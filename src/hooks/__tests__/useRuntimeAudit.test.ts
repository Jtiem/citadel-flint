/**
 * useRuntimeAudit.test.ts
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract test boundaries:
 *   - `useRuntimeAudit happy path`
 *   - `useRuntimeAudit serialization` (invariant `serialization` = 1 IPC call)
 *   - `useRuntimeAudit error surfacing`
 *   - `useRuntimeAudit reset on file change`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRuntimeAudit } from '../useRuntimeAudit'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { RuntimeAuditResult } from '../../types/runtime-audit'

function makeResult(
    overrides: Partial<RuntimeAuditResult> = {},
): RuntimeAuditResult {
    return {
        status: 'passed',
        timestamp: new Date().toISOString(),
        axeVersion: '4.10.3',
        nodeCount: 12,
        durationMs: 50,
        violations: [],
        ...overrides,
    }
}

beforeEach(() => {
    // Ensure store is clean.
    useCanvasStore.setState({ runtimeFindings: null })
})

describe('useRuntimeAudit — happy path', () => {
    it('calls window.flintAPI.runtime.runAxe exactly once and writes result to canvasStore', async () => {
        const runAxe = vi.fn().mockResolvedValue(
            makeResult({ status: 'violations', violations: [] }),
        )
        ;(window as unknown as { flintAPI: { runtime: { runAxe: typeof runAxe } } })
            .flintAPI.runtime.runAxe = runAxe

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(runAxe).toHaveBeenCalledTimes(1)
        expect(useCanvasStore.getState().runtimeFindings?.status).toBe(
            'violations',
        )
    })

    it('result getter reflects canvasStore.runtimeFindings', async () => {
        const response = makeResult({ status: 'passed' })
        ;(window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } })
            .flintAPI.runtime.runAxe = vi.fn().mockResolvedValue(response)

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(result.current.result?.axeVersion).toBe('4.10.3')
    })

    it('status transitions idle → running → passed on success', async () => {
        let resolveFn: (value: RuntimeAuditResult) => void = () => {}
        const runAxe = vi.fn().mockReturnValue(
            new Promise<RuntimeAuditResult>((resolve) => {
                resolveFn = resolve
            }),
        )
        ;(window as unknown as { flintAPI: { runtime: { runAxe: typeof runAxe } } })
            .flintAPI.runtime.runAxe = runAxe

        const { result } = renderHook(() => useRuntimeAudit())

        expect(result.current.status).toBe('idle')

        let runPromise: Promise<void> | undefined
        act(() => {
            runPromise = result.current.run({ previewHtml: '<div></div>' })
        })

        await waitFor(() => {
            expect(result.current.status).toBe('running')
        })

        await act(async () => {
            resolveFn(makeResult({ status: 'passed' }))
            await runPromise
        })

        expect(result.current.status).toBe('passed')
    })
})

// ── Contract invariant: serialization (= 1 IPC call) ─────────────────────────

describe('useRuntimeAudit — serialization (invariant: = 1 IPC call)', () => {
    it('a second run() while status=running is a no-op — runAxe invoked exactly once', async () => {
        let resolveFn: (value: RuntimeAuditResult) => void = () => {}
        const runAxe = vi.fn().mockReturnValue(
            new Promise<RuntimeAuditResult>((resolve) => {
                resolveFn = resolve
            }),
        )
        ;(window as unknown as { flintAPI: { runtime: { runAxe: typeof runAxe } } })
            .flintAPI.runtime.runAxe = runAxe

        const { result } = renderHook(() => useRuntimeAudit())

        // Two back-to-back calls before the first resolves.
        let firstRun: Promise<void> | undefined
        let secondRun: Promise<void> | undefined
        act(() => {
            firstRun = result.current.run({ previewHtml: '<div></div>' })
            secondRun = result.current.run({ previewHtml: '<div></div>' })
        })

        // Wait for both to settle. Second should be a no-op (no IPC fired).
        await act(async () => {
            resolveFn(makeResult({ status: 'passed' }))
            await Promise.all([firstRun!, secondRun!])
        })

        // The invariant: ONE IPC call total.
        expect(runAxe).toHaveBeenCalledTimes(1)
    })

    it('no error notification is emitted for the rejected second call', async () => {
        let resolveFn: (value: RuntimeAuditResult) => void = () => {}
        ;(window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } })
            .flintAPI.runtime.runAxe = vi.fn().mockReturnValue(
                new Promise<RuntimeAuditResult>((resolve) => {
                    resolveFn = resolve
                }),
            )

        const pushSpy = vi.spyOn(useNotificationStore.getState(), 'push')

        const { result } = renderHook(() => useRuntimeAudit())

        let firstRun: Promise<void> | undefined
        let secondRun: Promise<void> | undefined
        act(() => {
            firstRun = result.current.run({ previewHtml: '<div></div>' })
            secondRun = result.current.run({ previewHtml: '<div></div>' })
        })

        await act(async () => {
            resolveFn(makeResult({ status: 'passed' }))
            await Promise.all([firstRun!, secondRun!])
        })

        // No error toast for the rejected call (contract edge case).
        expect(pushSpy).not.toHaveBeenCalled()
    })
})

// ── Contract boundary: error surfacing ───────────────────────────────────────

describe('useRuntimeAudit — error surfacing', () => {
    it('IPC rejection emits a notification with severity "error"', async () => {
        const runAxe = vi.fn().mockRejectedValue(new Error('sandbox spawn failed'))
        ;(window as unknown as { flintAPI: { runtime: { runAxe: typeof runAxe } } })
            .flintAPI.runtime.runAxe = runAxe

        const pushSpy = vi.spyOn(useNotificationStore.getState(), 'push')

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(pushSpy).toHaveBeenCalledTimes(1)
        const pushed = pushSpy.mock.calls[0][0]
        expect(pushed.severity).toBe('error')
    })

    it('canvasStore.runtimeFindings remains null after IPC rejection', async () => {
        ;(window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } })
            .flintAPI.runtime.runAxe = vi.fn().mockRejectedValue(
                new Error('sandbox spawn failed'),
            )

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(useCanvasStore.getState().runtimeFindings).toBeNull()
    })

    it('hook status transitions to "error"', async () => {
        ;(window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } })
            .flintAPI.runtime.runAxe = vi.fn().mockRejectedValue(
                new Error('sandbox spawn failed'),
            )

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(result.current.status).toBe('error')
    })

    it('autoDismissMs matches the 8000ms pattern used by other error toasts', async () => {
        ;(window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } })
            .flintAPI.runtime.runAxe = vi.fn().mockRejectedValue(new Error('oops'))

        const pushSpy = vi.spyOn(useNotificationStore.getState(), 'push')

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(pushSpy.mock.calls[0][0].autoDismissMs).toBe(8000)
    })

    it('hook surfaces "Runtime audit unavailable" when IPC surface is missing', async () => {
        // Remove the runtime namespace to simulate pre-Group-A environment.
        delete (window as unknown as { flintAPI: { runtime?: unknown } }).flintAPI.runtime

        const pushSpy = vi.spyOn(useNotificationStore.getState(), 'push')

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(pushSpy).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe('error')
    })
})

// ── Contract boundary: reset ─────────────────────────────────────────────────

describe('useRuntimeAudit — reset', () => {
    it('reset() clears canvasStore.runtimeFindings and status', async () => {
        ;(window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } })
            .flintAPI.runtime.runAxe = vi.fn().mockResolvedValue(makeResult({ status: 'passed' }))

        const { result } = renderHook(() => useRuntimeAudit())

        await act(async () => {
            await result.current.run({ previewHtml: '<div></div>' })
        })

        expect(useCanvasStore.getState().runtimeFindings).not.toBeNull()

        act(() => {
            result.current.reset()
        })

        expect(useCanvasStore.getState().runtimeFindings).toBeNull()
        expect(result.current.status).toBe('idle')
    })
})

// ── Contract boundary: reset on file change (store-level integration) ─────────

describe('useRuntimeAudit — reset on file change', () => {
    it('canvasStore.runtimeFindings is cleared when activeFilePath changes via setActiveFile', async () => {
        // setActiveFile is the canonical code path that changes activeFilePath
        // in production. The store implementation clears runtimeFindings
        // inline on the `set({ activeFilePath, ..., runtimeFindings: null })`
        // call. This test exercises the store directly — the hook relies on
        // this guarantee.

        ;(window as unknown as { flintAPI: { readFile: ReturnType<typeof vi.fn> } })
            .flintAPI.readFile = vi.fn().mockResolvedValue('// empty\n')

        // Seed the store with runtimeFindings.
        useCanvasStore.setState({
            runtimeFindings: makeResult({ status: 'passed' }),
        })
        expect(useCanvasStore.getState().runtimeFindings).not.toBeNull()

        // Call setActiveFile — the clear-on-file-change path.
        await act(async () => {
            await useCanvasStore.getState().setActiveFile('/tmp/new.tsx')
        })

        expect(useCanvasStore.getState().runtimeFindings).toBeNull()
    })
})
