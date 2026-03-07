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
import { MousePointer2, Hand } from 'lucide-react'
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
import { LanguageRegistry } from '../../core/adapters/types'
import {
  publishPresence,
  publishPresenceImmediate,
} from '../../services/PresenceService'
import { useRemotePresence, useLockedNodeIds } from '../../hooks/useRemotePresence'

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
    // Expose React named exports as globals so stripped import statements resolve.
    // e.g. "import { useState } from 'react'" is stripped by the transform, but
    // the code still calls useState(...) -- this makes it work.
    var { useState, useEffect, useRef, useMemo, useCallback, useContext,
          useReducer, useLayoutEffect, useId, Fragment, createContext,
          forwardRef, memo, cloneElement, Children, isValidElement } = React;
  <\/script>
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
    window.Button = function({ variant, className, children, ...rest }) {
      var base = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 px-4 py-2 ';
      var variants = { primary: 'bg-blue-600 text-white shadow hover:bg-blue-700', secondary: 'text-blue-600 hover:bg-blue-50', outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' };
      return React.createElement('button', {
        className: base + (variants[variant] || variants.primary) + ' ' + (className || ''),
        ...rest,
        style: { pointerEvents: 'auto' }
      }, children);
    };
    window.Heading = function({ as, className, children, ...rest }) {
      var level = as || 1;
      var sizes = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-lg', 4: 'text-base', 5: 'text-sm', 6: 'text-xs' };
      return React.createElement('h' + level, {
        className: 'font-medium tracking-tight text-slate-800 ' + (sizes[level] || 'text-base') + ' ' + (className || ''),
        ...rest
      }, children);
    };
    window.TextField = function({ label, placeholder, value, helperText, className, ...rest }) {
      return React.createElement('div', { className: 'flex flex-col gap-1 ' + (className || '') },
        label ? React.createElement('label', { className: 'text-sm font-medium text-slate-700' }, label) : null,
        React.createElement('input', { type: 'text', placeholder: placeholder || '', defaultValue: value || '', className: 'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500', ...rest }),
        helperText ? React.createElement('span', { className: 'text-xs text-slate-500' }, helperText) : null
      );
    };
    window.SwitchToggle = function({ label, checked, className }) {
      return React.createElement('label', { className: 'inline-flex items-center gap-3 cursor-pointer ' + (className || '') },
        React.createElement('span', {
          className: 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' + (checked ? 'bg-blue-600' : 'bg-slate-300'),
        }, React.createElement('span', { className: 'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ' + (checked ? 'translate-x-4' : 'translate-x-0.5') })),
        label ? React.createElement('span', { className: 'text-sm text-slate-700' }, label) : null
      );
    };
    window.SelectField = function({ label, options, value, className }) {
      return React.createElement('div', { className: 'flex flex-col gap-1 ' + (className || '') },
        label ? React.createElement('label', { className: 'text-sm font-medium text-slate-700' }, label) : null,
        React.createElement('select', { defaultValue: value || '', className: 'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500' })
      );
    };
    window.IconButton = function({ icon, label, size, className, ...rest }) {
      var sizeClass = size === 'sm' ? 'h-5 w-5 p-0.5' : 'h-8 w-8 p-1.5';
      return React.createElement('button', {
        type: 'button',
        'aria-label': label || icon,
        className: 'inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ' + sizeClass + ' ' + (className || ''),
        ...rest
      }, icon);
    };
    window.Stack = function({ direction, spacing, className, children }) {
      var dir = direction === 'horizontal' ? 'flex-row' : 'flex-col';
      var gap = spacing ? 'gap-' + spacing : 'gap-4';
      return React.createElement('div', {
        className: 'flex ' + dir + ' ' + gap + ' ' + (className || ''),
      }, children);
    };
    window.Input = function({ placeholder, type, className, ...rest }) {
      return React.createElement('input', {
        type: type || 'text',
        placeholder: placeholder || '',
        className: 'rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' + (className || ''),
        ...rest
      });
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
    // __bridgeInteractMode: when true, all IDE intercepts (selection, drag, hover)
    // are disabled so native React events in the iframe fire unobstructed.
    window.__bridgeInteractMode = false;
    window.addEventListener('message', function (e) {
      if (!e.data) return;
      var type = e.data.type;
      if (type === 'SET_INTERACT_MODE') {
        window.__bridgeInteractMode = !!e.data.enabled;
        return;
      }
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
      if (window.__bridgeInteractMode) return;
      var el = e.target.closest('[data-bridge-id]');
      if (el) {
        window.parent.postMessage({ type: 'CANVAS_CLICK', id: el.getAttribute('data-bridge-id') }, '*');
      }
    });
    var _bridgeHoverId = null;
    document.body.addEventListener('mouseover', function (e) {
      if (window.__bridgeInteractMode) return;
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
      if (window.__bridgeInteractMode) return;
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
      if (window.__bridgeInteractMode) return;
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

// ── HTML srcdoc builder (Phase N.2) ─────────────────────────────────────────────

/**
 * Wraps a raw HTML string (with data-bridge-id attributes pre-injected)
 * in a minimal srcdoc document that includes the Tailwind CDN and the
 * full Bridge interaction proxy script (click-to-select, hover, drag).
 */
function buildHtmlSrcdoc(htmlCode: string, tailwindConfigJson: string): string {
  // Extract <body> inner content to avoid duplicating the outer <html>/<head>.
  const bodyMatch = htmlCode.match(/<body[^>]*>([\u200b\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlCode

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>tailwind.config = ${tailwindConfigJson};<\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 1rem; background: #111827; color: #f9fafb; font-family: system-ui, sans-serif; }
    .bridge-selected { outline: 2px solid #3b82f6 !important; background-color: rgba(59,130,246,0.1) !important; }
    .bridge-hovered { outline: 2px dashed #94a3b8 !important; background: rgba(148,163,184,0.1) !important; cursor: default; z-index: 40; transition: all 0.1s; }
    .bridge-drop-before { box-shadow: 0 -3px 0 0 #3b82f6 !important; z-index: 50; }
    .bridge-drop-after  { box-shadow: 0 3px 0 0 #3b82f6 !important; z-index: 50; }
    .bridge-drop-inside { outline: 2px solid #3b82f6 !important; background: rgba(59,130,246,0.2) !important; }
    #bridge-ghost { position: fixed; pointer-events: none; border: 2px solid #3b82f6; background: rgba(59,130,246,0.12); border-radius: 4px; z-index: 9999; display: none; width: 80px; height: 40px; }
  <\/style>
<\/head>
<body>
  ${bodyContent}
  <script>
    window.__bridgeInteractMode = false;
    window.addEventListener('message', function(e) {
      if (!e.data) return; var t = e.data.type;
      if (t === 'SET_INTERACT_MODE') { window.__bridgeInteractMode = !!e.data.enabled; return; }
      if (t === 'CLEAR_PREVIEW') { document.body.innerHTML = ''; return; }
      if (t === 'HIGHLIGHT') {
        document.querySelectorAll('.bridge-selected').forEach(function(el){el.classList.remove('bridge-selected');});
        if (e.data.id) { var s=document.querySelector('[data-bridge-id="'+e.data.id+'"]'); if(s)s.classList.add('bridge-selected'); }
        return;
      }
      if (t === 'HOVER') {
        document.querySelectorAll('.bridge-hovered').forEach(function(el){el.classList.remove('bridge-hovered');});
        if (e.data.id) { var h=document.querySelector('[data-bridge-id="'+e.data.id+'"]'); if(h)h.classList.add('bridge-hovered'); }
        return;
      }
      if (t === 'CLEAR_HOVER') { document.querySelectorAll('.bridge-hovered').forEach(function(el){el.classList.remove('bridge-hovered');}); return; }
      if (t === 'DRAG_OVER') {
        document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
        if (e.data.targetId){var d=document.querySelector('[data-bridge-id="'+e.data.targetId+'"]');if(d)d.classList.add('bridge-drop-'+e.data.position);}
        return;
      }
      if (t === 'DRAG_CLEAR') {
        var g=document.getElementById('bridge-ghost');if(g)g.style.display='none';
        document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
        return;
      }
      if (t === 'DRAG_MOVE') {
        var gm=document.getElementById('bridge-ghost');if(gm){gm.style.display='block';gm.style.left=(e.data.x-40)+'px';gm.style.top=(e.data.y-20)+'px';}
        document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
        var dme=document.elementFromPoint(e.data.x,e.data.y);var dmt=dme?dme.closest('[data-bridge-id]'):null;
        if(dmt){var r=dmt.getBoundingClientRect();var pct=(e.data.y-r.top)/r.height;dmt.classList.add('bridge-drop-'+(pct<0.25?'before':pct>0.75?'after':'inside'));}
        return;
      }
      if (t === 'DRAG_END') {
        var ge=document.getElementById('bridge-ghost');if(ge)ge.style.display='none';
        document.querySelectorAll('.bridge-drop-before,.bridge-drop-after,.bridge-drop-inside').forEach(function(n){n.classList.remove('bridge-drop-before','bridge-drop-after','bridge-drop-inside');});
        var de=document.elementFromPoint(e.data.x,e.data.y);var dt=de?de.closest('[data-bridge-id]'):null;
        var dp='inside';if(dt){var dr=dt.getBoundingClientRect();var dpp=(e.data.y-dr.top)/dr.height;dp=dpp<0.25?'before':dpp>0.75?'after':'inside';}
        window.parent.postMessage({type:'HIT_TEST_RESULT',targetId:dt?dt.getAttribute('data-bridge-id'):null,position:dp},'*');
        return;
      }
    });
    document.addEventListener('click', function(e) {
      if (window.__bridgeInteractMode) return;
      var el=e.target.closest('[data-bridge-id]');
      if(el) window.parent.postMessage({type:'CANVAS_CLICK',id:el.getAttribute('data-bridge-id')},'*');
    });
    var _hid=null;
    document.body.addEventListener('mouseover',function(e){
      if(window.__bridgeInteractMode)return;
      var el=e.target.closest('[data-bridge-id]');var id=el?el.getAttribute('data-bridge-id'):null;
      if(id!==_hid){_hid=id;window.parent.postMessage(id?{type:'CANVAS_HOVER',id:id}:{type:'CANVAS_HOVER_CLEAR'},'*');}
    });
    document.body.addEventListener('mouseleave',function(){if(_hid!==null){_hid=null;window.parent.postMessage({type:'CANVAS_HOVER_CLEAR'},'*');}});
    var _bg=document.createElement('div');_bg.id='bridge-ghost';document.body.appendChild(_bg);
    document.body.addEventListener('mousedown',function(e){
      if(window.__bridgeInteractMode)return;
      var el=e.target.closest('[data-bridge-id]');if(!el)return;
      e.preventDefault();
      window.parent.postMessage({type:'CANVAS_DRAG_START',id:el.getAttribute('data-bridge-id'),x:e.clientX,y:e.clientY},'*');
    });
  <\/script>
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
  const ensureDemoTokens = useTokenStore((state) => state.ensureDemoTokens)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [transformError, setTransformError] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)

  // ── Ghost Proxy drag state + canvas selection ─────────────────────────────
  const { dragSourceId, startDrag, endDrag, setActiveSelection } = useCanvasStore()
  const canvasMode = useCanvasStore((s) => s.canvasMode)
  const setCanvasMode = useCanvasStore((s) => s.setCanvasMode)
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

  useEffect(() => {
    const api = window.bridgeAPI?.preview
    if (!api) return   // Preload not yet available (e.g. Vitest environment)

    if (workspaceFiles == null) {
      // No project open — stop server and revert to srcdoc mode.
      void api.stop().then(() => setPreviewUrl(null))
      return
    }

    const projectRoot = workspaceFiles.path
    void api.start(projectRoot).then((result) => {
      if ('error' in result) {
        console.warn('[Bridge] Vite preview failed to start:', result.error)
        setPreviewUrl(null)
      } else {
        setPreviewUrl(result.url)
      }
    })

    return () => {
      void api.stop().then(() => setPreviewUrl(null))
    }
  }, [workspaceFiles?.path])   // Only restart when the project root changes

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

    // ── Phase N.2: HTML native preview ────────────────────────────────────
    // Bypass Babel/IPC entirely for raw .html files. The HtmlAdapter
    // injects bridge IDs and generates the final source; we wrap it in
    // a Tailwind + Bridge-script srcdoc and set it directly.
    const activeFilePath = useCanvasStore.getState().activeFilePath ?? ''
    if (activeFilePath.endsWith('.html')) {
      const adapter = LanguageRegistry.getAdapter(activeFilePath)
      const ast = adapter.parse(rawCode)
      if (ast !== null) {
        adapter.injectBridgeIds(ast)
        const injectedHtml = adapter.generate(ast)
        if (!cancelled && iframeRef.current !== null) {
          setTransformError(null)
          iframeRef.current.srcdoc = buildHtmlSrcdoc(injectedHtml, tailwindConfigJson)
        }
      }
      return () => { cancelled = true }
    }

    // ── Phase E.1: React/TSX path (unchanged) ───────────────────────────
    // Inject data-bridge-id attributes in renderer before IPC transform.
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

  const handleHydroPaste = async (figmaPayload: string) => {
    console.log('[HydroPaste] Received Figma AST Payload')
    console.log('[HydroPaste] Raw payload (first 2000 chars):', figmaPayload.slice(0, 2000))
    try {
      const response = await window.bridgeAPI.ai.hydroPaste?.(figmaPayload)
      console.log('[HydroPaste] Response from main:', JSON.stringify(response, null, 2))
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

    // Listen for automatic AST ingestion from the main process (via ingestion server)
    const unsubscribe = window.bridgeAPI.ai.onHydroPasteAuto?.((payload: string) => {
      handleHydroPaste(payload).catch(console.error)
    })

    return () => {
      window.removeEventListener('message', handleMessage)
      unsubscribe?.()
    }
  }, [setSelectedNode, setHoveredId, startDrag, endDrag, moveLayerNode, setActiveSelection, canvasMode])

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

  // Sync canvasMode to the iframe whenever it changes.
  // The iframe initialises __bridgeInteractMode to false; this message keeps
  // it in step if the user toggles the mode while a component is loaded.
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage(
      { type: 'SET_INTERACT_MODE', enabled: canvasMode === 'interact' },
      '*'
    )
  }, [canvasMode])

  // Re-apply highlight + current mode after the iframe reloads (srcdoc change navigates it)
  function handleIframeLoad(): void {
    const iframe = iframeRef.current
    if (iframe?.contentWindow == null) return
    iframe.contentWindow.postMessage({ type: 'HIGHLIGHT', id: selectedNodeId }, '*')
    iframe.contentWindow.postMessage(
      { type: 'SET_INTERACT_MODE', enabled: canvasMode === 'interact' },
      '*'
    )
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
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${canvasMode === 'design' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}
          >
            <MousePointer2 size={10} />
            Design
          </button>
          <button
            type="button"
            title="Interact mode: test native events"
            onClick={() => setCanvasMode('interact')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${canvasMode === 'interact' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}
          >
            <Hand size={10} />
            Interact
          </button>
        </div>

        {/* Quick Load */}
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
      <div
        className="relative min-h-0 flex-1 outline-none"
        tabIndex={0}
        onDragOver={(e) => {
          if (canvasMode !== 'design') return
          // Only accept component files from FileExplorer
          if (e.dataTransfer.types.includes('application/bridge-component-file')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }
        }}
        onPaste={async (e) => {
          if (canvasMode !== 'design') return

          let figmaPayload = e.clipboardData.getData('application/x-bridge-figma-ast')

          if (!figmaPayload) {
            const textData = e.clipboardData.getData('text/plain')
            try {
              const parsed = JSON.parse(textData)
              if (parsed && parsed.type === 'application/x-bridge-figma-ast') {
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
          if (canvasMode !== 'design') return
          const sourceFile = e.dataTransfer.getData('application/bridge-component-file')
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
              jsxSnippet: `\n      <${componentName} data-bridge-id="bridge-injected-${Date.now()}" />\n`,
              importSnippet: `import ${componentName} from './${componentName}'`
            }
          ])
        }}
      >
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
          className="absolute inset-0 h-full w-full border-0 bg-gray-900"
          {...(previewUrl != null ? { src: previewUrl } : {})}
          onLoad={handleIframeLoad}
        />
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
