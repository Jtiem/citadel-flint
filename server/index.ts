/**
 * Flint Glass Web Server — server/index.ts
 *
 * An Express + WebSocket server that replaces Electron's main process for
 * running Flint Glass in any browser. All window.flintAPI.* calls arrive at
 * POST /api/ipc and are dispatched to handler functions that mirror the
 * ipcMain.handle() registrations in electron/main.ts.
 *
 * Push events are broadcast over WebSocket (ws://host/ws).
 *
 * This module exports startServer() — it does not auto-start. The CLI
 * (server/cli.ts) or tests call startServer() with options.
 */

import { computeExpiresAt, type DeferDuration } from '../shared/deferralUtils'
import { RENDERER_ALLOWED_MCP_TOOLS } from '../shared/mcp-allowed-tools'
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  watch as fsWatch,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import Database from 'better-sqlite3'
import { transformSync } from '@babel/core'
import {
  jsxAttribute,
  jsxIdentifier,
  stringLiteral,
} from '@babel/types'
import type { JSXOpeningElement } from '@babel/types'
import type { NodePath } from '@babel/traverse'
import { fileURLToPath } from 'node:url'
import { createPreviewServer } from './services/previewServer.js'
import { ideFileSyncTick, type IDEFileSyncState } from './ideFileSyncTick.js'
import { detectProjectEnvironment, type DetectorFS } from '../shared/projectDetector.js'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Types ────────────────────────────────────────────────────────────────────

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

interface StartServerOptions {
  projectRoot: string
  port?: number
}

interface ServerInstance {
  app: express.Application
  server: http.Server
  wss: WebSocketServer
  close: () => Promise<void>
}

// ── Constants ────────────────────────────────────────────────────────────────

const BRAND = {
  product: 'Flint',
  configDir: '.flint',
  manifestFile: 'flint-manifest.json',
  logPrefix: '[Flint]',
  ipcPrefix: 'flint:',
  dataIdAttr: 'data-flint-id',
} as const

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'dist-electron', '.git', '.next',
  'build', 'out', 'coverage', '.turbo', '.cache',
])

// ── File Scanning ────────────────────────────────────────────────────────────

async function scanDirectory(dirPath: string): Promise<FileTreeNode> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const children: FileTreeNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      const subtree = await scanDirectory(fullPath)
      if ((subtree.children?.length ?? 0) > 0) {
        children.push(subtree)
      }
    } else if (entry.isFile() && /\.(tsx?|jsx?|html?)$/.test(entry.name)) {
      children.push({ name: entry.name, path: fullPath, type: 'file' })
    }
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return { name: path.basename(dirPath), path: dirPath, type: 'directory', children }
}

// ── Security Helpers ─────────────────────────────────────────────────────────

function isWithinHome(filePath: string): boolean {
  const home = os.homedir()
  const resolved = path.resolve(filePath)
  if (resolved === home || resolved.startsWith(home + path.sep)) return true
  // Allow OS temp directory — demo projects are copied there by beta:load-demo-project.
  // realpathSync resolves macOS /tmp → /private/tmp symlink so the prefix check works.
  try {
    const resolvedReal = realpathSync(resolved)
    const tmpReal = realpathSync(os.tmpdir())
    if (resolvedReal.startsWith(tmpReal + path.sep)) return true
  } catch { /* path doesn't exist yet — fall through to false */ }
  return false
}

function validateFilePath(filePath: unknown, requireSourceExt = true): string {
  if (typeof filePath !== 'string') {
    throw new TypeError('filePath must be a string')
  }
  if (!path.isAbsolute(filePath)) {
    throw new Error('filePath must be an absolute path')
  }
  if (requireSourceExt && !/\.(tsx?|jsx?|html?)$/.test(filePath)) {
    throw new Error('filePath must point to a source file (.tsx/.ts/.jsx/.js/.html)')
  }
  const resolved = path.resolve(filePath)
  // Resolve symlinks to prevent escape via symlink chains.
  // Falls through to the logical-path check for files that don't exist yet (writes).
  let realFilePath = resolved
  try { realFilePath = realpathSync(resolved) } catch { /* file may not exist yet for writes */ }
  if (!isWithinHome(realFilePath)) {
    throw new Error('path outside user home directory is not permitted')
  }
  // Return the resolved canonical path, not the raw input — prevents path
  // traversal sequences from reaching downstream fs operations.
  return resolved
}

// ── Atomic File Write ────────────────────────────────────────────────────────
// Mirrors FileTransactionManager: write to .tmp, then rename.

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  // Use a unique temp name to prevent races when multiple concurrent calls
  // target the same file — without this, call A's rename can steal call B's .tmp.
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmpPath, content, 'utf-8')
  await fs.rename(tmpPath, filePath)
}

// ── Flint ID Babel Plugin ────────────────────────────────────────────────────
// Identical to the one in electron/main.ts — injects data-flint-id on every
// JSXOpeningElement during preview compilation.

function injectFlintIdPlugin() {
  return {
    visitor: {
      JSXOpeningElement(nodePath: NodePath<JSXOpeningElement>): void {
        const loc = nodePath.node.loc
        if (loc == null) return

        const nameNode = nodePath.node.name
        let tagName: string
        if (nameNode.type === 'JSXIdentifier') {
          tagName = nameNode.name
        } else if (nameNode.type === 'JSXMemberExpression') {
          const obj =
            nameNode.object.type === 'JSXIdentifier'
              ? nameNode.object.name
              : '?'
          tagName = `${obj}.${nameNode.property.name}`
        } else {
          tagName = 'unknown'
        }

        const flintId = `${tagName}:${loc.start.line}:${loc.start.column}`

        const alreadySet = nodePath.node.attributes.some((attr) => {
          if (attr.type !== 'JSXAttribute') return false
          const name = attr.name
          return name.type === 'JSXIdentifier' && name.name === 'data-flint-id'
        })
        if (alreadySet) return

        nodePath.node.attributes.push(
          jsxAttribute(
            jsxIdentifier('data-flint-id'),
            stringLiteral(flintId),
          ),
        )
      },
    },
  }
}

// ── Database Initialization ──────────────────────────────────────────────────
// Creates the same schema as electron/store.ts but stored in the project's
// .flint/ directory instead of Electron's userData path.

function initProjectDatabase(projectRoot: string): Database.Database {
  const flintDir = path.join(projectRoot, BRAND.configDir)
  mkdirSync(flintDir, { recursive: true })

  const dbPath = path.join(flintDir, 'flint.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // ── Static tables ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_state (
      key         TEXT    PRIMARY KEY,
      value       TEXT    NOT NULL,
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS assets_cache (
      id          TEXT    PRIMARY KEY,
      base64_data TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS component_mappings (
      id               TEXT    PRIMARY KEY,
      figma_node_id    TEXT    NOT NULL,
      react_component  TEXT    NOT NULL,
      created_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `)

  // ── design_tokens (v3 schema) ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      token_path      TEXT    NOT NULL,
      token_type      TEXT    NOT NULL,
      token_value     TEXT    NOT NULL,
      description     TEXT,
      mode            TEXT    NOT NULL DEFAULT 'default',
      collection_name TEXT    NOT NULL DEFAULT 'default',
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      version         TEXT,
      last_modified   INTEGER,
      UNIQUE(token_path, mode, collection_name)
    );
  `)

  // ── presence table ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS presence (
      id         TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL,
      node_id    TEXT    NOT NULL DEFAULT '',
      x          REAL    NOT NULL DEFAULT 0,
      y          REAL    NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `)

  // ── component_overrides (v2 schema) ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS component_overrides (
      flint_id       TEXT    NOT NULL,
      property_key   TEXT    NOT NULL,
      property_value TEXT    NOT NULL,
      updated_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (flint_id, property_key)
    );
  `)

  // ── violation_baselines ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS violation_baselines (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path      TEXT    NOT NULL,
      node_id        TEXT    NOT NULL,
      rule_id        TEXT    NOT NULL,
      severity       TEXT    NOT NULL,
      snapshot_value TEXT,
      created_at     INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(file_path, node_id, rule_id)
    );
  `)

  // ── governance_events ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS governance_events (
      id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      timestamp   TEXT    NOT NULL    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      event_type  TEXT    NOT NULL,
      rule_id     TEXT    NOT NULL,
      severity    TEXT    NOT NULL,
      node_id     TEXT,
      file_path   TEXT    NOT NULL,
      message     TEXT,
      session_id  TEXT,
      actor       TEXT    NOT NULL    DEFAULT 'system',
      metadata    TEXT    NOT NULL    DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_gov_events_timestamp ON governance_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_gov_events_rule      ON governance_events(rule_id);
    CREATE INDEX IF NOT EXISTS idx_gov_events_file      ON governance_events(file_path);
    CREATE INDEX IF NOT EXISTS idx_gov_events_type      ON governance_events(event_type);
  `)

  // ── deferred_violations ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS deferred_violations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path   TEXT    NOT NULL,
      rule_id     TEXT    NOT NULL,
      node_id     TEXT,
      reason      TEXT,
      duration    TEXT,
      expires_at  TEXT,
      session_id  TEXT,
      deferred_at TEXT    NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      UNIQUE(file_path, rule_id, node_id)
    );
  `)

  // ── Schema migration: add duration + expires_at to existing DBs ──────────
  {
    const cols = db.pragma('table_info(deferred_violations)') as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    if (!colNames.has('duration')) {
      db.exec('ALTER TABLE deferred_violations ADD COLUMN duration TEXT')
    }
    if (!colNames.has('expires_at')) {
      db.exec('ALTER TABLE deferred_violations ADD COLUMN expires_at TEXT')
    }
  }

  // ── RAG chunks (no sqlite-vec in web mode — just the metadata table) ──────
  db.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      content     TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT '',
      chunk_type  TEXT    NOT NULL DEFAULT 'documentation',
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `)

  console.log(`${BRAND.logPrefix} Project database ready at: ${dbPath}`)
  return db
}

function initRegistryDatabase(): Database.Database {
  const flintDir = path.join(os.homedir(), BRAND.configDir)
  mkdirSync(flintDir, { recursive: true })

  const dbPath = path.join(flintDir, 'flint-registry.db')
  const registryDb = new Database(dbPath)
  registryDb.pragma('journal_mode = WAL')

  registryDb.exec(`
    CREATE TABLE IF NOT EXISTS recent_projects (
      id          TEXT    PRIMARY KEY,
      name        TEXT    NOT NULL,
      path        TEXT    NOT NULL UNIQUE,
      last_opened INTEGER NOT NULL
    );
  `)

  console.log(`${BRAND.logPrefix} Registry ready at: ${dbPath}`)
  return registryDb
}

// ── Preview Server singleton ──────────────────────────────────────────────────
// One instance per process — created once and reused for all handler calls.
const previewService = createPreviewServer()

// ── Server Factory ───────────────────────────────────────────────────────────

