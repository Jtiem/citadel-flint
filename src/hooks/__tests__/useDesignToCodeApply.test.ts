/**
 * useDesignToCodeApply.test.ts — src/hooks/__tests__/useDesignToCodeApply.test.ts
 *
 * Phase D2C.2b: Tests for the Design-to-Code apply hook.
 *
 * Covers:
 *   1. Calls IPC and updates stores on success
 *   2. Shows error notification on IPC failure (rejected promise)
 *   3. Shows error notification when result.ok === false
 *   4. Sets isApplying true during flight, false after success
 *   5. Sets isApplying false after failure
 *   6. Handles missing flintAPI gracefully (no crash, returns false)
 *   7. Handles missing designToCode sub-API gracefully (no crash, returns false)
 *   8. Returns false when apply fails (ok === false)
 *   9. Returns false when IPC throws
 *  10. Shows error with message from result.error when ok === false
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDesignToCodeApply } from '../useDesignToCodeApply'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { D2CApplyRequest, D2CApplyResult, FileTreeNode } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<D2CApplyRequest> = {}): D2CApplyRequest {
    return {
        pageName: 'LandingPage',
        components: [
            { name: 'HeroSection', code: 'export function HeroSection() { return <div />; }' },
            { name: 'FeatureSection', code: 'export function FeatureSection() { return <div />; }' },
        ],
        page: {
            name: 'LandingPage',
            code: 'export default function LandingPage() { return <div />; }',
        },
        ...overrides,
    }
}

function makeWorkspaceTree(): FileTreeNode {
    return {
        name: 'src',
        path: '/project/src',
        type: 'directory',
        children: [
            {
                name: 'LandingPage.tsx',
                path: '/project/src/components/generated/LandingPage/LandingPage.tsx',
                type: 'file',
                children: [],
            },
        ],
    }
}

function makeSuccessResult(overrides: Partial<D2CApplyResult> = {}): D2CApplyResult {
    return {
        ok: true,
        pageFilePath: '/project/src/components/generated/LandingPage/LandingPage.tsx',
        componentFilePaths: [
            '/project/src/components/generated/LandingPage/HeroSection.tsx',
            '/project/src/components/generated/LandingPage/FeatureSection.tsx',
        ],
        workspaceTree: makeWorkspaceTree(),
        ...overrides,
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let applyFn: ReturnType<typeof vi.fn>

beforeEach(() => {
    applyFn = vi.fn().mockResolvedValue(makeSuccessResult())

    ;(window as unknown as Record<string, unknown>).flintAPI = {
        designToCode: {
            apply: applyFn,
        },
        // setActiveFile calls window.flintAPI.readFile — stub it to avoid
        // IPC errors during the canvasStore.setActiveFile call in the hook.
        readFile: vi.fn().mockResolvedValue('export default function LandingPage() { return <div />; }'),
    }

    // Reset stores to known state before each test.
    useCanvasStore.setState({
        workspaceFiles: null,
        activeFilePath: null,
        saveState: 'idle',
    })
    useNotificationStore.setState({ notifications: [], history: [] })
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDesignToCodeApply', () => {
    it('returns isApplying: false initially', () => {
        const { result } = renderHook(() => useDesignToCodeApply())
        expect(result.current.isApplying).toBe(false)
    })

    it('calls window.flintAPI.designToCode.apply with the request', async () => {
        const { result } = renderHook(() => useDesignToCodeApply())
        const request = makeRequest()

        await act(async () => {
            await result.current.applyDesignToCode(request)
        })

        expect(applyFn).toHaveBeenCalledTimes(1)
        expect(applyFn).toHaveBeenCalledWith(request)
    })

    it('updates workspace tree on success', async () => {
        const tree = makeWorkspaceTree()
        applyFn.mockResolvedValue(makeSuccessResult({ workspaceTree: tree }))

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        expect(useCanvasStore.getState().workspaceFiles).toEqual(tree)
    })

    it('sets activeFilePath to the page compositor path on success', async () => {
        const pageFilePath = '/project/src/components/generated/LandingPage/LandingPage.tsx'
        applyFn.mockResolvedValue(makeSuccessResult({ pageFilePath }))

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        expect(useCanvasStore.getState().activeFilePath).toBe(pageFilePath)
    })

    it('shows success notification on success', async () => {
        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest({ pageName: 'LandingPage' }))
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications).toHaveLength(1)
        expect(notifications[0].severity).toBe('success')
        expect(notifications[0].message).toContain('LandingPage')
    })

    it('returns true when apply succeeds', async () => {
        const { result } = renderHook(() => useDesignToCodeApply())
        let returnValue: boolean | undefined

        await act(async () => {
            returnValue = await result.current.applyDesignToCode(makeRequest())
        })

        expect(returnValue).toBe(true)
    })

    it('sets isApplying true during flight and false after success', async () => {
        let resolveApply!: (value: D2CApplyResult) => void
        applyFn.mockReturnValue(new Promise<D2CApplyResult>((res) => { resolveApply = res }))

        const { result } = renderHook(() => useDesignToCodeApply())

        let applyPromise: Promise<boolean>
        act(() => {
            applyPromise = result.current.applyDesignToCode(makeRequest())
        })

        // isApplying should be true while in-flight
        expect(result.current.isApplying).toBe(true)

        await act(async () => {
            resolveApply(makeSuccessResult())
            await applyPromise
        })

        expect(result.current.isApplying).toBe(false)
    })

    it('sets isApplying false after IPC rejection', async () => {
        applyFn.mockRejectedValue(new Error('IPC error'))

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        expect(result.current.isApplying).toBe(false)
    })

    it('shows error notification when IPC rejects', async () => {
        applyFn.mockRejectedValue(new Error('Network timeout'))

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications).toHaveLength(1)
        expect(notifications[0].severity).toBe('error')
        expect(notifications[0].message).toContain('Network timeout')
    })

    it('returns false when IPC rejects', async () => {
        applyFn.mockRejectedValue(new Error('IPC failure'))

        const { result } = renderHook(() => useDesignToCodeApply())
        let returnValue: boolean | undefined

        await act(async () => {
            returnValue = await result.current.applyDesignToCode(makeRequest())
        })

        expect(returnValue).toBe(false)
    })

    it('shows error notification when result.ok is false', async () => {
        applyFn.mockResolvedValue({ ok: false, error: 'No project open', pageFilePath: '', componentFilePaths: [], workspaceTree: makeWorkspaceTree() })

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications).toHaveLength(1)
        expect(notifications[0].severity).toBe('error')
        expect(notifications[0].message).toContain('No project open')
    })

    it('returns false when result.ok is false', async () => {
        applyFn.mockResolvedValue({ ok: false, error: 'No project open', pageFilePath: '', componentFilePaths: [], workspaceTree: makeWorkspaceTree() })

        const { result } = renderHook(() => useDesignToCodeApply())
        let returnValue: boolean | undefined

        await act(async () => {
            returnValue = await result.current.applyDesignToCode(makeRequest())
        })

        expect(returnValue).toBe(false)
    })

    it('shows fallback error message when result.ok is false and error is undefined', async () => {
        applyFn.mockResolvedValue({ ok: false, pageFilePath: '', componentFilePaths: [], workspaceTree: makeWorkspaceTree() })

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        const notifications = useNotificationStore.getState().notifications
        expect(notifications).toHaveLength(1)
        expect(notifications[0].severity).toBe('error')
        expect(notifications[0].message).toBeTruthy()
    })

    it('does not update stores when result.ok is false', async () => {
        const originalTree = makeWorkspaceTree()
        useCanvasStore.setState({ workspaceFiles: originalTree })

        applyFn.mockResolvedValue({ ok: false, error: 'No project open', pageFilePath: '', componentFilePaths: [], workspaceTree: makeWorkspaceTree() })

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        // workspaceFiles should not have been updated
        expect(useCanvasStore.getState().workspaceFiles).toEqual(originalTree)
    })

    it('handles missing window.flintAPI gracefully (no crash, returns false)', async () => {
        ;(window as unknown as Record<string, unknown>).flintAPI = undefined

        const { result } = renderHook(() => useDesignToCodeApply())
        let returnValue: boolean | undefined

        await act(async () => {
            returnValue = await result.current.applyDesignToCode(makeRequest())
        })

        expect(returnValue).toBe(false)
        const notifications = useNotificationStore.getState().notifications
        expect(notifications).toHaveLength(1)
        expect(notifications[0].severity).toBe('error')
    })

    it('handles missing designToCode sub-API gracefully (no crash, returns false)', async () => {
        ;(window as unknown as Record<string, unknown>).flintAPI = {
            // flintAPI present but designToCode not wired (older preload)
            ping: vi.fn(),
        }

        const { result } = renderHook(() => useDesignToCodeApply())
        let returnValue: boolean | undefined

        await act(async () => {
            returnValue = await result.current.applyDesignToCode(makeRequest())
        })

        expect(returnValue).toBe(false)
        const notifications = useNotificationStore.getState().notifications
        expect(notifications).toHaveLength(1)
        expect(notifications[0].severity).toBe('error')
    })

    it('sets isApplying false after result.ok === false (no exception thrown)', async () => {
        applyFn.mockResolvedValue({ ok: false, error: 'bad', pageFilePath: '', componentFilePaths: [], workspaceTree: makeWorkspaceTree() })

        const { result } = renderHook(() => useDesignToCodeApply())

        await act(async () => {
            await result.current.applyDesignToCode(makeRequest())
        })

        expect(result.current.isApplying).toBe(false)
    })
})
