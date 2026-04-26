/**
 * ViolationCard.test.tsx — Sprint 3A sub-component tests
 *
 * Covers:
 * - Renders ruleId and truncated message
 * - Auto-fixable badge for Mithril with nearestToken
 * - Needs-input badge for Mithril without nearestToken and for a11y
 * - Flagged badge when isFlagged=true
 * - Hover-reveal secondary triage actions use group-hover opacity pattern
 * - Risk trend badges (rising/falling)
 * - Provenance chip (human vs agent)
 * - Defer form renders when isDeferFormOpen=true
 * - Defer success message renders when isDeferSuccess=true
 * - Deferred badge shows when isDeferred=true
 * - Callbacks fire on interaction
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViolationCard } from '../ViolationCard'
import type { LinterWarning } from '../../../../types/flint-api'
import type { FixableItem } from '../../FixPreviewDrawer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMithrilWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-abc123',
        type: 'color-drift',
        severity: 'amber',
        value: 2.5,
        message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        nearestToken: 'text-indigo-500',
        nearestTokenValue: '#6366f1',
        ...overrides,
    }
}

function makeA11yWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-def456',
        type: 'a11y',
        severity: 'critical',
        value: 1,
        // A11Y-010 is in A11Y_NOT_AUTO_FIXABLE — needs manual fix
        message: 'A11Y-010: Heading levels are skipped',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

const noop = () => {}

function makeFixItem(): FixableItem {
    return {
        nodeId: 'node-abc123',
        label: 'MITHRIL-COL-001 — node-abc123',
        hardcodedClass: 'text-[#3b82f6]',
        tokenClass: 'text-indigo-500',
    }
}

function defaultMithrilProps(overrides = {}) {
    return {
        issue: makeMithrilWarning(),
        type: 'mithril' as const,
        cardKey: 'm-node-abc123',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViolationCard — Mithril type', () => {
    it('renders the rule ID from the message', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        // The human label is displayed; raw rule ID is in the title attribute
        expect(screen.getByTitle('MITHRIL-COL-001')).toBeDefined()
    })

    it('renders the message with the rule ID prefix stripped', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        // The message paragraph strips the rule ID prefix — find it by its full title
        const msgEl = screen.getByTitle("MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set")
        expect(msgEl.textContent).toContain("arbitrary '#3b82f6'")
    })

    it('renders Auto-fixable badge when fixItem is present', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        expect(screen.getByTestId('badge-auto-fixable-node-abc123')).toBeDefined()
    })

    it('renders Needs input badge when fixItem is null', () => {
        render(<ViolationCard {...defaultMithrilProps({ fixItem: null })} />)
        expect(screen.getByTestId('badge-needs-input-node-abc123')).toBeDefined()
    })

    it('renders Flagged for Review badge when isFlagged=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isFlagged: true })} />)
        expect(screen.getByTestId('flagged-badge-node-abc123')).toBeDefined()
        expect(screen.getByText('Flagged for Review')).toBeDefined()
    })

    it('hides fixability badge when isFlagged=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isFlagged: true })} />)
        expect(screen.queryByTestId('badge-auto-fixable-node-abc123')).toBeNull()
        expect(screen.queryByTestId('badge-needs-input-node-abc123')).toBeNull()
    })

    it('calls onToggleExpand when expand button is clicked', () => {
        const handler = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({ onToggleExpand: handler })} />)
        // click the expand button (the full-width toggle)
        const expandBtn = screen.getByRole('button', { name: /Expand MITHRIL-COL-001 issue detail/ })
        fireEvent.click(expandBtn)
        expect(handler).toHaveBeenCalledOnce()
    })

    it('has aria-expanded=false when isExpanded=false', () => {
        render(<ViolationCard {...defaultMithrilProps({ isExpanded: false })} />)
        const btn = screen.getByRole('button', { name: /Expand MITHRIL-COL-001 issue detail/ })
        expect(btn.getAttribute('aria-expanded')).toBe('false')
    })

    it('has aria-expanded=true when isExpanded=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isExpanded: true })} />)
        const btn = screen.getByRole('button', { name: /Collapse MITHRIL-COL-001 issue detail/ })
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('renders rising risk trend badge', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ riskTrend: 'rising' }) })} />)
        expect(screen.getByTestId('risk-trend-rising-node-abc123')).toBeDefined()
    })

    it('renders falling risk trend badge', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ riskTrend: 'falling' }) })} />)
        expect(screen.getByTestId('risk-trend-falling-node-abc123')).toBeDefined()
    })

    it('does not render trend badges when riskTrend is undefined', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        expect(screen.queryByTestId('risk-trend-rising-node-abc123')).toBeNull()
        expect(screen.queryByTestId('risk-trend-falling-node-abc123')).toBeNull()
    })

    it('renders provenance chip when provenance.source is human', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'human', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByTestId('provenance-chip-node-abc123')).toBeDefined()
        expect(screen.getByText(/via manual edit/)).toBeDefined()
    })

    it('renders provenance chip with agent name when source is agent', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'agent', agentId: 'claude-3', timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via claude-3/)).toBeDefined()
    })

    it('does not render provenance chip when provenance is null', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: null })} />)
        expect(screen.queryByTestId('provenance-chip-node-abc123')).toBeNull()
    })

    it('renders deferred badge when isDeferred=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferred: true })} />)
        expect(screen.getByTestId('deferred-badge-node-abc123')).toBeDefined()
    })

    it('renders defer success message when isDeferSuccess=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferSuccess: true, deferSuccessMsg: 'Deferred for 1 day.' })} />)
        expect(screen.getByTestId('defer-success-node-abc123')).toBeDefined()
        expect(screen.getByText('Deferred for 1 day.')).toBeDefined()
    })

    it('renders defer form when isDeferFormOpen=true', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferFormOpen: true })} />)
        expect(screen.getByTestId('defer-form-node-abc123')).toBeDefined()
    })

    it('calls onSubmitDefer when Defer issue button is clicked in form', () => {
        const handler = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({ isDeferFormOpen: true, onSubmitDefer: handler })} />)
        fireEvent.click(screen.getByTestId('defer-submit-node-abc123'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('calls onCancelDefer when Cancel is clicked in defer form', () => {
        const handler = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({ isDeferFormOpen: true, onCancelDefer: handler })} />)
        fireEvent.click(screen.getByTestId('defer-cancel-node-abc123'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('secondary triage div has group-hover opacity-0 class for hover-reveal UX', () => {
        const { container } = render(<ViolationCard {...defaultMithrilProps()} />)
        // The triage div should have the group-hover opacity pattern
        const triageDiv = container.querySelector('[class*="group-hover:opacity-100"]')
        expect(triageDiv).not.toBeNull()
    })

    it('the outer card div has the group class for hover-reveal to work', () => {
        const { container } = render(<ViolationCard {...defaultMithrilProps()} />)
        const outerDiv = container.firstElementChild
        expect(outerDiv?.className).toContain('group')
    })
})

describe('ViolationCard — a11y type', () => {
    function defaultA11yProps(overrides = {}) {
        return {
            issue: makeA11yWarning(),
            type: 'a11y' as const,
            cardKey: 'a-node-def456-0',
            indexInList: 0,
            isPinned: false,
            isFlagged: false,
            isDeferred: false,
            deferExpiresAtMs: null,
            isDeferSuccess: false,
            isExpanded: false,
            isDiffOpen: false,
            isDiffLoading: false,
            diffData: null,
            isDeferFormOpen: false,
            fixItem: null,
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
            getNodeName: (id: string) => `<img #${id.slice(0, 6)}>`,
            activeFilePath: '/src/App.tsx',
            ...overrides,
        }
    }

    it('renders the a11y rule ID', () => {
        render(<ViolationCard {...defaultA11yProps()} />)
        // The human label is displayed; raw rule ID is in the title attribute
        expect(screen.getByTitle('A11Y-010')).toBeDefined()
    })

    it('renders Needs input badge for a11y violations', () => {
        render(<ViolationCard {...defaultA11yProps()} />)
        expect(screen.getByTestId('badge-needs-input-a11y-node-def456')).toBeDefined()
    })

    it('renders expand button in collapsed state (no footer hint text)', () => {
        render(<ViolationCard {...defaultA11yProps()} />)
        // Footer hint text was removed for progressive disclosure — just the expand toggle remains
        const expandBtn = document.querySelector('button[aria-controls]') as HTMLElement | null
        expect(expandBtn).not.toBeNull()
        expect(expandBtn!.getAttribute('aria-expanded')).toBe('false')
    })

    it('expand button shows aria-expanded true when card is expanded', () => {
        render(<ViolationCard {...defaultA11yProps({ isExpanded: true })} />)
        const expandBtn = document.querySelector('button[aria-controls]') as HTMLElement | null
        expect(expandBtn).not.toBeNull()
        expect(expandBtn!.getAttribute('aria-expanded')).toBe('true')
    })

    it('renders flagged badge with a11y prefix in testid when isFlagged=true', () => {
        render(<ViolationCard {...defaultA11yProps({ isFlagged: true })} />)
        expect(screen.getByTestId('flagged-badge-a11y-node-def456')).toBeDefined()
    })

    it('renders deferred badge for a11y when isDeferred=true', () => {
        render(<ViolationCard {...defaultA11yProps({ isDeferred: true })} />)
        expect(screen.getByTestId('deferred-badge-a11y-node-def456')).toBeDefined()
    })
})

// ── COUNSEL.3.2: Provenance chip "via" text format ──────────────────────────

describe('COUNSEL.3.2 — Provenance chip text format', () => {
    it('renders "via manual edit" for human provenance', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'human', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via manual edit/)).toBeDefined()
    })

    it('renders "via auto-fix" for auto-fix provenance', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'auto-fix', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via auto-fix/)).toBeDefined()
    })

    it('renders "via auto-fix" for auto_fix provenance (underscore variant)', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'auto_fix', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via auto-fix/)).toBeDefined()
    })

    it('renders "via auto-fix" for auto-heal provenance', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'auto-heal', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via auto-fix/)).toBeDefined()
    })

    it('renders "via import" for import provenance', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'import', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via import/)).toBeDefined()
    })

    it('renders "via [agentId]" when agent provenance has an agentId', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'agent', agentId: 'claude-3', timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via claude-3/)).toBeDefined()
    })

    it('renders "via AI orchestrator" when agent provenance has no agentId', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'ai_orchestrator', agentId: null, timestamp: '2024-01-01' } })} />)
        expect(screen.getByText(/via AI orchestrator/)).toBeDefined()
    })

    it('provenance chip has aria-label with source', () => {
        render(<ViolationCard {...defaultMithrilProps({ provenance: { source: 'human', agentId: null, timestamp: '2024-01-01' } })} />)
        const chip = screen.getByTestId('provenance-chip-node-abc123')
        expect(chip.getAttribute('aria-label')).toContain('Source: manual edit')
    })

    it('renders provenance chip for a11y cards', () => {
        const a11yProps = {
            issue: makeA11yWarning(),
            type: 'a11y' as const,
            cardKey: 'a-node-def456-0',
            indexInList: 0,
            isPinned: false,
            isFlagged: false,
            isDeferred: false,
            deferExpiresAtMs: null,
            isDeferSuccess: false,
            isExpanded: false,
            isDiffOpen: false,
            isDiffLoading: false,
            diffData: null,
            isDeferFormOpen: false,
            fixItem: null,
            provenance: { source: 'human', agentId: null, timestamp: '2024-01-01' },
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
        }
        render(<ViolationCard {...(a11yProps as unknown as Parameters<typeof ViolationCard>[0])} />)
        expect(screen.getByTestId('provenance-chip-a11y-node-def456')).toBeDefined()
    })
})

// ── CHRON.1-repair M3: OverrideReasonDialog wiring ─────────────────────────

describe('CHRON.1-repair M3 — Override button + OverrideReasonDialog wiring', () => {
    it('does NOT render the Override button when onOverride is not provided', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        expect(screen.queryByTestId('override-btn-node-abc123')).toBeNull()
    })

    it('renders the Override button when onOverride is provided (mithril)', () => {
        render(<ViolationCard {...defaultMithrilProps({ onOverride: vi.fn() })} />)
        expect(screen.getByTestId('override-btn-node-abc123')).toBeDefined()
    })

    it('does not call onOverride when the Override button is clicked — opens dialog instead', () => {
        const onOverride = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({ onOverride })} />)
        fireEvent.click(screen.getByTestId('override-btn-node-abc123'))
        expect(onOverride).not.toHaveBeenCalled()
        // Dialog is now open
        expect(screen.getByTestId('override-reason-dialog')).toBeDefined()
    })

    it('closes the dialog and fires onOverride with the reason when confirmed (Amber tier)', async () => {
        const onOverride = vi.fn()
        // severity='amber' → Amber tier dialog
        render(<ViolationCard {...defaultMithrilProps({
            onOverride,
            issue: makeMithrilWarning({ severity: 'amber' }),
        })} />)
        fireEvent.click(screen.getByTestId('override-btn-node-abc123'))
        const textarea = screen.getByTestId('override-reason-textarea') as HTMLTextAreaElement
        fireEvent.change(textarea, { target: { value: 'Acknowledged by design lead' } })
        fireEvent.click(screen.getByTestId('override-with-reason-btn'))
        expect(onOverride).toHaveBeenCalledWith('Acknowledged by design lead')
        // Dialog unmounts after MUI's close transition (~225ms). Poll briefly.
        await vi.waitFor(() => {
            expect(screen.queryByTestId('override-reason-dialog')).toBeNull()
        }, { timeout: 2000 })
    })

    it('fires onOverride with undefined when user waives reason on Amber tier', () => {
        const onOverride = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({
            onOverride,
            issue: makeMithrilWarning({ severity: 'amber' }),
        })} />)
        fireEvent.click(screen.getByTestId('override-btn-node-abc123'))
        fireEvent.click(screen.getByTestId('override-without-reason-btn'))
        expect(onOverride).toHaveBeenCalledWith(undefined)
    })

    it('requires a reason on Red tier (critical severity)', () => {
        const onOverride = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({
            onOverride,
            issue: makeMithrilWarning({ severity: 'critical' }),
        })} />)
        fireEvent.click(screen.getByTestId('override-btn-node-abc123'))
        // submit disabled when empty
        const btn = screen.getByTestId('override-submit-btn') as HTMLButtonElement
        expect(btn.disabled).toBe(true)
        // type >= 10 chars
        fireEvent.change(screen.getByTestId('override-reason-textarea'), { target: { value: 'A real concrete reason' } })
        fireEvent.click(screen.getByTestId('override-submit-btn'))
        expect(onOverride).toHaveBeenCalledWith('A real concrete reason')
    })

    it('dialog cancel does not fire onOverride', () => {
        const onOverride = vi.fn()
        render(<ViolationCard {...defaultMithrilProps({ onOverride })} />)
        fireEvent.click(screen.getByTestId('override-btn-node-abc123'))
        expect(screen.getByTestId('override-reason-dialog')).toBeDefined()
        fireEvent.click(screen.getByTestId('override-cancel-btn'))
        expect(onOverride).not.toHaveBeenCalled()
    })

    it('renders Override button on a11y cards when onOverride is provided', () => {
        const onOverride = vi.fn()
        // a11y cards use the a11y-suffixed testid
        const a11yProps = {
            issue: makeA11yWarning(),
            type: 'a11y' as const,
            cardKey: 'a-node-def456-0',
            indexInList: 0,
            isPinned: false,
            isFlagged: false,
            isDeferred: false,
            deferExpiresAtMs: null,
            isDeferSuccess: false,
            isExpanded: false,
            isDiffOpen: false,
            isDiffLoading: false,
            diffData: null,
            isDeferFormOpen: false,
            fixItem: null,
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
            onOverride,
            getNodeName: (id: string) => `<img #${id.slice(0, 6)}>`,
            activeFilePath: '/src/App.tsx',
        }
        render(<ViolationCard {...a11yProps} />)
        expect(screen.getByTestId('override-btn-a11y-node-def456')).toBeDefined()
    })

    it('hides Override button when the card is flagged', () => {
        render(<ViolationCard {...defaultMithrilProps({ isFlagged: true, onOverride: vi.fn() })} />)
        expect(screen.queryByTestId('override-btn-node-abc123')).toBeNull()
    })

    it('hides Override button when the card is deferred', () => {
        render(<ViolationCard {...defaultMithrilProps({ isDeferred: true, onOverride: vi.fn() })} />)
        expect(screen.queryByTestId('override-btn-node-abc123')).toBeNull()
    })
})

// ── COUNSEL.3.4: MRS risk score badge ───────────────────────────────────────

describe('COUNSEL.3.4 — MRS risk score badge', () => {
    it('renders green MRS badge for low risk (0-30)', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 15 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge).toBeDefined()
        expect(badge.textContent).toContain('MRS 15')
        expect(badge.className).toContain('text-emerald-400')
    })

    it('renders amber MRS badge for medium risk (31-60)', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 42 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge).toBeDefined()
        expect(badge.textContent).toContain('MRS 42')
        expect(badge.className).toContain('text-amber-400')
    })

    it('renders red MRS badge for high risk (61-100)', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 85 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge).toBeDefined()
        expect(badge.textContent).toContain('MRS 85')
        expect(badge.className).toContain('text-red-400')
    })

    it('renders green MRS badge at boundary (score=30)', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 30 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge.className).toContain('text-emerald-400')
    })

    it('renders amber MRS badge at boundary (score=60)', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 60 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge.className).toContain('text-amber-400')
    })

    it('renders red MRS badge at boundary (score=61)', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 61 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge.className).toContain('text-red-400')
    })

    it('does not render MRS badge when mrsScore is undefined', () => {
        render(<ViolationCard {...defaultMithrilProps()} />)
        expect(screen.queryByTestId('mrs-badge-node-abc123')).toBeNull()
    })

    it('does not render MRS badge when mrsScore is null', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: null }) })} />)
        expect(screen.queryByTestId('mrs-badge-node-abc123')).toBeNull()
    })

    it('MRS badge has aria-label with risk level', () => {
        render(<ViolationCard {...defaultMithrilProps({ issue: makeMithrilWarning({ mrsScore: 42 }) })} />)
        const badge = screen.getByTestId('mrs-badge-node-abc123')
        expect(badge.getAttribute('aria-label')).toContain('medium risk')
    })

    it('renders MRS badge on a11y cards', () => {
        const a11yWarning = makeA11yWarning({ mrsScore: 75 })
        const a11yProps = {
            issue: a11yWarning,
            type: 'a11y' as const,
            cardKey: 'a-node-def456-0',
            indexInList: 0,
            isPinned: false,
            isFlagged: false,
            isDeferred: false,
            deferExpiresAtMs: null,
            isDeferSuccess: false,
            isExpanded: false,
            isDiffOpen: false,
            isDiffLoading: false,
            diffData: null,
            isDeferFormOpen: false,
            fixItem: null,
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
        }
        render(<ViolationCard {...a11yProps} />)
        expect(screen.getByTestId('mrs-badge-a11y-node-def456')).toBeDefined()
        expect(screen.getByTestId('mrs-badge-a11y-node-def456').textContent).toContain('MRS 75')
    })
})
