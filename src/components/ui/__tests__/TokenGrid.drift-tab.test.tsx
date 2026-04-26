/**
 * TokenGrid.drift-tab.test.tsx
 *   src/components/ui/__tests__/TokenGrid.drift-tab.test.tsx
 *
 * MINT.5 Phase 2 §2.2 — Integration coverage for the drift sub-tab wiring.
 * Exercises three contract testBoundaries:
 *   - "TokenManager drift radio" (badge count renders)
 *   - "TokenGrid drift filter" (viewMode=drift routes to DriftGroupSection)
 *   - "radiogroup ARIA + badge-count updates"
 *
 * Uses TokenManager as the render surface (per contract "TokenGrid" is
 * composed inside TokenManager; the sub-tab radio lives on the TokenManager
 * toolbar). Drift data is injected through window.flintAPI.tokens.readFigmaDrift
 * which useTokenUsage consumes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { TokenManager } from '../TokenManager'
import { useTokenStore } from '../../../store/tokenStore'
import type { DesignToken } from '../../../types/flint-api'
import type { TokenDrift } from '../../../hooks/useTokenUsage'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: Math.floor(Math.random() * 100000),
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
]

const DRIFT_SAMPLE: TokenDrift[] = [
    { tokenName: 'color.primary', localValue: '#1d4ed8', figmaValue: '#2563eb', deltaE: 3.2 },
    { tokenName: 'color.secondary', localValue: '#7c3aed', figmaValue: '#8b5cf6', deltaE: 2.1 },
    { tokenName: 'spacing.md', localValue: '16px', figmaValue: '18px' },
]

/** Install a readFigmaDrift stub that resolves to the provided drift list. */
function installDriftStub(drift: TokenDrift[]): void {
    const api = (window as unknown as { flintAPI: Record<string, unknown> }).flintAPI
    const tokens = api.tokens as Record<string, unknown>
    tokens.readFigmaDrift = vi.fn().mockResolvedValue(drift)
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MINT.5 Phase 2 — TokenGrid drift sub-tab integration', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    it('radiogroup retains proper ARIA role and accessible name', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        installDriftStub([])
        render(<TokenManager />)
        await waitFor(() => {
            const group = screen.getByRole('radiogroup', { name: /token view mode/i })
            expect(group).toBeDefined()
        })
    })

    it('does not render the Drift radio when drift count is zero', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        installDriftStub([])
        render(<TokenManager />)
        await waitFor(() => screen.getByText('color.primary'))
        // The drift radio is only mounted when drift exists.
        expect(screen.queryByTestId('viewmode-drift-radio')).toBeNull()
    })

    it('renders "Drift" radio with accessible badge count when drift exists', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        installDriftStub(DRIFT_SAMPLE)
        render(<TokenManager />)
        await waitFor(() => {
            const driftRadio = screen.getByTestId('viewmode-drift-radio')
            expect(driftRadio).toBeDefined()
            // aria-label embeds the count so screen readers announce it.
            expect(driftRadio.getAttribute('aria-label')).toMatch(/drift \(3\)/i)
        })
        // Visible badge count matches
        const badge = screen.getByTestId('viewmode-drift-badge')
        expect(badge.textContent).toBe('3')
    })

    it('routes to DriftGroupSection when viewMode === "drift"', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        installDriftStub(DRIFT_SAMPLE)
        render(<TokenManager />)

        // Wait for tokens and drift to load — drift radio appears
        await waitFor(() => {
            expect(screen.getByTestId('viewmode-drift-radio')).toBeDefined()
        })

        // Click into drift mode.
        fireEvent.click(screen.getByTestId('viewmode-drift-radio'))

        await waitFor(() => {
            // DriftGroupSection renders its container when drift exists.
            expect(screen.queryByTestId('drift-group-section')).not.toBeNull()
        })
    })

    // FIX-7 (UX WARN-4): the old behavior was to auto-revert viewMode from
    // 'drift' to 'grid' when drift cleared. That silently stranded the user.
    // The new behavior: the drift radio stays visible while viewMode === 'drift'
    // so DriftGroupSection can render its own "No drift detected" empty state.
    it('keeps viewMode on drift and renders empty state when drift clears', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
        installDriftStub(DRIFT_SAMPLE)
        const { rerender } = render(<TokenManager />)

        // Wait for drift radio and click into drift mode
        await waitFor(() => {
            expect(screen.getByTestId('viewmode-drift-radio')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('viewmode-drift-radio'))
        await waitFor(() => {
            expect(screen.queryByTestId('drift-group-section')).not.toBeNull()
        })

        // Simulate a Pull that clears all drift: rescan resolves to []
        const api = (window as unknown as { flintAPI: Record<string, unknown> }).flintAPI
        ;(api.tokens as Record<string, unknown>).readFigmaDrift = vi.fn().mockResolvedValue([])

        // Force a tokenStore update to re-run useTokenUsage's effect (keyed on tokenCount).
        await act(async () => {
            useTokenStore.setState({ tokens: [...SAMPLE_TOKENS, makeToken({ id: 999, token_path: 'color.extra' })] })
        })
        rerender(<TokenManager />)

        await waitFor(() => {
            // drift-group-section is only rendered when drift > 0; when drift
            // clears, DriftGroupSection's own empty-state node renders instead.
            expect(screen.queryByTestId('drift-group-empty')).not.toBeNull()
            // Drift radio remains visible because viewMode is still 'drift'.
            expect(screen.queryByTestId('viewmode-drift-radio')).not.toBeNull()
        })
    })
})
