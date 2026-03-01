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
 *   3. The resulting JS is embedded in a self-contained HTML document that loads
 *      React 18 and ReactDOM from unpkg (UMD builds), injects Tailwind via CDN,
 *      then renders `window.__AppComponent` into a `#root` div.
 *   4. Design tokens from SQLite are injected as a `tailwind.config` extension
 *      so custom token classes (e.g. `bg-brand-primary`) resolve immediately.
 *
 * This approach requires zero cloud bundlers and works fully offline once the
 * CDN resources are cached — no Sandpack subdomain CSP whitelisting needed.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useTokenStore } from '../../store/tokenStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { DropPosition } from '../../utils/astModifier'
import { generateTailwindConfig } from '../../utils/tokenAdapter'
import { PAYMENT_CALCULATOR_CODE } from '../../templates/paymentCalculator'
import {
  parseCodeToAST,
  injectBridgeIds,
  generateCodeFromAST,
} from '../../core/ast-parser'
import {
  publishPresence,
  publishPresenceImmediate,
} from '../../services/PresenceService'
import { useRemotePresence } from '../../hooks/useRemotePresence'

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
 */
function buildSrcdoc(js: string, tailwindConfigJson: string): string {
  // JSON.stringify produces a string safe to embed inside a script tag.
  // Replace bare `<` with its Unicode escape so `</script>` in string
  // literals can never terminate the enclosing script element.
  const safeJson = JSON.stringify(js).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>tailwind.config = ${tailwindConfigJson};<\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 1rem; background: #111827; color: #f9fafb; font-family: system-ui, sans-serif; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
    .bridge-selected { outline: 2px solid #3b82f6 !important; background-color: rgba(59,130,246,0.1) !important; }
    .bridge-drop-before { box-shadow: 0 -3px 0 0 #3b82f6 !important; z-index: 50; }
    .bridge-drop-after { box-shadow: 0 3px 0 0 #3b82f6 !important; z-index: 50; }
    .bridge-drop-inside { outline: 2px solid #3b82f6 !important; background: rgba(59, 130, 246, 0.2) !important; }
    .bridge-hovered { outline: 2px dashed #94a3b8 !important; background: rgba(148, 163, 184, 0.1) !important; cursor: default; z-index: 40; transition: all 0.1s; }
    #bridge-ghost { position: fixed; pointer-events: none; border: 2px solid #3b82f6; background: rgba(59,130,246,0.12); border-radius: 4px; z-index: 9999; display: none; width: 80px; height: 40px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script id="__code" type="application/json">${safeJson}<\/script>
  <script>
    // UI Component Registry Stubs for Live Preview
    // These mirror the shadcn/ui API surface so injected components render
    // without a bundler resolving the actual package imports.
    window.Badge = function({ className, children, ...rest }) {
      return React.createElement('span', {
        className: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-slate-900 text-white shadow hover:bg-slate-900/80 ' + (className || ''),
        ...rest,
        style: { pointerEvents: 'auto' }
      }, children);
    };
    window.Button = function({ className, children, ...rest }) {
      return React.createElement('button', {
        className: 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-slate-900 text-white shadow hover:bg-slate-900/90 h-9 px-4 py-2 ' + (className || ''),
        ...rest,
        style: { pointerEvents: 'auto' }
      }, children);
    };
  <\/script>
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
        root.innerHTML = '<pre style="color:#f87171;font-size:12px">' + String(e) + '<\/pre>';
      }
    })();
  <\/script>
  <script>
    // Bridge: bi-directional Layer Tree \u2194 Preview selection + drag indicators
    window.addEventListener('message', function (e) {
      if (!e.data) return;
      var type = e.data.type;
      if (type === 'CLEAR_PREVIEW') {
        var root = document.getElementById('root');
        if (root) root.innerHTML = '';
        return;
      }
      if (type === 'HIGHLIGHT') {
        var prev = document.querySelector('.bridge-selected');
        if (prev) prev.classList.remove('bridge-selected');
        if (e.data.id) {
          var target = document.querySelector('[data-bridge-id="' + e.data.id + '"]');
          if (target) target.classList.add('bridge-selected');
        }
        return;
      }
      if (type === 'DRAG_OVER') {
        document.querySelectorAll('.bridge-drop-before, .bridge-drop-after, .bridge-drop-inside').forEach(function(el) {
          el.classList.remove('bridge-drop-before', 'bridge-drop-after', 'bridge-drop-inside');
        });
        if (e.data.targetId) {
          var dropEl = document.querySelector('[data-bridge-id="' + e.data.targetId + '"]');
          if (dropEl) dropEl.classList.add('bridge-drop-' + e.data.position);
        }
        return;
      }
      if (type === 'DRAG_CLEAR') {
        var ghostEl = document.getElementById('bridge-ghost');
        if (ghostEl) ghostEl.style.display = 'none';
        document.querySelectorAll('.bridge-drop-before, .bridge-drop-after, .bridge-drop-inside').forEach(function(el) {
          el.classList.remove('bridge-drop-before', 'bridge-drop-after', 'bridge-drop-inside');
        });
        return;
      }
      if (type === 'HOVER') {
        document.querySelectorAll('.bridge-hovered').forEach(function(el) {
          el.classList.remove('bridge-hovered');
        });
        if (e.data.id) {
          var hoverEl = document.querySelector('[data-bridge-id="' + e.data.id + '"]');
          if (hoverEl) hoverEl.classList.add('bridge-hovered');
        }
        return;
      }
      if (type === 'CLEAR_HOVER') {
        document.querySelectorAll('.bridge-hovered').forEach(function(el) {
          el.classList.remove('bridge-hovered');
        });
        return;
      }
      if (type === 'DRAG_MOVE') {
        var ghost = document.getElementById('bridge-ghost');
        if (ghost) {
          ghost.style.display = 'block';
          ghost.style.left = (e.data.x - 40) + 'px';
          ghost.style.top  = (e.data.y - 20) + 'px';
        }
        document.querySelectorAll('.bridge-drop-before, .bridge-drop-after, .bridge-drop-inside').forEach(function(n) {
          n.classList.remove('bridge-drop-before', 'bridge-drop-after', 'bridge-drop-inside');
        });
        var dmEl = document.elementFromPoint(e.data.x, e.data.y);
        var dmTarget = dmEl ? dmEl.closest('[data-bridge-id]') : null;
        if (dmTarget) {
          var r = dmTarget.getBoundingClientRect();
          var pct = (e.data.y - r.top) / r.height;
          dmTarget.classList.add('bridge-drop-' + (pct < 0.25 ? 'before' : pct > 0.75 ? 'after' : 'inside'));
        }
        return;
      }
      if (type === 'DRAG_END') {
        var ghost2 = document.getElementById('bridge-ghost');
        if (ghost2) ghost2.style.display = 'none';
        document.querySelectorAll('.bridge-drop-before, .bridge-drop-after, .bridge-drop-inside').forEach(function(n) {
          n.classList.remove('bridge-drop-before', 'bridge-drop-after', 'bridge-drop-inside');
        });
        var deEl = document.elementFromPoint(e.data.x, e.data.y);
        var deTarget = deEl ? deEl.closest('[data-bridge-id]') : null;
        var dePos = 'inside';
        if (deTarget) {
          var dr = deTarget.getBoundingClientRect();
          var dp = (e.data.y - dr.top) / dr.height;
          dePos = dp < 0.25 ? 'before' : dp > 0.75 ? 'after' : 'inside';
        }
        window.parent.postMessage({
          type: 'HIT_TEST_RESULT',
          targetId: deTarget ? deTarget.getAttribute('data-bridge-id') : null,
          position: dePos,
        }, '*');
        return;
      }
    });
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-bridge-id]');
      if (el) {
        window.parent.postMessage({ type: 'CANVAS_CLICK', id: el.getAttribute('data-bridge-id') }, '*');
      }
    });
    var _bridgeHoverId = null;
    document.body.addEventListener('mouseover', function (e) {
      var el = e.target.closest('[data-bridge-id]');
      var id = el ? el.getAttribute('data-bridge-id') : null;
      if (id !== _bridgeHoverId) {
        _bridgeHoverId = id;
        window.parent.postMessage(
          id ? { type: 'CANVAS_HOVER', id: id } : { type: 'CANVAS_HOVER_CLEAR' },
          '*'
        );
      }
    });
    document.body.addEventListener('mouseleave', function () {
      if (_bridgeHoverId !== null) {
        _bridgeHoverId = null;
        window.parent.postMessage({ type: 'CANVAS_HOVER_CLEAR' }, '*');
      }
    });
    // ── Ghost Proxy: initiation ───────────────────────────────────────────────
    // Create the ghost element once; it is shown/hidden by DRAG_MOVE / DRAG_END.
    var _bridgeGhost = document.createElement('div');
    _bridgeGhost.id = 'bridge-ghost';
    document.body.appendChild(_bridgeGhost);
    // Mousedown on any data-bridge-id element fires CANVAS_DRAG_START to the host.
    document.body.addEventListener('mousedown', function (e) {
      var el = e.target.closest('[data-bridge-id]');
      if (!el) return;
      e.preventDefault(); // prevent text-selection during drag
      window.parent.postMessage({
        type: 'CANVAS_DRAG_START',
        id: el.getAttribute('data-bridge-id'),
        x: e.clientX,
        y: e.clientY,
      }, '*');
    });
  <\/script>
