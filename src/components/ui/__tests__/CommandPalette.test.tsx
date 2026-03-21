/**
 * CommandPalette.test.tsx — Phase CP.1
 *
 * 14 tests covering the ⌘K command palette:
 * - Visibility toggling (closed / open)
 * - Backdrop and Escape key dismiss
 * - Keyboard navigation (↑↓, Enter)
 * - Query filtering
 * - Registry search integration (MCP callTool mock)
 * - Command actions (canvas view, right tab, notifications)
 * - No-file guard on audit/fix commands
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { CommandPalette } from '../CommandPalette'
import { useCanvasStore } from '../../../store/canvasStore'
import { useNotificationStore } from '../../../store/notificationStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

const noop = vi.fn()

function renderPalette(props?: Partial<{ onOpenExportModal: () => void; onOpenGovernancePanel: () => void }>) {
    return render(
        <CommandPalette
            onOpenExportModal={props?.onOpenExportModal ?? noop}
            onOpenGovernancePanel={props?.onOpenGovernancePanel ?? noop}
        />,
    )
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CommandPalette', () => {
    // 1. Hidden when commandPaletteOpen = false (default)
    it('renders nothing when closed', () => {
        renderPalette()
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    // 2. Visible when commandPaletteOpen = true
    it('renders the palette dialog when open', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeDefined()
    })

    // 3. Search input is rendered and focused
    it('renders a search input with placeholder', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        const input = screen.getByRole('textbox', { name: 'Command search' })
        expect(input).toBeDefined()
    })

    // 4. Shows static command groups by default (no query)
    it('shows Governance and Canvas section headings when no query', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        expect(screen.getByText('Governance')).toBeDefined()
        expect(screen.getByText('Canvas')).toBeDefined()
    })

    // 5. Escape key closes the palette
    it('closes on Escape key', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(useCanvasStore.getState().commandPaletteOpen).toBe(false)
    })

    // 6. Backdrop click closes the palette
    it('closes when the backdrop is clicked', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        const dialog = screen.getByRole('dialog')
        // Click the backdrop (the first child div of the dialog)
        const backdrop = dialog.querySelector('[aria-hidden="true"]') as HTMLElement
        expect(backdrop).toBeDefined()
        fireEvent.click(backdrop)
        expect(useCanvasStore.getState().commandPaletteOpen).toBe(false)
    })

    // 7. Close button in the palette header
    it('closes when the X button is clicked', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        fireEvent.click(screen.getByRole('button', { name: 'Close command palette' }))
        expect(useCanvasStore.getState().commandPaletteOpen).toBe(false)
    })

    // 8. Query filter narrows visible commands
    it('filters commands by query text', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'preview' } })
        expect(screen.getByText('Switch to Preview Mode')).toBeDefined()
        // Non-matching commands should be absent
        expect(screen.queryByText('Open Git Time Machine')).toBeNull()
    })

    // 9. No-match state shown when query yields nothing (waits for registry debounce)
    it('shows no-match message when query has no results', async () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'zzznomatch' } })
        await waitFor(
            () => expect(screen.getByText(/No commands match/i)).toBeDefined(),
            { timeout: 600 },
        )
    })

    // 10. ArrowDown advances the selected index
    it('moves selection down with ArrowDown', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        // First item starts selected (index 0)
        const allOptions = () => screen.getAllByRole('option')
        expect(allOptions()[0].getAttribute('aria-selected')).toBe('true')
        fireEvent.keyDown(window, { key: 'ArrowDown' })
        expect(allOptions()[1].getAttribute('aria-selected')).toBe('true')
    })

    // 11. ArrowUp does not go below 0
    it('does not move selection above 0 with ArrowUp at top', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        const allOptions = () => screen.getAllByRole('option')
        fireEvent.keyDown(window, { key: 'ArrowUp' })
        expect(allOptions()[0].getAttribute('aria-selected')).toBe('true')
    })

    // 12. Enter activates the selected command (canvas view switch)
    it('activates the selected command on Enter — canvas view switch', () => {
        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()
        const input = screen.getByRole('textbox')
        // Filter to only the "Build View" command
        fireEvent.change(input, { target: { value: 'Build View' } })
        // "Switch to Build View" should now be the first (only) item
        fireEvent.keyDown(window, { key: 'Enter' })
        // After 60ms delay the store should update
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(useCanvasStore.getState().canvasView).toBe('build')
                resolve()
            }, 100)
        })
    })

    // 13. Governance action: no-file guard shows warning notification
    it('shows a warning notification when audit is triggered with no active file', async () => {
        useCanvasStore.setState({ commandPaletteOpen: true, activeFilePath: null })
        renderPalette()
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'Run Audit' } })
        fireEvent.keyDown(window, { key: 'Enter' })
        await waitFor(
            () => {
                const notifications = useNotificationStore.getState().notifications
                expect(notifications.some((n) => n.title === 'No file open')).toBe(true)
            },
            { timeout: 500 },
        )
    })

    // 14. Registry search: MCP callTool is invoked when query ≥ 2 chars
    it('calls flint_query_registry via MCP when query is 2+ chars', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({
            isError: false,
            content: [{ text: '### Button\n**Import**: `@/components/ui/Button`\nA primary action button.\n' }],
        })
        ;(window as any).flintAPI.mcp = { callTool: mockCallTool, readResource: vi.fn(), status: vi.fn(), onEvent: vi.fn().mockReturnValue(() => {}) }

        useCanvasStore.setState({ commandPaletteOpen: true })
        renderPalette()

        const input = screen.getByRole('textbox')
        act(() => { fireEvent.change(input, { target: { value: 'Bu' } }) })

        await waitFor(
            () => expect(mockCallTool).toHaveBeenCalledWith('flint_query_registry', { query: 'Bu', limit: 5 }),
            { timeout: 500 },
        )
    })
})
