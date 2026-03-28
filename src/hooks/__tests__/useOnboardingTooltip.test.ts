/**
 * useOnboardingTooltip.test.ts — src/hooks/__tests__/useOnboardingTooltip.test.ts
 *
 * OPP-17: Contextual one-time tooltips tracked in localStorage.
 *
 * Covers:
 *   1. shouldShow is true on first access (no prior localStorage entry)
 *   2. shouldShow is false after dismiss() is called
 *   3. dismiss() writes localStorage key 'flint:tooltip:<key>'
 *   4. shouldShow is false on mount when localStorage already has 'dismissed'
 *   5. Different keys are independent — dismissing one does not dismiss another
 *   6. dismiss() is idempotent — calling twice has no additional effect
 *   7. localStorage unavailable — shouldShow defaults to false (fail-safe)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboardingTooltip } from '../useOnboardingTooltip'

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: vi.fn((key: string): string | null => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value }),
        removeItem: vi.fn((key: string) => { delete store[key] }),
        clear: vi.fn(() => { store = {} }),
        get length() { return Object.keys(store).length },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
        // Expose internal store for assertions
        _store: () => store,
    }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useOnboardingTooltip', () => {
    it('shouldShow is true on first access when localStorage has no entry', () => {
        const { result } = renderHook(() => useOnboardingTooltip('first-violation'))
        expect(result.current.shouldShow).toBe(true)
    })

    it('shouldShow is false after dismiss() is called', () => {
        const { result } = renderHook(() => useOnboardingTooltip('first-violation'))
        expect(result.current.shouldShow).toBe(true)

        act(() => { result.current.dismiss() })

        expect(result.current.shouldShow).toBe(false)
    })

    it('dismiss() writes the dismissed flag to localStorage', () => {
        const { result } = renderHook(() => useOnboardingTooltip('health-tab-unlock'))

        act(() => { result.current.dismiss() })

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'flint:tooltip:health-tab-unlock',
            'dismissed'
        )
    })

    it('shouldShow is false on mount when localStorage already has dismissed flag', () => {
        // Pre-set the dismissed flag before mounting
        localStorageMock.setItem('flint:tooltip:agents-tab-activity', 'dismissed')

        const { result } = renderHook(() => useOnboardingTooltip('agents-tab-activity'))

        expect(result.current.shouldShow).toBe(false)
    })

    it('different keys are independent', () => {
        const { result: r1 } = renderHook(() => useOnboardingTooltip('tooltip-a'))
        const { result: r2 } = renderHook(() => useOnboardingTooltip('tooltip-b'))

        // Dismiss only tooltip-a
        act(() => { r1.current.dismiss() })

        expect(r1.current.shouldShow).toBe(false)
        expect(r2.current.shouldShow).toBe(true)
    })

    it('dismiss() is idempotent — calling twice does not throw', () => {
        const { result } = renderHook(() => useOnboardingTooltip('idempotent-key'))

        act(() => { result.current.dismiss() })
        act(() => { result.current.dismiss() })

        expect(result.current.shouldShow).toBe(false)
        // setItem called twice but that's OK — idempotent behavior
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(2)
    })

    it('uses the correct localStorage key format "flint:tooltip:<key>"', () => {
        const key = 'my-unique-tooltip'
        renderHook(() => useOnboardingTooltip(key))

        // getItem is called during initialization with the correct key
        expect(localStorageMock.getItem).toHaveBeenCalledWith(`flint:tooltip:${key}`)
    })

    it('handles localStorage being unavailable (fail-safe returns false)', () => {
        // Override localStorage.getItem to throw
        const original = localStorageMock.getItem.getMockImplementation?.()
        localStorageMock.getItem.mockImplementationOnce(() => {
            throw new Error('localStorage not available')
        })

        const { result } = renderHook(() => useOnboardingTooltip('safe-key'))

        // Should default to false (safe, no tooltip crash)
        expect(result.current.shouldShow).toBe(false)

        if (original) localStorageMock.getItem.mockImplementation(original)
    })
})
