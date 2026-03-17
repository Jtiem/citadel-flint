/**
 * Tests for forms rules (A11Y-070 through A11Y-073)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { formsRules } from '../rules/forms.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(formsRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-070: fieldset must have legend ───────────────────────────────────────

describe('A11Y-070: fieldset must contain legend', () => {
    it('flags fieldset without legend', () => {
        const ast = parseJSX(`
            const C = () => (
                <fieldset>
                    <input type="text" aria-label="Name" />
                </fieldset>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-070')).toBe(true)
    })

    it('passes fieldset with legend', () => {
        const ast = parseJSX(`
            const C = () => (
                <fieldset>
                    <legend>Personal Info</legend>
                    <input type="text" aria-label="Name" />
                </fieldset>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-070')).toHaveLength(0)
    })

    it('auto-fix injects empty legend', () => {
        const ast = parseJSX(`
            const C = () => <fieldset><input aria-label="x" /></fieldset>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-070')!
        const rule = formsRules.find((r) => r.id === 'A11Y-070')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].type).toBe('inject')
        expect(fix!.mutations[0].args.jsxSnippet).toContain('legend')
    })

    it('skips fieldset with dynamic children (could include legend)', () => {
        const ast = parseJSX(`
            const C = ({ children }) => <fieldset>{children}</fieldset>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-070')).toHaveLength(0)
    })
})

// ── A11Y-071: required input must have aria-required ─────────────────────────

describe('A11Y-071: required input must have aria-required', () => {
    it('flags required input without aria-required', () => {
        const ast = parseJSX(`
            const C = () => <input required aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-071')).toBe(true)
    })

    it('passes required input with aria-required', () => {
        const ast = parseJSX(`
            const C = () => <input required aria-required="true" aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-071')).toHaveLength(0)
    })

    it('passes non-required input', () => {
        const ast = parseJSX(`
            const C = () => <input aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-071')).toHaveLength(0)
    })

    it('auto-fix adds aria-required="true"', () => {
        const ast = parseJSX(`const C = () => <input required aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-071')!
        const rule = formsRules.find((r) => r.id === 'A11Y-071')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'aria-required', value: 'true' },
        })
    })

    it('auto-fix on compliant input returns no violations', () => {
        const ast = parseJSX(`const C = () => <input aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-071')).toHaveLength(0)
    })
})

// ── A11Y-072: aria-invalid input must have aria-describedby ──────────────────

describe('A11Y-072: invalid input must have aria-describedby', () => {
    it('flags aria-invalid input without aria-describedby', () => {
        const ast = parseJSX(`
            const C = () => <input aria-invalid="true" aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-072')).toBe(true)
    })

    it('passes aria-invalid input with aria-describedby', () => {
        const ast = parseJSX(`
            const C = () => <input aria-invalid="true" aria-describedby="err" aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-072')).toHaveLength(0)
    })

    it('passes input without aria-invalid', () => {
        const ast = parseJSX(`const C = () => <input aria-label="Email" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-072')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`const C = () => <input aria-invalid="true" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-072')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-073: autocomplete must use valid values ──────────────────────────────

describe('A11Y-073: valid autocomplete values', () => {
    it('flags invalid autocomplete value', () => {
        const ast = parseJSX(`
            const C = () => <input autoComplete="fullname" aria-label="Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-073')).toBe(true)
    })

    it('passes valid autocomplete value', () => {
        const ast = parseJSX(`
            const C = () => <input autoComplete="name" aria-label="Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-073')).toHaveLength(0)
    })

    it('passes autocomplete="off"', () => {
        const ast = parseJSX(`const C = () => <input autoComplete="off" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-073')).toHaveLength(0)
    })

    it('auto-fix removes invalid autocomplete', () => {
        const ast = parseJSX(`const C = () => <input autoComplete="invalid-value" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-073')!
        const rule = formsRules.find((r) => r.id === 'A11Y-073')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'autoComplete', value: null },
        })
    })

    it('auto-fix on compliant input returns no violations', () => {
        const ast = parseJSX(`const C = () => <input autoComplete="email" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-073')).toHaveLength(0)
    })

    it('edge case: handles dynamic autocomplete (no false positive)', () => {
        const ast = parseJSX(`const C = ({ ac }) => <input autoComplete={ac} aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-073')).toHaveLength(0)
    })
})
