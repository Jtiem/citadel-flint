import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

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

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Bridge IDE',
        webPreferences: {
            preload: PRELOAD_PATH,
            contextIsolation: true,
            nodeIntegration: false,
            // sandbox: false is required because vite-plugin-electron builds the
            // preload as an ESM module. Electron's sandbox cannot bootstrap ESM
            // preloads; disabling it restores the Node.js-capable preload context.
            // Security is maintained by contextIsolation + contextBridge alone.
            // See: bridge-context/decisions.md
            sandbox: false,
        },
    })

    mainWindow.webContents.openDevTools()

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
    const { sendChatMessage, readConfig: readAIConfig, writeConfig: writeAIConfig, hasApiKey } =
        await import('./orchestrator.js')

    ipcMain.handle('ai:get-config', async (): Promise<{ hasKey: boolean; provider: string; model: string | null; baseURL: string | null }> => {
        const cfg = await readAIConfig()
        return {
            hasKey: await hasApiKey(),
            provider: cfg.provider ?? 'anthropic',
            model: cfg.model ?? null,
            baseURL: cfg.baseURL ?? null,
        }
    })

    ipcMain.handle('ai:save-config', async (_event, payload: unknown): Promise<void> => {
        if (typeof payload !== 'object' || payload === null) return
        const p = payload as Record<string, unknown>

        // Use the provider provided by the client, fallback to anthropic
        const patch: Record<string, unknown> = {
            provider: (typeof p.provider === 'string' && p.provider ? p.provider : 'anthropic')
        }

        // apiKey is optional — allow saving just the model/baseURL without re-sending the key.
        if (typeof p.apiKey === 'string' && p.apiKey.length > 0) patch.apiKey = p.apiKey
        if (typeof p.model === 'string' && p.model.length > 0) patch.model = p.model
        // Allow clearing the baseURL by saving an empty string (null-equivalent).
        if (typeof p.baseURL === 'string') patch.baseURL = p.baseURL.trim() || undefined
        await writeAIConfig(patch as Parameters<typeof writeAIConfig>[0])
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

    // ── Phase P: Integrated Terminal ──────────────────────────────────────────
    let ptyProcess: IPty | null = null

    ipcMain.handle('terminal:spawn', (event, cwd: unknown) => {
        if (typeof cwd !== 'string') return
        const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'] || (os.platform() === 'win32' ? 'cmd.exe' : 'bash')

        if (ptyProcess) {
            ptyProcess.kill()
        }

        try {
            ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: cwd,
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
        if (ptyProcess && typeof data === 'string') {
            ptyProcess.write(data)
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

    // Start the ingestion server and register its IPC handler
    const { startIngestionServer, getServerStatus, stopIngestionServer } = await import('./ingestion-server.js')
    startIngestionServer()
    stopServer = stopIngestionServer

    ipcMain.handle('server:get-status', () => getServerStatus())

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
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
    mainWindow = null
})
