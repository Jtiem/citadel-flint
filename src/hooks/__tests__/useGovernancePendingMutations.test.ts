/**
 * useGovernancePendingMutations.test.ts
 *
 * Tests for H14: S8.3 pending mutations / MRS approval queue state.
 *
 * Boundaries:
 *   - Returns empty pending array initially
 *   - Fetches pending mutations from IPC on mount
 *   - approve(id) calls IPC and removes item from local state
 *   - approve(id) pushes success notification
 *   - reject(id) calls IPC and removes item from local state
 *   - reject(id) pushes warning notification
 *   - Handles IPC failure on approve gracefully (no throw)
 *   - Handles IPC failure on reject gracefully (no throw)
 *   - Sets pending=[] on mount IPC failure
 *   - No-ops when getPendingMutations is missing
 *   - approve/reject are no-ops when respective IPC methods are missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernancePendingMutations } from '../useGovernancePendingMutations'
import { useNotificationStore } from '../../store/notificationStore'

const mockMutations = [
    { id: 1, description: 'Add className', riskTier: 'Amber', agentId: 'claude-3', filePath: '/src/App.tsx' },
    { id: 2, description: 'Remove node', riskTier: 'Red', agentId: 'claude-3', filePath: '/src/Button.tsx' },
]

describe('useGovernancePendingMutations', () => {
    beforeEach(() => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue([])
        ;(window.flintAPI.governance.approveMutation as ReturnType<typeof vi.fn>)
            .mockResolvedValue(undefined)
        ;(window.flintAPI.governance.rejectMutation as ReturnType<typeof vi.fn>)
            .mockResolvedValue(undefined)
    })

    it('returns empty pending array initially', () => {
        const { result } = renderHook(() => useGovernancePendingMutations())
        expect(result.current.pending).toEqual([])
    })

    it('fetches pending mutations from IPC on mount', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)

        const { result } = renderHook(() => useGovernancePendingMutations())

        await waitFor(() => {
            expect(result.current.pending).toHaveLength(2)
        })
    })

    it('sets pending=[] on mount IPC failure', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('IPC error'))

        const { result } = renderHook(() => useGovernancePendingMutations())

        await waitFor(() => {
            expect(result.current.pending).toEqual([])
        })
    })

    it('approve(id) calls approveMutation and removes item from state', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)

        const { result } = renderHook(() => useGovernancePendingMutations())
        await waitFor(() => expect(result.current.pending).toHaveLength(2))

        await act(async () => {
            await result.current.approve('1')
        })

        expect(window.flintAPI.governance.approveMutation).toHaveBeenCalledWith(1)
        expect((result.current.pending as Array<{ id: number }>).find((m) => m.id === 1)).toBeUndefined()
        expect(result.current.pending).toHaveLength(1)
    })

    it('approve(id) pushes success notification', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)

        const { result } = renderHook(() => useGovernancePendingMutations())
        await waitFor(() => expect(result.current.pending).toHaveLength(2))

        await act(async () => {
            await result.current.approve('1')
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.some((n) => n.title === 'Mutation approved')).toBe(true)
    })

    it('reject(id) calls rejectMutation and removes item from state', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)

        const { result } = renderHook(() => useGovernancePendingMutations())
        await waitFor(() => expect(result.current.pending).toHaveLength(2))

        await act(async () => {
            await result.current.reject('2')
        })

        expect(window.flintAPI.governance.rejectMutation).toHaveBeenCalledWith(2)
        expect((result.current.pending as Array<{ id: number }>).find((m) => m.id === 2)).toBeUndefined()
        expect(result.current.pending).toHaveLength(1)
    })

    it('reject(id) pushes warning notification', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)

        const { result } = renderHook(() => useGovernancePendingMutations())
        await waitFor(() => expect(result.current.pending).toHaveLength(2))

        await act(async () => {
            await result.current.reject('2')
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.some((n) => n.title === 'Mutation rejected')).toBe(true)
    })

    it('approve(id) handles IPC failure gracefully without throwing', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)
        ;(window.flintAPI.governance.approveMutation as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('approve failed'))

        const { result } = renderHook(() => useGovernancePendingMutations())
        await waitFor(() => expect(result.current.pending).toHaveLength(2))

        await expect(act(async () => {
            await result.current.approve('1')
        })).resolves.not.toThrow()
    })

    it('reject(id) handles IPC failure gracefully without throwing', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)
        ;(window.flintAPI.governance.rejectMutation as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('reject failed'))

        const { result } = renderHook(() => useGovernancePendingMutations())
        await waitFor(() => expect(result.current.pending).toHaveLength(2))

        await expect(act(async () => {
            await result.current.reject('2')
        })).resolves.not.toThrow()
    })

    it('does not throw when getPendingMutations is missing', () => {
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                getPendingMutations: undefined,
            },
        }

        expect(() => {
            renderHook(() => useGovernancePendingMutations())
        }).not.toThrow()
    })

    it('approve() is no-op when approveMutation is missing', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                approveMutation: undefined,
            },
        }

        const { result } = renderHook(() => useGovernancePendingMutations())

        await expect(act(async () => {
            await result.current.approve('1')
        })).resolves.not.toThrow()
    })

    it('reject() is no-op when rejectMutation is missing', async () => {
        ;(window.flintAPI.governance.getPendingMutations as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockMutations)
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                rejectMutation: undefined,
            },
        }

        const { result } = renderHook(() => useGovernancePendingMutations())

        await expect(act(async () => {
            await result.current.reject('1')
        })).resolves.not.toThrow()
    })
})
