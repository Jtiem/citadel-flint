/**
 * flint-interaction.ts — src/preview-vendor/flint-interaction.ts
 *
 * Shared iframe interaction proxy script injected into all preview srcdocs.
 * Handles: click-to-select, hover highlights, drag-and-drop positioning,
 * interact mode toggling, and Flint <-> iframe message protocol.
 *
 * Framework-agnostic — depends only on `data-flint-id` attributes and DOM APIs.
 * Must be injected as the LAST <script> in every srcdoc document.
 *
 * Extracted from LivePreview.tsx as part of MFP.1 to eliminate 260+ lines of
 * duplication and ensure future bug fixes propagate to all framework builders.
 */

/**
 * Framework-agnostic Flint selection/drag CSS classes.
 * Must be injected into <head> of every srcdoc document.
 */
export const FLINT_INTERACTION_STYLES: string = `
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 1rem; background: #111827; color: #f9fafb; font-family: system-ui, sans-serif; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
    .flint-selected { outline: 2px solid #3b82f6 !important; background-color: rgba(59,130,246,0.1) !important; }
    .flint-drop-before { box-shadow: 0 -3px 0 0 #3b82f6 !important; z-index: 50; }
    .flint-drop-after { box-shadow: 0 3px 0 0 #3b82f6 !important; z-index: 50; }
    .flint-drop-inside { outline: 2px solid #3b82f6 !important; background: rgba(59, 130, 246, 0.2) !important; }
    .flint-hovered { outline: 2px dashed #94a3b8 !important; background: rgba(148, 163, 184, 0.1) !important; cursor: default; z-index: 40; transition: all 0.1s; }
    #flint-ghost { position: fixed; pointer-events: none; border: 2px solid #3b82f6; background: rgba(59,130,246,0.12); border-radius: 4px; z-index: 9999; display: none; width: 80px; height: 40px; }
`

/**
 * Framework-agnostic interaction proxy script.
 * Handles: click-to-select, hover, drag-start, drag-move, drag-end,
 * ghost proxy, highlight, interact mode toggle.
 *
 * Depends only on `data-flint-id` attributes being present on DOM elements.
 * Must be injected as the LAST <script> in every srcdoc document.
 */
