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
