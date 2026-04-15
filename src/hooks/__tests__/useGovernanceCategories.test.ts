/**
 * useGovernanceCategories.test.ts — T7
 *
 * Covers:
 *   - Initial state: categoryFilter=null, all violations visible
 *   - chipCounts: correctly counts design-system, accessibility, token-sync
 *   - visibleLinterWarnings: all non-a11y warnings when filter=null
 *   - visibleLinterWarnings: only design-system (non-sync) when filter='design-system'
 *   - visibleLinterWarnings: only sync when filter='token-sync'
 *   - visibleLinterWarnings: empty when filter='accessibility'
 *   - visibleA11yWarnings: all a11y warnings when filter=null
 *   - visibleA11yWarnings: all a11y warnings when filter='accessibility'
 *   - visibleA11yWarnings: empty when filter='design-system' or 'token-sync'
 *   - effectiveA11yWarnings: always the full a11y list regardless of filter
 *   - setCategoryFilter: updates filter state
 *   - Edge case: empty delta warnings → all counts = 0
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGovernanceCategories } from '../useGovernanceCategories'
import type { LinterWarning } from '../../types/flint-api'
import type { UseGovernanceDeltaResult } from '../useGovernanceDelta'

// ── Helper factories ─────────────────────────────────────────────────────────

function makeWarning(overrides: Partial<LinterWarning>): LinterWarning {
    return {
        id: 'node-1',
        type: 'color-drift',
        severity: 'amber',
        value: 1,
        message: '',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

function makeDelta(deltaWarnings: LinterWarning[]): Pick<UseGovernanceDeltaResult, 'deltaWarnings'> {
    return { deltaWarnings }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const colorDrift = makeWarning({ id: 'n1', type: 'color-drift' })
const typoDrift  = makeWarning({ id: 'n2', type: 'typography-drift' })
const syncW      = makeWarning({ id: 'n3', type: 'sync' })
const a11yW1     = makeWarning({ id: 'n4', type: 'a11y', severity: 'critical' })
const a11yW2     = makeWarning({ id: 'n5', type: 'a11y', severity: 'critical' })

const mixedDelta = [colorDrift, typoDrift, syncW, a11yW1, a11yW2]

// ── Suite ────────────────────────────────────────────────────────────────────

describe('useGovernanceCategories', () => {
    it('initial categoryFilter is null', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta([]) })
        )
        expect(result.current.categoryFilter).toBeNull()
    })

    it('chipCounts: correctly counts each category', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        expect(result.current.chipCounts['design-system']).toBe(2) // color + typo
        expect(result.current.chipCounts['token-sync']).toBe(1)    // sync
        expect(result.current.chipCounts['accessibility']).toBe(2) // a11y × 2
    })

    it('visibleLinterWarnings: returns all non-a11y when filter=null', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        expect(result.current.visibleLinterWarnings).toHaveLength(3) // color + typo + sync
        expect(result.current.visibleLinterWarnings.every((w) => w.type !== 'a11y')).toBe(true)
    })

    it('visibleLinterWarnings: only non-sync when filter=design-system', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('design-system'))
        expect(result.current.visibleLinterWarnings).toHaveLength(2)
        expect(result.current.visibleLinterWarnings.every((w) => w.type !== 'sync')).toBe(true)
    })

    it('visibleLinterWarnings: only sync when filter=token-sync', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('token-sync'))
        expect(result.current.visibleLinterWarnings).toHaveLength(1)
        expect(result.current.visibleLinterWarnings[0].type).toBe('sync')
    })

    it('visibleLinterWarnings: empty when filter=accessibility', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('accessibility'))
        expect(result.current.visibleLinterWarnings).toHaveLength(0)
    })

    it('visibleA11yWarnings: returns all a11y when filter=null', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        expect(result.current.visibleA11yWarnings).toHaveLength(2)
    })

    it('visibleA11yWarnings: returns all a11y when filter=accessibility', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('accessibility'))
        expect(result.current.visibleA11yWarnings).toHaveLength(2)
    })

    it('visibleA11yWarnings: empty when filter=design-system', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('design-system'))
        expect(result.current.visibleA11yWarnings).toHaveLength(0)
    })

    it('visibleA11yWarnings: empty when filter=token-sync', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('token-sync'))
        expect(result.current.visibleA11yWarnings).toHaveLength(0)
    })

    it('effectiveA11yWarnings: always returns full a11y list regardless of filter', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        // With no filter
        expect(result.current.effectiveA11yWarnings).toHaveLength(2)

        // With design-system filter
        act(() => result.current.setCategoryFilter('design-system'))
        expect(result.current.effectiveA11yWarnings).toHaveLength(2)
    })

    it('setCategoryFilter: updates the filter', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta(mixedDelta) })
        )
        act(() => result.current.setCategoryFilter('token-sync'))
        expect(result.current.categoryFilter).toBe('token-sync')

        act(() => result.current.setCategoryFilter(null))
        expect(result.current.categoryFilter).toBeNull()
    })

    it('edge case: empty delta warnings → all counts = 0', () => {
        const { result } = renderHook(() =>
            useGovernanceCategories({ delta: makeDelta([]) })
        )
        expect(result.current.chipCounts['design-system']).toBe(0)
        expect(result.current.chipCounts['accessibility']).toBe(0)
        expect(result.current.chipCounts['token-sync']).toBe(0)
        expect(result.current.visibleLinterWarnings).toHaveLength(0)
        expect(result.current.visibleA11yWarnings).toHaveLength(0)
    })

    it('re-computes chipCounts when deltaWarnings change', () => {
        let delta = makeDelta([colorDrift])
        const { result, rerender } = renderHook(
            ({ d }) => useGovernanceCategories({ delta: d }),
            { initialProps: { d: delta } }
        )
        expect(result.current.chipCounts['design-system']).toBe(1)

        delta = makeDelta([colorDrift, typoDrift, a11yW1])
        rerender({ d: delta })
        expect(result.current.chipCounts['design-system']).toBe(2)
        expect(result.current.chipCounts['accessibility']).toBe(1)
    })
})
