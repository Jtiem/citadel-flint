/**
 * ExportModal.test.tsx — src/components/ui/__tests__/ExportModal.test.tsx
 *
 * Tests for the Export Gate modal (Phase B.2, B.1-d).
 *
 * Covers:
 *   - Header states: All Clear / Blocked / Critical
 *   - Violation counts and rows (Mithril, A11y, Property Overrides)
 *   - Severity badge coloring
 *   - Copy Source button availability
 *   - Node ID click: setSelectedNode + setActiveSelection
 *   - Keyboard / backdrop / close-button dismissal
 *   - Loading state
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportModal } from '../ExportModal'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { LinterWarning, OverrideRow } from '../../../types/flint-api'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-abc',
        type: 'color-drift',
        severity: 'amber',
        value: 5,
        message: 'Color drift detected',
        nearestToken: 'zinc-900',
        nearestTokenValue: '#18181b',
        ...overrides,
    }
}

function makeOverride(overrides: Partial<OverrideRow> = {}): OverrideRow {
    return {
        flint_id: 'abc123',
        property_key: 'color',
        property_value: '#ff0000',
        updated_at: Date.now(),
        ...overrides,
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Ensure readOverrides resolves immediately to empty by default
    ;(window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExportModal', () => {
    describe('header states', () => {
        it('renders "All Clear" header when there are no violations', async () => {
            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText(/All Clear/i)).toBeDefined()
            })
        })

        it('renders "Blocked" header when Mithril violations exist', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([['node-abc', makeWarning()]]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-abc'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText(/Blocked/i)).toBeDefined()
            })
        })

        it('renders "Critical" header when a warning has severity === "critical"', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-abc', makeWarning({ severity: 'critical', value: 15 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-abc'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText(/Critical Violations/i)).toBeDefined()
            })
        })

        it('renders "Blocked" header when a warning has value > 10 but severity is amber', async () => {
            // hasCriticalMithril checks severity === 'critical', not value > 10.
            // A warning with severity 'amber' and value 11 does NOT escalate to Critical.
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-abc', makeWarning({ severity: 'amber', value: 11 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-abc'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText(/Blocked/i)).toBeDefined()
            })
        })
    })

    describe('violation counts', () => {
        it('shows the correct total violation count in the subtitle', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([['node-abc', makeWarning()]]),
            })
            useCanvasStore.setState({
                mithrilViolations: ['node-abc'],
                a11yViolations: { 'node-def': ['A11Y-001: Missing alt'] },
            })
            ;(window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeOverride(),
            ])

            render(<ExportModal onClose={() => undefined} />)
            // Each violation type renders its own section header with a count.
            // Total = 1 mithril + 1 a11y + 1 override, shown as separate section headers.
            await waitFor(() => {
                expect(screen.getByText(/Mithril Violations \(1\)/i)).toBeDefined()
                expect(screen.getByText(/Accessibility Violations \(1\)/i)).toBeDefined()
                expect(screen.getByText(/Property Overrides \(1\)/i)).toBeDefined()
            })
        })
    })

    describe('violation rows', () => {
        it('renders a Mithril violation row with the node ID', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([['node-abc', makeWarning()]]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-abc'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText('node-abc')).toBeDefined()
            })
        })

        it('renders an A11y violation row with the flint ID', async () => {
            useCanvasStore.setState({
                a11yViolations: { 'node-def': ['A11Y-001: img must have alt text'] },
            })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText('node-def')).toBeDefined()
                expect(screen.getByText(/A11Y-001/)).toBeDefined()
            })
        })

        it('renders property override rows when readOverrides returns data', async () => {
            ;(window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeOverride({ flint_id: 'override-node', property_key: 'bg-color', property_value: 'red' }),
            ])

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText('override-node')).toBeDefined()
                expect(screen.getByText('bg-color')).toBeDefined()
            })
        })
    })

    describe('severity badge coloring', () => {
        it('critical row has text-red-300 badge', async () => {
            // The per-row Critical badge uses text-red-300 (not text-red-400).
            // text-red-400 is only used on the ShieldAlert icon in the header.
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-crit', makeWarning({ id: 'node-crit', severity: 'critical', value: 12 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-crit'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                // There may be two "Critical" spans (section header + row badge); getAllByText handles that.
                const badges = screen.getAllByText('Critical', { selector: 'span' })
                // At least one badge must carry the row-level red-300 class
                expect(badges.some((b) => b.className.includes('text-red-300'))).toBe(true)
            })
        })

        it('amber row node-ID button has text-amber-400 class', async () => {
            // Amber violations render the node ID as an amber-coloured button;
            // there is no standalone "Amber" badge text in the component.
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-amb', makeWarning({ id: 'node-amb', severity: 'amber', value: 5 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-amb'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                const nodeBtn = screen.getByText('node-amb', { selector: 'button' })
                expect(nodeBtn.className).toContain('text-amber-400')
            })
        })
    })

    describe('Copy Source button', () => {
        it('is visible when there are no violations', async () => {
            // The Copy Source button in the footer has no aria-label; it uses button text.
            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText('Copy Source')).toBeDefined()
            })
        })

        it('is hidden when violations are present', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([['node-abc', makeWarning()]]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-abc'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.queryByLabelText('Copy source')).toBeNull()
            })
        })
    })

    describe('node ID click', () => {
        it('calls setSelectedNode and setActiveSelection with the node ID, then closes', async () => {
            const onClose = vi.fn()
            const setSelectedNode = vi.fn()
            const setActiveSelection = vi.fn()

            useEditorStore.setState({
                linterWarnings: new Map([['node-abc', makeWarning()]]),
                setSelectedNode,
            })
            useCanvasStore.setState({
                mithrilViolations: ['node-abc'],
                setActiveSelection,
            })

            render(<ExportModal onClose={onClose} />)
            await waitFor(() => {
                expect(screen.getByText('node-abc')).toBeDefined()
            })

            fireEvent.click(screen.getByText('node-abc'))

            expect(setSelectedNode).toHaveBeenCalledWith('node-abc')
            expect(setActiveSelection).toHaveBeenCalledWith('node-abc')
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    describe('dismissal', () => {
        it('calls onClose when Escape key is pressed', async () => {
            const onClose = vi.fn()
            render(<ExportModal onClose={onClose} />)
            // The close button with aria-label is present once the component mounts.
            // The backdrop div has no role="dialog" — use the close button as the ready signal.
            await waitFor(() => screen.getByLabelText('Close export modal'))

            fireEvent.keyDown(window, { key: 'Escape' })
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('calls onClose when the backdrop is clicked', async () => {
            const onClose = vi.fn()
            const { container } = render(<ExportModal onClose={onClose} />)
            await waitFor(() => screen.getByLabelText('Close export modal'))

            // The backdrop is the outermost div rendered by ExportModal.
            const backdrop = container.firstChild as HTMLElement
            fireEvent.click(backdrop)
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('calls onClose when the close button in the header is clicked', async () => {
            const onClose = vi.fn()
            render(<ExportModal onClose={onClose} />)
            await waitFor(() => screen.getByLabelText('Close export modal'))

            fireEvent.click(screen.getByLabelText('Close export modal'))
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    describe('loading state', () => {
        it('shows "Running pre-flight audit" text initially before overrides resolve', () => {
            // Use a promise that never resolves so we stay in loading state
            ;(window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockReturnValue(
                new Promise(() => undefined)
            )

            render(<ExportModal onClose={() => undefined} />)
            expect(screen.getByText(/Running pre-flight audit/i)).toBeDefined()
        })
    })
})
