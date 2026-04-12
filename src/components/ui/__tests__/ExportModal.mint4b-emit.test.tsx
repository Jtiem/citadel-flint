/**
 * ExportModal.mint4b-emit.test.tsx — MINT.4b Emit Now button tests
 *
 * EM-01: Shows "Emit now" button when tokens are not configured
 * EM-02: Shows "Emit now" button when tokens have pending changes
 * EM-03: Does not show "Emit now" button when tokens are up to date
 * EM-04: Clicking "Emit now" calls MCP flint_emit_tokens
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportModal } from '../ExportModal'

beforeEach(() => {
    ;(window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

describe('MINT.4b — Emit Now button', () => {
    it('EM-01: shows "Emit now" button when tokens are not configured', async () => {
        render(<ExportModal onClose={() => undefined} />)
        await waitFor(() => {
            expect(screen.getByTestId('emit-now-button')).toBeTruthy()
        })
    })

    it('EM-02: shows "Emit now" button when tokens have pending changes', async () => {
        render(<ExportModal onClose={() => undefined} pendingTokenCount={5} />)
        await waitFor(() => {
            expect(screen.getByTestId('emit-now-button')).toBeTruthy()
        })
    })

    it('EM-03: does not show "Emit now" when tokens are up to date', async () => {
        render(<ExportModal onClose={() => undefined} pendingTokenCount={0} />)
        await waitFor(() => {
            expect(screen.queryByTestId('emit-now-button')).toBeNull()
        })
    })

    it('EM-04: clicking "Emit now" calls MCP flint_emit_tokens', async () => {
        const callTool = window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>
        callTool.mockResolvedValue({ content: [{ type: 'text', text: '{}' }] })
        render(<ExportModal onClose={() => undefined} />)
        await waitFor(() => {
            expect(screen.getByTestId('emit-now-button')).toBeTruthy()
        })
        fireEvent.click(screen.getByTestId('emit-now-button'))
        await waitFor(() => {
            expect(callTool).toHaveBeenCalledWith('flint_emit_tokens', { formats: ['css', 'tailwind'] })
        })
    })
})
