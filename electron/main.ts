import { app, BrowserWindow, dialog, ipcMain, Menu, net, safeStorage, session } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { BRAND, ipcChannel, logTag } from '../shared/brand.ts'
import { computeExpiresAt } from '../shared/deferralUtils.ts'
import type { DeferDuration } from '../shared/deferralUtils.ts'
import { fileURLToPath } from 'node:url'
import { readdir, readFile, writeFile, mkdir, stat as fsStat, open as fsOpen, cp } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import os from 'node:os'
import { snapToToken } from './ingestion/index.js'
import { loadAgentPolicy } from './agentPolicy.js'
import { checkBetaExpiry, startVersionCheck, stopVersionCheck, getBetaInfo } from './betaGuard.js'
import {
    initAutoUpdater,
    checkForUpdates as autoUpdateCheck,
    downloadUpdate as autoUpdateDownload,
    quitAndInstall as autoUpdateInstall,
    getUpdateChannel,
    setUpdateChannel,
    stopAutoUpdater,
} from './autoUpdater.js'
import { ThumbnailGenerator } from './thumbnailGenerator.js'
import type { ThumbnailOptions } from './thumbnailGenerator.js'
import { detectProjectEnvironment } from '../shared/projectDetector.ts'
import type { ProjectEnvironment, DetectorFS } from '../shared/projectDetector.ts'

// ── FileTreeNode ───────────────────────────────────────────────────────────────
// Mirrors the renderer-side type in src/types/flint-api.d.ts.
// Cannot be imported cross-boundary, so it is re-declared here.
interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    children?: FileTreeNode[]
}

/** Tracks the active project root so the main process can locate flint-manifest.json. */
let activeProjectRoot: string | null = null

// ── Phase CV2.2: Thumbnail Generator ─────────────────────────────────────────
// Module-level singleton created lazily when the first project is opened.
// Replaced via setProjectRoot() on subsequent opens; disposed on quit/close.
let thumbnailGenerator: ThumbnailGenerator | null = null

/**
 * Returns the app root directory (the repo root containing src/).
 * In dev builds, __dirname is dist-electron/ so we go up one level.
 * In prod builds, __dirname is the bundled resources directory.
 */
function _getThumbnailAppRoot(): string {
    // Walk up until we find src/preview-vendor or reach the filesystem root
    let dir = __dirname
    for (let i = 0; i < 4; i++) {
        if (existsSync(path.join(dir, 'src', 'preview-vendor'))) return dir
        dir = path.dirname(dir)
    }
    return __dirname
}

/**
 * Returns (creating if needed) the ThumbnailGenerator for the given projectRoot.
 * If one already exists, updates its projectRoot and returns it.
 */
function getThumbnailGenerator(projectRoot: string): ThumbnailGenerator {
    if (!thumbnailGenerator) {
        thumbnailGenerator = new ThumbnailGenerator(projectRoot, _getThumbnailAppRoot(), fileTransactionManager)
    } else {
        thumbnailGenerator.setProjectRoot(projectRoot)
    }
    return thumbnailGenerator
}

/**
 * Auto-invalidates a component thumbnail when its source file is saved.
 * Reads flint-manifest.json to map filePath → componentName.
 * Fire-and-forget — errors are logged but do not affect the save operation.
 */
async function autoInvalidateThumbnail(filePath: string): Promise<void> {
    if (!activeProjectRoot || !thumbnailGenerator) return
    const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
    try {
        const raw = await readFile(manifestPath, 'utf8')
        const manifest = JSON.parse(raw) as Record<string, unknown>
        const components = (manifest.components ?? {}) as Record<string, unknown>
        for (const [name, entry] of Object.entries(components)) {
            const entryObj = entry as { importPath?: string; filePath?: string }
            const srcPath = entryObj.filePath ?? entryObj.importPath
            if (!srcPath || typeof srcPath !== 'string') continue
            const resolvedPath = path.isAbsolute(srcPath)
                ? srcPath
                : path.join(activeProjectRoot, srcPath)
            if (resolvedPath === filePath) {
                await thumbnailGenerator.invalidate(name)
                break
            }
        }
    } catch {
        // Manifest missing or unparseable — no invalidation needed
    }
}

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
import { checkToolAccess } from './mcp-policy.js'
import { recordMutation } from './agentPolicy.js'

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

// ── Flint ID Babel Plugin ────────────────────────────────────────────────────
//
// Injects `data-flint-id="tagName:line:col"` onto every JSXOpeningElement
// during preview compilation. This attribute links AST nodes to their DOM
// counterparts, enabling the bi-directional Layer Tree ↔ Live Preview
// selection feature (highlight + click-to-select).
//
// This attribute is added ONLY to the Babel output sent to the srcdoc iframe —
// it is never written back to the user's source code.
function injectFlintIdPlugin() {
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

                const flintId = `${tagName}:${loc.start.line}:${loc.start.column}`

                // Skip if already injected (idempotent guard)
                const alreadySet = path.node.attributes.some((attr) => {
                    if (attr.type !== 'JSXAttribute') return false
                    const name = attr.name
                    return name.type === 'JSXIdentifier' && name.name === 'data-flint-id'
                })
                if (alreadySet) return

                path.node.attributes.push(
                    jsxAttribute(
                        jsxIdentifier('data-flint-id'),
                        stringLiteral(flintId)
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

        // ── Help ──────────────────────────────────────────────────────────────
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Reset to First Launch\u2026',
                    click: () => {
                        const choice = dialog.showMessageBoxSync({
                            type: 'warning',
                            buttons: ['Reset', 'Cancel'],
                            defaultId: 1,
                            cancelId: 1,
                            title: 'Reset to First Launch',
                            message: 'Reset Flint Glass to first launch?',
                            detail: 'Your setup preferences will be cleared and the app will reload from the beginning. Your projects will not be deleted.',
                        })
                        if (choice === 0) {
                            mainWindow?.webContents.send('menu:reset-state')
                        }
                    },
                },
            ],
        },
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
    "frame-src 'self' blob: http://localhost:* http://127.0.0.1:*",
].join('; ')

const PRODUCTION_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' http://127.0.0.1:*",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob: http://localhost:* http://127.0.0.1:*",
].join('; ')

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: BRAND.appTitle,
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
            // FlintAPI surface defined in src/types/flint-api.d.ts.
            // Track: https://github.com/electron/electron/issues — revisit
            // when vite-plugin-electron gains sandbox-compatible ESM output.
            // See: .flint-context/decisions.md
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

    // ── Beta version check ────────────────────────────────────────────────
    // Non-blocking periodic check for newer beta builds. Safe no-op when
    // FLINT_BETA_VERSION_URL is not set (dev builds).
    startVersionCheck(mainWindow)

    // ── BETA.3: electron-updater auto-update ──────────────────────────────
    // Registers update lifecycle event handlers and schedules the first check.
    // autoDownload = false — the user must confirm before anything downloads.
    initAutoUpdater(mainWindow)
}

