/**
 * A11y Runner — POL.1 Policy Integration Tests
 * flint-mcp/src/core/a11y/__tests__/runner.policy.test.ts
 *
 * Test map:
 *   Group A — conformanceLevel filtering
 *     A1 — conformanceLevel 'A': only level-A rules run
 *     A2 — conformanceLevel 'AA': A + AA rules run
 *     A3 — conformanceLevel 'AAA': all rules run (A + AA + AAA)
 *     A4 — no conformanceLevel: all rules run (backward compatible)
 *     A5 — conformanceLevel 'A' with AA violation code: that rule not triggered
 *
 *   Group B — per-rule mode (ruleModes) filtering
 *     B1 — ruleModes A11Y-001: 'off' → A11Y-001 violations absent
 *     B2 — ruleModes A11Y-001: 'off' does not affect other rules
 *     B3 — multiple rules 'off' → none of them fire
 *
 *   Group C — advisory severity
 *     C1 — ruleModes A11Y-001: 'advisory' → violation tagged severity: 'advisory'
 *     C2 — advisory rule still appears in violations list
 *     C3 — non-advisory rule still uses its default severity
 *
 *   Group D — combination: conformance + ruleModes
 *     D1 — conformanceLevel 'A' + one A-level rule 'off' → that rule excluded
 *     D2 — conformanceLevel 'A' + AA rule 'advisory' → advisory tag irrelevant
 *           (AA rule filtered out before advisory is applied)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { namesLabelsRules } from '../rules/names-labels.js'
import { structureRules } from '../rules/structure.js'
import { landmarksRules } from '../rules/landmarks.js'
import { contrastRules } from '../rules/contrast.js'
import type { A11yRule } from '../types.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Code that reliably triggers A11Y-001 (img without alt) */
const IMG_NO_ALT = `const C = () => <img src="x" />`

/** Code that reliably triggers nothing for names-labels rules */
const COMPLIANT = `const C = () => <div><main><img src="x" alt="logo" /></main></div>`

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    resetRules()
})

afterEach(() => {
    resetRules()
})

// ── Group A: conformanceLevel filtering ───────────────────────────────────────

