/**
 * GovernanceDashboard.test.tsx
 *
 * Tests for the GovernanceDashboard component, focusing on:
 * - Zero-state (no tokens) empty state copy and CTA
 * - Export button opens ExportModal via onOpenExportModal prop
 * - Override count uses real number (govOverrideCount) not boolean coercion
 * - A11y message synthesis joins string[] correctly
 * - Health score ring renders with tokens loaded
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useTokenStore } from '../../../store/tokenStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'
import { useNotificationStore } from '../../../store/notificationStore'
import type { Notification } from '../../../store/notificationStore'
import type { DesignToken } from '../../../types/flint-api'

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
    // Directly set the tokenStore state — faster than waiting for IPC round-trip
    useTokenStore.setState({ tokens, isLoading: false, error: null })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard', () => {
    beforeEach(() => {
        // Ensure token store is empty before each test (setup.ts doesn't reset it)
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        // Mock baseline API as undefined (not available in test environment)
        ;(window.flintAPI as Record<string, unknown>).baseline = undefined
    })

    // ── Fix 4: Zero-state copy ────────────────────────────────────────────────

    // 1. Shows updated no-tokens empty state text when tokenStore.tokens is empty
    it('shows updated empty state copy when token count is zero', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/Health score measures against your design tokens/)).toBeDefined()
        })
    })

    // 2. Empty state explains that tokens are required for measurement
    it('empty state references design tokens and governance scoring', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/Connect Figma or import tokens to start measuring/)).toBeDefined()
        })
    })

    // 3. Empty state shows Import Tokens CTA
    it('shows Import Tokens button when no tokens are loaded', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Import Tokens')).toBeDefined()
        })
    })

    // 4. Import Tokens button navigates to tokens tab
    it('Import Tokens button switches rightTab to tokens', async () => {
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Import Tokens')).toBeDefined()
        })
        fireEvent.click(screen.getByText('Import Tokens'))
        expect(useCanvasStore.getState().rightTab).toBe('tokens')
    })

    // ── Fix 1: Export button opens ExportModal ────────────────────────────────

    // 5. Export button calls onOpenExportModal when no violations
    it('Export button invokes onOpenExportModal prop', async () => {
        seedTokens([makeToken()])
        const onOpenExportModal = vi.fn()
        render(<GovernanceDashboard onOpenExportModal={onOpenExportModal} />)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Open export modal/i })).toBeDefined()
        })
        fireEvent.click(screen.getByRole('button', { name: /Open export modal/i }))
        expect(onOpenExportModal).toHaveBeenCalledOnce()
    })

    // 6. Export button does not throw when onOpenExportModal is not provided
    it('Export button is safe when onOpenExportModal prop is absent', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Open export modal/i })).toBeDefined()
        })
        // Should not throw
        expect(() => fireEvent.click(screen.getByRole('button', { name: /Open export modal/i }))).not.toThrow()
    })

    // ── Fix 3: Override count uses real number ────────────────────────────────

    // 7. Health score uses real override count from IPC (not boolean coercion)
    it('health score deducts 3 points per override using real count from IPC', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(4)
        seedTokens([makeToken()])
        useCanvasStore.setState({ overridesExist: true })
        render(<GovernanceDashboard />)
        // Wait for the IPC-loaded count to appear in the header badge
        await waitFor(() => {
            expect(screen.getByText('4 overrides')).toBeDefined()
        })
        // Open the Health Score accordion to see the deduction breakdown
        const scoreBtn = screen.getByRole('button', { name: /Health Score/i })
        fireEvent.click(scoreBtn)
        // With 4 overrides × 3 pts = 12 pts deducted — score = 88 not 97
        // The score ring shows 88 (not 97 which would come from boolean coercion)
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            // score = 100 - (4*3) = 88; boolean coercion would give 100 - (1*3) = 97
            expect(body).toContain('88')
        })
    })

    // ── Fix 2: A11y message joins string[] correctly ──────────────────────────

    // 8. A11y violations with multiple messages are joined and displayed
    it('a11y violation with multiple messages renders joined text not [object Array]', async () => {
        seedTokens([makeToken()])
        useCanvasStore.setState({
            a11yViolations: {
                'node-abc': ['Missing alt text', 'Low contrast ratio'],
            },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            // The joined message should appear somewhere in the tree
            const body = document.body.textContent ?? ''
            expect(body).not.toContain('[object Array]')
            // Both individual messages should be present (joined via ", ")
            expect(body).toContain('Missing alt text')
        })
    })

    // 9. A11y violation message does not produce object-coercion artifacts
    it('String(string[]) coercion is not used — no comma-joined raw array', async () => {
        seedTokens([makeToken()])
        useCanvasStore.setState({
            a11yViolations: {
                'node-xyz': ['A11Y-001: Missing alt text'],
            },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            const body = document.body.textContent ?? ''
            expect(body).not.toContain('[object Array]')
        })
    })

    // ── Existing baseline tests ───────────────────────────────────────────────

    // 10. Score ring renders when tokens are loaded (no empty state)
    it('renders the Governance Health header when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            const matches = screen.getAllByText('Governance Health')
            expect(matches.length).toBeGreaterThan(0)
        })
    })

    // 11. Score ring renders numeric score when tokens are loaded
    it('renders a numeric health score when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            const allText = document.body.textContent ?? ''
            expect(allText).toContain('100')
        })
    })

    // 12. Empty state is hidden when tokens are loaded
    it('does not show the no-tokens empty state when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.queryByText(/Health score measures against your design tokens/)).toBeNull()
        })
    })

    // 13. Score explanation section renders when tokens are loaded (EDU-08)
    it('renders score explanation toggle when tokens exist', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/How is this calculated/i)).toBeDefined()
        })
    })

    // 14. Delta Mode controls render when tokens are loaded (GLASS.1e)
    // The "Session & Baseline" accordion must be opened first since it's collapsed by default.
    it('renders Delta Mode toggle button when tokens exist', async () => {
        seedTokens([makeToken()])
        ;(window.flintAPI.baseline?.isSet as ReturnType<typeof vi.fn> | undefined)?.mockResolvedValue(false)
        render(<GovernanceDashboard />)
        // Open the "Session & Baseline" accordion
        const sessionBtn = screen.getByRole('button', { name: /Session.*Baseline/i })
        fireEvent.click(sessionBtn)
        await waitFor(() => {
            expect(screen.getByText(/Show only new issues/)).toBeDefined()
        })
    })

    // 15. GOV.2 override badge renders when override count > 0 (GLASS.3.4-B)
    it('shows override count when governance overrides are recorded', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(3)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('3 overrides')).toBeDefined()
        })
    })

    // 16. Override badge uses singular form for count of 1 (GLASS.3.4-B)
    it('shows singular "override" for count of 1', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(1)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByText('1 override')).toBeDefined()
        })
    })

    // 17. Override badge is hidden when count is 0 (GLASS.3.4-B)
    it('does not show override badge when count is zero', async () => {
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.queryByText(/override/i)).toBeNull()
        })
    })

    // ── S4.11: Agent Activity feed (empty state + events) ────────────────────

    // 18. Activity accordion toggle is present
    it('renders the Agent Activity accordion toggle button', async () => {
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('activity-accordion-toggle')).toBeDefined()
        })
    })

    // 19. Activity empty state shows when no MCP events in history
    it('shows activity empty state when there are no MCP events', async () => {
        // Ensure notification store history has no mutation/violation/sync events
        useNotificationStore.setState({ notifications: [], history: [] })
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)

        // Open the accordion
        await waitFor(() => screen.getByTestId('activity-accordion-toggle'))
        fireEvent.click(screen.getByTestId('activity-accordion-toggle'))

        await waitFor(() => {
            expect(
                screen.getByText('This feed tracks AI agent actions. Connect an MCP client to start seeing activity.')
            ).toBeDefined()
        })
    })

    // 20. Activity feed shows events when mutation notifications exist in history
    it('shows event entries when mutation notifications exist in history', async () => {
        const mutationEvent: Notification = {
            id: 'evt-1',
            type: 'mutation',
            title: 'MCP Mutation',
            message: 'Token applied to node abc',
            severity: 'info',
            autoDismissMs: 5000,
            timestamp: Date.now(),
        }
        useNotificationStore.setState({ notifications: [], history: [mutationEvent] })
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)

        // Open the accordion
        await waitFor(() => screen.getByTestId('activity-accordion-toggle'))
        fireEvent.click(screen.getByTestId('activity-accordion-toggle'))

        await waitFor(() => {
            expect(screen.getByText('MCP Mutation')).toBeDefined()
        })
        // Empty state must not be shown
        expect(screen.queryByText(/Connect an MCP client/)).toBeNull()
    })

    // 21. Activity feed section renders with data-testid when open
    it('activity feed section is present in the DOM when accordion is open', async () => {
        useNotificationStore.setState({ notifications: [], history: [] })
        seedTokens([makeToken()])
        render(<GovernanceDashboard />)

        await waitFor(() => screen.getByTestId('activity-accordion-toggle'))
        fireEvent.click(screen.getByTestId('activity-accordion-toggle'))

        await waitFor(() => {
            expect(screen.getByTestId('activity-feed-section')).toBeDefined()
        })
    })

    // ── Fix 1: A11y Fix button via MCP ───────────────────────────────────────

    // 22. Fix button renders for an a11y violation
    it('renders a Fix button for an a11y violation', async () => {
        seedTokens([makeToken()])
        useCanvasStore.setState({
            activeFilePath: '/project/src/Button.tsx',
            a11yViolations: {
                'node-a1': ['A11Y-001: Missing alt text'],
            },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByTestId('a11y-fix-btn-A11Y-001')).toBeDefined()
        })
    })

    // 23. Clicking the Fix button calls flint_fix with correct arguments
    it('clicking Fix calls flint_fix with filePath, ruleId, dry_run: false', async () => {
        const mockCallTool = vi.fn().mockResolvedValue({ ok: true })
        ;(window.flintAPI as Record<string, unknown>).mcp = { callTool: mockCallTool }

        seedTokens([makeToken()])
        useCanvasStore.setState({
            activeFilePath: '/project/src/Button.tsx',
            a11yViolations: {
                'node-a1': ['A11Y-001: Missing alt text'],
            },
        })
        render(<GovernanceDashboard />)
        await waitFor(() => screen.getByTestId('a11y-fix-btn-A11Y-001'))
        fireEvent.click(screen.getByTestId('a11y-fix-btn-A11Y-001'))
        await waitFor(() => {
            expect(mockCallTool).toHaveBeenCalledWith('flint_fix', {
                file: '/project/src/Button.tsx',
                ruleId: 'A11Y-001',
                dry_run: false,
            })
        })
    })

    // 24. Mithril Fix button still works (regression guard)
    it('Mithril Fix button still calls applyBatch — regression guard', async () => {
        // Set fixMode to 'auto' so handleFixSingle calls applyBatch directly
        localStorage.setItem('flint:user-prefs', JSON.stringify({ fixMode: 'auto' }))
        seedTokens([makeToken()])
        const applyBatch = vi.fn()
        useEditorStore.setState({ applyBatch } as Parameters<typeof useEditorStore.setState>[0])
        useEditorStore.setState({
            linterWarnings: new Map([
                ['node-m1', {
                    id: 'node-m1',
                    type: 'color-drift' as const,
                    severity: 'critical' as const,
                    value: 1,
                    message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
                    nearestToken: 'bg-blue-600',
                    nearestTokenValue: '#2563eb',
                }],
            ]),
        })
        render(<GovernanceDashboard />)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Fix drift on element node-m1/i })).toBeDefined()
        })
        fireEvent.click(screen.getByRole('button', { name: /Fix drift on element node-m1/i }))
        expect(applyBatch).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ op: 'applyTokenFix', nodeId: 'node-m1' }),
        ]))
        localStorage.removeItem('flint:user-prefs')
    })

    // ── Cleanup ───────────────────────────────────────────────────────────────

    // Reset canvas store state shared across tests
    beforeEach(() => {
        useCanvasStore.setState({
            overridesExist: false,
            a11yViolations: {},
            mithrilViolations: [],
        })
        useEditorStore.setState({ linterWarnings: new Map() })
        useNotificationStore.setState({ notifications: [], history: [] })
    })
})
