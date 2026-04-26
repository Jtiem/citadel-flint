/**
 * XYCanvas — src/components/editor/XYCanvas.tsx
 *
 * Module A: The Infinite Whiteboard Canvas.
 *
 * Mounts an @xyflow/react (React Flow v12) instance that hosts the Flint Glass
 * Live Preview as a draggable, resizable node on an infinite whiteboard.
 *
 * GLASS.1c: Canvas modes (Build/Govern) have been removed. The canvas always
 * renders the LivePreview + Shield/Ghost overlays. Component browsing and
 * governance are handled by sidebar panels.
 *
 * Design decisions:
 *  - A *single* `livePreviewNode` is placed at the origin (0, 0) on first
 *    render. Subsequent renders do NOT re-create it (stable initialNodes) so
 *    the user can freely reposition it without the position snapping back.
 *  - The LivePreview component is rendered via a custom XYFlow node type
 *    (`livePreviewNodeType`). DOM events inside the iframe still propagate
 *    through the Shield overlay exactly as before — XYFlow only controls the
 *    surrounding whiteboard chrome (pan/zoom/handle).
 *  - Panning is restricted to the mouse-wheel + spacebar-drag UX: this avoids
 *    conflicts with the Shield overlay's drag handling in 'design' mode.
 *  - The XYFlow `MiniMap` and `Controls` are rendered for navigation UX.
 *  - MithrilProvider must wrap this component at the call site (in App.tsx),
 *    since LivePreview reads from the MithrilContext.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
// debounce delay for Shift+scroll breakpoint cycling (ms)
const BREAKPOINT_SCROLL_DEBOUNCE_MS = 200;
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, NodeResizer, type NodeTypes, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LivePreview } from './LivePreview';
import { GhostCodeSnippet } from './GhostCodeSnippet';
import { useCanvasStore } from '../../store/canvasStore';
import { useASTBufferStore } from '../../store/astBufferStore';
import { useAnnotationStore } from '../../store/annotationStore';

// ── Custom node: LivePreview ────────────────────────────────────────────────

type LivePreviewData = Record<string, never>;

/**
 * AnnotationBadge — exported for testability.
 *
 * Reads open annotations from annotationStore and renders a count badge.
 * Returns null when there are no open annotations.
 * Exported so tests can render it in isolation without XYFlow dependencies.
 */
export function AnnotationBadge() {
  const annotations = useAnnotationStore(s => s.annotations);
  const openCount = annotations.filter(a => a.status === 'open').length;
  if (openCount === 0) return null;
  const label = openCount === 1 ? '1 open annotation' : `${openCount} open annotations`;
  return <button type="button" className="group absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[var(--spacing.2, 8px)] text-white shadow-sm" data-testid="annotation-badge" aria-label={label} onClick={() => {
    useCanvasStore.getState().setRightTab('notes');
  }}>
            {openCount}
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute left-0 top-full mt-1 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[var(--spacing.2, 8px)] text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100" data-testid="annotation-badge-tooltip">
                {label}
            </span>
        </button>;
}

/**
 * S8.1: Violation indicator dot for canvas nodes.
 * Reads from canvasStore.mithrilViolations and canvasStore.a11yViolations.
 */
function ViolationIndicator() {
  const mithrilViolations = useCanvasStore(s => s.mithrilViolations);
  const a11yViolations = useCanvasStore(s => s.a11yViolations);
  const {
    color,
    count,
    label
  } = useMemo(() => {
    const mithrilCount = mithrilViolations.length;
    const a11yCount = Object.keys(a11yViolations).length;
    const total = mithrilCount + a11yCount;
    if (total === 0) return {
      color: '',
      count: 0,
      label: ''
    };
    // Red for blocking (a11y) issues, amber for warnings (mithril drift)
    const hasBlocking = a11yCount > 0;
    return {
      color: hasBlocking ? 'bg-red-500' : 'bg-amber-400',
      count: total,
      label: `${total} issue${total !== 1 ? 's' : ''}`
    };
  }, [mithrilViolations, a11yViolations]);
  if (count === 0) return null;
  return <button type="button" className="group absolute right-2 top-2 z-10" data-testid="violation-indicator" aria-label={label} onClick={() => {
    useCanvasStore.getState().setRightTab('governance');
  }}>
            <span className={`block h-3 w-3 rounded-full ${color} shadow-sm`} />
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute right-0 top-full mt-1 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[var(--spacing.2, 8px)] text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {label}
            </span>
        </button>;
}

