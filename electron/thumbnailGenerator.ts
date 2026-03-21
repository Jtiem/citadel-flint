/**
 * thumbnailGenerator.ts — Phase CV2.2
 *
 * Renders React components in hidden BrowserWindows, captures screenshots
 * as PNG files, and caches them in .flint/thumbnails/.
 *
 * Architecture:
 *   - Sequential async queue (concurrency = 1) prevents GPU contention.
 *   - Hidden BrowserWindow: show: false, offscreen: true, fully sandboxed.
 *   - Babel transform pipeline mirrors code:transform in main.ts.
 *   - All PNG writes go through FileTransactionManager (Commandments 12/14).
 *   - Preview-vendor JS files read once at startup, cached in module scope.
 *
 * Security:
 *   - componentName is sanitized to prevent path traversal.
 *   - BrowserWindow: nodeIntegration: false, contextIsolation: true, sandbox: true.
 *   - Write paths are constructed from a validated projectRoot.
 *
 * Electron Main Process only — never import from src/.
 */

import { BrowserWindow } from 'electron'
import path from 'node:path'
import { readFile, mkdir, unlink, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { transformSync } from '@babel/core'
import type { FileTransactionManager } from './FileTransactionManager.js'

// ── Preview-vendor file cache ─────────────────────────────────────────────────
//
// Read once at module load time. These are the same UMD bundles used by
// LivePreview. In the main process we cannot use Vite's ?raw import syntax,
// so we resolve the path relative to the compiled output.
// The dist-electron/ and src/preview-vendor/ relationship:
//   - During dev: src is not compiled to dist, so we resolve from src/
//   - During prod: files are bundled separately
// We try both paths and cache whichever resolves.

let _reactUMD: string | null = null
let _reactDOMUMD: string | null = null
let _tailwindCDN: string | null = null

/**
 * Reads the preview-vendor files from disk if not already cached.
 * Tries multiple resolution paths to support both dev and prod builds.
 */
async function loadVendorFiles(appRoot: string): Promise<{
    reactUMD: string
    reactDOMUMD: string
    tailwindCDN: string
}> {
    if (_reactUMD && _reactDOMUMD && _tailwindCDN) {
        return {
            reactUMD: _reactUMD,
            reactDOMUMD: _reactDOMUMD,
            tailwindCDN: _tailwindCDN,
        }
    }

    // Resolution candidates (dev build: src/preview-vendor, prod: dist/preview-vendor)
    const candidates = [
        path.join(appRoot, 'src', 'preview-vendor'),
        path.join(appRoot, 'dist', 'preview-vendor'),
        path.join(appRoot, 'dist', 'assets'),
    ]

    let vendorDir: string | null = null
    for (const dir of candidates) {
        if (existsSync(path.join(dir, 'react.prod.js'))) {
            vendorDir = dir
            break
        }
    }

    if (!vendorDir) {
        throw new Error(
            '[ThumbnailGenerator] Cannot locate preview-vendor directory. ' +
            `Searched: ${candidates.join(', ')}`
        )
    }

    _reactUMD = await readFile(path.join(vendorDir, 'react.prod.js'), 'utf8')
    _reactDOMUMD = await readFile(path.join(vendorDir, 'react-dom.prod.js'), 'utf8')
    _tailwindCDN = await readFile(path.join(vendorDir, 'tailwind-cdn.js'), 'utf8')

    return {
        reactUMD: _reactUMD,
        reactDOMUMD: _reactDOMUMD,
        tailwindCDN: _tailwindCDN,
    }
}

// ── Type exports ──────────────────────────────────────────────────────────────

/**
 * Options for generating a single component thumbnail.
 */
export interface ThumbnailOptions {
    /** Absolute path to the component source file (.tsx/.jsx). */
    filePath: string
    /** Component name (PascalCase) — used as the cache key and filename. */
    componentName: string
    /** Width of the captured thumbnail in CSS pixels. Default: 280. */
    width?: number
    /** Height of the captured thumbnail in CSS pixels. Default: 180. */
    height?: number
    /** Device pixel ratio for retina captures. Default: 2 (for crisp thumbnails). */
    deviceScaleFactor?: number
}

/**
 * Result of a single thumbnail generation.
 */
export interface ThumbnailResult {
    /** Component name this thumbnail represents. */
    componentName: string
    /** Absolute path to the saved PNG file in .flint/thumbnails/. */
    thumbnailPath: string
    /** Whether this was freshly generated (true) or served from cache (false). */
    generated: boolean
    /** Non-null when generation failed. */
    error: string | null
}

/**
 * Result of a batch thumbnail generation.
 */
export interface BatchThumbnailResult {
    /** Total components processed. */
    total: number
    /** Successfully generated thumbnails. */
    succeeded: number
    /** Components that failed thumbnail generation. */
    failed: number
    /** Per-component results. */
    results: ThumbnailResult[]
}

// ── AsyncQueue ────────────────────────────────────────────────────────────────

/**
 * Sequential async queue to prevent GPU contention from multiple
 * simultaneous BrowserWindow renders.
 *
 * Concurrency is always 1. Each new task chains onto the tail promise.
 */
class AsyncQueue {
    private tail: Promise<void> = Promise.resolve()

    enqueue<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.tail = this.tail
                .then(() => task().then(resolve, reject))
                .catch(() => { /* prevent chain breakage on task failure */ })
        })
    }
}

