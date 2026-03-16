/**
 * Tests for ARIA rules (A11Y-030 through A11Y-038)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { ariaRules } from '../rules/aria.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(ariaRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-030: Valid role ──────────────────────────────────────────────────────

describe('A11Y-030: valid ARIA role', () => {
    it('flags invalid role', () => {
        const ast = parseJSX(`const C = () => <div role="invalid-role">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-030')).toBe(true)
    })

    it('passes with valid role', () => {
        const ast = parseJSX(`const C = () => <div role="button">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-030')).toHaveLength(0)
    })

    it('passes without role', () => {
        const ast = parseJSX(`const C = () => <div>content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-030')).toHaveLength(0)
    })

    it('auto-fix removes invalid role', () => {
        const ast = parseJSX(`const C = () => <div role="bad-role">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-030')!
        const rule = ariaRules.find((r) => r.id === 'A11Y-030')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'role', value: null },
        })
    })

    it('handles dynamic role (no false positive)', () => {
        const ast = parseJSX(`const C = ({ role }) => <div role={role}>content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-030')).toHaveLength(0)
    })
})

// ── A11Y-033: Required ARIA attributes ───────────────────────────────────────

describe('A11Y-033: required ARIA attributes', () => {
    it('flags checkbox without aria-checked', () => {
        const ast = parseJSX(`const C = () => <div role="checkbox">check</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-033')).toBe(true)
    })

    it('passes checkbox with aria-checked', () => {
        const ast = parseJSX(`const C = () => <div role="checkbox" aria-checked="false">check</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-033')).toHaveLength(0)
    })

    it('auto-fix adds required attribute with default value', () => {
        const ast = parseJSX(`const C = () => <div role="checkbox">check</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-033')!
        const rule = ariaRules.find((r) => r.id === 'A11Y-033')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations).toContainEqual(
            expect.objectContaining({
                type: 'updateProp',
                args: expect.objectContaining({ propName: 'aria-checked', value: 'false' }),
            }),
        )
    })
})

// ── A11Y-034: Valid ARIA attribute names ──────────────────────────────────────

describe('A11Y-034: valid ARIA attribute names', () => {
    it('flags typo aria-lable', () => {
        const ast = parseJSX(`const C = () => <div aria-lable="hello">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-034')).toBe(true)
    })

    it('passes with valid aria-label', () => {
        const ast = parseJSX(`const C = () => <div aria-label="hello">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-034')).toHaveLength(0)
    })

    it('auto-fix removes invalid attr', () => {
        const ast = parseJSX(`const C = () => <div aria-lable="x">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-034')!
        const rule = ariaRules.find((r) => r.id === 'A11Y-034')!
        const fix = rule.fix!(v, ast as any)
        expect(fix).not.toBeNull()
        expect(fix!.mutations[0].type).toBe('updateProp')
    })

    it('edge case: does not flag non-aria attributes', () => {
        const ast = parseJSX(`const C = () => <div data-bridge-id="x" className="a">content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-034')).toHaveLength(0)
    })
})

// ── A11Y-036: aria-hidden on focusable ───────────────────────────────────────

describe('A11Y-036: aria-hidden on focusable element', () => {
    it('flags button with aria-hidden="true"', () => {
        const ast = parseJSX(`const C = () => <button aria-hidden="true">Click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-036')).toBe(true)
    })

    it('passes div with aria-hidden="true"', () => {
        const ast = parseJSX(`const C = () => <div aria-hidden="true">decorative</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-036')).toHaveLength(0)
    })

    it('passes button with tabIndex={-1} and aria-hidden (removed from flow)', () => {
        const ast = parseJSX(`const C = () => <button aria-hidden="true" tabIndex={-1}>x</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-036')).toHaveLength(0)
    })

    it('auto-fix removes aria-hidden', () => {
        const ast = parseJSX(`const C = () => <button aria-hidden="true">Click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-036')!
        const rule = ariaRules.find((r) => r.id === 'A11Y-036')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'aria-hidden', value: null },
        })
    })
})

// ── A11Y-038: interactive elements must not have presentation role ────────────

describe('A11Y-038: interactive element with presentation role', () => {
    it('flags input with role="presentation"', () => {
        const ast = parseJSX(`const C = () => <input role="presentation" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-038')).toBe(true)
    })

    it('passes input without role', () => {
        const ast = parseJSX(`const C = () => <input aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-038')).toHaveLength(0)
    })

    it('auto-fix removes role', () => {
        const ast = parseJSX(`const C = () => <input role="none" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-038')!
        const rule = ariaRules.find((r) => r.id === 'A11Y-038')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'role', value: null },
        })
    })

    it('passes div with role="presentation" (not interactive)', () => {
        const ast = parseJSX(`const C = () => <div role="presentation">spacer</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-038')).toHaveLength(0)
    })
})
