/**
 * Shared Health Signal — pure function, zero dependencies.
 *
 * Computes fidelity, accessibility, and overall health scores from
 * raw violation counts. Used by both Glass (GovernanceDashboard) and
 * the CLI (flint-ci debt command) so the numbers always match.
 *
 * COUNSEL.1.3: The overall score now uses the canonical severity-weighted
 * formula from useGovernanceHealth.ts / debtReportService.ts:
 *   score = clamp(100 - criticals * 10 - warnings * 3 - infos * 1 - overrides * 3, 0, 100)
 *
 * For this function's simplified API (count-based, not severity-bucketed),
 * a11y violations map to 'critical' (penalty 10) and mithril violations
 * map to 'amber/warning' (penalty 3). This matches the canonical mapping
 * in useGovernanceHealth.bucketViolations where a11y severity='critical'
 * and mithril default severity='amber'.
 *
 * @deprecated Prefer useGovernanceHealth hook (src/hooks/useGovernanceHealth.ts)
 * for components, or computeCanonicalHealthScore for pure computation.
 * This function is retained for backward compatibility with sub-score display.
 */

export interface HealthSignal {
    /** 0-100, sub-score for design system fidelity */
    fidelityScore: number
    /** 0-100, sub-score for accessibility compliance */
    a11yScore: number
    /** Raw count of active rule overrides */
    overrideCount: number
    /**
     * Overall health score (0-100) — uses the canonical severity-weighted formula.
     * a11y violations = critical (penalty 10), mithril = warning (penalty 3).
     */
    overallScore: number
    /** Letter grade: A >= 90, B >= 80, C >= 70, D >= 60, F < 60 */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

/**
 * Compute a health signal from raw violation counts.
 *
 * Overall score uses the canonical severity-weighted formula
 * (COUNSEL.1.3 — matches useGovernanceHealth / debtReportService):
 *   clamp(100 - a11yCount * 10 - mithrilCount * 3 - overrideCount * 3, 0, 100)
 *
 * Note: a11y violations are always severity='critical' (penalty 10 each).
 * Mithril violations default to severity='amber' (penalty 3 each).
 * When individual severity information is available, prefer
 * computeCanonicalHealthScore from useGovernanceHealth.ts instead.
 */
export function formatHealthSignal(
    mithrilCount: number,
    a11yCount: number,
    overrideCount: number,
): HealthSignal {
    // Sub-scores for breakdown display (informational, not used for overall score)
    const fidelityScore = Math.max(0, 100 - mithrilCount * 3)
    const a11yScore = Math.max(0, 100 - a11yCount * 10)

    // Canonical formula: a11y = critical (x10), mithril = amber/warning (x3), overrides (x3)
    const raw = 100 - a11yCount * 10 - mithrilCount * 3 - overrideCount * 3
    const overallScore = Math.max(0, Math.min(100, raw))

    let grade: HealthSignal['grade']
    if (overallScore >= 90) grade = 'A'
    else if (overallScore >= 80) grade = 'B'
    else if (overallScore >= 70) grade = 'C'
    else if (overallScore >= 60) grade = 'D'
    else grade = 'F'

    return { fidelityScore, a11yScore, overrideCount, overallScore, grade }
}