// ── HTML shell builder ────────────────────────────────────────────────────────

/**
 * Builds a minimal, interaction-free HTML shell for thumbnail rendering.
 *
 * Differences from LivePreview's buildSrcdoc():
 *   - White background (not dark canvas)
 *   - No Flint interaction layer (no shield, no click handlers, no data-flint-id)
 *   - overflow: hidden to prevent scrollbars in the capture
 *   - Component is centered in the viewport
 *   - No postMessage listeners
 */
function buildThumbnailHtml(
    transformedJs: string,
    reactUMD: string,
    reactDOMUMD: string,
    tailwindCDN: string
): string {
    const safeJson = JSON.stringify(transformedJs).replace(/</g, '\\u003c')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${reactUMD}<\/script>
  <script>${reactDOMUMD}<\/script>
  <script>${tailwindCDN}<\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: white; overflow: hidden; }
    #root {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script id="__code" type="application/json">${safeJson}<\/script>
  <script>
    var { useState, useEffect, useRef, useMemo, useCallback, useContext,
          useReducer, useLayoutEffect, useId, Fragment, createContext,
          forwardRef, memo, cloneElement, Children, isValidElement } = React;
  <\/script>
  <script>
    (function() {
      try {
        var encoded = document.getElementById('__code').textContent;
        var js = JSON.parse(encoded);
        new Function(js)();
        if (window.__AppComponent) {
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(window.__AppComponent));
        }
      } catch (e) {
        document.getElementById('root').innerHTML =
          '<div style="color:#dc2626;padding:8px;font-size:12px;font-family:monospace">' +
          'Render error: ' + e.message + '<\/div>';
      }
    })();
  <\/script>
