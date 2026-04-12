/**
 * counsel2.test.tsx — COUNSEL.2 Deferral + Workload Voice tests
 *
 * Covers:
 *   COUNSEL.2.1 — Defer button on every ViolationCard, deferred section
 *   COUNSEL.2.2 — AI-sourced "Review" badge (indigo)
 *   COUNSEL.2.3 — Resurfaced badge when isResurfaced=true
 *   COUNSEL.2.4 — Effort estimate in BatchActionBar
 *   COUNSEL.2.5 — Session progress bar and celebration state
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ViolationCard } from '../ViolationCard'
import { BatchActionBar } from '../BatchActionBar'
import type { LinterWarning } from '../../../../types/flint-api'
import type { FixableItem } from '../../FixPreviewDrawer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMithrilWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-c2test',
        type: 'color-drift',
        severity: 'amber',
        value: 2.5,
        message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        nearestToken: 'text-indigo-500',
        nearestTokenValue: '#6366f1',
        ...overrides,
    }
}

function makeFixItem(): FixableItem {
    return {
        nodeId: 'node-c2test',
        label: 'MITHRIL-COL-001 — node-c2test',
        hardcodedClass: 'text-[#3b82f6]',
        tokenClass: 'text-indigo-500',
    }
}

const noop = () => {}

function defaultMithrilProps(overrides = {}) {
    return {
        issue: makeMithrilWarning(),
        type: 'mithril' as const,
        cardKey: 'm-node-c2test',
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
        isResurfaced: false,
        isAiSourced: false,
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

// ── COUNSEL.2.1: Defer button on every ViolationCard ────────────────────────

describe('COUNSEL.2.1 — Defer button on ViolationCard', () => {
    it('renders a Defer button when not deferred and not flagged', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        expect(screen.getByTestId('defer-btn-node-c2test')).toBeDefined()
    })

    it('renders Snoozed badge when isDeferred=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferred: true })} />)
        expect(screen.getByTestId('deferred-badge-node-c2test')).toBeDefined()
    })

    it('hides Defer button when isDeferred=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferred: true })} />)
        expect(screen.queryByTestId('defer-btn-node-c2test')).toBeNull()
    })

    it('shows resurface label when deferred with expiry', () => {
        const expiresInOneDay = Date.now() + 86400000
        render(<ViolationCard {...defaultMithrilProps({
            isDeferred: true,
            deferExpiresAtMs: expiresInOneDay,
        })} />)
        expect(screen.getByTestId('resurface-label-node-c2test')).toBeDefined()
    })

    it('opens defer form when isDeferFormOpen=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferFormOpen: true })} />)
        expect(screen.getByTestId('defer-form-node-c2test')).toBeDefined()
    })

    it('renders duration options in the defer form', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferFormOpen: true })} />)
        expect(screen.getByText('1 day')).toBeDefined()
        expect(screen.getByText('3 days')).toBeDefined()
        expect(screen.getByText('1 week')).toBeDefined()
        expect(screen.getByText('1 sprint')).toBeDefined()
        expect(screen.getByText('Manually')).toBeDefined()
    })

    it('renders defer success message when isDeferSuccess=true', () => {
        render(<ViolationCard {...defaultMithrilProps({
            isDeferSuccess: true,
            deferSuccessMsg: 'Deferred. Will resurface in 1 day.',
        })} />)
        expect(screen.getByTestId('defer-success-node-c2test')).toBeDefined()
        expect(screen.getByText('Deferred. Will resurface in 1 day.')).toBeDefined()
    })
})

// ── COUNSEL.2.2: AI-sourced "Review" badge ──────────────────────────────────

describe('COUNSEL.2.2 — AI-sourced Review badge', () => {
    it('renders indigo Review badge when isAiSourced=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isAiSourced: true })} />)
        expect(screen.getByTestId('review-badge-node-c2test')).toBeDefined()
        expect(screen.getByText('Review')).toBeDefined()
    })

    it('Review badge has indigo styling', () => {
        render(<ViolationCard {...defaultMithrilProps({ isAiSourced: true })} />)
        const badge = screen.getByTestId('review-badge-node-c2test')
        expect(badge.className).toContain('text-indigo-400')
        expect(badge.className).toContain('border-indigo-500')
    })

    it('hides Review badge when isFlagged=true (flag takes precedence)', () => {
        render(<ViolationCard {...defaultMithrilProps({ isAiSourced: true, isFlagged: true })} />)
        expect(screen.queryByTestId('review-badge-node-c2test')).toBeNull()
        expect(screen.getByTestId('flagged-badge-node-c2test')).toBeDefined()
    })

    it('hides fixability badge when isAiSourced=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isAiSourced: true })} />)
        expect(screen.queryByTestId('badge-auto-fixable-node-c2test')).toBeNull()
    })

    it('does not render Review badge when isAiSourced=false', () => {
        render(<ViolationCard {...defaultMithrilProps({ isAiSourced: false })} />)
        expect(screen.queryByTestId('review-badge-node-c2test')).toBeNull()
    })
})

// ── COUNSEL.2.3: Resurfaced badge ───────────────────────────────────────────

describe('COUNSEL.2.3 — Resurfaced badge', () => {
    it('renders amber Resurfaced badge when isResurfaced=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isResurfaced: true })} />)
        expect(screen.getByTestId('resurfaced-badge-node-c2test')).toBeDefined()
        expect(screen.getByText('Resurfaced')).toBeDefined()
    })

    it('Resurfaced badge has amber styling', () => {
        render(<ViolationCard {...defaultMithrilProps({ isResurfaced: true })} />)
        const badge = screen.getByTestId('resurfaced-badge-node-c2test')
        expect(badge.className).toContain('text-amber-400')
        expect(badge.className).toContain('border-amber-500')
    })

    it('hides fixability badge when isResurfaced=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isResurfaced: true })} />)
        expect(screen.queryByTestId('badge-auto-fixable-node-c2test')).toBeNull()
    })

    it('does not render Resurfaced badge when isResurfaced=false', () => {
        render(<ViolationCard {...defaultMithrilProps({ isResurfaced: false })} />)
        expect(screen.queryByTestId('resurfaced-badge-node-c2test')).toBeNull()
    })

    it('Resurfaced badge takes precedence over Flagged badge', () => {
        render(<ViolationCard {...defaultMithrilProps({ isResurfaced: true, isFlagged: true })} />)
        expect(screen.getByTestId('resurfaced-badge-node-c2test')).toBeDefined()
        expect(screen.queryByTestId('flagged-badge-node-c2test')).toBeNull()
    })
})

// ── COUNSEL.2.4: Effort estimate in BatchActionBar ──────────────────────────

describe('COUNSEL.2.4 — Effort estimate', () => {
    const defaultBatchProps = {
        acceptedCount: 0,
        autoFixableCount: 5,
        a11yFixableCount: 2,
        manualCount: 3,
        onApplyAccepted: noop,
        onAutoFixMithril: noop,
        onFixAllA11y: noop,
        onReviewManual: noop,
    }

    it('renders effort estimate text when provided', () => {
        render(<BatchActionBar {...defaultBatchProps} effortEstimate="Estimated effort: 5 auto-fixes (~25s) + 3 manual reviews (~6 min) = ~7 min total" />)
        expect(screen.getByTestId('effort-estimate')).toBeDefined()
        expect(screen.getByText(/Estimated effort/)).toBeDefined()
    })

    it('does not render effort estimate when empty string', () => {
        render(<BatchActionBar {...defaultBatchProps} effortEstimate="" />)
        expect(screen.queryByTestId('effort-estimate')).toBeNull()
    })

    it('does not render effort estimate when undefined', () => {
        render(<BatchActionBar {...defaultBatchProps} />)
        expect(screen.queryByTestId('effort-estimate')).toBeNull()
    })

    it('hides effort estimate when all fixes are complete', () => {
        render(<BatchActionBar
            {...defaultBatchProps}
            effortEstimate="Estimated effort: 5 auto-fixes (~25s)"
            sessionProgress={{ fixed: 10, total: 10 }}
        />)
        expect(screen.queryByTestId('effort-estimate')).toBeNull()
    })
})

// ── COUNSEL.2.5: Session progress bar and celebration ───���───────────────────

describe('COUNSEL.2.5 — Session progress bar and celebration', () => {
    const defaultBatchProps = {
        acceptedCount: 0,
        autoFixableCount: 3,
        a11yFixableCount: 0,
        manualCount: 0,
        onApplyAccepted: noop,
        onAutoFixMithril: noop,
        onFixAllA11y: noop,
        onReviewManual: noop,
    }

    it('renders progress bar when session progress is available', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 5, total: 15 }} />)
        expect(screen.getByTestId('session-progress-bar')).toBeDefined()
    })

    it('progress bar has correct ARIA attributes', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 8, total: 15 }} />)
        const bar = screen.getByTestId('session-progress-bar')
        expect(bar.getAttribute('role')).toBe('progressbar')
        expect(bar.getAttribute('aria-valuenow')).toBe('8')
        expect(bar.getAttribute('aria-valuemax')).toBe('15')
    })

    it('renders session progress text with correct count', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 8, total: 15 }} />)
        expect(screen.getByTestId('session-progress-indicator')).toBeDefined()
        expect(screen.getByText('Fixed 8 of 15 this session')).toBeDefined()
    })

    it('shows celebration state when all violations are fixed', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 15, total: 15 }} />)
        expect(screen.getByTestId('session-all-fixed')).toBeDefined()
        expect(screen.getByText('All clear! Zero violations.')).toBeDefined()
    })

    it('hides progress bar when all violations are fixed', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 15, total: 15 }} />)
        expect(screen.queryByTestId('session-progress-bar')).toBeNull()
    })

    it('hides progress indicator text when all violations are fixed', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 15, total: 15 }} />)
        expect(screen.queryByTestId('session-progress-indicator')).toBeNull()
    })

    it('does not render progress bar when total is 0', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 0, total: 0 }} />)
        expect(screen.queryByTestId('session-progress-bar')).toBeNull()
    })

    it('does not render progress bar when sessionProgress is undefined', () => {
        render(<BatchActionBar {...defaultBatchProps} />)
        expect(screen.queryByTestId('session-progress-bar')).toBeNull()
    })

    it('progress bar width is proportional to fixed/total', () => {
        render(<BatchActionBar {...defaultBatchProps} sessionProgress={{ fixed: 5, total: 10 }} />)
        const bar = screen.getByTestId('session-progress-bar')
        const inner = bar.querySelector('div')
        expect(inner?.style.width).toBe('50%')
    })
})
