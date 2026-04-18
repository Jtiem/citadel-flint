/**
 * SeverityChip.test.tsx
 *
 * Test boundaries from MINT.5-phase1.contract.ts §1.4:
 *  1. Renders the correct color class for each severity tier.
 *  2. Hides count when undefined; renders count when number provided.
 *  3. aria-label matches expected format.
 *  4. Keyboard tab order — chip is non-interactive (not in tab sequence).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeverityChip } from '../SeverityChip'
import type { ChipSeverity } from '../../../../../.flint-context/contracts/MINT.5-phase1.contract'

// ── 1. Color classes per severity tier ───────────────────────────────────────

describe('SeverityChip — color classes', () => {
    it.each<[ChipSeverity, string, string]>([
        ['critical', 'red-400',   'red-500/10'],
        ['amber',    'amber-400', 'amber-400/10'],
        ['advisory', 'zinc-400',  'zinc-800'],
    ])('%s severity renders correct palette (%s text, %s background)', (severity, textToken, bgToken) => {
        render(
            <SeverityChip
                severity={severity}
                label="violations"
                data-testid="chip"
            />
        )

        const chip = screen.getByTestId('chip')

        // Text colour token must appear in the className string
        expect(chip.className).toContain(textToken)

        // Background token must appear in the className string
        expect(chip.className).toContain(bgToken)
    })

    it('critical severity renders red dot when no icon is provided', () => {
        const { container } = render(
            <SeverityChip severity="critical" label="issues" data-testid="chip" />
        )
        // The severity dot is a sibling span with aria-hidden="true" inside the chip
        const dots = container.querySelectorAll('[aria-hidden="true"]')
        const dotSpans = Array.from(dots).filter(
            el => el.tagName === 'SPAN' && (el as HTMLElement).className.includes('rounded-full')
        )
        expect(dotSpans.length).toBeGreaterThanOrEqual(1)
        expect((dotSpans[0] as HTMLElement).className).toContain('bg-red-400')
    })

    it('amber severity renders amber dot when no icon is provided', () => {
        const { container } = render(
            <SeverityChip severity="amber" label="issues" data-testid="chip" />
        )
        const dots = container.querySelectorAll('[aria-hidden="true"]')
        const dotSpans = Array.from(dots).filter(
            el => el.tagName === 'SPAN' && (el as HTMLElement).className.includes('rounded-full')
        )
        expect((dotSpans[0] as HTMLElement).className).toContain('bg-amber-400')
    })

    it('advisory severity renders zinc dot when no icon is provided', () => {
        const { container } = render(
            <SeverityChip severity="advisory" label="issues" data-testid="chip" />
        )
        const dots = container.querySelectorAll('[aria-hidden="true"]')
        const dotSpans = Array.from(dots).filter(
            el => el.tagName === 'SPAN' && (el as HTMLElement).className.includes('rounded-full')
        )
        expect((dotSpans[0] as HTMLElement).className).toContain('bg-zinc-500')
    })
})

// ── 2. Count rendering ────────────────────────────────────────────────────────

describe('SeverityChip — count rendering', () => {
    it('does not render a count element when count is undefined', () => {
        render(
            <SeverityChip
                severity="critical"
                label="errors"
                data-testid="chip"
            />
        )
        const chip = screen.getByTestId('chip')
        // The chip text content should be just the label, no leading number
        expect(chip.textContent).not.toMatch(/^\d/)
        // Confirm label is still present
        expect(chip.textContent).toContain('errors')
    })

    it('renders count before label when count is 0', () => {
        render(
            <SeverityChip
                severity="advisory"
                label="warnings"
                count={0}
                data-testid="chip"
            />
        )
        const chip = screen.getByTestId('chip')
        expect(chip.textContent).toContain('0')
        expect(chip.textContent).toContain('warnings')
    })

    it('renders count=1 alongside label', () => {
        render(
            <SeverityChip
                severity="amber"
                label="drifted"
                count={1}
                data-testid="chip"
            />
        )
        const chip = screen.getByTestId('chip')
        expect(chip.textContent).toContain('1')
        expect(chip.textContent).toContain('drifted')
    })

    it('renders count=3 alongside label', () => {
        render(
            <SeverityChip
                severity="critical"
                label="contrast fails"
                count={3}
                data-testid="chip"
            />
        )
        const chip = screen.getByTestId('chip')
        expect(chip.textContent).toContain('3')
        expect(chip.textContent).toContain('contrast fails')
    })
})

// ── 3. Accessible aria-label ──────────────────────────────────────────────────

describe('SeverityChip — aria-label', () => {
    it('computes default aria-label from count + severity + label', () => {
        render(
            <SeverityChip
                severity="critical"
                label="contrast fails"
                count={3}
            />
        )
        // Contract: `${count} ${severity} ${label}`
        const chip = screen.getByLabelText(/3 critical contrast fails/i)
        expect(chip).toBeTruthy()
    })

    it('computes aria-label without count prefix when count is undefined', () => {
        render(
            <SeverityChip
                severity="advisory"
                label="dead tokens"
            />
        )
        // Contract: `${severity} ${label}` when count is omitted
        const chip = screen.getByLabelText(/advisory dead tokens/i)
        expect(chip).toBeTruthy()
    })

    it('uses the aria-label prop override when provided', () => {
        render(
            <SeverityChip
                severity="amber"
                label="drifted"
                count={5}
                aria-label="5 token drift warnings"
            />
        )
        const chip = screen.getByLabelText('5 token drift warnings')
        expect(chip).toBeTruthy()
        // Default label should NOT be present — getByLabelText would throw if not found,
        // so use queryByLabelText and assert null
        expect(screen.queryByLabelText(/5 amber drifted/i)).toBeNull()
    })

    it('aria-label includes count=0 in prefix', () => {
        render(
            <SeverityChip
                severity="critical"
                label="violations"
                count={0}
            />
        )
        const chip = screen.getByLabelText(/0 critical violations/i)
        expect(chip).toBeTruthy()
    })
})

// ── 4. Keyboard tab order ─────────────────────────────────────────────────────

describe('SeverityChip — keyboard tab order', () => {
    it('is not keyboard-focusable (non-interactive, no tabIndex)', () => {
        render(
            <SeverityChip
                severity="critical"
                label="issues"
                data-testid="chip"
            />
        )
        const chip = screen.getByTestId('chip')
        // tabIndex defaults to 0 for interactive elements; span has -1 or unset (native -1)
        // A plain span without tabIndex has tabIndex === -1 in jsdom
        expect(chip.tabIndex).toBe(-1)
    })

    it('chip is a span element (not a button or anchor)', () => {
        render(
            <SeverityChip
                severity="amber"
                label="warnings"
                data-testid="chip"
            />
        )
        const chip = screen.getByTestId('chip')
        expect(chip.tagName).toBe('SPAN')
    })
})

// ── 5. Custom icon prop ───────────────────────────────────────────────────────

describe('SeverityChip — icon prop', () => {
    it('renders icon content when icon prop is provided', () => {
        render(
            <SeverityChip
                severity="critical"
                label="errors"
                icon={<svg data-testid="custom-icon" />}
                data-testid="chip"
            />
        )
        expect(screen.getByTestId('custom-icon')).toBeTruthy()
    })

    it('renders dot when no icon prop is provided', () => {
        const { container } = render(
            <SeverityChip
                severity="critical"
                label="errors"
                data-testid="chip"
            />
        )
        // Should have an aria-hidden dot span, no svg
        expect(container.querySelector('svg')).toBeNull()
        const dots = container.querySelectorAll('[aria-hidden="true"]')
        expect(dots.length).toBeGreaterThanOrEqual(1)
    })
})
