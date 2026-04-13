/**
 * visualRegressionStub.test.ts — Phase P7: Visual Regression MCP Stub
 *
 * The MCP server is headless and cannot render components. This stub:
 *   - Returns an advisory LinterWarning when no Glass bridge is registered
 *   - Delegates to the Glass bridge when one is available
 *   - Never throws — surfaces errors via the `error` field
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
    VISUAL_REG_RULE_ID,
    VISUAL_REG_WARNING_TYPE,
    registerGlassBridge,
    resetGlassBridgeForTests,
    isGlassAvailable,
    runVisualRegressionAudit,
    runVisualRegressionForLinter,
    buildGlassUnavailableAdvisory,
    violationToLinterWarning,
    type GlassVisualBridge,
    type VisualRegressionInput,
    type VisualRegressionViolation,
} from '../visualRegressionStub.js'

const sampleInput: VisualRegressionInput = {
    componentCode: 'export default function C() { return null }',
    componentName: 'C',
    expectedBoxes: [{ flintId: 'a', width: 100, height: 50, x: 0, y: 0 }],
}

beforeEach(() => {
    resetGlassBridgeForTests()
})

describe('visualRegressionStub', () => {

    it('exports stable rule ID and warning type constants', () => {
        expect(VISUAL_REG_RULE_ID).toBe('VISUAL-REG-001')
        expect(VISUAL_REG_WARNING_TYPE).toBe('visual-regression')
    })

    it('returns degraded ok:false + ranInGlass=false when no bridge registered (Sprint 1 R10)', async () => {
        expect(isGlassAvailable()).toBe(false)
        const result = await runVisualRegressionAudit(sampleInput)
        // Sprint 1 R10 — no silent green. Unregistered bridge is a degraded
        // result so CI / MCP consumers can surface the skip explicitly.
        expect(result.ok).toBe(false)
        expect(result.degraded).toBe(true)
        expect(result.violations).toEqual([])
        expect(result.ranInGlass).toBe(false)
        expect(result.error).toBe('Glass bridge unavailable')
    })

    it('runVisualRegressionForLinter returns advisory when Glass unavailable', async () => {
        const warnings = await runVisualRegressionForLinter(sampleInput)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].ruleId).toBe('VISUAL-REG-001')
        expect(warnings[0].type).toBe('visual-regression')
        expect(warnings[0].severity).toBe('advisory')
        expect(warnings[0].message).toContain('Flint Glass')
        expect(warnings[0].fixable).toBe(false)
        expect(warnings[0].explanation).toContain('VISUAL-REG-001')
        expect(warnings[0].recovery).toContain('Flint Glass')
    })

    it('delegates to a registered Glass bridge and returns its result', async () => {
        const fakeViolation: VisualRegressionViolation = {
            flintId: 'btn-1',
            ruleId: 'VISUAL-REG-001',
            message: 'Width drift',
            expected: { width: 100, height: 40 },
            actual: { width: 140, height: 40 },
            deltaPx: 40,
            suggestion: 'Add `overflow-hidden`',
        }
        const bridge: GlassVisualBridge = async () => ({
            ok: false,
            violations: [fakeViolation],
            error: null,
        })
        registerGlassBridge(bridge)

        expect(isGlassAvailable()).toBe(true)
        const result = await runVisualRegressionAudit(sampleInput)
        expect(result.ranInGlass).toBe(true)
        expect(result.ok).toBe(false)
        expect(result.violations).toEqual([fakeViolation])
    })

    it('runVisualRegressionForLinter maps Glass violations to LinterWarnings', async () => {
        const bridge: GlassVisualBridge = async () => ({
            ok: false,
            violations: [
                {
                    flintId: 'card-2',
                    ruleId: 'VISUAL-REG-001',
                    message: 'Visual regression on "card-2": expected 300×200 got 250×200.',
                    expected: { width: 300, height: 200 },
                    actual: { width: 250, height: 200 },
                    deltaPx: 50,
                    suggestion: 'Add `flex-shrink-0`.',
                },
            ],
            error: null,
        })
        registerGlassBridge(bridge)

        const warnings = await runVisualRegressionForLinter(sampleInput)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].type).toBe('visual-regression')
        expect(warnings[0].ruleId).toBe('VISUAL-REG-001')
        expect(warnings[0].value).toBe(50)
        expect(warnings[0].message).toContain('flex-shrink-0')
    })

    it('surfaces Glass bridge throws as error field without propagating', async () => {
        const bridge: GlassVisualBridge = async () => { throw new Error('boom') }
        registerGlassBridge(bridge)

        const result = await runVisualRegressionAudit(sampleInput)
        expect(result.ranInGlass).toBe(true)
        expect(result.ok).toBe(false)
        expect(result.error).toContain('boom')
        expect(result.violations).toEqual([])
    })

    it('runVisualRegressionForLinter surfaces bridge errors as advisory warnings', async () => {
        const bridge: GlassVisualBridge = async () => ({
            ok: false,
            violations: [],
            error: 'render timeout',
        })
        registerGlassBridge(bridge)

        const warnings = await runVisualRegressionForLinter(sampleInput)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].message).toContain('render timeout')
        expect(warnings[0].severity).toBe('advisory')
    })

    it('buildGlassUnavailableAdvisory produces a valid LinterWarning shape', () => {
        const w = buildGlassUnavailableAdvisory()
        expect(w.ruleId).toBe('VISUAL-REG-001')
        expect(w.type).toBe('visual-regression')
        expect(w.severity).toBe('advisory')
        expect(w.fixable).toBe(false)
        expect(w.nearestToken).toBeNull()
    })

    it('violationToLinterWarning appends suggestion to the message when present', () => {
        const w = violationToLinterWarning({
            flintId: 'x',
            ruleId: 'VISUAL-REG-001',
            message: 'Drift detected.',
            expected: { width: 10, height: 10 },
            actual: { width: 20, height: 10 },
            deltaPx: 10,
            suggestion: 'Try `flex-none`.',
        })
        expect(w.message).toContain('Drift detected.')
        expect(w.message).toContain('Try `flex-none`.')
    })

    it('registerGlassBridge(null) clears the bridge and reverts to advisory', async () => {
        registerGlassBridge(async () => ({ ok: true, violations: [], error: null }))
        expect(isGlassAvailable()).toBe(true)
        registerGlassBridge(null)
        expect(isGlassAvailable()).toBe(false)
        const result = await runVisualRegressionAudit(sampleInput)
        expect(result.ranInGlass).toBe(false)
    })
})
