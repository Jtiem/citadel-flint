/**
 * GovernanceDashboard.actionable.test.tsx — GLASS.1e
 *
 * Tests for the actionable features added to GovernanceDashboard:
 *   1. Rule rows are clickable (button elements)
 *   2. Clicking a rule row sets governanceRuleFilter and switches to properties tab
 *   3. Run Audit button renders
 *   4. Delta Mode toggle is near the top (in delta-mode-section testid)
 *   5. Score trend hint renders actionable guidance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useTokenStore } from '../../../store/tokenStore'
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

function makeWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'COL-001',
        type: 'color-drift',
        severity: 'amber',
        value: 4.5,
        message: "MITHRIL-COL-001: arbitrary '#ff0000' not in color token set",
        nearestToken: 'text-red-500',
        nearestTokenValue: '#ef4444',
        ...overrides,
    }
}

function seedTokensAndWarnings(tokens: DesignToken[], warnings: Map<string, LinterWarning>) {
    useTokenStore.setState({ tokens, isLoading: false, error: null })
    useEditorStore.setState({ linterWarnings: warnings })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — Actionable (GLASS.1e)', () => {
    beforeEach(() => {
        // Reset stores
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useEditorStore.setState({ linterWarnings: new Map() })
        useCanvasStore.setState({
            governanceRuleFilter: null,
            activeFilePath: '/test/Component.tsx',
            rightTab: 'governance',
        })
        // Mock baseline API as undefined (not available in test environment)
        ;(window.flintAPI as unknown as Record<string, unknown>).baseline = undefined
        // Mock MCP API
        ;(window.flintAPI as unknown as Record<string, unknown>).mcp = {
            callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
            readResource: vi.fn(),
            status: vi.fn().mockResolvedValue({ connected: true, serverPid: 123 }),
            onEvent: vi.fn(),
            removeEventListener: vi.fn(),
        }
    })

    // 1. Rule rows are clickable — open "More details" then "Top Triggered Rules" accordion first
    it('renders rule rows as clickable buttons', async () => {
        const warnings = new Map<string, LinterWarning>([
            ['n1', makeWarning({ id: 'W1', type: 'color-drift' })],
            ['n2', makeWarning({ id: 'W2', type: 'color-drift' })],
        ])
        seedTokensAndWarnings([makeToken()], warnings)
        render(<GovernanceDashboard />)

        // Open "More details" disclosure first (GAP-1 restructure)
        const moreDetailsBtn = screen.getByTestId('more-details-toggle')
        fireEvent.click(moreDetailsBtn)

        // Open the "Top Triggered Rules" accordion inside
        await waitFor(() => screen.getByRole('button', { name: /Top Triggered Rules/i }))
        const topRulesBtn = screen.getByRole('button', { name: /Top Triggered Rules/i })
        fireEvent.click(topRulesBtn)

        await waitFor(() => {
            const ruleRow = screen.getByTestId('rule-row-color-drift')
            expect(ruleRow).toBeDefined()
            expect(ruleRow.tagName).toBe('BUTTON')
        })
    })

    // 2. Clicking a rule row sets governanceRuleFilter (no longer switches tab — scrolls instead)
    it('clicking a rule row sets governanceRuleFilter', async () => {
        const warnings = new Map<string, LinterWarning>([
            ['n1', makeWarning({ id: 'W1', type: 'color-drift' })],
            ['n2', makeWarning({ id: 'W2', type: 'typography-drift', message: "MITHRIL-TYP-001: drift" })],
        ])
        seedTokensAndWarnings([makeToken()], warnings)
        render(<GovernanceDashboard />)

        // Open "More details" disclosure first (GAP-1 restructure)
        const moreDetailsBtn = screen.getByTestId('more-details-toggle')
        fireEvent.click(moreDetailsBtn)

        // Open the "Top Triggered Rules" accordion inside
        await waitFor(() => screen.getByRole('button', { name: /Top Triggered Rules/i }))
        const topRulesBtn = screen.getByRole('button', { name: /Top Triggered Rules/i })
        fireEvent.click(topRulesBtn)

        await waitFor(() => {
            expect(screen.getByTestId('rule-row-color-drift')).toBeDefined()
        })

        const ruleRow = screen.getByTestId('rule-row-color-drift')
        fireEvent.click(ruleRow)

        expect(useCanvasStore.getState().governanceRuleFilter).toBe('color-drift')
        // rightTab stays on 'governance' (rule rows scroll to violations, no longer switch tabs)
        expect(useCanvasStore.getState().rightTab).toBe('governance')
    })

    // 3. Run Audit button renders
    it('renders Run Audit button', () => {
        seedTokensAndWarnings([makeToken()], new Map())
        render(<GovernanceDashboard />)

        const auditBtn = screen.getByTestId('run-audit-button')
        expect(auditBtn).toBeDefined()
        expect(auditBtn.textContent).toContain('Run Audit')
    })

    // 4. Run Audit calls MCP tool
    it('Run Audit button calls mcp.callTool with flint_audit', async () => {
        seedTokensAndWarnings([makeToken()], new Map())
        render(<GovernanceDashboard />)

        const auditBtn = screen.getByTestId('run-audit-button')
        fireEvent.click(auditBtn)

        await waitFor(() => {
            const mcp = window.flintAPI.mcp!
            expect(mcp.callTool).toHaveBeenCalledWith('flint_audit', { file: '/test/Component.tsx' })
        })
    })

    // 5. Delta Mode toggle is in the "Session & Baseline" accordion (inside "More details")
    it('Delta Mode toggle section is rendered inside Session & Baseline accordion', async () => {
        seedTokensAndWarnings([makeToken()], new Map())
        render(<GovernanceDashboard />)

        // Open "More details" disclosure first (GAP-1 restructure)
        const moreDetailsBtn = screen.getByTestId('more-details-toggle')
        fireEvent.click(moreDetailsBtn)

        // The section is inside a collapsed accordion — open it
        await waitFor(() => screen.getByRole('button', { name: /Session.*Baseline/i }))
        const sessionBtn = screen.getByRole('button', { name: /Session.*Baseline/i })
        fireEvent.click(sessionBtn)

        await waitFor(() => {
            const deltaSection = screen.getByTestId('delta-mode-section')
            expect(deltaSection).toBeDefined()
        })
    })

    // 6. Score trend hint renders inside Health Score accordion
    it('shows score trend hint when violations exist', async () => {
        const warnings = new Map<string, LinterWarning>([
            ['n1', makeWarning({ id: 'W1', type: 'color-drift' })],
            ['n2', makeWarning({ id: 'W2', type: 'color-drift' })],
        ])
        seedTokensAndWarnings([makeToken()], warnings)
        render(<GovernanceDashboard />)
        await waitFor(() => screen.getByTestId('score-ring'))

        await waitFor(() => {
            const hint = screen.getByTestId('score-trend-hint')
            expect(hint).toBeDefined()
            expect(hint.textContent).toContain('Color Drift')
        })
    })
})
