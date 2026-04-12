/**
 * ContrastAuditPanel — src/components/ui/ContrastAuditPanel.tsx
 *
 * MINT.3a: Token Contrast Auditor
 *
 * Renders a WCAG contrast matrix comparing foreground color tokens
 * against common background tokens. Each pair shows pass/fail badge
 * and contrast ratio.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useCallback } from 'react'
import { X, Eye } from 'lucide-react'
import type { ContrastPair } from '../../types/flint-api'

export interface ContrastAuditPanelProps {
    /** Cached contrast data. Null means "not yet fetched". */
    contrastData: ContrastPair[] | null
    /** Whether the audit is currently running. */
    isLoading: boolean
    /** Trigger a fresh audit. */
    onRunAudit: () => void
    /** Close the panel. */
    onClose: () => void
}

/** Group contrast pairs by foreground token for the matrix view. */
function groupByForeground(pairs: ContrastPair[]): Map<string, ContrastPair[]> {
    const map = new Map<string, ContrastPair[]>()
    for (const pair of pairs) {
        if (!map.has(pair.fg)) {
            map.set(pair.fg, [])
        }
        map.get(pair.fg)!.push(pair)
    }
    return map
}

function RatioBadge({ pair }: { pair: ContrastPair }) {
    const ratioText = `${pair.ratio.toFixed(1)}:1`

    if (pair.passAAA) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                data-testid="contrast-badge-aaa"
                aria-label={`${ratioText} AAA pass`}
            >
                {ratioText} AAA
            </span>
        )
    }

    if (pair.passAA) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                data-testid="contrast-badge-aa"
                aria-label={`${ratioText} AA pass`}
            >
                {ratioText} AA
            </span>
        )
    }

    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20"
            data-testid="contrast-badge-fail"
            aria-label={`${ratioText} FAIL`}
        >
            {ratioText} FAIL
        </span>
    )
}

function PairRow({ pair }: { pair: ContrastPair }) {
    return (
        <div
            className="flex items-center gap-2 border-b border-zinc-800/40 px-3 py-1.5 hover:bg-zinc-800/20"
            data-testid="contrast-pair-row"
        >
            {/* Visual preview: fg text on bg color */}
            <span
                className="flex h-6 w-10 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                style={{ backgroundColor: pair.bgValue, color: pair.fgValue }}
                aria-label={`Preview: ${pair.fgValue} on ${pair.bgValue}`}
                role="img"
            >
                Aa
            </span>

            {/* Foreground token */}
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400" title={pair.fg}>
                {pair.fg}
            </span>

            {/* "on" divider */}
            <span className="shrink-0 text-[9px] text-zinc-600">on</span>

            {/* Background token */}
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400" title={pair.bg}>
                {pair.bg}
            </span>

            {/* Ratio badge */}
            <RatioBadge pair={pair} />
        </div>
    )
}

export function ContrastAuditPanel({
    contrastData,
    isLoading,
    onRunAudit,
    onClose,
}: ContrastAuditPanelProps) {
    const [filterFail, setFilterFail] = useState(false)

    const pairs = contrastData ?? []
    const displayed = filterFail ? pairs.filter((p) => !p.passAA) : pairs
    const failCount = pairs.filter((p) => !p.passAA).length
    const passCount = pairs.length - failCount
    const grouped = groupByForeground(displayed)

    return (
        <div
            className="border-t border-zinc-700 bg-zinc-950/95"
            data-testid="contrast-audit-panel"
            role="region"
            aria-label="Contrast audit results"
        >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <Eye className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-zinc-300">
                    Warden Contrast Audit
                </span>

                {pairs.length > 0 && (
                    <span className="text-[10px] text-zinc-500">
                        {passCount} pass, {failCount} fail
                    </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                    {pairs.length > 0 && failCount > 0 && (
                        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <input
                                type="checkbox"
                                checked={filterFail}
                                onChange={(e) => setFilterFail(e.target.checked)}
                                className="h-3 w-3 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-1 focus:ring-red-400"
                                aria-label="Show failures only"
                            />
                            Failures only
                        </label>
                    )}

                    <button
                        type="button"
                        onClick={onRunAudit}
                        disabled={isLoading}
                        className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-40"
                        aria-label="Re-run contrast audit"
                    >
                        {isLoading ? 'Auditing\u2026' : 'Re-run'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        aria-label="Close contrast audit panel"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="max-h-[240px] overflow-y-auto">
                {isLoading && (
                    <p className="px-3 py-4 text-center text-[11px] text-zinc-500">
                        Analyzing contrast pairs\u2026
                    </p>
                )}

                {!isLoading && pairs.length === 0 && (
                    <p className="px-3 py-4 text-center text-[11px] text-zinc-500">
                        No color token pairs to audit. Import color tokens first.
                    </p>
                )}

                {!isLoading && pairs.length > 0 && displayed.length === 0 && (
                    <p className="px-3 py-4 text-center text-[11px] text-emerald-400">
                        All pairs pass WCAG AA contrast requirements.
                    </p>
                )}

                {!isLoading && displayed.length > 0 && (
                    <div role="list" aria-label="Contrast pair results">
                        {[...grouped.entries()].map(([fg, fgPairs]) => (
                            <div key={fg} role="listitem">
                                {fgPairs.map((pair, i) => (
                                    <PairRow key={`${pair.fg}-${pair.bg}-${i}`} pair={pair} />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
