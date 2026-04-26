/**
 * useGovernanceCleanState.test.ts — T9
 *
 * Covers:
 *   - Initial state: lastCleanCommit=null, canRewind=false
 *   - Mount: calls governance.getLastCleanState
 *   - lastCleanCommit: set from IPC response timestamp
 *   - canRewind: true when a clean state exists, false otherwise
 *   - Re-fetches when score changes
 *   - rewindToClean: no-op when lastCleanState is null
 *   - rewindToClean: calls applyUndo() when user confirms
 *   - rewindToClean: does nothing when user cancels confirm dialog
 *   - rewindToClean: pushes success notification on success
 *   - rewindToClean: pushes failure notification when applyUndo throws
 *   - Cleanup: handles IPC unavailability gracefully
 *   - Edge case: getLastCleanState rejects → state remains null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernanceCleanState } from '../useGovernanceCleanState'
import { useNotificationStore } from '../../store/notificationStore'

// Mock applyUndo since it lives in the core layer
vi.mock('../../core/recoveryController', () => ({
    applyUndo: vi.fn().mockResolvedValue(undefined),
}))

import { applyUndo } from '../../core/recoveryController'

// ── Suite ────────────────────────────────────────────────────────────────────

describe('useGovernanceCleanState', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset governance mock to return null
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue(null)

        // Reset window.confirm to default (auto-confirm)
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('initial state: lastCleanCommit=null, canRewind=false before async resolves', () => {
        const { result } = renderHook(() => useGovernanceCleanState({ score: 100 }))
        expect(result.current.lastCleanCommit).toBeNull()
        expect(result.current.canRewind).toBe(false)
    })

    it('calls governance.getLastCleanState on mount', async () => {
        renderHook(() => useGovernanceCleanState({ score: 85 }))
        await waitFor(() => {
            expect(window.flintAPI.governance.getLastCleanState).toHaveBeenCalledTimes(1)
        })
    })

    it('sets lastCleanCommit from IPC response timestamp', async () => {
        const ts = '2026-04-12T10:00:00.000Z'
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ timestamp: ts, score: 98 })

        const { result } = renderHook(() => useGovernanceCleanState({ score: 85 }))

        await waitFor(() => {
            expect(result.current.lastCleanCommit).toBe(ts)
        })
        expect(result.current.canRewind).toBe(true)
    })

    it('canRewind=false when getLastCleanState returns null', async () => {
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue(null)

        const { result } = renderHook(() => useGovernanceCleanState({ score: 50 }))
        await waitFor(() => {
            expect(window.flintAPI.governance.getLastCleanState).toHaveBeenCalled()
        })
        expect(result.current.canRewind).toBe(false)
    })

    it('re-fetches clean state when score prop changes', async () => {
        const { rerender } = renderHook(
            ({ score }) => useGovernanceCleanState({ score }),
            { initialProps: { score: 80 } }
        )

        await waitFor(() => {
            expect(window.flintAPI.governance.getLastCleanState).toHaveBeenCalledTimes(1)
        })

        rerender({ score: 90 })

        await waitFor(() => {
            expect(window.flintAPI.governance.getLastCleanState).toHaveBeenCalledTimes(2)
        })
    })

    it('rewindToClean: no-op when lastCleanState is null', async () => {
        const { result } = renderHook(() => useGovernanceCleanState({ score: 80 }))
        await waitFor(() => {
            expect(result.current.canRewind).toBe(false)
        })

        await act(async () => {
            await result.current.rewindToClean()
        })

        expect(applyUndo).not.toHaveBeenCalled()
        expect(window.confirm).not.toHaveBeenCalled()
    })

    it('rewindToClean: calls applyUndo when user confirms', async () => {
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ timestamp: '2026-04-12T10:00:00.000Z', score: 98 })
        vi.spyOn(window, 'confirm').mockReturnValue(true)

        const { result } = renderHook(() => useGovernanceCleanState({ score: 70 }))
        await waitFor(() => { expect(result.current.canRewind).toBe(true) })

        await act(async () => {
            await result.current.rewindToClean()
        })

        expect(applyUndo).toHaveBeenCalledTimes(1)
    })

    it('rewindToClean: does NOT call applyUndo when user cancels', async () => {
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ timestamp: '2026-04-12T10:00:00.000Z', score: 98 })
        vi.spyOn(window, 'confirm').mockReturnValue(false)

        const { result } = renderHook(() => useGovernanceCleanState({ score: 70 }))
        await waitFor(() => { expect(result.current.canRewind).toBe(true) })

        await act(async () => {
            await result.current.rewindToClean()
        })

        expect(applyUndo).not.toHaveBeenCalled()
    })

    it('rewindToClean: pushes success notification on success', async () => {
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ timestamp: '2026-04-12T10:00:00.000Z', score: 98 })
        vi.mocked(applyUndo).mockResolvedValueOnce(true)

        const { result } = renderHook(() => useGovernanceCleanState({ score: 70 }))
        await waitFor(() => { expect(result.current.canRewind).toBe(true) })

        await act(async () => {
            await result.current.rewindToClean()
        })

        const notifications = useNotificationStore.getState().notifications
        const success = notifications.find((n) => n.title === 'Reverted to clean state')
        expect(success).toBeDefined()
    })

    it('rewindToClean: pushes failure notification when applyUndo throws', async () => {
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ timestamp: '2026-04-12T10:00:00.000Z', score: 98 })
        vi.mocked(applyUndo).mockRejectedValueOnce(new Error('undo failed'))

        const { result } = renderHook(() => useGovernanceCleanState({ score: 70 }))
        await waitFor(() => { expect(result.current.canRewind).toBe(true) })

        await act(async () => {
            await result.current.rewindToClean()
        })

        const notifications = useNotificationStore.getState().notifications
        const failure = notifications.find((n) => n.title === 'Rewind failed')
        expect(failure).toBeDefined()
    })

    it('handles IPC rejection gracefully — state stays null', async () => {
        ;(window.flintAPI.governance.getLastCleanState as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('IPC error'))

        const { result } = renderHook(() => useGovernanceCleanState({ score: 80 }))

        await waitFor(() => {
            expect(window.flintAPI.governance.getLastCleanState).toHaveBeenCalled()
        })
        expect(result.current.lastCleanCommit).toBeNull()
        expect(result.current.canRewind).toBe(false)
    })

    it('handles missing getLastCleanState API gracefully', async () => {
        ;(window.flintAPI.governance as any).getLastCleanState = undefined

        expect(() => renderHook(() => useGovernanceCleanState({ score: 80 }))).not.toThrow()
    })
})
