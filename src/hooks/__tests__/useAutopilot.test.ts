/**
 * useAutopilot.test.ts — src/hooks/__tests__/useAutopilot.test.ts
 *
 * Phase REM.2.2: Governance Autopilot lifecycle hook.
 *
 * Covers:
 *   1. Calls flintAPI.autopilot.enable on mount when enabled
 *   2. Calls flintAPI.autopilot.disable on unmount
 *   3. Clears governed result when file changes
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutopilot } from '../useAutopilot'
import { useCanvasStore } from '../../store/canvasStore'
import type { AutopilotResult } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<AutopilotResult> = {}): AutopilotResult {
    return {
        filePath: '/src/App.tsx',
        governedSource: 'export default function App() {}',
        fixableCount: 2,
        mithrilCount: 1,
        a11yCount: 1,
        timestamp: Date.now(),
        ...overrides,
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let enableFn: ReturnType<typeof vi.fn>
let disableFn: ReturnType<typeof vi.fn>
let resultCallback: ((result: AutopilotResult) => void) | null
let onResultFn: ReturnType<typeof vi.fn>

beforeEach(() => {
    resultCallback = null
    enableFn = vi.fn().mockResolvedValue(undefined)
    disableFn = vi.fn().mockResolvedValue(undefined)
    onResultFn = vi.fn().mockImplementation((cb: (result: AutopilotResult) => void) => {
        resultCallback = cb
        // Return the unsubscribe function
        return () => { resultCallback = null }
    })

    ;(window as unknown as Record<string, unknown>).flintAPI = {
        autopilot: {
            enable: enableFn,
            disable: disableFn,
            onResult: onResultFn,
        },
    }

    useCanvasStore.setState({
        autopilotEnabled: false,
        activeFilePath: null,
        governedCode: null,
        governedFixCount: 0,
        governedTimestamp: null,
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAutopilot', () => {
    it('calls flintAPI.autopilot.enable when autopilot is enabled and a file is active', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: '/src/App.tsx',
        })

        renderHook(() => useAutopilot())

        expect(enableFn).toHaveBeenCalledWith('/src/App.tsx')
    })

    it('does not call enable when autopilot is disabled', () => {
        useCanvasStore.setState({
            autopilotEnabled: false,
            activeFilePath: '/src/App.tsx',
        })

        renderHook(() => useAutopilot())

        expect(enableFn).not.toHaveBeenCalled()
    })

    it('does not call enable when no file is active', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: null,
        })

        renderHook(() => useAutopilot())

        expect(enableFn).not.toHaveBeenCalled()
    })

    it('calls flintAPI.autopilot.disable on unmount', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: '/src/App.tsx',
        })

        const { unmount } = renderHook(() => useAutopilot())
        unmount()

        expect(disableFn).toHaveBeenCalled()
    })

    it('stores governed result when a matching result with fixes arrives', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: '/src/App.tsx',
        })

        renderHook(() => useAutopilot())

        act(() => {
            resultCallback?.(makeResult({ filePath: '/src/App.tsx', fixableCount: 3, governedSource: 'const x = 1' }))
        })

        const state = useCanvasStore.getState()
        expect(state.governedCode).toBe('const x = 1')
        expect(state.governedFixCount).toBe(3)
    })

    it('clears governed result when the result has fixableCount = 0', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: '/src/App.tsx',
            governedCode: 'previous code',
            governedFixCount: 2,
        })

        renderHook(() => useAutopilot())

        act(() => {
            resultCallback?.(makeResult({ filePath: '/src/App.tsx', fixableCount: 0 }))
        })

        const state = useCanvasStore.getState()
        expect(state.governedCode).toBeNull()
        expect(state.governedFixCount).toBe(0)
    })

    it('clears governed result when the file path changes', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: '/src/App.tsx',
            governedCode: 'some code',
            governedFixCount: 2,
        })

        const { rerender } = renderHook(() => useAutopilot())

        act(() => {
            useCanvasStore.setState({ activeFilePath: '/src/Button.tsx' })
        })
        rerender()

        // clearGovernedResult is called on cleanup when the effect re-runs
        const state = useCanvasStore.getState()
        expect(state.governedCode).toBeNull()
        expect(state.governedFixCount).toBe(0)
    })

    it('does not update governed result for a result from a different file', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            activeFilePath: '/src/App.tsx',
        })

        renderHook(() => useAutopilot())

        act(() => {
            // Result is for a different file path
            resultCallback?.(makeResult({ filePath: '/src/Button.tsx', fixableCount: 5 }))
        })

        // The store should have been cleared (filePath mismatch triggers clearGovernedResult)
        const state = useCanvasStore.getState()
        expect(state.governedFixCount).toBe(0)
    })
})
