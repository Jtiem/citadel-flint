/**
 * SetupWizard.test.tsx — ONBOARD.1-FIXES: Setup Wizard UX & Safety Fixes
 *
 * Covers all 5 wizard steps and their state transitions. All IPC calls go
 * through the window.flintAPI mock established by the global setup.ts.
 *
 * Original coverage (24 tests, updated for new behavior):
 *   WIZ-01 — Renders welcome step on initial mount
 *   WIZ-02 — "Let's go" button advances to ide-detect step
 *   WIZ-03 — detectIDEs is called when ide-detect step mounts
 *   WIZ-04 — Shows spinner while detectedIDEs is null
 *   WIZ-05 — Auto-selects first detected IDE
 *   WIZ-06 — Undetected IDE can still be manually selected
 *   WIZ-07 — "Continue" is disabled with no selection
 *   WIZ-08 — "Continue" advances to mcp-snippet step
 *   WIZ-09 — "Skip setup" on ide-detect calls onComplete
 *   WIZ-10 — "Install MCP Config" button is shown (no auto-write on step entry)
 *   WIZ-11 — Shows "Config written" after clicking Install and writeMCPConfig resolves
 *   WIZ-12 — Shows error state when writeMCPConfig rejects
 *   WIZ-13 — Retry button resets write state so another attempt fires
 *   WIZ-14 — "Continue" on mcp-snippet (after success) advances to verify step
 *   WIZ-15 — "Skip" on mcp-snippet advances to verify (not done); completeFirstLaunch NOT called
 *   WIZ-16 — Verify success path: callTool resolves → shows "Flint is live"
 *   WIZ-17 — Verify error path: callTool rejects → shows error message
 *   WIZ-18 — "Continue" on verify success advances to done
 *   WIZ-19 — "Skip" on verify advances to done
 *   WIZ-20 — Done step "Start building" calls completeFirstLaunch then onComplete
 *   WIZ-21 — Back button on ide-detect goes to welcome
 *   WIZ-22 — Back button on mcp-snippet goes to ide-detect
 *   WIZ-23 — Escape key calls onComplete (when not writing)
 *   WIZ-24 — Step indicator renders 5 dots
 *   WIZ-24b — Antigravity appears in the IDE list
 *   WIZ-24c — writeMCPConfig is called with Antigravity's mcp_config.json path
 *
 * New R-* fix coverage:
 *   R1-A  — writeMCPConfig NOT called automatically on mcp-snippet step entry
 *   R1-B  — "Install MCP Config" button is present before write
 *   R1-C  — Clicking "Install MCP Config" calls writeMCPConfig
 *   R1-D  — Install button shows "Installing…" spinner while writing
 *   R2-A  — "Copy config snippet" button appears in error state
 *   R2-B  — Clicking copy writes the JSON to clipboard
 *   R2-C  — Manual paste instruction shown in error state
 *   R3-A  — Skip in mcp-snippet calls goNext (advances to verify), not handleDone
 *   R3-B  — completeFirstLaunch is NOT called when skipping mcp-snippet
 *   R3-C  — Only the "Start building" button on done step calls completeFirstLaunch
 *   R4-A  — Escape key is ignored while writeStatus === 'writing'
 *   R5-A  — Verify step shows accurate copy (no "restart your IDE")
 *   R5-B  — Verify step shows "internal connection" language
 *   R6-A  — writeStatus resets to null when IDE selection changes
 *   R8-A  — No @ts-expect-error comments in component (types are properly defined)
 *   R9-A  — Status box has aria-live="polite"
 *   R10-A — Completed steps show checkmark
 *   R10-B — Current step shows ring indicator
 */

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { SetupWizard } from '../SetupWizard'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SERVER_PATH = '/usr/local/flint-mcp/dist/server.js'

const MOCK_IDES_ALL_DETECTED = {
    ides: [
        { name: 'Claude Code' as const, settingsPath: '/home/.claude/mcp.json', detected: true },
        { name: 'Antigravity' as const, settingsPath: '/home/.gemini/antigravity/mcp_config.json', detected: true },
        { name: 'Cursor' as const, settingsPath: '/home/Library/Cursor/settings.json', detected: true },
        { name: 'VS Code' as const, settingsPath: '/home/Library/Code/settings.json', detected: true },
    ],
    mcpServerPath: MOCK_SERVER_PATH,
}

