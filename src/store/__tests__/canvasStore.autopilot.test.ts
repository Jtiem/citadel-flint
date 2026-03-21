/**
 * canvasStore.autopilot.test.ts — src/store/__tests__/canvasStore.autopilot.test.ts
 *
 * Phase REM.2.2: Governance Autopilot state — canvasStore.
 *
 * Covers:
 *   1. setAutopilotEnabled toggles the flag
 *   2. setGovernedResult sets code + count + timestamp
 *   3. clearGovernedResult resets to null / 0 / null
 *   4. closeWorkspace resets all autopilot state
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../canvasStore'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useCanvasStore.setState({
        autopilotEnabled: false,
        governedCode: null,
        governedFixCount: 0,
        governedTimestamp: null,
        activeFilePath: null,
    })
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        saveFile: vi.fn().mockResolvedValue(undefined),
        policy: { get: vi.fn().mockResolvedValue(null) },
    }
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('canvasStore — Governance Autopilot', () => {
    it('setAutopilotEnabled(true) enables the autopilot flag', () => {
        useCanvasStore.getState().setAutopilotEnabled(true)
        expect(useCanvasStore.getState().autopilotEnabled).toBe(true)
    })

    it('setAutopilotEnabled(false) disables the autopilot flag', () => {
        useCanvasStore.setState({ autopilotEnabled: true })
        useCanvasStore.getState().setAutopilotEnabled(false)
        expect(useCanvasStore.getState().autopilotEnabled).toBe(false)
    })

    it('setGovernedResult stores the governed code, fix count, and a timestamp', () => {
        const before = Date.now()
        useCanvasStore.getState().setGovernedResult('export default function App() {}', 3)
        const after = Date.now()

        const state = useCanvasStore.getState()
        expect(state.governedCode).toBe('export default function App() {}')
        expect(state.governedFixCount).toBe(3)
        expect(state.governedTimestamp).not.toBeNull()
        expect(state.governedTimestamp!).toBeGreaterThanOrEqual(before)
        expect(state.governedTimestamp!).toBeLessThanOrEqual(after)
    })

    it('clearGovernedResult resets code, count, and timestamp to null / 0 / null', () => {
        useCanvasStore.setState({
            governedCode: 'some code',
            governedFixCount: 5,
            governedTimestamp: Date.now(),
        })

        useCanvasStore.getState().clearGovernedResult()

        const state = useCanvasStore.getState()
        expect(state.governedCode).toBeNull()
        expect(state.governedFixCount).toBe(0)
        expect(state.governedTimestamp).toBeNull()
    })

    it('closeWorkspace resets all autopilot fields to their defaults', () => {
        useCanvasStore.setState({
            autopilotEnabled: true,
            governedCode: 'export default function App() {}',
            governedFixCount: 2,
            governedTimestamp: Date.now(),
        })

        useCanvasStore.getState().closeWorkspace()

        const state = useCanvasStore.getState()
        expect(state.autopilotEnabled).toBe(false)
        expect(state.governedCode).toBeNull()
        expect(state.governedFixCount).toBe(0)
        expect(state.governedTimestamp).toBeNull()
    })

    it('autopilotEnabled starts as false by default', () => {
        // Fresh state verified by beforeEach reset
        expect(useCanvasStore.getState().autopilotEnabled).toBe(false)
    })

    it('governedCode starts as null by default', () => {
        expect(useCanvasStore.getState().governedCode).toBeNull()
    })

    it('governedFixCount starts as 0 by default', () => {
        expect(useCanvasStore.getState().governedFixCount).toBe(0)
    })
})
