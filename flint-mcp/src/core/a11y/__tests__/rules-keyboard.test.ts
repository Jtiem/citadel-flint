/**
 * Tests for keyboard rules (A11Y-007, A11Y-020, A11Y-021, A11Y-022)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { keyboardRules } from '../rules/keyboard.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(keyboardRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-007: positive tabIndex ───────────────────────────────────────────────

describe('A11Y-007: positive tabIndex', () => {
    it('flags tabIndex > 0', () => {
        const ast = parseJSX(`const C = () => <div tabIndex={3}>focus</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-007')).toBe(true)
    })

    it('passes tabIndex={0}', () => {
        const ast = parseJSX(`const C = () => <div tabIndex={0}>focus</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-007')).toHaveLength(0)
    })

    it('passes tabIndex={-1}', () => {
        const ast = parseJSX(`const C = () => <div tabIndex={-1}>focus</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-007')).toHaveLength(0)
    })

    it('auto-fix sets tabIndex to "0"', () => {
        const ast = parseJSX(`const C = () => <div tabIndex={5}>focus</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-007')!
        const rule = keyboardRules.find((r) => r.id === 'A11Y-007')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'tabIndex', value: '0' },
        })
    })

    it('auto-fix on compliant element returns no violations', () => {
        const ast = parseJSX(`const C = () => <div tabIndex={0}>focus</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-007')).toHaveLength(0)
    })

    it('handles string tabIndex="2"', () => {
        const ast = parseJSX(`const C = () => <div tabIndex="2">focus</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-007')).toBe(true)
    })
})

// ── A11Y-020: non-interactive with click ──────────────────────────────────────

describe('A11Y-020: non-interactive element with onClick', () => {
    it('flags div with onClick but no role/tabIndex/onKeyDown', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}}>click</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-020')).toBe(true)
    })

    it('passes div with onClick, role, tabIndex, onKeyDown', () => {
        const ast = parseJSX(`
            const C = () => (
                <div
                    onClick={() => {}}
                    role="button"
                    tabIndex={0}
                    onKeyDown={() => {}}
                >
                    click
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-020')).toHaveLength(0)
    })

    it('does not flag <button> with onClick (natively interactive)', () => {
        const ast = parseJSX(`const C = () => <button onClick={() => {}}>click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-020')).toHaveLength(0)
    })

    it('auto-fix adds role="button" and tabIndex="0"', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}}>click</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-020')!
        const rule = keyboardRules.find((r) => r.id === 'A11Y-020')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations).toContainEqual(
            expect.objectContaining({
                type: 'updateProp',
                args: expect.objectContaining({ propName: 'role', value: 'button' }),
            }),
        )
        expect(fix!.mutations).toContainEqual(
            expect.objectContaining({
                type: 'updateProp',
                args: expect.objectContaining({ propName: 'tabIndex', value: '0' }),
            }),
        )
    })
})

// ── A11Y-021: mouse-only handlers ─────────────────────────────────────────────

describe('A11Y-021: mouse-only event handlers', () => {
    it('flags onMouseDown without onKeyDown', () => {
        const ast = parseJSX(`const C = () => <div onMouseDown={() => {}}>content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-021')).toBe(true)
    })

    it('passes when onMouseDown has onKeyDown', () => {
        const ast = parseJSX(`
            const C = () => (
                <div onMouseDown={() => {}} onKeyDown={() => {}}>content</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-021')).toHaveLength(0)
    })

    it('is not fixable (fixable: false)', () => {
        const ast = parseJSX(`const C = () => <div onMouseDown={() => {}}>content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-021')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-022: focus indicator removed ────────────────────────────────────────

describe('A11Y-022: focus indicator must not be removed', () => {
    it('flags outline-none without replacement focus style', () => {
        const ast = parseJSX(`const C = () => <button className="outline-none">click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-022')).toBe(true)
    })

    it('passes outline-none with focus:ring-* replacement', () => {
        const ast = parseJSX(`
            const C = () => <button className="outline-none focus:ring-2 focus:ring-blue-500">click</button>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-022')).toHaveLength(0)
    })

    it('passes without outline-none', () => {
        const ast = parseJSX(`const C = () => <button className="px-4 py-2">click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-022')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`const C = () => <button className="outline-none">click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-022')
        if (v) expect(v.fixable).toBe(false)
    })
})
