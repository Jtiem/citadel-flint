/**
 * StatusBar.fixtureContext.test.tsx — FIXTURE.1 Glass-level pill tests.
 *
 * Contract source: .flint-context/contracts/FIXTURE.1-contract.md
 *
 * Post-UX-review (2026-04-19) behavior:
 *   - Truncation is CSS-only (max-w-[160px] truncate); the DOM carries the FULL
 *     label, not a sliced string. Screen-reader and copy-paste stay honest.
 *   - Visible prefix "Context · " frames the pill as an audit-context signal
 *     rather than a brand badge (WARN-2 fix).
 *   - Pill is focusable (tabIndex=0) so keyboard users can reveal the native
 *     tooltip on focus (SUG-1 fix).
 *   - title attribute unconditionally carries the full label + surface.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Mock hooks that StatusBar depends on ─────────────────────────────────────

vi.mock('../../../hooks/useRuntimeAxeFlag', () => ({
    useRuntimeAxeFlag: vi.fn().mockReturnValue(false),
}))

vi.mock('../../../hooks/useRuntimeAudit', () => ({
    useRuntimeAudit: vi.fn().mockReturnValue({ status: 'idle', result: null, run: vi.fn() }),
}))

vi.mock('../../../hooks/useOnboardingTooltip', () => ({
    useOnboardingTooltip: vi.fn().mockReturnValue({ shouldShow: false, dismiss: vi.fn() }),
}))

// ── Reset canvasStore before each test ────────────────────────────────────────

beforeEach(() => {
    useCanvasStore.setState({
        latestAudit: null,
        mithrilViolations: [],
        a11yViolations: {},
        overridesExist: false,
        activeFilePath: null,
        ideSyncActive: false,
    })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderStatusBar() {
    return render(<StatusBar />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditContextPill (FIXTURE.1)', () => {
    it('renders pill with full fixture label when fixtureContext.label is present', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: 'MUI demo context',
                    source: '/project/demos/figma-d2c/.flint-fixture.json',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill).toBeDefined()
        // Post-UX-fix: full label is in the DOM (CSS handles visual truncation)
        expect(pill.textContent).toContain('MUI demo context')
        // Context prefix makes the pill read as an audit-context signal, not a brand
        expect(pill.textContent).toContain('Context')
    })

    it('is renderless (zero DOM nodes) when latestAudit is null', () => {
        useCanvasStore.setState({ latestAudit: null })

        renderStatusBar()

        expect(screen.queryByTestId('audit-context-pill')).toBeNull()
    })

    it('is renderless when latestAudit has no fixtureContext', () => {
        useCanvasStore.setState({ latestAudit: {} })

        renderStatusBar()

        expect(screen.queryByTestId('audit-context-pill')).toBeNull()
    })

    it('is renderless when fixtureContext.label is undefined', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    source: '/project/demos/.flint-fixture.json',
                    // label intentionally absent
                },
            },
        })

        renderStatusBar()

        expect(screen.queryByTestId('audit-context-pill')).toBeNull()
    })

    it('tooltip carries full label + surface when surface is present', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: 'Short',
                    source: '/project/.flint-fixture.json',
                    surface: 'component',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill.getAttribute('title')).toBe('Short · Surface: component')
    })

    it('tooltip carries full label when label is long (CSS truncation does NOT drop from title)', () => {
        const longLabel = 'Mithril shadow audit demo context'
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: longLabel,
                    source: '/project/demos/03-mithril-shadow-audit/.flint-fixture.json',
                    surface: 'component',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        // DOM carries the full label (CSS truncates visually via max-w + truncate)
        expect(pill.textContent).toContain(longLabel)
        const title = pill.getAttribute('title') ?? ''
        expect(title).toContain(longLabel)
        expect(title).toContain('Surface: component')
    })

    it('aria-label is always the full label (not truncated)', () => {
        const fullLabel = 'MUI demo context'
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: fullLabel,
                    source: '/project/.flint-fixture.json',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill.getAttribute('aria-label')).toBe(`Audit context: ${fullLabel}`)
    })

    it('pill has role="status" for screen reader announcement (Commandment 5)', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: 'Test label',
                    source: '/project/.flint-fixture.json',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByRole('status', { hidden: false })
        expect(pill).toBeDefined()
        expect(pill.getAttribute('data-testid')).toBe('audit-context-pill')
    })

    it('pill is focusable for keyboard users (FIXTURE.1-UX-SUG-1)', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: 'Keyboard check',
                    source: '/project/.flint-fixture.json',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill.getAttribute('tabIndex')).toBe('0')
    })

    it('short label + no surface shows bare label in tooltip', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: 'MUI',
                    source: '/project/.flint-fixture.json',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill.getAttribute('title')).toBe('MUI')
        expect(pill.textContent).toContain('MUI')
    })

    it('short label with surface shows "<label> · Surface: <surface>" in tooltip', () => {
        useCanvasStore.setState({
            latestAudit: {
                fixtureContext: {
                    label: 'MUI',
                    source: '/project/.flint-fixture.json',
                    surface: 'document',
                },
            },
        })

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill.getAttribute('title')).toBe('MUI · Surface: document')
        expect(pill.textContent).toContain('MUI')
    })

    // SUG-2: Integration test that exercises the MCP → store → UI data path
    // via the `setLatestAudit` action (the production entry point).
    it('setLatestAudit action drives the pill render (MCP → store → UI data path)', () => {
        const mockAuditResponse = {
            fixtureContext: {
                label: 'Action-driven context',
                source: '/project/.flint-fixture.json',
                surface: 'component' as const,
            },
        }

        // Call the real store action — not setState — so the public contract
        // surface (setLatestAudit) is exercised end-to-end.
        useCanvasStore.getState().setLatestAudit(mockAuditResponse)

        renderStatusBar()

        const pill = screen.getByTestId('audit-context-pill')
        expect(pill.textContent).toContain('Action-driven context')
        expect(pill.getAttribute('title')).toBe('Action-driven context · Surface: component')
    })
})
