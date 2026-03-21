/**
 * ImportAuditToast.test.tsx
 *
 * Verifies that ImportAuditToast reads from importSummaryStore (not canvasStore)
 * and correctly maps tier2Flagged + tier3Unknown to the warning display.
 *
 * Covers:
 *   - Toast renders when importSummaryStore has visible summary with tier2/tier3 warnings
 *   - Toast renders nothing when no summary is present
 *   - Toast renders nothing when tier2 and tier3 are both zero
 *   - Dismiss button calls importSummaryStore.dismiss()
 *   - Auto-dismiss after 8 seconds clears via importSummaryStore.dismiss()
 *   - Summary text reflects tier2 + tier3 counts
 *   - canvasStore is NOT consulted (no lastImportWarnings / clearImportWarnings)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import ImportAuditToast from '../ImportAuditToast'
import { useImportSummaryStore } from '../../../store/importSummaryStore'
import type { IngestionSummary, IngestionFix, IngestionFlag } from '../../../types/flint-api'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFix(nodeId = 'node-fix-1'): IngestionFix {
    return {
        nodeId,
        ruleId: 'MITHRIL-COL-001',
        originalValue: '#3B82F6',
        fixedToToken: 'color.blue.500',
        fixedToClass: 'bg-blue-500',
    }
}

function makeFlag(nodeId = 'node-flag-1'): IngestionFlag {
    return {
        nodeId,
        ruleId: 'MITHRIL-COL-001',
        originalValue: '#3A81F5',
        suggestedToken: 'color.blue.500',
        suggestedClass: 'bg-blue-500',
        distance: 0.4,
        distanceUnit: 'deltaE',
    }
}

function makeSummary(overrides: Partial<IngestionSummary> = {}): IngestionSummary {
    return {
        totalValues: 10,
        tier1Fixed: [makeFix()],
        tier2Flagged: [makeFlag()],
        tier3Unknown: 1,
        healTimeMs: 42,
        preHealCode: 'const X = () => <div />;',
        ...overrides,
    }
}

// ── Store reset helper ─────────────────────────────────────────────────────────

function resetStore() {
    useImportSummaryStore.setState({
        summary: null,
        isVisible: false,
        isPanelMode: false,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ImportAuditToast', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        resetStore()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders nothing when importSummaryStore has no summary', () => {
        const { container } = render(<ImportAuditToast />)
        expect(container.firstChild).toBeNull()
    })

    it('renders nothing when summary is visible but tier2 and tier3 are both zero', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [], tier3Unknown: 0 })
            )
        })
        const { container } = render(<ImportAuditToast />)
        expect(container.firstChild).toBeNull()
    })

    it('renders the toast when tier2Flagged has items', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [makeFlag()], tier3Unknown: 0 })
            )
        })
        render(<ImportAuditToast />)

        expect(screen.getByRole('status')).toBeDefined()
        expect(screen.getByText('Import complete — non-aligned values')).toBeDefined()
    })

    it('renders the toast when tier3Unknown is non-zero', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [], tier3Unknown: 3 })
            )
        })
        render(<ImportAuditToast />)

        expect(screen.getByRole('status')).toBeDefined()
        // tier3Unknown = 3 → "3 values unmatched"
        const status = screen.getByRole('status')
        expect(status.textContent).toContain('unmatched')
    })

    it('shows tier2 count in the summary text', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({
                    tier2Flagged: [makeFlag('n1'), makeFlag('n2'), makeFlag('n3')],
                    tier3Unknown: 0,
                })
            )
        })
        render(<ImportAuditToast />)

        const status = screen.getByRole('status')
        expect(status.textContent).toContain('3 values need review')
    })

    it('shows both tier2 and tier3 counts when both are non-zero', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({
                    tier2Flagged: [makeFlag()],
                    tier3Unknown: 2,
                })
            )
        })
        render(<ImportAuditToast />)

        const status = screen.getByRole('status')
        expect(status.textContent).toContain('need review')
        expect(status.textContent).toContain('unmatched')
    })

    it('clicking dismiss calls importSummaryStore.dismiss()', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
        })
        render(<ImportAuditToast />)

        const dismissBtn = screen.getByLabelText('Dismiss import warning')
        act(() => {
            fireEvent.click(dismissBtn)
        })

        // After dismiss, the store should be cleared
        expect(useImportSummaryStore.getState().isVisible).toBe(false)
        expect(useImportSummaryStore.getState().summary).toBeNull()
    })

    it('auto-dismisses after 8 seconds via importSummaryStore.dismiss()', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(makeSummary())
        })
        render(<ImportAuditToast />)

        // Toast is visible before timer fires
        expect(screen.getByRole('status')).toBeDefined()

        act(() => {
            vi.advanceTimersByTime(8000)
        })

        // Store should be cleared by dismiss()
        expect(useImportSummaryStore.getState().isVisible).toBe(false)
        expect(useImportSummaryStore.getState().summary).toBeNull()
    })

    it('does not read lastImportWarnings from canvasStore — canvasStore has no such field', async () => {
        // This test documents that the canvasStore has no lastImportWarnings.
        // If someone adds it by mistake, this test should alert them via
        // TypeScript — here we verify at runtime the field is undefined.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const canvasState = (await import('../../../store/canvasStore')).useCanvasStore.getState() as any
        expect(canvasState.lastImportWarnings).toBeUndefined()
        expect(canvasState.clearImportWarnings).toBeUndefined()
    })

    it('renders a singular summary when exactly one tier2 item exists', () => {
        act(() => {
            useImportSummaryStore.getState().setSummary(
                makeSummary({ tier2Flagged: [makeFlag()], tier3Unknown: 0 })
            )
        })
        render(<ImportAuditToast />)

        const status = screen.getByRole('status')
        // "1 value needs review" (singular)
        expect(status.textContent).toContain('1 value need review')
    })
})
