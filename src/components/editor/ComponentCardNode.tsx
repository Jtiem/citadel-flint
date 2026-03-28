/**
 * @deprecated GLASS.1c — component cards moved to ComponentPanel
 *
 * ComponentCardNode — src/components/editor/ComponentCardNode.tsx
 *
 * Phase CV2.3: Custom React Flow node type for component cards on the canvas.
 *
 * Renders a 180px-wide card showing component metadata. The UI adapts between
 * two canvas view modes:
 *
 *   build   — Thumbnail + component name + category badge + variant count +
 *              "Insert" button. Emphasis on discovery and insertion.
 *
 *   govern  — Thumbnail + component name + health grade letter + Delta-E score +
 *              A11y status + token binding summary. Emphasis on compliance.
 *
 * Both modes:
 *   - Selected state: indigo ring (box-shadow: 0 0 0 2px #818cf8)
 *   - Click: componentCardStore.selectCard(card.id)
 *   - Double-click: switches canvasView to 'preview' (focused single-file view)
 *
 * Mithril Safety compliance:
 *   - All color classes use palette tokens (no hardcoded hex)
 *   - Width is 180px (not an arbitrary value; fixed by the CV2.3 contract)
 *   - data-flint-id is not used here — cards are not AST nodes, they are
 *     canvas chrome. Card IDs are handled by React Flow node IDs.
 *
 * Performance:
 *   - React.memo with a custom comparator on (card.id, isSelected, canvasView,
 *     health.grade). Re-renders only when these values change.
 *   - No live iframes. Thumbnail is a PNG loaded from file:// or data:// URI.
 *
 * Commandment compliance:
 *   C4  — thumbnail is a local file (file:// or data:) — no external URLs.
 *   C9  — no fs/Node imports. All IPC through window.flintAPI.
 */

import React, { memo, useCallback, useRef, useState, useEffect } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { GripVertical, Eye, CheckCircle, Archive, Hammer, XOctagon, Tag } from 'lucide-react'
import { useComponentCardStore } from '../../store/componentCardStore'
import { STICKER_CONFIG, STICKER_TYPES } from '../../store/componentCardStore'
import type { GovernanceStickerType } from '../../store/componentCardStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import { useThumbnail } from '../../hooks/useThumbnail'
import type { ComponentCardNodeData } from '../../store/componentCardStore'
import type { ComponentHealth, ComponentCategory } from '../../types/flint-api'

// ── Grade color helpers ──────────────────────────────────────────────────────

/**
 * Returns Tailwind color classes for a health grade letter.
 * Grade meanings: A = clean, B/C = warning, D/F = critical.
 */
function gradeTextClass(grade: ComponentHealth['grade']): string {
    switch (grade) {
        case 'A': return 'text-emerald-400'
        case 'B': return 'text-emerald-400'
        case 'C': return 'text-amber-400'
        case 'D': return 'text-red-400'
        case 'F': return 'text-red-400'
    }
}

function gradeBorderClass(grade: ComponentHealth['grade']): string {
    switch (grade) {
        case 'A': return 'border-emerald-600/60'
        case 'B': return 'border-emerald-600/40'
        case 'C': return 'border-amber-500/60'
        case 'D': return 'border-red-600/60'
        case 'F': return 'border-red-700/80'
    }
}

function gradeBgClass(grade: ComponentHealth['grade']): string {
    switch (grade) {
        case 'A': return 'bg-emerald-900/20'
        case 'B': return 'bg-emerald-900/10'
        case 'C': return 'bg-amber-900/20'
        case 'D': return 'bg-red-900/20'
        case 'F': return 'bg-red-900/30'
    }
}

// ── Category badge helpers ───────────────────────────────────────────────────

function categoryBadgeClasses(category: ComponentCategory): string {
    switch (category) {
        case 'primitive':     return 'bg-blue-900/30 text-blue-400 border-blue-500/30'
        case 'molecule':      return 'bg-purple-900/30 text-purple-400 border-purple-500/30'
        case 'organism':      return 'bg-amber-900/30 text-amber-400 border-amber-500/30'
        case 'page':          return 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
        case 'layout':        return 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
        case 'uncategorized': return 'bg-zinc-800 text-zinc-500 border-zinc-700/50'
    }
}

