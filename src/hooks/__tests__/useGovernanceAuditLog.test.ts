/**
 * useGovernanceAuditLog.test.ts
 *
 * Tests for H8: lazy audit log loader + pagination.
 *
 * Boundaries:
 *   - Returns empty entries, false isLoading, false hasMore on init
 *   - Does NOT auto-fetch on mount
 *   - refresh() fetches entries from IPC
 *   - Uses limit+1 trick: hasMore=true when IPC returns limit+1 entries
 *   - Uses limit+1 trick: hasMore=false when IPC returns <= limit entries
 *   - loadMore() increases limit by 20 and re-fetches
 *   - Sets isLoading true while fetching, false after
 *   - Handles IPC failure gracefully (entries=[])
 *   - No-ops when getAuditLog is missing from API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGovernanceAuditLog } from '../useGovernanceAuditLog'

describe('useGovernanceAuditLog', () => {
    beforeEach(() => {
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockResolvedValue([])
    })

    it('returns empty state on init without fetching', () => {
        const { result } = renderHook(() => useGovernanceAuditLog())
        expect(result.current.entries).toEqual([])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.hasMore).toBe(false)
        // getAuditLog should NOT have been called on mount
        expect(window.flintAPI.governance.getAuditLog).not.toHaveBeenCalled()
    })

    it('refresh() fetches entries from IPC', async () => {
        const mockEntries = [
            { id: 1, timestamp: '2026-04-12T10:00:00Z', action: 'fix', filePath: '/src/App.tsx', description: 'Fixed color drift' },
            { id: 2, timestamp: '2026-04-12T10:05:00Z', action: 'audit', filePath: '/src/App.tsx', description: 'Ran audit' },
        ]
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockEntries)

        const { result } = renderHook(() => useGovernanceAuditLog())

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.entries).toHaveLength(2)
        expect(result.current.isLoading).toBe(false)
    })

    it('sets hasMore=true when IPC returns limit+1 entries', async () => {
        // Default page size is 20; return 21 items to trigger hasMore
        const manyEntries = Array.from({ length: 21 }, (_, i) => ({
            id: i + 1,
            timestamp: '2026-04-12T10:00:00Z',
            action: 'fix',
            filePath: '/src/App.tsx',
            description: `Entry ${i + 1}`,
        }))
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockResolvedValue(manyEntries)

        const { result } = renderHook(() => useGovernanceAuditLog())

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.hasMore).toBe(true)
        expect(result.current.entries).toHaveLength(20) // sliced to limit
    })

    it('sets hasMore=false when IPC returns <= limit entries', async () => {
        const fewEntries = Array.from({ length: 5 }, (_, i) => ({
            id: i + 1,
            timestamp: '2026-04-12T10:00:00Z',
            action: 'audit',
            filePath: '/src/App.tsx',
            description: `Entry ${i + 1}`,
        }))
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockResolvedValue(fewEntries)

        const { result } = renderHook(() => useGovernanceAuditLog())

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.hasMore).toBe(false)
        expect(result.current.entries).toHaveLength(5)
    })

    it('loadMore() fetches with increased limit', async () => {
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockResolvedValue([])

        const { result } = renderHook(() => useGovernanceAuditLog())

        await act(async () => {
            await result.current.loadMore()
        })

        // Should have called getAuditLog with limit+1 = 41 (20+20=40, +1 = 41)
        expect(window.flintAPI.governance.getAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 41 }),
        )
    })

    it('handles IPC failure gracefully — sets entries to []', async () => {
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('IPC error'))

        const { result } = renderHook(() => useGovernanceAuditLog())

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.entries).toEqual([])
        expect(result.current.isLoading).toBe(false)
    })

    it('sets isLoading=false after fetch regardless of success', async () => {
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useGovernanceAuditLog())

        await act(async () => {
            await result.current.refresh()
        })

        expect(result.current.isLoading).toBe(false)
    })

    it('does not throw when getAuditLog is missing from API', async () => {
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                getAuditLog: undefined,
            },
        }

        const { result } = renderHook(() => useGovernanceAuditLog())

        await expect(act(async () => {
            await result.current.refresh()
        })).resolves.not.toThrow()
    })
})