export const FLINT_INTERACTION_SCRIPT: string = `
    // Flint: bi-directional Layer Tree \u2194 Preview selection + drag indicators
    // __flintInteractMode: when true, all IDE intercepts (selection, drag, hover)
    // are disabled so native React events in the iframe fire unobstructed.
    window.__flintInteractMode = false;
    window.addEventListener('message', function (e) {
      if (!e.data) return;
      var type = e.data.type;
      if (type === 'SET_INTERACT_MODE') {
        window.__flintInteractMode = !!e.data.enabled;
        return;
      }
      if (type === 'CLEAR_PREVIEW') {
        var root = document.getElementById('root');
        if (root) root.innerHTML = '';
        return;
      }
      if (type === 'HIGHLIGHT') {
        var prev = document.querySelector('.flint-selected');
        if (prev) prev.classList.remove('flint-selected');
        if (e.data.id) {
          var target = document.querySelector('[data-flint-id="' + e.data.id + '"]');
          if (target) target.classList.add('flint-selected');
        }
        return;
      }
      if (type === 'DRAG_OVER') {
        document.querySelectorAll('.flint-drop-before, .flint-drop-after, .flint-drop-inside').forEach(function(el) {
          el.classList.remove('flint-drop-before', 'flint-drop-after', 'flint-drop-inside');
        });
        if (e.data.targetId) {
          var dropEl = document.querySelector('[data-flint-id="' + e.data.targetId + '"]');
          if (dropEl) dropEl.classList.add('flint-drop-' + e.data.position);
        }
        return;
      }
      if (type === 'DRAG_CLEAR') {
        var ghostEl = document.getElementById('flint-ghost');
        if (ghostEl) ghostEl.style.display = 'none';
        document.querySelectorAll('.flint-drop-before, .flint-drop-after, .flint-drop-inside').forEach(function(el) {
          el.classList.remove('flint-drop-before', 'flint-drop-after', 'flint-drop-inside');
        });
        return;
      }
      if (type === 'HOVER') {
        document.querySelectorAll('.flint-hovered').forEach(function(el) {
          el.classList.remove('flint-hovered');
        });
        if (e.data.id) {
          var hoverEl = document.querySelector('[data-flint-id="' + e.data.id + '"]');
          if (hoverEl) hoverEl.classList.add('flint-hovered');
        }
        return;
      }
      if (type === 'CLEAR_HOVER') {
        document.querySelectorAll('.flint-hovered').forEach(function(el) {
          el.classList.remove('flint-hovered');
        });
        return;
      }
      if (type === 'DRAG_MOVE') {
        var ghost = document.getElementById('flint-ghost');
        if (ghost) {
          ghost.style.display = 'block';
          ghost.style.left = (e.data.x - 40) + 'px';
          ghost.style.top  = (e.data.y - 20) + 'px';
        }
        document.querySelectorAll('.flint-drop-before, .flint-drop-after, .flint-drop-inside').forEach(function(n) {
          n.classList.remove('flint-drop-before', 'flint-drop-after', 'flint-drop-inside');
        });
        var dmEl = document.elementFromPoint(e.data.x, e.data.y);
        var dmTarget = dmEl ? dmEl.closest('[data-flint-id]') : null;
        if (dmTarget) {
          var r = dmTarget.getBoundingClientRect();
          var pct = (e.data.y - r.top) / r.height;
          dmTarget.classList.add('flint-drop-' + (pct < 0.25 ? 'before' : pct > 0.75 ? 'after' : 'inside'));
        }
        return;
      }
      if (type === 'DRAG_END') {
        var ghost2 = document.getElementById('flint-ghost');
        if (ghost2) ghost2.style.display = 'none';
        document.querySelectorAll('.flint-drop-before, .flint-drop-after, .flint-drop-inside').forEach(function(n) {
          n.classList.remove('flint-drop-before', 'flint-drop-after', 'flint-drop-inside');
        });
        var deEl = document.elementFromPoint(e.data.x, e.data.y);
        var deTarget = deEl ? deEl.closest('[data-flint-id]') : null;
        var dePos = 'inside';
        if (deTarget) {
          var dr = deTarget.getBoundingClientRect();
          var dp = (e.data.y - dr.top) / dr.height;
          dePos = dp < 0.25 ? 'before' : dp > 0.75 ? 'after' : 'inside';
        }
        window.parent.postMessage({
          type: 'HIT_TEST_RESULT',
          targetId: deTarget ? deTarget.getAttribute('data-flint-id') : null,
          position: dePos,
        }, '*');
        return;
      }
    });
    document.addEventListener('click', function (e) {
      if (window.__flintInteractMode) return;
      var el = e.target.closest('[data-flint-id]');
      if (el) {
        window.parent.postMessage({ type: 'CANVAS_CLICK', id: el.getAttribute('data-flint-id') }, '*');
      }
    });
    var _flintHoverId = null;
    document.body.addEventListener('mouseover', function (e) {
      if (window.__flintInteractMode) return;
      var el = e.target.closest('[data-flint-id]');
      var id = el ? el.getAttribute('data-flint-id') : null;
      if (id !== _flintHoverId) {
        _flintHoverId = id;
        window.parent.postMessage(
          id ? { type: 'CANVAS_HOVER', id: id } : { type: 'CANVAS_HOVER_CLEAR' },
          '*'
        );
      }
    });
    document.body.addEventListener('mouseleave', function () {
      if (window.__flintInteractMode) return;
      if (_flintHoverId !== null) {
        _flintHoverId = null;
        window.parent.postMessage({ type: 'CANVAS_HOVER_CLEAR' }, '*');
      }
    });
    // ── Ghost Proxy: initiation ───────────────────────────────────────────────
    // Create the ghost element once; it is shown/hidden by DRAG_MOVE / DRAG_END.
    var _flintGhost = document.createElement('div');
    _flintGhost.id = 'flint-ghost';
    document.body.appendChild(_flintGhost);
    // Drag requires the pointer to move >= 5 px before CANVAS_DRAG_START is sent.
    // A plain click (no movement) is handled by the separate 'click' listener above.
    (function () {
      var _pendingDrag = null;
      var DRAG_THRESHOLD = 5;
      document.body.addEventListener('mousedown', function (e) {
        if (window.__flintInteractMode) return;
        var el = e.target.closest('[data-flint-id]');
        if (!el) return;
        _pendingDrag = { el: el, startX: e.clientX, startY: e.clientY };
      });
      document.addEventListener('mousemove', function (e) {
        if (!_pendingDrag) return;
        var dx = e.clientX - _pendingDrag.startX;
        var dy = e.clientY - _pendingDrag.startY;
        if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
          var id = _pendingDrag.el.getAttribute('data-flint-id');
          _pendingDrag = null;
          e.preventDefault();
          window.parent.postMessage({
            type: 'CANVAS_DRAG_START',
            id: id,
            x: e.clientX,
            y: e.clientY,
          }, '*');
        }
      });
      document.addEventListener('mouseup', function () { _pendingDrag = null; });
    })();
`
