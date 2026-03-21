/**
 * LivePreview.breakpoint.test.tsx
 *
 * Responsive preview breakpoint rendering tests.
 *
 * Tests:
 *   BP-UI-01 — breakpoint-container has no maxWidth when breakpoint is 'desktop'
 *   BP-UI-02 — breakpoint-container has maxWidth 375px when breakpoint is 'mobile'
 *   BP-UI-03 — breakpoint-container has maxWidth 768px when breakpoint is 'tablet'
 *   BP-UI-04 — breakpoint label shows '375px' when breakpoint is 'mobile'
 *   BP-UI-05 — breakpoint label shows '768px' when breakpoint is 'tablet'
 *   BP-UI-06 — breakpoint label is not rendered when breakpoint is 'desktop'
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LivePreview } from '../LivePreview'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useEditorStore.setState({
        rawCode: 'export default function App() { return <div data-flint-id="root">hello</div> }',
    })
    useCanvasStore.setState({ previewBreakpoint: 'desktop', canvasMode: 'design' })
})

// ── BP-UI-01 ───────────────────────────────────────────────────────────────────

describe('LivePreview — desktop breakpoint (BP-UI-01)', () => {
    it('breakpoint-container has no maxWidth constraint in desktop mode', () => {
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        render(<LivePreview />)

        const container = document.querySelector('[data-testid="breakpoint-container"]') as HTMLElement | null
        expect(container).not.toBeNull()
        // Desktop mode: width is '100%', no maxWidth restriction via inline style.
        expect(container!.style.width).toBe('100%')
        expect(container!.style.maxWidth).toBe('')
    })
})

// ── BP-UI-02 ───────────────────────────────────────────────────────────────────

describe('LivePreview — mobile breakpoint (BP-UI-02)', () => {
    it('breakpoint-container has width 375px in mobile mode', () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        render(<LivePreview />)

        const container = document.querySelector('[data-testid="breakpoint-container"]') as HTMLElement | null
        expect(container).not.toBeNull()
        expect(container!.style.width).toBe('375px')
    })
})

// ── BP-UI-03 ───────────────────────────────────────────────────────────────────

describe('LivePreview — tablet breakpoint (BP-UI-03)', () => {
    it('breakpoint-container has width 768px in tablet mode', () => {
        useCanvasStore.setState({ previewBreakpoint: 'tablet' })
        render(<LivePreview />)

        const container = document.querySelector('[data-testid="breakpoint-container"]') as HTMLElement | null
        expect(container).not.toBeNull()
        expect(container!.style.width).toBe('768px')
    })
})

// ── BP-UI-04 ───────────────────────────────────────────────────────────────────

describe('LivePreview — mobile breakpoint label (BP-UI-04)', () => {
    it("shows '375px' label when breakpoint is mobile", () => {
        useCanvasStore.setState({ previewBreakpoint: 'mobile' })
        render(<LivePreview />)

        const label = screen.getByTestId('breakpoint-label')
        expect(label).toBeDefined()
        expect(label.textContent).toBe('375px')
    })
})

// ── BP-UI-05 ───────────────────────────────────────────────────────────────────

describe('LivePreview — tablet breakpoint label (BP-UI-05)', () => {
    it("shows '768px' label when breakpoint is tablet", () => {
        useCanvasStore.setState({ previewBreakpoint: 'tablet' })
        render(<LivePreview />)

        const label = screen.getByTestId('breakpoint-label')
        expect(label).toBeDefined()
        expect(label.textContent).toBe('768px')
    })
})

// ── BP-UI-06 ───────────────────────────────────────────────────────────────────

describe('LivePreview — desktop mode has no label (BP-UI-06)', () => {
    it('breakpoint label is not rendered in desktop mode', () => {
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        render(<LivePreview />)

        const label = document.querySelector('[data-testid="breakpoint-label"]')
        expect(label).toBeNull()
    })
})