export async function startServer(options: StartServerOptions): Promise<ServerInstance> {
  const { projectRoot, port = 4201 } = options
  const resolvedRoot = path.resolve(projectRoot)

  if (!existsSync(resolvedRoot)) {
    throw new Error(`Project root does not exist: ${resolvedRoot}`)
  }

  // Active project root — mutable, same as Electron's module-level variable
  let activeProjectRoot: string = resolvedRoot
  // Original CLI root — immutable. Used by IDE sync to always find
  // ide-active-file.json even when activeProjectRoot changes (e.g. demo load).
  const serverRoot: string = resolvedRoot

  // Tracks whether the user has explicitly opened a project during this server
  // instance. Used by project:get-last-session to avoid auto-resuming the CLI
  // default root as if it were a persisted session.
  let sessionExplicitlyOpened = false

  // Session UUID for governance telemetry
  const governanceSessionId: string = randomUUID()

  // Initialize databases
  const db = initProjectDatabase(activeProjectRoot)
  const registryDb = initRegistryDatabase()

  // ── Prepared Statements: design_tokens ─────────────────────────────────────

  const stmtCreate = db.prepare<[string, string, string, string | null, string, string]>(`
    INSERT INTO design_tokens
      (token_path, token_type, token_value, description, mode, collection_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_path, mode, collection_name) DO UPDATE SET
      token_value = excluded.token_value,
      description = excluded.description,
      updated_at  = strftime('%s', 'now')
  `)

  const stmtReadAll = db.prepare(`
    SELECT id, token_path, token_type, token_value, description, mode, collection_name
    FROM design_tokens
    ORDER BY collection_name, mode, token_path
  `)

  const stmtDelete = db.prepare<[number]>('DELETE FROM design_tokens WHERE id = ?')
  const stmtClearAll = db.prepare('DELETE FROM design_tokens')

  // ── Prepared Statements: component_overrides ───────────────────────────────

  const stmtReadOverrides = db.prepare(`
    SELECT flint_id, property_key, property_value, updated_at
    FROM component_overrides
    ORDER BY updated_at DESC
  `)

  // ── Prepared Statements: presence ──────────────────────────────────────────

  const stmtUpsertPresence = db.prepare<[string, string, string, number, number]>(`
    INSERT INTO presence (id, user_id, node_id, x, y, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(id) DO UPDATE SET
      user_id    = excluded.user_id,
      node_id    = excluded.node_id,
      x          = excluded.x,
      y          = excluded.y,
      updated_at = strftime('%s', 'now')
  `)

  const stmtReadPresence = db.prepare(`
    SELECT id, user_id, node_id, x, y, updated_at
    FROM presence
    WHERE updated_at > strftime('%s', 'now') - 30
  `)

  // ── Prepared Statements: violation_baselines ───────────────────────────────

  const baselineUpsert = db.prepare<[string, string, string, string, string | null]>(`
    INSERT INTO violation_baselines (file_path, node_id, rule_id, severity, snapshot_value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(file_path, node_id, rule_id) DO UPDATE SET
      severity       = excluded.severity,
      snapshot_value = excluded.snapshot_value,
      created_at     = strftime('%s', 'now')
  `)

  const baselineSelect = db.prepare<[string]>(
    'SELECT file_path, node_id, rule_id, severity, snapshot_value FROM violation_baselines WHERE file_path = ?',
  )
  const baselineClear = db.prepare('DELETE FROM violation_baselines')
  const baselineIsSet = db.prepare('SELECT COUNT(*) as count FROM violation_baselines')

  // ── Prepared Statements: deferred_violations ───────────────────────────────

  const deferViolationUpsert = db.prepare<[string, string, string | null, string | null, string | null, string | null, string]>(`
    INSERT INTO deferred_violations (file_path, rule_id, node_id, reason, duration, expires_at, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_path, rule_id, node_id)
    DO UPDATE SET
      reason      = excluded.reason,
      duration    = excluded.duration,
      expires_at  = excluded.expires_at,
      session_id  = excluded.session_id,
      deferred_at = datetime('now'),
      resolved_at = NULL
  `)

  const deferViolationSelectUnresolved = db.prepare(
    `SELECT id, file_path, rule_id, node_id, reason, duration, expires_at, session_id, deferred_at
     FROM deferred_violations
     WHERE resolved_at IS NULL
     ORDER BY deferred_at DESC`,
  )

  const deferViolationResolve = db.prepare<[string, string, string | null, string | null]>(`
    UPDATE deferred_violations
    SET resolved_at = datetime('now')
    WHERE file_path = ? AND rule_id = ? AND (node_id = ? OR (node_id IS NULL AND ? IS NULL)) AND resolved_at IS NULL
  `)

  // ── Prepared Statements: governance_events ─────────────────────────────────

  const govInsert = db.prepare(`
    INSERT INTO governance_events (event_type, rule_id, severity, file_path, actor, session_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const govOverrideCount = db.prepare<[string]>(
    "SELECT COUNT(*) as count FROM governance_events WHERE event_type = 'override' AND session_id = ?",
  )

  // ── Prepared Statements: registry ──────────────────────────────────────────

  const registryUpsert = registryDb.prepare<[string, string, string]>(`
    INSERT INTO recent_projects (id, name, path, last_opened)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(path) DO UPDATE SET
      name        = excluded.name,
      last_opened = strftime('%s', 'now')
  `)

  const registryGetRecent = registryDb.prepare(`
    SELECT id, name, path, last_opened
    FROM recent_projects
    ORDER BY last_opened DESC
    LIMIT 10
  `)

  const registryRemove = registryDb.prepare<[string]>(
    'DELETE FROM recent_projects WHERE id = ?',
  )

  // ── Prepared Statements: context enrichment ────────────────────────────────

  const stmtTokenCount = db.prepare('SELECT COUNT(*) AS count FROM design_tokens')
  const stmtOverrideCount = db.prepare('SELECT COUNT(*) AS count FROM component_overrides')

  // ── WebSocket Setup ────────────────────────────────────────────────────────

  // Generate a per-session token for WebSocket authentication.
  // The token is served via GET /api/ws-token so the browser can include it
  // as a query param on the WS upgrade request.
  const wsSessionToken = randomUUID()

  const app = express()
  app.use(express.json({ limit: '10mb' }))

  // Expose the session token to the SPA — only reachable from localhost.
  app.get('/api/ws-token', (_req, res) => {
    res.json({ token: wsSessionToken })
  })

  const server = http.createServer(app)
  const wss = new WebSocketServer({ noServer: true })

  // Authenticate WebSocket upgrades: require ?token=<wsSessionToken>
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }
    const token = url.searchParams.get('token')
    if (token !== wsSessionToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })

  function broadcast(channel: string, data: unknown): void {
    const message = JSON.stringify({ channel, data })
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }

  // When a new Glass tab connects, push the current IDE file immediately.
  // This fixes the "tab close + reopen" scenario where the server's lastPath
  // dedup would otherwise prevent re-broadcasting the active file.
  wss.on('connection', (clientWs) => {
    if (ideFileSyncState.lastPath) {
      const msg = JSON.stringify({
        channel: 'flint:ide-file-selected',
        data: { path: ideFileSyncState.lastPath },
      })
      clientWs.send(msg)
    }
  })

  function broadcastTokensUpdated(): void {
    broadcast('flint:tokens-updated', {})
  }

  // ── Handler Map ────────────────────────────────────────────────────────────

  const handlers = new Map<string, (...args: any[]) => Promise<any> | any>()

  // ── Priority 1: Core experience ────────────────────────────────────────────

  handlers.set('ping', async () => 'pong from Web Server')

  // ── Token CRUD ─────────────────────────────────────────────────────────────

  handlers.set('tokens:create', async (token: unknown) => {
    if (
      typeof token !== 'object' || token === null ||
      typeof (token as any).token_path !== 'string' ||
      typeof (token as any).token_type !== 'string' ||
      typeof (token as any).token_value !== 'string'
    ) {
      throw new Error('tokens:create — invalid payload shape')
    }
    const t = token as {
      token_path: string; token_type: string; token_value: string
      description?: string; mode?: string; collection_name?: string
    }
    const mode = typeof t.mode === 'string' && t.mode.trim() !== '' ? t.mode : 'default'
    const collectionName =
      typeof t.collection_name === 'string' && t.collection_name.trim() !== ''
        ? t.collection_name
        : 'default'

    const result = stmtCreate.run(
      t.token_path, t.token_type, t.token_value,
      t.description ?? null, mode, collectionName,
    )
    broadcastTokensUpdated()
    return { id: result.lastInsertRowid }
  })

  handlers.set('tokens:read-all', async () => stmtReadAll.all())

  handlers.set('tokens:update', async (tokenPath: unknown, updates: unknown) => {
    if (typeof tokenPath !== 'string' || tokenPath.trim() === '') {
      throw new Error('tokens:update — tokenPath must be a non-empty string')
    }
    if (typeof updates !== 'object' || updates === null) {
      throw new Error('tokens:update — updates must be an object')
    }
    const u = updates as Record<string, unknown>
    const setClauses: string[] = []
    const params: (string | null)[] = []

    if (typeof u.token_type === 'string') { setClauses.push('token_type = ?'); params.push(u.token_type) }
    if (typeof u.token_value === 'string') { setClauses.push('token_value = ?'); params.push(u.token_value) }
    if ('description' in u) {
      setClauses.push('description = ?')
      params.push(typeof u.description === 'string' ? u.description : null)
    }
    if (setClauses.length === 0) {
      throw new Error('tokens:update — at least one field must be provided')
    }
    setClauses.push("updated_at = strftime('%s', 'now')")

    const sql = `UPDATE design_tokens SET ${setClauses.join(', ')} WHERE token_path = ?`
    const result = db.prepare(sql).run(...params, tokenPath)
    broadcastTokensUpdated()
    return { changes: result.changes }
  })

  handlers.set('tokens:delete', async (id: unknown) => {
    if (typeof id !== 'number' || !Number.isInteger(id)) {
      throw new Error('tokens:delete — id must be an integer')
    }
    const result = stmtDelete.run(id)
    broadcastTokensUpdated()
    return { changes: result.changes }
  })

  handlers.set('tokens:clear-all', async () => {
    const result = stmtClearAll.run()
    console.log(`${BRAND.logPrefix} tokens:clear-all: removed ${result.changes} tokens`)
    broadcastTokensUpdated()
    return { changes: result.changes }
  })

  // ── Component Overrides ────────────────────────────────────────────────────

  handlers.set('tokens:clear-override', async (flintId: unknown) => {
    if (typeof flintId !== 'string' || flintId.length === 0) return
    db.prepare('DELETE FROM component_overrides WHERE flint_id = ?').run(flintId)
  })

  handlers.set('tokens:upsert-override', async (flintId: unknown, propertyKey: unknown, propertyValue: unknown) => {
    if (
      typeof flintId !== 'string' || flintId.length === 0 ||
      typeof propertyKey !== 'string' || propertyKey.length === 0 ||
      typeof propertyValue !== 'string'
    ) return
    db.prepare(
      `INSERT OR REPLACE INTO component_overrides
        (flint_id, property_key, property_value, updated_at)
       VALUES (?, ?, ?, strftime('%s','now'))`,
    ).run(flintId, propertyKey, propertyValue)
  })

  handlers.set('tokens:read-overrides', async () => stmtReadOverrides.all())

  // ── File I/O ───────────────────────────────────────────────────────────────

  handlers.set('file:read', async (filePath: unknown) => {
    const validated = validateFilePath(filePath)
    return fs.readFile(validated, 'utf-8')
  })

  handlers.set('ast:save-file', async (filePath: unknown, content: unknown) => {
    if (typeof content !== 'string') {
      throw new TypeError('ast:save-file — content must be a string')
    }
    const validated = validateFilePath(filePath)
    // Reject writes to temp dirs — macOS cleans these up and the rename step
    // in atomicWrite produces ENOENT floods that obscure real errors.
    if (validated.startsWith('/var/folders/') || validated.startsWith('/tmp/')) {
      throw new Error(`ast:save-file — refusing write to temp dir: ${validated}`)
    }
    // Self-hosting guard: refuse to write files that live inside the Flint
    // source tree itself. When dev:web runs from the repo root, a write to
    // e.g. src/App.tsx or demos/demo-before.tsx updates its mtime → Vite HMR
    // fires → full reload → autoResumeChecked resets → loop.
    //
    // IMPORTANT: use serverRoot (original CLI root, immutable) not activeProjectRoot.
    // After openPath() loads a demo into a temp dir, activeProjectRoot changes to
    // that temp dir — but the Flint source files (e.g. demos/*.tsx opened via IDE
    // sync) still live under serverRoot. The old check used activeProjectRoot, so
    // it stopped protecting source files once a demo project was loaded.
    if (existsSync(path.join(serverRoot, 'electron', 'main.ts')) &&
        validated.startsWith(serverRoot + path.sep)) {
      console.warn(`${BRAND.logPrefix} ast:save-file — refusing self-hosted write to ${validated}`)
      return
    }
    await atomicWrite(validated, content)
    // Register newly saved files with the workspace watcher so future
    // external edits are detected without a full rescan.
    const tracked = (globalThis as Record<string, unknown>).__flintWebTrackedFiles as Map<string, number> | undefined
    if (tracked && !tracked.has(validated)) {
      try {
        const stat = await fs.stat(validated)
        tracked.set(validated, stat.mtimeMs)
      } catch { /* file may not be flushed yet — watcher will pick it up on next scan */ }
    }
  })

  handlers.set('ast:save-batch', async (batch: unknown) => {
    if (typeof batch !== 'object' || batch === null || Array.isArray(batch)) {
      throw new TypeError('ast:save-batch — batch must be a plain object')
    }
    const entries = Object.entries(batch as Record<string, unknown>)
    const validated = new Map<string, string>()

    for (const [filePath, content] of entries) {
      if (typeof content !== 'string') {
        throw new TypeError(`ast:save-batch — content for "${filePath}" must be a string`)
      }
      const v = validateFilePath(filePath)
      validated.set(v, content)
    }

    // Self-hosting guard: same protection as ast:save-file — use serverRoot so
    // the check holds even after activeProjectRoot changes (e.g. demo load).
    const serverRootIsFlint = existsSync(path.join(serverRoot, 'electron', 'main.ts'))
    const safeEntries = serverRootIsFlint
      ? [...validated.entries()].filter(([fp]) => {
          if (fp.startsWith(serverRoot + path.sep)) {
            console.warn(`${BRAND.logPrefix} ast:save-batch — refusing self-hosted write to ${fp}`)
            return false
          }
          return true
        })
      : [...validated.entries()]

    await Promise.all(safeEntries.map(([fp, content]) => atomicWrite(fp, content)))
  })

  // ── Code Transform ─────────────────────────────────────────────────────────

  handlers.set('code:transform', async (code: unknown) => {
    if (typeof code !== 'string') {
      return { js: null, error: 'code must be a string' }
    }
    // Bail early on empty input — nothing to transform. Returning an error
    // string here lets the client distinguish "empty source" from "valid JS
    // with no default export", which would also produce js=''. The client
    // guards against js.trim()=='' separately.
    if (code.trim() === '') {
      return { js: null, error: 'empty source' }
    }
    try {
      const result = transformSync(code, {
        filename: 'App.tsx',
        sourceType: 'module',
        plugins: [
          ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
          injectFlintIdPlugin,
          ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
        ],
        configFile: false,
        babelrc: false,
        sourceMaps: false,
      })

      if (result === null || result.code == null) {
        return { js: null, error: 'Babel returned no output' }
      }

      let js = result.code

      // Strip ES module import statements — React will be a global in the iframe
      js = js.replace(/^import\s[^\n]*\n?/gm, '')

      // ── Detect component name from export statements ──────────────────
      // Priority: export default > first named export function/class
      let componentName: string | null = null

      // 1. Rewrite `export default function/class Foo` -> `function/class Foo`
      js = js.replace(
        /\bexport\s+default\s+(function|class)\s+(\w+)/,
        (_m: string, kw: string, name: string) => {
          componentName = name
          return `${kw} ${name}`
        },
      )

      // 2. Fallback: `export default Foo`
      if (componentName === null) {
        js = js.replace(
          /^export\s+default\s+(\w+)\s*;?\s*$/m,
          (_m: string, name: string) => {
            componentName = name
            return ''
          },
        )
      }

      // 3. No default export — capture the first named export function/class
      //    as the component to render. This handles files like
      //    `export function PatientForm() {}` (common in demos and libraries).
      if (componentName === null) {
        const namedMatch = js.match(/^export\s+(?:async\s+)?(function|class)\s+(\w+)/m)
        if (namedMatch) {
          componentName = namedMatch[2]
        }
      }

      // Strip named export declarations — `export function Foo`, `export class Foo`,
      // `export const/let/var`, `export { Foo }`, `export * from '...'`.
      // These are all invalid inside `new Function()` (non-module script context).
      js = js.replace(/^export\s+\{[^}]*\}\s*(?:from\s+['"][^'"]*['"])?\s*;?\n?/gm, '') // export { Foo } / export { Foo } from '...'
      js = js.replace(/^export\s+\*\s*(?:from\s+['"][^'"]*['"])?\s*;?\n?/gm, '')          // export * / export * from '...'
      js = js.replace(/^export\s+((?:async\s+)?function|class)\s+/gm, '$1 ')              // export function/class Foo → function/class Foo
      js = js.replace(/^export\s+(const|let|var)\s+/gm, '$1 ')                            // export const/let/var → const/let/var

      if (componentName !== null) {
        js += `\nwindow.__AppComponent = ${componentName};`
      }

      return { js, error: null }
    } catch (err) {
      return { js: null, error: String(err) }
    }
  })

  handlers.set('code:transform-vue', async (code: unknown) => {
    if (typeof code !== 'string') {
      return { js: null, css: '', error: 'code must be a string' }
    }
    try {
      const { compileVueSFC } = await import(
        path.resolve(process.cwd(), 'electron', 'vueCompiler.js')
      )
      return await compileVueSFC(code)
    } catch (err) {
      return { js: null, css: '', error: `Vue compiler not available: ${String(err)}` }
    }
  })

  handlers.set('code:transform-svelte', async (code: unknown) => {
    if (typeof code !== 'string') {
      return { js: null, css: '', error: 'code must be a string' }
    }
    try {
      const { compileSvelteComponent } = await import(
        path.resolve(process.cwd(), 'electron', 'svelteCompiler.js')
      )
      return await compileSvelteComponent(code)
    } catch (err) {
      return { js: null, css: '', error: `Svelte compiler not available: ${String(err)}` }
    }
  })

  // ── Project / Directory Operations ─────────────────────────────────────────

  handlers.set('project:openPath', async (folderPath: unknown) => {
    if (typeof folderPath !== 'string') return null

    const normalized = path.normalize(folderPath)
    // Resolve symlinks before the home-dir check to prevent symlink escape
    // (e.g., ~/evil -> /etc would pass the prefix check on the symlink path).
    let realPath = normalized
    try { realPath = realpathSync(normalized) } catch { /* dir may not exist */ }
    if (!isWithinHome(realPath)) return null

    try {
      const tree = await scanDirectory(normalized)
      const projectName = path.basename(normalized)
      registryUpsert.run(randomUUID(), projectName, normalized)
      const previousRoot = activeProjectRoot
      activeProjectRoot = normalized
      sessionExplicitlyOpened = true
      void (globalThis as Record<string, unknown>).__flintWebStartFileWatcher?.()
      ;(globalThis as Record<string, unknown>).__flintIDEFileSyncStart?.()
      // Notify all connected Glass clients that the active project changed.
      // This allows Glass to re-open the correct project when the project is
      // opened externally (e.g. via the demo script or CLI curl call).
      if (previousRoot !== normalized) {
        broadcast('flint:project-opened', { path: normalized })
      }
      return tree
    } catch {
      return null
    }
  })

  // ── project:findRootForFile ─────────────────────────────────────────────────
  // Web-build parity for the Electron project:findRootForFile IPC handler.
  handlers.set('project:findRootForFile', (filePath: unknown): string | null => {
    if (typeof filePath !== 'string') return null

    const home = os.homedir()
    let dir = path.dirname(path.normalize(filePath))

    for (let i = 0; i < 20; i++) {
      if (!dir.startsWith(home)) break

      if (existsSync(path.join(dir, 'package.json')) || existsSync(path.join(dir, '.flint'))) {
        // Self-hosting guard: never return the Flint source tree as a project root.
        // Prevents iframe recursion when the web server is run from the repo root.
        if (existsSync(path.join(dir, 'electron', 'main.ts'))) return null
        return dir
      }

      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }

    return null
  })

  handlers.set('project:create-scratchpad', async () => {
    const flintProjectsDir = path.join(os.homedir(), `${BRAND.product} Projects`)
    await fs.mkdir(flintProjectsDir, { recursive: true })

    let existing: string[] = []
    try { existing = await fs.readdir(flintProjectsDir) } catch { /* ok */ }
    let counter = 1
    while (existing.includes(`Untitled-${counter}`)) counter++
    const projectName = `Untitled-${counter}`
    const targetPath = path.join(flintProjectsDir, projectName)
    await fs.mkdir(targetPath)

    // Scaffold from bundled template (same as Electron's initializeProject)
    const templateDir = path.resolve(__dirname, '..', 'electron', 'templates', 'base-vite-tailwind')
    if (existsSync(templateDir)) {
      const { cpSync } = await import('node:fs')
      cpSync(templateDir, targetPath, { recursive: true, force: true })
    }

    // Ensure .flint/ config directory exists with starter files
    const flintDir = path.join(targetPath, BRAND.configDir)
    await fs.mkdir(flintDir, { recursive: true })
    if (!existsSync(path.join(flintDir, 'design-tokens.json'))) {
      await atomicWrite(path.join(flintDir, 'design-tokens.json'), '[]\n')
    }
    if (!existsSync(path.join(flintDir, 'policy.json'))) {
      await atomicWrite(path.join(flintDir, 'policy.json'), JSON.stringify({
        version: 1,
        mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 10.0, mode: 'enforce', ignore_patterns: [] },
        a11y: { level: 'AA', mode: 'enforce', disabled_rules: [] },
        export_gate: { block_on_mithril: true, block_on_a11y: true, block_on_overrides: true },
        baseline: { enabled: false },
      }, null, 2) + '\n')
    }

    registryUpsert.run(randomUUID(), projectName, targetPath)
    activeProjectRoot = targetPath
    sessionExplicitlyOpened = true
    void (globalThis as Record<string, unknown>).__flintWebStartFileWatcher?.()
    ;(globalThis as Record<string, unknown>).__flintIDEFileSyncStart?.()

    // Start MCP for the new project
    void mcp.start(targetPath).catch((err: unknown) => {
      console.error(`${BRAND.logPrefix} project:initialize: MCP server failed to start —`, err instanceof Error ? err.message : err)
    })

    return scanDirectory(targetPath)
  })

  handlers.set('project:get-last-session', async () => {
    // In web mode there is no persistent session storage. Only return a session
    // if the user has explicitly opened a project during this server instance
    // (i.e. activeProjectRoot was changed from the CLI default by openPath,
    // createScratchpad, or initialize). Returning the CLI default root
    // unconditionally caused a race: the auto-resume effect in App.tsx would
    // call project.openPath() concurrently with any user-initiated open,
    // resulting in two competing hydrateWorkspace calls that oscillated
    // workspaceFiles back and forth — the LaunchScreen loop bug.
    if (!sessionExplicitlyOpened) return null
    // Don't restore temp dir sessions — macOS cleans these up and restoring
    // them causes ENOENT floods when Glass auto-saves to the dead directory.
    if (activeProjectRoot.startsWith('/var/folders/') || activeProjectRoot.startsWith('/tmp/')) {
      return null
    }
    return {
      path: activeProjectRoot,
      name: path.basename(activeProjectRoot),
      isScratchpad: /Flint Projects\/Untitled/i.test(activeProjectRoot),
    }
  })

  // ── project:get-active-root ───────────────────────────────────────────────
  // Returns the server's current activeProjectRoot so Glass can auto-open the
  // project on startup without requiring the user to select a folder.
  handlers.set('project:get-active-root', async () => {
    // Don't expose temp dirs — they get cleaned by macOS and cause ENOENT floods
    if (activeProjectRoot.startsWith('/var/folders/') || activeProjectRoot.startsWith('/tmp/')) {
      return { projectRoot: null }
    }
    // Self-hosting guard: when dev:web is launched from the Flint repo root
    // (no --project flag), activeProjectRoot IS the Flint source tree. Returning
    // it causes tryAutoResume in App.tsx to open src/App.tsx as the active file,
    // which calls setCode → triggerAutoSave → writes the file back to disk →
    // Vite detects the mtime change → HMR fires → page reloads → loop.
    if (existsSync(path.join(activeProjectRoot, 'electron', 'main.ts'))) {
      return { projectRoot: null }
    }
    return { projectRoot: activeProjectRoot }
  })

  // ── mcp:get-recent-file-focus ─────────────────────────────────────────────
  // Web-build parity. Checks the active project's mcp-events.jsonl for a
  // file:focus event within the last 60 seconds.
  handlers.set('mcp:get-recent-file-focus', (): string | null => {
    const THRESHOLD_MS = 60_000
    const now = Date.now()
    const home = os.homedir()
    const eventsFile = path.join(activeProjectRoot, '.flint', 'mcp-events.jsonl')
    if (!existsSync(eventsFile)) return null

    try {
      const content = readFileSync(eventsFile, 'utf-8')
      const lines = content.trimEnd().split('\n').slice(-100)
      let best: { filePath: string; timestamp: number } | null = null

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as {
            type?: string
            timestamp?: number
            filePath?: string
            summary?: string
          }
          if (event.type !== 'file:focus') continue
          const ts = typeof event.timestamp === 'number' ? event.timestamp : 0
          if (now - ts > THRESHOLD_MS) continue
          // Only accept filePath — summary is human-readable text, not a path.
          const fp = event.filePath
          if (!fp || !path.isAbsolute(fp) || !fp.startsWith(home)) continue
          if (!best || ts > best.timestamp) best = { filePath: fp, timestamp: ts }
        } catch { /* malformed line — skip */ }
      }

      return best?.filePath ?? null
    } catch {
      return null
    }
  })

  handlers.set('project:initialize', async (payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).targetPath !== 'string' ||
      typeof (payload as any).templateId !== 'string'
    ) {
      throw new TypeError('project:initialize — invalid payload shape')
    }
    const { targetPath } = payload as { targetPath: string; templateId: string }
    validateFilePath(targetPath, false)

    // Create directory and scaffold
    await fs.mkdir(targetPath, { recursive: true })
    const flintDir = path.join(targetPath, BRAND.configDir)
    await fs.mkdir(flintDir, { recursive: true })

    // Write the same starter config files that Electron writes
    await atomicWrite(path.join(flintDir, 'design-tokens.json'), '[]\n')
    await atomicWrite(path.join(flintDir, 'policy.json'), JSON.stringify({
      version: 1,
      mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 10.0, mode: 'enforce', ignore_patterns: [] },
      a11y: { level: 'AA', mode: 'enforce', disabled_rules: [] },
      export_gate: { block_on_mithril: true, block_on_a11y: true, block_on_overrides: true },
      baseline: { enabled: false },
    }, null, 2) + '\n')

    const projectName = path.basename(targetPath)
    registryUpsert.run(randomUUID(), projectName, targetPath)
    activeProjectRoot = targetPath
    sessionExplicitlyOpened = true
    void (globalThis as Record<string, unknown>).__flintWebStartFileWatcher?.()
    ;(globalThis as Record<string, unknown>).__flintIDEFileSyncStart?.()
    void mcp.start(targetPath).catch((err: unknown) => {
      console.error(`${BRAND.logPrefix} project:openPath: MCP server failed to start —`, err instanceof Error ? err.message : err)
    })

    return scanDirectory(targetPath)
  })

  handlers.set('project:reset-to-demo', async (targetPath: unknown) => {
    if (typeof targetPath !== 'string') {
      throw new TypeError('project:reset-to-demo — targetPath must be a string')
    }
    validateFilePath(targetPath, false)

    // Copy the bundled demo template over the target path, same as Electron's injectDemoState
    const templateDir = path.resolve(__dirname, '..', 'electron', 'templates', 'flint-demo')
    if (existsSync(templateDir)) {
      const { cpSync } = await import('node:fs')
      cpSync(templateDir, targetPath, { recursive: true, force: true })
    }

    // Ensure .flint/ config exists with starter files
    const flintDir = path.join(targetPath, BRAND.configDir)
    mkdirSync(flintDir, { recursive: true })
    if (!existsSync(path.join(flintDir, 'design-tokens.json'))) {
      await atomicWrite(path.join(flintDir, 'design-tokens.json'), '[]\n')
    }
    if (!existsSync(path.join(flintDir, 'policy.json'))) {
      await atomicWrite(path.join(flintDir, 'policy.json'), JSON.stringify({
        version: 1,
        mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 10.0, mode: 'enforce', ignore_patterns: [] },
        a11y: { level: 'AA', mode: 'enforce', disabled_rules: [] },
        export_gate: { block_on_mithril: true, block_on_a11y: true, block_on_overrides: true },
        baseline: { enabled: false },
      }, null, 2) + '\n')
    }

    return scanDirectory(targetPath)
  })

  // ── project:detect-environment (FORGE.2a–2c) ─────────────────────────────
  // Detects the project's UI framework, CSS framework, token format, TypeScript,
  // and component library by reading package.json and checking for config files.
  // Writes the result to .flint/detected-environment.json and runs a best-effort
  // baseline audit via MCP if connected.
  handlers.set('project:detect-environment', async () => {
    if (!activeProjectRoot) return null
    // Skip temp dirs — macOS cleans these up, causing ENOENT floods
    if (activeProjectRoot.startsWith('/var/folders/') || activeProjectRoot.startsWith('/tmp/')) return null

    const root = activeProjectRoot

    // ── FORGE.2a: Detect via shared projectDetector ───────────────────
    const detectorFs: DetectorFS = {
      readFile: (fp: string, enc: 'utf-8') => fs.readFile(fp, enc),
      exists: (fp: string) => existsSync(fp),
    }

    const result = await detectProjectEnvironment(root, detectorFs)

    // Write detection result to .flint/
    try {
      const flintDir = path.join(root, '.flint')
      if (!existsSync(flintDir)) {
        await fs.mkdir(flintDir, { recursive: true })
      }
      await atomicWrite(
        path.join(flintDir, 'detected-environment.json'),
        JSON.stringify(result, null, 2),
      )
    } catch (err) {
      console.error(`${BRAND.logPrefix} FORGE.2b: Failed to write detected-environment.json:`, err)
    }

    // Best-effort baseline audit via MCP
    try {
      if (mcp.status().connected) {
        let auditFile: string | null = null
        const candidates = ['src/App.tsx', 'src/app.tsx', 'src/index.tsx', 'src/main.tsx', 'pages/index.tsx']
        for (const c of candidates) {
          const full = path.join(root, c)
          if (existsSync(full)) {
            auditFile = full
            break
          }
        }

        if (auditFile) {
          const rawResult = await mcp.callTool('audit_ui_component', { file: auditFile })
          if (rawResult?.content?.[0]?.text) {
            try {
              const auditData = JSON.parse(rawResult.content[0].text as string) as {
                violations?: unknown[]
                summary?: { grade?: string; totalViolations?: number }
              }
              const violations = auditData.summary?.totalViolations
                ?? (auditData.violations as unknown[] | undefined)?.length
                ?? 0
              const grade = auditData.summary?.grade ?? 'N/A'
              result.auditSummary = { violations, grade }
            } catch {
              // Audit result was not valid JSON — skip
            }
          }
        }
      }
    } catch (err) {
      console.error(`${BRAND.logPrefix} FORGE.2c: Baseline audit failed (non-blocking):`, err)
    }

    // Best-effort auto-configure side-effect
    try {
      const libName = result.componentLibrary?.name
      if (mcp.status().connected && libName) {
        await mcp.callTool('flint_set_library', { library: libName })
          .catch((err: unknown) => {
            console.error(`${BRAND.logPrefix} FORGE.2b: flint_set_library failed (non-blocking):`, err)
          })
      }
      if (mcp.status().connected) {
        await mcp.callTool('flint_reindex_registry', { projectRoot: activeProjectRoot })
          .catch((err: unknown) => {
            console.error(`${BRAND.logPrefix} FORGE.2b: flint_reindex_registry failed (non-blocking):`, err)
          })
      }
    } catch {
      // swallow — detection result is still returned even if auto-config fails
    }

    return result
  })

  // ── project:get-health-grade (FORGE.4b) ───────────────────────────────────
  // Reads the cached debt snapshot for a project and returns its health grade.
  handlers.set('project:get-health-grade', async (projectPath: unknown) => {
    if (typeof projectPath !== 'string') return null
    try {
      validateFilePath(projectPath, false)
      const snapshotPath = path.join(projectPath, '.flint', 'debt-snapshot.json')
      const raw = await fs.readFile(snapshotPath, 'utf-8')
      const data = JSON.parse(raw) as { grade?: string; score?: number; timestamp?: string }
      if (!data.grade || data.score == null) return null
      return { grade: data.grade, score: data.score, updatedAt: data.timestamp ?? new Date().toISOString() }
    } catch { return null }
  })

  // ── project:auto-configure (FORGE.2b) ─────────────────────────────────────
  // Reads detected environment and calls MCP tools to configure the project.
  handlers.set('project:auto-configure', async () => {
    if (!activeProjectRoot) {
      return { configured: false, library: null, reindexed: false }
    }
    if (!mcp.status().connected) {
      return { configured: false, library: null, reindexed: false }
    }

    const root = activeProjectRoot
    let library: string | null = null
    let librarySet = false
    let reindexed = false

    // Read the detected environment written by project:detect-environment
    try {
      const envPath = path.join(root, '.flint', 'detected-environment.json')
      const raw = await fs.readFile(envPath, 'utf-8')
      const env = JSON.parse(raw) as {
        componentLibrary?: { name: string; version: string } | string | null
      }
      // Handle both new format (object) and legacy format (string)
      if (typeof env.componentLibrary === 'object' && env.componentLibrary !== null) {
        library = env.componentLibrary.name
      } else if (typeof env.componentLibrary === 'string') {
        library = env.componentLibrary
      }
    } catch {
      // No detected-environment.json yet — proceed without library config
    }

    // Call flint_set_library if a component library was detected
    if (library) {
      try {
        await mcp.callTool('flint_set_library', { library })
        librarySet = true
      } catch (err) {
        console.error(`${BRAND.logPrefix} FORGE.2b: flint_set_library failed (non-blocking):`, err)
      }
    }

    // Always re-index the registry after configuring
    try {
      await mcp.callTool('flint_reindex_registry', { projectRoot: activeProjectRoot })
      reindexed = true
    } catch (err) {
      console.error(`${BRAND.logPrefix} FORGE.2b: flint_reindex_registry failed (non-blocking):`, err)
    }

    const configured = librarySet || reindexed
    return { configured, library, reindexed }
  })

  // ── project:run-baseline (FORGE.4a) ───────────────────────────────────────
  // Runs a full governance audit + debt report across src/**/*.tsx via MCP.
  // Sends progress updates over WebSocket and writes debt-snapshot.json.
  handlers.set('project:run-baseline', async () => {
    if (!activeProjectRoot) return null
    if (!mcp.status().connected) return null

    const root = activeProjectRoot

    // Progress helper
    const sendProgress = (phase: string, percent: number) => {
      broadcast('project:baseline-progress', { phase, percent })
    }

    let violations = 0
    let grade = 'N/A'
    let score = 0
    let filesAudited = 0

    // Phase 1: Audit
    sendProgress('audit', 10)
    try {
      const auditResult = await mcp.callTool('flint_swarm_audit_fix', {
        glob: 'src/**/*.tsx',
        autoFix: false,
      })
      sendProgress('audit', 60)

      if (auditResult?.content?.[0]?.text) {
        try {
          const data = JSON.parse(auditResult.content[0].text as string) as {
            totalViolations?: number
            filesAudited?: number
          }
          violations = data.totalViolations ?? 0
          filesAudited = data.filesAudited ?? 0
        } catch {
          // Non-JSON audit result — continue
        }
      }
    } catch (err) {
      console.error(`${BRAND.logPrefix} FORGE.4a: Swarm audit failed:`, err)
    }

    // Phase 2: Debt report
    sendProgress('debt', 70)
    try {
      const debtResult = await mcp.callTool('flint_debt_report', {
        glob: 'src/**/*.tsx',
        format: 'json',
      })
      sendProgress('debt', 90)

      if (debtResult?.content?.[0]?.text) {
        try {
          const debtData = JSON.parse(debtResult.content[0].text as string) as {
            grade?: string
            score?: number
          }
          grade = debtData.grade ?? 'N/A'
          score = debtData.score ?? 0
        } catch {
          // Non-JSON debt result — continue
        }
      }
    } catch (err) {
      console.error(`${BRAND.logPrefix} FORGE.4a: Debt report failed:`, err)
    }

    // Write debt-snapshot.json
    try {
      const flintDir = path.join(root, '.flint')
      if (!existsSync(flintDir)) {
        await fs.mkdir(flintDir, { recursive: true })
      }
      await atomicWrite(
        path.join(flintDir, 'debt-snapshot.json'),
        JSON.stringify({
          grade,
          score,
          violations,
          filesAudited,
          timestamp: new Date().toISOString(),
        }, null, 2),
      )
    } catch (err) {
      console.error(`${BRAND.logPrefix} FORGE.4a: Failed to write debt-snapshot.json:`, err)
    }

    sendProgress('complete', 100)
    return { violations, grade, score, filesAudited }
  })

  handlers.set('project:reindex', async () => {
    try {
      // 1. Run component indexer (Babel AST scan — Commandment 13)
      const { indexComponents } = await import('../flint-mcp/src/core/init/componentIndexer.js')
      const indexResult = await indexComponents(activeProjectRoot)

      // 2. Merge into flint-manifest.json (read existing manifest -> update -> write)
      const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
      let manifest: Record<string, unknown> = {}
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8')
        manifest = JSON.parse(raw) as Record<string, unknown>
      } catch { /* Missing or malformed manifest — start fresh */ }
      manifest.components = indexResult.components
      await atomicWrite(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

      // 3. Re-seed RAG store from the updated manifest + tokens + docs
      const ragResult = await rag.seedFromProject(activeProjectRoot)

      console.log(
        `${BRAND.logPrefix} Reindex complete — ${indexResult.count} components, ${ragResult.ingested} RAG chunks`,
      )

      return { components: indexResult.count, ragChunks: ragResult.ingested }
    } catch (err) {
      console.error(`${BRAND.logPrefix} Reindex failed:`, err)
      return { components: 0, ragChunks: 0 }
    }
  })

  // ── Registry ───────────────────────────────────────────────────────────────

  handlers.set('registry:getRecent', async () => registryGetRecent.all())

  handlers.set('registry:upsertProject', async (payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).name !== 'string' ||
      typeof (payload as any).path !== 'string'
    ) return
    const { name, path: projectPath } = payload as { name: string; path: string }
    if (!path.isAbsolute(projectPath)) return
    registryUpsert.run(randomUUID(), name, projectPath)
  })

  handlers.set('registry:removeProject', async (id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) return
    registryRemove.run(id)
  })

  // ── Git Operations ─────────────────────────────────────────────────────────

  handlers.set('ast:git-show', async (filePath: unknown, commitHash: unknown) => {
    if (typeof filePath !== 'string' || typeof commitHash !== 'string') return null
    if (!/^([0-9a-fA-F]{4,64}|HEAD)$/.test(commitHash)) return null
    if (!path.isAbsolute(filePath)) return null
    if (!isWithinHome(filePath)) return null

    try {
      const cwd = path.dirname(filePath)
      const { stdout: rootRaw } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd })
      const gitRoot = rootRaw.trim()
      const relPath = path.relative(gitRoot, filePath)
      const { stdout } = await execFileAsync(
        'git', ['show', `${commitHash}:${relPath}`],
        { cwd: gitRoot, maxBuffer: 2 * 1024 * 1024 },
      )
      return stdout
    } catch {
      return null
    }
  })

  handlers.set('ast:git-log', async (filePath: unknown) => {
    if (typeof filePath !== 'string') return []
    if (!path.isAbsolute(filePath)) return []
    if (!isWithinHome(filePath)) return []

    try {
      const cwd = path.dirname(filePath)
      const { stdout: rootRaw } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd })
      const gitRoot = rootRaw.trim()
      const relPath = path.relative(gitRoot, filePath)
      const { stdout } = await execFileAsync(
        'git', ['log', '--pretty=format:%h|%s|%at', '-n', '50', '--', relPath],
        { cwd: gitRoot, maxBuffer: 1024 * 1024 },
      )
      const entries: { hash: string; message: string; timestamp: number }[] = []
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = trimmed.split('|')
        if (parts.length < 3) continue
        const hash = parts[0]
        const timestamp = parseInt(parts[parts.length - 1], 10)
        const message = parts.slice(1, parts.length - 1).join('|')
        if (hash && !isNaN(timestamp)) {
          entries.push({ hash, message, timestamp })
        }
      }
      return entries
    } catch {
      return []
    }
  })

  // ── Presence ───────────────────────────────────────────────────────────────

  handlers.set('sync:update-presence', async (payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).id !== 'string' ||
      typeof (payload as any).userId !== 'string' ||
      typeof (payload as any).x !== 'number' ||
      typeof (payload as any).y !== 'number'
    ) {
      throw new Error('sync:update-presence — invalid payload')
    }
    const p = payload as { id: string; userId: string; nodeId?: string; x: number; y: number }
    stmtUpsertPresence.run(p.id, p.userId, p.nodeId ?? '', p.x, p.y)
  })

  handlers.set('sync:read-presence', async () => stmtReadPresence.all())

  // ── Policy ─────────────────────────────────────────────────────────────────

  handlers.set('policy:get', async () => {
    const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
    try {
      const raw = await fs.readFile(policyPath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      // Return the same DEFAULT_POLICY shape that Electron returns
      return {
        version: 1,
        mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 10.0, mode: 'enforce', ignore_patterns: [] },
        a11y: { level: 'AA', mode: 'enforce', disabled_rules: [] },
        export_gate: { block_on_mithril: true, block_on_a11y: true, block_on_overrides: true },
        baseline: { enabled: false },
        risk_tiers: { green: { max_score: 30 }, amber: { max_score: 70 }, red: { max_score: 100 } },
        approval_gates: { amber: 'warn', red: 'block' },
      }
    }
  })

  // ── Context Sync ───────────────────────────────────────────────────────────

  handlers.set('context:sync', async (context: unknown) => {
    if (typeof context !== 'object' || context === null) {
      throw new TypeError('context:sync — payload must be a non-null object')
    }
    const flintDir = path.join(activeProjectRoot, BRAND.configDir)
    await fs.mkdir(flintDir, { recursive: true })
    const contextPath = path.join(flintDir, 'context.json')
    await atomicWrite(contextPath, JSON.stringify(context, null, 2))
  })

  handlers.set('context:get-enriched', async () => {
    const contextPath = path.join(activeProjectRoot, BRAND.configDir, 'context.json')
    let base: Record<string, unknown> = {}
    try {
      const raw = await fs.readFile(contextPath, 'utf-8')
      base = JSON.parse(raw) as Record<string, unknown>
    } catch {
      base = { timestamp: Date.now(), activeFile: null }
    }
    const tokenCount = (stmtTokenCount.get() as { count: number }).count
    const activeOverrideCount = (stmtOverrideCount.get() as { count: number }).count
    return {
      ...base,
      tokenCount,
      activeOverrideCount,
      enrichedAt: new Date().toISOString(),
    }
  })

  // ── Priority 2: Governance ─────────────────────────────────────────────────

  handlers.set('governance:record-override', async (payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).ruleId !== 'string' ||
      typeof (payload as any).action !== 'string' ||
      typeof (payload as any).filePath !== 'string'
    ) {
      throw new TypeError('governance:record-override — invalid payload shape')
    }
    const p = payload as {
      ruleId: string
      action: string
      newValue: unknown
      filePath: string
    }
    govInsert.run(
      'override', p.ruleId, 'info', p.filePath, 'user', governanceSessionId,
      JSON.stringify({ action: p.action, newValue: p.newValue }),
    )
    broadcast('flint:governance-override-recorded', {})
  })

  handlers.set('governance:override-count', async () => {
    const row = govOverrideCount.get(governanceSessionId) as { count: number } | undefined
    return row?.count ?? 0
  })

  handlers.set('governance:compliance-summary', async (_ruleIds: unknown) => {
    // Stub — requires ruleProvenanceRegistry which is MCP-side
    return { authorities: {}, totalRules: 0, coveredRules: 0 }
  })

  // ── Deferred Violations ────────────────────────────────────────────────────

  handlers.set('governance:defer-violation', async (
    filePath: unknown, ruleId: unknown, nodeId?: unknown, reason?: unknown, duration?: unknown,
  ) => {
    if (typeof filePath !== 'string' || typeof ruleId !== 'string') {
      throw new TypeError('governance:defer-violation — filePath and ruleId must be strings')
    }
    const nId = typeof nodeId === 'string' ? nodeId : null
    const r = typeof reason === 'string' ? reason : null
    const VALID_DURATIONS = new Set<string>(['1 day', '3 days', '1 week', '1 sprint', 'Manually'])
    const dur: DeferDuration | null = (typeof duration === 'string' && VALID_DURATIONS.has(duration)) ? duration as DeferDuration : null
    const expiresAt = dur ? computeExpiresAt(dur) : null
    deferViolationUpsert.run(filePath, ruleId, nId, r, dur, expiresAt, governanceSessionId)
  })

  handlers.set('governance:get-deferred-violations', async () => {
    return deferViolationSelectUnresolved.all()
  })

  handlers.set('governance:resolve-deferred-violation', async (
    filePath: unknown, ruleId: unknown, nodeId?: unknown,
  ) => {
    if (typeof filePath !== 'string' || typeof ruleId !== 'string') {
      throw new TypeError('governance:resolve-deferred-violation — filePath and ruleId must be strings')
    }
    const nId = typeof nodeId === 'string' ? nodeId : null
    deferViolationResolve.run(filePath, ruleId, nId, nId)
  })

  // ── governance:preview-fix ─────────────────────────────────────────────────
  //
  // COUNSEL.1.4: Dry-run fix preview — mirrors the Electron main.ts handler.
  // Calls flint_fix with dry_run:true and returns the normalised InlineFixPreview
  // shape so the web build has parity with the Electron desktop build.
  handlers.set('governance:preview-fix', async (ruleId: unknown, filePath: unknown): Promise<{
    current: string
    proposed: string
    tokenName: string
    isColor: boolean
  } | null> => {
    if (typeof ruleId !== 'string' || typeof filePath !== 'string') return null
    // Security: restrict to paths within the user's home directory
    const home = os.homedir()
    if (filePath !== home && !filePath.startsWith(home + path.sep)) return null
    try {
      if (!mcp.status().connected) return null
      const rawResult = await mcp.callTool('flint_fix', {
        file: filePath,
        ruleId,
        dry_run: true,
      })
      if (!rawResult.content?.length || !rawResult.content[0].text) return null
      const parsed = JSON.parse(rawResult.content[0].text) as {
        fixes?: Array<{
          currentValue?: string
          current?: string
          proposedValue?: string
          proposed?: string
          tokenName?: string
          token_name?: string
          isColor?: boolean
          type?: string
        }>
      }
      const fixes = parsed.fixes ?? []
      if (fixes.length === 0) return null
      const fix = fixes[0]
      return {
        current: fix.currentValue ?? fix.current ?? '',
        proposed: fix.proposedValue ?? fix.proposed ?? '',
        tokenName: fix.tokenName ?? fix.token_name ?? '',
        isColor: fix.isColor ?? fix.type === 'color',
      }
    } catch {
      return null
    }
  })

  // ── governance:apply-fix ────────────────────────────────────────────────────
  //
  // Apply all Mithril + A11y auto-fixes to a file and write to disk.
  // Mirrors the Electron main.ts governance:apply-fix handler.
  // Bypasses the renderer MCP allowlist — the server owns the write path.
  handlers.set('governance:apply-fix', async (filePath: unknown): Promise<{ fixesApplied: number; status: string } | null> => {
    if (typeof filePath !== 'string') return null
    const home = os.homedir()
    if (filePath !== home && !filePath.startsWith(home + path.sep)) return null
    try {
      const mcpConnected = mcp.status().connected
      console.log(`[governance:apply-fix] file=${filePath} mcp.connected=${mcpConnected}`)
      if (!mcpConnected) return null
      const rawResult = await mcp.callTool('flint_fix', {
        file: filePath,
        dryRun: false,
      })
      if (!rawResult.content?.length || !rawResult.content[0].text) return null
      const parsed = JSON.parse(rawResult.content[0].text) as {
        fixesApplied?: number
        status?: string
      }
      console.log(`[governance:apply-fix] fixesApplied=${parsed.fixesApplied} status=${parsed.status}`)
      return {
        fixesApplied: parsed.fixesApplied ?? 0,
        status: parsed.status ?? 'unknown',
      }
    } catch (err) {
      console.warn('[governance:apply-fix] error:', err)
      return null
    }
  })

  // ── Token Analysis (MINT parity) ────────────────────────────────────────────

  handlers.set('tokens:scan-usage', async () => {
    if (!activeProjectRoot) return []

    // Load design tokens from .flint/design-tokens.json
    const tokensPath = path.join(activeProjectRoot, '.flint', 'design-tokens.json')
    let tokenEntries: { name: string; cssVar: string }[] = []
    try {
      const raw = await fs.readFile(tokensPath, 'utf8')
      const parsed = JSON.parse(raw)
      function walk(obj: Record<string, unknown>, prefix: string) {
        for (const [key, val] of Object.entries(obj)) {
          if (key.startsWith('$')) continue
          const fullPath = prefix ? `${prefix}-${key}` : key
          if (val && typeof val === 'object' && '$value' in (val as Record<string, unknown>)) {
            tokenEntries.push({ name: fullPath, cssVar: `--${fullPath}` })
          } else if (val && typeof val === 'object') {
            walk(val as Record<string, unknown>, fullPath)
          }
        }
      }
      walk(parsed, '')
    } catch {
      try {
        const allTokens = stmtReadAll.all() as Array<{ token_path: string }>
        tokenEntries = allTokens.map((t) => ({
          name: t.token_path,
          cssVar: `--${t.token_path.replace(/\./g, '-')}`,
        }))
      } catch { return [] }
    }
    if (tokenEntries.length === 0) return []

    // Collect project files
    const FILE_LIMIT = 500
    const extensions = new Set(['.tsx', '.jsx', '.css'])
    const files: string[] = []
    async function collectFiles(dir: string) {
      if (files.length >= FILE_LIMIT) return
      let entries
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        if (files.length >= FILE_LIMIT) break
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) continue
          await collectFiles(fullPath)
        } else if (extensions.has(path.extname(entry.name))) {
          files.push(fullPath)
        }
      }
    }
    await collectFiles(activeProjectRoot)

    // Scan files for token references
    const usageMap = new Map<string, { count: number; files: Set<string> }>()
    for (const te of tokenEntries) usageMap.set(te.cssVar, { count: 0, files: new Set() })
    for (const filePath of files) {
      let content: string
      try { content = await fs.readFile(filePath, 'utf8') } catch { continue }
      for (const te of tokenEntries) {
        if (content.includes(te.cssVar)) {
          const entry = usageMap.get(te.cssVar)!
          entry.count++
          entry.files.add(path.relative(activeProjectRoot, filePath))
        }
      }
    }
    return tokenEntries.map((te) => {
      const usage = usageMap.get(te.cssVar)!
      return { tokenName: te.name, cssVar: te.cssVar, usageCount: usage.count, files: [...usage.files] }
    })
  })

  handlers.set('tokens:audit-contrast', async () => {
    if (!activeProjectRoot) return []

    function hexToRgb(hex: string): [number, number, number] | null {
      const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
      return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
    }
    function srgbLinear(c: number): number {
      const s = c / 255
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    function luminance(r: number, g: number, b: number): number {
      return 0.2126 * srgbLinear(r) + 0.7152 * srgbLinear(g) + 0.0722 * srgbLinear(b)
    }
    function contrastRatio(l1: number, l2: number): number {
      const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1]
      return (lighter + 0.05) / (darker + 0.05)
    }

    const tokensPath = path.join(activeProjectRoot, '.flint', 'design-tokens.json')
    const colorTokens: { name: string; value: string }[] = []
    try {
      const raw = await fs.readFile(tokensPath, 'utf8')
      const parsed = JSON.parse(raw)
      function walk(obj: Record<string, unknown>, prefix: string) {
        for (const [key, val] of Object.entries(obj)) {
          if (key.startsWith('$')) continue
          const fullPath = prefix ? `${prefix}.${key}` : key
          if (val && typeof val === 'object' && '$value' in (val as Record<string, unknown>)) {
            const v = (val as Record<string, unknown>).$value
            const t = (val as Record<string, unknown>).$type
            if (typeof v === 'string' && t === 'color' && v.startsWith('#')) {
              colorTokens.push({ name: fullPath, value: v })
            }
          } else if (val && typeof val === 'object') {
            walk(val as Record<string, unknown>, fullPath)
          }
        }
      }
      walk(parsed, '')
    } catch {
      try {
        const allTokens = stmtReadAll.all() as Array<{ token_path: string; token_value: string; token_type: string }>
        for (const t of allTokens) {
          if (t.token_type === 'color' && t.token_value.startsWith('#')) {
            colorTokens.push({ name: t.token_path, value: t.token_value })
          }
        }
      } catch { return [] }
    }
    if (colorTokens.length < 2) return []

    const pairs: Array<{ fg: string; bg: string; fgValue: string; bgValue: string; ratio: number; passAA: boolean; passAAA: boolean }> = []
    for (let i = 0; i < colorTokens.length; i++) {
      for (let j = 0; j < colorTokens.length; j++) {
        if (i === j) continue
        const fgRgb = hexToRgb(colorTokens[i].value)
        const bgRgb = hexToRgb(colorTokens[j].value)
        if (!fgRgb || !bgRgb) continue
        const fgLum = luminance(...fgRgb)
        const bgLum = luminance(...bgRgb)
        const ratio = Math.round(contrastRatio(fgLum, bgLum) * 100) / 100
        pairs.push({
          fg: colorTokens[i].name, bg: colorTokens[j].name,
          fgValue: colorTokens[i].value, bgValue: colorTokens[j].value,
          ratio, passAA: ratio >= 4.5, passAAA: ratio >= 7.0,
        })
      }
    }
    return pairs
  })

  // ── Token Approval Staging ────────────────────────────────────────────────

  handlers.set('tokens:get-pending-approvals', async () => {
    if (!activeProjectRoot) return []
    const pendingPath = path.join(activeProjectRoot, '.flint', 'pending-tokens.json')
    try {
      const raw = await fs.readFile(pendingPath, 'utf8')
      return JSON.parse(raw)
    } catch { return [] }
  })

  handlers.set('tokens:approve-token', async (tokenName: unknown) => {
    if (!activeProjectRoot || typeof tokenName !== 'string') return { ok: false }
    const pendingPath = path.join(activeProjectRoot, '.flint', 'pending-tokens.json')
    const tokensPath = path.join(activeProjectRoot, '.flint', 'design-tokens.json')
    try {
      const raw = await fs.readFile(pendingPath, 'utf8')
      const pending = JSON.parse(raw) as Array<{ name: string; value: string; type: string }>
      const token = pending.find((t) => t.name === tokenName)
      if (!token) return { ok: false }
      const remaining = pending.filter((t) => t.name !== tokenName)
      await atomicWrite(pendingPath, JSON.stringify(remaining, null, 2))
      let designTokens: Record<string, unknown> = {}
      try { designTokens = JSON.parse(await fs.readFile(tokensPath, 'utf8')) } catch { /* fresh */ }
      const parts = token.name.split('.')
      let current: Record<string, unknown> = designTokens
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {}
        current = current[parts[i]] as Record<string, unknown>
      }
      current[parts[parts.length - 1]] = { $value: token.value, $type: token.type }
      await atomicWrite(tokensPath, JSON.stringify(designTokens, null, 2))
      return { ok: true }
    } catch { return { ok: false } }
  })

  handlers.set('tokens:reject-token', async (tokenName: unknown) => {
    if (!activeProjectRoot || typeof tokenName !== 'string') return { ok: false }
    const pendingPath = path.join(activeProjectRoot, '.flint', 'pending-tokens.json')
    try {
      const raw = await fs.readFile(pendingPath, 'utf8')
      const pending = JSON.parse(raw) as Array<{ name: string }>
      const remaining = pending.filter((t) => t.name !== tokenName)
      await atomicWrite(pendingPath, JSON.stringify(remaining, null, 2))
      return { ok: true }
    } catch { return { ok: false } }
  })

  // ── Governance: Provenance, Anomalies, Health, Mutations, Audit Log ───────

  handlers.set('governance:get-provenance-summary', (filePath: unknown): Record<string, { source: string; agentId?: string; timestamp: string }> => {
    if (typeof filePath !== 'string') return {}
    try {
      const rows = db.prepare(`
        SELECT node_id, provenance_source, provenance_agent_id, created_at
        FROM mutations_ledger WHERE file_path = ? ORDER BY created_at DESC
      `).all(filePath) as Array<{ node_id: string; provenance_source: string; provenance_agent_id: string | null; created_at: string }>
      const result: Record<string, { source: string; agentId?: string; timestamp: string }> = {}
      for (const row of rows) {
        if (result[row.node_id]) continue
        result[row.node_id] = {
          source: row.provenance_source ?? 'unknown',
          ...(row.provenance_agent_id ? { agentId: row.provenance_agent_id } : {}),
          timestamp: row.created_at,
        }
      }
      return result
    } catch { return {} }
  })

  handlers.set('governance:get-anomalies', (): Array<{ type: string; severity: string; message: string; detected_at: string }> => {
    try {
      return db.prepare(`
        SELECT type, severity, message, detected_at FROM anomaly_history
        WHERE detected_at >= datetime('now', '-24 hours') ORDER BY detected_at DESC LIMIT 20
      `).all() as Array<{ type: string; severity: string; message: string; detected_at: string }>
    } catch { return [] }
  })

  handlers.set('governance:get-last-clean-state', async (): Promise<{ timestamp: string; score: number } | null> => {
    if (activeProjectRoot) {
      try {
        const histPath = path.join(activeProjectRoot, '.flint', 'health-history.json')
        const raw = await fs.readFile(histPath, 'utf-8')
        const entries = JSON.parse(raw) as Array<{ date: string; score: number; grade: string }>
        for (let i = entries.length - 1; i >= 0; i--) {
          if (entries[i].score >= 95) return { timestamp: entries[i].date, score: entries[i].score }
        }
      } catch { /* fall through */ }
    }
    try {
      const row = db.prepare(`
        SELECT created_at, json_extract(payload, '$.score') as score FROM governance_events
        WHERE json_extract(payload, '$.score') >= 95 ORDER BY created_at DESC LIMIT 1
      `).get() as { created_at: string; score: number } | undefined
      if (row) return { timestamp: row.created_at, score: row.score }
    } catch { /* table may not exist */ }
    return null
  })

  handlers.set('governance:preview-token-impact', async (tokenName: unknown, _newValue: unknown): Promise<{ affectedFiles: number; estimatedImpact: 'low' | 'medium' | 'high' }> => {
    if (typeof tokenName !== 'string') throw new TypeError('governance:preview-token-impact — tokenName must be a string')
    if (!activeProjectRoot) return { affectedFiles: 0, estimatedImpact: 'low' }
    const cssVar = `--${(tokenName as string).replace(/\./g, '-')}`
    let affectedFiles = 0
    try {
      const srcDir = path.join(activeProjectRoot, 'src')
      const scanDir = existsSync(srcDir) ? srcDir : activeProjectRoot
      const files = await collectSourceFilesForImpact(scanDir)
      for (const f of files) {
        try {
          const content = await fs.readFile(f, 'utf-8')
          if (content.includes(cssVar) || content.includes(tokenName as string)) affectedFiles++
        } catch { /* skip */ }
      }
    } catch { /* scan failed */ }
    const estimatedImpact: 'low' | 'medium' | 'high' = affectedFiles <= 2 ? 'low' : affectedFiles <= 5 ? 'medium' : 'high'
    return { affectedFiles, estimatedImpact }
  })

  handlers.set('governance:get-health-history', async (): Promise<Array<{ date: string; score: number; grade: string }>> => {
    if (!activeProjectRoot) return []
    const histPath = path.join(activeProjectRoot, '.flint', 'health-history.json')
    try {
      const raw = await fs.readFile(histPath, 'utf-8')
      return JSON.parse(raw) as Array<{ date: string; score: number; grade: string }>
    } catch { return [] }
  })

  handlers.set('governance:record-health', async (entry: unknown): Promise<void> => {
    if (!activeProjectRoot) return
    if (typeof entry !== 'object' || entry === null) return
    const e = entry as { score?: number; grade?: string }
    if (typeof e.score !== 'number' || typeof e.grade !== 'string') return
    const histPath = path.join(activeProjectRoot, '.flint', 'health-history.json')
    let entries: Array<{ date: string; score: number; grade: string }> = []
    try { entries = JSON.parse(await fs.readFile(histPath, 'utf-8')) } catch { /* new file */ }
    entries.push({ date: new Date().toISOString(), score: e.score, grade: e.grade })
    if (entries.length > 90) entries = entries.slice(-90)
    try {
      await fs.mkdir(path.join(activeProjectRoot, '.flint'), { recursive: true })
      await atomicWrite(histPath, JSON.stringify(entries, null, 2))
    } catch { /* best-effort */ }
  })

  handlers.set('governance:get-pending-mutations', (): Array<{ id: number; type: string; filePath: string; riskScore: number; riskTier: string; agentId?: string }> => {
    try {
      return db.prepare(`
        SELECT id, type, file_path as filePath, risk_score as riskScore, risk_tier as riskTier, agent_id as agentId
        FROM mutations_ledger WHERE risk_tier IN ('Amber', 'Red') AND approved_at IS NULL
        ORDER BY risk_score DESC LIMIT 50
      `).all() as Array<{ id: number; type: string; filePath: string; riskScore: number; riskTier: string; agentId?: string }>
    } catch { return [] }
  })

  handlers.set('governance:approve-mutation', (id: unknown): void => {
    if (typeof id !== 'number') throw new TypeError('governance:approve-mutation — id must be a number')
    try { db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now') WHERE id = ?`).run(id) } catch { /* table may not exist */ }
  })

  handlers.set('governance:reject-mutation', (id: unknown): void => {
    if (typeof id !== 'number') throw new TypeError('governance:reject-mutation — id must be a number')
    try { db.prepare(`DELETE FROM mutations_ledger WHERE id = ?`).run(id) } catch { /* table may not exist */ }
  })

  handlers.set('governance:get-audit-log', (opts: unknown): Array<{ id: number | string; timestamp: string; action: string; filePath: string; description: string }> => {
    const limit = typeof (opts as Record<string, unknown>)?.limit === 'number'
      ? (opts as Record<string, unknown>).limit as number : 50
    try {
      return db.prepare(`
        SELECT id, created_at AS timestamp, event_type AS action,
               COALESCE(file_path, '') AS filePath, COALESCE(description, event_type) AS description
        FROM governance_events ORDER BY created_at DESC LIMIT ?
      `).all(limit) as Array<{ id: number | string; timestamp: string; action: string; filePath: string; description: string }>
    } catch { return [] }
  })

  // Helper: collect source files for token impact scan
  async function collectSourceFilesForImpact(dir: string): Promise<string[]> {
    const results: string[] = []
    const SKIP = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.flint'])
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue
        if (SKIP.has(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...(await collectSourceFilesForImpact(full)))
        } else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) {
          results.push(full)
        }
      }
    } catch { /* directory not readable */ }
    return results
  }

  // ── Baseline ───────────────────────────────────────────────────────────────

  handlers.set('baseline:set', async (violations: unknown) => {
    if (!Array.isArray(violations)) {
      throw new TypeError('baseline:set — violations must be an array')
    }
    const insertMany = db.transaction(
      (rows: Array<{ filePath: string; nodeId: string; ruleId: string; severity: string; value?: string }>) => {
        for (const row of rows) {
          baselineUpsert.run(row.filePath, row.nodeId, row.ruleId, row.severity, row.value ?? null)
        }
      },
    )
    const rows = (violations as Array<Record<string, unknown>>)
      .filter(
        (v) =>
          typeof v.nodeId === 'string' &&
          typeof v.ruleId === 'string' &&
          typeof v.severity === 'string' &&
          typeof v.filePath === 'string',
      )
      .map((v) => ({
        filePath: v.filePath as string,
        nodeId: v.nodeId as string,
        ruleId: v.ruleId as string,
        severity: v.severity as string,
        value: typeof v.value === 'string' ? v.value : undefined,
      }))
    insertMany(rows)
    console.log(`${BRAND.logPrefix} baseline:set — ${rows.length} violations baselined`)
  })

  handlers.set('baseline:get', async (filePath: unknown) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new TypeError('baseline:get — filePath must be a non-empty string')
    }
    return baselineSelect.all(filePath)
  })

  handlers.set('baseline:clear', async () => {
    const result = baselineClear.run()
    console.log(`${BRAND.logPrefix} baseline:clear — ${result.changes} rows removed`)
  })

  handlers.set('baseline:is-set', async () => {
    const row = baselineIsSet.get() as { count: number } | undefined
    return (row?.count ?? 0) > 0
  })

  // ── MCP Integration (live) ───────────────────────────────────────────────
  // Spawn flint-mcp as a child process, same as Electron does.

  const { MCPClient } = await import('./mcpClient.js')
  const mcp = new MCPClient()

  // Start MCP server connected to the active project
  void mcp.start(activeProjectRoot).catch((err: Error) => {
    console.warn(`${BRAND.logPrefix} MCP client failed to start: ${err.message}`)
    console.warn(`${BRAND.logPrefix} Ensure flint-mcp is built: cd flint-mcp && npm run build`)
  })

  handlers.set('mcp:call-tool', async (name: unknown, args: unknown) => {
    const toolName = name as string
    if (!RENDERER_ALLOWED_MCP_TOOLS.includes(toolName)) {
      throw new Error(
        `mcp:call-tool — tool "${toolName}" is not in the renderer allowlist. ` +
        `Only these tools can be called from Glass: ${RENDERER_ALLOWED_MCP_TOOLS.join(', ')}`,
      )
    }
    return mcp.callTool(
      toolName,
      (args ?? {}) as Record<string, unknown>,
    )
  })

  handlers.set('mcp:read-resource', async (uri: unknown) => {
    return mcp.readResource(uri as string)
  })

  handlers.set('mcp:status', async () => mcp.status())
  handlers.set('mcp:reconnect', async () => mcp.reconnect())

  // ── Phase W.1: MCP Event Push Channel ─────────────────────────────────────
  //
  // The MCP server appends MCPEvent records (newline-delimited JSON) to
  // `.flint/mcp-events.jsonl` after each tool completion. The web server
  // tail-follows that file using fs.watch (with a 10-second poll fallback)
  // and broadcasts `flint:mcp-event` to all WebSocket clients so that the
  // `useMCPEventListener` hook can dispatch to stores.
  //
  // Mirrors the Electron implementation in electron/main.ts (Phase W.1).
  {
    let mcpEventsOffset = 0
    let mcpEventsBatchTimer: ReturnType<typeof setTimeout> | null = null
    const mcpEventsBatch: unknown[] = []
    let mcpEventsWatcher: ReturnType<typeof fsWatch> | null = null

    function getMCPEventsFilePath(): string {
      return path.join(activeProjectRoot, BRAND.configDir, 'mcp-events.jsonl')
    }

    function flushMCPEventsBatch(): void {
      if (mcpEventsBatch.length === 0) return
      const events = mcpEventsBatch.splice(0)
      broadcast('flint:mcp-event', events)
    }

    async function tailMCPEvents(): Promise<void> {
      const filePath = getMCPEventsFilePath()
      try {
        const stat = await fs.stat(filePath)
        const size = stat.size
        // File was rotated (e.g. renamed to .bak and a new file started)
        if (size < mcpEventsOffset) {
          mcpEventsOffset = 0
        }
        if (size === mcpEventsOffset) return // no new data

        const fd = await fs.open(filePath, 'r')
        try {
          const bytesToRead = size - mcpEventsOffset
          const buf = Buffer.alloc(bytesToRead)
          const { bytesRead } = await fd.read(buf, 0, bytesToRead, mcpEventsOffset)
          mcpEventsOffset += bytesRead
          const chunk = buf.subarray(0, bytesRead).toString('utf-8')

          for (const line of chunk.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const event = JSON.parse(trimmed)
              mcpEventsBatch.push(event)
            } catch {
              // Truncated / malformed line — skip
            }
          }
        } finally {
          await fd.close()
        }

        // Schedule/reset the 500ms debounce flush
        if (mcpEventsBatch.length > 0) {
          if (mcpEventsBatchTimer !== null) clearTimeout(mcpEventsBatchTimer)
          mcpEventsBatchTimer = setTimeout(() => {
            mcpEventsBatchTimer = null
            flushMCPEventsBatch()
          }, 500)
        }
      } catch {
        // File does not exist yet or is unreadable — safe to ignore
      }
    }

    function startMCPEventsWatcher(): void {
      const filePath = getMCPEventsFilePath()
      const dir = path.dirname(filePath)
      const basename = path.basename(filePath)

      // Ensure .flint directory exists
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

      try {
        mcpEventsWatcher = fsWatch(dir, { persistent: false }, (_event, filename) => {
          if (filename === basename) {
            void tailMCPEvents()
          }
        })
        mcpEventsWatcher.on('error', () => {
          // Watcher died — fall back to polling
          if (mcpEventsWatcher) {
            mcpEventsWatcher.close()
            mcpEventsWatcher = null
          }
        })
      } catch {
        // fs.watch unavailable — will rely on poll fallback
      }

      // 10-second poll fallback for NFS/NAS mounts and systems where
      // fs.watch is unreliable for atomic tmp->rename writes
      const pollInterval = setInterval(() => void tailMCPEvents(), 10_000)

      // Store cleanup reference on server close
      const origClose = server.close.bind(server)
      server.close = (callback?: (err?: Error) => void) => {
        clearInterval(pollInterval)
        if (mcpEventsWatcher) {
          mcpEventsWatcher.close()
          mcpEventsWatcher = null
        }
        if (mcpEventsBatchTimer !== null) {
          clearTimeout(mcpEventsBatchTimer)
          flushMCPEventsBatch()
        }
        return origClose(callback)
      }

      console.log(`${BRAND.logPrefix} MCP event push channel active — watching ${filePath}`)
    }

    // Start the watcher after a brief delay to let the MCP server create the file
    setTimeout(() => startMCPEventsWatcher(), 2000)
  }

  // ── Annotations ────────────────────────────────────────────────────────────

  handlers.set('annotations:read-all', async () => {
    const filePath = path.join(activeProjectRoot, BRAND.configDir, 'annotations.json')
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
    } catch {
      return []
    }
  })

  handlers.set('annotations:resolve', async (id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) return
    const filePath = path.join(activeProjectRoot, BRAND.configDir, 'annotations.json')
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      let changed = false
      const updated = parsed.map((a: any) => {
        if (a.id === id && a.status !== 'resolved') {
          changed = true
          return { ...a, status: 'resolved', resolvedAt: new Date().toISOString() }
        }
        return a
      })
      if (changed) {
        await atomicWrite(filePath, JSON.stringify(updated, null, 2))
        broadcast('flint:annotations-changed', {})
      }
    } catch { /* file missing — ok */ }
  })

  // ── Workspace file watcher ─────────────────────────────────────────────────
  // Stat-polls .tsx/.ts/.jsx/.js files and broadcasts changes via WebSocket so
  // the Glass-in-browser LivePreview updates without a manual refresh.
  {
    let fileWatchInterval: ReturnType<typeof setInterval> | null = null
    const trackedFiles = new Map<string, number>() // filePath → lastMtimeMs

    async function scanWorkspaceFiles(root: string): Promise<string[]> {
      const results: string[] = []
      const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.flint'])
      const MAX_FILES = 100

      async function walk(dir: string): Promise<void> {
        if (results.length >= MAX_FILES) return
        let entries
        try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
        for (const entry of entries) {
          if (results.length >= MAX_FILES) return
          if (SKIP.has(entry.name)) continue
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            await walk(full)
          } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
            results.push(full)
          }
        }
      }
      await walk(root)
      return results
    }

    async function startWebFileWatcher(): Promise<void> {
      if (fileWatchInterval) clearInterval(fileWatchInterval)
      trackedFiles.clear()
      if (!activeProjectRoot) return

      // Self-hosting guard: never watch the Flint source tree itself.
      // When dev:web is launched from the repo root, activeProjectRoot IS the
      // repo root. Scanning src/ confuses Vite's HMR watcher (same files,
      // same mtime events) and causes the LOADING flash loop.
      if (existsSync(path.join(activeProjectRoot, 'electron', 'main.ts'))) {
        console.log(`${BRAND.logPrefix} workspace watcher: skipping self-hosting root ${activeProjectRoot}`)
        return
      }

      const files = await scanWorkspaceFiles(activeProjectRoot)
      for (const f of files) {
        try {
          const stat = await fs.stat(f)
          trackedFiles.set(f, stat.mtimeMs)
        } catch { /* file may not exist */ }
      }

      fileWatchInterval = setInterval(() => {
        void (async () => {
          // Check for modifications to known files
          for (const [filePath, lastMtime] of trackedFiles) {
            try {
              const stat = await fs.stat(filePath)
              if (stat.mtimeMs > lastMtime) {
                trackedFiles.set(filePath, stat.mtimeMs)
                const content = await fs.readFile(filePath, 'utf-8')
                broadcast('flint:file-changed', { filePath, content })
              }
            } catch { /* file deleted or inaccessible */ }
          }
          // Check for newly created files not yet in the tracked set.
          try {
            const currentFiles = await scanWorkspaceFiles(activeProjectRoot)
            for (const filePath of currentFiles) {
              if (!trackedFiles.has(filePath)) {
                try {
                  const stat = await fs.stat(filePath)
                  trackedFiles.set(filePath, stat.mtimeMs)
                  const content = readFileSync(filePath, 'utf-8')
                  broadcast('flint:file-changed', { filePath, content })
                } catch { /* file vanished between scan and stat — skip */ }
              }
            }
          } catch { /* scan error — skip new-file detection this tick */ }
        })()
      }, 1_000)
    }

    // Expose for use after project open
    ;(globalThis as Record<string, unknown>).__flintWebStartFileWatcher = startWebFileWatcher
    ;(globalThis as Record<string, unknown>).__flintWebTrackedFiles = trackedFiles

    // Start immediately for the CLI-supplied project root
    void startWebFileWatcher()
  }

  // ── IDE→Glass File Sync (IDE.2 parity) ────────────────────────────────────
  // The VS Code extension writes the active file path to
  // `.flint/ide-active-file.json` on every editor focus change.
  // We stat-poll that file (same pattern as Electron's startIDEFileSyncWatcher)
  // and broadcast `flint:ide-file-selected` to all WebSocket clients so Glass
  // auto-follows IDE focus without the user touching the Files tab.
  //
  // The tick logic lives in server/ideFileSyncTick.ts so it can be unit-tested
  // without spinning up the full Express server.
  let ideFileSyncInterval: ReturnType<typeof setInterval> | null = null
  const ideFileSyncState: IDEFileSyncState = { lastMtime: 0, lastPath: '' }

  {
    function startIDEFileSyncWatcher(): void {
      if (ideFileSyncInterval) clearInterval(ideFileSyncInterval)
      // Only reset mtime (so we re-check the file), but preserve lastPath
      // to prevent re-broadcasting the same file after a project switch.
      ideFileSyncState.lastMtime = 0

      ideFileSyncInterval = setInterval(() => {
        // Poll the active project root first, then fall back to the original
        // server root. This handles the case where Glass opened a demo project
        // (temp dir) but the VS Code extension writes to the workspace root.
        void ideFileSyncTick({
          activeProjectRoot,
          state: ideFileSyncState,
          statFn: (p) => fs.stat(p),
          readFileFn: (p) => fs.readFile(p, 'utf-8'),
          broadcastFn: broadcast,
          configDir: BRAND.configDir,
        }).then(() => {
          // If the primary root didn't find anything and the roots differ,
          // also check the original server root.
          // Self-hosting guard: skip when serverRoot IS the Flint source tree.
          // Broadcasting a Flint source file path from ide-active-file.json would
          // cause Glass to open it → setActiveFile → triggerAutoSave → the file
          // gets written back to disk → Vite HMR detects mtime change → reload loop.
          // This happens even when activeProjectRoot has changed to a demo temp dir —
          // the broadcast still results in a write to the source tree.
          const serverRootIsFlint = existsSync(path.join(serverRoot, 'electron', 'main.ts'))
          if (serverRoot !== activeProjectRoot && !serverRootIsFlint) {
            return ideFileSyncTick({
              activeProjectRoot: serverRoot,
              state: ideFileSyncState,
              statFn: (p) => fs.stat(p),
              readFileFn: (p) => fs.readFile(p, 'utf-8'),
              broadcastFn: broadcast,
              configDir: BRAND.configDir,
            })
          }
        })
      }, 1_000)
    }

    // Expose for restart when activeProjectRoot changes
    ;(globalThis as Record<string, unknown>).__flintIDEFileSyncStart = startIDEFileSyncWatcher
    ;(globalThis as Record<string, unknown>).__flintIDEFileSyncStop = () => {
      if (ideFileSyncInterval) { clearInterval(ideFileSyncInterval); ideFileSyncInterval = null }
    }

    startIDEFileSyncWatcher()
  }

  // ── Setup Wizard ───────────────────────────────────────────────────────────

  handlers.set('setup:detect-ides', async () => {
    const home = os.homedir()
    const claudeSettingsPath = path.join(home, '.claude', 'settings.json')
    const claudeMcpPath = path.join(home, '.claude', 'mcp.json')

    const ides = [
      {
        name: 'Claude Code',
        settingsPath: existsSync(claudeMcpPath) ? claudeMcpPath : claudeSettingsPath,
        detected: existsSync(claudeSettingsPath) || existsSync(claudeMcpPath),
      },
      {
        name: 'Antigravity',
        settingsPath: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        detected: existsSync(path.join(home, 'Library', 'Application Support', 'Antigravity', 'User', 'settings.json')),
      },
      {
        name: 'Cursor',
        settingsPath: path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'),
        detected: existsSync(path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')),
      },
      {
        name: 'VS Code',
        settingsPath: path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
        detected: existsSync(path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json')),
      },
    ]

    // Resolve the MCP server path the same way Electron does.
    // In dev: <repo-root>/flint-mcp/dist/server.js
    const mcpServerPath = path.resolve(__dirname, '..', 'flint-mcp', 'dist', 'server.js')
    return { ides, mcpServerPath }
  })

  handlers.set('setup:check-first-launch', async () => {
    const setupPath = path.join(os.homedir(), BRAND.configDir, 'setup.json')
    try {
      const raw = readFileSync(setupPath, 'utf-8')
      const parsed = JSON.parse(raw) as { firstLaunchComplete?: boolean }
      return { isFirstLaunch: parsed.firstLaunchComplete !== true }
    } catch {
      return { isFirstLaunch: true }
    }
  })

  handlers.set('setup:complete-first-launch', async () => {
    const flintDir = path.join(os.homedir(), BRAND.configDir)
    mkdirSync(flintDir, { recursive: true })
    const setupPath = path.join(flintDir, 'setup.json')
    writeFileSync(
      setupPath,
      JSON.stringify({ firstLaunchComplete: true, completedAt: Date.now() }, null, 2),
      'utf-8',
    )
  })

  handlers.set('app:reset-state', async () => {
    const setupPath = path.join(os.homedir(), BRAND.configDir, 'setup.json')
    try {
      if (existsSync(setupPath)) rmSync(setupPath)
    } catch (err) {
      console.error(`${BRAND.logPrefix} app:reset-state — could not delete setup.json:`, err)
    }
  })

  handlers.set('setup:write-mcp-config', async (ideName: unknown, configPath: unknown, mcpServerPath: unknown) => {
    if (typeof configPath !== 'string' || typeof mcpServerPath !== 'string') {
      return { written: false }
    }
    // Validate configPath against known-safe destinations to prevent arbitrary file writes.
    const SAFE_CONFIG_PATHS = [
      path.join(os.homedir(), '.cursor', 'mcp.json'),
      path.join(os.homedir(), '.claude', 'mcp.json'),
      path.join(process.cwd(), '.vscode', 'mcp.json'),
      path.join(process.cwd(), '.cursor', 'mcp.json'),
    ]
    const normalizedConfigPath = path.normalize(configPath)
    if (!SAFE_CONFIG_PATHS.some((safe) => path.normalize(safe) === normalizedConfigPath)) {
      throw new Error('Invalid MCP config path')
    }
    try {
      // Read existing config, merge Flint MCP entry
      let config: Record<string, unknown> = {}
      if (existsSync(configPath as string)) {
        try { config = JSON.parse(readFileSync(configPath as string, 'utf8')) as Record<string, unknown> } catch {}
      }
      const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>
      mcpServers['flint'] = {
        command: 'node',
        args: [mcpServerPath],
        env: { FLINT_PROJECT_ROOT: activeProjectRoot },
      }
      config.mcpServers = mcpServers
      await fs.mkdir(path.dirname(configPath as string), { recursive: true })
      writeFileSync(configPath as string, JSON.stringify(config, null, 2))
      console.log(`${BRAND.logPrefix} Wrote MCP config to ${configPath} for ${ideName}`)
      return { written: true }
    } catch (err) {
      console.error(`${BRAND.logPrefix} setup:write-mcp-config failed:`, err)
      return { written: false }
    }
  })

  // ── Figma Ingestion Server ──────────────────────────────────────────────

  const { createIngestionServer } = await import('./services/ingestionServer.js')
  const ingestion = createIngestionServer()
  const sessionSecret = randomUUID()

  // Start ingestion server for Figma plugin connections
  void ingestion.start(activeProjectRoot, { secret: sessionSecret }).then(({ port: ingPort }) => {
    console.log(`${BRAND.logPrefix} Ingestion server listening on port ${ingPort}`)
  }).catch((err: Error) => {
    console.warn(`${BRAND.logPrefix} Ingestion server failed: ${err.message}`)
  })

  // Forward ingestion events to WebSocket clients
  ingestion.onIngest((data) => broadcast('flint:figma-connected', data))
  ingestion.onError((data) => broadcast('flint:figma-error', data))

  handlers.set('server:get-status', async () => {
    const status = ingestion.status()
    return { running: status.running, port: status.port || port }
  })

  handlers.set('figma:status', async () => {
    const status = ingestion.status()
    return {
      running: status.running,
      lastWebhookAt: status.lastWebhookAt,
      tokenCount: status.tokenCount,
      port: status.port,
    }
  })

  handlers.set('figma:disconnect', async () => {
    await ingestion.stop()
  })

  // ── AI Orchestration ───────────────────────────────────────────────────────

  const aiConfigPath = path.join(os.homedir(), BRAND.configDir, 'config.json')

  handlers.set('ai:get-config', async () => {
    try {
      if (existsSync(aiConfigPath)) {
        const raw = readFileSync(aiConfigPath, 'utf8')
        const cfg = JSON.parse(raw) as Record<string, unknown>
        return {
          hasKey: !!(cfg.apiKey || process.env.ANTHROPIC_API_KEY),
          provider: (cfg.provider as string) ?? 'anthropic',
          model: (cfg.model as string) ?? null,
          baseURL: (cfg.baseURL as string) ?? null,
        }
      }
    } catch { /* fall through to defaults */ }
    return {
      hasKey: !!process.env.ANTHROPIC_API_KEY,
      provider: 'anthropic',
      model: null,
      baseURL: null,
    }
  })

  handlers.set('ai:save-config', async (config: unknown) => {
    const configDir = path.join(os.homedir(), BRAND.configDir)
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
    // Merge with existing config to preserve fields not in the update
    let existing: Record<string, unknown> = {}
    try {
      if (existsSync(aiConfigPath)) {
        existing = JSON.parse(readFileSync(aiConfigPath, 'utf8')) as Record<string, unknown>
      }
    } catch { /* start fresh */ }
    const merged = { ...existing, ...(config as Record<string, unknown>) }
    writeFileSync(aiConfigPath, JSON.stringify(merged, null, 2))
  })
  // ── AI Chat + Streaming ──────────────────────────────────────────────────

  const { createAIChatService } = await import('./services/aiChat.js')
  const aiChat = createAIChatService(aiConfigPath)

  handlers.set('ai:chat', async (messages: unknown, context: unknown) => {
    await aiChat.chat(
      messages as unknown[],
      context,
      (chunk) => broadcast('ai:chunk', chunk),
    )
  })

  // ai:apply-batch — delegate mutations to flint_ast_mutate via MCP.
  // The Electron counterpart is a sentinel ACK (the renderer handles AST surgery
  // via editorStore.applyBatch locally). In web mode the renderer cannot call
  // Electron IPC, so the server must actually apply the mutations via MCP.
  handlers.set('ai:apply-batch', async (mutations: unknown, filePath: unknown) => {
    if (!mutations || !filePath) {
      // No-op ACK when called without arguments (matches Electron sentinel behaviour).
      return { ok: true }
    }
    if (!mcp.status().connected) {
      console.error('[IPC] ai:apply-batch failed: MCP not connected')
      return { ok: false, error: 'Operation failed' }
    }
    try {
      const result = await mcp.callTool('flint_ast_mutate', {
        filePath,
        mutations,
        dry_run: false,
      })
      const text = result.content?.[0]?.text ?? '{}'
      const parsed = JSON.parse(text) as Record<string, unknown>
      return { ok: true, ...parsed }
    } catch (err) {
      console.error('[IPC] ai:apply-batch failed:', err)
      return { ok: false, error: 'Operation failed' }
    }
  })

  // ── RAG Store ───────────────────────────────────────────────────────────

  const { createRAGService } = await import('./services/ragStore.js')
  const rag = createRAGService(db)

  handlers.set('ai:query-rag', async (query: unknown) => {
    return rag.query(query as string)
  })

  handlers.set('ai:ingest-rag', async (chunks: unknown) => {
    return rag.ingest(chunks as Array<{ content: string; source?: string; chunkType?: string }>)
  })

  handlers.set('ai:clear-rag', async () => { await rag.clear() })
  handlers.set('ai:rag-count', async () => rag.count())

  handlers.set('ai:seed-rag', async () => {
    return rag.seedFromProject(activeProjectRoot)
  })

  // ── Beta ───────────────────────────────────────────────────────────────────

  handlers.set('beta:get-info', async () => ({
    buildId: 'web',
    expiryDate: null,
    daysRemaining: null,
    isBeta: false,
  }))

  handlers.set('beta:submit-feedback', async (feedback: unknown) => {
    try {
      const feedbackDir = path.join(os.homedir(), BRAND.configDir, 'feedback')
      if (!existsSync(feedbackDir)) mkdirSync(feedbackDir, { recursive: true })
      const filename = `feedback-${Date.now()}.json`
      const entry = {
        ...(feedback as Record<string, unknown>),
        timestamp: new Date().toISOString(),
        buildId: 'web',
        projectRoot: activeProjectRoot,
      }
      writeFileSync(path.join(feedbackDir, filename), JSON.stringify(entry, null, 2))
      return { saved: true }
    } catch {
      return { saved: false }
    }
  })

  handlers.set('beta:load-demo-project', async (payload?: { demoName?: string }) => {
    try {
      const demoName = payload?.demoName
      const resourcesBase = path.resolve(__dirname, '..', 'build-resources')

      // If a named demo is requested, look in build-resources/demos/<demoName>/
      // Fall back to build-resources/demo-project/ for the default case.
      let demoSourceDir: string
      if (demoName && demoName !== 'default') {
        const namedDir = path.join(resourcesBase, 'demos', demoName)
        demoSourceDir = existsSync(namedDir) ? namedDir : path.join(resourcesBase, 'demo-project')
      } else {
        demoSourceDir = path.join(resourcesBase, 'demo-project')
      }

      if (!existsSync(demoSourceDir)) {
        return { error: 'Demo project bundle not found at ' + demoSourceDir }
      }
      const tmpBase = path.join(os.tmpdir(), 'flint-beta-demo')
      mkdirSync(tmpBase, { recursive: true })
      const projectDir = path.join(tmpBase, `demo-${Date.now()}`)
      mkdirSync(projectDir, { recursive: true })
      await fs.cp(demoSourceDir, projectDir, { recursive: true })

      // Copy design tokens into .flint/ so the governance engine picks them up
      const tokensSrc = path.join(projectDir, 'design-tokens.json')
      if (existsSync(tokensSrc)) {
        const flintDir = path.join(projectDir, BRAND.configDir)
        mkdirSync(flintDir, { recursive: true })
        const tokensContent = await fs.readFile(tokensSrc)
        await fs.writeFile(path.join(flintDir, 'design-tokens.json'), tokensContent)
      }

      return { projectPath: projectDir }
    } catch (err) {
      console.error('[IPC] beta:load-demo-project failed:', err)
      return { error: 'Operation failed' }
    }
  })

  handlers.set('beta:capture-screenshot', async () => null)

  // ── Components ─────────────────────────────────────────────────────────────

  // ── CV2.4: Load linters once for per-component health enrichment ──────────
  // Dynamic imports wrapped in try/catch so a missing flint-mcp package
  // degrades gracefully — all components get `health: null` in that case.
  type AuditAllFn = (ast: import('@babel/types').File, tokens: unknown[]) => Map<string, { value?: number }>
  type A11yAuditFn = (ast: import('@babel/types').File) => Record<string, string[]>
  interface ComponentHealth {
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    maxDeltaE: number
    violationCount: number
    mithrilCount: number
    a11yCount: number
  }

  let auditAllFn: AuditAllFn | null = null
  let a11yAuditFn: A11yAuditFn | null = null

  try {
    const mithrilMod = await import('../flint-mcp/src/core/MithrilLinter.js')
    const a11yMod = await import('../flint-mcp/src/core/A11yLinter.js')
    auditAllFn = mithrilMod.auditAll as AuditAllFn
    a11yAuditFn = (ast: import('@babel/types').File) =>
      (a11yMod.A11yLinter as { audit: A11yAuditFn }).audit(ast)
    console.log(`${BRAND.logPrefix} Component health linters loaded successfully`)
  } catch {
    console.warn(`${BRAND.logPrefix} flint-mcp linters not available — component health will be null`)
  }

  async function enrichComponentHealth(
    filePath: string,
    tokens: Array<{ token_path: string; token_type: string; token_value: string }>,
    auditAll: AuditAllFn,
    a11yAudit: A11yAuditFn,
  ): Promise<ComponentHealth | null> {
    try {
      const code = await fs.readFile(filePath, 'utf-8')
      const { parse } = await import('@babel/parser')
      const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] })

      const mithrilWarnings = auditAll(ast, tokens)
      const mithrilCount = mithrilWarnings.size
      let maxDeltaE = 0
      for (const warning of mithrilWarnings.values()) {
        const de = typeof warning.value === 'number' ? warning.value : 0
        if (de > maxDeltaE) maxDeltaE = de
      }

      const a11yViolations = a11yAudit(ast)
      const a11yCount = Object.values(a11yViolations).reduce(
        (sum, msgs) => sum + msgs.length, 0,
      )

      const violationCount = mithrilCount + a11yCount
      let grade: ComponentHealth['grade']
      if (violationCount === 0 && maxDeltaE < 2.0) grade = 'A'
      else if (violationCount <= 2 && maxDeltaE < 5.0) grade = 'B'
      else if (violationCount <= 5 && maxDeltaE < 10.0) grade = 'C'
      else if (violationCount <= 10) grade = 'D'
      else grade = 'F'

      return { grade, maxDeltaE, violationCount, mithrilCount, a11yCount }
    } catch {
      return null
    }
  }

  handlers.set('components:list', async () => {
    const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw) as Record<string, unknown>
      const components = (manifest.components ?? {}) as Record<string, unknown>

      // Derive category from file path — mirrors Electron's deriveComponentCategory
      function deriveCategory(filePath: string): string {
        const n = filePath.replace(/\\/g, '/')
        if (/\/primitives\//.test(n) || /\/atoms\//.test(n)) return 'primitive'
        if (/\/molecules\//.test(n)) return 'molecule'
        if (/\/organisms\//.test(n) || /\/templates\//.test(n)) return 'organism'
        if (/\/pages\//.test(n)) return 'page'
        if (/\/layouts\//.test(n)) return 'layout'
        return 'uncategorized'
      }

      // Deterministic 8-char hex ID from name+importPath — mirrors Electron's makeComponentId
      function makeComponentId(name: string, importPath: string): string {
        const input = `${name}::${importPath}`
        let hash = 5381
        for (let i = 0; i < input.length; i++) {
          // eslint-disable-next-line no-bitwise
          hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
        }
        // eslint-disable-next-line no-bitwise
        return (hash >>> 0).toString(16).padStart(8, '0')
      }

      // Read category overrides
      let categoryOverrides: Record<string, string> = {}
      try {
        const overridesPath = path.join(activeProjectRoot, BRAND.configDir, 'category-overrides.json')
        if (existsSync(overridesPath)) {
          const raw2 = readFileSync(overridesPath, 'utf-8')
          const parsed = JSON.parse(raw2)
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            categoryOverrides = parsed as Record<string, string>
          }
        }
      } catch { /* ok */ }

      const VALID_CATEGORIES = new Set(['primitive', 'molecule', 'organism', 'page', 'layout', 'uncategorized'])
      const categoryOrder: Record<string, number> = {
        primitive: 0, molecule: 1, organism: 2, page: 3, layout: 4, uncategorized: 5,
      }

      const thumbnailBase = path.join(activeProjectRoot, BRAND.configDir, 'thumbnails')

      // Load design tokens for health enrichment
      let designTokens: Array<{ token_path: string; token_type: string; token_value: string }> = []
      if (auditAllFn) {
        try {
          const rows = stmtReadAll.all() as Array<{ token_path: string; token_type: string; token_value: string }>
          designTokens = rows
        } catch { designTokens = [] }
      }

      const cards = await Promise.all(Object.entries(components).map(async ([name, entry]) => {
        const e = (entry ?? {}) as Record<string, unknown>
        const importPath = typeof e.importPath === 'string' ? e.importPath : ''
        const filePath = typeof e.filePath === 'string' ? e.filePath : ''
        const variants = Array.isArray(e.variants) ? e.variants : []
        const propsRaw = (e.props ?? {}) as Record<string, unknown>
        const id = makeComponentId(name, importPath)

        let thumbnailPath: string | null = null
        const tp = path.join(thumbnailBase, `${id}.png`)
        if (existsSync(tp)) thumbnailPath = tp

        const props: Record<string, { type: string; required: boolean }> = {}
        for (const [propName, propDef] of Object.entries(propsRaw)) {
          const p = (propDef ?? {}) as Record<string, unknown>
          props[propName] = {
            type: typeof p.type === 'string' ? p.type : 'unknown',
            required: typeof p.required === 'boolean' ? p.required : false,
          }
        }

        // CV2.4: Per-component health enrichment
        let health: ComponentHealth | null = null
        if (filePath && auditAllFn && a11yAuditFn) {
          const resolvedPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(activeProjectRoot, filePath)
          health = await enrichComponentHealth(resolvedPath, designTokens, auditAllFn, a11yAuditFn)
        }

        let category = deriveCategory(filePath)
        const override = categoryOverrides[id]
        if (override && VALID_CATEGORIES.has(override)) category = override

        return {
          id,
          name,
          importPath,
          filePath,
          category,
          variantCount: variants.length,
          variants,
          props,
          thumbnailPath,
          health,
          tokens: Array.isArray(e.tokens) ? (e.tokens as string[]) : [],
          dependencies: Array.isArray(e.dependencies) ? (e.dependencies as string[]) : [],
          // Pass through any extra manifest fields (description, usageExample, etc.)
          ...(typeof e.description === 'string' ? { description: e.description } : {}),
          ...(typeof e.usageExample === 'string' ? { usageExample: e.usageExample } : {}),
          ...(typeof e.compositionNotes === 'string' ? { compositionNotes: e.compositionNotes } : {}),
          ...(typeof e.a11yNotes === 'string' ? { a11yNotes: e.a11yNotes } : {}),
          ...(Array.isArray(e.relatedComponents) ? { relatedComponents: e.relatedComponents } : {}),
        }
      }))

      // Sort: category order, then alphabetical
      cards.sort((a, b) => {
        const d = (categoryOrder[a.category] ?? 5) - (categoryOrder[b.category] ?? 5)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      })

      return cards
    } catch {
      return []
    }
  })

  handlers.set('components:save-positions', async (positions: unknown) => {
    if (typeof positions !== 'object' || positions === null || Array.isArray(positions)) return
    // Must use card-positions.json — matches electron/main.ts
    const posPath = path.join(activeProjectRoot, BRAND.configDir, 'card-positions.json')
    await fs.mkdir(path.dirname(posPath), { recursive: true })
    await atomicWrite(posPath, JSON.stringify(positions, null, 2))
  })

  handlers.set('components:load-positions', async () => {
    // Must use card-positions.json — matches electron/main.ts
    const posPath = path.join(activeProjectRoot, BRAND.configDir, 'card-positions.json')
    try {
      const raw = await fs.readFile(posPath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed
      }
      return {}
    } catch {
      return {}
    }
  })

  handlers.set('components:set-category', async (payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const p = payload as Record<string, unknown>
    if (typeof p.componentId !== 'string' || typeof p.category !== 'string') return
    const overridesPath = path.join(activeProjectRoot, BRAND.configDir, 'category-overrides.json')
    let overrides: Record<string, string> = {}
    try {
      const raw = await fs.readFile(overridesPath, 'utf-8')
      overrides = JSON.parse(raw) as Record<string, string>
    } catch { /* ok */ }
    overrides[p.componentId] = p.category
    await fs.mkdir(path.dirname(overridesPath), { recursive: true })
    await atomicWrite(overridesPath, JSON.stringify(overrides, null, 2))
  })

  // ── CV2.4: Component Health (MCP-backed) ─────────────────────────────────
  // Web-mode equivalent of the Electron per-component health enrichment.
  // Instead of calling the linter directly, this handler delegates to the
  // MCP `flint_audit` tool (structured JSON response) so that the web build
  // doesn't require flint-mcp to be importable as an ES module.
  //
  // Returns: Record<componentName, ComponentHealth | null>
  // null when the component has no filePath or MCP is not connected.

  handlers.set('components:health', async () => {
    const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)

    let components: Record<string, unknown> = {}
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw) as Record<string, unknown>
      components = (manifest.components ?? {}) as Record<string, unknown>
    } catch {
      return {}
    }

    // Only proceed if MCP is available — health requires audit_ui_component
    const mcpConnected = mcp.status().connected
    if (!mcpConnected) {
      // Return null health for every component; client degrades gracefully
      const result: Record<string, null> = {}
      for (const name of Object.keys(components)) {
        result[name] = null
      }
      return result
    }

    // Helper: derive ComponentHealth grade from counts
    function gradeFromCounts(
      violationCount: number,
      maxDeltaE: number,
    ): 'A' | 'B' | 'C' | 'D' | 'F' {
      if (violationCount === 0 && maxDeltaE < 2.0) return 'A'
      if (violationCount <= 2 && maxDeltaE < 5.0) return 'B'
      if (violationCount <= 5 && maxDeltaE < 10.0) return 'C'
      if (violationCount <= 10) return 'D'
      return 'F'
    }

    // Helper: extract max deltaE from violation messages ("ΔE 4.2" pattern)
    function extractMaxDeltaE(violations: Array<{ message?: string }>): number {
      let max = 0
      for (const v of violations) {
        const m = v.message?.match(/ΔE\s+([\d.]+)/)
        if (m) {
          const val = parseFloat(m[1])
          if (!isNaN(val) && val > max) max = val
        }
      }
      return max
    }

    const healthMap: Record<string, {
      grade: 'A' | 'B' | 'C' | 'D' | 'F'
      maxDeltaE: number
      violationCount: number
      mithrilCount: number
      a11yCount: number
    } | null> = {}

    // Audit each component via MCP (sequential to avoid overwhelming the server)
    for (const [name, entry] of Object.entries(components)) {
      const e = (entry ?? {}) as Record<string, unknown>
      const rawFilePath = typeof e.filePath === 'string' ? e.filePath : null

      if (!rawFilePath) {
        healthMap[name] = null
        continue
      }

      const resolvedPath = path.isAbsolute(rawFilePath)
        ? rawFilePath
        : path.join(activeProjectRoot, rawFilePath)

      try {
        const source = await fs.readFile(resolvedPath, 'utf-8')
        const auditResult = await mcp.callTool('flint_audit', {
          source,
          filePath: resolvedPath,
        })

        // flint_audit returns structured JSON in content[0].text
        const text = (auditResult as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '{}'
        // Strip any enrichment suffix appended to the JSON (ACX.3 appends token context after JSON)
        const jsonEnd = text.lastIndexOf('}')
        const jsonText = jsonEnd !== -1 ? text.slice(0, jsonEnd + 1) : text
        const parsed = JSON.parse(jsonText) as {
          mithrilCount?: number
          a11yCount?: number
          violations?: Array<{ message?: string }>
        }

        const mithrilCount = typeof parsed.mithrilCount === 'number' ? parsed.mithrilCount : 0
        const a11yCount = typeof parsed.a11yCount === 'number' ? parsed.a11yCount : 0
        const violations = Array.isArray(parsed.violations) ? parsed.violations : []
        const violationCount = mithrilCount + a11yCount
        const maxDeltaE = extractMaxDeltaE(violations)
        const grade = gradeFromCounts(violationCount, maxDeltaE)

        healthMap[name] = { grade, maxDeltaE, violationCount, mithrilCount, a11yCount }
      } catch {
        // File unreadable, parse error, or MCP timeout — return null for this component
        healthMap[name] = null
      }
    }

    return healthMap
  })

  // ── Scope / Library ──────────────────────────────────────────────────────

  handlers.set('scope:get-registry-and-scope', async () => {
    // Read component registry from flint-manifest.json
    let registry: unknown[] = []
    try {
      const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
      if (existsSync(manifestPath)) {
        const raw = readFileSync(manifestPath, 'utf8')
        const manifest = JSON.parse(raw) as Record<string, unknown>
        const components = (manifest.components ?? {}) as Record<string, unknown>
        registry = Object.entries(components).map(([name, entry]) => ({
          name,
          ...(entry as Record<string, unknown>),
        }))
      }
    } catch { /* no manifest */ }

    // Read scope from policy.json
    let scope: string[] | null = null
    try {
      const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
      if (existsSync(policyPath)) {
        const raw = readFileSync(policyPath, 'utf8')
        const policy = JSON.parse(raw) as Record<string, unknown>
        if (Array.isArray(policy.componentScope)) {
          scope = policy.componentScope as string[]
        }
      }
    } catch { /* no policy */ }

    return { registry, scope }
  })

  handlers.set('scope:set-scope', async (update: unknown) => {
    const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
    let policy: Record<string, unknown> = {}
    try {
      if (existsSync(policyPath)) {
        policy = JSON.parse(readFileSync(policyPath, 'utf8')) as Record<string, unknown>
      }
    } catch { /* start fresh */ }
    const { scope } = (update ?? {}) as { scope: string[] | null }
    if (scope === null) {
      delete policy.componentScope
    } else {
      policy.componentScope = scope
    }
    const flintDir = path.join(activeProjectRoot, BRAND.configDir)
    if (!existsSync(flintDir)) mkdirSync(flintDir, { recursive: true })
    const tmpPath = policyPath + '.tmp'
    writeFileSync(tmpPath, JSON.stringify(policy, null, 2))
    await fs.rename(tmpPath, policyPath)
    return { ok: true }
  })
  // ── Library ──────────────────────────────────────────────────────────────

  const availableLibraries = [
    { library: 'shadcn', displayName: 'shadcn/ui' },
    { library: 'mui', displayName: 'Material UI (MUI)' },
    { library: 'primeng', displayName: 'PrimeNG / PrimeReact / PrimeVue' },
    { library: 'tailwind', displayName: 'Tailwind CSS' },
  ]

  handlers.set('library:get-active', async () => {
    try {
      const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
      if (existsSync(policyPath)) {
        const policy = JSON.parse(readFileSync(policyPath, 'utf8')) as Record<string, unknown>
        return { library: (policy.selectedLibrary as string) ?? null, availableLibraries }
      }
    } catch { /* non-fatal */ }
    return { library: null, availableLibraries }
  })

  handlers.set('library:set-active', async (payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      return { ok: false, library: null, seeded: 0, error: 'Invalid payload' }
    }
    const { library } = payload as { library: unknown }
    if (library !== null && typeof library !== 'string') {
      return { ok: false, library: null, seeded: 0, error: 'library must be a string or null' }
    }

    try {
      const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
      let policy: Record<string, unknown> = {}
      if (existsSync(policyPath)) {
        try { policy = JSON.parse(readFileSync(policyPath, 'utf8')) as Record<string, unknown> } catch {}
      }

      if (!library || library === 'none') {
        delete policy.selectedLibrary
      } else {
        policy.selectedLibrary = library
      }

      const flintDir = path.join(activeProjectRoot, BRAND.configDir)
      if (!existsSync(flintDir)) mkdirSync(flintDir, { recursive: true })
      const tmpPath = policyPath + '.tmp'
      writeFileSync(tmpPath, JSON.stringify(policy, null, 2) + '\n')
      await fs.rename(tmpPath, policyPath)
      return { ok: true, library: library as string | null, seeded: 0 }
    } catch (err) {
      console.error('[IPC] library:set-active failed:', err)
      return { ok: false, library: null, seeded: 0, error: 'Operation failed' }
    }
  })

  // ── Enrichment ────────────────────────────────────────────────────────────

  handlers.set('enrichment:get-drafts', async () => {
    try {
      // 1. Read enrichment-drafts.json
      const draftsPath = path.join(activeProjectRoot, BRAND.configDir, 'enrichment-drafts.json')
      let drafts: Record<string, unknown> = {}
      if (existsSync(draftsPath)) {
        try {
          const raw = await fs.readFile(draftsPath, 'utf-8')
          const parsed = JSON.parse(raw) as Record<string, unknown>
          drafts = (typeof parsed.drafts === 'object' && parsed.drafts !== null)
            ? parsed.drafts as Record<string, unknown>
            : parsed
        } catch { drafts = {} }
      }

      // 2. Read manifest to compute stats
      const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
      let total = 0, enriched = 0
      if (existsSync(manifestPath)) {
        try {
          const raw = await fs.readFile(manifestPath, 'utf-8')
          const manifest = JSON.parse(raw) as Record<string, unknown>
          const components = (manifest.components ?? {}) as Record<string, unknown>
          for (const entry of Object.values(components)) {
            const e = (entry ?? {}) as Record<string, unknown>
            total++
            if (typeof e.description === 'string' && e.description.length > 0 &&
                typeof e.usageExample === 'string' && e.usageExample.length > 0) {
              enriched++
            }
          }
        } catch {}
      }

      const draftCount = Object.keys(drafts).length
      const bare = Math.max(0, total - enriched - draftCount)
      return { drafts, enrichmentStats: { bare, draft: draftCount, enriched, total } }
    } catch {
      return null
    }
  })

  handlers.set('enrichment:approve', async (payload: unknown) => {
    try {
      if (typeof payload !== 'object' || payload === null ||
          !('componentName' in payload) || !('action' in payload)) {
        return { ok: false, remainingDrafts: 0, error: 'Invalid payload' }
      }
      const { componentName, action, editedFields } = payload as {
        componentName: string; action: string; editedFields?: Record<string, unknown>
      }

      const flintDir = path.join(activeProjectRoot, BRAND.configDir)
      if (!existsSync(flintDir)) mkdirSync(flintDir, { recursive: true })
      const draftsPath = path.join(flintDir, 'enrichment-drafts.json')

      let draftsWrapper: Record<string, unknown> = { drafts: {} }
      let drafts: Record<string, unknown> = {}
      if (existsSync(draftsPath)) {
        try {
          const parsed = JSON.parse(await fs.readFile(draftsPath, 'utf-8')) as Record<string, unknown>
          if (typeof parsed.drafts === 'object' && parsed.drafts !== null) {
            draftsWrapper = parsed
            drafts = parsed.drafts as Record<string, unknown>
          } else {
            drafts = parsed
            draftsWrapper = { drafts: parsed }
          }
        } catch { drafts = {}; draftsWrapper = { drafts: {} } }
      }

      // Approve: merge draft into manifest
      if (action === 'approve') {
        const draft = (drafts[componentName] ?? {}) as Record<string, unknown>
        const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
        let manifest: Record<string, unknown> = {}
        if (existsSync(manifestPath)) {
          try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as Record<string, unknown> } catch {}
        }
        const components = (manifest.components ?? {}) as Record<string, unknown>
        const existing = (components[componentName] ?? {}) as Record<string, unknown>
        components[componentName] = { ...existing, ...draft, ...(editedFields ?? {}) }
        manifest.components = components
        const tmpManifest = manifestPath + '.tmp'
        writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2) + '\n')
        await fs.rename(tmpManifest, manifestPath)
      }

      // Remove from drafts (approve or dismiss)
      delete drafts[componentName]
      draftsWrapper.drafts = drafts
      const tmpDrafts = draftsPath + '.tmp'
      writeFileSync(tmpDrafts, JSON.stringify(draftsWrapper, null, 2) + '\n')
      await fs.rename(tmpDrafts, draftsPath)

      return { ok: true, remainingDrafts: Object.keys(drafts).length }
    } catch (err) {
      console.error('[IPC] enrichment:approve failed:', err)
      return { ok: false, remainingDrafts: 0, error: 'Operation failed' }
    }
  })

  // ── Design-to-Code ────────────────────────────────────────────────────────

  handlers.set('d2c:apply', async (request: unknown) => {
    const EMPTY_TREE: FileTreeNode = { name: '', path: '', type: 'directory', children: [] }
    try {
      if (typeof request !== 'object' || request === null ||
          !('pageName' in request) || !('components' in request) || !('page' in request)) {
        return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid request' }
      }
      const req = request as { pageName: string; components: Array<{ name: string; code: string }>; page: { name: string; code: string }; themeFile?: { filename: string; code: string } }

      // Validate path segments to prevent directory traversal.
      function isSafePathSegment(s: unknown): s is string {
        if (typeof s !== 'string' || s.length === 0) return false
        return !/[/\\]|\.\./.test(s)
      }
      if (!isSafePathSegment(req.pageName)) {
        return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid pageName' }
      }

      // Target directory for generated components
      const targetDir = path.join(activeProjectRoot, 'src', 'components', 'generated', req.pageName)
      await fs.mkdir(targetDir, { recursive: true })

      // Build file batch
      const fileBatch = new Map<string, string>()
      const componentFilePaths: string[] = []

      for (const comp of req.components) {
        if (typeof comp.name !== 'string' || typeof comp.code !== 'string') continue
        if (!isSafePathSegment(comp.name)) {
          return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: `Invalid component name: ${comp.name}` }
        }
        const filePath = path.join(targetDir, `${comp.name}.tsx`)
        if (!filePath.startsWith(activeProjectRoot + path.sep)) {
          return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: `Path outside project root: ${filePath}` }
        }
        fileBatch.set(filePath, comp.code)
        componentFilePaths.push(filePath)
      }

      // Page compositor
      if (!isSafePathSegment(req.page.name)) {
        return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid page name' }
      }
      const pageFilePath = path.join(targetDir, `${req.page.name}.tsx`)
      let pageCode = req.page.code
      if (!/export\s+default\b/.test(pageCode)) {
        pageCode = pageCode + `\nexport default ${req.page.name};\n`
      }
      fileBatch.set(pageFilePath, pageCode)

      // Write all files atomically
      for (const [fp, content] of fileBatch) {
        const tmpPath = fp + '.tmp'
        writeFileSync(tmpPath, content)
        await fs.rename(tmpPath, fp)
      }

      // Theme file
      if (req.themeFile && typeof req.themeFile.filename === 'string') {
        const themeFilePath = path.join(activeProjectRoot, req.themeFile.filename)
        if (!themeFilePath.startsWith(activeProjectRoot + path.sep)) {
          throw new Error(`d2c:apply — theme file path escapes project root: ${themeFilePath}`)
        }
        const tmpPath = themeFilePath + '.tmp'
        writeFileSync(tmpPath, req.themeFile.code)
        await fs.rename(tmpPath, themeFilePath)
      }

      // Re-scan workspace
      const workspaceTree = await scanDirectory(activeProjectRoot)
      return { ok: true, pageFilePath, componentFilePaths, workspaceTree }
    } catch (err) {
      console.error('[IPC] d2c:apply failed:', err)
      return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Operation failed' }
    }
  })

  // ── Workspace rescan ───────────────────────────────────────────────────────

  handlers.set('workspace:rescan', async () => {
    if (!activeProjectRoot) return null
    return scanDirectory(activeProjectRoot)
  })

  // ── Preview Server ──────────────────────────────────────────────────────
  // Delegates to the createPreviewServer() singleton. The service owns the
  // idempotency guard — calling start() with the same root twice returns the
  // cached URL without stopping/restarting the server.

  handlers.set('preview:start', async (projectRoot: unknown) => {
    if (typeof projectRoot !== 'string') {
      return { error: 'preview:start — projectRoot must be a string' }
    }
    // In web mode, the srcdoc + code:transform pipeline is the correct preview
    // mechanism. Starting a separate Vite dev server hijacks the iframe with
    // src= which makes all srcdoc writes invisible. Return an error so
    // LivePreview stays in srcdoc mode.
    return { error: 'Vite preview server disabled in web mode — using srcdoc preview' }
  })

  handlers.set('preview:stop', async () => {
    await previewService.stop()
  })

  handlers.set('preview:url', async () => {
    return previewService.getUrl()
  })

  // ── Autopilot (MCP-powered file watch + audit) ────────────────────────────

  let autopilotWatcher: ReturnType<typeof setTimeout> | null = null
  let autopilotFilePath: string | null = null

  handlers.set('autopilot:enable', async (filePath: unknown) => {
    if (typeof filePath !== 'string') return
    autopilotFilePath = filePath as string

    // Clear any existing watcher
    if (autopilotWatcher) { clearInterval(autopilotWatcher); autopilotWatcher = null }

    // Run an immediate audit via MCP
    const runAudit = async () => {
      if (!autopilotFilePath || !mcp.status().connected) return
      try {
        const result = await mcp.callTool('audit_ui_component', { file: autopilotFilePath })
        const text = result.content?.[0]?.text ?? '{}'
        const parsed = JSON.parse(text) as Record<string, unknown>
        broadcast('flint:autopilot-result', {
          filePath: autopilotFilePath,
          governedSource: '',
          fixableCount: (parsed.fixableCount as number) ?? 0,
          mithrilCount: (parsed.mithrilCount as number) ?? 0,
          a11yCount: (parsed.a11yCount as number) ?? 0,
          timestamp: Date.now(),
        })
      } catch { /* audit failed — silent */ }
    }

    void runAudit()
    // Re-audit every 2 seconds while enabled
    autopilotWatcher = setInterval(() => void runAudit(), 2000)
  })

  handlers.set('autopilot:disable', async () => {
    if (autopilotWatcher) { clearInterval(autopilotWatcher); autopilotWatcher = null }
    autopilotFilePath = null
  })

  // ── Dialogs (web uses --project CLI flag; no native OS picker) ─────────────

  handlers.set('dialog:openFolder', async () => null)
  handlers.set('dialog:selectFolder', async () => null)

  // ── Import summary ──────────────────────────────────────────────────────

  handlers.set('import:snap-to-token', async (payload: unknown) => {
    if (
      typeof payload !== 'object' || payload === null ||
      typeof (payload as any).nodeId !== 'string' ||
      typeof (payload as any).tokenPath !== 'string' ||
      typeof (payload as any).className !== 'string' ||
      typeof (payload as any).originalClass !== 'string'
    ) {
      return { ok: false, error: 'Invalid payload: missing or wrong-type fields' }
    }

    // Resolve the active file from context.json — same approach as Electron
    const contextPath = path.join(activeProjectRoot, BRAND.configDir, 'context.json')
    let activeFile: string | null = null
    try {
      const raw = await fs.readFile(contextPath, 'utf-8')
      const ctx = JSON.parse(raw) as Record<string, unknown>
      if (typeof ctx.activeFile === 'string' && ctx.activeFile.length > 0) {
        activeFile = ctx.activeFile
      }
    } catch {
      return { ok: false, error: 'Cannot read context.json — no active file available' }
    }

    if (!activeFile) {
      return { ok: false, error: 'No active file in context.json' }
    }

    if (!isWithinHome(activeFile)) {
      return { ok: false, error: 'Active file path is outside home directory' }
    }

    if (!mcp.status().connected) return { ok: false, error: 'MCP not connected' }
    try {
      await mcp.callTool('flint_fix', { file: activeFile, dry_run: false })
      return { ok: true }
    } catch (err) {
      console.error('[IPC] import:snap-to-token failed:', err)
      return { ok: false, error: 'Operation failed' }
    }
  })

  handlers.set('import:undo-all-heals', async () => {
    // In web mode there is no server-side preHealCodeStore (the ingestion server
    // runs in its own service). Signal the renderer to revert using the broadcast
    // channel so any connected WebSocket client can handle the restore locally.
    broadcast('flint:hydro-paste-auto', null)
    return { ok: true }
  })

  // ── HydroPaste (delegates to MCP) ──────────────────────────────────────────

  handlers.set('flint:hydro-paste', async (payloadStr: unknown) => {
    if (!mcp.status().connected) return { error: 'MCP not connected' }
    try {
      const result = await mcp.callTool('hydrate_figma_data', { payload: payloadStr as string })
      const text = result.content?.[0]?.text ?? '{}'
      return JSON.parse(text)
    } catch (err) {
      console.error('[IPC] flint:hydro-paste failed:', err)
      return { error: 'Operation failed' }
    }
  })

  // ── Thumbnails (Puppeteer) ──────────────────────────────────────────────

  const { createThumbnailService } = await import('./services/thumbnailService.js')
  const thumbnails = createThumbnailService()

  handlers.set('thumbnails:generate', async (payload: unknown) => {
    const p = (payload ?? {}) as { filePath: string; componentName: string; width?: number; height?: number }
    return thumbnails.generate({ ...p, projectRoot: activeProjectRoot })
  })

  handlers.set('thumbnails:generate-all', async () => {
    return thumbnails.generateAll(activeProjectRoot)
  })

  handlers.set('thumbnails:get', async (componentName: unknown) => {
    return thumbnails.get(componentName as string, activeProjectRoot)
  })

  handlers.set('thumbnails:invalidate', async (componentName: unknown) => {
    await thumbnails.invalidate(componentName as string, activeProjectRoot)
  })

  // ── Debug Routes ───────────────────────────────────────────────────────────

  app.get('/api/debug/ide-sync', (_req, res) => {
    res.json({
      activeProjectRoot,
      lastMtime: ideFileSyncState.lastMtime,
      lastPath: ideFileSyncState.lastPath,
      tickRunning: true,
      wsClients: wss.clients.size,
    })
  })

  // ── IPC Dispatch Route ─────────────────────────────────────────────────────

  app.post('/api/ipc', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ result: null, error: 'Request body not parsed — check Content-Type header' })
      return
    }
    const { channel, args } = req.body
    if (typeof channel !== 'string') {
      res.json({ result: null, error: 'Missing channel' })
      return
    }

    const handler = handlers.get(channel)
    if (!handler) {
      // Priority 3: sensible defaults for unimplemented channels
      console.warn(`${BRAND.logPrefix} Unhandled channel: ${channel}`)

      // Return type-appropriate defaults based on naming conventions
      if (channel.endsWith(':read-all') || channel.endsWith(':list')) {
        res.json({ result: [] })
      } else if (channel.includes('count') || channel.includes('Count')) {
        res.json({ result: 0 })
      } else if (channel.includes('is-') || channel.includes('check')) {
        res.json({ result: false })
      } else if (channel.includes('get') || channel.includes('read') || channel.includes('status')) {
        res.json({ result: null })
      } else {
        res.json({ result: { ok: true } })
      }
      return
    }

    try {
      const result = await handler(...(args || []))
      res.json({ result: result ?? null })
    } catch (e: unknown) {
      console.error(`[IPC] ${channel} failed:`, e)
      const msg = e instanceof Error ? e.message : String(e)
      res.json({ result: null, error: `${channel}: ${msg}` })
    }
  })

  // ── Static File Serving ────────────────────────────────────────────────────
  // In production, serves the pre-built Glass UI from dist-web/.

  const distWebPath = path.resolve(__dirname, '..', 'dist-web')
  if (existsSync(distWebPath)) {
    app.use(express.static(distWebPath))
    // SPA fallback — serve index.html for all non-API routes.
    // path-to-regexp v8+ requires a named wildcard: '*path' not '*'.
    app.get('*path', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      res.sendFile(path.join(distWebPath, 'index.html'))
    })
  }

  // ── Start Server ───────────────────────────────────────────────────────────

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`${BRAND.logPrefix} Flint Glass Web Server running on http://localhost:${port}`)
      console.log(`${BRAND.logPrefix} Project: ${activeProjectRoot}`)
      console.log(`${BRAND.logPrefix} WebSocket: ws://localhost:${port}/ws`)

      resolve({
        app,
        server,
        wss,
        close: async () => {
          if (autopilotWatcher) { clearInterval(autopilotWatcher); autopilotWatcher = null }
          const ideStop = (globalThis as Record<string, unknown>).__flintIDEFileSyncStop
          if (typeof ideStop === 'function') (ideStop as () => void)()
          await ingestion.stop().catch(() => {})
          await mcp.stop().catch(() => {})
          db.close()
          registryDb.close()
          return new Promise<void>((resolveClose) => {
            wss.close(() => {
              server.close(() => resolveClose())
            })
          })
        },
      })
    })
  })
}
