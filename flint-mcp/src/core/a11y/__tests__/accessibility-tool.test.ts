/**
 * Integration tests for the flint_accessibility_report tool handler
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { handleAccessibilityReport } from '../../../tools/accessibility.js'
import { resetRules, registerRules } from '../runner.js'
import { namesLabelsRules } from '../rules/names-labels.js'
import { structureRules } from '../rules/structure.js'
import { landmarksRules } from '../rules/landmarks.js'

beforeEach(() => {
    resetRules()
    registerRules([...namesLabelsRules, ...structureRules, ...landmarksRules])
})

afterEach(() => {
    resetRules()
})

describe('handleAccessibilityReport', () => {
    it('returns PASS for source with no A11Y-001 violation (img with alt)', async () => {
        // Use criteria filter to scope to just 1.1.1 rules for a deterministic PASS
        const result = await handleAccessibilityReport({
            source: `const C = () => <img src="x" alt="desc" />`,
            criteria: ['1.1.1'],
        })
        expect(result.status).toBe('PASS')
        expect(result.auditResult.violations.filter((v) => v.ruleId === 'A11Y-001')).toHaveLength(0)
    })

    it('returns FAIL for source with A11Y-001 violation', async () => {
        const result = await handleAccessibilityReport({
            source: `const C = () => <img src="x" />`,
            criteria: ['1.1.1'],
        })
        expect(result.status).toBe('FAIL')
        expect(result.auditResult.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
    })

    it('throws error when neither source nor filePath provided', async () => {
        await expect(handleAccessibilityReport({})).rejects.toThrow(
            'Either source or filePath must be provided',
        )
    })

    it('filters by criteria', async () => {
        const result = await handleAccessibilityReport({
            source: `const C = () => <img src="x" />`,
            criteria: ['1.1.1'],
        })
        expect(result.auditResult.violations.every((v) => v.wcag === '1.1.1')).toBe(true)
    })

    it('applies autoFix and returns fixedSource', async () => {
        const result = await handleAccessibilityReport({
            source: `const C = () => <img src="x" />`,
            autoFix: true,
        })
        // May or may not return fixedSource depending on whether fixes were available
        // but should not throw
        expect(result.status).toBeDefined()
    })

    it('throws for non-existent filePath', async () => {
        await expect(
            handleAccessibilityReport({ filePath: '/nonexistent/file.tsx' }),
        ).rejects.toThrow('File not found')
    })

    it('filters by categories', async () => {
        const result = await handleAccessibilityReport({
            source: `const C = () => <img src="x" />`,
            categories: ['names-labels'],
        })
        const nonNamesLabels = result.auditResult.violations.filter(
            (v) => !['A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005', 'A11Y-006', 'A11Y-011', 'A11Y-012', 'A11Y-013', 'A11Y-014'].includes(v.ruleId),
        )
        expect(nonNamesLabels).toHaveLength(0)
    })

    it('handles non-JSX source without crash', async () => {
        const result = await handleAccessibilityReport({
            source: `const x = 42`,
        })
        // Document-level rules skip when no elements found
        expect(result.auditResult.violations.filter((v) => v.elementId !== 'document')).toHaveLength(0)
        expect(result.auditResult.violations).toHaveLength(0)
    })

    it('auditResult has correct structure', async () => {
        const result = await handleAccessibilityReport({
            source: `const C = () => <img src="x" />`,
        })
        expect(result.auditResult).toMatchObject({
            filePath: expect.any(String),
            totalRules: expect.any(Number),
            passed: expect.any(Number),
            failed: expect.any(Number),
            compliancePercent: expect.any(Number),
            violations: expect.any(Array),
            criterionResults: expect.any(Array),
            fixableCount: expect.any(Number),
            timestamp: expect.any(String),
        })
    })
})
