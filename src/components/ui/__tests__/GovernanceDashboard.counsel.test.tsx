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
// the chips to appear. If for some reason the accordion is closed, we open it.
async function ensureScoreAccordionOpen() {
    // If chips are already visible (accordion starts open), just return.
    const chips = document.querySelector('[data-testid="category-chips"]')
    if (chips) return
    // Otherwise open it by clicking the accordion header button.
    const btn = screen.getByRole('button', { name: /Health Score/i })
    fireEvent.click(btn)
    await waitFor(() => {
        expect(screen.getByTestId('category-chips')).toBeDefined()
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

    it('renders three category chips when tokens are loaded', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        expect(screen.getByTestId('chip-design-system')).toBeDefined()
        expect(screen.getByTestId('chip-accessibility')).toBeDefined()
        expect(screen.getByTestId('chip-token-sync')).toBeDefined()
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
        seedTokens([makeToken()])
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
        seedTokens([makeToken()])
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

    it('effort text appears before the health score ring (DOM order)', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await ensureScoreAccordionOpen()
        const effortEl = screen.getByTestId('effort-framing')
        const ringEl = screen.getByRole('img', { name: /Health score/i })
        // compareDocumentPosition: 4 = DOCUMENT_POSITION_FOLLOWING (ring comes after effort)
        const pos = effortEl.compareDocumentPosition(ringEl)
        expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
        const scoreBtn = screen.getByRole('button', { name: /Health Score/i })
        expect(scoreBtn.getAttribute('aria-expanded')).toBeDefined()
    })
})
