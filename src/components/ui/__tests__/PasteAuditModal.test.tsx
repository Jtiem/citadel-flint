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
})