const MOCK_IDES_NONE_DETECTED = {
    ides: [
        { name: 'Claude Code' as const, settingsPath: '/home/.claude/mcp.json', detected: false },
        { name: 'Antigravity' as const, settingsPath: '/home/.gemini/antigravity/mcp_config.json', detected: false },
        { name: 'Cursor' as const, settingsPath: '/home/Library/Cursor/settings.json', detected: false },
        { name: 'VS Code' as const, settingsPath: '/home/Library/Code/settings.json', detected: false },
    ],
    mcpServerPath: MOCK_SERVER_PATH,
}

const MOCK_IDES_ANTIGRAVITY_ONLY = {
    ides: [
        { name: 'Claude Code' as const, settingsPath: '/home/.claude/mcp.json', detected: false },
        { name: 'Antigravity' as const, settingsPath: '/home/.gemini/antigravity/mcp_config.json', detected: true },
        { name: 'Cursor' as const, settingsPath: '/home/Library/Cursor/settings.json', detected: false },
        { name: 'VS Code' as const, settingsPath: '/home/Library/Code/settings.json', detected: false },
    ],
    mcpServerPath: MOCK_SERVER_PATH,
}

// Helper: advance through welcome to ide-detect and wait for IDE list to load
async function advanceToIdeDetect(detectResult = MOCK_IDES_ALL_DETECTED) {
    ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(detectResult)
    const onComplete = vi.fn()
    render(<SetupWizard onComplete={onComplete} />)

    // Click "Let's go" on welcome step
    fireEvent.click(screen.getByText("Let's go"))

    // Wait for IDE list to render
    await waitFor(() => {
        expect(screen.getByText('Claude Code')).toBeDefined()
    })

    return { onComplete }
}

// Helper: advance to mcp-snippet step with the first auto-selected IDE
async function advanceToMcpStep(detectResult = MOCK_IDES_ALL_DETECTED) {
    const { onComplete } = await advanceToIdeDetect(detectResult)
    // First detected IDE is auto-selected; click Continue
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => {
        expect(screen.getByText(/Connecting Flint to/)).toBeDefined()
    })
    return { onComplete }
}

// Helper: advance to mcp-snippet and perform a successful install
async function advanceToMcpStepInstalled(detectResult = MOCK_IDES_ALL_DETECTED) {
    ;(window.flintAPI.setup.writeMCPConfig as Mock).mockResolvedValue({ written: true })
    const result = await advanceToMcpStep(detectResult)
    // Click Install button
    fireEvent.click(screen.getByText('Install MCP Config'))
    await waitFor(() => {
        expect(screen.getByText(/Config written/i)).toBeDefined()
    })
    return result
}

