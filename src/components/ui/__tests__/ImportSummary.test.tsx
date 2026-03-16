/**
 * ImportSummary.test.tsx
 *
 * Phase ING.2 component tests — ING-15, ING-16, ING-17 (contract Section 9).
 *
 * ING-15: Import Summary toast renders with correct counts
 * ING-16: "Snap to token" IPC -> tier-2 item removed from store
 * ING-17: "Undo all heals" -> replaceWithPreHeal called, store cleared
 *
 * Additional coverage:
 *   - Toast auto-dismiss via timer
 *   - "Review" button opens panel mode
 *   - Panel renders all three sections (auto-healed, needs review, flagged)
 *   - "Dismiss" button clears store
 *   - All-clean state (no Review button)
 *   - Toast hidden when isPanelMode = true
 *
 * Test isolation:
 *   window.bridgeAPI is mocked via the global setup (src/components/__tests__/setup.ts).
 *   Zustand stores are reset in beforeEach via resetAllStores().
 *   The importSummaryStore is reset manually in each test that needs a specific state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { ImportSummaryToastMount, ImportSummaryPanelView } from '../ImportSummary'
import { useImportSummaryStore } from '../../../store/importSummaryStore'
import type { IngestionSummary, IngestionFix, IngestionFlag } from '../../../types/bridge-api'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFix(overrides: Partial<IngestionFix> = {}): IngestionFix {
    return {
        nodeId: 'node-1',
        ruleId: 'MITHRIL-COL-001',
        originalValue: '#3B82F6',
        fixedToToken: 'color.blue.500',
        fixedToClass: 'bg-blue-500',
        ...overrides,
    }
}

function makeFlag(overrides: Partial<IngestionFlag> = {}): IngestionFlag {
    return {
        nodeId: 'node-2',
        ruleId: 'MITHRIL-COL-001',
        originalValue: '#3A81F5',
        suggestedToken: 'color.blue.500',
        suggestedClass: 'bg-blue-500',
        distance: 0.4,
        distanceUnit: 'deltaE',
        ...overrides,
    }
}

function makeSummary(overrides: Partial<IngestionSummary> = {}): IngestionSummary {
    return {
        totalValues: 14,
        tier1Fixed: [makeFix()],
        tier2Flagged: [makeFlag()],
        tier3Unknown: 1,
        healTimeMs: 42,
        preHealCode: 'const X = () => <div />;',
        ...overrides,
    }
}

// ── Store helper ──────────────────────────────────────────────────────────────

function resetImportSummaryStore() {
    useImportSummaryStore.setState({
        summary: null,
        isVisible: false,
        isPanelMode: false,
    })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ImportSummaryToastMount', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetImportSummaryStore()
    })

    // Restore real timers after each test that uses fakes
    afterEach(() => {
        vi.useRealTimers()
    })

    // ING-15a: Toast renders when isVisible=true and isPanelMode=false
    it('renders the toast when the store has a visible summary in toast mode', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
        })
        render(<ImportSummaryToastMount />)

        // The "Imported" label should be present (toast variant)
        expect(screen.getByText('Imported')).toBeDefined()
    })

    // ING-15b: Toast renders correct counts for tier1, tier2, tier3
    it('shows the correct token count breakdown in the summary line', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({
                    tier1Fixed: [makeFix(), makeFix({ nodeId: 'node-1b' })],
                    tier2Flagged: [makeFlag()],
                    tier3Unknown: 2,
                })
            )
        })
        render(<ImportSummaryToastMount />)

        // Should contain counts for each tier
        const summaryEl = screen.getByRole('status')
        expect(summaryEl.textContent).toContain('2 auto-matched')
        expect(summaryEl.textContent).toContain('1 need review')
        expect(summaryEl.textContent).toContain('2 flagged')
    })

    // ING-15c: All-clean state — no Review button
    it('shows "All clean" with no Review button when tier2=0 and tier3=0', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [], tier3Unknown: 0 })
            )
        })
        render(<ImportSummaryToastMount />)

        expect(screen.getByText('All clean')).toBeDefined()
        expect(screen.queryByText('Review')).toBeNull()
    })

    // ING-15d: Toast is hidden when isPanelMode=true
    it('renders nothing when isPanelMode is true', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
            useImportSummaryStore.getState().openPanel()
        })
        const { container } = render(<ImportSummaryToastMount />)

        expect(container.firstChild).toBeNull()
    })

    // ING-15e: Toast is hidden when isVisible=false
    it('renders nothing when summary is not visible', () => {
        resetImportSummaryStore()
        const { container } = render(<ImportSummaryToastMount />)

        expect(container.firstChild).toBeNull()
    })

    // Toast auto-dismiss after 8s
    it('auto-dismisses after 8 seconds with no interaction', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
        })
        render(<ImportSummaryToastMount />)

        expect(screen.getByText('Imported')).toBeDefined()

        act(() => {
            vi.advanceTimersByTime(8000)
        })

        // Store should be cleared
        expect(useImportSummaryStore.getState().isVisible).toBe(false)
        expect(useImportSummaryStore.getState().summary).toBeNull()
    })

    // Review button opens panel mode
    it('clicking Review escalates to panel mode', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
        })
        render(<ImportSummaryToastMount />)

        const reviewBtn = screen.getByText('Review')
        act(() => {
            fireEvent.click(reviewBtn)
        })

        expect(useImportSummaryStore.getState().isPanelMode).toBe(true)
    })

    // Dismiss button clears the store
    it('clicking dismiss clears the summary', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
        })
        render(<ImportSummaryToastMount />)

        const dismissBtn = screen.getByLabelText('Dismiss import summary')
        act(() => {
            fireEvent.click(dismissBtn)
        })

        expect(useImportSummaryStore.getState().isVisible).toBe(false)
        expect(useImportSummaryStore.getState().summary).toBeNull()
    })
})

describe('ImportSummaryPanelView', () => {
    beforeEach(() => {
        resetImportSummaryStore()
    })

    // ING-15f: Panel renders all three sections
    it('renders auto-healed, needs review, and flagged sections', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
            useImportSummaryStore.getState().openPanel()
        })
        render(<ImportSummaryPanelView />)

        expect(screen.getByText(/Auto-healed \(1\)/i)).toBeDefined()
        expect(screen.getByText(/Needs review \(1\)/i)).toBeDefined()
        expect(screen.getByText(/Flagged \(1\)/i)).toBeDefined()
    })

    // ING-15g: Panel renders heal time in footer
    it('shows the heal time in the panel footer', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary({ healTimeMs: 142 }))
            useImportSummaryStore.getState().openPanel()
        })
        render(<ImportSummaryPanelView />)

        expect(screen.getByText('Healed in 142ms')).toBeDefined()
    })

    // ING-16: Snap button calls IPC and removes item from store
    it('clicking Snap calls bridgeAPI.importSummary.snapToToken and removes the item', async () => {
        const mockSnapToToken = vi.fn().mockResolvedValue({ ok: true })
        ;(window.bridgeAPI as any).importSummary = {
            snapToToken: mockSnapToToken,
            undoAllHeals: vi.fn().mockResolvedValue({ ok: true }),
            onSummary: vi.fn().mockReturnValue(() => {}),
            removeListeners: vi.fn(),
        }

        const flag = makeFlag({ nodeId: 'node-snap-test' })
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [flag] })
            )
            useImportSummaryStore.getState().openPanel()
        })
        render(<ImportSummaryPanelView />)

        const snapBtn = screen.getByLabelText(/snap .* to token/i)
        fireEvent.click(snapBtn)

        await waitFor(() => {
            expect(mockSnapToToken).toHaveBeenCalledWith({
                nodeId: 'node-snap-test',
                tokenPath: flag.suggestedToken,
                className: flag.suggestedClass,
                originalClass: flag.originalValue,
            })
        })

        await waitFor(() => {
            const remaining = useImportSummaryStore.getState().summary?.tier2Flagged ?? []
            expect(remaining.find((f) => f.nodeId === 'node-snap-test')).toBeUndefined()
        })
    })

    // ING-17: Undo all heals calls IPC and clears store
    it('clicking "Undo all heals" calls undoAllHeals IPC and clears summary', async () => {
        const mockUndoAllHeals = vi.fn().mockResolvedValue({ ok: true })
        ;(window.bridgeAPI as any).importSummary = {
            snapToToken: vi.fn().mockResolvedValue({ ok: true }),
            undoAllHeals: mockUndoAllHeals,
            onSummary: vi.fn().mockReturnValue(() => {}),
            removeListeners: vi.fn(),
        }

        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
            useImportSummaryStore.getState().openPanel()
        })
        render(<ImportSummaryPanelView />)

        const undoBtn = screen.getByLabelText('Undo all auto-healed token fixes')
        fireEvent.click(undoBtn)

        await waitFor(() => {
            expect(mockUndoAllHeals).toHaveBeenCalledWith('const X = () => <div />;')
        })

        await waitFor(() => {
            expect(useImportSummaryStore.getState().summary).toBeNull()
            expect(useImportSummaryStore.getState().isVisible).toBe(false)
        })
    })

    // Panel dismiss button clears store
    it('panel dismiss button clears the summary', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
            useImportSummaryStore.getState().openPanel()
        })
        render(<ImportSummaryPanelView />)

        const dismissBtn = screen.getByLabelText('Dismiss import summary')
        act(() => {
            fireEvent.click(dismissBtn)
        })

        expect(useImportSummaryStore.getState().isVisible).toBe(false)
    })

    // Panel shows nothing when no summary
    it('renders nothing when summary is null', () => {
        resetImportSummaryStore()
        const { container } = render(<ImportSummaryPanelView />)

        // Should render an empty container (no content)
        expect(container.querySelector('[aria-label="Import summary panel"]')).toBeNull()
    })

    // Large import auto-escalates to panel mode
    it('setSummary with > 10 tier1+tier2 items auto-escalates to panel mode', () => {
        const manyFixes = Array.from({ length: 8 }, (_, i) => makeFix({ nodeId: `node-${i}` }))
        const manyFlags = Array.from({ length: 4 }, (_, i) => makeFlag({ nodeId: `flag-${i}` }))
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier1Fixed: manyFixes, tier2Flagged: manyFlags })
            )
        })

        expect(useImportSummaryStore.getState().isPanelMode).toBe(true)
    })

    // removeTier2Item auto-closes when all resolved and tier3=0
    it('auto-closes panel when last tier-2 item is snapped and tier3=0', () => {
        const flag = makeFlag({ nodeId: 'last-flag' })
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [flag], tier3Unknown: 0 })
            )
            useImportSummaryStore.getState().openPanel()
        })

        act(() => {
            useImportSummaryStore.getState().removeTier2Item('last-flag')
        })

        expect(useImportSummaryStore.getState().isVisible).toBe(false)
        expect(useImportSummaryStore.getState().summary).toBeNull()
    })
})
