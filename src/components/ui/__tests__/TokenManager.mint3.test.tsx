/**
 * TokenManager.mint3.test.tsx
 *
 * MINT.3 tests: Accessibility + Approval for the token experience.
 *
 * Covers:
 *   - MINT.3a: Contrast audit button, panel, results
 *   - MINT.3b: Inline contrast badges on token cards
 *   - MINT.3c: Approval staging area (pending tokens, approve, reject, bulk)
 *   - MINT.3d: Scale gap warnings, motion token detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TokenManager } from '../TokenManager'
import { useTokenStore } from '../../../store/tokenStore'
import type { DesignToken, ContrastPair, PendingToken } from '../../../types/flint-api'
import { detectScaleGaps, getBestContrastGrade } from '../TokenGrid'
import type { ContrastBadgeGrade } from '../TokenGrid'

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

const COLOR_TOKENS: DesignToken[] = [
    makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8', collection_name: 'Colors' }),
    makeToken({ id: 2, token_path: 'color.secondary', token_type: 'color', token_value: '#7c3aed', collection_name: 'Colors' }),
]

const CONTRAST_RESULTS: ContrastPair[] = [
    { fg: 'color.primary', bg: '#ffffff', fgValue: '#1d4ed8', bgValue: '#ffffff', ratio: 5.2, passAA: true, passAAA: false },
    { fg: 'color.primary', bg: '#000000', fgValue: '#1d4ed8', bgValue: '#000000', ratio: 4.0, passAA: false, passAAA: false },
    { fg: 'color.secondary', bg: '#ffffff', fgValue: '#7c3aed', bgValue: '#ffffff', ratio: 7.5, passAA: true, passAAA: true },
]

const PENDING_TOKENS: PendingToken[] = [
    { name: 'color.accent', value: '#ff6600', type: 'color', source: 'Figma', proposedAt: new Date(Date.now() - 3600000).toISOString() },
    { name: 'spacing.xl', value: '32px', type: 'dimension', source: 'Scout', proposedAt: new Date(Date.now() - 7200000).toISOString() },
]

// ── MINT.3a: Contrast Audit ─────────────────────────────────────────────────

describe('MINT.3a — Token Contrast Auditor', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    it('renders a contrast audit button in the toolbar', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const btn = screen.getByTestId('contrast-audit-button')
            expect(btn).toBeDefined()
            expect(btn.textContent).toContain('Contrast')
        })
    })

    it('contrast button is disabled when auditContrast is not available', async () => {
        const original = window.flintAPI.tokens.auditContrast
        ;(window.flintAPI.tokens as any).auditContrast = undefined
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        render(<TokenManager />)
        await waitFor(() => {
            const btn = screen.getByTestId('contrast-audit-button')
            expect(btn.hasAttribute('disabled')).toBe(true)
        })
        ;(window.flintAPI.tokens as any).auditContrast = original
    })

    it('opens contrast panel with results when audit button is clicked', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))

        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const panel = screen.getByTestId('contrast-audit-panel')
            expect(panel).toBeDefined()
        })
    })

    it('shows pass and fail counts in the contrast panel', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const panel = screen.getByTestId('contrast-audit-panel')
            expect(panel.textContent).toContain('2 pass')
            expect(panel.textContent).toContain('1 fail')
        })
    })

    it('renders contrast pair rows with Aa preview', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const rows = screen.queryAllByTestId('contrast-pair-row')
            expect(rows.length).toBe(3)
        })
    })

    it('shows AA badge for passing pairs', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const aaBadges = screen.queryAllByTestId('contrast-badge-aa')
            expect(aaBadges.length).toBe(1)
        })
    })

    it('shows FAIL badge for failing pairs', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const failBadges = screen.queryAllByTestId('contrast-badge-fail')
            expect(failBadges.length).toBe(1)
        })
    })

    it('closes the contrast panel when close button is clicked', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => screen.getByTestId('contrast-audit-panel'))

        const closeBtn = screen.getByLabelText('Close contrast audit panel')
        fireEvent.click(closeBtn)

        await waitFor(() => {
            expect(screen.queryByTestId('contrast-audit-panel')).toBeNull()
        })
    })

    it('contrast panel has proper aria-label', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const panel = screen.getByRole('region', { name: /contrast audit results/i })
            expect(panel).toBeDefined()
        })
    })
})

// ── MINT.3b: Inline Contrast Badges ────────────────────────────────────────

describe('MINT.3b — Contrast Badges in Token UI', () => {
    it('shows inline contrast badges on color tokens after audit', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.auditContrast as ReturnType<typeof vi.fn>).mockResolvedValue(CONTRAST_RESULTS)
        render(<TokenManager />)
        await waitFor(() => screen.getByTestId('contrast-audit-button'))
        fireEvent.click(screen.getByTestId('contrast-audit-button'))

        await waitFor(() => {
            const inlineBadges = screen.queryAllByTestId('contrast-inline-badge')
            expect(inlineBadges.length).toBeGreaterThan(0)
        })
    })

    it('getBestContrastGrade returns AAA for high-ratio pairs', () => {
        const map = new Map<string, ContrastPair[]>()
        map.set('color.secondary', [CONTRAST_RESULTS[2]])
        const result = getBestContrastGrade('color.secondary', map)
        expect(result.grade).toBe('aaa')
        expect(result.ratio).toBe(7.5)
    })

    it('getBestContrastGrade returns AA for medium-ratio pairs', () => {
        const map = new Map<string, ContrastPair[]>()
        map.set('color.primary', [CONTRAST_RESULTS[0]])
        const result = getBestContrastGrade('color.primary', map)
        expect(result.grade).toBe('aa')
        expect(result.ratio).toBe(5.2)
    })

    it('getBestContrastGrade returns fail for low-ratio pairs', () => {
        const map = new Map<string, ContrastPair[]>()
        map.set('color.low', [{ fg: 'color.low', bg: '#ffffff', fgValue: '#cccccc', bgValue: '#ffffff', ratio: 1.5, passAA: false, passAAA: false }])
        const result = getBestContrastGrade('color.low', map)
        expect(result.grade).toBe('fail')
    })

    it('getBestContrastGrade returns null for unknown tokens', () => {
        const map = new Map<string, ContrastPair[]>()
        const result = getBestContrastGrade('color.unknown', map)
        expect(result.grade).toBeNull()
    })
})

// ── MINT.3c: Token Approval Staging Area ───────────────────────────────────

describe('MINT.3c — Token Approval Staging Area', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    it('shows approval staging area when pending tokens exist', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            const staging = screen.getByTestId('approval-staging-area')
            expect(staging).toBeDefined()
        })
    })

    it('does not show approval staging area when no pending tokens', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue([])
        render(<TokenManager />)

        await waitFor(() => screen.getByText('color.primary'))
        expect(screen.queryByTestId('approval-staging-area')).toBeNull()
    })

    it('displays pending token names and values', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            expect(screen.getByText('color.accent')).toBeDefined()
            expect(screen.getByText('#ff6600')).toBeDefined()
            expect(screen.getByText('spacing.xl')).toBeDefined()
        })
    })

    it('shows source info for pending tokens', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            expect(screen.getByText('from Figma')).toBeDefined()
            expect(screen.getByText('from Scout')).toBeDefined()
        })
    })

    it('shows the pending count badge', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            const staging = screen.getByTestId('approval-staging-area')
            expect(staging.textContent).toContain('2')
        })
    })

    it('calls approveToken when approve button is clicked', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => screen.getByText('color.accent'))

        const approveBtn = screen.getByLabelText('Approve token color.accent')
        fireEvent.click(approveBtn)

        await waitFor(() => {
            expect(window.flintAPI.tokens.approveToken).toHaveBeenCalledWith('color.accent')
        })
    })

    it('calls rejectToken when reject button is clicked', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => screen.getByText('color.accent'))

        const rejectBtn = screen.getByLabelText('Reject token color.accent')
        fireEvent.click(rejectBtn)

        await waitFor(() => {
            expect(window.flintAPI.tokens.rejectToken).toHaveBeenCalledWith('color.accent')
        })
    })

    it('renders Approve all and Reject all buttons', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            expect(screen.getByLabelText('Approve all pending tokens')).toBeDefined()
            expect(screen.getByLabelText('Reject all pending tokens')).toBeDefined()
        })
    })

    it('approve all calls approveToken for each pending token', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => screen.getByLabelText('Approve all pending tokens'))

        fireEvent.click(screen.getByLabelText('Approve all pending tokens'))

        await waitFor(() => {
            expect(window.flintAPI.tokens.approveToken).toHaveBeenCalledWith('color.accent')
            expect(window.flintAPI.tokens.approveToken).toHaveBeenCalledWith('spacing.xl')
        })
    })

    it('staging area has proper aria-label', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            const region = screen.getByRole('region', { name: /tokens awaiting approval/i })
            expect(region).toBeDefined()
        })
    })

    it('renders pending token rows with proper test ids', async () => {
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(COLOR_TOKENS)
        ;(window.flintAPI.tokens.getPendingApprovals as ReturnType<typeof vi.fn>).mockResolvedValue(PENDING_TOKENS)
        render(<TokenManager />)

        await waitFor(() => {
            const rows = screen.queryAllByTestId('pending-token-row')
            expect(rows.length).toBe(2)
        })
    })
})

// ── MINT.3d: Additional A11y Token Insights ────────────────────────────────

describe('MINT.3d — Scale Gap Analysis', () => {
    it('detects gaps in a spacing scale', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'spacing.xs', token_type: 'dimension', token_value: '4px' }),
            makeToken({ token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px' }),
            makeToken({ token_path: 'spacing.lg', token_type: 'dimension', token_value: '16px' }),
            makeToken({ token_path: 'spacing.xl', token_type: 'dimension', token_value: '20px' }),
        ]
        const gaps = detectScaleGaps(tokens)
        expect(gaps.length).toBe(1)
        expect(gaps[0].before).toBe(8)
        expect(gaps[0].after).toBe(16)
    })

    it('returns empty array for consistent scales', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'spacing.xs', token_type: 'dimension', token_value: '4px' }),
            makeToken({ token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px' }),
            makeToken({ token_path: 'spacing.md', token_type: 'dimension', token_value: '12px' }),
            makeToken({ token_path: 'spacing.lg', token_type: 'dimension', token_value: '16px' }),
        ]
        const gaps = detectScaleGaps(tokens)
        expect(gaps.length).toBe(0)
    })

    it('returns empty array for fewer than 3 tokens', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'spacing.xs', token_type: 'dimension', token_value: '4px' }),
            makeToken({ token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px' }),
        ]
        const gaps = detectScaleGaps(tokens)
        expect(gaps.length).toBe(0)
    })

    it('renders scale gap warning in the token grid for dimension tokens', async () => {
        const tokens: DesignToken[] = [
            makeToken({ id: 1, token_path: 'spacing.xs', token_type: 'dimension', token_value: '4px', collection_name: 'Spacing' }),
            makeToken({ id: 2, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px', collection_name: 'Spacing' }),
            makeToken({ id: 3, token_path: 'spacing.lg', token_type: 'dimension', token_value: '16px', collection_name: 'Spacing' }),
            makeToken({ id: 4, token_path: 'spacing.xl', token_type: 'dimension', token_value: '20px', collection_name: 'Spacing' }),
        ]
        ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(tokens)
        render(<TokenManager />)

        await waitFor(() => {
            const warning = screen.queryByTestId('scale-gap-warning')
            expect(warning).not.toBeNull()
            expect(warning!.textContent).toContain('Gap')
        })
    })
})