/**
 * XYFlow custom node that renders the Flint LivePreview iframe.
 *
 * `nodrag` class on the wrapping div prevents XYFlow's built-in drag from
 * interfering with the inner Shield overlay's drag logic. The node *header*
 * (the chrome bar above) remains draggable via the `drag-handle` class.
 *
 * T5.2: Size is initialised from canvasStore (persisted to localStorage) and
 * saved back on NodeResizer onResizeEnd so the size survives session reloads.
 */
function LivePreviewNode() {
  const previewWidth = useCanvasStore(s => s.previewWidth);
  const previewHeight = useCanvasStore(s => s.previewHeight);
  const setPreviewSize = useCanvasStore(s => s.setPreviewSize);
  return <>
            {/* T5.2: NodeResizer — persist final size to canvasStore on drag end */}
            <NodeResizer minWidth={300} minHeight={200} onResizeEnd={(_event, params) => {
      setPreviewSize(Math.round(params.width), Math.round(params.height));
    }} />
        <div className="relative flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/60" style={{
      width: previewWidth,
      height: previewHeight
    }}>
            {/* S8.1: Violation indicator dot (top-right corner) */}
            <ViolationIndicator />

            {/* ── Window chrome drag handle ───────────────────────────── */}
            <div
      /* `drag-handle` is the class React Flow uses when nodeDragThreshold
         and dragHandle are set to .drag-handle on the parent node.     */ className="drag-handle group flex shrink-0 cursor-grab items-center justify-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-2 active:cursor-grabbing" tabIndex={0} role="button" aria-label="Drag to reposition preview panel. Use arrow keys when focused.">
                <GripHorizontal size={14} className="text-zinc-600 transition-colors group-hover:text-zinc-400" />
                <span className="text-[var(--spacing.2, 8px)] text-zinc-600 opacity-0 transition-colors group-hover:text-zinc-400 group-hover:opacity-100">
                    Drag to reposition
                </span>
            </div>

            {/* ── The actual preview — fills remaining height ─────────── */}
            <div className="nodrag min-h-0 flex-1">
                <LivePreview />
            </div>
        </div>
        </>;
}

// ── Node types registry ─────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  livePreview: LivePreviewNode as NodeTypes[string]
};

// ── Initial node placement ──────────────────────────────────────────────────

const INITIAL_NODES: Node<LivePreviewData>[] = [{
  id: 'live-preview',
  type: 'livePreview',
  position: {
    x: 0,
    y: 0
  },
  data: {},
  // Allow resize handles but lock content drag to the chrome bar only.
  dragHandle: '.drag-handle'
}];

// ── XYCanvas ────────────────────────────────────────────────────────────────

/**
 * XYCanvas
 *
 * Drop-in replacement for the raw `<LivePreview />` in the center panel.
 * Renders the infinite React Flow whiteboard with the LivePreview node.
 *
 * The parent container must have an explicit height (e.g. `h-full` / flex-1)
 * for React Flow to size itself correctly — React Flow relies on its parent's
 * measured dimensions.
 */
/**
 * The MIME type used when a .tsx file is dragged from the FileExplorer.
 * Checked during dragover/drop to gate acceptance.
 */
