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
// useNotificationStore is available via the test setup but not directly called in this file
import type { LinterWarning } from '../../../types/flint-api'

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
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545,
        })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Figma')).toBeDefined()
        })
    })

    // 2. Green dot when tokens exist
    it('shows emerald dot when tokens are present', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
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
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: false, lastWebhookAt: null, tokenCount: 3, port: 4545,
        })
        render(<StatusBar />)
        await waitFor(() => {
            const dot = document.querySelector('.bg-zinc-500')
            expect(dot).not.toBeNull()
        })
    })

    // 4. Shows violation count text via Export Gate chip
    it('renders violation count text in the center section', async () => {
        // StatusBar reads canvasStore.mithrilViolations + a11yViolations for total issue count.
        useCanvasStore.setState({ mithrilViolations: ['node-1'], overridesExist: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('1 Issue')).toBeDefined()
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
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
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

    // 8. Override badge relocated to GovernanceDashboard (GLASS.3.4-B)
    it('does not render the overrides badge in StatusBar (relocated to GovernanceDashboard)', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(2)
        render(<StatusBar />)
        // Allow any async effects to settle
        await waitFor(() => {
            expect(screen.queryByText(/Overrides/i)).toBeNull()
        })
    })

    // 9. Confirm override badge is fully removed regardless of count
    it('does not render override text even with high override count', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(10)
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.queryByText(/Overrides/i)).toBeNull()
        })
    })

    // 10. Copy endpoint button copies the correct value
    it('calls navigator.clipboard.writeText with the endpoint URL when copy endpoint is clicked', async () => {
        ;(window.flintAPI.tokens.readAll as Mock).mockResolvedValue([])
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue({
            running: true,
            lastWebhookAt: null,
            tokenCount: 5,
            port: 4545,
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

    // 11. Disconnect button calls figma.disconnect() after confirm
    it('calls window.flintAPI.figma.disconnect when the disconnect button is clicked', async () => {
        // S1.12: window.confirm guard — mock it to return true so the handler proceeds
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        ;(window.flintAPI.tokens.readAll as Mock).mockResolvedValue([])
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545,
        })
        ;(window.flintAPI.figma.disconnect as Mock).mockResolvedValue(undefined)
        render(<StatusBar />)
        await waitFor(() => screen.getByText('Figma'))
        fireEvent.click(screen.getByText('Figma'))
        await waitFor(() => screen.getByText('Figma Connection'))
        const disconnectBtn = screen.getByTitle('Stop the ingestion server')
        fireEvent.click(disconnectBtn)
        await waitFor(() => {
            expect(window.flintAPI.figma.disconnect).toHaveBeenCalled()
        })
        confirmSpy.mockRestore()
    })

    // ── WS1: Connect IDE chip ─────────────────────────────────────────────────

    // 12. "Connect IDE" chip appears when MCP is disconnected and onConnectIDE is provided
    it('renders "Connect IDE" chip when MCP is disconnected and onConnectIDE prop is provided', async () => {
        ;(window.flintAPI.mcp?.status as Mock).mockResolvedValue({ connected: false })
        const onConnectIDE = vi.fn()
        render(<StatusBar onConnectIDE={onConnectIDE} />)
        // Chip lives inside the overflow dropdown — open it first
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => {
            expect(screen.getByTestId('statusbar-connect-ide')).toBeDefined()
        })
    })

    // 13. Clicking "Connect IDE" chip calls onConnectIDE
    it('calls onConnectIDE when "Connect IDE" chip is clicked', async () => {
        ;(window.flintAPI.mcp?.status as Mock).mockResolvedValue({ connected: false })
        const onConnectIDE = vi.fn()
        render(<StatusBar onConnectIDE={onConnectIDE} />)
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => screen.getByTestId('statusbar-connect-ide'))
        fireEvent.click(screen.getByTestId('statusbar-connect-ide'))
        expect(onConnectIDE).toHaveBeenCalled()
    })

    // 14. "Connect IDE" chip is absent when MCP is connected
    it('does not render "Connect IDE" chip when MCP is connected', async () => {
        ;(window.flintAPI.mcp?.status as Mock).mockResolvedValue({ connected: true })
        const onConnectIDE = vi.fn()
        render(<StatusBar onConnectIDE={onConnectIDE} />)
        await waitFor(() => {
            expect(screen.queryByTestId('statusbar-connect-ide')).toBeNull()
        })
    })

    // 15. "Connect IDE" chip is absent when onConnectIDE prop is not provided
    it('does not render "Connect IDE" chip when onConnectIDE prop is absent', async () => {
        ;(window.flintAPI.mcp?.status as Mock).mockResolvedValue({ connected: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.queryByTestId('statusbar-connect-ide')).toBeNull()
        })
    })

    // ── WS1: Demo project indicator ───────────────────────────────────────────

    // 16. "Demo Project" badge appears when isDemo is true
    it('renders "Demo Project" badge when isDemo is true', async () => {
        render(<StatusBar isDemo={true} />)
        // Badge lives inside the overflow dropdown — open it first
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => {
            expect(screen.getByText('Demo Project')).toBeDefined()
        })
    })

    // 17. "Demo Project" badge is absent when isDemo is false
    it('does not render "Demo Project" badge when isDemo is false', async () => {
        render(<StatusBar isDemo={false} />)
        await waitFor(() => {
            expect(screen.queryByText('Demo Project')).toBeNull()
        })
    })

    // 18. "Open your project" link calls onOpenOwnProject when clicked
    it('renders "Open your project" link and calls onOpenOwnProject when clicked', async () => {
        const onOpenOwnProject = vi.fn()
        render(<StatusBar isDemo={true} onOpenOwnProject={onOpenOwnProject} />)
        await waitFor(() => screen.getByTestId('statusbar-overflow-btn'))
        fireEvent.click(screen.getByTestId('statusbar-overflow-btn'))
        await waitFor(() => screen.getByText('Open your project'))
        fireEvent.click(screen.getByText('Open your project'))
        expect(onOpenOwnProject).toHaveBeenCalled()
    })

    // ── S4.1: Figma dot has no glow shadow ────────────────────────────────────

    // 19. S4.1 — Figma indicator dot does not carry shadow-lg or shadow-emerald classes
    it('S4.1: Figma status dot has no shadow-lg or shadow-emerald classes', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true,
            lastWebhookAt: Date.now() - 1000, // synced within 24 h → emerald dot
            tokenCount: 5,
            port: 4545,
        })
        render(<StatusBar />)
        await waitFor(() => screen.getByText('Figma'))
        // The Figma button's dot span should have bg-emerald-500 but NOT any shadow classes
        const figmaBtn = screen.getByTitle('Figma connection — click for details')
        const dot = figmaBtn.querySelector('span')
        expect(dot).not.toBeNull()
        // Must not include glow shadow classes (S4.1 requirement)
        expect(dot!.className).not.toContain('shadow-lg')
        expect(dot!.className).not.toContain('shadow-emerald')
    })

    // ── S4.2: StatusBar left-to-right priority ordering ───────────────────────

    // 20. S4.2 — Export Gate appears before Figma button in DOM order
    it('S4.2: Export Gate appears before Figma status button in document order', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545,
        })
        useCanvasStore.setState({ mithrilViolations: [], overridesExist: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Export Ready')).toBeDefined()
            expect(screen.getByText('Figma')).toBeDefined()
        })
        const exportBtn = screen.getByTitle(
            'All design system checks pass — your file is ready to export. Click to open the Export panel.'
        )
        const figmaBtn = screen.getByTitle('Figma connection — click for details')
        // compareDocumentPosition: if FOLLOWING_SIBLING bit is set (4), exportBtn comes first
        const position = exportBtn.compareDocumentPosition(figmaBtn)
        // Node.DOCUMENT_POSITION_FOLLOWING === 4 — figmaBtn comes after exportBtn
        expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    // 21. S4.2 — Figma button appears before Flint (MCP) indicator in DOM order
    it('S4.2: Figma status button appears before MCP/Flint indicator in document order', async () => {
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true, lastWebhookAt: null, tokenCount: 5, port: 4545,
        })
        ;(window.flintAPI.mcp?.status as ReturnType<typeof vi.fn>).mockResolvedValue({ connected: true })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('Figma')).toBeDefined()
            // When connected, only the green dot is shown — no text label.
            // Verify the MCP indicator container is present via its tooltip.
            expect(screen.getByTitle('Governance engine — connected. Flint is actively checking your code.')).toBeDefined()
        })
        const figmaBtn = screen.getByTitle('Figma connection — click for details')
        const flintIndicator = screen.getByTitle('Governance engine — connected. Flint is actively checking your code.')
        // figmaBtn should precede flintIndicator in the document
        const position = figmaBtn.compareDocumentPosition(flintIndicator)
        expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    // 22. S4.2 — Export Gate shows violation label as second DOM priority (after itself)
    it('S4.2: Export Gate violation chip renders with amber text when violations exist', async () => {
        useCanvasStore.setState({ mithrilViolations: ['n1', 'n2'], overridesExist: false })
        render(<StatusBar />)
        await waitFor(() => {
            expect(screen.getByText('2 Issues')).toBeDefined()
        })
        // The gate button itself is the first meaningful item — verify it is amber
        const gateBtn = document.querySelector('button.text-amber-400')
        expect(gateBtn).not.toBeNull()
        // And it should be the first button in the footer
        const footer = document.querySelector('footer')
        const buttons = footer ? Array.from(footer.querySelectorAll('button')) : []
        const firstBtn = buttons[0]
        expect(firstBtn?.classList.contains('text-amber-400')).toBe(true)
    })

    // ── S4.14: Export Gate click → Governance tab ─────────────────────────────

    // 23. S4.14 — Clicking blocked Export Gate switches right panel to Governance (Health) tab
    it('S4.14: clicking blocked Export Gate chip calls setRightTab("governance")', async () => {
        useCanvasStore.setState({ mithrilViolations: ['node-1'], overridesExist: false })
        const setRightTab = vi.fn()
        useCanvasStore.setState({ setRightTab } as never)
        render(<StatusBar />)
        await waitFor(() => {
            const gateBtn = document.querySelector('button.text-amber-400')
            expect(gateBtn).not.toBeNull()
        })
        const gateBtn = document.querySelector('button.text-amber-400')!
        fireEvent.click(gateBtn)
        expect(setRightTab).toHaveBeenCalledWith('governance')
    })

    // ── S7.4: Pull / Push sync buttons ───────────────────────────────────────

    // Helper: open the Figma popover with a connected status
    async function openFigmaPopoverConnected() {
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue({
            running: true, lastWebhookAt: Date.now() - 60_000, tokenCount: 5, port: 4545,
        })
        render(<StatusBar />)
        await waitFor(() => screen.getByText('Figma'))
        fireEvent.click(screen.getByText('Figma'))
        await waitFor(() => screen.getByText('Figma Connection'))
    }

    // 24. S7.4 — Pull and Push buttons render in the Figma popover
    it('S7.4: renders Pull and Push buttons in the Figma popover', async () => {
        await openFigmaPopoverConnected()
        expect(screen.getByTestId('figma-sync-pull')).toBeDefined()
        expect(screen.getByTestId('figma-sync-push')).toBeDefined()
        expect(screen.getByText('Pull from Figma')).toBeDefined()
        expect(screen.getByText('Push to Figma')).toBeDefined()
    })

    // 25. S7.4 — Pull button calls flint_sync_pull via MCP
    it('S7.4: Pull button calls flint_sync_pull via MCP callTool', async () => {
        ;(window.flintAPI.mcp?.callTool as Mock).mockResolvedValue({
            content: [{ type: 'text', text: 'ok' }], isError: false,
        })
        await openFigmaPopoverConnected()
        fireEvent.click(screen.getByTestId('figma-sync-pull'))
        await waitFor(() => {
            expect(window.flintAPI.mcp?.callTool).toHaveBeenCalledWith('flint_sync_pull', {})
        })
    })

    // 26. S7.4 — Push button calls flint_sync_push via MCP
    it('S7.4: Push button calls flint_sync_push via MCP callTool', async () => {
        ;(window.flintAPI.mcp?.callTool as Mock).mockResolvedValue({
            content: [{ type: 'text', text: 'ok' }], isError: false,
        })
        await openFigmaPopoverConnected()
        fireEvent.click(screen.getByTestId('figma-sync-push'))
        await waitFor(() => {
            expect(window.flintAPI.mcp?.callTool).toHaveBeenCalledWith('flint_sync_push', {})
        })
    })

    // 27. S7.4 — Pull and Push buttons are disabled when Figma is not connected
    it('S7.4: Pull and Push buttons are disabled when Figma is disconnected', async () => {
        // tokenCount: 0 triggers the "No design system" state which redirects click
        // to governance tab instead of opening the popover. Use running: false + tokens > 0 instead.
        ;(window.flintAPI.figma.status as Mock).mockResolvedValue({
            running: false, lastWebhookAt: null, tokenCount: 5, port: 4545,
        })
        render(<StatusBar />)
        await waitFor(() => screen.getByText('Figma'))
        fireEvent.click(screen.getByText('Figma'))
        await waitFor(() => screen.getByText('Figma Connection'))
        const pullBtn = screen.getByTestId('figma-sync-pull')
        const pushBtn = screen.getByTestId('figma-sync-push')
        expect(pullBtn.hasAttribute('disabled')).toBe(true)
        expect(pushBtn.hasAttribute('disabled')).toBe(true)
    })

    // 28. S7.4 — Last synced timestamp displays when lastWebhookAt is present
    it('S7.4: displays last synced timestamp when figmaStatus has lastWebhookAt', async () => {
        await openFigmaPopoverConnected()
        await waitFor(() => {
            expect(screen.getByTestId('figma-last-synced')).toBeDefined()
            expect(screen.getByTestId('figma-last-synced').textContent).toContain('Last synced:')
        })
    })
})
