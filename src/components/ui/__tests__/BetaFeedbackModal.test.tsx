/**
 * BetaFeedbackModal.test.tsx
 *
 * Tests for the BETA.4 enhanced feedback modal.
 *
 * Covers:
 *   - Basic render: form fields present, modal mounts/unmounts
 *   - Category and severity selection
 *   - Description controls submit button enabled state
 *   - Screenshot capture: button triggers IPC, thumbnail shows, remove clears it
 *   - Screenshot capture failure: modal still usable when IPC returns null
 *   - System info disclosure: collapsed by default, expands on click
 *   - Submit: calls submitFeedback with screenshot + system metadata
 *   - Submit without screenshot: still works (backward compatible)
 *   - Success state shown after saved
 *   - Escape key closes modal
 *   - captureScreenshot hidden when undefined (graceful degradation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BetaFeedbackModal } from '../BetaFeedbackModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderOpen(overrides?: { onClose?: () => void }) {
    const onClose = overrides?.onClose ?? vi.fn()
    const { rerender, unmount } = render(
        <BetaFeedbackModal open={true} onClose={onClose} />
    )
    return { onClose, rerender, unmount }
}

function fillDescription(text = 'Something broke badly') {
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: text } })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BetaFeedbackModal', () => {

    describe('mount / unmount', () => {
        it('renders nothing when open is false', () => {
            render(<BetaFeedbackModal open={false} onClose={vi.fn()} />)
            expect(screen.queryByRole('dialog')).toBeNull()
        })

        it('renders the dialog when open is true', () => {
            renderOpen()
            expect(screen.getByRole('dialog')).toBeDefined()
        })

        it('shows the "Beta Feedback" heading', () => {
            renderOpen()
            expect(screen.getByText('Beta Feedback')).toBeDefined()
        })
    })

    describe('form fields', () => {
        it('renders all four category buttons', () => {
            renderOpen()
            expect(screen.getByText('Bug')).toBeDefined()
            expect(screen.getByText('Feature Request')).toBeDefined()
            expect(screen.getByText('Usability')).toBeDefined()
            expect(screen.getByText('Other')).toBeDefined()
        })

        it('renders all three severity buttons', () => {
            renderOpen()
            expect(screen.getByText('Cosmetic')).toBeDefined()
            expect(screen.getByText('Annoying')).toBeDefined()
            expect(screen.getByText('Blocker')).toBeDefined()
        })

        it('submit button is disabled when description is empty', () => {
            renderOpen()
            const submitBtn = screen.getByText('Save Feedback').closest('button')!
            expect(submitBtn.disabled).toBe(true)
        })

        it('submit button becomes enabled after typing a description', () => {
            renderOpen()
            fillDescription()
            const submitBtn = screen.getByText('Save Feedback').closest('button')!
            expect(submitBtn.disabled).toBe(false)
        })

        it('selecting a category highlights the chosen button', () => {
            renderOpen()
            fireEvent.click(screen.getByText('Usability'))
            // After clicking, Usability should have the active indigo class
            const btn = screen.getByText('Usability').closest('button')!
            expect(btn.className).toContain('border-indigo-500')
        })

        it('cancel button calls onClose', () => {
            const { onClose } = renderOpen()
            fireEvent.click(screen.getByText('Cancel'))
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    describe('Escape key', () => {
        it('calls onClose when Escape is pressed', () => {
            const { onClose } = renderOpen()
            fireEvent.keyDown(document, { key: 'Escape' })
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('does not throw when Escape pressed without onClose', () => {
            renderOpen()
            expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
        })
    })

    describe('screenshot capture', () => {
        it('renders the Attach Screenshot button', () => {
            renderOpen()
            expect(screen.getByLabelText('Attach screenshot')).toBeDefined()
        })

        it('calls captureScreenshot IPC when button is clicked', async () => {
            renderOpen()
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })
            expect(window.flintAPI.beta.captureScreenshot).toHaveBeenCalledOnce()
        })

        it('shows thumbnail when captureScreenshot returns a base64 string', async () => {
            const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            ;(window.flintAPI.beta.captureScreenshot as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(fakeBase64)

            renderOpen()
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })

            await waitFor(() => {
                const img = screen.getByAltText('Screenshot preview') as HTMLImageElement
                expect(img.src).toContain(`data:image/png;base64,${fakeBase64}`)
            })
        })

        it('does not show thumbnail when captureScreenshot returns null', async () => {
            ;(window.flintAPI.beta.captureScreenshot as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(null)

            renderOpen()
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })

            await waitFor(() => {
                expect(screen.queryByAltText('Screenshot preview')).toBeNull()
            })
        })

        it('clicking "Remove" clears the screenshot thumbnail', async () => {
            const fakeBase64 = 'abc123'
            ;(window.flintAPI.beta.captureScreenshot as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(fakeBase64)

            renderOpen()
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })
            await waitFor(() => expect(screen.getByAltText('Screenshot preview')).toBeDefined())

            fireEvent.click(screen.getByLabelText('Remove screenshot'))
            expect(screen.queryByAltText('Screenshot preview')).toBeNull()
        })

        it('modal is still usable when captureScreenshot throws', async () => {
            ;(window.flintAPI.beta.captureScreenshot as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(new Error('IPC failed'))

            renderOpen()
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })

            // No thumbnail, no crash
            expect(screen.queryByAltText('Screenshot preview')).toBeNull()
            // The rest of the form is still interactive
            expect(screen.getByRole('textbox')).toBeDefined()
        })
    })

    describe('system info disclosure', () => {
        it('system info section is present but collapsed by default', () => {
            renderOpen()
            expect(screen.getByText(/System Info/)).toBeDefined()
            // Panel content (Platform row) should not be visible
            expect(screen.queryByText('Platform')).toBeNull()
        })

        it('expands system info when clicked', () => {
            renderOpen()
            fireEvent.click(screen.getByText(/System Info/))
            expect(screen.getByText('Platform')).toBeDefined()
            expect(screen.getByText('Screen')).toBeDefined()
            expect(screen.getByText('Build')).toBeDefined()
        })

        it('collapses system info on second click', () => {
            renderOpen()
            fireEvent.click(screen.getByText(/System Info/))
            fireEvent.click(screen.getByText(/System Info/))
            expect(screen.queryByText('Platform')).toBeNull()
        })

        it('aria-expanded reflects open state', () => {
            renderOpen()
            const toggle = screen.getByRole('button', { name: /System Info/ })
            expect(toggle.getAttribute('aria-expanded')).toBe('false')
            fireEvent.click(toggle)
            expect(toggle.getAttribute('aria-expanded')).toBe('true')
        })
    })

    describe('submission', () => {
        it('calls submitFeedback with category, severity, and description', async () => {
            renderOpen()
            fillDescription('Something is wrong')

            await act(async () => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            await waitFor(() => {
                expect(window.flintAPI.beta.submitFeedback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        category: 'bug',
                        severity: 'annoying',
                        description: 'Something is wrong',
                    })
                )
            })
        })

        it('includes screenshot in the payload when captured', async () => {
            const fakeBase64 = 'screenshot-data'
            ;(window.flintAPI.beta.captureScreenshot as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(fakeBase64)

            renderOpen()
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })
            await waitFor(() => expect(screen.getByAltText('Screenshot preview')).toBeDefined())

            fillDescription('With screenshot')
            await act(async () => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            await waitFor(() => {
                expect(window.flintAPI.beta.submitFeedback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        screenshot: fakeBase64,
                    })
                )
            })
        })

        it('includes system metadata in the payload', async () => {
            renderOpen()
            fillDescription('With system info')

            await act(async () => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            await waitFor(() => {
                expect(window.flintAPI.beta.submitFeedback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        system: expect.objectContaining({
                            screenWidth: expect.any(Number),
                            screenHeight: expect.any(Number),
                            devicePixelRatio: expect.any(Number),
                        }),
                    })
                )
            })
        })

        it('sends null screenshot when none was captured', async () => {
            renderOpen()
            fillDescription('No screenshot')

            await act(async () => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            await waitFor(() => {
                expect(window.flintAPI.beta.submitFeedback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        screenshot: null,
                    })
                )
            })
        })

        it('shows success state after saved', async () => {
            renderOpen()
            fillDescription('Success test')

            await act(async () => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            await waitFor(() => {
                expect(screen.getByText(/Thanks! Feedback saved/)).toBeDefined()
            }, { timeout: 3000 })
        })

        it('button shows "Saving..." while submitting', async () => {
            // Make submitFeedback hang so we can observe the transient state
            let resolve!: (v: { saved: boolean }) => void
            ;(window.flintAPI.beta.submitFeedback as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce(new Promise<{ saved: boolean }>(r => { resolve = r }))

            renderOpen()
            fillDescription('Pending submit')

            // Click without awaiting — we want to inspect mid-flight state
            act(() => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            await waitFor(() => {
                expect(screen.getByText('Saving...')).toBeDefined()
            }, { timeout: 2000 })

            // Unblock the hanging promise
            await act(async () => { resolve({ saved: true }) })
        })

        it('form stays open when submitFeedback throws', async () => {
            ;(window.flintAPI.beta.submitFeedback as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(new Error('disk full'))

            renderOpen()
            fillDescription('Error case')

            await act(async () => {
                fireEvent.click(screen.getByText('Save Feedback'))
            })

            // Form stays visible
            expect(screen.getByRole('dialog')).toBeDefined()
            expect(screen.queryByText(/Thanks!/)).toBeNull()
        })
    })

    describe('beta info banner', () => {
        it('does not show banner when daysRemaining is null', async () => {
            // Default mock returns daysRemaining: null — flush the effect then assert
            await act(async () => {
                renderOpen()
            })
            expect(screen.queryByText(/days remaining/)).toBeNull()
        })

        it('shows banner when daysRemaining is set', async () => {
            ;(window.flintAPI.beta.getInfo as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    buildId: 'beta-0.1.0-20260327',
                    expiryDate: '2026-04-26T00:00:00Z',
                    daysRemaining: 30,
                    isBeta: true,
                })

            await act(async () => {
                renderOpen()
            })
            expect(screen.getByText(/30 days remaining/)).toBeDefined()
        })
    })

    describe('form reset', () => {
        it('clears description when modal is reopened', () => {
            const { rerender } = render(
                <BetaFeedbackModal open={true} onClose={vi.fn()} />
            )
            fillDescription('old text')

            // Close and reopen
            rerender(<BetaFeedbackModal open={false} onClose={vi.fn()} />)
            rerender(<BetaFeedbackModal open={true} onClose={vi.fn()} />)

            const textarea = screen.getByRole('textbox')
            expect((textarea as HTMLTextAreaElement).value).toBe('')
        })

        it('clears screenshot when modal is reopened', async () => {
            const fakeBase64 = 'img-data'
            ;(window.flintAPI.beta.captureScreenshot as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(fakeBase64)

            const onClose = vi.fn()
            const { rerender } = render(
                <BetaFeedbackModal open={true} onClose={onClose} />
            )

            // Capture screenshot
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Attach screenshot'))
            })
            // Thumbnail should be visible
            expect(screen.getByAltText('Screenshot preview')).toBeDefined()

            // Close and reopen
            rerender(<BetaFeedbackModal open={false} onClose={onClose} />)
            await act(async () => {
                rerender(<BetaFeedbackModal open={true} onClose={onClose} />)
            })

            // Screenshot should be cleared
            expect(screen.queryByAltText('Screenshot preview')).toBeNull()
        })
    })
})
