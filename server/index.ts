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
  return resolved === home || resolved.startsWith(home + path.sep)
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
  if (!isWithinHome(filePath)) {
    throw new Error('path outside user home directory is not permitted')
  }
  return filePath
}

// ── Atomic File Write ────────────────────────────────────────────────────────
// Mirrors FileTransactionManager: write to .tmp, then rename.

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = filePath + '.tmp'
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
      session_id  TEXT,
      deferred_at TEXT    NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      UNIQUE(file_path, rule_id, node_id)
    );
  `)

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

  const deferViolationUpsert = db.prepare<[string, string, string | null, string | null, string]>(`
    INSERT INTO deferred_violations (file_path, rule_id, node_id, reason, session_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(file_path, rule_id, node_id)
    DO UPDATE SET
      reason      = excluded.reason,
      session_id  = excluded.session_id,
      deferred_at = datetime('now'),
      resolved_at = NULL
  `)

  const deferViolationSelectUnresolved = db.prepare(
    `SELECT id, file_path, rule_id, node_id, reason, session_id, deferred_at
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

  const app = express()
  app.use(express.json({ limit: '10mb' }))

  const server = http.createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  function broadcast(channel: string, data: unknown): void {
    const message = JSON.stringify({ channel, data })
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }

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
    await atomicWrite(validated, content)
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

    await Promise.all(
      [...validated.entries()].map(([fp, content]) => atomicWrite(fp, content)),
    )
  })

  // ── Code Transform ─────────────────────────────────────────────────────────

  handlers.set('code:transform', async (code: unknown) => {
    if (typeof code !== 'string') {
      return { js: null, error: 'code must be a string' }
    }
    try {
      const result = transformSync(code, {
        filename: 'App.tsx',
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

      // Rewrite `export default function/class Foo` -> `function/class Foo`
      let componentName: string | null = null
      js = js.replace(
        /\bexport\s+default\s+(function|class)\s+(\w+)/,
        (_m: string, kw: string, name: string) => {
          componentName = name
          return `${kw} ${name}`
        },
      )

      // Fallback: `export default Foo`
      if (componentName === null) {
        js = js.replace(
          /^export\s+default\s+(\w+)\s*;?\s*$/m,
          (_m: string, name: string) => {
            componentName = name
            return ''
          },
        )
      }

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
    if (!isWithinHome(normalized)) return null

    try {
      const tree = await scanDirectory(normalized)
      const projectName = path.basename(normalized)
      registryUpsert.run(randomUUID(), projectName, normalized)
      activeProjectRoot = normalized
      sessionExplicitlyOpened = true
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

    // Start MCP for the new project
    void mcp.start(targetPath).catch(() => {})

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
    return {
      path: activeProjectRoot,
      name: path.basename(activeProjectRoot),
      isScratchpad: /Flint Projects\/Untitled/i.test(activeProjectRoot),
    }
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
    void mcp.start(targetPath).catch(() => {})

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
    filePath: unknown, ruleId: unknown, nodeId?: unknown, reason?: unknown,
  ) => {
    if (typeof filePath !== 'string' || typeof ruleId !== 'string') {
      throw new TypeError('governance:defer-violation — filePath and ruleId must be strings')
    }
    const nId = typeof nodeId === 'string' ? nodeId : null
    const r = typeof reason === 'string' ? reason : null
    deferViolationUpsert.run(filePath, ruleId, nId, r, governanceSessionId)
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
    return mcp.callTool(
      name as string,
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

  handlers.set('ai:apply-batch', async () => ({ ok: true }))

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
      return { error: err instanceof Error ? err.message : String(err) }
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
      return { ok: false, library: null, seeded: 0, error: err instanceof Error ? err.message : String(err) }
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
      return { ok: false, remainingDrafts: 0, error: err instanceof Error ? err.message : String(err) }
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
      const home = os.homedir()

      // Target directory for generated components
      const targetDir = path.join(activeProjectRoot, 'src', 'components', 'generated', req.pageName)
      await fs.mkdir(targetDir, { recursive: true })

      // Build file batch
      const fileBatch = new Map<string, string>()
      const componentFilePaths: string[] = []

      for (const comp of req.components) {
        if (typeof comp.name !== 'string' || typeof comp.code !== 'string') continue
        const filePath = path.join(targetDir, `${comp.name}.tsx`)
        if (!filePath.startsWith(home + path.sep)) {
          return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: `Path outside home: ${filePath}` }
        }
        fileBatch.set(filePath, comp.code)
        componentFilePaths.push(filePath)
      }

      // Page compositor
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
        if (themeFilePath.startsWith(home + path.sep)) {
          const tmpPath = themeFilePath + '.tmp'
          writeFileSync(tmpPath, req.themeFile.code)
          await fs.rename(tmpPath, themeFilePath)
        }
      }

      // Re-scan workspace
      const workspaceTree = await scanDirectory(activeProjectRoot)
      return { ok: true, pageFilePath, componentFilePaths, workspaceTree }
    } catch (err) {
      return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: err instanceof Error ? err.message : String(err) }
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
    return previewService.start(projectRoot)
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
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
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
      return { error: err instanceof Error ? err.message : String(err) }
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

  // ── IPC Dispatch Route ─────────────────────────────────────────────────────

  app.post('/api/ipc', async (req, res) => {
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
    } catch (e: any) {
      console.error(`${BRAND.logPrefix} Handler error [${channel}]:`, e.message)
      res.json({ result: null, error: e.message })
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
    server.listen(port, () => {
      console.log(`${BRAND.logPrefix} Flint Glass Web Server running on http://localhost:${port}`)
      console.log(`${BRAND.logPrefix} Project: ${activeProjectRoot}`)
      console.log(`${BRAND.logPrefix} WebSocket: ws://localhost:${port}/ws`)

      resolve({
        app,
        server,
        wss,
        close: async () => {
          if (autopilotWatcher) { clearInterval(autopilotWatcher); autopilotWatcher = null }
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
