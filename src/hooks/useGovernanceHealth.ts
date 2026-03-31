/**
 * useGovernanceHealth — src/hooks/useGovernanceHealth.ts
 *
 * Canonical health score hook for Flint Glass. Computes the project health
 * score using the SAME severity-weighted formula as debtReportService.ts so
 * Glass and MCP always agree on the score and grade.
 *
 * Formula (canonical, matches debtReportService.computeHealthScore):
 *   score = clamp(100 - criticals × 10 - warnings × 3 - infos × 1, 0, 100)
 *
 * Severity mapping (LinterWarning.severity → debt bucket):
 *   'critical'  → criticals  (penalty 10)
 *   'amber'     → warnings   (penalty 3)
 *   'advisory'  → infos      (penalty 1)
 *
 * Override penalty: overrideCount × 3 (overrides are not violations, so they
 * have no severity; the advisory-equivalent weight is applied directly).
 *
 * Grade thresholds:
 *   A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60
 */

import { useMemo } from 'react'
import type { LinterWarning } from '../types/flint-api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GovernanceHealthResult {
    /** Health score 0-100 */
    score: number
    /** Letter grade */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Count of violations mapped to the 'critical' bucket (LinterWarning severity='critical') */
    criticals: number
    /** Count of violations mapped to the 'warning' bucket (LinterWarning severity='amber') */
    warnings: number
    /** Count of violations mapped to the 'info' bucket (LinterWarning severity='advisory') */
    infos: number
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/**
 * Compute a health score from pre-bucketed severity counts.
 * This is the canonical formula that MUST match debtReportService.computeHealthScore.
 *
 * @param criticals - Count of critical-severity violations (penalty ×10)
 * @param warnings  - Count of warning-severity violations  (penalty ×3)
 * @param infos     - Count of info-severity violations     (penalty ×1)
 * @param overrides - Count of active rule overrides        (penalty ×3)
 * @returns Health score clamped to [0, 100]
 */
export function computeCanonicalHealthScore(
    criticals: number,
    warnings: number,
    infos: number,
    overrides: number,
): number {
    const raw = 100 - criticals * 10 - warnings * 3 - infos * 1 - overrides * 3
    return Math.max(0, Math.min(100, raw))
}

/**
 * Map a numeric score to a letter grade.
 * Thresholds are identical to debtReportService.scoreToGrade.
 */
export function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

/**
 * Bucket an array of LinterWarnings into (criticals, warnings, infos) counts.
 *
 * Mapping:
 *   severity='critical'  → criticals
 *   severity='amber'     → warnings
 *   severity='advisory'  → infos
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
        if (v.severity === 'critical') {
            criticals++
        } else if (v.severity === 'amber') {
            warnings++
        } else {
            // 'advisory' and any future values
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
        const score = computeCanonicalHealthScore(criticals, warnings, infos, overrideCount)
        const grade = gradeFromScore(score)
        return { score, grade, criticals, warnings, infos }
    }, [violations, overrideCount])
}
