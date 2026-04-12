/**
 * visualAuditor.ts — Phase P7: Visual Regression Driving AST Mutation (Glass-only)
 *
 * Headless renderer that compiles a TSX component in-memory, renders it into a
 * hidden BrowserWindow, measures the bounding boxes of each `data-flint-id`-tagged
 * element via `getBoundingClientRect()`, and compares them against the expected
 * Figma AST bounding boxes. Emits VISUAL-REG-001 violations when any element
 * diverges by more than the configured tolerance (default 2px) in width or height.
 *
 * This is Glass-only — the MCP server delegates here via IPC. The headless
 * MCP process cannot spawn an Electron BrowserWindow.
 *
 * Security:
 *   - BrowserWindow: nodeIntegration: false, contextIsolation: true, sandbox: true.
 *   - Component source is transformed via Babel into sandboxed JS. No remote URLs.
 *   - The HTML shell is loaded via a `data:` URL — no disk or network load.
 *
 * Electron Main Process only — never import from src/.
 */

import { BrowserWindow } from 'electron'
import { transformSync } from '@babel/core'

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * A single expected bounding box for a `data-flint-id`-tagged element.
 * Sourced from the Figma AST payload during ingestion.
 */
export interface ExpectedBox {
    flintId: string
    width: number
    height: number
    x: number
    y: number
}

export interface VisualAuditInput {
    /** Full TSX component source code. */
    componentCode: string
    /** Component name (PascalCase). Used for logging + rendering. */
    componentName: string
    /** Expected bounding boxes from the Figma AST payload. */
    expectedBoxes: ExpectedBox[]
    /** Pixel tolerance per dimension. Defaults to 2px. */
    tolerance?: number
    /** Viewport width for the hidden BrowserWindow. Default: 1440. */
    viewportWidth?: number
    /** Viewport height for the hidden BrowserWindow. Default: 900. */
    viewportHeight?: number
}

/**
 * A single visual regression violation. One per `flintId` that drifts beyond
 * tolerance, or per element that fails to render at all.
 */
export interface VisualViolation {
    flintId: string
    /** Flint rule id — always VISUAL-REG-001 for now. */
    ruleId: 'VISUAL-REG-001'
    /** Human-readable message explaining the drift. */
    message: string
    expected: { width: number; height: number }
    actual: { width: number; height: number }
    /** Maximum absolute pixel delta between expected and actual dimensions. */
    deltaPx: number
    /** Advisory CSS suggestion produced by the feedback loop. */
    suggestion: string | null
}

export interface VisualAuditResult {
    /** True when rendering completed and all elements matched within tolerance. */
    ok: boolean
    /** All elements that diverged beyond tolerance. */
    violations: VisualViolation[]
    /** Non-null when the audit could not run (transform error, render timeout, etc.). */
    error: string | null
}

// ── Babel transform ──────────────────────────────────────────────────────────

/**
 * Transforms TSX into sandboxed JS that assigns the default export to
 * `window.__FlintVisualComponent`. Mirrors the thumbnail generator's transform
 * but with a distinct global to avoid collision.
 *
 * Never throws — returns { js, error }.
 */
