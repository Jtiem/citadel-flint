/**
 * Sprint 1 Governor Fixes — consolidated Phase 2 acceptance tests.
 *
 * Covers Group A service/logic fixes owned by `coder`:
 *   - tailwindVersionResolver empty-root guard
 *   - visualRegressionStub degraded/ok:false on unregistered bridge
 *   - healthcare dynamic a11y rule enumeration (A11Y-011..050)
 *   - government escalation cascade (inherits healthcare fix)
 *   - MithrilLinter R1 Assert+Defer one-shot warning for MITHRIL-SPC-TOUCH
 *
 * Contract: .flint-context/contracts/sprint-1-governor-fixes.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'

import { resolveTailwindVersion } from '../tailwindVersionResolver.js'
import {
    runVisualRegressionAudit,
    runVisualRegressionForLinter,
    registerGlassBridge,
    resetGlassBridgeForTests,
    VISUAL_REG_WARNING_TYPE,
} from '../visualRegressionStub.js'
import { applyHealthcareEscalation } from '../domains/healthcare.js'
import { applyGovernmentEscalation } from '../domains/government.js'
import { DEFAULT_RESOLVED_POLICY } from '../policyEngine.js'
import type { ResolvedPolicy } from '../policyEngine.js'
import { auditAll, __resetDeferredWarningState } from '../MithrilLinter.js'

// ─── tailwindVersionResolver empty-root guard ─────────────────────────────

describe('tailwindVersionResolver — empty-root guard (R7)', () => {
    it('returns null for empty-string projectRoot', () => {
        expect(resolveTailwindVersion('')).toBeNull()
    })

    it('returns null for undefined projectRoot (cast)', () => {
        expect(resolveTailwindVersion(undefined as unknown as string)).toBeNull()
    })
})

// ─── visualRegressionStub degraded path ──────────────────────────────────

describe('visualRegressionStub — degraded path (R10)', () => {
    beforeEach(() => {
        resetGlassBridgeForTests()
    })
    afterEach(() => {
        resetGlassBridgeForTests()
    })

    const input = {
        componentCode: '<div />',
        componentName: 'X',
        expectedBoxes: [],
    }

    it('returns ok:false, degraded:true when no Glass bridge is registered', async () => {
        const res = await runVisualRegressionAudit(input)
        expect(res.ok).toBe(false)
        expect(res.degraded).toBe(true)
        expect(res.ranInGlass).toBe(false)
        expect(res.error).toBe('Glass bridge unavailable')
    })

    it('returns ok:true, ranInGlass:true when Glass bridge is registered', async () => {
        registerGlassBridge(async () => ({ ok: true, violations: [], error: null }))
        const res = await runVisualRegressionAudit(input)
        expect(res.ok).toBe(true)
        expect(res.ranInGlass).toBe(true)
        expect(res.degraded).toBeUndefined()
    })

    it('runVisualRegressionForLinter still emits exactly one advisory when degraded', async () => {
        const warnings = await runVisualRegressionForLinter(input)
        expect(warnings).toHaveLength(1)
        expect(warnings[0]!.type).toBe(VISUAL_REG_WARNING_TYPE)
        expect(warnings[0]!.severity).toBe('advisory')
    })
})

// ─── healthcare dynamic a11y enumeration ──────────────────────────────────

function policyWithA11yRules(rules: Record<string, 'blocking' | 'advisory' | 'off'>): ResolvedPolicy {
    return {
        ...DEFAULT_RESOLVED_POLICY,
        a11y: {
            ...DEFAULT_RESOLVED_POLICY.a11y,
            rules,
        },
    }
}

describe('healthcare.applyHealthcareEscalation — dynamic a11y enumeration (R11)', () => {
    it('escalates all A11Y rules (including A11Y-011+) to blocking, not just A11Y-001..010', () => {
        // Seed the policy with 20 advisory rules across the full A11Y-* range,
        // including rules OUTSIDE the legacy 001-010 block — the whole point
        // of the fix is that A11Y-015, A11Y-030, A11Y-045 no longer silently
        // stay advisory.
        const seeded: Record<string, 'blocking' | 'advisory' | 'off'> = {}
        const ids = [
            'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005',
            'A11Y-010', 'A11Y-011', 'A11Y-015', 'A11Y-020', 'A11Y-021',
            'A11Y-025', 'A11Y-030', 'A11Y-033', 'A11Y-035', 'A11Y-040',
            'A11Y-042', 'A11Y-045', 'A11Y-047', 'A11Y-049', 'A11Y-050',
        ]
        for (const id of ids) seeded[id] = 'advisory'

        const escalated = applyHealthcareEscalation(policyWithA11yRules(seeded))

        for (const id of ids) {
            expect(escalated.a11y.rules[id]).toBe('blocking')
        }
        // Specifically — the three rules that used to be silently downgraded.
        expect(escalated.a11y.rules['A11Y-015']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-030']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-045']).toBe('blocking')
    })

    it('preserves explicit "off" overrides — does not re-enable disabled rules', () => {
        const seeded: Record<string, 'blocking' | 'advisory' | 'off'> = {
            'A11Y-001': 'advisory',
            'A11Y-015': 'off',
        }
        const escalated = applyHealthcareEscalation(policyWithA11yRules(seeded))
        expect(escalated.a11y.rules['A11Y-001']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-015']).toBe('off')
    })

    it('zero a11y rules → top-level blocking mode, no crash, empty rules is fine', () => {
        const escalated = applyHealthcareEscalation(policyWithA11yRules({}))
        expect(escalated.a11y.mode).toBe('blocking')
        // Escalation may add registry-sourced rules; we only assert no crash
        // and that the resulting shape is valid.
        expect(typeof escalated.a11y.rules).toBe('object')
    })

    it('government cascade inherits the dynamic enumeration (A11Y-015/030/045 blocking)', () => {
        const seeded: Record<string, 'blocking' | 'advisory' | 'off'> = {
            'A11Y-001': 'advisory',
            'A11Y-015': 'advisory',
            'A11Y-030': 'advisory',
            'A11Y-045': 'advisory',
        }
        const escalated = applyGovernmentEscalation(policyWithA11yRules(seeded))
        expect(escalated.a11y.rules['A11Y-001']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-015']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-030']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-045']).toBe('blocking')
    })
})

// ─── MithrilLinter R1 Assert+Defer deferred-rule warning ──────────────────

function tinyAst(): File {
    return parse('const x = 1;', { sourceType: 'module', plugins: ['jsx', 'typescript'] }) as unknown as File
}

describe('MithrilLinter — R1 Assert+Defer deferred-rule warning (R15)', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>
    const origEnv = process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS

    beforeEach(() => {
        __resetDeferredWarningState()
        delete process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
        warnSpy.mockRestore()
        if (origEnv === undefined) {
            delete process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS
        } else {
            process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS = origEnv
        }
        __resetDeferredWarningState()
    })

    function invokeWithTouchRule() {
        return auditAll(tinyAst(), [], {
            ruleModes: { 'MITHRIL-SPC-TOUCH': 'blocking' },
        })
    }

    it('first invocation logs exactly one deferred-rule warning for MITHRIL-SPC-TOUCH', () => {
        invokeWithTouchRule()
        const calls = warnSpy.mock.calls.filter((c) =>
            String(c[0] ?? '').includes('MITHRIL-SPC-TOUCH'),
        )
        expect(calls).toHaveLength(1)
        expect(String(calls[0]![0])).toContain('deferred to Mithril expansion sprint')
        expect(String(calls[0]![0])).toContain('no visitor registered')
    })

    it('second invocation emits zero additional warnings (once-per-process guard)', () => {
        invokeWithTouchRule()
        invokeWithTouchRule()
        invokeWithTouchRule()
        const calls = warnSpy.mock.calls.filter((c) =>
            String(c[0] ?? '').includes('MITHRIL-SPC-TOUCH'),
        )
        expect(calls).toHaveLength(1)
    })

    it('FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS=1 silences the warning', () => {
        process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS = '1'
        invokeWithTouchRule()
        const calls = warnSpy.mock.calls.filter((c) =>
            String(c[0] ?? '').includes('MITHRIL-SPC-TOUCH'),
        )
        expect(calls).toHaveLength(0)
    })

    it('__resetDeferredWarningState() re-arms the one-shot emit', () => {
        invokeWithTouchRule()
        __resetDeferredWarningState()
        invokeWithTouchRule()
        const calls = warnSpy.mock.calls.filter((c) =>
            String(c[0] ?? '').includes('MITHRIL-SPC-TOUCH'),
        )
        expect(calls).toHaveLength(2)
    })

    it('rule mode "off" does NOT trigger the deferred warning', () => {
        auditAll(tinyAst(), [], {
            ruleModes: { 'MITHRIL-SPC-TOUCH': 'off' },
        })
        const calls = warnSpy.mock.calls.filter((c) =>
            String(c[0] ?? '').includes('MITHRIL-SPC-TOUCH'),
        )
        expect(calls).toHaveLength(0)
    })
})