</body>
</html>`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LivePreview() {
  const rawCode = useEditorStore((state) => state.rawCode)
  const setCode = useEditorStore((state) => state.setCode)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const setSelectedNode = useEditorStore((state) => state.setSelectedNode)
  const hoveredId = useEditorStore((state) => state.hoveredId)
  const setHoveredId = useEditorStore((state) => state.setHoveredId)
  const tokens = useTokenStore((state) => state.tokens)
  const ensureDemoTokens = useTokenStore((state) => state.ensureDemoTokens)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [transformError, setTransformError] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)

  // ── Ghost Proxy drag state + canvas selection ─────────────────────────────
  const { dragSourceId, startDrag, endDrag, setActiveSelection } = useCanvasStore()
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

  async function handleLoadDemo(): Promise<void> {
    setDemoLoading(true)
    try {
      // Seeds baseline tokens if the DB is empty so token classes resolve
      await ensureDemoTokens()
      setCode(PAYMENT_CALCULATOR_CODE)
    } finally {
      setDemoLoading(false)
    }
  }

  // Re-compute only when the token list changes, not on every render.
  const tailwindConfigJson = useMemo(() => generateTailwindConfig(tokens), [tokens])

  useEffect(() => {
    let cancelled = false

    // Phase E.1: inject data-bridge-id attributes in the renderer before sending
    // to the main process. This guarantees IDs exist even if the main-process
    // Babel plugin fails. The main-process plugin's idempotency guard means
    // double-injection is impossible. Fall back to rawCode when parsing fails
    // (e.g. during live typing with a syntax error).
    const freshAst = parseCodeToAST(rawCode)
    const codeToTransform =
      freshAst !== null
        ? (() => { injectBridgeIds(freshAst); return generateCodeFromAST(freshAst) })()
        : rawCode

    window.bridgeAPI
      .transformCode(codeToTransform)
      .then(({ js, error }) => {
        if (cancelled) return
        if (error !== null || js === null) {
          setTransformError(error ?? 'Transform failed')
          return
        }
        setTransformError(null)
        if (iframeRef.current !== null) {
          // Strip any remaining import statements from the execution string only.
          // The AST source of truth (editorStore) is never modified here.
          const executeCode = js.replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
          iframeRef.current.srcdoc = buildSrcdoc(executeCode, tailwindConfigJson)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setTransformError(String(err))
      })

    return () => {
      cancelled = true
    }
  }, [rawCode, tailwindConfigJson])

  // When the selected layer changes → send HIGHLIGHT to the iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage({ type: 'HIGHLIGHT', id: selectedNodeId }, '*')
  }, [selectedNodeId])

  // When hoveredId changes → send HOVER / CLEAR_HOVER into the iframe.
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    if (hoveredId !== null) {
      iframe.contentWindow.postMessage({ type: 'HOVER', id: hoveredId }, '*')
    } else {
      iframe.contentWindow.postMessage({ type: 'CLEAR_HOVER' }, '*')
    }
  }, [hoveredId])

  // When the iframe posts CANVAS_CLICK / CANVAS_HOVER / CANVAS_HOVER_CLEAR → update store.
  useEffect(() => {
    function handleMessage(e: MessageEvent): void {
      if (typeof e.data !== 'object' || e.data === null) return
      const msg = e.data as { type?: unknown; id?: unknown; targetId?: unknown; position?: unknown }
      if (msg.type === 'CANVAS_CLICK') {
        if (typeof msg.id === 'string') {
          setSelectedNode(msg.id)
          setActiveSelection(msg.id)
        }
      } else if (msg.type === 'CANVAS_HOVER') {
        if (typeof msg.id === 'string') setHoveredId(msg.id)
      } else if (msg.type === 'CANVAS_HOVER_CLEAR') {
        setHoveredId(null)
      } else if (msg.type === 'CANVAS_DRAG_START') {
        // Iframe mousedown fired — mount the Shield and record the source.
        if (typeof msg.id === 'string') {
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
        iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_CLEAR' }, '*')
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
    return () => window.removeEventListener('message', handleMessage)
  }, [setSelectedNode, setHoveredId, startDrag, endDrag, moveLayerNode, setActiveSelection])

  // Forward bridge:dragOver / bridge:dragClear events from LayerTree to the iframe.
  // These are custom DOM events (not postMessages) dispatched by LayerRow handlers.
  useEffect(() => {
    function handleDragOver(e: Event): void {
      if (!(e instanceof CustomEvent)) return
      const { targetId, position } = e.detail as { targetId: string; position: string }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'DRAG_OVER', targetId, position },
        '*'
      )
    }
    function handleDragClear(): void {
      iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_CLEAR' }, '*')
    }
    window.addEventListener('bridge:dragOver', handleDragOver as EventListener)
    window.addEventListener('bridge:dragClear', handleDragClear)
    return () => {
      window.removeEventListener('bridge:dragOver', handleDragOver as EventListener)
      window.removeEventListener('bridge:dragClear', handleDragClear)
    }
  }, [])

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
      iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_MOVE', x, y }, '*')
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
      }, '*')
      // dragSourceIdRef and canvasStore are cleared in the HIT_TEST_RESULT handler.
    } else {
      // Cancel: clear immediately without waiting for a HIT_TEST_RESULT.
      dragSourceIdRef.current = null
      endDrag()
      // Broadcast lock release: clear the active drag element immediately.
      publishPresenceImmediate(0, 0, '')
      iframeRef.current?.contentWindow?.postMessage({ type: 'DRAG_CLEAR' }, '*')
    }
  }

  // Re-apply highlight after the iframe reloads (srcdoc change navigates it)
  function handleIframeLoad(): void {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage({ type: 'HIGHLIGHT', id: selectedNodeId }, '*')
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* ── Demo loader bar ─────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-800/60 bg-gray-900/40 px-3 py-1.5">
        <span className="text-[9px] font-medium uppercase tracking-wider text-gray-700">
          Quick Load
        </span>
        <button
          type="button"
          disabled={demoLoading}
          onClick={() => { handleLoadDemo().catch(console.error) }}
          className="ml-auto rounded border border-gray-700 px-2.5 py-0.5 text-[10px] text-gray-500 transition-colors hover:border-indigo-600/60 hover:text-indigo-400 disabled:cursor-wait disabled:opacity-40"
        >
          {demoLoading ? 'Compiling AST…' : 'Load Demo'}
        </button>
      </div>

      {transformError !== null && (
        <div className="shrink-0 border-b border-red-900/40 bg-red-900/10 px-3 py-1.5 text-[11px] text-red-400">
          {transformError}
        </div>
      )}
      {/* Positioning context so the Shield can overlay exactly the iframe */}
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          title="Live Preview"
          className="absolute inset-0 h-full w-full border-0 bg-gray-900"
          onLoad={handleIframeLoad}
        />
        {/* Shield: transparent overlay that captures pointer events during drag */}
        {isDragging && (
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
                <span className="absolute left-4 top-0 whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[9px] font-medium leading-tight text-white">
                  {user.user_id}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
