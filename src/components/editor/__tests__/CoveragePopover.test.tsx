/**
 * CoveragePopover.test.tsx
 *
 * Phase 0 — Coverage Honesty
 * Group B: Real assertions replacing it.todo() scaffolds.
 *
 * CONTRACT-SOURCE: .flint-context/contracts/PHASE0-coverage-honesty.contract.ts
 * CONTRACT-BOUNDARY: "CoveragePopover — breakdown rendering"
 *
 * Key assertions:
 *   - Renders exactly N <li> elements where N === count of non-zero skippedFilesByReason
 *   - Each row shows the human-readable label and the count
 *   - Zero skipped files → "All files governed" empty state (no reasons list)
 *   - All 9 reasons non-zero → 9 rows (parse-failure added by flint-ast-surgeon)
 *   - Escape key dismisses (onClose called) — Commandment 5
 *   - Footer contains the informational copy string verbatim
 *   - Idle mode: renders "No scan yet" heading + educational message
 *   - REASON_LABELS has 9 entries with plain-English copy (Fix 2)
 *   - tailwind-config-extension label reflects load-failure, not missing-feature (Phase 1 fix)
 *   - dynamic-class-expression label hints at unresolvable shapes, not generic clsx usage (Phase 1 fix)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoveragePopover, REASON_LABELS } from '../CoveragePopover'
import type { CoverageSummary } from '../../../../shared/coverage-types'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const ZERO_REASONS = {
    'css-in-js-detected': 0,
    'external-stylesheet-imported': 0,
    'css-modules-reference': 0,
    'dynamic-class-expression': 0,
    'unresolvable-var': 0,
    'tailwind-config-extension': 0,
    'non-jsx-framework': 0,
    'non-literal-ternary-branch': 0,
    'parse-failure': 0,
}

function makeSummary(overrides: Partial<CoverageSummary>): CoverageSummary {
    return {
        governedSurfacePercent: 100,
        totalFiles: 10,
        parsedFiles: 10,
        partialFiles: 0,
        skippedFiles: 0,
        skippedFilesByReason: { ...ZERO_REASONS },
        timestamp: '2026-04-18T00:00:00.000Z',
        ...overrides,
    }
}

/** Summary with 2 non-zero reasons: css-in-js-detected=3, non-jsx-framework=1 */
const TWO_REASON_SUMMARY = makeSummary({
    governedSurfacePercent: 60,
    totalFiles: 5,
    parsedFiles: 3,
    partialFiles: 1,
    skippedFiles: 1,
    skippedFilesByReason: {
        ...ZERO_REASONS,
        'css-in-js-detected': 3,
        'non-jsx-framework': 1,
    },
})

/** Summary with all 9 reasons non-zero */
const ALL_REASONS_SUMMARY = makeSummary({
    governedSurfacePercent: 0,
    totalFiles: 9,
    parsedFiles: 0,
    partialFiles: 5,
    skippedFiles: 4,
    skippedFilesByReason: {
        'css-in-js-detected': 1,
        'external-stylesheet-imported': 1,
        'css-modules-reference': 1,
        'dynamic-class-expression': 1,
        'unresolvable-var': 1,
        'tailwind-config-extension': 1,
        'non-jsx-framework': 1,
        'non-literal-ternary-branch': 1,
        'parse-failure': 1,
    },
})

/** Summary with zero skipped/partial files */
const FULLY_GOVERNED_SUMMARY = makeSummary({
    governedSurfacePercent: 100,
    totalFiles: 10,
    parsedFiles: 10,
    partialFiles: 0,
    skippedFiles: 0,
    skippedFilesByReason: { ...ZERO_REASONS },
})

/** Summary for showing all four counts */
const COUNTS_SUMMARY = makeSummary({
    governedSurfacePercent: 60,
    totalFiles: 5,
    parsedFiles: 3,
    partialFiles: 1,
    skippedFiles: 1,
    skippedFilesByReason: {
        ...ZERO_REASONS,
        'css-in-js-detected': 2,
    },
})

// ─── CONTRACT-BOUNDARY: CoveragePopover — breakdown rendering ────────────────

