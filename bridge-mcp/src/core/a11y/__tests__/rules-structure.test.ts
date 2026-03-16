/**
 * Tests for structure rules (A11Y-008, A11Y-009, A11Y-010, A11Y-015, A11Y-016, A11Y-017)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { structureRules } from '../rules/structure.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(structureRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-008: table must have accessible summary ──────────────────────────────

describe('A11Y-008: table accessible summary', () => {
    it('flags table without caption or aria-label', () => {
        const ast = parseJSX(`
            const C = () => <table><tr><td>x</td></tr></table>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-008')).toBe(true)
    })

    it('passes table with <caption>', () => {
        const ast = parseJSX(`
            const C = () => (
                <table>
                    <caption>User data</caption>
                    <tr><td>x</td></tr>
                </table>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-008')).toHaveLength(0)
    })

    it('passes table with aria-label', () => {
        const ast = parseJSX(`
            const C = () => <table aria-label="User data"><tr><td>x</td></tr></table>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-008')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`const C = () => <table><tr><td>x</td></tr></table>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-008')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-009: html must have lang ─────────────────────────────────────────────

describe('A11Y-009: html lang attribute', () => {
    it('flags html without lang', () => {
        const ast = parseJSX(`const C = () => <html><body>test</body></html>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-009')).toBe(true)
    })

    it('passes html with lang', () => {
        const ast = parseJSX(`const C = () => <html lang="en"><body>test</body></html>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-009')).toHaveLength(0)
    })

    it('auto-fix adds lang="en"', () => {
        const ast = parseJSX(`const C = () => <html><body>test</body></html>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-009')!
        const rule = structureRules.find((r) => r.id === 'A11Y-009')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'lang', value: 'en' },
        })
    })

    it('handles dynamic lang (no false positive)', () => {
        const ast = parseJSX(`const C = ({ lang }) => <html lang={lang}><body>test</body></html>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-009')).toHaveLength(0)
    })
})

// ── A11Y-010: headings must not skip levels ────────────────────────────────────

describe('A11Y-010: heading level order', () => {
    it('flags when h3 follows h1 (skips h2)', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <h1>Title</h1>
                    <h3>Subtitle</h3>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-010')).toBe(true)
    })

    it('passes sequential headings', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <h1>Title</h1>
                    <h2>Subtitle</h2>
                    <h3>Section</h3>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-010')).toHaveLength(0)
    })

    it('passes single h1 with no subsequent headings', () => {
        const ast = parseJSX(`const C = () => <h1>Title</h1>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-010')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`
            const C = () => <div><h1>A</h1><h4>B</h4></div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-010')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-015: ul/ol children must be li ─────────────────────────────────────

describe('A11Y-015: list children must be li', () => {
    it('flags ul with div child', () => {
        const ast = parseJSX(`
            const C = () => <ul><div>item</div></ul>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-015')).toBe(true)
    })

    it('passes ul with li children', () => {
        const ast = parseJSX(`
            const C = () => <ul><li>item 1</li><li>item 2</li></ul>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-015')).toHaveLength(0)
    })

    it('skips dynamic children (expression containers)', () => {
        const ast = parseJSX(`
            const C = ({ items }) => <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-015')).toHaveLength(0)
    })
})

// ── A11Y-016: dl children must be dt or dd ────────────────────────────────────

describe('A11Y-016: definition list children', () => {
    it('flags dl with invalid children', () => {
        const ast = parseJSX(`
            const C = () => <dl><span>not a term</span></dl>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-016')).toBe(true)
    })

    it('passes dl with dt/dd children', () => {
        const ast = parseJSX(`
            const C = () => <dl><dt>Term</dt><dd>Definition</dd></dl>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-016')).toHaveLength(0)
    })

    it('edge case: empty dl has no violation', () => {
        const ast = parseJSX(`const C = () => <dl></dl>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-016')).toHaveLength(0)
    })
})

// ── A11Y-017: page must have exactly one h1 ──────────────────────────────────

describe('A11Y-017: exactly one h1', () => {
    it('flags when two h1 elements exist', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <h1>Title One</h1>
                    <h1>Title Two</h1>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-017')).toBe(true)
    })

    it('passes with single h1', () => {
        const ast = parseJSX(`const C = () => <h1>Title</h1>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-017')).toHaveLength(0)
    })

    it('passes with no h1 (may be a component, not a page)', () => {
        const ast = parseJSX(`const C = () => <div><p>Content</p></div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-017')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`
            const C = () => <div><h1>A</h1><h1>B</h1></div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-017')
        if (v) expect(v.fixable).toBe(false)
    })
})
