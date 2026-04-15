/**
 * CompactScoreSummary.tsx — C3 extraction from GovernanceDashboard
 *
 * Renders:
 *   - COUNSEL.1.1: Category filter chips (design-system, accessibility, token-sync)
 *   - Score summary row: mini ring + grade letter + score/100 + export badge
 *   - Effort framing text
 *   - COUNSEL.1.2: Delta mode auto-enable banner
 *   - Export-ready banner (when not blocked)
 *
 * Pure presentational — zero Zustand reads, zero IPC, zero side-effects.
 * All data is passed via props from GovernanceDashboard.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import { ShieldCheck, SendHorizonal } from 'lucide-react'
import { GRADE_TEXT, GRADE_RING } from './ScoreSection'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CompactScoreSummaryProps {
    score: number
    grade: string
    exportBlocked: boolean
    ringPulse: boolean

    // Category chips
    mithrilCount: number
    a11yCount: number
    syncCount: number
    activeCategory: 'design-system' | 'accessibility' | 'token-sync' | null
    onSetCategory: (cat: 'design-system' | 'accessibility' | 'token-sync' | null) => void

    // Blocking dot counts (GAP-11)
    designSystemBlockingCount?: number
    a11yBlockingCount?: number
    syncBlockingCount?: number

    // Effort framing
    effortText: string

    // Delta mode banner (COUNSEL.1.2)
    initialViolationCount?: number
    isBaselineSet: boolean
    bannerDismissed: boolean
    onDismissBanner: () => void
    onShowAllViolations: () => void

    // Export gate
    onOpenExportModal?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompactScoreSummary({
    score,
    grade,
    exportBlocked,
    ringPulse,
    mithrilCount,
    a11yCount,
    syncCount,
    activeCategory,
    onSetCategory,
    designSystemBlockingCount = 0,
    a11yBlockingCount = 0,
    syncBlockingCount = 0,
    effortText,
    initialViolationCount,
    isBaselineSet,
    bannerDismissed,
    onDismissBanner,
    onShowAllViolations,
    onOpenExportModal,
}: CompactScoreSummaryProps) {
    const totalViolations = mithrilCount + a11yCount

    return (
        <>
            {/* COUNSEL.1.1: Category chips — first thing visible, ABOVE score ring */}
            {(totalViolations > 0) && (
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800" data-testid="category-chips">
                    {mithrilCount > 0 && (
                        <button
                            type="button"
                            aria-pressed={activeCategory === 'design-system'}
                            onClick={() => onSetCategory(activeCategory === 'design-system' ? null : 'design-system')}
                            className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-zinc-100 aria-pressed:border-amber-500/50 aria-pressed:bg-amber-900/20 aria-pressed:text-amber-300 transition-colors"
                            data-testid="chip-design-system"
                        >
                            {designSystemBlockingCount > 0 && (
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                                    aria-label="blocks export"
                                    data-testid="chip-design-system-blocking-dot"
                                    title="Contains violations that block export"
                                />
                            )}
                            Design System {mithrilCount}
                        </button>
                    )}
                    {a11yCount > 0 && (
                        <button
                            type="button"
                            aria-pressed={activeCategory === 'accessibility'}
                            onClick={() => onSetCategory(activeCategory === 'accessibility' ? null : 'accessibility')}
                            className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-zinc-100 aria-pressed:border-red-500/50 aria-pressed:bg-red-900/20 aria-pressed:text-red-300 transition-colors"
                            data-testid="chip-accessibility"
                        >
                            {a11yBlockingCount > 0 && (
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                                    aria-label="blocks export"
                                    data-testid="chip-accessibility-blocking-dot"
                                    title="Contains violations that block export"
                                />
                            )}
                            Accessibility {a11yCount}
                        </button>
                    )}
                    {syncCount > 0 && (
                        <button
                            type="button"
                            aria-pressed={activeCategory === 'token-sync'}
                            onClick={() => onSetCategory(activeCategory === 'token-sync' ? null : 'token-sync')}
                            className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-zinc-100 aria-pressed:border-indigo-500/50 aria-pressed:bg-indigo-900/20 aria-pressed:text-indigo-300 transition-colors"
                            data-testid="chip-token-sync"
                        >
                            {syncBlockingCount > 0 && (
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                                    aria-label="blocks export"
                                    data-testid="chip-token-sync-blocking-dot"
                                    title="Contains violations that block export"
                                />
                            )}
                            Token Sync {syncCount}
                        </button>
                    )}
                </div>
            )}

            {/* Score summary row: mini ring + grade + score + export badge */}
            <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800">
                {/* Mini ring — 32px inline SVG */}
                {(() => {
                    const RADIUS = 13
                    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
                    const filled = (score / 100) * CIRCUMFERENCE
                    const gap = CIRCUMFERENCE - filled
                    return (
                        <svg
                            width={32}
                            height={32}
                            viewBox="0 0 32 32"
                            className={`shrink-0${ringPulse ? ' motion-safe:animate-pulse' : ''}`}
                            aria-label={`Health score ${score} out of 100`}
                            role="img"
                            data-testid="score-ring"
                        >
                            <circle cx={16} cy={16} r={RADIUS} fill="none" className="stroke-zinc-800" strokeWidth={3} />
                            <circle
                                cx={16} cy={16} r={RADIUS} fill="none"
                                className={GRADE_RING[grade]}
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeDasharray={`${filled} ${gap}`}
                                transform="rotate(-90 16 16)"
                            />
                        </svg>
                    )
                })()}

                {/* Grade + score */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-sm font-bold ${GRADE_TEXT[grade]}`} aria-label={`Grade ${grade}`}>{grade}</span>
                    <span className="text-xs text-zinc-500">{score}/100</span>
                    {exportBlocked
                        ? <span className="ml-1 rounded bg-red-900/30 border border-red-700/40 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Export blocked</span>
                        : <span className="ml-1 rounded bg-emerald-900/20 border border-emerald-700/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Ready to export</span>
                    }
                </div>
            </div>

            {/* Effort text */}
            <p className="px-3 py-1.5 text-[11px] text-zinc-400" data-testid="effort-framing">
                {effortText}
            </p>

            {/* COUNSEL.1.2: Delta mode auto-enable banner */}
            {(initialViolationCount ?? 0) > 10 && isBaselineSet && !bannerDismissed && (
                <div className="mx-3 mb-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-3 py-2" data-testid="delta-mode-auto-banner">
                    <p className="text-[10px] text-indigo-300">
                        Delta mode active — showing new issues only. There are {initialViolationCount} existing violations being filtered.
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Show all violations"
                            onClick={onShowAllViolations}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                        >
                            Show all violations
                        </button>
                        <button
                            type="button"
                            aria-label="Dismiss delta mode banner"
                            onClick={onDismissBanner}
                            className="text-[10px] text-zinc-500 hover:text-zinc-400"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Export gate — full-width banner when not blocked */}
            {!exportBlocked && (
                <div className="px-3 py-1.5 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-900/10 px-3 py-1.5">
                        <ShieldCheck size={12} className="shrink-0 text-emerald-400" aria-hidden="true" />
                        <span className="flex-1 text-xs font-medium text-emerald-300">
                            {isBaselineSet ? 'No new issues — export ready' : 'All clear — export ready'}
                        </span>
                        <button
                            type="button"
                            onClick={() => onOpenExportModal?.()}
                            className="flex items-center gap-1 rounded bg-emerald-600/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                            aria-label="Open export modal"
                        >
                            Export
                            <SendHorizonal size={10} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
