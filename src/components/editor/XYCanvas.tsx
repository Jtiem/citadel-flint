/**
 * XYCanvas — src/components/editor/XYCanvas.tsx
 *
 * Module A: The Infinite Whiteboard Canvas.
 *
 * Mounts an @xyflow/react (React Flow v12) instance that hosts the Flint IDE
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
 *
 * CV2.1 additions:
 *  - CanvasViewToggle is rendered in ALL three view modes (always visible).
 *  - When `canvasView === 'build'` or `'govern'`, placeholder panels replace
 *    the ReactFlow canvas. GhostCodeSnippet is gated to `'preview'` only.
 *  - `handleDrop` is a no-op when not in preview mode (contract §8 risk table).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// debounce delay for Shift+scroll breakpoint cycling (ms)
const BREAKPOINT_SCROLL_DEBOUNCE_MS = 200
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    type NodeTypes,
    type EdgeTypes,
    type Node,
    type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LivePreview } from './LivePreview'
import { GhostCodeSnippet } from './GhostCodeSnippet'
import { CanvasViewToggle } from './CanvasViewToggle'
import { ComponentCardNode } from './ComponentCardNode'
import { DependencyEdge } from './DependencyEdge'
import { Search, X } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useASTBufferStore } from '../../store/astBufferStore'
import { useComponentCardStore } from '../../store/componentCardStore'
import { RecipeStrip } from './RecipeStrip'
import type { ComponentCategory } from '../../types/flint-api'

// ── Custom node: LivePreview ────────────────────────────────────────────────

type LivePreviewData = Record<string, never>

/**
 * XYFlow custom node that renders the Flint LivePreview iframe.
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
    componentCard: ComponentCardNode as NodeTypes[string],
}

// ── Edge types registry ─────────────────────────────────────────────────────

const edgeTypes: EdgeTypes = {
    dependency: DependencyEdge as EdgeTypes[string],
}

// ── Empty edges constant (avoids new array reference on every render) ────────

const EMPTY_EDGES = [] as const

// ── CV2.7: Category options for the filter dropdown ──────────────────────────

const CATEGORY_OPTIONS: Array<{ value: ComponentCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'primitive', label: 'Primitive' },
    { value: 'molecule', label: 'Molecule' },
    { value: 'organism', label: 'Organism' },
    { value: 'page', label: 'Page' },
    { value: 'layout', label: 'Layout' },
    { value: 'uncategorized', label: 'Uncategorized' },
]

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
/**
 * The MIME type used when a .tsx file is dragged from the FileExplorer.
 * Checked during dragover/drop to gate acceptance.
 */
const FLINT_COMPONENT_FILE_TYPE = 'application/flint-component-file'
const FLINT_SOURCE_ID_TYPE = 'application/flint-source-id'

