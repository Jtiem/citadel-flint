/**
 * riskApproval.test.ts
 *
 * Tests for V.1 — Mutation Risk Score (MRS) wired into the orchestrator
 * approval flow.
 *
 * Imports the canonical MRS implementation from mrsEngine.ts (extracted
 * from orchestrator.ts to sidestep the esbuild 0.27.x Unicode issue).
 *
 * What is tested
 * ──────────────
 * 1. Read-only tools receive no risk annotation.
 * 2. Simple prop/text updates resolve to the green tier.
 * 3. Structural ops (insert_node, wrap_node) resolve to amber or higher.
 * 4. Delete node resolves to the highest (red) tier.
 * 5. Risk fields (riskTier, riskScore, riskFactors) are present on annotated chunks.
 * 6. requiresReview is true for amber.
 * 7. requiresSignoff is true for red.
 * 8. Boundary values for tier thresholds (0.30/0.31, 0.69/0.70).
 * 9. affectedNodeCount influences the blast radius factor.
 * 10. hasViolations raises the severity factor.
 */

import { describe, it, expect } from 'vitest'
import {
    computeMRS,
    mrsTier,
    type MRSTier,
    type MRSFactor,
} from '../mrsEngine'

// ── Set of mutation tool names (mirrors MUTATION_TOOL_NAMES in orchestrator.ts)
const MUTATION_TOOL_NAMES = new Set([
    'flint_update_props',
    'flint_update_text',
    'flint_insert_node',
    'flint_wrap_node',
    'flint_delete_node',
    'flint_add_class',
    'flint_remove_class',
])

// ── Read-only tool names ───────────────────────────────────────────────────────
const READ_ONLY_TOOL_NAMES = [
    'flint_read_code',
    'flint_read_tokens',
    'flint_audit_mithril',
    'flint_audit_a11y',
    'flint_search_design_system',
]

// ── Helper: simulate the chunk annotation logic in orchestrator.ts runStream ──
interface ToolCallChunk {
    type: 'tool_call'
    toolName: string
    toolUseId: string
    toolInput: Record<string, unknown>
    riskTier?: MRSTier
    riskScore?: number
    riskFactors?: MRSFactor[]
    requiresReview?: boolean
    requiresSignoff?: boolean
}

function simulateChunkEmission(toolName: string, violationsActive: boolean = false): ToolCallChunk {
    const base: ToolCallChunk = {
        type: 'tool_call',
        toolName,
        toolUseId: 'test-id',
        toolInput: {},
    }

    if (MUTATION_TOOL_NAMES.has(toolName)) {
        const mrs = computeMRS(toolName, 1, violationsActive)
        return {
            ...base,
            riskTier: mrs.tier,
            riskScore: mrs.score,
            riskFactors: mrs.factors,
            requiresReview: mrs.tier === 'amber',
            requiresSignoff: mrs.tier === 'red',
        }
    }

    return base
}

// =============================================================================
// Test suites
// =============================================================================

describe('V.1 MRS — read-only tools receive no risk annotation', () => {
    for (const toolName of READ_ONLY_TOOL_NAMES) {
        it(`${toolName} has no riskTier, riskScore, riskFactors`, () => {
            const chunk = simulateChunkEmission(toolName)
            expect(chunk.riskTier).toBeUndefined()
            expect(chunk.riskScore).toBeUndefined()
            expect(chunk.riskFactors).toBeUndefined()
            expect(chunk.requiresReview).toBeUndefined()
            expect(chunk.requiresSignoff).toBeUndefined()
        })
    }
})

describe('V.1 MRS — simple prop/text updates resolve to green tier', () => {
    it('flint_update_props (no violations) → green tier', () => {
        const result = computeMRS('flint_update_props', 1, false)
        expect(result.tier).toBe('green')
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(0.30)
    })

    it('flint_update_text (no violations) → green tier', () => {
        const result = computeMRS('flint_update_text', 1, false)
        expect(result.tier).toBe('green')
        expect(result.score).toBeLessThanOrEqual(0.30)
    })

    it('flint_add_class (no violations) → green tier', () => {
        const result = computeMRS('flint_add_class', 1, false)
        expect(result.tier).toBe('green')
    })

    it('flint_remove_class (no violations) → green tier', () => {
        const result = computeMRS('flint_remove_class', 1, false)
        expect(result.tier).toBe('green')
    })
})

