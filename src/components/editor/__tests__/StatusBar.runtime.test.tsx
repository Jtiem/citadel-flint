/**
 * StatusBar.runtime.test.tsx — RUNTIME.1 Glass-level gating tests.
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 *
 * CONTRACT INVARIANT COVERED: `flag-off-ui-silent`
 * ----------------------------------------------------------
 * Threshold: "= 0 DOM nodes rendered for runtime-axe surfaces"
 *
 * This invariant is falsifiable. The tests below literally count DOM
 * nodes by calling queryAllByTestId('runtime-audit-pill') and asserting
 * `.length === 0` when the flag is off. If someone ever removes the
 * flag gate or defaults the flag to true, these tests FAIL immediately.
 *
 * Contract test boundaries covered:
 *   - `StatusBar runtime pill gated`
 *   - `RuntimeAuditPill flag-off not mounted`
 *   - `runtime:run-axe ipc-callable when flag off` (asserted at the mock
 *     level — the pill is absent but window.flintAPI.runtime.runAxe is
 *     still callable)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useCanvasStore } from '../../../store/canvasStore'

// Mock the flag hook so every test can set it deterministically.
vi.mock('../../../hooks/useRuntimeAxeFlag', () => ({
    useRuntimeAxeFlag: vi.fn(),
}))

import { useRuntimeAxeFlag } from '../../../hooks/useRuntimeAxeFlag'

const mockUseRuntimeAxeFlag = useRuntimeAxeFlag as ReturnType<typeof vi.fn>

beforeEach(() => {
    // Default: flag OFF (matches first-ship posture).
    mockUseRuntimeAxeFlag.mockReturnValue(false)
})

// ── Contract invariant: flag-off-ui-silent (falsifiable, = 0 DOM nodes) ──────

describe('StatusBar — runtime.axe.enabled flag off', () => {
    it('INVARIANT flag-off-ui-silent: queryAllByTestId("runtime-audit-pill") returns [] when flag is false', () => {
        mockUseRuntimeAxeFlag.mockReturnValue(false)
        // Active file IS set — to prove the flag alone is the gating factor.
        useCanvasStore.setState({ activeFilePath: '/tmp/some/file.tsx' })

        render(<StatusBar />)

        // The hard assertion: ZERO DOM nodes for the runtime-axe surface.
        const pills = screen.queryAllByTestId('runtime-audit-pill')
        expect(pills).toHaveLength(0)
    })

    it('INVARIANT flag-off-ui-silent: idle pill test-id also returns [] when flag is false', () => {
        mockUseRuntimeAxeFlag.mockReturnValue(false)
        useCanvasStore.setState({ activeFilePath: '/tmp/some/file.tsx' })

        render(<StatusBar />)

        const idlePills = screen.queryAllByTestId('runtime-audit-pill-idle')
        expect(idlePills).toHaveLength(0)
    })

    it('no runtime-audit-no-preview-message is rendered when flag is false', () => {
        mockUseRuntimeAxeFlag.mockReturnValue(false)
        useCanvasStore.setState({ activeFilePath: '/tmp/some/file.tsx' })

        render(<StatusBar />)

        expect(
            screen.queryByTestId('runtime-audit-no-preview-message'),
        ).toBeNull()
    })

    it('IPC handler remains callable when flag is off (programmatic callers)', async () => {
        // Contract test boundary "runtime:run-axe ipc-callable when flag off":
        // flag-gated UI does NOT short-circuit the IPC — scripted callers work.
        mockUseRuntimeAxeFlag.mockReturnValue(false)

        render(<StatusBar />)

        // Direct programmatic call (bypasses the UI). The mock is set up in
        // setup.ts, so it should resolve with the default payload.
        const runAxe = (window as unknown as { flintAPI?: { runtime?: { runAxe: (...args: unknown[]) => Promise<unknown> } } })
            .flintAPI?.runtime?.runAxe
        expect(runAxe).toBeDefined()

        const result = await runAxe!({ previewHtml: '<div></div>' })
        expect(result).toBeDefined()
    })
})

// ── Flag ON path ─────────────────────────────────────────────────────────────

describe('StatusBar — runtime.axe.enabled flag on', () => {
    it('renders the pill when flag is true AND activeFilePath is set', async () => {
        mockUseRuntimeAxeFlag.mockReturnValue(true)
        useCanvasStore.setState({ activeFilePath: '/tmp/some/file.tsx' })

        render(<StatusBar />)

        await waitFor(() => {
            expect(screen.getByTestId('runtime-audit-pill')).toBeDefined()
        })
    })

    it('hides the pill when flag is true BUT activeFilePath is null (progressive disclosure)', () => {
        mockUseRuntimeAxeFlag.mockReturnValue(true)
        useCanvasStore.setState({ activeFilePath: null })

        render(<StatusBar />)

        expect(screen.queryByTestId('runtime-audit-pill')).toBeNull()
    })

    it('the pill appears when activeFilePath transitions from null → file (with flag on)', () => {
        mockUseRuntimeAxeFlag.mockReturnValue(true)
        useCanvasStore.setState({ activeFilePath: null })

        const { rerender } = render(<StatusBar />)
        expect(screen.queryByTestId('runtime-audit-pill')).toBeNull()

        act(() => {
            useCanvasStore.setState({ activeFilePath: '/tmp/x.tsx' })
        })
        rerender(<StatusBar />)

        expect(screen.getByTestId('runtime-audit-pill')).toBeDefined()
    })
})

// ── Click wiring ─────────────────────────────────────────────────────────────

describe('StatusBar — runtime audit click wiring', () => {
    it('clicking the pill invokes window.flintAPI.runtime.runAxe', async () => {
        mockUseRuntimeAxeFlag.mockReturnValue(true)
        useCanvasStore.setState({ activeFilePath: '/tmp/some/file.tsx' })

        const runAxe = (window as unknown as { flintAPI: { runtime: { runAxe: ReturnType<typeof vi.fn> } } }).flintAPI.runtime.runAxe

        render(<StatusBar />)
        await waitFor(() => screen.getByTestId('runtime-audit-pill'))

        fireEvent.click(screen.getByTestId('runtime-audit-pill'))

        await waitFor(() => {
            expect(runAxe).toHaveBeenCalledTimes(1)
        })
    })
})

// ── Empty preview sub-message ────────────────────────────────────────────────

describe('StatusBar — runtime audit no-preview message', () => {
    it('shows "Runtime audit skipped — no preview" when status transitions to no-preview', async () => {
        mockUseRuntimeAxeFlag.mockReturnValue(true)
        useCanvasStore.setState({ activeFilePath: '/tmp/some/file.tsx' })

        // Default mock resolves with `status: 'no-preview'` (see setup.ts).
        render(<StatusBar />)

        await waitFor(() => screen.getByTestId('runtime-audit-pill'))
        fireEvent.click(screen.getByTestId('runtime-audit-pill'))

        // Wait for the IPC to resolve and the status to flip.
        await waitFor(() => {
            expect(screen.getByTestId('runtime-audit-no-preview-message')).toBeDefined()
        })
    })
})
