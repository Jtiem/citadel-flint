/**
 * useGovernanceHealthSignal.test.ts
 *
 * Tests for H11: sub-scores, coaching sentence, top-5 rules, sparkline.
 *
 * Boundaries:
 *   - Returns correct subScores for given counts
 *   - Returns correct coachingSentence for each variant
 *   - topRules: aggregates linter warnings by type+severity, max 5
 *   - topRules: includes synthetic a11y row when a11yCount > 0
 *   - topRules: sorted by count descending
 *   - sparklineData: fetches healthHistory on mount
 *   - Records health when score changes
 *   - Does not record health when tokenCount is 0
 *   - Handles missing IPC gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGovernanceHealthSignal, type HealthSignalInput } from '../useGovernanceHealthSignal'
import { useTokenStore } from '../../store/tokenStore'

function makeInput(overrides: Partial<HealthSignalInput> = {}): HealthSignalInput {
    return {
        mithrilCount: 0,
        a11yCount: 0,
        overrideCount: 0,
        score: 100,
        grade: 'A',
        effectiveLinterWarnings: [],
        ...overrides,
    }
}

describe('useGovernanceHealthSignal', () => {
    beforeEach(() => {
        ;(window.flintAPI.governance.getHealthHistory as ReturnType<typeof vi.fn>)
            .mockResolvedValue([])
        ;(window.flintAPI.governance.recordHealth as ReturnType<typeof vi.fn>)
            .mockResolvedValue(undefined)
    })

    // ── subScores ────────────────────────────────────────────────────────────

    it('returns subScores.mithril=100 when mithrilCount=0', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput()))
        expect(result.current.subScores.mithril).toBe(100)
    })

    it('returns subScores.mithril clamped at 0 for large count', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ mithrilCount: 50 })))
        expect(result.current.subScores.mithril).toBe(0)
    })

    it('returns subScores.a11y=0 for 10+ a11y violations', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ a11yCount: 10 })))
        expect(result.current.subScores.a11y).toBe(0)
    })

    it('returns subScores.overrides=100 when overrideCount=0', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput()))
        expect(result.current.subScores.overrides).toBe(100)
    })

    // ── coachingSentence ─────────────────────────────────────────────────────

    it('returns perfect-score sentence when score=100', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ score: 100 })))
        expect(result.current.coachingSentence).toContain('Perfect score')
    })

    it('returns override-dominant sentence when overrides dominate', () => {
        const { result } = renderHook(() =>
            useGovernanceHealthSignal(makeInput({ score: 70, overrideCount: 5, mithrilCount: 1, a11yCount: 1 }))
        )
        expect(result.current.coachingSentence).toContain('rule override')
    })

    it('returns nearly-perfect sentence when score >= 90 with violations', () => {
        const { result } = renderHook(() =>
            useGovernanceHealthSignal(makeInput({ score: 92, mithrilCount: 2, a11yCount: 0, overrideCount: 0 }))
        )
        expect(result.current.coachingSentence).toContain('Nearly perfect')
    })

    it('returns a11y-dominant sentence when a11y > mithril', () => {
        const { result } = renderHook(() =>
            useGovernanceHealthSignal(makeInput({ score: 60, mithrilCount: 1, a11yCount: 5 }))
        )
        expect(result.current.coachingSentence).toContain('accessibility gap')
    })

    it('returns mithril-dominant sentence when mithril only', () => {
        const { result } = renderHook(() =>
            useGovernanceHealthSignal(makeInput({ score: 70, mithrilCount: 3 }))
        )
        expect(result.current.coachingSentence).toContain('color drift')
    })

    // ── topRules ─────────────────────────────────────────────────────────────

    it('returns empty topRules when no warnings and no a11y', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput()))
        expect(result.current.topRules).toHaveLength(0)
    })

    it('aggregates linter warnings by type+severity', () => {
        const warnings = [
            { id: '1', type: 'color-drift' as const, severity: 'amber' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
            { id: '2', type: 'color-drift' as const, severity: 'amber' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
            { id: '3', type: 'spacing-drift' as const, severity: 'advisory' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
        ]
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ effectiveLinterWarnings: warnings })))
        const colorDrift = result.current.topRules.find((r) => r.ruleId === 'color-drift')
        expect(colorDrift?.count).toBe(2)
    })

    it('adds synthetic a11y row when a11yCount > 0', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ a11yCount: 4 })))
        const a11yRow = result.current.topRules.find((r) => r.ruleId === 'a11y')
        expect(a11yRow).toBeDefined()
        expect(a11yRow?.count).toBe(4)
        expect(a11yRow?.severity).toBe('critical')
    })

    it('sorts topRules by count descending', () => {
        const warnings = [
            { id: '1', type: 'spacing-drift' as const, severity: 'advisory' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
            { id: '2', type: 'color-drift' as const, severity: 'amber' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
            { id: '3', type: 'color-drift' as const, severity: 'amber' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
            { id: '4', type: 'color-drift' as const, severity: 'amber' as const, value: 0, message: '', nearestToken: null, nearestTokenValue: null },
        ]
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ effectiveLinterWarnings: warnings })))
        expect(result.current.topRules[0].ruleId).toBe('color-drift')
        expect(result.current.topRules[0].count).toBe(3)
    })

    it('caps topRules at 5 entries', () => {
        const types = ['color-drift', 'spacing-drift', 'shadow-drift', 'opacity-drift', 'semantic-drift', 'registry'] as const
        const warnings = types.map((type, i) => ({
            id: String(i),
            type,
            severity: 'amber' as const,
            value: 0,
            message: '',
            nearestToken: null,
            nearestTokenValue: null,
        }))
        const { result } = renderHook(() =>
            useGovernanceHealthSignal(makeInput({ effectiveLinterWarnings: warnings, a11yCount: 0 }))
        )
        expect(result.current.topRules.length).toBeLessThanOrEqual(5)
    })

    // ── sparklineData ────────────────────────────────────────────────────────

    it('fetches health history on mount', async () => {
        const history = [
            { date: '2026-04-11', score: 80, grade: 'B' },
            { date: '2026-04-12', score: 90, grade: 'A' },
        ]
        ;(window.flintAPI.governance.getHealthHistory as ReturnType<typeof vi.fn>)
            .mockResolvedValue(history)

        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput()))

        await waitFor(() => {
            expect(result.current.sparklineData).toHaveLength(2)
        })
    })

    it('sets sparklineData to [] on getHealthHistory failure', async () => {
        ;(window.flintAPI.governance.getHealthHistory as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput()))

        await waitFor(() => {
            expect(result.current.sparklineData).toEqual([])
        })
    })

    it('does not call recordHealth when tokenCount is 0', async () => {
        useTokenStore.setState({ tokens: [] })

        const { rerender } = renderHook(
            (props: HealthSignalInput) => useGovernanceHealthSignal(props),
            { initialProps: makeInput({ score: 100 }) }
        )

        // Simulate score change
        rerender(makeInput({ score: 90, grade: 'A', mithrilCount: 2 }))

        await waitFor(() => {
            expect(window.flintAPI.governance.recordHealth).not.toHaveBeenCalled()
        })
    })

    it('returns passthrough score and grade from input', () => {
        const { result } = renderHook(() => useGovernanceHealthSignal(makeInput({ score: 75, grade: 'C' })))
        expect(result.current.score).toBe(75)
        expect(result.current.grade).toBe('C')
    })
})
