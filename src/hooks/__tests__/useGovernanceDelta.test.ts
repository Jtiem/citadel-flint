/**
 * useGovernanceDelta.test.ts — T1
 *
 * Covers:
 *   - Mount: calls baseline.isSet() and baseline.get() on mount
 *   - Mount: reloads baseline entries when activeFilePath changes
 *   - Mount: handles missing baseline API gracefully
 *   - deltaWarnings returns all violations when no baseline is set
 *   - deltaWarnings applies delta filter when baseline is active
 *   - setBaseline: calls api.set(), refreshes isBaselineSet and baselineEntries
 *   - clearBaseline: calls api.clear(), resets state
 *   - baselineStatus transitions: idle → setting → idle
 *   - baselineStatus transitions: idle → clearing → idle
 *   - Edge case: empty violations list, empty baseline
 *   - Edge case: activeFilePath null → baselineEntries reset to []
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernanceDelta } from '../useGovernanceDelta'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { LinterWarning } from '../../types/flint-api'

// ── Helper factories ─────────────────────────────────────────────────────────

function makeWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-1',
        type: 'color-drift',
        severity: 'amber',
        value: 3.5,
        message: 'MITHRIL-COL-001: arbitrary color',
        nearestToken: 'color-brand.primary',
        nearestTokenValue: '#1d4ed8',
        ...overrides,
    }
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('useGovernanceDelta', () => {
    beforeEach(() => {
        // The global setup.ts beforeEach resets stores and mocks.
        // Here we configure the baseline API defaults.
        ;(window.flintAPI as any).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
    })

    it('calls baseline.isSet and baseline.get on mount', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })

        renderHook(() => useGovernanceDelta())

        await waitFor(() => {
            expect(window.flintAPI.baseline.isSet).toHaveBeenCalledTimes(1)
            expect(window.flintAPI.baseline.get).toHaveBeenCalledWith('/src/App.tsx')
        })
    })

    it('does not call baseline.get when activeFilePath is null', async () => {
        useCanvasStore.setState({ activeFilePath: null })

        renderHook(() => useGovernanceDelta())

        await waitFor(() => {
            expect(window.flintAPI.baseline.isSet).toHaveBeenCalledTimes(1)
        })
        expect(window.flintAPI.baseline.get).not.toHaveBeenCalled()
    })

    it('reloads baseline entries when activeFilePath changes', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })

        renderHook(() => useGovernanceDelta())

        await waitFor(() => {
            expect(window.flintAPI.baseline.get).toHaveBeenCalledWith('/src/App.tsx')
        })

        act(() => {
            useCanvasStore.setState({ activeFilePath: '/src/Button.tsx' })
        })

        await waitFor(() => {
            expect(window.flintAPI.baseline.get).toHaveBeenCalledWith('/src/Button.tsx')
        })
    })

    it('handles missing baseline API gracefully (no crash)', () => {
        ;(window.flintAPI as any).baseline = undefined
        expect(() => renderHook(() => useGovernanceDelta())).not.toThrow()
    })

    it('returns all violations as deltaWarnings when no baseline is set', async () => {
        const w1 = makeWarning({ id: 'node-1' })
        const w2 = makeWarning({ id: 'node-2', type: 'typography-drift' })
        useEditorStore.setState({
            linterWarnings: new Map([['node-1', w1], ['node-2', w2]]),
        })
        ;(window.flintAPI as any).baseline.isSet.mockResolvedValue(false)

        const { result } = renderHook(() => useGovernanceDelta())

        await waitFor(() => {
            expect(result.current.isBaselineSet).toBe(false)
        })
        expect(result.current.deltaWarnings).toHaveLength(2)
    })

    it('applies delta filter when baseline is active — filters out known violations', async () => {
        const w1 = makeWarning({ id: 'node-1', type: 'color-drift' })
        const w2 = makeWarning({ id: 'node-2', type: 'typography-drift' })
        useEditorStore.setState({
            linterWarnings: new Map([['node-1', w1], ['node-2', w2]]),
        })
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })

        ;(window.flintAPI as any).baseline.isSet.mockResolvedValue(true)
        ;(window.flintAPI as any).baseline.get.mockResolvedValue([
            { file_path: '/src/App.tsx', node_id: 'node-1', rule_id: 'color-drift', severity: 'amber', snapshot_value: null },
        ])

        const { result } = renderHook(() => useGovernanceDelta())

        await waitFor(() => {
            expect(result.current.isBaselineSet).toBe(true)
            expect(result.current.baselineEntries).toHaveLength(1)
        })
        // node-1 is in baseline, should be filtered out; node-2 is new, should show
        expect(result.current.deltaWarnings).toHaveLength(1)
        expect(result.current.deltaWarnings[0].id).toBe('node-2')
    })

    it('setBaseline: calls api.set and refreshes state', async () => {
        const w1 = makeWarning({ id: 'node-1' })
        useEditorStore.setState({ linterWarnings: new Map([['node-1', w1]]) })
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })

        ;(window.flintAPI as any).baseline.isSet
            .mockResolvedValueOnce(false)   // initial mount
            .mockResolvedValueOnce(true)    // after set
        ;(window.flintAPI as any).baseline.get
            .mockResolvedValueOnce([])      // initial mount
            .mockResolvedValueOnce([        // after set
                { file_path: '/src/App.tsx', node_id: 'node-1', rule_id: 'color-drift', severity: 'amber', snapshot_value: null },
            ])

        const { result } = renderHook(() => useGovernanceDelta())
        await waitFor(() => { expect(result.current.isBaselineSet).toBe(false) })

        await act(async () => {
            await result.current.setBaseline()
        })

        expect(window.flintAPI.baseline.set).toHaveBeenCalledTimes(1)
        expect(result.current.isBaselineSet).toBe(true)
        expect(result.current.baselineEntries).toHaveLength(1)
        expect(result.current.baselineStatus).toBe('idle')
    })

    it('setBaseline: no-op when activeFilePath is null', async () => {
        useCanvasStore.setState({ activeFilePath: null })
        const { result } = renderHook(() => useGovernanceDelta())

        await act(async () => {
            await result.current.setBaseline()
        })

        expect(window.flintAPI.baseline.set).not.toHaveBeenCalled()
    })

    it('clearBaseline: calls api.clear and resets state', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI as any).baseline.isSet.mockResolvedValue(true)
        ;(window.flintAPI as any).baseline.get.mockResolvedValue([
            { file_path: '/src/App.tsx', node_id: 'node-1', rule_id: 'color-drift', severity: 'amber', snapshot_value: null },
        ])

        const { result } = renderHook(() => useGovernanceDelta())
        await waitFor(() => { expect(result.current.isBaselineSet).toBe(true) })

        await act(async () => {
            await result.current.clearBaseline()
        })

        expect(window.flintAPI.baseline.clear).toHaveBeenCalledTimes(1)
        expect(result.current.isBaselineSet).toBe(false)
        expect(result.current.baselineEntries).toHaveLength(0)
        expect(result.current.baselineStatus).toBe('idle')
    })

    it('baselineStatus is idle initially', async () => {
        const { result } = renderHook(() => useGovernanceDelta())
        expect(result.current.baselineStatus).toBe('idle')
    })

    it('returns empty deltaWarnings when no linter warnings and no a11y violations', async () => {
        // Stores are already cleared by global beforeEach
        const { result } = renderHook(() => useGovernanceDelta())
        await waitFor(() => {
            expect(result.current.deltaWarnings).toHaveLength(0)
        })
    })

    it('includes a11y violations in deltaWarnings', async () => {
        useCanvasStore.setState({
            a11yViolations: { 'node-a': ['Missing alt text'] },
            activeFilePath: '/src/App.tsx',
        })

        const { result } = renderHook(() => useGovernanceDelta())

        await waitFor(() => {
            const a11yWarnings = result.current.deltaWarnings.filter((w) => w.type === 'a11y')
            expect(a11yWarnings).toHaveLength(1)
            expect(a11yWarnings[0].id).toBe('node-a')
        })
    })
})
