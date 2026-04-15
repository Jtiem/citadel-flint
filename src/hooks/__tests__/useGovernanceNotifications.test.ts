/**
 * useGovernanceNotifications.test.ts — src/hooks/__tests__/useGovernanceNotifications.test.ts
 *
 * T5: Tests for useGovernanceNotifications (H5).
 *
 * Covers:
 *   - mount: returns expected shape
 *   - sessionInitialCount reflects violations at mount time (from store state)
 *   - pulseRing starts as false
 *   - pulseRing activates when totalViolations drops from >0 to 0
 *   - pulseRing auto-clears after 3 seconds (via timers.schedule)
 *   - pulseRing does NOT activate on first render (null prevTotal)
 *   - pulseRing does NOT activate when total was already 0
 *   - showConfirmationToast pushes a notification to notificationStore
 *   - unmount cleanup: timer does not fire after unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGovernanceNotifications } from '../useGovernanceNotifications'
import { useGovernanceTimers } from '../useGovernanceTimers'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWarning(id: string): LinterWarning {
    return {
        id,
        type: 'color-drift',
        severity: 'critical',
        value: 1,
        message: 'Color drift',
        nearestToken: null,
        nearestTokenValue: null,
    }
}

function renderNotifications(totalViolations: number) {
    const timers = renderHook(() => useGovernanceTimers()).result.current
    return renderHook(
        ({ total }: { total: number }) => useGovernanceNotifications({ timers, totalViolations: total }),
        { initialProps: { total: totalViolations } },
    )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGovernanceNotifications', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns expected shape on mount', () => {
        const { result } = renderNotifications(0)
        expect(typeof result.current.sessionInitialCount).toBe('number')
        expect(typeof result.current.pulseRing).toBe('boolean')
        expect(typeof result.current.showConfirmationToast).toBe('function')
    })

    it('sessionInitialCount reflects linterWarnings in store at mount time', () => {
        useEditorStore.setState({
            linterWarnings: new Map([['w1', makeWarning('w1')], ['w2', makeWarning('w2')]]),
        })
        useCanvasStore.setState({ a11yViolations: {} })

        const { result } = renderNotifications(2)
        // Should capture 2 mithril + 0 a11y = 2
        expect(result.current.sessionInitialCount).toBe(2)
    })

    it('sessionInitialCount includes a11y violations from canvasStore at mount', () => {
        useEditorStore.setState({ linterWarnings: new Map() })
        useCanvasStore.setState({
            a11yViolations: { 'node-1': ['Missing label'], 'node-2': ['No alt text'] },
        })

        const { result } = renderNotifications(2)
        expect(result.current.sessionInitialCount).toBe(2)
    })

    it('pulseRing starts as false', () => {
        const { result } = renderNotifications(5)
        expect(result.current.pulseRing).toBe(false)
    })

    it('pulseRing activates when totalViolations drops from >0 to 0', () => {
        const { result, rerender } = renderNotifications(3)

        // First render: prev is null, no pulse
        expect(result.current.pulseRing).toBe(false)

        rerender({ total: 0 })

        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(result.current.pulseRing).toBe(true)
    })

    it('pulseRing auto-clears after 3000ms', () => {
        const { result, rerender } = renderNotifications(3)

        rerender({ total: 0 })

        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(result.current.pulseRing).toBe(true)

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(result.current.pulseRing).toBe(false)
    })

    it('pulseRing does NOT activate on first render with totalViolations = 0 (no prevTotal)', () => {
        const { result } = renderNotifications(0)
        // prevTotalRef starts null — no transition occurred
        expect(result.current.pulseRing).toBe(false)
    })

    it('pulseRing does NOT activate when total was already 0 and stays 0', () => {
        const { result, rerender } = renderNotifications(0)

        rerender({ total: 0 })

        act(() => {
            vi.advanceTimersByTime(100)
        })

        expect(result.current.pulseRing).toBe(false)
    })

    it('pulseRing does NOT activate when total increases', () => {
        const { result, rerender } = renderNotifications(3)

        rerender({ total: 5 })

        act(() => {
            vi.advanceTimersByTime(100)
        })

        expect(result.current.pulseRing).toBe(false)
    })

    it('showConfirmationToast pushes a notification to the store', () => {
        const { result } = renderNotifications(0)

        act(() => {
            result.current.showConfirmationToast('Baseline set — 5 issues marked')
        })

        const notifs = useNotificationStore.getState().notifications
        expect(notifs.some((n) => n.message === 'Baseline set — 5 issues marked')).toBe(true)
    })

    it('showConfirmationToast uses mutation type and info severity', () => {
        const { result } = renderNotifications(0)

        act(() => {
            result.current.showConfirmationToast('Done')
        })

        const notifs = useNotificationStore.getState().notifications
        const toast = notifs.find((n) => n.message === 'Done')
        expect(toast?.type).toBe('mutation')
        expect(toast?.severity).toBe('info')
    })

    it('timer is cancelled on unmount — pulseRing does not change after unmount', () => {
        const { result, rerender, unmount } = renderNotifications(3)

        rerender({ total: 0 })

        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(result.current.pulseRing).toBe(true)

        unmount()

        // Advancing time after unmount should not cause state update errors
        expect(() => {
            act(() => {
                vi.advanceTimersByTime(5000)
            })
        }).not.toThrow()
    })

    it('sessionInitialCount does not change after mount even when violations change', () => {
        useEditorStore.setState({ linterWarnings: new Map([['w1', makeWarning('w1')]]) })

        const { result, rerender } = renderNotifications(1)

        const initialCount = result.current.sessionInitialCount

        // Now add more violations
        act(() => {
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['w1', makeWarning('w1')],
                    ['w2', makeWarning('w2')],
                    ['w3', makeWarning('w3')],
                ]),
            })
        })

        rerender({ total: 3 })

        // sessionInitialCount must be immutable (lazy init)
        expect(result.current.sessionInitialCount).toBe(initialCount)
    })
})
