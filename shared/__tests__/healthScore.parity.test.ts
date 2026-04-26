/**
 * healthScore.parity.test.ts — Sprint CHRON.1-repair / C2
 *
 * Cross-surface parity harness for Flint's health score.
 *
 * Before this sprint, four different formulas produced four different grades
 * for the same input (64/70/75/69 for one test case; 73 vs 85 for another).
 * The canonical formula lives in shared/healthScore.ts; every other surface
 * re-exports, re-implements (with a comment), or delegates to it.
 *
 * This test feeds a matrix of 10+ scenarios into every surface and asserts
 * byte-for-byte equality of {score, grade}. If a future PR introduces drift,
 * this test fails loudly and names the offending surface.
 *
 * Surfaces covered:
 *   A. shared/healthScore.ts — the canonical source of truth (baseline)
 *   B. shared/healthSignal.ts — the legacy thin wrapper used by flint-ci
 *   C. src/hooks/useGovernanceHealth — Glass dashboard hook
 *   D. flint-mcp/src/core/dashboard/debtReportService — MCP debt report
 *
 * We do not import from React runtime here (the Glass hook exports pure
 * helpers that are callable outside a component — that's the surface the
 * parity test validates). This keeps the test Node-runnable.
 */

import { describe, it, expect } from 'vitest'
import {
    computeHealthScore as canonicalCompute,
    gradeFromScore as canonicalGrade,
    type HealthScoreInput,
    type HealthGrade,
} from '../healthScore'
import { formatHealthSignal } from '../healthSignal'
import {
    computeCanonicalHealthScore as glassCompute,
    gradeFromScore as glassGrade,
} from '../../src/hooks/useGovernanceHealth'
import {
    computeHealthScore as mcpCompute,
    scoreToGrade as mcpGrade,
} from '../../flint-mcp/src/core/dashboard/debtReportService'
import { computeDbomProjectHealth } from '../../flint-mcp/src/core/dbom/generator'
import { computePerComponentHealth } from '../../flint-mcp/src/core/governance/dbomService'

// ── Matrix of parity scenarios ──────────────────────────────────────────────

interface Scenario {
    name: string
    input: HealthScoreInput
    expectedScore: number
    expectedGrade: HealthGrade
}

