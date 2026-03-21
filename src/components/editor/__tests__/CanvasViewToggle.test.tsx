/**
 * CanvasViewToggle.test.tsx
 *
 * CV2.1 — Unit tests for the CanvasViewToggle segmented control.
 *
 * Tests:
 *   CV-TOGGLE-01: Renders three buttons (preview, build, govern)
 *   CV-TOGGLE-02: Preview button has active styling when canvasView === 'preview'
 *   CV-TOGGLE-03: Clicking Build button calls setCanvasView('build')
 *   CV-TOGGLE-04: Clicking Govern button calls setCanvasView('govern')
 *   CV-TOGGLE-05: Active segment changes visual highlight when view changes
 *   CV-TOGGLE-06: All buttons have accessible labels (aria-label)
 *   CV-TOGGLE-07: All buttons have data-testid attributes
 *   CV-TOGGLE-08: Clicking Preview button calls setCanvasView('preview')
 *   CV-TOGGLE-09: aria-pressed is true on the active segment only
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasViewToggle } from '../CanvasViewToggle'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useCanvasStore.setState({ canvasView: 'preview' })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CanvasViewToggle', () => {
    // CV-TOGGLE-01: All three buttons render
    it('renders three view mode buttons', () => {
        render(<CanvasViewToggle />)
        expect(screen.getByTestId('canvas-view-preview')).toBeDefined()
        expect(screen.getByTestId('canvas-view-build')).toBeDefined()
        expect(screen.getByTestId('canvas-view-govern')).toBeDefined()
    })

    // CV-TOGGLE-07: data-testid attributes are present
    it('has the correct data-testid on each button', () => {
        render(<CanvasViewToggle />)
        const previewBtn = screen.getByTestId('canvas-view-preview')
        const buildBtn = screen.getByTestId('canvas-view-build')
        const governBtn = screen.getByTestId('canvas-view-govern')
        expect(previewBtn).toBeDefined()
        expect(buildBtn).toBeDefined()
        expect(governBtn).toBeDefined()
    })

    // CV-TOGGLE-06: Accessible labels on all buttons
    it('provides aria-label on each button', () => {
        render(<CanvasViewToggle />)
        expect(screen.getByLabelText('Switch to Preview mode')).toBeDefined()
        expect(screen.getByLabelText('Switch to Build mode')).toBeDefined()
        expect(screen.getByLabelText('Switch to Govern mode')).toBeDefined()
    })

    // CV-TOGGLE-02: Active styling on Preview when canvasView === 'preview'
    it('applies active styling (bg-indigo-600) to Preview when in preview mode', () => {
        useCanvasStore.setState({ canvasView: 'preview' })
        render(<CanvasViewToggle />)
        const previewBtn = screen.getByTestId('canvas-view-preview')
        expect(previewBtn.className).toContain('bg-indigo-600')
        expect(previewBtn.className).not.toContain('text-zinc-400')
    })

    // CV-TOGGLE-05: Build button gets active styling after setCanvasView('build')
    it('applies active styling to Build button when canvasView is build', () => {
        useCanvasStore.setState({ canvasView: 'build' })
        render(<CanvasViewToggle />)
        const buildBtn = screen.getByTestId('canvas-view-build')
        expect(buildBtn.className).toContain('bg-indigo-600')
        // Preview should now be inactive
        const previewBtn = screen.getByTestId('canvas-view-preview')
        expect(previewBtn.className).not.toContain('bg-indigo-600')
    })

    // CV-TOGGLE-05 (govern case): Govern button gets active styling
    it('applies active styling to Govern button when canvasView is govern', () => {
        useCanvasStore.setState({ canvasView: 'govern' })
        render(<CanvasViewToggle />)
        const governBtn = screen.getByTestId('canvas-view-govern')
        expect(governBtn.className).toContain('bg-indigo-600')
        const previewBtn = screen.getByTestId('canvas-view-preview')
        expect(previewBtn.className).not.toContain('bg-indigo-600')
    })

    // CV-TOGGLE-03: Clicking Build calls setCanvasView('build')
    it('clicking Build button switches canvasView to build', () => {
        useCanvasStore.setState({ canvasView: 'preview' })
        render(<CanvasViewToggle />)
        fireEvent.click(screen.getByTestId('canvas-view-build'))
        expect(useCanvasStore.getState().canvasView).toBe('build')
    })

    // CV-TOGGLE-04: Clicking Govern calls setCanvasView('govern')
    it('clicking Govern button switches canvasView to govern', () => {
        useCanvasStore.setState({ canvasView: 'preview' })
        render(<CanvasViewToggle />)
        fireEvent.click(screen.getByTestId('canvas-view-govern'))
        expect(useCanvasStore.getState().canvasView).toBe('govern')
    })

    // CV-TOGGLE-08: Clicking Preview calls setCanvasView('preview')
    it('clicking Preview button switches canvasView back to preview', () => {
        useCanvasStore.setState({ canvasView: 'govern' })
        render(<CanvasViewToggle />)
        fireEvent.click(screen.getByTestId('canvas-view-preview'))
        expect(useCanvasStore.getState().canvasView).toBe('preview')
    })

    // CV-TOGGLE-09: aria-pressed reflects active state
    it('sets aria-pressed=true only on the active segment', () => {
        useCanvasStore.setState({ canvasView: 'build' })
        render(<CanvasViewToggle />)
        const previewBtn = screen.getByTestId('canvas-view-preview')
        const buildBtn = screen.getByTestId('canvas-view-build')
        const governBtn = screen.getByTestId('canvas-view-govern')
        expect(previewBtn.getAttribute('aria-pressed')).toBe('false')
        expect(buildBtn.getAttribute('aria-pressed')).toBe('true')
        expect(governBtn.getAttribute('aria-pressed')).toBe('false')
    })

    // Labels are rendered in the button text
    it('renders label text for each segment', () => {
        render(<CanvasViewToggle />)
        expect(screen.getByText('Preview')).toBeDefined()
        expect(screen.getByText('Build')).toBeDefined()
        expect(screen.getByText('Govern')).toBeDefined()
    })
})
