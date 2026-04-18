/**
 * TokenManager.test.tsx
 *
 * Tests for the read-only TokenManager component. Token values are
 * governed via MCP tools — not editable directly in this UI.
 *
 * Covers:
 *   - Loading state, token display, grouping, search, empty state
 *   - Import modal
 *   - MINT.1a: Token Health Bar (total, sync status, coverage)
 *   - MINT.1b: Visual Token Grid (swatches, specimens, view toggle)
 *   - MINT.1c: Mode Columns (light/dark side-by-side)
 *   - MINT.1d: Read-only governance UI (no dangerous mutations)
 *   - MINT.1e: Accessibility (aria-labels, grid semantics, keyboard)
 *   - S7.2: Per-token sync badges
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TokenManager } from '../TokenManager'
import { useTokenStore } from '../../../store/tokenStore'
import type { DesignToken } from '../../../types/flint-api'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: Math.floor(Math.random() * 10000),
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
        ...overrides,
    }
}

const SAMPLE_TOKENS: DesignToken[] = [
    makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8', collection_name: 'Colors' }),
    makeToken({ id: 2, token_path: 'color.secondary', token_type: 'color', token_value: '#7c3aed', collection_name: 'Colors' }),
    makeToken({ id: 3, token_path: 'spacing.md', token_type: 'dimension', token_value: '16px', collection_name: 'Spacing' }),
    makeToken({ id: 4, token_path: 'font.body', token_type: 'fontFamily', token_value: 'Inter', collection_name: 'Typography' }),
]

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TokenManager', () => {
    beforeEach(() => {
        // Reset token store between tests to prevent state leaking
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    // 1. Shows loading state when store isLoading is true
    it('shows loading text while tokens are being fetched', () => {
        // Set the store to loading state directly (simulates fetchTokens in progress)
        useTokenStore.setState({ isLoading: true, tokens: [], error: null })
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
        render(<TokenManager />)
        expect(screen.getByText(/Loading/)).toBeDefined()
    })

    // 2. Shows tokens after fetch resolves
    it('renders token paths after tokens are fetched', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByText('color.primary')).toBeDefined()
        })
    })

    // 3. Shows empty state when no tokens (MINT.5 Phase 2 — ConnectFigmaEmptyState replaces the legacy copy).
    it('shows empty state message when token list is empty', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)
        await waitFor(() => {
            // Phase 2: new ConnectFigmaEmptyState disconnected-variant heading.
            expect(screen.getByText(/Connect Figma to sync your design tokens/i)).toBeDefined()
        })
    })

    // 3b. Empty state renders the data-testid anchor
    it('empty state container has data-testid="tokens-empty-state"', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)
        await waitFor(() => {
            const el = document.querySelector('[data-testid="tokens-empty-state"]')
            expect(el).not.toBeNull()
        })
    })

    // 4. Groups tokens by collection_name
    it('groups tokens under their collection_name header', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByText('Colors')).toBeDefined()
            expect(screen.getByText('Spacing')).toBeDefined()
            expect(screen.getByText('Typography')).toBeDefined()
        })
    })

    // 5. Shows collection header with count badge
    it('renders a count badge next to each collection header', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            // Colors collection has 2 tokens
            expect(screen.getByText('2')).toBeDefined()
        })
    })

    // 6. Shows color swatch for color-type tokens
    it('renders a color swatch span for tokens with token_type "color"', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 10, token_type: 'color', token_value: '#ff0000' }),
        ])
        render(<TokenManager />)
        await waitFor(() => {
            // ColorSwatch renders a span with inline backgroundColor style
            const swatch = document.querySelector('span[style*="background-color"]')
            expect(swatch).not.toBeNull()
        })
    })

    // 7. No swatch rendered for non-color tokens (in list view)
    it('does NOT render a color swatch for non-color token types in list view', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 11, token_type: 'dimension', token_value: '16px' }),
        ])
        render(<TokenManager />)
        await waitFor(() => screen.getByText('16px'))

        // Switch to list view
        const listBtn = screen.getByRole('radio', { name: /list view/i })
        fireEvent.click(listBtn)

        await waitFor(() => {
            expect(screen.getByText('16px')).toBeDefined()
            const swatch = document.querySelector('span[style*="background-color"]')
            expect(swatch).toBeNull()
        })
    })

    // 8. Search filters by token_path
    it('filters the token list by token_path when a query is entered', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))

        const searchInput = screen.getByLabelText('Search tokens by name, value, or type')
        fireEvent.change(searchInput, { target: { value: 'spacing' } })

        await waitFor(() => {
            expect(screen.getByText('spacing.md')).toBeDefined()
            expect(screen.queryByText('color.primary')).toBeNull()
        })
    })

    // 9. Search filters by token_value
    it('filters the token list by token_value when a query is entered', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))

        const searchInput = screen.getByLabelText('Search tokens by name, value, or type')
        fireEvent.change(searchInput, { target: { value: 'Inter' } })

        await waitFor(() => {
            expect(screen.getByText('font.body')).toBeDefined()
            expect(screen.queryByText('color.primary')).toBeNull()
        })
    })

    // 10. Search shows "no matches" message when filter returns nothing
    it('shows "No tokens match" when the query matches nothing', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))

        const searchInput = screen.getByLabelText('Search tokens by name, value, or type')
        fireEvent.change(searchInput, { target: { value: 'zzznomatch999' } })

        await waitFor(() => {
            expect(screen.getByText('No tokens match')).toBeDefined()
        })
    })

    // 11. Shows error state when fetch fails
    it('shows an error message when the token fetch rejects', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('IPC unavailable')
        )
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByText('IPC unavailable')).toBeDefined()
        })
    })

    // 12. ImportModal has role=dialog and aria-modal
    it('ImportModal renders with role=dialog and aria-modal when open', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)
        // Open the import modal
        const importBtn = screen.getByRole('button', { name: /Import JSON/i })
        fireEvent.click(importBtn)
        await waitFor(() => {
            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeDefined()
            expect(dialog.getAttribute('aria-modal')).toBe('true')
        })
    })

    // 13. ImportModal title is labelled via aria-labelledby
    it('ImportModal title element matches aria-labelledby', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)
        fireEvent.click(screen.getByRole('button', { name: /Import JSON/i }))
        await waitFor(() => {
            const dialog = screen.getByRole('dialog')
            const labelId = dialog.getAttribute('aria-labelledby')
            expect(labelId).toBeTruthy()
            const title = document.getElementById(labelId!)
            expect(title).not.toBeNull()
            expect(title!.textContent).toContain('Import Token File (JSON)')
        })
    })

    // ── MINT.1d: Read-only governance UI (no dangerous mutations) ─────────────

    // 14. No delete button present
    it('does not render a delete button for any token row', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))
        expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
        expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
    })

    // 15. No "Clear all" button present
    it('does not render a "Clear all" or "Reset" button', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))
        expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull()
        expect(screen.queryByRole('button', { name: /reset/i })).toBeNull()
        expect(screen.queryByText('Clear all')).toBeNull()
    })

    // 16. Token values are not in editable inputs
    it('token values are shown as read-only text, not as input elements', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))
        expect(screen.getByText('#1d4ed8')).toBeDefined()
        expect(screen.queryByDisplayValue('#1d4ed8')).toBeNull()
    })

    // 17. Read-only tooltip is present on token value elements (list view)
    it('token value text has governance tooltip in list view', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 30, token_type: 'color', token_value: '#ff0000' }),
        ])
        render(<TokenManager />)
        // Switch to list view
        await waitFor(() => {
            const listBtn = screen.getByRole('radio', { name: /list view/i })
            fireEvent.click(listBtn)
        })
        await waitFor(() => screen.getByText('#ff0000'))
        const valueEl = screen.getByText('#ff0000')
        const title = valueEl.getAttribute('title')
        expect(title).toBeTruthy()
        expect(title!.toLowerCase()).toContain('managed')
    })

    // ── S7.2: Per-token sync badges ─────────────────────────────────────────

    // 18. No sync badges when Figma is not connected
    it('does not show sync badges when Figma is not connected', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: false, lastWebhookAt: null, tokenCount: 0, port: 4545,
        })
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))
        expect(screen.queryAllByTestId('sync-badge').length).toBe(0)
    })

    // 19. Shows sync badges when Figma is connected and tokens are available
    it('shows sync badges when Figma is connected', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8', collection_name: 'Colors' }),
        ])
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
        })
        ;(window.flintAPI.mcp!.readResource as ReturnType<typeof vi.fn>).mockResolvedValue(
            JSON.stringify([{ token_path: 'color.primary', token_value: '#1d4ed8' }])
        )
        render(<TokenManager />)
        await waitFor(() => {
            const badges = screen.queryAllByTestId('sync-badge')
            expect(badges.length).toBeGreaterThan(0)
        })
    })

    // ── MINT.1a: Token Health Bar ───────────────────────────────────────────

    // 20. Health bar appears when tokens are loaded
    it('renders the token health bar when tokens exist', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const healthBar = screen.getByTestId('token-health-bar')
            expect(healthBar).toBeDefined()
        })
    })

    // 21. Health bar shows total token count
    it('health bar displays the total token count', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const totalPill = screen.getByTestId('health-total')
            expect(totalPill.textContent).toContain('4 tokens')
        })
    })

    // 22. Health bar does not appear when no tokens
    it('health bar is hidden when token list is empty', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.queryByTestId('token-health-bar')).toBeNull()
        })
    })

    // 23. Health bar shows sync status when Figma connected
    it('health bar shows sync status pill when Figma is connected', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
            running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
        })
        ;(window.flintAPI.mcp!.readResource as ReturnType<typeof vi.fn>).mockResolvedValue(
            JSON.stringify([{ token_path: 'color.primary', token_value: '#1d4ed8' }])
        )
        render(<TokenManager />)
        await waitFor(() => {
            const syncPill = screen.getByTestId('health-sync')
            expect(syncPill).toBeDefined()
        })
    })

    // 24. Health bar shows coverage when scanUsage returns data
    it('health bar shows coverage pill when usage data is available', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue([
            { tokenName: 'color.primary', cssVar: '--color-primary', usageCount: 3, files: ['App.tsx', 'Header.tsx', 'Button.tsx'] },
        ])
        render(<TokenManager />)
        await waitFor(() => {
            const coveragePill = screen.getByTestId('health-coverage')
            expect(coveragePill).toBeDefined()
            expect(coveragePill.textContent).toContain('Used in 3 files')
        })
    })

    // ── MINT.1b: Visual Token Grid ──────────────────────────────────────────

    // 25. View toggle buttons are present
    it('renders grid/list view toggle buttons', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByRole('radio', { name: /grid view/i })).toBeDefined()
            expect(screen.getByRole('radio', { name: /list view/i })).toBeDefined()
        })
    })

    // 26. Grid view renders grid cards for color tokens
    it('renders grid cards in grid view mode', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8' }),
            makeToken({ id: 2, token_path: 'color.secondary', token_type: 'color', token_value: '#7c3aed' }),
        ])
        render(<TokenManager />)
        await waitFor(() => {
            const cards = screen.queryAllByTestId('token-grid-card')
            expect(cards.length).toBe(2)
        })
    })

    // 27. Switching to list view removes grid cards
    it('switches from grid to list view when toggled', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8' }),
        ])
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.queryAllByTestId('token-grid-card').length).toBe(1)
        })

        // Switch to list view
        const listBtn = screen.getByRole('radio', { name: /list view/i })
        fireEvent.click(listBtn)

        await waitFor(() => {
            expect(screen.queryAllByTestId('token-grid-card').length).toBe(0)
        })
    })

    // 28. Typography tokens show "Aa" specimen
    it('renders "Aa" specimen for fontFamily tokens in grid view', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 1, token_path: 'font.heading', token_type: 'fontFamily', token_value: 'Inter', collection_name: 'Typography' }),
        ])
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByText('Aa')).toBeDefined()
        })
    })

    // ── MINT.1c: Mode Columns ───────────────────────────────────────────────

    // 29. Shows light and dark swatches side-by-side in grid view
    it('shows light and dark mode swatches side-by-side for color tokens', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8', mode: 'light', collection_name: 'Colors' }),
            makeToken({ id: 2, token_path: 'color.primary', token_type: 'color', token_value: '#818cf8', mode: 'dark', collection_name: 'Colors' }),
        ])
        render(<TokenManager />)
        await waitFor(() => {
            // Should show mode columns with both values
            const modeColumns = screen.queryByTestId('mode-columns')
            expect(modeColumns).not.toBeNull()
            expect(modeColumns!.textContent).toContain('#1d4ed8')
            expect(modeColumns!.textContent).toContain('#818cf8')
        })
    })

    // ── MINT.1e: Accessibility ──────────────────────────────────────────────

    // 30. Search input has aria-label
    it('search input has proper aria-label', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const input = screen.getByLabelText('Search tokens by name, value, or type')
            expect(input).toBeDefined()
        })
    })

    // 31. Color swatches have aria-label with color info
    it('color swatches have aria-label with color name and value', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8' }),
        ])
        render(<TokenManager />)
        await waitFor(() => {
            const swatch = screen.getByLabelText(/Color swatch.*color\.primary.*#1d4ed8/i)
            expect(swatch).toBeDefined()
        })
    })

    // 32. Grid has proper role="grid" semantics
    it('token grid sections have role="grid"', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const grids = document.querySelectorAll('[role="grid"]')
            expect(grids.length).toBeGreaterThan(0)
        })
    })

    // 33. View toggle has radiogroup semantics
    it('view toggle has radiogroup role', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const radiogroup = screen.getByRole('radiogroup', { name: /token view mode/i })
            expect(radiogroup).toBeDefined()
        })
    })

    // 34. Health bar has status role
    it('health bar has role="status" for screen readers', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const statusBar = screen.getByRole('status')
            expect(statusBar).toBeDefined()
        })
    })

    // 35. Clear search button has aria-label
    it('clear search button has aria-label', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))

        const searchInput = screen.getByLabelText('Search tokens by name, value, or type')
        fireEvent.change(searchInput, { target: { value: 'color' } })

        await waitFor(() => {
            const clearBtn = screen.getByLabelText('Clear search')
            expect(clearBtn).toBeDefined()
        })
    })
})
