/**
 * useGovernanceHealth — src/hooks/useGovernanceHealth.ts
 *
 * Canonical health score hook for Flint Glass. This hook is a THIN WRAPPER
 * around shared/healthScore.ts — the single source of truth for the formula.
 * It exists to:
 *   - bucket LinterWarning[] into severity counts, and
 *   - memoize the result for the React render path.
 *
 * It owns no arithmetic. Every score and grade routes through
 * shared/healthScore.ts so Glass, MCP, CI, SARIF and DBOM always agree.
 *
 * Formula (see shared/healthScore.ts):
 *   score = clamp(100
 *             - criticalCount * 10
 *             - amberCount    * 3
 *             - advisoryCount * 1
 *             - overrideCount * 3,
 *           0, 100)
 *
 * Grade bands: A >= 90 · B >= 80 · C >= 70 · D >= 60 · F < 60
 */

import { useMemo } from 'react'
import type { LinterWarning } from '../types/flint-api'
import {
    computeHealthScore as canonicalComputeHealthScore,
    gradeFromScore as canonicalGradeFromScore,
    type HealthGrade,
} from '../../shared/healthScore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GovernanceHealthResult {
    /** Health score 0-100 */
    score: number
    /** Letter grade */
    grade: HealthGrade
    /** Count of violations mapped to the 'critical' bucket (severity='critical') */
    criticals: number
    /** Count of violations mapped to the 'warning' bucket (severity='amber'/'warn') */
    warnings: number
    /** Count of violations mapped to the 'info' bucket (severity='advisory'/'info') */
    infos: number
}

// ── Pure helpers (exported for tests and other hooks) ────────────────────────

/**
 * Compute a health score from pre-bucketed severity counts.
 *
 * @deprecated COUNSEL.1 — Use the object-arg form
 *   `computeHealthScore({ criticalCount, amberCount, advisoryCount, overrideCount })`
 * imported directly from `shared/healthScore.ts`. This positional 4-arg shim
 * is the same shape that produced divergence B in the MCP DBOM generator
 * (silently zeroed advisoryCount). Kept for one-release back-compat only.
 *
 * @param criticals - Count of critical-severity violations (penalty ×10)
 * @param warnings  - Count of warning/amber-severity violations  (penalty ×3)
 * @param infos     - Count of info/advisory-severity violations     (penalty ×1)
 * @param overrides - Count of active rule overrides        (penalty ×3)
 * @returns Health score clamped to [0, 100], rounded to integer
 */
export function computeCanonicalHealthScore(
    criticals: number,
    warnings: number,
    infos: number,
    overrides: number,
): number {
    return canonicalComputeHealthScore({
        criticalCount: criticals,
        amberCount: warnings,
        advisoryCount: infos,
        overrideCount: overrides,
    }).score
}

/**
 * Map a numeric score to a letter grade. Delegates to shared/healthScore.ts.
 * Re-exported so legacy callers that import gradeFromScore from this module
 * continue to compile.
 */
export function gradeFromScore(score: number): HealthGrade {
    return canonicalGradeFromScore(score)
}

/**
 * Bucket an array of LinterWarnings into (criticals, warnings, infos) counts.
 *
 * Mapping:
 *   severity='critical'          → criticals
 *   severity='amber' | 'warn'    → warnings
 *   severity='advisory' | 'info' → infos
 *   (any unknown value)          → infos (safe default)
 */
export function bucketViolations(violations: LinterWarning[]): {
    criticals: number
    warnings: number
    infos: number
} {
    let criticals = 0
    let warnings = 0
    let infos = 0

    for (const v of violations) {
        const sev = v.severity as string
        if (sev === 'critical') {
            criticals++
        } else if (sev === 'amber' || sev === 'warn') {
            warnings++
        } else {
            // 'advisory', 'info', and any future values
            infos++
        }
    }

    return { criticals, warnings, infos }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Computes the canonical governance health score from pre-filtered violation
 * arrays and an override count. Callers are responsible for applying delta
 * filtering (baseline mode) before passing violations in.
 *
 * @param violations  - Combined Mithril + A11y LinterWarning array (delta-filtered)
 * @param overrideCount - Active rule override count
 * @returns GovernanceHealthResult with score, grade, and per-bucket counts
 */
export function useGovernanceHealth(
    violations: LinterWarning[],
    overrideCount: number,
): GovernanceHealthResult {
    return useMemo(() => {
        const { criticals, warnings, infos } = bucketViolations(violations)
        const { score, grade } = canonicalComputeHealthScore({
            criticalCount: criticals,
            amberCount: warnings,
            advisoryCount: infos,
            overrideCount: overrideCount,
        })
        return { score, grade, criticals, warnings, infos }
    }, [violations, overrideCount])
}
