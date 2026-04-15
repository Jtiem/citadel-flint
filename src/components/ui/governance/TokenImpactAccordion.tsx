/**
 * TokenImpactAccordion.tsx — C13
 *
 * COUNSEL.4.1 Token Change Impact Preview accordion section.
 * Shows the estimated impact of changing a token, with per-file breakdown.
 * Pure presentational — all data and callbacks passed as props.
 */

import { ChevronDown, ChevronRight, Activity, Loader2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenImpactData {
    tokenName: string
    affectedFiles: number
    estimatedImpact: 'low' | 'medium' | 'high'
}

export interface TokenImpactFileEntry {
    file: string
    count: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const IMPACT_COLOR: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
}

const IMPACT_BORDER: Record<string, string> = {
    low: 'border-emerald-500/30 bg-emerald-900/10',
    medium: 'border-amber-500/30 bg-amber-900/10',
    high: 'border-red-500/30 bg-red-900/10',
}

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface TokenImpactAccordionProps {
    /** Whether the accordion is expanded. */
    isOpen: boolean
    /** Toggle callback. */
    onToggle: () => void
    /** Token impact summary, or null when no sync violations are active. */
    tokenImpact: TokenImpactData | null
    /** Per-file breakdown list. */
    tokenImpactDetails: TokenImpactFileEntry[]
    /** Whether a token impact load is in progress. */
    isTokenImpactLoading: boolean
    /** Callback for the "Preview impact" refresh button. */
    onPreviewImpact: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TokenImpactAccordion({
    isOpen,
    onToggle,
    tokenImpact,
    tokenImpactDetails,
    isTokenImpactLoading,
    onPreviewImpact,
}: TokenImpactAccordionProps) {
    if (!tokenImpact) return null

    return (
        <div className="border-t border-zinc-800/60" data-testid="token-impact-section">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                aria-expanded={isOpen}
                aria-controls="token-impact-accordion"
            >
                {isOpen
                    ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                    : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                <span className="flex-1 text-xs text-zinc-400">Token Impact</span>
                <span className={`text-[10px] font-medium ${IMPACT_COLOR[tokenImpact.estimatedImpact]}`}>
                    {tokenImpact.estimatedImpact}
                </span>
            </button>
            {isOpen && (
                <div id="token-impact-accordion" className="px-3 py-2 space-y-1.5">
                    <div className={`flex items-start gap-2 rounded border px-3 py-2 ${IMPACT_BORDER[tokenImpact.estimatedImpact]}`}>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300">
                                Changing{' '}
                                <span className="font-mono text-indigo-300">{tokenImpact.tokenName}</span>{' '}
                                would create{' '}
                                <span className={`font-bold ${IMPACT_COLOR[tokenImpact.estimatedImpact]}`}>
                                    {tokenImpact.affectedFiles}
                                </span>{' '}
                                Mithril {tokenImpact.affectedFiles === 1 ? 'violation' : 'violations'} in{' '}
                                {tokenImpact.affectedFiles}{' '}
                                {tokenImpact.affectedFiles === 1 ? 'file' : 'files'}
                            </p>
                            <p className={`mt-0.5 text-[10px] ${IMPACT_COLOR[tokenImpact.estimatedImpact]}`}>
                                {tokenImpact.estimatedImpact === 'low' && 'Low impact — safe to change'}
                                {tokenImpact.estimatedImpact === 'medium' && 'Medium impact — review affected files before changing'}
                                {tokenImpact.estimatedImpact === 'high' && 'High impact — this token is widely used, proceed with caution'}
                            </p>
                        </div>
                    </div>
                    {tokenImpactDetails.length > 0 && (
                        <div className="space-y-0.5" data-testid="token-impact-file-list">
                            {tokenImpactDetails.map((f, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/30"
                                >
                                    <span className="flex-1 truncate text-[10px] font-mono text-zinc-400">
                                        {f.file}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 tabular-nums">
                                        {f.count} {f.count === 1 ? 'violation' : 'violations'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => void onPreviewImpact()}
                        disabled={isTokenImpactLoading}
                        className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors disabled:text-zinc-600"
                        data-testid="preview-impact-button"
                    >
                        {isTokenImpactLoading ? (
                            <Loader2 size={9} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Activity size={9} aria-hidden="true" />
                        )}
                        Preview impact
                    </button>
                </div>
            )}
        </div>
    )
}
