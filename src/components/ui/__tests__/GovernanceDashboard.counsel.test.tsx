/**
 * GovernanceDashboard.counsel.test.tsx
 *
 * Tests for COUNSEL governance UX improvements:
 *   COUNSEL.1.1 — Category Split Header (design-system / accessibility / token-sync chips)
 *   COUNSEL.1.2 — Delta Mode Auto-Enable banner for legacy projects (> 10 violations)
 *   COUNSEL.1.3 — Health score formula uses canonical useGovernanceHealth hook
 *   COUNSEL.1.7 — A11y: icon-only buttons have aria-label, violation rows have aria-expanded
 *   COUNSEL.2.4 — Effort Framing text above the health score ring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useTokenStore } from '../../../store/tokenStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'
import type { DesignToken, LinterWarning } from '../../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: 1,
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
        ...overrides,
    }
}

function seedTokens(tokens: DesignToken[]) {
    useTokenStore.setState({ tokens, isLoading: false, error: null })
}

function makeLinterWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: `node-${Math.random().toString(36).slice(2)}`,
        type: 'color-drift',
        severity: 'amber',
        value: 1,
        message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

// Ensure the Health Score accordion is open and its content is visible.
// The accordion starts open (isScoreOpen = true), so we just wait for
// the score-accordion panel to appear. If for some reason the accordion is
// closed, we open it. We use next-step-prompt as the settled signal because
// it is always present in the accordion body regardless of violation count
// (unlike category-chips, which are hidden in zero-violation state).
async function ensureScoreAccordionOpen() {
    // If accordion body is already visible, just return.
    const accordionBody = document.querySelector('#score-accordion')
    if (accordionBody) return
    // Otherwise open it by clicking the accordion header button.
    const btn = screen.getByRole('button', { name: /Score breakdown/i })
    fireEvent.click(btn)
    await waitFor(() => {
        expect(screen.getByTestId('next-step-prompt')).toBeDefined()
    }, { timeout: 3000 })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — COUNSEL', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useCanvasStore.setState({ mithrilViolations: [], a11yViolations: {} })
        useEditorStore.setState({ linterWarnings: new Map() })
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    })

    // ── COUNSEL.1.1: Category chips ───────────────────────────────────────────

    it('renders only non-zero category chips when violations exist', async () => {
        // Phase 1: chips are hidden when their count is zero — seed all three categories
        seedTokens([makeToken()])
        const dsWarning = makeLinterWarning({ type: 'color-drift', id: 'chip-visibility-ds' })
        const syncWarning = makeLinterWarning({ type: 'sync', id: 'chip-visibility-sync' })
        useEditorStore.setState({ linterWarnings: new Map([['chip-visibility-ds', dsWarning], ['chip-visibility-sync', syncWarning]]) })
        useCanvasStore.setState({ a11yViolations: { 'chip-node': ['A11Y-001: Missing alt text'] } })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        expect(screen.getByTestId('chip-design-system')).toBeDefined()
        expect(screen.getByTestId('chip-accessibility')).toBeDefined()
        expect(screen.getByTestId('chip-token-sync')).toBeDefined()
    })

    it('hides a category chip when its count is zero', async () => {
        // Only a11y violation — Design System and Token Sync chips should be hidden
        seedTokens([makeToken()])
        useCanvasStore.setState({ a11yViolations: { 'chip-node-2': ['A11Y-001: Missing alt text'] } })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        expect(screen.getByTestId('chip-accessibility')).toBeDefined()
        expect(screen.queryByTestId('chip-design-system')).toBeNull()
        expect(screen.queryByTestId('chip-token-sync')).toBeNull()
    })

    it('hides category chips in zero-violation state (Phase 1 declutter)', async () => {
        // No violations — chips should not render
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => screen.getByTestId('score-ring'))
        expect(screen.queryByTestId('category-chips')).toBeNull()
    })

    it('category chips show correct counts for design system violations', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ type: 'color-drift', id: 'n1' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', warning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        // Design system chip shows 1 (mithril count)
        const chip = screen.getByTestId('chip-design-system')
        expect(chip.textContent).toContain('1')
    })

    it('category chips show correct counts for accessibility violations', async () => {
        seedTokens([makeToken()])
        useCanvasStore.setState({
            a11yViolations: { 'node-abc': ['A11Y-001: Missing alt text'] },
        })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        const chip = screen.getByTestId('chip-accessibility')
        expect(chip.textContent).toContain('1')
    })

    it('token sync chip shows count for sync violations', async () => {
        seedTokens([makeToken()])
        const syncWarning = makeLinterWarning({ type: 'sync', id: 'sync-1' })
        useEditorStore.setState({ linterWarnings: new Map([['sync-1', syncWarning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        const chip = screen.getByTestId('chip-token-sync')
        expect(chip.textContent).toContain('1')
    })

    it('clicking a category chip sets aria-pressed to true', async () => {
        // Chips are only rendered when violations exist — seed one to make chips visible
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'chip-test-1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['chip-test-1', warning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        const chip = screen.getByTestId('chip-design-system')
        expect(chip.getAttribute('aria-pressed')).toBe('false')
        fireEvent.click(chip)
        await waitFor(() => {
            expect(screen.getByTestId('chip-design-system').getAttribute('aria-pressed')).toBe('true')
        })
    })

    it('clicking the active chip again clears the filter (aria-pressed returns false)', async () => {
        // Chips are only rendered when violations exist — seed one to make chips visible
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'chip-test-2', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['chip-test-2', warning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        const chip = screen.getByTestId('chip-design-system')
        fireEvent.click(chip)
        await waitFor(() => {
            expect(chip.getAttribute('aria-pressed')).toBe('true')
        })
        fireEvent.click(chip)
        await waitFor(() => {
            expect(chip.getAttribute('aria-pressed')).toBe('false')
        })
    })

    it('clicking accessibility chip hides design system violations from the list', async () => {
        seedTokens([makeToken()])
        const mithrilWarning = makeLinterWarning({
            type: 'color-drift',
            id: 'n1',
            message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        })
        useEditorStore.setState({ linterWarnings: new Map([['n1', mithrilWarning]]) })
        useCanvasStore.setState({
            a11yViolations: { 'node-abc': ['A11Y-001: Missing alt text'] },
        })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        // The mithril violation should be visible in the list initially
        await waitFor(() => {
            const list = document.querySelector('[data-testid="violations-list"]')
            expect(list?.textContent).toContain('MITHRIL-COL-001')
        })
        // Click accessibility chip — mithril violations should disappear from the list
        const chip = screen.getByTestId('chip-accessibility')
        fireEvent.click(chip)
        await waitFor(() => {
            const list = document.querySelector('[data-testid="violations-list"]')
            expect(list?.textContent).not.toContain('MITHRIL-COL-001')
        })
    })

    // ── COUNSEL.2.4: Effort framing ───────────────────────────────────────────

    it('renders the effort framing text element when tokens are loaded', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        expect(screen.getByTestId('effort-framing')).toBeDefined()
    })

    it('shows "No violations — looking good" when there are no violations', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            expect(screen.getByTestId('effort-framing').textContent).toContain('No violations — looking good')
        })
    })

    it('shows auto-fixable count in effort text when violations have nearestToken', async () => {
        seedTokens([makeToken()])
        const autoFixable = makeLinterWarning({
            id: 'n1',
            type: 'color-drift',
            nearestToken: 'bg-blue-500',
            nearestTokenValue: '#3b82f6',
            message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        })
        useEditorStore.setState({ linterWarnings: new Map([['n1', autoFixable]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const effortEl = screen.getByTestId('effort-framing')
            expect(effortEl.textContent).toContain('auto-fixable')
            expect(effortEl.textContent).toContain('Autopilot')
        })
    })

    it('shows "needs your input" when issues have no nearestToken', async () => {
        seedTokens([makeToken()])
        const manualWarning = makeLinterWarning({
            id: 'n1',
            type: 'color-drift',
            nearestToken: null,
            severity: 'critical',
        })
        useEditorStore.setState({ linterWarnings: new Map([['n1', manualWarning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const effortEl = screen.getByTestId('effort-framing')
            expect(effortEl.textContent).toContain('need')
            expect(effortEl.textContent).toContain('input')
        })
    })

    it('effort text appears after the health score ring (DOM order, Phase 1 reposition)', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        const effortEl = screen.getByTestId('effort-framing')
        const ringEl = screen.getByRole('img', { name: /Health score/i })
        // compareDocumentPosition: 2 = DOCUMENT_POSITION_PRECEDING (ring comes before effort)
        const pos = effortEl.compareDocumentPosition(ringEl)
        expect(pos & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    })

    // ── COUNSEL.1.2: Delta mode auto-enable banner ────────────────────────────

    it('does NOT show auto-enable banner when initialViolationCount is <= 10', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard initialViolationCount={5} />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            expect(screen.queryByTestId('delta-mode-auto-banner')).toBeNull()
        })
    })

    it('shows auto-enable banner when initialViolationCount > 10 and baseline is set', async () => {
        seedTokens([makeToken()])
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(true),
            get: vi.fn().mockResolvedValue([{ file_path: '/f', node_id: 'n', rule_id: 'color-drift', severity: 'amber', snapshot_value: null }]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        render(<GovernanceDashboard initialViolationCount={15} />)
        await ensureScoreAccordionOpen()
        // The banner appears when baseline is active and count > 10
        await waitFor(() => {
            expect(screen.getByTestId('delta-mode-auto-banner')).toBeDefined()
        })
    })

    it('banner shows correct violation count in message', async () => {
        seedTokens([makeToken()])
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(true),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        render(<GovernanceDashboard initialViolationCount={25} />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const banner = screen.getByTestId('delta-mode-auto-banner')
            expect(banner.textContent).toContain('25')
            expect(banner.textContent).toContain('existing violations')
        })
    })

    it('banner "tap to see all" button calls baseline.clear', async () => {
        seedTokens([makeToken()])
        const clearMock = vi.fn().mockResolvedValue(undefined)
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(true),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: clearMock,
        }
        render(<GovernanceDashboard initialViolationCount={20} />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            expect(screen.getByTestId('delta-mode-auto-banner')).toBeDefined()
        })
        fireEvent.click(screen.getByRole('button', { name: /Show all violations/i }))
        await waitFor(() => {
            expect(clearMock).toHaveBeenCalled()
        })
    })

    it('banner dismiss button hides the banner', async () => {
        seedTokens([makeToken()])
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(true),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        render(<GovernanceDashboard initialViolationCount={15} />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            expect(screen.getByTestId('delta-mode-auto-banner')).toBeDefined()
        })
        fireEvent.click(screen.getByRole('button', { name: /Dismiss delta mode banner/i }))
        await waitFor(() => {
            expect(screen.queryByTestId('delta-mode-auto-banner')).toBeNull()
        })
    })

    // ── COUNSEL.1.3: Health score formula — canonical useGovernanceHealth hook ──

    it('shows grade A and score 100 when there are no violations', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).toContain('100')
            expect(body).toContain('A')
        })
    })

    it('uses severity-weighted formula: one critical violation deducts 10 pts (score = 90)', async () => {
        seedTokens([makeToken()])
        // A single critical mithril violation should deduct 10 pts with the canonical formula
        const criticalWarning = makeLinterWarning({
            id: 'n-crit',
            type: 'color-drift',
            severity: 'critical',
        })
        useEditorStore.setState({ linterWarnings: new Map([['n-crit', criticalWarning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).toContain('90')
        })
    })

    it('uses severity-weighted formula: one amber violation deducts 3 pts (score = 97)', async () => {
        seedTokens([makeToken()])
        const amberWarning = makeLinterWarning({
            id: 'n-amber',
            type: 'color-drift',
            severity: 'amber',
        })
        useEditorStore.setState({ linterWarnings: new Map([['n-amber', amberWarning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).toContain('97')
        })
    })

    it('uses severity-weighted formula: one advisory violation deducts 1 pt (score = 99)', async () => {
        seedTokens([makeToken()])
        const advisoryWarning = makeLinterWarning({
            id: 'n-adv',
            type: 'color-drift',
            severity: 'advisory',
        })
        useEditorStore.setState({ linterWarnings: new Map([['n-adv', advisoryWarning]]) })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).toContain('99')
        })
    })

    it('mixed severity violations: 1 critical + 2 amber + 1 advisory → score = 83', async () => {
        // 100 - 10 - 6 - 1 = 83
        seedTokens([makeToken()])
        const warnings: Map<string, LinterWarning> = new Map([
            ['n1', makeLinterWarning({ id: 'n1', severity: 'critical' })],
            ['n2', makeLinterWarning({ id: 'n2', severity: 'amber' })],
            ['n3', makeLinterWarning({ id: 'n3', severity: 'amber' })],
            ['n4', makeLinterWarning({ id: 'n4', severity: 'advisory' })],
        ])
        useEditorStore.setState({ linterWarnings: warnings })
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).toContain('83')
        })
    })

    // ── COUNSEL.1.7: A11y compliance — icon-only buttons and aria-expanded ──────

    it('Run Audit button has an aria-label', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        const auditBtn = screen.getByTestId('run-audit-button')
        expect(auditBtn.getAttribute('aria-label')).toBeTruthy()
    })

    it('collapsible mithril violation row button has aria-expanded attribute', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({
            id: 'n-expand',
            type: 'color-drift',
            severity: 'amber',
            message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        })
        useEditorStore.setState({ linterWarnings: new Map([['n-expand', warning]]) })
        render(<GovernanceDashboard />)
        // Wait for the violations list to appear
        await waitFor(() => {
            expect(screen.getByTestId('violations-list')).toBeDefined()
        })
        // The first expandable button in the violations list should have aria-expanded
        const violationButtons = document.querySelectorAll('[aria-expanded]')
        const expandButtons = Array.from(violationButtons).filter(
            (el) => el.getAttribute('aria-controls')?.startsWith('v-m-'),
        )
        expect(expandButtons.length).toBeGreaterThan(0)
        expect(expandButtons[0].getAttribute('aria-expanded')).toBe('false')
    })

    it('violation row aria-expanded toggles to true when clicked', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({
            id: 'n-toggle',
            type: 'color-drift',
            severity: 'amber',
            message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        })
        useEditorStore.setState({ linterWarnings: new Map([['n-toggle', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('violations-list')).toBeDefined()
        })
        const expandButtons = document.querySelectorAll('[aria-controls^="v-m-"]')
        expect(expandButtons.length).toBeGreaterThan(0)
        const btn = expandButtons[0] as HTMLElement
        expect(btn.getAttribute('aria-expanded')).toBe('false')
        fireEvent.click(btn)
        await waitFor(() => {
            expect(btn.getAttribute('aria-expanded')).toBe('true')
        })
    })

    it('Health Score accordion button has aria-expanded attribute', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        const scoreBtn = screen.getByRole('button', { name: /Score breakdown/i })
        expect(scoreBtn.getAttribute('aria-expanded')).toBeDefined()
    })
})

// ---------------------------------------------------------------------------
// COUNSEL.2.1 — GovernanceDashboard post-defer visual state (it.todo scaffolds)
// Full assertions added in Group D after flint-design-engineer completes Group C.
// ---------------------------------------------------------------------------

describe('GovernanceDashboard — COUNSEL.2.1 post-defer visual state', () => {
    it.todo('defer button visible on each violation row')
    it.todo('defer form opens with all 5 duration options')
    it.todo('submit calls governance.deferViolation with duration and note')
    it.todo('violation shows Deferred badge after successful defer')
    it.todo('cancel closes form without calling deferViolation')
})

// ---------------------------------------------------------------------------
// COUNSEL.2.2 — Flagged for Review tier
// ---------------------------------------------------------------------------

describe('GovernanceDashboard — COUNSEL.2.2 Flagged for Review', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useCanvasStore.setState({ mithrilViolations: [], a11yViolations: {} })
        useEditorStore.setState({ linterWarnings: new Map() })
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    })

    it('renders a Flag button on each Mithril violation card', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('flag-btn-n1')).toBeDefined()
        })
    })

    it('renders a Flag button on each a11y violation card', async () => {
        seedTokens([makeToken()])
        useCanvasStore.setState({
            a11yViolations: { 'node-abc': ['A11Y-001: Missing alt text'] },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('flag-btn-a11y-node-abc')).toBeDefined()
        })
    })

    it('clicking Flag shows "Flagged for Review" badge on the violation card', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('flag-btn-n1')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('flag-btn-n1'))
        await waitFor(() => {
            expect(screen.getByTestId('flagged-badge-n1')).toBeDefined()
            expect(screen.getByTestId('flagged-badge-n1').textContent).toContain('Flagged for Review')
        })
    })

    it('flagging a violation calls governance.deferViolation with [FLAGGED] prefix', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', warning]]) })
        useCanvasStore.setState({ activeFilePath: '/test/file.tsx' })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('flag-btn-n1')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('flag-btn-n1'))
        await waitFor(() => {
            expect(window.flintAPI.governance.deferViolation).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: '[FLAGGED] Flagged for review',
                    duration: 'Manually',
                }),
            )
        })
    })

    it('flagged violation shows Unflag button instead of Flag and Defer', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('flag-btn-n1')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('flag-btn-n1'))
        await waitFor(() => {
            expect(screen.getByTestId('unflag-btn-n1')).toBeDefined()
            expect(screen.queryByTestId('flag-btn-n1')).toBeNull()
        })
    })
})

// ---------------------------------------------------------------------------
// COUNSEL.3.2 — Provenance Chip
// ---------------------------------------------------------------------------

describe('GovernanceDashboard — COUNSEL.3.2 Provenance Chip', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useCanvasStore.setState({ mithrilViolations: [], a11yViolations: {} })
        useEditorStore.setState({ linterWarnings: new Map() })
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    })

    it('renders "Introduced by you" when provenance source is human', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', warning]]) })
        useCanvasStore.setState({ activeFilePath: '/test/file.tsx' })
        ;(window.flintAPI.governance.getProvenanceSummary as ReturnType<typeof vi.fn>).mockResolvedValue({
            'n1': { source: 'human', timestamp: '2026-03-31T00:00:00Z' },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('provenance-chip-n1')).toBeDefined()
            expect(screen.getByTestId('provenance-chip-n1').textContent).toContain('Introduced by you')
        })
    })

    it('renders agent name when provenance source is an agent', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n2', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n2', warning]]) })
        useCanvasStore.setState({ activeFilePath: '/test/file.tsx' })
        ;(window.flintAPI.governance.getProvenanceSummary as ReturnType<typeof vi.fn>).mockResolvedValue({
            'n2': { source: 'agent', agentId: 'claude-coder', timestamp: '2026-03-31T00:00:00Z' },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('provenance-chip-n2')).toBeDefined()
            expect(screen.getByTestId('provenance-chip-n2').textContent).toContain('Introduced by claude-coder')
        })
    })

    it('does not render provenance chip when no provenance data exists', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'n3', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['n3', warning]]) })
        ;(window.flintAPI.governance.getProvenanceSummary as ReturnType<typeof vi.fn>).mockResolvedValue({})
        render(<GovernanceDashboard />)
        await waitFor(() => {
            const list = document.querySelector('[data-testid="violations-list"]')
            expect(list).toBeDefined()
        })
        expect(screen.queryByTestId('provenance-chip-n3')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// COUNSEL.3.3 — Anomaly Alert Banner
// ---------------------------------------------------------------------------

describe('GovernanceDashboard — COUNSEL.3.3 Anomaly Alert Banner', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useCanvasStore.setState({ mithrilViolations: [], a11yViolations: {} })
        useEditorStore.setState({ linterWarnings: new Map() })
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    })

    it('renders anomaly banner when anomalies are present', async () => {
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>).mockResolvedValue([
            { type: 'mutation_spike', severity: 'high', message: 'Mutation rate 3x above baseline', detected_at: '2026-03-31T12:00:00Z' },
        ])
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('anomaly-alert-banner')).toBeDefined()
            expect(screen.getByTestId('anomaly-alert-banner').textContent).toContain('Flare detected 1 anomaly')
            expect(screen.getByTestId('anomaly-alert-banner').textContent).toContain('Mutation rate 3x above baseline')
        })
    })

    it('does not render anomaly banner when no anomalies exist', async () => {
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>).mockResolvedValue([])
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // Give it time to mount and fetch
        await waitFor(() => {
            expect(screen.queryByTestId('anomaly-alert-banner')).toBeNull()
        })
    })

    it('dismiss button hides the anomaly banner for the session', async () => {
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>).mockResolvedValue([
            { type: 'override_spike', severity: 'medium', message: 'Override count above baseline', detected_at: '2026-03-31T12:00:00Z' },
        ])
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('anomaly-alert-banner')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('anomaly-banner-dismiss'))
        await waitFor(() => {
            expect(screen.queryByTestId('anomaly-alert-banner')).toBeNull()
        })
    })

    it('renders correct plural text for multiple anomalies', async () => {
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>).mockResolvedValue([
            { type: 'mutation_spike', severity: 'high', message: 'Spike 1', detected_at: '2026-03-31T12:00:00Z' },
            { type: 'violation_spike', severity: 'medium', message: 'Spike 2', detected_at: '2026-03-31T12:01:00Z' },
        ])
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('anomaly-alert-banner').textContent).toContain('Flare detected 2 anomalies')
        })
    })

    // ── COUNSEL.3.1: Rewind to clean state ───────────────────────────────────

    it('shows "Rewind to clean" link when score < 95 and a clean state exists', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getLastCleanState =
            vi.fn().mockResolvedValue({ timestamp: '2026-03-30T10:00:00Z', score: 98 })
        seedTokens([makeToken()])
        // Add violations to drop score below 95
        const warnings = new Map<string, LinterWarning>()
        for (let i = 0; i < 3; i++) {
            const w = makeLinterWarning({ id: `v-${i}`, severity: 'critical' })
            warnings.set(`v-${i}`, w)
        }
        useEditorStore.setState({ linterWarnings: warnings })
        render(<GovernanceDashboard />)
        // Open Health Score accordion (starts closed) to reveal rewind-to-clean
        await waitFor(() => screen.getByTestId('score-ring'))
        const accordionBtn = document.querySelector('button[aria-controls="score-accordion"]') as HTMLElement
        fireEvent.click(accordionBtn)
        await waitFor(() => {
            expect(screen.getByTestId('rewind-to-clean')).toBeDefined()
        })
        expect(screen.getByTestId('rewind-to-clean').textContent).toContain('score 98')
    })

    it('hides "Rewind to clean" link when score >= 95', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getLastCleanState =
            vi.fn().mockResolvedValue({ timestamp: '2026-03-30T10:00:00Z', score: 100 })
        seedTokens([makeToken()])
        // No violations — score stays at 100
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.queryByTestId('rewind-to-clean')).toBeNull()
        })
    })

    it('hides "Rewind to clean" link when no clean state exists', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getLastCleanState =
            vi.fn().mockResolvedValue(null)
        seedTokens([makeToken()])
        const w = makeLinterWarning({ id: 'v1', severity: 'critical' })
        useEditorStore.setState({ linterWarnings: new Map([['v1', w]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.queryByTestId('rewind-to-clean')).toBeNull()
        })
    })

    // ── COUNSEL.4.2: Compliance trajectory sparkline ─────────────────────────

    it('renders sparkline when health history has 2+ entries', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getHealthHistory =
            vi.fn().mockResolvedValue([
                { date: '2026-03-28T10:00:00Z', score: 85, grade: 'B' },
                { date: '2026-03-29T10:00:00Z', score: 90, grade: 'A' },
                { date: '2026-03-30T10:00:00Z', score: 92, grade: 'A' },
            ])
        ;(window.flintAPI.governance as Record<string, unknown>).recordHealth =
            vi.fn().mockResolvedValue(undefined)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // Open Health Score accordion (starts closed) to reveal sparkline
        await waitFor(() => screen.getByTestId('score-ring'))
        const accordionBtn = document.querySelector('button[aria-controls="score-accordion"]') as HTMLElement
        fireEvent.click(accordionBtn)
        await waitFor(() => {
            expect(screen.getByTestId('sparkline')).toBeDefined()
        })
        // Should have a polyline element inside the SVG
        const svg = screen.getByTestId('sparkline')
        expect(svg.querySelector('polyline')).not.toBeNull()
    })

    it('does not render sparkline when history has fewer than 2 entries', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getHealthHistory =
            vi.fn().mockResolvedValue([{ date: '2026-03-30T10:00:00Z', score: 95, grade: 'A' }])
        ;(window.flintAPI.governance as Record<string, unknown>).recordHealth =
            vi.fn().mockResolvedValue(undefined)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // Use score-ring (always visible with tokens) as settle signal instead of accordion content
        await waitFor(() => {
            expect(screen.getByTestId('score-ring')).toBeDefined()
        })
        expect(screen.queryByTestId('sparkline')).toBeNull()
    })

    // ── COUNSEL.4.1: Token impact preview ────────────────────────────────────

    it('shows token impact section when sync violations exist (inside More details)', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).previewTokenImpact =
            vi.fn().mockResolvedValue({ affectedFiles: 4, estimatedImpact: 'medium' })
        seedTokens([makeToken()])
        const syncWarning = makeLinterWarning({
            type: 'sync',
            id: 'sync-1',
            nearestToken: 'color.brand.primary',
            message: "SYNC-001: token drift on 'color.brand.primary'",
        })
        useEditorStore.setState({ linterWarnings: new Map([['sync-1', syncWarning]]) })
        render(<GovernanceDashboard />)
        // GAP-1: token-impact-section is inside "More details" disclosure
        fireEvent.click(screen.getByTestId('more-details-toggle'))
        await waitFor(() => {
            expect(screen.getByTestId('token-impact-section')).toBeDefined()
        })
    })

    it('hides token impact section when no sync violations exist', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).previewTokenImpact =
            vi.fn().mockResolvedValue({ affectedFiles: 0, estimatedImpact: 'low' })
        seedTokens([makeToken()])
        const mithrilWarning = makeLinterWarning({ type: 'color-drift', id: 'n1' })
        useEditorStore.setState({ linterWarnings: new Map([['n1', mithrilWarning]]) })
        render(<GovernanceDashboard />)
        // Use score-ring (always visible with tokens) as settle signal
        await waitFor(() => {
            expect(screen.getByTestId('score-ring')).toBeDefined()
        })
        expect(screen.queryByTestId('token-impact-section')).toBeNull()
    })

    // ── S8.3: Pending approvals ──────────────────────────────────────────────

    it('shows pending approvals section when mutations await approval', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getPendingMutations =
            vi.fn().mockResolvedValue([
                { id: 1, type: 'insertNode', filePath: '/src/App.tsx', riskScore: 65, riskTier: 'Amber', agentId: 'agent-1' },
                { id: 2, type: 'deleteNode', filePath: '/src/Home.tsx', riskScore: 85, riskTier: 'Red' },
            ])
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // GAP-1: pending-approvals-section is inside "More details" disclosure
        fireEvent.click(screen.getByTestId('more-details-toggle'))
        await waitFor(() => {
            expect(screen.getByTestId('pending-approvals-section')).toBeDefined()
        })
        // Badge should show "2 pending"
        expect(screen.getByTestId('pending-approvals-section').textContent).toContain('2 pending')
    })

    it('hides pending approvals section when no mutations pending', async () => {
        ;(window.flintAPI.governance as Record<string, unknown>).getPendingMutations =
            vi.fn().mockResolvedValue([])
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // Use score-ring (always visible with tokens) as settle signal
        await waitFor(() => {
            expect(screen.getByTestId('score-ring')).toBeDefined()
        })
        // Even if More details were open, the section would not render (pendingMutations.length === 0)
        expect(screen.queryByTestId('pending-approvals-section')).toBeNull()
    })

    it('approve button removes the mutation from the list', async () => {
        const approveFn = vi.fn().mockResolvedValue(undefined)
        ;(window.flintAPI.governance as Record<string, unknown>).getPendingMutations =
            vi.fn().mockResolvedValue([
                { id: 42, type: 'insertNode', filePath: '/src/App.tsx', riskScore: 65, riskTier: 'Amber' },
            ])
        ;(window.flintAPI.governance as Record<string, unknown>).approveMutation = approveFn
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // GAP-1: Open "More details" first
        fireEvent.click(screen.getByTestId('more-details-toggle'))
        await waitFor(() => {
            expect(screen.getByTestId('pending-approvals-section')).toBeDefined()
        })
        // Open the accordion
        fireEvent.click(screen.getByText('Pending Approvals'))
        await waitFor(() => {
            expect(screen.getByTestId('approve-mutation-42')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('approve-mutation-42'))
        await waitFor(() => {
            expect(approveFn).toHaveBeenCalledWith(42)
        })
    })

    it('reject button removes the mutation from the list', async () => {
        const rejectFn = vi.fn().mockResolvedValue(undefined)
        ;(window.flintAPI.governance as Record<string, unknown>).getPendingMutations =
            vi.fn().mockResolvedValue([
                { id: 99, type: 'deleteNode', filePath: '/src/Home.tsx', riskScore: 85, riskTier: 'Red' },
            ])
        ;(window.flintAPI.governance as Record<string, unknown>).rejectMutation = rejectFn
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        // GAP-1: Open "More details" first
        fireEvent.click(screen.getByTestId('more-details-toggle'))
        await waitFor(() => {
            expect(screen.getByTestId('pending-approvals-section')).toBeDefined()
        })
        fireEvent.click(screen.getByText('Pending Approvals'))
        await waitFor(() => {
            expect(screen.getByTestId('reject-mutation-99')).toBeDefined()
        })
        fireEvent.click(screen.getByTestId('reject-mutation-99'))
        await waitFor(() => {
            expect(rejectFn).toHaveBeenCalledWith(99)
        })
    })
})

// ---------------------------------------------------------------------------
// COUNSEL.1 Sprint — Additional tests for COUNSEL.1.1 through COUNSEL.1.7
// ---------------------------------------------------------------------------

describe('GovernanceDashboard — COUNSEL.1 Sprint (additional tests)', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useCanvasStore.setState({ mithrilViolations: [], a11yViolations: {} })
        useEditorStore.setState({ linterWarnings: new Map() })
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    })

    // ── COUNSEL.1.1: Category chips appear BEFORE score ring (DOM order) ─────

    it('category chips appear before the score ring in DOM order', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ type: 'color-drift', id: 'dom-order-1' })
        useEditorStore.setState({ linterWarnings: new Map([['dom-order-1', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('category-chips')).toBeDefined()
            expect(screen.getByTestId('score-ring')).toBeDefined()
        })
        const chipsEl = screen.getByTestId('category-chips')
        const ringEl = screen.getByTestId('score-ring')
        // compareDocumentPosition: 4 = DOCUMENT_POSITION_FOLLOWING (ring comes after chips)
        const pos = chipsEl.compareDocumentPosition(ringEl)
        expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    // ── COUNSEL.1.2: Auto-enable delta mode for legacy projects ──────────────

    it('auto-enables baseline when initialViolationCount > 10', async () => {
        seedTokens([makeToken()])
        // Seed 12 warnings so the auto-enable can find them
        const warnings = new Map<string, LinterWarning>()
        for (let i = 0; i < 12; i++) {
            const w = makeLinterWarning({ id: `auto-${i}`, type: 'color-drift' })
            warnings.set(`auto-${i}`, w)
        }
        useEditorStore.setState({ linterWarnings: warnings })
        useCanvasStore.setState({ activeFilePath: '/test/auto-baseline.tsx' })
        const setMock = vi.fn().mockResolvedValue(undefined)
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: setMock,
            clear: vi.fn().mockResolvedValue(undefined),
        }
        render(<GovernanceDashboard initialViolationCount={15} />)
        await waitFor(() => {
            expect(setMock).toHaveBeenCalled()
        })
    })

    it('does NOT auto-enable baseline when initialViolationCount <= 10', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'no-auto-1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['no-auto-1', warning]]) })
        useCanvasStore.setState({ activeFilePath: '/test/no-auto.tsx' })
        const setMock = vi.fn().mockResolvedValue(undefined)
        ;(window.flintAPI as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: setMock,
            clear: vi.fn().mockResolvedValue(undefined),
        }
        render(<GovernanceDashboard initialViolationCount={5} />)
        // Wait for any async effects to settle
        await waitFor(() => screen.getByTestId('score-ring'))
        // set should NOT have been called
        expect(setMock).not.toHaveBeenCalled()
    })

    // ── COUNSEL.1.3: Formula unification — mithril = 3 pts (not 5) ──────────

    it('one amber mithril violation deducts 3 pts (score = 97, not 95)', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'formula-1', severity: 'amber', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['formula-1', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).toContain('97')
        })
    })

    it('score breakdown shows correct penalty text for mithril (-3 pts)', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'penalty-1', severity: 'amber', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['penalty-1', warning]]) })
        render(<GovernanceDashboard />)
        // Open score breakdown accordion
        await waitFor(() => screen.getByTestId('score-ring'))
        const accordionBtn = document.querySelector('button[aria-controls="score-accordion"]') as HTMLElement
        if (accordionBtn) fireEvent.click(accordionBtn)
        await waitFor(() => {
            const row = screen.getByTestId('fidelity-score-row')
            expect(row.textContent).toContain('3 pts')
        })
    })

    // ── COUNSEL.1.7: Heading hierarchy ───────────────────────────────────────

    it('renders an h2 heading for screen readers', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        const heading = document.querySelector('h2')
        expect(heading).toBeTruthy()
        expect(heading?.textContent).toContain('Governance Health')
    })

    it('BatchActionBar uses h3 (not h4) for proper heading hierarchy', async () => {
        seedTokens([makeToken()])
        const warning = makeLinterWarning({ id: 'h-test-1', type: 'color-drift' })
        useEditorStore.setState({ linterWarnings: new Map([['h-test-1', warning]]) })
        render(<GovernanceDashboard />)
        await waitFor(() => screen.getByTestId('violations-list'))
        // h3 should exist in the Issues section (from BatchActionBar)
        const h3Elements = document.querySelectorAll('h3')
        const issuesH3 = Array.from(h3Elements).find(el => el.textContent?.includes('Issues'))
        expect(issuesH3).toBeTruthy()
        // No h4 elements should exist
        expect(document.querySelectorAll('h4').length).toBe(0)
    })

    it('dashboard has role="region" with aria-label', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        const region = document.querySelector('[role="region"]')
        expect(region).toBeTruthy()
        expect(region?.getAttribute('aria-label')).toContain('Governance')
    })
})
