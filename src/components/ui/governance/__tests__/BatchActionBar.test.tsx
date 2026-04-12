/**
 * BatchActionBar.test.tsx — Sprint 3A sub-component tests
 *
 * Covers:
 * - Renders section header
 * - Conditionally shows each button only when count > 0
 * - Session progress indicator shows correct text
 * - All callback props fire on click
 * - isBaselineSet adds "(new only)" label to header
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BatchActionBar } from '../BatchActionBar'

const noop = () => {}

const defaultProps = {
    acceptedCount: 0,
    autoFixableCount: 0,
    a11yFixableCount: 0,
    manualCount: 0,
    onApplyAccepted: noop,
    onAutoFixMithril: noop,
    onFixAllA11y: noop,
    onReviewManual: noop,
}

describe('BatchActionBar', () => {
    it('renders the Issues section header', () => {
        render(<BatchActionBar {...defaultProps} />)
        expect(screen.getByText('Issues')).toBeDefined()
    })

    it('does not render any action buttons when all counts are zero', () => {
        render(<BatchActionBar {...defaultProps} />)
        expect(screen.queryByTestId('apply-accepted-fixes-button')).toBeNull()
        expect(screen.queryByTestId('fix-all-a11y-button')).toBeNull()
        expect(screen.queryByTestId('review-manual-a11y-button')).toBeNull()
    })

    it('renders Apply fixes button when acceptedCount > 0', () => {
        render(<BatchActionBar {...defaultProps} acceptedCount={3} />)
        const btn = screen.getByTestId('apply-accepted-fixes-button')
        expect(btn).toBeDefined()
        expect(btn.textContent).toContain('Apply 3')
    })

    it('calls onApplyAccepted when Apply button is clicked', () => {
        const handler = vi.fn()
        render(<BatchActionBar {...defaultProps} acceptedCount={1} onApplyAccepted={handler} />)
        fireEvent.click(screen.getByTestId('apply-accepted-fixes-button'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('renders Auto-fix button when autoFixableCount > 0', () => {
        render(<BatchActionBar {...defaultProps} autoFixableCount={5} />)
        expect(screen.getByText(/Auto-fix 5/)).toBeDefined()
    })

    it('renders Fix all a11y button when a11yFixableCount > 0', () => {
        render(<BatchActionBar {...defaultProps} a11yFixableCount={2} />)
        const btn = screen.getByTestId('fix-all-a11y-button')
        expect(btn).toBeDefined()
        expect(btn.textContent).toContain('Fix all a11y (2)')
    })

    it('calls onFixAllA11y when a11y button is clicked', () => {
        const handler = vi.fn()
        render(<BatchActionBar {...defaultProps} a11yFixableCount={1} onFixAllA11y={handler} />)
        fireEvent.click(screen.getByTestId('fix-all-a11y-button'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('renders Review manually button when manualCount > 0', () => {
        render(<BatchActionBar {...defaultProps} manualCount={4} />)
        const btn = screen.getByTestId('review-manual-a11y-button')
        expect(btn).toBeDefined()
        expect(btn.textContent).toContain('Review 4 manually')
    })

    it('calls onReviewManual when Review button is clicked', () => {
        const handler = vi.fn()
        render(<BatchActionBar {...defaultProps} manualCount={1} onReviewManual={handler} />)
        fireEvent.click(screen.getByTestId('review-manual-a11y-button'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('shows session progress indicator when sessionProgress.total > 0', () => {
        render(<BatchActionBar {...defaultProps} sessionProgress={{ fixed: 3, total: 10 }} />)
        const indicator = screen.getByTestId('session-progress-indicator')
        expect(indicator.textContent).toContain('Fixed 3 of 10 this session')
    })

    it('does not show session progress indicator when total is 0', () => {
        render(<BatchActionBar {...defaultProps} sessionProgress={{ fixed: 0, total: 0 }} />)
        expect(screen.queryByTestId('session-progress-indicator')).toBeNull()
    })

    it('does not show session progress indicator when sessionProgress is undefined', () => {
        render(<BatchActionBar {...defaultProps} />)
        expect(screen.queryByTestId('session-progress-indicator')).toBeNull()
    })

    it('shows "(new only)" label when isBaselineSet is true', () => {
        render(<BatchActionBar {...defaultProps} isBaselineSet={true} />)
        expect(screen.getByText('(new only)')).toBeDefined()
    })

    it('does not show "(new only)" label when isBaselineSet is false', () => {
        render(<BatchActionBar {...defaultProps} isBaselineSet={false} />)
        expect(screen.queryByText('(new only)')).toBeNull()
    })

    it('uses singular "fix" label when acceptedCount is 1', () => {
        render(<BatchActionBar {...defaultProps} acceptedCount={1} />)
        expect(screen.getByText(/Apply 1 fix$/)).toBeDefined()
    })

    it('uses plural "fixes" label when acceptedCount > 1', () => {
        render(<BatchActionBar {...defaultProps} acceptedCount={2} />)
        expect(screen.getByText(/Apply 2 fixes$/)).toBeDefined()
    })

    it('ensures session progress fixed count never goes below 0', () => {
        render(<BatchActionBar {...defaultProps} sessionProgress={{ fixed: -5, total: 10 }} />)
        const indicator = screen.getByTestId('session-progress-indicator')
        expect(indicator.textContent).toContain('Fixed 0 of 10 this session')
    })
})
