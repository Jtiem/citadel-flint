/**
 * useGovernanceTimers.test.ts — src/hooks/__tests__/useGovernanceTimers.test.ts
 *
 * T13: Tests for useGovernanceTimers (H13).
 *
 * Covers:
 *   - schedule(fn, ms) calls fn after the delay
 *   - cleared timers do not fire after unmount
 *   - clearAll() cancels all pending timers
 *   - multiple timers can be scheduled independently
 *   - schedule cleans up its own handle on fire (no leak)
 *   - re-mount creates a fresh registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGovernanceTimers } from '../useGovernanceTimers'

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('useGovernanceTimers', () => {
    it('returns schedule and clearAll functions', () => {
        const { result } = renderHook(() => useGovernanceTimers())
        expect(typeof result.current.schedule).toBe('function')
        expect(typeof result.current.clearAll).toBe('function')
    })

    it('schedule fires callback after the specified delay', () => {
        const fn = vi.fn()
        const { result } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn, 500)
        })

        expect(fn).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(500)
        })

        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('cancels pending timers on unmount — callback does not fire', () => {
        const fn = vi.fn()
        const { result, unmount } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn, 1000)
        })

        unmount()

        act(() => {
            vi.advanceTimersByTime(2000)
        })

        expect(fn).not.toHaveBeenCalled()
    })

    it('clearAll cancels all pending timers immediately', () => {
        const fn1 = vi.fn()
        const fn2 = vi.fn()
        const { result } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn1, 500)
            result.current.schedule(fn2, 1000)
        })

        act(() => {
            result.current.clearAll()
        })

        act(() => {
            vi.advanceTimersByTime(2000)
        })

        expect(fn1).not.toHaveBeenCalled()
        expect(fn2).not.toHaveBeenCalled()
    })

    it('multiple timers fire independently at their own delays', () => {
        const fn1 = vi.fn()
        const fn2 = vi.fn()
        const { result } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn1, 200)
            result.current.schedule(fn2, 800)
        })

        act(() => {
            vi.advanceTimersByTime(400)
        })

        expect(fn1).toHaveBeenCalledTimes(1)
        expect(fn2).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(600)
        })

        expect(fn2).toHaveBeenCalledTimes(1)
    })

    it('fired timer handle is removed from the internal set (no double-fire on clearAll)', () => {
        const fn = vi.fn()
        const { result } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn, 100)
        })

        // Let it fire
        act(() => {
            vi.advanceTimersByTime(200)
        })

        expect(fn).toHaveBeenCalledTimes(1)

        // clearAll should be a no-op now (handle was already removed)
        act(() => {
            result.current.clearAll()
        })

        // Still only 1 call
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('clearAll after unmount does not throw', () => {
        const { result, unmount } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(vi.fn(), 500)
        })

        unmount()

        // Should not throw even after unmount
        expect(() => {
            act(() => {
                result.current.clearAll()
            })
        }).not.toThrow()
    })

    it('schedule with zero delay fires synchronously after advanceTimersByTime(0)', () => {
        const fn = vi.fn()
        const { result } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn, 0)
        })

        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('re-mount creates an independent registry — old unmount does not cancel new timers', () => {
        const fn = vi.fn()

        const { unmount: unmountFirst } = renderHook(() => useGovernanceTimers())
        unmountFirst()

        const { result } = renderHook(() => useGovernanceTimers())

        act(() => {
            result.current.schedule(fn, 300)
        })

        act(() => {
            vi.advanceTimersByTime(400)
        })

        expect(fn).toHaveBeenCalledTimes(1)
    })
})
