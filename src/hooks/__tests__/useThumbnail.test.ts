/**
 * useThumbnail.test.ts — Phase CV2.2: Component Thumbnail Generator
 *
 * Tests the useThumbnail hook with mocked window.flintAPI.thumbnails.
 *
 * Coverage:
 *   TH-01 — returns loading state initially
 *   TH-02 — returns data URL after cache hit
 *   TH-03 — triggers generate on cache miss then get
 *   TH-04 — returns error when generation fails
 *   TH-05 — re-fetches when componentName changes
 *   TH-06 — does not re-fetch on unrelated re-renders
 *   TH-07 — handles missing flintAPI gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useThumbnail } from '../useThumbnail'

// ── Type for the flintAPI mock ────────────────────────────────────────────────

type ThumbnailsMock = {
    get: ReturnType<typeof vi.fn>
    generate: ReturnType<typeof vi.fn>
}

function makeMock(overrides: Partial<ThumbnailsMock> = {}): ThumbnailsMock {
    return {
        get: vi.fn().mockResolvedValue(null),
        generate: vi.fn().mockResolvedValue({ componentName: 'Button', thumbnailPath: '/p/Button.png', generated: true, error: null }),
        ...overrides,
    }
}

function setupFlintAPI(mock: ThumbnailsMock | null): void {
    if (mock === null) {
        delete (window as unknown as Record<string, unknown>).flintAPI
        return
    }
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        thumbnails: mock,
    }
}

const COMPONENT_NAME = 'Button'
const FILE_PATH = '/Users/dev/project/src/Button.tsx'
const DATA_URL = 'data:image/png;base64,abc123'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useThumbnail', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TH-01: returns loading state initially', () => {
        const mock = makeMock({
            get: vi.fn().mockReturnValue(new Promise(() => { /* never resolves */ })),
        })
        setupFlintAPI(mock)

        const { result } = renderHook(() => useThumbnail(COMPONENT_NAME, FILE_PATH))

        // Synchronously verify the initial state
        expect(result.current.isLoading).toBe(true)
        expect(result.current.dataUrl).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('TH-02: returns data URL after cache hit', async () => {
        const mock = makeMock({
            get: vi.fn().mockResolvedValue(DATA_URL),
        })
        setupFlintAPI(mock)

        const { result } = renderHook(() => useThumbnail(COMPONENT_NAME, FILE_PATH))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.dataUrl).toBe(DATA_URL)
        expect(result.current.error).toBeNull()
        // generate() should NOT have been called on a cache hit
        expect(mock.generate).not.toHaveBeenCalled()
    })

    it('TH-03: triggers generate on cache miss, then re-reads', async () => {
        const mock = makeMock({
            // First call: cache miss; second call (after generate): hit
            get: vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(DATA_URL),
            generate: vi.fn().mockResolvedValue({
                componentName: COMPONENT_NAME,
                thumbnailPath: '/p/Button.png',
                generated: true,
                error: null,
            }),
        })
        setupFlintAPI(mock)

        const { result } = renderHook(() => useThumbnail(COMPONENT_NAME, FILE_PATH))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.dataUrl).toBe(DATA_URL)
        expect(result.current.error).toBeNull()
        expect(mock.generate).toHaveBeenCalledOnce()
        expect(mock.generate).toHaveBeenCalledWith({ filePath: FILE_PATH, componentName: COMPONENT_NAME })
        // get() called twice: initial check + re-read after generate
        expect(mock.get).toHaveBeenCalledTimes(2)
    })

    it('TH-04: returns error when generation fails', async () => {
        const ERROR_MSG = 'Babel transform failed'
        const mock = makeMock({
            get: vi.fn().mockResolvedValue(null),
            generate: vi.fn().mockResolvedValue({
                componentName: COMPONENT_NAME,
                thumbnailPath: '',
                generated: false,
                error: ERROR_MSG,
            }),
        })
        setupFlintAPI(mock)

        const { result } = renderHook(() => useThumbnail(COMPONENT_NAME, FILE_PATH))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.dataUrl).toBeNull()
        expect(result.current.error).toBe(ERROR_MSG)
    })

    it('TH-05: re-fetches when componentName changes', async () => {
        const mock = makeMock({
            get: vi.fn().mockResolvedValue(DATA_URL),
        })
        setupFlintAPI(mock)

        const { result, rerender } = renderHook(
            ({ name }: { name: string }) => useThumbnail(name, FILE_PATH),
            { initialProps: { name: 'Button' } }
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(mock.get).toHaveBeenCalledWith('Button')

        // Change the componentName
        act(() => {
            rerender({ name: 'Card' })
        })

        await waitFor(() => {
            expect(mock.get).toHaveBeenCalledWith('Card')
        })
    })

    it('TH-06: does not re-fetch on unrelated re-renders', async () => {
        const mock = makeMock({
            get: vi.fn().mockResolvedValue(DATA_URL),
        })
        setupFlintAPI(mock)

        const { result, rerender } = renderHook(
            ({ name, path: filePath }: { name: string; path: string }) =>
                useThumbnail(name, filePath),
            { initialProps: { name: COMPONENT_NAME, path: FILE_PATH } }
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        const callCountAfterMount = mock.get.mock.calls.length

        // Re-render with the same props (simulate parent re-render)
        rerender({ name: COMPONENT_NAME, path: FILE_PATH })

        // Give it a tick to settle
        await new Promise((r) => setTimeout(r, 10))

        // No additional get() calls should have fired
        expect(mock.get.mock.calls.length).toBe(callCountAfterMount)
    })

    it('TH-07: handles missing flintAPI gracefully', async () => {
        setupFlintAPI(null)

        const { result } = renderHook(() => useThumbnail(COMPONENT_NAME, FILE_PATH))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.dataUrl).toBeNull()
        expect(result.current.error).not.toBeNull()
        expect(result.current.error).toContain('thumbnails is not available')
    })
})
