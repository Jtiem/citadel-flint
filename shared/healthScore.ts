/**
 * Canonical health score module — shared/healthScore.ts
 *
 * Single source of truth for Flint's project health score and letter grade.
 * Before this module existed, four competing formulas lived in the codebase
 * (two inside flint-mcp/src/core/dashboard/debtReportService.ts, one in
 * src/hooks/useGovernanceHealth.ts, and one in shared/healthSignal.ts) —
 * producing different grades for the same input. Sprint CHRON.1-repair / C2
 * retired those and funnels every surface through this module.
 *
 * Formula:
 *   score = clamp(100
 *             - criticalCount * 10
 *             - amberCount    * 3
 *             - advisoryCount * 1
 *             - overrideCount * 3,
 *           0, 100)
 *
 * Severity buckets (see CLAUDE.md / Counsel redesign):
 *   critical  — any Mithril or A11y violation with severity 'critical'
 *   amber     — severity 'warn' or 'amber' (standard violations)
 *   advisory  — severity 'info' or 'advisory' (cognitive, opt-in)
 *   override  — count of active overrides that have not expired
 *
 * Grade bands (identical across every surface):
 *   A >= 90  B >= 80  C >= 70  D >= 60  F < 60
 *
 * Zero dependencies — importable from the MCP build (Node ESM, .js extension
 * in relative imports) and the Glass build (Vite, bare path imports without
 * extension). Do NOT add any imports.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthScoreInput {
    /** Count of severity='critical' violations (Mithril + A11y). Penalty ×10. */
    criticalCount: number
    /** Count of severity='amber' or 'warn' violations. Penalty ×3. */
    amberCount: number
    /** Count of severity='advisory' or 'info' violations. Penalty ×1. */
    advisoryCount: number
    /** Count of active (non-expired) rule overrides. Penalty ×3. */
    overrideCount: number
}

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface HealthScoreResult {
    /** Integer 0..100 (clamped). */
    score: number
    /** Letter grade derived from score using the canonical bands. */
    grade: HealthGrade
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Map a numeric score to a canonical letter grade.
 *
 * Bands:
 *   A >= 90  ·  B >= 80  ·  C >= 70  ·  D >= 60  ·  F < 60
 *
 * Non-finite or out-of-range inputs are treated as F (safe default).
 */
export function gradeFromScore(score: number): HealthGrade {
    if (!Number.isFinite(score)) return 'F'
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

/**
 * Compute the canonical health score and letter grade from pre-bucketed counts.
 *
 * This is the ONLY function in the codebase that should own the health-score
 * formula. Every surface (Glass hook, MCP debt report, CI debt output, SARIF
 * generator, DBOM health, etc.) must call this or re-export it.
 *
 * Negative inputs are coerced to 0 — callers should never pass negatives, but
 * defensive clamping keeps us from emitting a score > 100 if they do.
 *
 * Returns an integer score clamped to [0, 100] and the matching letter grade.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
    const criticalCount = Math.max(0, Math.floor(input.criticalCount ?? 0))
    const amberCount = Math.max(0, Math.floor(input.amberCount ?? 0))
    const advisoryCount = Math.max(0, Math.floor(input.advisoryCount ?? 0))
    const overrideCount = Math.max(0, Math.floor(input.overrideCount ?? 0))

    const raw =
        100
        - criticalCount * 10
        - amberCount * 3
        - advisoryCount * 1
        - overrideCount * 3

    const score = Math.max(0, Math.min(100, Math.round(raw)))
    return { score, grade: gradeFromScore(score) }
}

// ── Deduction constants (exported for narration) ─────────────────────────────

/**
 * Per-bucket deduction weights — exported so UI surfaces can narrate the
 * breakdown without re-declaring the numbers (avoids future drift).
 */
export const HEALTH_SCORE_WEIGHTS = {
    critical: 10,
    amber: 3,
    advisory: 1,
    override: 3,
} as const
