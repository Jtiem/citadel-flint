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
 *   'configure' → shows endpoint (http://127.0.0.1:{port}) and secret
 *   'waiting'   → transitions to 'success' when onConnected fires
 */

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FigmaSetupWizard } from '../FigmaSetupWizard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function runningStatus(overrides: Partial<{
    port: number
    secret: string
    lastWebhookAt: number | null
    tokenCount: number
}> = {}) {
    return {
        running: true,
        lastWebhookAt: null,
        tokenCount: 0,
        port: 4545,
        secret: 'test-secret',
        ...overrides,
    }
}

function stoppedStatus() {
    return {
        running: false,
        lastWebhookAt: null,
        tokenCount: 0,
        port: 4545,
        secret: 'test-secret',
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
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(runningStatus())
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
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ secret: 'test-secret', port: 4545 }),
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
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(stoppedStatus())
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
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4546 }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            expect(screen.getByText(/127\.0\.0\.1:4546/)).toBeDefined()
        })
    })

    // 5. Step 2 shows the secret value
    it('renders the secret value from figma.status() in the configure step', async () => {
        const secretValue = 'bridge-unique-secret-abc'
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ secret: secretValue }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            // Secret may be truncated or masked; we check that at least part of
            // it appears (or a visible representation is present)
            const text = document.body.textContent ?? ''
            // The component must render the secret (possibly masked to first N chars)
            // so we verify the start of the secret is visible
            const secretStart = secretValue.slice(0, 8)
            expect(text).toContain(secretStart)
        })
    })

    // 6. Copy endpoint button copies to clipboard
    it('calls navigator.clipboard.writeText with the endpoint URL when copy endpoint is clicked', async () => {
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545, secret: 'test-secret' }),
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

    // 7. Copy secret button copies to clipboard
    it('calls navigator.clipboard.writeText with the secret when copy secret is clicked', async () => {
        const secretValue = 'test-secret'
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545, secret: secretValue }),
        )
        render(<FigmaSetupWizard {...defaultProps()} />)
        await waitFor(() => {
            expect(document.body.textContent).toContain('127.0.0.1:4545')
        })
        // Find the copy button for the secret row
        const allBtns = screen.getAllByRole('button')
        const secretCopyBtn = allBtns.find((btn) => {
            const label = btn.getAttribute('aria-label') ?? ''
            const title = btn.getAttribute('title') ?? ''
            return /copy.*secret|secret.*copy/i.test(label) ||
                   /copy.*secret|secret.*copy/i.test(title) ||
                   (/copy/i.test(label) && btn.closest('[data-testid="secret-row"]') !== null)
        })
        if (secretCopyBtn) {
            fireEvent.click(secretCopyBtn)
        } else {
            // Fall back: second copy button (endpoint is first, secret is second)
            const copyBtns = allBtns.filter((btn) =>
                /copy/i.test(btn.getAttribute('aria-label') ?? '') ||
                /copy/i.test(btn.getAttribute('title') ?? '') ||
                btn.textContent?.trim().toLowerCase() === 'copy',
            )
            expect(copyBtns.length).toBeGreaterThanOrEqual(2)
            fireEvent.click(copyBtns[1])
        }
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(secretValue)
        })
    })

    // 8. Step 3 transitions to success on figma-connected event
    it('transitions to success state when the onConnected callback fires', async () => {
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue(
            runningStatus({ port: 4545, secret: 'test-secret' }),
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
                expect(window.bridgeAPI.figma.onConnected).toHaveBeenCalled()
            })
        }
        // Capture the callback registered with onConnected and invoke it manually
        const calls = (window.bridgeAPI.figma.onConnected as Mock).mock.calls
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
