/**
 * Tests for Mutation Planner — flint-mcp/src/core/__tests__/mutationPlanner.test.ts
 *
 * Phase P0: Closed-Loop Auto-Fix Remediation
 *
 * Covers:
 *   - Color drift with nearestToken → deterministic
 *   - Color drift without nearestToken → semantic
 *   - A11y auto-fixable rule → deterministic
 *   - A11y non-auto-fixable rule → semantic
 *   - High MRS score → riskGated
 *   - Low MRS score → stays deterministic
 *   - Mixed batch produces correct split
 *   - Empty violations → empty plan
 *   - Risk threshold override works
 *   - Structural element swap → riskGated regardless of score
 *   - Typography drift with nearestToken → deterministic
 *   - Spacing drift without nearestToken → semantic
 *   - Sync violations → semantic
 *   - Plan summary generation
 */

import { describe, it, expect } from 'vitest'
import { planMutations, summarizePlan } from '../mutationPlanner.js'
import type { MutationPlan } from '../mutationPlanner.js'
import type { LinterWarning, DesignToken } from '../../types.js'

// ── Test fixtures ──────────────────────────────────────────────────────────

const SAMPLE_TOKENS: DesignToken[] = [
    {
        id: 1,
        token_path: 'color/error/500',
        token_type: 'color',
        token_value: '#FF0000',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 2,
        token_path: 'spacing/md',
        token_type: 'dimension',
        token_value: '16px',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
]

function makeWarning(overrides: Partial<LinterWarning> & { id: string }): LinterWarning {
    return {
        type: 'color-drift',
        severity: 'amber',
        value: 5,
        message: 'Test violation',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('planMutations', () => {
    it('classifies color drift WITH nearestToken as deterministic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'col-1',
                type: 'color-drift',
                nearestToken: 'color/error/500',
                nearestTokenValue: '#FF0000',
                value: 3.5,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(1)
        expect(plan.semantic.length).toBe(0)
        expect(plan.deterministic[0].classification).toBe('deterministic')
        expect(plan.deterministic[0].proposedFix?.type).toBe('fixToken')
        expect(plan.deterministic[0].proposedFix?.params.targetToken).toBe('color/error/500')
    })

    it('classifies color drift WITHOUT nearestToken as semantic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'col-2',
                type: 'color-drift',
                nearestToken: null,
                value: 15,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(0)
        expect(plan.semantic.length).toBe(1)
        expect(plan.semantic[0].classification).toBe('semantic')
        expect(plan.semantic[0].semanticHint).toContain('No matching design token')
    })

    it('classifies a11y fixable rule as deterministic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'a11y-1',
                type: 'a11y',
                fixable: true,
                ruleId: 'A11Y-001',
                message: 'Image missing alt text',
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(1)
        expect(plan.semantic.length).toBe(0)
        expect(plan.deterministic[0].classification).toBe('deterministic')
        expect(plan.deterministic[0].proposedFix?.type).toBe('updateProp')
    })

    it('classifies a11y non-fixable rule as semantic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'a11y-2',
                type: 'a11y',
                fixable: false,
                ruleId: 'A11Y-HEADING-ORDER',
                message: 'Heading hierarchy skips levels',
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(0)
        expect(plan.semantic.length).toBe(1)
        expect(plan.semantic[0].classification).toBe('semantic')
    })

    it('moves high MRS score deterministic fix to riskGated', async () => {
        // Use a very low risk threshold (1 on 0-100 scale) so the default
        // fixToken MRS score exceeds it.
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'col-high',
                type: 'color-drift',
                nearestToken: 'color/error/500',
                nearestTokenValue: '#FF0000',
                value: 3,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS, {
            riskThreshold: 1, // Very low: 0.01 on MRS scale — almost everything goes to riskGated
        })

        expect(plan.riskGated.length).toBe(1)
        expect(plan.deterministic.length).toBe(0)
        expect(plan.riskGated[0].riskScore).toBeDefined()
        expect(plan.riskGated[0].riskScore!.score).toBeGreaterThan(0)
    })

    it('keeps low MRS score as deterministic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'col-low',
                type: 'color-drift',
                nearestToken: 'color/error/500',
                nearestTokenValue: '#FF0000',
                value: 2,
            }),
        ]

        // Default threshold is 50 (0.50 on MRS scale).
        // fixToken has a base op weight of 0.1, so total MRS is well below 0.50.
        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(1)
        expect(plan.riskGated.length).toBe(0)
        expect(plan.deterministic[0].riskScore).toBeDefined()
        expect(plan.deterministic[0].riskScore!.score).toBeLessThanOrEqual(0.50)
    })

    it('splits a mixed batch correctly', async () => {
        const violations: LinterWarning[] = [
            // Deterministic: color drift with token
            makeWarning({
                id: 'mix-1',
                type: 'color-drift',
                nearestToken: 'color/error/500',
                nearestTokenValue: '#FF0000',
                value: 3,
            }),
            // Semantic: a11y non-fixable
            makeWarning({
                id: 'mix-2',
                type: 'a11y',
                fixable: false,
                ruleId: 'A11Y-FOCUS',
                message: 'Focus management required',
            }),
            // Deterministic: spacing drift with token
            makeWarning({
                id: 'mix-3',
                type: 'spacing-drift',
                nearestToken: 'spacing/md',
                nearestTokenValue: '16px',
                value: 4,
            }),
            // Semantic: color drift without token
            makeWarning({
                id: 'mix-4',
                type: 'color-drift',
                nearestToken: null,
                value: 20,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(2)
        expect(plan.semantic.length).toBe(2)
        expect(plan.deterministic.map(d => d.violation.id)).toContain('mix-1')
        expect(plan.deterministic.map(d => d.violation.id)).toContain('mix-3')
        expect(plan.semantic.map(s => s.violation.id)).toContain('mix-2')
        expect(plan.semantic.map(s => s.violation.id)).toContain('mix-4')
    })

    it('returns empty plan for empty violations', async () => {
        const plan = await planMutations([], SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(0)
        expect(plan.semantic.length).toBe(0)
        expect(plan.riskGated.length).toBe(0)
    })

    it('respects risk threshold override', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'thresh-1',
                type: 'color-drift',
                nearestToken: 'color/error/500',
                nearestTokenValue: '#FF0000',
                value: 3,
            }),
        ]

        // Very high threshold: everything stays deterministic
        const planHigh = await planMutations(violations, SAMPLE_TOKENS, {
            riskThreshold: 99,
        })
        expect(planHigh.deterministic.length).toBe(1)
        expect(planHigh.riskGated.length).toBe(0)

        // Very low threshold: everything goes to riskGated
        const planLow = await planMutations(violations, SAMPLE_TOKENS, {
            riskThreshold: 1,
        })
        expect(planLow.deterministic.length).toBe(0)
        expect(planLow.riskGated.length).toBe(1)
    })

    it('routes registry violations to semantic (structural element swap)', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'reg-1',
                type: 'registry',
                message: 'Rogue <button> — use <Button> from design system',
                ruleId: 'MITHRIL-REG-001',
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.semantic.length).toBe(1)
        expect(plan.deterministic.length).toBe(0)
        expect(plan.riskGated.length).toBe(0)
        expect(plan.semantic[0].semanticHint).toContain('design system component')
    })

    it('classifies typography drift with nearestToken as deterministic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'typ-1',
                type: 'typography-drift',
                nearestToken: 'typography/body/fontSize',
                nearestTokenValue: '16px',
                value: 2,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic.length).toBe(1)
        expect(plan.deterministic[0].proposedFix?.type).toBe('fixToken')
    })

    it('classifies spacing drift without nearestToken as semantic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'spc-1',
                type: 'spacing-drift',
                nearestToken: null,
                value: 8,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.semantic.length).toBe(1)
        expect(plan.semantic[0].semanticHint).toContain('No matching design token')
    })

    it('classifies sync violations as semantic', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'sync-1',
                type: 'sync',
                message: 'Token drift: local value differs from Figma source',
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.semantic.length).toBe(1)
        expect(plan.semantic[0].semanticHint).toContain('sync')
    })

    it('attaches riskScore to deterministic fixes', async () => {
        const violations: LinterWarning[] = [
            makeWarning({
                id: 'score-1',
                type: 'color-drift',
                nearestToken: 'color/error/500',
                nearestTokenValue: '#FF0000',
                value: 3,
            }),
        ]

        const plan = await planMutations(violations, SAMPLE_TOKENS)

        expect(plan.deterministic[0].riskScore).toBeDefined()
        expect(plan.deterministic[0].riskScore!.tier).toBeDefined()
        expect(plan.deterministic[0].riskScore!.factors.length).toBeGreaterThan(0)
    })
})

describe('summarizePlan', () => {
    it('generates correct summary for mixed plan', () => {
        const plan: MutationPlan = {
            deterministic: [{ violation: makeWarning({ id: 'a' }), classification: 'deterministic', confidence: 0.9 }],
            semantic: [
                { violation: makeWarning({ id: 'b' }), classification: 'semantic', confidence: 0.5 },
                { violation: makeWarning({ id: 'c' }), classification: 'semantic', confidence: 0.5 },
            ],
            riskGated: [{ violation: makeWarning({ id: 'd' }), classification: 'deterministic', confidence: 0.8 }],
        }

        const summary = summarizePlan(plan)
        expect(summary).toContain('Fixed 1 automatically')
        expect(summary).toContain('2 semantic issues require attention')
        expect(summary).toContain('1 high-risk fix needs confirmation')
    })

    it('returns "No violations to fix." for empty plan', () => {
        const plan: MutationPlan = { deterministic: [], semantic: [], riskGated: [] }
        expect(summarizePlan(plan)).toBe('No violations to fix.')
    })
})