describe('V.1 MRS — structural ops (insert_node, wrap_node) resolve to amber or higher', () => {
    it('flint_insert_node (1 node, no violations) → amber or higher', () => {
        const result = computeMRS('flint_insert_node', 1, false)
        expect(['amber', 'red']).toContain(result.tier)
        expect(result.score).toBeGreaterThan(0.30)
    })

    it('flint_wrap_node (1 node, no violations) → amber or higher', () => {
        const result = computeMRS('flint_wrap_node', 1, false)
        expect(['amber', 'red']).toContain(result.tier)
        expect(result.score).toBeGreaterThan(0.30)
    })

    it('flint_insert_node score is higher than flint_update_props score', () => {
        const insertResult = computeMRS('flint_insert_node', 1, false)
        const propsResult = computeMRS('flint_update_props', 1, false)
        expect(insertResult.score).toBeGreaterThan(propsResult.score)
    })

    it('flint_wrap_node score is higher than flint_insert_node score', () => {
        const wrapResult = computeMRS('flint_wrap_node', 1, false)
        const insertResult = computeMRS('flint_insert_node', 1, false)
        expect(wrapResult.score).toBeGreaterThan(insertResult.score)
    })
})

describe('V.1 MRS — flint_delete_node resolves to the highest risk tier', () => {
    it('flint_delete_node → red tier', () => {
        const result = computeMRS('flint_delete_node', 1, false)
        expect(result.tier).toBe('red')
        // Note: score reflects the formula output. The tier is enforced to red
        // by the policy floor even when the raw score is below 0.70.
        expect(result.score).toBeGreaterThan(0)
    })

    it('flint_delete_node has the highest score among all mutation tools', () => {
        const deleteScore = computeMRS('flint_delete_node', 1, false).score
        for (const toolName of MUTATION_TOOL_NAMES) {
            if (toolName === 'flint_delete_node') continue
            const otherScore = computeMRS(toolName, 1, false).score
            expect(deleteScore).toBeGreaterThanOrEqual(otherScore)
        }
    })
})

describe('V.1 MRS — risk fields are present on mutation tool_call chunks', () => {
    for (const toolName of MUTATION_TOOL_NAMES) {
        it(`${toolName} chunk has riskTier, riskScore, riskFactors`, () => {
            const chunk = simulateChunkEmission(toolName)
            expect(chunk.riskTier).toBeDefined()
            expect(typeof chunk.riskScore).toBe('number')
            expect(Array.isArray(chunk.riskFactors)).toBe(true)
            expect(chunk.riskFactors!.length).toBeGreaterThan(0)
        })
    }
})

describe('V.1 MRS — requiresReview true for amber tier', () => {
    it('flint_insert_node chunk has requiresReview=true (amber)', () => {
        const chunk = simulateChunkEmission('flint_insert_node')
        expect(chunk.riskTier).toBe('amber')
        expect(chunk.requiresReview).toBe(true)
        expect(chunk.requiresSignoff).toBe(false)
    })

    it('flint_wrap_node chunk has requiresReview=true (amber)', () => {
        const chunk = simulateChunkEmission('flint_wrap_node')
        expect(chunk.riskTier).toBe('amber')
        expect(chunk.requiresReview).toBe(true)
        expect(chunk.requiresSignoff).toBe(false)
    })

    it('green-tier mutation has requiresReview=false', () => {
        const chunk = simulateChunkEmission('flint_update_props')
        expect(chunk.riskTier).toBe('green')
        expect(chunk.requiresReview).toBe(false)
        expect(chunk.requiresSignoff).toBe(false)
    })
})

describe('V.1 MRS — requiresSignoff true for red tier', () => {
    it('flint_delete_node chunk has requiresSignoff=true (red)', () => {
        const chunk = simulateChunkEmission('flint_delete_node')
        expect(chunk.riskTier).toBe('red')
        expect(chunk.requiresSignoff).toBe(true)
        expect(chunk.requiresReview).toBe(false)
    })
})

describe('V.1 MRS — tier threshold boundary conditions', () => {
    it('score of exactly 0.30 resolves to green', () => {
        expect(mrsTier(0.30)).toBe('green')
    })

    it('score of 0.31 resolves to amber', () => {
        expect(mrsTier(0.31)).toBe('amber')
    })

    it('score of 0.69 resolves to amber', () => {
        expect(mrsTier(0.69)).toBe('amber')
    })

    it('score of 0.70 resolves to red', () => {
        expect(mrsTier(0.70)).toBe('red')
    })

    it('score of 0.0 resolves to green', () => {
        expect(mrsTier(0.0)).toBe('green')
    })

    it('score of 1.0 resolves to red', () => {
        expect(mrsTier(1.0)).toBe('red')
    })
})

