import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, session } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, readFile, writeFile, mkdir, rename, stat as fsStat, open as fsOpen } from 'node:fs/promises'
import { existsSync, mkdirSync, watch as fsWatch } from 'node:fs'
import { execFile } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import os from 'node:os'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import { snapToToken } from './ingestion/index.js'

// ── FileTreeNode ───────────────────────────────────────────────────────────────
// Mirrors the renderer-side type in src/types/bridge-api.d.ts.
// Cannot be imported cross-boundary, so it is re-declared here.
interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    children?: FileTreeNode[]
}

/** Tracks the active project root so the main process can locate bridge-manifest.json. */
let activeProjectRoot: string | null = null

/**
 * Server-side store for pre-heal code (Security fix for SECURITY-01).
 * The heal pass in ingestion-server.ts sets this; the undo handler reads it.
 * Keyed by 'latest' — only the most recent heal is undoable.
 */
const preHealCodeStore = new Map<string, string>()

/** Directory names that are always excluded from the recursive scan. */
const EXCLUDED_DIRS = new Set([
    'node_modules', 'dist', 'dist-electron', '.git', '.next',
    'build', 'out', 'coverage', '.turbo', '.cache',
])

/**
 * Recursively scans `dirPath` for `.tsx/.ts/.jsx/.js` files.
 * Hidden files/directories (name starts with `.`) are skipped.
 * Directories listed in `EXCLUDED_DIRS` are skipped entirely.
 * The returned `children` array is sorted: directories first, then files,
 * both groups sorted alphabetically.
 *
 * Uses `fs.promises.readdir` with `withFileTypes: true` so each level is
 * a non-blocking async I/O call — no risk of blocking the Electron main thread.
 */
async function scanDirectory(dirPath: string): Promise<FileTreeNode> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const children: FileTreeNode[] = []

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue  // skip hidden

        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue
            const subtree = await scanDirectory(fullPath)
            // Only include directories that contain at least one source file
            if ((subtree.children?.length ?? 0) > 0) {
                children.push(subtree)
            }
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
            children.push({ name: entry.name, path: fullPath, type: 'file' })
        }
    }

    // Sort: directories before files, then alphabetical within each group
    children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
    })

    return { name: path.basename(dirPath), path: dirPath, type: 'directory', children }
}
import { promisify } from 'node:util'
import { transformSync } from '@babel/core'

const execFileAsync = promisify(execFile)
import { fileTransactionManager } from './FileTransactionManager.js'
import { gitManager } from './GitManager.js'
import { jsxAttribute, jsxIdentifier, stringLiteral } from '@babel/types'
import type { JSXOpeningElement } from '@babel/types'
import type { NodePath } from '@babel/traverse'
import { startViteServer, stopViteServer, getPreviewUrl } from './preview/viteServer.js'
import { mcpClient } from './mcpClient.js'
import { RENDERER_ALLOWED_MCP_TOOLS } from './mcp-policy.js'

// Must be called synchronously before app.whenReady() fires.
// Suppresses the Chromium SharedImageManager / GPU mailbox errors that spam
// the terminal during development on machines without a discrete GPU.
app.disableHardwareAcceleration()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Dist output directories
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD_PATH = path.join(__dirname, 'preload.js')

let mainWindow: BrowserWindow | null = null
let stopServer: (() => void) | null = null

// ── GOV.2: Session UUID ───────────────────────────────────────────────────────
// Generated once at app launch and used as the sessionId for all governance
// event telemetry within this Glass session. A new UUID is produced on every
// restart, so override counts reset cleanly between sessions.
const governanceSessionId: string = randomUUID()

// ── Bridge ID Babel Plugin ────────────────────────────────────────────────────
//
// Injects `data-bridge-id="tagName:line:col"` onto every JSXOpeningElement
// during preview compilation. This attribute links AST nodes to their DOM
// counterparts, enabling the bi-directional Layer Tree ↔ Live Preview
// selection feature (highlight + click-to-select).
//
// This attribute is added ONLY to the Babel output sent to the srcdoc iframe —
// it is never written back to the user's source code.
function injectBridgeIdPlugin() {
    return {
        visitor: {
            JSXOpeningElement(path: NodePath<JSXOpeningElement>): void {
                const loc = path.node.loc
                if (loc == null) return

                const nameNode = path.node.name
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

                const bridgeId = `${tagName}:${loc.start.line}:${loc.start.column}`

                // Skip if already injected (idempotent guard)
                const alreadySet = path.node.attributes.some((attr) => {
                    if (attr.type !== 'JSXAttribute') return false
                    const name = attr.name
                    return name.type === 'JSXIdentifier' && name.name === 'data-bridge-id'
                })
                if (alreadySet) return

                path.node.attributes.push(
                    jsxAttribute(
                        jsxIdentifier('data-bridge-id'),
                        stringLiteral(bridgeId)
                    )
                )
            },
        },
    }
}

// ── Application Menu ──────────────────────────────────────────────────────────
// Builds and sets the native OS menu bar. File menu items send IPC push events
// to the renderer via mainWindow.webContents.send so App.tsx can react without
// any new ipcMain.handle round-trips.
function buildAppMenu(): void {
    const isMac = process.platform === 'darwin'

    const template: MenuItemConstructorOptions[] = [
        // macOS requires the first menu item to be the app menu (shows the app name).
        ...(isMac ? [{ role: 'appMenu' as const }] : []),

        // ── File ──────────────────────────────────────────────────────────────
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project\u2026',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => { mainWindow?.webContents.send('menu:new-project') },
                },
                {
                    label: 'Open Project\u2026',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => { mainWindow?.webContents.send('menu:open-project') },
                },
                { type: 'separator' },
                {
                    label: 'Save Project As\u2026',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => { mainWindow?.webContents.send('menu:save-project-as') },
                },
                { type: 'separator' },
                {
                    label: 'Close Project',
                    accelerator: 'CmdOrCtrl+Shift+W',
                    click: () => { mainWindow?.webContents.send('menu:close-project') },
                },
            ],
        },

        // ── Edit / View / Window ─────────────────────────────────────────────
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── SEC.1: Content Security Policy constants ──────────────────────────────────
// Injected as HTTP response headers via session.webRequest.onHeadersReceived.
// Defense-in-depth alongside the <meta> CSP in index.html — header-based CSP
// cannot be overridden by page content, data: URLs, or blob: URLs.

const DEVELOPMENT_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:*",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob: http://localhost:*",
].join('; ')

const PRODUCTION_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' http://127.0.0.1:*",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob: http://localhost:*",
].join('; ')

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Bridge IDE',
        webPreferences: {
            preload: PRELOAD_PATH,
            contextIsolation: true,
            nodeIntegration: false,
            // Fix 5 (P3-2): sandbox: true is architecturally blocked here.
            // vite-plugin-electron compiles the preload as an ESM module.
            // Electron's renderer sandbox cannot bootstrap ESM preloads — the
            // sandbox intercepts `require` but ESM is loaded via a different
            // code path that sandbox mode does not support in Electron 35.
            // Mitigation: contextIsolation: true + contextBridge enforce the
            // process boundary at the API surface level. The preload exposes
            // no Node.js APIs directly; all calls go through the typed
            // BridgeAPI surface defined in src/types/bridge-api.d.ts.
            // Track: https://github.com/electron/electron/issues — revisit
            // when vite-plugin-electron gains sandbox-compatible ESM output.
            // See: .bridge-context/decisions.md
            sandbox: false,
        },
    })

    // Fix 4 (P3-1): Only open DevTools in development builds.
    // In packaged production releases this would expose internal state to users.
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools()
    }

    // SEC.1: Inject Content Security Policy as an HTTP response header.
    // Defense-in-depth alongside the <meta> CSP in index.html.
    // Dev CSP includes 'unsafe-eval' (required for Vite HMR) and ws://localhost:*.
    // Production CSP omits 'unsafe-eval' — the only new Function() usage in
    // production is inside the sandboxed srcdoc iframe which has its own CSP context.
    const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const csp = isDev ? DEVELOPMENT_CSP : PRODUCTION_CSP
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
            },
        })
    })

    // Load the Vite dev server in development, or the built files in production
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('ping', () => 'pong from Main Process ✓')

// ── Open Folder Handler ────────────────────────────────────────────────────────
// Shows a native OS directory picker and returns a recursive FileTreeNode tree
// rooted at the chosen directory. Only .tsx/.ts/.jsx/.js files are included.
// Empty subdirectories (after filtering) are omitted.
//
// Security: the directory is chosen by the user via a system dialog — no path
// is accepted from the renderer. The scan is restricted to paths within the
// user's home directory.
//
// Returns null if the user cancels the picker.
ipcMain.handle(
    'dialog:openFolder',
    async (): Promise<FileTreeNode | null> => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Open Project Folder',
            buttonLabel: 'Open',
        })
        if (canceled || filePaths.length === 0) return null

        const folderPath = path.normalize(filePaths[0])
        const home = app.getPath('home')

        // Security: restrict scanning to the user's home directory
        if (folderPath !== home && !folderPath.startsWith(home + path.sep)) {
            return null
        }

        // Ensure git repo exists so we can track shadow commits
        await gitManager.ensureRepo(folderPath).catch(err => {
            console.error(`[Bridge] main.ts: ensureRepo failed for ${folderPath}`, err)
        })

        activeProjectRoot = folderPath
        // Phase W.3: start MCP client for the newly opened project
        void mcpClient.start(folderPath).catch((err) => {
            console.error('[Bridge] mcpClient.start failed after openFolder:', err)
        })
        return scanDirectory(folderPath)
    }
)

// ── Read File Handler ─────────────────────────────────────────────────────────
// Reads the raw UTF-8 content of a single source file. Called by the renderer
// when the user clicks a file in the FileExplorer sidebar.
//
// Security constraints (mirrors ast:save-file):
//   • filePath must be an absolute path.
//   • filePath must end with .tsx/.ts/.jsx/.js.
//   • filePath must reside within the user's home directory.
ipcMain.handle('file:read', async (_event, filePath: unknown): Promise<string> => {
    if (typeof filePath !== 'string') {
        throw new TypeError('file:read — filePath must be a string')
    }
    if (!path.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
        throw new Error('file:read — filePath must be an absolute path to a .tsx/.ts/.jsx/.js file')
    }
    const home = app.getPath('home')
    if (!filePath.startsWith(home + path.sep)) {
        throw new Error('file:read — path outside user home directory is not permitted')
    }
    return readFile(filePath, 'utf-8')
})