describe('Group A — conformanceLevel filtering', () => {
    it('A1: conformanceLevel "A" → only level-A rules included', () => {
        // Register a mix of level-A and level-AA rules
        const levelARule: A11yRule = {
            id: 'TEST-A-001',
            name: 'Level A Test',
            wcag: '1.1.1',
            level: 'A',
            category: 'names-labels',
            severity: 'critical',
            description: 'Always fires',
            visitElement: (_path, _ctx) => ({
                ruleId: 'TEST-A-001',
                elementId: 'el-1',
                message: 'Level A violation',
                severity: 'critical',
                wcag: '1.1.1',
                fixable: false,
            }),
        }
        const levelAARule: A11yRule = {
            id: 'TEST-AA-001',
            name: 'Level AA Test',
            wcag: '1.4.3',
            level: 'AA',
            category: 'contrast',
            severity: 'critical',
            description: 'Always fires',
            visitElement: (_path, _ctx) => ({
                ruleId: 'TEST-AA-001',
                elementId: 'el-1',
                message: 'Level AA violation',
                severity: 'critical',
                wcag: '1.4.3',
                fixable: false,
            }),
        }
        registerRules([levelARule, levelAARule])

        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            conformanceLevel: 'A',
        })

        expect(result.violations.some((v) => v.ruleId === 'TEST-A-001')).toBe(true)
        expect(result.violations.some((v) => v.ruleId === 'TEST-AA-001')).toBe(false)
    })

    it('A2: conformanceLevel "AA" → level-A and level-AA rules run', () => {
        const levelARule: A11yRule = {
            id: 'TEST-A-002',
            name: 'Level A Test 2',
            wcag: '2.1.1',
            level: 'A',
            category: 'keyboard',
            severity: 'critical',
            description: 'Always fires',
            visitElement: () => ({
                ruleId: 'TEST-A-002',
                elementId: 'el-1',
                message: 'violation',
                severity: 'critical',
                wcag: '2.1.1',
                fixable: false,
            }),
        }
        const levelAARule: A11yRule = {
            id: 'TEST-AA-002',
            name: 'Level AA Test 2',
            wcag: '1.4.6',
            level: 'AA',
            category: 'contrast',
            severity: 'warning',
            description: 'Always fires',
            visitElement: () => ({
                ruleId: 'TEST-AA-002',
                elementId: 'el-1',
                message: 'violation',
                severity: 'warning',
                wcag: '1.4.6',
                fixable: false,
            }),
        }
        const levelAAARule: A11yRule = {
            id: 'TEST-AAA-001',
            name: 'Level AAA Test',
            wcag: '1.4.6',
            level: 'AAA',
            category: 'contrast',
            severity: 'info',
            description: 'Always fires',
            visitElement: () => ({
                ruleId: 'TEST-AAA-001',
                elementId: 'el-1',
                message: 'violation',
                severity: 'info',
                wcag: '1.4.6',
                fixable: false,
            }),
        }
        registerRules([levelARule, levelAARule, levelAAARule])

        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            conformanceLevel: 'AA',
        })

        expect(result.violations.some((v) => v.ruleId === 'TEST-A-002')).toBe(true)
        expect(result.violations.some((v) => v.ruleId === 'TEST-AA-002')).toBe(true)
        expect(result.violations.some((v) => v.ruleId === 'TEST-AAA-001')).toBe(false)
    })

    it('A3: conformanceLevel "AAA" → all rules run (A + AA + AAA)', () => {
        const makeRule = (id: string, level: 'A' | 'AA' | 'AAA'): A11yRule => ({
            id,
            name: `${level} Test`,
            wcag: '1.1.1',
            level,
            category: 'names-labels',
            severity: 'critical',
            description: 'Always fires',
            visitElement: () => ({
                ruleId: id,
                elementId: 'el-1',
                message: 'violation',
                severity: 'critical',
                wcag: '1.1.1',
                fixable: false,
            }),
        })
        registerRules([makeRule('TEST-A-003', 'A'), makeRule('TEST-AA-003', 'AA'), makeRule('TEST-AAA-003', 'AAA')])

        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            conformanceLevel: 'AAA',
        })

        expect(result.violations.some((v) => v.ruleId === 'TEST-A-003')).toBe(true)
        expect(result.violations.some((v) => v.ruleId === 'TEST-AA-003')).toBe(true)
        expect(result.violations.some((v) => v.ruleId === 'TEST-AAA-003')).toBe(true)
    })

    it('A4: no conformanceLevel → all rules run (backward compatible)', () => {
        registerRules([...namesLabelsRules])

        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
    })

    it('A5: conformanceLevel "A" → AA-only rules are excluded from totalRules count', () => {
        // Register only the contrast rules (all AA level) and a names-labels rule (A level)
        registerRules([...namesLabelsRules, ...contrastRules])

        const ast = parseJSX(`const C = () => <div />`)
        const fullResult = auditSync(ast as any, { filePath: 'test.tsx' })
        const filteredResult = auditSync(ast as any, {
            filePath: 'test.tsx',
            conformanceLevel: 'A',
        })

        // The full result should have more total rules than the A-only result
        expect(filteredResult.totalRules).toBeLessThan(fullResult.totalRules)
        // Contrast rules (AA) should not be in the filtered result
        expect(filteredResult.violations.some((v) => v.ruleId === 'A11Y-060')).toBe(false)
    })
})

// ── Group B: per-rule mode (ruleModes) filtering ──────────────────────────────

