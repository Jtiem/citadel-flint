/**
 * useSyncActions.test.ts — src/hooks/__tests__/useSyncActions.test.ts
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Covers the full useSyncActions contract surface:
 *   - ready flag tracks window.flintAPI availability
 *   - pull / push / resolve / pullOne / connect happy paths
 *   - serialization — concurrent actions rejected while syncOp != null
 *   - error path — lastError + error notification severity
 *   - auth-expired path — lastError.persistent=true + critical notification
 *   - confirmPush / confirmResolve guards block MCP call on false/null
 *   - onAfterSync fires on success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSyncActions } from '../useSyncActions'
import { useNotificationStore } from '../../store/notificationStore'

// Helper — typed accessor for the mocked mcp.callTool stub populated by setup.ts.
function getCallToolMock() {
    return window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>
}

describe('useSyncActions', () => {
    beforeEach(() => {
        // Reset notification store between tests so notification assertions
        // don't leak across cases.
        useNotificationStore.setState({ notifications: [], history: [] })
        // Default: every call resolves with a clean, success-y result.
        getCallToolMock().mockResolvedValue({
            isError: false,
            content: [{ type: 'text', text: 'ok' }],
        })
    })

    // ── Ready flag ────────────────────────────────────────────────────────────

    it('returns ready=true when window.flintAPI.mcp.callTool is a function', () => {
        const { result } = renderHook(() => useSyncActions())
        expect(result.current.ready).toBe(true)
    })

    it('returns ready=false when window.flintAPI is missing', async () => {
        const previous = window.flintAPI
        delete (window as unknown as { flintAPI?: unknown }).flintAPI
        try {
            const { result } = renderHook(() => useSyncActions())
            expect(result.current.ready).toBe(false)
        } finally {
            ;(window as unknown as { flintAPI: typeof previous }).flintAPI = previous
        }
    })

    // ── pull ──────────────────────────────────────────────────────────────────

    it('pull() invokes flint_sync_pull with {} exactly once and fires onAfterSync', async () => {
        const onAfterSync = vi.fn()
        const { result } = renderHook(() => useSyncActions({ onAfterSync }))

        await act(async () => {
            await result.current.pull()
        })

        const mock = getCallToolMock()
        expect(mock).toHaveBeenCalledTimes(1)
        expect(mock).toHaveBeenCalledWith('flint_sync_pull', {})
        expect(onAfterSync).toHaveBeenCalledTimes(1)

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.length).toBeGreaterThan(0)
        expect(notifications[0].severity).toBe('success')
        expect(notifications[0].type).toBe('sync')
    })

    it('pull() clears lastError after a successful call', async () => {
        // First call fails, second succeeds
        getCallToolMock()
            .mockResolvedValueOnce({ isError: true, content: [{ type: 'text', text: 'boom' }] })
            .mockResolvedValueOnce({ isError: false, content: [{ type: 'text', text: 'ok' }] })

        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })
        expect(result.current.lastError?.tool).toBe('flint_sync_pull')

        await act(async () => {
            await result.current.pull()
        })
        expect(result.current.lastError).toBeNull()
    })

    // ── push ──────────────────────────────────────────────────────────────────

    it('push() invokes flint_sync_push when confirmPush resolves true', async () => {
        const confirmPush = vi.fn().mockResolvedValue(true)
        const { result } = renderHook(() => useSyncActions({ confirmPush }))

        await act(async () => {
            await result.current.push()
        })

        expect(confirmPush).toHaveBeenCalledTimes(1)
        const mock = getCallToolMock()
        expect(mock).toHaveBeenCalledTimes(1)
        expect(mock).toHaveBeenCalledWith('flint_sync_push', {})
    })

    it('push() does NOT invoke mcp.callTool when confirmPush resolves false', async () => {
        const confirmPush = vi.fn().mockResolvedValue(false)
        const { result } = renderHook(() => useSyncActions({ confirmPush }))

        await act(async () => {
            await result.current.push()
        })

        expect(confirmPush).toHaveBeenCalledTimes(1)
        expect(getCallToolMock()).not.toHaveBeenCalled()
    })

    it('push() without a confirmPush callback still fires (caller-controlled gating)', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.push()
        })

        expect(getCallToolMock()).toHaveBeenCalledWith('flint_sync_push', {})
    })

    // ── resolve ───────────────────────────────────────────────────────────────

    it('resolve("prefer-figma") invokes flint_resolve_all with the strategy', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.resolve('prefer-figma')
        })

        expect(getCallToolMock()).toHaveBeenCalledWith('flint_resolve_all', {
            strategy: 'prefer-figma',
        })
    })

    it('resolve("prefer-local") forwards the strategy equivalently', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.resolve('prefer-local')
        })

        expect(getCallToolMock()).toHaveBeenCalledWith('flint_resolve_all', {
            strategy: 'prefer-local',
        })
    })

    it('resolve() respects confirmResolve returning null (abort)', async () => {
        const confirmResolve = vi.fn().mockResolvedValue(null)
        const { result } = renderHook(() => useSyncActions({ confirmResolve }))

        await act(async () => {
            await result.current.resolve('prefer-figma')
        })

        expect(getCallToolMock()).not.toHaveBeenCalled()
    })

    it('resolve() overrides the argument when confirmResolve returns a different strategy', async () => {
        const confirmResolve = vi.fn().mockResolvedValue('prefer-local')
        const { result } = renderHook(() => useSyncActions({ confirmResolve }))

        await act(async () => {
            await result.current.resolve('prefer-figma')
        })

        expect(getCallToolMock()).toHaveBeenCalledWith('flint_resolve_all', {
            strategy: 'prefer-local',
        })
    })

    // ── pullOne ───────────────────────────────────────────────────────────────

    it('pullOne() invokes flint_sync_pull with { scope: "token", tokenPath }', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pullOne('colors.primary')
        })

        expect(getCallToolMock()).toHaveBeenCalledWith('flint_sync_pull', {
            scope: 'token',
            tokenPath: 'colors.primary',
        })
    })

    it('pullOne() records lastError when the MCP tool rejects the scope arg', async () => {
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'scope arg not supported' }],
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pullOne('colors.primary')
        })

        expect(result.current.lastError?.tool).toBe('flint_sync_pull')
        expect(result.current.lastError?.message).toContain('scope arg not supported')
        // Does NOT fall back to full pull — only 1 call made.
        expect(getCallToolMock()).toHaveBeenCalledTimes(1)
    })

    // ── connect ───────────────────────────────────────────────────────────────

    it('connect() invokes flint_figma_connect with { action: "connect" }', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.connect()
        })

        expect(getCallToolMock()).toHaveBeenCalledWith('flint_figma_connect', {
            action: 'connect',
        })
    })

    // FIX-6 (UX WARN-1/2): plain-language connect toast, no "Alliance" /
    // no "OAuth" / no premature "Figma connected" headline.
    it('connect() emits a plain-language toast that does not leak Citadel vocabulary', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.connect()
        })

        const notifications = useNotificationStore.getState().notifications
        const toast = notifications[0]
        expect(toast).toBeDefined()
        expect(toast.title).toBe('Opening Figma')
        expect(toast.message).not.toMatch(/Alliance/i)
        expect(toast.message).not.toMatch(/OAuth/i)
        expect(toast.title).not.toBe('Figma connected')
    })

    // ── FIX-3 (Security WARN-2): sanitize user-visible MCP error text ─────────

    it('collapses the renderer allowlist dump into a short, human-safe toast', async () => {
        const raw =
            'mcp:call-tool — tool "flint_ast_mutate" is not in the renderer allowlist. ' +
            'Only these tools can be called from Glass: flint_status, flint_audit, flint_debt_report, flint_query_registry, flint_generate_dbom, flint_accessibility_report, flint_audit_report, flint_sync_pull, flint_sync_push, flint_resolve_all, flint_sync_check, flint_figma_connect'
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: raw }],
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        const notifications = useNotificationStore.getState().notifications
        const errorToast = notifications.find((n) => n.severity === 'error')
        expect(errorToast).toBeDefined()
        expect(errorToast?.message).not.toContain('flint_ast_mutate')
        expect(errorToast?.message).not.toContain('flint_status')
        expect(errorToast?.message).toMatch(/Glass UI/)
        // The lastError.message is also sanitized.
        expect(result.current.lastError?.message).not.toContain('flint_ast_mutate')
    })

    it('redacts secret-shaped tokens in MCP error text before surfacing', async () => {
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'Upstream failure: sk-ant-abcdef0123456789abcdef-01' }],
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        const notifications = useNotificationStore.getState().notifications
        const errorToast = notifications.find((n) => n.severity === 'error')
        expect(errorToast?.message).toContain('[REDACTED]')
        expect(errorToast?.message).not.toContain('sk-ant-abcdef')
    })

    // ── FIX-5 (Security WARN-3): runtime Zod guard on ResolveStrategy ─────────

    it('resolve() rejects an invalid strategy without invoking mcp.callTool', async () => {
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            // Intentional hostile cast — simulates an `as any` at the caller.
            await result.current.resolve('bogus-strategy' as unknown as 'prefer-figma')
        })

        expect(getCallToolMock()).not.toHaveBeenCalled()
        expect(result.current.lastError?.tool).toBe('flint_resolve_all')
        expect(result.current.lastError?.message).toMatch(/invalid/i)

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.some((n) => n.severity === 'error')).toBe(true)
    })

    // ── Serialization ─────────────────────────────────────────────────────────

    it('serializes concurrent actions — two quick pull() calls invoke the MCP tool exactly once', async () => {
        // Hold the first call pending so the second one fires while syncOp != null.
        let resolveFirst: ((v: unknown) => void) | undefined
        const firstCall = new Promise((r) => {
            resolveFirst = r
        })
        getCallToolMock()
            .mockImplementationOnce(() => firstCall)
            .mockResolvedValue({ isError: false, content: [{ type: 'text', text: 'ok' }] })

        const { result } = renderHook(() => useSyncActions())

        // Fire both calls synchronously before awaiting either.
        await act(async () => {
            void result.current.pull()
            // Same tick — second call should hit the serialization guard because
            // the ref was set before the micro-task yields.
            void result.current.pull()
        })

        // Only 1 call dispatched despite 2 invocations.
        expect(getCallToolMock()).toHaveBeenCalledTimes(1)

        // Release the first call so the hook can clean up.
        await act(async () => {
            resolveFirst?.({ isError: false, content: [{ type: 'text', text: 'ok' }] })
            await firstCall
        })

        await waitFor(() => {
            expect(result.current.syncOp).toBeNull()
        })
    })

    // ── Error paths ───────────────────────────────────────────────────────────

    it('sets lastError and pushes an error notification when MCP returns isError=true', async () => {
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'network timeout' }],
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        expect(result.current.lastError?.tool).toBe('flint_sync_pull')
        expect(result.current.lastError?.message).toBe('network timeout')
        expect(result.current.lastError?.persistent).toBe(false)

        const notifications = useNotificationStore.getState().notifications
        const errorToast = notifications.find((n) => n.severity === 'error')
        expect(errorToast).toBeDefined()
        expect(errorToast?.autoDismissMs).toBe(8000)
    })

    it('marks lastError.persistent=true and emits a critical notification on auth-expired error', async () => {
        // Phase 3 refactor: persistent flag is now driven by result.classification
        // (classification='auth-expired'), not just keyword-text matching.
        // The keyword-fallback survives as a backstop until Phase 4.
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'auth-expired: re-authenticate with Figma' }],
            classification: 'auth-expired', // Phase 3: structured field
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        expect(result.current.lastError?.persistent).toBe(true)

        const notifications = useNotificationStore.getState().notifications
        const criticalToast = notifications.find((n) => n.severity === 'critical')
        expect(criticalToast).toBeDefined()
        // critical severity is forced to persistent (autoDismissMs=0) by the
        // notification store regardless of our requested value.
        expect(criticalToast?.autoDismissMs).toBe(0)
    })

    // ── Phase 3: classification field drives persistent flag ─────────────────
    // boundary: useSyncActions consumes classification

    it('[Phase 3] sets lastError.persistent=true from result.classification="auth-expired" (not text matching)', async () => {
        // boundary: useSyncActions consumes classification
        // The classification field is the primary signal; the hook should read
        // result.classification rather than scanning rawText.
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'Figma OAuth session expired' }], // no "auth-expired" keyword
            classification: 'auth-expired', // but structured field is present
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        // persistent=true must be driven by classification='auth-expired'
        expect(result.current.lastError?.persistent).toBe(true)
    })

    it('[Phase 3] unclassified error (classification=undefined) → persistent=false', async () => {
        // boundary: useSyncActions consumes classification — edge: unclassified → persistent=false
        // When classification is absent (e.g. older main process not yet updated),
        // the hook should treat it as 'unknown' and set persistent=false.
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'network timeout' }],
            // No classification field — simulates pre-Phase-3 main process
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        expect(result.current.lastError?.persistent).toBe(false)
    })

    it('[Phase 3] classification="rate-limited" also sets persistent=true', async () => {
        // boundary: useSyncActions consumes classification — edge: rate-limited → persistent=true
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'Too many requests, retry after 60s' }],
            classification: 'rate-limited',
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        expect(result.current.lastError?.persistent).toBe(true)
    })

    it('[Phase 3] classification="tool-error" sets persistent=false', async () => {
        // boundary: useSyncActions consumes classification — tool-error is not persistent
        getCallToolMock().mockResolvedValueOnce({
            isError: true,
            content: [{ type: 'text', text: 'projectRoot not found' }],
            classification: 'tool-error',
        })
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        expect(result.current.lastError?.persistent).toBe(false)
    })

    it('catches thrown errors from window.flintAPI and surfaces them via lastError', async () => {
        getCallToolMock().mockRejectedValueOnce(new Error('IPC bridge unavailable'))
        const { result } = renderHook(() => useSyncActions())

        await act(async () => {
            await result.current.pull()
        })

        expect(result.current.lastError?.tool).toBe('flint_sync_pull')
        expect(result.current.lastError?.message).toBe('IPC bridge unavailable')

        const notifications = useNotificationStore.getState().notifications
        expect(notifications.some((n) => n.severity === 'error')).toBe(true)
    })
})