// ── Code Transform Handler ─────────────────────────────────────────────────────
// Transforms TSX source to preview-ready JS in the privileged main process
// (full Node.js, no CSP restrictions). The renderer calls this via IPC and
// injects the resulting JS into a srcdoc iframe for live preview.
ipcMain.handle('code:transform', (_event, code: unknown): { js: string | null; error: string | null } => {
    if (typeof code !== 'string') {
        return { js: null, error: 'code must be a string' }
    }
    try {
        const result = transformSync(code, {
            filename: 'App.tsx',
            plugins: [
                ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
                injectBridgeIdPlugin,
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

        // Strip ES module import statements — React etc. will be globals in the iframe.
        js = js.replace(/^import\s[^\n]*\n?/gm, '')

        // Rewrite `export default function/class Foo` → `function/class Foo`
        // and record the component name so we can assign it to window.__AppComponent.
        let componentName: string | null = null
        js = js.replace(
            /\bexport\s+default\s+(function|class)\s+(\w+)/,
            (_m: string, kw: string, name: string) => {
                componentName = name
                return `${kw} ${name}`
            }
        )

        // Fallback: `export default Foo` (bare identifier after a declaration above)
        if (componentName === null) {
            js = js.replace(
                /^export\s+default\s+(\w+)\s*;?\s*$/m,
                (_m: string, name: string) => {
                    componentName = name
                    return ''
                }
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

// ── Preview Server IPC (Phase N.4) ───────────────────────────────────────────

/**
 * preview:start — Boots a programmatic Vite dev server at `projectRoot`.
 * Returns the URL the renderer should load in the preview iframe.
 *
 * Security: projectRoot must be an absolute path within the user's home dir.
 */
ipcMain.handle('preview:start', async (_event, projectRoot: unknown): Promise<{ url: string } | { error: string }> => {
    if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) {
        return { error: 'preview:start — projectRoot must be an absolute path' }
    }
    const home = app.getPath('home')
    if (projectRoot !== home && !projectRoot.startsWith(home + path.sep)) {
        return { error: 'preview:start — path outside user home directory is not permitted' }
    }
    try {
        const url = await startViteServer(projectRoot)
        return { url }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Bridge] preview:start failed:', msg)
        return { error: `Preview server failed to start: ${msg}` }
    }
})

/**
 * preview:stop — Gracefully shuts down the running preview Vite server.
 * Safe to call when no server is running (idempotent).
 */
ipcMain.handle('preview:stop', async (): Promise<void> => {
    await stopViteServer()
})

/**
 * preview:url — Returns the current preview server URL, or null.
 * Used by the renderer to query the URL without triggering a restart.
 */
ipcMain.handle('preview:url', (): string | null => {
    return getPreviewUrl()
})

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    // Initialise the database first (imported for side-effects: tables are
    // created synchronously inside store.ts on module load).
    const { default: db } = await import('./store.js')

    // ── Token CRUD Handlers (v2) ─────────────────────────────────────────────
    // Prepared statements are scoped to this closure — created once, reused
    // across all IPC invocations (better-sqlite3 best practice).
    //
    // stmtCreate uses an UPSERT so that re-ingesting Figma variables is always
    // safe: inserting the same (token_path, mode, collection_name) triple updates
    // token_value + description in place rather than throwing a UNIQUE error.
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
    const stmtDelete = db.prepare<[number]>(
        'DELETE FROM design_tokens WHERE id = ?'
    )
    const stmtClearAll = db.prepare('DELETE FROM design_tokens')

    // Notifies all open renderer windows that the design_tokens table changed.
    // Called after every mutating token IPC handler so reactive subscribers
    // (watchTokens) receive updates regardless of which source triggered the write.
    function broadcastTokensUpdated(): void {
        BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.webContents.send('bridge:tokens-updated')
        })
    }

    ipcMain.handle('tokens:create', (_event, token: unknown) => {
        if (
            typeof token !== 'object' || token === null ||
            typeof (token as Record<string, unknown>).token_path !== 'string' ||
            typeof (token as Record<string, unknown>).token_type !== 'string' ||
            typeof (token as Record<string, unknown>).token_value !== 'string'
        ) {
            throw new Error('tokens:create — invalid payload shape')
        }
        const t = token as {
            token_path: string
            token_type: string
            token_value: string
            description?: string
            mode?: string
            collection_name?: string
        }
        const mode = typeof t.mode === 'string' && t.mode.trim() !== '' ? t.mode : 'default'
        const collection_name =
            typeof t.collection_name === 'string' && t.collection_name.trim() !== ''
                ? t.collection_name
                : 'default'

        const result = stmtCreate.run(
            t.token_path, t.token_type, t.token_value,
            t.description ?? null,
            mode, collection_name
        )
        broadcastTokensUpdated()
        return { id: result.lastInsertRowid }
    })

    ipcMain.handle('tokens:read-all', () => stmtReadAll.all())

    ipcMain.handle('tokens:update', (_event, tokenPath: unknown, updates: unknown) => {
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
        // Always bump updated_at alongside user-supplied changes
        setClauses.push("updated_at = strftime('%s', 'now')")

        // Safe from injection: setClauses is built from a strict field allowlist;
        // all user values are bound via ? parameterization.
        const sql = `UPDATE design_tokens SET ${setClauses.join(', ')} WHERE token_path = ?`
        const result = db.prepare(sql).run(...params, tokenPath)
        broadcastTokensUpdated()
        return { changes: result.changes }
    })

    ipcMain.handle('tokens:delete', (_event, id: unknown) => {
        if (typeof id !== 'number' || !Number.isInteger(id)) {
            throw new Error('tokens:delete — id must be an integer')
        }
        const result = stmtDelete.run(id)
        broadcastTokensUpdated()
        return { changes: result.changes }
    })

    ipcMain.handle('tokens:clear-all', () => {
        const result = stmtClearAll.run()
        console.log(`[Bridge] tokens:clear-all: removed ${result.changes} tokens`)
        broadcastTokensUpdated()
        return { changes: result.changes }
    })

    // ── Component Override Clear Handler (Phase E — Garbage Collection) ────────
    // Deletes the component_overrides row for `bridgeId`, releasing the export
    // lock associated with a deleted AST node. Called by the renderer-side
    // applyMutationBatch deleteNode path via window.bridgeAPI.tokens.clearOverride.
    //
    // Silent no-op if the row does not exist (idempotent).
    ipcMain.handle('tokens:clear-override', (_event, bridgeId: unknown): void => {
        if (typeof bridgeId !== 'string' || bridgeId.length === 0) return
        db.prepare('DELETE FROM component_overrides WHERE bridge_id = ?').run(bridgeId)
    })

    // ── Component Override Upsert Handler (Phase E — Write Pathway) ───────────
    // INSERT OR REPLACE a single property row in component_overrides, recording
    // that `propertyKey` on `bridgeId` has been manually overridden.
    //
    // The composite PK (bridge_id, property_key) ensures each property for a
    // given element has exactly one row; subsequent edits to the same property
    // update the row in-place via the ON CONFLICT replacement.
    //
    // The Export Gate (canExport) reads overridesExist, updated optimistically
    // by the renderer via canvasStore.setOverridesExist after each commit.
    ipcMain.handle(
        'tokens:upsert-override',
        (_event, bridgeId: unknown, propertyKey: unknown, propertyValue: unknown): void => {
            if (
                typeof bridgeId !== 'string' || bridgeId.length === 0 ||
                typeof propertyKey !== 'string' || propertyKey.length === 0 ||
                typeof propertyValue !== 'string'
            ) return
            db.prepare(
                `INSERT OR REPLACE INTO component_overrides
                    (bridge_id, property_key, property_value, updated_at)
                 VALUES (?, ?, ?, strftime('%s','now'))`
            ).run(bridgeId, propertyKey, propertyValue)
        }
    )

    // ── Component Override Read Handler (Phase B.2 — Export Gate) ─────────────
    // Returns every row in component_overrides so the ExportModal can surface
    // exactly which bridge IDs and properties are blocking export.
    // Results are ordered by updated_at DESC so the most recently dirtied nodes
    // appear first in the violation list.
    type OverrideRow = {
        bridge_id: string
        property_key: string
        property_value: string
        updated_at: number
    }
    const stmtReadOverrides = db.prepare<[], OverrideRow>(`
        SELECT bridge_id, property_key, property_value, updated_at
        FROM component_overrides
        ORDER BY updated_at DESC
    `)
    ipcMain.handle('tokens:read-overrides', (): OverrideRow[] => stmtReadOverrides.all())

    // ── Presence UPSERT Handler ──────────────────────────────────────────────
    // Receives batched cursor/selection updates from the renderer (sent at most
    // every 50–100 ms via the renderer-side throttle in useSyncPresence).
    // The main process simply performs an UPSERT — no additional batching needed.
    //
    // Payload shape: { id, userId, nodeId, x, y }
    //   id     — session UUID that uniquely identifies the sender's presence row
    //   userId — human-readable display name or generated handle
    //   nodeId — the bridge ID of the node currently selected (may be '')
    //   x, y   — cursor coordinates in canvas space
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

    ipcMain.handle('sync:update-presence', (_event, payload: unknown): void => {
        if (
            typeof payload !== 'object' || payload === null ||
            typeof (payload as Record<string, unknown>).id !== 'string' ||
            typeof (payload as Record<string, unknown>).userId !== 'string' ||
            typeof (payload as Record<string, unknown>).x !== 'number' ||
            typeof (payload as Record<string, unknown>).y !== 'number'
        ) {
            throw new Error('sync:update-presence — invalid payload')
        }
        const p = payload as { id: string; userId: string; nodeId?: string; x: number; y: number }
        stmtUpsertPresence.run(p.id, p.userId, p.nodeId ?? '', p.x, p.y)
    })

    // ── Read-Presence Handler ──────────────────────────────────────────────────
    // Returns all presence rows whose updated_at falls within the last 30 s.
    // Called by the renderer at ~5 Hz to refresh the remote-cursor overlay.
    // Rows older than 30 s are excluded so stale cursors vanish automatically.
    type PresenceRow = {
        id: string
        user_id: string
        node_id: string
        x: number
        y: number
        updated_at: number
    }
    const stmtReadPresence = db.prepare<[], PresenceRow>(`
        SELECT id, user_id, node_id, x, y, updated_at
        FROM presence
        WHERE updated_at > strftime('%s', 'now') - 30
    `)

    ipcMain.handle('sync:read-presence', (): PresenceRow[] => {
        return stmtReadPresence.all()
    })

    // ── File-Save Handler (Phase A — FileTransactionManager) ─────────────────
    // Atomically persists a .tsx/.ts source file from the renderer.
    // Two-phase write: content → <filePath>.tmp, then fs.rename() overwrites
    // the target in a single kernel op. Rapid-fire writes to the same path are
    // serialised; writes to different paths run concurrently.
    //
    // Security constraints:
    //   • filePath must be an absolute path to a .tsx/.ts/.jsx/.js file.
    //   • filePath must reside within the user's home directory to prevent
    //     the sandboxed renderer from writing to arbitrary system locations.
    ipcMain.handle('ast:save-file', async (_event, filePath: unknown, content: unknown): Promise<void> => {
        if (typeof filePath !== 'string' || typeof content !== 'string') {
            throw new TypeError('ast:save-file — filePath and content must be strings')
        }
        if (!path.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
            throw new Error('ast:save-file — filePath must be an absolute path to a .tsx/.ts/.jsx/.js file')
        }
        const home = app.getPath('home')
        if (!filePath.startsWith(home + path.sep)) {
            throw new Error('ast:save-file — path outside user home directory is not permitted')
        }
        await fileTransactionManager.write(filePath, content)

        // Commandment 13: Must shadowCommit only after fileTransactionManager resolves
        await gitManager.shadowCommit(path.dirname(filePath)).catch((err: Error) => {
            console.error('[Bridge] main.ts: ast:save-file shadowCommit failed', err)
        })
    })

    // ── Batch Save Handler ─────────────────────────────────────────────────────
    // Atomically writes multiple files in one IPC call (Phase F.2 / Multi-file
    // surgery). Each path undergoes the same security validation as ast:save-file.
    // Writes to different paths execute concurrently; writes to the same path
    // are serialised by FileTransactionManager's per-path FIFO queue.
    //
    // `batch` is a plain JSON object: { [absoluteFilePath]: content }.
    ipcMain.handle('ast:save-batch', async (_event, batch: unknown): Promise<void> => {
        if (typeof batch !== 'object' || batch === null || Array.isArray(batch)) {
            throw new TypeError('ast:save-batch — batch must be a plain object')
        }
        const home = app.getPath('home')
        const validated = new Map<string, string>()

        for (const [filePath, content] of Object.entries(batch as Record<string, unknown>)) {
            if (typeof content !== 'string') {
                throw new TypeError(`ast:save-batch — content for "${filePath}" must be a string`)
            }
            if (!path.isAbsolute(filePath) || !/\.(tsx?|jsx?)$/.test(filePath)) {
                throw new Error(
                    `ast:save-batch — "${filePath}" must be an absolute path to a .tsx/.ts/.jsx/.js file`
                )
            }
            if (!filePath.startsWith(home + path.sep)) {
                throw new Error(
                    `ast:save-batch — "${filePath}" is outside the user home directory`
                )
            }
            validated.set(filePath, content)
        }

        await fileTransactionManager.writeBatch(validated)

        // Commandment 13: shadowCommit after successful batch
        const firstPath = Object.keys(validated)[0]
        if (firstPath) {
            await gitManager.shadowCommit(path.dirname(firstPath)).catch((err: Error) => {
                console.error('[Bridge] main.ts: ast:save-batch shadowCommit failed', err)
            })
        }
    })

    // ── Git Show Handler ───────────────────────────────────────────────────────
    // Returns the raw content of `filePath` at `commitHash` using `git show`.
    // Does NOT modify the working tree (no checkout).
    //
    // Security:
    //   • commitHash is validated as hex-only to prevent shell injection.
    //   • filePath must be absolute and inside the user's home directory.
    //   • execFile with array args is used — no shell interpolation.
    ipcMain.handle(
        'ast:git-show',
        async (_event, filePath: unknown, commitHash: unknown): Promise<string | null> => {
            if (typeof filePath !== 'string' || typeof commitHash !== 'string') return null

            // Reject anything that isn't a plain hex SHA (4–64 chars) or the
            // special "HEAD" ref. Using execFile with an array arg means "HEAD"
            // carries no shell-injection risk.
            if (!/^([0-9a-fA-F]{4,64}|HEAD)$/.test(commitHash)) return null

            if (!path.isAbsolute(filePath)) return null
            const home = app.getPath('home')
            if (!filePath.startsWith(home + path.sep)) return null

            try {
                const cwd = path.dirname(filePath)
                // Find the git repository root so we can compute a repo-relative path
                // (git show <hash>:<path> requires a path relative to the git root).
                const { stdout: rootRaw } = await execFileAsync(
                    'git', ['rev-parse', '--show-toplevel'],
                    { cwd }
                )
                const gitRoot = rootRaw.trim()
                const relPath = path.relative(gitRoot, filePath)

                const { stdout } = await execFileAsync(
                    'git', ['show', `${commitHash}:${relPath}`],
                    { cwd: gitRoot, maxBuffer: 2 * 1024 * 1024 }
                )
                return stdout
            } catch {
                // File not tracked, commit not found, or no git repo — silently return null.
                return null
            }
        }
    )

    // ── Git Log Handler ────────────────────────────────────────────────────────
    // Returns a parsed list of shadow commits for `filePath`.
    // Each commit is { hash, message, timestamp } where timestamp is Unix seconds.
    //
    // The log is limited to commits that touch `filePath` (git log -- <relpath>).
    // Maximum 50 entries are returned to avoid unbounded IPC payloads.
    //
    // Security: same constraints as ast:git-show (absolute path, home dir, execFile).
    ipcMain.handle(
        'ast:git-log',
        async (_event, filePath: unknown): Promise<{ hash: string; message: string; timestamp: number }[]> => {
            if (typeof filePath !== 'string') return []
            if (!path.isAbsolute(filePath)) return []
            const home = app.getPath('home')
            if (!filePath.startsWith(home + path.sep)) return []

            try {
                const cwd = path.dirname(filePath)
                const { stdout: rootRaw } = await execFileAsync(
                    'git', ['rev-parse', '--show-toplevel'],
                    { cwd }
                )
                const gitRoot = rootRaw.trim()
                const relPath = path.relative(gitRoot, filePath)

                // %h = abbreviated hash | %s = subject | %at = author timestamp (Unix)
                const { stdout } = await execFileAsync(
                    'git',
                    ['log', '--pretty=format:%h|%s|%at', '-n', '50', '--', relPath],
                    { cwd: gitRoot, maxBuffer: 1024 * 1024 }
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
        }
    )

    // ── Project Registry + Template Scaffolding ───────────────────────────────
    const { upsertProject, getRecentProjects, removeProject } = await import('./registry.js')
    const { initializeProject, injectDemoState } = await import('./templateService.js')

    // ── Select-Folder Dialog ───────────────────────────────────────────────────
    // Shows the native OS directory picker and returns the selected path as a
    // string (no scan). Used by the "New Project" flow in the LaunchScreen to
    // choose an empty target directory before calling `project:initialize`.
    //
    // Returns null if the user cancels or selects a path outside their home dir.
    ipcMain.handle('dialog:selectFolder', async (): Promise<string | null> => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Empty Folder for New Project',
            buttonLabel: 'Select Folder',
        })
        if (canceled || filePaths.length === 0) return null

        const folderPath = path.normalize(filePaths[0])
        const home = app.getPath('home')
        if (folderPath !== home && !folderPath.startsWith(home + path.sep)) return null

        return folderPath
    })

    // ── project:initialize ────────────────────────────────────────────────────
    // Scaffolds a new Bridge workspace by copying the bundled template into an
    // empty user-selected directory.
    //
    // Payload: { targetPath: string, templateId: string }
    //   targetPath  — absolute path to an empty directory inside the home dir.
    //   templateId  — must match a known template (validated by templateService).
    //
    // Steps:
    //   1. Validate payload shape, absolute path, and home-dir containment.
    //   2. Delegate to initializeProject (Empty-Dir Gate + cpSync).
    //   3. Upsert the project into the global registry.
    //   4. Scan and return the FileTreeNode tree so the renderer can hydrate.
    //
    // Throws on any validation failure, non-empty directory, or I/O error.
    ipcMain.handle('project:initialize', async (_event, payload: unknown): Promise<FileTreeNode> => {
        if (
            typeof payload !== 'object' || payload === null ||
            typeof (payload as Record<string, unknown>).targetPath !== 'string' ||
            typeof (payload as Record<string, unknown>).templateId !== 'string'
        ) {
            throw new TypeError('project:initialize — invalid payload shape')
        }

        const { targetPath, templateId } = payload as { targetPath: string; templateId: string }

        // Security: absolute path + inside home directory
        if (!path.isAbsolute(targetPath)) {
            throw new Error('project:initialize — targetPath must be absolute')
        }
        const home = app.getPath('home')
        if (targetPath !== home && !targetPath.startsWith(home + path.sep)) {
            throw new Error('project:initialize — targetPath must be inside the user home directory')
        }

        // Empty-Dir Gate + cpSync (templateService throws if non-empty)
        initializeProject(targetPath, templateId)

        // ── Scaffold .bridge/ directory with starter config files ────────────
        // Creates .bridge/policy.json (DEFAULT_POLICY) and
        // .bridge/design-tokens.json (empty array) so the governance engine
        // and StatusBar can read them immediately without falling back to
        // hard-coded defaults.  Uses the atomic FTM queue — no raw writeFile.
        const bridgeDir = path.join(targetPath, '.bridge')
        await mkdir(bridgeDir, { recursive: true })

        const { DEFAULT_POLICY } = await import('../bridge-mcp/src/core/config.js')
        await fileTransactionManager.writeFile(
            path.join(bridgeDir, 'policy.json'),
            JSON.stringify(DEFAULT_POLICY, null, 2) + '\n',
        )
        await fileTransactionManager.writeFile(
            path.join(bridgeDir, 'design-tokens.json'),
            '[]\n',
        )

        // Ensure git repo is initialized on the new workspace
        await gitManager.ensureRepo(targetPath).catch(err => {
            console.error(`[Bridge] main.ts: ensureRepo failed for new project ${targetPath}`, err)
        })

        // Write to registry (UUID is stable: path UNIQUE constraint preserves
        // the first-inserted id on subsequent opens of the same directory)
        const projectName = path.basename(targetPath)
        upsertProject(randomUUID(), projectName, targetPath)

        // Scan the newly populated directory and return the tree
        return scanDirectory(targetPath)
    })

    // ── project:create-scratchpad ─────────────────────────────────────────────
    // Instantly scaffolds a new project in ~/Bridge Projects/Untitled-N with no
    // dialog. The first available counter slot is chosen so names never collide.
    //
    // Steps:
    //   1. Ensure ~/Bridge Projects/ exists.
    //   2. Pick the next free Untitled-N name.
    //   3. Create the directory and scaffold from 'base-vite-tailwind'.
    //   4. Write .bridge/ policy + tokens (same as project:initialize).
    //   5. Git init via gitManager.ensureRepo.
    //   6. Register in the global registry.
    //   7. Set activeProjectRoot and start the MCP client.
    //   8. Scan and return the FileTreeNode tree.
    ipcMain.handle('project:create-scratchpad', async (): Promise<FileTreeNode> => {
        const bridgeProjectsDir = path.join(app.getPath('home'), 'Bridge Projects')
        await mkdir(bridgeProjectsDir, { recursive: true })

        // Find the first free Untitled-N slot
        let existing: string[] = []
        try { existing = await readdir(bridgeProjectsDir) } catch { /* empty dir is fine */ }
        let counter = 1
        while (existing.includes(`Untitled-${counter}`)) counter++
        const projectName = `Untitled-${counter}`
        const targetPath = path.join(bridgeProjectsDir, projectName)
        await mkdir(targetPath)

        // Scaffold using the same template service as project:initialize
        initializeProject(targetPath, 'base-vite-tailwind')

        // Write .bridge/ starter config files
        const bridgeDir = path.join(targetPath, '.bridge')
        await mkdir(bridgeDir, { recursive: true })
        const { DEFAULT_POLICY } = await import('../bridge-mcp/src/core/config.js')
        await fileTransactionManager.writeFile(
            path.join(bridgeDir, 'policy.json'),
            JSON.stringify(DEFAULT_POLICY, null, 2) + '\n',
        )
        await fileTransactionManager.writeFile(
            path.join(bridgeDir, 'design-tokens.json'),
            '[]\n',
        )

        // Git init
        await gitManager.ensureRepo(targetPath).catch(err => {
            console.error(`[Bridge] project:create-scratchpad: ensureRepo failed for ${targetPath}`, err)
        })

        // Register in registry
        upsertProject(randomUUID(), projectName, targetPath)

        // Set active project root and start MCP client
        activeProjectRoot = targetPath
        void mcpClient.start(targetPath).catch((err) => {
            console.error('[Bridge] mcpClient.start failed after create-scratchpad:', err)
        })

        return scanDirectory(targetPath)
    })

    // ── project:reset-to-demo ──────────────────────────────────────────────────
    // Resets the provided targetPath to the bundled 'bridge-demo' state.
    //
    // Throws if path is not absolute or not inside home dir.
    ipcMain.handle('project:reset-to-demo', async (_event, targetPath: unknown): Promise<FileTreeNode> => {
        if (typeof targetPath !== 'string') {
            throw new TypeError('project:reset-to-demo — targetPath must be a string')
        }

        // Security: absolute path + inside home directory
        if (!path.isAbsolute(targetPath)) {
            throw new Error('project:reset-to-demo — targetPath must be absolute')
        }
        const home = app.getPath('home')
        if (targetPath !== home && !targetPath.startsWith(home + path.sep)) {
            throw new Error('project:reset-to-demo — targetPath must be inside the user home directory')
        }

        injectDemoState(targetPath)

        // Reset git repo
        await gitManager.ensureRepo(targetPath).catch(err => {
            console.error(`[Bridge] main.ts: ensureRepo failed for reset project ${targetPath}`, err)
        })

        // Return the fresh directory tree
        return scanDirectory(targetPath)
    })

    // ── project:openPath ──────────────────────────────────────────────────────
    // Opens an existing project by its absolute path: scans for source files
    // and records the access in the global registry.
    //
    // Used by the "Recent Projects" list in the LaunchScreen — no dialog shown.
    // Returns null when the path is outside the home dir or scan fails.
    ipcMain.handle('project:openPath', async (_event, folderPath: unknown): Promise<FileTreeNode | null> => {
        if (typeof folderPath !== 'string') return null

        const normalized = path.normalize(folderPath)
        const home = app.getPath('home')
        if (normalized !== home && !normalized.startsWith(home + path.sep)) return null

        try {
            // Ensure git repo exists before returning the tree
            await gitManager.ensureRepo(normalized).catch(err => {
                console.error(`[Bridge] main.ts: ensureRepo failed for ${normalized}`, err)
            })

            const tree = await scanDirectory(normalized)
            const projectName = path.basename(normalized)
            upsertProject(randomUUID(), projectName, normalized)
            activeProjectRoot = normalized
            // Phase W.3: start MCP client for the newly opened project
            void mcpClient.start(normalized).catch((err) => {
                console.error('[Bridge] mcpClient.start failed after openPath:', err)
            })
            return tree
        } catch {
            return null
        }
    })

    // ── registry:getRecent ────────────────────────────────────────────────────
    // Returns up to 10 recently opened projects (newest first) from the global
    // registry. Called by LaunchScreen on mount to populate the recent list.
    ipcMain.handle('registry:getRecent', (): ReturnType<typeof getRecentProjects> => {
        return getRecentProjects()
    })

    // ── registry:upsertProject ────────────────────────────────────────────────
    // Records or refreshes a project entry in the registry.
    // Called by the renderer after a successful `dialog:openFolder` open so
    // that manually opened folders appear in the Recent Projects list.
    //
    // Payload: { name: string, path: string }
    ipcMain.handle('registry:upsertProject', (_event, payload: unknown): void => {
        if (
            typeof payload !== 'object' || payload === null ||
            typeof (payload as Record<string, unknown>).name !== 'string' ||
            typeof (payload as Record<string, unknown>).path !== 'string'
        ) return

        const { name, path: projectPath } = payload as { name: string; path: string }
        if (!path.isAbsolute(projectPath)) return

        upsertProject(randomUUID(), name, projectPath)
    })

    // ── registry:removeProject ────────────────────────────────────────────────
    // Removes the project with the given UUID from the registry.
    // Called when the user dismisses a project from the Recent Projects list.
    ipcMain.handle('registry:removeProject', (_event, id: unknown): void => {
        if (typeof id !== 'string' || id.length === 0) return
        removeProject(id)
    })

    // ── Phase L: AI Orchestration Engine ─────────────────────────────────────
    // All LLM calls run in the main process so the API key never reaches the renderer.
    const { sendChatMessage, readConfig: readAIConfig, writeConfig: writeAIConfig } =
        await import('./orchestrator.js')

    // ── SEC.4: API Key Safe Storage (complete) ────────────────────────────────
    //
    // orchestrator.ts now handles safeStorage encrypt/decrypt internally.
    // main.ts is responsible for:
    //   1. Startup migration: detect legacy plaintext `apiKey` and encrypt it,
    //      removing the plaintext field from disk (one-time, idempotent).
    //   2. ai:save-config: delegate to writeAIConfig which now encrypts via
    //      safeStorage and never writes plaintext `apiKey` to disk.
    //   3. ai:get-config: delegate hasKey check to readAIConfig (which decrypts).
    //
    // Never log the decrypted key.

    // ── SEC.4 startup migration ───────────────────────────────────────────────
    // Run once on app.whenReady. If legacy plaintext `apiKey` exists and
    // safeStorage is available, encrypt it in-place and remove the plaintext
    // field. Running this twice is a no-op (idempotent).
    await (async () => {
        if (!safeStorage.isEncryptionAvailable()) return
        try {
            const cfg = await readAIConfig()
            // Migration condition: plaintext key exists but no encrypted key.
            if (
                typeof (cfg as Record<string, unknown>).apiKey === 'string' &&
                ((cfg as Record<string, unknown>).apiKey as string).length > 0 &&
                !((cfg as Record<string, unknown>).apiKeyEncrypted)
            ) {
                // writeAIConfig will encrypt and remove the plaintext field.
                await writeAIConfig(cfg)
                console.log('[Bridge] Migrated API key to encrypted storage')
            }
        } catch {
            // Non-fatal — migration will retry on next startup.
        }
    })()

    ipcMain.handle('ai:get-config', async (): Promise<{ hasKey: boolean; provider: string; model: string | null; baseURL: string | null }> => {
        const cfg = await readAIConfig()
        return {
            hasKey: typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0,
            provider: cfg.provider ?? 'anthropic',
            model: cfg.model ?? null,
            baseURL: cfg.baseURL ?? null,
        }
    })

    ipcMain.handle('ai:save-config', async (_event, payload: unknown): Promise<void> => {
        if (typeof payload !== 'object' || payload === null) return
        const p = payload as Record<string, unknown>

        // SEC.4: writeAIConfig (orchestrator.ts) handles safeStorage encryption.
        // Pass apiKey through as a partial config; writeConfig will encrypt it
        // and remove the plaintext field before writing to disk.
        const patch: Parameters<typeof writeAIConfig>[0] = {
            provider: (typeof p.provider === 'string' && p.provider
                ? p.provider as 'anthropic' | 'openai' | 'gemini'
                : 'anthropic'),
        }
        if (typeof p.apiKey === 'string' && p.apiKey.length > 0) {
            patch.apiKey = p.apiKey
        }
        if (typeof p.model === 'string' && p.model.length > 0) patch.model = p.model
        // Allow clearing the baseURL by saving an empty string (null-equivalent).
        if (typeof p.baseURL === 'string') patch.baseURL = p.baseURL.trim() || undefined
        await writeAIConfig(patch)
    })

    ipcMain.handle('ai:chat', async (event, messages: unknown, _context: unknown): Promise<void> => {
        if (!Array.isArray(messages)) return
        // Phase M: pass the FULL message array, including tool_call and tool_result turns.
        // The previous implementation incorrectly filtered these out, silently breaking
        // the multi-turn AI tool loop. sendChatMessage handles all 4 role types.
        const chatMessages = (messages as Array<{ role: string; content: string; toolUseId?: string; toolName?: string; toolInput?: Record<string, unknown> }>)
            .filter((m) => typeof m.content === 'string' && ['user', 'assistant', 'tool_call', 'tool_result'].includes(m.role))
            .map((m) => ({
                role: m.role as 'user' | 'assistant' | 'tool_call' | 'tool_result',
                content: m.content,
                ...(m.toolUseId !== undefined && { toolUseId: m.toolUseId }),
                ...(m.toolName !== undefined && { toolName: m.toolName }),
                ...(m.toolInput !== undefined && { toolInput: m.toolInput }),
            }))
        await sendChatMessage(chatMessages, (chunk) => { event.sender.send('ai:chunk', chunk) })
    })


    // Sentinel ACK — actual AST surgery runs in editorStore.applyBatch in renderer.
    ipcMain.handle('ai:apply-batch', (): { ok: boolean } => ({ ok: true }))

    // ── Phase N: Figma-to-Bridge AST Hydration (hydroPaste) ───────────────
    ipcMain.handle('bridge:hydro-paste', async (_event, payloadStr: unknown) => {
        if (typeof payloadStr !== 'string') return { error: 'Invalid payload' }

        try {
            const payload = JSON.parse(payloadStr)

            // Read manifest — try project root first, then home dir
            let manifest: any = { components: {} }
            const searchPaths = [
                activeProjectRoot ? path.join(activeProjectRoot, 'bridge-manifest.json') : null,
                path.join(app.getPath('home'), 'bridge-manifest.json'),
                path.join(process.cwd(), 'bridge-manifest.json'),
                path.join(app.getAppPath(), 'bridge-manifest.json'),
                path.join(app.getAppPath(), '..', 'bridge-manifest.json'),
            ].filter(Boolean) as string[]

            console.log('[HydroPaste] activeProjectRoot:', activeProjectRoot)
            console.log('[HydroPaste] Searching for manifest in:', searchPaths)

            let manifestLoaded = false
            for (const manifestPath of searchPaths) {
                try {
                    const raw = await readFile(manifestPath, 'utf8')
                    manifest = JSON.parse(raw)
                    console.log(`[HydroPaste] Loaded manifest from ${manifestPath}`)
                    manifestLoaded = true
                    break
                } catch { /* try next */ }
            }
            if (!manifestLoaded) {
                console.warn('[HydroPaste] No bridge-manifest.json found in any search path')
                return { error: `Manifest not found. Searched: ${searchPaths.join(', ')}. activeProjectRoot=${activeProjectRoot}` }
            }

            const components = manifest.components || {}
            const resolvers: any[] = manifest.resolvers || []
            const requiredImports = new Set<string>()

            // ── Figma styles → Tailwind class converter ────────────────────
            function stylesToTailwind(styles: Record<string, any> | undefined): string {
                if (!styles) return ''
                const cls: string[] = []

                // Layout
                if (styles.layoutMode === 'HORIZONTAL') { cls.push('flex', 'flex-row') }
                else if (styles.layoutMode === 'VERTICAL') { cls.push('flex', 'flex-col') }

                // Gap (itemSpacing)
                if (styles.itemSpacing != null && styles.itemSpacing > 0) {
                    const gap = spacingToTw(styles.itemSpacing)
                    cls.push(gap ? `gap-${gap}` : `gap-[${styles.itemSpacing}px]`)
                }

                // Padding
                const pt = styles.paddingTop, pr = styles.paddingRight, pb = styles.paddingBottom, pl = styles.paddingLeft
                if (pt != null || pr != null || pb != null || pl != null) {
                    if (pt === pr && pr === pb && pb === pl && pt > 0) {
                        const p = spacingToTw(pt)
                        cls.push(p ? `p-${p}` : `p-[${pt}px]`)
                    } else {
                        if (pt != null && pt > 0) { const v = spacingToTw(pt); cls.push(v ? `pt-${v}` : `pt-[${pt}px]`) }
                        if (pr != null && pr > 0) { const v = spacingToTw(pr); cls.push(v ? `pr-${v}` : `pr-[${pr}px]`) }
                        if (pb != null && pb > 0) { const v = spacingToTw(pb); cls.push(v ? `pb-${v}` : `pb-[${pb}px]`) }
                        if (pl != null && pl > 0) { const v = spacingToTw(pl); cls.push(v ? `pl-${v}` : `pl-[${pl}px]`) }
                    }
                }

                // Alignment
                if (styles.primaryAxisAlignItems) {
                    const map: Record<string, string> = { MIN: 'justify-start', CENTER: 'justify-center', MAX: 'justify-end', SPACE_BETWEEN: 'justify-between' }
                    if (map[styles.primaryAxisAlignItems]) cls.push(map[styles.primaryAxisAlignItems])
                }
                if (styles.counterAxisAlignItems) {
                    const map: Record<string, string> = { MIN: 'items-start', CENTER: 'items-center', MAX: 'items-end' }
                    if (map[styles.counterAxisAlignItems]) cls.push(map[styles.counterAxisAlignItems])
                }

                // Sizing
                if (styles.width != null && styles.width > 0) {
                    const w = spacingToTw(styles.width)
                    cls.push(w ? `w-${w}` : `w-[${styles.width}px]`)
                }
                if (styles.height != null && styles.height > 0) {
                    const h = spacingToTw(styles.height)
                    cls.push(h ? `h-${h}` : `h-[${styles.height}px]`)
                }

                // Fill color
                if (styles.fillColor) {
                    cls.push(`bg-[${styles.fillColor}]`)
                    if (styles.fillOpacity != null) {
                        cls.push(`bg-opacity-${roundOpacity(styles.fillOpacity)}`)
                    }
                }

                // Stroke / border
                if (styles.strokeColor) {
                    cls.push('border', `border-[${styles.strokeColor}]`)
                    if (styles.strokeWeight != null && styles.strokeWeight !== 1) {
                        cls.push(`border-[${styles.strokeWeight}px]`)
                    }
                }

                // Corner radius
                if (styles.cornerRadius != null && styles.cornerRadius > 0) {
                    const r = styles.cornerRadius
                    const rMap: Record<number, string> = { 2: 'rounded-sm', 4: 'rounded', 6: 'rounded-md', 8: 'rounded-lg', 12: 'rounded-xl', 16: 'rounded-2xl', 9999: 'rounded-full' }
                    cls.push(rMap[r] || `rounded-[${r}px]`)
                }

                // Opacity
                if (styles.opacity != null && styles.opacity < 100) {
                    cls.push(`opacity-${roundOpacity(styles.opacity)}`)
                }

                // Typography (for text nodes)
                if (styles.fontSize) {
                    const fsMap: Record<number, string> = { 12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg', 20: 'text-xl', 24: 'text-2xl', 30: 'text-3xl', 36: 'text-4xl', 48: 'text-5xl', 60: 'text-6xl' }
                    cls.push(fsMap[styles.fontSize] || `text-[${styles.fontSize}px]`)
                }
                if (styles.fontStyle) {
                    const weight = styles.fontStyle.toLowerCase()
                    const fwMap: Record<string, string> = { thin: 'font-thin', extralight: 'font-extralight', light: 'font-light', regular: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold', extrabold: 'font-extrabold', black: 'font-black' }
                    if (fwMap[weight]) cls.push(fwMap[weight])
                }
                if (styles.textColor) {
                    cls.push(`text-[${styles.textColor}]`)
                }
                if (styles.letterSpacing && styles.letterSpacing !== 0) {
                    cls.push(`tracking-[${styles.letterSpacing}px]`)
                }
                if (styles.lineHeight) {
                    cls.push(`leading-[${styles.lineHeight}px]`)
                }

                return cls.join(' ')
            }

            // Tailwind spacing scale: px → Tailwind unit
            function spacingToTw(px: number): string | null {
                const scale: Record<number, string> = {
                    0: '0', 1: 'px', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5',
                    12: '3', 14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8',
                    36: '9', 40: '10', 44: '11', 48: '12', 56: '14', 64: '16',
                    80: '20', 96: '24', 112: '28', 128: '32', 144: '36',
                    160: '40', 176: '44', 192: '48', 208: '52', 224: '56',
                    240: '60', 256: '64', 288: '72', 320: '80', 384: '96'
                }
                return scale[px] ?? null
            }

            function roundOpacity(pct: number): number {
                const steps = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100]
                return steps.reduce((prev, curr) => Math.abs(curr - pct) < Math.abs(prev - pct) ? curr : prev)
            }

            // ── Variant descriptor parser ──────────────────────────────────
            // Parses "Variant=Outlined, Size=Medium*, State=Enabled" → { Variant: "Outlined", Size: "Medium*", State: "Enabled" }
            function parseVariantDescriptor(desc: string): Record<string, string> {
                const pairs: Record<string, string> = {}
                for (const segment of desc.split(',')) {
                    const eq = segment.indexOf('=')
                    if (eq === -1) continue
                    const key = segment.slice(0, eq).trim()
                    const val = segment.slice(eq + 1).trim()
                    if (key) pairs[key] = val
                }
                return pairs
            }

            // ── Resolver matcher ───────────────────────────────────────────
            // Matches a parsed variant descriptor + props against the resolvers array
            function resolveComponent(nodeData: any): any | null {
                const descriptor = nodeData.figmaComponent || ''
                const parsed = parseVariantDescriptor(descriptor)
                const props = nodeData.props || {}

                // 1. Try exact match in components map
                if (components[descriptor]) return { ...components[descriptor], _resolvedVia: 'exact' }

                // 2. Try resolver rules
                for (const resolver of resolvers) {
                    // Check if any match field has a matching value
                    let matched = false
                    for (const [field, values] of Object.entries(resolver.match as Record<string, string[]>)) {
                        const parsedVal = parsed[field]
                        if (parsedVal && (values as string[]).some(v =>
                            v.toLowerCase() === parsedVal.toLowerCase() ||
                            v.toLowerCase() === parsedVal.replace(/\*$/, '').toLowerCase()
                        )) {
                            matched = true
                            break
                        }
                    }
                    if (!matched) continue

                    // Check detect fields exist in props (at least one)
                    if (resolver.detect) {
                        const hasDetectField = (resolver.detect as string[]).some(d => d in props || d in parsed)
                        if (!hasDetectField) continue
                    }

                    // Check excludeDetect — if any of these are in props, skip this resolver
                    if (resolver.excludeDetect) {
                        const hasExcluded = (resolver.excludeDetect as string[]).some(d => d in props)
                        if (hasExcluded) continue
                    }

                    // Skip nodes explicitly marked (e.g., Chips we can't render yet)
                    if (resolver.skip) return { _skip: true }

                    // Build resolved def
                    const def: any = {
                        componentName: resolver.componentName,
                        importPath: resolver.importPath,
                        propMap: { ...resolver.propMap },
                        defaultProps: { ...resolver.defaultProps },
                        leafComponent: resolver.leafComponent || false,
                        _resolvedVia: 'resolver',
                        _wrapperTag: resolver.wrapperTag,
                    }

                    // Apply variantToProp mapping
                    if (resolver.variantToProp) {
                        const { field, map } = resolver.variantToProp
                        const variantVal = parsed[field] || props[field]
                        if (variantVal && map[variantVal]) {
                            def.defaultProps = { ...def.defaultProps, ...map[variantVal] }
                        }
                    }

                    return def
                }

                // 3. Fallback: try component name fragments in the components map
                for (const key of Object.keys(components)) {
                    if (key.toLowerCase().replace(/\s+/g, '') === descriptor.toLowerCase().replace(/\s+/g, '')) {
                        return { ...components[key], _resolvedVia: 'fuzzy' }
                    }
                }

                return null
            }

            async function generateJsxElement(nodeData: any): Promise<any> {
                const t = await import('@babel/types')

                // Handle raw text nodes from Figma (type "_TextNode")
                if (nodeData.figmaComponent === '_TextNode') {
                    const text = nodeData.props?.content || ''
                    if (!text) return null
                    const twClass = stylesToTailwind(nodeData.styles)
                    if (twClass) {
                        // Wrap text in a <span> with typography classes
                        const attrs = [t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(twClass))]
                        const opening = t.jsxOpeningElement(t.jsxIdentifier('span'), attrs, false)
                        const closing = t.jsxClosingElement(t.jsxIdentifier('span'))
                        return { element: t.jsxElement(opening, closing, [t.jsxText(text)]), name: '_TextNode' }
                    }
                    return { element: t.jsxText(text), name: '_TextNode' }
                }

                // Handle _Frame wrapper nodes with layout styles
                if (nodeData.figmaComponent === '_Frame') {
                    const childNodes: any[] = []
                    if (nodeData.children && Array.isArray(nodeData.children)) {
                        for (const child of nodeData.children) {
                            const generated = await generateJsxElement(child)
                            if (generated) childNodes.push(generated)
                        }
                    }
                    if (childNodes.length === 0 && !nodeData.styles) return null
                    const twClass = stylesToTailwind(nodeData.styles)
                    const attrs = twClass ? [t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(twClass))] : []
                    const opening = t.jsxOpeningElement(t.jsxIdentifier('div'), attrs, childNodes.length === 0)
                    const closing = childNodes.length === 0 ? null : t.jsxClosingElement(t.jsxIdentifier('div'))
                    return { element: t.jsxElement(opening, closing, childNodes.map(c => c.element)), name: 'div' }
                }

                const componentDef = resolveComponent(nodeData)

                // Skip nodes explicitly excluded by a resolver rule
                if (componentDef?._skip) return null

                // Handle wrapper/container nodes — emit a <div> and recurse children
                if (componentDef?._wrapperTag || (!componentDef && nodeData.children?.length > 0)) {
                    const tag = componentDef?._wrapperTag || 'div'
                    const childNodes: any[] = []
                    if (nodeData.children && Array.isArray(nodeData.children)) {
                        for (const child of nodeData.children) {
                            const generated = await generateJsxElement(child)
                            if (generated) childNodes.push(generated)
                        }
                    }
                    if (childNodes.length === 0) return null
                    const twClass = stylesToTailwind(nodeData.styles)
                    const attrs = twClass ? [t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(twClass))] : []
                    const opening = t.jsxOpeningElement(t.jsxIdentifier(tag), attrs, false)
                    const closing = t.jsxClosingElement(t.jsxIdentifier(tag))
                    return { element: t.jsxElement(opening, closing, childNodes.map(c => c.element)), name: tag }
                }

                if (!componentDef || !componentDef.importPath) {
                    console.warn(`[HydroPaste] Unresolved: "${nodeData.figmaComponent}"`)
                    return null
                }

                console.log(`[HydroPaste] Resolved "${nodeData.figmaComponent}" → ${componentDef.componentName} (via ${componentDef._resolvedVia})`)

                // Track imports (both global set and per-element)
                const elementImport = `import { ${componentDef.componentName} } from '${componentDef.importPath}'`
                requiredImports.add(elementImport)

                const jsxName = t.jsxIdentifier(componentDef.componentName)
                const attributes: any[] = []
                let childNodes: any[] = []
                let textContent = ""

                // Apply defaultProps from manifest/resolver (e.g., variant: "secondary", as: 3)
                if (componentDef.defaultProps) {
                    for (const [propName, value] of Object.entries(componentDef.defaultProps)) {
                        if (propName === 'children') {
                            textContent = String(value)
                            continue
                        }
                        if (typeof value === 'boolean') {
                            if (value) {
                                attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), null))
                            } else {
                                attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), t.jsxExpressionContainer(t.booleanLiteral(false))))
                            }
                        } else if (typeof value === 'number') {
                            attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), t.jsxExpressionContainer(t.numericLiteral(value))))
                        } else {
                            attributes.push(t.jsxAttribute(t.jsxIdentifier(propName), t.stringLiteral(String(value))))
                        }
                    }
                }

                // Map Figma props → React props via propMap
                if (nodeData.props) {
                    for (const [figmaProp, value] of Object.entries(nodeData.props)) {
                        const reactProp = componentDef.propMap[figmaProp]
                        if (!reactProp) continue

                        if (reactProp === 'children') {
                            textContent = String(value)
                            continue
                        }

                        let attrValue: any = t.stringLiteral(String(value))
                        if (value === "true") attrValue = null
                        if (value === "false") {
                            attrValue = t.jsxExpressionContainer(t.booleanLiteral(false))
                        }
                        if (!isNaN(Number(value)) && value !== "") {
                            attrValue = t.jsxExpressionContainer(t.numericLiteral(Number(value)))
                        }

                        attributes.push(t.jsxAttribute(t.jsxIdentifier(reactProp), attrValue))
                    }
                }

                // Inject Tailwind className from extracted Figma styles
                const twClass = stylesToTailwind(nodeData.styles)
                if (twClass) {
                    attributes.push(t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(twClass)))
                }

                // Leaf components get text from props — skip recursing children to avoid duplication
                if (!componentDef.leafComponent && nodeData.children && Array.isArray(nodeData.children)) {
                    for (const child of nodeData.children) {
                        const generated = await generateJsxElement(child)
                        if (generated) childNodes.push(generated)
                    }
                }

                const opening = t.jsxOpeningElement(jsxName, attributes, childNodes.length === 0 && !textContent)
                const closing = childNodes.length === 0 && !textContent ? null : t.jsxClosingElement(jsxName)

                const childrenBlock: any[] = childNodes.map((c: any) => c.element)
                if (textContent) {
                    childrenBlock.unshift(t.jsxText(textContent))
                }

                return { element: t.jsxElement(opening, closing, childrenBlock), name: componentDef.componentName, import: elementImport }
            }

            const rawElements = await Promise.all(payload.children.map(generateJsxElement))
            const rootElements = rawElements.filter(Boolean)
            if (rootElements.length === 0) return { error: 'No valid components found in payload' }

            const _genMod: any = await import('@babel/generator')
            const generate: any =
                typeof _genMod === 'function' ? _genMod
                : typeof _genMod.default === 'function' ? _genMod.default
                : typeof _genMod.default?.default === 'function' ? _genMod.default.default
                : _genMod.generate

            // Generate per-element snippets paired with their imports
            const elements = rootElements.map((result: any) => {
                const { code } = generate(result.element)
                return {
                    code,
                    import: result.import || null
                }
            })

            return {
                ok: true,
                imports: Array.from(requiredImports),
                elements
            }

        } catch (err) {
            console.error('[HydroPaste Error]', err)
            return { error: String(err) }
        }
    })

    // ── Phase M: RAG endpoints ───────────────────────────────────────────────
    ipcMain.handle('ai:query-rag', async (_event, query: unknown): Promise<unknown[]> => {
        if (typeof query !== 'string') return []
        const { queryRAG } = await import('./ragService.js')
        return await queryRAG(query)
    })

    ipcMain.handle('ai:ingest-rag', async (_event, chunks: unknown): Promise<{ ingested: number }> => {
        if (!Array.isArray(chunks)) return { ingested: 0 }
        const { ingestChunks } = await import('./ragService.js')
        return await ingestChunks(chunks)
    })

    ipcMain.handle('ai:clear-rag', async (): Promise<void> => {
        const { clearRAG } = await import('./ragService.js')
        clearRAG()
    })

    ipcMain.handle('ai:rag-count', async (): Promise<number> => {
        const { ragChunkCount } = await import('./ragService.js')
        return ragChunkCount()
    })

    // ── Phase COLLAB.4: Annotation IPC + fs.watch ─────────────────────────────
    //
    // Annotations are written to .bridge/annotations.json by the MCP tool
    // (bridge_annotate). Glass reads them via 'annotations:read-all' and
    // resolves them via 'annotations:resolve'. An fs.watch subscription on the
    // file pushes 'bridge:annotations-changed' to all renderer windows whenever
    // the file changes so the React store re-fetches without polling.
    //
    // The annotations file path is derived from the active project root at
    // call-time so it always targets the currently open workspace.

    /**
     * Returns the absolute path to .bridge/annotations.json for the active
     * project, falling back to the user home directory when no project is open.
     */
    function getAnnotationsFilePath(): string {
        const base = activeProjectRoot ?? app.getPath('home')
        return path.join(base, '.bridge', 'annotations.json')
    }

    /**
     * Broadcasts 'bridge:annotations-changed' to all non-destroyed renderer windows.
     * Called by the fs.watch callback whenever the annotations file is modified.
     */
    function broadcastAnnotationsChanged(): void {
        BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.webContents.send('bridge:annotations-changed')
        })
    }

    /**
     * Reads .bridge/annotations.json and returns the parsed array.
     * Returns [] when the file is missing or unparseable — never throws.
     */
    async function readAnnotationsFile(filePath: string): Promise<unknown[]> {
        try {
            const raw = await readFile(filePath, 'utf-8')
            const parsed: unknown = JSON.parse(raw)
            if (!Array.isArray(parsed)) return []
            return parsed
        } catch {
            return []
        }
    }

    /**
     * Atomically writes `annotations` to `filePath` via FileTransactionManager.
     * Creates the parent .bridge directory if it does not yet exist.
     *
     * Fix 6 (P3-3): Routes through FTM instead of raw writeFile/rename to comply
     * with Commandment 12 (Atomic Queuing) and Commandment 14 (Bypass Prohibition).
     */
    async function writeAnnotationsFile(filePath: string, annotations: unknown[]): Promise<void> {
        const dir = path.dirname(filePath)
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true })
        }
        await fileTransactionManager.write(filePath, JSON.stringify(annotations, null, 2))
    }

    // ── annotations:read-all ──────────────────────────────────────────────────
    // Returns all annotations from .bridge/annotations.json.
    // Safe: returns [] when the file is missing — renderer handles empty state.
    ipcMain.handle('annotations:read-all', async (): Promise<unknown[]> => {
        const filePath = getAnnotationsFilePath()
        return readAnnotationsFile(filePath)
    })

    // ── annotations:resolve ───────────────────────────────────────────────────
    // Marks the annotation with `id` as resolved and writes the updated list
    // back atomically. Silently no-ops if the id is not found (idempotent).
    ipcMain.handle('annotations:resolve', async (_event, id: unknown): Promise<void> => {
        if (typeof id !== 'string' || id.length === 0) return
        const filePath = getAnnotationsFilePath()
        const annotations = await readAnnotationsFile(filePath)
        let changed = false
        const updated = annotations.map((a) => {
            const ann = a as Record<string, unknown>
            if (ann['id'] === id && ann['status'] !== 'resolved') {
                changed = true
                return { ...ann, status: 'resolved', resolvedAt: new Date().toISOString() }
            }
            return a
        })
        if (changed) {
            await writeAnnotationsFile(filePath, updated)
            broadcastAnnotationsChanged()
        }
    })

    // ── fs.watch on .bridge/annotations.json ─────────────────────────────────
    // Watches for external writes (from MCP tools) and pushes push events to
    // the renderer so annotationStore.fetchAnnotations() is triggered without
    // polling. The watcher is re-created whenever the active project changes
    // (tracked via the existing activeProjectRoot module-level variable).
    //
    // Implementation note: we watch the parent .bridge/ directory rather than
    // the file directly because fs.watch on a non-existent file throws on some
    // platforms. The directory is created on first annotation write.
    {
        let annotationsWatcher: ReturnType<typeof fsWatch> | null = null

        /**
         * (Re)starts the fs.watch on the active project's .bridge/ directory.
         * Called once at app-ready and should be re-called if activeProjectRoot changes.
         * Exported as a no-op for now; the current project lifecycle does not
         * dynamically switch roots after the watcher is started — the renderer
         * triggers a full reload on project switch instead.
         */
        function startAnnotationsWatcher(): void {
            annotationsWatcher?.close()
            const base = activeProjectRoot ?? app.getPath('home')
            const bridgeDir = path.join(base, '.bridge')

            // Ensure the .bridge directory exists before watching it
            if (!existsSync(bridgeDir)) {
                try {
                    // Synchronous mkdir is acceptable here — this runs once at startup
                    // outside the hot path. mkdirSync is imported at the top of the file.
                    mkdirSync(bridgeDir, { recursive: true })
                } catch { /* directory may already exist */ }
            }

            try {
                annotationsWatcher = fsWatch(bridgeDir, { persistent: false }, (eventType, filename) => {
                    if (filename === 'annotations.json' && (eventType === 'rename' || eventType === 'change')) {
                        broadcastAnnotationsChanged()
                    }
                })
                annotationsWatcher.on('error', (err) => {
                    console.error('[Bridge] annotations fs.watch error:', err)
                    annotationsWatcher = null
                })
            } catch (err) {
                console.error('[Bridge] Failed to start annotations fs.watch:', err)
            }
        }

        // Start the watcher for the initial project root (may be null on first launch).
        // The watcher will pick up the correct path when a project is opened because
        // getAnnotationsFilePath() reads activeProjectRoot at call-time.
        startAnnotationsWatcher()

        app.on('will-quit', () => {
            annotationsWatcher?.close()
        })
    }

    // ── Phase W.1: MCP Event Push Channel ─────────────────────────────────────
    //
    // The MCP server appends MCPEvent records (newline-delimited JSON) to
    // `.bridge/mcp-events.jsonl` after each tool completion. The Electron main
    // process tail-follows that file using fs.watch (with a 10-second poll
    // fallback for NFS/NAS mounts) and broadcasts `bridge:mcp-event` to all
    // renderer windows so the `useMCPEventListener` hook can dispatch to stores.
    //
    // Design invariants:
    //   - Byte offset is tracked so we never re-read lines already dispatched.
    //   - Events are batched within a 500ms debounce window to avoid a storm of
    //     individual notifications during a bulk audit.
    //   - On rotation (file shrinks below the last offset), offset resets to 0.
    {
        let mcpEventsOffset = 0
        let mcpEventsWatcher: ReturnType<typeof fsWatch> | null = null
        let mcpEventsBatchTimer: ReturnType<typeof setTimeout> | null = null
        const mcpEventsBatch: unknown[] = []

        function getMCPEventsFilePath(): string {
            const base = activeProjectRoot ?? app.getPath('home')
            return path.join(base, '.bridge', 'mcp-events.jsonl')
        }

        /**
         * Broadcasts a batch of parsed MCPEvent objects to all live renderer windows.
         * Called after the 500 ms debounce window closes.
         */
        function flushMCPEventsBatch(): void {
            if (mcpEventsBatch.length === 0) return
            const events = mcpEventsBatch.splice(0)
            BrowserWindow.getAllWindows().forEach((w) => {
                if (!w.isDestroyed()) w.webContents.send('bridge:mcp-event', events)
            })
        }

        /**
         * Reads new lines from the JSONL file since the last known byte offset.
         * Parses each line as a JSON MCPEvent and queues them for the next flush.
         * Resets the offset if the file has shrunk (rotation occurred).
         */
        async function tailMCPEvents(): Promise<void> {
            const filePath = getMCPEventsFilePath()
            try {
                const { size } = await fsStat(filePath)
                // File was rotated (e.g. renamed to .bak and a new file started)
                if (size < mcpEventsOffset) {
                    mcpEventsOffset = 0
                }
                if (size === mcpEventsOffset) return // no new data

                const fd = await fsOpen(filePath, 'r')
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
                // File doesn't exist yet or I/O error — safe to ignore
            }
        }

        /**
         * (Re)starts the fs.watch on the active project's .bridge/ directory,
         * monitoring for changes to mcp-events.jsonl.
         * Also installs a 10-second poll fallback for NFS/NAS mounts where
         * inotify events may not fire.
         */
        function startMCPEventsWatcher(): void {
            mcpEventsWatcher?.close()
            mcpEventsOffset = 0

            const base = activeProjectRoot ?? app.getPath('home')
            const bridgeDir = path.join(base, '.bridge')

            if (!existsSync(bridgeDir)) {
                try {
                    mkdirSync(bridgeDir, { recursive: true })
                } catch { /* already exists */ }
            }

            try {
                mcpEventsWatcher = fsWatch(bridgeDir, { persistent: false }, (eventType, filename) => {
                    if (filename === 'mcp-events.jsonl' && (eventType === 'rename' || eventType === 'change')) {
                        void tailMCPEvents()
                    }
                })
                mcpEventsWatcher.on('error', (err) => {
                    console.error('[Bridge] mcp-events fs.watch error:', err)
                    mcpEventsWatcher = null
                })
            } catch (err) {
                console.error('[Bridge] Failed to start mcp-events fs.watch:', err)
            }

            // 10-second poll fallback for NFS/NAS mounts
            const pollInterval = setInterval(() => {
                void tailMCPEvents()
            }, 10_000)

            app.once('will-quit', () => {
                clearInterval(pollInterval)
                mcpEventsWatcher?.close()
            })
        }

        startMCPEventsWatcher()
    }

    // ── Phase W.3: Bidirectional Action Bridge — IPC Handlers ─────────────────
    //
    // Renderer calls these via window.bridgeAPI.mcp.callTool / readResource / status.
    // All execution stays in the main process; the renderer only receives the result.
    //
    // The mcpClient singleton is started when a project opens and stopped when
    // it closes. The IPC handlers are registered once at app-ready regardless
    // of whether the server is connected — callers must check status() first if
    // they need a graceful degradation path.

    /**
     * mcp:call-tool — Invoke an MCP tool by name with arguments.
     * Returns the tool's content array or throws with a human-readable message.
     */
    ipcMain.handle(
        'mcp:call-tool',
        async (_event, name: unknown, args: unknown): Promise<unknown> => {
            if (typeof name !== 'string' || name.length === 0) {
                throw new TypeError('mcp:call-tool — name must be a non-empty string')
            }
            if (typeof args !== 'object' || args === null || Array.isArray(args)) {
                throw new TypeError('mcp:call-tool — args must be a plain object')
            }

            // SEC.3: Enforce renderer tool allowlist — Glass is an observability layer
            // and must only invoke read-oriented or report-generation tools.
            // Write-oriented tools (mutations, fixes, ingestion) are invoked by MCP
            // agents through the protocol, not by the renderer.
            if (!RENDERER_ALLOWED_MCP_TOOLS.includes(name)) {
                throw new Error(
                    `mcp:call-tool — tool "${name}" is not in the renderer allowlist. ` +
                    `Only these tools can be called from Glass: ${RENDERER_ALLOWED_MCP_TOOLS.join(', ')}`
                )
            }

            return mcpClient.callTool(name, args as Record<string, unknown>)
        }
    )

    /**
     * mcp:read-resource — Read an MCP resource by URI.
     * Returns the resource contents array or throws.
     */
    ipcMain.handle(
        'mcp:read-resource',
        async (_event, uri: unknown): Promise<unknown> => {
            if (typeof uri !== 'string' || uri.length === 0) {
                throw new TypeError('mcp:read-resource — uri must be a non-empty string')
            }
            return mcpClient.readResource(uri)
        }
    )

    /**
     * mcp:status — Returns { connected, serverPid } for the Glass status indicator.
     */
    ipcMain.handle('mcp:status', (): unknown => mcpClient.status())

    // ── Policy Engine IPC Handler ─────────────────────────────────────────────
    //
    // policy:get — Returns the active governance policy for the current project.
    // Reads `.bridge/policy.json` from the project root. Returns DEFAULT_POLICY
    // if the file is missing or malformed.
    //
    // This channel lets the renderer (ExportModal, canvasStore) read the policy
    // without importing any Node.js modules — respects the process boundary law.
    ipcMain.handle('policy:get', async (): Promise<unknown> => {
        if (!activeProjectRoot) {
            // Return default policy when no project is open
            const { DEFAULT_POLICY } = await import('../bridge-mcp/src/core/config.js')
            return DEFAULT_POLICY
        }
        const { loadPolicy } = await import('../bridge-mcp/src/core/config-loader.js')
        return loadPolicy(activeProjectRoot)
    })

    // ── GOV.2: Governance Override Telemetry IPC Handlers ────────────────────
    //
    // These three handlers implement the GOV.2 contract from
    // .bridge-context/contracts/gov1-gov2-provenance-telemetry.md.
    //
    // Dependency note: GovernanceEventService is imported from
    // bridge-mcp/src/core/governance/eventService.ts, and
    // resolveProvenance / buildComplianceSummary are imported from
    // bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts.
    // ruleProvenanceRegistry.ts is being created by the bridge-ast-surgeon agent
    // in parallel (Group 1). Dynamic imports are used so this handler compiles
    // and runs even before ruleProvenanceRegistry.ts is present — it will throw
    // at runtime if called before the MCP engine agent delivers the file.
    //
    // The GovernanceEventService instance is created once per app session and
    // reused across all handler invocations. The shared SQLite `db` instance
    // (from store.ts) is passed in so governance events land in the same
    // database as tokens, presence, and component overrides.
    const { GovernanceEventService } = await import('../bridge-mcp/src/core/governance/eventService.js')
    const govEventService = new GovernanceEventService(db)

    /**
     * Broadcasts 'bridge:governance-override-recorded' to all renderer windows.
     * Called after each successful governance:record-override write so StatusBar
     * can re-fetch the override count without polling.
     */
    function broadcastGovernanceOverrideRecorded(): void {
        BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.webContents.send('bridge:governance-override-recorded')
        })
    }

    // ── governance:record-override ────────────────────────────────────────────
    // Receives a rule override action from the renderer (fired by GovernancePanel
    // after setOverride / resetOverride / resetAll). Writes a GovernanceEvent with
    // eventType: 'override' to the governance_events table synchronously via
    // GovernanceEventService.recordEvent(), then broadcasts the push channel so
    // StatusBar knows to re-fetch the count.
    //
    // Payload: { ruleId, action, newValue, filePath }
    // Return: void (fire-and-forget from renderer's perspective)
    ipcMain.handle('governance:record-override', (_event, payload: unknown): void => {
        if (
            typeof payload !== 'object' || payload === null ||
            typeof (payload as Record<string, unknown>).ruleId !== 'string' ||
            typeof (payload as Record<string, unknown>).action !== 'string' ||
            typeof (payload as Record<string, unknown>).filePath !== 'string'
        ) {
            throw new TypeError('governance:record-override — invalid payload shape')
        }

        const p = payload as {
            ruleId: string
            action: 'disable' | 'enable' | 'change_severity' | 'reset' | 'reset_all'
            newValue: { enabled?: boolean; severity?: string } | null
            filePath: string
        }

        const validActions = new Set(['disable', 'enable', 'change_severity', 'reset', 'reset_all'])
        if (!validActions.has(p.action)) {
            throw new TypeError(`governance:record-override — invalid action: ${p.action}`)
        }

        govEventService.recordEvent({
            eventType: 'override',
            ruleId: p.ruleId,
            severity: 'info',
            filePath: p.filePath,
            actor: 'user',
            sessionId: governanceSessionId,
            metadata: {
                action: p.action,
                newValue: p.newValue,
            },
        })

        broadcastGovernanceOverrideRecorded()
    })

    // ── governance:override-count ─────────────────────────────────────────────
    // Returns the count of 'override' events recorded during this Glass session.
    // Used by StatusBar to populate the "Overrides (N)" badge.
    //
    // Queries the governance_events table filtered to eventType='override' and
    // sessionId=governanceSessionId using GovernanceEventService.queryEvents().
    // No payload required from renderer.
    ipcMain.handle('governance:override-count', (): number => {
        return govEventService.getOverrideCount(governanceSessionId)
    })

    // ── governance:compliance-summary ────────────────────────────────────────
    // Receives a string[] of ruleIds from the renderer, resolves each against
    // the static provenance registry, and returns a ComplianceSummary object.
    //
    // No SQLite involvement — pure in-memory lookup from the static registry.
    // The ruleProvenanceRegistry is dynamically imported so this handler is
    // forward-compatible with the MCP engine agent delivering the file.
    //
    // Payload: string[] (ruleIds from the current audit)
    // Return: ComplianceSummary
    ipcMain.handle('governance:compliance-summary', async (_event, ruleIds: unknown): Promise<unknown> => {
        if (!Array.isArray(ruleIds) || !ruleIds.every((id) => typeof id === 'string')) {
            throw new TypeError('governance:compliance-summary — ruleIds must be a string[]')
        }

        // Dynamic import: ruleProvenanceRegistry.ts is being created by the
        // bridge-ast-surgeon agent (Group 1 of the GOV.1/GOV.2 implementation).
        // This import will throw at runtime if the file does not yet exist —
        // callers (ExportModal) must handle the rejection gracefully.
        const { resolveProvenance, buildComplianceSummary } = await import(
            '../bridge-mcp/src/core/governance/ruleProvenanceRegistry.js'
        ) as {
            resolveProvenance: (ruleId: string) => unknown
            buildComplianceSummary: (violations: Array<{ ruleId: string; severity: 'critical' | 'warning' | 'info' }>) => unknown
        }

        // Build the violations list with a default 'warning' severity.
        // ExportModal passes deduplicated ruleIds without severity information —
        // the summary is authority/provenance-focused rather than severity-ranked.
        const violations = (ruleIds as string[]).map((ruleId) => ({
            ruleId,
            severity: 'warning' as const,
        }))

        void resolveProvenance // suppress unused-variable warning; used by buildComplianceSummary

        return buildComplianceSummary(violations)
    })

    // ── Delta Mode: Baseline IPC Handlers ────────────────────────────────────
    //
    // violation_baselines table lives in the shared bridge.db (store.ts).
    // Four handlers cover the full lifecycle: set, get, clear, is-set.
    //
    // baseline:set  — bulk-upserts every violation in the current audit into the
    //                 table. Idempotent: re-running on the same file overwrites
    //                 snapshot_value for existing (file_path, node_id, rule_id) rows.
    //
    // baseline:get  — returns all rows for a given file path so the renderer can
    //                 compute the delta: current violations minus baseline.
    //
    // baseline:clear — removes ALL rows from the table, resetting delta mode.
    //
    // baseline:is-set — returns true when any rows exist (used to show the
    //                   "Delta Mode" badge without fetching the full list).

    // Prepare statements once at app-ready; reuse across all handler invocations.
    const baselineUpsert = db.prepare<[string, string, string, string, string | null]>(`
        INSERT INTO violation_baselines (file_path, node_id, rule_id, severity, snapshot_value)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(file_path, node_id, rule_id)
        DO UPDATE SET
            severity       = excluded.severity,
            snapshot_value = excluded.snapshot_value,
            created_at     = strftime('%s', 'now')
    `)

    const baselineSelect = db.prepare<[string]>(
        'SELECT file_path, node_id, rule_id, severity, snapshot_value FROM violation_baselines WHERE file_path = ?'
    )

    const baselineClear = db.prepare('DELETE FROM violation_baselines')

    const baselineIsSet = db.prepare<[]>(
        'SELECT COUNT(*) as count FROM violation_baselines'
    )

    // ── baseline:set ──────────────────────────────────────────────────────────
    // Payload: Array<{ nodeId, ruleId, severity, filePath, value? }>
    // Each entry is upserted atomically; the entire batch runs in a transaction
    // so a partial failure does not leave the table half-written.
    ipcMain.handle('baseline:set', (_event, violations: unknown): void => {
        if (!Array.isArray(violations)) {
            throw new TypeError('baseline:set — violations must be an array')
        }

        const insertMany = db.transaction(
            (rows: Array<{ filePath: string; nodeId: string; ruleId: string; severity: string; value?: string }>) => {
                for (const row of rows) {
                    baselineUpsert.run(
                        row.filePath,
                        row.nodeId,
                        row.ruleId,
                        row.severity,
                        row.value ?? null,
                    )
                }
            }
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
        console.log(`[Bridge] baseline:set — ${rows.length} violations baselined`)
    })

    // ── baseline:get ──────────────────────────────────────────────────────────
    // Returns all baseline entries for the given file path.
    // The renderer uses this to build a Set<"nodeId:ruleId"> for fast delta lookup.
    ipcMain.handle('baseline:get', (_event, filePath: unknown): unknown[] => {
        if (typeof filePath !== 'string' || filePath.length === 0) {
            throw new TypeError('baseline:get — filePath must be a non-empty string')
        }
        return baselineSelect.all(filePath) as unknown[]
    })

    // ── baseline:clear ────────────────────────────────────────────────────────
    // Removes ALL violation_baselines rows — resets delta mode globally.
    // Returns void; idempotent when the table is already empty.
    ipcMain.handle('baseline:clear', (): void => {
        const result = baselineClear.run()
        console.log(`[Bridge] baseline:clear — ${result.changes} rows removed`)
    })

    // ── baseline:is-set ───────────────────────────────────────────────────────
    // Returns true when at least one baseline row exists.
    // Cheap COUNT(*) query — O(1) in SQLite regardless of row count.
    ipcMain.handle('baseline:is-set', (): boolean => {
        const row = baselineIsSet.get() as { count: number } | undefined
        return (row?.count ?? 0) > 0
    })

    // ── Phase ING: Import Summary IPC handlers ────────────────────────────────

    /**
     * import:snap-to-token — ING.3: real AST surgery for tier-2 snap-to-token.
     *
     * The renderer sends this after the user clicks "Snap" on an IngestionFlag.
     * The handler:
     *   1. Validates the SnapToTokenPayload shape.
     *   2. Resolves the active file path from context.json (written by useContextSync).
     *   3. Reads the file from disk.
     *   4. Calls snapToToken() (Babel AST surgery) to replace the arbitrary class
     *      with the token class in the element identified by data-bridge-id.
     *   5. Writes the updated code back via fileTransactionManager (Commandment 12).
     *   6. Broadcasts the updated code to the renderer so editorStore re-parses.
     *   7. Returns { ok: true } on success, { ok: false, error } on failure.
     *
     * Security: file path is constructed from activeProjectRoot + context.json.
     * No user-controlled paths accepted. Path is validated to remain within home.
     *
     * Commandment compliance:
     *   C12 — All disk writes via fileTransactionManager.
     *   C13 — Babel AST traversal via snapToToken() in IngestionAuditor.ts.
     *   C7  — data-bridge-id is never mutated.
     */
    ipcMain.handle('import:snap-to-token', async (_event, payload: unknown) => {
        // ── 1. Validate payload ───────────────────────────────────────────────
        if (
            typeof payload !== 'object' ||
            payload === null ||
            typeof (payload as Record<string, unknown>).nodeId !== 'string' ||
            typeof (payload as Record<string, unknown>).tokenPath !== 'string' ||
            typeof (payload as Record<string, unknown>).className !== 'string' ||
            typeof (payload as Record<string, unknown>).originalClass !== 'string'
        ) {
            return { ok: false, error: 'Invalid payload: missing or wrong-type fields' }
        }

        const p = payload as {
            nodeId: string
            tokenPath: string
            className: string
            originalClass: string
        }

        // ── 2. Resolve active file path from context.json ─────────────────────
        const bridgeDir = activeProjectRoot
            ? path.join(activeProjectRoot, '.bridge')
            : path.join(app.getPath('home'), '.bridge')
        const contextPath = path.join(bridgeDir, 'context.json')

        let activeFile: string | null = null
        try {
            const raw = await readFile(contextPath, 'utf8')
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

        // ── 3. Security: path must stay within the user home directory ────────
        const homePath = app.getPath('home')
        const resolvedFile = path.resolve(activeFile)
        if (!resolvedFile.startsWith(homePath)) {
            return { ok: false, error: 'Active file path is outside home directory' }
        }

        // ── 4. Read file from disk ────────────────────────────────────────────
        let currentCode: string
        try {
            currentCode = await readFile(resolvedFile, 'utf8')
        } catch (err) {
            return {
                ok: false,
                error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
            }
        }

        // ── 5. Apply Babel AST surgery ────────────────────────────────────────
        const snapResult = snapToToken(currentCode, p.nodeId, p.originalClass, p.className)
        if (!snapResult.ok) {
            return { ok: false, error: snapResult.error }
        }

        // ── 6. Write back via FileTransactionManager (Commandment 12) ─────────
        try {
            await fileTransactionManager.write(resolvedFile, snapResult.code)
        } catch (err) {
            return {
                ok: false,
                error: `Write failed: ${err instanceof Error ? err.message : String(err)}`,
            }
        }

        // ── 7. Broadcast updated code to renderer ─────────────────────────────
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
            windows[0].webContents.send('bridge:file-updated', {
                filePath: resolvedFile,
                code: snapResult.code,
            })
        }

        console.log(
            `[Bridge] import:snap-to-token — node=${p.nodeId} ` +
            `token=${p.tokenPath} file=${resolvedFile}`
        )
        return { ok: true }
    })

    /**
     * import:undo-all-heals — reverts all tier-1 heals by restoring the pre-heal code.
     *
     * Security: The pre-heal code is stored server-side in `preHealCodeStore` (set by
     * the heal pass in ingestion-server.ts). The renderer sends only a signal to trigger
     * the restore — no code round-trips through the renderer. This prevents a compromised
     * renderer from injecting arbitrary code via the undo path.
     */
    ipcMain.handle('import:undo-all-heals', () => {
        const code = preHealCodeStore.get('latest')
        if (!code) {
            console.warn('[Bridge] import:undo-all-heals — no pre-heal code stored')
            return { ok: false }
        }
        // Broadcast the server-stored pre-heal code to the renderer
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
            windows[0].webContents.send('bridge:hydro-paste-auto', code)
        }
        // Clear after use to prevent stale restores
        preHealCodeStore.delete('latest')
        console.log('[Bridge] import:undo-all-heals — pre-heal code restored from server store')
        return { ok: true }
    })

    // ── Phase ACX.5: Context Sync Pipeline ───────────────────────────────────
    //
    // context:sync   — Receives a BridgeContext snapshot from useContextSync
    //                  and atomically writes it to .bridge/context.json so the
    //                  headless MCP server can read it via bridge_get_context.
    //
    // context:get-enriched — Reads context.json, then enriches it with live
    //                        SQLite metrics (token count, override count) and
    //                        returns the combined EnrichedContext object.
    //
    // Security: context.json is written to the active project's .bridge/
    // subdirectory. When no project is open we fall back to the user's home
    // directory. No path traversal is possible because we construct the path
    // ourselves rather than accepting it from the renderer.

    ipcMain.handle('context:sync', async (_event, context: unknown): Promise<void> => {
        if (typeof context !== 'object' || context === null) {
            throw new TypeError('context:sync — payload must be a non-null object')
        }

        // Determine the target directory. Prefer the active project root so
        // context.json lands in <projectRoot>/.bridge/context.json. Fall back to
        // ~/.bridge/context.json when no project has been opened yet.
        const bridgeDir = activeProjectRoot
            ? path.join(activeProjectRoot, '.bridge')
            : path.join(app.getPath('home'), '.bridge')

        try {
            await mkdir(bridgeDir, { recursive: true })
        } catch {
            // Directory already exists — not an error.
        }

        const contextPath = path.join(bridgeDir, 'context.json')
        const json = JSON.stringify(context, null, 2)

        // Route through FileTransactionManager for Commandment 12 + 14 compliance.
        await fileTransactionManager.write(contextPath, json)
    })

    // Read helpers for context:get-enriched — prepared once, reused per call.
    const stmtTokenCount = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM design_tokens')
    const stmtOverrideCount = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM component_overrides')

    ipcMain.handle('context:get-enriched', async (): Promise<unknown> => {
        const bridgeDir = activeProjectRoot
            ? path.join(activeProjectRoot, '.bridge')
            : path.join(app.getPath('home'), '.bridge')

        const contextPath = path.join(bridgeDir, 'context.json')

        let base: Record<string, unknown> = {}
        try {
            const raw = await readFile(contextPath, 'utf8')
            base = JSON.parse(raw) as Record<string, unknown>
        } catch {
            // context.json does not exist yet or is malformed — start with empty base.
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

    // ── Phase P: Integrated Terminal ──────────────────────────────────────────
    let ptyProcess: IPty | null = null

    // SEC.5: Maximum input size for terminal:data (8 KB).
    const TERMINAL_INPUT_MAX_BYTES = 8192

    ipcMain.handle('terminal:spawn', (event, cwd: unknown) => {
        if (typeof cwd !== 'string') return

        // SEC.5: Validate cwd against activeProjectRoot (preferred) or home dir
        // (fallback). This tightens the original Fix 3 (P1-3) so that when a
        // project is open the terminal is constrained to the project tree, not
        // the entire home directory.
        const resolvedCwd = path.resolve(cwd)
        const allowedRoot = activeProjectRoot ?? app.getPath('home')
        if (resolvedCwd !== allowedRoot && !resolvedCwd.startsWith(allowedRoot + path.sep)) {
            console.error(`[Bridge] terminal:spawn — SEC.5 rejected cwd outside allowed root: ${resolvedCwd} (root: ${allowedRoot})`)
            return
        }

        const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'] || (os.platform() === 'win32' ? 'cmd.exe' : 'bash')

        if (ptyProcess) {
            ptyProcess.kill()
        }

        try {
            ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: resolvedCwd,
                env: process.env as Record<string, string>,
            })

            ptyProcess.onData((data) => {
                const window = BrowserWindow.fromWebContents(event.sender)
                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal:output', data)
                }
            })

            ptyProcess.onExit(() => {
                ptyProcess = null
            })
        } catch (err) {
            console.error('[Bridge] terminal:spawn failed', err)
        }
    })

    ipcMain.handle('terminal:data', (_event, data: unknown) => {
        if (!ptyProcess || typeof data !== 'string') return

        // SEC.5: Reject oversized input (8 KB limit).
        if (Buffer.byteLength(data, 'utf-8') > TERMINAL_INPUT_MAX_BYTES) {
            console.warn(`[Bridge] terminal:data — SEC.5 rejected oversized input (${Buffer.byteLength(data, 'utf-8')} bytes, limit ${TERMINAL_INPUT_MAX_BYTES})`)
            return
        }

        // SEC.5: Strip null bytes from terminal input.
        let sanitized = data
        if (data.includes('\x00')) {
            console.warn('[Bridge] terminal:data — SEC.5 stripped null bytes from input')
            sanitized = data.replaceAll('\x00', '')
        }

        if (sanitized.length > 0) {
            ptyProcess.write(sanitized)
        }
    })

    ipcMain.handle('terminal:resize', (_event, cols: unknown, rows: unknown) => {
        if (ptyProcess && typeof cols === 'number' && typeof rows === 'number') {
            try {
                ptyProcess.resize(cols, rows)
            } catch (err) {
                console.error('[Bridge] terminal:resize failed', err)
            }
        }
    })

    // Start the ingestion server and register its IPC handlers
    const { startIngestionServer, getServerStatus, getFigmaStatus, stopIngestionServer, setPreHealCodeCallback } = await import('./ingestion-server.js')
    // Wire the pre-heal code store (SECURITY-01: server-side storage, no renderer round-trip)
    setPreHealCodeCallback((code: string) => preHealCodeStore.set('latest', code))

    // SEC.2: Generate a cryptographically random per-session secret.
    // 32 bytes = 64 hex chars = 256 bits of entropy. Regenerated on every app launch.
    // The secret is passed directly to startIngestionServer — never via IPC, env vars,
    // or global state. The renderer must never receive this value.
    const ingestionSecret = randomBytes(32).toString('hex')
    startIngestionServer(ingestionSecret)
    stopServer = stopIngestionServer

    ipcMain.handle('server:get-status', () => getServerStatus())
    // SEC.2: getFigmaStatus() no longer returns `secret` — removed at the source.
    // The renderer only needs connection health data (running, port, tokenCount, lastWebhookAt).
    ipcMain.handle('figma:status', () => getFigmaStatus())
    ipcMain.handle('figma:disconnect', () => {
        stopIngestionServer()
    })

    createWindow()
    buildAppMenu()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('will-quit', () => {
    // Close the ingestion server gracefully before the process exits so the
    // OS port is released immediately. This prevents EADDRINUSE on fast
    // dev-server reloads where Electron restarts before the OS reclaims 4545.
    stopServer?.()

    // Phase W.3: shut down the MCP server child process on app exit.
    // stop() is async but will-quit is synchronous — fire-and-forget is acceptable
    // here because the OS will reclaim the child process anyway on app exit.
    void mcpClient.stop()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
    mainWindow = null
})
