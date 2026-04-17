/**
 * Shared Health Signal — thin wrapper over shared/healthScore.ts.
 *
 * This module predates the canonical health-score unification (CHRON.1-repair
 * C2). It used to own its own formula; it no longer does. Overall score +
 * grade now route through shared/healthScore.ts — the single source of truth.
 *
 * Retained for backward compatibility so existing callers (flint-ci/debt.ts,
 * legacy imports) continue to compile. The sub-score fields (fidelityScore,
 * a11yScore) are display-only breakdowns that DO NOT participate in the
 * overall score — they are the per-bucket worst-case ceiling used for the
 * "How is this calculated?" modal.
 *
 * New code should import computeHealthScore / gradeFromScore from
 * shared/healthScore.ts directly and derive sub-scores inline.
 *
 * @deprecated Use shared/healthScore.ts (computeHealthScore) for the score and
 *     grade. Only the sub-score breakdown remains useful here.
 */

import { computeHealthScore, type HealthGrade } from './healthScore.js'

export interface HealthSignal {
    /**
     * 0-100, informational sub-score for design system fidelity.
     * Purely a display helper (100 − mithrilCount × 3). NOT used for the
     * overall score — that routes through shared/healthScore.ts.
     */
    fidelityScore: number
    /**
     * 0-100, informational sub-score for accessibility compliance.
     * Purely a display helper (100 − a11yCount × 10). NOT used for the
     * overall score — that routes through shared/healthScore.ts.
     */
    a11yScore: number
    /** Raw count of active rule overrides */
    overrideCount: number
    /**
     * Canonical overall health score (0-100) from shared/healthScore.ts.
     * The simplified count-based API here treats every a11y violation as
     * severity='critical' (penalty ×10) and every mithril violation as
     * severity='amber' (penalty ×3). Callers that have severity-bucketed
     * counts should import computeHealthScore from shared/healthScore.ts
     * directly for exact fidelity.
     */
    overallScore: number
    /** Letter grade from shared/healthScore.ts (A >= 90, B >= 80, C >= 70, D >= 60, F < 60) */
    grade: HealthGrade
}

/**
 * Compute a health signal from raw violation counts.
 *
 * Overall score and grade are delegated to the canonical module so every Flint
 * surface agrees on the number. Sub-scores remain local because they are a
 * display affordance, not part of the formula.
 */
export function formatHealthSignal(
    mithrilCount: number,
    a11yCount: number,
    overrideCount: number,
): HealthSignal {
    // Sub-scores for breakdown display (informational, not used for overall score)
    const m = Math.max(0, Math.floor(mithrilCount ?? 0))
    const a = Math.max(0, Math.floor(a11yCount ?? 0))
    const o = Math.max(0, Math.floor(overrideCount ?? 0))

    const fidelityScore = Math.max(0, Math.min(100, 100 - m * 3))
    const a11yScore = Math.max(0, Math.min(100, 100 - a * 10))

    // Canonical formula: treat a11y=critical (×10), mithril=amber (×3).
    // This matches the simplified count-based contract this function was built
    // for (see flint-ci/src/commands/debt.ts). For severity-bucketed inputs
    // call computeHealthScore from shared/healthScore.ts directly.
    const { score: overallScore, grade } = computeHealthScore({
        criticalCount: a,
        amberCount: m,
        advisoryCount: 0,
        overrideCount: o,
    })

    return { fidelityScore, a11yScore, overrideCount: o, overallScore, grade }
}
