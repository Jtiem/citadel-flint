/**
 * LayerTree — src/components/ui/LayerTree.tsx
 *
 * Recursive layer hierarchy panel derived from the live AST visual tree.
 * Each row shows:
 *   - A collapse chevron (▶ / ▼) for nodes with children
 *   - A type icon  (◇ component · # element · T text)
 *   - An inferred human-readable name produced by the layerNaming engine
 *   - A secondary tag badge showing the raw JSX tag name
 *   - A hover-only </> button that jumps the code editor to that source line
 *
 * Collapse / expand:
 *   `collapsedIds` state lives in the `LayerTree` root and is passed down.
 *   Clicking the chevron calls `onToggleCollapsed` with the node id.
 *   Leaf nodes receive an invisible spacer to keep icon alignment consistent.
 *
 * Drag-and-drop reordering:
 *   Each row is draggable. While dragging over a target row a positional
 *   indicator is shown:
 *     · Top blue line  — 'before' (top 25 % of row height)
 *     · Bottom blue line — 'after'  (bottom 25 %)
 *     · Blue background tint — 'inside' (middle 50 %)
 *   On drop, moveLayerNode is dispatched → AST is mutated → code regenerated.
 *
 *   During drag, custom DOM events are dispatched so LivePreview can mirror
 *   the same indicators inside the iframe:
 *     flint:dragOver  — { targetId, position }
 *     flint:dragClear — (no detail)
 *   A `lastBroadcast` ref prevents redundant dispatches on every mousemove.
 *
 * Depth indentation uses inline style (not dynamic Tailwind classes) because
 * Tailwind v4 only generates classes that appear literally in source — runtime
 * interpolated values like `pl-${depth * 4}` are never in the safelist.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useRef, useCallback, useMemo } from 'react'
import { BRAND } from '../../../shared/brand'
import { Diamond, Hash, Type, Code2, ChevronRight, ChevronDown, AlertTriangle, Lock, Layers } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useLockedNodeIds } from '../../hooks/useRemotePresence'
import { useAnnotationStore } from '../../store/annotationStore'
import type { VisualLayer } from '../../core/ast-parser'
import { getLayerName } from '../../utils/layerNaming'
import type { LayerType } from '../../utils/layerNaming'
import type { DropPosition } from '../../utils/astModifier'

// ── Tree traversal helpers ────────────────────────────────────────────────────

/**
 * Flattens the visible portion of a VisualLayer tree into an ordered list.
 * Collapsed nodes' children are excluded since they are not rendered.
 */
function flattenVisibleTree(
    layers: VisualLayer[],
    collapsedIds: Set<string>,
): VisualLayer[] {
    const result: VisualLayer[] = []
    for (const layer of layers) {
        result.push(layer)
        if (layer.children.length > 0 && !collapsedIds.has(layer.id)) {
            result.push(...flattenVisibleTree(layer.children, collapsedIds))
        }
    }
    return result
}

/**
 * Builds a map from child ID to parent layer. Top-level nodes have no parent.
 */
function buildParentMap(
    layers: VisualLayer[],
    parentMap: Map<string, VisualLayer> = new Map(),
    parent?: VisualLayer,
): Map<string, VisualLayer> {
    for (const layer of layers) {
        if (parent) parentMap.set(layer.id, parent)
        buildParentMap(layer.children, parentMap, layer)
    }
    return parentMap
}

/**
 * Computes the depth of a node in the tree by walking the parent map.
 */
function getDepth(id: string, parentMap: Map<string, VisualLayer>): number {
    let depth = 0
    let current = parentMap.get(id)
    while (current) {
        depth++
        current = parentMap.get(current.id)
    }
    return depth
}

// ── Icon map ───────────────────────────────────────────────────────────────────

type IconComponent = React.FC<{ className?: string }>

const LAYER_ICONS: Record<LayerType, IconComponent> = {
    component: Diamond,
    element: Hash,
    text: Type,
}

// ── LayerRow ───────────────────────────────────────────────────────────────────

interface LayerRowProps {
    layer: VisualLayer
    depth: number
    /** Set of node IDs that are currently collapsed. */
    collapsedIds: Set<string>
    onToggleCollapsed: (id: string) => void
    /** Set of node IDs actively locked by remote users (Phase C.2). */
    lockedIds: Set<string>
    /** The ID of the node that currently holds roving tabindex focus. */
    focusedId: string | null
    /** Setter to update the roving tabindex focus target. */
    setFocusedId: (id: string) => void
}

