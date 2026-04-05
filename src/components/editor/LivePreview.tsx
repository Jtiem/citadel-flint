/**
 * LivePreview — src/components/editor/LivePreview.tsx
 *
 * Renders the current editor code in a sandboxed srcdoc iframe.
 *
 * Flow:
 *   1. `rawCode` (TSX) is sent to the Electron main process via IPC.
 *   2. Main process transforms it with Babel (TypeScript → plain JS,
 *      JSX → React.createElement), strips `import` statements, and rewrites
 *      `export default` so the component is assigned to `window.__AppComponent`.
 *   3. The resulting JS is embedded in a self-contained HTML document that inlines
 *      React 18, ReactDOM, and Tailwind Play CDN as bundled strings (100% offline),
 *      then renders `window.__AppComponent` into a `#root` div.
 *   4. Design tokens from SQLite are injected as a `tailwind.config` extension
 *      so custom token classes (e.g. `bg-brand-primary`) resolve immediately.
 *
 * React 18 UMD and Tailwind Play CDN are bundled locally (src/preview-vendor/) —
 * the preview is 100% offline with no external network dependency.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { BRAND } from '../../../shared/brand'
import reactUMD from '../../preview-vendor/react.prod.js?raw'
import reactDOMUMD from '../../preview-vendor/react-dom.prod.js?raw'
import tailwindCDN from '../../preview-vendor/tailwind-cdn.js?raw'
import vueUMD from '../../preview-vendor/vue.global.prod.txt?raw'
import {
  FLINT_INTERACTION_SCRIPT,
  FLINT_INTERACTION_STYLES,
} from '../../preview-vendor/flint-interaction'
import {
  getLibraryShims,
  getGenericShims,
  type LibraryShimBundle,
} from '../../preview-vendor/shims/index'
import { MousePointer2, Hand, Loader2, AlertTriangle } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useTokenStore } from '../../store/tokenStore'
import { useCanvasStore } from '../../store/canvasStore'
import { BREAKPOINT_WIDTHS } from '../../store/canvasStore'
import { useImportSummaryStore } from '../../store/importSummaryStore'
import type { DropPosition } from '../../utils/astModifier'
import { generateTailwindConfig } from '../../utils/tokenAdapter'
import {
  parseCodeToAST,
  injectFlintIds,
  generateCodeFromAST,
} from '../../core/ast-parser'
import { LanguageRegistry } from '../../core/adapters/types'
import { vueAdapter } from '../../core/adapters/VueAdapter'
import {
  publishPresence,
  publishPresenceImmediate,
} from '../../services/PresenceService'
import { useRemotePresence, useLockedNodeIds } from '../../hooks/useRemotePresence'

// ── MED-01: Restrict postMessage target origin to iframe origin ───────────────

/**
 * Returns the origin of the current preview URL so postMessage calls use the
 * principle of least privilege instead of the wildcard '*'.
 *
 * srcdoc iframes have an opaque origin — the string 'null' is NOT a valid postMessage
 * target origin (only '*' or a serialized origin are valid per the HTML spec).
 * For srcdoc mode we must use '*'. When a Vite preview URL is active we use its origin.
 */
function getIframeOrigin(previewUrl: string | null): string {
  if (previewUrl == null) return '*'
  try {
    return new URL(previewUrl).origin
  } catch {
    return '*'
  }
}

// ── srcdoc builder ────────────────────────────────────────────────────────────

/**
 * Wraps transformed JS in a full HTML document that:
 *  - Loads React 18 + ReactDOM 18 as UMD globals from unpkg.
 *  - Injects Tailwind CSS via CDN for class-based styling.
 *  - Applies a custom Tailwind config (colors, spacing) derived from the
 *    app's design token store so token-named classes render correctly.
 *  - Embeds the JS in a `<script type="application/json">` block so that
 *    `</script>` sequences inside the code cannot break the HTML parser.
 *  - Executes it with `new Function()` (covered by `'unsafe-eval'` in CSP)
 *    and renders the exported component into `#root`.
 *
 * @param js               Babel-transformed component JS ready to execute.
 * @param tailwindConfigJson  JSON string produced by `generateTailwindConfig`.
 *                            Applied via `tailwind.config = ...` after CDN load.
 * @param libraryShims     Optional library-specific shim bundle. When provided,
 *                         its CSS variables are injected in <head> and its
 *                         component shims override any matching generic stubs.
 *                         Pass null to use generic stubs only (default behaviour).
 */
export function buildSrcdoc(
  js: string,
  tailwindConfigJson: string,
  libraryShims: LibraryShimBundle | null,
): string {
  // JSON.stringify produces a string safe to embed inside a script tag.
  // Replace bare `<` with its Unicode escape so `</script>` in string
  // literals can never terminate the enclosing script element.
  const safeJson = JSON.stringify(js).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${reactUMD}<\/script>
  <script>${reactDOMUMD}<\/script>
  <script>${tailwindCDN}<\/script>
  <script>tailwind.config = ${tailwindConfigJson};<\/script>
  ${libraryShims ? `<style>${libraryShims.cssVars}<\/style>` : ''}
  <style>${FLINT_INTERACTION_STYLES}<\/style>
</head>
<body style="margin:0;background:#fff">
  <div id="root"></div>
  <script id="__code" type="application/json">${safeJson}<\/script>
  <script>
    // Expose React named exports as globals so stripped import statements resolve.
    // e.g. "import { useState } from 'react'" is stripped by the transform, but
    // the code still calls useState(...) -- this makes it work.
    var { useState, useEffect, useRef, useMemo, useCallback, useContext,
          useReducer, useLayoutEffect, useId, Fragment, createContext,
          forwardRef, memo, cloneElement, Children, isValidElement } = React;
  <\/script>
  <script>
    // Generic component stubs — always loaded as the base layer.
    // Library-specific shims (below) override any matching component name.
    ${getGenericShims().shimSource.replace(/<\/script>/g, '<\\/script>')}
  <\/script>
  ${libraryShims ? `<script>
    // Library-specific shims: ${libraryShims.displayName} (${libraryShims.componentCount} components)
    // These override the generic stubs above for matching component names.
    ${libraryShims.shimSource.replace(/<\/script>/g, '<\\/script>')}
  <\/script>` : ''}
  <script>
    (function () {
      var root = document.getElementById('root');
      try {
        var code = JSON.parse(document.getElementById('__code').textContent || '');
        // Execute the transformed component code in global scope.
        // React / ReactDOM are UMD globals; window.__AppComponent is set by the code.
        // eslint-disable-next-line no-new-func
        (new Function(code))();
        if (typeof window.__AppComponent !== 'undefined') {
          ReactDOM.createRoot(root).render(React.createElement(window.__AppComponent, null));
        } else {
          root.innerHTML = '<p style="color:#94a3b8;font-size:12px">No default export found.</p>';
        }
      } catch (e) {
        var _pre = document.createElement('pre'); _pre.style.cssText = 'color:#f87171;font-size:12px'; _pre.textContent = String(e); root.innerHTML = ''; root.appendChild(_pre);
      }
    })();
  <\/script>
  <script>${FLINT_INTERACTION_SCRIPT}<\/script>
</body>
</html>`
}

// ── HTML srcdoc builder (Phase N.2) ─────────────────────────────────────────────

/**
 * Wraps a raw HTML string (with data-flint-id attributes pre-injected)
 * in a minimal srcdoc document that includes the vendored Tailwind CDN and the
 * shared Flint interaction proxy script (click-to-select, hover, drag).
 *
 * MFP.1: Fixed Commandment 4 violation — replaced cdn.tailwindcss.com external
 * URL with the locally-vendored tailwind-cdn.js (same as buildSrcdoc does).
 */
export function buildHtmlSrcdoc(htmlCode: string, tailwindConfigJson: string): string {
  // Extract <body style="margin:0;background:#fff"> inner content to avoid duplicating the outer <html>/<head>.
  const bodyMatch = htmlCode.match(/<body[^>]*>([\u200b\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlCode

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${tailwindCDN}<\/script>
  <script>tailwind.config = ${tailwindConfigJson};<\/script>
  <style>${FLINT_INTERACTION_STYLES}<\/style>
<\/head>
<body style="margin:0;background:#fff">
  ${bodyContent}
  <script>${FLINT_INTERACTION_SCRIPT}<\/script>
<\/body>
<\/html>`
}

