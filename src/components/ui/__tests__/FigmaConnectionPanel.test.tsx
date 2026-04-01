/**
 * FigmaConnectionPanel.test.tsx
 *
 * S7.1: Tests for the dedicated Figma connection management panel.
 * Covers: connection status display, sync actions, token mapping counts,
 * sync history, and disconnect flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { FigmaConnectionPanel } from '../FigmaConnectionPanel'

describe('FigmaConnectionPanel', () => {
    beforeEach(() => {
        // Default: Figma not connected
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: false,
            lastWebhookAt: null,
            tokenCount: 0,
            port: 4545,
        })
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: JSON.stringify({ conflicts: [], total: 0, synced: 0, drifted: 0, orphaned: 0 }) }],
        })
    })

    it('renders the panel with data-testid', () => {
        render(<FigmaConnectionPanel />)
        expect(screen.getByTestId('figma-connection-panel')).toBeDefined()
    })

    it('shows "Not connected" when Figma is not running', async () => {
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('figma-status-label').textContent).toBe('Not connected')
        })
    })

    it('shows "Connected" when Figma is running with tokens', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: Date.now() - 60_000,
            tokenCount: 42,
            port: 4545,
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('figma-status-label').textContent).toBe('Connected')
        })
    })

    it('shows "Never" for last sync when no webhook has occurred', async () => {
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('figma-last-sync').textContent).toBe('Never')
        })
    })

    it('disables sync buttons when not connected', async () => {
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            const pullBtn = screen.getByTestId('figma-panel-pull')
            const pushBtn = screen.getByTestId('figma-panel-push')
            expect(pullBtn.hasAttribute('disabled')).toBe(true)
            expect(pushBtn.hasAttribute('disabled')).toBe(true)
        })
    })

    it('enables sync buttons when connected', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: Date.now(),
            tokenCount: 10,
            port: 4545,
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            const pullBtn = screen.getByTestId('figma-panel-pull')
            expect(pullBtn.hasAttribute('disabled')).toBe(false)
        })
    })

    it('shows token mapping counts from MCP', async () => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: JSON.stringify({ total: 50, synced: 40, drifted: 8, orphaned: 2, conflicts: [] }) }],
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('token-total').textContent).toBe('50')
            expect(screen.getByTestId('token-synced').textContent).toBe('40')
            expect(screen.getByTestId('token-drifted').textContent).toBe('8')
            expect(screen.getByTestId('token-orphaned').textContent).toBe('2')
        })
    })

    it('shows empty sync history by default', () => {
        render(<FigmaConnectionPanel />)
        expect(screen.getByText('No sync operations this session.')).toBeDefined()
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(<FigmaConnectionPanel onClose={onClose} />)
        const closeBtn = screen.getByLabelText('Close panel')
        fireEvent.click(closeBtn)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls flint_sync_pull via MCP when Pull button is clicked', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: Date.now(),
            tokenCount: 10,
            port: 4545,
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('figma-panel-pull').hasAttribute('disabled')).toBe(false)
        })
        fireEvent.click(screen.getByTestId('figma-panel-pull'))
        await waitFor(() => {
            expect(window.flintAPI.mcp!.callTool).toHaveBeenCalledWith('flint_sync_pull', {})
        })
    })
})