const FLINT_COMPONENT_FILE_TYPE = 'application/flint-component-file';
const FLINT_SOURCE_ID_TYPE = 'application/flint-source-id';
export function XYCanvas() {
  const cyclePreviewBreakpoint = useCanvasStore(s => s.cyclePreviewBreakpoint);
  const onInit = useCallback(() => {
    // Future: can expose fitView / zoom controls from here.
  }, []);
  const proOptions = {
    hideAttribution: true
  };

  // ── Shift+scroll: cycle responsive breakpoint ───────────────────────────
  // Debounced to 200 ms so rapid scroll events only fire once per intent.
  const breakpointScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function handleWheel(e: WheelEvent): void {
      // Only intercept when Shift is held.
      if (!e.shiftKey) return;

      // Prevent XYFlow from panning on Shift+scroll.
      e.preventDefault();
      e.stopPropagation();

      // Debounce: ignore rapid scroll ticks — only fire on the first tick
      // of each gesture.
      if (breakpointScrollTimer.current !== null) return;
      breakpointScrollTimer.current = setTimeout(() => {
        breakpointScrollTimer.current = null;
      }, BREAKPOINT_SCROLL_DEBOUNCE_MS);

      // deltaY < 0 → scroll up → cycle forward; deltaY > 0 → scroll down → cycle backward
      cyclePreviewBreakpoint(e.deltaY < 0 ? 'up' : 'down');
    }

    // Must use passive: false to allow preventDefault()
    window.addEventListener('wheel', handleWheel, {
      passive: false
    });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (breakpointScrollTimer.current !== null) {
        clearTimeout(breakpointScrollTimer.current);
        breakpointScrollTimer.current = null;
      }
    };
  }, [cyclePreviewBreakpoint]);

  // ── Cross-file drop state ───────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only accept flint component file drops — ignore all other drag types.
    if (e.dataTransfer.types.includes(FLINT_COMPONENT_FILE_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(FLINT_COMPONENT_FILE_TYPE)) {
      setIsDragOver(true);
    }
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear the indicator when the cursor genuinely leaves the container,
    // not when it enters a child element.
    const container = e.currentTarget;
    if (!container.contains(e.relatedTarget as globalThis.Node | null)) {
      setIsDragOver(false);
    }
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const sourceFile = e.dataTransfer.getData(FLINT_COMPONENT_FILE_TYPE);
    // sourceNodeId may be empty string when the drag originated from a file
    // node (FileExplorer) rather than a LayerTree row. In that case we pass
    // an empty string and crossFileMove's internal null-fallback for
    // effectiveTargetId will resolve the root JSX element automatically.
    const sourceNodeId = e.dataTransfer.getData(FLINT_SOURCE_ID_TYPE);
    if (!sourceFile) return;
    const targetFile = useCanvasStore.getState().activeFilePath;
    // Guard: no open file, or dropped onto itself.
    if (!targetFile || targetFile === sourceFile) return;

    // Canvas drops are always clone operations — the source file remains intact.
    // Use empty string as sourceNodeId when not provided; crossFileMove treats
    // it the same as a missing ID and will fall back to the root node.
    void useASTBufferStore.getState().crossFileMove(sourceFile, targetFile, sourceNodeId || '', null,
    // append to root of target file
    'inside', {
      cloneMode: true
    });
  }, []);
  return <div className={`relative h-full w-full transition-shadow ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop} data-testid="xy-canvas-container">
            {/* T3.3: Custom scrollbar styling for any overflow children */}
            <style>{`
                [data-testid="xy-canvas-container"] ::-webkit-scrollbar { width: 6px; height: 6px; }
                [data-testid="xy-canvas-container"] ::-webkit-scrollbar-thumb { background: rgb(63 63 70); border-radius: 3px; } /* zinc-700 */
                [data-testid="xy-canvas-container"] ::-webkit-scrollbar-track { background: transparent; }
            `}</style>
            {/* GLASS.1c — Canvas is always the canvas. No Build/Govern modes. */}
            <ReactFlow defaultNodes={INITIAL_NODES} nodeTypes={nodeTypes} onInit={onInit} fitView fitViewOptions={{
      padding: 0.15,
      maxZoom: 1
    }} panOnScroll panOnDrag={[1, 2]} // middle-click or right-drag to pan
    selectionOnDrag={false} elementsSelectable={false} zoomOnDoubleClick={false} proOptions={proOptions} className="bg-gray-900" /* T3.2: lightened from bg-gray-950 */>
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgb(55 65 81)" /* gray-700 */ />
                <Controls showInteractive={false} className="[&>button]:border-gray-700 [&>button]:bg-gray-900 [&>button]:text-gray-400 [&>button:hover]:bg-gray-800" />
                <MiniMap nodeColor="rgb(79 70 229)" /* indigo-600 */ maskColor="rgba(0,0,0,0.6)" style={{
        background: 'rgb(17 24 39)' /* gray-900 */,
        border: '1px solid rgb(31 41 55)' /* gray-800 */
      }} />
            </ReactFlow>

            {/* U.4 — Ghost Code Snippet overlay: floats above canvas when a node is selected */}
            <GhostCodeSnippet />
        </div>;
}