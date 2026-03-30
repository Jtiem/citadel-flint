/**
 * GovernanceDashboard.govfix3.test.tsx
 *
 * GOV-FIX-3: Verifies that the health score ring does NOT show 100/A when
 * tokenCount is 0. Instead, only the empty state ("not measured") is shown.
 *
 * Tests:
 *   - Score ring is NOT rendered when tokens are absent (ring role=img hidden)
 *   - Grade letter "A" is NOT rendered when tokens are absent
 *   - Top Triggered Rules section is NOT rendered when tokens are absent
 *   - "All checks passing" clean-state banner is NOT rendered when tokens are absent
 *   - The no-tokens empty state IS rendered (OPP-5 coverage)
 *   - Score ring IS rendered when tokens exist
 *   - Grade IS rendered when tokens exist
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useTokenStore } from '../../../store/tokenStore'
import type { DesignToken } from '../../../types/flint-api'

// ── Helpers ────────────────────────────────────────────────────────────────────

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
    useTokenStore.setState({ tokens, isLoading: false, error: null })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — GOV-FIX-3 no-token state shows no score', () => {
    beforeEach(() => {
        // Ensure empty token store and baseline API absent
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        ;(window.flintAPI as Record<string, unknown>).baseline = undefined
    })

    describe('when tokenCount is 0 (no design system connected)', () => {
        it('does NOT render the numeric score "100" in the page', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText(/Health score measures against your design tokens/)).toBeDefined()
            })
            // The SVG score text "100" must not be in the document
            // We check textContent of the entire body to catch SVG text nodes
            const bodyText = document.body.textContent ?? ''
            // Must not contain "100" as a standalone number from the score ring
            // (the empty state message may contain other numbers — we check the SVG role)
            const scoreRing = screen.queryByRole('img', { name: /Health score/i })
            expect(scoreRing).toBeNull()
        })

        it('does NOT render the grade letter "A" as a styled heading', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText(/Health score measures against your design tokens/)).toBeDefined()
            })
            // The grade span has aria-label="Grade A" — if absent, the grade is hidden
            expect(screen.queryByLabelText('Grade A')).toBeNull()
        })

        it('does NOT render the "Top Triggered Rules" section', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText(/Health score measures against your design tokens/)).toBeDefined()
            })
            expect(screen.queryByText(/Top Triggered Rules/)).toBeNull()
        })

        it('does NOT render the "All clear" clean-state banner', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText(/Health score measures against your design tokens/)).toBeDefined()
            })
            expect(screen.queryByText(/All clear — export ready/)).toBeNull()
        })

        it('renders the empty state Import Tokens CTA', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText('Import Tokens')).toBeDefined()
            })
        })

        it('renders the Governance Health header even with no tokens', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                const matches = screen.getAllByText('Governance Health')
                expect(matches.length).toBeGreaterThan(0)
            })
        })
    })

    describe('when tokens are connected', () => {
        beforeEach(() => {
            seedTokens([makeToken()])
        })

        it('renders the score ring (role=img with aria-label Health score)', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByRole('img', { name: /Health score/i })).toBeDefined()
            })
        })

        it('renders the grade letter', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                // With no violations and tokens present, grade is A
                expect(screen.getByLabelText('Grade A')).toBeDefined()
            })
        })

        it('renders Top Triggered Rules section', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText(/Top Triggered Rules/)).toBeDefined()
            })
        })

        it('renders clean-state banner when score is 100', async () => {
            // No violations seeded → score = 100
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByText(/All clear — export ready/)).toBeDefined()
            })
        })

        it('does NOT render the no-tokens empty state', async () => {
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.queryByText(/Health score measures against your design tokens/)).toBeNull()
            })
        })
    })
})
