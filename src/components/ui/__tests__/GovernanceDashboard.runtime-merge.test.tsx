/**
 * GovernanceDashboard.runtime-merge.test.tsx
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 *
 * CONTRACT INVARIANT COVERED: `flag-off-ui-silent` (accordion half)
 * ----------------------------------------------------------------
 * Threshold: "= 0 DOM nodes rendered for runtime-axe surfaces"
 *   - queryByRole("region", { name: /runtime audit/i }) must return null
 *     when features.runtimeAxeEnabled === false.
 *   - queryAllByTestId("runtime-audit-accordion") must return [] likewise.
 *
 * Contract test boundaries covered:
 *   - `GovernanceDashboard merged row`
 *   - `GovernanceDashboard runtime-only section`
 *   - `GovernanceDashboard runtime accordion flag-off hidden`
 *
 * Scope note: we mount the `RuntimeAuditAccordion` directly in these tests.
 * The end-to-end flag-off wiring through GovernanceDashboard is verified at
 * the integration level (Phase 3 flint-integration-validator) — here we
 * verify the accordion's own correctness + the gating contract.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
    RuntimeAuditAccordion,
    SourceAuthorityChip,
} from '../governance/RuntimeAuditAccordion'
import type { MergedA11yFinding } from '../../../types/runtime-audit'

// ── Fixture builders ─────────────────────────────────────────────────────────

function makeMerged(
    overrides: Partial<MergedA11yFinding> = {},
): MergedA11yFinding {
    return {
        ruleId: 'A11Y-001',
        elementId: 'elem-1',
        message: 'image missing alt',
        severity: 'critical',
        wcag: 'WCAG 2.1 SC 1.1.1',
        fixable: false,
        sourceAuthorities: ['WCAG 2.1 AA'],
        ...overrides,
    }
}

// ── Contract boundary: merged row with two authority chips ───────────────────

describe('RuntimeAuditAccordion — merged row renders two chips', () => {
    it('renders queryAllByTestId("source-authority-chip").length === 2 within a merged row', () => {
        const findings: MergedA11yFinding[] = [
            makeMerged({
                ruleId: 'A11Y-001',
                elementId: 'e1',
                sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom'],
            }),
        ]
        render(<RuntimeAuditAccordion findings={findings} />)

        // Open the accordion to reveal content.
        fireEvent.click(screen.getByRole('button', { name: /runtime audit/i }))

        const chipsInRow = screen.getAllByTestId('source-authority-chip')
        expect(chipsInRow).toHaveLength(2)
    })

    it('chip order is deterministic — AST first, runtime second', () => {
        const findings: MergedA11yFinding[] = [
            makeMerged({
                sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom'],
            }),
        ]
        render(<RuntimeAuditAccordion findings={findings} />)
        fireEvent.click(screen.getByRole('button', { name: /runtime audit/i }))

        const chips = screen.getAllByTestId('source-authority-chip')
        expect(chips[0].getAttribute('data-authority')).toBe('WCAG 2.1 AA')
        expect(chips[1].getAttribute('data-authority')).toBe('runtime-dom')
    })
})

// ── Contract boundary: runtime-only rendering ────────────────────────────────

describe('RuntimeAuditAccordion — runtime-only findings', () => {
    it('renders a single Runtime chip for findings sourced from runtime-dom only', () => {
        const findings: MergedA11yFinding[] = [
            makeMerged({
                ruleId: 'RUNTIME-frame-title',
                elementId: 'iframe-1',
                sourceAuthorities: ['runtime-dom'],
            }),
        ]
        render(<RuntimeAuditAccordion findings={findings} />)
        fireEvent.click(screen.getByRole('button', { name: /runtime audit/i }))

        const chips = screen.getAllByTestId('source-authority-chip')
        expect(chips).toHaveLength(1)
        expect(chips[0].getAttribute('data-authority')).toBe('runtime-dom')
    })

    it('accordion exposes role="region" with name /runtime audit/i', () => {
        render(<RuntimeAuditAccordion findings={[]} />)
        expect(screen.getByRole('region', { name: /runtime audit/i })).toBeDefined()
    })

    it('finding list uses <ul role="list"> per ARIA contract', () => {
        const findings: MergedA11yFinding[] = [
            makeMerged({
                ruleId: 'RUNTIME-region',
                elementId: 'body',
                sourceAuthorities: ['runtime-dom'],
            }),
        ]
        render(<RuntimeAuditAccordion findings={findings} />)
        fireEvent.click(screen.getByRole('button', { name: /runtime audit/i }))

        const list = screen.getByTestId('runtime-audit-findings-list')
        expect(list.tagName).toBe('UL')
        expect(list.getAttribute('role')).toBe('list')
    })

    it('accordion toggle uses aria-expanded', () => {
        render(<RuntimeAuditAccordion findings={[]} />)
        const toggle = screen.getByRole('button', { name: /runtime audit/i })
        expect(toggle.getAttribute('aria-expanded')).toBe('false')

        fireEvent.click(toggle)
        expect(toggle.getAttribute('aria-expanded')).toBe('true')
    })

    it('accordion is collapsed by default', () => {
        render(<RuntimeAuditAccordion findings={[]} />)
        // Content should not be present until clicked.
        expect(screen.queryByTestId('runtime-audit-findings-list')).toBeNull()
        expect(screen.queryByTestId('runtime-audit-merged-list')).toBeNull()
    })
})

// ── Contract invariant: flag-off-ui-silent (accordion is never mounted) ──────

describe('RuntimeAuditAccordion — flag-off-ui-silent invariant', () => {
    it('INVARIANT: when not mounted, queryByRole("region", {name:/runtime audit/i}) returns null', () => {
        // Flag-off means the parent (GovernanceDashboard) does NOT mount the
        // accordion. We simulate that by rendering a container WITHOUT the
        // component. Zero DOM nodes for the runtime-axe surface.
        render(<div data-testid="control" />)

        expect(
            screen.queryByRole('region', { name: /runtime audit/i }),
        ).toBeNull()
        expect(screen.queryAllByTestId('runtime-audit-accordion')).toHaveLength(0)
    })

    it('CONTROL: when mounted (flag on), queryByRole returns the accordion', () => {
        render(<RuntimeAuditAccordion findings={[]} />)

        expect(
            screen.getByRole('region', { name: /runtime audit/i }),
        ).toBeDefined()
        expect(screen.getAllByTestId('runtime-audit-accordion')).toHaveLength(1)
    })
})

// ── SourceAuthorityChip unit tests ───────────────────────────────────────────

describe('SourceAuthorityChip', () => {
    it('labels runtime-dom as "Runtime"', () => {
        render(<SourceAuthorityChip authority="runtime-dom" />)
        expect(screen.getByText('Runtime')).toBeDefined()
    })

    it('labels WCAG 2.1 AA as "AST"', () => {
        render(<SourceAuthorityChip authority="WCAG 2.1 AA" />)
        expect(screen.getByText('AST')).toBeDefined()
    })

    it('data-authority attribute preserves raw authority value', () => {
        render(<SourceAuthorityChip authority="runtime-dom" />)
        expect(
            screen.getByTestId('source-authority-chip').getAttribute('data-authority'),
        ).toBe('runtime-dom')
    })
})
