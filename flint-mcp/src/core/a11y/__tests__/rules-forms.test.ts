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

// ── A11Y-074: password input should have autocomplete ────────────────────────

describe('A11Y-074: password input missing autocomplete', () => {
    it('flags password input without autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-074')).toBe(true)
    })

    it('flags password input with wrong autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" autoComplete="name" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-074')).toBe(true)
    })

    it('passes password input with current-password', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" autoComplete="current-password" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-074')).toHaveLength(0)
    })

    it('passes password input with new-password', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" autoComplete="new-password" aria-label="Confirm Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-074')).toHaveLength(0)
    })

    it('does not flag non-password inputs', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" aria-label="Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-074')).toHaveLength(0)
    })

    it('fix adds current-password autocomplete', () => {
        const ast = parseJSX(`const C = () => <input type="password" aria-label="Password" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-074')!
        const rule = formsRules.find((r) => r.id === 'A11Y-074')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('autoComplete')
        expect(fix!.mutations[0].args.value).toBe('current-password')
    })
})

// ── A11Y-075: <output> must have htmlFor or aria-live ────────────────────────

describe('A11Y-075: output element missing association', () => {
    it('flags output without htmlFor or aria-live', () => {
        const ast = parseJSX(`
            const C = () => <output>42</output>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-075')).toBe(true)
    })

    it('passes output with htmlFor', () => {
        const ast = parseJSX(`
            const C = () => <output htmlFor="range-input">42</output>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-075')).toHaveLength(0)
    })

    it('passes output with aria-live', () => {
        const ast = parseJSX(`
            const C = () => <output aria-live="polite">42</output>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-075')).toHaveLength(0)
    })

    it('fix adds aria-live="polite"', () => {
        const ast = parseJSX(`const C = () => <output>42</output>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-075')!
        const rule = formsRules.find((r) => r.id === 'A11Y-075')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('aria-live')
        expect(fix!.mutations[0].args.value).toBe('polite')
    })
})
