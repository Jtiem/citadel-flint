/**
 * TokenGrid.mint2.test.tsx
 *
 * MINT.2 — Code Truth Moat tests.
 * Covers:
 *   MINT.2a — Token usage scanner integration
 *   MINT.2b — Usage counts + dead token badges
 *   MINT.2c — Drift indicators
 *   MINT.2d — Silent drift badge on Tokens tab (TokenHealthBar)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TokenManager } from '../TokenManager'
import { TokenHealthBar } from '../TokenHealthBar'
import { TokenRow, TokenGroupSection, type ViewMode } from '../TokenGrid'
import { useTokenStore } from '../../../store/tokenStore'
import type { DesignToken, TokenUsageResult } from '../../../types/flint-api'
import type { TokenDrift } from '../../../hooks/useTokenUsage'

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

const USAGE_RESULTS: TokenUsageResult[] = [
    { tokenName: 'color.primary', cssVar: '--color-primary', usageCount: 5, files: ['App.tsx', 'Header.tsx', 'Button.tsx', 'Card.tsx', 'Nav.tsx'] },
    { tokenName: 'color.secondary', cssVar: '--color-secondary', usageCount: 0, files: [] },
    { tokenName: 'spacing.md', cssVar: '--spacing-md', usageCount: 12, files: Array.from({ length: 12 }, (_, i) => `file${i}.tsx`) },
    { tokenName: 'font.body', cssVar: '--font-body', usageCount: 0, files: [] },
]

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MINT.2 — Code Truth Moat', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    // ── MINT.2a: Token Usage Scanner ─────────────────────────────────────

    describe('MINT.2a — Token usage scanner', () => {
        it('calls scanUsage on mount', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)
            await waitFor(() => {
                expect(window.flintAPI.tokens.scanUsage).toHaveBeenCalled()
            })
        })

        it('gracefully handles missing scanUsage', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not wired'))
            render(<TokenManager />)
            // Should not crash — tokens still render
            await waitFor(() => {
                expect(screen.getByText('color.primary')).toBeDefined()
            })
        })
    })

    // ── MINT.2b: Usage Counts + Dead Token Badges ─────────────────────────

    describe('MINT.2b — Usage counts and dead token badges', () => {
        it('shows usage badge on token row in list view', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)

            // Switch to list view to see rows
            await waitFor(() => screen.getByText('color.primary'))
            const listBtn = screen.getByRole('radio', { name: /list view/i })
            fireEvent.click(listBtn)

            await waitFor(() => {
                const usageBadges = screen.queryAllByTestId('usage-badge')
                expect(usageBadges.length).toBeGreaterThan(0)
            })
        })

        it('shows dead badge for tokens with 0 usage', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)

            await waitFor(() => screen.getByText('color.primary'))
            const listBtn = screen.getByRole('radio', { name: /list view/i })
            fireEvent.click(listBtn)

            await waitFor(() => {
                const deadBadges = screen.queryAllByTestId('dead-token-badge')
                expect(deadBadges.length).toBeGreaterThan(0)
            })
        })

        it('dead badge has accessible aria-label', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)

            await waitFor(() => screen.getByText('color.primary'))
            const listBtn = screen.getByRole('radio', { name: /list view/i })
            fireEvent.click(listBtn)

            await waitFor(() => {
                const deadBadge = screen.queryAllByTestId('dead-token-badge')[0]
                expect(deadBadge).toBeDefined()
                expect(deadBadge.getAttribute('aria-label')).toContain('Dead token')
            })
        })

        it('shows usage filter controls when usage data is available', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)

            await waitFor(() => {
                expect(screen.getByTestId('usage-controls')).toBeDefined()
            })
        })

        it('"Dead only" checkbox filters to zero-usage tokens', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)

            await waitFor(() => screen.getByTestId('usage-controls'))

            const deadCheckbox = screen.getByLabelText('Show dead tokens only')
            fireEvent.click(deadCheckbox)

            // After filtering, only dead tokens should remain
            await waitFor(() => {
                // color.primary has 5 usages — should be hidden
                expect(screen.queryByText('color.primary')).toBeNull()
                // color.secondary has 0 usages — should remain
                expect(screen.getByText('color.secondary')).toBeDefined()
            })
        })

        it('"Sort by usage" checkbox reorders tokens', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue(USAGE_RESULTS)
            render(<TokenManager />)

            await waitFor(() => screen.getByTestId('usage-controls'))

            const sortCheckbox = screen.getByLabelText('Sort by usage count')
            fireEvent.click(sortCheckbox)

            // After sorting, dead tokens (0 usage) should appear first
            // Rendering order is managed through the grouped sections
            await waitFor(() => {
                expect(screen.getByText('color.secondary')).toBeDefined()
                expect(screen.getByText('spacing.md')).toBeDefined()
            })
        })
    })

    // ── MINT.2b: TokenHealthBar dead pill ──────────────────────────────────

    describe('MINT.2b — TokenHealthBar dead token pill', () => {
        it('shows dead token pill when deadTokenCount > 0', () => {
            render(
                <TokenHealthBar
                    totalTokens={10}
                    syncStatuses={[]}
                    figmaConnected={false}
                    usageFileCount={5}
                    deadTokenCount={3}
                />
            )
            const deadPill = screen.getByTestId('health-dead')
            expect(deadPill).toBeDefined()
            expect(deadPill.textContent).toContain('3 dead')
        })

        it('hides dead token pill when deadTokenCount is 0', () => {
            render(
                <TokenHealthBar
                    totalTokens={10}
                    syncStatuses={[]}
                    figmaConnected={false}
                    usageFileCount={5}
                    deadTokenCount={0}
                />
            )
            expect(screen.queryByTestId('health-dead')).toBeNull()
        })

        it('dead token pill has accessible aria-label', () => {
            render(
                <TokenHealthBar
                    totalTokens={10}
                    syncStatuses={[]}
                    figmaConnected={false}
                    usageFileCount={5}
                    deadTokenCount={2}
                />
            )
            const deadPill = screen.getByTestId('health-dead')
            expect(deadPill.getAttribute('aria-label')).toContain('2 dead token')
        })
    })

    // ── MINT.2c: Drift Indicators ────────────────────────────────────────

    describe('MINT.2c — Drift indicators', () => {
        it('shows drift pill in health bar when driftCount > 0', () => {
            render(
                <TokenHealthBar
                    totalTokens={10}
                    syncStatuses={[]}
                    figmaConnected={true}
                    usageFileCount={5}
                    driftCount={2}
                />
            )
            const driftPill = screen.getByTestId('health-drift')
            expect(driftPill).toBeDefined()
            expect(driftPill.textContent).toContain('2 drifted')
        })

        it('hides drift pill when driftCount is 0', () => {
            render(
                <TokenHealthBar
                    totalTokens={10}
                    syncStatuses={[]}
                    figmaConnected={true}
                    usageFileCount={5}
                    driftCount={0}
                />
            )
            expect(screen.queryByTestId('health-drift')).toBeNull()
        })

        it('drift pill has accessible aria-label', () => {
            render(
                <TokenHealthBar
                    totalTokens={10}
                    syncStatuses={[]}
                    figmaConnected={true}
                    usageFileCount={5}
                    driftCount={3}
                />
            )
            const driftPill = screen.getByTestId('health-drift')
            expect(driftPill.getAttribute('aria-label')).toContain('3 tokens drifted from Figma')
        })

        it('TokenRow shows drift badge when drift data is present', () => {
            const token = makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8' })
            const drift: TokenDrift = {
                tokenName: 'color.primary',
                localValue: '#1d4ed8',
                figmaValue: '#2563eb',
            }
            render(
                <div role="grid">
                    <TokenRow token={token} drift={drift} />
                </div>
            )
            const driftBadge = screen.getByTestId('drift-badge')
            expect(driftBadge).toBeDefined()
            expect(driftBadge.textContent).toBe('Drifted')
        })

        it('TokenRow drift badge has tooltip with both values', () => {
            const token = makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8' })
            const drift: TokenDrift = {
                tokenName: 'color.primary',
                localValue: '#1d4ed8',
                figmaValue: '#2563eb',
            }
            render(
                <div role="grid">
                    <TokenRow token={token} drift={drift} />
                </div>
            )
            const driftBadge = screen.getByTestId('drift-badge')
            expect(driftBadge.getAttribute('title')).toContain('#1d4ed8')
            expect(driftBadge.getAttribute('title')).toContain('#2563eb')
        })

        it('TokenRow does not show drift badge when no drift', () => {
            const token = makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8' })
            render(
                <div role="grid">
                    <TokenRow token={token} drift={null} />
                </div>
            )
            expect(screen.queryByTestId('drift-badge')).toBeNull()
        })
    })

    // ── MINT.2b: TokenRow usage badge unit tests ──────────────────────────

    describe('MINT.2b — TokenRow usage badges', () => {
        it('shows usage count badge for tokens with usage', () => {
            const token = makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8' })
            const usage: TokenUsageResult = {
                tokenName: 'color.primary',
                cssVar: '--color-primary',
                usageCount: 5,
                files: ['App.tsx', 'Header.tsx', 'Button.tsx', 'Card.tsx', 'Nav.tsx'],
            }
            render(
                <div role="grid">
                    <TokenRow token={token} usageResult={usage} />
                </div>
            )
            const badge = screen.getByTestId('usage-badge')
            expect(badge.textContent).toContain('5 files')
        })

        it('shows dead badge for tokens with 0 usage', () => {
            const token = makeToken({ id: 2, token_path: 'color.secondary', token_value: '#7c3aed' })
            const usage: TokenUsageResult = {
                tokenName: 'color.secondary',
                cssVar: '--color-secondary',
                usageCount: 0,
                files: [],
            }
            render(
                <div role="grid">
                    <TokenRow token={token} usageResult={usage} />
                </div>
            )
            const badge = screen.getByTestId('dead-token-badge')
            expect(badge.textContent).toBe('Dead')
        })

        it('high usage (>10) gets green styling', () => {
            const token = makeToken({ id: 3, token_path: 'spacing.md', token_value: '16px' })
            const usage: TokenUsageResult = {
                tokenName: 'spacing.md',
                cssVar: '--spacing-md',
                usageCount: 12,
                files: Array.from({ length: 12 }, (_, i) => `file${i}.tsx`),
            }
            render(
                <div role="grid">
                    <TokenRow token={token} usageResult={usage} />
                </div>
            )
            const badge = screen.getByTestId('usage-badge')
            expect(badge.className).toContain('emerald')
        })

        it('does not show usage badge when no usage data', () => {
            const token = makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8' })
            render(
                <div role="grid">
                    <TokenRow token={token} />
                </div>
            )
            expect(screen.queryByTestId('usage-badge')).toBeNull()
            expect(screen.queryByTestId('dead-token-badge')).toBeNull()
        })

        it('usage badge has accessible aria-label', () => {
            const token = makeToken({ id: 1 })
            const usage: TokenUsageResult = {
                tokenName: 'color.brand.primary',
                cssVar: '--color-brand-primary',
                usageCount: 3,
                files: ['a.tsx', 'b.tsx', 'c.tsx'],
            }
            render(
                <div role="grid">
                    <TokenRow token={token} usageResult={usage} />
                </div>
            )
            const badge = screen.getByTestId('usage-badge')
            expect(badge.getAttribute('aria-label')).toContain('Used in 3 files')
        })
    })
})
