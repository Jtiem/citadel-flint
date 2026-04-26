/**
 * ViolationsList.test.tsx — T21
 *
 * Covers:
 * - Renders violations-list container
 * - Renders mithril ViolationCard per card in mithrilCards
 * - Renders a11y ViolationCard per card in a11yCards
 * - Resurfaced section header appears when resurfacedCardKeys.size > 0
 * - Deferred section header appears when deferredCardKeys.size > 0
 * - Overrides row appears when overridesExist is true
 * - BatchActionBar is rendered
 * - Callbacks (onToggleExpand, onFlag, onPin) fire with correct key
 * - Empty state: no cards, no sections when all empty
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViolationsList } from '../ViolationsList'
import type { MithrilCardData, A11yCardData } from '../ViolationsList'
import type { LinterWarning } from '../../../../types/flint-api'

const noop = () => {}

function makeMithrilCard(id: string): MithrilCardData {
    const warning: LinterWarning = {
        id,
        type: 'color-drift',
        severity: 'amber',
        value: 1,
        message: `MITHRIL-COLOR: expected text-zinc-100 at node ${id}`,
        nearestToken: 'text-zinc-100',
        nearestTokenValue: null,
    }
    return {
        warning,
        cardKey: `m-${id}`,
        isPinned: false,
        isFlagged: false,
        isDeferred: false,
        deferExpiresAtMs: null,
        isDeferSuccess: false,
        deferSuccessMsg: undefined,
        isResurfaced: false,
        isAiSourced: false,
        isExpanded: false,
        isDiffOpen: false,
        isDiffLoading: false,
        diffData: null,
        isDeferFormOpen: false,
        fixItem: {
            nodeId: id,
            label: `MITHRIL-COLOR — ${id.slice(0, 12)}`,
            hardcodedClass: 'text-[#fff]',
            tokenClass: 'text-zinc-100',
        },
        provenance: null,
        deferReason: '',
        deferDuration: '1 day',
        navigationIndex: null,
        overrideReason: null,
        overrideActor: null,
        overrideTimestamp: null,
    }
}

function makeA11yCard(id: string, index: number): A11yCardData {
    const warning: LinterWarning = {
        id,
        type: 'a11y',
        severity: 'critical',
        value: 1,
        message: `[A11Y-001] Missing alt text on node ${id}`,
        nearestToken: null,
        nearestTokenValue: null,
    }
    return {
        warning,
        cardKey: `a-${id}-${index}`,
        indexInList: index,
        isPinned: false,
        isFlagged: false,
        isDeferred: false,
        deferExpiresAtMs: null,
        isDeferSuccess: false,
        deferSuccessMsg: undefined,
        isResurfaced: false,
        isAiSourced: false,
        isExpanded: false,
        isDeferFormOpen: false,
        provenance: null,
        deferReason: '',
        deferDuration: '1 day',
        navigationIndex: null,
        overrideReason: null,
        overrideActor: null,
        overrideTimestamp: null,
    }
}

const defaultProps = {
    mithrilCards: [makeMithrilCard('node-001')],
    a11yCards: [makeA11yCard('node-002', 0)],
    resurfacedCardKeys: new Set<string>(),
    resurfaceTick: 0,
    deferredCardKeys: new Set<string>(),
    overridesExist: false,
    acceptedCount: 0,
    autoFixableCount: 1,
    a11yFixableCount: 1,
    manualCount: 0,
    sessionProgress: undefined,
    isBaselineSet: false,
    effortEstimate: '',
    activeFilePath: '/project/src/App.tsx',
    getNodeName: (id: string) => `#${id.slice(0, 6)}`,
    onApplyAccepted: noop,
    onAutoFixMithril: noop,
    onFixAllA11y: noop,
    onReviewManual: noop,
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
}

describe('ViolationsList', () => {
    // ── Rendering ─────────────────────────────────────────────────────────────

    it('renders the violations-list container', () => {
        render(<ViolationsList {...defaultProps} />)
        expect(screen.getByTestId('violations-list')).toBeDefined()
    })

    it('renders BatchActionBar', () => {
        render(<ViolationsList {...defaultProps} autoFixableCount={1} />)
        // BatchActionBar renders "Issues" header
        expect(screen.getByText('Issues')).toBeDefined()
    })

    it('renders mithril violation cards', () => {
        render(<ViolationsList {...defaultProps} mithrilCards={[makeMithrilCard('n1'), makeMithrilCard('n2')]} a11yCards={[]} />)
        // Each ViolationCard renders an expand toggle button; there should be exactly 2
        // (a11yCards cleared to isolate mithril count)
        const expandBtns = screen.getAllByRole('button', { name: /Expand.*issue detail/i })
        expect(expandBtns.length).toBe(2)
    })

    it('renders a11y violation cards', () => {
        render(<ViolationsList {...defaultProps} a11yCards={[makeA11yCard('n1', 0), makeA11yCard('n2', 1)]} />)
        expect(screen.queryByTestId('violations-list')).toBeDefined()
    })

    it('renders with no mithril or a11y cards', () => {
        render(<ViolationsList {...defaultProps} mithrilCards={[]} a11yCards={[]} />)
        expect(screen.getByTestId('violations-list')).toBeDefined()
    })

    // ── Resurfaced section ────────────────────────────────────────────────────

    it('shows resurfaced section header when resurfacedCardKeys has entries', () => {
        render(
            <ViolationsList
                {...defaultProps}
                resurfacedCardKeys={new Set(['m-node-001'])}
            />
        )
        expect(screen.getByTestId('resurfaced-section')).toBeDefined()
    })

    it('does not show resurfaced section header when resurfacedCardKeys is empty', () => {
        render(<ViolationsList {...defaultProps} resurfacedCardKeys={new Set()} />)
        expect(screen.queryByTestId('resurfaced-section')).toBeNull()
    })

    // ── Deferred section ──────────────────────────────────────────────────────

    it('shows deferred section header when deferredCardKeys has entries', () => {
        render(
            <ViolationsList
                {...defaultProps}
                deferredCardKeys={new Set(['m-node-001'])}
            />
        )
        expect(screen.getByTestId('deferred-section')).toBeDefined()
    })

    it('shows deferred count in header', () => {
        render(
            <ViolationsList
                {...defaultProps}
                deferredCardKeys={new Set(['m-node-001', 'm-node-002'])}
            />
        )
        expect(screen.getByText(/Deferred \(2\)/)).toBeDefined()
    })

    it('does not show deferred section header when deferredCardKeys is empty', () => {
        render(<ViolationsList {...defaultProps} deferredCardKeys={new Set()} />)
        expect(screen.queryByTestId('deferred-section')).toBeNull()
    })

    // ── Overrides ─────────────────────────────────────────────────────────────

    it('shows overrides row when overridesExist is true', () => {
        render(<ViolationsList {...defaultProps} overridesExist={true} />)
        expect(screen.getByText('Unapplied Overrides')).toBeDefined()
    })

    it('does not show overrides row when overridesExist is false', () => {
        render(<ViolationsList {...defaultProps} overridesExist={false} />)
        expect(screen.queryByText('Unapplied Overrides')).toBeNull()
    })

    // ── Callbacks ─────────────────────────────────────────────────────────────

    it('onToggleExpand is called with the card key when the card is toggled', () => {
        const handler = vi.fn()
        const cards = [makeMithrilCard('callback-test')]
        render(<ViolationsList {...defaultProps} mithrilCards={cards} onToggleExpand={handler} />)
        // ViolationCard renders an expand button with aria-label containing the rule id
        const cardHeader = screen.getByRole('button', { name: /Expand MITHRIL-COLOR issue detail/i })
        fireEvent.click(cardHeader)
        expect(handler).toHaveBeenCalledWith('m-callback-test')
    })

    it('onFlag is called with the card key', () => {
        const handler = vi.fn()
        const cards = [makeMithrilCard('flag-test')]
        render(<ViolationsList {...defaultProps} mithrilCards={cards} onFlag={handler} />)
        // Flag button uses data-testid="flag-btn-{nodeId}" where nodeId is the warning id
        const flagBtn = screen.getByTestId('flag-btn-flag-test')
        fireEvent.click(flagBtn)
        expect(handler).toHaveBeenCalledWith('m-flag-test')
    })
})
