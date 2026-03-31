/**
 * TokenManager.test.tsx
 *
 * Tests for the read-only TokenManager component. Token values are
 * governed via MCP tools — not editable directly in this UI.
 * Covers: loading state, token display, grouping, search, empty state,
 * import modal, and the removal of dangerous mutation actions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TokenManager } from '../TokenManager'
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
    // 1. Shows loading state initially (before fetch resolves)
    it('shows loading text while tokens are being fetched', () => {
        // Never resolves during this check
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
        render(<TokenManager />)
        expect(screen.getByText('Loading…')).toBeDefined()
    })

    // 2. Shows tokens after fetch resolves
    it('renders token paths after tokens are fetched', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByText('color.primary')).toBeDefined()
        })
    })

    // 3. Shows empty state when no tokens
    it('shows empty state message when token list is empty', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)
        await waitFor(() => {
            expect(screen.getByText('No design tokens loaded. Connect Figma or import a tokens JSON file.')).toBeDefined()
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
            // Collection header text is the raw collection_name (CSS uppercase via Tailwind)
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

    // 7. No swatch rendered for non-color tokens
    it('does NOT render a color swatch for non-color token types', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 11, token_type: 'dimension', token_value: '16px' }),
        ])
        render(<TokenManager />)
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

        const searchInput = screen.getByPlaceholderText('Search by name, value, or type…')
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

        const searchInput = screen.getByPlaceholderText('Search by name, value, or type…')
        fireEvent.change(searchInput, { target: { value: 'Inter' } })

        await waitFor(() => {
            expect(screen.getByText('font.body')).toBeDefined()
            expect(screen.queryByText('color.primary')).toBeNull()
        })
    })

    // 10. Search shows "no matches" message when filter returns nothing
    it('shows "No tokens match your search" when the query matches nothing', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))

        const searchInput = screen.getByPlaceholderText('Search by name, value, or type…')
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
            expect(screen.getByText('Error: IPC unavailable')).toBeDefined()
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
        // No button with trash/delete label
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
        // The value should appear as text
        expect(screen.getByText('#1d4ed8')).toBeDefined()
        // No input with that value
        expect(screen.queryByDisplayValue('#1d4ed8')).toBeNull()
    })

    // 17. Read-only tooltip is present on token value elements
    it('token value text has governance tooltip', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 30, token_type: 'color', token_value: '#ff0000' }),
        ])
        render(<TokenManager />)
        await waitFor(() => screen.getByText('#ff0000'))
        const valueEl = screen.getByText('#ff0000')
        expect(valueEl.getAttribute('title')).toContain('managed through your design system')
    })
})