describe('V.1 MRS — affectedNodeCount raises blast radius factor', () => {
    it('10 affected nodes has higher blast contribution than 1', () => {
        const result1 = computeMRS('flint_update_props', 1, false)
        const result10 = computeMRS('flint_update_props', 10, false)
        // The blast radius factor is min(n/10, 1.0) × 0.35.
        // At n=10 the factor is 0.35; at n=1 it is 0.035.
        expect(result10.score).toBeGreaterThan(result1.score)
    })

    it('blast radius is capped at 1.0 for node counts > 10', () => {
        const result10 = computeMRS('flint_update_props', 10, false)
        const result100 = computeMRS('flint_update_props', 100, false)
        // Both should have the same blast contribution (capped at 1.0).
        const blast10 = result10.factors.find((f) => f.name === 'blastRadius')!
        const blast100 = result100.factors.find((f) => f.name === 'blastRadius')!
        expect(blast10.contribution).toBe(blast100.contribution)
    })

    it('blastRadius factor contribution is correct for 5 nodes', () => {
        const result = computeMRS('flint_update_props', 5, false)
        const blast = result.factors.find((f) => f.name === 'blastRadius')!
        // blastRaw = 5/10 = 0.5; contribution = mrsClamped(0.5 × 0.35) = mrsClamped(0.175) = 0.175
        expect(blast.contribution).toBeCloseTo(0.175, 3)
    })
})

describe('V.1 MRS — hasViolations raises the severity factor', () => {
    it('flint_update_props with violations scores higher than without', () => {
        const without = computeMRS('flint_update_props', 1, false)
        const with_ = computeMRS('flint_update_props', 1, true)
        expect(with_.score).toBeGreaterThan(without.score)
    })

    it('severity factor description changes when violations are present', () => {
        const result = computeMRS('flint_update_props', 1, true)
        const severityFactor = result.factors.find((f) => f.name === 'severity')!
        expect(severityFactor.description).toContain('violations')
    })

    it('severity factor is 0 for non-structural op with no violations', () => {
        const result = computeMRS('flint_update_props', 1, false)
        const severityFactor = result.factors.find((f) => f.name === 'severity')!
        expect(severityFactor.contribution).toBe(0)
    })

    it('severity factor is non-zero for structural op with no violations', () => {
        // delete is structural (opWeightRaw 0.65 >= 0.50) and no violations.
        const result = computeMRS('flint_delete_node', 1, false)
        const severityFactor = result.factors.find((f) => f.name === 'severity')!
        expect(severityFactor.contribution).toBeGreaterThan(0)
    })
})

describe('V.1 MRS — factor structure is well-formed', () => {
    it('returns exactly 4 factors for any mutation tool', () => {
        for (const toolName of MUTATION_TOOL_NAMES) {
            const result = computeMRS(toolName, 1, false)
            expect(result.factors).toHaveLength(4)
        }
    })

    it('each factor has name, contribution, and description fields', () => {
        const result = computeMRS('flint_update_props', 1, false)
        for (const factor of result.factors) {
            expect(typeof factor.name).toBe('string')
            expect(factor.name.length).toBeGreaterThan(0)
            expect(typeof factor.contribution).toBe('number')
            expect(factor.contribution).toBeGreaterThanOrEqual(0)
            expect(factor.contribution).toBeLessThanOrEqual(1)
            expect(typeof factor.description).toBe('string')
        }
    })

    it('factor names are the expected four keys', () => {
        const result = computeMRS('flint_delete_node', 1, false)
        const names = result.factors.map((f) => f.name).sort()
        expect(names).toEqual(['blastRadius', 'familiarity', 'opWeight', 'severity'])
    })

    it('score is always between 0.0 and 1.0', () => {
        for (const toolName of MUTATION_TOOL_NAMES) {
            const r = computeMRS(toolName, 1, false)
            expect(r.score).toBeGreaterThanOrEqual(0.0)
            expect(r.score).toBeLessThanOrEqual(1.0)
        }
    })

    it('score is clamped to 1.0 even with extreme inputs', () => {
        // 1000 affected nodes should hit the cap.
        const result = computeMRS('flint_delete_node', 1000, true)
        expect(result.score).toBeLessThanOrEqual(1.0)
    })
})

describe('V.1 MRS — unknown tool name defaults to neutral weight', () => {
    it('unknown tool gets MRS_UNKNOWN_OP_WEIGHT (0.50)', () => {
        const result = computeMRS('flint_unknown_tool', 1, false)
        const opFactor = result.factors.find((f) => f.name === 'opWeight')!
        // opWeightRaw is 0.50 → contribution = mrsClamped(0.50 × 0.40) = 0.2
        expect(opFactor.contribution).toBeCloseTo(0.20, 3)
    })
})

describe('V.1 MRS — chunk type field is always tool_call', () => {
    it('mutation tool chunk type remains tool_call after MRS annotation', () => {
        const chunk = simulateChunkEmission('flint_update_props')
        expect(chunk.type).toBe('tool_call')
    })

    it('read-only tool chunk type is tool_call with no risk fields', () => {
        const chunk = simulateChunkEmission('flint_read_code')
        expect(chunk.type).toBe('tool_call')
        expect(chunk.riskTier).toBeUndefined()
    })
})
