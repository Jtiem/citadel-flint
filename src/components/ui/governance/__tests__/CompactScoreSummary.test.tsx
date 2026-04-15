/**
 * CompactScoreSummary.test.tsx — T18
 *
 * Covers:
 * - Renders category chips only for non-zero counts
 * - Chip aria-pressed reflects activeCategory
 * - Chip click callbacks fire with correct category argument
 * - Export-blocked badge shows "Export blocked" text
 * - Export-ready badge shows "Ready to export" text
 * - Export-ready banner renders and Export button calls onOpenExportModal
 * - Effort framing text is rendered
 * - Delta mode auto-banner shows when conditions are met
 * - Banner Dismiss and Show all violations buttons fire callbacks
 * - Blocking dots appear when blocking count > 0
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompactScoreSummary } from '../CompactScoreSummary'

const noop = () => {}

const defaultProps = {
    score: 85,
    grade: 'B',
    exportBlocked: false,
    ringPulse: false,
    mithrilCount: 3,
    a11yCount: 2,
    syncCount: 1,
    activeCategory: null as null,
    onSetCategory: noop,
    effortText: '3 auto-fixable — Autopilot can resolve them',
    isBaselineSet: false,
    bannerDismissed: false,
    onDismissBanner: noop,
    onShowAllViolations: noop,
}

describe('CompactScoreSummary', () => {
    // ── Category chips ────────────────────────────────────────────────────────

    it('renders Design System chip when mithrilCount > 0', () => {
        render(<CompactScoreSummary {...defaultProps} />)
        expect(screen.getByTestId('chip-design-system')).toBeDefined()
    })

    it('renders Accessibility chip when a11yCount > 0', () => {
        render(<CompactScoreSummary {...defaultProps} />)
        expect(screen.getByTestId('chip-accessibility')).toBeDefined()
    })

    it('renders Token Sync chip when syncCount > 0', () => {
        render(<CompactScoreSummary {...defaultProps} />)
        expect(screen.getByTestId('chip-token-sync')).toBeDefined()
    })

    it('does not render category chips section when all counts are zero', () => {
        render(<CompactScoreSummary {...defaultProps} mithrilCount={0} a11yCount={0} syncCount={0} />)
        expect(screen.queryByTestId('chip-design-system')).toBeNull()
        expect(screen.queryByTestId('chip-accessibility')).toBeNull()
        expect(screen.queryByTestId('chip-token-sync')).toBeNull()
    })

    it('does not render a chip for a category with count=0 even when others are shown', () => {
        render(<CompactScoreSummary {...defaultProps} syncCount={0} />)
        expect(screen.queryByTestId('chip-token-sync')).toBeNull()
    })

    it('chip-design-system aria-pressed is true when activeCategory is design-system', () => {
        render(<CompactScoreSummary {...defaultProps} activeCategory="design-system" />)
        const chip = screen.getByTestId('chip-design-system')
        expect(chip.getAttribute('aria-pressed')).toBe('true')
    })

    it('chip-accessibility aria-pressed is false when activeCategory is design-system', () => {
        render(<CompactScoreSummary {...defaultProps} activeCategory="design-system" />)
        const chip = screen.getByTestId('chip-accessibility')
        expect(chip.getAttribute('aria-pressed')).toBe('false')
    })

    it('clicking a chip calls onSetCategory with the correct category', () => {
        const handler = vi.fn()
        render(<CompactScoreSummary {...defaultProps} onSetCategory={handler} />)
        fireEvent.click(screen.getByTestId('chip-design-system'))
        expect(handler).toHaveBeenCalledWith('design-system')
    })

    it('clicking active chip calls onSetCategory with null (deselect)', () => {
        const handler = vi.fn()
        render(<CompactScoreSummary {...defaultProps} activeCategory="design-system" onSetCategory={handler} />)
        fireEvent.click(screen.getByTestId('chip-design-system'))
        expect(handler).toHaveBeenCalledWith(null)
    })

    // ── Blocking dots ─────────────────────────────────────────────────────────

    it('shows blocking dot on Design System chip when designSystemBlockingCount > 0', () => {
        render(<CompactScoreSummary {...defaultProps} designSystemBlockingCount={2} />)
        expect(screen.getByTestId('chip-design-system-blocking-dot')).toBeDefined()
    })

    it('does not show blocking dot on Design System chip when designSystemBlockingCount is 0', () => {
        render(<CompactScoreSummary {...defaultProps} designSystemBlockingCount={0} />)
        expect(screen.queryByTestId('chip-design-system-blocking-dot')).toBeNull()
    })

    it('shows blocking dot on Accessibility chip when a11yBlockingCount > 0', () => {
        render(<CompactScoreSummary {...defaultProps} a11yBlockingCount={1} />)
        expect(screen.getByTestId('chip-accessibility-blocking-dot')).toBeDefined()
    })

    it('shows blocking dot on Token Sync chip when syncBlockingCount > 0', () => {
        render(<CompactScoreSummary {...defaultProps} syncBlockingCount={3} />)
        expect(screen.getByTestId('chip-token-sync-blocking-dot')).toBeDefined()
    })

    // ── Score summary row ─────────────────────────────────────────────────────

    it('renders score ring', () => {
        render(<CompactScoreSummary {...defaultProps} />)
        expect(screen.getByTestId('score-ring')).toBeDefined()
    })

    it('renders grade letter', () => {
        render(<CompactScoreSummary {...defaultProps} grade="B" />)
        expect(screen.getByRole('img', { name: /Health score/ })).toBeDefined()
        // Grade text appears in the summary row
        const gradeEl = screen.getByLabelText('Grade B')
        expect(gradeEl).toBeDefined()
    })

    it('renders score as X/100', () => {
        render(<CompactScoreSummary {...defaultProps} score={72} />)
        expect(screen.getByText('72/100')).toBeDefined()
    })

    it('shows "Export blocked" badge when exportBlocked is true', () => {
        render(<CompactScoreSummary {...defaultProps} exportBlocked={true} />)
        expect(screen.getByText('Export blocked')).toBeDefined()
    })

    it('shows "Ready to export" badge when exportBlocked is false', () => {
        render(<CompactScoreSummary {...defaultProps} exportBlocked={false} />)
        expect(screen.getByText('Ready to export')).toBeDefined()
    })

    // ── Effort framing ────────────────────────────────────────────────────────

    it('renders effort framing text', () => {
        render(<CompactScoreSummary {...defaultProps} effortText="5 auto-fixable" />)
        expect(screen.getByTestId('effort-framing').textContent).toContain('5 auto-fixable')
    })

    // ── Delta mode banner ─────────────────────────────────────────────────────

    it('does not show delta mode banner when conditions are not met', () => {
        render(<CompactScoreSummary {...defaultProps} initialViolationCount={5} isBaselineSet={true} />)
        expect(screen.queryByTestId('delta-mode-auto-banner')).toBeNull()
    })

    it('shows delta mode banner when initialViolationCount > 10, isBaselineSet, and not dismissed', () => {
        render(
            <CompactScoreSummary
                {...defaultProps}
                initialViolationCount={15}
                isBaselineSet={true}
                bannerDismissed={false}
            />
        )
        expect(screen.getByTestId('delta-mode-auto-banner')).toBeDefined()
    })

    it('does not show delta mode banner when bannerDismissed is true', () => {
        render(
            <CompactScoreSummary
                {...defaultProps}
                initialViolationCount={15}
                isBaselineSet={true}
                bannerDismissed={true}
            />
        )
        expect(screen.queryByTestId('delta-mode-auto-banner')).toBeNull()
    })

    it('calls onDismissBanner when Dismiss button in banner is clicked', () => {
        const handler = vi.fn()
        render(
            <CompactScoreSummary
                {...defaultProps}
                initialViolationCount={15}
                isBaselineSet={true}
                bannerDismissed={false}
                onDismissBanner={handler}
            />
        )
        fireEvent.click(screen.getByLabelText('Dismiss delta mode banner'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('calls onShowAllViolations when "Show all violations" is clicked', () => {
        const handler = vi.fn()
        render(
            <CompactScoreSummary
                {...defaultProps}
                initialViolationCount={15}
                isBaselineSet={true}
                bannerDismissed={false}
                onShowAllViolations={handler}
            />
        )
        fireEvent.click(screen.getByLabelText('Show all violations'))
        expect(handler).toHaveBeenCalledOnce()
    })

    // ── Export-ready banner ───────────────────────────────────────────────────

    it('renders Export button when exportBlocked is false', () => {
        render(<CompactScoreSummary {...defaultProps} exportBlocked={false} />)
        expect(screen.getByLabelText('Open export modal')).toBeDefined()
    })

    it('does not render export-ready banner when exportBlocked is true', () => {
        render(<CompactScoreSummary {...defaultProps} exportBlocked={true} />)
        expect(screen.queryByLabelText('Open export modal')).toBeNull()
    })

    it('calls onOpenExportModal when Export button is clicked', () => {
        const handler = vi.fn()
        render(<CompactScoreSummary {...defaultProps} exportBlocked={false} onOpenExportModal={handler} />)
        fireEvent.click(screen.getByLabelText('Open export modal'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('shows "No new issues — export ready" text when isBaselineSet is true', () => {
        render(<CompactScoreSummary {...defaultProps} exportBlocked={false} isBaselineSet={true} />)
        expect(screen.getByText('No new issues — export ready')).toBeDefined()
    })

    it('shows "All clear — export ready" text when isBaselineSet is false', () => {
        render(<CompactScoreSummary {...defaultProps} exportBlocked={false} isBaselineSet={false} />)
        expect(screen.getByText('All clear — export ready')).toBeDefined()
    })
})
