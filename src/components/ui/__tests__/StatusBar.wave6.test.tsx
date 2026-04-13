/**
 * StatusBar.wave6.test.tsx — S8.2 Autopilot toggle explanation tooltip
 *
 * Tests that the Autopilot toggle button carries the correct aria-label and
 * title attribute for both On and Off states.
 *
 * The Autopilot button is hidden behind a `hasSeenViolation` guard — it only
 * renders once at least one Mithril violation has been observed. We seed that
 * state via canvasStore before rendering.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { StatusBar } from '../../editor/StatusBar'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Seeds the stores so the Autopilot button becomes visible (OPP-12 guard).
 * mithrilViolations must be non-empty so hasSeenViolation flips to true.
 */
function seedViolation(autopilotEnabled: boolean) {
    useCanvasStore.setState({
        mithrilViolations: ['node-1'],
        autopilotEnabled,
    })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('StatusBar — Autopilot toggle (S8.2)', () => {
    // 1. aria-label is "Autopilot: Off" when disabled
    it('has aria-label "Autopilot: Off" when autopilot is disabled', async () => {
        seedViolation(false)
        render(<StatusBar />)
        // Autopilot toggle lives inside the overflow dropdown — open it first
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => {
            const btn = screen.queryByRole('button', { name: 'Autopilot: Off' })
            expect(btn).not.toBeNull()
        })
    })

    // 2. aria-label is "Autopilot: On" when enabled
    it('has aria-label "Autopilot: On" when autopilot is enabled', async () => {
        seedViolation(true)
        render(<StatusBar />)
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => {
            const btn = screen.queryByRole('button', { name: 'Autopilot: On' })
            expect(btn).not.toBeNull()
        })
    })

    // 3. title attribute describes the Off state
    it('shows the correct tooltip text when autopilot is OFF', async () => {
        seedViolation(false)
        render(<StatusBar />)
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => {
            const btn = screen.queryByRole('button', { name: 'Autopilot: Off' })
            expect(btn).not.toBeNull()
            expect(btn!.getAttribute('title')).toBe(
                'Enable Autopilot to let Flint auto-fix safe issues in the background',
            )
        })
    })

    // 4. title attribute describes the On state
    it('shows the correct tooltip text when autopilot is ON', async () => {
        seedViolation(true)
        render(<StatusBar />)
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => {
            const btn = screen.queryByRole('button', { name: 'Autopilot: On' })
            expect(btn).not.toBeNull()
            expect(btn!.getAttribute('title')).toBe(
                'Autopilot is active — Flint will automatically fix safe issues as you work',
            )
        })
    })

    // 5. Autopilot button is hidden before any violation is seen (OPP-12)
    it('does not render the Autopilot button before any violation is observed', async () => {
        // Default store state: mithrilViolations is empty
        useCanvasStore.setState({ mithrilViolations: [], autopilotEnabled: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /Autopilot/i })).toBeNull()
        })
    })
})
