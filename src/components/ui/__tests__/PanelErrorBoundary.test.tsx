/**
 * PanelErrorBoundary.test.tsx
 *
 * 5 tests covering the panel-level error boundary.
 * Tests verify normal rendering, error capture, retry, copy-to-clipboard,
 * and console.error logging.
 *
 * @module GLASS.2.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelErrorBoundary } from '../PanelErrorBoundary'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A component that throws on render — used to trigger the error boundary. */
function BrokenChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
    if (shouldThrow) {
        throw new Error('Panel render failed')
    }
    return <div data-testid="child-ok">Working</div>
}

/** Suppress React's noisy error boundary console output in test output. */
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ── Suite ────────────────────────────────────────────────────────────────────

describe('PanelErrorBoundary', () => {
    // 1. Renders children normally when no error
    it('renders children when no error occurs', () => {
        render(
            <PanelErrorBoundary panelName="Layers">
                <div data-testid="child-ok">Content</div>
            </PanelErrorBoundary>,
        )

        expect(screen.getByTestId('child-ok')).toBeDefined()
        expect(screen.getByText('Content')).toBeDefined()
    })

    // 2. Catches render error and shows panel name
    it('catches error and shows "Something went wrong in [panelName]"', () => {
        render(
            <PanelErrorBoundary panelName="Governance">
                <BrokenChild />
            </PanelErrorBoundary>,
        )

        expect(screen.getByText('Something went wrong in Governance')).toBeDefined()
        expect(screen.queryByTestId('child-ok')).toBeNull()
    })

    // 3. Retry button re-mounts children
    it('re-mounts children when Retry is clicked', () => {
        // We need a stateful wrapper to toggle the throw behavior.
        let shouldThrow = true
        function ConditionalChild() {
            if (shouldThrow) throw new Error('first render fails')
            return <div data-testid="child-ok">Recovered</div>
        }

        render(
            <PanelErrorBoundary panelName="Canvas">
                <ConditionalChild />
            </PanelErrorBoundary>,
        )

        // Error state is shown
        expect(screen.getByText('Something went wrong in Canvas')).toBeDefined()

        // Fix the child so the next render succeeds
        shouldThrow = false

        // Click Retry
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))

        // Child should now be mounted successfully
        expect(screen.getByTestId('child-ok')).toBeDefined()
        expect(screen.getByText('Recovered')).toBeDefined()
    })

    // 4. Copy Error button copies error message to clipboard
    it('copies error message to clipboard when Copy Error is clicked', () => {
        render(
            <PanelErrorBoundary panelName="Tokens">
                <BrokenChild />
            </PanelErrorBoundary>,
        )

        fireEvent.click(screen.getByRole('button', { name: /copy error/i }))

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Panel render failed')
    })

    // 5. Logs error to console.error (does not swallow)
    it('logs the error to console.error', () => {
        render(
            <PanelErrorBoundary panelName="Activity">
                <BrokenChild />
            </PanelErrorBoundary>,
        )

        // Our componentDidCatch calls console.error with the panelName context
        expect(consoleErrorSpy).toHaveBeenCalled()
        const callArgs = consoleErrorSpy.mock.calls.find(
            (args) => typeof args[0] === 'string' && args[0].includes('Activity'),
        )
        expect(callArgs).toBeDefined()
    })
})
