/**
 * PasteAuditModal.test.tsx — FORGE.4a tests
 *
 * PAM-01: Renders modal with textarea and Audit button
 * PAM-02: Audit button is disabled when textarea is empty
 * PAM-03: Audit button is enabled when textarea has content
 * PAM-04: Clicking close calls onClose
 * PAM-05: Pressing Escape calls onClose
 * PAM-06: Shows error when MCP is not connected
 * PAM-07: Shows results after successful audit
 * PAM-08: Shows "Audit another snippet" button after results
 * PAM-09: Clicking "Audit another snippet" resets state
 * PAM-10: Error state renders a styled card, not a raw text dump
 * PAM-11: Stack trace is NOT present in the default (collapsed) DOM
 * PAM-12: "Show details" toggle reveals the technical detail section
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PasteAuditModal } from '../PasteAuditModal'

beforeEach(() => {
    ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ totalViolations: 2, diagnostics: [{ message: 'Color drift detected' }, { message: 'Missing alt text' }], grade: 'C' }) }],
    })
})

describe('PasteAuditModal — FORGE.4a', () => {
    it('PAM-01: renders modal with textarea and Audit button', () => {
        render(<PasteAuditModal onClose={vi.fn()} />)
        expect(screen.getByTestId('paste-audit-modal')).toBeTruthy()
        expect(screen.getByTestId('paste-audit-textarea')).toBeTruthy()
        expect(screen.getByTestId('paste-audit-submit')).toBeTruthy()
    })

    it('PAM-02: Audit button is disabled when textarea is empty', () => {
        render(<PasteAuditModal onClose={vi.fn()} />)
        const btn = screen.getByTestId('paste-audit-submit') as HTMLButtonElement
        expect(btn.disabled).toBe(true)
    })

    it('PAM-03: Audit button is enabled when textarea has content', () => {
        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Hello</div>' },
        })
        const btn = screen.getByTestId('paste-audit-submit') as HTMLButtonElement
        expect(btn.disabled).toBe(false)
    })

    it('PAM-04: clicking close calls onClose', () => {
        const onClose = vi.fn()
        render(<PasteAuditModal onClose={onClose} />)
        fireEvent.click(screen.getByTestId('paste-audit-close'))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('PAM-05: pressing Escape calls onClose', () => {
        const onClose = vi.fn()
        render(<PasteAuditModal onClose={onClose} />)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('PAM-06: shows error when MCP callTool is not available', async () => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('MCP not connected'),
        )
        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Hello</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-error')).toBeTruthy()
        })
    })

    it('PAM-07: shows results after successful audit', async () => {
        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div className="bg-[#ff0000]">Test</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-results')).toBeTruthy()
        })

        expect(screen.getByTestId('paste-audit-results').textContent).toContain('2 issues found')
        expect(screen.getByTestId('paste-audit-warnings')!.children.length).toBe(2)
    })

    it('PAM-08: shows reset button after results', async () => {
        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Test</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-reset')).toBeTruthy()
        })
    })

    it('PAM-09: clicking reset clears results', async () => {
        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Test</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-results')).toBeTruthy()
        })

        fireEvent.click(screen.getByTestId('paste-audit-reset'))
        expect(screen.queryByTestId('paste-audit-results')).toBeNull()
        expect(screen.getByTestId('paste-audit-textarea')).toBeTruthy()
    })

    it('PAM-10: error state renders a styled error card, not a raw text dump', async () => {
        const errorMessage = 'MCP not connected. Open a project first.'
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error(errorMessage),
        )
        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Test</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-error')).toBeTruthy()
        })

        // The error container must have role="alert" — it's a styled card
        const card = screen.getByTestId('paste-audit-error')
        expect(card.getAttribute('role')).toBe('alert')

        // The user-facing message is visible
        expect(screen.getByTestId('paste-audit-error-message').textContent).toBe(errorMessage)
    })

    it('PAM-11: stack trace is NOT present in the default (collapsed) DOM', async () => {
        const err = new Error('Something went wrong')
        // Simulate a stack trace being present on the error
        err.stack = 'Error: Something went wrong\n    at handleAudit (PasteAuditModal.tsx:60:13)'
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(err)

        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Test</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-error')).toBeTruthy()
        })

        // Detail section should be collapsed — not in DOM
        expect(screen.queryByTestId('paste-audit-error-detail')).toBeNull()

        // The raw stack trace text should not appear in the visible card
        const card = screen.getByTestId('paste-audit-error')
        expect(card.textContent).not.toContain('at handleAudit')
    })

    it('PAM-12: "Show details" toggle reveals the technical detail section', async () => {
        const err = new Error('Unexpected audit failure')
        err.stack = 'Error: Unexpected audit failure\n    at handleAudit (PasteAuditModal.tsx:60:13)'
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(err)

        render(<PasteAuditModal onClose={vi.fn()} />)
        fireEvent.change(screen.getByTestId('paste-audit-textarea'), {
            target: { value: '<div>Test</div>' },
        })
        fireEvent.click(screen.getByTestId('paste-audit-submit'))

        await waitFor(() => {
            expect(screen.getByTestId('paste-audit-error-details-toggle')).toBeTruthy()
        })

        // Detail is hidden before toggling
        expect(screen.queryByTestId('paste-audit-error-detail')).toBeNull()

        // Click the toggle
        fireEvent.click(screen.getByTestId('paste-audit-error-details-toggle'))

        // Detail section is now visible and contains the stack
        const detail = screen.getByTestId('paste-audit-error-detail')
        expect(detail).toBeTruthy()
        expect(detail.textContent).toContain('at handleAudit')
    })
})
