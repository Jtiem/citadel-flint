/**
 * Sprint 1 Group B tests — mutationPlanner.ts
 *
 * Covers the four changes shipped in Group B:
 *   1. dark-mode-drift classification (deterministic / semantic)
 *   2. visual-regression classification (always riskGated)
 *   3. replaceElement always routes to riskGated (ALWAYS_RISK_GATED_OPS)
 *   4. Type-aware computeDriftConfidence — typography/spacing ladder differs from color
 *   5. swapMotionToken MRS weight is real (no longer falls through to unknown-op default)
 */

import { describe, it, expect } from 'vitest'
import { planMutations } from '../mutationPlanner.js'
import type { LinterWarning, DesignToken } from '../../types.js'

// ── Shared fixtures ──────────────────────────────────────────────────────────

const NO_TOKENS: DesignToken[] = []

const SAMPLE_TOKENS: DesignToken[] = [
    {
        id: 1,
        token_path: 'color/surface/dark',
        token_type: 'color',
        token_value: '#1A1A1A',
        description: null,
        collection_name: 'default',
        mode: 'dark',
    },
]

function makeWarning(overrides: Partial<LinterWarning>): LinterWarning {
    return {
        id: 'test-id',
        type: 'color-drift',
        severity: 'amber',
        value: 1,
        message: 'test violation',
        nearestToken: null,
        nearestTokenValue: null,
        ruleId: undefined,
        fixable: false,
        recovery: undefined,
        ...overrides,
    } as LinterWarning
}

// ── 1. dark-mode-drift classification ────────────────────────────────────────

