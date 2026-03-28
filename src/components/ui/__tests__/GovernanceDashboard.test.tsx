/**
 * GovernanceDashboard.test.tsx
 *
 * Tests for the GovernanceDashboard component, focusing on the no-tokens
 * empty state (OPP-5) and the baseline score-ring render path.
 *
 * The tokenStore is populated by tokenStore.fetchTokens() which calls
 * window.flintAPI.tokens.readAll(). We control the empty vs. populated
 * state by setting the mock return value before rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useTokenStore } from '../../../store/tokenStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { DesignToken } from '../../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: 1,
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
        ...overrides,
    }
}

function seedTokens(tokens: DesignToken[]) {
    // Directly set the tokenStore state — faster than waiting for IPC round-trip
    useTokenStore.setState({ tokens, isLoading: false, error: null })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard', () => {
    beforeEach(() => {
        // Ensure token store is empty before each test (setup.ts doesn't reset it)
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        // Mock baseline API as undefined (not available in test environment)
        ;(window.flintAPI as Record<string, unknown>).baseline = undefined
    })
    // 1. Shows no-tokens empty state when tokenStore.tokens is empty
    it('shows no design system empty state when token count is zero', async () => {
        // tokenStore starts empty by default (setup.ts resets stores)
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/No design system connected/)).toBeDefined()
        })
    })

    // 2. Empty state copy references design tokens and governance
    it('empty state explains relationship between tokens and health score', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/Health score measures against your design tokens/)).toBeDefined()
        })
    })

    // 3. Empty state shows Import Tokens CTA
    it('shows Import Tokens button when no tokens are loaded', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Import Tokens')).toBeDefined()
        })
    })

    // 4. Import Tokens button navigates to tokens tab
    it('Import Tokens button switches rightTab to tokens', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Import Tokens')).toBeDefined()
        })
        fireEvent.click(screen.getByText('Import Tokens'))
        expect(useCanvasStore.getState().rightTab).toBe('tokens')
    })

    // 5. Score ring renders when tokens are loaded (no empty state)
    it('renders the Governance Health header when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            // Multiple elements can contain this text — use getAllByText
            const matches = screen.getAllByText('Governance Health')
            expect(matches.length).toBeGreaterThan(0)
        })
    })

    // 6. Score ring renders numeric score when tokens are loaded
    it('renders a numeric health score when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            // Score of 100 with no violations — look for "100" in SVG text
            const allText = document.body.textContent ?? ''
            expect(allText).toContain('100')
        })
    })

    // 7. Empty state is hidden when tokens are loaded
    it('does not show the no-tokens empty state when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.queryByText(/No design system connected/)).toBeNull()
        })
    })

    // 8. Score explanation section renders when tokens are loaded.
    // Note: "Penalty Breakdown" was replaced with "How is this score calculated?" (EDU-08).
    it('renders score explanation toggle when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/How is this score calculated/i)).toBeDefined()
        })
    })

    // 9. Delta Mode controls render when tokens are loaded (GLASS.1e promoted label)
    it('renders Delta Mode toggle button when tokens exist', async () => {
        seedTokens([makeToken()])
        // Baseline API must return false for 'isSet'
        ;(window.flintAPI.baseline?.isSet as ReturnType<typeof vi.fn> | undefined)?.mockResolvedValue(false)
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/Show only new violations/)).toBeDefined()
        })
    })

    // 10. GOV.2 override badge renders when override count > 0 (GLASS.3.4-B)
    it('shows override count when governance overrides are recorded', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(3)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('3 overrides')).toBeDefined()
        })
    })

    // 11. Override badge uses singular form for count of 1 (GLASS.3.4-B)
    it('shows singular "override" for count of 1', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(1)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('1 override')).toBeDefined()
        })
    })

    // 12. Override badge is hidden when count is 0 (GLASS.3.4-B)
    it('does not show override badge when count is zero', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.queryByText(/override/i)).toBeNull()
        })
    })
})
