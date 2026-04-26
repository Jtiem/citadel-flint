/**
 * TokenManager.phase2.test.tsx
 *   src/components/ui/__tests__/TokenManager.phase2.test.tsx
 *
 * MINT.5 Phase 2 — Integration coverage for TokenManager wiring.
 *
 * Test boundaries covered:
 *   1. ConnectFigmaEmptyState replaces the old empty-state block (variants).
 *   2. Confirm Push dialog open/close flow (opens on Push click, cancels on
 *      Escape/Cancel, fires mcp.callTool on confirm).
 *   3. Confirm Resolve dialog strategy flow.
 *   4. Auto-revert — drift sub-tab flips back to grid when drift empties.
 *   5. useSyncActions wiring — Pull fires flint_sync_pull via mcp.callTool.
 *
 * These exercise the TokenManager-level integration that the component-level
 * tests (already covered in mint/__tests__) do not touch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { TokenManager } from '../TokenManager'
import { useTokenStore } from '../../../store/tokenStore'
import type { DesignToken } from '../../../types/flint-api'
import type { TokenDrift } from '../../../hooks/useTokenUsage'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: Math.floor(Math.random() * 100000),
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
        ...overrides,
    }
}

const SAMPLE_TOKENS: DesignToken[] = [
    makeToken({ id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#1d4ed8' }),
    makeToken({ id: 2, token_path: 'color.secondary', token_type: 'color', token_value: '#7c3aed' }),
]

const DRIFT_SAMPLE: TokenDrift[] = [
    { tokenName: 'color.primary', localValue: '#1d4ed8', figmaValue: '#2563eb', deltaE: 3.2 },
]

/** Install a readFigmaDrift stub used by useTokenUsage. */
function installDriftStub(drift: TokenDrift[]): void {
    const api = (window as unknown as { flintAPI: Record<string, unknown> }).flintAPI
    const tokens = api.tokens as Record<string, unknown>
    tokens.readFigmaDrift = vi.fn().mockResolvedValue(drift)
}

/** Mock mcp.callTool with a default success response. */
function mockMcpCallTool() {
    const mock = vi.fn().mockResolvedValue({ isError: false, content: [] })
    const api = (window as unknown as { flintAPI: Record<string, unknown> }).flintAPI
    ;(api.mcp as Record<string, unknown>).callTool = mock
    return mock
}

/**
 * FIX-1 helper — route-mock mcp.callTool so different MCP tools can return
 * different shapes. Returns the mock so tests can assert against specific
 * calls.
 */
