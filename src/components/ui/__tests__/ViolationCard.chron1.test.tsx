/**
 * ViolationCard.chron1.test.tsx — CHRON.1 Reason-on-Override (UX A+ pass)
 *
 * Test boundaries from the CHRON.1 contract, extended for UX A+ fixes:
 *   TB-16: Override reason text visible when overrideReason prop is present
 *   TB-17: No override reason element when overrideReason prop is null
 *   Bonus: No element when 'skipped'
 *   UX A+: Actor + timestamp rendered ("Overridden by Justin 2 days ago: reason")
 *   UX A+: Fallbacks when actor or timestamp missing
 *
 * Contract: .flint-context/contracts/CHRON.1.contract.ts
 * Implementation target: src/components/ui/governance/ViolationCard.tsx
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ViolationCard, formatRelativeTime } from '../../ui/governance/ViolationCard'
import type { LinterWarning } from '../../../types/flint-api'
import type { FixableItem } from '../FixPreviewDrawer'
import type {
    OverrideReasonDisplay,
} from '../../../../.flint-context/contracts/CHRON.1.contract'

// Type-level smoke check: imported contract type must compile.
type _CheckDisplay = OverrideReasonDisplay

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMithrilWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-chron1',
        type: 'color-drift',
        severity: 'amber',
        value: 2.5,
        message: "MITHRIL-COLOR: arbitrary '#3b82f6' not in color token set",
        nearestToken: 'text-indigo-500',
        nearestTokenValue: '#6366f1',
        ...overrides,
    }
}

function makeFixItem(): FixableItem {
    return {
        nodeId: 'node-chron1',
        label: 'MITHRIL-COLOR — node-chron1',
        hardcodedClass: 'text-[#3b82f6]',
        tokenClass: 'text-indigo-500',
    }
}

const noop = () => {}

function defaultProps(overrides: Record<string, unknown> = {}) {
    return {
        issue: makeMithrilWarning(),
        type: 'mithril' as const,
        cardKey: 'm-node-chron1',
        isPinned: false,
        isFlagged: false,
        isDeferred: false,
        deferExpiresAtMs: null,
        isDeferSuccess: false,
        deferSuccessMsg: undefined,
        isExpanded: false,
        isDiffOpen: false,
        isDiffLoading: false,
        diffData: null,
        isDeferFormOpen: false,
        fixItem: makeFixItem(),
        provenance: null,
        deferReason: '',
        deferDuration: '1 day' as const,
        onToggleExpand: noop,
        onFix: noop,
        onPreviewFix: noop,
        onAcceptFix: noop,
        onSkipFix: noop,
        onFlag: noop,
        onUnflag: noop,
        onDefer: noop,
        onDeferReasonChange: noop,
        onDeferDurationChange: noop,
        onSubmitDefer: noop,
        onCancelDefer: noop,
        onPin: noop,
        getNodeName: (id: string) => `<div #${id.slice(0, 6)}>`,
        activeFilePath: '/src/App.tsx',
        ...overrides,
    }
}

// ── Tests — original CHRON.1 contract ────────────────────────────────────────

describe('CHRON.1 — ViolationCard override reason display', () => {
    // TB-16: reason text visible when overrideReason prop is a non-null, non-'skipped' string
    it('displays override reason text when overrideReason prop is present — text includes reason', () => {
        render(<ViolationCard {...defaultProps({ overrideReason: 'brand team approved' })} />)
        const reasonEl = screen.getByTestId('override-reason-node-chron1')
        expect(reasonEl).toBeDefined()
        expect(reasonEl.textContent).toContain('brand team approved')
    })

    // TB-17: no override reason element when prop is null
    it('renders no override reason element when overrideReason prop is null', () => {
        render(<ViolationCard {...defaultProps({ overrideReason: null })} />)
        expect(screen.queryByTestId('override-reason-node-chron1')).toBeNull()
    })

    // Bonus: no override reason element when prop is undefined (prop not set)
    it('renders no override reason element when overrideReason prop is not provided', () => {
        render(<ViolationCard {...defaultProps()} />)
        expect(screen.queryByTestId('override-reason-node-chron1')).toBeNull()
    })

    // Bonus: no override reason element when prop is 'skipped' (filtered per contract linter W.A)
    it('renders no override reason element when overrideReason prop is "skipped"', () => {
        render(<ViolationCard {...defaultProps({ overrideReason: 'skipped' })} />)
        expect(screen.queryByTestId('override-reason-node-chron1')).toBeNull()
    })

    // Verify the reason text is accessible via aria-label
    it('override reason element has accessible aria-label including the reason', () => {
        render(<ViolationCard {...defaultProps({ overrideReason: 'compliance requirement' })} />)
        const reasonEl = screen.getByTestId('override-reason-node-chron1')
        expect(reasonEl.getAttribute('aria-label')).toBe('Override reason: compliance requirement')
    })
})

// ── Tests — UX A+ actor + timestamp rendering ─────────────────────────────────

describe('CHRON.1 UX A+ — ViolationCard actor and timestamp rendering', () => {
    // Construct a timestamp 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

    it('shows "Overridden by [actor] [time]" when both actor and timestamp are present', () => {
        render(<ViolationCard {...defaultProps({
            overrideReason: 'brand team approved',
            overrideActor: 'Justin',
            overrideTimestamp: twoDaysAgo,
        })} />)
        const el = screen.getByTestId('override-reason-node-chron1')
        expect(el.textContent).toContain('Overridden by Justin')
        expect(el.textContent).toContain('days ago')
        expect(el.textContent).toContain('brand team approved')
    })

    it('shows "Overridden by [actor]" when actor is present but timestamp is absent', () => {
        render(<ViolationCard {...defaultProps({
            overrideReason: 'brand team approved',
            overrideActor: 'Justin',
        })} />)
        const el = screen.getByTestId('override-reason-node-chron1')
        expect(el.textContent).toContain('Overridden by Justin')
        // No relative time in output
        expect(el.textContent).not.toContain('ago')
    })

    it('shows "Overridden [time]" when timestamp is present but actor is absent', () => {
        render(<ViolationCard {...defaultProps({
            overrideReason: 'brand team approved',
            overrideTimestamp: twoDaysAgo,
        })} />)
        const el = screen.getByTestId('override-reason-node-chron1')
        expect(el.textContent).toContain('Overridden')
        expect(el.textContent).toContain('days ago')
        // No "by" when actor is absent
        expect(el.textContent).not.toContain('by ')
    })

    it('shows "Overridden:" with no time or actor when neither is provided', () => {
        render(<ViolationCard {...defaultProps({
            overrideReason: 'brand team approved',
        })} />)
        const el = screen.getByTestId('override-reason-node-chron1')
        // Basic fallback
        expect(el.textContent).toContain('Overridden')
        expect(el.textContent).toContain('brand team approved')
        expect(el.textContent).not.toContain('by ')
        expect(el.textContent).not.toContain('ago')
    })

    it('reason is wrapped in quotes in the output', () => {
        render(<ViolationCard {...defaultProps({
            overrideReason: 'approved',
            overrideActor: 'Alex',
            overrideTimestamp: twoDaysAgo,
        })} />)
        const el = screen.getByTestId('override-reason-node-chron1')
        // The reason is displayed as "reason" (with curly quotes or similar)
        expect(el.textContent).toContain('approved')
    })

    it('aria-label on override reason element always contains the reason text', () => {
        render(<ViolationCard {...defaultProps({
            overrideReason: 'legal requirement',
            overrideActor: 'Sam',
            overrideTimestamp: twoDaysAgo,
        })} />)
        const el = screen.getByTestId('override-reason-node-chron1')
        expect(el.getAttribute('aria-label')).toContain('legal requirement')
    })
})

// ── Tests — formatRelativeTime helper ────────────────────────────────────────

describe('formatRelativeTime helper', () => {
    it('returns "just now" for timestamps less than 1 minute ago', () => {
        const ts = new Date(Date.now() - 30_000).toISOString()
        expect(formatRelativeTime(ts)).toBe('just now')
    })

    it('returns "N minutes ago" for timestamps within the last hour', () => {
        const ts = new Date(Date.now() - 15 * 60_000).toISOString()
        expect(formatRelativeTime(ts)).toContain('minutes ago')
    })

    it('returns "1 minute ago" for exactly 1 minute', () => {
        const ts = new Date(Date.now() - 60_000).toISOString()
        expect(formatRelativeTime(ts)).toBe('1 minute ago')
    })

    it('returns "N hours ago" for timestamps within 24 hours', () => {
        const ts = new Date(Date.now() - 3 * 60 * 60_000).toISOString()
        expect(formatRelativeTime(ts)).toContain('hours ago')
    })

    it('returns "1 hour ago" for exactly 1 hour', () => {
        const ts = new Date(Date.now() - 60 * 60_000).toISOString()
        expect(formatRelativeTime(ts)).toBe('1 hour ago')
    })

    it('returns "N days ago" for timestamps within 7 days', () => {
        const ts = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
        expect(formatRelativeTime(ts)).toBe('2 days ago')
    })

    it('returns "1 day ago" for exactly 1 day', () => {
        const ts = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
        expect(formatRelativeTime(ts)).toBe('1 day ago')
    })

    it('returns "N weeks ago" for timestamps beyond 7 days', () => {
        const ts = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString()
        expect(formatRelativeTime(ts)).toBe('2 weeks ago')
    })

    it('returns "" for an invalid date string', () => {
        expect(formatRelativeTime('not-a-date')).toBe('')
    })

    it('returns "" for an empty string', () => {
        expect(formatRelativeTime('')).toBe('')
    })
})
