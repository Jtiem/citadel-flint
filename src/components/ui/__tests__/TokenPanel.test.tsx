/**
 * TokenPanel.test.tsx
 *
 * Tests for the MINT Wave 3 token observability panel.
 * Covers: TokenHealthBar, ColorGrid, TypographySpecimen, SpacingRuler,
 *         ModeColumns, search a11y, and collection header semantics.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TokenPanel } from '../TokenPanel'
import type { DesignToken } from '../../../types/flint-api'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: Math.floor(Math.random() * 100_000),
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
        ...overrides,
    }
}

const COLOR_TOKENS: DesignToken[] = [
    makeToken({ id: 1, token_path: 'color.primary', token_value: '#1d4ed8', collection_name: 'Colors' }),
    makeToken({ id: 2, token_path: 'color.secondary', token_value: '#7c3aed', collection_name: 'Colors' }),
    makeToken({ id: 3, token_path: 'color.accent', token_value: '#10b981', collection_name: 'Colors' }),
]

const TYPOGRAPHY_TOKENS: DesignToken[] = [
    makeToken({ id: 10, token_path: 'fontFamily.sans', token_type: 'fontFamily', token_value: 'Inter', collection_name: 'Typography' }),
    makeToken({ id: 11, token_path: 'fontWeight.bold', token_type: 'fontWeight', token_value: '700', collection_name: 'Typography' }),
]

const SPACING_TOKENS: DesignToken[] = [
    makeToken({ id: 20, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px', collection_name: 'Spacing' }),
    makeToken({ id: 21, token_path: 'spacing.md', token_type: 'dimension', token_value: '16px', collection_name: 'Spacing' }),
]

const MULTI_MODE_TOKENS: DesignToken[] = [
    makeToken({ id: 30, token_path: 'color.surface', token_value: '#ffffff', mode: 'Light', collection_name: 'Brand' }),
    makeToken({ id: 31, token_path: 'color.surface', token_value: '#111827', mode: 'Dark', collection_name: 'Brand' }),
    makeToken({ id: 32, token_path: 'color.text', token_value: '#111827', mode: 'Light', collection_name: 'Brand' }),
    makeToken({ id: 33, token_path: 'color.text', token_value: '#f9fafb', mode: 'Dark', collection_name: 'Brand' }),
]

const ALL_TOKENS = [...COLOR_TOKENS, ...TYPOGRAPHY_TOKENS, ...SPACING_TOKENS]

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TokenPanel', () => {
    // ── TokenHealthBar ────────────────────────────────────────────────────────

    describe('TokenHealthBar', () => {
        it('renders with token count broken down by type', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const bar = screen.getByTestId('token-health-bar')
                expect(bar).toBeDefined()
                // 3 colors
                expect(bar.textContent).toContain('3 colors')
                // 2 dimensions
                expect(bar.textContent).toContain('2 dimensions')
                // 2 typography
                expect(bar.textContent).toContain('2 typography')
            })
        })

        it('shows "Never synced" when getSyncSummary returns null lastSyncAt', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            // Wire getSyncSummary on the mock
            ;(window.flintAPI as any).tokens.getSyncSummary = vi.fn().mockResolvedValue({
                lastSyncAt: null,
                tokenCount: 3,
            })
            render(<TokenPanel />)
            await waitFor(() => {
                const status = screen.getByTestId('sync-status')
                expect(status.textContent).toBe('Never synced')
            })
        })

        it('shows relative sync time when getSyncSummary returns a date', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            ;(window.flintAPI as any).tokens.getSyncSummary = vi.fn().mockResolvedValue({
                lastSyncAt: twoHoursAgo,
                tokenCount: 3,
            })
            render(<TokenPanel />)
            await waitFor(() => {
                const status = screen.getByTestId('sync-status')
                expect(status.textContent).toContain('Synced')
                expect(status.textContent).toContain('hours ago')
            })
        })

        it('does not crash when getSyncSummary is not available', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            // getSyncSummary intentionally absent from mock — the panel must not throw
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('token-health-bar')).toBeDefined()
            })
        })

        it('shows "Figma connected" when figma.status running=true', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: true, lastWebhookAt: null, tokenCount: 3, port: 4545,
            })
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('figma-connection-status').textContent).toBe('Figma connected')
            })
        })

        it('shows "Not connected" when figma.status running=false', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: false, lastWebhookAt: null, tokenCount: 0, port: 4545,
            })
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('figma-connection-status').textContent).toBe('Not connected')
            })
        })
    })

    // ── ColorGrid ─────────────────────────────────────────────────────────────

    describe('ColorGrid', () => {
        it('renders color tokens as swatches with role="img" and aria-label', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const swatches = document.querySelectorAll('[role="img"][aria-label*="Color token"]')
                expect(swatches.length).toBe(COLOR_TOKENS.length)
            })
        })

        it('applies backgroundColor inline style derived from token_value', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeToken({ id: 50, token_path: 'color.test', token_value: '#ff0000', collection_name: 'Colors' }),
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                const swatch = document.querySelector('[role="img"][style*="background-color"]')
                expect(swatch).not.toBeNull()
            })
        })

        it('shows abbreviated token name and value below each swatch', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeToken({ id: 51, token_path: 'color.brand.primary', token_value: '#1d4ed8', collection_name: 'Colors' }),
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                // last segment of path
                expect(screen.getByText('primary')).toBeDefined()
                expect(screen.getByText('#1d4ed8')).toBeDefined()
            })
        })
    })

    // ── TypographySpecimen ────────────────────────────────────────────────────

    describe('TypographySpecimen', () => {
        it('renders typography tokens with specimen text', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(TYPOGRAPHY_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const specimens = screen.getAllByText('The quick brown fox')
                expect(specimens.length).toBe(TYPOGRAPHY_TOKENS.length)
            })
        })

        it('shows token path and value below the specimen', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeToken({ id: 60, token_path: 'fontFamily.sans', token_type: 'fontFamily', token_value: 'Inter', collection_name: 'Typography' }),
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByText('fontFamily.sans')).toBeDefined()
                expect(screen.getByText('Inter')).toBeDefined()
            })
        })
    })

    // ── SpacingRuler ──────────────────────────────────────────────────────────

    describe('SpacingRuler', () => {
        it('renders spacing tokens with aria-label on each bar container', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SPACING_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const bars = document.querySelectorAll('[aria-label*="Spacing"]')
                expect(bars.length).toBe(SPACING_TOKENS.length)
            })
        })

        it('renders token paths and values next to the bars', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeToken({ id: 70, token_path: 'spacing.md', token_type: 'dimension', token_value: '16px', collection_name: 'Spacing' }),
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByText('spacing.md')).toBeDefined()
                expect(screen.getByText('16px')).toBeDefined()
            })
        })
    })

    // ── ModeColumns ───────────────────────────────────────────────────────────

    describe('ModeColumns', () => {
        it('shows the "Group by mode" toggle only when multiple modes exist', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                // ALL_TOKENS has no multi-mode tokens — toggle should be absent
                expect(screen.queryByRole('button', { name: /Group by mode/i })).toBeNull()
            })
        })

        it('shows the "Group by mode" toggle when tokens have multiple modes', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(MULTI_MODE_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Group by mode/i })).toBeDefined()
            })
        })

        it('renders ModeColumns view when the toggle is activated', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(MULTI_MODE_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => screen.getByRole('button', { name: /Group by mode/i }))
            fireEvent.click(screen.getByRole('button', { name: /Group by mode/i }))
            await waitFor(() => {
                expect(screen.getByTestId('mode-columns')).toBeDefined()
            })
        })

        it('groups tokens by token_path showing both modes side-by-side', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(MULTI_MODE_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => screen.getByRole('button', { name: /Group by mode/i }))
            fireEvent.click(screen.getByRole('button', { name: /Group by mode/i }))
            await waitFor(() => {
                // The ModeColumns table should show the shared path once
                const paths = screen.getAllByText('color.surface')
                expect(paths.length).toBeGreaterThanOrEqual(1)
                // And both mode column headers
                expect(screen.getByText('Light')).toBeDefined()
                expect(screen.getByText('Dark')).toBeDefined()
            })
        })
    })

    // ── A11y ─────────────────────────────────────────────────────────────────

    describe('Accessibility', () => {
        it('search input has aria-label="Search tokens"', async () => {
            // Use spacing tokens — their paths are displayed in full (not abbreviated)
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SPACING_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => screen.getByText('spacing.sm'))
            const input = screen.getByLabelText('Search tokens')
            expect(input).toBeDefined()
        })

        it('clear search button has aria-label="Clear search"', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SPACING_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => screen.getByText('spacing.sm'))
            fireEvent.change(screen.getByLabelText('Search tokens'), { target: { value: 'spacing' } })
            await waitFor(() => {
                expect(screen.getByLabelText('Clear search')).toBeDefined()
            })
        })

        it('close modal button has aria-label="Close import modal"', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
            render(<TokenPanel />)
            // Empty state — only the Import JSON in the empty state, open it
            const importBtns = screen.getAllByRole('button', { name: /Import JSON/i })
            fireEvent.click(importBtns[0])
            await waitFor(() => {
                expect(screen.getByLabelText('Close import modal')).toBeDefined()
            })
        })

        it('import modal inputs have matching label/id pairs', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
            render(<TokenPanel />)
            const importBtns = screen.getAllByRole('button', { name: /Import JSON/i })
            fireEvent.click(importBtns[0])
            await waitFor(() => {
                const collectionInput = document.getElementById('token-collection-name')
                expect(collectionInput).not.toBeNull()
                const jsonInput = document.getElementById('token-json-input')
                expect(jsonInput).not.toBeNull()
            })
        })

        it('collection type sub-headers use h3 elements', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const h3s = document.querySelectorAll('h3')
                expect(h3s.length).toBeGreaterThan(0)
            })
        })
    })

    // ── Search ────────────────────────────────────────────────────────────────

    describe('Search', () => {
        it('filters tokens by token_path', async () => {
            // Use all tokens — wait for collection headers (not abbreviated token paths)
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            // Wait for the Spacing collection header (spacing tokens render full paths)
            await waitFor(() => screen.getByText('Spacing'))
            fireEvent.change(screen.getByLabelText('Search tokens'), { target: { value: 'spacing' } })
            await waitFor(() => {
                expect(screen.getByText('spacing.sm')).toBeDefined()
                // Colors collection should no longer be visible
                expect(screen.queryByText('Colors')).toBeNull()
            })
        })

        it('shows no-match empty state when search yields nothing', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => screen.getByText('Spacing'))
            fireEvent.change(screen.getByLabelText('Search tokens'), { target: { value: 'zzznomatch999' } })
            await waitFor(() => {
                expect(screen.getByText('No tokens match')).toBeDefined()
            })
        })

        it('restores full list after clear search', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => screen.getByText('Spacing'))
            const input = screen.getByLabelText('Search tokens')
            fireEvent.change(input, { target: { value: 'spacing' } })
            await waitFor(() => expect(screen.queryByText('Colors')).toBeNull())
            fireEvent.click(screen.getByLabelText('Clear search'))
            await waitFor(() => {
                // Both collections should return
                expect(screen.getByText('Colors')).toBeDefined()
                expect(screen.getByText('Spacing')).toBeDefined()
            })
        })
    })

    // ── General ───────────────────────────────────────────────────────────────

    describe('General', () => {
        it('shows loading state initially', () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
            render(<TokenPanel />)
            expect(screen.getByText('Loading…')).toBeDefined()
        })

        it('shows empty state with data-testid when no tokens exist', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(document.querySelector('[data-testid="tokens-empty-state"]')).not.toBeNull()
            })
        })

        it('groups tokens by collection_name', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByText('Colors')).toBeDefined()
                expect(screen.getByText('Spacing')).toBeDefined()
                expect(screen.getByText('Typography')).toBeDefined()
            })
        })

        it('shows total token count in toolbar', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(ALL_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByText(`${ALL_TOKENS.length} tokens`)).toBeDefined()
            })
        })
    })

    // ── MINT.2b: Token Usage Intelligence ────────────────────────────────────

    describe('Token Usage (MINT.2b)', () => {
        it('shows usage summary when scan returns results', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue([
                { tokenName: 'color.primary', cssVar: '--color-primary', usageCount: 3, files: ['a.tsx', 'b.tsx', 'c.tsx'] },
                { tokenName: 'color.secondary', cssVar: '--color-secondary', usageCount: 1, files: ['a.tsx'] },
                { tokenName: 'color.accent', cssVar: '--color-accent', usageCount: 0, files: [] },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                const summary = screen.getByTestId('token-usage-summary')
                expect(summary).toBeDefined()
                expect(summary.textContent).toContain('2 used')
                expect(summary.textContent).toContain('3 total')
            })
        })

        it('shows dead token count when unused tokens exist', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue([
                { tokenName: 'color.primary', cssVar: '--color-primary', usageCount: 2, files: ['a.tsx'] },
                { tokenName: 'color.secondary', cssVar: '--color-secondary', usageCount: 0, files: [] },
                { tokenName: 'color.accent', cssVar: '--color-accent', usageCount: 0, files: [] },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                const deadCount = screen.getByTestId('dead-token-count')
                expect(deadCount.textContent).toContain('2 unused')
            })
        })

        it('shows "Unused" badge on dead color tokens in the grid', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue([
                { tokenName: 'color.primary', cssVar: '--color-primary', usageCount: 3, files: ['a.tsx'] },
                { tokenName: 'color.secondary', cssVar: '--color-secondary', usageCount: 0, files: [] },
                { tokenName: 'color.accent', cssVar: '--color-accent', usageCount: 0, files: [] },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                const deadBadges = document.querySelectorAll('[data-testid="dead-token-badge"]')
                expect(deadBadges.length).toBe(2)
                expect(deadBadges[0].textContent).toBe('Unused')
            })
        })

        it('shows usage count badge on used color tokens', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue([
                { tokenName: 'color.primary', cssVar: '--color-primary', usageCount: 5, files: ['a.tsx'] },
                { tokenName: 'color.secondary', cssVar: '--color-secondary', usageCount: 1, files: ['b.tsx'] },
                { tokenName: 'color.accent', cssVar: '--color-accent', usageCount: 0, files: [] },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                const usageBadges = document.querySelectorAll('[data-testid="usage-count-badge"]')
                expect(usageBadges.length).toBe(2)
            })
        })

        it('does not show usage summary when scanUsage returns empty', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens.scanUsage as ReturnType<typeof vi.fn>).mockResolvedValue([])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('token-health-bar')).toBeDefined()
            })
            // Summary section should not appear
            expect(document.querySelector('[data-testid="token-usage-summary"]')).toBeNull()
        })

        it('gracefully handles scanUsage not being available', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            // Remove scanUsage from mock
            ;(window.flintAPI.tokens as any).scanUsage = undefined
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('token-health-bar')).toBeDefined()
            })
            // Should not crash — no usage summary
            expect(document.querySelector('[data-testid="token-usage-summary"]')).toBeNull()
        })
    })

    // ── MINT.3b: Contrast Audit ──────────────────────────────────────────────

    describe('Contrast Audit (MINT.3b)', () => {
        it('shows contrast audit section when audit returns pairs', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).auditContrast = vi.fn().mockResolvedValue([
                { fg: 'color.primary', bg: 'color.accent', fgValue: '#1d4ed8', bgValue: '#10b981', ratio: 2.1, passAA: false, passAAA: false },
                { fg: 'color.primary', bg: 'color.secondary', fgValue: '#1d4ed8', bgValue: '#7c3aed', ratio: 5.2, passAA: true, passAAA: false },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                const section = screen.getByTestId('contrast-audit-section')
                expect(section).toBeDefined()
                expect(section.textContent).toContain('1 of 2 color pairs pass WCAG AA')
            })
        })

        it('shows progress bar in contrast audit section', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).auditContrast = vi.fn().mockResolvedValue([
                { fg: 'color.primary', bg: 'color.accent', fgValue: '#1d4ed8', bgValue: '#10b981', ratio: 5.0, passAA: true, passAAA: false },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('contrast-progress-bar')).toBeDefined()
            })
        })

        it('shows failing pairs list when contrast issues exist', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).auditContrast = vi.fn().mockResolvedValue([
                { fg: 'color.primary', bg: 'color.accent', fgValue: '#1d4ed8', bgValue: '#10b981', ratio: 2.1, passAA: false, passAAA: false },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('failing-pairs-list')).toBeDefined()
                expect(screen.getByText('Fails AA')).toBeDefined()
            })
        })

        it('does not show contrast section when audit returns empty', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).auditContrast = vi.fn().mockResolvedValue([])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('token-health-bar')).toBeDefined()
            })
            expect(document.querySelector('[data-testid="contrast-audit-section"]')).toBeNull()
        })
    })

    // ── MINT.3c: Token Approval Staging ──────────────────────────────────────

    describe('Token Approval Staging (MINT.3c)', () => {
        it('shows approval staging when pending tokens exist', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).getPendingApprovals = vi.fn().mockResolvedValue([
                { name: 'color.new.accent', value: '#ff6600', type: 'color', source: 'Figma', proposedAt: new Date().toISOString() },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('token-approval-staging')).toBeDefined()
                expect(screen.getByText('1 pending approval')).toBeDefined()
            })
        })

        it('does not show approval staging when no pending tokens', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).getPendingApprovals = vi.fn().mockResolvedValue([])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByTestId('token-health-bar')).toBeDefined()
            })
            expect(document.querySelector('[data-testid="token-approval-staging"]')).toBeNull()
        })

        it('shows approve and reject buttons for each pending token', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).getPendingApprovals = vi.fn().mockResolvedValue([
                { name: 'color.pending', value: '#aabbcc', type: 'color', source: 'Scout', proposedAt: new Date().toISOString() },
            ])
            render(<TokenPanel />)
            await waitFor(() => {
                expect(screen.getByLabelText('Approve color.pending')).toBeDefined()
                expect(screen.getByLabelText('Reject color.pending')).toBeDefined()
            })
        })

        it('removes token from list after approval', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            ;(window.flintAPI.tokens as any).getPendingApprovals = vi.fn().mockResolvedValue([
                { name: 'color.test', value: '#112233', type: 'color', source: 'Manual', proposedAt: new Date().toISOString() },
            ])
            ;(window.flintAPI.tokens as any).approveToken = vi.fn().mockResolvedValue({ ok: true })
            render(<TokenPanel />)
            await waitFor(() => screen.getByLabelText('Approve color.test'))
            fireEvent.click(screen.getByLabelText('Approve color.test'))
            await waitFor(() => {
                expect(document.querySelector('[data-testid="token-approval-staging"]')).toBeNull()
            })
        })
    })

    // ── MINT.4d: Token Detail View ───────────────────────────────────────────

    describe('Token Detail View (MINT.4d)', () => {
        it('opens detail view when a color swatch is clicked', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const swatches = document.querySelectorAll('[role="img"][aria-label*="Color token"]')
                expect(swatches.length).toBeGreaterThan(0)
            })
            // Click the first swatch's container (which has role="button")
            const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
            if (clickables.length > 0) {
                fireEvent.click(clickables[0])
                await waitFor(() => {
                    expect(screen.getByTestId('token-detail-view')).toBeDefined()
                })
            }
        })

        it('shows large swatch in detail view for color tokens', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
                expect(clickables.length).toBeGreaterThan(0)
            })
            const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
            fireEvent.click(clickables[0])
            await waitFor(() => {
                expect(screen.getByTestId('detail-swatch')).toBeDefined()
            })
        })

        it('closes detail view on X button click', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
                expect(clickables.length).toBeGreaterThan(0)
            })
            const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
            fireEvent.click(clickables[0])
            await waitFor(() => screen.getByTestId('token-detail-view'))
            fireEvent.click(screen.getByLabelText('Close detail view'))
            await waitFor(() => {
                expect(document.querySelector('[data-testid="token-detail-view"]')).toBeNull()
            })
        })

        it('closes detail view on Escape key', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
            render(<TokenPanel />)
            await waitFor(() => {
                const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
                expect(clickables.length).toBeGreaterThan(0)
            })
            const clickables = document.querySelectorAll('[data-testid="color-grid"] [role="button"]')
            fireEvent.click(clickables[0])
            await waitFor(() => screen.getByTestId('token-detail-view'))
            fireEvent.keyDown(document, { key: 'Escape' })
            await waitFor(() => {
                expect(document.querySelector('[data-testid="token-detail-view"]')).toBeNull()
            })
        })
    })
})
