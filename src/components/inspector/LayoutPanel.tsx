/**
 * LayoutPanel — src/components/inspector/LayoutPanel.tsx
 *
 * Auto Layout controls for the Inspector, mirroring Figma's Auto Layout panel.
 *
 * Section 1 — Flow: three toggle buttons (WrapText / ArrowDown / ArrowRight)
 *             mapping to flex-wrap / flex-col / flex-row.
 *
 * Section 2 — Alignment grid: a 3×3 dot grid whose axes swap based on the
 *             active direction, exactly matching Figma's behaviour:
 *               flex-row (default): X = justify-*, Y = items-*
 *               flex-col          : X = items-*,   Y = justify-*
 *             Clicking a dot sets both alignment and justification at once.
 *             The Gap token select sits to the right of the grid.
 *
 * Section 3 — Resizing: W / H selects offering Hug (w-fit / h-fit)
 *             and Fill (w-full / h-full) options.
 *
 * Section 4 — Padding: a single token select for the `p-` prefix.
 *
 * All structural class mutations go through updateLayoutClass in layoutMapper.ts
 * (managed-set approach). Token-based classes (gap, padding) are swapped inline.
 *
 * Renderer Process only — no Node.js imports.
 */

import { WrapText, ArrowDown, ArrowRight } from 'lucide-react'
import type { TokenType } from '../../types/bridge-api'
import { useTokenStore } from '../../store/tokenStore'
import { tokenToClass } from '../../utils/classMapper'
import { updateLayoutClass, getActiveLayoutClass } from '../../utils/layoutMapper'
import { TokenSelect } from './TokenSelect'

// ── Constants ──────────────────────────────────────────────────────────────────

/** The three values shown in the 3×3 grid for the "main" axis. */
const JUSTIFY_3 = ['justify-start', 'justify-center', 'justify-end'] as const

/** The three values shown in the 3×3 grid for the "cross" axis. */
const ITEMS_3 = ['items-start', 'items-center', 'items-end'] as const

// ── AlignmentGrid ──────────────────────────────────────────────────────────────

interface AlignmentGridProps {
    /** True when flex-col is the active direction (axes are swapped). */
    isColumn: boolean
    activeAlignment: string
    activeJustification: string
    onCellClick: (justification: string, alignment: string) => void
}

/**
 * 3×3 grid of dot buttons. Each dot encodes a (justify-*, items-*) pair.
 * The active combination is highlighted; all others are muted.
 *
 * Axis mapping:
 *   flex-row: column index → justify-*, row index → items-*
 *   flex-col: column index → items-*,   row index → justify-*
 */
