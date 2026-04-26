/**
 * ScoreSection.test.tsx — Sprint 3A sub-component tests
 *
 * Covers:
 * - Renders the Health Score accordion toggle button
 * - Score ring renders with data-testid="score-ring"
 * - Grade letter is shown
 * - Effort framing text renders
 * - Category chips render (design-system, accessibility, token-sync)
 * - Category chip click calls onSetCategory
 * - Fidelity score row shows when mithrilCount > 0
 * - A11y score row shows when a11yCount > 0
 * - Override score row shows when overrideCount > 0
 * - Delta mode banner shows when condition is met
 * - Export blocked banner renders when exportBlocked=true
 * - Export clear banner renders when exportBlocked=false
 * - Sparkline renders when health history has >= 2 entries
 * - Score trend hint shows when provided
 * - Next step prompt text renders
 * - Rewind to clean link shows when score < 95 and lastCleanState exists
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScoreSection } from '../ScoreSection'

const noop = () => {}

function defaultProps(overrides = {}) {
    return {
        score: 85,
        grade: 'B',
        trend: 0,
        exportBlocked: false,
        mithrilCount: 2,
        a11yCount: 1,
        overridesExist: false,
        overrideCount: 0,
        onRunAudit: noop,
        baselineMode: false,
        onToggleBaseline: noop,
        healthHistory: [],
        scoreTrendHint: null,
        nextStep: { variant: 'mithril-dominant', text: '2 color drifts are lowering your score.' },
        effortText: '2 auto-fixable — Autopilot can resolve them in one click',
        ringPulse: false,
        lastCleanState: null,
        onRewindToClean: noop,
        activeCategory: null,
        onSetCategory: noop,
        syncCount: 0,
        initialViolationCount: undefined,
        isBaselineSet: false,
        bannerDismissed: false,
        onDismissBanner: noop,
        onShowAllViolations: noop,
        onOpenExportModal: noop,
        ...overrides,
    }
}

describe('ScoreSection', () => {
    it('renders the Health Score accordion toggle button', () => {
        render(<ScoreSection {...defaultProps()} />)
        expect(screen.getByRole('button', { name: /Health Score/i })).toBeDefined()
    })

    it('renders score ring with data-testid="score-ring" when accordion is open', () => {
        render(<ScoreSection {...defaultProps()} />)
        expect(screen.getByTestId('score-ring')).toBeDefined()
    })

    it('renders the grade letter', () => {
        render(<ScoreSection {...defaultProps({ grade: 'B' })} />)
        // grade appears both in the accordion header and in the body
        const gradeEls = screen.getAllByText('B')
        expect(gradeEls.length).toBeGreaterThan(0)
    })

    it('renders effort framing text', () => {
        render(<ScoreSection {...defaultProps()} />)
        expect(screen.getByTestId('effort-framing')).toBeDefined()
        expect(screen.getByTestId('effort-framing').textContent).toContain('2 auto-fixable')
    })

    it('renders category chips', () => {
        render(<ScoreSection {...defaultProps()} />)
        expect(screen.getByTestId('chip-design-system')).toBeDefined()
        expect(screen.getByTestId('chip-accessibility')).toBeDefined()
        expect(screen.getByTestId('chip-token-sync')).toBeDefined()
    })

    it('calls onSetCategory with design-system when chip is clicked', () => {
        const handler = vi.fn()
        render(<ScoreSection {...defaultProps({ onSetCategory: handler })} />)
        fireEvent.click(screen.getByTestId('chip-design-system'))
        expect(handler).toHaveBeenCalledWith('design-system')
    })

    it('calls onSetCategory with null when active chip is clicked again', () => {
        const handler = vi.fn()
        render(<ScoreSection {...defaultProps({ activeCategory: 'design-system', onSetCategory: handler })} />)
        fireEvent.click(screen.getByTestId('chip-design-system'))
        expect(handler).toHaveBeenCalledWith(null)
    })

    // CHRON.1-repair / C2: ScoreSection now groups by severity bucket (critical /
    // amber / advisory / override) to match the canonical health formula, not by
    // type (mithril / a11y). Tests updated accordingly.
    it('renders amber score row when mithrilCount > 0', () => {
        render(<ScoreSection {...defaultProps({ mithrilCount: 3 })} />)
        expect(screen.getByTestId('amber-score-row')).toBeDefined()
    })

    it('does not render amber score row when no amber-severity violations', () => {
        render(<ScoreSection {...defaultProps({ mithrilCount: 0, a11yCount: 0 })} />)
        expect(screen.queryByTestId('amber-score-row')).toBeNull()
    })

    it('renders amber score row when a11yCount > 0 (a11y violations count as amber)', () => {
        render(<ScoreSection {...defaultProps({ a11yCount: 2 })} />)
        expect(screen.getByTestId('amber-score-row')).toBeDefined()
    })

    it('renders override score row when overrideCount > 0', () => {
        render(<ScoreSection {...defaultProps({ overrideCount: 1 })} />)
        expect(screen.getByTestId('override-score-row')).toBeDefined()
    })

    it('renders export blocked banner when exportBlocked=true', () => {
        render(<ScoreSection {...defaultProps({ exportBlocked: true })} />)
        expect(screen.getByRole('alert')).toBeDefined()
        expect(screen.getByText(/Export blocked/)).toBeDefined()
    })

    it('renders export clear banner when exportBlocked=false', () => {
        render(<ScoreSection {...defaultProps({ exportBlocked: false })} />)
        expect(screen.getByText(/All clear — export ready|No new issues — export ready/)).toBeDefined()
    })

    it('renders sparkline when healthHistory has >= 2 entries', () => {
        const history = [
            { date: '2024-01-01', score: 80, grade: 'B' },
            { date: '2024-01-02', score: 85, grade: 'B' },
        ]
        render(<ScoreSection {...defaultProps({ healthHistory: history })} />)
        expect(screen.getByTestId('sparkline')).toBeDefined()
    })

    it('does not render sparkline when healthHistory has < 2 entries', () => {
        render(<ScoreSection {...defaultProps({ healthHistory: [] })} />)
        expect(screen.queryByTestId('sparkline')).toBeNull()
    })

    it('renders score trend hint when provided', () => {
        render(<ScoreSection {...defaultProps({ scoreTrendHint: 'Fix 2 issues to reach grade A' })} />)
        expect(screen.getByTestId('score-trend-hint').textContent).toContain('Fix 2 issues to reach grade A')
    })

    it('renders the next step prompt', () => {
        render(<ScoreSection {...defaultProps()} />)
        expect(screen.getByTestId('next-step-prompt').textContent).toContain('color drifts')
    })

    it('renders rewind to clean link when score < 95 and lastCleanState exists', () => {
        render(<ScoreSection {...defaultProps({
            score: 85,
            lastCleanState: { timestamp: new Date().toISOString(), score: 98 }
        })} />)
        expect(screen.getByTestId('rewind-to-clean')).toBeDefined()
    })

    it('does not render rewind to clean when score >= 95', () => {
        render(<ScoreSection {...defaultProps({
            score: 95,
            lastCleanState: { timestamp: new Date().toISOString(), score: 100 }
        })} />)
        expect(screen.queryByTestId('rewind-to-clean')).toBeNull()
    })

    it('does not render rewind to clean when lastCleanState is null', () => {
        render(<ScoreSection {...defaultProps({ score: 80, lastCleanState: null })} />)
        expect(screen.queryByTestId('rewind-to-clean')).toBeNull()
    })

    it('renders delta mode auto banner when conditions are met', () => {
        render(<ScoreSection {...defaultProps({
            initialViolationCount: 15,
            isBaselineSet: true,
            bannerDismissed: false,
        })} />)
        expect(screen.getByTestId('delta-mode-auto-banner')).toBeDefined()
    })

    it('does not render delta banner when initialViolationCount <= 10', () => {
        render(<ScoreSection {...defaultProps({
            initialViolationCount: 5,
            isBaselineSet: true,
            bannerDismissed: false,
        })} />)
        expect(screen.queryByTestId('delta-mode-auto-banner')).toBeNull()
    })

    it('does not render delta banner when bannerDismissed=true', () => {
        render(<ScoreSection {...defaultProps({
            initialViolationCount: 15,
            isBaselineSet: true,
            bannerDismissed: true,
        })} />)
        expect(screen.queryByTestId('delta-mode-auto-banner')).toBeNull()
    })

    it('calls onDismissBanner when Dismiss is clicked in delta banner', () => {
        const handler = vi.fn()
        render(<ScoreSection {...defaultProps({
            initialViolationCount: 15,
            isBaselineSet: true,
            bannerDismissed: false,
            onDismissBanner: handler,
        })} />)
        fireEvent.click(screen.getByRole('button', { name: /Dismiss delta mode banner/ }))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('calls onShowAllViolations when Show all violations is clicked', () => {
        const handler = vi.fn()
        render(<ScoreSection {...defaultProps({
            initialViolationCount: 15,
            isBaselineSet: true,
            bannerDismissed: false,
            onShowAllViolations: handler,
        })} />)
        fireEvent.click(screen.getByRole('button', { name: /Show all violations/ }))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('accordion collapses when header button is clicked', () => {
        render(<ScoreSection {...defaultProps()} />)
        const headerBtn = screen.getByRole('button', { name: /Health Score/i })
        expect(headerBtn.getAttribute('aria-expanded')).toBe('true')
        fireEvent.click(headerBtn)
        expect(headerBtn.getAttribute('aria-expanded')).toBe('false')
        // score ring should no longer be visible
        expect(screen.queryByTestId('score-ring')).toBeNull()
    })

    it('shows "Delta Score" label when isBaselineSet=true', () => {
        render(<ScoreSection {...defaultProps({ isBaselineSet: true })} />)
        expect(screen.getByText(/Delta Score/)).toBeDefined()
    })

    it('shows "Governance Health" label when isBaselineSet=false', () => {
        render(<ScoreSection {...defaultProps({ isBaselineSet: false })} />)
        expect(screen.getByText('Governance Health')).toBeDefined()
    })

    it('calls onOpenExportModal when Export button is clicked on clear state', () => {
        const handler = vi.fn()
        render(<ScoreSection {...defaultProps({ exportBlocked: false, onOpenExportModal: handler })} />)
        fireEvent.click(screen.getByRole('button', { name: /Open export modal/ }))
        expect(handler).toHaveBeenCalledOnce()
    })
})