export function XYCanvas() {
    // ── CV2.1: Canvas view mode ─────────────────────────────────────────────
    const canvasView = useCanvasStore((s) => s.canvasView)
    const cyclePreviewBreakpoint = useCanvasStore((s) => s.cyclePreviewBreakpoint)

    // ── CV2.3: Component card store ─────────────────────────────────────────
    const loadCards = useComponentCardStore((s) => s.loadCards)
    const updatePosition = useComponentCardStore((s) => s.updatePosition)
    const savePositions = useComponentCardStore((s) => s.savePositions)
    const isLoaded = useComponentCardStore((s) => s.isLoaded)

    // Subscribe to the underlying state slices (stable primitives/references)
    // then derive nodes/edges with useMemo. This avoids calling toFlowNodes()
    // inside a Zustand selector, which creates new array references on every call
    // and causes infinite re-render loops (Zustand shallow-equality check fails).
    const cards = useComponentCardStore((s) => s.cards)
    const cardPositions = useComponentCardStore((s) => s.cardPositions)
    const selectedCardId = useComponentCardStore((s) => s.selectedCardId)

    // CV2.7: Search + category filter state
    const searchQuery = useComponentCardStore((s) => s.searchQuery)
    const categoryFilter = useComponentCardStore((s) => s.categoryFilter)
    const setSearchQuery = useComponentCardStore((s) => s.setSearchQuery)
    const setCategoryFilter = useComponentCardStore((s) => s.setCategoryFilter)

    // Coverage heat map toggle (Govern mode only)
    const showCoverageHeatMap = useComponentCardStore((s) => s.showCoverageHeatMap)
    const toggleCoverageHeatMap = useComponentCardStore((s) => s.toggleCoverageHeatMap)

    // Local controlled input value — debounced 150 ms before committing to store.
    const [inputValue, setInputValue] = useState(searchQuery)
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Keep local input in sync if the store resets externally (e.g. clearCards).
    useEffect(() => {
        setInputValue(searchQuery)
    }, [searchQuery])

    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value
            setInputValue(value)
            if (debounceTimer.current !== null) {
                clearTimeout(debounceTimer.current)
            }
            debounceTimer.current = setTimeout(() => {
                debounceTimer.current = null
                setSearchQuery(value)
            }, 150)
        },
        [setSearchQuery],
    )

    const handleCategoryChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setCategoryFilter(e.target.value as ComponentCategory | 'all')
        },
        [setCategoryFilter],
    )

    const handleClearFilters = useCallback(() => {
        if (debounceTimer.current !== null) {
            clearTimeout(debounceTimer.current)
            debounceTimer.current = null
        }
        setInputValue('')
        setSearchQuery('')
        setCategoryFilter('all')
    }, [setSearchQuery, setCategoryFilter])

    // Clean up debounce timer on unmount.
    useEffect(() => {
        return () => {
            if (debounceTimer.current !== null) {
                clearTimeout(debounceTimer.current)
            }
        }
    }, [])

    const filtersActive = searchQuery !== '' || categoryFilter !== 'all'

    // Total card count for the result indicator (unfiltered).
    const totalCardCount = cards.length

    const effectiveView = canvasView === 'preview' ? 'build' : canvasView

    const flowNodes = useMemo(
        () => useComponentCardStore.getState().toFlowNodes(effectiveView),
        // Re-compute when the underlying data or view changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cards, cardPositions, selectedCardId, effectiveView, searchQuery, categoryFilter],
    )

    // Visible count is the number of nodes after filtering.
    const visibleCardCount = flowNodes.length

    // Coverage summary: grade distribution across visible cards (Govern mode).
    const coverageSummary = useMemo(() => {
        if (canvasView !== 'govern') return null

        let gradeA = 0, gradeB = 0, gradeC = 0, gradeD = 0, gradeF = 0, noData = 0

        for (const node of flowNodes) {
            const grade = node.data.card.health?.grade ?? null
            if (grade === 'A') gradeA++
            else if (grade === 'B') gradeB++
            else if (grade === 'C') gradeC++
            else if (grade === 'D') gradeD++
            else if (grade === 'F') gradeF++
            else noData++
        }

        const total = flowNodes.length
        const governedCount = gradeA + gradeB
        const governedPct = total > 0 ? Math.round((governedCount / total) * 100) : 0

        return { gradeA, gradeB, gradeC, gradeD, gradeF, noData, total, governedCount, governedPct }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowNodes, canvasView])

    const flowEdges = useMemo(
        () => canvasView === 'govern' ? useComponentCardStore.getState().toFlowEdges() : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cards, canvasView, searchQuery, categoryFilter],
    )

    // Load cards when switching into build or govern mode
    useEffect(() => {
        if (canvasView === 'build' || canvasView === 'govern') {
            if (!isLoaded) {
                void loadCards()
            }
        }
    }, [canvasView, isLoaded, loadCards])

    // Controlled onNodesChange handler: position changes from React Flow drag
    // are written back to the store. Only position changes are handled here —
    // React Flow may also emit selection changes, but those go through the
    // selectCard action via onClick on ComponentCardNode, not through this handler.
    const handleNodesChange = useCallback((changes: NodeChange[]) => {
        for (const change of changes) {
            if (change.type === 'position' && change.position && change.id) {
                updatePosition(change.id, change.position)
            }
        }
    }, [updatePosition])

    // On drag stop, persist positions to disk (debounced 500ms in store).
    const handleNodeDragStop = useCallback(() => {
        savePositions()
    }, [savePositions])

    const onInit = useCallback(() => {
        // Future: can expose fitView / zoom controls from here.
    }, [])

    const proOptions = useMemo(() => ({ hideAttribution: true }), [])

    // ── Shift+scroll: cycle responsive breakpoint (preview mode only) ─────────
    // Debounced to 200 ms so rapid scroll events only fire once per intent.
    const breakpointScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        function handleWheel(e: WheelEvent): void {
            // Only intercept when Shift is held and the canvas is in preview mode.
            if (!e.shiftKey) return
            if (useCanvasStore.getState().canvasView !== 'preview') return

            // Prevent XYFlow from panning on Shift+scroll.
            e.preventDefault()
            e.stopPropagation()

            // Debounce: ignore rapid scroll ticks — only fire on the first tick
            // of each gesture.
            if (breakpointScrollTimer.current !== null) return
            breakpointScrollTimer.current = setTimeout(() => {
                breakpointScrollTimer.current = null
            }, BREAKPOINT_SCROLL_DEBOUNCE_MS)

            // deltaY < 0 → scroll up → cycle forward; deltaY > 0 → scroll down → cycle backward
            cyclePreviewBreakpoint(e.deltaY < 0 ? 'up' : 'down')
        }

        // Must use passive: false to allow preventDefault()
        window.addEventListener('wheel', handleWheel, { passive: false })
        return () => {
            window.removeEventListener('wheel', handleWheel)
            if (breakpointScrollTimer.current !== null) {
                clearTimeout(breakpointScrollTimer.current)
                breakpointScrollTimer.current = null
            }
        }
    }, [cyclePreviewBreakpoint])

    // ── Cross-file drop state ───────────────────────────────────────────────
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        // Only accept flint component file drops — ignore all other drag types.
        if (e.dataTransfer.types.includes(FLINT_COMPONENT_FILE_TYPE)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
        }
    }, [])

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        if (e.dataTransfer.types.includes(FLINT_COMPONENT_FILE_TYPE)) {
            setIsDragOver(true)
        }
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        // Only clear the indicator when the cursor genuinely leaves the container,
        // not when it enters a child element.
        const container = e.currentTarget
        if (!container.contains(e.relatedTarget as globalThis.Node | null)) {
            setIsDragOver(false)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragOver(false)

        // CV2.1 risk table §8: drops are no-ops when not in preview mode.
        // In build/govern mode the ReactFlow target is gone, so crossFileMove
        // would have no valid canvas context. Guard here rather than relying on
        // downstream null-checks.
        if (useCanvasStore.getState().canvasView !== 'preview') return

        const sourceFile = e.dataTransfer.getData(FLINT_COMPONENT_FILE_TYPE)
        // sourceNodeId may be empty string when the drag originated from a file
        // node (FileExplorer) rather than a LayerTree row. In that case we pass
        // an empty string and crossFileMove's internal null-fallback for
        // effectiveTargetId will resolve the root JSX element automatically.
        const sourceNodeId = e.dataTransfer.getData(FLINT_SOURCE_ID_TYPE)

        if (!sourceFile) return

        const targetFile = useCanvasStore.getState().activeFilePath
        // Guard: no open file, or dropped onto itself.
        if (!targetFile || targetFile === sourceFile) return

        // Canvas drops are always clone operations — the source file remains intact.
        // Use empty string as sourceNodeId when not provided; crossFileMove treats
        // it the same as a missing ID and will fall back to the root node.
        void useASTBufferStore.getState().crossFileMove(
            sourceFile,
            targetFile,
            sourceNodeId || '',
            null,       // append to root of target file
            'inside',
            { cloneMode: true },
        )
    }, [])

    return (
        <div
            className={`relative h-full w-full transition-shadow ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="xy-canvas-container"
        >
            {/* CV2.1 — Toggle is always visible in all three view modes */}
            <CanvasViewToggle />

            {/* CV2.7 — Search / filter bar: only in build and govern modes ── */}
            {(canvasView === 'build' || canvasView === 'govern') && (
                <div
                    className="absolute left-0 right-0 top-0 z-10 flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 backdrop-blur-sm"
                    data-testid="component-search-bar"
                >
                    {/* Search icon + input */}
                    <div className="relative flex flex-1 items-center">
                        <Search size={12} className="pointer-events-none absolute left-2 text-zinc-500" />
                        <input
                            type="text"
                            value={inputValue}
                            onChange={handleSearchChange}
                            placeholder="Search components..."
                            className="w-full rounded border border-zinc-800 bg-zinc-800 py-1 pl-6 pr-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500/30 focus:ring-0"
                            data-testid="component-search-input"
                        />
                    </div>

                    {/* Category dropdown */}
                    <select
                        value={categoryFilter}
                        onChange={handleCategoryChange}
                        className="rounded border border-zinc-800 bg-zinc-800 px-2 py-1 text-xs text-zinc-400 outline-none focus:border-indigo-500/30"
                        data-testid="component-category-select"
                    >
                        {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* Result count */}
                    <span className="shrink-0 text-xs text-zinc-500" data-testid="component-result-count">
                        {filtersActive
                            ? `${visibleCardCount} of ${totalCardCount}`
                            : `${totalCardCount} components`}
                    </span>

                    {/* Clear button — only when filters are active */}
                    {filtersActive && (
                        <button
                            onClick={handleClearFilters}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Clear filters"
                            data-testid="component-clear-filters"
                        >
                            <X size={12} />
                        </button>
                    )}

                    {/* Govern mode: heat map toggle */}
                    {canvasView === 'govern' && (
                        <button
                            onClick={toggleCoverageHeatMap}
                            className={`
                                shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors
                                ${showCoverageHeatMap
                                    ? 'border-amber-500/30 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30'
                                    : 'border-zinc-700/50 bg-zinc-800 text-zinc-500 hover:text-zinc-300'}
                            `.trim()}
                            title={showCoverageHeatMap ? 'Hide heat map' : 'Show heat map'}
                            data-testid="coverage-heatmap-toggle"
                        >
                            Heat Map
                        </button>
                    )}
                </div>
            )}

            {/* Govern mode: coverage summary bar */}
            {canvasView === 'govern' && coverageSummary !== null && coverageSummary.total > 0 && (
                <div
                    className="absolute left-0 right-0 z-10 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/90 px-3 py-1 backdrop-blur-sm"
                    style={{ top: 37 }}
                    data-testid="coverage-summary-bar"
                >
                    <span className="text-[10px] text-zinc-500">Coverage:</span>
                    <span className="text-[10px] font-medium text-zinc-300">
                        {coverageSummary.governedPct}% governed
                    </span>
                    <span className="text-[10px] text-zinc-600">|</span>
                    <span className="text-[10px] text-emerald-400" data-testid="coverage-grade-a">
                        {coverageSummary.gradeA} A
                    </span>
                    <span className="text-[10px] text-emerald-400" data-testid="coverage-grade-b">
                        {coverageSummary.gradeB} B
                    </span>
                    <span className="text-[10px] text-amber-400" data-testid="coverage-grade-c">
                        {coverageSummary.gradeC} C
                    </span>
                    <span className="text-[10px] text-red-400" data-testid="coverage-grade-d">
                        {coverageSummary.gradeD} D
                    </span>
                    <span className="text-[10px] text-red-400" data-testid="coverage-grade-f">
                        {coverageSummary.gradeF} F
                    </span>
                    {coverageSummary.noData > 0 && (
                        <span className="text-[10px] text-zinc-600" data-testid="coverage-grade-none">
                            {coverageSummary.noData} —
                        </span>
                    )}
                </div>
            )}

            {/* ── Preview mode: existing ReactFlow canvas (CV2.1 default) ── */}
            {canvasView === 'preview' && (
                <>
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

                    {/* U.4 — Ghost Code Snippet overlay: floats above canvas when a node is selected */}
                    <GhostCodeSnippet />
                </>
            )}

            {/* ── Build mode: Recipe Strip (below search bar) ───────────── */}
            {canvasView === 'build' && (
                <div
                    className="absolute left-0 right-0 z-10"
                    style={{ top: 37 }}
                    data-testid="recipe-strip-wrapper"
                >
                    <RecipeStrip />
                </div>
            )}

            {/* ── Build mode: Component Library (CV2.3) ─────────────────── */}
            {canvasView === 'build' && (
                <ReactFlow
                    key="card-canvas-build"
                    nodes={flowNodes}
                    edges={EMPTY_EDGES as unknown as Parameters<typeof ReactFlow>[0]['edges']}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={handleNodesChange}
                    onNodeDragStop={handleNodeDragStop}
                    onInit={onInit}
                    fitView
                    fitViewOptions={{ padding: 0.15, maxZoom: 1.5 }}
                    panOnScroll
                    panOnDrag={[1, 2]}
                    selectionOnDrag={false}
                    elementsSelectable={true}
                    zoomOnDoubleClick={false}
                    proOptions={proOptions}
                    className="bg-zinc-950"
                    data-testid="canvas-build-flow"
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={24}
                        size={1}
                        color="#27272a"
                    />
                    <Controls
                        showInteractive={false}
                        className="[&>button]:border-zinc-700 [&>button]:bg-zinc-900 [&>button]:text-zinc-400 [&>button:hover]:bg-zinc-800"
                    />
                    <MiniMap
                        nodeColor="#4f46e5"
                        maskColor="rgba(0,0,0,0.6)"
                        style={{ background: '#09090b', border: '1px solid #27272a' }}
                    />
                </ReactFlow>
            )}

            {/* ── Govern mode: Compliance Map (CV2.3) ──────────────────── */}
            {canvasView === 'govern' && (
                <ReactFlow
                    key="card-canvas-govern"
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={handleNodesChange}
                    onNodeDragStop={handleNodeDragStop}
                    onInit={onInit}
                    fitView
                    fitViewOptions={{ padding: 0.15, maxZoom: 1.5 }}
                    panOnScroll
                    panOnDrag={[1, 2]}
                    selectionOnDrag={false}
                    elementsSelectable={true}
                    zoomOnDoubleClick={false}
                    proOptions={proOptions}
                    className="bg-zinc-950"
                    data-testid="canvas-govern-flow"
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={24}
                        size={1}
                        color="#27272a"
                    />
                    <Controls
                        showInteractive={false}
                        className="[&>button]:border-zinc-700 [&>button]:bg-zinc-900 [&>button]:text-zinc-400 [&>button:hover]:bg-zinc-800"
                    />
                    <MiniMap
                        nodeColor="#4f46e5"
                        maskColor="rgba(0,0,0,0.6)"
                        style={{ background: '#09090b', border: '1px solid #27272a' }}
                    />
                </ReactFlow>
            )}
        </div>
    )
}