function AlignmentGrid({
    isColumn,
    activeAlignment,
    activeJustification,
    onCellClick,
}: AlignmentGridProps) {
    const cells: React.ReactElement[] = []

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cellJustify = isColumn ? JUSTIFY_3[row] : JUSTIFY_3[col]
            const cellItems = isColumn ? ITEMS_3[col] : ITEMS_3[row]
            const isActive =
                activeJustification === cellJustify && activeAlignment === cellItems

            cells.push(
                <button
                    key={`${row}-${col}`}
                    type="button"
                    title={`${cellJustify} ${cellItems}`}
                    className="flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-gray-700/60"
                    onClick={() => onCellClick(cellJustify, cellItems)}
                >
                    <div
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            isActive ? 'bg-indigo-400' : 'bg-gray-600 hover:bg-gray-400'
                        }`}
                    />
                </button>
            )
        }
    }

    return (
        <div className="grid shrink-0 grid-cols-3 gap-0.5 rounded-md bg-gray-800/80 p-1 ring-1 ring-inset ring-gray-700/50">
            {cells}
        </div>
    )
}

// ── LayoutPanel ────────────────────────────────────────────────────────────────

interface Props {
    /** Full className string of the currently selected node. */
    className: string
    /** Called with the reconstructed className string when any control changes. */
    onChange: (newClassName: string) => void
}

export function LayoutPanel({ className, onChange }: Props) {
    const tokens = useTokenStore((s) => s.tokens)

    // ── Derived state ─────────────────────────────────────────────────────────

    const activeFlow = getActiveLayoutClass(className, 'flow')
    const activeAlignment = getActiveLayoutClass(className, 'alignment')
    const activeJustification = getActiveLayoutClass(className, 'justification')
    const activeWidth = getActiveLayoutClass(className, 'sizing-width')
    const activeHeight = getActiveLayoutClass(className, 'sizing-height')

    // Grid axes swap when direction is flex-col.
    const isColumn = activeFlow === 'flex-col'

    // ── Handlers — structural classes ─────────────────────────────────────────

    function handleFlow(value: string): void {
        const next = activeFlow === value ? '' : value
        onChange(updateLayoutClass(className, 'flow', next))
    }

    function handleCellClick(justification: string, alignment: string): void {
        let updated = updateLayoutClass(className, 'justification', justification)
        updated = updateLayoutClass(updated, 'alignment', alignment)
        onChange(updated)
    }

    function handleWidth(value: string): void {
        onChange(updateLayoutClass(className, 'sizing-width', value))
    }

    function handleHeight(value: string): void {
        onChange(updateLayoutClass(className, 'sizing-height', value))
    }

    // ── Handlers — token-based classes ────────────────────────────────────────

    function getActiveTokenClass(prefix: string, type: TokenType): string {
        const classList = new Set(className.split(/\s+/).filter(Boolean))
        for (const t of tokens.filter((tok) => tok.token_type === type)) {
            const cls = tokenToClass(t.token_path, t.token_type, prefix)
            if (classList.has(cls)) return cls
        }
        return ''
    }

    function handleTokenChange(
        prefix: string,
        type: TokenType,
        newCls: string | null
    ): void {
        const allPossible = new Set(
            tokens
                .filter((t) => t.token_type === type)
                .map((t) => tokenToClass(t.token_path, t.token_type, prefix))
        )
        const parts = className
            .split(/\s+/)
            .filter((c) => c !== '' && !allPossible.has(c))
        if (newCls !== null) parts.push(newCls)
        onChange(parts.join(' '))
    }

    // ── Style helpers ─────────────────────────────────────────────────────────

    function flowBtnCls(value: string): string {
        const isActive = activeFlow === value
        return [
            'flex items-center justify-center rounded p-1.5 transition-colors',
            isActive
                ? 'bg-indigo-600/25 text-indigo-400 ring-1 ring-inset ring-indigo-500/40'
                : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700/60 hover:text-gray-300',
        ].join(' ')
    }

    const selectCls =
        'flex-1 appearance-none rounded border border-gray-700 bg-gray-800/60 px-1.5 py-0.5 text-[11px] text-gray-200 outline-none focus:border-indigo-500'

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-3 border-b border-gray-800 px-3 py-3">
            {/* Header */}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                Auto Layout
            </span>

            {/* ── Section 1: Flow ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-gray-500">Flow</span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        title="Wrap (flex-wrap)"
                        className={flowBtnCls('flex-wrap')}
                        onClick={() => handleFlow('flex-wrap')}
                    >
                        <WrapText className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="Vertical (flex-col)"
                        className={flowBtnCls('flex-col')}
                        onClick={() => handleFlow('flex-col')}
                    >
                        <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="Horizontal (flex-row)"
                        className={flowBtnCls('flex-row')}
                        onClick={() => handleFlow('flex-row')}
                    >
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* ── Section 2: Alignment grid + Gap ─────────────────────────── */}
            <div className="flex items-start gap-3">
                <AlignmentGrid
                    isColumn={isColumn}
                    activeAlignment={activeAlignment}
                    activeJustification={activeJustification}
                    onCellClick={handleCellClick}
                />
                <div className="min-w-0 flex-1">
                    <TokenSelect
                        label="Gap"
                        tokenType="dimension"
                        classPrefix="gap-"
                        value={getActiveTokenClass('gap-', 'dimension')}
                        onChange={(cls) => handleTokenChange('gap-', 'dimension', cls)}
                    />
                </div>
            </div>

            {/* ── Section 3: Resizing ──────────────────────────────────────── */}
            <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1.5">
                    <span className="shrink-0 text-[10px] font-semibold text-gray-600">
                        W
                    </span>
                    <select
                        value={activeWidth}
                        onChange={(e) => handleWidth(e.target.value)}
                        className={selectCls}
                    >
                        <option value="">— default —</option>
                        <option value="w-fit">Hug</option>
                        <option value="w-full">Fill</option>
                    </select>
                </div>
                <div className="flex flex-1 items-center gap-1.5">
                    <span className="shrink-0 text-[10px] font-semibold text-gray-600">
                        H
                    </span>
                    <select
                        value={activeHeight}
                        onChange={(e) => handleHeight(e.target.value)}
                        className={selectCls}
                    >
                        <option value="">— default —</option>
                        <option value="h-fit">Hug</option>
                        <option value="h-full">Fill</option>
                    </select>
                </div>
            </div>

            {/* ── Section 4: Padding ───────────────────────────────────────── */}
            <TokenSelect
                label="Padding"
                tokenType="dimension"
                classPrefix="p-"
                value={getActiveTokenClass('p-', 'dimension')}
                onChange={(cls) => handleTokenChange('p-', 'dimension', cls)}
            />
        </div>
    )
}
