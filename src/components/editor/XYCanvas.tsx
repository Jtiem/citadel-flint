/**
 * XYCanvas — src/components/editor/XYCanvas.tsx
 *
 * Module A: The Infinite Whiteboard Canvas.
 *
 * Mounts an @xyflow/react (React Flow v12) instance that hosts the Bridge IDE
 * Live Preview as a draggable, resizable node on an infinite whiteboard.
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

import { useCallback, useMemo } from 'react'
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    type NodeTypes,
    type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LivePreview } from './LivePreview'

// ── Custom node: LivePreview ────────────────────────────────────────────────

type LivePreviewData = Record<string, never>

/**
 * XYFlow custom node that renders the Bridge LivePreview iframe.
 *
 * `nodrag` class on the wrapping div prevents XYFlow's built-in drag from
 * interfering with the inner Shield overlay's drag logic. The node *header*
 * (the chrome bar above) remains draggable via the `drag-handle` class.
 */
function LivePreviewNode() {
    return (
        <div
            className="flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-2xl shadow-black/60"
            style={{ width: 900, height: 600 }}
        >
            {/* ── Window chrome drag handle ───────────────────────────── */}
            <div
                /* `drag-handle` is the class React Flow uses when nodeDragThreshold
                   and dragHandle are set to .drag-handle on the parent node.     */
                className="drag-handle flex shrink-0 cursor-grab items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-2 active:cursor-grabbing"
            >
                {/* Traffic-light pills */}
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Live Preview · srcdoc Engine
                </span>
            </div>

            {/* ── The actual preview — fills remaining height ─────────── */}
            <div className="nodrag min-h-0 flex-1">
                <LivePreview />
            </div>
        </div>
    )
}

// ── Node types registry ─────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
    livePreview: LivePreviewNode as NodeTypes[string],
}

// ── Initial node placement ──────────────────────────────────────────────────

const INITIAL_NODES: Node<LivePreviewData>[] = [
    {
        id: 'live-preview',
        type: 'livePreview',
        position: { x: 0, y: 0 },
        data: {},
        // Allow resize handles but lock content drag to the chrome bar only.
        dragHandle: '.drag-handle',
    },
]

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
export function XYCanvas() {
    // Stable node-change handler — keeps node positions in sync after drag.
    // We use the built-in `onNodesChange` but don't need external state because
    // we never need to persist canvas layout to the AST (nodes are canvas chrome,
    // not AST nodes). React Flow manages position internally when nodes are
    // uncontrolled (initialNodes).
    const onInit = useCallback(() => {
        // Future: can expose fitView / zoom controls from here.
    }, [])

    const proOptions = useMemo(() => ({ hideAttribution: true }), [])

    return (
        <ReactFlow
            defaultNodes={INITIAL_NODES}
            nodeTypes={nodeTypes}
            onInit={onInit}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            panOnScroll
            panOnDrag={[1, 2]} // middle-click or right-drag to pan
            selectionOnDrag={false}
            elementsSelectable={false}
            zoomOnDoubleClick={false}
            proOptions={proOptions}
            className="bg-gray-950"
        >
            <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
                color="#374151"
            />
            <Controls
                showInteractive={false}
                className="[&>button]:border-gray-700 [&>button]:bg-gray-900 [&>button]:text-gray-400 [&>button:hover]:bg-gray-800"
            />
            <MiniMap
                nodeColor="#4f46e5"
                maskColor="rgba(0,0,0,0.6)"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
            />
        </ReactFlow>
    )
}