function LayerRow({ layer, depth, collapsedIds, onToggleCollapsed, lockedIds, focusedId, setFocusedId }: LayerRowProps) {
    const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
    const setSelectedNode = useEditorStore((state) => state.setSelectedNode)
    const setJumpToLine = useEditorStore((state) => state.setJumpToLine)
    const moveLayerNode = useEditorStore((state) => state.moveLayerNode)
    const hoveredId = useEditorStore((state) => state.hoveredId)
    const setHoveredId = useEditorStore((state) => state.setHoveredId)
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    // Phase COLLAB.4: annotation pin indicator — derived selector, not stored state.
    const annotationsForNode = useAnnotationStore((s) => s.annotationsForNode)
    const annotationCount = annotationsForNode(layer.id).length
    const isSelected = selectedNodeId === layer.id
    const isHovered = !isSelected && hoveredId === layer.id
    const hasViolation = mithrilViolations.includes(layer.id)
    const isCollapsed = collapsedIds.has(layer.id)
    const hasChildren = layer.children.length > 0
    // Phase C.2: AST Conflict Arbiter — prevent edits on remotely locked nodes.
    const isLocked = lockedIds.has(layer.id)

    const [dropPosition, setDropPosition] = useState<DropPosition | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const rowRef = useRef<HTMLDivElement>(null)
    /** Tracks the last broadcast to avoid redundant postMessages on every mousemove. */
    const lastBroadcast = useRef<{ targetId: string; position: DropPosition } | null>(null)

    const { name, type, tag } = getLayerName(layer)
    const Icon = LAYER_ICONS[type]

    // ── Collapse handler ──────────────────────────────────────────────────────

    function handleChevronClick(e: React.MouseEvent): void {
        e.stopPropagation()
        onToggleCollapsed(layer.id)
    }

    // ── DnD handlers ──────────────────────────────────────────────────────────

    function handleDragStart(e: React.DragEvent): void {
        e.dataTransfer.setData('text/plain', layer.id)
        // Flint-namespaced keys allow FileExplorer to identify cross-file drops
        // without conflicting with other drag sources.
        e.dataTransfer.setData('application/flint-source-id', layer.id)
        const sourceFile = useCanvasStore.getState().activeFilePath
        if (sourceFile !== null) {
            e.dataTransfer.setData('application/flint-source-file', sourceFile)
        }
        e.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
    }

    function handleDragEnd(): void {
        setIsDragging(false)
        setDropPosition(null)
        lastBroadcast.current = null
        window.dispatchEvent(new CustomEvent(`${BRAND.productLower}:dragClear`))
    }

    function handleDragOver(e: React.DragEvent): void {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const row = rowRef.current
        if (row === null) return
        const rect = row.getBoundingClientRect()
        const pct = (e.clientY - rect.top) / rect.height
        let position: DropPosition
        if (pct < 0.25) position = 'before'
        else if (pct > 0.75) position = 'after'
        else position = 'inside'
        setDropPosition(position)

        // Broadcast to iframe only when targetId or position changes.
        const lb = lastBroadcast.current
        if (lb === null || lb.targetId !== layer.id || lb.position !== position) {
            lastBroadcast.current = { targetId: layer.id, position }
            window.dispatchEvent(
                new CustomEvent(`${BRAND.productLower}:dragOver`, { detail: { targetId: layer.id, position } })
            )
        }
    }

    function handleDragLeave(e: React.DragEvent): void {
        // Only clear when the cursor genuinely exits this row, not when it
        // moves between child elements (buttons, indicator divs) within it.
        const row = rowRef.current
        if (row !== null && row.contains(e.relatedTarget as Node | null)) return
        setDropPosition(null)
        lastBroadcast.current = null
        window.dispatchEvent(new CustomEvent(`${BRAND.productLower}:dragClear`))
    }

    function handleDrop(e: React.DragEvent): void {
        e.preventDefault()
        const sourceId = e.dataTransfer.getData('text/plain')
        if (sourceId === '' || dropPosition === null || sourceId === layer.id) {
            setDropPosition(null)
            return
        }
        moveLayerNode(sourceId, layer.id, dropPosition)
        setDropPosition(null)
        lastBroadcast.current = null
        window.dispatchEvent(new CustomEvent(`${BRAND.productLower}:dragClear`))
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/*
             * Outer div: the drag handle and drop target for this row.
             * The two sibling buttons (selection + code-jump) sit inside.
             * Before/after indicators are zero-height absolute divs;
             * the 'inside' state is expressed as a tint on the selection button.
             */}
            <div
                ref={rowRef}
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={isSelected}
                aria-expanded={hasChildren ? !isCollapsed : undefined}
                tabIndex={focusedId === layer.id ? 0 : -1}
                data-layer-id={layer.id}
                draggable={!isLocked}
                className={`group relative flex w-full transition-opacity ${isDragging ? 'opacity-40' : ''
                    } ${isLocked ? 'cursor-not-allowed' : ''}`}
                onMouseEnter={() => setHoveredId(layer.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setFocusedId(layer.id)}
                onDragStart={isLocked ? undefined : handleDragStart}
                onDragEnd={isLocked ? undefined : handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                title={isLocked ? 'Locked by a collaborator — editing disabled' : undefined}
            >
                {/* Before indicator — thin blue line at the top of the row */}
                {dropPosition === 'before' && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-indigo-400" />
                )}

                {/* After indicator — thin blue line at the bottom of the row */}
                {dropPosition === 'after' && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-indigo-400" />
                )}

                <button
                    type="button"
                    className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-[var(--indent)] pr-7 text-left text-xs transition-colors ${dropPosition === 'inside'
                        ? 'bg-indigo-400/10 text-gray-200'
                        : isSelected
                            ? 'bg-indigo-600/30 text-indigo-300'
                            : isHovered
                                ? 'bg-gray-700/40 text-gray-200'
                                : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                        }`}
                    style={
                        { '--indent': `${depth * 14 + 8}px` } as React.CSSProperties
                    }
                    onClick={() => {
                        // Phase C.2: do not select a remotely locked node
                        if (isLocked) return
                        setSelectedNode(layer.id)
                    }}
                >
                    {/*
                     * Chevron for collapsible nodes. Uses a <span> (not a nested
                     * <button>) so the HTML stays valid. stopPropagation prevents
                     * the parent button's onClick from also firing on chevron clicks.
                     * Leaf nodes get an invisible same-size spacer for icon alignment.
                     */}
                    {hasChildren ? (
                        <span
                            className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
                            onClick={handleChevronClick}
                        >
                            {isCollapsed
                                ? <ChevronRight className="h-2.5 w-2.5" />
                                : <ChevronDown className="h-2.5 w-2.5" />
                            }
                        </span>
                    ) : (
                        <span className="h-2.5 w-2.5 shrink-0" />
                    )}

                    <Icon
                        className={`h-3 w-3 shrink-0 ${isSelected ? 'opacity-80' : 'opacity-40'}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    {hasViolation && (
                        <span title="Mithril Violation — colour drift detected">
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-500" />
                        </span>
                    )}
                    {/* Phase COLLAB.4: annotation pin — indigo dot when open annotations exist */}
                    {annotationCount > 0 && (
                        <span
                            title={`${annotationCount} open annotation${annotationCount !== 1 ? 's' : ''}`}
                            className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-indigo-600/40 border border-indigo-500/50 px-0.5"
                        >
                            <span className="text-[10px] font-bold leading-none text-indigo-400">
                                {annotationCount}
                            </span>
                        </span>
                    )}
                    {/* Phase C.2: lock badge — shows when a remote user holds this node */}
                    {isLocked && (
                        <span title="Locked by a collaborator">
                            <Lock className="h-2.5 w-2.5 shrink-0 text-blue-400" />
                        </span>
                    )}
                    {name !== tag && (
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                            {tag}
                        </span>
                    )}
                </button>

                {/* Jump-to-source button — visible only on row hover */}
                <button
                    type="button"
                    title={`Jump to line ${layer.line}`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-400"
                    onClick={(e) => {
                        e.stopPropagation()
                        setJumpToLine(layer.line)
                    }}
                >
                    <Code2 className="h-3 w-3" />
                </button>
            </div>

            {/* Children are hidden when this node is collapsed */}
            {!isCollapsed &&
                layer.children.map((child) => (
                    <LayerRow
                        key={child.id}
                        layer={child}
                        depth={depth + 1}
                        collapsedIds={collapsedIds}
                        onToggleCollapsed={onToggleCollapsed}
                        lockedIds={lockedIds}
                        focusedId={focusedId}
                        setFocusedId={setFocusedId}
                    />
                ))}
        </>
    )
}