export function transformVisualSource(source: string): { js: string | null; error: string | null } {
    try {
        const result = transformSync(source, {
            filename: 'VisualComponent.tsx',
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

        // Strip ES module imports — the harness provides React globally.
        js = js.replace(/^import\s[^\n]*\n?/gm, '')

        let componentName: string | null = null
        js = js.replace(
            /\bexport\s+default\s+(function|class)\s+(\w+)/,
            (_m: string, kw: string, name: string) => {
                componentName = name
                return `${kw} ${name}`
            }
        )

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
            js += `\nwindow.__FlintVisualComponent = ${componentName};`
        } else {
            return { js: null, error: 'No default export found' }
        }

        return { js, error: null }
    } catch (err) {
        return { js: null, error: String(err) }
    }
}

// ── HTML shell ───────────────────────────────────────────────────────────────

/**
 * Builds a minimal HTML shell that renders the transformed component and
 * exposes a measurement function `__flintMeasure(flintIds)` for the main
 * process to call via executeJavaScript().
 *
 * The shell uses offline React globals — no CDN, no external resources.
 */
export function buildVisualHarnessHtml(
    transformedJs: string,
    reactUMD: string,
    reactDOMUMD: string
): string {
    const safeJson = JSON.stringify(transformedJs).replace(/</g, '\\u003c')
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" />
  <script>${reactUMD}<\/script>
  <script>${reactDOMUMD}<\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: white; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script id="__code" type="application/json">${safeJson}<\/script>
  <script>
    var { useState, useEffect, useRef, useMemo, useCallback, useContext,
          useReducer, useLayoutEffect, useId, Fragment, createContext,
          forwardRef, memo } = React;
  <\/script>
  <script>
    (function() {
      try {
        var encoded = document.getElementById('__code').textContent;
        var js = JSON.parse(encoded);
        new Function(js)();
        if (window.__FlintVisualComponent) {
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(window.__FlintVisualComponent));
        }
      } catch (e) {
        window.__flintRenderError = String(e && e.message || e);
      }
    })();

    // Measurement hook — invoked from the main process via executeJavaScript.
    window.__flintMeasure = function(flintIds) {
      var out = {};
      for (var i = 0; i < flintIds.length; i++) {
        var id = flintIds[i];
        var el = document.querySelector('[data-flint-id="' + id.replace(/"/g, '\\\\"') + '"]');
        if (!el) { out[id] = null; continue; }
        var r = el.getBoundingClientRect();
        out[id] = { width: r.width, height: r.height, x: r.x, y: r.y };
      }
      return { boxes: out, renderError: window.__flintRenderError || null };
    };
  <\/script>
</body>
</html>`
}

// ── Feedback loop: CSS suggestions ───────────────────────────────────────────

/**
 * Given an expected vs actual bounding box, suggest an advisory CSS fix.
 * Advisory only — never auto-applied.
 *
 * - Width overflow → overflow-hidden or min-w-0
 * - Width collapse → flex-shrink-0
 * - Height collapse → flex-shrink-0
 * - Positional drift → flex-none
 */
export function suggestCssFix(expected: ExpectedBox, actual: { width: number; height: number; x: number; y: number }): string | null {
    const widthDelta = actual.width - expected.width
    const heightDelta = actual.height - expected.height
    const posDelta = Math.max(Math.abs(actual.x - expected.x), Math.abs(actual.y - expected.y))

    if (widthDelta > 2) {
        return 'Width exceeds expected — consider adding `overflow-hidden` or `min-w-0` to the parent.'
    }
    if (widthDelta < -2) {
        return 'Width collapsed below expected — consider adding `flex-shrink-0` to prevent shrinking.'
    }
    if (heightDelta < -2) {
        return 'Height collapsed below expected — consider adding `flex-shrink-0` to preserve vertical sizing.'
    }
    if (posDelta > 2) {
        return 'Positional drift detected — consider adding `flex-none` to lock the layout slot.'
    }
    return null
}

// ── Pure comparison helper ───────────────────────────────────────────────────

/**
 * Pure function that diffs expected vs measured boxes and produces violations.
 * Extracted for direct unit testing without a BrowserWindow.
 */
export function diffBoxes(
    expectedBoxes: ExpectedBox[],
    measured: Record<string, { width: number; height: number; x: number; y: number } | null>,
    tolerance: number
): VisualViolation[] {
    const violations: VisualViolation[] = []

    for (const expected of expectedBoxes) {
        const actual = measured[expected.flintId]

        if (actual == null) {
            violations.push({
                flintId: expected.flintId,
                ruleId: 'VISUAL-REG-001',
                message: `Element with data-flint-id="${expected.flintId}" was not rendered in the visual harness.`,
                expected: { width: expected.width, height: expected.height },
                actual: { width: 0, height: 0 },
                deltaPx: Math.max(expected.width, expected.height),
                suggestion: null,
            })
            continue
        }

        const widthDelta = Math.abs(actual.width - expected.width)
        const heightDelta = Math.abs(actual.height - expected.height)
        const deltaPx = Math.max(widthDelta, heightDelta)

        if (deltaPx > tolerance) {
            violations.push({
                flintId: expected.flintId,
                ruleId: 'VISUAL-REG-001',
                message:
                    `Visual regression on "${expected.flintId}": ` +
                    `expected ${expected.width}×${expected.height}px, ` +
                    `rendered ${actual.width.toFixed(1)}×${actual.height.toFixed(1)}px ` +
                    `(Δ ${deltaPx.toFixed(1)}px > tolerance ${tolerance}px).`,
                expected: { width: expected.width, height: expected.height },
                actual: { width: actual.width, height: actual.height },
                deltaPx,
                suggestion: suggestCssFix(expected, actual),
            })
        }
    }

    return violations
}

// ── Main audit entry point ───────────────────────────────────────────────────

/**
 * Vendor file loader — resolved lazily so the module can be imported in tests
 * without the full Electron app harness. The caller supplies the React UMD
 * bundles (already cached by the thumbnail generator in production).
 */
export type VendorLoader = () => Promise<{ reactUMD: string; reactDOMUMD: string }>

/**
 * Run a visual audit. Spawns a hidden BrowserWindow, renders the component,
 * measures bounding boxes, and diffs them against the Figma-sourced expected
 * boxes. Returns violations — never throws.
 */
export async function runVisualAudit(
    input: VisualAuditInput,
    loadVendor: VendorLoader
): Promise<VisualAuditResult> {
    const tolerance = input.tolerance ?? 2
    const viewportWidth = input.viewportWidth ?? 1440
    const viewportHeight = input.viewportHeight ?? 900

    if (input.expectedBoxes.length === 0) {
        return { ok: true, violations: [], error: null }
    }

    const { js, error: transformError } = transformVisualSource(input.componentCode)
    if (transformError || !js) {
        return { ok: false, violations: [], error: transformError ?? 'Babel returned no output' }
    }

    let vendor: { reactUMD: string; reactDOMUMD: string }
    try {
        vendor = await loadVendor()
    } catch (err) {
        return { ok: false, violations: [], error: `Vendor load failed: ${String(err)}` }
    }

    const html = buildVisualHarnessHtml(js, vendor.reactUMD, vendor.reactDOMUMD)

    let win: BrowserWindow | null = null
    try {
        win = new BrowserWindow({
            width: viewportWidth,
            height: viewportHeight,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                offscreen: true,
                devTools: false,
            },
        })

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Visual audit render timeout')), 10_000)
            win!.webContents.once('did-finish-load', () => {
                win!.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(r))')
                    .then(() => { clearTimeout(timeout); resolve() })
                    .catch((err) => { clearTimeout(timeout); reject(err) })
            })
            win!.webContents.once('did-fail-load', (_e, code, desc) => {
                clearTimeout(timeout)
                reject(new Error(`did-fail-load: ${code} ${desc}`))
            })
            win!.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        })

        const flintIds = input.expectedBoxes.map((b) => b.flintId)
        const measurement = await win.webContents.executeJavaScript(
            `window.__flintMeasure(${JSON.stringify(flintIds)})`
        ) as {
            boxes: Record<string, { width: number; height: number; x: number; y: number } | null>
            renderError: string | null
        }

        if (measurement.renderError) {
            return { ok: false, violations: [], error: `Render error: ${measurement.renderError}` }
        }

        const violations = diffBoxes(input.expectedBoxes, measurement.boxes, tolerance)
        return { ok: violations.length === 0, violations, error: null }
    } catch (err) {
        return { ok: false, violations: [], error: String(err) }
    } finally {
        if (win && !win.isDestroyed()) {
            win.destroy()
        }
    }
}
