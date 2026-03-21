/**
 * Tests for landmark rules (A11Y-050 through A11Y-053)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { landmarksRules } from '../rules/landmarks.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(landmarksRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-050: page must have <main> ───────────────────────────────────────────

describe('A11Y-050: page must have main landmark', () => {
    it('flags when page-structure file has no main element', () => {
        // A layout with header+footer is a page — must have main
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <header>Nav</header>
                    <footer>Footer</footer>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-050')).toBe(true)
    })

    it('does not flag a simple component without page structure', () => {
        const ast = parseJSX(`const C = () => <div><p>Hello</p></div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-050')).toHaveLength(0)
    })

    it('passes with <main>', () => {
        const ast = parseJSX(`const C = () => <main><p>Hello</p></main>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-050')).toHaveLength(0)
    })

    it('passes with role="main"', () => {
        const ast = parseJSX(`const C = () => <div role="main"><p>Hello</p></div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-050')).toHaveLength(0)
    })

    it('elementId is "document" for document-level violation', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <header>Nav</header>
                    <footer>Footer</footer>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-050')
        expect(v?.elementId).toBe('document')
    })

    it('is not fixable (fixable: false)', () => {
        const ast = parseJSX(`
            const C = () => <div><header>Nav</header></div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-050')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-051: page should have <nav> (warning) ────────────────────────────────

describe('A11Y-051: page should have navigation landmark (warning)', () => {
    it('flags when page-layout has no nav', () => {
        // main is a page-structure element, so A11Y-051 fires
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <main><p>Hello</p></main>
                    <footer>Footer</footer>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-051')
        expect(v).toBeDefined()
        expect(v!.severity).toBe('warning')
    })

    it('passes with <nav>', () => {
        const ast = parseJSX(`const C = () => <div><nav>Menu</nav><main>Content</main></div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-051')).toHaveLength(0)
    })

    it('passes with role="navigation"', () => {
        const ast = parseJSX(`const C = () => <div role="navigation">Menu</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-051')).toHaveLength(0)
    })
})

// ── A11Y-052: main must not appear more than once ─────────────────────────────

describe('A11Y-052: multiple main landmarks', () => {
    it('flags when two <main> elements present', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <main>Content A</main>
                    <main>Content B</main>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-052')).toBe(true)
    })

    it('passes with single <main>', () => {
        const ast = parseJSX(`const C = () => <main>Content</main>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-052')).toHaveLength(0)
    })

    it('passes with zero <main> elements in a simple component', () => {
        const ast = parseJSX(`const C = () => <div>Content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-052')).toHaveLength(0)
    })
})

// ── A11Y-053: multiple same-type landmarks need distinct labels ───────────────

describe('A11Y-053: duplicate landmarks need distinct labels', () => {
    it('flags two <nav> without aria-labels', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <nav>Primary</nav>
                    <nav>Secondary</nav>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-053')).toBe(true)
    })

    it('passes two <nav> with distinct aria-labels', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <nav aria-label="Primary Navigation">Primary</nav>
                    <nav aria-label="Footer Navigation">Secondary</nav>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-053')).toHaveLength(0)
    })

    it('passes single <nav> without aria-label', () => {
        const ast = parseJSX(`const C = () => <nav>Primary</nav>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-053')).toHaveLength(0)
    })

    it('edge case: handles empty document', () => {
        const ast = parseJSX(`const x = 42`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-053')).toHaveLength(0)
    })
})