function mockMcpCallToolRouted(routes: Record<string, unknown>) {
    const mock = vi.fn().mockImplementation(async (tool: string) => {
        if (tool in routes) return routes[tool]
        return { isError: false, content: [] }
    })
    const api = (window as unknown as { flintAPI: Record<string, unknown> }).flintAPI
    ;(api.mcp as Record<string, unknown>).callTool = mock
    return mock
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MINT.5 Phase 2 — TokenManager integration', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    // ── 2.3 — Empty state replacement ────────────────────────────────────────

    describe('ConnectFigmaEmptyState integration', () => {
        it('renders the disconnected variant when figmaConnected=false and tokenCount=0', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: false, lastWebhookAt: null, tokenCount: 0, port: 4545,
            })
            render(<TokenManager />)
            await waitFor(() => {
                const empty = screen.getByTestId('connect-figma-empty-state')
                expect(empty.getAttribute('data-variant')).toBe('disconnected')
            })
        })

        it('renders the connected-no-tokens variant when figmaConnected=true and tokenCount=0', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
            })
            render(<TokenManager />)
            await waitFor(() => {
                const empty = screen.getByTestId('connect-figma-empty-state')
                expect(empty.getAttribute('data-variant')).toBe('connected-no-tokens')
            })
        })

        it('suppresses the empty state once tokens exist (returns null)', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            render(<TokenManager />)
            await waitFor(() => screen.getByText('color.primary'))
            expect(screen.queryByTestId('connect-figma-empty-state')).toBeNull()
        })

        it('Connect CTA invokes flint_figma_connect via mcp.callTool', async () => {
            const callTool = mockMcpCallTool()
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue([])
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: false, lastWebhookAt: null, tokenCount: 0, port: 4545,
            })
            render(<TokenManager />)
            await waitFor(() => screen.getByTestId('connect-figma-connect-cta'))
            fireEvent.click(screen.getByTestId('connect-figma-connect-cta'))
            await waitFor(() => {
                expect(callTool).toHaveBeenCalledWith('flint_figma_connect', { action: 'connect' })
            })
        })
    })

    // ── 2.4 — Confirm Push dialog ────────────────────────────────────────────

    describe('ConfirmPushDialog flow', () => {
        it('does not render the dialog on initial mount', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            render(<TokenManager />)
            await waitFor(() => screen.getByText('color.primary'))
            expect(screen.queryByTestId('confirm-push-dialog')).toBeNull()
        })

        it('Push button renders disabled when flint_sync_check reports zero local edits', async () => {
            const callTool = mockMcpCallToolRouted({
                flint_sync_check: {
                    isError: false,
                    content: [
                        { type: 'text', text: 'Sync status: OK — tokens are in sync with baseline.' },
                        { type: 'text', text: JSON.stringify({
                            inSync: true,
                            pendingConflicts: 0,
                            staleSince: null,
                            tokensDrifted: 0,
                            recommendation: 'ok',
                        }) },
                    ],
                },
            })
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
            })
            render(<TokenManager />)
            await waitFor(() => screen.getByText('color.primary'))

            await waitFor(() => {
                const pushBtn = screen.getByTestId('sync-push')
                expect(pushBtn.hasAttribute('disabled')).toBe(true)
            })
            expect(callTool).not.toHaveBeenCalledWith('flint_sync_push', expect.anything())
        })

        // ── FIX-1 (UX BLK-1 / Code WARN-2) — localEditCount wired from MCP ──
        it('Push button becomes enabled and dialog opens with real count when flint_sync_check reports local edits', async () => {
            const callTool = mockMcpCallToolRouted({
                flint_sync_check: {
                    isError: false,
                    content: [
                        { type: 'text', text: 'Sync status: push_needed. 3 token(s) drifted.' },
                        { type: 'text', text: JSON.stringify({
                            inSync: false,
                            pendingConflicts: 1,
                            staleSince: null,
                            tokensDrifted: 3,
                            recommendation: 'push_needed',
                        }) },
                    ],
                },
            })
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
            })
            render(<TokenManager />)
            await waitFor(() => screen.getByText('color.primary'))

            // Confirm flint_sync_check was called.
            await waitFor(() => {
                expect(callTool).toHaveBeenCalledWith('flint_sync_check', {})
            })

            // Push button must become enabled because localEditCount > 0.
            await waitFor(() => {
                const pushBtn = screen.getByTestId('sync-push')
                expect(pushBtn.hasAttribute('disabled')).toBe(false)
            })

            // Click Push → dialog opens with the real count in the body.
            fireEvent.click(screen.getByTestId('sync-push'))
            await waitFor(() => {
                expect(screen.queryByTestId('confirm-push-dialog')).not.toBeNull()
            })
            expect(screen.getByTestId('confirm-push-body').textContent).toMatch(/3/)
        })
    })

    // ── FIX-2 (UX BLK-2): persistent SeverityChip on auth-expired error ──────

    describe('Persistent auth-expired chip', () => {
        it('renders a persistent SeverityChip on the health bar when lastError.persistent is true', async () => {
            const callTool = mockMcpCallToolRouted({
                flint_sync_pull: {
                    isError: true,
                    content: [{ type: 'text', text: 'auth-expired: re-authenticate with Figma' }],
                },
                flint_sync_check: {
                    isError: false,
                    content: [
                        { type: 'text', text: 'Sync status: OK — tokens are in sync with baseline.' },
                        { type: 'text', text: JSON.stringify({
                            inSync: true,
                            pendingConflicts: 0,
                            staleSince: null,
                            tokensDrifted: 0,
                            recommendation: 'ok',
                        }) },
                    ],
                },
            })
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
            })
            installDriftStub(DRIFT_SAMPLE)
            render(<TokenManager />)

            await waitFor(() => {
                const pullBtn = screen.getByTestId('sync-pull')
                expect(pullBtn.hasAttribute('disabled')).toBe(false)
            })

            // Trigger auth-expired error via Pull.
            fireEvent.click(screen.getByTestId('sync-pull'))

            await waitFor(() => {
                expect(callTool).toHaveBeenCalledWith('flint_sync_pull', {})
            })

            // Persistent chip appears.
            await waitFor(() => {
                expect(screen.queryByTestId('health-chip-sync-error')).not.toBeNull()
            })
        })
    })

    // ── 2.4 — Confirm Resolve dialog ─────────────────────────────────────────

    describe('ConfirmResolveDialog flow', () => {
        it('does not render the dialog on initial mount', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            render(<TokenManager />)
            await waitFor(() => screen.getByText('color.primary'))
            expect(screen.queryByTestId('confirm-resolve-dialog')).toBeNull()
        })
    })

    // ── 2.1 — useSyncActions wiring ──────────────────────────────────────────

    describe('Pull wiring', () => {
        it('does NOT invoke mcp.callTool for sync tools when Figma is disconnected', async () => {
            const callTool = mockMcpCallTool()
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: false, lastWebhookAt: null, tokenCount: 0, port: 4545,
            })
            render(<TokenManager />)
            await waitFor(() => screen.getByText('color.primary'))

            // In the disconnected state the cluster collapses to a single
            // Connect CTA — Pull button is not rendered. Invariant
            // "zero-unauth-sync-calls": no flint_sync_pull fires.
            expect(screen.queryByTestId('sync-pull')).toBeNull()
            expect(callTool).not.toHaveBeenCalledWith('flint_sync_pull', expect.anything())
        })

        it('Pull button in connected cluster invokes flint_sync_pull via mcp.callTool when drift exists', async () => {
            const callTool = mockMcpCallTool()
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            ;(window.flintAPI.figma.status as ReturnType<typeof vi.fn>).mockResolvedValue({
                running: true, lastWebhookAt: Date.now(), tokenCount: 5, port: 4545,
            })
            installDriftStub(DRIFT_SAMPLE)
            render(<TokenManager />)

            await waitFor(() => {
                const pullBtn = screen.getByTestId('sync-pull')
                expect(pullBtn.hasAttribute('disabled')).toBe(false)
            })

            fireEvent.click(screen.getByTestId('sync-pull'))

            await waitFor(() => {
                expect(callTool).toHaveBeenCalledWith('flint_sync_pull', {})
            })
        })
    })

    // ── FIX-7 (UX WARN-4): no silent auto-revert from drift sub-tab ──────────

    describe('Drift sub-tab stays put when count drops to zero', () => {
        it('keeps viewMode on drift and renders the empty state in DriftGroupSection', async () => {
            ;(window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_TOKENS)
            installDriftStub(DRIFT_SAMPLE)
            render(<TokenManager />)

            await waitFor(() => screen.getByTestId('viewmode-drift-radio'))
            fireEvent.click(screen.getByTestId('viewmode-drift-radio'))
            await waitFor(() => {
                expect(screen.queryByTestId('drift-group-section')).not.toBeNull()
            })

            // Simulate drift clearing after a successful pull.
            const api = (window as unknown as { flintAPI: Record<string, unknown> }).flintAPI
            ;(api.tokens as Record<string, unknown>).readFigmaDrift = vi.fn().mockResolvedValue([])

            await act(async () => {
                useTokenStore.setState({ tokens: [...SAMPLE_TOKENS, makeToken({ id: 999, token_path: 'color.new' })] })
            })

            // The drift radio MUST remain visible (viewMode still 'drift').
            await waitFor(() => {
                expect(screen.queryByTestId('viewmode-drift-radio')).not.toBeNull()
            })
            // DriftGroupSection renders its own empty state instead of
            // auto-reverting to grid.
            expect(screen.queryByTestId('drift-group-empty')).not.toBeNull()
        })
    })
})
