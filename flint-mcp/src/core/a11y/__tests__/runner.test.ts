/**
 * Tests for a11y runner.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules, getRegisteredRules } from '../runner.js'
import { namesLabelsRules } from '../rules/names-labels.js'
import { structureRules } from '../rules/structure.js'
import { landmarksRules } from '../rules/landmarks.js'
import type { A11yRule } from '../types.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules([...namesLabelsRules, ...structureRules, ...landmarksRules])
})

afterEach(() => {
    resetRules()
})

// ── Basic audit ───────────────────────────────────────────────────────────────

describe('auditSync basics', () => {
    it('returns empty violations for compliant code', () => {
        const ast = parseJSX(`
            const C = () => <div><main><img src="x" alt="desc" /></main></div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        // Only checking no A11Y-001 violation
        const a001 = result.violations.filter((v) => v.ruleId === 'A11Y-001')
        expect(a001).toHaveLength(0)
    })

    it('flags A11Y-001 for missing alt', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
    })

    it('returns correct structure with filePath', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'my-file.tsx' })
        expect(result.filePath).toBe('my-file.tsx')
    })

    it('has totalRules equal to registered rule count', () => {
        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.totalRules).toBe(getRegisteredRules().length)
    })

    it('compliancePercent is 100 for fully compliant file', () => {
        resetRules()
        const trivialRule: A11yRule = {
            id: 'TEST-001',
            name: 'Test Rule',
            wcag: '1.1.1',
            level: 'A',
            category: 'names-labels',
            severity: 'critical',
            description: 'Always passes',
            visitElement: () => null,
        }
        registerRules([trivialRule])

        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.compliancePercent).toBe(100)
    })

    it('handles empty file (no JSX) — no violations', () => {
        // Document-level rules skip when no elements found
        const ast = parseJSX(`const x = 42`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const elementLevelViolations = result.violations.filter((v) => v.elementId !== 'document')
        expect(elementLevelViolations).toHaveLength(0)
        // Document violations also should be 0 for empty file
        expect(result.violations).toHaveLength(0)
    })

    it('handles JSX fragments without crash', () => {
        const ast = parseJSX(`const C = () => <><img src="x" /></>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
    })

    it('fixableCount reflects violations with fixable=true', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.fixableCount).toBeGreaterThan(0)
    })

    it('timestamp is ISO 8601 format', () => {
        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(() => new Date(result.timestamp)).not.toThrow()
        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
})

// ── Criterion filtering ───────────────────────────────────────────────────────

describe('criteria filtering', () => {
    it('filters rules by criteria', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            criteria: ['1.1.1'],
        })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
        // Only 1.1.1 rules should be active
        const nonCriteria = result.violations.filter((v) => v.wcag !== '1.1.1')
        expect(nonCriteria).toHaveLength(0)
    })

    it('returns empty violations for unmatched criteria', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            criteria: ['9.9.9'], // nonexistent
        })
        expect(result.violations).toHaveLength(0)
        expect(result.totalRules).toBe(0)
    })
})

// ── Category filtering ────────────────────────────────────────────────────────

describe('categories filtering', () => {
    it('filters rules by category', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            categories: ['names-labels'],
        })
        const nonNamesLabels = result.violations.filter((v) => {
            // All flagged violations should come from names-labels rules
            return !['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005', 'A11Y-006', 'A11Y-011', 'A11Y-012', 'A11Y-013', 'A11Y-014'].includes(v.ruleId)
        })
        expect(nonNamesLabels).toHaveLength(0)
    })
})

// ── Criterion results ─────────────────────────────────────────────────────────

describe('criterionResults', () => {
    it('includes criterion results for violated criteria', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const criterion111 = result.criterionResults.find((c) => c.criterion === '1.1.1')
        expect(criterion111).toBeDefined()
        expect(criterion111!.passed).toBe(false)
    })

    it('criterion passes when no violations', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="desc" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const criterion111 = result.criterionResults.find((c) => c.criterion === '1.1.1')
        if (criterion111) {
            expect(criterion111.passed).toBe(true)
        }
    })

    it('criterion results are sorted by criterion ID', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const criteria = result.criterionResults.map((c) => c.criterion)
        const sorted = [...criteria].sort((a, b) => a.localeCompare(b))
        expect(criteria).toEqual(sorted)
    })
})

// ── Document-level rules ──────────────────────────────────────────────────────

describe('document-level rules (landmarks)', () => {
    it('A11Y-050 fires when page has structure but no main landmark', () => {
        // A file with <header>/<footer> is a page layout — must have <main>
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <header>Site Header</header>
                    <footer>Site Footer</footer>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-050')).toBe(true)
    })

    it('A11Y-050 does not fire for simple component without page structure', () => {
        const ast = parseJSX(`const C = () => <div><p>Hello</p></div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-050')).toHaveLength(0)
    })

    it('A11Y-050 passes when <main> is present', () => {
        const ast = parseJSX(`const C = () => <main><p>Hello</p></main>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-050')).toHaveLength(0)
    })
})

// ── Rule errors are swallowed ─────────────────────────────────────────────────

describe('error resilience', () => {
    it('swallows rule errors without crashing', () => {
        const crashRule: A11yRule = {
            id: 'CRASH-001',
            name: 'Crash Rule',
            wcag: '1.1.1',
            level: 'A',
            category: 'names-labels',
            severity: 'critical',
            description: 'Throws an error',
            visitElement: () => { throw new Error('intentional crash') },
        }
        registerRules([crashRule])
        const ast = parseJSX(`const C = () => <div />`)
        expect(() => auditSync(ast as any, { filePath: 'test.tsx' })).not.toThrow()
    })
})
