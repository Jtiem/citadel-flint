/**
 * Shared health signal computation -- flint-ci/src/utils/health.ts
 *
 * Canonical formula used by CLI, CI, and Glass.
 * Mirrors shared/healthSignal.ts (inlined to avoid cross-package rootDir issues).
 *
 * Single source of truth for the flint-ci package. All commands and the
 * GitHub Action import from here instead of inlining the formula.
 */

export interface HealthSignal {
    fidelityScore: number
    a11yScore: number
    overrideCount: number
    overallScore: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export function computeHealthSignal(
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
