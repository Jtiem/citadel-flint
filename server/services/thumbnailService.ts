/**
 * server/services/thumbnailService.ts — Component Thumbnail Generator (Web Mode)
 *
 * Generates component thumbnails using Puppeteer instead of Electron's
 * offscreen BrowserWindow. This is the web-mode counterpart to the
 * component thumbnail generator in the Electron shell.
 *
 * Thumbnails are rendered by:
 *   1. Reading the component source file
 *   2. Transforming it with Babel (strip imports, wrap in render harness)
 *   3. Creating an HTML page with React UMD that renders the component
 *   4. Launching Puppeteer to screenshot the rendered output
 *   5. Caching the PNG in {projectRoot}/.flint/thumbnails/
 *
 * If Puppeteer is not installed, all operations return graceful errors
 * instead of throwing.
 */

import path from 'node:path'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThumbnailService {
  generate(options: {
    filePath: string
    componentName: string
    projectRoot: string
    width?: number
    height?: number
  }): Promise<{
    componentName: string
    thumbnailPath: string
    generated: boolean
    error: string | null
  }>
  generateAll(projectRoot: string): Promise<{
    total: number
    succeeded: number
    failed: number
    results: Array<{
      componentName: string
      thumbnailPath: string
      generated: boolean
      error: string | null
    }>
  }>
  get(componentName: string, projectRoot: string): Promise<string | null>
  invalidate(componentName: string, projectRoot: string): Promise<void>
}

// ── Constants ──────────────────────────────────────────────────────────────

const LOG_PREFIX = '[Flint]'
const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 300
const THUMBNAIL_DIR = 'thumbnails'
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

// React UMD scripts — loaded from local node_modules (Commandment 4: 100% offline).
// We read the files once at service creation time and inline them into the harness.
let _reactUmdScript: string = ''
let _reactDomUmdScript: string = ''

