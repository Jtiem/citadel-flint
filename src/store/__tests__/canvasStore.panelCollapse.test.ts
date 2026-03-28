/**
 * canvasStore.panelCollapse.test.ts
 *
 * GLASS.3.2 — Panel collapse/expand state tests.
 *
 * Covers:
 *   PC-01: leftPanelWidth defaults to 224
 *   PC-02: rightPanelWidth defaults to 288
 *   PC-03: toggleLeftPanel collapses (width -> 0, collapsed -> true)
 *   PC-04: toggleLeftPanel again restores previous width
 *   PC-05: toggleRightPanel collapses (width -> 0, collapsed -> true)
 *   PC-06: toggleRightPanel again restores previous width
 *   PC-07: closeWorkspace resets panel state
 *   PC-08: setLeftPanelWidth updates width
 *   PC-09: setRightPanelWidth updates width
 *   PC-10: collapse preserves custom width through round-trip
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../canvasStore'

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useCanvasStore.setState({
        leftPanelWidth: 224,
        rightPanelWidth: 288,
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        _leftPanelSavedWidth: 224,
        _rightPanelSavedWidth: 288,
    })
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GLASS.3.2: Panel collapse/expand', () => {
    // PC-01
    it('leftPanelWidth defaults to 224', () => {
        expect(useCanvasStore.getState().leftPanelWidth).toBe(224)
    })

    // PC-02
    it('rightPanelWidth defaults to 288', () => {
        expect(useCanvasStore.getState().rightPanelWidth).toBe(288)
    })

    // PC-03
    it('toggleLeftPanel collapses (width -> 0, collapsed -> true)', () => {
        useCanvasStore.getState().toggleLeftPanel()
        const state = useCanvasStore.getState()
        expect(state.leftPanelWidth).toBe(0)
        expect(state.leftPanelCollapsed).toBe(true)
    })

    // PC-04
    it('toggleLeftPanel again restores previous width', () => {
        useCanvasStore.getState().toggleLeftPanel() // collapse
        useCanvasStore.getState().toggleLeftPanel() // expand
        const state = useCanvasStore.getState()
        expect(state.leftPanelWidth).toBe(224)
        expect(state.leftPanelCollapsed).toBe(false)
    })

    // PC-05
    it('toggleRightPanel collapses (width -> 0, collapsed -> true)', () => {
        useCanvasStore.getState().toggleRightPanel()
        const state = useCanvasStore.getState()
        expect(state.rightPanelWidth).toBe(0)
        expect(state.rightPanelCollapsed).toBe(true)
    })

    // PC-06
    it('toggleRightPanel again restores previous width', () => {
        useCanvasStore.getState().toggleRightPanel() // collapse
        useCanvasStore.getState().toggleRightPanel() // expand
        const state = useCanvasStore.getState()
        expect(state.rightPanelWidth).toBe(288)
        expect(state.rightPanelCollapsed).toBe(false)
    })

    // PC-07
    it('closeWorkspace resets panel state', () => {
        // Collapse both panels and change widths
        useCanvasStore.getState().setLeftPanelWidth(300)
        useCanvasStore.getState().toggleLeftPanel()
        useCanvasStore.getState().setRightPanelWidth(350)
        useCanvasStore.getState().toggleRightPanel()

        useCanvasStore.getState().closeWorkspace()

        const state = useCanvasStore.getState()
        expect(state.leftPanelWidth).toBe(224)
        expect(state.rightPanelWidth).toBe(288)
        expect(state.leftPanelCollapsed).toBe(false)
        expect(state.rightPanelCollapsed).toBe(false)
        expect(state._leftPanelSavedWidth).toBe(224)
        expect(state._rightPanelSavedWidth).toBe(288)
    })

    // PC-08
    it('setLeftPanelWidth updates width', () => {
        useCanvasStore.getState().setLeftPanelWidth(300)
        expect(useCanvasStore.getState().leftPanelWidth).toBe(300)
    })

    // PC-09
    it('setRightPanelWidth updates width', () => {
        useCanvasStore.getState().setRightPanelWidth(350)
        expect(useCanvasStore.getState().rightPanelWidth).toBe(350)
    })

    // PC-10
    it('collapse preserves custom width through round-trip', () => {
        // Set custom width, collapse, then expand — should restore custom width
        useCanvasStore.getState().setLeftPanelWidth(300)
        useCanvasStore.getState().toggleLeftPanel() // collapse: saves 300
        expect(useCanvasStore.getState().leftPanelWidth).toBe(0)

        useCanvasStore.getState().toggleLeftPanel() // expand: restores 300
        expect(useCanvasStore.getState().leftPanelWidth).toBe(300)
    })
})
