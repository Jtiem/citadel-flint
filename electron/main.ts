import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// ── FileTreeNode ───────────────────────────────────────────────────────────────
// Mirrors the renderer-side type in src/types/bridge-api.d.ts.
// Cannot be imported cross-boundary, so it is re-declared here.
interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    children?: FileTreeNode[]
}

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
    const { initializeProject } = await import('./templateService.js')

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
