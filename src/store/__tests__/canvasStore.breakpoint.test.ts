/**
 * canvasStore.breakpoint.test.ts
 *
 * Responsive preview breakpoint state — store transition tests.
 *
 * Covers:
 *   BP-STORE-01: previewBreakpoint defaults to 'desktop'
 *   BP-STORE-02: cyclePreviewBreakpoint('up') cycles desktop → mobile
 *   BP-STORE-03: cyclePreviewBreakpoint('up') cycles mobile → tablet
 *   BP-STORE-04: cyclePreviewBreakpoint('up') cycles tablet → desktop
 *   BP-STORE-05: cyclePreviewBreakpoint('down') cycles desktop → tablet
 *   BP-STORE-06: cyclePreviewBreakpoint('down') cycles tablet → mobile
 *   BP-STORE-07: cyclePreviewBreakpoint('down') cycles mobile → desktop
 *   BP-STORE-08: closeWorkspace resets previewBreakpoint to 'desktop'
 *   BP-STORE-09: setPreviewBreakpoint sets the breakpoint explicitly
 *   BP-STORE-10: cyclePreviewBreakpoint does not modify canvasMode
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../canvasStore'
import type { PreviewBreakpoint } from '../canvasStore'

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useCanvasStore.setState({
        previewBreakpoint: 'desktop',
        canvasMode: 'design',
        activeFilePath: null,
    })
})

// ── BP-STORE-01 ────────────────────────────────────────────────────────────────

describe("canvasStore — previewBreakpoint initial state (BP-STORE-01)", () => {
    it("previewBreakpoint defaults to 'desktop'", () => {
        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })
})

// ── BP-STORE-02 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint('up') from desktop (BP-STORE-02)", () => {
    it("cycles from 'desktop' to 'mobile'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('mobile')
    })
})

// ── BP-STORE-03 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint('up') from mobile (BP-STORE-03)", () => {
    it("cycles from 'mobile' to 'tablet'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('tablet')
    })
})

// ── BP-STORE-04 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint('up') from tablet (BP-STORE-04)", () => {
    it("cycles from 'tablet' to 'desktop'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'tablet' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })
})

// ── BP-STORE-05 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint('down') from desktop (BP-STORE-05)", () => {
    it("cycles from 'desktop' to 'tablet'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        useCanvasStore.getState().cyclePreviewBreakpoint('down')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('tablet')
    })
})

// ── BP-STORE-06 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint('down') from tablet (BP-STORE-06)", () => {
    it("cycles from 'tablet' to 'mobile'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'tablet' })
        useCanvasStore.getState().cyclePreviewBreakpoint('down')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('mobile')
    })
})

// ── BP-STORE-07 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint('down') from mobile (BP-STORE-07)", () => {
    it("cycles from 'mobile' to 'desktop'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        useCanvasStore.getState().cyclePreviewBreakpoint('down')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })
})

// ── BP-STORE-08 ────────────────────────────────────────────────────────────────

describe("canvasStore — closeWorkspace resets previewBreakpoint (BP-STORE-08)", () => {
    it("resets previewBreakpoint to 'desktop' from 'mobile'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })

    it("resets previewBreakpoint to 'desktop' from 'tablet'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'tablet' })
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })

    it("previewBreakpoint stays 'desktop' when already 'desktop'", () => {
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })
})

// ── BP-STORE-09 ────────────────────────────────────────────────────────────────

describe("canvasStore — setPreviewBreakpoint (BP-STORE-09)", () => {
    it("sets breakpoint to 'mobile' explicitly", () => {
        useCanvasStore.getState().setPreviewBreakpoint('mobile')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('mobile')
    })

    it("sets breakpoint to 'tablet' explicitly", () => {
        useCanvasStore.getState().setPreviewBreakpoint('tablet')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('tablet')
    })

    it("sets breakpoint to 'desktop' explicitly", () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        useCanvasStore.getState().setPreviewBreakpoint('desktop')

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })
})

// ── BP-STORE-10 ────────────────────────────────────────────────────────────────

describe("canvasStore — cyclePreviewBreakpoint is orthogonal to canvasMode (BP-STORE-10)", () => {
    it("cyclePreviewBreakpoint does not change canvasMode", () => {
        useCanvasStore.setState({ canvasMode: 'interact', previewBreakpoint: 'mobile' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up')

        expect(useCanvasStore.getState().canvasMode).toBe('interact')
    })

    it("full forward cycle returns to the original breakpoint after 3 steps", () => {
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up') // → mobile
        useCanvasStore.getState().cyclePreviewBreakpoint('up') // → tablet
        useCanvasStore.getState().cyclePreviewBreakpoint('up') // → desktop

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('desktop')
    })

    it("full reverse cycle returns to the original breakpoint after 3 steps", () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        useCanvasStore.getState().cyclePreviewBreakpoint('down') // → desktop
        useCanvasStore.getState().cyclePreviewBreakpoint('down') // → tablet
        useCanvasStore.getState().cyclePreviewBreakpoint('down') // → mobile

        expect(useCanvasStore.getState().previewBreakpoint).toBe<PreviewBreakpoint>('mobile')
    })
})