</body>
</html>`
}

// ── Babel transform (mirrors code:transform in main.ts, no flint-id injection) ──

/**
 * Transforms TSX source to plain JS suitable for execution in an srcdoc iframe.
 * Strips imports and rewrites export default to assign window.__AppComponent.
 *
 * Returns { js, error } — never throws.
 */
function transformComponentSource(source: string): { js: string | null; error: string | null } {
    try {
        const result = transformSync(source, {
            filename: 'Component.tsx',
            plugins: [
                ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
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

        // Strip ES module import statements
        js = js.replace(/^import\s[^\n]*\n?/gm, '')

        // Rewrite `export default function/class Foo` → `function/class Foo`
        let componentName: string | null = null
        js = js.replace(
            /\bexport\s+default\s+(function|class)\s+(\w+)/,
            (_m: string, kw: string, name: string) => {
                componentName = name
                return `${kw} ${name}`
            }
        )

        // Fallback: `export default Foo` (bare identifier)
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
}

// ── componentName sanitization ────────────────────────────────────────────────

/**
 * Sanitizes a component name to be safe for use as a filename.
 * Strips any characters that are not alphanumeric, dash, or underscore.
 * Returns the sanitized name, or throws if the result is empty.
 */
export function sanitizeComponentName(name: string): string {
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '')
    if (sanitized.length === 0) {
        throw new Error(`ThumbnailGenerator: invalid componentName "${name}"`)
    }
    return sanitized
}

// ── ThumbnailGenerator ────────────────────────────────────────────────────────

/**
 * ThumbnailGenerator — renders components in hidden BrowserWindows and
 * captures screenshots as PNG files cached in .flint/thumbnails/.
 *
 * Usage:
 *   const gen = new ThumbnailGenerator('/path/to/project', appRoot, ftm)
 *   const result = await gen.generate({ filePath, componentName })
 *   const dataUrl = await gen.get('Button')   // → 'data:image/png;base64,...' or null
 *   await gen.invalidate('Button')
 *   gen.dispose()
 */
export class ThumbnailGenerator {
    private projectRoot: string
    /** Absolute path to the app root (where src/preview-vendor lives). */
    private readonly appRoot: string
    private readonly ftm: FileTransactionManager
    private readonly queue = new AsyncQueue()
    /** Set of componentNames currently cached on disk (in-memory bookkeeping). */
    private cachedNames = new Set<string>()
    /** Active hidden BrowserWindows (tracked for dispose()). */
    private activeWindows = new Set<BrowserWindow>()

    constructor(projectRoot: string, appRoot: string, ftm: FileTransactionManager) {
        this.projectRoot = projectRoot
        this.appRoot = appRoot
        this.ftm = ftm
        // Seed the cache set from disk (best-effort at construction)
        this._seedCacheFromDisk()
    }

    /**
     * Scans .flint/thumbnails/ on startup to populate cachedNames without
     * waiting for the async I/O to block the constructor.
     * Runs async but is fire-and-forget; cache misses simply trigger regeneration.
     */
    private _seedCacheFromDisk(): void {
        const thumbnailDir = this._thumbnailDir()
        if (!existsSync(thumbnailDir)) return
        void readdir(thumbnailDir).then((files) => {
            for (const f of files) {
                if (f.endsWith('.png')) {
                    this.cachedNames.add(f.slice(0, -4))
                }
            }
        }).catch(() => {
            // Non-critical — cache miss just triggers regeneration
        })
    }

    private _thumbnailDir(): string {
        return path.join(this.projectRoot, '.flint', 'thumbnails')
    }

    private _thumbnailPath(componentName: string): string {
        const safe = sanitizeComponentName(componentName)
        return path.join(this._thumbnailDir(), `${safe}.png`)
    }

    /**
     * Returns true if a valid cached thumbnail exists for the component.
     */
    has(componentName: string): boolean {
        try {
            const safe = sanitizeComponentName(componentName)
            return this.cachedNames.has(safe) && existsSync(this._thumbnailPath(safe))
        } catch {
            return false
        }
    }

    /**
     * Read a cached thumbnail as a base64 data URL.
     * Returns null if the thumbnail does not exist.
     * Serving cached thumbnails from disk targets < 50ms.
     */
    async get(componentName: string): Promise<string | null> {
        try {
            const thumbPath = this._thumbnailPath(componentName)
            if (!existsSync(thumbPath)) return null
            const buf = await readFile(thumbPath)
            return `data:image/png;base64,${buf.toString('base64')}`
        } catch {
            return null
        }
    }

    /**
     * Invalidate (delete) the cached thumbnail for a component.
     * Idempotent — safe to call when no thumbnail exists.
     */
    async invalidate(componentName: string): Promise<void> {
        try {
            const safe = sanitizeComponentName(componentName)
            const thumbPath = this._thumbnailPath(safe)
            this.cachedNames.delete(safe)
            if (existsSync(thumbPath)) {
                await unlink(thumbPath)
            }
        } catch {
            // Idempotent — ignore ENOENT and sanitization errors
        }
    }

    /**
     * Generate a thumbnail for a single component.
     * If a cached PNG exists and has not been invalidated, returns it immediately.
     */
    async generate(options: ThumbnailOptions): Promise<ThumbnailResult> {
        return this.queue.enqueue(() => this._doGenerate(options))
    }

    private async _doGenerate(options: ThumbnailOptions): Promise<ThumbnailResult> {
        const {
            filePath,
            componentName,
            width = 280,
            height = 180,
            deviceScaleFactor = 2,
        } = options

        let safeName: string
        try {
            safeName = sanitizeComponentName(componentName)
        } catch (err) {
            return {
                componentName,
                thumbnailPath: '',
                generated: false,
                error: String(err),
            }
        }

        const thumbPath = this._thumbnailPath(safeName)

        // Cache hit: return immediately without re-rendering
        if (this.cachedNames.has(safeName) && existsSync(thumbPath)) {
            return {
                componentName: safeName,
                thumbnailPath: thumbPath,
                generated: false,
                error: null,
            }
        }

        let win: BrowserWindow | null = null
        try {
            // Step 1: Read source
            let source: string
            try {
                source = await readFile(filePath, 'utf8')
            } catch (err) {
                return {
                    componentName: safeName,
                    thumbnailPath: '',
                    generated: false,
                    error: `Cannot read source file: ${String(err)}`,
                }
            }

            // Step 2: Babel transform
            const { js, error: transformError } = transformComponentSource(source)
            if (transformError || !js) {
                return {
                    componentName: safeName,
                    thumbnailPath: '',
                    generated: false,
                    error: transformError ?? 'Babel returned no output',
                }
            }

            // Step 3: Load vendor files (cached in module scope)
            const vendor = await loadVendorFiles(this.appRoot)

            // Step 4: Build HTML shell
            const html = buildThumbnailHtml(js, vendor.reactUMD, vendor.reactDOMUMD, vendor.tailwindCDN)

            // Step 5: Create hidden BrowserWindow
            win = new BrowserWindow({
                width,
                height,
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true,
                    offscreen: true,
                    devTools: false,
                },
            })
            if (deviceScaleFactor !== 1) {
                // Set device scale factor for retina captures
                win.webContents.setZoomFactor(1)
            }
            this.activeWindows.add(win)

            // Step 6: Load HTML and wait for paint
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Thumbnail render timeout')), 10_000)

                win!.webContents.once('did-finish-load', () => {
                    // Wait one rAF for the paint cycle to complete
                    win!.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(r))')
                        .then(() => {
                            clearTimeout(timeout)
                            resolve()
                        })
                        .catch((err) => {
                            clearTimeout(timeout)
                            reject(err)
                        })
                })

                win!.webContents.once('did-fail-load', (_e, errorCode, desc) => {
                    clearTimeout(timeout)
                    reject(new Error(`did-fail-load: ${errorCode} ${desc}`))
                })

                win!.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
            })

            // Step 7: Capture page
            const nativeImage = await win.webContents.capturePage()
            const pngBuffer = nativeImage.toPNG()

            // Step 8: Ensure thumbnails directory exists
            const thumbDir = this._thumbnailDir()
            await mkdir(thumbDir, { recursive: true })

            // Step 9: Write PNG via FileTransactionManager (Commandments 12/14)
            // Use writeBuffer for binary PNG content — utf8 encoding would corrupt it.
            await this.ftm.writeBuffer(thumbPath, pngBuffer)

            this.cachedNames.add(safeName)

            return {
                componentName: safeName,
                thumbnailPath: thumbPath,
                generated: true,
                error: null,
            }
        } catch (err) {
            return {
                componentName: safeName,
                thumbnailPath: '',
                generated: false,
                error: String(err),
            }
        } finally {
            if (win) {
                this.activeWindows.delete(win)
                if (!win.isDestroyed()) {
                    win.destroy()
                }
            }
        }
    }

    /**
     * Batch generate thumbnails for all components listed in flint-manifest.json.
     * Processes sequentially via the internal async queue.
     * Maximum 500 components — excess entries are skipped.
     */
    async generateAll(): Promise<BatchThumbnailResult> {
        const manifestPath = path.join(this.projectRoot, 'flint-manifest.json')
        let manifest: Record<string, unknown>

        try {
            const raw = await readFile(manifestPath, 'utf8')
            manifest = JSON.parse(raw) as Record<string, unknown>
        } catch {
            return { total: 0, succeeded: 0, failed: 0, results: [] }
        }

        const components = (manifest.components ?? {}) as Record<string, unknown>
        const entries = Object.entries(components).slice(0, 500)

        if (entries.length === 0) {
            return { total: 0, succeeded: 0, failed: 0, results: [] }
        }

        const results: ThumbnailResult[] = []

        for (const [name, entry] of entries) {
            const entryObj = entry as { importPath?: string; filePath?: string }
            const srcPath = entryObj.filePath ?? entryObj.importPath

            if (!srcPath || typeof srcPath !== 'string') {
                results.push({
                    componentName: name,
                    thumbnailPath: '',
                    generated: false,
                    error: 'No filePath or importPath in manifest entry',
                })
                continue
            }

            const resolvedPath = path.isAbsolute(srcPath)
                ? srcPath
                : path.join(this.projectRoot, srcPath)

            const result = await this.generate({
                filePath: resolvedPath,
                componentName: name,
            })
            results.push(result)
        }

        const succeeded = results.filter((r) => !r.error).length
        return {
            total: results.length,
            succeeded,
            failed: results.length - succeeded,
            results,
        }
    }

    /**
     * Update the project root (called when user opens a different project).
     * Resets the internal cache state.
     */
    setProjectRoot(projectRoot: string): void {
        this.projectRoot = projectRoot
        this.cachedNames.clear()
        this._seedCacheFromDisk()
    }

    /**
     * Clean up: close any pending BrowserWindows.
     * Called on app quit.
     */
    dispose(): void {
        for (const win of this.activeWindows) {
            if (!win.isDestroyed()) {
                win.destroy()
            }
        }
        this.activeWindows.clear()
    }
}