function loadReactUmd(): void {
  if (_reactUmdScript) return
  try {
    const reactPath = require.resolve('react/umd/react.production.min.js')
    const reactDomPath = require.resolve('react-dom/umd/react-dom.production.min.js')
    _reactUmdScript = readFileSync(reactPath, 'utf8')
    _reactDomUmdScript = readFileSync(reactDomPath, 'utf8')
  } catch {
    // Fallback: try relative node_modules path
    const nmReact = path.join(__dirname, '..', '..', 'node_modules', 'react', 'umd', 'react.production.min.js')
    const nmReactDom = path.join(__dirname, '..', '..', 'node_modules', 'react-dom', 'umd', 'react-dom.production.min.js')
    try {
      _reactUmdScript = readFileSync(nmReact, 'utf8')
      _reactDomUmdScript = readFileSync(nmReactDom, 'utf8')
    } catch {
      console.warn('[Flint] Could not load React UMD scripts from node_modules — thumbnails may fail')
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function thumbnailsDir(projectRoot: string): string {
  return path.join(projectRoot, '.flint', THUMBNAIL_DIR)
}

function thumbnailPath(projectRoot: string, componentName: string): string {
  // Sanitize component name for filesystem safety
  const safeName = componentName.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(thumbnailsDir(projectRoot), `${safeName}.png`)
}

function ensureThumbnailsDir(projectRoot: string): void {
  const dir = thumbnailsDir(projectRoot)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Check if a cached thumbnail exists and is fresh enough to reuse.
 */
function isCacheFresh(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false
    const { mtimeMs } = statSync(filePath)
    return Date.now() - mtimeMs < CACHE_MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * Strip import statements and export keywords from component source code
 * so it can run in a plain <script> tag with React as a global.
 */
function transformForBrowser(source: string, componentName: string): string {
  let code = source

  // Remove all import statements (single-line and multi-line)
  code = code.replace(/^import\s[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '')
  code = code.replace(/^import\s+['"][^'"]*['"];?\s*$/gm, '')

  // Remove TypeScript type imports
  code = code.replace(/^import\s+type\s[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '')

  // Remove TypeScript type annotations (simplified — handles common patterns)
  code = code.replace(/:\s*React\.\w+(<[^>]*>)?/g, '')
  code = code.replace(/:\s*\w+(\[\])?(\s*\|[^=,)}\n]+)?(?=[,)}\n=])/g, '')
  code = code.replace(/<\w+(\s*,\s*\w+)*>/g, '') // generic type params

  // Remove interface/type declarations
  code = code.replace(/^(export\s+)?(interface|type)\s+\w+[\s\S]*?^}/gm, '')

  // Convert `export default function Foo` -> `function Foo`
  code = code.replace(/\bexport\s+default\s+(function|class)\s+/g, '$1 ')

  // Convert `export default Foo` -> (remove)
  code = code.replace(/^export\s+default\s+\w+\s*;?\s*$/gm, '')

  // Remove other export keywords
  code = code.replace(/^export\s+(?!default)/gm, '')

  return code
}

/**
 * Build an HTML page that renders a single component and exposes it
 * for Puppeteer to screenshot.
 */
function buildRenderHarness(componentCode: string, componentName: string, width: number, height: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #root {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
  <script>${_reactUmdScript}<\/script>
  <script>${_reactDomUmdScript}<\/script>
</head>
<body>
  <div id="root"></div>
  <script>
    // Provide common hooks as globals (components may reference them)
    const { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext } = React;

    try {
      ${componentCode}

      // Attempt to render the component
      const Component = typeof ${componentName} === 'function' ? ${componentName} : null;
      if (Component) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
        window.__FLINT_RENDER_OK = true;
      } else {
        document.getElementById('root').innerHTML =
          '<div style="color:#888;font-family:system-ui;font-size:14px;text-align:center">' +
          'Component not found: ${componentName}</div>';
        window.__FLINT_RENDER_OK = false;
      }
    } catch (err) {
      document.getElementById('root').innerHTML =
        '<div style="color:#c00;font-family:system-ui;font-size:12px;padding:16px">' +
        'Render error: ' + err.message + '</div>';
      window.__FLINT_RENDER_OK = false;
    }
  <\/script>
</body>
</html>`
}

/**
 * Attempt to dynamically import Playwright chromium. Returns null if not available.
 */
async function loadPlaywright(): Promise<any | null> {
  try {
    const pw = await import('playwright')
    return pw.chromium ?? null
  } catch {
    return null
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createThumbnailService(): ThumbnailService {
  loadReactUmd()
  return {
    async generate(options): Promise<{
      componentName: string
      thumbnailPath: string
      generated: boolean
      error: string | null
    }> {
      const {
        filePath,
        componentName,
        projectRoot,
        width = DEFAULT_WIDTH,
        height = DEFAULT_HEIGHT,
      } = options

      const outPath = thumbnailPath(projectRoot, componentName)

      // Check cache first
      if (isCacheFresh(outPath)) {
        return {
          componentName,
          thumbnailPath: outPath,
          generated: true,
          error: null,
        }
      }

      // Verify the source file exists
      if (!existsSync(filePath)) {
        return {
          componentName,
          thumbnailPath: '',
          generated: false,
          error: `Source file not found: ${filePath}`,
        }
      }

      // Load Playwright
      const chromium = await loadPlaywright()
      if (!chromium) {
        return {
          componentName,
          thumbnailPath: '',
          generated: false,
          error: 'Playwright is not installed. Run `npm install playwright` to enable thumbnail generation.',
        }
      }

      let browser: any = null

      try {
        // Read and transform the component source
        const source = readFileSync(filePath, 'utf8')
        const transformed = transformForBrowser(source, componentName)
        const html = buildRenderHarness(transformed, componentName, width, height)

        // Launch headless browser
        browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        })

        const page = await browser.newPage()
        await page.setViewportSize({ width, height })

        // Load the HTML content
        await page.setContent(html, { waitUntil: 'networkidle', timeout: 15_000 })

        // Wait a brief moment for React to finish rendering
        await page.waitForFunction('window.__FLINT_RENDER_OK !== undefined', { timeout: 10_000 })

        // Take the screenshot
        ensureThumbnailsDir(projectRoot)
        await page.screenshot({
          path: outPath,
          type: 'png',
          clip: { x: 0, y: 0, width, height },
        })

        console.log(`${LOG_PREFIX} Thumbnail generated: ${componentName} -> ${outPath}`)

        return {
          componentName,
          thumbnailPath: outPath,
          generated: true,
          error: null,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`${LOG_PREFIX} Thumbnail generation failed for ${componentName}:`, message)
        return {
          componentName,
          thumbnailPath: '',
          generated: false,
          error: message,
        }
      } finally {
        if (browser) {
          try { await browser.close() } catch { /* already closed */ }
        }
      }
    },

    async generateAll(projectRoot: string): Promise<{
      total: number
      succeeded: number
      failed: number
      results: Array<{
        componentName: string
        thumbnailPath: string
        generated: boolean
        error: string | null
      }>
    }> {
      // Read the flint-manifest.json to discover components
      const manifestPath = path.join(projectRoot, 'flint-manifest.json')

      if (!existsSync(manifestPath)) {
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          results: [],
        }
      }

      let components: Array<{ name: string; filePath: string }> = []

      try {
        const raw = readFileSync(manifestPath, 'utf8')
        const manifest = JSON.parse(raw) as Record<string, unknown>
        const comps = (manifest.components ?? {}) as Record<string, unknown>

        components = Object.entries(comps)
          .filter(([, entry]) => {
            const e = entry as Record<string, unknown>
            return typeof e.filePath === 'string'
          })
          .map(([name, entry]) => ({
            name,
            filePath: (entry as Record<string, unknown>).filePath as string,
          }))
      } catch (err) {
        console.error(`${LOG_PREFIX} Failed to read manifest:`, err)
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          results: [],
        }
      }

      const results: Array<{
        componentName: string
        thumbnailPath: string
        generated: boolean
        error: string | null
      }> = []

      // Generate thumbnails sequentially to avoid overwhelming the system
      for (const comp of components) {
        const result = await this.generate({
          filePath: path.isAbsolute(comp.filePath)
            ? comp.filePath
            : path.join(projectRoot, comp.filePath),
          componentName: comp.name,
          projectRoot,
        })
        results.push(result)
      }

      const succeeded = results.filter((r) => r.generated).length
      const failed = results.filter((r) => !r.generated).length

      console.log(
        `${LOG_PREFIX} Thumbnail generation complete: ${succeeded}/${results.length} succeeded, ${failed} failed`,
      )

      return {
        total: results.length,
        succeeded,
        failed,
        results,
      }
    },

    async get(componentName: string, projectRoot: string): Promise<string | null> {
      const pngPath = thumbnailPath(projectRoot, componentName)

      if (!existsSync(pngPath)) {
        return null
      }

      try {
        const buffer = await readFile(pngPath)
        return `data:image/png;base64,${buffer.toString('base64')}`
      } catch {
        return null
      }
    },

    async invalidate(componentName: string, projectRoot: string): Promise<void> {
      const pngPath = thumbnailPath(projectRoot, componentName)

      if (existsSync(pngPath)) {
        try {
          unlinkSync(pngPath)
          console.log(`${LOG_PREFIX} Thumbnail invalidated: ${componentName}`)
        } catch (err) {
          console.error(`${LOG_PREFIX} Failed to invalidate thumbnail for ${componentName}:`, err)
        }
      }
    },
  }
}
