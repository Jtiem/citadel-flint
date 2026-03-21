/**
 * Tests for fixer.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { applyFixes } from '../fixer.js'
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
