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
import type { LinterWarning, OverrideRow } from '../../../types/bridge-api'

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
        bridge_id: 'abc123',
        property_key: 'color',
        property_value: '#ff0000',
        updated_at: Date.now(),
        ...overrides,
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Ensure readOverrides resolves immediately to empty by default
    ;(window.bridgeAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([])
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

        it('renders "Critical" header when a warning has value > 10', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-abc', makeWarning({ severity: 'amber', value: 11 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-abc'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText(/Critical Violations/i)).toBeDefined()
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
            ;(window.bridgeAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeOverride(),
            ])

            render(<ExportModal onClose={() => undefined} />)
            // Total = 1 mithril + 1 a11y + 1 override = 3 issues
            await waitFor(() => {
                expect(screen.getByText(/3 issues found/i)).toBeDefined()
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

        it('renders an A11y violation row with the bridge ID', async () => {
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
            ;(window.bridgeAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([
                makeOverride({ bridge_id: 'override-node', property_key: 'bg-color', property_value: 'red' }),
            ])

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByText('override-node')).toBeDefined()
                expect(screen.getByText('bg-color')).toBeDefined()
            })
        })
    })

    describe('severity badge coloring', () => {
        it('critical row has text-red-400 badge', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-crit', makeWarning({ id: 'node-crit', severity: 'critical', value: 12 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-crit'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                const badge = screen.getByText('Critical', { selector: 'span' })
                expect(badge.className).toContain('text-red-400')
            })
        })

        it('amber row has text-amber-400 badge', async () => {
            useEditorStore.setState({
                linterWarnings: new Map([
                    ['node-amb', makeWarning({ id: 'node-amb', severity: 'amber', value: 5 })],
                ]),
            })
            useCanvasStore.setState({ mithrilViolations: ['node-amb'] })

            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                const badge = screen.getByText('Amber', { selector: 'span' })
                expect(badge.className).toContain('text-amber-400')
            })
        })
    })

    describe('Copy Source button', () => {
        it('is visible when there are no violations', async () => {
            render(<ExportModal onClose={() => undefined} />)
            await waitFor(() => {
                expect(screen.getByLabelText('Copy source')).toBeDefined()
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
            await waitFor(() => screen.getByRole('dialog'))

            fireEvent.keyDown(window, { key: 'Escape' })
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('calls onClose when the backdrop is clicked', async () => {
            const onClose = vi.fn()
            render(<ExportModal onClose={onClose} />)
            const dialog = await waitFor(() => screen.getByRole('dialog'))

            // Click the outer backdrop element itself
            fireEvent.click(dialog)
            expect(onClose).toHaveBeenCalledOnce()
        })

        it('calls onClose when the close button in the header is clicked', async () => {
            const onClose = vi.fn()
            render(<ExportModal onClose={onClose} />)
            await waitFor(() => screen.getByRole('dialog'))

            fireEvent.click(screen.getByLabelText('Close export modal'))
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    describe('loading state', () => {
        it('shows "Running pre-flight audit" text initially before overrides resolve', () => {
            // Use a promise that never resolves so we stay in loading state
            ;(window.bridgeAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockReturnValue(
                new Promise(() => undefined)
            )

            render(<ExportModal onClose={() => undefined} />)
            expect(screen.getByText(/Running pre-flight audit/i)).toBeDefined()
        })
    })
})
