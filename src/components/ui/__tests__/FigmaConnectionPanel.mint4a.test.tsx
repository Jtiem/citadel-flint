/**
 * FigmaConnectionPanel.mint4a.test.tsx
 *
 * MINT.4a: First-sync prompt tests.
 * Covers: banner visibility conditions, pull button call, banner hidden after sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { FigmaConnectionPanel } from '../FigmaConnectionPanel'

describe('MINT.4a — first-sync banner', () => {
    beforeEach(() => {
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
            isError: false,
            content: [{ text: JSON.stringify({ conflicts: [], total: 0, synced: 0, drifted: 0, orphaned: 0 }) }],
        })
    })

    it('shows first-sync banner when connected and lastWebhookAt is null', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: null,
            tokenCount: 10,
            port: 4545,
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('first-sync-banner')).toBeDefined()
            expect(screen.getByTestId('first-sync-banner').textContent).toContain("haven't been synced yet")
        })
    })

    it('does NOT show first-sync banner when not connected', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: false,
            lastWebhookAt: null,
            tokenCount: 0,
            port: 4545,
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.queryByTestId('first-sync-banner')).toBeNull()
        })
    })

    it('does NOT show first-sync banner when already synced (lastWebhookAt set)', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: Date.now() - 5_000,
            tokenCount: 42,
            port: 4545,
        })
        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.queryByTestId('first-sync-banner')).toBeNull()
        })
    })

    it('first-sync pull button calls flint_sync_pull', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: null,
            tokenCount: 5,
            port: 4545,
        })
        const callTool = window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>
        callTool.mockResolvedValue({ isError: false, content: [{ text: 'OK' }] })

        render(<FigmaConnectionPanel />)
        await waitFor(() => {
            expect(screen.getByTestId('first-sync-banner')).toBeDefined()
        })

        fireEvent.click(screen.getByTestId('first-sync-pull-btn'))
        await waitFor(() => {
            expect(callTool).toHaveBeenCalledWith('flint_sync_pull', {})
        })
    })
})