// ── Vue 3 srcdoc builder (MFP.2) ─────────────────────────────────────────────

/**
 * Wraps compiled Vue 3 component JS in a sandboxed srcdoc document that:
 *  - Inlines the vendored Vue 3 UMD production runtime (`vue.global.prod.js`).
 *  - Injects Tailwind CSS via the vendored CDN build.
 *  - Applies the design-token-derived Tailwind config (same as React path).
 *  - Injects extracted <style> block CSS.
 *  - Executes the compiled component with `new Function()` and mounts via
 *    `Vue.createApp(window.__VueComponent).mount('#app')`.
 *  - Appends the shared Flint interaction proxy script last.
 *
 * @param js                Compiled Vue component JS from `code:transform-vue` IPC.
 * @param css               Extracted <style> block CSS, or empty string.
 * @param tailwindConfigJson  JSON string produced by `generateTailwindConfig`.
 */
export function buildVueSrcdoc(
  js: string,
  css: string,
  tailwindConfigJson: string,
): string {
  // JSON-safe embedding: escape </script> sequences and bare `<` chars so that
  // `</script>` inside the compiled code cannot terminate the enclosing script.
  const safeJson = JSON.stringify(js).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${vueUMD}<\/script>
  <script>${tailwindCDN}<\/script>
  <script>tailwind.config = ${tailwindConfigJson};<\/script>
  <style>${FLINT_INTERACTION_STYLES}<\/style>
  ${css ? `<style>${css}<\/style>` : ''}
<\/head>
<body style="margin:0;background:#fff">
  <div id="app"></div>
  <script id="__vue_code" type="application/json">${safeJson}<\/script>
  <script>
    (function () {
      var appEl = document.getElementById('app');
      try {
        var code = JSON.parse(document.getElementById('__vue_code').textContent || '');
        // eslint-disable-next-line no-new-func
        (new Function(code))();
        if (typeof window.__VueComponent !== 'undefined' && typeof Vue !== 'undefined') {
          Vue.createApp(window.__VueComponent).mount('#app');
        } else if (typeof Vue === 'undefined') {
          appEl.innerHTML = '<pre style="color:#f87171;font-size:12px">Vue runtime not loaded.<\/pre>';
        } else {
          appEl.innerHTML = '<p style="color:#94a3b8;font-size:12px">No Vue component exported.<\/p>';
        }
      } catch (e) {
        var _pre = document.createElement('pre'); _pre.style.cssText = 'color:#f87171;font-size:12px'; _pre.textContent = String(e); appEl.innerHTML = ''; appEl.appendChild(_pre);
      }
    })();
  <\/script>
  <script>${FLINT_INTERACTION_SCRIPT}<\/script>
<\/body>
<\/html>`
}

// ── Svelte srcdoc builder (MFP.3) ────────────────────────────────────────────

/**
 * Wraps compiled Svelte component JS in a sandboxed srcdoc document that:
 *  - Does NOT include any Svelte runtime — Svelte compiles to vanilla JS.
 *  - Injects Tailwind CSS via the vendored CDN build.
 *  - Applies the design-token-derived Tailwind config (same as React/Vue paths).
 *  - Injects extracted <style> block CSS.
 *  - Executes the compiled component JS (which assigns `window.__SvelteComponent`)
 *    and mounts via the constructor call appended by svelteCompiler.ts.
 *  - Appends the shared Flint interaction proxy script last.
 *
 * Key advantage over Vue: no runtime script tag is needed. The iframe is smaller
 * and faster to initialize because the compiled output is pure DOM API calls.
 *
 * @param js                Compiled Svelte component JS from `code:transform-svelte` IPC.
 *                          Already contains the mount call; just needs to execute.
 * @param css               Extracted <style> block CSS, or empty string.
 * @param tailwindConfigJson  JSON string produced by `generateTailwindConfig`.
 */
export function buildSvelteSrcdoc(
  js: string,
  css: string,
  tailwindConfigJson: string,
): string {
  // JSON-safe embedding: escape </script> sequences and bare `<` chars so that
  // `</script>` inside the compiled code cannot terminate the enclosing script.
  const safeJson = JSON.stringify(js).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${tailwindCDN}<\/script>
  <script>tailwind.config = ${tailwindConfigJson};<\/script>
  <style>${FLINT_INTERACTION_STYLES}<\/style>
  ${css ? `<style>${css}<\/style>` : ''}
<\/head>
<body style="margin:0;background:#fff">
  <div id="app"></div>
  <script id="__svelte_code" type="application/json">${safeJson}<\/script>
  <script>
    (function () {
      var appEl = document.getElementById('app');
      try {
        var code = JSON.parse(document.getElementById('__svelte_code').textContent || '');
        // Execute the compiled Svelte component (sets window.__SvelteComponent
        // and runs the inline mount call appended by svelteCompiler.ts).
        // eslint-disable-next-line no-new-func
        (new Function(code))();
      } catch (e) {
        if (appEl) var _pre = document.createElement('pre'); _pre.style.cssText = 'color:#f87171;font-size:12px'; _pre.textContent = String(e); appEl.innerHTML = ''; appEl.appendChild(_pre);
      }
    })();
  <\/script>
  <script>${FLINT_INTERACTION_SCRIPT}<\/script>
<\/body>
<\/html>`
}