describe('CoveragePopover — breakdown rendering', () => {
    it('renders exactly 2 <li> elements when 2 reasons are non-zero', () => {
        // GIVEN: summary with css-in-js-detected=3, non-jsx-framework=1, all others 0
        const onClose = vi.fn()
        // WHEN: component mounts
        render(<CoveragePopover summary={TWO_REASON_SUMMARY} onClose={onClose} />)
        // THEN: exactly 2 <li> elements in the reasons list
        const list = screen.getByTestId('coverage-reasons-list')
        const items = list.querySelectorAll('li')
        expect(items.length).toBe(2)
    })

    it('renders the human-readable label for css-in-js-detected reason', () => {
        // GIVEN: same summary with css-in-js-detected=3
        render(<CoveragePopover summary={TWO_REASON_SUMMARY} onClose={vi.fn()} />)
        // THEN: one row displays the CSS-in-JS label (plain-English copy, Fix 2)
        expect(screen.getByText(/CSS-in-JS/)).toBeDefined()
        // The count is present in the row alongside the label
        const list = screen.getByTestId('coverage-reasons-list')
        expect(list.textContent).toContain('3')
    })

    it('renders the human-readable label for non-jsx-framework reason', () => {
        // GIVEN: same summary with non-jsx-framework=1
        render(<CoveragePopover summary={TWO_REASON_SUMMARY} onClose={vi.fn()} />)
        // THEN: one row displays the framework label with count 1
        expect(screen.getByText(/Flint only understands React today/)).toBeDefined()
        const list = screen.getByTestId('coverage-reasons-list')
        expect(list.textContent).toContain('1')
    })

    it('renders "All files governed" empty state when skippedFiles and partialFiles are both 0', () => {
        // GIVEN: fully governed summary — no skipped or partial files
        render(<CoveragePopover summary={FULLY_GOVERNED_SUMMARY} onClose={vi.fn()} />)
        // THEN: "All files governed" empty state message instead of a list
        const emptyState = screen.getByTestId('coverage-empty-state')
        expect(emptyState).toBeDefined()
        expect(emptyState.textContent).toContain('All files fully governed')
        // Reasons list is NOT rendered
        expect(screen.queryByTestId('coverage-reasons-list')).toBeNull()
    })

    it('renders 9 <li> elements when all CoverageReason values are non-zero', () => {
        // GIVEN: all 9 reasons non-zero (8 original + parse-failure)
        render(<CoveragePopover summary={ALL_REASONS_SUMMARY} onClose={vi.fn()} />)
        // THEN: exactly 9 <li> elements
        const list = screen.getByTestId('coverage-reasons-list')
        const items = list.querySelectorAll('li')
        expect(items.length).toBe(9)
    })

    it('shows total file counts — parsedFiles, partialFiles, skippedFiles, totalFiles', () => {
        // GIVEN: summary with parsedFiles=3, partialFiles=1, skippedFiles=1, totalFiles=5
        render(<CoveragePopover summary={COUNTS_SUMMARY} onClose={vi.fn()} />)
        // THEN: all four counts appear in the popover
        expect(screen.getByTestId('coverage-total-files').textContent).toContain('5')
        expect(screen.getByTestId('coverage-parsed-files').textContent).toContain('3')
        expect(screen.getByTestId('coverage-partial-files').textContent).toContain('1')
        expect(screen.getByTestId('coverage-skipped-files').textContent).toContain('1')
    })

    it('close-on-Escape calls onClose callback', () => {
        // GIVEN: popover with a mock onClose
        const onClose = vi.fn()
        render(<CoveragePopover summary={TWO_REASON_SUMMARY} onClose={onClose} />)
        // WHEN: user presses Escape
        fireEvent.keyDown(document, { key: 'Escape' })
        // THEN: onClose called exactly once
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('popover copy states coverage is informational and does not change grade', () => {
        // GIVEN: any summary
        render(<CoveragePopover summary={TWO_REASON_SUMMARY} onClose={vi.fn()} />)
        // WHEN: component mounts
        // THEN: footer contains the exact informational-copy string (non-goal #2 mitigation)
        expect(screen.getByText('Coverage is informational — it does not change your grade.')).toBeDefined()
    })
})

// ─── Fix 2: REASON_LABELS plain-English copy ─────────────────────────────────

describe('REASON_LABELS — plain-English copy (Fix 2)', () => {
    it('has exactly 9 entries (8 original + parse-failure)', () => {
        expect(Object.keys(REASON_LABELS).length).toBe(9)
    })

    it('css-in-js-detected label says what\'s in the code and signals "yet"', () => {
        const label = REASON_LABELS['css-in-js-detected']
        expect(label).toMatch(/CSS-in-JS/i)
        expect(label).toMatch(/yet/i)
    })

    it('non-jsx-framework label names Vue/Svelte/Angular and says "today"', () => {
        const label = REASON_LABELS['non-jsx-framework']
        expect(label).toMatch(/Vue|Svelte|Angular/i)
        expect(label).toMatch(/today|yet/i)
    })

    it('tailwind-config-extension label describes a load failure, not a missing feature', () => {
        const label = REASON_LABELS['tailwind-config-extension']
        // Must reference the config and indicate a load failure
        expect(label).toMatch(/config/i)
        expect(label).toMatch(/couldn't load|syntax error|unsupported/i)
        // Must NOT use the old "extends theme values" wording
        expect(label).not.toMatch(/extends theme/i)
    })

    it('tailwind-config-extension label renders in popover with correct failure copy', () => {
        const summary = makeSummary({
            governedSurfacePercent: 80,
            totalFiles: 5,
            parsedFiles: 4,
            partialFiles: 0,
            skippedFiles: 1,
            skippedFilesByReason: {
                ...ZERO_REASONS,
                'tailwind-config-extension': 1,
            },
        })
        render(<CoveragePopover summary={summary} onClose={vi.fn()} />)
        const list = screen.getByTestId('coverage-reasons-list')
        expect(list.textContent).toMatch(/couldn't load|syntax error|unsupported/i)
    })

    it('parse-failure label describes a syntax or unsupported syntax problem', () => {
        const label = REASON_LABELS['parse-failure']
        expect(label).toMatch(/parse|syntax/i)
    })

    it('dynamic-class-expression label names unresolvable patterns, not generic clsx/cva usage', () => {
        const label = REASON_LABELS['dynamic-class-expression']
        // Must reference the unresolvable shapes, not just "clsx, cva, classnames"
        expect(label).toMatch(/imported helper|function result|variable in a ternary/i)
        // Must still signal incompleteness
        expect(label).toMatch(/yet/i)
        // Must NOT use the old "Merges classes dynamically" framing
        expect(label).not.toMatch(/Merges classes dynamically/i)
    })

    it('dynamic-class-expression label renders in popover with hint-style copy', () => {
        const summary = makeSummary({
            governedSurfacePercent: 80,
            totalFiles: 5,
            parsedFiles: 4,
            partialFiles: 0,
            skippedFiles: 1,
            skippedFilesByReason: {
                ...ZERO_REASONS,
                'dynamic-class-expression': 2,
            },
        })
        render(<CoveragePopover summary={summary} onClose={vi.fn()} />)
        const list = screen.getByTestId('coverage-reasons-list')
        expect(list.textContent).toMatch(/imported helper|function result|variable in a ternary/i)
        expect(list.textContent).toContain('2')
    })

    it('no label contains the jargon phrase "Dynamic className ternary" (old copy)', () => {
        const values = Object.values(REASON_LABELS)
        // The old jargon label should be gone — replaced with plain English
        expect(values.every(v => !v.includes('Dynamic className ternary'))).toBe(true)
    })

    it('no label contains the jargon phrase "CSS Modules" as a standalone label', () => {
        // Old label was just "CSS Modules" — new one explains what Flint does with it
        const label = REASON_LABELS['css-modules-reference']
        // New copy must say more than the bare jargon term
        expect(label.length).toBeGreaterThan('CSS Modules'.length + 10)
        expect(label).toMatch(/yet/i)
    })

    it('no label contains "Unresolvable CSS variable" as-is (old jargon copy)', () => {
        const label = REASON_LABELS['unresolvable-var']
        expect(label).not.toBe('Unresolvable CSS variable')
    })
})

// ─── Idle mode rendering ──────────────────────────────────────────────────────

describe('CoveragePopover — idle mode', () => {
    it('renders "No scan yet" heading in idle mode', () => {
        render(<CoveragePopover mode="idle" onClose={vi.fn()} />)
        expect(screen.getByText('No scan yet')).toBeDefined()
    })

    it('idle mode renders data-coverage-popover-mode="idle"', () => {
        const { container } = render(<CoveragePopover mode="idle" onClose={vi.fn()} />)
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover?.getAttribute('data-coverage-popover-mode')).toBe('idle')
    })

    it('idle mode shows flint_debt_report instruction', () => {
        render(<CoveragePopover mode="idle" onClose={vi.fn()} />)
        const message = screen.getByTestId('coverage-idle-message')
        expect(message.textContent).toContain('flint_debt_report')
    })

    it('idle mode Escape key calls onClose', () => {
        const onClose = vi.fn()
        render(<CoveragePopover mode="idle" onClose={onClose} />)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('idle mode does not render the coverage-reasons-list', () => {
        render(<CoveragePopover mode="idle" onClose={vi.fn()} />)
        expect(screen.queryByTestId('coverage-reasons-list')).toBeNull()
    })

    it('idle mode does not render the coverage-percent element', () => {
        render(<CoveragePopover mode="idle" onClose={vi.fn()} />)
        expect(screen.queryByTestId('coverage-percent')).toBeNull()
    })
})
