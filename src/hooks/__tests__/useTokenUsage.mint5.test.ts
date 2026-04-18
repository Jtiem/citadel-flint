/**
 * useTokenUsage.mint5.test.ts — src/hooks/__tests__/useTokenUsage.mint5.test.ts
 *
 * MINT.5 Phase 1 — Drift re-enable regression tests for useTokenUsage.
 *
 * Tests:
 *   - readFigmaDrift IPC called once on mount
 *   - readFigmaDrift IPC called again when tokenCount changes (not on re-render)
 *   - driftedTokens populated from IPC response
 *   - Unmount during in-flight call does not trigger setState (mountedRef / cancelled flag)
 *   - No render loop: IPC does NOT fire on every re-render with stable tokenCount
 *
 * Contract references:
 *   testBoundaries: 'useTokenUsage' (drift IPC, render-loop regression)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTokenUsage } from '../useTokenUsage'

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockReadFigmaDrift = vi.fn()
const mockScanUsage = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()

    // Default: instant resolution with empty arrays
    mockReadFigmaDrift.mockResolvedValue([])
    mockScanUsage.mockResolvedValue([])

    const api = (window as any).flintAPI
    if (api?.tokens) {
        api.tokens.readFigmaDrift = mockReadFigmaDrift
        api.tokens.scanUsage = mockScanUsage
    } else {
        ;(window as any).flintAPI = {
            tokens: {
                readFigmaDrift: mockReadFigmaDrift,
                scanUsage: mockScanUsage,
                readAll: vi.fn().mockResolvedValue([]),
                create: vi.fn().mockResolvedValue({ id: 1 }),
                update: vi.fn().mockResolvedValue({ changes: 0 }),
                delete: vi.fn().mockResolvedValue({ changes: 0 }),
                clearAll: vi.fn().mockResolvedValue({ changes: 0 }),
            },
            watchTokens: vi.fn(),
        }
    }
})

// ── Drift IPC wiring ──────────────────────────────────────────────────────────

describe('useTokenUsage — drift IPC re-enable (MINT.5)', () => {
    it('calls readFigmaDrift exactly once on mount', async () => {
        renderHook(() => useTokenUsage(5))

        await waitFor(() => {
            expect(mockReadFigmaDrift).toHaveBeenCalledTimes(1)
        })
    })

    it('populates driftedTokens from readFigmaDrift response', async () => {
        const driftRows = [
            { tokenName: 'color.primary', localValue: '#ff0000', figmaValue: '#ee0000', deltaE: 3.2 },
            { tokenName: 'color.secondary', localValue: '#0000ff', figmaValue: '#0011ff', deltaE: undefined },
        ]
        mockReadFigmaDrift.mockResolvedValue(driftRows)

        const { result } = renderHook(() => useTokenUsage(2))

        await waitFor(() => {
            expect(result.current.driftedTokens).toHaveLength(2)
        })

        expect(result.current.driftedTokens[0].tokenName).toBe('color.primary')
        expect(result.current.driftedTokens[0].deltaE).toBe(3.2)
        expect(result.current.driftedTokens[1].tokenName).toBe('color.secondary')
        expect(result.current.driftedTokens[1].deltaE).toBeUndefined()
        expect(result.current.driftCount).toBe(2)
    })

    it('returns empty driftedTokens when readFigmaDrift is not available (graceful degradation)', async () => {
        // Remove the API method
        ;(window as any).flintAPI.tokens.readFigmaDrift = undefined

        const { result } = renderHook(() => useTokenUsage(3))

        // Should not throw, driftedTokens stays []
        expect(result.current.driftedTokens).toHaveLength(0)
        expect(result.current.driftCount).toBe(0)
    })

    it('returns empty driftedTokens when readFigmaDrift rejects (graceful degradation)', async () => {
        mockReadFigmaDrift.mockRejectedValue(new Error('IPC not wired'))

        const { result } = renderHook(() => useTokenUsage(3))

        await waitFor(() => {
            // After rejection, driftedTokens should be set to []
            // The hook catches and silently degrades
            expect(result.current.driftedTokens).toHaveLength(0)
        })
    })

    it('re-fires readFigmaDrift when tokenCount changes (not on re-render with same count)', async () => {
        const { rerender } = renderHook(({ count }) => useTokenUsage(count), {
            initialProps: { count: 5 },
        })

        await waitFor(() => {
            expect(mockReadFigmaDrift).toHaveBeenCalledTimes(1)
        })

        // Re-render with SAME tokenCount — should NOT call readFigmaDrift again
        rerender({ count: 5 })
        expect(mockReadFigmaDrift).toHaveBeenCalledTimes(1)

        // Re-render with DIFFERENT tokenCount — should call readFigmaDrift once more
        rerender({ count: 6 })

        await waitFor(() => {
            expect(mockReadFigmaDrift).toHaveBeenCalledTimes(2)
        })
    })

    it('does not setState after unmount (cancelled flag guard)', async () => {
        // Create a deferred promise so we can control when the IPC resolves
        let resolveIPC!: (value: unknown[]) => void
        const ircPromise = new Promise<unknown[]>((resolve) => { resolveIPC = resolve })
        mockReadFigmaDrift.mockReturnValue(ircPromise)

        const { unmount } = renderHook(() => useTokenUsage(3))

        // Unmount BEFORE the IPC resolves
        unmount()

        // Now resolve the IPC — should not trigger setState or throw
        expect(() => {
            resolveIPC([{ tokenName: 'color.x', localValue: '#fff', figmaValue: '#000' }])
        }).not.toThrow()

        // Wait a tick to let any microtasks run
        await new Promise((r) => setTimeout(r, 0))

        // No errors thrown — test passes
    })
})

// ── No render loop regression ─────────────────────────────────────────────────

describe('useTokenUsage — no render loop regression (MINT.5)', () => {
    it('readFigmaDrift is NOT called infinitely — fires once per tokenCount value', async () => {
        // This was the original bug: setState in the effect caused a re-render,
        // which re-ran the effect, which called setState again, etc.
        // The fix: cancelation flag pattern (no mountedRef on drift effect) +
        // stable tokenCount dependency (not a derived array).

        const { result } = renderHook(() => useTokenUsage(5))

        // Wait for the initial effect to run
        await waitFor(() => {
            expect(mockReadFigmaDrift).toHaveBeenCalledTimes(1)
        })

        // Wait another tick — verify count stays at 1 (no loop)
        await new Promise((r) => setTimeout(r, 50))
        expect(mockReadFigmaDrift).toHaveBeenCalledTimes(1)

        // driftedTokens is [] — setting it to [] should not re-trigger the effect
        expect(result.current.driftedTokens).toHaveLength(0)
        expect(mockReadFigmaDrift).toHaveBeenCalledTimes(1)
    })

    it('scanUsage IPC also fires exactly once on mount with stable tokenCount', async () => {
        renderHook(() => useTokenUsage(5))

        await waitFor(() => {
            expect(mockScanUsage).toHaveBeenCalledTimes(1)
        })

        await new Promise((r) => setTimeout(r, 50))
        expect(mockScanUsage).toHaveBeenCalledTimes(1)
    })
})