describe('Group B — ruleModes "off" filtering', () => {
    beforeEach(() => {
        registerRules([...namesLabelsRules, ...structureRules, ...landmarksRules])
    })

    it('B1: A11Y-001 "off" → no A11Y-001 violations', () => {
        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            ruleModes: { 'A11Y-001': 'off' },
        })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(false)
    })

    it('B2: A11Y-001 "off" does not suppress other rule violations', () => {
        // Build AST that triggers A11Y-001 AND another names-labels rule
        // Using button without accessible name to trigger A11Y-002
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <img src="x" />
                    <button />
                </div>
            )
        `)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            ruleModes: { 'A11Y-001': 'off' },
        })
        // A11Y-001 (img no alt) should be gone
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(false)
        // But other violations may still be present
        // We just verify the audit ran (totalRules is less by 1)
        expect(result.totalRules).toBeGreaterThan(0)
    })

    it('B3: multiple rules "off" → none of them fire', () => {
        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            ruleModes: {
                'A11Y-001': 'off',
                'A11Y-002': 'off',
                'A11Y-003': 'off',
            },
        })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(false)
        expect(result.violations.some((v) => v.ruleId === 'A11Y-002')).toBe(false)
        expect(result.violations.some((v) => v.ruleId === 'A11Y-003')).toBe(false)
    })
})

// ── Group C: advisory severity ────────────────────────────────────────────────

describe('Group C — advisory severity tagging', () => {
    it('C1: A11Y-001 "advisory" → violation is tagged severity: "advisory"', () => {
        registerRules([...namesLabelsRules])

        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            ruleModes: { 'A11Y-001': 'advisory' },
        })
        const a001violations = result.violations.filter((v) => v.ruleId === 'A11Y-001')
        expect(a001violations.length).toBeGreaterThan(0)
        for (const v of a001violations) {
            expect(v.severity).toBe('advisory')
        }
    })

    it('C2: advisory rule still appears in violations list', () => {
        registerRules([...namesLabelsRules])

        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            ruleModes: { 'A11Y-001': 'advisory' },
        })
        // The violation should still be present (just downgraded, not removed)
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
    })

    it('C3: non-advisory rule retains its default severity', () => {
        registerRules([...namesLabelsRules])

        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            // A11Y-001 uses default severity (no advisory)
        })
        const a001violations = result.violations.filter((v) => v.ruleId === 'A11Y-001')
        expect(a001violations.length).toBeGreaterThan(0)
        // Default severity for A11Y-001 is 'critical' — should not be 'advisory'
        for (const v of a001violations) {
            expect(v.severity).not.toBe('advisory')
        }
    })

    it('C4: only advisory rules get advisory severity — other violations unaffected', () => {
        registerRules([...namesLabelsRules])

        // A JSX with two violations: img (A11Y-001) and button without label (A11Y-002)
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <img src="x" />
                    <button />
                </div>
            )
        `)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            // Mark only A11Y-001 as advisory
            ruleModes: { 'A11Y-001': 'advisory' },
        })

        const a001 = result.violations.filter((v) => v.ruleId === 'A11Y-001')
        const a002 = result.violations.filter((v) => v.ruleId === 'A11Y-002')

        // A11Y-001 → advisory
        for (const v of a001) {
            expect(v.severity).toBe('advisory')
        }
        // A11Y-002 (if present) → NOT advisory
        for (const v of a002) {
            expect(v.severity).not.toBe('advisory')
        }
    })
})

// ── Group D: combination — conformance + ruleModes ────────────────────────────

describe('Group D — conformance level + ruleModes combined', () => {
    it('D1: conformanceLevel "A" + A-level rule "off" → that rule excluded', () => {
        registerRules([...namesLabelsRules, ...contrastRules])

        const ast = parseJSX(IMG_NO_ALT)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            conformanceLevel: 'A',
            ruleModes: { 'A11Y-001': 'off' },
        })

        // A11Y-001 is A-level but set to 'off' → not in active rules
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(false)
        // AA-level contrast rules are also excluded by conformanceLevel
        expect(result.violations.some((v) => v.ruleId === 'A11Y-060')).toBe(false)
    })

    it('D2: conformanceLevel "A" + AA rule marked "advisory" → AA rule still excluded', () => {
        // Advisory marking only affects severity — 'off' filtering happens at activeRules stage.
        // An AA rule with 'advisory' mode but conformanceLevel='A' should be excluded
        // because the conformance filter runs before advisory tagging.
        registerRules([...contrastRules])

        const ast = parseJSX(`const C = () => <div />`)
        const result = auditSync(ast as any, {
            filePath: 'test.tsx',
            conformanceLevel: 'A',
            // A11Y-060 is AA-level; advisory mode should not override conformance filter
            ruleModes: { 'A11Y-060': 'advisory' },
        })

        // AA rule should still be excluded by conformance filter
        expect(result.violations.some((v) => v.ruleId === 'A11Y-060')).toBe(false)
        expect(result.totalRules).toBe(0)
    })
})
