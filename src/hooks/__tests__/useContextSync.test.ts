/**
 * useContextSync.test.ts — src/hooks/__tests__/useContextSync.test.ts
 *
 * Tests for the useContextSync hook.
 *
 * The hook debounces at 200 ms then calls window.bridgeAPI.syncContext with
 * a BridgeContext snapshot assembled from canvasStore and editorStore.
 *
 * Covers:
 *   - 200 ms debounce: fires after delay, not before
 *   - Rapid state changes: only the last write fires
 *   - Payload fields: activeFile, selectedNodeId, violation counts, saveState, canvasMode
 *   - Cleanup: pending timer cancelled on unmount
 *   - No-op when syncContext is not available
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContextSync } from '../useContextSync'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import type { LinterWarning } from '../../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMithrilWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-abc',
        type: 'color-drift',
        severity: 'amber',
        value: 5,
        message: 'Drift',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

function makeA11yWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-def',
        type: 'a11y',
        severity: 'amber',
        value: 0,
        message: 'Missing alt',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useContextSync', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('does NOT call syncContext before 200 ms have elapsed', () => {
        renderHook(() => useContextSync())

        act(() => {
            vi.advanceTimersByTime(199)
        })

        expect(window.bridgeAPI.syncContext).not.toHaveBeenCalled()
    })

    it('calls syncContext after the 200 ms debounce fires', () => {
        renderHook(() => useContextSync())

        act(() => {
            vi.advanceTimersByTime(200)
        })

        expect(window.bridgeAPI.syncContext).toHaveBeenCalledOnce()
    })

    it('debounces rapid state changes — only the last write fires', () => {
        const { rerender } = renderHook(() => useContextSync())

        act(() => {
            // Two rapid state changes before the debounce window closes
            useCanvasStore.setState({ activeFilePath: '/src/A.tsx' })
            rerender()
            vi.advanceTimersByTime(100)
            useCanvasStore.setState({ activeFilePath: '/src/B.tsx' })
            rerender()
            vi.advanceTimersByTime(200) // total > 200 ms from the last change
        })

        // Only a single syncContext call should have fired (the debounced one)
        expect(window.bridgeAPI.syncContext).toHaveBeenCalledOnce()
    })

    it('includes activeFile from canvasStore in the context payload', () => {
        useCanvasStore.setState({ activeFilePath: '/src/components/Button.tsx' })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.activeFile).toBe('/src/components/Button.tsx')
    })

    it('includes selectedNodeId from editorStore in the context payload', () => {
        useEditorStore.setState({ selectedNodeId: 'bridge-node-xyz' })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.selectedNodeId).toBe('bridge-node-xyz')
    })

    it('includes correct mithrilCount in violations', () => {
        useEditorStore.setState({
            linterWarnings: new Map([
                ['node-1', makeMithrilWarning({ id: 'node-1', type: 'color-drift' })],
                ['node-2', makeMithrilWarning({ id: 'node-2', type: 'typography-drift' })],
            ]),
        })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.violations.mithrilCount).toBe(2)
    })

    it('includes correct a11yCount in violations', () => {
        useEditorStore.setState({
            linterWarnings: new Map([
                ['node-a', makeA11yWarning({ id: 'node-a' })],
                ['node-b', makeA11yWarning({ id: 'node-b' })],
                ['node-c', makeA11yWarning({ id: 'node-c' })],
            ]),
        })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.violations.a11yCount).toBe(3)
    })

    it('includes correct criticalCount in violations', () => {
        useEditorStore.setState({
            linterWarnings: new Map([
                ['node-crit-1', makeMithrilWarning({ id: 'node-crit-1', severity: 'critical' })],
                ['node-amber', makeMithrilWarning({ id: 'node-amber', severity: 'amber' })],
                ['node-crit-2', makeMithrilWarning({ id: 'node-crit-2', severity: 'critical' })],
            ]),
        })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.violations.criticalCount).toBe(2)
    })

    it('includes saveState from canvasStore in the context payload', () => {
        useCanvasStore.setState({ saveState: 'saved' })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.saveState).toBe('saved')
    })

    it('includes canvasMode from canvasStore in the context payload', () => {
        useCanvasStore.setState({ canvasMode: 'interact' })

        renderHook(() => useContextSync())
        act(() => { vi.advanceTimersByTime(200) })

        const ctx = (window.bridgeAPI.syncContext as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(ctx.canvasMode).toBe('interact')
    })

    it('cancels the pending timer on unmount — syncContext is not called after cleanup', () => {
        const { unmount } = renderHook(() => useContextSync())

        act(() => {
            vi.advanceTimersByTime(100) // debounce not yet fired
            unmount()
            vi.advanceTimersByTime(200) // would have fired if not cleaned up
        })

        expect(window.bridgeAPI.syncContext).not.toHaveBeenCalled()
    })

    it('is a no-op when bridgeAPI.syncContext is undefined', () => {
        // Temporarily remove syncContext from the API
        const original = window.bridgeAPI.syncContext
        ;(window.bridgeAPI as Record<string, unknown>).syncContext = undefined

        expect(() => {
            renderHook(() => useContextSync())
            act(() => { vi.advanceTimersByTime(200) })
        }).not.toThrow()

        // Restore
        window.bridgeAPI.syncContext = original
    })
})
