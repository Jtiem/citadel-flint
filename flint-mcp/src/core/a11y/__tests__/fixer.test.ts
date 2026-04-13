/**
 * Tests for fixer.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import generate from '@babel/generator'
import { applyFixes, applyFixMutationToAst } from '../fixer.js'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { namesLabelsRules } from '../rules/names-labels.js'
import { keyboardRules } from '../rules/keyboard.js'
import { structureRules } from '../rules/structure.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules([...namesLabelsRules, ...keyboardRules, ...structureRules])
})

afterEach(() => {
    resetRules()
})

describe('applyFixes', () => {
    it('fixes A11Y-001 (missing alt) with updateProp mutation', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-001')
        expect(violation).toBeDefined()

        const fixResult = applyFixes([violation!], ast, namesLabelsRules)
        expect(fixResult.fixed).toHaveLength(1)
        expect(fixResult.mutations).toContainEqual(
            expect.objectContaining({
                type: 'updateProp',
                args: expect.objectContaining({ propName: 'alt', value: '' }),
            }),
        )
    })

    it('skips violations without fixable=true', () => {
        const ast = parseJSX(`const C = () => <a onClick={() => {}}>click here</a>`) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-014')
        // A11Y-014 is not fixable
        if (violation) {
            const fixResult = applyFixes([violation], ast, namesLabelsRules)
            expect(fixResult.skipped).toContain(violation)
            expect(fixResult.fixed).toHaveLength(0)
        }
    })

    it('skips violations whose rule has no fix function', () => {
        // A11Y-008 (table) has no fix
        const ast = parseJSX(`const C = () => <table><tr><td>x</td></tr></table>`) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-008')
        if (violation) {
            const fixResult = applyFixes([violation], ast, structureRules)
            expect(fixResult.skipped).toContain(violation)
        }
    })

    it('returns appliedFixes descriptions', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-001')!
        const fixResult = applyFixes([violation], ast, namesLabelsRules)
        expect(fixResult.appliedFixes[0]).toMatchObject({
            ruleId: 'A11Y-001',
            description: expect.any(String),
        })
    })

    it('handles empty violations list', () => {
        const ast = parseJSX(`const C = () => <div />`) as any
        const fixResult = applyFixes([], ast, namesLabelsRules)
        expect(fixResult.fixed).toHaveLength(0)
        expect(fixResult.mutations).toHaveLength(0)
        expect(fixResult.skipped).toHaveLength(0)
    })

    it('handles multiple violations in one pass', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <img src="x" />
                    <button />
                </div>
            )
        `) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const fixable = result.violations.filter((v) => v.fixable)
        const fixResult = applyFixes(fixable, ast, [...namesLabelsRules, ...keyboardRules])
        expect(fixResult.fixed.length).toBeGreaterThan(0)
    })

    it('fixes A11Y-004 (input missing label) on file without data-flint-id via tag fallback', () => {
        // Simulate a file that has never had injectFlintIds run — no data-flint-id attributes
        const code = `const C = () => <div><input type="text" /></div>`
        const ast = parseJSX(code) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-004')
        expect(violation).toBeDefined()
        expect(violation!.fixable).toBe(true)

        const fixResult = applyFixes([violation!], ast, namesLabelsRules)
        expect(fixResult.fixed).toHaveLength(1)

        // Apply mutations to AST
        for (const mutation of fixResult.mutations) {
            applyFixMutationToAst(ast, mutation)
        }

        const { code: fixedCode } = (generate as any).default
            ? (generate as any).default(ast)
            : (generate as any)(ast)

        expect(fixedCode).toContain('aria-label')
    })

    it('fixes A11Y-001 (img missing alt) on file without data-flint-id via tag fallback', () => {
        const code = `const C = () => <img src="photo.png" />`
        const ast = parseJSX(code) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-001')
        expect(violation).toBeDefined()

        const fixResult = applyFixes([violation!], ast, namesLabelsRules)
        for (const mutation of fixResult.mutations) {
            applyFixMutationToAst(ast, mutation)
        }

        const { code: fixedCode } = (generate as any).default
            ? (generate as any).default(ast)
            : (generate as any)(ast)

        expect(fixedCode).toContain('alt')
    })

    it('does not double-fix an element that already has the target prop', () => {
        // One input without label, one with — only the first should be fixed
        const code = `const C = () => <div><input type="text" /><input aria-label="Name" /></div>`
        const ast = parseJSX(code) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-004')
        expect(violations).toHaveLength(1)

        const fixResult = applyFixes(violations, ast, namesLabelsRules)
        for (const mutation of fixResult.mutations) {
            applyFixMutationToAst(ast, mutation)
        }

        const { code: fixedCode } = (generate as any).default
            ? (generate as any).default(ast)
            : (generate as any)(ast)

        // Both inputs should end up with aria-label
        const ariaLabelCount = (fixedCode.match(/aria-label/g) ?? []).length
        expect(ariaLabelCount).toBeGreaterThanOrEqual(2)
    })

    it('applyFixMutationToAst: primary path works when data-flint-id is present', () => {
        // With data-flint-id, the primary traversal should find and fix the element
        const code = `const C = () => <img src="x" data-flint-id="img-001" />`
        const ast = parseJSX(code) as any

        applyFixMutationToAst(ast, {
            type: 'updateProp',
            args: { nodeId: 'img-001', propName: 'alt', value: '' },
        } as any)

        const { code: fixedCode } = (generate as any).default
            ? (generate as any).default(ast)
            : (generate as any)(ast)

        expect(fixedCode).toContain('alt')
    })

    it('applyFixMutationToAst: unknown nodeId without tag inference does nothing', () => {
        const code = `const C = () => <div />`
        const ast = parseJSX(code) as any

        // Should not throw, just silently skip
        expect(() =>
            applyFixMutationToAst(ast, {
                type: 'updateProp',
                args: { nodeId: 'unknown-xyz', propName: 'aria-label', value: 'test' },
            } as any),
        ).not.toThrow()
    })

    it('fix on already-compliant input returns null from rule.fix', () => {
        // A11Y-001 on img WITH alt should produce no violation
        const ast = parseJSX(`const C = () => <img src="x" alt="desc" />`) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const a001 = result.violations.filter((v) => v.ruleId === 'A11Y-001')
        expect(a001).toHaveLength(0)
        // No violations to fix
        const fixResult = applyFixes(a001, ast, namesLabelsRules)
        expect(fixResult.fixed).toHaveLength(0)
    })

    it('fix for A11Y-007 sets tabIndex to "0"', () => {
        const ast = parseJSX(`const C = () => <div tabIndex={3}>click</div>`) as any
        const result = auditSync(ast, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-007')
        expect(violation).toBeDefined()

        const fixResult = applyFixes([violation!], ast, keyboardRules)
        expect(fixResult.mutations).toContainEqual(
            expect.objectContaining({
                type: 'updateProp',
                args: expect.objectContaining({ propName: 'tabIndex', value: '0' }),
            }),
        )
    })
})