// ── Self-hosting guard ────────────────────────────────────────────────────────
// During development (`npm run dev`), the Flint source tree is served by Vite.
// If the user opens it (or any subdirectory) as a Flint project, the preview
// iframe would serve the same app → infinite recursion, and file watchers
// from the inner Vite server conflict with the outer one → reload loops.
// Walk UP the directory tree to catch both the root and subdirectories.
function isFlintSourceTree(projectPath: string): boolean {
    let dir = path.resolve(projectPath)
    const root = path.parse(dir).root
    while (dir !== root) {
        if (existsSync(path.join(dir, 'electron', 'main.ts'))) return true
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return false
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

        // Self-hosting guard: don't open the Flint source tree as a project
        // during development — causes preview iframe recursion.
        if (isFlintSourceTree(folderPath)) {
            console.warn(`${BRAND.logPrefix} Refusing to open Flint source tree as project (self-hosting guard)`)
            dialog.showMessageBoxSync({
                type: 'warning',
                title: 'Cannot Open This Folder',
                message: 'This folder is part of the Flint development project.',
                detail: 'During development, Flint cannot open its own source tree as a project (it would create an infinite loop). Choose a different folder.',
            })
            return null
        }

        // Ensure git repo exists so we can track shadow commits
        await gitManager.ensureRepo(folderPath).catch(err => {
            console.error(`${BRAND.logPrefix} main.ts: ensureRepo failed for ${folderPath}`, err)
        })

        activeProjectRoot = folderPath
        // AGV.1: Load per-project agent policy
        void loadAgentPolicy(folderPath).catch((err) => {
            console.error(`${BRAND.logPrefix} loadAgentPolicy failed after openFolder:`, err)
        })
        // Phase W.3: start MCP client for the newly opened project
        void mcpClient.start(folderPath).catch((err) => {
            console.error(`${BRAND.logPrefix} mcpClient.start failed after openFolder:`, err)
        })
        // File watcher: restart scan for new project root
        void (globalThis as Record<string, unknown>)['__flintStartFileWatcher']?.()
        // CV2.2: Initialize thumbnail generator for the new project root
        getThumbnailGenerator(folderPath)
        // CK.1: Seed RAG store with component docs + tokens
        void import('./ragSeeder.js').then(({ seedRAGFromProject }) => {
            seedRAGFromProject(folderPath).catch(err => {
                console.error(`${logTag('CK.1')} RAG seeding failed:`, err)
            })
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
    // Bail early on empty input — nothing to transform. This prevents the
    // clearAST→setCode gap from producing a blank srcdoc that shows
    // "No default export found." in the iframe.
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

        // Strip ES module import statements — React etc. will be globals in the iframe.
        js = js.replace(/^import\s[^\n]*\n?/gm, '')

        // ── Detect component name from export statements ──────────────
        // Priority: export default > first named export function/class
        let componentName: string | null = null

        // 1. Rewrite `export default function/class Foo` → `function/class Foo`
        js = js.replace(
            /\bexport\s+default\s+(function|class)\s+(\w+)/,
            (_m: string, kw: string, name: string) => {
                componentName = name
                return `${kw} ${name}`
            }
        )

        // 2. Fallback: `export default Foo` (bare identifier after a declaration above)
        if (componentName === null) {
            js = js.replace(
                /^export\s+default\s+(\w+)\s*;?\s*$/m,
                (_m: string, name: string) => {
                    componentName = name
                    return ''
                }
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

// ── MFP.2: Vue Transform Handler ──────────────────────────────────────────────
// Compiles a Vue 3 SFC (.vue) source string into browser-ready JS using
// @vue/compiler-sfc. Dynamic import ensures a graceful fallback when the
// package is not installed.
ipcMain.handle(
    'code:transform-vue',
    async (_event, code: unknown): Promise<{ js: string | null; css: string; error: string | null }> => {
        if (typeof code !== 'string') {
            return { js: null, css: '', error: 'code must be a string' }
        }
        try {
            const { compileVueSFC } = await import('./vueCompiler.js')
            return await compileVueSFC(code)
        } catch (err) {
            return { js: null, css: '', error: `Vue compiler not available: ${String(err)}` }
        }
    }
)

// ── MFP.3: Svelte Transform Handler ──────────────────────────────────────────
// Compiles a .svelte source string into self-contained vanilla JS + extracted CSS.
// Uses svelte/compiler (dynamic import — graceful no-op if svelte is not installed).
ipcMain.handle(
    'code:transform-svelte',
    async (_event, code: unknown): Promise<{ js: string | null; css: string; error: string | null }> => {
        if (typeof code !== 'string') {
            return { js: null, css: '', error: 'code must be a string' }
        }
        try {
            const { compileSvelteComponent } = await import('./svelteCompiler.js')
            return await compileSvelteComponent(code)
        } catch (err) {
            return { js: null, css: '', error: `Svelte compiler not available: ${String(err)}` }
        }
    }
)

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
        if (!url) return { error: 'Vite not available in packaged build — using srcdoc preview' }
        return { url }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`${BRAND.logPrefix} preview:start failed:`, msg)
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

// ── Single-instance lock ──────────────────────────────────────────────────────
// Prevents multiple Flint Glass processes from running simultaneously.
// Without this, every activation (dock click, OS session restore, crash retry)
// spawns a new process, causing the "opens faster than you can close" loop.
{
    const gotLock = app.requestSingleInstanceLock()
    if (!gotLock) {
        // Another instance is already running — quit immediately and let it
        // handle the activation (second-instance handler below will focus it).
        app.quit()
    }
}

app.on('second-instance', () => {
    // A second launch was attempted — focus the existing window instead.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
    }
})

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    // ── Beta guard ────────────────────────────────────────────────────────────
    // Must run before any window creation. Shows expiry dialog and quits if
    // the build has expired.
    if (!checkBetaExpiry()) return

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
            if (!w.isDestroyed()) w.webContents.send(ipcChannel('tokens-updated'))
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
        console.log(`${BRAND.logPrefix} tokens:clear-all: removed ${result.changes} tokens`)
        broadcastTokensUpdated()
        return { changes: result.changes }
    })

    // ── Component Override Clear Handler (Phase E — Garbage Collection) ────────
    // Deletes the component_overrides row for `flintId`, releasing the export
    // lock associated with a deleted AST node. Called by the renderer-side
    // applyMutationBatch deleteNode path via window.flintAPI.tokens.clearOverride.
    //
    // Silent no-op if the row does not exist (idempotent).
    ipcMain.handle('tokens:clear-override', (_event, flintId: unknown): void => {
        if (typeof flintId !== 'string' || flintId.length === 0) return
        db.prepare('DELETE FROM component_overrides WHERE flint_id = ?').run(flintId)
    })

    // ── Component Override Upsert Handler (Phase E — Write Pathway) ───────────
    // INSERT OR REPLACE a single property row in component_overrides, recording
    // that `propertyKey` on `flintId` has been manually overridden.
    //
    // The composite PK (flint_id, property_key) ensures each property for a
    // given element has exactly one row; subsequent edits to the same property
    // update the row in-place via the ON CONFLICT replacement.
    //
    // The Export Gate (canExport) reads overridesExist, updated optimistically
    // by the renderer via canvasStore.setOverridesExist after each commit.
    ipcMain.handle(
        'tokens:upsert-override',
        (_event, flintId: unknown, propertyKey: unknown, propertyValue: unknown): void => {
            if (
                typeof flintId !== 'string' || flintId.length === 0 ||
                typeof propertyKey !== 'string' || propertyKey.length === 0 ||
                typeof propertyValue !== 'string'
            ) return
            db.prepare(
                `INSERT OR REPLACE INTO component_overrides
                    (flint_id, property_key, property_value, updated_at)
                 VALUES (?, ?, ?, strftime('%s','now'))`
            ).run(flintId, propertyKey, propertyValue)
        }
    )

    // ── Component Override Read Handler (Phase B.2 — Export Gate) ─────────────
    // Returns every row in component_overrides so the ExportModal can surface
    // exactly which flint IDs and properties are blocking export.
    // Results are ordered by updated_at DESC so the most recently dirtied nodes
    // appear first in the violation list.
    type OverrideRow = {
        flint_id: string
        property_key: string
        property_value: string
        updated_at: number
    }
    const stmtReadOverrides = db.prepare<[], OverrideRow>(`
        SELECT flint_id, property_key, property_value, updated_at
        FROM component_overrides
        ORDER BY updated_at DESC
    `)
    ipcMain.handle('tokens:read-overrides', (): OverrideRow[] => stmtReadOverrides.all())

    // ── MINT.2a: Token Usage Scanner ────────────────────────────────────────
    // Scans project files (.tsx/.jsx/.css) for CSS variable references to
    // design tokens. Returns usage counts per token for dead-token detection.
    ipcMain.handle('tokens:scan-usage', async () => {
        if (!activeProjectRoot) return []

        // 1. Load design tokens from .flint/design-tokens.json
        const tokensPath = path.join(activeProjectRoot, '.flint', 'design-tokens.json')
        let tokenEntries: { name: string; cssVar: string }[] = []
        try {
            const raw = await readFile(tokensPath, 'utf8')
            const parsed = JSON.parse(raw)
            // Flatten token tree into name → CSS variable pairs
            // Tokens are stored as nested objects; leaf nodes have $value and $type
            function walk(obj: Record<string, unknown>, prefix: string) {
                for (const [key, val] of Object.entries(obj)) {
                    if (key.startsWith('$')) continue
                    const fullPath = prefix ? `${prefix}-${key}` : key
                    if (val && typeof val === 'object' && '$value' in (val as Record<string, unknown>)) {
                        tokenEntries.push({
                            name: fullPath,
                            cssVar: `--${fullPath}`,
                        })
                    } else if (val && typeof val === 'object') {
                        walk(val as Record<string, unknown>, fullPath)
                    }
                }
            }
            walk(parsed, '')
        } catch {
            // Also try reading from SQLite token store as fallback
            try {
                const allTokens = stmtReadAll.all() as Array<{ token_path: string }>
                tokenEntries = allTokens.map((t) => ({
                    name: t.token_path,
                    cssVar: `--${t.token_path.replace(/\./g, '-')}`,
                }))
            } catch {
                return []
            }
        }

        if (tokenEntries.length === 0) return []

        // 2. Collect project files (.tsx, .jsx, .css) — limit to 500 files
        const FILE_LIMIT = 500
        const extensions = new Set(['.tsx', '.jsx', '.css'])
        const files: string[] = []

        async function collectFiles(dir: string) {
            if (files.length >= FILE_LIMIT) return
            let entries
            try {
                entries = await readdir(dir, { withFileTypes: true })
            } catch { return }
            for (const entry of entries) {
                if (files.length >= FILE_LIMIT) break
                const fullPath = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                    // Skip node_modules, .git, dist, build
                    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) continue
                    await collectFiles(fullPath)
                } else if (extensions.has(path.extname(entry.name))) {
                    files.push(fullPath)
                }
            }
        }
        await collectFiles(activeProjectRoot)

        // 3. Scan each file for CSS variable references
        const usageMap = new Map<string, { count: number; files: Set<string> }>()
        for (const te of tokenEntries) {
            usageMap.set(te.cssVar, { count: 0, files: new Set() })
        }

        for (const filePath of files) {
            let content: string
            try {
                content = await readFile(filePath, 'utf8')
            } catch { continue }

            for (const te of tokenEntries) {
                // Match var(--token-name) or direct --token-name references
                if (content.includes(te.cssVar)) {
                    const entry = usageMap.get(te.cssVar)!
                    const relativePath = path.relative(activeProjectRoot!, filePath)
                    entry.count++
                    entry.files.add(relativePath)
                }
            }
        }

        // 4. Build result array
        return tokenEntries.map((te) => {
            const usage = usageMap.get(te.cssVar)!
            return {
                tokenName: te.name,
                cssVar: te.cssVar,
                usageCount: usage.count,
                files: [...usage.files],
            }
        })
    })

    // ── MINT.3a: Token Contrast Auditor ─────────────────────────────────────
    // Reads color tokens from .flint/design-tokens.json, computes WCAG contrast
    // ratio for all foreground/background pairs.
    ipcMain.handle('tokens:audit-contrast', async () => {
        if (!activeProjectRoot) return []

        // Inline WCAG contrast helpers
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

        // Load color tokens
        const tokensPath = path.join(activeProjectRoot, '.flint', 'design-tokens.json')
        const colorTokens: { name: string; value: string }[] = []
        try {
            const raw = await readFile(tokensPath, 'utf8')
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
            // Also try SQLite fallback
            try {
                const allTokens = stmtReadAll.all() as Array<{ token_path: string; token_value: string; token_type: string }>
                for (const t of allTokens) {
                    if (t.token_type === 'color' && t.token_value.startsWith('#')) {
                        colorTokens.push({ name: t.token_path, value: t.token_value })
                    }
                }
            } catch {
                return []
            }
        }

        if (colorTokens.length < 2) return []

        // Compute contrast for all fg/bg pairs
        const pairs: Array<{
            fg: string; bg: string; fgValue: string; bgValue: string
            ratio: number; passAA: boolean; passAAA: boolean
        }> = []

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
                    fg: colorTokens[i].name,
                    bg: colorTokens[j].name,
                    fgValue: colorTokens[i].value,
                    bgValue: colorTokens[j].value,
                    ratio,
                    passAA: ratio >= 4.5,
                    passAAA: ratio >= 7.0,
                })
            }
        }

        return pairs
    })

    // ── MINT.3c: Token Approval Staging ─────────────────────────────────────
    // Reads/writes `.flint/pending-tokens.json` for approval workflow.

    ipcMain.handle('tokens:get-pending-approvals', async () => {
        if (!activeProjectRoot) return []
        const pendingPath = path.join(activeProjectRoot, '.flint', 'pending-tokens.json')
        try {
            const raw = await readFile(pendingPath, 'utf8')
            return JSON.parse(raw)
        } catch {
            return []
        }
    })

    ipcMain.handle('tokens:approve-token', async (_event, tokenName: unknown) => {
        if (!activeProjectRoot || typeof tokenName !== 'string') return { ok: false }

        const pendingPath = path.join(activeProjectRoot, '.flint', 'pending-tokens.json')
        const tokensPath = path.join(activeProjectRoot, '.flint', 'design-tokens.json')

        try {
            const raw = await readFile(pendingPath, 'utf8')
            const pending = JSON.parse(raw) as Array<{ name: string; value: string; type: string; source: string; proposedAt: string }>
            const token = pending.find((t) => t.name === tokenName)
            if (!token) return { ok: false }

            // Remove from pending (Commandment 12: atomic write via FTM)
            const remaining = pending.filter((t) => t.name !== tokenName)
            await fileTransactionManager.write(pendingPath, JSON.stringify(remaining, null, 2))

            // Add to design-tokens.json
            let designTokens: Record<string, unknown> = {}
            try {
                const dtRaw = await readFile(tokensPath, 'utf8')
                designTokens = JSON.parse(dtRaw)
            } catch { /* fresh file */ }

            // Build nested path
            const parts = token.name.split('.')
            let current: Record<string, unknown> = designTokens
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
                    current[parts[i]] = {}
                }
                current = current[parts[i]] as Record<string, unknown>
            }
            current[parts[parts.length - 1]] = {
                $value: token.value,
                $type: token.type,
            }

            await fileTransactionManager.write(tokensPath, JSON.stringify(designTokens, null, 2))
            return { ok: true }
        } catch {
            return { ok: false }
        }
    })

    ipcMain.handle('tokens:reject-token', async (_event, tokenName: unknown) => {
        if (!activeProjectRoot || typeof tokenName !== 'string') return { ok: false }

        const pendingPath = path.join(activeProjectRoot, '.flint', 'pending-tokens.json')
        try {
            const raw = await readFile(pendingPath, 'utf8')
            const pending = JSON.parse(raw) as Array<{ name: string }>
            const remaining = pending.filter((t) => t.name !== tokenName)
            await fileTransactionManager.write(pendingPath, JSON.stringify(remaining, null, 2))
            return { ok: true }
        } catch {
            return { ok: false }
        }
    })

    // ── Presence UPSERT Handler ──────────────────────────────────────────────
    // Receives batched cursor/selection updates from the renderer (sent at most
    // every 50–100 ms via the renderer-side throttle in useSyncPresence).
    // The main process simply performs an UPSERT — no additional batching needed.
    //
    // Payload shape: { id, userId, nodeId, x, y }
    //   id     — session UUID that uniquely identifies the sender's presence row
    //   userId — human-readable display name or generated handle
    //   nodeId — the flint ID of the node currently selected (may be '')
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
            console.warn(`${BRAND.logPrefix} ast:save-file: shadowCommit failed (file saved, version snapshot unavailable) —`, err instanceof Error ? err.message : err)
        })

        // CV2.2: Auto-invalidate thumbnail when a component file is saved
        void autoInvalidateThumbnail(filePath)

        // File watcher: register newly created files so they are stat-polled
        // going forward. Uses the shared trackedFiles map exposed on globalThis
        // by the workspace file watcher block (initialised after app:ready).
        const tracked = (globalThis as Record<string, unknown>)['__flintTrackedFiles'] as Map<string, number> | undefined
        if (tracked && !tracked.has(filePath)) {
            try {
                const { mtimeMs } = await fsStat(filePath)
                tracked.set(filePath, mtimeMs)
            } catch { /* ignore — file may have been deleted immediately */ }
        }
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
        const firstPath = [...validated.keys()][0]
        if (firstPath) {
            await gitManager.shadowCommit(path.dirname(firstPath)).catch((err: Error) => {
                console.warn(`${BRAND.logPrefix} ast:save-batch: shadowCommit failed (files saved, version snapshot unavailable) —`, err instanceof Error ? err.message : err)
            })
        }

        // CV2.2: Auto-invalidate thumbnails for all saved component files
        for (const filePath of validated.keys()) {
            void autoInvalidateThumbnail(filePath)
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

    // ── Phase CV2.2: Thumbnail IPC Handlers ───────────────────────────────────
    //
    // All thumbnail operations are pull-based (renderer requests when needed).
    // No push events — thumbnails are derived cache artifacts, not source-of-truth.
    // Security: componentName is sanitized inside ThumbnailGenerator.sanitizeComponentName().

    /**
     * thumbnails:generate — renders a single component and saves a PNG to
     * .flint/thumbnails/. Returns cache hit immediately if the PNG exists.
     */
    ipcMain.handle('thumbnails:generate', async (_event, payload: unknown) => {
        if (
            typeof payload !== 'object' || payload === null ||
            typeof (payload as Record<string, unknown>).filePath !== 'string' ||
            typeof (payload as Record<string, unknown>).componentName !== 'string'
        ) {
            throw new TypeError('thumbnails:generate — payload must have filePath and componentName strings')
        }
        const p = payload as ThumbnailOptions
        const home = app.getPath('home')
        if (!path.isAbsolute(p.filePath) || !/\.(tsx?|jsx?)$/.test(p.filePath)) {
            throw new Error('thumbnails:generate — filePath must be an absolute path to a source file')
        }
        if (!p.filePath.startsWith(home + path.sep)) {
            throw new Error('thumbnails:generate — path outside user home directory')
        }
        if (!activeProjectRoot) {
            return { componentName: p.componentName, thumbnailPath: '', generated: false, error: 'No active project' }
        }
        const gen = getThumbnailGenerator(activeProjectRoot)
        return gen.generate(p)
    })

    /**
     * thumbnails:generate-all — batch generates thumbnails for all components
     * listed in flint-manifest.json. Processed sequentially.
     */
    ipcMain.handle('thumbnails:generate-all', async () => {
        if (!activeProjectRoot) {
            return { total: 0, succeeded: 0, failed: 0, results: [] }
        }
        const gen = getThumbnailGenerator(activeProjectRoot)
        return gen.generateAll()
    })

    /**
     * thumbnails:get — reads a cached thumbnail as a base64 data URL.
     * Returns null if the thumbnail is not cached (caller should generate first).
     */
    ipcMain.handle('thumbnails:get', async (_event, componentName: unknown) => {
        if (typeof componentName !== 'string' || componentName.trim() === '') {
            return null
        }
        if (!activeProjectRoot) return null
        const gen = getThumbnailGenerator(activeProjectRoot)
        return gen.get(componentName)
    })

    /**
     * thumbnails:invalidate — deletes the cached PNG for a component.
     * Called automatically on ast:save-file; can also be called manually.
     */
    ipcMain.handle('thumbnails:invalidate', async (_event, componentName: unknown) => {
        if (typeof componentName !== 'string' || componentName.trim() === '') return
        if (!activeProjectRoot) return
        const gen = getThumbnailGenerator(activeProjectRoot)
        await gen.invalidate(componentName)
    })

    // ── Project Registry + Template Scaffolding ───────────────────────────────
    const { upsertProject, getRecentProjects, removeProject, getLastSession } = await import('./registry.js')
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
    // Scaffolds a new Flint workspace by copying the bundled template into an
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

        // ── Scaffold .flint/ directory with starter config files ────────────
        // Creates .flint/policy.json (DEFAULT_POLICY) and
        // .flint/design-tokens.json (empty array) so the governance engine
        // and StatusBar can read them immediately without falling back to
        // hard-coded defaults.  Uses the atomic FTM queue — no raw writeFile.
        const flintDir = path.join(targetPath, BRAND.configDir)
        await mkdir(flintDir, { recursive: true })

        const { DEFAULT_POLICY } = await import('../flint-mcp/src/core/config.js')
        await fileTransactionManager.write(
            path.join(flintDir, 'policy.json'),
            JSON.stringify(DEFAULT_POLICY, null, 2) + '\n',
        )
        await fileTransactionManager.write(
            path.join(flintDir, 'design-tokens.json'),
            '[]\n',
        )

        // Ensure git repo is initialized on the new workspace
        await gitManager.ensureRepo(targetPath).catch(err => {
            console.error(`${BRAND.logPrefix} main.ts: ensureRepo failed for new project ${targetPath}`, err)
        })

        // Write to registry (UUID is stable: path UNIQUE constraint preserves
        // the first-inserted id on subsequent opens of the same directory)
        const projectName = path.basename(targetPath)
        upsertProject(randomUUID(), projectName, targetPath)

        // Scan the newly populated directory and return the tree
        return scanDirectory(targetPath)
    })

    // ── project:create-scratchpad ─────────────────────────────────────────────
    // Instantly scaffolds a new project in ~/Flint Projects/Untitled-N with no
    // dialog. The first available counter slot is chosen so names never collide.
    //
    // Steps:
    //   1. Ensure ~/Flint Projects/ exists.
    //   2. Pick the next free Untitled-N name.
    //   3. Create the directory and scaffold from 'base-vite-tailwind'.
    //   4. Write .flint/ policy + tokens (same as project:initialize).
    //   5. Git init via gitManager.ensureRepo.
    //   6. Register in the global registry.
    //   7. Set activeProjectRoot and start the MCP client.
    //   8. Scan and return the FileTreeNode tree.
    ipcMain.handle('project:create-scratchpad', async (): Promise<FileTreeNode> => {
        const flintProjectsDir = path.join(app.getPath('home'), `${BRAND.product} Projects`)
        await mkdir(flintProjectsDir, { recursive: true })

        // Find the first free Untitled-N slot
        let existing: string[] = []
        try { existing = await readdir(flintProjectsDir) } catch { /* empty dir is fine */ }
        let counter = 1
        while (existing.includes(`Untitled-${counter}`)) counter++
        const projectName = `Untitled-${counter}`
        const targetPath = path.join(flintProjectsDir, projectName)
        await mkdir(targetPath)

        // Scaffold using the same template service as project:initialize
        initializeProject(targetPath, 'base-vite-tailwind')

        // Write .flint/ starter config files
        const flintDir = path.join(targetPath, BRAND.configDir)
        await mkdir(flintDir, { recursive: true })
        const { DEFAULT_POLICY } = await import('../flint-mcp/src/core/config.js')
        await fileTransactionManager.write(
            path.join(flintDir, 'policy.json'),
            JSON.stringify(DEFAULT_POLICY, null, 2) + '\n',
        )
        await fileTransactionManager.write(
            path.join(flintDir, 'design-tokens.json'),
            '[]\n',
        )

        // Git init
        await gitManager.ensureRepo(targetPath).catch(err => {
            console.error(`${BRAND.logPrefix} project:create-scratchpad: ensureRepo failed for ${targetPath}`, err)
        })

        // Register in registry
        upsertProject(randomUUID(), projectName, targetPath)

        // Set active project root and start MCP client
        activeProjectRoot = targetPath
        // AGV.1: Load per-project agent policy
        void loadAgentPolicy(targetPath).catch((err) => {
            console.error(`${BRAND.logPrefix} loadAgentPolicy failed after create-scratchpad:`, err)
        })
        void mcpClient.start(targetPath).catch((err) => {
            console.error(`${BRAND.logPrefix} mcpClient.start failed after create-scratchpad:`, err)
        })
        // File watcher: restart scan for new project root
        void (globalThis as Record<string, unknown>)['__flintStartFileWatcher']?.()
        // CV2.2: Initialize thumbnail generator for the new project root
        getThumbnailGenerator(targetPath)
        // CK.1: Seed RAG store with component docs + tokens
        void import('./ragSeeder.js').then(({ seedRAGFromProject }) => {
            seedRAGFromProject(targetPath).catch(err => {
                console.error(`${logTag('CK.1')} RAG seeding failed:`, err)
            })
        })

        return scanDirectory(targetPath)
    })

    // ── project:reset-to-demo ──────────────────────────────────────────────────
    // Resets the provided targetPath to the bundled 'flint-demo' state.
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
            console.error(`${BRAND.logPrefix} main.ts: ensureRepo failed for reset project ${targetPath}`, err)
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

        // Self-hosting guard: don't open the Flint source tree as a project
        if (isFlintSourceTree(normalized)) {
            console.warn(`${BRAND.logPrefix} Refusing to open Flint source tree as project (self-hosting guard)`)
            return null
        }

        try {
            // Ensure git repo exists before returning the tree
            await gitManager.ensureRepo(normalized).catch(err => {
                console.error(`${BRAND.logPrefix} main.ts: ensureRepo failed for ${normalized}`, err)
            })

            const tree = await scanDirectory(normalized)
            const projectName = path.basename(normalized)
            upsertProject(randomUUID(), projectName, normalized)
            activeProjectRoot = normalized
            // AGV.1: Load per-project agent policy
            void loadAgentPolicy(normalized).catch((err) => {
                console.error(`${BRAND.logPrefix} loadAgentPolicy failed after openPath:`, err)
            })
            // Phase W.3: start MCP client for the newly opened project
            void mcpClient.start(normalized).catch((err) => {
                console.error(`${BRAND.logPrefix} mcpClient.start failed after openPath:`, err)
            })
            // File watcher: restart scan for new project root
            void (globalThis as Record<string, unknown>)['__flintStartFileWatcher']?.()
            // CV2.2: Initialize thumbnail generator for the new project root
            getThumbnailGenerator(normalized)
            // CK.1: Seed RAG store with component docs + tokens
            void import('./ragSeeder.js').then(({ seedRAGFromProject }) => {
                seedRAGFromProject(normalized).catch(err => {
                    console.error(`${logTag('CK.1')} RAG seeding failed:`, err)
                })
            })
            return tree
        } catch {
            return null
        }
    })

    // ── project:findRootForFile ───────────────────────────────────────────────
    // Walks up the directory tree from a given file path looking for a project
    // root (a directory that contains package.json or .flint/). Returns the
    // absolute root path, or null if none is found before the home directory.
    //
    // Used by the Glass MCP push channel (file:focus events) to auto-open a
    // project when Claude writes a file and Glass has no workspace loaded.
    ipcMain.handle('project:findRootForFile', (_event, filePath: unknown): string | null => {
        if (typeof filePath !== 'string') return null

        const home = app.getPath('home')
        let dir = path.dirname(path.normalize(filePath))

        for (let i = 0; i < 20; i++) {
            // Security: stop at home directory boundary
            if (!dir.startsWith(home)) break

            const hasPackageJson = existsSync(path.join(dir, 'package.json'))
            const hasFlintDir = existsSync(path.join(dir, '.flint'))

            if (hasPackageJson || hasFlintDir) {
                return isFlintSourceTree(dir) ? null : dir
            }

            const parent = path.dirname(dir)
            if (parent === dir) break  // filesystem root
            dir = parent
        }

        return null
    })

    // ── project:reindex ───────────────────────────────────────────────────────
    // CK.3: Re-scans the active project for components, merges the result
    // into flint-manifest.json, and re-seeds the RAG store so that
    // flint_search_design_system returns up-to-date results.
    //
    // Returns { components, ragChunks } — both zero when no project is open.
    // Never throws: errors are logged and reflected in the zero-count return.
    ipcMain.handle('project:reindex', async (): Promise<{ components: number; ragChunks: number }> => {
        if (!activeProjectRoot) return { components: 0, ragChunks: 0 }

        const root = activeProjectRoot

        // 1. Run component indexer (Babel AST scan — Commandment 13)
        const { indexComponents } = await import(
            '../flint-mcp/src/core/init/componentIndexer.js'
        )
        const indexResult = await indexComponents(root)

        // 2. Merge into flint-manifest.json (read existing manifest → update → write)
        const manifestPath = path.join(root, BRAND.manifestFile)
        let manifest: Record<string, unknown> = {}
        try {
            const raw = await readFile(manifestPath, 'utf-8')
            manifest = JSON.parse(raw) as Record<string, unknown>
        } catch {
            // Missing or malformed manifest — start fresh
        }
        manifest.components = indexResult.components
        await fileTransactionManager.write(
            manifestPath,
            JSON.stringify(manifest, null, 2) + '\n',
        )

        // 3. Re-seed RAG store from the updated manifest + tokens + docs
        const { seedRAGFromProject } = await import('./ragSeeder.js')
        const ragResult = await seedRAGFromProject(root)

        console.log(
            `${logTag('CK.3')} Reindex complete — ${indexResult.count} components, ${ragResult.ingested} RAG chunks`,
        )

        return { components: indexResult.count, ragChunks: ragResult.ingested }
    })

    // ── registry:getRecent ────────────────────────────────────────────────────
    // Returns up to 10 recently opened projects (newest first) from the global
    // registry. Called by LaunchScreen on mount to populate the recent list.
    ipcMain.handle('registry:getRecent', (): ReturnType<typeof getRecentProjects> => {
        return getRecentProjects()
    })

    // ── project:get-last-session ──────────────────────────────────────────
    // Returns the most recent project for auto-resume, or null if none exists.
    // The renderer uses this to skip the LaunchScreen for returning users.
    ipcMain.handle('project:get-last-session', async (): Promise<unknown> => {
        const session = getLastSession()
        if (!session) return null
        // Verify the path still exists on disk
        if (!existsSync(session.path)) return null
        return session
    })

    // ── project:detect-environment (FORGE.2a–2c) ───────────────────────────────
    // Detects the project's UI framework, CSS framework, token format, TypeScript,
    // and component library by reading package.json and checking for config files.
    // Writes the result to .flint/detected-environment.json (FORGE.2b) and runs
    // a best-effort baseline audit via MCP if connected (FORGE.2c).
    ipcMain.handle('project:detect-environment', async (): Promise<ProjectEnvironment | null> => {
        if (!activeProjectRoot) return null

        const root = activeProjectRoot

        // ── FORGE.2a: Detect via shared projectDetector ───────────────────
        const detectorFs: DetectorFS = {
            readFile: (fp: string, enc: 'utf-8') => readFile(fp, enc),
            exists: (fp: string) => existsSync(fp),
        }

        const result = await detectProjectEnvironment(root, detectorFs)

        // ── FORGE.2b: Write detection result to .flint/ ──────────────────
        try {
            const flintDir = path.join(root, '.flint')
            if (!existsSync(flintDir)) {
                await mkdir(flintDir, { recursive: true })
            }
            await writeFile(
                path.join(flintDir, 'detected-environment.json'),
                JSON.stringify(result, null, 2),
                'utf-8',
            )
        } catch (err) {
            console.error(`${logTag('FORGE.2b')} Failed to write detected-environment.json:`, err)
        }

        // ── FORGE.2c: Best-effort baseline audit via MCP ─────────────────
        try {
            if (mcpClient.status().connected) {
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
                    const rawResult = await mcpClient.callTool('audit_ui_component', { file: auditFile })
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
            console.error(`${logTag('FORGE.2c')} Baseline audit failed (non-blocking):`, err)
        }

        // ── FORGE.2b: Auto-configure from detection result ───────────────
        try {
            if (mcpClient.status().connected) {
                const libName = result.componentLibrary?.name
                if (libName) {
                    await mcpClient.callTool('flint_set_library', { library: libName })
                        .catch((err: unknown) => {
                            console.error(`${logTag('FORGE.2b')} flint_set_library failed (non-blocking):`, err)
                        })
                }
                await mcpClient.callTool('flint_reindex_registry', {})
                    .catch((err: unknown) => {
                        console.error(`${logTag('FORGE.2b')} flint_reindex_registry failed (non-blocking):`, err)
                    })
            }
        } catch (err) {
            console.error(`${logTag('FORGE.2b')} Auto-configure side-effect failed (non-blocking):`, err)
        }

        return result
    })

    /* FORGE.2a: Detection logic extracted to shared/projectDetector.ts */

    // ── project:auto-configure (FORGE.2b) ────────────────────────────────────
    // Reads the detected environment (or accepts it inline) and calls MCP tools
    // to configure the project: flint_set_library + flint_reindex_registry.
    // All MCP calls are best-effort — errors are logged, never thrown.
    ipcMain.handle('project:auto-configure', async (): Promise<{
        configured: boolean
        library: string | null
        reindexed: boolean
    }> => {
        if (!activeProjectRoot) {
            return { configured: false, library: null, reindexed: false }
        }

        if (!mcpClient.status().connected) {
            return { configured: false, library: null, reindexed: false }
        }

        const root = activeProjectRoot
        let library: string | null = null
        let librarySet = false
        let reindexed = false

        // Read the detected environment written by project:detect-environment
        try {
            const envPath = path.join(root, '.flint', 'detected-environment.json')
            const raw = await readFile(envPath, 'utf-8')
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
                await mcpClient.callTool('flint_set_library', { library })
                librarySet = true
            } catch (err) {
                console.error(`${logTag('FORGE.2b')} flint_set_library failed (non-blocking):`, err)
            }
        }

        // Always re-index the registry after configuring
        try {
            await mcpClient.callTool('flint_reindex_registry', {})
            reindexed = true
        } catch (err) {
            console.error(`${logTag('FORGE.2b')} flint_reindex_registry failed (non-blocking):`, err)
        }

        const configured = librarySet || reindexed
        return { configured, library, reindexed }
    })

    // ── project:run-baseline (FORGE.2c) ──────────────────────────────────────
    // Runs a full project-wide audit via MCP and writes a debt snapshot to
    // .flint/debt-snapshot.json. Emits progress events via BrowserWindow so the
    // UI can show a progress indicator. All MCP calls are best-effort — errors
    // are caught and partial results are returned.
    ipcMain.handle('project:run-baseline', async (): Promise<{
        violations: number; grade: string; score: number; filesAudited: number
    } | null> => {
        if (!activeProjectRoot) return null
        if (!mcpClient.status().connected) return null

        const root = activeProjectRoot
        const flintDir = path.join(root, '.flint')

        const emitProgress = (phase: string, percent: number): void => {
            const win = BrowserWindow.getAllWindows()[0]
            if (win) {
                win.webContents.send('project:baseline-progress', { phase, percent })
            }
        }

        let violations = 0
        let filesAudited = 0
        let grade = 'N/A'
        let score = 0

        // Phase 1 — full swarm audit
        try {
            emitProgress('auditing', 20)
            const swarmResult = await mcpClient.callTool('flint_swarm_audit_fix', {
                glob: 'src/**/*.tsx',
                autoFix: false,
            })
            emitProgress('auditing', 50)
            if (swarmResult?.content?.[0]?.text) {
                try {
                    const swarmData = JSON.parse(swarmResult.content[0].text as string) as {
                        totalViolations?: number
                        filesAudited?: number
                        summary?: { totalViolations?: number; filesAudited?: number }
                    }
                    violations = swarmData.totalViolations
                        ?? swarmData.summary?.totalViolations
                        ?? 0
                    filesAudited = swarmData.filesAudited
                        ?? swarmData.summary?.filesAudited
                        ?? 0
                } catch {
                    // Swarm result was not valid JSON — skip
                }
            }
        } catch (err) {
            console.error(`${logTag('FORGE.2c')} flint_swarm_audit_fix failed (non-blocking):`, err)
        }

        // Phase 2 — debt report
        try {
            emitProgress('scoring', 70)
            const debtResult = await mcpClient.callTool('flint_debt_report', {
                glob: 'src/**/*.tsx',
                format: 'json',
            })
            emitProgress('scoring', 80)
            if (debtResult?.content?.[0]?.text) {
                try {
                    const debtData = JSON.parse(debtResult.content[0].text as string) as {
                        grade?: string
                        score?: number
                        healthScore?: number
                        summary?: { grade?: string; score?: number; healthScore?: number }
                    }
                    grade = debtData.grade ?? debtData.summary?.grade ?? 'N/A'
                    score = debtData.score
                        ?? debtData.healthScore
                        ?? debtData.summary?.score
                        ?? debtData.summary?.healthScore
                        ?? 0

                    // Write debt snapshot so project:get-health-grade can read it later
                    try {
                        if (!existsSync(flintDir)) {
                            await mkdir(flintDir, { recursive: true })
                        }
                        await writeFile(
                            path.join(flintDir, 'debt-snapshot.json'),
                            JSON.stringify({
                                grade, score, violations, filesAudited,
                                timestamp: new Date().toISOString(),
                            }, null, 2),
                            'utf-8',
                        )
                    } catch (writeErr) {
                        console.error(`${logTag('FORGE.2c')} Failed to write debt-snapshot.json:`, writeErr)
                    }
                } catch {
                    // Debt result was not valid JSON — skip
                }
            }
        } catch (err) {
            console.error(`${logTag('FORGE.2c')} flint_debt_report failed (non-blocking):`, err)
        }

        emitProgress('done', 100)
        return { violations, grade, score, filesAudited }
    })

    // ── project:get-health-grade (FORGE.4b) ──────────────────────────────────
    // Reads the cached debt snapshot for a project and returns its health grade.
    // Used by LaunchScreen to display grade badges on recent projects.
    ipcMain.handle('project:get-health-grade', async (_e, projectPath: unknown): Promise<{ grade: string; score: number; updatedAt: string } | null> => {
        if (typeof projectPath !== 'string') return null
        // Path validation: must be absolute and within user home directory
        const home = app.getPath('home')
        if (!path.isAbsolute(projectPath) || !projectPath.startsWith(home + path.sep)) return null
        try {
            const snapshotPath = path.join(projectPath, '.flint', 'debt-snapshot.json')
            const raw = await readFile(snapshotPath, 'utf-8')
            const data = JSON.parse(raw) as { grade?: string; score?: number; timestamp?: string }
            if (!data.grade || data.score == null) return null
            return { grade: data.grade, score: data.score, updatedAt: data.timestamp ?? new Date().toISOString() }
        } catch { return null }
    })

    // ── mcp:get-recent-file-focus ──────────────────────────────────────────────
    // Scans recently opened projects for file:focus events written in the last
    // 60 seconds. Used by App.tsx on cold launch to skip LaunchScreen and open
    // directly to the last file Claude Code touched.
    ipcMain.handle('mcp:get-recent-file-focus', (): string | null => {
        const THRESHOLD_MS = 60_000
        const now = Date.now()
        const home = app.getPath('home')
        const projects = getRecentProjects()
        let best: { filePath: string; timestamp: number } | null = null

        for (const project of projects) {
            const eventsFile = path.join(project.path, '.flint', 'mcp-events.jsonl')
            if (!existsSync(eventsFile)) continue

            try {
                const content = readFileSync(eventsFile, 'utf-8')
                const lines = content.trimEnd().split('\n').slice(-100)

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
                        if (!best || ts > best.timestamp) {
                            best = { filePath: fp, timestamp: ts }
                        }
                    } catch { /* malformed line — skip */ }
                }
            } catch { /* file unreadable — skip */ }
        }

        return best?.filePath ?? null
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
    // Migrates a legacy plaintext `apiKey` to encrypted storage. Only runs when
    // a config file already exists (i.e., NOT on first launch). This avoids
    // triggering the macOS Keychain permission dialog on a fresh install before
    // the user has even seen the app.
    await (async () => {
        try {
            const cfg = await readAIConfig()
            // Only migrate if there's actually a plaintext key to encrypt.
            const hasPlaintextKey =
                typeof (cfg as Record<string, unknown>).apiKey === 'string' &&
                ((cfg as Record<string, unknown>).apiKey as string).length > 0 &&
                !((cfg as Record<string, unknown>).apiKeyEncrypted)
            if (!hasPlaintextKey) return
            // Now check safeStorage — this is what triggers the Keychain prompt.
            if (!safeStorage.isEncryptionAvailable()) return
            await writeAIConfig(cfg)
            console.log(`${BRAND.logPrefix} Migrated API key to encrypted storage`)
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

    // ── Phase N: Figma-to-Flint AST Hydration (hydroPaste) ───────────────

    /** Figma node styles extracted from the plugin payload. */
    interface HydroFigmaStyles {
        layoutMode?: string
        itemSpacing?: number
        paddingTop?: number
        paddingRight?: number
        paddingBottom?: number
        paddingLeft?: number
        primaryAxisAlignItems?: string
        counterAxisAlignItems?: string
        width?: number
        height?: number
        fillColor?: string
        fillOpacity?: number
        strokeColor?: string
        strokeWeight?: number
        cornerRadius?: number
        opacity?: number
        fontSize?: number
        fontStyle?: string
        textColor?: string
        letterSpacing?: number
        lineHeight?: number
    }

    /** A single node in the Figma-to-Flint hydration payload. */
    interface HydroNodeData {
        figmaComponent?: string
        props?: Record<string, string | number | boolean>
        styles?: HydroFigmaStyles
        children?: HydroNodeData[]
    }

    /** A resolver entry from flint-manifest.json. */
    interface HydroResolver {
        match: Record<string, string[]>
        detect?: string[]
        excludeDetect?: string[]
        skip?: boolean
        componentName: string
        importPath: string
        propMap?: Record<string, string>
        defaultProps?: Record<string, string | number | boolean>
        leafComponent?: boolean
        wrapperTag?: string
        variantToProp?: { field: string; map: Record<string, Record<string, string | number | boolean>> }
    }

    /** A resolved component definition produced by resolveComponent(). */
    interface HydroResolvedDef {
        componentName: string
        importPath: string
        propMap: Record<string, string>
        defaultProps: Record<string, string | number | boolean>
        leafComponent?: boolean
        _resolvedVia: 'exact' | 'resolver' | 'fuzzy'
        _wrapperTag?: string
        _skip?: boolean
    }

    /** The manifest shape relevant to HydroPaste. */
    interface HydroManifest {
        components: Record<string, HydroResolvedDef>
        resolvers?: HydroResolver[]
    }

    /** Result of generateJsxElement — a Babel JSXElement with metadata. */
    interface HydroGeneratedElement {
        element: import('@babel/types').JSXElement | import('@babel/types').JSXText
        name: string
        import?: string
    }

    ipcMain.handle(ipcChannel('hydro-paste'), async (_event, payloadStr: unknown) => {
        if (typeof payloadStr !== 'string') return { error: 'Invalid payload' }

        try {
            const payload = JSON.parse(payloadStr)

            // Read manifest — try project root first, then home dir
            let manifest: HydroManifest = { components: {} }
            const searchPaths = [
                activeProjectRoot ? path.join(activeProjectRoot, BRAND.manifestFile) : null,
                path.join(app.getPath('home'), BRAND.manifestFile),
                path.join(process.cwd(), BRAND.manifestFile),
                path.join(app.getAppPath(), BRAND.manifestFile),
                path.join(app.getAppPath(), '..', BRAND.manifestFile),
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
                console.warn('[HydroPaste] No flint-manifest.json found in any search path')
                return { error: `Manifest not found. Searched: ${searchPaths.join(', ')}. activeProjectRoot=${activeProjectRoot}` }
            }

            const components = manifest.components || {}
            const resolvers: HydroResolver[] = manifest.resolvers || []
            const requiredImports = new Set<string>()

            // ── Figma styles → Tailwind class converter ────────────────────
            function stylesToTailwind(styles: HydroFigmaStyles | undefined): string {
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
            function resolveComponent(nodeData: HydroNodeData): HydroResolvedDef | null {
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
                    const def: HydroResolvedDef = {
                        componentName: resolver.componentName,
                        importPath: resolver.importPath,
                        propMap: { ...(resolver.propMap ?? {}) },
                        defaultProps: { ...(resolver.defaultProps ?? {}) },
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

            async function generateJsxElement(nodeData: HydroNodeData): Promise<HydroGeneratedElement | null> {
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
                    const childNodes: HydroGeneratedElement[] = []
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
                if (componentDef?._wrapperTag || (!componentDef && nodeData.children?.length)) {
                    const tag = componentDef?._wrapperTag || 'div'
                    const childNodes: HydroGeneratedElement[] = []
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
                const attributes: import('@babel/types').JSXAttribute[] = []
                let childNodes: HydroGeneratedElement[] = []
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

                        let attrValue: import('@babel/types').StringLiteral | import('@babel/types').JSXExpressionContainer | null = t.stringLiteral(String(value))
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

                const childrenBlock: Array<import('@babel/types').JSXElement | import('@babel/types').JSXText> = childNodes.map((c) => c.element)
                if (textContent) {
                    childrenBlock.unshift(t.jsxText(textContent))
                }

                return { element: t.jsxElement(opening, closing, childrenBlock), name: componentDef.componentName, import: elementImport }
            }

            const rawElements = await Promise.all(payload.children.map(generateJsxElement))
            const rootElements = rawElements.filter(Boolean)
            if (rootElements.length === 0) return { error: 'No valid components found in payload' }

            const _genMod = await import('@babel/generator')
            const generate: (node: import('@babel/types').Node) => { code: string } =
                typeof _genMod === 'function' ? _genMod as unknown as (node: import('@babel/types').Node) => { code: string }
                : typeof _genMod.default === 'function' ? _genMod.default as unknown as (node: import('@babel/types').Node) => { code: string }
                : typeof (_genMod.default as Record<string, unknown>)?.default === 'function' ? (_genMod.default as Record<string, unknown>).default as unknown as (node: import('@babel/types').Node) => { code: string }
                : (_genMod as Record<string, unknown>).generate as (node: import('@babel/types').Node) => { code: string }

            // Generate per-element snippets paired with their imports
            const elements = rootElements.map((result: HydroGeneratedElement) => {
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

    // CK.1: Manual RAG re-seed trigger — called by the renderer via window.flintAPI.ai.seedRAG()
    ipcMain.handle('ai:seed-rag', async (): Promise<{ ingested: number; sources: string[] }> => {
        if (!activeProjectRoot) return { ingested: 0, sources: [] }
        const { seedRAGFromProject } = await import('./ragSeeder.js')
        return await seedRAGFromProject(activeProjectRoot)
    })

    // ── Phase COLLAB.4: Annotation IPC + fs.watch ─────────────────────────────
    //
    // Annotations are written to .flint/annotations.json by the MCP tool
    // (flint_annotate). Glass reads them via 'annotations:read-all' and
    // resolves them via 'annotations:resolve'. An fs.watch subscription on the
    // file pushes ipcChannel('annotations-changed') to all renderer windows whenever
    // the file changes so the React store re-fetches without polling.
    //
    // The annotations file path is derived from the active project root at
    // call-time so it always targets the currently open workspace.

    /**
     * Returns the absolute path to .flint/annotations.json for the active
     * project, falling back to the user home directory when no project is open.
     */
    function getAnnotationsFilePath(): string {
        const base = activeProjectRoot ?? app.getPath('home')
        return path.join(base, BRAND.configDir, 'annotations.json')
    }

    /**
     * Broadcasts ipcChannel('annotations-changed') to all non-destroyed renderer windows.
     * Called by the fs.watch callback whenever the annotations file is modified.
     */
    function broadcastAnnotationsChanged(): void {
        BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.webContents.send(ipcChannel('annotations-changed'))
        })
    }

    /**
     * Reads .flint/annotations.json and returns the parsed array.
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
     * Creates the parent .flint directory if it does not yet exist.
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
    // Returns all annotations from .flint/annotations.json.
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

    // ── fs.watch on .flint/annotations.json ─────────────────────────────────
    // Watches for external writes (from MCP tools) and pushes push events to
    // the renderer so annotationStore.fetchAnnotations() is triggered without
    // polling. The watcher is re-created whenever the active project changes
    // (tracked via the existing activeProjectRoot module-level variable).
    //
    // Implementation note: we watch the parent .flint/ directory rather than
    // the file directly because fs.watch on a non-existent file throws on some
    // platforms. The directory is created on first annotation write.
    {
        let annotationsPollInterval: ReturnType<typeof setInterval> | null = null
        let annotationsLastMtime = 0

        /**
         * (Re)starts the annotations poll. Uses stat-based polling instead of
         * fs.watch to avoid fsevents crashes on macOS 26 during env cleanup.
         */
        function startAnnotationsWatcher(): void {
            if (annotationsPollInterval) clearInterval(annotationsPollInterval)
            annotationsLastMtime = 0

            annotationsPollInterval = setInterval(async () => {
                const filePath = path.join(
                    activeProjectRoot ?? app.getPath('home'),
                    BRAND.configDir,
                    'annotations.json'
                )
                try {
                    const { mtimeMs } = await fsStat(filePath)
                    if (mtimeMs > annotationsLastMtime) {
                        annotationsLastMtime = mtimeMs
                        broadcastAnnotationsChanged()
                    }
                } catch { /* file doesn't exist yet */ }
            }, 1_500)
        }

        // Start the watcher for the initial project root (may be null on first launch).
        startAnnotationsWatcher()

        app.on('will-quit', () => {
            if (annotationsPollInterval) clearInterval(annotationsPollInterval)
        })
    }

    // ── Workspace File Watcher ────────────────────────────────────────────────
    // Stat-polls every .tsx/.ts/.jsx/.js file in the active project workspace
    // and broadcasts ipcChannel('file-changed') to all windows when an mtime
    // changes. This closes the core workflow loop: AI writes file → Glass
    // updates LivePreview automatically.
    //
    // Uses the same stat-poll pattern as the annotations watcher to avoid
    // fsevents crashes on macOS 26 during environment cleanup. Native fs.watch
    // is intentionally avoided for the same reason.
    //
    // Limits: max 100 files, skips node_modules / .git / dist / build dirs.
    // Interval: 1 000ms (1 second) — fast enough for responsive preview.
    {
        let fileWatchInterval: ReturnType<typeof setInterval> | null = null
        const trackedFiles = new Map<string, number>() // filePath → lastMtimeMs

        /**
         * Recursively scans `root` for source files, respecting the skip-list
         * and the 100-file hard cap. Returns absolute file paths.
         */
        async function scanWorkspaceFiles(root: string): Promise<string[]> {
            const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.flint'])
            const results: string[] = []

            async function walk(dir: string): Promise<void> {
                if (results.length >= 100) return
                let entries: Awaited<ReturnType<typeof readdir>>
                try {
                    entries = await readdir(dir, { withFileTypes: true })
                } catch { return }
                for (const entry of entries) {
                    if (results.length >= 100) break
                    if (entry.isDirectory()) {
                        if (!SKIP_DIRS.has(entry.name)) {
                            await walk(path.join(dir, entry.name))
                        }
                    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
                        results.push(path.join(dir, entry.name))
                    }
                }
            }

            await walk(root)
            return results
        }

        /**
         * (Re)starts the workspace file watcher. Clears any existing interval,
         * re-scans the workspace, initialises mtimes, then polls every second.
         * Called once on launch and again whenever activeProjectRoot changes.
         */
        async function startFileWatcher(): Promise<void> {
            if (fileWatchInterval) clearInterval(fileWatchInterval)
            trackedFiles.clear()

            if (!activeProjectRoot) return

            const files = await scanWorkspaceFiles(activeProjectRoot)
            for (const f of files) {
                try {
                    const { mtimeMs } = await fsStat(f)
                    trackedFiles.set(f, mtimeMs)
                } catch { /* file may not exist */ }
            }

            fileWatchInterval = setInterval(() => {
                void (async () => {
                    for (const [filePath, lastMtime] of trackedFiles) {
                        try {
                            const { mtimeMs } = await fsStat(filePath)
                            if (mtimeMs > lastMtime) {
                                trackedFiles.set(filePath, mtimeMs)
                                const content = await readFile(filePath, 'utf-8')
                                for (const win of BrowserWindow.getAllWindows()) {
                                    win.webContents.send(ipcChannel('file-changed'), { filePath, content })
                                }
                            }
                        } catch { /* file deleted or inaccessible — skip silently */ }
                    }
                })()
            }, 1_000)
        }

        // Hoist startFileWatcher and trackedFiles onto globalThis so that the
        // ast:save-file handler (defined before this block runs) can register
        // newly created files for tracking without a shared closure.
        ;(globalThis as Record<string, unknown>)['__flintStartFileWatcher'] = startFileWatcher
        ;(globalThis as Record<string, unknown>)['__flintTrackedFiles'] = trackedFiles

        // Start for the initial project root (may be null on first launch).
        void startFileWatcher()

        app.on('will-quit', () => {
            if (fileWatchInterval) clearInterval(fileWatchInterval)
        })
    }

    // ── IDE→Glass File Sync ───────────────────────────────────────────────────
    // The VS Code extension writes the active file path to
    // `.flint/ide-active-file.json` on every editor focus change.
    // We stat-poll that file (same pattern as annotations) and broadcast
    // ipcChannel('ide-file-selected') to the renderer so Glass auto-follows
    // IDE focus without the user touching the Files tab.
    {
        let ideFileSyncInterval: ReturnType<typeof setInterval> | null = null
        let ideFileSyncLastMtime = 0
        let ideFileSyncLastPath = ''

        function startIDEFileSyncWatcher(): void {
            if (ideFileSyncInterval) clearInterval(ideFileSyncInterval)
            ideFileSyncLastMtime = 0
            ideFileSyncLastPath = ''

            ideFileSyncInterval = setInterval(async () => {
                const filePath = path.join(
                    activeProjectRoot ?? app.getPath('home'),
                    BRAND.configDir,
                    'ide-active-file.json'
                )
                try {
                    const { mtimeMs } = await fsStat(filePath)
                    if (mtimeMs > ideFileSyncLastMtime) {
                        ideFileSyncLastMtime = mtimeMs
                        const raw = await readFile(filePath, 'utf8')
                        const parsed = JSON.parse(raw) as { path?: string; explicit?: boolean }
                        const filePath = parsed.path
                        const isExplicit = parsed.explicit === true
                        if (
                            typeof filePath === 'string' &&
                            path.isAbsolute(filePath) &&
                            activeProjectRoot &&
                            filePath.startsWith(activeProjectRoot + path.sep) &&
                            // Explicit commands bypass the lastPath dedup guard so
                            // the user can always reload the same file intentionally.
                            (isExplicit || filePath !== ideFileSyncLastPath)
                        ) {
                            ideFileSyncLastPath = filePath
                            BrowserWindow.getAllWindows().forEach((w) => {
                                if (!w.isDestroyed()) w.webContents.send(ipcChannel('ide-file-selected'), { path: filePath, explicit: isExplicit })
                            })
                        }
                    }
                } catch { /* file doesn't exist yet — normal until first IDE focus change */ }
            }, 1_000)
        }

        startIDEFileSyncWatcher()

        app.on('will-quit', () => {
            if (ideFileSyncInterval) clearInterval(ideFileSyncInterval)
        })
    }

    // ── Phase W.1: MCP Event Push Channel ─────────────────────────────────────
    //
    // The MCP server appends MCPEvent records (newline-delimited JSON) to
    // `.flint/mcp-events.jsonl` after each tool completion. The Electron main
    // process tail-follows that file using fs.watch (with a 10-second poll
    // fallback for NFS/NAS mounts) and broadcasts `flint:mcp-event` to all
    // renderer windows so the `useMCPEventListener` hook can dispatch to stores.
    //
    // Design invariants:
    //   - Byte offset is tracked so we never re-read lines already dispatched.
    //   - Events are batched within a 500ms debounce window to avoid a storm of
    //     individual notifications during a bulk audit.
    //   - On rotation (file shrinks below the last offset), offset resets to 0.
    {
        let mcpEventsOffset = 0
        let mcpEventsBatchTimer: ReturnType<typeof setTimeout> | null = null
        const mcpEventsBatch: unknown[] = []

        function getMCPEventsFilePath(): string {
            const base = activeProjectRoot ?? app.getPath('home')
            return path.join(base, BRAND.configDir, 'mcp-events.jsonl')
        }

        /**
         * Broadcasts a batch of parsed MCPEvent objects to all live renderer windows.
         * Called after the 500 ms debounce window closes.
         */
        function flushMCPEventsBatch(): void {
            if (mcpEventsBatch.length === 0) return
            const events = mcpEventsBatch.splice(0)
            BrowserWindow.getAllWindows().forEach((w) => {
                if (!w.isDestroyed()) w.webContents.send(ipcChannel('mcp-event'), events)
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
         * (Re)starts the MCP events poll. Uses a 2-second interval instead of
         * fs.watch to avoid fsevents crashes on macOS 26 during env cleanup.
         */
        function startMCPEventsWatcher(): void {
            mcpEventsOffset = 0

            const pollInterval = setInterval(() => {
                void tailMCPEvents()
            }, 2_000)

            app.once('will-quit', () => {
                clearInterval(pollInterval)
            })
        }

        startMCPEventsWatcher()
    }

    // ── Phase W.3: Bidirectional Action Flint — IPC Handlers ─────────────────
    //
    // Renderer calls these via window.flintAPI.mcp.callTool / readResource / status.
    // All execution stays in the main process; the renderer only receives the result.
    //
    // The mcpClient singleton is started when a project opens and stopped when
    // it closes. The IPC handlers are registered once at app-ready regardless
    // of whether the server is connected — callers must check status() first if
    // they need a graceful degradation path.

    /**
     * mcp:call-tool — Invoke an MCP tool by name with arguments.
     * Returns the tool's content array or throws with a human-readable message.
     *
     * AGV.1: Extracts agentId from args._agentId (if present) or defaults to
     * 'renderer' for Glass-initiated calls. Enforces both the SEC.3 renderer
     * allowlist and the per-agent ACL via checkToolAccess().
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

            // AGV.1: All ipcMain.handle calls originate from the renderer process.
            // The renderer MUST always be identified as 'renderer' — never trust
            // _agentId from IPC args, as that would allow the renderer to
            // impersonate a registered agent with elevated permissions.
            // Agent identity assertion is only trusted from the MCP protocol channel.
            const argsObj = args as Record<string, unknown>
            const agentId = 'renderer'

            // SEC.3 + AGV.1: Unified tool access check
            const access = checkToolAccess(agentId, name as string)
            if (!access.allowed) {
                console.warn(`${BRAND.logPrefix} mcp:call-tool DENIED — agent=%s tool=%s reason=%s`, agentId, name, access.reason)
                throw new Error(access.reason ?? `mcp:call-tool — tool "${name}" denied for agent "${agentId}"`)
            }

            // Strip _agentId before forwarding to the MCP server — it's metadata, not a tool arg
            const { _agentId, ...cleanArgs } = argsObj

            const result = await mcpClient.callTool(name, cleanArgs)

            // AGV.1: Track mutation count for rate limiting
            if (['flint_ast_mutate', 'flint_fix', 'flint_sync_tokens', 'flint_ingest_figma'].includes(name)) {
                recordMutation(agentId)
            }

            return result
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

    /**
     * mcp:reconnect — Resets the crash counter and re-spawns the MCP server.
     * Safe to call at any time; no-op if no project is open.
     */
    ipcMain.handle('mcp:reconnect', (): void => mcpClient.reconnect())

    // ── Policy Engine IPC Handler ─────────────────────────────────────────────
    //
    // policy:get — Returns the active governance policy for the current project.
    // Reads `.flint/policy.json` from the project root. Returns DEFAULT_POLICY
    // if the file is missing or malformed.
    //
    // This channel lets the renderer (ExportModal, canvasStore) read the policy
    // without importing any Node.js modules — respects the process boundary law.
    ipcMain.handle('policy:get', async (): Promise<unknown> => {
        if (!activeProjectRoot) {
            // Return default policy when no project is open
            const { DEFAULT_POLICY } = await import('../flint-mcp/src/core/config.js')
            return DEFAULT_POLICY
        }
        const { loadPolicy } = await import('../flint-mcp/src/core/config-loader.js')
        return loadPolicy(activeProjectRoot)
    })

    // ── GOV.2: Governance Override Telemetry IPC Handlers ────────────────────
    //
    // These three handlers implement the GOV.2 contract from
    // .flint-context/contracts/gov1-gov2-provenance-telemetry.md.
    //
    // Dependency note: GovernanceEventService is imported from
    // flint-mcp/src/core/governance/eventService.ts, and
    // resolveProvenance / buildComplianceSummary are imported from
    // flint-mcp/src/core/governance/ruleProvenanceRegistry.ts.
    // ruleProvenanceRegistry.ts is being created by the flint-ast-surgeon agent
    // in parallel (Group 1). Dynamic imports are used so this handler compiles
    // and runs even before ruleProvenanceRegistry.ts is present — it will throw
    // at runtime if called before the MCP engine agent delivers the file.
    //
    // The GovernanceEventService instance is created once per app session and
    // reused across all handler invocations. The shared SQLite `db` instance
    // (from store.ts) is passed in so governance events land in the same
    // database as tokens, presence, and component overrides.
    const { GovernanceEventService } = await import('../flint-mcp/src/core/governance/eventService.js')
    const govEventService = new GovernanceEventService(db)

    /**
     * Broadcasts ipcChannel('governance-override-recorded') to all renderer windows.
     * Called after each successful governance:record-override write so StatusBar
     * can re-fetch the override count without polling.
     */
    function broadcastGovernanceOverrideRecorded(): void {
        BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.webContents.send(ipcChannel('governance-override-recorded'))
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
        // flint-ast-surgeon agent (Group 1 of the GOV.1/GOV.2 implementation).
        // This import will throw at runtime if the file does not yet exist —
        // callers (ExportModal) must handle the rejection gracefully.
        const { resolveProvenance, buildComplianceSummary } = await import(
            '../flint-mcp/src/core/governance/ruleProvenanceRegistry.js'
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

    // ── Strategy 7: Deferred Violations IPC Handlers ──────────────────────────
    //
    // deferred_violations table stores violations the user explicitly deferred.
    // Three handlers: defer (upsert), get-all (query unresolved), resolve.
    //
    // The MCP tool flint_defer_violation also writes to .flint/deferred-violations.json
    // so the headless MCP server can read deferrals without SQLite access.

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
        `SELECT id, file_path, rule_id, node_id, reason, duration, session_id, deferred_at, expires_at, resolved_at
         FROM deferred_violations
         WHERE resolved_at IS NULL
         ORDER BY deferred_at DESC`
    )

    const deferViolationResolve = db.prepare<[string, string, string | null, string | null]>(`
        UPDATE deferred_violations
        SET resolved_at = datetime('now')
        WHERE file_path = ? AND rule_id = ? AND (node_id = ? OR (node_id IS NULL AND ? IS NULL)) AND resolved_at IS NULL
    `)

    ipcMain.handle('governance:defer-violation', (
        _event,
        filePath: unknown,
        ruleId: unknown,
        nodeId?: unknown,
        reason?: unknown,
        duration?: unknown,
    ): void => {
        if (typeof filePath !== 'string' || typeof ruleId !== 'string') {
            throw new TypeError('governance:defer-violation — filePath and ruleId must be strings')
        }
        const nId = typeof nodeId === 'string' ? nodeId : null
        const r = typeof reason === 'string' ? reason : null
        const VALID_DURATIONS = new Set(['1 day', '3 days', '1 week', '1 sprint', 'Manually'])
        const dur = (typeof duration === 'string' && VALID_DURATIONS.has(duration)) ? duration as DeferDuration : undefined
        const expiresAt = computeExpiresAt(dur)
        deferViolationUpsert.run(filePath, ruleId, nId, r, dur ?? null, expiresAt, governanceSessionId)
    })

    ipcMain.handle('governance:get-deferred-violations', (): unknown[] => {
        return deferViolationSelectUnresolved.all()
    })

    ipcMain.handle('governance:resolve-deferred-violation', (
        _event,
        filePath: unknown,
        ruleId: unknown,
        nodeId?: unknown,
    ): void => {
        if (typeof filePath !== 'string' || typeof ruleId !== 'string') {
            throw new TypeError('governance:resolve-deferred-violation — filePath and ruleId must be strings')
        }
        const nId = typeof nodeId === 'string' ? nodeId : null
        deferViolationResolve.run(filePath, ruleId, nId, nId)
    })

    // ── governance:preview-fix ────────────────────────────────────────────────
    //
    // COUNSEL.1.4: Calls flint_fix with dry_run:true to preview the proposed
    // fix for a single violation before the user commits to applying it.
    //
    // The MCP tool returns a FixResult whose `fixes` array describes the
    // before/after token substitution. We extract the first fix entry and
    // normalise it to the InlineFixPreview shape expected by GovernanceDashboard.
    //
    // Payload: (ruleId: string, filePath: string)
    // Return:  { current, proposed, tokenName, isColor } | null on any error
    ipcMain.handle(
        'governance:preview-fix',
        async (_event, ruleId: unknown, filePath: unknown): Promise<{
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
                if (!mcpClient.status().connected) return null
                const rawResult = await mcpClient.callTool('flint_fix', {
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
        },
    )

    // ── governance:apply-fix ──────────────────────────────────────────────────
    //
    // Calls flint_fix with dryRun:false to apply all Mithril + A11y fixes to a
    // file and write the result to disk. Used by GovernanceDashboard "Fix all"
    // batch action. Bypasses the renderer MCP allowlist intentionally — the
    // main process owns the write path.
    //
    // Payload: (filePath: string)
    // Return:  { fixesApplied: number; status: string } | null on error
    ipcMain.handle(
        'governance:apply-fix',
        async (_event, filePath: unknown): Promise<{ fixesApplied: number; status: string } | null> => {
            if (typeof filePath !== 'string') return null
            const home = os.homedir()
            if (filePath !== home && !filePath.startsWith(home + path.sep)) return null
            try {
                if (!mcpClient.status().connected) return null
                const rawResult = await mcpClient.callTool('flint_fix', {
                    file: filePath,
                    dryRun: false,
                })
                if (!rawResult.content?.length || !rawResult.content[0].text) return null
                const parsed = JSON.parse(rawResult.content[0].text) as {
                    fixesApplied?: number
                    status?: string
                }
                return {
                    fixesApplied: parsed.fixesApplied ?? 0,
                    status: parsed.status ?? 'unknown',
                }
            } catch {
                return null
            }
        },
    )

    // ── COUNSEL.3.2: governance:get-provenance-summary ─────────────────────────
    //
    // Returns a map of nodeId → { source, agentId?, timestamp } for all
    // mutations on the given file. Used by GovernanceDashboard to render
    // "Introduced by [source]" provenance chips on violation cards.
    //
    // Queries the mutations_ledger table (created by mutationProvenanceService).
    // Guard with try/catch — the table may not exist in all databases.
    ipcMain.handle('governance:get-provenance-summary', (_event, filePath: unknown): Record<string, { source: string; agentId?: string; timestamp: string }> => {
        if (typeof filePath !== 'string') return {}
        try {
            const rows = db.prepare(`
                SELECT node_id, provenance_source, provenance_agent_id, created_at
                FROM mutations_ledger
                WHERE file_path = ?
                ORDER BY created_at DESC
            `).all(filePath) as Array<{
                node_id: string
                provenance_source: string
                provenance_agent_id: string | null
                created_at: string
            }>
            const result: Record<string, { source: string; agentId?: string; timestamp: string }> = {}
            for (const row of rows) {
                // Keep only the most recent mutation per node (rows are DESC by created_at)
                if (result[row.node_id]) continue
                result[row.node_id] = {
                    source: row.provenance_source ?? 'unknown',
                    ...(row.provenance_agent_id ? { agentId: row.provenance_agent_id } : {}),
                    timestamp: row.created_at,
                }
            }
            return result
        } catch {
            // mutations_ledger table may not exist — return empty
            return {}
        }
    })

    // ── COUNSEL.3.3: governance:get-anomalies ────────────────────────────────
    //
    // Returns recent anomalies (last 24 hours) from the anomaly_history table.
    // Used by GovernanceDashboard to render the Flare anomaly alert banner.
    //
    // Guard with try/catch — the table may not exist in all databases.
    ipcMain.handle('governance:get-anomalies', (): Array<{ type: string; severity: string; message: string; detected_at: string }> => {
        try {
            const rows = db.prepare(`
                SELECT type, severity, message, detected_at
                FROM anomaly_history
                WHERE detected_at >= datetime('now', '-24 hours')
                ORDER BY detected_at DESC
                LIMIT 20
            `).all() as Array<{ type: string; severity: string; message: string; detected_at: string }>
            return rows
        } catch {
            // anomaly_history table may not exist — return empty
            return []
        }
    })

    // ── COUNSEL.3.1: governance:get-last-clean-state ────────────────────────
    //
    // Returns the most recent health-history entry with score >= 95, or null.
    // Primary source: .flint/health-history.json. Fallback: governance_events table.
    ipcMain.handle('governance:get-last-clean-state', async (): Promise<{ timestamp: string; score: number } | null> => {
        // Try .flint/health-history.json first
        if (activeProjectRoot) {
            try {
                const histPath = path.join(activeProjectRoot, '.flint', 'health-history.json')
                const raw = await readFile(histPath, 'utf-8')
                const entries = JSON.parse(raw) as Array<{ date: string; score: number; grade: string }>
                for (let i = entries.length - 1; i >= 0; i--) {
                    if (entries[i].score >= 95) {
                        return { timestamp: entries[i].date, score: entries[i].score }
                    }
                }
            } catch {
                // File missing or malformed — fall through to DB fallback
            }
        }
        // Fallback: governance_events table
        try {
            const row = db.prepare(`
                SELECT created_at, json_extract(payload, '$.score') as score
                FROM governance_events
                WHERE json_extract(payload, '$.score') >= 95
                ORDER BY created_at DESC
                LIMIT 1
            `).get() as { created_at: string; score: number } | undefined
            if (row) return { timestamp: row.created_at, score: row.score }
        } catch {
            // governance_events table may not exist
        }
        return null
    })

    // ── COUNSEL.4.1: governance:preview-token-impact ─────────────────────────
    //
    // Counts project files referencing a given token's CSS variable.
    // Returns { affectedFiles, estimatedImpact }.
    ipcMain.handle('governance:preview-token-impact', async (
        _event,
        tokenName: unknown,
        _newValue: unknown,
    ): Promise<{ affectedFiles: number; estimatedImpact: 'low' | 'medium' | 'high' }> => {
        if (typeof tokenName !== 'string') {
            throw new TypeError('governance:preview-token-impact — tokenName must be a string')
        }
        if (!activeProjectRoot) {
            return { affectedFiles: 0, estimatedImpact: 'low' }
        }
        const cssVar = `--${tokenName.replace(/\./g, '-')}`
        let affectedFiles = 0
        try {
            const srcDir = path.join(activeProjectRoot, 'src')
            const scanDir = existsSync(srcDir) ? srcDir : activeProjectRoot
            const files = await collectSourceFilesForImpact(scanDir)
            for (const f of files) {
                try {
                    const content = await readFile(f, 'utf-8')
                    if (content.includes(cssVar) || content.includes(tokenName)) {
                        affectedFiles++
                    }
                } catch { /* skip unreadable files */ }
            }
        } catch { /* scan failed */ }
        const estimatedImpact: 'low' | 'medium' | 'high' =
            affectedFiles <= 2 ? 'low' : affectedFiles <= 5 ? 'medium' : 'high'
        return { affectedFiles, estimatedImpact }
    })

    // Helper: collect .tsx/.ts/.jsx/.js/.css files recursively for token impact scan
    async function collectSourceFilesForImpact(dir: string): Promise<string[]> {
        const results: string[] = []
        const SKIP = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.flint'])
        try {
            const entries = await readdir(dir, { withFileTypes: true })
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

    // ── COUNSEL.4.2: governance:get-health-history + governance:record-health ─
    //
    // Reads/appends .flint/health-history.json for the compliance trajectory chart.
    ipcMain.handle('governance:get-health-history', async (): Promise<Array<{ date: string; score: number; grade: string }>> => {
        if (!activeProjectRoot) return []
        const histPath = path.join(activeProjectRoot, '.flint', 'health-history.json')
        try {
            const raw = await readFile(histPath, 'utf-8')
            return JSON.parse(raw) as Array<{ date: string; score: number; grade: string }>
        } catch {
            return []
        }
    })

    ipcMain.handle('governance:record-health', async (_event, entry: unknown): Promise<void> => {
        if (!activeProjectRoot) return
        if (typeof entry !== 'object' || entry === null) return
        const e = entry as { score?: number; grade?: string }
        if (typeof e.score !== 'number' || typeof e.grade !== 'string') return
        const histPath = path.join(activeProjectRoot, '.flint', 'health-history.json')
        let entries: Array<{ date: string; score: number; grade: string }> = []
        try {
            const raw = await readFile(histPath, 'utf-8')
            entries = JSON.parse(raw) as Array<{ date: string; score: number; grade: string }>
        } catch { /* file does not exist yet */ }
        entries.push({ date: new Date().toISOString(), score: e.score, grade: e.grade })
        if (entries.length > 90) entries = entries.slice(-90)
        try {
            await mkdir(path.join(activeProjectRoot, '.flint'), { recursive: true })
            await fileTransactionManager.write(histPath, JSON.stringify(entries, null, 2))
        } catch { /* best-effort */ }
    })

    // ── S8.3: governance:get-pending-mutations ───────────────────────────────
    //
    // Returns mutations_ledger rows with risk_tier IN ('Amber','Red') and no approval.
    ipcMain.handle('governance:get-pending-mutations', (): Array<{
        id: number; type: string; filePath: string; riskScore: number; riskTier: string; agentId?: string
    }> => {
        try {
            const rows = db.prepare(`
                SELECT id, type, file_path as filePath, risk_score as riskScore,
                       risk_tier as riskTier, agent_id as agentId
                FROM mutations_ledger
                WHERE risk_tier IN ('Amber', 'Red')
                  AND approved_at IS NULL
                ORDER BY risk_score DESC
                LIMIT 50
            `).all() as Array<{
                id: number; type: string; filePath: string; riskScore: number; riskTier: string; agentId?: string
            }>
            return rows
        } catch {
            return []
        }
    })

    ipcMain.handle('governance:approve-mutation', (_event, id: unknown): void => {
        if (typeof id !== 'number') throw new TypeError('governance:approve-mutation — id must be a number')
        try {
            db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now') WHERE id = ?`).run(id)
        } catch { /* table may not exist */ }
    })

    ipcMain.handle('governance:reject-mutation', (_event, id: unknown): void => {
        if (typeof id !== 'number') throw new TypeError('governance:reject-mutation — id must be a number')
        try {
            db.prepare(`DELETE FROM mutations_ledger WHERE id = ?`).run(id)
        } catch { /* table may not exist */ }
    })

    // ── COUNSEL.4.5: Audit Log IPC Handler ───────────────────────────────────
    // Returns the last N governance events for the Audit Log tab in
    // GovernanceDashboard. Queries governance_events ordered by created_at DESC.
    // Gracefully returns [] when the table does not exist (fresh install).

    ipcMain.handle('governance:get-audit-log', (_event, opts: unknown): Array<{
        id: number | string
        timestamp: string
        action: string
        filePath: string
        description: string
    }> => {
        const limit = typeof (opts as Record<string, unknown>)?.limit === 'number'
            ? (opts as Record<string, unknown>).limit as number
            : 50
        try {
            const rows = db.prepare(`
                SELECT
                    id,
                    created_at  AS timestamp,
                    event_type  AS action,
                    COALESCE(file_path, '')   AS filePath,
                    COALESCE(description, event_type) AS description
                FROM governance_events
                ORDER BY created_at DESC
                LIMIT ?
            `).all(limit) as Array<{
                id: number | string
                timestamp: string
                action: string
                filePath: string
                description: string
            }>
            return rows
        } catch {
            // governance_events table may not exist on first launch
            return []
        }
    })

    // ── Delta Mode: Baseline IPC Handlers ────────────────────────────────────
    //
    // violation_baselines table lives in the shared flint.db (store.ts).
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
        console.log(`${BRAND.logPrefix} baseline:set — ${rows.length} violations baselined`)
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
        console.log(`${BRAND.logPrefix} baseline:clear — ${result.changes} rows removed`)
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
     *      with the token class in the element identified by data-flint-id.
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
     *   C7  — data-flint-id is never mutated.
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

        // ── 2. Resolve active file path from context.json ─────────────────��───
        const flintDir = activeProjectRoot
            ? path.join(activeProjectRoot, BRAND.configDir)
            : path.join(app.getPath('home'), BRAND.configDir)
        const contextPath = path.join(flintDir, 'context.json')

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
            windows[0].webContents.send(ipcChannel('file-updated'), {
                filePath: resolvedFile,
                code: snapResult.code,
            })
        }

        console.log(
            `${BRAND.logPrefix} import:snap-to-token — node=${p.nodeId} ` +
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
            console.warn(`${BRAND.logPrefix} import:undo-all-heals — no pre-heal code stored`)
            return { ok: false }
        }
        // Broadcast the server-stored pre-heal code to the renderer
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
            windows[0].webContents.send(ipcChannel('hydro-paste-auto'), code)
        }
        // Clear after use to prevent stale restores
        preHealCodeStore.delete('latest')
        console.log(`${BRAND.logPrefix} import:undo-all-heals — pre-heal code restored from server store`)
        return { ok: true }
    })

    // ── Phase ACX.5: Context Sync Pipeline ───────────────────────────────────
    //
    // context:sync   — Receives a FlintContext snapshot from useContextSync
    //                  and atomically writes it to .flint/context.json so the
    //                  headless MCP server can read it via flint_get_context.
    //
    // context:get-enriched — Reads context.json, then enriches it with live
    //                        SQLite metrics (token count, override count) and
    //                        returns the combined EnrichedContext object.
    //
    // Security: context.json is written to the active project's .flint/
    // subdirectory. When no project is open we fall back to the user's home
    // directory. No path traversal is possible because we construct the path
    // ourselves rather than accepting it from the renderer.

    ipcMain.handle('context:sync', async (_event, context: unknown): Promise<void> => {
        if (typeof context !== 'object' || context === null) {
            throw new TypeError('context:sync — payload must be a non-null object')
        }

        // Determine the target directory. Prefer the active project root so
        // context.json lands in <projectRoot>/.flint/context.json. Fall back to
        // ~/.flint/context.json when no project has been opened yet.
        const flintDir = activeProjectRoot
            ? path.join(activeProjectRoot, BRAND.configDir)
            : path.join(app.getPath('home'), BRAND.configDir)

        try {
            await mkdir(flintDir, { recursive: true })
        } catch {
            // Directory already exists — not an error.
        }

        const contextPath = path.join(flintDir, 'context.json')
        const json = JSON.stringify(context, null, 2)

        // Route through FileTransactionManager for Commandment 12 + 14 compliance.
        await fileTransactionManager.write(contextPath, json)
    })

    // Read helpers for context:get-enriched — prepared once, reused per call.
    const stmtTokenCount = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM design_tokens')
    const stmtOverrideCount = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM component_overrides')

    ipcMain.handle('context:get-enriched', async (): Promise<unknown> => {
        const flintDir = activeProjectRoot
            ? path.join(activeProjectRoot, BRAND.configDir)
            : path.join(app.getPath('home'), BRAND.configDir)

        const contextPath = path.join(flintDir, 'context.json')

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

    // ── ONBOARD.1: Setup Wizard IPC ───────────────────────────────────────────

    /**
     * Strips single-line (//) and multi-line (/* *\/) comments from a JSONC
     * string, returning plain JSON safe to pass to JSON.parse().
     * Uses a character-by-character scan so that comment markers inside
     * string literals are never treated as comments.
     * No external dependency — pure string manipulation only.
     */
    function stripJsoncComments(jsonc: string): string {
        let result = ''
        let inString = false
        let i = 0
        while (i < jsonc.length) {
            const ch = jsonc[i]
            const next = jsonc[i + 1]
            if (ch === '"' && (i === 0 || jsonc[i - 1] !== '\\')) {
                inString = !inString
                result += ch
                i++
            } else if (!inString && ch === '/' && next === '/') {
                // Skip to end of line
                while (i < jsonc.length && jsonc[i] !== '\n') i++
            } else if (!inString && ch === '/' && next === '*') {
                // Skip to end of block comment
                i += 2
                while (i < jsonc.length && !(jsonc[i] === '*' && jsonc[i + 1] === '/')) i++
                i += 2
            } else {
                result += ch
                i++
            }
        }
        return result
    }

    /**
     * Resolves the absolute path to flint-mcp/dist/server.js.
     * In packaged builds: resources/flint-mcp/dist/server.js
     * In development:     <repo-root>/flint-mcp/dist/server.js
     */
    function getMCPServerPath(): string {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'flint-mcp', 'dist', 'server.js')
        }
        return path.resolve(__dirname, '..', 'flint-mcp', 'dist', 'server.js')
    }

    /**
     * setup:detect-ides
     * Checks for installed IDEs by probing known settings file paths.
     * Detection file  ≠  config file for Claude Code (see contract §13).
     * Returns the IDE list plus the resolved MCP server path so the renderer
     * can build the snippet in one round-trip.
     */
    ipcMain.handle('setup:detect-ides', () => {
        const home = os.homedir()

        const IDE_CANDIDATES: Array<{
            name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
            detectionPath: string
            settingsPath: string
        }> = [
            {
                name: 'Claude Code',
                // Dual-file detection: older installs have settings.json;
                // MCP-first / fresh installs may only have mcp.json.
                // detectionPath is unused for Claude Code — see the map() below.
                detectionPath: path.join(home, '.claude', 'settings.json'),
                // Config: mcp.json is the authoritative MCP registration target.
                // Prefer mcp.json if present, fall back to settings.json.
                settingsPath: existsSync(path.join(home, '.claude', 'mcp.json'))
                    ? path.join(home, '.claude', 'mcp.json')
                    : path.join(home, '.claude', 'settings.json'),
            },
            {
                // Antigravity is a VS Code fork. Its MCP config lives at
                // ~/.gemini/antigravity/mcp_config.json and uses the VS Code
                // `mcp.servers` format (not the Claude Code `mcpServers` format).
                name: 'Antigravity',
                detectionPath: path.join(home, 'Library', 'Application Support', 'Antigravity', 'User', 'settings.json'),
                settingsPath: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
            },
            {
                name: 'Cursor',
                detectionPath: path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'),
                settingsPath: path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'),
            },
            {
                name: 'VS Code',
                detectionPath: path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
                settingsPath: path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
            },
        ]

        const claudeSettingsPath = path.join(home, '.claude', 'settings.json')
        const claudeMcpPath = path.join(home, '.claude', 'mcp.json')

        const ides = IDE_CANDIDATES.map(({ name, detectionPath, settingsPath }) => ({
            name,
            settingsPath,
            // Claude Code: detect via settings.json (older) OR mcp.json (MCP-first)
            detected:
                name === 'Claude Code'
                    ? existsSync(claudeSettingsPath) || existsSync(claudeMcpPath)
                    : existsSync(detectionPath),
        }))

        return { ides, mcpServerPath: getMCPServerPath() }
    })

    /**
     * setup:check-first-launch
     * Reads ~/.flint/setup.json.
     * Returns { isFirstLaunch: true } when the file is absent or unparseable,
     * { isFirstLaunch: false } when firstLaunchComplete === true.
     */
    ipcMain.handle('setup:check-first-launch', () => {
        const setupPath = path.join(os.homedir(), BRAND.configDir, 'setup.json')
        try {
            const raw = readFileSync(setupPath, 'utf-8')
            const parsed = JSON.parse(raw) as { firstLaunchComplete?: boolean }
            if (parsed.firstLaunchComplete === true) {
                return { isFirstLaunch: false }
            }
            return { isFirstLaunch: true }
        } catch {
            // File missing or JSON parse failure — treat as first launch
            return { isFirstLaunch: true }
        }
    })

    /**
     * setup:complete-first-launch
     * Writes { firstLaunchComplete: true, completedAt: <unix ms> } to
     * ~/.flint/setup.json. Creates the ~/.flint/ directory if needed.
     * Uses writeFileSync directly — this is a config flag, not source code
     * (Commandment 12 exemption; consistent with ai:save-config pattern).
     */
    ipcMain.handle('setup:complete-first-launch', () => {
        const flintDir = path.join(os.homedir(), BRAND.configDir)
        mkdirSync(flintDir, { recursive: true })
        const setupPath = path.join(flintDir, 'setup.json')
        writeFileSync(
            setupPath,
            JSON.stringify({ firstLaunchComplete: true, completedAt: Date.now() }, null, 2),
            'utf-8',
        )
    })

    /**
     * app:reset-state
     * Deletes ~/.flint/setup.json so the next launch shows the full onboarding
     * flow from the beginning. The renderer clears localStorage and reloads
     * itself after this call returns.
     */
    ipcMain.handle('app:reset-state', () => {
        const setupPath = path.join(os.homedir(), BRAND.configDir, 'setup.json')
        try {
            if (existsSync(setupPath)) rmSync(setupPath)
        } catch (err) {
            console.error(`${BRAND.logPrefix} app:reset-state — could not delete setup.json:`, err)
        }
    })

    /**
     * setup:write-mcp-config
     * Automatically writes the MCP server entry into the IDE's config file.
     * Merges with existing config — never clobbers other entries.
     *
     * ideName: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
     * configPath: the IDE-specific path resolved by setup:detect-ides
     * mcpServerPath: absolute path to flint-mcp/dist/server.js
     *
     * Returns { written: true } on success or throws on failure.
     */
    ipcMain.handle(
        'setup:write-mcp-config',
        (_event, ideName: string, configPath: string, mcpServerPath: string) => {
            // Path validation: configPath must be absolute and within user home directory
            const home = os.homedir()
            if (!path.isAbsolute(configPath) || !configPath.startsWith(home + path.sep)) {
                throw new Error('setup:write-mcp-config — configPath must be within user home directory')
            }
            // Ensure parent directory exists
            mkdirSync(path.dirname(configPath), { recursive: true })

            // Read existing config if present.
            // stripJsoncComments() is called before JSON.parse() because VS Code
            // and Cursor settings files are JSONC — they commonly contain // and
            // /* */ comments that cause a plain JSON.parse() to throw.
            let existing: Record<string, unknown> = {}
            try {
                existing = JSON.parse(
                    stripJsoncComments(readFileSync(configPath, 'utf-8')),
                ) as Record<string, unknown>
            } catch {
                // File absent or unparseable — start fresh
            }

            // VS Code and Antigravity use { mcp: { servers: { flint: ... } } }
            // Claude Code and Cursor use { mcpServers: { flint: ... } }
            if (ideName === 'VS Code' || ideName === 'Antigravity') {
                const flintEntry = { type: 'stdio', command: 'node', args: [mcpServerPath] }
                const mcp = (existing.mcp ?? {}) as Record<string, unknown>
                const servers = (mcp.servers ?? {}) as Record<string, unknown>
                servers.flint = flintEntry
                mcp.servers = servers
                existing.mcp = mcp
            } else {
                const flintEntry = { command: 'node', args: [mcpServerPath] }
                const mcpServers = (existing.mcpServers ?? {}) as Record<string, unknown>
                mcpServers.flint = flintEntry
                existing.mcpServers = mcpServers
            }

            writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8')
            return { written: true }
        },
    )

    // ── Phase REM.2.1: Governance Autopilot ──────────────────────────────────
    //
    // When enabled, watches the active source file for changes and runs a
    // flint_fix dry-run after a 500 ms debounce. The governed (post-fix)
    // source is broadcast to all renderer windows via ipcChannel('autopilot-result')
    // so the renderer can display the live governance diff without writing to disk.
    //
    // Lifecycle:
    //   autopilot:enable  — (re)starts the watcher + runs an immediate audit.
    //   autopilot:disable — tears down the watcher; idempotent.
    //
    // Design notes:
    //   - One watcher at a time. Calling enable() while active replaces the
    //     previous watcher (disable first, then start new).
    //   - File is watched at the directory level (same pattern as annotations
    //     and mcp-events watchers above) to survive atomic tmp→rename writes.
    //   - The MCP client is used so flint_fix logic stays in flint-mcp with
    //     no source duplication. Falls back gracefully when disconnected.

    let autopilotPollInterval: ReturnType<typeof setInterval> | null = null
    let autopilotLastMtime = 0
    let autopilotDebounceTimer: ReturnType<typeof setTimeout> | null = null
    const AUTOPILOT_DEBOUNCE_MS = 500

    /**
     * Broadcasts an AutopilotResult to all live renderer windows.
     */
    function broadcastAutopilotResult(result: {
        filePath: string
        governedSource: string
        fixableCount: number
        mithrilCount: number
        a11yCount: number
        timestamp: number
    }): void {
        BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) {
                w.webContents.send(ipcChannel('autopilot-result'), result)
            }
        })
    }

    /**
     * Reads the file at `filePath`, calls flint_fix via the MCP client with
     * dry_run: true, and broadcasts the result. Non-fatal — logs and returns
     * on any error so a transient I/O or MCP failure does not crash the app.
     */
    async function runAutopilotAudit(filePath: string): Promise<void> {
        try {
            if (!existsSync(filePath)) return
            const source = readFileSync(filePath, 'utf-8')

            // Call flint_fix via the MCP client (dry_run: true so no disk writes).
            // The MCP client is the established pattern for calling flint-mcp tools
            // from the main process without importing the MCP engine directly.
            const status = mcpClient.status()
            if (!status.connected) {
                // MCP server not yet connected — emit a passthrough result so the
                // renderer sees something (fixableCount 0, original source).
                broadcastAutopilotResult({
                    filePath,
                    governedSource: source,
                    fixableCount: 0,
                    mithrilCount: 0,
                    a11yCount: 0,
                    timestamp: Date.now(),
                })
                return
            }

            const rawResult = await mcpClient.callTool('flint_fix', {
                file: filePath,
                dry_run: true,
            })

            // flint_fix returns its structured data in the content[0].text field
            // as a JSON string (standard MCP tool response shape).
            let fixedSource = source
            let fixableCount = 0
            let mithrilCount = 0
            let a11yCount = 0

            if (rawResult.content.length > 0 && rawResult.content[0].text) {
                try {
                    const parsed = JSON.parse(rawResult.content[0].text) as {
                        fixedSource?: string
                        fixesApplied?: number
                        mithrilViolations?: number
                        a11yViolations?: number
                    }
                    fixedSource = parsed.fixedSource ?? source
                    fixableCount = parsed.fixesApplied ?? 0
                    mithrilCount = parsed.mithrilViolations ?? 0
                    a11yCount = parsed.a11yViolations ?? 0
                } catch {
                    // If the text is not JSON (e.g. a human-readable message), fall back
                    // to the original source with 0 fixes — not fatal.
                }
            }

            broadcastAutopilotResult({
                filePath,
                governedSource: fixedSource,
                fixableCount,
                mithrilCount,
                a11yCount,
                timestamp: Date.now(),
            })
        } catch (err) {
            console.error(`${logTag('Autopilot')} Audit failed for %s:`, filePath, err)
        }
    }

    // ── autopilot:enable ─────────────────────────────────────────────────────
    // Validates the filePath (must be inside the user's home directory), tears
    // down any existing watcher, starts a new fsWatch on the file's parent
    // directory, and fires an immediate audit.
    ipcMain.handle('autopilot:enable', async (_event, filePath: unknown): Promise<void> => {
        if (typeof filePath !== 'string' || filePath.length === 0) {
            throw new TypeError('autopilot:enable — filePath must be a non-empty string')
        }

        const resolvedPath = path.resolve(filePath)
        const homeDir = app.getPath('home')
        if (resolvedPath !== homeDir && !resolvedPath.startsWith(homeDir + path.sep)) {
            throw new Error(
                `autopilot:enable — filePath must be inside the home directory (got: ${resolvedPath})`
            )
        }

        // Tear down any existing poll before starting a new one.
        if (autopilotPollInterval) {
            clearInterval(autopilotPollInterval)
            autopilotPollInterval = null
        }
        if (autopilotDebounceTimer) {
            clearTimeout(autopilotDebounceTimer)
            autopilotDebounceTimer = null
        }
        autopilotLastMtime = 0

        // Poll every 500 ms for mtime changes — avoids fsevents crashes on macOS 26.
        autopilotPollInterval = setInterval(async () => {
            try {
                const { mtimeMs } = await fsStat(resolvedPath)
                if (mtimeMs > autopilotLastMtime) {
                    autopilotLastMtime = mtimeMs
                    if (autopilotDebounceTimer) clearTimeout(autopilotDebounceTimer)
                    autopilotDebounceTimer = setTimeout(() => {
                        autopilotDebounceTimer = null
                        void runAutopilotAudit(resolvedPath)
                    }, AUTOPILOT_DEBOUNCE_MS)
                }
            } catch { /* file removed or inaccessible */ }
        }, 500)

        // Run an immediate audit so the renderer gets an initial result without
        // waiting for the first file change.
        void runAutopilotAudit(resolvedPath)
    })

    // ── autopilot:disable ────────────────────────────────────────────────────
    // Stops the file poll and cancels any pending debounce. Idempotent.
    ipcMain.handle('autopilot:disable', async (): Promise<void> => {
        if (autopilotPollInterval) {
            clearInterval(autopilotPollInterval)
            autopilotPollInterval = null
        }
        autopilotLastMtime = 0
        if (autopilotDebounceTimer) {
            clearTimeout(autopilotDebounceTimer)
            autopilotDebounceTimer = null
        }
        console.log(`${logTag('Autopilot')} Disabled`)
    })

    // Ensure the poll is cleaned up on app exit.
    app.on('will-quit', () => {
        if (autopilotPollInterval) clearInterval(autopilotPollInterval)
        if (autopilotDebounceTimer) clearTimeout(autopilotDebounceTimer)
    })

    createWindow()
    buildAppMenu()

    // ── Starter template for scratchpad index.html ──────────────────────
    // Written to new scratchpads so the LivePreview shows a polished landing
    // page instead of an empty white iframe. Every element carries a
    // data-flint-id so Flint's interaction layer can select/hover it.
    // 100% inline — no external deps (Commandment 4).
    const SCRATCHPAD_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Untitled — ${BRAND.product}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --surface: #0f0f11;
      --surface-raised: #18181b;
      --surface-overlay: #1e1e22;
      --border: #2a2a2e;
      --border-subtle: #232327;
      --text-primary: #f0f0f2;
      --text-secondary: #9b9ba4;
      --text-tertiary: #65656d;
      --accent: #6d5cff;
      --accent-hover: #7d6eff;
      --accent-subtle: rgba(109, 92, 255, 0.12);
      --success: #34d399;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 20px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--surface);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Hero ─────────────────────────────────── */
    .hero {
      text-align: center;
      max-width: 520px;
      margin-bottom: 48px;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--accent-subtle);
      border: 1px solid rgba(109, 92, 255, 0.2);
      border-radius: 999px;
      margin-bottom: 24px;
    }

    .hero-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
    }

    .hero h1 {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.2;
      margin-bottom: 12px;
    }

    .hero p {
      font-size: 16px;
      color: var(--text-secondary);
      max-width: 400px;
      margin: 0 auto;
    }

    /* ── Card grid ────────────────────────────── */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      max-width: 520px;
      width: 100%;
      margin-bottom: 40px;
    }

    .card {
      background: var(--surface-raised);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 24px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .card:hover {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent), 0 4px 24px rgba(109, 92, 255, 0.08);
    }

    .card-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-overlay);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      font-size: 18px;
      margin-bottom: 14px;
    }

    .card h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .card p {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    /* ── Button group ─────────────────────────── */
    .button-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      padding: 0 20px;
      font-size: 14px;
      font-weight: 500;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
      font-family: inherit;
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn-primary {
      background: var(--accent);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      color: var(--text-primary);
      border-color: var(--text-tertiary);
      background: var(--surface-raised);
    }

    /* ── Footer hint ──────────────────────────── */
    .footer-hint {
      margin-top: 24px;
      font-size: 12px;
      color: var(--text-tertiary);
      text-align: center;
    }

    .kbd {
      display: inline-block;
      padding: 2px 6px;
      font-size: 11px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      background: var(--surface-overlay);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <section class="hero" data-flint-id="hero-section" style="text-align: center; max-width: 520px; margin-bottom: 48px">
    <span class="hero-badge" data-flint-id="hero-badge" style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: #6d5cff; background: rgba(109,92,255,0.12); border-radius: 999px; padding: 5px 14px">Scratchpad</span>
    <h1 data-flint-id="hero-heading" style="font-size: 36px; font-weight: 700; line-height: 1.2; letter-spacing: -0.025em; color: #f0f0f2">Start building</h1>
    <p data-flint-id="hero-description" style="font-size: 16px; color: #9b9ba4; line-height: 1.6">This is your design scratchpad. Edit this file in your IDE and see changes live, or ask your AI assistant to build something.</p>
  </section>

  <div class="card-grid" data-flint-id="card-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 520px">
    <div class="card" data-flint-id="card-governance" style="background: #18181b; border: 1px solid #2a2a2e; border-radius: 12px; padding: 24px">
      <div class="card-icon" data-flint-id="icon-governance" style="font-size: 18px; background: #1e1e22; border-radius: 8px; width: 36px; height: 36px">\u{1F6E1}</div>
      <h3 style="font-size: 14px; font-weight: 600">Governance</h3>
      <p style="font-size: 13px; color: #9b9ba4">Token compliance, accessibility, and brand safety enforced at the AST level.</p>
    </div>
    <div class="card" data-flint-id="card-preview" style="background: #18181b; border: 1px solid #2a2a2e; border-radius: 12px; padding: 24px">
      <div class="card-icon" data-flint-id="icon-preview" style="font-size: 18px; background: #1e1e22; border-radius: 8px; width: 36px; height: 36px">\u{1F441}</div>
      <h3 style="font-size: 14px; font-weight: 600">Live Preview</h3>
      <p style="font-size: 13px; color: #9b9ba4">See every change instantly. No build step, no refresh needed.</p>
    </div>
    <div class="card" data-flint-id="card-a11y" style="background: #18181b; border: 1px solid #2a2a2e; border-radius: 12px; padding: 24px">
      <div class="card-icon" data-flint-id="icon-a11y" style="font-size: 18px; background: #1e1e22; border-radius: 8px; width: 36px; height: 36px">\u{2714}</div>
      <h3 style="font-size: 14px; font-weight: 600">Accessibility</h3>
      <p style="font-size: 13px; color: #9b9ba4">50 WCAG 2.1 AA rules checked automatically before export.</p>
    </div>
    <div class="card" data-flint-id="card-tokens" style="background: #18181b; border: 1px solid #2a2a2e; border-radius: 12px; padding: 24px">
      <div class="card-icon" data-flint-id="icon-tokens" style="font-size: 18px; background: #1e1e22; border-radius: 8px; width: 36px; height: 36px">\u{1F3A8}</div>
      <h3 style="font-size: 14px; font-weight: 600">Design Tokens</h3>
      <p style="font-size: 13px; color: #9b9ba4">Every color, spacing, and type value tied to your design system.</p>
    </div>
  </div>

  <div class="button-group" data-flint-id="button-group" style="display: flex; gap: 12px">
    <button class="btn btn-primary" data-flint-id="btn-start" style="font-size: 14px; font-weight: 500; background: #6d5cff; color: #fff; border-radius: 8px; padding: 0 20px; height: 40px; border: none">Get Started</button>
    <button class="btn btn-secondary" data-flint-id="btn-docs" style="font-size: 14px; font-weight: 500; background: transparent; color: #9b9ba4; border: 1px solid #2a2a2e; border-radius: 8px; padding: 0 20px; height: 40px">Documentation</button>
  </div>

  <p class="footer-hint" data-flint-id="footer-hint" style="font-size: 12px; color: #65656d; margin-top: 24px">
    Open this project in your IDE to start editing &middot; <kbd class="kbd">Cmd+K</kbd> for commands
  </p>
</body>
</html>
`

    // ── Auto-scratchpad: ensure MCP server is always running ─────────────
    // On first launch (or when no project was previously open), reuse an
    // existing scratchpad or create one. This ensures the MCP server starts
    // immediately so StatusBar, Figma, and governance tools work from the
    // first second — no "open a project first" roadblock.
    //
    // LAUNCH.2 fix: reuse the first existing Untitled-N scratchpad instead
    // of creating a new one every launch (which previously accumulated
    // hundreds of empty folders).
    if (!activeProjectRoot) {
        const flintProjectsDir = path.join(app.getPath('home'), `${BRAND.product} Projects`)
        mkdirSync(flintProjectsDir, { recursive: true })

        // Try to reuse an existing scratchpad
        let targetPath: string | null = null
        try {
            const entries = readdirSync(flintProjectsDir)
            const existing = entries
                .filter(e => e === 'Untitled' || /^Untitled-\d+$/.test(e))
                .sort((a, b) => {
                    const numA = a === 'Untitled' ? 0 : parseInt(a.split('-')[1], 10)
                    const numB = b === 'Untitled' ? 0 : parseInt(b.split('-')[1], 10)
                    return numB - numA // most recent first
                })
            if (existing.length > 0) {
                targetPath = path.join(flintProjectsDir, existing[0])
                console.log(`${BRAND.logPrefix} Reusing existing scratchpad: ${targetPath}`)
            }
        } catch { /* empty dir is fine */ }

        // Create a new scratchpad only if none exist
        if (!targetPath) {
            targetPath = path.join(flintProjectsDir, 'Untitled')
            mkdirSync(targetPath, { recursive: true })
            mkdirSync(path.join(targetPath, BRAND.configDir), { recursive: true })
            writeFileSync(
                path.join(targetPath, BRAND.configDir, 'design-tokens.json'),
                '[]',
                'utf-8',
            )
            writeFileSync(
                path.join(targetPath, 'index.html'),
                SCRATCHPAD_INDEX_HTML,
                'utf-8',
            )
            console.log(`${BRAND.logPrefix} Auto-scratchpad created at ${targetPath}`)
        }

        // Ensure .flint/ dir exists (may be missing on reused scratchpads)
        const flintDir = path.join(targetPath, BRAND.configDir)
        if (!existsSync(flintDir)) {
            mkdirSync(flintDir, { recursive: true })
            writeFileSync(
                path.join(flintDir, 'design-tokens.json'),
                '[]',
                'utf-8',
            )
        }

        // Ensure index.html exists (may be missing on reused scratchpads
        // created before the starter template was introduced)
        const indexPath = path.join(targetPath, 'index.html')
        if (!existsSync(indexPath)) {
            writeFileSync(indexPath, SCRATCHPAD_INDEX_HTML, 'utf-8')
            console.log(`${BRAND.logPrefix} Wrote starter index.html to ${targetPath}`)
        }

        activeProjectRoot = targetPath
        void mcpClient.start(targetPath).catch((err) => {
            console.error(`${BRAND.logPrefix} mcpClient.start failed for auto-scratchpad:`, err)
        })
        // File watcher: restart scan for auto-scratchpad project root
        void (globalThis as Record<string, unknown>)['__flintStartFileWatcher']?.()
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

// ── Beta Distribution IPC ────────────────────────────────────────────────────

ipcMain.handle('beta:get-info', () => getBetaInfo())

ipcMain.handle('beta:submit-feedback', async (_event, feedback: unknown) => {
    if (
        typeof feedback !== 'object' || feedback === null ||
        typeof (feedback as Record<string, unknown>).category !== 'string' ||
        typeof (feedback as Record<string, unknown>).description !== 'string' ||
        typeof (feedback as Record<string, unknown>).severity !== 'string'
    ) {
        throw new Error('beta:submit-feedback — invalid payload shape')
    }

    const fb = feedback as {
        category: string
        description: string
        severity: string
        context?: string
        screenshot?: string | null
        system?: {
            os: string
            osVersion: string
            screenWidth: number
            screenHeight: number
            devicePixelRatio: number
        }
    }

    // Validate enum values (defense-in-depth)
    const ALLOWED_CATEGORIES = new Set(['bug', 'feature', 'usability', 'other'])
    const ALLOWED_SEVERITIES = new Set(['cosmetic', 'annoying', 'blocker'])
    if (!ALLOWED_CATEGORIES.has(fb.category) || !ALLOWED_SEVERITIES.has(fb.severity)) {
        throw new Error('beta:submit-feedback — invalid category or severity')
    }

    // Truncate description to prevent unbounded file growth
    const MAX_DESCRIPTION_LEN = 10_000
    if (fb.description.length > MAX_DESCRIPTION_LEN) {
        fb.description = fb.description.slice(0, MAX_DESCRIPTION_LEN)
    }

    const entry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        buildId: getBetaInfo().buildId,
        appVersion: app.getVersion(),
        platform: `${process.platform}-${process.arch}`,
        ...fb,
    }

    // Save to ~/.flint/beta-feedback.json (always, works offline)
    const flintDir = path.join(os.homedir(), BRAND.configDir)
    const feedbackPath = path.join(flintDir, 'beta-feedback.json')

    try {
        if (!existsSync(flintDir)) mkdirSync(flintDir, { recursive: true })

        let existing: unknown[] = []
        if (existsSync(feedbackPath)) {
            try {
                const raw = readFileSync(feedbackPath, 'utf-8')
                existing = JSON.parse(raw)
                if (!Array.isArray(existing)) existing = []
            } catch {
                existing = []
            }
        }

        existing.push(entry)
        writeFileSync(feedbackPath, JSON.stringify(existing, null, 2))

        // Optional GitHub Issue submission (best-effort, never blocks local save).
        // Only active when FLINT_FEEDBACK_GITHUB_TOKEN is set at build/runtime.
        // Respects Commandment 4 (Local-First): local save is the primary path.
        const ghToken = process.env.FLINT_FEEDBACK_GITHUB_TOKEN
        if (ghToken) {
            try {
                const issueBody = [
                    `**Category:** ${fb.category}`,
                    `**Severity:** ${fb.severity}`,
                    `**Build:** ${getBetaInfo().buildId}`,
                    `**Platform:** ${process.platform}-${process.arch}`,
                    fb.system ? `**Screen:** ${fb.system.screenWidth}x${fb.system.screenHeight} @${fb.system.devicePixelRatio}x` : null,
                    '',
                    fb.description,
                ].filter(Boolean).join('\n')

                const issuePayload = JSON.stringify({
                    title: `[Beta Feedback] ${fb.category} / ${fb.severity}: ${fb.description.slice(0, 60)}`,
                    body: issueBody,
                    labels: ['beta-feedback', fb.severity],
                })

                await net.fetch('https://api.github.com/repos/Jtiem/lunar-elevator-flint/issues', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${ghToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json',
                    },
                    body: issuePayload,
                })
            } catch {
                // GitHub submission failed. Local save already succeeded. Silent.
            }
        }

        return { saved: true }
    } catch (err) {
        console.error(`${logTag('Beta')} Failed to save feedback:`, err)
        return { saved: false }
    }
})

// ── BETA.4: Screenshot capture ────────────────────────────────────────────────
//
// Uses BrowserWindow.capturePage() to take a PNG screenshot.
// Resized to max 1200px wide to keep file size reasonable.
// User-initiated only — never called automatically.

ipcMain.handle('beta:capture-screenshot', async () => {
    try {
        const win = BrowserWindow.getFocusedWindow()
        if (!win) return null
        const image = await win.capturePage()
        const { width } = image.getSize()
        const resized = width > 1200 ? image.resize({ width: 1200 }) : image
        return resized.toPNG().toString('base64')
    } catch (err) {
        console.warn(`${logTag('Beta')} Screenshot capture failed:`, err)
        return null
    }
})

// ── Phase CV2.3: Component Cards IPC ──────────────────────────────────────────
//
// Three handlers back componentCardStore.loadCards() and savePositions().
// Reads go through the existing activeProjectRoot variable.
// Writes use atomic tmp→rename (Commandment 12 — Atomic Queuing).
// No renderer-side Node.js APIs (Process Boundary Law — Commandment 4).
//
// Category derivation rules (from file path convention):
//   /primitives/ or /atoms/      → 'primitive'
//   /molecules/                  → 'molecule'
//   /organisms/ or /templates/   → 'organism'
//   /pages/                      → 'page'
//   /layouts/                    → 'layout'
//   anything else                → 'uncategorized'

/** Derives a ComponentCategory from an absolute file path. */
function deriveComponentCategory(
    filePath: string
): 'primitive' | 'molecule' | 'organism' | 'page' | 'layout' | 'uncategorized' {
    const n = filePath.replace(/\\/g, '/')
    if (/\/primitives\//.test(n) || /\/atoms\//.test(n)) return 'primitive'
    if (/\/molecules\//.test(n)) return 'molecule'
    if (/\/organisms\//.test(n) || /\/templates\//.test(n)) return 'organism'
    if (/\/pages\//.test(n)) return 'page'
    if (/\/layouts\//.test(n)) return 'layout'
    return 'uncategorized'
}

// ── CV2.6: Category Override Helpers ─────────────────────────────────────────
//
// These are defined before `components:list` so the list handler can call them.
// The IPC handler `components:set-category` also uses them.

/** All valid ComponentCategory values. Used for input validation. */
const VALID_CATEGORIES = new Set([
    'primitive', 'molecule', 'organism', 'page', 'layout', 'uncategorized',
])

/** Reads .flint/category-overrides.json. Returns {} on any read/parse failure. */
async function readCategoryOverrides(base: string): Promise<Record<string, string>> {
    const overridesPath = path.join(base, BRAND.configDir, 'category-overrides.json')
    try {
        const raw = await readFile(overridesPath, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, string>
        }
        return {}
    } catch {
        return {}
    }
}

/** Produces a deterministic 8-char hex ID from component name + importPath (djb2). */
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

// ── CV2.4: Per-Component Health Assessment ────────────────────────────────────
// Logic lives in componentHealth.ts so tests can import it without pulling in
// the full main.ts (which calls app.disableHardwareAcceleration() at load time).
import {
    enrichComponentHealth,
    type ComponentHealth,
    type AuditAllFn,
    type A11yAuditFn,
} from './componentHealth.js'

ipcMain.handle('components:list', async (): Promise<unknown[]> => {
    // 1. Locate flint-manifest.json — same search order as HydroPaste.
    const searchPaths: string[] = [
        activeProjectRoot ? path.join(activeProjectRoot, BRAND.manifestFile) : null,
        path.join(app.getPath('home'), BRAND.manifestFile),
        path.join(process.cwd(), BRAND.manifestFile),
    ].filter((p): p is string => p !== null)

    let manifest: Record<string, unknown> = { components: {} }
    for (const candidate of searchPaths) {
        try {
            const raw = await readFile(candidate, 'utf-8')
            manifest = JSON.parse(raw) as Record<string, unknown>
            break
        } catch {
            /* try next path */
        }
    }

    // 2. Extract components and enrich each entry.
    const components = (manifest.components ?? {}) as Record<string, unknown>
    const thumbnailBase = activeProjectRoot
        ? path.join(activeProjectRoot, BRAND.configDir, 'thumbnails')
        : null

    const categoryOrder: Record<string, number> = {
        primitive: 0, molecule: 1, organism: 2, page: 3, layout: 4, uncategorized: 5,
    }

    // ── CV2.4: Load linters once before the per-component loop ────────────────
    // Dynamic imports wrapped in try/catch so a missing flint-mcp package
    // degrades gracefully — all components get `health: null` in that case.
    let auditAllFn: AuditAllFn | null = null
    let a11yAuditFn: A11yAuditFn | null = null
    let designTokens: Array<{ token_path: string; token_type: string; token_value: string }> = []

    try {
        const mithrilMod = await import('../flint-mcp/src/core/MithrilLinter.js')
        const a11yMod = await import('../flint-mcp/src/core/A11yLinter.js')
        auditAllFn = mithrilMod.auditAll as AuditAllFn
        a11yAuditFn = (ast: import('@babel/types').File) =>
            (a11yMod.A11yLinter as { audit: A11yAuditFn }).audit(ast)

        // Load design tokens from SQLite.
        // This handler is registered at module level so `db` is not directly in
        // scope — use the same dynamic import pattern as the rest of main.ts.
        try {
            const { default: storeDb } = await import('./store.js')
            const rows = storeDb.prepare(
                'SELECT token_path, token_type, token_value FROM design_tokens ORDER BY token_type, token_path',
            ).all() as Array<{ token_path: string; token_type: string; token_value: string }>
            designTokens = rows
        } catch {
            designTokens = []
        }
    } catch {
        // flint-mcp not available — health enrichment will be skipped.
    }

    const cards = await Promise.all(
        Object.entries(components).map(async ([name, entry]) => {
        const e = (entry ?? {}) as Record<string, unknown>
        const importPath = typeof e.importPath === 'string' ? e.importPath : ''
        const filePath = typeof e.filePath === 'string' ? e.filePath : ''
        const variants = Array.isArray(e.variants) ? e.variants : []
        const propsRaw = (e.props ?? {}) as Record<string, unknown>
        const id = makeComponentId(name, importPath)

        let thumbnailPath: string | null = null
        if (thumbnailBase) {
            const tp = path.join(thumbnailBase, `${id}.png`)
            if (existsSync(tp)) thumbnailPath = tp
        }

        const props: Record<string, { type: string; required: boolean }> = {}
        for (const [propName, propDef] of Object.entries(propsRaw)) {
            const p = (propDef ?? {}) as Record<string, unknown>
            props[propName] = {
                type: typeof p.type === 'string' ? p.type : 'unknown',
                required: typeof p.required === 'boolean' ? p.required : false,
            }
        }

        // ── CV2.4: Per-component health enrichment ────────────────────────────
        let health: ComponentHealth | null = null
        if (filePath && auditAllFn && a11yAuditFn) {
            const resolvedPath = path.isAbsolute(filePath)
                ? filePath
                : activeProjectRoot
                    ? path.join(activeProjectRoot, filePath)
                    : filePath
            health = await enrichComponentHealth(resolvedPath, designTokens, auditAllFn, a11yAuditFn)
        }

        const derivedCategory = deriveComponentCategory(filePath)

        return {
            id,
            name,
            importPath,
            filePath,
            // CV2.6: category is resolved after overrides are loaded below.
            category: derivedCategory,
            variantCount: variants.length,
            variants,
            props,
            thumbnailPath,
            health,
            tokens: Array.isArray(e.tokens) ? (e.tokens as string[]) : [],
            dependencies: Array.isArray(e.dependencies) ? (e.dependencies as string[]) : [],
        }
    }))

    // CV2.6: Apply category overrides. Read the overrides file once and patch each card.
    const base = activeProjectRoot ?? app.getPath('home')
    const categoryOverrides = await readCategoryOverrides(base)
    for (const card of cards) {
        const override = categoryOverrides[card.id]
        if (override && VALID_CATEGORIES.has(override)) {
            card.category = override as 'primitive' | 'molecule' | 'organism' | 'page' | 'layout' | 'uncategorized'
        }
    }

    // 3. Sort: category order, then alphabetical by name.
    cards.sort((a, b) => {
        const d = (categoryOrder[a.category] ?? 5) - (categoryOrder[b.category] ?? 5)
        return d !== 0 ? d : a.name.localeCompare(b.name)
    })

    return cards
})

ipcMain.handle('components:save-positions', async (_event, positions: unknown): Promise<void> => {
    if (typeof positions !== 'object' || positions === null || Array.isArray(positions)) {
        throw new TypeError('components:save-positions — positions must be a plain object')
    }
    const base = activeProjectRoot ?? app.getPath('home')
    const flintDir = path.join(base, BRAND.configDir)
    if (!existsSync(flintDir)) mkdirSync(flintDir, { recursive: true })

    const positionsPath = path.join(flintDir, 'card-positions.json')
    // Commandment 12/14: route through FileTransactionManager for atomic queuing
    await fileTransactionManager.write(positionsPath, JSON.stringify(positions, null, 2))
})

ipcMain.handle('components:load-positions', async (): Promise<unknown> => {
    const base = activeProjectRoot ?? app.getPath('home')
    const positionsPath = path.join(base, BRAND.configDir, 'card-positions.json')
    try {
        const raw = await readFile(positionsPath, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed
        }
        return {}
    } catch {
        return {} // Missing or corrupt — safe default.
    }
})

// ── CV2.6: Category Override IPC Handler ─────────────────────────────────────
//
// Reads .flint/category-overrides.json (creates if missing), sets the override
// for the given componentId, and writes back atomically via FileTransactionManager.
// VALID_CATEGORIES and readCategoryOverrides are defined above, near deriveComponentCategory.

ipcMain.handle(
    'components:set-category',
    async (_event, payload: unknown): Promise<void> => {
        // Validate payload shape.
        if (
            typeof payload !== 'object' ||
            payload === null ||
            Array.isArray(payload)
        ) {
            throw new TypeError('components:set-category — payload must be an object')
        }

        const p = payload as Record<string, unknown>

        if (typeof p.componentId !== 'string' || p.componentId.trim() === '') {
            throw new TypeError('components:set-category — componentId must be a non-empty string')
        }
        if (typeof p.category !== 'string' || !VALID_CATEGORIES.has(p.category)) {
            throw new TypeError(
                `components:set-category — category must be one of: ${[...VALID_CATEGORIES].join(', ')}`,
            )
        }

        const base = activeProjectRoot ?? app.getPath('home')
        const flintDir = path.join(base, BRAND.configDir)

        // Ensure .flint/ directory exists before writing.
        if (!existsSync(flintDir)) mkdirSync(flintDir, { recursive: true })

        // Read current overrides, apply mutation, write back atomically.
        const overrides = await readCategoryOverrides(base)
        overrides[p.componentId] = p.category

        const overridesPath = path.join(flintDir, 'category-overrides.json')
        await fileTransactionManager.write(overridesPath, JSON.stringify(overrides, null, 2))
    },
)

ipcMain.handle('beta:load-demo-project', async (_event, payload?: { demoName?: string }) => {
    try {
        const demoName = payload?.demoName
        const resourcesBase = app.isPackaged
            ? path.join(process.resourcesPath, 'build-resources')
            : path.join(__dirname, '..', 'build-resources')

        // If a named demo is requested, look in build-resources/demos/<demoName>/
        // Fall back to build-resources/demo-project/ for the default case.
        let demoSourceDir: string
        if (demoName && demoName !== 'default') {
            const namedDir = path.join(resourcesBase, 'demos', demoName)
            demoSourceDir = existsSync(namedDir)
                ? namedDir
                : path.join(resourcesBase, 'demo-project')
        } else {
            demoSourceDir = path.join(resourcesBase, 'demo-project')
        }

        if (!existsSync(demoSourceDir)) {
            return { error: 'Demo project bundle not found.' }
        }

        // Create a temp directory for the demo project
        const tmpBase = path.join(os.tmpdir(), 'flint-beta-demo')
        if (!existsSync(tmpBase)) mkdirSync(tmpBase, { recursive: true })
        const projectDir = path.join(tmpBase, `demo-${Date.now()}`)
        mkdirSync(projectDir, { recursive: true })

        // Recursively copy the entire demo project (handles subdirectories safely)
        await cp(demoSourceDir, projectDir, { recursive: true })

        // Copy design tokens into .flint/ so the governance engine picks them up
        const tokensSrc = path.join(projectDir, 'design-tokens.json')
        if (existsSync(tokensSrc)) {
            const flintDir = path.join(projectDir, BRAND.configDir)
            mkdirSync(flintDir, { recursive: true })
            const tokensContent = await readFile(tokensSrc)
            await writeFile(path.join(flintDir, 'design-tokens.json'), tokensContent)
        }

        console.log(`${logTag('Beta')} Demo project created at: ${projectDir}`)
        return { projectPath: projectDir }
    } catch (err) {
        console.error(`${logTag('Beta')} Failed to create demo project:`, err)
        return { error: 'Failed to create demo project.' }
    }
})

// ── BETA.3: Auto-Update IPC ───────────────────────────────────────────────────
//
// Five handlers expose electron-updater's lifecycle to the renderer through the
// contextBridge surface (window.flintAPI.autoUpdate.*).
// Push events are forwarded from autoUpdater.ts via BrowserWindow.webContents.send().

ipcMain.handle('auto-update:check', async () => {
    try {
        const result = await autoUpdateCheck()
        if (!result?.updateInfo) return null
        const info = result.updateInfo
        return {
            version: info.version,
            releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
            releaseDate: info.releaseDate,
            isBeta: info.version.includes('beta'),
        }
    } catch {
        // Offline or no releases — return null so the renderer shows nothing.
        return null
    }
})

ipcMain.handle('auto-update:download', () => autoUpdateDownload())

ipcMain.handle('auto-update:install', () => {
    // quitAndInstall is synchronous and terminates the process — no return value.
    autoUpdateInstall()
})

ipcMain.handle('auto-update:get-channel', () => getUpdateChannel())

ipcMain.handle('auto-update:set-channel', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
        throw new Error('auto-update:set-channel — payload must be an object with a "channel" property')
    }
    const { channel } = payload as { channel: string }
    if (channel !== 'stable' && channel !== 'beta') {
        throw new Error('auto-update:set-channel — invalid channel; must be "stable" or "beta"')
    }
    setUpdateChannel(channel)
})

// ── CR.4: Component Scope Management IPC ─────────────────────────────────────
//
// Two handlers back window.flintAPI.scope in the renderer:
//
//   scope:get-registry-and-scope — reads flint-manifest.json + .flint/policy.json
//     and returns them in a single round-trip so the ComponentScopePanel never
//     reads the registry and policy separately (race-condition-free).
//
//   scope:set-scope — persists componentScope changes to .flint/policy.json via
//     FileTransactionManager (Commandment 12: Atomic Queuing).
//
// Both handlers follow the established pattern of guarding on activeProjectRoot,
// wrapping in try/catch, and never throwing from an IPC handler.

ipcMain.handle('scope:get-registry-and-scope', async (): Promise<{
    registry: Record<string, {
        name: string
        props: Record<string, { type: string; required: boolean }>
        variants: string[]
        consumedTokens: string[]
        description: string
    }>
    scope: string[] | null
    registryAvailable: boolean
}> => {
    if (!activeProjectRoot) {
        return { registry: {}, scope: null, registryAvailable: false }
    }

    try {
        // ── 1. Read flint-manifest.json ──────────────────────────────────────
        const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
        if (!existsSync(manifestPath)) {
            return { registry: {}, scope: null, registryAvailable: false }
        }

        let manifest: Record<string, unknown>
        try {
            const raw = await readFile(manifestPath, 'utf-8')
            manifest = JSON.parse(raw) as Record<string, unknown>
        } catch {
            return { registry: {}, scope: null, registryAvailable: false }
        }

        // ── 2. Normalize registry entries ─────────────────────────────────────
        // Field mapping: manifest's `tokens` array → `consumedTokens`.
        // Missing fields get safe defaults.
        const rawComponents = (manifest.components ?? {}) as Record<string, unknown>
        const registry: Record<string, {
            name: string
            props: Record<string, { type: string; required: boolean }>
            variants: string[]
            consumedTokens: string[]
            description: string
        }> = {}

        for (const [componentName, entry] of Object.entries(rawComponents)) {
            const e = (entry ?? {}) as Record<string, unknown>

            const propsRaw = (e.props ?? {}) as Record<string, unknown>
            const props: Record<string, { type: string; required: boolean }> = {}
            for (const [propName, propDef] of Object.entries(propsRaw)) {
                const p = (propDef ?? {}) as Record<string, unknown>
                props[propName] = {
                    type: typeof p.type === 'string' ? p.type : 'unknown',
                    required: typeof p.required === 'boolean' ? p.required : false,
                }
            }

            registry[componentName] = {
                name: componentName,
                props,
                variants: Array.isArray(e.variants) ? (e.variants as string[]) : [],
                consumedTokens: Array.isArray(e.tokens) ? (e.tokens as string[]) : [],
                description: typeof e.description === 'string' ? e.description : '',
            }
        }

        // ── 3. Read componentScope from .flint/policy.json ───────────────────
        let scope: string[] | null = null
        const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
        if (existsSync(policyPath)) {
            try {
                const policyRaw = await readFile(policyPath, 'utf-8')
                const policy = JSON.parse(policyRaw) as Record<string, unknown>
                if (Array.isArray(policy.componentScope) && policy.componentScope.length > 0) {
                    scope = policy.componentScope as string[]
                }
                // Empty array is treated as null per CR.3 semantics.
            } catch {
                // Malformed policy — treat as missing.
            }
        }

        return { registry, scope, registryAvailable: true }
    } catch (err) {
        console.error(`${BRAND.logPrefix} scope:get-registry-and-scope failed:`, err)
        return { registry: {}, scope: null, registryAvailable: false }
    }
})

ipcMain.handle('scope:set-scope', async (_event, payload: unknown): Promise<{ ok: boolean; error?: string }> => {
    if (!activeProjectRoot) {
        return { ok: false, error: 'No project open' }
    }

    try {
        // ── 1. Validate payload ───────────────────────────────────────────────
        if (
            typeof payload !== 'object' ||
            payload === null ||
            !('scope' in payload)
        ) {
            return { ok: false, error: 'Invalid payload: expected { scope: string[] | null }' }
        }
        const { scope } = payload as { scope: unknown }
        if (scope !== null && !Array.isArray(scope)) {
            return { ok: false, error: 'Invalid payload: scope must be string[] or null' }
        }
        if (Array.isArray(scope) && !scope.every((item) => typeof item === 'string')) {
            return { ok: false, error: 'Invalid payload: scope array must contain only strings' }
        }

        // ── 2. Ensure .flint/ directory exists ───────────────────────────────
        const flintDir = path.join(activeProjectRoot, BRAND.configDir)
        if (!existsSync(flintDir)) {
            mkdirSync(flintDir, { recursive: true })
        }

        // ── 3. Read existing policy.json (create empty object if missing) ──────
        const policyPath = path.join(flintDir, 'policy.json')
        let policy: Record<string, unknown> = {}
        if (existsSync(policyPath)) {
            try {
                const raw = await readFile(policyPath, 'utf-8')
                policy = JSON.parse(raw) as Record<string, unknown>
            } catch {
                // Malformed — start fresh.
                policy = {}
            }
        }

        // ── 4. Apply scope mutation ───────────────────────────────────────────
        // null or empty array → remove componentScope key (all components allowed).
        // non-empty array → set explicit allow-list.
        if (scope === null || (Array.isArray(scope) && scope.length === 0)) {
            delete policy.componentScope
        } else {
            policy.componentScope = scope
        }

        // ── 5. Write atomically via FileTransactionManager (Commandment 12) ───
        await fileTransactionManager.write(policyPath, JSON.stringify(policy, null, 2) + '\n')

        return { ok: true }
    } catch (err) {
        console.error(`${BRAND.logPrefix} scope:set-scope failed:`, err)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
})

// ── LIB.1: Library Selection IPC ──────────────────────────────────────────────
//
// Two handlers back window.flintAPI.scope.getActiveLibrary/setActiveLibrary:
//
//   library:get-active — reads .flint/policy.json and returns selectedLibrary
//   library:set-active — writes selectedLibrary + seeds tokens

ipcMain.handle('library:get-active', async (): Promise<{
    library: string | null
    availableLibraries: Array<{ library: string; displayName: string }>
}> => {
    const availableLibraries = [
        { library: 'shadcn', displayName: 'shadcn/ui' },
        { library: 'mui', displayName: 'Material UI (MUI)' },
        { library: 'primeng', displayName: 'PrimeNG / PrimeReact / PrimeVue' },
        { library: 'tailwind', displayName: 'Tailwind CSS' },
    ]

    if (!activeProjectRoot) {
        return { library: null, availableLibraries }
    }

    try {
        const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
        if (existsSync(policyPath)) {
            const policy = JSON.parse(readFileSync(policyPath, 'utf-8'))
            return { library: policy.selectedLibrary ?? null, availableLibraries }
        }
    } catch { /* non-fatal */ }

    return { library: null, availableLibraries }
})

ipcMain.handle('library:set-active', async (_event, payload: unknown): Promise<{
    ok: boolean
    library: string | null
    seeded: number
    error?: string
}> => {
    if (!activeProjectRoot) {
        return { ok: false, library: null, seeded: 0, error: 'No project open' }
    }

    // ── Runtime payload validation (BLOCKER 3 fix) ───────────────────────
    if (typeof payload !== 'object' || payload === null) {
        return { ok: false, library: null, seeded: 0, error: 'Invalid payload' }
    }
    const { library } = payload as { library: unknown }
    if (library !== null && typeof library !== 'string') {
        return { ok: false, library: null, seeded: 0, error: 'library must be a string or null' }
    }
    const libraryValue = library as string | null

    try {
        // Read current policy
        const policyPath = path.join(activeProjectRoot, BRAND.configDir, 'policy.json')
        let policy: Record<string, unknown> = {}
        if (existsSync(policyPath)) {
            try {
                policy = JSON.parse(readFileSync(policyPath, 'utf-8'))
            } catch { /* start fresh */ }
        }

        // Clear library
        if (!libraryValue || libraryValue === 'none') {
            delete policy.selectedLibrary
            await fileTransactionManager.write(policyPath, JSON.stringify(policy, null, 2) + '\n')
            return { ok: true, library: null, seeded: 0 }
        }

        // ── Validate library name against the canonical adapter registry ──
        // Single source of truth: the adapter registry (not a hardcoded list).
        const { getAdapter, hasAdapter, getAvailableLibraries } = await import('../flint-mcp/src/core/libraryAdapters/index.js')
        if (!hasAdapter(libraryValue as import('../flint-mcp/src/core/libraryAdapters/types.js').LibraryTarget)) {
            const available = getAvailableLibraries().join(', ')
            return { ok: false, library: libraryValue, seeded: 0, error: `Unknown library: "${libraryValue}". Supported: ${available}` }
        }

        // Set library in policy (only after validation)
        policy.selectedLibrary = libraryValue
        await fileTransactionManager.write(policyPath, JSON.stringify(policy, null, 2) + '\n')

        const adapter = getAdapter(libraryValue as import('../flint-mcp/src/core/libraryAdapters/types.js').LibraryTarget)
        const seedTokens = adapter.seedTokens()

        // Read current tokens
        const tokensPath = path.join(activeProjectRoot, BRAND.configDir, 'design-tokens.json')
        let currentTokens: Array<{ id: number; token_path: string; [key: string]: unknown }> = []
        if (existsSync(tokensPath)) {
            try {
                const parsed = JSON.parse(readFileSync(tokensPath, 'utf-8'))
                if (Array.isArray(parsed)) currentTokens = parsed
            } catch { /* start fresh */ }
        }

        // Merge with preserve — never overwrite existing token paths
        const existingPaths = new Set(currentTokens.map(t => t.token_path))
        let seeded = 0
        let nextId = currentTokens.length > 0
            ? Math.max(...currentTokens.map(t => t.id)) + 1
            : 1
        const merged = [...currentTokens]
        for (const seed of seedTokens) {
            if (!existingPaths.has(seed.token_path)) {
                merged.push({ ...seed, id: nextId++ })
                seeded++
            }
        }

        // Write via FileTransactionManager (Commandment 12)
        if (seeded > 0) {
            await fileTransactionManager.write(tokensPath, JSON.stringify(merged, null, 2) + '\n')
        }

        return { ok: true, library: libraryValue, seeded }
    } catch (err) {
        console.error(`${BRAND.logPrefix} library:set-active failed:`, err)
        return { ok: false, library: null, seeded: 0, error: err instanceof Error ? err.message : String(err) }
    }
})

// ── EN.1: Enrichment Draft Reading and Approval IPC ──────────────────────────
//
// Two handlers back window.flintAPI.enrichment in the renderer:
//
//   enrichment:get-drafts — reads .flint/enrichment-drafts.json and
//     flint-manifest.json in one round-trip, returning all pending drafts
//     plus computed stats (bare / draft / enriched / total).
//
//   enrichment:approve — approves or dismisses a single draft. On approval
//     the draft fields (with any renderer-edited overrides) are merged into
//     flint-manifest.json via FileTransactionManager, then the RAG store is
//     re-seeded so the updated description is immediately queryable.
//
// A component is:
//   "enriched" — has both `description` AND `usageExample` in the manifest.
//   "draft"    — exists in enrichment-drafts.json (may also be in manifest
//                without a usageExample yet).
//   "bare"     — in the manifest, neither enriched nor draft.
//
// Commandment 12: all manifest writes go through FileTransactionManager.

ipcMain.handle('enrichment:get-drafts', async (): Promise<{
    drafts: Record<string, {
        description: string
        usageExample: string
        compositionNotes?: string
        a11yNotes?: string
        relatedComponents?: string[]
        confidence: 'high' | 'medium' | 'low'
        usageFileCount: number
        sourceFile: string
        generatedAt: string
        generatedBy: string
    }>
    enrichmentStats: { bare: number; draft: number; enriched: number; total: number }
} | null> => {
    if (!activeProjectRoot) return null

    try {
        // ── 1. Read enrichment-drafts.json ────────────────────────────────────
        // File format: { generatedAt, generatedBy, drafts: Record<name, Draft> }
        // We unwrap the `.drafts` sub-key to get the component-keyed map.
        const draftsPath = path.join(activeProjectRoot, BRAND.configDir, 'enrichment-drafts.json')
        let drafts: Record<string, unknown> = {}
        if (existsSync(draftsPath)) {
            try {
                const raw = await readFile(draftsPath, 'utf-8')
                const parsed = JSON.parse(raw) as Record<string, unknown>
                // Unwrap: the actual drafts live under the `drafts` key.
                // If the file is a flat map (no wrapper), fall back to the parsed object itself.
                drafts = (typeof parsed.drafts === 'object' && parsed.drafts !== null)
                    ? parsed.drafts as Record<string, unknown>
                    : parsed
            } catch {
                // Malformed file — treat as empty.
                drafts = {}
            }
        }

        // ── 2. Read flint-manifest.json to compute stats ─────────────────────
        const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)
        let total = 0
        let enriched = 0

        if (existsSync(manifestPath)) {
            try {
                const raw = await readFile(manifestPath, 'utf-8')
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
            } catch {
                // Malformed manifest — stats stay at 0.
            }
        }

        const draftCount = Object.keys(drafts).length
        // "bare" = in manifest, not enriched, not in draft queue
        const bare = Math.max(0, total - enriched - draftCount)

        return {
            drafts: drafts as Record<string, {
                description: string
                usageExample: string
                compositionNotes?: string
                a11yNotes?: string
                relatedComponents?: string[]
                confidence: 'high' | 'medium' | 'low'
                usageFileCount: number
                sourceFile: string
                generatedAt: string
                generatedBy: string
            }>,
            enrichmentStats: { bare, draft: draftCount, enriched, total },
        }
    } catch (err) {
        console.error(`${BRAND.logPrefix} enrichment:get-drafts failed:`, err)
        return null
    }
})

ipcMain.handle('enrichment:approve', async (
    _event,
    payload: unknown,
): Promise<{ ok: boolean; remainingDrafts: number; error?: string }> => {
    if (!activeProjectRoot) {
        return { ok: false, remainingDrafts: 0, error: 'No project open' }
    }

    try {
        // ── 1. Validate payload ───────────────────────────────────────────────
        if (
            typeof payload !== 'object' ||
            payload === null ||
            !('componentName' in payload) ||
            !('action' in payload)
        ) {
            return { ok: false, remainingDrafts: 0, error: 'Invalid payload: expected { componentName, action }' }
        }

        const { componentName, action, editedFields } = payload as {
            componentName: unknown
            action: unknown
            editedFields?: Record<string, unknown>
        }

        if (typeof componentName !== 'string' || componentName.trim() === '') {
            return { ok: false, remainingDrafts: 0, error: 'Invalid payload: componentName must be a non-empty string' }
        }
        if (action !== 'approve' && action !== 'dismiss') {
            return { ok: false, remainingDrafts: 0, error: 'Invalid payload: action must be "approve" or "dismiss"' }
        }

        // ── 2. Load current drafts ────────────────────────────────────────────
        // File format: { generatedAt, generatedBy, drafts: Record<name, Draft> }
        // We must unwrap the `.drafts` sub-key to get the component-keyed map,
        // and preserve the wrapper so we write back the correct shape.
        const flintDir = path.join(activeProjectRoot, BRAND.configDir)
        if (!existsSync(flintDir)) {
            mkdirSync(flintDir, { recursive: true })
        }
        const draftsPath = path.join(flintDir, 'enrichment-drafts.json')

        let draftsWrapper: Record<string, unknown> = { drafts: {} }
        let drafts: Record<string, unknown> = {}
        if (existsSync(draftsPath)) {
            try {
                const raw = await readFile(draftsPath, 'utf-8')
                const parsed = JSON.parse(raw) as Record<string, unknown>
                if (typeof parsed.drafts === 'object' && parsed.drafts !== null) {
                    draftsWrapper = parsed
                    drafts = parsed.drafts as Record<string, unknown>
                } else {
                    // Flat format fallback
                    drafts = parsed
                    draftsWrapper = { drafts: parsed }
                }
            } catch {
                drafts = {}
                draftsWrapper = { drafts: {} }
            }
        }

        // ── 3. If approve: merge draft fields into flint-manifest.json ───────
        if (action === 'approve') {
            const draft = (drafts[componentName] ?? {}) as Record<string, unknown>
            const manifestPath = path.join(activeProjectRoot, BRAND.manifestFile)

            let manifest: Record<string, unknown> = {}
            if (existsSync(manifestPath)) {
                try {
                    const raw = await readFile(manifestPath, 'utf-8')
                    manifest = JSON.parse(raw) as Record<string, unknown>
                } catch {
                    manifest = {}
                }
            }

            const components = (manifest.components ?? {}) as Record<string, unknown>
            const existing = (components[componentName] ?? {}) as Record<string, unknown>

            // Merge: manifest fields <- draft fields <- renderer editedFields overrides
            components[componentName] = {
                ...existing,
                ...draft,
                ...(editedFields ?? {}),
            }
            manifest.components = components

            // Atomic write via FileTransactionManager (Commandment 12)
            await fileTransactionManager.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

            // Trigger RAG re-seed so the updated description is immediately queryable
            void import('./ragSeeder.js').then(({ seedRAGFromProject }) => {
                seedRAGFromProject(activeProjectRoot!).catch(err => {
                    console.error(`${BRAND.logPrefix} enrichment:approve — RAG re-seed failed:`, err)
                })
            })
        }

        // ── 4. Remove from drafts file (approve or dismiss) ───────────────────
        delete drafts[componentName]
        draftsWrapper.drafts = drafts
        await fileTransactionManager.write(draftsPath, JSON.stringify(draftsWrapper, null, 2) + '\n')

        const remainingDrafts = Object.keys(drafts).length
        return { ok: true, remainingDrafts }
    } catch (err) {
        console.error(`${BRAND.logPrefix} enrichment:approve failed:`, err)
        return { ok: false, remainingDrafts: 0, error: err instanceof Error ? err.message : String(err) }
    }
})

// ── Phase D2C.2: Design-to-Code LivePreview Integration ──────────────────────

/**
 * workspace:rescan — Re-scans the active project root and returns the
 * updated FileTreeNode. Useful after any operation that creates or deletes
 * files outside the normal save-file flow (D2C apply, template scaffolding).
 *
 * Returns null when no project is open (activeProjectRoot is null).
 */
ipcMain.handle('workspace:rescan', async (): Promise<FileTreeNode | null> => {
    if (!activeProjectRoot) return null
    return await scanDirectory(activeProjectRoot)
})

/**
 * d2c:apply — Atomically writes all generated component files from a
 * flint_design_to_code MCP tool result to disk, runs injectFlintIds on each
 * component's AST (Commandment 7), shadow-commits the generated directory,
 * re-scans the workspace tree, and returns the page compositor path so the
 * renderer can open it via canvasStore.setActiveFile().
 *
 * Security:
 *   - All generated paths must be within the user's home directory.
 *   - All generated .tsx files are written via FileTransactionManager (Commandment 12).
 *   - The theme file (if present) is written via FileTransactionManager after a
 *     path-within-home check (no extension restriction — theme files may be .css/.ts).
 *   - mkdir is the only direct fs call — it only creates directories, not source files.
 */
ipcMain.handle('d2c:apply', async (_event, request: unknown): Promise<{
    ok: boolean
    pageFilePath: string
    componentFilePaths: string[]
    workspaceTree: FileTreeNode
    error?: string
}> => {
    const EMPTY_TREE: FileTreeNode = { name: '', path: '', type: 'directory', children: [] }

    try {
        // ── 1. Validate request shape ─────────────────────────────────────────
        if (
            typeof request !== 'object' || request === null ||
            !('pageName' in request) || !('components' in request) || !('page' in request)
        ) {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid request: missing required fields (pageName, components, page)' }
        }

        const req = request as {
            pageName: unknown
            components: unknown
            page: unknown
            themeFile?: unknown
        }

        if (typeof req.pageName !== 'string' || req.pageName.trim() === '') {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid request: pageName must be a non-empty string' }
        }
        if (!Array.isArray(req.components)) {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid request: components must be an array' }
        }
        if (typeof req.page !== 'object' || req.page === null) {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid request: page must be an object' }
        }
        const page = req.page as { name?: unknown; code?: unknown }
        if (typeof page.name !== 'string' || typeof page.code !== 'string') {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'Invalid request: page must have name and code strings' }
        }

        // ── 2. Validate project is open ───────────────────────────────────────
        if (!activeProjectRoot) {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: 'No project open — open a project before applying D2C output' }
        }

        const home = app.getPath('home')

        // ── 3. Compute target directory ───────────────────────────────────────
        const targetDir = path.join(activeProjectRoot, 'src', 'components', 'generated', req.pageName)

        // ── 4. Ensure target directory exists (mkdir is exempt from FTM — Commandment 14 note) ──
        await mkdir(targetDir, { recursive: true })

        // ── 5. Import Babel parse + generate (dynamic to avoid ESM/CJS issues) ─
        const { parse: babelParse } = await import('@babel/parser')
        const _genMod = await import('@babel/generator') as unknown as Record<string, unknown>
        const babelGenerate: (ast: unknown, opts?: unknown) => { code: string } =
            typeof _genMod === 'function' ? (_genMod as unknown as (ast: unknown) => { code: string })
            : typeof (_genMod as { default?: unknown }).default === 'function' ? ((_genMod as { default: unknown }).default as (ast: unknown) => { code: string })
            : typeof ((_genMod as { default?: { default?: unknown } }).default?.default) === 'function' ? ((_genMod as { default: { default: unknown } }).default.default as (ast: unknown) => { code: string })
            : (_genMod as { generate: (ast: unknown) => { code: string } }).generate

        // ── 6. Helper: parse code, run injectFlintIds plugin, generate code ────
        function processComponentCode(code: string, filename: string): { code: string; warning?: string } {
            try {
                const ast = babelParse(code, {
                    sourceType: 'module',
                    plugins: ['typescript', 'jsx'],
                    errorRecovery: true,
                })

                // Run injectFlintIdPlugin visitor on the parsed AST (Commandment 7).
                // We reuse the same plugin that powers the preview engine.
                const pluginResult = injectFlintIdPlugin()
                const visitor = pluginResult.visitor

                // Walk all JSXOpeningElements in the AST
                const traverse = (node: Record<string, unknown>): void => {
                    if (!node || typeof node !== 'object') return
                    if (node.type === 'JSXOpeningElement') {
                        // Create a minimal NodePath-compatible object for the visitor
                        const pseudoPath = { node: node as unknown as JSXOpeningElement } as NodePath<JSXOpeningElement>
                        visitor.JSXOpeningElement(pseudoPath)
                    }
                    for (const key of Object.keys(node)) {
                        const child = node[key]
                        if (Array.isArray(child)) {
                            for (const item of child) {
                                if (item && typeof item === 'object' && 'type' in item) {
                                    traverse(item as Record<string, unknown>)
                                }
                            }
                        } else if (child && typeof child === 'object' && 'type' in child) {
                            traverse(child as Record<string, unknown>)
                        }
                    }
                }
                traverse(ast.program as unknown as Record<string, unknown>)

                const { code: generated } = babelGenerate(ast)
                return { code: generated }
            } catch (err) {
                // If parsing fails, write the code as-is (user can fix manually)
                // and include a warning in the result (contract §12 risk mitigation)
                console.warn(`${BRAND.logPrefix} d2c:apply — parse failed for ${filename}, writing as-is:`, err)
                return { code, warning: `Parse failed for ${filename}: ${err instanceof Error ? err.message : String(err)}` }
            }
        }

        // ── 7. Build file batch ───────────────────────────────────────────────
        const fileBatch = new Map<string, string>()
        const componentFilePaths: string[] = []
        const warnings: string[] = []

        for (const comp of req.components) {
            const c = comp as { name?: unknown; code?: unknown }
            if (typeof c.name !== 'string' || typeof c.code !== 'string') continue
            const filePath = path.join(targetDir, `${c.name}.tsx`)

            // Security: must be within home directory
            if (!filePath.startsWith(home + path.sep)) {
                return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: `Security: path outside home directory — ${filePath}` }
            }

            const { code: processed, warning } = processComponentCode(c.code, c.name)
            if (warning) warnings.push(warning)
            fileBatch.set(filePath, processed)
            componentFilePaths.push(filePath)
        }

        // Page compositor
        const pageFilePath = path.join(targetDir, `${page.name}.tsx`)
        if (!pageFilePath.startsWith(home + path.sep)) {
            return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: `Security: page path outside home directory — ${pageFilePath}` }
        }

        // Ensure page compositor has an export default (contract Q1 resolution)
        let pageCode = page.code
        if (!/export\s+default\b/.test(pageCode)) {
            pageCode = pageCode + `\nexport default ${page.name};\n`
        }
        const { code: processedPage, warning: pageWarning } = processComponentCode(pageCode, page.name)
        if (pageWarning) warnings.push(pageWarning)
        fileBatch.set(pageFilePath, processedPage)

        // ── 8. Write all source files via FileTransactionManager ──────────────
        await fileTransactionManager.writeBatch(fileBatch)

        // ── 9. Write theme file (if present) — separate write, no extension check ─
        if (req.themeFile !== undefined && req.themeFile !== null) {
            const tf = req.themeFile as { filename?: unknown; code?: unknown }
            if (typeof tf.filename === 'string' && typeof tf.code === 'string') {
                const themeFilePath = path.join(activeProjectRoot, tf.filename)
                // Security: must be within home directory
                if (!themeFilePath.startsWith(home + path.sep)) {
                    return { ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: EMPTY_TREE, error: `Security: theme file path outside home directory — ${themeFilePath}` }
                }
                await fileTransactionManager.write(themeFilePath, tf.code)
            }
        }

        // ── 10. Shadow commit (Commandment 13: after FTM resolves) ───────────
        await gitManager.shadowCommit(targetDir).catch((err: Error) => {
            console.warn(`${BRAND.logPrefix} d2c:apply — shadowCommit failed (non-fatal):`, err)
        })

        // ── 11. Re-scan workspace ─────────────────────────────────────────────
        const workspaceTree = await scanDirectory(activeProjectRoot)

        console.log(`${BRAND.logPrefix} d2c:apply — wrote ${fileBatch.size} files to ${targetDir}`)
        if (warnings.length > 0) {
            console.warn(`${BRAND.logPrefix} d2c:apply — warnings:`, warnings)
        }

        return { ok: true, pageFilePath, componentFilePaths, workspaceTree }
    } catch (err) {
        console.error(`${BRAND.logPrefix} d2c:apply failed:`, err)
        return {
            ok: false,
            pageFilePath: '',
            componentFilePaths: [],
            workspaceTree: EMPTY_TREE,
            error: err instanceof Error ? err.message : String(err),
        }
    }
})

app.on('will-quit', () => {
    // Stop beta version check polling
    stopVersionCheck()

    // Stop auto-update periodic checks and release the window reference.
    stopAutoUpdater()

    // Close the ingestion server gracefully before the process exits so the
    // OS port is released immediately. This prevents EADDRINUSE on fast
    // dev-server reloads where Electron restarts before the OS reclaims 4545.
    stopServer?.()

    // Phase W.3: shut down the MCP server child process on app exit.
    // stop() is async but will-quit is synchronous — fire-and-forget is acceptable
    // here because the OS will reclaim the child process anyway on app exit.
    void mcpClient.stop()

    // CV2.2: Destroy any pending thumbnail BrowserWindows
    thumbnailGenerator?.dispose()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
    mainWindow = null
})
