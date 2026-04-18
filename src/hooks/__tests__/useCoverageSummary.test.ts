/**
 * useCoverageSummary.test.ts — src/hooks/__tests__/useCoverageSummary.test.ts
 *
 * Phase 0 — Coverage Honesty
 *
 * Tests the runtime behavior of useCoverageSummary:
 *   1. Calls getCoverageSummary once on mount
 *   2. Exposes the resolved summary
 *   3. Subscribes to mcp.onEvent and refetches on "debt-scan-complete"
 *   4. Ignores events that are not "debt-scan-complete"
 *   5. Unsubscribes on unmount
 *   6. Tracks isLoading correctly during initial fetch
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCoverageSummary } from '../useCoverageSummary'
import type { CoverageSummary } from '../../../shared/coverage-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSkippedByReason(overrides: Partial<Record<string, number>> = {}): CoverageSummary['skippedFilesByReason'] {
    return {
        'css-in-js-detected': 0,
        'external-stylesheet-imported': 0,
        'css-modules-reference': 0,
        'dynamic-class-expression': 0,
        'unresolvable-var': 0,
        'tailwind-config-extension': 0,
        'non-jsx-framework': 0,
        'non-literal-ternary-branch': 0,
        ...overrides,
    }
}

function makeSummary(overrides: Partial<CoverageSummary> = {}): CoverageSummary {
    return {
        governedSurfacePercent: 100,
        totalFiles: 10,
        parsedFiles: 10,
        partialFiles: 0,
        skippedFiles: 0,
        skippedFilesByReason: makeSkippedByReason(),
        timestamp: new Date().toISOString(),
        ...overrides,
    }
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

let getSummaryFn: ReturnType<typeof vi.fn>
let onEventFn: ReturnType<typeof vi.fn>
let removeEventListenerFn: ReturnType<typeof vi.fn>

/** Captured MCP event handler registered by the hook. */
let capturedOnEventHandler: ((events: unknown[]) => void) | null = null

beforeEach(() => {
    capturedOnEventHandler = null
    getSummaryFn = vi.fn().mockResolvedValue(makeSummary())
    removeEventListenerFn = vi.fn()
    onEventFn = vi.fn().mockImplementation((cb: (events: unknown[]) => void) => {
        capturedOnEventHandler = cb
    })

    ;(window as unknown as Record<string, unknown>).flintAPI = {
        coverage: {
            getSummary: getSummaryFn,
        },
        mcp: {
            onEvent: onEventFn,
            removeEventListener: removeEventListenerFn,
        },
    }
})

