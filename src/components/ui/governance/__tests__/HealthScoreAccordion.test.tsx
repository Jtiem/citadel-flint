/**
 * HealthScoreAccordion.test.tsx — T19
 *
 * Covers:
 * - Renders "Score breakdown" header button
 * - Accordion collapses and expands on toggle
 * - Renders next-step coaching text
 * - Renders score trend hint when provided
 * - Does not render score trend hint when null
 * - Shows sparkline-empty message when history < 2 entries
 * - Shows sparkline when history has >= 2 entries
 * - Renders rewind-to-clean button when score < 95 and lastCleanState present
 * - Does not render rewind-to-clean when score >= 95
 * - Renders fidelity, a11y, override sub-score rows when counts > 0
 * - Does not render sub-score rows when all counts are zero
 * - "How is this calculated?" button opens modal
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HealthScoreAccordion } from '../HealthScoreAccordion'

const noop = () => {}

const defaultProps = {
    score: 80,
    grade: 'B',
    mithrilCount: 2,
    a11yCount: 1,
    overrideCount: 0,
    healthHistory: [
        { date: '2026-04-10', score: 75, grade: 'C' },
        { date: '2026-04-11', score: 80, grade: 'B' },
    ],
    scoreTrendHint: 'Fix 2 Color Drift issues to reach grade A',
    nextStep: { variant: 'mithril-dominant', text: '2 color drifts are lowering your score.' },
    lastCleanState: null,
    onRewindToClean: noop,
    fidelityScore: 85,
    a11yScore: 70,
}

describe('HealthScoreAccordion', () => {
    // ── Accordion toggle ──────────────────────────────────────────────────────

    it('renders the Score breakdown header button', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        // GLASSTYPO.1: Section title is "Score breakdown — {grade}" (grade appended)
        expect(screen.getByRole('button', { name: /Score breakdown/ })).toBeDefined()
    })

    it('accordion starts collapsed by default (passive metric — GLASSTYPO.1)', () => {
        // GLASSTYPO.1 contract: score breakdown is passive info → expandedWhen: () => false
        render(<HealthScoreAccordion {...defaultProps} />)
        const btn = screen.getByRole('button', { name: /Score breakdown/ })
        expect(btn.getAttribute('aria-expanded')).toBe('false')
    })

    it('expands when header button is clicked', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        const btn = screen.getByRole('button', { name: /Score breakdown/ })
        fireEvent.click(btn)
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('collapses after two clicks (toggle back)', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        const btn = screen.getByRole('button', { name: /Score breakdown/ })
        fireEvent.click(btn) // expand
        fireEvent.click(btn) // collapse
        expect(btn.getAttribute('aria-expanded')).toBe('false')
    })

    it('accordion button has aria-expanded=false when collapsed', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        const btn = screen.getByRole('button', { name: /Score breakdown/ })
        expect(btn.getAttribute('aria-expanded')).toBe('false')
    })

    it('accordion button has aria-expanded=true after clicking to expand', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        const btn = screen.getByRole('button', { name: /Score breakdown/ })
        fireEvent.click(btn)
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    // ── Next-step coaching sentence ───────────────────────────────────────────

    it('renders next step text', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        expect(screen.getByTestId('next-step-prompt').textContent).toContain('2 color drifts')
    })

    // ── Score trend hint ──────────────────────────────────────────────────────

    it('renders score trend hint when provided', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        expect(screen.getByTestId('score-trend-hint')).toBeDefined()
    })

    it('does not render score trend hint when scoreTrendHint is null', () => {
        render(<HealthScoreAccordion {...defaultProps} scoreTrendHint={null} />)
        expect(screen.queryByTestId('score-trend-hint')).toBeNull()
    })

    // ── Sparkline ─────────────────────────────────────────────────────────────

    it('shows sparkline when healthHistory has >= 2 entries', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        expect(screen.getByTestId('sparkline')).toBeDefined()
    })

    it('shows sparkline-empty message when history has < 2 entries', () => {
        render(<HealthScoreAccordion {...defaultProps} healthHistory={[]} />)
        expect(screen.getByTestId('sparkline-empty')).toBeDefined()
    })

    it('shows sparkline-empty message when history has exactly 1 entry', () => {
        render(<HealthScoreAccordion {...defaultProps} healthHistory={[{ date: '2026-04-11', score: 80, grade: 'B' }]} />)
        expect(screen.getByTestId('sparkline-empty')).toBeDefined()
    })

    // ── Rewind to clean ───────────────────────────────────────────────────────

    it('does not render rewind-to-clean button when lastCleanState is null', () => {
        render(<HealthScoreAccordion {...defaultProps} lastCleanState={null} />)
        expect(screen.queryByTestId('rewind-to-clean')).toBeNull()
    })

    it('does not render rewind-to-clean when score >= 95', () => {
        render(
            <HealthScoreAccordion
                {...defaultProps}
                score={95}
                lastCleanState={{ timestamp: new Date().toISOString(), score: 100 }}
            />
        )
        expect(screen.queryByTestId('rewind-to-clean')).toBeNull()
    })

    it('renders rewind-to-clean button when score < 95 and lastCleanState is provided', () => {
        render(
            <HealthScoreAccordion
                {...defaultProps}
                score={80}
                lastCleanState={{ timestamp: new Date().toISOString(), score: 100 }}
            />
        )
        expect(screen.getByTestId('rewind-to-clean')).toBeDefined()
    })

    it('calls onRewindToClean when rewind button is clicked', () => {
        const handler = vi.fn()
        render(
            <HealthScoreAccordion
                {...defaultProps}
                score={80}
                lastCleanState={{ timestamp: new Date().toISOString(), score: 100 }}
                onRewindToClean={handler}
            />
        )
        fireEvent.click(screen.getByTestId('rewind-to-clean'))
        expect(handler).toHaveBeenCalledOnce()
    })

    // ── Sub-score rows ────────────────────────────────────────────────────────
    // CHRON.1-repair / C2: rows narrate the canonical severity buckets driving
    // shared/healthScore.ts. Legacy callers that pass only (mithrilCount,
    // a11yCount) fall back to: mithril → amber bucket, a11y → critical bucket.

    it('renders amber-score-row when mithrilCount > 0 (fallback: mithril→amber)', () => {
        render(<HealthScoreAccordion {...defaultProps} mithrilCount={2} />)
        expect(screen.getByTestId('amber-score-row')).toBeDefined()
    })

    it('does not render amber-score-row when mithrilCount is 0 and no amberCount', () => {
        render(<HealthScoreAccordion {...defaultProps} mithrilCount={0} />)
        expect(screen.queryByTestId('amber-score-row')).toBeNull()
    })

    it('renders critical-score-row when a11yCount > 0 (fallback: a11y→critical)', () => {
        render(<HealthScoreAccordion {...defaultProps} a11yCount={1} />)
        expect(screen.getByTestId('critical-score-row')).toBeDefined()
    })

    it('does not render critical-score-row when a11yCount is 0 and no criticalCount', () => {
        render(<HealthScoreAccordion {...defaultProps} a11yCount={0} />)
        expect(screen.queryByTestId('critical-score-row')).toBeNull()
    })

    it('renders override-score-row when overrideCount > 0', () => {
        render(<HealthScoreAccordion {...defaultProps} overrideCount={3} />)
        expect(screen.getByTestId('override-score-row')).toBeDefined()
    })

    it('does not render override-score-row when overrideCount is 0', () => {
        render(<HealthScoreAccordion {...defaultProps} overrideCount={0} />)
        expect(screen.queryByTestId('override-score-row')).toBeNull()
    })

    it('amber bucket deduction matches canonical weight (×3 pts)', () => {
        render(<HealthScoreAccordion {...defaultProps} mithrilCount={4} />)
        expect(screen.getByTestId('amber-score-row').textContent).toContain('−12 pts')
    })

    it('critical bucket deduction matches canonical weight (×10 pts)', () => {
        render(<HealthScoreAccordion {...defaultProps} a11yCount={3} />)
        expect(screen.getByTestId('critical-score-row').textContent).toContain('−30 pts')
    })

    it('override bucket deduction matches canonical weight (×3 pts)', () => {
        render(<HealthScoreAccordion {...defaultProps} overrideCount={5} />)
        expect(screen.getByTestId('override-score-row').textContent).toContain('−15 pts')
    })

    it('severity-bucketed props override the legacy fallback', () => {
        // Pass a11yCount=0 but explicit criticalCount=2 — narration should use
        // the explicit bucket.
        render(
            <HealthScoreAccordion
                {...defaultProps}
                a11yCount={0}
                mithrilCount={0}
                criticalCount={2}
                amberCount={1}
                advisoryCount={3}
            />
        )
        expect(screen.getByTestId('critical-score-row').textContent).toContain('−20 pts')
        expect(screen.getByTestId('amber-score-row').textContent).toContain('−3 pts')
        expect(screen.getByTestId('advisory-score-row').textContent).toContain('−3 pts')
    })

    // ── "How is this calculated?" ─────────────────────────────────────────────

    it('renders "How is this calculated?" button', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        expect(screen.getByText('How is this calculated?')).toBeDefined()
    })

    it('opens score formula modal when "How is this calculated?" is clicked', () => {
        render(<HealthScoreAccordion {...defaultProps} />)
        fireEvent.click(screen.getByText('How is this calculated?'))
        // Modal title should now be visible
        expect(screen.getByText('How Your Score Is Calculated')).toBeDefined()
    })
})