// ── LayerTree ──────────────────────────────────────────────────────────────────

export function LayerTree() {
    const visualTree = useEditorStore((state) => state.visualTree)
    const setSelectedNode = useEditorStore((state) => state.setSelectedNode)
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
    const [focusedId, setFocusedId] = useState<string | null>(null)
    // Phase C.2: derive locked node IDs from the 5Hz presence poll.
    const lockedIds = useLockedNodeIds()
    const treeRef = useRef<HTMLDivElement>(null)

    // Memoize the flattened visible tree and parent map for keyboard navigation.
    const flatVisible = useMemo(
        () => flattenVisibleTree(visualTree, collapsedIds),
        [visualTree, collapsedIds],
    )
    const parentMap = useMemo(
        () => buildParentMap(visualTree),
        [visualTree],
    )

    function toggleCollapsed(id: string): void {
        setCollapsedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    /**
     * Moves roving tabindex focus to the given node ID and scrolls it into view.
     */
    const moveFocus = useCallback((id: string) => {
        setFocusedId(id)
        // After React re-renders with the new tabIndex=0, focus the element.
        requestAnimationFrame(() => {
            const el = treeRef.current?.querySelector(`[data-layer-id="${id}"]`) as HTMLElement | null
            el?.focus()
        })
    }, [])

    /**
     * WAI-ARIA TreeView keyboard navigation handler.
     * Operates on the flattened visible list for ArrowDown/Up/Home/End,
     * and on the tree structure for ArrowLeft/Right.
     */
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (flatVisible.length === 0) return

        // Determine the currently focused node's index in the flat list.
        const currentIndex = focusedId !== null
            ? flatVisible.findIndex((l) => l.id === focusedId)
            : -1
        const currentLayer = currentIndex >= 0 ? flatVisible[currentIndex] : null

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault()
                const nextIndex = currentIndex < flatVisible.length - 1 ? currentIndex + 1 : currentIndex
                moveFocus(flatVisible[nextIndex >= 0 ? nextIndex : 0].id)
                break
            }
            case 'ArrowUp': {
                e.preventDefault()
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0
                moveFocus(flatVisible[prevIndex].id)
                break
            }
            case 'ArrowRight': {
                e.preventDefault()
                if (!currentLayer) break
                if (currentLayer.children.length > 0 && collapsedIds.has(currentLayer.id)) {
                    // Expand the collapsed node.
                    toggleCollapsed(currentLayer.id)
                } else if (currentLayer.children.length > 0) {
                    // Move to first child.
                    moveFocus(currentLayer.children[0].id)
                }
                break
            }
            case 'ArrowLeft': {
                e.preventDefault()
                if (!currentLayer) break
                if (currentLayer.children.length > 0 && !collapsedIds.has(currentLayer.id)) {
                    // Collapse the expanded node.
                    toggleCollapsed(currentLayer.id)
                } else {
                    // Move to parent.
                    const parent = parentMap.get(currentLayer.id)
                    if (parent) moveFocus(parent.id)
                }
                break
            }
            case 'Home': {
                e.preventDefault()
                if (flatVisible.length > 0) moveFocus(flatVisible[0].id)
                break
            }
            case 'End': {
                e.preventDefault()
                if (flatVisible.length > 0) moveFocus(flatVisible[flatVisible.length - 1].id)
                break
            }
            case 'Enter':
            case ' ': {
                e.preventDefault()
                if (currentLayer) setSelectedNode(currentLayer.id)
                break
            }
            default:
                // Do not preventDefault — let other keys propagate normally.
                break
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flatVisible, focusedId, collapsedIds, parentMap, moveFocus, setSelectedNode])

    if (visualTree.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center h-full">
                <Layers className="h-6 w-6 text-zinc-600" />
                <p className="text-sm text-zinc-400">No component layers</p>
                <p className="text-xs text-zinc-500 max-w-[240px]">Open a .tsx file to see its layer structure</p>
            </div>
        )
    }

    return (
        <div
            ref={treeRef}
            role="tree"
            aria-label="Component layer tree"
            className="h-full overflow-y-auto py-2"
            onKeyDown={handleKeyDown}
        >
            {visualTree.map((layer) => (
                <LayerRow
                    key={layer.id}
                    layer={layer}
                    depth={0}
                    collapsedIds={collapsedIds}
                    onToggleCollapsed={toggleCollapsed}
                    lockedIds={lockedIds}
                    focusedId={focusedId}
                    setFocusedId={setFocusedId}
                />
            ))}
        </div>
    )
}
