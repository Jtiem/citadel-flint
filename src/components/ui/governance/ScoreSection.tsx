/**
 * ScoreSection.tsx — Extracted from GovernanceDashboard (Sprint 3A refactor)
 *
 * Renders the health score ring, grade letter, sparkline, trend hint,
 * next-step coaching sentence, sub-score breakdown rows, and the
 * "How is this calculated?" modal.
 *
 * All state that drives this UI lives in GovernanceDashboard. ScoreSection
 * is intentionally stateless except for the modal open/close toggle so the
 * parent can keep a flat, predictable state shape.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck, ShieldOff, SendHorizonal } from 'lucide-react'
import { Modal } from '../Modal'
import { formatHealthSignal } from '../../../../shared/healthSignal'
import { gradeFromScore } from '../../../hooks/useGovernanceHealth'
import { formatRelativeTime } from '../../../utils/relativeTime'

// ── Grade → token colour maps (ScoreSection owns these) ─────────────────────

export const GRADE_TEXT: Record<string, string> = {
    A: 'text-emerald-400',
    B: 'text-emerald-400',
    C: 'text-amber-400',
    D: 'text-amber-400',
    F: 'text-red-400',
}

export const GRADE_RING: Record<string, string> = {
    A: 'stroke-emerald-400',
    B: 'stroke-emerald-400',
    C: 'stroke-amber-400',
    D: 'stroke-amber-400',
    F: 'stroke-red-400',
}

// ── COUNSEL.4.2: Sparkline ────────────────────────────────────────────────────

export function Sparkline({ data }: { data: Array<{ score: number }> }) {
    if (data.length < 2) return null
    const w = 120, h = 32, pad = 2
    const scores = data.slice(-7).map(d => d.score)
    const min = Math.min(...scores), max = Math.max(...scores)
    const range = max - min || 1
    const points = scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - 2 * pad)
        const y = h - pad - ((s - min) / range) * (h - 2 * pad)
        return `${x},${y}`
    }).join(' ')
    // Colour routes through Tailwind text-* tokens via `currentColor` — no hardcoded hex.
    // Flint governs its own code (Commandment 2: No Hallucinated Styling).
    const trend = scores[scores.length - 1] - scores[0]
    const trendColorClass = trend > 2 ? 'text-emerald-400' : trend < -2 ? 'text-red-400' : 'text-amber-400'
    const trendLabel = trend > 2 ? 'Trending up' : trend < -2 ? 'Trending down' : 'Stable'
    return (
        <div className="flex items-center gap-2" data-testid="sparkline-container">
            <svg width={w} height={h} className={`shrink-0 ${trendColorClass}`} aria-label="Health trend" role="img" data-testid="sparkline">
                <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
            </svg>
            <span className="text-[10px] text-zinc-500" data-testid="sparkline-trend-label">{trendLabel}</span>
        </div>
    )
}

// ── Score ring (SVG) ─────────────────────────────────────────────────────────

interface ScoreRingProps {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    pulse?: boolean
}

export function ScoreRing({ score, grade, pulse }: ScoreRingProps) {
    const RADIUS = 34
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
    const filled = (score / 100) * CIRCUMFERENCE
    const gap    = CIRCUMFERENCE - filled
    return (
        <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            className={`shrink-0${pulse ? ' motion-safe:animate-pulse' : ''}`}
            aria-label={`Health score ${score} out of 100`}
            role="img"
            data-testid="score-ring"
        >
            <circle cx={40} cy={40} r={RADIUS} fill="none" className="stroke-zinc-800" strokeWidth={6} />
            <circle
                cx={40} cy={40} r={RADIUS} fill="none"
                className={GRADE_RING[grade]}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${gap}`}
                transform="rotate(-90 40 40)"
            />
            <text
                x={40} y={44} textAnchor="middle"
                className="fill-zinc-100"
                fontSize={16} fontWeight={700} fontFamily="inherit"
                aria-hidden="true"
            >
                {score}
            </text>
        </svg>
    )
}


// ── Props ─────────────────────────────────────────────────────────────────────

export interface ScoreSectionProps {
    score: number
    grade: string
    trend: number
    exportBlocked: boolean
    mithrilCount: number
    a11yCount: number
    overridesExist: boolean
    overrideCount: number
    onRunAudit: () => void
    baselineMode: boolean
    onToggleBaseline: () => void
    newIssueCount?: number

    // Derived data passed from parent
    healthHistory: Array<{ date: string; score: number; grade: string }>
    scoreTrendHint: string | null
    nextStep: { variant: string; text: string }
    effortText: string
    ringPulse: boolean
    lastCleanState: { timestamp: string; score: number } | null
    onRewindToClean: () => void

    // Category chips
    activeCategory: 'design-system' | 'accessibility' | 'token-sync' | null
    onSetCategory: (cat: 'design-system' | 'accessibility' | 'token-sync' | null) => void
    syncCount: number

    // Delta mode banner
    initialViolationCount?: number
    isBaselineSet: boolean
    bannerDismissed: boolean
    onDismissBanner: () => void
    onShowAllViolations: () => void

    // Export
    onOpenExportModal?: () => void

    // GAP-11: Per-category export-blocking violation counts (severity: 'critical')
    designSystemBlockingCount?: number
    a11yBlockingCount?: number
    syncBlockingCount?: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScoreSection({
    score,
    grade,
    exportBlocked,
    mithrilCount,
    a11yCount,
    overridesExist,
    overrideCount,
    healthHistory,
    scoreTrendHint,
    nextStep,
    effortText,
    ringPulse,
    lastCleanState,
    onRewindToClean,
    activeCategory,
    onSetCategory,
    syncCount,
    initialViolationCount,
    isBaselineSet,
    bannerDismissed,
    onDismissBanner,
    onShowAllViolations,
    onOpenExportModal,
    designSystemBlockingCount = 0,
    a11yBlockingCount = 0,
    syncBlockingCount = 0,
}: ScoreSectionProps) {
    const [isScoreOpen, setIsScoreOpen] = useState(true)
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)

    const healthSignal = formatHealthSignal(mithrilCount, a11yCount, overrideCount)

    return (
        <>
            {/* ── EXPORT GATE BANNER ──────────────────────────────────────── */}
            {exportBlocked && (
                <div className="px-3 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 rounded border border-red-700/40 bg-red-900/10 px-3 py-2" role="alert">
                        <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-xs font-medium text-red-300">
                            Export blocked — {mithrilCount + a11yCount} {mithrilCount + a11yCount !== 1 ? 'issues' : 'issue'}
                            {overridesExist ? ' + overrides' : ''}
                        </span>
                    </div>
                </div>
            )}
            {!exportBlocked && (
                <div className="px-3 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-900/10 px-3 py-2">
                        <ShieldCheck size={13} className="shrink-0 text-emerald-400" aria-hidden="true" />
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

            {/* ── ACCORDION: Health Score ──────────────────────────────────── */}
            <div className="border-t border-zinc-800">
                <button
                    type="button"
                    onClick={() => setIsScoreOpen(v => !v)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                    aria-expanded={isScoreOpen}
                    aria-controls="score-accordion"
                >
                    {isScoreOpen
                        ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                        : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                    <span className="flex-1 text-xs text-zinc-400">Health Score</span>
                    <span className={`text-xs font-bold ${GRADE_TEXT[grade]}`} aria-hidden="true">{grade}</span>
                    <span className="font-mono text-xs text-zinc-400" aria-label={`Score ${score} out of 100`}>{score}</span>
                </button>

                {isScoreOpen && (
                    <div id="score-accordion">
                        {/* Effort framing */}
                        <p className="px-4 pt-3 pb-1 text-xs text-zinc-400" data-testid="effort-framing">
                            {effortText}
                        </p>

                        {/* COUNSEL.1.1: Category split chips */}
                        <div className="flex items-center gap-1.5 px-4 pb-2" data-testid="category-chips">
                            <button
                                type="button"
                                aria-pressed={activeCategory === 'design-system'}
                                onClick={() => onSetCategory(activeCategory === 'design-system' ? null : 'design-system')}
                                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 aria-pressed:border-amber-500/50 aria-pressed:bg-amber-900/20 aria-pressed:text-amber-300"
                                data-testid="chip-design-system"
                            >
                                Design System {mithrilCount}
                                {/* GAP-11: Export-blocking indicator */}
                                {designSystemBlockingCount > 0 && (
                                    <span
                                        className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                                        aria-label="blocks export"
                                        data-testid="chip-design-system-blocking-dot"
                                        title="Contains violations that block export"
                                    />
                                )}
                            </button>
                            <button
                                type="button"
                                aria-pressed={activeCategory === 'accessibility'}
                                onClick={() => onSetCategory(activeCategory === 'accessibility' ? null : 'accessibility')}
                                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 aria-pressed:border-red-500/50 aria-pressed:bg-red-900/20 aria-pressed:text-red-300"
                                data-testid="chip-accessibility"
                            >
                                Accessibility {a11yCount}
                                {/* GAP-11: Export-blocking indicator — all a11y violations are critical */}
                                {a11yBlockingCount > 0 && (
                                    <span
                                        className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                                        aria-label="blocks export"
                                        data-testid="chip-accessibility-blocking-dot"
                                        title="Contains violations that block export"
                                    />
                                )}
                            </button>
                            <button
                                type="button"
                                aria-pressed={activeCategory === 'token-sync'}
                                onClick={() => onSetCategory(activeCategory === 'token-sync' ? null : 'token-sync')}
                                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 aria-pressed:border-indigo-500/50 aria-pressed:bg-indigo-900/20 aria-pressed:text-indigo-300"
                                data-testid="chip-token-sync"
                            >
                                Token Sync {syncCount}
                                {/* GAP-11: Export-blocking indicator */}
                                {syncBlockingCount > 0 && (
                                    <span
                                        className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0"
                                        aria-label="blocks export"
                                        data-testid="chip-token-sync-blocking-dot"
                                        title="Contains violations that block export"
                                    />
                                )}
                            </button>
                        </div>

                        {/* COUNSEL.1.2: Delta mode auto-enable banner */}
                        {(initialViolationCount ?? 0) > 10 && isBaselineSet && !bannerDismissed && (
                            <div className="mx-3 mb-2 rounded border border-indigo-500/30 bg-indigo-900/10 px-3 py-2" data-testid="delta-mode-auto-banner">
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

                        {/* Ring + grade label row */}
                        <div className="flex items-center gap-4 px-4 py-4" title={scoreTrendHint ?? undefined}>
                            <div className="flex flex-col items-center gap-1">
                                <ScoreRing score={score} grade={grade as 'A' | 'B' | 'C' | 'D' | 'F'} pulse={ringPulse} />
                                {healthHistory.length >= 2 && <Sparkline data={healthHistory} />}
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className={`text-3xl font-bold leading-none ${GRADE_TEXT[grade]}`} aria-label={`Grade ${grade}`}>{grade}</span>
                                <span className="text-xs text-zinc-400">{isBaselineSet ? 'Delta Score (new issues only)' : 'Governance Health'}</span>
                                {scoreTrendHint && <span className="text-xs text-zinc-300 mt-0.5" data-testid="score-trend-hint">{scoreTrendHint}</span>}
                                <p className="text-xs text-zinc-400 mt-1" data-testid="next-step-prompt">{nextStep.text}</p>
                                {/* COUNSEL.3.1: Rewind to clean */}
                                {score < 95 && lastCleanState && (
                                    <button
                                        type="button"
                                        onClick={onRewindToClean}
                                        className="mt-1 text-left text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition-colors"
                                        data-testid="rewind-to-clean"
                                    >
                                        Rewind to clean (score {lastCleanState.score}, {formatRelativeTime(lastCleanState.timestamp)})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sub-score breakdown */}
                        {(mithrilCount > 0 || a11yCount > 0 || overrideCount > 0) && (
                            <div className="px-3 py-2 space-y-1.5 border-t border-zinc-800/50">
                                {mithrilCount > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="fidelity-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                        <span className="flex-1">Fidelity Score: {healthSignal.fidelityScore}/100 — fixing {mithrilCount} design system {mithrilCount !== 1 ? 'issues' : 'issue'} would raise your score by {mithrilCount * 3} pts</span>
                                    </div>
                                )}
                                {a11yCount > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="a11y-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                        <span className="flex-1">Accessibility Score: {healthSignal.a11yScore}/100 — fixing {a11yCount} accessibility {a11yCount !== 1 ? 'issues' : 'issue'} would raise your score by {a11yCount * 10} pts</span>
                                    </div>
                                )}
                                {overrideCount > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="override-score-row">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                        <span className="flex-1">Fixing {overrideCount} unapplied style {overrideCount !== 1 ? 'overrides' : 'override'} would raise your score by {overrideCount * 3} pts</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* "How is this calculated?" link + modal */}
                        <div className="px-3 py-2 border-t border-zinc-800/50">
                            <button
                                type="button"
                                onClick={() => setIsScoreModalOpen(true)}
                                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                How is this calculated?
                            </button>
                            <Modal
                                isOpen={isScoreModalOpen}
                                onClose={() => setIsScoreModalOpen(false)}
                                title="How Your Score Is Calculated"
                                size="sm"
                                data-testid="score-formula-modal"
                            >
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs font-medium text-zinc-400 mb-2">Deductions</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Critical violations</span><span className="font-mono text-red-400">−10 per issue</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Amber violations</span><span className="font-mono text-amber-400">−3 per issue</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Advisory violations</span><span className="font-mono text-zinc-400">−1 per issue</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Unapplied overrides</span><span className="font-mono text-amber-400">−3 per change</span></li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-zinc-400 mb-2">Grade Scale</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center justify-between text-sm"><span className="text-emerald-400 font-medium">A</span><span className="text-zinc-400">90–100</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-emerald-400 font-medium">B</span><span className="text-zinc-400">80–89</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-amber-400 font-medium">C</span><span className="text-zinc-400">70–79</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-amber-400 font-medium">D</span><span className="text-zinc-400">60–69</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-red-400 font-medium">F</span><span className="text-zinc-400">&lt;60</span></li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-zinc-400 mb-2">Live Sub-scores</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Fidelity</span><span className="font-mono text-zinc-300">{healthSignal.fidelityScore}</span></li>
                                            <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Accessibility</span><span className="font-mono text-zinc-300">{healthSignal.a11yScore}</span></li>
                                        </ul>
                                    </div>
                                </div>
                            </Modal>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

// Re-export gradeFromScore so callers that import from here also get it
export { gradeFromScore }