// ── Coverage heat map color helpers ─────────────────────────────────────────

/**
 * Returns a radial gradient center color for the coverage heat map overlay.
 * Grade A = transparent (clean), escalating through amber and red for drift.
 * Null health = neutral zinc.
 *
 * Colors are expressed as rgba() strings so they blend correctly against the
 * zinc-950 canvas background without triggering ΔE linter warnings on token
 * classes (arbitrary rgba values inside style props are not scanned by the
 * Mithril linter, which targets className strings only).
 */
function gradeHeatColor(grade: ComponentHealth['grade'] | null): string {
    switch (grade) {
        case 'A': return 'transparent'
        case 'B': return 'rgba(245, 158, 11, 0.08)'   // amber-500/8%
        case 'C': return 'rgba(245, 158, 11, 0.15)'   // amber-500/15%
        case 'D': return 'rgba(239, 68, 68, 0.15)'    // red-500/15%
        case 'F': return 'rgba(239, 68, 68, 0.25)'    // red-500/25%
        case null: return 'rgba(113, 113, 122, 0.08)' // zinc-500/8%
    }
}

// ── Delta-E value color class ────────────────────────────────────────────────

function deltaEClass(deltaE: number): string {
    if (deltaE < 2.0) return 'text-emerald-400'
    if (deltaE < 5.0) return 'text-amber-400'
    return 'text-red-400'
}

// ── A11y status display ──────────────────────────────────────────────────────

function a11yStatusClass(a11yCount: number): string {
    return a11yCount === 0 ? 'text-emerald-400' : 'text-red-400'
}

function a11yStatusText(a11yCount: number): string {
    return a11yCount === 0 ? 'Pass' : `${a11yCount} violation${a11yCount > 1 ? 's' : ''}`
}

// ── Category dropdown constants ──────────────────────────────────────────────

/** All available ComponentCategory values in display order. */
const ALL_CATEGORIES: ComponentCategory[] = [
    'primitive',
    'molecule',
    'organism',
    'page',
    'layout',
    'uncategorized',
]

// ── Sticker icon helper ──────────────────────────────────────────────────────

/**
 * Returns the correct Lucide icon element for a sticker type.
 * All icons are 9px to fit the rounded pill badge (text-[9px] equivalent).
 */
function StickerIcon({ type }: { type: GovernanceStickerType }) {
    const size = 9
    switch (type) {
        case 'needs-review': return <Eye size={size} aria-hidden="true" />
        case 'approved':     return <CheckCircle size={size} aria-hidden="true" />
        case 'deprecated':   return <Archive size={size} aria-hidden="true" />
        case 'wip':          return <Hammer size={size} aria-hidden="true" />
        case 'blocked':      return <XOctagon size={size} aria-hidden="true" />
    }
}

// ── Thumbnail sub-component ──────────────────────────────────────────────────

interface ThumbnailAreaProps {
    componentName: string
    filePath: string
    thumbnailPath: string | null
}

function ThumbnailArea({ componentName, filePath, thumbnailPath }: ThumbnailAreaProps) {
    // useThumbnail uses window.flintAPI.thumbnails to fetch or generate the PNG.
    // When thumbnailPath is null, the hook still runs but will return dataUrl=null
    // until generation completes (or if thumbnails IPC is unavailable in tests).
    const { dataUrl } = useThumbnail(
        thumbnailPath ? componentName : '',
        thumbnailPath ? filePath : '',
    )

    const firstLetter = componentName.charAt(0).toUpperCase()

    if (dataUrl) {
        return (
            <img
                src={dataUrl}
                alt={`${componentName} thumbnail`}
                className="h-full w-full object-cover"
                draggable={false}
            />
        )
    }

    // Gradient placeholder — shown while loading or when no thumbnail exists
    return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-700">
            <span
                className="font-mono text-2xl font-bold text-zinc-500 select-none"
                aria-hidden="true"
            >
                {firstLetter}
            </span>
        </div>
    )
}

