/**
 * FigmaSetupWizard.test.tsx
 *
 * 8 tests for the FigmaSetupWizard component. Covers the 3-step wizard
 * lifecycle: server check (Step 1), configure copy fields (Step 2), and
 * waiting-for-first-sync (Step 3) including the success transition.
 *
 * The wizard's internal WizardStep state machine under test:
 *   'checking'  → auto-advances to 'configure' when server running === true
 *   'checking'  → transitions to 'error' when server running === false
 *   'configure' → shows endpoint (http://127.0.0.1:{port})
 *   'waiting'   → transitions to 'success' when onConnected fires
 *
 * SEC.2: Tests no longer reference the secret field — it is server-side only.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FigmaSetupWizard } from '../FigmaSetupWizard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function runningStatus(overrides: Partial<{
    port: number
    lastWebhookAt: number | null
    tokenCount: number
}> = {}) {
    return {
        running: true,
        lastWebhookAt: null,
        tokenCount: 0,
        port: 4545,
        ...overrides,
    }
}

function stoppedStatus() {
    return {
        running: false,
        lastWebhookAt: null,
        tokenCount: 0,
        port: 4545,
    }
}

function defaultProps(overrides: Partial<{ visible: boolean; onClose: () => void }> = {}) {
    return {
        visible: true,
        onClose: vi.fn(),
        ...overrides,
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('FigmaSetupWizard', () => {
    // 1. Renders 3 step indicators
    it('renders 3 step indicators (Step 1, Step 2, Step 3)', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(runningStatus())
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            // The wizard must show three step labels — exact text is flexible
            // but all three ordinal markers must be present
            const text = document.body.textContent ?? ''
            expect(text).toMatch(/step\s*1|1\./i)
            expect(text).toMatch(/step\s*2|2\./i)
            expect(text).toMatch(/step\s*3|3\./i)
        })
    })

    // 2. Step 1 auto-completes when server is running
    it('advances past the checking step to configure when server is running', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545 }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        // When running === true the wizard leaves 'checking' and shows the
        // configure UI. The configure step shows the endpoint copy field.
        await waitFor(() => {
            const text = document.body.textContent ?? ''
            expect(text).toContain('127.0.0.1')
        })
    })

    // 3. Step 1 shows error when server is not running
    it('shows an error state when figma.status() returns running: false', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(stoppedStatus())
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            // Must show some kind of error / not-running indicator
            const text = document.body.textContent ?? ''
            const hasErrorIndicator =
                /not running|error|stopped|offline|failed|unable/i.test(text)
            expect(hasErrorIndicator).toBe(true)
        })
    })

    // 4. Step 2 shows endpoint with the correct port
    it('shows the correct port in the endpoint when status returns port: 4546', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4546 }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText(/127\.0\.0\.1:4546/)).toBeDefined()
        })
    })

    // 5. Step 2 does NOT render a secret field (SEC.2 — secret is server-side only)
    it('does not render a secret copy field in the configure step', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(runningStatus())
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            const text = document.body.textContent ?? ''
            expect(text).toContain('127.0.0.1')
        })
        // The configure step should have only one copy button (for the endpoint)
        // and no "Secret (x-flint-secret)" label visible as a copy field label.
        const text = document.body.textContent ?? ''
        // There should be no "Secret" copy-field heading rendered
        expect(text).not.toMatch(/^Secret \(x-flint-secret\)/m)
        // Only one CopyField should be in the DOM (the endpoint one)
        const labels = document.querySelectorAll('[aria-label^="Copy"]')
        // At most 1 copy button: the endpoint one. The secret copy button is gone.
        const secretLabels = Array.from(labels).filter((el) =>
            /secret/i.test(el.getAttribute('aria-label') ?? '')
        )
        expect(secretLabels).toHaveLength(0)
    })

    // 6. Copy endpoint button copies to clipboard
    it('calls navigator.clipboard.writeText with the endpoint URL when copy endpoint is clicked', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545 }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        // Wait for configure step to render
        await waitFor(() => {
            expect(document.body.textContent).toContain('127.0.0.1:4545')
        })
        // Find and click the copy button for the endpoint
        const copyButtons = screen.getAllByRole('button')
        const endpointCopyBtn = copyButtons.find((btn) => {
            const label = btn.getAttribute('aria-label') ?? ''
            const title = btn.getAttribute('title') ?? ''
            return /copy.*endpoint|endpoint.*copy/i.test(label) ||
                   /copy.*endpoint|endpoint.*copy/i.test(title) ||
                   /copy/i.test(label) && btn.closest('[data-testid="endpoint-row"]') !== null
        })
        // If no aria-label based match, find by proximity to the endpoint text
        if (endpointCopyBtn) {
            fireEvent.click(endpointCopyBtn)
        } else {
            // Fall back: look for any button near "127.0.0.1" text
            const allBtns = screen.getAllByRole('button')
            const nearEndpoint = allBtns.find((btn) => {
                const parent = btn.closest('[data-testid]') ?? btn.parentElement
                return (parent?.textContent ?? '').includes('127.0.0.1')
            })
            expect(nearEndpoint).toBeDefined()
            fireEvent.click(nearEndpoint!)
        }
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'http://127.0.0.1:4545',
            )
        })
    })

    // 7. Step 3 "I've configured the plugin" button advances the wizard
    it('advances to the waiting step when the configure button is clicked', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545 }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        // Wait for configure step
        await waitFor(() => {
            expect(document.body.textContent).toContain('127.0.0.1:4545')
        })
        // Click the advance button
        const advanceBtn = screen.getAllByRole('button').find((btn) => {
            const text = btn.textContent ?? ''
            return /configured|next|continue|i.ve/i.test(text)
        })
        expect(advanceBtn).toBeDefined()
        fireEvent.click(advanceBtn!)
        // The wizard should now show the waiting state
        await waitFor(() => {
            const text = document.body.textContent ?? ''
            const inWaiting = /waiting|sync variables|first sync/i.test(text)
            expect(inWaiting).toBe(true)
        })
    })

    // 8. Step 3 transitions to success on figma-connected event
    it('transitions to success state when the onConnected callback fires', async () => {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545 }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        // Advance to configure step
        await waitFor(() => {
            expect(document.body.textContent).toContain('127.0.0.1')
        })
        // Click "I've configured the plugin" (or equivalent) to advance to Step 3
        const advanceBtn = screen.getAllByRole('button').find((btn) => {
            const text = btn.textContent ?? ''
            return /configured|next|continue|i.ve|waiting|step 3/i.test(text)
        })
        if (advanceBtn) {
            fireEvent.click(advanceBtn)
            // Now in 'waiting' step — simulate onConnected firing
            await waitFor(() => {
                expect(window.flintAPI.figma.onConnected).toHaveBeenCalled()
            })
        }
        // Capture the callback registered with onConnected and invoke it manually
        const calls = (window.flintAPI.figma.onConnected as Mock).mock.calls
        expect(calls.length).toBeGreaterThan(0)
        const registeredCallback = calls[0][0] as (event: { tokenCount: number; timestamp: number }) => void
        registeredCallback({ tokenCount: 50, timestamp: Date.now() })
        await waitFor(() => {
            const text = document.body.textContent ?? ''
            const hasSuccess = /success|connected|synced|tokens.*imported|done/i.test(text)
            expect(hasSuccess).toBe(true)
        })
    })
})
