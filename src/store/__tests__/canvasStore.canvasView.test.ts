/**
 * canvasStore.canvasView.test.ts — src/store/__tests__/canvasStore.canvasView.test.ts
 *
 * Phase CV2.1: Build/Govern Canvas Mode Toggle — store state transition tests.
 *
 * Covers:
 *   CV-STORE-01: Initial canvasView is 'preview'
 *   CV-STORE-02: setCanvasView('build') transitions state to 'build'
 *   CV-STORE-03: setCanvasView('govern') transitions state to 'govern'
 *   CV-STORE-04: setCanvasView('preview') transitions state back to 'preview'
 *   CV-STORE-05: closeWorkspace() resets canvasView to 'preview'
 *   CV-STORE-06: Setting the same view twice is idempotent (no errors)
 *   Boundary: canvasView is orthogonal to canvasMode
 *   Boundary: setCanvasView is a pure state update — only canvasView changes
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../canvasStore'
import type { CanvasView } from '../canvasStore'

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Reset the specific fields under test to their known defaults.
    // Using setState directly avoids importing resetAllStores and its transitive
    // deps — keeps this suite fast and focused.
    useCanvasStore.setState({
        canvasView: 'preview',
        canvasMode: 'design',
        activeFilePath: null,
    })
})

// ── CV-STORE-01 ────────────────────────────────────────────────────────────────

describe('canvasStore — canvasView initial state (CV-STORE-01)', () => {
    it("canvasView defaults to 'preview'", () => {
        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })
})

// ── CV-STORE-02 ────────────────────────────────────────────────────────────────

describe("canvasStore — setCanvasView('build') (CV-STORE-02)", () => {
    it("transitions canvasView from 'preview' to 'build'", () => {
        useCanvasStore.getState().setCanvasView('build')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('build')
    })

    it("transitions canvasView from 'govern' to 'build'", () => {
        useCanvasStore.setState({ canvasView: 'govern' })
        useCanvasStore.getState().setCanvasView('build')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('build')
    })
})

// ── CV-STORE-03 ────────────────────────────────────────────────────────────────

describe("canvasStore — setCanvasView('govern') (CV-STORE-03)", () => {
    it("transitions canvasView from 'preview' to 'govern'", () => {
        useCanvasStore.getState().setCanvasView('govern')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('govern')
    })

    it("transitions canvasView from 'build' to 'govern'", () => {
        useCanvasStore.setState({ canvasView: 'build' })
        useCanvasStore.getState().setCanvasView('govern')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('govern')
    })
})

// ── CV-STORE-04 ────────────────────────────────────────────────────────────────

describe("canvasStore — setCanvasView('preview') (CV-STORE-04)", () => {
    it("transitions canvasView from 'build' back to 'preview'", () => {
        useCanvasStore.setState({ canvasView: 'build' })
        useCanvasStore.getState().setCanvasView('preview')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })

    it("transitions canvasView from 'govern' back to 'preview'", () => {
        useCanvasStore.setState({ canvasView: 'govern' })
        useCanvasStore.getState().setCanvasView('preview')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })
})

// ── CV-STORE-05 ────────────────────────────────────────────────────────────────

describe("canvasStore — closeWorkspace resets canvasView (CV-STORE-05)", () => {
    it("resets canvasView to 'preview' when closing from 'build'", () => {
        useCanvasStore.setState({ canvasView: 'build' })
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })

    it("resets canvasView to 'preview' when closing from 'govern'", () => {
        useCanvasStore.setState({ canvasView: 'govern' })
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })

    it("resets canvasView to 'preview' when already in 'preview' (no-op case)", () => {
        useCanvasStore.setState({ canvasView: 'preview' })
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })
})

// ── CV-STORE-06 ────────────────────────────────────────────────────────────────

describe('canvasStore — setCanvasView idempotency (CV-STORE-06)', () => {
    it("calling setCanvasView with the same value twice does not throw", () => {
        expect(() => {
            useCanvasStore.getState().setCanvasView('build')
            useCanvasStore.getState().setCanvasView('build')
        }).not.toThrow()
    })

    it("canvasView is stable after repeated calls with the same value", () => {
        useCanvasStore.getState().setCanvasView('govern')
        useCanvasStore.getState().setCanvasView('govern')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('govern')
    })

    it("calling setCanvasView('preview') when already 'preview' is a no-op", () => {
        useCanvasStore.getState().setCanvasView('preview')
        useCanvasStore.getState().setCanvasView('preview')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('preview')
    })
})

// ── Boundary: orthogonality with canvasMode ────────────────────────────────────

describe('canvasStore — canvasView is orthogonal to canvasMode', () => {
    it('setCanvasView does not modify canvasMode', () => {
        useCanvasStore.setState({ canvasMode: 'interact' })
        useCanvasStore.getState().setCanvasView('build')

        // canvasMode must be untouched
        expect(useCanvasStore.getState().canvasMode).toBe('interact')
        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('build')
    })

    it('setCanvasMode does not modify canvasView', () => {
        useCanvasStore.setState({ canvasView: 'govern' })
        useCanvasStore.getState().setCanvasMode('interact')

        expect(useCanvasStore.getState().canvasView).toBe<CanvasView>('govern')
        expect(useCanvasStore.getState().canvasMode).toBe('interact')
    })
})

// ── Boundary: only canvasView changes on setCanvasView ────────────────────────

describe('canvasStore — setCanvasView is a surgical state update', () => {
    it('setCanvasView does not reset activeFilePath', () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        useCanvasStore.getState().setCanvasView('build')

        expect(useCanvasStore.getState().activeFilePath).toBe('/src/App.tsx')
    })

    it('setCanvasView does not reset mithrilViolations', () => {
        useCanvasStore.setState({ mithrilViolations: ['node-1', 'node-2'] })
        useCanvasStore.getState().setCanvasView('govern')

        expect(useCanvasStore.getState().mithrilViolations).toEqual(['node-1', 'node-2'])
    })

    it('all three valid CanvasView values are accepted without error', () => {
        const views: CanvasView[] = ['preview', 'build', 'govern']

        for (const view of views) {
            expect(() => useCanvasStore.getState().setCanvasView(view)).not.toThrow()
            expect(useCanvasStore.getState().canvasView).toBe(view)
        }
    })
})
