/**
 * useUnifiedViolations.test.ts — src/hooks/__tests__/useUnifiedViolations.test.ts
 *
 * GLASS.1d: Tests for the unified violation hook.
 *
 * Covers:
 *   - Returns empty array when both stores have no violations
 *   - Merges mithril violations correctly from editorStore.linterWarnings
 *   - Merges basic mithril violations from canvasStore.mithrilViolations
 *   - Merges a11y violations correctly from canvasStore.a11yViolations
 *   - Counts autoFixable correctly
 *   - Deduplicates by flintId + ruleId
 *   - totalCount matches violations.length
 *   - Severity mapping is correct
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUnifiedViolations } from '../useUnifiedViolations'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { LinterWarning } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLinterWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-abc',
        type: 'color-drift',
        severity: 'amber',
        value: 5,
        message: 'MITHRIL-COL-001: arbitrary \'#3b82f6\' not in color token set',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useUnifiedViolations', () => {
    beforeEach(() => {
        // Reset both stores to clean state
        useEditorStore.setState({
            linterWarnings: new Map(),
        })
        useCanvasStore.setState({
            mithrilViolations: [],
            a11yViolations: {},
        })
    })

    it('returns empty array when both stores have no violations', () => {
        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.violations).toEqual([])
        expect(result.current.totalCount).toBe(0)
        expect(result.current.autoFixableCount).toBe(0)
        expect(result.current.mithrilCount).toBe(0)
        expect(result.current.a11yCount).toBe(0)
    })

    it('merges mithril violations from editorStore.linterWarnings', () => {
        const warning = makeLinterWarning({
            id: 'node-1',
            nearestToken: 'text-blue-500',
            nearestTokenValue: '#3b82f6',
        })
        useEditorStore.setState({
            linterWarnings: new Map([['node-1', warning]]),
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.violations).toHaveLength(1)
        expect(result.current.violations[0].flintId).toBe('node-1')
        expect(result.current.violations[0].type).toBe('mithril')
        expect(result.current.violations[0].ruleId).toBe('MITHRIL-COL-001')
        expect(result.current.violations[0].severity).toBe('warning') // 'amber' → 'warning'
        expect(result.current.violations[0].autoFixAvailable).toBe(true)
        expect(result.current.violations[0].nearestToken).toBe('text-blue-500')
        expect(result.current.violations[0].source).toBe(warning)
        expect(result.current.mithrilCount).toBe(1)
        expect(result.current.totalCount).toBe(1)
    })

    it('maps critical severity correctly', () => {
        const warning = makeLinterWarning({
            id: 'node-1',
            severity: 'critical',
        })
        useEditorStore.setState({
            linterWarnings: new Map([['node-1', warning]]),
        })

        const { result } = renderHook(() => useUnifiedViolations())
        expect(result.current.violations[0].severity).toBe('critical')
    })

    it('maps advisory severity to info', () => {
        const warning = makeLinterWarning({
            id: 'node-1',
            severity: 'advisory',
        })
        useEditorStore.setState({
            linterWarnings: new Map([['node-1', warning]]),
        })

        const { result } = renderHook(() => useUnifiedViolations())
        expect(result.current.violations[0].severity).toBe('info')
    })

    it('adds basic mithril violations from canvasStore when not in linterWarnings', () => {
        useCanvasStore.setState({
            mithrilViolations: ['node-2', 'node-3'],
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.violations).toHaveLength(2)
        expect(result.current.violations[0].flintId).toBe('node-2')
        expect(result.current.violations[0].type).toBe('mithril')
        expect(result.current.violations[0].autoFixAvailable).toBe(false)
        expect(result.current.violations[1].flintId).toBe('node-3')
        expect(result.current.mithrilCount).toBe(2)
    })

    it('does not duplicate mithril violations already in linterWarnings', () => {
        const warning = makeLinterWarning({ id: 'node-1' })
        useEditorStore.setState({
            linterWarnings: new Map([['node-1', warning]]),
        })
        useCanvasStore.setState({
            mithrilViolations: ['node-1'],
        })

        const { result } = renderHook(() => useUnifiedViolations())

        // Only one entry — the rich one from linterWarnings
        expect(result.current.violations).toHaveLength(1)
        expect(result.current.violations[0].source).toBe(warning)
        expect(result.current.mithrilCount).toBe(1)
    })

    it('merges a11y violations correctly', () => {
        useCanvasStore.setState({
            a11yViolations: {
                'node-5': [
                    'A11Y-001: <img> has no alt attribute.',
                    'A11Y-002: <button> has no accessible name.',
                ],
            },
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.violations).toHaveLength(2)
        expect(result.current.violations[0].flintId).toBe('node-5')
        expect(result.current.violations[0].type).toBe('a11y')
        expect(result.current.violations[0].ruleId).toBe('A11Y-001')
        expect(result.current.violations[0].severity).toBe('critical')
        expect(result.current.violations[1].ruleId).toBe('A11Y-002')
        expect(result.current.a11yCount).toBe(2)
    })

    it('counts autoFixable correctly', () => {
        const fixable = makeLinterWarning({
            id: 'node-1',
            nearestToken: 'text-blue-500',
        })
        const notFixable = makeLinterWarning({
            id: 'node-2',
            nearestToken: null,
            message: 'MITHRIL-TYP-001: arbitrary \'Comic Sans\' not in token set',
        })

        useEditorStore.setState({
            linterWarnings: new Map([
                ['node-1', fixable],
                ['node-2', notFixable],
            ]),
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.autoFixableCount).toBe(1)
        expect(result.current.totalCount).toBe(2)
    })

    it('deduplicates by flintId + ruleId', () => {
        // Same flintId + same rule from both linterWarnings and a11yViolations
        const warning = makeLinterWarning({
            id: 'node-1',
            type: 'a11y',
            message: 'A11Y-001: <img> has no alt attribute.',
        })

        useEditorStore.setState({
            linterWarnings: new Map([['node-1', warning]]),
        })
        useCanvasStore.setState({
            a11yViolations: {
                'node-1': ['A11Y-001: <img> has no alt attribute.'],
            },
        })

        const { result } = renderHook(() => useUnifiedViolations())

        // Should only appear once (from linterWarnings, since it processes first)
        const a11yForNode1 = result.current.violations.filter(
            (v) => v.flintId === 'node-1' && v.ruleId === 'A11Y-001'
        )
        expect(a11yForNode1).toHaveLength(1)
    })

    it('totalCount matches violations.length', () => {
        const w1 = makeLinterWarning({ id: 'n1' })
        const w2 = makeLinterWarning({
            id: 'n2',
            message: 'MITHRIL-TYP-001: font drift',
        })

        useEditorStore.setState({
            linterWarnings: new Map([['n1', w1], ['n2', w2]]),
        })
        useCanvasStore.setState({
            mithrilViolations: ['n3'],
            a11yViolations: { 'n4': ['A11Y-003: missing landmark.'] },
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.totalCount).toBe(result.current.violations.length)
        expect(result.current.totalCount).toBe(4) // 2 linter + 1 basic mithril + 1 a11y
    })

    it('reacts to store changes', () => {
        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.totalCount).toBe(0)

        // Add a violation
        act(() => {
            useCanvasStore.setState({
                a11yViolations: { 'node-x': ['A11Y-005: form control without label.'] },
            })
        })

        expect(result.current.totalCount).toBe(1)
        expect(result.current.a11yCount).toBe(1)
    })

    it('handles a11y violations with no rule prefix', () => {
        useCanvasStore.setState({
            a11yViolations: {
                'node-10': ['No alt text provided for image element.'],
            },
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.violations).toHaveLength(1)
        expect(result.current.violations[0].ruleId).toBeNull()
        expect(result.current.violations[0].type).toBe('a11y')
    })

    it('combines mithril and a11y counts correctly', () => {
        const warning = makeLinterWarning({ id: 'node-a' })
        useEditorStore.setState({
            linterWarnings: new Map([['node-a', warning]]),
        })
        useCanvasStore.setState({
            mithrilViolations: ['node-b'],
            a11yViolations: { 'node-c': ['A11Y-010: missing heading structure.'] },
        })

        const { result } = renderHook(() => useUnifiedViolations())

        expect(result.current.mithrilCount).toBe(2)
        expect(result.current.a11yCount).toBe(1)
        expect(result.current.totalCount).toBe(3)
    })
})
