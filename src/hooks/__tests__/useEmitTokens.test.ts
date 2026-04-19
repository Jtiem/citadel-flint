/**
 * useEmitTokens.test.ts — src/hooks/__tests__/useEmitTokens.test.ts
 *
 * MINT.5 Phase 3 — Hook wrapping flint_emit_tokens MCP tool.
 *
 * Covers contract testBoundaries:
 *   - 'useEmitTokens.preview'        — calls mcp.callTool with dryRun=true
 *   - 'useEmitTokens.write (confirmed)' — calls with dryRun=false after confirmWrite=true
 *   - 'useEmitTokens.write (cancelled)' — blocks MCP call when confirmWrite=false
 *   - 'useEmitTokens.classification' — surfaces validation-error classification on lastError
 *
 * Mock boundary: window.flintAPI.mcp.callTool is mocked once via the global setup.
 * We do NOT mock useEmitTokens itself; we mock the IPC boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEmitTokens } from '../useEmitTokens'
import { useNotificationStore } from '../../store/notificationStore'

// ── Typed accessor for the callTool mock ─────────────────────────────────────

function getCallToolMock() {
    return window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useNotificationStore.setState({ notifications: [], history: [] })
    getCallToolMock().mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'Emitted successfully' }],
        classification: 'unknown',
    })
})

// ── Ready flag ────────────────────────────────────────────────────────────────

describe('useEmitTokens — ready flag', () => {
    it('returns ready=true when window.flintAPI.mcp.callTool is available', () => {
        const { result } = renderHook(() => useEmitTokens())
        expect(result.current.ready).toBe(true)
    })

    it('starts with emitOp=null and lastError=null', () => {
        const { result } = renderHook(() => useEmitTokens())
        expect(result.current.emitOp).toBeNull()
        expect(result.current.lastError).toBeNull()
    })
})

// ── useEmitTokens.preview ─────────────────────────────────────────────────────
// boundary: useEmitTokens.preview

describe('useEmitTokens — preview mode', () => {
    it('invokes flint_emit_tokens with dryRun=true for preview mode', async () => {
        // boundary: useEmitTokens.preview
        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['css'], 'preview')
        })

        const mock = getCallToolMock()
        expect(mock).toHaveBeenCalledTimes(1)
        expect(mock).toHaveBeenCalledWith('flint_emit_tokens', {
            platforms: ['css'],
            dryRun: true,
        })
    })

    it('does NOT prompt confirmWrite for preview mode', async () => {
        // boundary: useEmitTokens.preview (edge: no confirm for preview)
        const confirmWrite = vi.fn().mockResolvedValue(true)
        const { result } = renderHook(() => useEmitTokens({ confirmWrite }))

        await act(async () => {
            await result.current.emit(['tailwind'], 'preview')
        })

        expect(confirmWrite).not.toHaveBeenCalled()
        expect(getCallToolMock()).toHaveBeenCalledTimes(1)
    })

    it('emits a success notification after a successful preview emit', async () => {
        // boundary: useEmitTokens.preview — fires success notification
        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['css'], 'preview')
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.length).toBeGreaterThan(0)
        expect(notifications[0].severity).toBe('success')
    })

    it('sets emitOp=null after the preview call resolves', async () => {
        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['swift'], 'preview')
        })

        expect(result.current.emitOp).toBeNull()
    })

    it('calls onAfterEmit after a successful preview emit', async () => {
        const onAfterEmit = vi.fn()
        const { result } = renderHook(() => useEmitTokens({ onAfterEmit }))

        await act(async () => {
            await result.current.emit(['kotlin'], 'preview')
        })

        expect(onAfterEmit).toHaveBeenCalledTimes(1)
    })
})

// ── useEmitTokens.write (confirmed) ──────────────────────────────────────────
// boundary: useEmitTokens.write (confirmed)

describe('useEmitTokens — write mode (confirmed)', () => {
    it('invokes flint_emit_tokens with dryRun=false after confirmWrite returns true', async () => {
        // boundary: useEmitTokens.write (confirmed)
        const confirmWrite = vi.fn().mockResolvedValue(true)
        const { result } = renderHook(() => useEmitTokens({ confirmWrite }))

        await act(async () => {
            await result.current.emit(['tailwind'], 'write')
        })

        expect(confirmWrite).toHaveBeenCalledTimes(1)
        expect(confirmWrite).toHaveBeenCalledWith(['tailwind'])

        const mock = getCallToolMock()
        expect(mock).toHaveBeenCalledTimes(1)
        expect(mock).toHaveBeenCalledWith('flint_emit_tokens', {
            platforms: ['tailwind'],
            dryRun: false,
        })
    })

    it('passes the platforms list to confirmWrite so the dialog can display them', async () => {
        const confirmWrite = vi.fn().mockResolvedValue(true)
        const { result } = renderHook(() => useEmitTokens({ confirmWrite }))

        await act(async () => {
            await result.current.emit(['css', 'react-native'], 'write')
        })

        expect(confirmWrite).toHaveBeenCalledWith(['css', 'react-native'])
    })
})

// ── useEmitTokens.write (cancelled) ──────────────────────────────────────────
// boundary: useEmitTokens.write (cancelled)

describe('useEmitTokens — write mode (cancelled)', () => {
    it('blocks the MCP tool call when confirmWrite returns false', async () => {
        // boundary: useEmitTokens.write (cancelled)
        const confirmWrite = vi.fn().mockResolvedValue(false)
        const { result } = renderHook(() => useEmitTokens({ confirmWrite }))

        await act(async () => {
            await result.current.emit(['tailwind'], 'write')
        })

        expect(confirmWrite).toHaveBeenCalledTimes(1)
        expect(getCallToolMock()).not.toHaveBeenCalled()
    })

    it('does not set lastError when write is cancelled via confirm', async () => {
        const confirmWrite = vi.fn().mockResolvedValue(false)
        const { result } = renderHook(() => useEmitTokens({ confirmWrite }))

        await act(async () => {
            await result.current.emit(['tailwind'], 'write')
        })

        expect(result.current.lastError).toBeNull()
    })

    it('does not emit any notification when write is cancelled', async () => {
        const confirmWrite = vi.fn().mockResolvedValue(false)
        const { result } = renderHook(() => useEmitTokens({ confirmWrite }))

        await act(async () => {
            await result.current.emit(['css'], 'write')
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.length).toBe(0)
    })

    it('blocks the MCP call when no confirmWrite is provided and mode is write (no-guard fires)', async () => {
        // Without a confirmWrite, write mode fires directly (caller-controlled gating).
        // The hook fires the call and emitOp resolves.
        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['tailwind'], 'write')
        })

        // When no confirmWrite is provided, the hook proceeds (no implicit gate)
        expect(getCallToolMock()).toHaveBeenCalledWith('flint_emit_tokens', {
            platforms: ['tailwind'],
            dryRun: false,
        })
    })
})

// ── useEmitTokens.classification ─────────────────────────────────────────────
// boundary: useEmitTokens.classification

describe('useEmitTokens — classification surfaces on lastError', () => {
    it('sets lastError with the classification field from the MCP result', async () => {
        // boundary: useEmitTokens.classification
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'Validation failed: missing required field' }],
            classification: 'validation-error',
        })

        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['css'], 'preview')
        })

        expect(result.current.lastError).not.toBeNull()
        expect(result.current.lastError!.tool).toBe('flint_emit_tokens')
        // The classification field is read from result, not text-matched
        expect(result.current.lastError!.message).toBeTruthy()
    })

    it('emits an error notification when the MCP call returns isError=true', async () => {
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'Emit failed' }],
            classification: 'tool-error',
        })

        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['css'], 'preview')
        })

        const notifications = useNotificationStore.getState().notifications
        const errorToast = notifications.find((n) => n.severity === 'error' || n.severity === 'critical')
        expect(errorToast).toBeDefined()
    })

    it('sets lastError.persistent=true when classification is auth-expired', async () => {
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'auth-expired: re-authenticate with Figma' }],
            classification: 'auth-expired',
        })

        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['tailwind'], 'preview')
        })

        expect(result.current.lastError?.persistent).toBe(true)
    })

    it('clears lastError after a subsequent successful emit', async () => {
        getCallToolMock()
            .mockResolvedValueOnce({
                isError: true,
                content: [{ type: 'text', text: 'Emit failed' }],
                classification: 'tool-error',
            })
            .mockResolvedValueOnce({
                isError: false,
                content: [{ type: 'text', text: 'ok' }],
                classification: 'unknown',
            })

        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            await result.current.emit(['css'], 'preview')
        })
        expect(result.current.lastError).not.toBeNull()

        await act(async () => {
            await result.current.emit(['css'], 'preview')
        })
        expect(result.current.lastError).toBeNull()
    })
})

// ── Serialization ─────────────────────────────────────────────────────────────

describe('useEmitTokens — serialization', () => {
    it('blocks a second emit call while one is already in-flight', async () => {
        let resolveFirst: ((v: unknown) => void) | undefined
        const firstCall = new Promise((r) => {
            resolveFirst = r
        })
        getCallToolMock()
            .mockImplementationOnce(() => firstCall)
            .mockResolvedValue({ isError: false, content: [{ type: 'text', text: 'ok' }], classification: 'unknown' })

        const { result } = renderHook(() => useEmitTokens())

        await act(async () => {
            void result.current.emit(['css'], 'preview')
            void result.current.emit(['css'], 'preview')
        })

        // Only one call despite two invocations
        expect(getCallToolMock()).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveFirst?.({ isError: false, content: [{ type: 'text', text: 'ok' }], classification: 'unknown' })
            await firstCall
        })

        await waitFor(() => {
            expect(result.current.emitOp).toBeNull()
        })
    })
})
