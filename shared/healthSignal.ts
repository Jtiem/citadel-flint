/**
 * Shared Health Signal — pure function, zero dependencies.
 *
 * Computes fidelity, accessibility, and overall health scores from
 * raw violation counts. Used by both Glass (GovernanceDashboard) and
 * the CLI (flint-ci debt command) so the numbers always match.
 */

export interface HealthSignal {
    /** 0-100, computed as max(0, 100 - mithrilCount * 5) */
    fidelityScore: number
    /** 0-100, computed as max(0, 100 - a11yCount * 10) */
    a11yScore: number
    /** Raw count of active rule overrides */
    overrideCount: number
    /** Overall health score (0-100) — matches GovernanceDashboard formula */
    overallScore: number
    /** Letter grade: A >= 90, B >= 80, C >= 70, D >= 60, F < 60 */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

/**
 * Compute a health signal from raw violation counts.
 *
 * Overall score uses the same formula as GovernanceDashboard:
 *   clamp(100 - mithrilCount * 5 - a11yCount * 10 - overrideCount * 3, 0, 100)
 */
export function formatHealthSignal(
    mithrilCount: number,
    a11yCount: number,
    overrideCount: number,
): HealthSignal {
    const fidelityScore = Math.max(0, 100 - mithrilCount * 5)
    const a11yScore = Math.max(0, 100 - a11yCount * 10)

    const raw = 100 - mithrilCount * 5 - a11yCount * 10 - overrideCount * 3
    const overallScore = Math.max(0, Math.min(100, raw))

    let grade: HealthSignal['grade']
    if (overallScore >= 90) grade = 'A'
    else if (overallScore >= 80) grade = 'B'
    else if (overallScore >= 70) grade = 'C'
    else if (overallScore >= 60) grade = 'D'
    else grade = 'F'

    return { fidelityScore, a11yScore, overrideCount, overallScore, grade }
}