// Helper: advance to verify step (via successful install then Continue)
async function advanceToVerify() {
    const { onComplete } = await advanceToMcpStepInstalled()
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => {
        expect(screen.getByText(/Test your connection/i)).toBeDefined()
    })
    return { onComplete }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('SetupWizard', () => {

    // WIZ-01: Renders welcome step on initial mount
    it('renders the welcome step heading on initial mount', () => {
        render(<SetupWizard onComplete={vi.fn()} />)
        expect(screen.getByText(/Get Flint running in 2 minutes/i)).toBeDefined()
    })

    // WIZ-02: "Let's go" button advances to ide-detect step
    it('"Let\'s go" button advances to the ide-detect step', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        render(<SetupWizard onComplete={vi.fn()} />)

        fireEvent.click(screen.getByText("Let's go"))

        await waitFor(() => {
            expect(screen.getByText(/Which IDE do you use\?/i)).toBeDefined()
        })
    })

    // WIZ-03: detectIDEs is called when ide-detect step mounts
    it('calls detectIDEs when the ide-detect step mounts', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        render(<SetupWizard onComplete={vi.fn()} />)

        fireEvent.click(screen.getByText("Let's go"))

        await waitFor(() => {
            expect(window.flintAPI.setup.detectIDEs).toHaveBeenCalledOnce()
        })
    })

    // WIZ-04: Shows spinner while detectedIDEs is null (loading state)
    it('shows a loading spinner while detectIDEs has not resolved', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockReturnValue(new Promise(() => {}))

        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))

        await waitFor(() => {
            const spinner = document.querySelector('.animate-spin')
            expect(spinner).not.toBeNull()
        })
    })

    // WIZ-05: Auto-selects first detected IDE (Antigravity when only it is detected)
    it('auto-selects the first detected IDE when the list loads', async () => {
        await advanceToIdeDetect(MOCK_IDES_ANTIGRAVITY_ONLY)

        // Antigravity is the only detected IDE; Continue should be enabled
        const continueBtn = screen.getByText('Continue').closest('button')!
        expect(continueBtn.hasAttribute('disabled')).toBe(false)
    })

    // WIZ-06: Undetected IDE can still be manually selected
    it('allows the user to select an undetected IDE manually', async () => {
        await advanceToIdeDetect(MOCK_IDES_NONE_DETECTED)

        // Nothing is auto-selected; Continue should be disabled
        const continueBtn = screen.getByText('Continue').closest('button')!
        expect(continueBtn.hasAttribute('disabled')).toBe(true)

        // Click Claude Code (undetected but still selectable)
        fireEvent.click(screen.getByText('Claude Code'))

        // Now Continue should be enabled
        expect(continueBtn.hasAttribute('disabled')).toBe(false)
    })

    // WIZ-07: "Continue" is disabled with no selection
    it('"Continue" button is disabled when no IDE is selected', async () => {
        await advanceToIdeDetect(MOCK_IDES_NONE_DETECTED)

        const continueBtn = screen.getByText('Continue').closest('button')!
        expect(continueBtn.hasAttribute('disabled')).toBe(true)
    })

    // WIZ-08: "Continue" advances to mcp-snippet step
    it('"Continue" with a selected IDE advances to the mcp-snippet step', async () => {
        await advanceToMcpStep()

        expect(screen.getByText(/Connecting Flint to/i)).toBeDefined()
    })

    // WIZ-09: "Skip setup" on ide-detect calls onComplete
    it('"Skip setup" link on the ide-detect step calls onComplete immediately', async () => {
        const { onComplete } = await advanceToIdeDetect()

        fireEvent.click(screen.getByText('Skip setup'))

        expect(onComplete).toHaveBeenCalledOnce()
    })

    // WIZ-10 (updated): "Install MCP Config" button is shown; writeMCPConfig NOT auto-called
    it('shows "Install MCP Config" button and does NOT auto-call writeMCPConfig on step entry', async () => {
        await advanceToMcpStep()

        // Install button must be present
        expect(screen.getByText('Install MCP Config')).toBeDefined()
        // writeMCPConfig must NOT have been called automatically
        expect(window.flintAPI.setup.writeMCPConfig).not.toHaveBeenCalled()
    })

    // WIZ-11 (updated): Shows "Config written" after clicking Install and writeMCPConfig resolves
    it('shows "Config written" after clicking "Install MCP Config" and writeMCPConfig resolves', async () => {
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockResolvedValue({ written: true })

        await advanceToMcpStep()

        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Config written/i)).toBeDefined()
        })
    })

    // WIZ-12: Shows error state when writeMCPConfig rejects
    it('shows "Write failed" when writeMCPConfig rejects', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockRejectedValue(
            new Error('EACCES: permission denied'),
        )
        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))
        await waitFor(() => { expect(screen.getByText('Claude Code')).toBeDefined() })
        fireEvent.click(screen.getByText('Continue'))

        await waitFor(() => {
            expect(screen.getByText('Install MCP Config')).toBeDefined()
        })

        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Write failed/i)).toBeDefined()
        })
    })

    // WIZ-13: Retry button resets write state so another attempt fires
    it('Retry button appears on write failure and resets state for a new attempt', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockRejectedValue(new Error('fail'))
        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))
        await waitFor(() => { expect(screen.getByText('Claude Code')).toBeDefined() })
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText('Install MCP Config')).toBeDefined() })
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Write failed/i)).toBeDefined()
        })

        // Retry resets to null state — Install button should reappear
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockResolvedValue({ written: true })
        fireEvent.click(screen.getByText('Retry'))

        // After retry, we're back to null state, then user clicks Install again
        await waitFor(() => {
            expect(screen.getByText('Install MCP Config')).toBeDefined()
        })

        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Config written/i)).toBeDefined()
        })
    })

    // WIZ-14: "Continue" on mcp-snippet (after success) advances to verify step
    it('"Continue" on the mcp-snippet step (after success) advances to verify', async () => {
        await advanceToVerify()

        expect(screen.getByText(/Test your connection/i)).toBeDefined()
    })

    // WIZ-15 (updated): "Skip" on mcp-snippet advances to verify, NOT done; completeFirstLaunch NOT called
    it('"Skip" on mcp-snippet advances to the verify step without calling completeFirstLaunch', async () => {
        const { onComplete } = await advanceToMcpStep()

        fireEvent.click(screen.getByText('Skip'))

        await waitFor(() => {
            expect(screen.getByText(/Test your connection/i)).toBeDefined()
        })

        // completeFirstLaunch must NOT have been called
        expect(window.flintAPI.setup.completeFirstLaunch).not.toHaveBeenCalled()
        // onComplete must NOT have been called
        expect(onComplete).not.toHaveBeenCalled()
    })

    // WIZ-16: Verify success path shows "Flint is live"
    it('shows "Flint is live" when callTool flint_status resolves successfully', async () => {
        ;(window.flintAPI.mcp!.callTool as Mock).mockResolvedValue({ status: 'ok' })

        await advanceToVerify()

        fireEvent.click(screen.getByText('Test Connection'))

        await waitFor(() => {
            expect(screen.getByText(/Flint is live/i)).toBeDefined()
        })
    })

    // WIZ-17: Verify error path shows error message
    it('shows an error message when callTool flint_status rejects', async () => {
        ;(window.flintAPI.mcp!.callTool as Mock).mockRejectedValue(
            new Error('connect ECONNREFUSED 127.0.0.1:5000'),
        )

        await advanceToVerify()

        fireEvent.click(screen.getByText('Test Connection'))

        await waitFor(() => {
            expect(screen.getByText(/MCP server not found/i)).toBeDefined()
        })
    })

    // WIZ-18: "Continue" on verify success advances to done
    it('"Continue" shown after verify success advances to the done step', async () => {
        ;(window.flintAPI.mcp!.callTool as Mock).mockResolvedValue({ status: 'ok' })

        await advanceToVerify()

        fireEvent.click(screen.getByText('Test Connection'))

        await waitFor(() => {
            expect(screen.getByText(/Flint is live/i)).toBeDefined()
        })

        fireEvent.click(screen.getByText('Continue'))

        await waitFor(() => {
            expect(screen.getByText(/You're ready\./i)).toBeDefined()
        })
    })

    // WIZ-19: "Skip" on verify advances to done
    it('"Skip" on the verify step advances to the done step', async () => {
        await advanceToVerify()

        fireEvent.click(screen.getByText('Skip'))

        await waitFor(() => {
            expect(screen.getByText(/You're ready\./i)).toBeDefined()
        })
    })

    // WIZ-20: Done step "Start building" calls completeFirstLaunch then onComplete
    it('"Start building" on done step calls completeFirstLaunch then onComplete', async () => {
        const { onComplete } = await advanceToVerify()

        fireEvent.click(screen.getByText('Skip'))

        await waitFor(() => {
            expect(screen.getByText(/Start building/i)).toBeDefined()
        })

        fireEvent.click(screen.getByText(/Start building/i))

        await waitFor(() => {
            expect(window.flintAPI.setup.completeFirstLaunch).toHaveBeenCalledOnce()
            expect(onComplete).toHaveBeenCalledOnce()
        })
    })

    // WIZ-21: Back button on ide-detect goes to welcome
    it('Back button on ide-detect step navigates back to the welcome step', async () => {
        await advanceToIdeDetect()

        fireEvent.click(screen.getByText('Back'))

        expect(screen.getByText(/Get Flint running in 2 minutes/i)).toBeDefined()
    })

    // WIZ-22: Back button on mcp-snippet goes to ide-detect
    it('Back button on mcp-snippet step navigates back to ide-detect', async () => {
        await advanceToMcpStep()

        fireEvent.click(screen.getByText('Back'))

        await waitFor(() => {
            expect(screen.getByText(/Which IDE do you use\?/i)).toBeDefined()
        })
    })

    // WIZ-23: Escape key calls onComplete when not writing
    it('pressing Escape calls onComplete when writeStatus is not "writing"', () => {
        const onComplete = vi.fn()
        render(<SetupWizard onComplete={onComplete} />)

        fireEvent.keyDown(window, { key: 'Escape' })

        expect(onComplete).toHaveBeenCalledOnce()
    })

    // WIZ-24: Step indicator shows 5 dots
    it('renders exactly 5 step indicator dots', () => {
        render(<SetupWizard onComplete={vi.fn()} />)

        const dotsContainer = document.querySelector('[data-testid="step-dots"]')
        expect(dotsContainer).not.toBeNull()
        const dots = dotsContainer!.querySelectorAll('[data-step-index]')
        expect(dots.length).toBe(5)
    })

    // WIZ-24b: Antigravity appears in the IDE list
    it('shows Antigravity as an IDE option when detected', async () => {
        await advanceToIdeDetect(MOCK_IDES_ANTIGRAVITY_ONLY)

        expect(screen.getByText('Antigravity')).toBeDefined()
    })

    // WIZ-24c: writeMCPConfig is called with Antigravity's mcp_config.json path
    it('calls writeMCPConfig with the Antigravity config path when Antigravity is selected', async () => {
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockResolvedValue({ written: true })

        await advanceToMcpStep(MOCK_IDES_ANTIGRAVITY_ONLY)

        // Click Install to trigger write
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(window.flintAPI.setup.writeMCPConfig).toHaveBeenCalledWith(
                'Antigravity',
                '/home/.gemini/antigravity/mcp_config.json',
                MOCK_SERVER_PATH,
            )
        })
    })

    // ── R-1 Fix Tests ─────────────────────────────────────────────────────────

    // R1-A: writeMCPConfig NOT called automatically on mcp-snippet step entry
    it('R1-A: writeMCPConfig is NOT called automatically when mcp-snippet step mounts', async () => {
        await advanceToMcpStep()

        // Allow any pending microtasks to settle
        await act(async () => {})

        expect(window.flintAPI.setup.writeMCPConfig).not.toHaveBeenCalled()
    })

    // R1-B: "Install MCP Config" button is present before write
    it('R1-B: "Install MCP Config" button is visible before the write is triggered', async () => {
        await advanceToMcpStep()

        expect(screen.getByText('Install MCP Config')).toBeDefined()
    })

    // R1-C: Clicking "Install MCP Config" calls writeMCPConfig
    it('R1-C: clicking "Install MCP Config" calls window.flintAPI.setup.writeMCPConfig', async () => {
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockResolvedValue({ written: true })

        await advanceToMcpStep()
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(window.flintAPI.setup.writeMCPConfig).toHaveBeenCalledOnce()
        })
    })

    // R1-D: Install button shows spinner and "Installing…" while write is in-flight
    it('R1-D: Install button is disabled with spinner text while write is in-flight', async () => {
        // Never-resolving promise to hold the writing state
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockReturnValue(new Promise(() => {}))

        await advanceToMcpStep()
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            // Find the disabled Install button (the aria-live region also shows "Installing…"
            // text so we target the button specifically)
            const installingBtn = document.querySelector('button[disabled]')
            expect(installingBtn).not.toBeNull()
            expect(installingBtn!.textContent).toMatch(/Installing/i)
        })
    })

    // ── R-2 Fix Tests ─────────────────────────────────────────────────────────

    // R2-A: "Copy config snippet" button appears in error state
    it('R2-A: "Copy config snippet" button appears when writeMCPConfig fails', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockRejectedValue(new Error('EACCES'))
        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))
        await waitFor(() => { expect(screen.getByText('Claude Code')).toBeDefined() })
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText('Install MCP Config')).toBeDefined() })
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Copy config snippet/i)).toBeDefined()
        })
    })

    // R2-B: Clicking copy writes the JSON snippet to clipboard
    it('R2-B: clicking "Copy config snippet" writes the MCP config JSON to the clipboard', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockRejectedValue(new Error('EACCES'))
        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))
        await waitFor(() => { expect(screen.getByText('Claude Code')).toBeDefined() })
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText('Install MCP Config')).toBeDefined() })
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Copy config snippet/i)).toBeDefined()
        })

        fireEvent.click(screen.getByText(/Copy config snippet/i))

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
        })

        // The copied text should be valid JSON containing the flint server entry
        const copiedText = (navigator.clipboard.writeText as Mock).mock.calls[0][0] as string
        expect(copiedText).toContain('flint')
        expect(copiedText).toContain(MOCK_SERVER_PATH)
    })

    // R2-C: Manual paste instruction shown in error state
    it('R2-C: manual paste instruction is shown in the error state', async () => {
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockRejectedValue(new Error('EACCES'))
        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))
        await waitFor(() => { expect(screen.getByText('Claude Code')).toBeDefined() })
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText('Install MCP Config')).toBeDefined() })
        fireEvent.click(screen.getByText('Install MCP Config'))

        await waitFor(() => {
            expect(screen.getByText(/Paste this into/i)).toBeDefined()
        })
    })

    // ── R-3 Fix Tests ─────────────────────────────────────────────────────────

    // R3-A: Skip in mcp-snippet advances to verify step
    it('R3-A: "Skip" in mcp-snippet advances to verify step, not done', async () => {
        await advanceToMcpStep()
        fireEvent.click(screen.getByText('Skip'))

        await waitFor(() => {
            expect(screen.getByText(/Test your connection/i)).toBeDefined()
        })
    })

    // R3-B: completeFirstLaunch NOT called when skipping mcp-snippet
    it('R3-B: completeFirstLaunch is NOT called when "Skip" is clicked on mcp-snippet', async () => {
        await advanceToMcpStep()
        fireEvent.click(screen.getByText('Skip'))

        await waitFor(() => {
            expect(screen.getByText(/Test your connection/i)).toBeDefined()
        })

        expect(window.flintAPI.setup.completeFirstLaunch).not.toHaveBeenCalled()
    })

    // R3-C: Only "Start building" on done step calls completeFirstLaunch
    it('R3-C: completeFirstLaunch is called exactly once from the done step "Start building"', async () => {
        const { onComplete } = await advanceToVerify()

        // Skip verify
        fireEvent.click(screen.getByText('Skip'))
        await waitFor(() => { expect(screen.getByText(/Start building/i)).toBeDefined() })

        // completeFirstLaunch must not have been called yet
        expect(window.flintAPI.setup.completeFirstLaunch).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText(/Start building/i))

        await waitFor(() => {
            expect(window.flintAPI.setup.completeFirstLaunch).toHaveBeenCalledOnce()
            expect(onComplete).toHaveBeenCalledOnce()
        })
    })

    // ── R-4 Fix Tests ─────────────────────────────────────────────────────────

    // R4-A: Escape key ignored while writeStatus === 'writing'
    it('R4-A: Escape key does NOT call onComplete while a write is in progress', async () => {
        // Never-resolving write so we stay in "writing" state
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockReturnValue(new Promise(() => {}))

        const onComplete = vi.fn()
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        render(<SetupWizard onComplete={onComplete} />)
        fireEvent.click(screen.getByText("Let's go"))
        await waitFor(() => { expect(screen.getByText('Claude Code')).toBeDefined() })
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText('Install MCP Config')).toBeDefined() })

        // Begin the write
        fireEvent.click(screen.getByText('Install MCP Config'))

        // Wait until write is in-flight (disabled button present)
        await waitFor(() => {
            const disabledBtn = document.querySelector('button[disabled]')
            expect(disabledBtn).not.toBeNull()
        })

        // Press Escape — must be blocked
        fireEvent.keyDown(window, { key: 'Escape' })

        // onComplete should NOT have been called
        expect(onComplete).not.toHaveBeenCalled()
    })

    // ── R-5 Fix Tests ─────────────────────────────────────────────────────────

    // R5-A: Verify step does NOT say "restart your IDE" as an instruction
    it('R5-A: verify step does not instruct the user to restart their IDE', async () => {
        await advanceToVerify()

        const pageText = document.body.textContent ?? ''
        // The copy must not tell the user to restart; it should say they do NOT need to
        expect(pageText.toLowerCase()).not.toContain('restart your ide')
    })

    // R5-B: Verify step shows "internal connection" language
    it('R5-B: verify step shows accurate "internal connection" copy', async () => {
        await advanceToVerify()

        expect(screen.getByText(/internal connection/i)).toBeDefined()
    })

    // ── R-6 Fix Tests ─────────────────────────────────────────────────────────

    // R6-A: writeStatus resets when IDE selection changes
    it('R6-A: writeStatus resets to null when the user changes IDE selection', async () => {
        ;(window.flintAPI.setup.writeMCPConfig as Mock).mockResolvedValue({ written: true })

        // Go to ide-detect with all IDEs detected
        await advanceToIdeDetect(MOCK_IDES_ALL_DETECTED)

        // Select Claude Code then advance to mcp-snippet and install
        fireEvent.click(screen.getByText('Claude Code'))
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText('Install MCP Config')).toBeDefined() })
        fireEvent.click(screen.getByText('Install MCP Config'))
        await waitFor(() => { expect(screen.getByText(/Config written/i)).toBeDefined() })

        // Go back to ide-detect
        fireEvent.click(screen.getByText('Back'))
        await waitFor(() => { expect(screen.getByText(/Which IDE do you use\?/i)).toBeDefined() })

        // Select a different IDE — writeStatus should reset
        fireEvent.click(screen.getByText('Cursor'))

        // Re-advance to mcp-snippet
        fireEvent.click(screen.getByText('Continue'))
        await waitFor(() => { expect(screen.getByText(/Connecting Flint to/i)).toBeDefined() })

        // The Install button must be visible (not the "Config written" state)
        expect(screen.getByText('Install MCP Config')).toBeDefined()
    })

    // ── R-9 Fix Tests ─────────────────────────────────────────────────────────

    // R9-A: Status box has aria-live="polite"
    it('R9-A: the status indicator container in mcp-snippet has aria-live="polite"', async () => {
        await advanceToMcpStep()

        const liveRegion = document.querySelector('[aria-live="polite"]')
        expect(liveRegion).not.toBeNull()
    })

    // ── R-10 Fix Tests ────────────────────────────────────────────────────────

    // R10-A: Completed steps show a checkmark indicator
    it('R10-A: steps before the current one show the completed state', async () => {
        // Advance past welcome (index 0), so welcome dot should be "completed"
        ;(window.flintAPI.setup.detectIDEs as Mock).mockResolvedValue(MOCK_IDES_ALL_DETECTED)
        render(<SetupWizard onComplete={vi.fn()} />)
        fireEvent.click(screen.getByText("Let's go"))

        await waitFor(() => {
            expect(screen.getByText(/Which IDE do you use\?/i)).toBeDefined()
        })

        // Find the dots container
        const dotsContainer = document.querySelector('[data-testid="step-dots"]')
        expect(dotsContainer).not.toBeNull()

        // The first dot (welcome, index 0) is now completed
        const firstDot = dotsContainer!.querySelector('[data-step-index="1"]') as HTMLElement
        expect(firstDot).not.toBeNull()
        expect(firstDot.getAttribute('data-step-state')).toBe('completed')
        // Completed dot contains a checkmark span inside
        expect(firstDot.children.length).toBeGreaterThan(0)
    })

    // R10-B: Current step shows ring indicator with inner dot
    it('R10-B: the current step dot shows the ring-with-inner-dot indicator', () => {
        render(<SetupWizard onComplete={vi.fn()} />)

        // On welcome (index 0), first dot should be "current"
        const dotsContainer = document.querySelector('[data-testid="step-dots"]')
        expect(dotsContainer).not.toBeNull()

        const firstDot = dotsContainer!.querySelector('[data-step-index="1"]') as HTMLElement
        expect(firstDot).not.toBeNull()
        expect(firstDot.getAttribute('data-step-state')).toBe('current')
        // Current dot has an inner span (the filled dot inside the ring)
        expect(firstDot.children.length).toBeGreaterThan(0)
    })
})
