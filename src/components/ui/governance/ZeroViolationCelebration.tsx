/**
 * ZeroViolationCelebration.tsx — C2 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Confetti hero state shown when there are zero violations and no overrides.
 * Score = 100 triggers CSS-only confetti particles and A+ badge.
 * Score < 100 shows a simpler "No issues found" message.
 *
 * Source lines: GovernanceDashboard.tsx ~1710-1778
 */

import { CheckCircle2 } from 'lucide-react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ZeroViolationCelebrationProps {
    /** The current health score (0–100). */
    score: number
    /** Whether the ring-pulse animation is active. */
    ringPulse: boolean
    /** Whether delta / baseline mode is active. */
    isBaselineSet: boolean
    /** True if the zero-state should be shown (tokenCount > 0 && totalViolations === 0 && !overridesExist). */
    visible: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ZeroViolationCelebration({
    score,
    ringPulse,
    isBaselineSet,
    visible,
}: ZeroViolationCelebrationProps) {
    if (!visible) return null

    return (
        <div
            className="relative flex flex-col items-center gap-3 px-6 py-8 border-b border-zinc-800 text-center overflow-hidden"
            data-testid="zero-violation-state"
        >
            {/* CSS-only confetti particles — triggered on score reaching 100 */}
            {score === 100 && ringPulse && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="celebration-confetti">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <span
                            key={i}
                            className="absolute block h-1.5 w-1.5 rounded-full motion-safe:animate-bounce"
                            style={{
                                left: `${10 + (i * 7) % 80}%`,
                                top: `${-5 - (i % 3) * 10}%`,
                                backgroundColor: [
                                    'rgb(52 211 153)', 'rgb(129 140 248)', 'rgb(251 191 36)',
                                    'rgb(248 113 113)', 'rgb(96 165 250)', 'rgb(167 139 250)',
                                ][i % 6],
                                animationDelay: `${i * 0.12}s`,
                                animationDuration: `${1.2 + (i % 3) * 0.3}s`,
                                opacity: 0.8,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Hero display */}
            {score === 100 ? (
                <>
                    <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full bg-emerald-900/30 ring-2 ring-emerald-400/40${ringPulse ? ' motion-safe:animate-pulse' : ''}`}
                        data-testid="celebration-hero"
                    >
                        <span className="text-xl font-black text-emerald-300" data-testid="celebration-grade">A+</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-emerald-300" data-testid="celebration-title">
                            Perfect score — zero violations
                        </p>
                        <p className="mt-1 text-xs text-zinc-400 max-w-[240px] leading-relaxed" data-testid="celebration-description">
                            Your project is fully compliant with all active governance rules. You are clear to export.
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <CheckCircle2
                        className={`h-9 w-9 text-emerald-400${ringPulse ? ' motion-safe:animate-pulse' : ''}`}
                        aria-hidden="true"
                        data-testid="zero-violation-icon"
                    />
                    <div>
                        <p className="text-sm font-medium text-emerald-300">
                            {isBaselineSet ? 'No new issues since baseline' : 'No issues found'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400 max-w-[220px] leading-relaxed">
                            {isBaselineSet
                                ? "No new violations since your baseline was set. You're clear to export."
                                : "Your component meets all governance standards. You're clear to export."}
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
