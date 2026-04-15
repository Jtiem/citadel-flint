/**
 * HealthScoreAccordion.tsx — C4 extraction from GovernanceDashboard
 *
 * Renders the collapsible "Score breakdown" accordion including:
 *   - Next-step coaching sentence
 *   - Score trend hint
 *   - COUNSEL.4.2: Sparkline trajectory (imported from ScoreSection)
 *   - Rewind to clean button
 *   - Sub-score breakdown rows (Fidelity, Accessibility, Overrides)
 *   - "How is this calculated?" link + modal
 *
 * Pure presentational — one piece of local state: isOpen accordion toggle
 * and the score formula modal open/close. No Zustand reads, no IPC.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Modal } from '../Modal'
import { GRADE_TEXT } from './ScoreSection'
import { Sparkline } from './ScoreSection'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HealthScoreAccordionProps {
    score: number
    grade: string
    mithrilCount: number
    a11yCount: number
    overrideCount: number

    // Sparkline + trend
    healthHistory: Array<{ date: string; score: number; grade: string }>
    scoreTrendHint: string | null
    nextStep: { variant: string; text: string }

    // Rewind to clean (COUNSEL.3.1)
    lastCleanState: { timestamp: string; score: number } | null
    onRewindToClean: () => void

    // Sub-scores (passed as derived numbers so component stays pure)
    fidelityScore: number
    a11yScore: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HealthScoreAccordion({
    score,
    grade,
    mithrilCount,
    a11yCount,
    overrideCount,
    healthHistory,
    scoreTrendHint,
    nextStep,
    lastCleanState,
    onRewindToClean,
    fidelityScore,
    a11yScore,
}: HealthScoreAccordionProps) {
    const [isOpen, setIsOpen] = useState(true)
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)

    // Relative time formatter (inline to keep this component self-contained)
    function relativeTime(timestamp: string): string {
        const diff = Date.now() - new Date(timestamp).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'just now'
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs}h ago`
        return `${Math.floor(hrs / 24)}d ago`
    }

    return (
        <div className="border-b border-zinc-800/40">
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800/30 transition-colors"
                aria-expanded={isOpen}
                aria-controls="score-accordion"
            >
                {isOpen
                    ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                    : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                <span className="flex-1 text-xs text-zinc-500">Score breakdown</span>
                <span className={`text-xs font-bold ${GRADE_TEXT[grade]}`} aria-hidden="true">{grade}</span>
            </button>

            {isOpen && (
                <div id="score-accordion" className="px-3 pb-2 space-y-1.5">
                    {/* Next-step coaching sentence */}
                    <p className="text-xs text-zinc-400 pt-1" data-testid="next-step-prompt">{nextStep.text}</p>

                    {/* Score trend hint */}
                    {scoreTrendHint && (
                        <p className="text-xs text-zinc-300" data-testid="score-trend-hint">{scoreTrendHint}</p>
                    )}

                    {/* COUNSEL.4.2: Compliance trajectory sparkline */}
                    {healthHistory.length >= 2 ? (
                        <Sparkline data={healthHistory} />
                    ) : (
                        <p className="text-[10px] text-zinc-600" data-testid="sparkline-empty">
                            Tracking starts after first audit
                        </p>
                    )}

                    {/* Rewind to clean */}
                    {score < 95 && lastCleanState && (
                        <button
                            type="button"
                            onClick={onRewindToClean}
                            className="text-left text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition-colors"
                            data-testid="rewind-to-clean"
                        >
                            Rewind to clean (score {lastCleanState.score}, {relativeTime(lastCleanState.timestamp)})
                        </button>
                    )}

                    {/* Sub-score breakdown */}
                    {(mithrilCount > 0 || a11yCount > 0 || overrideCount > 0) && (
                        <div className="space-y-1 pt-0.5">
                            {mithrilCount > 0 && (
                                <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="fidelity-score-row">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                    <span className="flex-1">
                                        Fidelity — {mithrilCount} design {mithrilCount !== 1 ? 'issues' : 'issue'} (−{mithrilCount * 3} pts)
                                    </span>
                                </div>
                            )}
                            {a11yCount > 0 && (
                                <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="a11y-score-row">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                    <span className="flex-1">
                                        Accessibility — {a11yCount} {a11yCount !== 1 ? 'issues' : 'issue'} (−{a11yCount * 10} pts)
                                    </span>
                                </div>
                            )}
                            {overrideCount > 0 && (
                                <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="override-score-row">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                    <span className="flex-1">
                                        {overrideCount} unapplied {overrideCount !== 1 ? 'overrides' : 'override'} (−{overrideCount * 3} pts)
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* "How is this calculated?" link + modal */}
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
                                    <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Fidelity</span><span className="font-mono text-zinc-300">{fidelityScore}</span></li>
                                    <li className="flex items-center justify-between text-sm"><span className="text-zinc-300">Accessibility</span><span className="font-mono text-zinc-300">{a11yScore}</span></li>
                                </ul>
                            </div>
                        </div>
                    </Modal>
                </div>
            )}
        </div>
    )
}