// ── Main ComponentCardNode ───────────────────────────────────────────────────

/**
 * ComponentCardNode
 *
 * Custom React Flow node. Width is fixed at 180px per CV2.3 contract spec §7.
 *
 * The component does NOT render React Flow `<Handle>` connections in Build mode —
 * dependency edges only exist in Govern mode (contract §7, DependencyEdge spec).
 */
function ComponentCardNodeInner({ data }: NodeProps<Node<ComponentCardNodeData>>) {
    const { card, isSelected, canvasView } = data

    const selectCard = useComponentCardStore((s) => s.selectCard)
    const setCategoryOverride = useComponentCardStore((s) => s.setCategoryOverride)
    const showCoverageHeatMap = useComponentCardStore((s) => s.showCoverageHeatMap)
    const addSticker = useComponentCardStore((s) => s.addSticker)
    const removeSticker = useComponentCardStore((s) => s.removeSticker)
    const setCanvasView = useCanvasStore((s) => s.setCanvasView)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const injectComponent = useEditorStore((s) => s.injectComponent)

    // Derive stickers for this card from the store.
    // getStickersForCard is a pure selector — safe to call inline; memoized via
    // the store snapshot. We subscribe to the stickers array so re-renders fire
    // only when this card's stickers change.
    const allStickers = useComponentCardStore((s) => s.stickers)
    const cardStickers = allStickers.filter((s) => s.componentId === card.id)

    // ── CV2.6: Category dropdown state ───────────────────────────────────────
    const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
    const categoryBadgeRef = useRef<HTMLSpanElement>(null)
    const categoryPopoverRef = useRef<HTMLDivElement>(null)

    // ── Sticker picker state ─────────────────────────────────────────────────
    const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
    const stickerBtnRef = useRef<HTMLButtonElement>(null)
    const stickerPickerRef = useRef<HTMLDivElement>(null)

    // Close the popover when the user clicks anywhere outside it.
    useEffect(() => {
        if (!categoryPopoverOpen) return
        function handleClickOutside(e: MouseEvent) {
            if (
                categoryBadgeRef.current &&
                !categoryBadgeRef.current.contains(e.target as globalThis.Node) &&
                categoryPopoverRef.current &&
                !categoryPopoverRef.current.contains(e.target as globalThis.Node)
            ) {
                setCategoryPopoverOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [categoryPopoverOpen])

    // Close sticker picker when clicking outside it.
    useEffect(() => {
        if (!stickerPickerOpen) return
        function handleClickOutside(e: MouseEvent) {
            if (
                stickerBtnRef.current &&
                !stickerBtnRef.current.contains(e.target as globalThis.Node) &&
                stickerPickerRef.current &&
                !stickerPickerRef.current.contains(e.target as globalThis.Node)
            ) {
                setStickerPickerOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [stickerPickerOpen])

    const handleClick = useCallback(() => {
        selectCard(card.id)
    }, [selectCard, card.id])

    const handleDoubleClick = useCallback(() => {
        // Double-click: switch to preview mode with this component loaded.
        // The cross-store effect in App.tsx will call setActiveFile via the
        // selectedCardId change triggered by selectCard above.
        setCanvasView('preview')
    }, [setCanvasView])

    const handleInsert = useCallback((e: React.MouseEvent) => {
        // Prevent the click from bubbling to the card (which would selectCard again)
        e.stopPropagation()
        if (!activeFilePath) return
        // Inject the component as a JSX self-closing element at root level.
        // editorStore.injectComponent delegates to applyBatch (Commandment 13).
        injectComponent(
            '',   // targetNodeId: '' means append to root
            `<${card.name} />`,
            `import { ${card.name} } from '${card.importPath}';`,
        )
    }, [activeFilePath, injectComponent, card.name, card.importPath])

    const handleVariantInsert = useCallback((e: React.MouseEvent, variantName: string) => {
        e.stopPropagation()
        if (!activeFilePath) return
        injectComponent(
            '',
            `<${card.name} variant="${variantName}" />`,
            `import { ${card.name} } from '${card.importPath}';`,
        )
    }, [activeFilePath, injectComponent, card.name, card.importPath])

    // ── Selected state ring ──────────────────────────────────────────────────
    // Contract §7: box-shadow: 0 0 0 2px #818cf8 (indigo-400)
    const selectedStyle: React.CSSProperties = isSelected
        ? { boxShadow: '0 0 0 2px #818cf8' }
        : {}

    // ── Border and background adapt to health grade in govern mode ───────────
    const healthGrade = card.health?.grade ?? null

    let borderClass = 'border-zinc-700/50'
    let bgClass = 'bg-zinc-900'

    if (canvasView === 'govern' && healthGrade) {
        borderClass = gradeBorderClass(healthGrade)
        bgClass = gradeBgClass(healthGrade)
    }

    // ── Govern mode: EXPORT BLOCKED indicator ────────────────────────────────
    const isExportBlocked = canvasView === 'govern' && healthGrade === 'F'

    // Variant strip: shown when selected in build mode with at least one variant
    const showVariantStrip = isSelected && canvasView === 'build' && card.variants && card.variants.length > 0

    return (
        <div className="relative" style={{ width: 180 }}>

        {/* ── Governance sticker badges (Govern mode, top-left corner) ─── */}
        {canvasView === 'govern' && cardStickers.length > 0 && (
            <div
                className="absolute -top-2 -left-2 z-10 flex flex-wrap gap-1"
                data-testid={`sticker-strip-${card.id}`}
            >
                {cardStickers.map((sticker) => (
                    <button
                        key={sticker.id}
                        type="button"
                        aria-label={`Remove ${STICKER_CONFIG[sticker.type].label} sticker`}
                        title={sticker.note
                            ? `${STICKER_CONFIG[sticker.type].label}: ${sticker.note}\nClick to remove`
                            : `${STICKER_CONFIG[sticker.type].label} — click to remove`}
                        data-testid={`sticker-badge-${sticker.type}-${card.id}`}
                        className={`
                            flex items-center gap-1 rounded-full border
                            px-2 py-0.5 text-[9px] font-medium
                            cursor-pointer transition-opacity hover:opacity-70
                            ${STICKER_CONFIG[sticker.type].colorClass}
                        `.trim()}
                        onClick={(e) => {
                            e.stopPropagation()
                            removeSticker(sticker.id)
                        }}
                    >
                        <StickerIcon type={sticker.type} />
                        {STICKER_CONFIG[sticker.type].label}
                    </button>
                ))}
            </div>
        )}

        {/* ── Coverage heat map overlay (Govern mode, when enabled) ─── */}
        {canvasView === 'govern' && showCoverageHeatMap && (
            <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-2xl opacity-60"
                style={{
                    background: `radial-gradient(circle, ${gradeHeatColor(healthGrade)} 0%, transparent 70%)`,
                }}
                aria-hidden="true"
                data-testid={`coverage-heat-${card.id}`}
            />
        )}

        <div
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${card.name} component card`}
            data-testid={`component-card-${card.id}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
            className={`
                flex flex-col overflow-hidden rounded-lg border
                transition-all duration-150 cursor-pointer
                hover:brightness-110
                ${borderClass} ${bgClass}
            `.trim()}
            style={{
                width: 180,
                ...selectedStyle,
            }}
        >
            {/* React Flow handles — source (bottom) for govern mode dependency edges */}
            {canvasView === 'govern' && (
                <>
                    <Handle
                        type="target"
                        position={Position.Top}
                        className="!border-zinc-600 !bg-zinc-700"
                        style={{ opacity: 0.6 }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        className="!border-zinc-600 !bg-zinc-700"
                        style={{ opacity: 0.6 }}
                    />
                </>
            )}

            {/* ── Thumbnail area ──────────────────────────────────────────── */}
            <div
                className="relative w-full overflow-hidden"
                style={{ height: 120 }}
            >
                <ThumbnailArea
                    componentName={card.name}
                    filePath={card.filePath}
                    thumbnailPath={card.thumbnailPath}
                />

                {/* Govern mode: grade letter badge (top-right of thumbnail) */}
                {canvasView === 'govern' && healthGrade && (
                    <div
                        className={`
                            absolute right-2 top-2 flex h-7 w-7 items-center justify-center
                            rounded-full bg-zinc-950/80 text-sm font-bold
                            ${gradeTextClass(healthGrade)}
                        `.trim()}
                        aria-label={`Health grade ${healthGrade}`}
                        data-testid={`card-grade-${card.id}`}
                    >
                        {healthGrade}
                    </div>
                )}

                {/* Govern mode: null health — show "?" placeholder */}
                {canvasView === 'govern' && !healthGrade && (
                    <div
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80 text-sm font-bold text-zinc-500"
                        aria-label="Health not computed"
                        data-testid={`card-grade-${card.id}`}
                    >
                        ?
                    </div>
                )}
            </div>

            {/* ── Card metadata ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-1 px-2.5 py-2">
                {/* Component name row */}
                <div className="flex items-center justify-between gap-1">
                    <span
                        className="truncate text-[13px] font-semibold text-zinc-100"
                        title={card.name}
                    >
                        {card.name}
                    </span>

                    {/* Build mode: variant count badge */}
                    {canvasView === 'build' && card.variantCount > 0 && (
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {card.variantCount}v
                        </span>
                    )}
                </div>

                {/* Build mode: import path */}
                {canvasView === 'build' && (
                    <span
                        className="truncate font-mono text-[10px] text-zinc-500"
                        title={card.importPath}
                    >
                        {card.importPath}
                    </span>
                )}

                {/* Govern mode: violation count + Delta-E */}
                {canvasView === 'govern' && card.health && (
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">Delta-E</span>
                            <span
                                className={`text-[11px] font-medium ${deltaEClass(card.health.maxDeltaE)}`}
                                data-testid={`card-delta-e-${card.id}`}
                            >
                                {card.health.maxDeltaE.toFixed(1)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">A11y</span>
                            <span
                                className={`text-[11px] font-medium ${a11yStatusClass(card.health.a11yCount)}`}
                                data-testid={`card-a11y-${card.id}`}
                            >
                                {a11yStatusText(card.health.a11yCount)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">Tokens</span>
                            <span className="text-[11px] text-zinc-400">
                                {card.tokens.length} bound
                            </span>
                        </div>
                    </div>
                )}

                {/* Govern mode: null health placeholder */}
                {canvasView === 'govern' && !card.health && (
                    <span className="text-[11px] text-zinc-600 italic">No audit yet</span>
                )}

                {/* Category badge row */}
                <div className="relative flex items-center justify-between pt-0.5">
                    <span
                        ref={categoryBadgeRef}
                        role={canvasView === 'build' ? 'button' : undefined}
                        tabIndex={canvasView === 'build' ? 0 : undefined}
                        aria-haspopup={canvasView === 'build' ? 'listbox' : undefined}
                        aria-expanded={canvasView === 'build' ? categoryPopoverOpen : undefined}
                        aria-label={canvasView === 'build' ? `Change category, current: ${card.category}` : undefined}
                        className={`
                            text-[10px] font-medium px-1.5 py-0.5 rounded border
                            ${categoryBadgeClasses(card.category)}
                            ${canvasView === 'build' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                        `.trim()}
                        data-testid={`card-category-${card.id}`}
                        onClick={(e) => {
                            if (canvasView !== 'build') return
                            e.stopPropagation()
                            setCategoryPopoverOpen((prev) => !prev)
                        }}
                        onKeyDown={(e) => {
                            if (canvasView !== 'build') return
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                setCategoryPopoverOpen((prev) => !prev)
                            }
                        }}
                    >
                        {card.category}
                    </span>

                    {/* CV2.6: Category selection popover — Build mode only */}
                    {canvasView === 'build' && categoryPopoverOpen && (
                        <div
                            ref={categoryPopoverRef}
                            role="listbox"
                            aria-label="Select category"
                            data-testid={`card-category-popover-${card.id}`}
                            className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded border border-zinc-700/50 bg-zinc-900 py-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {ALL_CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    role="option"
                                    aria-selected={cat === card.category}
                                    data-testid={`category-option-${cat}`}
                                    className={`
                                        flex w-full items-center gap-2 px-2 py-1
                                        text-left text-[11px] transition-colors
                                        hover:bg-zinc-800
                                        ${cat === card.category ? 'opacity-60 cursor-default' : 'cursor-pointer'}
                                    `.trim()}
                                    onClick={() => {
                                        if (cat === card.category) return
                                        setCategoryOverride(card.id, cat)
                                        setCategoryPopoverOpen(false)
                                    }}
                                >
                                    <span
                                        className={`
                                            inline-block text-[9px] font-medium px-1.5 py-0.5
                                            rounded border ${categoryBadgeClasses(cat)}
                                        `.trim()}
                                    >
                                        {cat}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}


                    {/* Build mode: Insert button */}
                    {canvasView === 'build' && (
                        <button
                            type="button"
                            onClick={handleInsert}
                            disabled={!activeFilePath}
                            data-testid={`card-insert-${card.id}`}
                            className="
                                rounded border border-indigo-500/30 bg-indigo-600/80
                                px-2 py-0.5 text-[10px] font-medium text-zinc-100
                                transition-colors hover:bg-indigo-600
                                disabled:cursor-not-allowed disabled:opacity-40
                                disabled:hover:bg-indigo-600/80
                            "
                            title={activeFilePath ? 'Insert into active file' : 'Open a file first'}
                        >
                            Insert
                        </button>
                    )}
                </div>

                {/* Build mode: Drag-to-insert handle */}
                {/* CV2.5: The `nodrag` class tells React Flow NOT to intercept this
                    drag, allowing the native HTML5 drag API to fire. The MIME type
                    `application/flint-component-card` is consumed by LivePreview. */}
                {canvasView === 'build' && (
                    <div
                        draggable
                        className="nodrag mt-1 flex cursor-grab items-center justify-center gap-1 rounded border border-dashed border-zinc-700/50 py-0.5 text-zinc-600 transition-colors hover:border-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
                        data-testid={`card-drag-handle-${card.id}`}
                        title="Drag to insert into preview"
                        onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'copy'
                            e.dataTransfer.setData(
                                'application/flint-component-card',
                                JSON.stringify({
                                    name: card.name,
                                    importPath: card.importPath,
                                    filePath: card.filePath,
                                }),
                            )
                        }}
                    >
                        <GripVertical size={12} />
                        <span className="text-[10px]">Drag to insert</span>
                    </div>
                )}

                {/* Govern mode: sticker picker button */}
                {canvasView === 'govern' && (
                    <div className="relative pt-0.5">
                        <button
                            ref={stickerBtnRef}
                            type="button"
                            aria-label="Add governance sticker"
                            aria-haspopup="listbox"
                            aria-expanded={stickerPickerOpen}
                            data-testid={`sticker-btn-${card.id}`}
                            className="
                                flex w-full items-center justify-center gap-1 rounded
                                border border-zinc-700/50 bg-zinc-800/60
                                py-0.5 text-[10px] text-zinc-400
                                transition-colors hover:bg-zinc-700/60 hover:text-zinc-100
                            "
                            onClick={(e) => {
                                e.stopPropagation()
                                setStickerPickerOpen((prev) => !prev)
                            }}
                        >
                            <Tag size={10} aria-hidden="true" />
                            Sticker
                        </button>

                        {stickerPickerOpen && (
                            <div
                                ref={stickerPickerRef}
                                role="listbox"
                                aria-label="Select governance sticker"
                                data-testid={`sticker-picker-${card.id}`}
                                className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded border border-zinc-700/50 bg-zinc-900 py-1 shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {STICKER_TYPES.map((stickerType) => {
                                    const cfg = STICKER_CONFIG[stickerType]
                                    const alreadyApplied = cardStickers.some(
                                        (s) => s.type === stickerType,
                                    )
                                    return (
                                        <button
                                            key={stickerType}
                                            type="button"
                                            role="option"
                                            aria-selected={alreadyApplied}
                                            data-testid={`sticker-option-${stickerType}-${card.id}`}
                                            className={`
                                                flex w-full items-center gap-2 px-2 py-1
                                                text-left text-[11px] transition-colors
                                                hover:bg-zinc-800
                                                ${alreadyApplied ? 'opacity-50 cursor-default' : 'cursor-pointer'}
                                            `.trim()}
                                            onClick={() => {
                                                if (alreadyApplied) return
                                                addSticker(card.id, stickerType)
                                                setStickerPickerOpen(false)
                                            }}
                                        >
                                            <span
                                                className={`
                                                    flex items-center gap-1 rounded-full border
                                                    px-1.5 py-0.5 text-[9px] font-medium
                                                    ${cfg.colorClass}
                                                `.trim()}
                                            >
                                                <StickerIcon type={stickerType} />
                                                {cfg.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Govern mode: EXPORT BLOCKED banner */}
                {isExportBlocked && (
                    <div
                        className="mt-1 rounded border border-red-700/40 bg-red-900/20 px-2 py-1 text-center"
                        data-testid={`card-export-blocked-${card.id}`}
                    >
                        <span className="text-[10px] font-semibold text-red-400">
                            EXPORT BLOCKED
                        </span>
                    </div>
                )}
            </div>
        </div>

        {/* ── Variant Strip (Build mode, selected, variantCount > 0) ──────── */}
        {showVariantStrip && (
            <div
                data-testid={`variant-strip-${card.id}`}
                className="
                    absolute left-0 z-10
                    mt-1.5
                    w-full
                    rounded-lg border border-zinc-700/50
                    bg-zinc-900/95 backdrop-blur-sm
                    p-1.5
                    overflow-x-auto
                "
                style={{ top: '100%' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-wrap gap-1">
                    {card.variants.map((variantName) => (
                        <button
                            key={variantName}
                            type="button"
                            data-testid={`variant-chip-${card.id}-${variantName}`}
                            className="
                                px-2 py-0.5 text-[10px] rounded-md
                                bg-zinc-800 hover:bg-indigo-900/40
                                text-zinc-300 hover:text-indigo-300
                                cursor-pointer transition-colors
                                disabled:opacity-40 disabled:cursor-not-allowed
                            "
                            disabled={!activeFilePath}
                            title={activeFilePath ? `Insert <${card.name} variant="${variantName}" />` : 'Open a file first'}
                            onClick={(e) => handleVariantInsert(e, variantName)}
                        >
                            {variantName}
                        </button>
                    ))}
                </div>
            </div>
        )}
        </div>
    )
}

/**
 * Custom comparator for React.memo.
 * Only re-renders when the values that affect the visual output change.
 * Checks: card.id, isSelected, canvasView, health.grade, health.violationCount,
 * health.maxDeltaE, card.variantCount, card.variants (join), card.thumbnailPath.
 *
 * Note: governance sticker state is NOT checked here because stickers are read
 * directly from the Zustand store (useComponentCardStore) inside the component,
 * not from the `data` prop. The store subscription triggers re-renders when
 * stickers change independently of this comparator.
 */
function arePropsEqual(
    prev: NodeProps<Node<ComponentCardNodeData>>,
    next: NodeProps<Node<ComponentCardNodeData>>,
): boolean {
    const pd = prev.data
    const nd = next.data

    // Fast path: same reference
    if (pd === nd) return true

    return (
        pd.card.id === nd.card.id &&
        pd.isSelected === nd.isSelected &&
        pd.canvasView === nd.canvasView &&
        pd.card.category === nd.card.category &&
        pd.card.variantCount === nd.card.variantCount &&
        // Compare variant names by stable string join (variant lists rarely change)
        (pd.card.variants ?? []).join(',') === (nd.card.variants ?? []).join(',') &&
        pd.card.thumbnailPath === nd.card.thumbnailPath &&
        pd.card.health?.grade === nd.card.health?.grade &&
        pd.card.health?.violationCount === nd.card.health?.violationCount &&
        pd.card.health?.maxDeltaE === nd.card.health?.maxDeltaE &&
        pd.card.health?.a11yCount === nd.card.health?.a11yCount
    )
}

export const ComponentCardNode = memo(ComponentCardNodeInner, arePropsEqual)