// ── Placeholder srcdoc builder (MFP.1) ────────────────────────────────────────

/**
 * Renders a "framework not yet available" message for preview paths that are
 * not yet implemented (Vue — MFP.2, Svelte — MFP.3).
 *
 * @param framework  Human-readable framework name, e.g. "Vue" or "Svelte".
 */
export function buildPlaceholderSrcdoc(framework: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: #111827; color: #f9fafb; font-family: system-ui, sans-serif; }
  <\/style>
<\/head>
<body style="margin:0;background:#fff">
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#9ca3af;font-family:system-ui">
    <p>${framework} preview \u2014 install @vue/compiler-sfc or svelte to enable</p>
  <\/div>
<\/body>
<\/html>`
}


export function LivePreview() {
  const rawCode = useEditorStore((state) => state.rawCode)
  const setCode = useEditorStore((state) => state.setCode)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const setSelectedNode = useEditorStore((state) => state.setSelectedNode)
  const hoveredId = useEditorStore((state) => state.hoveredId)
  const setHoveredId = useEditorStore((state) => state.setHoveredId)
  const tokens = useTokenStore((state) => state.tokens)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [transformError, setTransformError] = useState<string | null>(null)

  // ── GLASS.3.1A: Transform loading indicator ──────────────────────────────
  const [isTransforming, setIsTransforming] = useState(false)

  // ── GLASS.3.1B: Stale preview indicator ──────────────────────────────────
  // Tracks whether the source code has changed since the last successful
  // srcdoc update. Becomes true when previewCode changes, cleared when the
  // iframe srcdoc is actually set.
  const [isStale, setIsStale] = useState(false)
  // Monotonic counter — incremented on each source change so the transform
  // callback can detect outdated results without a stale closure.
  const codeVersionRef = useRef(0)
  const renderedVersionRef = useRef(0)

  // ── GLASS.3.1C: Error formatting — expand toggle ────────────────────────
  const [errorExpanded, setErrorExpanded] = useState(false)

  // ── Phase D2C.3: Active library for shim injection ─────────────────────────
  // Read the active library via the existing `scope:get-active-library` IPC channel.
  // Stored as local component state — no store changes needed.
  const [activeLibrary, setActiveLibrary] = useState<string | null>(null)

  useEffect(() => {
    window.flintAPI?.scope?.getActiveLibrary?.()
      .then((result: { library: string | null }) => {
        setActiveLibrary(result?.library ?? null)
      })
      .catch(() => {
        // Non-fatal: fall back to generic stubs
      })
  }, [])

  // ── Phase REM.2.2: Governance Autopilot diff toggle ─────────────────────
  const autopilotEnabled = useCanvasStore((s) => s.autopilotEnabled)
  const governedCode = useCanvasStore((s) => s.governedCode)
  const governedFixCount = useCanvasStore((s) => s.governedFixCount)
  const [showGoverned, setShowGoverned] = useState(false)

  // Reset to original view whenever governed code is cleared
  useEffect(() => {
    if (!governedCode) setShowGoverned(false)
  }, [governedCode])

  // The code passed to the transform pipeline: governed or original.
  const previewCode = (showGoverned && governedCode) ? governedCode : rawCode

  // ── Ghost Proxy drag state + canvas selection ─────────────────────────────
  const { dragSourceId, startDrag, endDrag, setActiveSelection } = useCanvasStore()
  const canvasMode = useCanvasStore((s) => s.canvasMode)
  const setCanvasMode = useCanvasStore((s) => s.setCanvasMode)
  const previewBreakpoint = useCanvasStore((s) => s.previewBreakpoint)
  const workspaceFiles = useCanvasStore((s) => s.workspaceFiles)
  const moveLayerNode = useEditorStore((s) => s.moveLayerNode)
  const isDragging = dragSourceId !== null
  /** Stable ref so Shield callbacks never capture a stale sourceId. */
  const dragSourceIdRef = useRef<string | null>(null)
  /** requestAnimationFrame handle — throttles DRAG_MOVE postMessages. */
  const rafRef = useRef<number | null>(null)
  /** Ghost position in Shield (host) coordinate space — null when hidden. */
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  /** Remote users' active presence rows — polled at 5 Hz for cursor overlay. */
  const remotePresence = useRemotePresence()
  /** Phase C.2: Set of node IDs currently held by remote users — locks the canvas. */
  const lockedNodeIds = useLockedNodeIds()
  /** Stable ref so the message handler always reads the latest locked set. */
  const lockedNodeIdsRef = useRef<Set<string>>(lockedNodeIds)
  useEffect(() => { lockedNodeIdsRef.current = lockedNodeIds }, [lockedNodeIds])

  // ── Phase N.4: Vite Preview Server lifecycle ────────────────────────────
  //
  // When a project folder is opened (workspaceFiles is non-null), start the
  // programmatic Vite dev server pointed at the project root. The iframe will
  // load the resulting URL as `src` instead of the Babel/srcdoc path.
  //
  // When the project is closed (workspaceFiles becomes null), or when this
  // component unmounts, stop the server gracefully.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  /** CV2.5: True while a component card is being dragged over the preview area. */
  const [isCardDragOver, setIsCardDragOver] = useState(false)

  // ── Smart Insert (CV2.5+) ─────────────────────────────────────────────────
  // visualTree drives the Smart Insert panel shown when a card is dragged over.
  const visualTree = useEditorStore((s) => s.visualTree)

  /**
   * The component card data captured on dragEnter. Null when no card is in flight.
   * We store it here (not in onDrop) so the panel rows can close correctly
   * whether the user drops on a panel row or on the iframe fallback.
   */
  const [pendingCardDrag, setPendingCardDrag] = useState<{
    name: string
    importPath: string
  } | null>(null)

  /** ID of the Smart Insert row the user is hovering over, for highlight. */
  const [smartHoveredId, setSmartHoveredId] = useState<string | null>(null)

  /**
   * Inserts the pending card component at the given target node.
   * Falls back silently if no pending drag data is present.
   */
  const handleSmartDrop = useCallback(
    (targetNodeId: string) => {
      if (!pendingCardDrag) return
      const { name, importPath } = pendingCardDrag
      setPendingCardDrag(null)
      setIsCardDragOver(false)
      setSmartHoveredId(null)
      useEditorStore.getState().applyBatch([
        {
          op: 'injectComponent',
          targetNodeId,
          jsxSnippet: `<${name} />`,
          importSnippet: `import { ${name} } from '${importPath}';`,
        },
      ])
    },
    [pendingCardDrag],
  )

  // Track the last project root we started the preview for so we don't
  // restart on every remount (React Strict Mode double-fires effects).
  const lastPreviewRoot = useRef<string | null>(null)

  useEffect(() => {
    const api = window.flintAPI?.preview
    if (!api) return

    if (workspaceFiles == null) {
      if (lastPreviewRoot.current !== null) {
        lastPreviewRoot.current = null
        void api.stop().then(() => setPreviewUrl(null))
      }
      return
    }

    const projectRoot = workspaceFiles.path

    // Skip if we already started the preview for this exact path.
    if (projectRoot === lastPreviewRoot.current) return

    lastPreviewRoot.current = projectRoot
    void api.start(projectRoot).then((result) => {
      if ('error' in result) {
        console.warn('[Flint] Vite preview failed to start:', result.error)
        setPreviewUrl(null)
      } else {
        setPreviewUrl(result.url)
      }
    })

    // Cleanup only resets state — don't stop the server on every unmount
    // because Strict Mode double-fires. The server is stopped when the
    // path actually changes (above) or on null workspace (above).
    return () => {
      setPreviewUrl(null)
    }
  }, [workspaceFiles?.path])

  // Re-compute only when the token list changes, not on every render.
  const tailwindConfigJson = useMemo(() => generateTailwindConfig(tokens), [tokens])

  // GLASS.3.1B: Mark stale whenever the source code changes.
  useEffect(() => {
    codeVersionRef.current += 1
    setIsStale(true)
    // Reset error expand state on new source code
    setErrorExpanded(false)
  }, [previewCode])

  useEffect(() => {
    let cancelled = false

    // GLASS.3.1A: Track the code version this transform was started for.
    const thisVersion = codeVersionRef.current

    // ── MFP.1: Framework dispatch — route by file extension ───────────────
    const activeFilePath = useCanvasStore.getState().activeFilePath ?? ''
    const ext = activeFilePath.split('.').pop()?.toLowerCase() ?? ''

    switch (ext) {
      // ── .html: Phase N.2 HTML native preview ──────────────────────────
      // Bypass Babel/IPC entirely. The HtmlAdapter injects flint IDs and
      // generates the final source; wrap in vendored Tailwind + Flint script.
      case 'html': {
        const adapter = LanguageRegistry.getAdapter(activeFilePath)
        const ast = adapter.parse(previewCode)
        if (ast !== null) {
          adapter.injectFlintIds(ast)
          const injectedHtml = adapter.generate(ast)
          if (!cancelled && iframeRef.current !== null) {
            setTransformError(null)
            iframeRef.current.srcdoc = buildHtmlSrcdoc(injectedHtml, tailwindConfigJson)
            renderedVersionRef.current = thisVersion
            setIsStale(false)
          }
        }
        return () => { cancelled = true }
      }

      // ── .vue: MFP.2 — Vue 3 SFC preview ──────────────────────────────
      // Inject data-flint-id attributes into the template section before IPC,
      // then compile the SFC in the main process via @vue/compiler-sfc.
      case 'vue': {
        const codeWithIds = vueAdapter.injectFlintIdsIntoSource(previewCode)
        setIsTransforming(true)
        window.flintAPI
          .transformVue(codeWithIds)
          .then(({ js, css, error }) => {
            if (cancelled) return
            setIsTransforming(false)
            if (error !== null || js === null) {
              setTransformError(error ?? 'Vue compilation failed')
              return
            }
            setTransformError(null)
            if (iframeRef.current !== null) {
              iframeRef.current.srcdoc = buildVueSrcdoc(js, css ?? '', tailwindConfigJson)
              renderedVersionRef.current = thisVersion
              setIsStale(false)
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setIsTransforming(false)
              setTransformError(String(err))
            }
          })
        return () => { cancelled = true }
      }

      // ── .svelte: MFP.3 — full Svelte preview via code:transform-svelte IPC ──
      case 'svelte': {
        // Inject data-flint-id into the markup section before compilation.
        // The SvelteAdapter handles markup-section extraction and ID injection.
        const svelteAdapter = LanguageRegistry.hasAdapter('svelte')
          ? LanguageRegistry.getAdapter('fake.svelte')
          : null
        let codeToTransform = previewCode
        if (svelteAdapter !== null) {
          const parsed = svelteAdapter.parse(previewCode)
          if (parsed !== null) {
            svelteAdapter.injectFlintIds(parsed)
            codeToTransform = svelteAdapter.generate(parsed)
          }
        }

        setIsTransforming(true)
        window.flintAPI.transformSvelte(codeToTransform)
          .then(({ js, css, error }: { js: string | null; css: string; error: string | null }) => {
            if (cancelled) return
            setIsTransforming(false)
            if (error !== null || js === null) {
              setTransformError(error ?? 'Svelte compilation failed')
              return
            }
            setTransformError(null)
            if (iframeRef.current !== null) {
              iframeRef.current.srcdoc = buildSvelteSrcdoc(js, css ?? '', tailwindConfigJson)
              renderedVersionRef.current = thisVersion
              setIsStale(false)
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setIsTransforming(false)
              setTransformError(String(err))
            }
          })
        return () => { cancelled = true }
      }

      // ── default: React/TSX path (Phase E.1, unchanged) ────────────────
      default: {
        // Inject data-flint-id attributes in renderer before IPC transform.
        const freshAst = parseCodeToAST(previewCode)
        const codeToTransform =
          freshAst !== null
            ? (() => { injectFlintIds(freshAst); return generateCodeFromAST(freshAst) })()
            : previewCode

        setIsTransforming(true)
        window.flintAPI
          .transformCode(codeToTransform)
          .then(({ js, error }) => {
            if (cancelled) return
            setIsTransforming(false)
            // 'empty source' is a sentinel the transform handlers return when
            // rawCode is '' (the clearAST → setCode gap). It is expected and
            // should not be shown as a visible error — just leave the previous
            // srcdoc in place until the real file content arrives.
            if (error === 'empty source') return
            if (error !== null || js === null) {
              setTransformError(error ?? 'Transform failed')
              return
            }
            // Guard against an empty JS string (legacy: old server versions
            // returned { js: '', error: null } for empty input instead of the
            // 'empty source' sentinel). An empty string passed to buildSrcdoc
            // renders "No default export found." without any visible error.
            if (js.trim() === '') return
            setTransformError(null)
            if (iframeRef.current !== null) {
              // The server already strips ES module imports. This client-side
              // strip is a safety net for Electron's Babel transform which may
              // leave multi-line import statements intact. The regex uses
              // [\s\S]*? (cross-line) because imports can span multiple lines.
              // Safe here because the server output should contain zero imports.
              const executeCode = js.replace(/^import\s[\s\S]*?from\s*['"][^'"]*['"]\s*;?\n?/gm, '')
              const libraryShims = getLibraryShims(activeLibrary)
              iframeRef.current.srcdoc = buildSrcdoc(executeCode, tailwindConfigJson, libraryShims)
              renderedVersionRef.current = thisVersion
              setIsStale(false)
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setIsTransforming(false)
              setTransformError(String(err))
            }
          })

        return () => {
          cancelled = true
        }
      }
    }
  }, [previewCode, tailwindConfigJson, activeLibrary])

  // When the selected layer changes → send HIGHLIGHT to the iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage({ type: 'HIGHLIGHT', id: selectedNodeId }, getIframeOrigin(previewUrl))
  }, [selectedNodeId, previewUrl])

  // When hoveredId changes → send HOVER / CLEAR_HOVER into the iframe.
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    if (hoveredId !== null) {
      iframe.contentWindow.postMessage({ type: 'HOVER', id: hoveredId }, getIframeOrigin(previewUrl))
    } else {
      iframe.contentWindow.postMessage({ type: 'CLEAR_HOVER' }, getIframeOrigin(previewUrl))
    }
  }, [hoveredId, previewUrl])

  const handleHydroPaste = async (figmaPayload: string) => {
    if (import.meta.env.DEV) {
      console.log('[HydroPaste] Received Figma AST Payload')
      console.log('[HydroPaste] Raw payload (first 2000 chars):', figmaPayload.slice(0, 2000))
    }
    try {
      const response = await window.flintAPI.ai.hydroPaste?.(figmaPayload)
      if (import.meta.env.DEV) console.log('[HydroPaste] Response from main:', JSON.stringify(response, null, 2))
      if (!response || response.error || !response.ok) {
        console.error('[HydroPaste Error]', response?.error || 'No valid components found in payload')
        return
      }
      const editorState = useEditorStore.getState()

      const { elements, imports } = response as { elements?: Array<{ code: string; import: string | null }>; imports?: string[] }

      if (!elements || elements.length === 0) return

      // If no file is open (empty visualTree), scaffold a new component file
      if (!editorState.visualTree || editorState.visualTree.length === 0) {
        const importBlock = (imports || []).join('\n')
        const jsxBody = elements.map((el) => el.code).join('\n        ')
        const wrapper = elements.length === 1 ? jsxBody : `<div>\n        ${jsxBody}\n      </div>`
        const screenName = (() => {
          try { return JSON.parse(figmaPayload).screenName || 'FigmaScreen' } catch { return 'FigmaScreen' }
        })()
        const code = `${importBlock ? importBlock + '\n\n' : ''}export default function ${screenName}() {\n  return (\n    ${wrapper}\n  )\n}\n`
        editorState.setCode(code)
        return
      }

      const rootNodeId = editorState.visualTree[0].id
      const mutations = elements.map((el) => ({
        op: 'injectComponent' as const,
        targetNodeId: rootNodeId,
        jsxSnippet: el.code,
        importSnippet: el.import || undefined
      }))
      editorState.applyBatch(mutations)
    } catch (err) {
      console.error('[HydroPaste Error]', err)
    }
  }

  // When the iframe posts CANVAS_CLICK / CANVAS_HOVER / CANVAS_HOVER_CLEAR / FIGMA_PASTE → update store.
  useEffect(() => {
    function handleMessage(e: MessageEvent): void {
      // SEC.1: Only accept messages from srcdoc iframes (origin 'null')
      // or from the Vite preview server on localhost.
      // srcdoc iframes have an opaque origin serialised as the literal string 'null'
      // per the HTML specification. Messages from any other origin are silently dropped.
      if (e.origin !== 'null' && !e.origin.startsWith('http://localhost:')) return

      if (typeof e.data !== 'object' || e.data === null) return
      const msg = e.data as { type?: unknown; id?: unknown; targetId?: unknown; position?: unknown; payload?: unknown }

      if (msg.type === 'FIGMA_PASTE') {
        if (canvasMode === 'design' && typeof msg.payload === 'string') {
          handleHydroPaste(msg.payload).catch(console.error)
        }
      } else if (msg.type === 'CANVAS_CLICK') {
        // In interact mode the IDE does not intercept clicks; native onClick fires instead.
        if (canvasMode === 'design' && typeof msg.id === 'string') {
          // Phase C.2: do not select a node locked by a remote collaborator.
          if (lockedNodeIdsRef.current.has(msg.id)) return
          setSelectedNode(msg.id)
          setActiveSelection(msg.id)
        }
      } else if (msg.type === 'CANVAS_HOVER') {
        if (canvasMode === 'design' && typeof msg.id === 'string') setHoveredId(msg.id)
      } else if (msg.type === 'CANVAS_HOVER_CLEAR') {
        if (canvasMode === 'design') setHoveredId(null)
      } else if (msg.type === 'CANVAS_DRAG_START') {
        // Iframe mousedown fired — mount the Shield and record the source.
        if (canvasMode === 'design' && typeof msg.id === 'string') {
          // Phase C.2: do not start a drag on a node locked by a remote collaborator.
          if (lockedNodeIdsRef.current.has(msg.id)) return
          dragSourceIdRef.current = msg.id
          startDrag(msg.id)
          // Broadcast lock: immediately publish the dragged element's ID.
          publishPresenceImmediate(0, 0, msg.id)
        }
      } else if (msg.type === 'HIT_TEST_RESULT') {
        // Iframe reported the drop target — perform AST surgery then clean up.
        const sourceId = dragSourceIdRef.current
        dragSourceIdRef.current = null
        endDrag()
        // Broadcast lock release: clear the active drag element immediately.
        publishPresenceImmediate(0, 0, '')
        iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_CLEAR' }, getIframeOrigin(previewUrl))
        if (
          typeof msg.targetId === 'string' &&
          typeof msg.position === 'string' &&
          sourceId !== null &&
          msg.targetId !== sourceId
        ) {
          moveLayerNode(sourceId, msg.targetId, msg.position as DropPosition)
        }
      }
    }
    window.addEventListener('message', handleMessage)

    // Listen for automatic AST ingestion from the main process (via ingestion server)
    const unsubscribe = window.flintAPI.ai.onHydroPasteAuto?.((payload: string) => {
      handleHydroPaste(payload).catch(console.error)
    })

    // Phase ING.2: Listen for import summary push events from ingestion heal pass
    const unsubscribeImportSummary = window.flintAPI.importSummary?.onSummary?.((summary) => {
      useImportSummaryStore.getState().setSummary(summary)
    })

    return () => {
      window.removeEventListener('message', handleMessage)
      unsubscribe?.()
      unsubscribeImportSummary?.()
    }
  }, [setSelectedNode, setHoveredId, startDrag, endDrag, moveLayerNode, setActiveSelection, canvasMode])

  // Forward dragOver / dragClear events from LayerTree to the iframe.
  // These are custom DOM events (not postMessages) dispatched by LayerRow handlers.
  useEffect(() => {
    const dragOverEvent = `${BRAND.productLower}:dragOver`
    const dragClearEvent = `${BRAND.productLower}:dragClear`
    function handleDragOver(e: Event): void {
      if (!(e instanceof CustomEvent)) return
      const { targetId, position } = e.detail as { targetId: string; position: string }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'DRAG_OVER', targetId, position },
        getIframeOrigin(previewUrl)
      )
    }
    function handleDragClear(): void {
      iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_CLEAR' }, getIframeOrigin(previewUrl))
    }
    window.addEventListener(dragOverEvent, handleDragOver as EventListener)
    window.addEventListener(dragClearEvent, handleDragClear)
    return () => {
      window.removeEventListener(dragOverEvent, handleDragOver as EventListener)
      window.removeEventListener(dragClearEvent, handleDragClear)
    }
  }, [previewUrl])

  // ── Shield handlers (Ghost Proxy) ─────────────────────────────────────────

  /** Converts Shield (host) pointer coordinates to iframe-relative coordinates
   *  and streams them into the iframe via postMessage, throttled by rAF. */
  function handleShieldMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // Move the host-side ghost outline to follow the cursor (instant, 60fps).
    setGhostPos({ x: x - 40, y: y - 20 })
    // Publish presence at ≤10 Hz — entirely decoupled from the rAF loop below.
    publishPresence(x, y, dragSourceId ?? '')
    // Throttle the postMessage to one per animation frame.
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_MOVE', x, y }, getIframeOrigin(previewUrl))
    })
  }

  /** Called on Shield mouseUp (commit=true) or mouseLeave (commit=false).
   *  On commit: asks the iframe for the drop target via DRAG_END.
   *  On cancel: immediately clears drag state without AST surgery. */
  function handleShieldFinish(
    e: React.MouseEvent<HTMLDivElement>,
    commit: boolean
  ): void {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setGhostPos(null)
    if (commit) {
      const rect = e.currentTarget.getBoundingClientRect()
      iframeRef.current?.contentWindow?.postMessage({
        type: 'DRAG_END',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }, getIframeOrigin(previewUrl))
      // dragSourceIdRef and canvasStore are cleared in the HIT_TEST_RESULT handler.
    } else {
      // Cancel: clear immediately without waiting for a HIT_TEST_RESULT.
      dragSourceIdRef.current = null
      endDrag()
      // Broadcast lock release: clear the active drag element immediately.
      publishPresenceImmediate(0, 0, '')
      iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_CLEAR' }, getIframeOrigin(previewUrl))
    }
  }

  // Sync canvasMode to the iframe whenever it changes.
  // The iframe initialises __flintInteractMode to false; this message keeps
  // it in step if the user toggles the mode while a component is loaded.
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage(
      { type: 'SET_INTERACT_MODE', enabled: canvasMode === 'interact' },
      getIframeOrigin(previewUrl)
    )
  }, [canvasMode, previewUrl])

  // Re-apply highlight + current mode after the iframe reloads (srcdoc change navigates it)
  function handleIframeLoad(): void {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage({ type: 'HIGHLIGHT', id: selectedNodeId }, getIframeOrigin(previewUrl))
    iframe.contentWindow.postMessage(
      { type: 'SET_INTERACT_MODE', enabled: canvasMode === 'interact' },
      getIframeOrigin(previewUrl)
    )
  }

  // ── GLASS.3.1D: Derive framework badge label from activeFilePath ──────
  const detectedFramework = useMemo(() => {
    const filePath = useCanvasStore.getState().activeFilePath ?? ''
    const extension = filePath.split('.').pop()?.toLowerCase() ?? ''
    switch (extension) {
      case 'vue': return 'Vue'
      case 'svelte': return 'Svelte'
      case 'html': return 'HTML'
      default: return 'React'
    }
  }, [rawCode]) // re-derive when rawCode changes (implies file switch)

  // ── GLASS.3.1C: Error formatting helpers ────────────────────────────────

  /** Extract a recognizable error type from an error message string. */
  const parseErrorType = (msg: string): string => {
    if (/SyntaxError/i.test(msg)) return 'Syntax Error'
    if (/TypeError/i.test(msg)) return 'Type Error'
    if (/ReferenceError/i.test(msg)) return 'Reference Error'
    if (/RangeError/i.test(msg)) return 'Range Error'
    if (/compilation failed/i.test(msg)) return 'Compile Error'
    return 'Error'
  }

  /** Return a contextual hint for common error patterns. */
  const getErrorHint = (msg: string): string | null => {
    if (/is not defined/i.test(msg) || /ReferenceError/i.test(msg))
      return 'Missing import?'
    if (/unexpected token/i.test(msg) || /unterminated/i.test(msg) || /SyntaxError/i.test(msg))
      return 'Unclosed tag?'
    if (/is not a function/i.test(msg) || /undefined/i.test(msg))
      return 'Undefined component?'
    if (/cannot read propert/i.test(msg))
      return 'Null reference — check your data'
    return null
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── Preview toolbar ─────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-800/60 bg-gray-900/40 px-3 py-1.5">
        {/* Mode toggle: Design vs Interact */}
        <div className="flex items-center rounded border border-gray-700/60 p-0.5">
          <button
            type="button"
            title="Design mode: click to select AST nodes"
            onClick={() => setCanvasMode('design')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${canvasMode === 'design' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <MousePointer2 size={10} />
            Design
          </button>
          <button
            type="button"
            title="Interact mode: test native events"
            onClick={() => setCanvasMode('interact')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${canvasMode === 'interact' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Hand size={10} />
            Interact
          </button>
        </div>

        {/* GLASS.3.1D: Framework badge */}
        <span
          data-testid="framework-badge"
          className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400"
        >
          {detectedFramework}
        </span>

        {/* GLASS.3.1B: Stale preview indicator */}
        {isStale && !isTransforming && (
          <div data-testid="stale-indicator" className="ml-auto flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-xs text-amber-400">Outdated</span>
          </div>
        )}
      </div>

      {/* ── GLASS.3.1C: Structured error display ────────────────────────── */}
      {transformError !== null && (
        <div
          data-testid="transform-error"
          role="alert"
          aria-live="assertive"
          className="shrink-0 border-b border-red-700/40 bg-red-900/10 rounded p-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              {/* Error type badge */}
              <span
                data-testid="error-type-badge"
                className="mb-1 inline-block rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300"
              >
                {parseErrorType(transformError)}
              </span>

              {/* Error message — max 3 lines unless expanded */}
              <pre
                data-testid="error-message"
                className={`mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-red-400 ${!errorExpanded ? 'line-clamp-3' : ''}`}
              >
                {transformError}
              </pre>

              {/* "Show more" toggle — visible only when the message likely exceeds 3 lines */}
              {transformError.length > 200 && (
                <button
                  type="button"
                  data-testid="error-expand-toggle"
                  aria-expanded={errorExpanded}
                  onClick={() => setErrorExpanded((prev) => !prev)}
                  className="mt-1 text-[10px] text-red-300/70 underline hover:text-red-300"
                >
                  {errorExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {/* Contextual hint */}
              {getErrorHint(transformError) !== null && (
                <p data-testid="error-hint" className="mt-1.5 text-[10px] italic text-red-300/60">
                  This usually means: {getErrorHint(transformError)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Governance Autopilot diff toggle (Phase REM.2.2) ──────────── */}
      {autopilotEnabled && governedCode && (
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-700 bg-zinc-800/90 px-3 py-1 text-xs">
          <button
            type="button"
            onClick={() => { setShowGoverned(false) }}
            className={`rounded px-2 py-0.5 ${!showGoverned ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => { setShowGoverned(true) }}
            className={`rounded px-2 py-0.5 ${showGoverned ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Governed
          </button>
          <span className="ml-auto text-emerald-400">
            {governedFixCount} fix{governedFixCount !== 1 ? 'es' : ''} available
          </span>
        </div>
      )}

      {/* ── Responsive breakpoint wrapper ───────────────────────────── */}
      {/* Outer flex container centers the constrained preview in mobile/tablet modes */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-hidden bg-zinc-950">
        {/* Breakpoint label — only visible in non-desktop modes */}
        {previewBreakpoint !== 'desktop' && (
          <div
            className="z-10 mt-1 rounded bg-zinc-900/80 px-2 py-0.5 text-[10px] text-zinc-500"
            data-testid="breakpoint-label"
          >
            {previewBreakpoint === 'mobile' ? '375px' : '768px'}
          </div>
        )}

        {/* Inner container — constrained width for mobile/tablet, full width for desktop */}
        <div
          className="relative flex-1 transition-all duration-300"
          data-testid="breakpoint-container"
          style={
            BREAKPOINT_WIDTHS[previewBreakpoint] !== undefined
              ? {
                  width: `${BREAKPOINT_WIDTHS[previewBreakpoint]}px`,
                  maxWidth: '100%',
                  borderRadius: previewBreakpoint === 'mobile' ? '12px' : '4px',
                  outline: '1px solid rgba(113,113,122,0.4)',
                  outlineOffset: '0px',
                  overflow: 'hidden',
                }
              : { width: '100%' }
          }
        >

      {/* Positioning context so the Shield can overlay exactly the iframe */}
      {/* CV2.5: isCardDragOver adds a 2px dashed indigo border as a drop indicator */}
      <div
        data-testid="live-preview-drop-zone"
        className={`relative min-h-0 h-full outline-none transition-all ${isCardDragOver ? 'ring-2 ring-inset ring-indigo-500 ring-dashed' : ''}`}
        tabIndex={0}
        onDragOver={(e) => {
          if (canvasMode !== 'design') return
          // Accept component files from FileExplorer and component cards from the canvas
          if (
            e.dataTransfer.types.includes('application/flint-component-file') ||
            e.dataTransfer.types.includes('application/flint-component-card')
          ) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDragEnter={(e) => {
          // CV2.5: show drop indicator when a component card enters the zone
          if (e.dataTransfer.types.includes('application/flint-component-card')) {
            setIsCardDragOver(true)
            // Smart Insert: read card data from dataTransfer on enter so the
            // panel can display node targets immediately. getData is only
            // available on dragenter/dragover (not dragover in Chrome, but
            // the data is already set by ComponentCardNode's onDragStart).
            try {
              const raw = e.dataTransfer.getData('application/flint-component-card')
              if (raw) {
                const { name, importPath } = JSON.parse(raw) as {
                  name: string
                  importPath: string
                }
                if (name && importPath) {
                  setPendingCardDrag({ name, importPath })
                }
              }
            } catch {
              // Payload not yet readable on this event — will be available on drop
            }
          }
        }}
        onDragLeave={(e) => {
          // Only clear the indicator when the cursor actually leaves the element
          // (not when moving between child elements — relatedTarget check)
          if (
            e.currentTarget &&
            !e.currentTarget.contains(e.relatedTarget as Node | null)
          ) {
            setIsCardDragOver(false)
            setPendingCardDrag(null)
            setSmartHoveredId(null)
          }
        }}
        onPaste={async (e) => {
          if (canvasMode !== 'design') return

          let figmaPayload = e.clipboardData.getData('application/x-flint-figma-ast')

          if (!figmaPayload) {
            const textData = e.clipboardData.getData('text/plain')
            try {
              const parsed = JSON.parse(textData)
              if (parsed && parsed.type === 'application/x-flint-figma-ast') {
                figmaPayload = typeof parsed.payload === 'string'
                  ? parsed.payload
                  : JSON.stringify(parsed.payload)
              }
            } catch (err) {
              // Not our JSON payload
            }
          }

          if (!figmaPayload) return
          e.preventDefault()

          handleHydroPaste(figmaPayload).catch(console.error)
        }}
        onDrop={(e) => {
          // Always clear the card drag indicator on drop
          setIsCardDragOver(false)
          setPendingCardDrag(null)
          setSmartHoveredId(null)

          if (canvasMode !== 'design') return

          // CV2.5: Handle component card drops from the canvas.
          // Smart Insert panel rows call handleSmartDrop directly; when the user
          // drops on the iframe itself (missing the panel), this fallback inserts
          // at the root node (original CV2.5 behaviour preserved).
          const cardDataRaw = e.dataTransfer.getData('application/flint-component-card')
          if (cardDataRaw) {
            e.preventDefault()
            try {
              const { name, importPath } = JSON.parse(cardDataRaw) as {
                name: string
                importPath: string
                filePath: string
              }
              if (!name || !importPath) return

              const editorState = useEditorStore.getState()
              if (!editorState.visualTree || editorState.visualTree.length === 0) return
              const rootNodeId = editorState.visualTree[0].id

              editorState.applyBatch([
                {
                  op: 'injectComponent',
                  targetNodeId: rootNodeId,
                  jsxSnippet: `<${name} />`,
                  importSnippet: `import { ${name} } from '${importPath}';`,
                },
              ])
            } catch {
              // Malformed JSON — ignore silently
            }
            return
          }

          // Existing: accept component file drops from the FileExplorer
          const sourceFile = e.dataTransfer.getData('application/flint-component-file')
          if (!sourceFile) return

          e.preventDefault()

          // Simple heuristic: file basename is the component name
          const componentName = sourceFile.split(/[/\\]/).pop()?.replace(/\.tsx$/, '')
          if (!componentName) return

          // We insert into visualTree[0], which is the root node of the currently active file
          const editorState = useEditorStore.getState()
          if (!editorState.visualTree || editorState.visualTree.length === 0) return
          const rootNodeId = editorState.visualTree[0].id

          editorState.applyBatch([
            {
              op: 'injectComponent',
              targetNodeId: rootNodeId,
              jsxSnippet: `\n      <${componentName} data-flint-id="flint-injected-${Date.now()}" />\n`,
              importSnippet: `import ${componentName} from './${componentName}'`
            }
          ])
        }}
      >
        {/* ── Smart Insert Panel (CV2.5+) ──────────────────────────────────────
            Shown only while a component card is being dragged over the preview.
            Presents the top-level visual tree nodes as drop targets so the user
            can choose exactly WHERE to insert (before/inside/after an element).
            Falls back to the iframe drop target (root append) if dismissed.

            Commandment C2: all colors from the Bridge palette — no hex values.
            Panel is pointer-events-auto so drag events are received, but only
            for the panel's own rows — the iframe behind remains accessible. */}
        {isCardDragOver && visualTree.length > 0 && (
          <div
            data-testid="smart-insert-panel"
            className="absolute right-0 top-0 z-40 flex h-full w-44 flex-col border-l border-zinc-700/50 bg-zinc-900/95 backdrop-blur-sm"
          >
            {/* Panel header */}
            <div className="border-b border-zinc-800 px-3 py-2 shrink-0">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Insert at
              </h3>
              {pendingCardDrag && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-indigo-400">
                  &lt;{pendingCardDrag.name} /&gt;
                </p>
              )}
            </div>

            {/* Tree node rows — max 10 to avoid clutter */}
            <div
              className="flex-1 overflow-y-auto py-1"
              data-testid="smart-insert-node-list"
            >
              {visualTree.slice(0, 10).map((node) => (
                <div
                  key={node.id}
                  data-testid={`smart-insert-node-${node.id}`}
                  className={`
                    flex cursor-pointer items-center gap-2 px-3 py-1.5
                    text-[11px] transition-colors
                    ${smartHoveredId === node.id
                      ? 'bg-indigo-900/30 text-indigo-300 border-l-2 border-indigo-500/50'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}
                  `.trim()}
                  onMouseEnter={() => setSmartHoveredId(node.id)}
                  onMouseLeave={() => setSmartHoveredId(null)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'copy'
                    setSmartHoveredId(node.id)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSmartDrop(node.id)
                  }}
                >
                  <span className="shrink-0 font-mono text-zinc-600">&lt;</span>
                  <span className="truncate font-mono">{node.tagName}</span>
                  <span className="shrink-0 font-mono text-zinc-600">&gt;</span>
                </div>
              ))}

              {/* Truncation indicator */}
              {visualTree.length > 10 && (
                <div className="px-3 py-1 text-[10px] text-zinc-600 italic">
                  …and {visualTree.length - 10} more
                </div>
              )}
            </div>

            {/* Footer: cancel hint */}
            <div className="border-t border-zinc-800 px-3 py-1.5 shrink-0">
              <p className="text-[10px] text-zinc-600">
                Drop on row or preview to insert
              </p>
            </div>
          </div>
        )}

        <iframe
          // Phase N.4: when a project is open, use the Vite dev server URL as
          // src so HMR and the user's full framework pipeline are active.
          // When previewUrl is null (no project / single-file mode), the
          // iframe falls back to the existing imperative srcdoc assignments.
          // The `key` forces React to unmount+remount the iframe when switching
          // between src= and srcdoc= modes, avoiding cross-origin state leaks.
          key={previewUrl ?? 'srcdoc'}
          ref={iframeRef}
          title="Live Preview"
          className={`absolute inset-0 h-full w-full bg-gray-900 ${showGoverned && governedCode ? 'border-2 border-emerald-500/30' : 'border-0'}`}
          // SEC.1: Sandbox prevents injected code from accessing window.parent.flintAPI.
          // allow-scripts is required for the new Function() preview execution path.
          // allow-forms is included so user components with <form> elements remain
          // interactive in "interact" mode.
          // CRITICAL: allow-same-origin is intentionally omitted — adding it with srcdoc
          // would give the iframe the same origin as the parent, negating the sandbox.
          sandbox="allow-scripts allow-forms"
          {...(previewUrl != null ? { src: previewUrl } : {})}
          onLoad={handleIframeLoad}
        />
        {/* ── GLASS.3.1A: Transform loading overlay ──────────────────────── */}
        {isTransforming && (
          <div
            data-testid="transform-loading-overlay"
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/40"
          >
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-400">Compiling...</span>
            </div>
          </div>
        )}
        {/* Shield: transparent overlay that captures pointer events during drag.
            Hidden in interact mode so drags pass through to native components. */}
        {isDragging && canvasMode === 'design' && (
          <div
            className="absolute inset-0 z-50 cursor-grabbing"
            onMouseMove={handleShieldMouseMove}
            onMouseUp={(e) => handleShieldFinish(e, true)}
            onMouseLeave={(e) => handleShieldFinish(e, false)}
          >
            {/* Ghost: lightweight outline following the cursor */}
            {ghostPos !== null && (
              <div
                className="pointer-events-none absolute h-10 w-20 rounded border-2 border-blue-500 bg-blue-500/10"
                style={{ left: ghostPos.x, top: ghostPos.y }}
              />
            )}
            {/* Remote cursors: SVG overlays for other connected users */}
            {remotePresence.map((user) => (
              <div
                key={user.id}
                className="pointer-events-none absolute"
                style={{ left: user.x, top: user.y }}
              >
                <svg
                  width="14"
                  height="20"
                  viewBox="0 0 14 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0 0L0 16L4 11L7 18L9.5 17L6.5 10L12 10Z"
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth="0.75"
                  />
                </svg>
                <span className="absolute left-4 top-0 whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[10px] font-medium leading-tight text-white">
                  {user.user_id}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>{/* end breakpoint-container */}
      </div>{/* end breakpoint wrapper */}
    </div>
  )
}