describe('dark-mode-drift classification', () => {
    it('with nearestToken + fixable:true → deterministic, confidence >= 0.8', async () => {
        const warning = makeWarning({
            id: 'dark-1',
            type: 'dark-mode-drift',
            nearestToken: 'color.surface',
            nearestTokenValue: '#1A1A1A',
            fixable: true,
            value: 1,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })

        // riskThreshold=100 → no MRS gating; deterministic items stay deterministic
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet.length).toBe(1)
        expect(plan.semantic.length).toBe(0)
        expect(allDet[0].confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('with nearestToken + fixable:true → proposedFix.type is swapMotionToken', async () => {
        const warning = makeWarning({
            id: 'dark-2',
            type: 'dark-mode-drift',
            nearestToken: 'color.surface',
            fixable: true,
            value: 1,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet[0].proposedFix?.type).toBe('swapMotionToken')
    })

    it('without nearestToken → semantic, confidence 0.5', async () => {
        const warning = makeWarning({
            id: 'dark-3',
            type: 'dark-mode-drift',
            nearestToken: null,
            fixable: false,
            value: 1,
        })

        const plan = await planMutations([warning], NO_TOKENS)

        expect(plan.semantic.length).toBe(1)
        expect(plan.deterministic.length).toBe(0)
        expect(plan.riskGated.length).toBe(0)
        expect(plan.semantic[0].confidence).toBe(0.5)
    })

    it('with nearestToken but fixable:false → semantic (not deterministic)', async () => {
        const warning = makeWarning({
            id: 'dark-4',
            type: 'dark-mode-drift',
            nearestToken: 'color.surface',
            fixable: false,
            value: 1,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS)

        expect(plan.semantic.length).toBe(1)
        expect(plan.deterministic.length).toBe(0)
        expect(plan.riskGated.length).toBe(0)
    })
})

// ── 2. visual-regression classification ──────────────────────────────────────

describe('visual-regression classification', () => {
    it('always routes to riskGated regardless of riskThreshold', async () => {
        const warning = makeWarning({
            id: 'vr-1',
            type: 'visual-regression',
            fixable: false,
            value: 1,
        })

        // Even with threshold=100 (never gate on MRS), replaceElement is in
        // ALWAYS_RISK_GATED_OPS so it must end up in riskGated
        const plan = await planMutations([warning], NO_TOKENS, { riskThreshold: 100 })

        expect(plan.riskGated.length).toBe(1)
        expect(plan.deterministic.length).toBe(0)
        expect(plan.semantic.length).toBe(0)
    })

    it('visual-regression riskGated item has confidence 0.6', async () => {
        const warning = makeWarning({
            id: 'vr-2',
            type: 'visual-regression',
            value: 1,
        })

        const plan = await planMutations([warning], NO_TOKENS, { riskThreshold: 100 })
        expect(plan.riskGated[0].confidence).toBe(0.6)
    })

    it('visual-regression item includes a semanticHint about human review', async () => {
        const warning = makeWarning({
            id: 'vr-3',
            type: 'visual-regression',
            value: 1,
        })

        const plan = await planMutations([warning], NO_TOKENS, { riskThreshold: 100 })
        expect(plan.riskGated[0].semanticHint).toBeTruthy()
        expect(plan.riskGated[0].semanticHint).toMatch(/human|review|diff/i)
    })
})

// ── 3. replaceElement always routes to riskGated ──────────────────────────────

describe('replaceElement always riskGated via ALWAYS_RISK_GATED_OPS', () => {
    it('registry violation with prop mapping → riskGated even at very low threshold', async () => {
        // MITHRIL-REG-001 with prop mapping produces opType 'replaceElement'
        const warning = makeWarning({
            id: 'reg-1',
            type: 'registry',
            ruleId: 'MITHRIL-REG-001',
            message: 'Use Button instead of <button>. Prop mapping: onClick→onClick',
            fixable: true,
            value: 1,
        })

        // riskThreshold=0 means everything deterministic goes to riskGated on MRS;
        // BUT replaceElement must go there unconditionally via ALWAYS_RISK_GATED_OPS
        const plan = await planMutations([warning], NO_TOKENS, { riskThreshold: 100 })

        expect(plan.riskGated.length).toBe(1)
        expect(plan.deterministic.length).toBe(0)
    })

    it('proposedFix.type is replaceElement for registry with prop mapping', async () => {
        const warning = makeWarning({
            id: 'reg-2',
            type: 'registry',
            ruleId: 'MITHRIL-REG-001',
            message: 'Use Button instead of <button>. Prop mapping: onClick→onClick',
            value: 1,
        })

        const plan = await planMutations([warning], NO_TOKENS, { riskThreshold: 100 })
        expect(plan.riskGated[0].proposedFix?.type).toBe('replaceElement')
    })
})

// ── 4. Type-aware computeDriftConfidence ──────────────────────────────────────

describe('computeDriftConfidence — type-aware ladder', () => {
    it('typography-drift with delta=2 returns 0.88 (px ladder), not 0.98 (color ΔE)', async () => {
        const warning = makeWarning({
            id: 'typo-1',
            type: 'typography-drift',
            nearestToken: 'typography/body/size',
            value: 2, // delta = 2px
            fixable: true,
        })

        // riskThreshold=100 keeps it in deterministic (not riskGated by MRS)
        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet[0].confidence).toBe(0.88)
    })

    it('color-drift with delta=2 returns 0.98 (color ΔE ladder)', async () => {
        const warning = makeWarning({
            id: 'color-1',
            type: 'color-drift',
            nearestToken: 'color/error/500',
            value: 2, // ΔE = 2
            fixable: true,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet[0].confidence).toBe(0.98)
    })

    it('typography-drift and color-drift at delta=2 produce distinct confidence values', async () => {
        const typWarning = makeWarning({
            id: 'typ-conf',
            type: 'typography-drift',
            nearestToken: 'typography/body/size',
            value: 2,
            fixable: true,
        })
        const colorWarning = makeWarning({
            id: 'col-conf',
            type: 'color-drift',
            nearestToken: 'color/error/500',
            value: 2,
            fixable: true,
        })

        const planTyp = await planMutations([typWarning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const planColor = await planMutations([colorWarning], SAMPLE_TOKENS, { riskThreshold: 100 })

        const typConf = [...planTyp.deterministic, ...planTyp.riskGated][0].confidence
        const colorConf = [...planColor.deterministic, ...planColor.riskGated][0].confidence

        expect(typConf).not.toBe(colorConf)
    })

    it('spacing-drift with delta=8 returns 0.78 (px ladder)', async () => {
        const warning = makeWarning({
            id: 'space-1',
            type: 'spacing-drift',
            nearestToken: 'spacing/md',
            value: 8,
            fixable: true,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet[0].confidence).toBe(0.78)
    })

    it('typography-drift with delta=20 returns 0.6 (off the scale)', async () => {
        const warning = makeWarning({
            id: 'typo-big',
            type: 'typography-drift',
            nearestToken: 'typography/display/size',
            value: 20,
            fixable: true,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet[0].confidence).toBe(0.6)
    })

    it('shadow-drift returns flat 0.6 regardless of delta', async () => {
        const lowDelta = makeWarning({
            id: 'shadow-low',
            type: 'shadow-drift',
            nearestToken: 'shadow/sm',
            value: 1,
            fixable: true,
        })
        const highDelta = makeWarning({
            id: 'shadow-high',
            type: 'shadow-drift',
            nearestToken: 'shadow/lg',
            value: 50,
            fixable: true,
        })

        const planLow = await planMutations([lowDelta], SAMPLE_TOKENS, { riskThreshold: 100 })
        const planHigh = await planMutations([highDelta], SAMPLE_TOKENS, { riskThreshold: 100 })

        const confLow = [...planLow.deterministic, ...planLow.riskGated][0].confidence
        const confHigh = [...planHigh.deterministic, ...planHigh.riskGated][0].confidence

        expect(confLow).toBe(0.6)
        expect(confHigh).toBe(0.6)
    })

    it('dark-mode-drift confidence is 0.85 when nearestToken present (deterministic path)', async () => {
        const warning = makeWarning({
            id: 'dark-conf',
            type: 'dark-mode-drift',
            nearestToken: 'color.surface',
            value: 1,
            fixable: true,
        })

        const plan = await planMutations([warning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet[0].confidence).toBe(0.85)
    })
})

// ── 5. swapMotionToken has real MRS weight ────────────────────────────────────

describe('swapMotionToken MRS weight is wired through', () => {
    it('motion-drift with nearestToken scores lower than unknown op (proves weight=0.4 not 0.5)', async () => {
        // swapMotionToken (weight 0.4) should produce a lower MRS opWeight than
        // unknown op (default weight 0.5). We verify via the riskScore factor.
        const motionWarning = makeWarning({
            id: 'motion-mrs',
            type: 'motion-drift',
            nearestToken: 'motion/duration/fast',
            value: 1,
            fixable: true,
        })

        // riskThreshold=100 keeps it deterministic so riskScore is populated
        const plan = await planMutations([motionWarning], SAMPLE_TOKENS, { riskThreshold: 100 })
        const allDet = [...plan.deterministic, ...plan.riskGated]
        expect(allDet.length).toBe(1)

        const riskScore = allDet[0].riskScore
        expect(riskScore).toBeDefined()

        const opFactor = riskScore!.factors.find((f) => f.name === 'opWeight')!
        // swapMotionToken: 0.4 × 0.40 = 0.16
        // unknown-op:      0.5 × 0.40 = 0.20
        // swapMotionToken opWeight contribution must be less than unknown's 0.20
        expect(opFactor.contribution).toBeLessThan(0.20)
        expect(opFactor.contribution).toBeCloseTo(0.16, 4)
    })

    it('motion-drift without nearestToken → semantic (no MRS computed)', async () => {
        const warning = makeWarning({
            id: 'motion-no-token',
            type: 'motion-drift',
            nearestToken: null,
            fixable: false,
            value: 1,
        })

        const plan = await planMutations([warning], NO_TOKENS)
        expect(plan.semantic.length).toBe(1)
        expect(plan.semantic[0].riskScore).toBeUndefined()
    })
})