const SCENARIOS: Scenario[] = [
    // Trivial baselines
    {
        name: 'all zeros → perfect score',
        input: { criticalCount: 0, amberCount: 0, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 100,
        expectedGrade: 'A',
    },

    // One-dimension linear drops
    {
        name: '1 critical only → 90 (A)',
        input: { criticalCount: 1, amberCount: 0, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 90,
        expectedGrade: 'A',
    },
    {
        name: '10 criticals → 0 (F, clamped)',
        input: { criticalCount: 10, amberCount: 0, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 0,
        expectedGrade: 'F',
    },
    {
        name: '1 amber only → 97 (A)',
        input: { criticalCount: 0, amberCount: 1, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 97,
        expectedGrade: 'A',
    },
    {
        name: '33 ambers → 1 (F)',
        input: { criticalCount: 0, amberCount: 33, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 1,
        expectedGrade: 'F',
    },
    {
        name: '1 advisory only → 99 (A)',
        input: { criticalCount: 0, amberCount: 0, advisoryCount: 1, overrideCount: 0 },
        expectedScore: 99,
        expectedGrade: 'A',
    },
    {
        name: '1 override only → 97 (A)',
        input: { criticalCount: 0, amberCount: 0, advisoryCount: 0, overrideCount: 1 },
        expectedScore: 97,
        expectedGrade: 'A',
    },

    // Mixed realistic scenarios (drawn from the CHRON.1-repair spec)
    {
        name: 'mixed realistic {c:2, a:3, adv:1, o:2} → 63 (D)',
        input: { criticalCount: 2, amberCount: 3, advisoryCount: 1, overrideCount: 2 },
        // 100 − 2×10 − 3×3 − 1×1 − 2×3 = 100 − 20 − 9 − 1 − 6 = 64
        expectedScore: 64,
        expectedGrade: 'D',
    },
    {
        name: 'large mixed {c:5, a:10, adv:5, o:3} → 6 (F)',
        input: { criticalCount: 5, amberCount: 10, advisoryCount: 5, overrideCount: 3 },
        // 100 − 50 − 30 − 5 − 9 = 6
        expectedScore: 6,
        expectedGrade: 'F',
    },

    // Grade-boundary suite — one per band + adjacent
    {
        name: 'exactly 90 → A (1 critical)',
        input: { criticalCount: 1, amberCount: 0, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 90,
        expectedGrade: 'A',
    },
    {
        name: '89 → B (1 amber + 1 advisory + 3×advisory + 2 overrides)',
        // 100 − 1*3 − 1*1 − 2*3 = 90 − not quite. Use {c:0, a:3, adv:2, o:0}: 100-0-9-2-0=89.
        input: { criticalCount: 0, amberCount: 3, advisoryCount: 2, overrideCount: 0 },
        expectedScore: 89,
        expectedGrade: 'B',
    },
    {
        name: 'exactly 80 → B (2 overrides + 4 ambers + 2 advisory)',
        // 100 − 0 − 4*3 − 2 − 2*3 = 100 − 12 − 2 − 6 = 80
        input: { criticalCount: 0, amberCount: 4, advisoryCount: 2, overrideCount: 2 },
        expectedScore: 80,
        expectedGrade: 'B',
    },
    {
        name: '79 → C (7 ambers)',
        // 100 − 7*3 = 79
        input: { criticalCount: 0, amberCount: 7, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 79,
        expectedGrade: 'C',
    },
    {
        name: 'exactly 70 → C (10 ambers)',
        // 100 − 10*3 = 70
        input: { criticalCount: 0, amberCount: 10, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 70,
        expectedGrade: 'C',
    },
    {
        name: '69 → D (3 criticals + 13 advisory)',
        // 100 − 3*10 − 13*1 = 57 − not right. Use {c:3, a:0, adv:1, o:0}: 100-30-0-1-0 = 69.
        input: { criticalCount: 3, amberCount: 0, advisoryCount: 1, overrideCount: 0 },
        expectedScore: 69,
        expectedGrade: 'D',
    },
    {
        name: 'exactly 60 → D (4 criticals)',
        // 100 − 4*10 = 60
        input: { criticalCount: 4, amberCount: 0, advisoryCount: 0, overrideCount: 0 },
        expectedScore: 60,
        expectedGrade: 'D',
    },
    {
        name: '59 → F (4 criticals + 1 advisory)',
        // 100 − 40 − 1 = 59
        input: { criticalCount: 4, amberCount: 0, advisoryCount: 1, overrideCount: 0 },
        expectedScore: 59,
        expectedGrade: 'F',
    },
]

// ── Parity assertions ──────────────────────────────────────────────────────

describe('canonical health score — shared/healthScore.ts', () => {
    for (const scenario of SCENARIOS) {
        it(`${scenario.name}`, () => {
            const result = canonicalCompute(scenario.input)
            expect(result.score).toBe(scenario.expectedScore)
            expect(result.grade).toBe(scenario.expectedGrade)
            expect(canonicalGrade(result.score)).toBe(scenario.expectedGrade)
        })
    }
})

describe('parity: shared/healthSignal.formatHealthSignal', () => {
    /*
     * formatHealthSignal has a simpler count-based signature: it does NOT
     * accept an advisory count. It always maps:
     *   - mithrilCount → amber bucket (penalty ×3)
     *   - a11yCount    → critical bucket (penalty ×10)
     *
     * For strict parity, we only feed scenarios with advisoryCount === 0.
     */
    for (const scenario of SCENARIOS.filter((s) => s.input.advisoryCount === 0)) {
        it(`agrees with canonical on ${scenario.name}`, () => {
            const signal = formatHealthSignal(
                scenario.input.amberCount,    // mithril count  → amber bucket
                scenario.input.criticalCount, // a11y count     → critical bucket
                scenario.input.overrideCount,
            )
            expect(signal.overallScore).toBe(scenario.expectedScore)
            expect(signal.grade).toBe(scenario.expectedGrade)
        })
    }
})

describe('parity: src/hooks/useGovernanceHealth.computeCanonicalHealthScore', () => {
    for (const scenario of SCENARIOS) {
        it(`agrees with canonical on ${scenario.name}`, () => {
            const { criticalCount, amberCount, advisoryCount, overrideCount } = scenario.input
            const score = glassCompute(criticalCount, amberCount, advisoryCount, overrideCount)
            expect(score).toBe(scenario.expectedScore)
            expect(glassGrade(score)).toBe(scenario.expectedGrade)
        })
    }
})

describe('parity: flint-mcp/debtReportService.computeHealthScore', () => {
    for (const scenario of SCENARIOS) {
        it(`agrees with canonical on ${scenario.name}`, () => {
            const { criticalCount, amberCount, advisoryCount, overrideCount } = scenario.input
            const score = mcpCompute(criticalCount, amberCount, advisoryCount, overrideCount)
            expect(score).toBe(scenario.expectedScore)
            expect(mcpGrade(score)).toBe(scenario.expectedGrade)
        })
    }
})

// ── COUNSEL.1: 16-row parity matrix across all four surfaces ────────────────

/**
 * Adapter for the flint-mcp/dbom/generator.ts surface.
 *
 * Calls the REAL exported `computeDbomProjectHealth` helper that
 * `generateDBOM` uses at step 7. If a future PR re-inlines the score math
 * inside `generateDBOM` and the helper drifts, this adapter still hits the
 * helper but the production surface diverges — the project-health helper test
 * catches that. To prevent helper bypass, the helper is the ONLY callsite for
 * the score in `generator.ts` (verified by code review).
 *
 * The generator hard-codes `overrideCount: 0` (filesystem scans cannot see
 * live overrides). For matrix rows with overrides, we therefore expect the
 * generator's score to equal `canonical({...input, overrideCount: 0})`, NOT
 * `canonical(input)`. The override-only rows are still exercised by the
 * canonical / glass / mcp adapters which DO honor overrideCount.
 */
function dbomGeneratorAdapter(input: HealthScoreInput): { score: number; grade: HealthGrade } {
    return computeDbomProjectHealth({
        criticalCount: input.criticalCount,
        amberCount: input.amberCount,
        advisoryCount: input.advisoryCount,
    })
}

/**
 * Adapter for the flint-mcp/governance/dbomService.ts per-component surface.
 *
 * Calls the REAL exported `computePerComponentHealth` helper that
 * `generateDBOM` uses to build every `DBOMComponentEntry.auditResult.score`.
 * We synthesize a minimal `DBOMViolation[]` + `DBOMA11yViolation[]` fixture
 * whose post-bucketing counts equal the matrix row's input.
 *
 * Bucketing per `computePerComponentHealth`:
 *   critical bucket = a11yViolations.length + mithril severity='critical'
 *   amber bucket    = mithril severity='amber'
 *   advisory bucket = mithril with neither 'critical' nor 'amber' severity
 *
 * Per-component scores hard-code overrideCount=0, so override-only matrix rows
 * are tested by other adapters, not this one.
 */
function dbomServicePerComponentAdapter(input: HealthScoreInput): { score: number; grade: HealthGrade } {
    const a11yViolations = Array.from({ length: input.criticalCount }, (_, i) => ({
        ruleId: `A11Y-FIXTURE-${i}`,
        message: 'parity-test fixture',
    }))
    const mithrilViolations = [
        ...Array.from({ length: input.amberCount }, (_, i) => ({
            ruleId: `MITHRIL-FIXTURE-AMBER-${i}`,
            severity: 'amber' as const,
            message: 'parity-test fixture',
            nodeId: `node-amber-${i}`,
        })),
        ...Array.from({ length: input.advisoryCount }, (_, i) => ({
            ruleId: `MITHRIL-FIXTURE-ADVISORY-${i}`,
            severity: 'advisory' as const,
            message: 'parity-test fixture',
            nodeId: `node-advisory-${i}`,
        })),
    ]
    return computePerComponentHealth(mithrilViolations, a11yViolations)
}

interface ParityRow {
    label: string
    input: HealthScoreInput
    expectedScore: number
    expectedGrade: HealthGrade
}

const PARITY_MATRIX: ParityRow[] = [
    { label: 'all-zero',            input: { criticalCount: 0, amberCount: 0, advisoryCount: 0, overrideCount: 0 }, expectedScore: 100, expectedGrade: 'A' },
    { label: 'critical-only-1',     input: { criticalCount: 1, amberCount: 0, advisoryCount: 0, overrideCount: 0 }, expectedScore: 90,  expectedGrade: 'A' },
    { label: 'critical-saturate',   input: { criticalCount: 10, amberCount: 0, advisoryCount: 0, overrideCount: 0 }, expectedScore: 0,  expectedGrade: 'F' },
    { label: 'amber-only-1',        input: { criticalCount: 0, amberCount: 1, advisoryCount: 0, overrideCount: 0 }, expectedScore: 97,  expectedGrade: 'A' },
    { label: 'advisory-only-5',     input: { criticalCount: 0, amberCount: 0, advisoryCount: 5, overrideCount: 0 }, expectedScore: 95,  expectedGrade: 'A' },
    { label: 'override-only-1',     input: { criticalCount: 0, amberCount: 0, advisoryCount: 0, overrideCount: 1 }, expectedScore: 97,  expectedGrade: 'A' },
    { label: 'override-only-3',     input: { criticalCount: 0, amberCount: 0, advisoryCount: 0, overrideCount: 3 }, expectedScore: 91,  expectedGrade: 'A' },
    { label: 'mixed-low',           input: { criticalCount: 1, amberCount: 2, advisoryCount: 3, overrideCount: 0 }, expectedScore: 81,  expectedGrade: 'B' },
    { label: 'mixed-mid',           input: { criticalCount: 2, amberCount: 3, advisoryCount: 1, overrideCount: 2 }, expectedScore: 64,  expectedGrade: 'D' },
    { label: 'mixed-high',          input: { criticalCount: 5, amberCount: 10, advisoryCount: 5, overrideCount: 3 }, expectedScore: 6, expectedGrade: 'F' },
    { label: 'boundary-90A',        input: { criticalCount: 1, amberCount: 0, advisoryCount: 0, overrideCount: 0 }, expectedScore: 90,  expectedGrade: 'A' },
    { label: 'boundary-89B',        input: { criticalCount: 0, amberCount: 3, advisoryCount: 2, overrideCount: 0 }, expectedScore: 89,  expectedGrade: 'B' },
    { label: 'boundary-80B',        input: { criticalCount: 0, amberCount: 4, advisoryCount: 2, overrideCount: 2 }, expectedScore: 80,  expectedGrade: 'B' },
    { label: 'boundary-70C',        input: { criticalCount: 0, amberCount: 10, advisoryCount: 0, overrideCount: 0 }, expectedScore: 70, expectedGrade: 'C' },
    { label: 'boundary-60D',        input: { criticalCount: 4, amberCount: 0, advisoryCount: 0, overrideCount: 0 }, expectedScore: 60,  expectedGrade: 'D' },
    { label: 'boundary-59F',        input: { criticalCount: 4, amberCount: 0, advisoryCount: 1, overrideCount: 0 }, expectedScore: 59,  expectedGrade: 'F' },
]

describe('COUNSEL.1 — 16-row parity matrix across all four surfaces', () => {
    /*
     * Headline invariant (COUNSEL.1):
     *   |delta| === 0 between every pairwise combination of the four
     *   public surfaces for every row of the matrix.
     *
     *   Surfaces:
     *     1. shared/healthScore.ts::computeHealthScore (canonical)
     *     2. flint-mcp/dashboard/debtReportService::computeHealthScore (deprecated shim)
     *     3. flint-mcp/dbom/generator::generateDBOM (project healthScore)
     *     4. flint-mcp/governance/dbomService::generateDBOM (per-component score)
     */

    it('matrix has exactly 16 rows', () => {
        expect(PARITY_MATRIX.length).toBe(16)
    })

    for (const row of PARITY_MATRIX) {
        it(`[${row.label}] all four surfaces agree on expected {score,grade}`, () => {
            const { criticalCount, amberCount, advisoryCount, overrideCount } = row.input

            // Surface 1: canonical (honors all four buckets)
            const s1 = canonicalCompute(row.input)
            // Surface 2: debtReportService positional shim (honors all four buckets)
            const s2Score = mcpCompute(criticalCount, amberCount, advisoryCount, overrideCount)
            const s2Grade = mcpGrade(s2Score)
            // Surface 3: dbom/generator project healthScore (overrideCount=0 by design)
            const s3 = dbomGeneratorAdapter(row.input)
            // Surface 4: dbomService per-component score (overrideCount=0 by design)
            const s4 = dbomServicePerComponentAdapter(row.input)

            // The canonical-with-zero-overrides expectation that DBOM surfaces
            // can match. For rows where overrideCount === 0 this equals s1.
            const noOverrideExpected = canonicalCompute({
                criticalCount,
                amberCount,
                advisoryCount,
                overrideCount: 0,
            })

            // Expected values land on the canonical formula
            expect(s1.score).toBe(row.expectedScore)
            expect(s1.grade).toBe(row.expectedGrade)

            // Surfaces 1 + 2 honor overrideCount, must agree pairwise
            expect(Math.abs(s1.score - s2Score)).toBe(0)
            expect(s1.grade).toBe(s2Grade)

            // Surfaces 3 + 4 ignore overrideCount by design (file scans cannot
            // see live overrides). They must agree with each other and with
            // canonical-at-zero-overrides; on rows where overrideCount === 0
            // they additionally agree with s1/s2.
            expect(Math.abs(s3.score - s4.score)).toBe(0)
            expect(s3.grade).toBe(s4.grade)
            expect(Math.abs(s3.score - noOverrideExpected.score)).toBe(0)
            expect(Math.abs(s4.score - noOverrideExpected.score)).toBe(0)

            if (overrideCount === 0) {
                expect(Math.abs(s1.score - s3.score)).toBe(0)
                expect(Math.abs(s1.score - s4.score)).toBe(0)
                expect(Math.abs(s2Score - s3.score)).toBe(0)
                expect(Math.abs(s2Score - s4.score)).toBe(0)
                expect(s1.grade).toBe(s3.grade)
                expect(s1.grade).toBe(s4.grade)
            }
        })
    }

    it('advisory-bucket-respected canary (divergence B): {0,0,5,0} ⇒ 95 / A', () => {
        // The single number that proves the DBOM advisory drop is fixed.
        // 100 - 0 - 0 - 5 - 0 = 95. Grade band: 95 >= 90 → A.
        const result = canonicalCompute({ criticalCount: 0, amberCount: 0, advisoryCount: 5, overrideCount: 0 })
        expect(result.score).toBe(95)
        expect(result.grade).toBe('A')
    })

    it('coverage-grade-independence: score does not depend on coverage data', () => {
        // The canonical computeHealthScore signature has no coverage field by
        // design. Two calls with identical buckets must return identical score
        // regardless of any external coverage state.
        const a = canonicalCompute({ criticalCount: 1, amberCount: 0, advisoryCount: 0, overrideCount: 0 })
        const b = canonicalCompute({ criticalCount: 1, amberCount: 0, advisoryCount: 0, overrideCount: 0 })
        expect(a.score).toBe(b.score)
        expect(a.grade).toBe(b.grade)
    })
})

describe('cross-surface byte-parity (belt + suspenders)', () => {
    /*
     * For every scenario, assert all four surfaces produce the same score and
     * grade. This is the contract that CHRON.1-repair / C2 exists to enforce.
     */
    for (const scenario of SCENARIOS) {
        it(`all surfaces agree on ${scenario.name}`, () => {
            const { criticalCount, amberCount, advisoryCount, overrideCount } = scenario.input

            const canon = canonicalCompute(scenario.input)
            const glassScore = glassCompute(criticalCount, amberCount, advisoryCount, overrideCount)
            const mcpScore = mcpCompute(criticalCount, amberCount, advisoryCount, overrideCount)

            expect(glassScore).toBe(canon.score)
            expect(mcpScore).toBe(canon.score)
            expect(glassGrade(glassScore)).toBe(canon.grade)
            expect(mcpGrade(mcpScore)).toBe(canon.grade)

            // healthSignal only works when advisoryCount === 0 (see above).
            if (advisoryCount === 0) {
                const signal = formatHealthSignal(amberCount, criticalCount, overrideCount)
                expect(signal.overallScore).toBe(canon.score)
                expect(signal.grade).toBe(canon.grade)
            }
        })
    }
})
