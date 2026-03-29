/**
 * TokenManager.test.tsx
 *
 * 11 tests for the TokenManager component. The component fetches all tokens
 * from window.flintAPI.tokens.readAll(), groups them by collection_name,
 * and provides a search filter.
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

    // 14. Color token validation — valid hex shows no error
    it('shows no validation error for a valid hex color value', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 20, token_type: 'color', token_value: '#0066ff' }),
        ])
        render(<TokenManager />)
        // The edit trigger button's accessible name is its text content (the token value)
        await waitFor(() => screen.getByRole('button', { name: '#0066ff' }))

        // Enter edit mode by clicking the value button
        fireEvent.click(screen.getByRole('button', { name: '#0066ff' }))
        await waitFor(() => screen.getByDisplayValue('#0066ff'))

        // Valid hex — no error
        expect(screen.queryByText('Not a valid color value')).toBeNull()
    })

    // 15. Color token validation — invalid value shows inline error
    it('shows "Not a valid color value" when an invalid color is typed for a color token', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 21, token_type: 'color', token_value: '#0066ff' }),
        ])
        render(<TokenManager />)
        await waitFor(() => screen.getByRole('button', { name: '#0066ff' }))

        // Enter edit mode
        fireEvent.click(screen.getByRole('button', { name: '#0066ff' }))
        const input = await waitFor(() => screen.getByDisplayValue('#0066ff'))

        // Type an invalid color
        fireEvent.change(input, { target: { value: 'notacolor' } })

        await waitFor(() => {
            expect(screen.getByText('Not a valid color value')).toBeDefined()
        })
    })

    // 16. Non-color token validation — empty value shows error
    it('shows "Value cannot be empty" when a non-color token value is cleared', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
            makeToken({ id: 22, token_type: 'dimension', token_value: '16px' }),
        ])
        render(<TokenManager />)
        await waitFor(() => screen.getByRole('button', { name: '16px' }))

        fireEvent.click(screen.getByRole('button', { name: '16px' }))
        const input = await waitFor(() => screen.getByDisplayValue('16px'))

        fireEvent.change(input, { target: { value: '' } })

        await waitFor(() => {
            expect(screen.getByText('Value cannot be empty')).toBeDefined()
        })
    })
})
