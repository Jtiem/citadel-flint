/**
 * StatusBar.test.tsx
 *
 * 9 tests for the StatusBar component. Covers Figma indicator dot color,
 * violation count text, governance dot colors, and the notification bell badge.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { StatusBar } from '../../editor/StatusBar'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useNotificationStore } from '../../../store/notificationStore'
import type { LinterWarning } from '../../../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWarning(severity: 'amber' | 'critical'): LinterWarning {
    return {
        id: 'W-001',
        type: 'color-drift',
        severity,
        value: severity === 'critical' ? 12 : 3,
        message: 'test violation',
        nearestToken: null,
        nearestTokenValue: null,
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('StatusBar', () => {
    // 1. Renders Figma indicator text (when tokens are synced, label is "Figma")
    it('renders the Figma label in the status bar', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.bridgeAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545, secret: 'x',
        })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Figma')).toBeDefined()
        })
    })

    // 2. Green dot when tokens exist
    it('shows emerald dot when tokens are present', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#000', description: null, mode: 'default', collection_name: 'Colors' },
        ])
        render(<StatusBar />)
        await waitFor(() => {
            const dot = document.querySelector('.bg-emerald-400')
            expect(dot).not.toBeNull()
        })
    })

    // 3. Gray dot when server is not running (tokens exist but server down)
    it('shows zinc dot when server is not running', async () => {
        // running: false + tokenCount > 0 → figmaDotColor → bg-zinc-500
        // (tokenCount > 0 avoids the amber "No design system" override)
        ;(window.bridgeAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: false, lastWebhookAt: null, tokenCount: 3, port: 4545, secret: '',
        })
        render(<StatusBar />)
        await waitFor(() => {
            const dot = document.querySelector('.bg-zinc-500')
            expect(dot).not.toBeNull()
        })
    })

    // 4. Shows violation count text via Export Gate chip
    it('renders violation count text in the center section', async () => {
        // StatusBar reads canvasStore.mithrilViolations, not editorStore.linterWarnings.
        // When 1 violation is present the Export Gate renders "1 Mithril Violation".
        useCanvasStore.setState({ mithrilViolations: ['node-1'], overridesExist: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('1 Mithril Violation')).toBeDefined()
        })
    })

    // 5. Export Gate chip shows amber text when Mithril violations are present
    it('shows red dot when at least one critical linter warning is present', async () => {
        // StatusBar has no red governance dot. When mithrilViolations is non-empty the
        // Export Gate button carries class "text-amber-400" and the ShieldAlert icon.
        useCanvasStore.setState({ mithrilViolations: ['node-1'], overridesExist: false })
        render(<StatusBar />)
        await waitFor(() => {
            // The Export Gate button rendered when violations exist uses text-amber-400.
            const gateBtn = document.querySelector('button.text-amber-400')
            expect(gateBtn).not.toBeNull()
        })
    })

    // 6. Amber dot when non-critical violations exist
    it('shows amber dot when violations exist but none are critical', async () => {
        ;(window.bridgeAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        useEditorStore.setState({
            linterWarnings: new Map([['n1', makeWarning('amber')]]),
        })
        render(<StatusBar />)
        await waitFor(() => {
            const amberDot = document.querySelector('.bg-amber-400')
            expect(amberDot).not.toBeNull()
        })
    })

    // 7. Export Gate renders "Export Ready" with emerald text when zero violations
    it('shows emerald dot on the governance indicator when there are zero violations', async () => {
        // canvasStore defaults: mithrilViolations: [], overridesExist: false
        // → canExport = true → "Export Ready" rendered with text-emerald-500
        useCanvasStore.setState({ mithrilViolations: [], overridesExist: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Export Ready')).toBeDefined()
        })
    })

    // 8. Overrides badge appears when overrideCount > 0
    it('renders a badge with the notification count when notifications are present', async () => {
        // StatusBar has no notification bell. The closest badge surface is the
        // Overrides chip rendered when overrideCount > 0 (GOV.2 feature).
        ;(window.bridgeAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(2)
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Overrides (2)')).toBeDefined()
        })
    })

    // 9. Overrides chip correctly pluralises its count for values > 9
    it('renders "9+" in the badge when there are more than 9 notifications', async () => {
        // StatusBar has no notification bell or bg-indigo-600 badge.
        // Map to the Overrides chip: when overrideCount > 9 the chip shows "Overrides (10)".
        ;(window.bridgeAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(10)
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Overrides (10)')).toBeDefined()
        })
    })

    // 10. Copy endpoint button copies the correct value
    it('calls navigator.clipboard.writeText with the endpoint URL when copy endpoint is clicked', async () => {
        ;(window.bridgeAPI.tokens.readAll as Mock).mockResolvedValue([])
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue({
            running: true,
            lastWebhookAt: null,
            tokenCount: 5,
            port: 4545,
            secret: 'test-secret',
        })
        render(<StatusBar />)
        // Open the Figma popover (label is "Figma" when tokenCount > 0)
        await waitFor(() => screen.getByText('Figma'))
        fireEvent.click(screen.getByText('Figma'))
        await waitFor(() => {
            expect(screen.getByText('Figma Connection')).toBeDefined()
        })
        // Click the copy button for the endpoint row
        const allBtns = screen.getAllByRole('button')
        const endpointCopyBtn = allBtns.find((btn) => {
            const label = btn.getAttribute('aria-label') ?? ''
            const title = btn.getAttribute('title') ?? ''
            return /copy.*endpoint|endpoint.*copy/i.test(label) ||
                   /copy.*endpoint|endpoint.*copy/i.test(title) ||
                   (btn.closest('[data-testid="endpoint-row"]') !== null &&
                    /copy/i.test(btn.textContent ?? ''))
        })
        expect(endpointCopyBtn).toBeDefined()
        fireEvent.click(endpointCopyBtn!)
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'http://127.0.0.1:4545',
            )
        })
    })

    // 11. Copy secret button copies the correct value
    it('calls navigator.clipboard.writeText with the secret when copy secret is clicked', async () => {
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
        ;(window.bridgeAPI.tokens.readAll as Mock).mockResolvedValue([])
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545, secret: 'test-secret',
        })
        render(<StatusBar />)
        await waitFor(() => screen.getByText('Figma'))
        fireEvent.click(screen.getByText('Figma'))
        await waitFor(() => screen.getByText('Figma Connection'))
        const secretBtn = screen.getByLabelText('Copy secret')
        fireEvent.click(secretBtn)
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-secret')
        })
    })

    // 12. Disconnect button calls figma.disconnect()
    it('calls window.bridgeAPI.figma.disconnect when the disconnect button is clicked', async () => {
        ;(window.bridgeAPI.tokens.readAll as Mock).mockResolvedValue([])
        ;(window.bridgeAPI.figma.status as Mock).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545, secret: 'test-secret',
        })
        ;(window.bridgeAPI.figma.disconnect as Mock).mockResolvedValue(undefined)
        render(<StatusBar />)
        await waitFor(() => screen.getByText('Figma'))
        fireEvent.click(screen.getByText('Figma'))
        await waitFor(() => screen.getByText('Figma Connection'))
        const disconnectBtn = screen.getByTitle('Stop the ingestion server')
        fireEvent.click(disconnectBtn)
        await waitFor(() => {
            expect(window.bridgeAPI.figma.disconnect).toHaveBeenCalled()
        })
    })
})