afterEach(() => {
    vi.restoreAllMocks()
    // Clean up any flintAPI stub so other tests start fresh.
    delete (window as unknown as Record<string, unknown>).flintAPI
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCoverageSummary', () => {
    it('calls getCoverageSummary exactly once on mount', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(getSummaryFn).toHaveBeenCalledTimes(1)
    })

    it('exposes the resolved summary after the IPC call resolves', async () => {
        const expected = makeSummary({
            governedSurfacePercent: 60,
            totalFiles: 5,
            parsedFiles: 3,
            partialFiles: 1,
            skippedFiles: 1,
        })
        getSummaryFn.mockResolvedValue(expected)

        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(result.current.summary).toEqual(expected)
    })

    it('subscribes to mcp.onEvent on mount', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(onEventFn).toHaveBeenCalledTimes(1)
        expect(typeof capturedOnEventHandler).toBe('function')
    })

    it('calls refetch when a debt-scan-complete event arrives via eventType', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        // getSummary called once so far (mount)
        expect(getSummaryFn).toHaveBeenCalledTimes(1)

        // Simulate a debt-scan-complete event arriving
        const updatedSummary = makeSummary({ governedSurfacePercent: 80, parsedFiles: 8, totalFiles: 10 })
        getSummaryFn.mockResolvedValue(updatedSummary)

        await act(async () => {
            capturedOnEventHandler!([{ eventType: 'debt-scan-complete', timestamp: Date.now() }])
        })

        await waitFor(() => expect(getSummaryFn).toHaveBeenCalledTimes(2))
        expect(result.current.summary?.governedSurfacePercent).toBe(80)
    })

    it('calls refetch when a debt-scan-complete event arrives via type field', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(getSummaryFn).toHaveBeenCalledTimes(1)

        const updatedSummary = makeSummary({ governedSurfacePercent: 70 })
        getSummaryFn.mockResolvedValue(updatedSummary)

        await act(async () => {
            capturedOnEventHandler!([{ type: 'debt-scan-complete', timestamp: Date.now() }])
        })

        await waitFor(() => expect(getSummaryFn).toHaveBeenCalledTimes(2))
        expect(result.current.summary?.governedSurfacePercent).toBe(70)
    })

    it('ignores events that are not debt-scan-complete', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(getSummaryFn).toHaveBeenCalledTimes(1)

        await act(async () => {
            capturedOnEventHandler!([
                { type: 'violation', severity: 'warning', summary: 'some violation', timestamp: Date.now() },
                { type: 'audit', summary: 'audit done', timestamp: Date.now() },
                { eventType: 'mutation', timestamp: Date.now() },
            ])
        })

        // No additional getSummary calls — none of these events match
        expect(getSummaryFn).toHaveBeenCalledTimes(1)
    })

    it('only triggers one refetch per batch even if multiple debt-scan-complete events arrive', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(getSummaryFn).toHaveBeenCalledTimes(1)

        await act(async () => {
            capturedOnEventHandler!([
                { eventType: 'debt-scan-complete', timestamp: Date.now() },
                { eventType: 'debt-scan-complete', timestamp: Date.now() },
            ])
        })

        // Should only trigger a single refetch for the batch
        await waitFor(() => expect(getSummaryFn).toHaveBeenCalledTimes(2))
    })

    it('calls removeEventListener on unmount', async () => {
        const { result, unmount } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        unmount()

        expect(removeEventListenerFn).toHaveBeenCalledTimes(1)
    })

    it('starts with isLoading=true before the first IPC call resolves', async () => {
        // Make getSummary take a tick so we can observe the loading state.
        let resolveSummary!: (value: CoverageSummary) => void
        getSummaryFn.mockReturnValue(new Promise<CoverageSummary>((resolve) => {
            resolveSummary = resolve
        }))

        const { result } = renderHook(() => useCoverageSummary())

        // Immediately after mount, before the promise resolves, isLoading must be true.
        expect(result.current.isLoading).toBe(true)
        expect(result.current.summary).toBeNull()

        // Resolve the promise and wait for the state update.
        await act(async () => {
            resolveSummary(makeSummary())
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.summary).not.toBeNull()
    })

    it('sets isLoading=false after the initial fetch completes', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
    })

    it('degrades gracefully when window.flintAPI.coverage is absent', async () => {
        // Remove the coverage namespace to simulate a missing IPC layer.
        ;(window as unknown as Record<string, unknown>).flintAPI = {
            mcp: {
                onEvent: onEventFn,
                removeEventListener: removeEventListenerFn,
            },
        }

        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        // Summary remains null — no crash.
        expect(result.current.summary).toBeNull()
    })

    it('degrades gracefully when window.flintAPI is absent entirely', async () => {
        delete (window as unknown as Record<string, unknown>).flintAPI

        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.summary).toBeNull()
    })

    it('exposes a stable refetch function that can be called manually', async () => {
        const { result } = renderHook(() => useCoverageSummary())

        await waitFor(() => expect(result.current.summary).not.toBeNull())

        expect(getSummaryFn).toHaveBeenCalledTimes(1)

        const updatedSummary = makeSummary({ governedSurfacePercent: 50 })
        getSummaryFn.mockResolvedValue(updatedSummary)

        await act(async () => {
            await result.current.refetch()
        })

        expect(getSummaryFn).toHaveBeenCalledTimes(2)
        expect(result.current.summary?.governedSurfacePercent).toBe(50)
    })
})
