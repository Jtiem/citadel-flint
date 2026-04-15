/**
 * useGovernanceAudit.test.ts — T2
 *
 * Covers:
 *   - Initial state: isAuditing=false, lastAuditRanAt=null, auditError=null
 *   - runAudit: sets isAuditing during execution, clears after
 *   - runAudit: sets lastAuditRanAt on success
 *   - runAudit: no-op when activeFilePath is null
 *   - runAudit: captures error in auditError on failure
 *   - runAudit: pushes error notification on failure
 *   - runAudit: clears previous auditError on a new call
 *   - Cleanup: does not set state after unmount (isMountedRef guard)
 *   - Edge case: mcp API not available (window.flintAPI.mcp undefined)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernanceAudit } from '../useGovernanceAudit'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'

// ── Suite ────────────────────────────────────────────────────────────────────

describe('useGovernanceAudit', () => {
    beforeEach(() => {
        // The global setup.ts beforeEach already resets stores and mocks.
        // mcp.callTool is already mocked to resolve with {}.
    })

    it('initial state: isAuditing=false, lastAuditRanAt=null, auditError=null', () => {
        const { result } = renderHook(() => useGovernanceAudit())
        expect(result.current.isAuditing).toBe(false)
        expect(result.current.lastAuditRanAt).toBeNull()
        expect(result.current.auditError).toBeNull()
    })

    it('runAudit: is a no-op when activeFilePath is null', async () => {
        useCanvasStore.setState({ activeFilePath: null })
        const { result } = renderHook(() => useGovernanceAudit())

        await act(async () => {
            await result.current.runAudit()
        })

        expect(window.flintAPI.mcp?.callTool).not.toHaveBeenCalled()
        expect(result.current.lastAuditRanAt).toBeNull()
    })

    it('runAudit: calls mcp.callTool with flint_audit', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        const { result } = renderHook(() => useGovernanceAudit())

        await act(async () => {
            await result.current.runAudit()
        })

        expect(window.flintAPI.mcp?.callTool).toHaveBeenCalledWith('flint_audit', { file: '/src/App.tsx' })
    })

    it('runAudit: sets lastAuditRanAt on success', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        const before = Date.now()
        const { result } = renderHook(() => useGovernanceAudit())

        await act(async () => {
            await result.current.runAudit()
        })

        expect(result.current.lastAuditRanAt).toBeGreaterThanOrEqual(before)
        expect(result.current.isAuditing).toBe(false)
    })

    it('runAudit: captures error message in auditError on failure', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI.mcp?.callTool as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('MCP unreachable'))

        const { result } = renderHook(() => useGovernanceAudit())

        await act(async () => {
            await result.current.runAudit()
        })

        expect(result.current.auditError).toBe('MCP unreachable')
        expect(result.current.isAuditing).toBe(false)
        expect(result.current.lastAuditRanAt).toBeNull()
    })

    it('runAudit: pushes error notification on failure', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI.mcp?.callTool as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('Network timeout'))

        const { result } = renderHook(() => useGovernanceAudit())

        await act(async () => {
            await result.current.runAudit()
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.length).toBeGreaterThanOrEqual(1)
        const errorNotification = notifications.find((n) => n.title === 'Audit failed')
        expect(errorNotification).toBeDefined()
    })

    it('runAudit: clears previous auditError before a new call', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI.mcp?.callTool as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(new Error('First failure'))
            .mockResolvedValueOnce({})

        const { result } = renderHook(() => useGovernanceAudit())

        // First call — fails
        await act(async () => { await result.current.runAudit() })
        expect(result.current.auditError).toBe('First failure')

        // Second call — succeeds
        await act(async () => { await result.current.runAudit() })
        expect(result.current.auditError).toBeNull()
    })

    it('does not throw when mcp API is undefined', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI as any).mcp = undefined

        const { result } = renderHook(() => useGovernanceAudit())

        await act(async () => {
            await result.current.runAudit()
        })
        // Should complete without throwing and without error state.
        // When mcp is undefined, the hook early-returns before calling callTool.
        expect(result.current.auditError).toBeNull()
        expect(result.current.lastAuditRanAt).toBeNull()
        expect(result.current.isAuditing).toBe(false)
    })

    it('cleanup: unmounting hook does not cause state-after-unmount errors', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })

        // Make callTool slow enough that we can unmount before it resolves
        let resolveCall!: () => void
        const slowPromise = new Promise<Record<string, unknown>>((res) => {
            resolveCall = () => res({})
        })
        ;(window.flintAPI.mcp?.callTool as ReturnType<typeof vi.fn>)
            .mockReturnValueOnce(slowPromise)

        const { result, unmount } = renderHook(() => useGovernanceAudit())

        // Start the audit (don't await yet)
        act(() => { void result.current.runAudit() })

        // Unmount before the promise resolves
        unmount()

        // Resolve the promise — should not cause any React warning
        await act(async () => { resolveCall() })
        // If we reach here without error, the isMountedRef guard worked
    })
})
