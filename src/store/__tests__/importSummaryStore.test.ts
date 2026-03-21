/**
 * importSummaryStore.test.ts — src/store/__tests__/importSummaryStore.test.ts
 *
 * State transition tests for the Phase ING.2 importSummaryStore.
 *
 * Covers:
 *   - setSummary: sets summary, isVisible=true, auto-escalates to panel on > 10 items
 *   - dismiss: clears summary, isVisible=false, isPanelMode=false
 *   - openPanel: sets isPanelMode=true without touching summary or isVisible
 *   - removeTier2Item: removes correct item, auto-dismisses when all clean
 *   - replaceWithPreHeal: clears all state (summary, visible, panel)
 *   - hasTier2Items: derived selector correctness
 *   - isAllClean: derived selector correctness
 *   - Edge cases: empty state, null summary, no-op on missing nodeId
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useImportSummaryStore } from '../importSummaryStore'
import type { IngestionSummary, IngestionFix, IngestionFlag } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFix(nodeId: string): IngestionFix {
    return {
        nodeId,
        ruleId: 'MITHRIL-COL',
        originalValue: '#3B82F6',
        fixedToToken: 'color.blue.500',
        fixedToClass: 'bg-blue-500',
    }
}

function makeFlag(nodeId: string, distance = 0.8): IngestionFlag {
    return {
        nodeId,
        ruleId: 'MITHRIL-COL',
        originalValue: '#3A81F5',
        suggestedToken: 'color.blue.500',
        suggestedClass: 'bg-blue-500',
        distance,
        distanceUnit: 'deltaE',
    }
}

function makeSummary(overrides: Partial<IngestionSummary> = {}): IngestionSummary {
    return {
        totalValues: 3,
        tier1Fixed: [makeFix('node-1')],
        tier2Flagged: [makeFlag('node-2')],
        tier3Unknown: 0,
        healTimeMs: 45,
        preHealCode: 'const App = () => <div className="bg-[#3B82F6]" />;',
        ...overrides,
    }
}

// Reset store before each test
beforeEach(() => {
    useImportSummaryStore.setState({
        summary: null,
        isVisible: false,
        isPanelMode: false,
    })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImportSummaryStore', () => {
    describe('initial state', () => {
        it('starts with null summary', () => {
            const { summary } = useImportSummaryStore.getState()
            expect(summary).toBeNull()
        })

        it('starts hidden', () => {
            const { isVisible } = useImportSummaryStore.getState()
            expect(isVisible).toBe(false)
        })

        it('starts in toast mode (not panel)', () => {
            const { isPanelMode } = useImportSummaryStore.getState()
            expect(isPanelMode).toBe(false)
        })
    })

    describe('setSummary', () => {
        it('sets the summary and makes the UI visible', () => {
            const { setSummary } = useImportSummaryStore.getState()
            const summary = makeSummary()

            setSummary(summary)

            const state = useImportSummaryStore.getState()
            expect(state.summary).toEqual(summary)
            expect(state.isVisible).toBe(true)
        })

        it('defaults to toast mode when tier1 + tier2 count <= 10', () => {
            const { setSummary } = useImportSummaryStore.getState()
            // 1 tier1 + 1 tier2 = 2 items — toast mode
            setSummary(makeSummary())

            const { isPanelMode } = useImportSummaryStore.getState()
            expect(isPanelMode).toBe(false)
        })

        it('auto-escalates to panel mode when tier1 + tier2 count > 10', () => {
            const { setSummary } = useImportSummaryStore.getState()
            const tier1Fixed = Array.from({ length: 8 }, (_, i) => makeFix(`node-t1-${i}`))
            const tier2Flagged = Array.from({ length: 4 }, (_, i) => makeFlag(`node-t2-${i}`))
            // 8 + 4 = 12 items — panel mode

            setSummary(makeSummary({ tier1Fixed, tier2Flagged }))

            const { isPanelMode } = useImportSummaryStore.getState()
            expect(isPanelMode).toBe(true)
        })

        it('stays in toast mode when exactly 10 items (boundary)', () => {
            const { setSummary } = useImportSummaryStore.getState()
            const tier1Fixed = Array.from({ length: 5 }, (_, i) => makeFix(`node-t1-${i}`))
            const tier2Flagged = Array.from({ length: 5 }, (_, i) => makeFlag(`node-t2-${i}`))
            // 5 + 5 = 10 items — still toast mode (> 10 required)

            setSummary(makeSummary({ tier1Fixed, tier2Flagged }))

            const { isPanelMode } = useImportSummaryStore.getState()
            expect(isPanelMode).toBe(false)
        })

        it('replaces a previous summary with a new one', () => {
            const { setSummary } = useImportSummaryStore.getState()
            setSummary(makeSummary({ healTimeMs: 10 }))
            setSummary(makeSummary({ healTimeMs: 99 }))

            const { summary } = useImportSummaryStore.getState()
            expect(summary?.healTimeMs).toBe(99)
        })
    })

    describe('dismiss', () => {
        it('clears summary and hides the UI', () => {
            const { setSummary, dismiss } = useImportSummaryStore.getState()
            setSummary(makeSummary())

            dismiss()

            const state = useImportSummaryStore.getState()
            expect(state.summary).toBeNull()
            expect(state.isVisible).toBe(false)
            expect(state.isPanelMode).toBe(false)
        })

        it('resets isPanelMode to false', () => {
            const { setSummary, openPanel, dismiss } = useImportSummaryStore.getState()
            setSummary(makeSummary())
            openPanel()
            expect(useImportSummaryStore.getState().isPanelMode).toBe(true)

            dismiss()
            expect(useImportSummaryStore.getState().isPanelMode).toBe(false)
        })

        it('is a no-op (safe) when called on already-dismissed state', () => {
            const { dismiss } = useImportSummaryStore.getState()
            // Already null/hidden from beforeEach
            expect(() => dismiss()).not.toThrow()

            const state = useImportSummaryStore.getState()
            expect(state.summary).toBeNull()
            expect(state.isVisible).toBe(false)
        })
    })

    describe('openPanel', () => {
        it('sets isPanelMode to true', () => {
            const { setSummary, openPanel } = useImportSummaryStore.getState()
            setSummary(makeSummary())

            openPanel()

            expect(useImportSummaryStore.getState().isPanelMode).toBe(true)
        })

        it('does not clear the summary or visibility', () => {
            const { setSummary, openPanel } = useImportSummaryStore.getState()
            const summary = makeSummary()
            setSummary(summary)

            openPanel()

            const state = useImportSummaryStore.getState()
            expect(state.summary).toEqual(summary)
            expect(state.isVisible).toBe(true)
        })
    })

    describe('removeTier2Item', () => {
        it('removes the item with the matching nodeId', () => {
            const { setSummary, removeTier2Item } = useImportSummaryStore.getState()
            const summary = makeSummary({
                tier2Flagged: [makeFlag('node-a'), makeFlag('node-b')],
                tier3Unknown: 1,
            })
            setSummary(summary)

            removeTier2Item('node-a')

            const state = useImportSummaryStore.getState()
            expect(state.summary?.tier2Flagged).toHaveLength(1)
            expect(state.summary?.tier2Flagged[0].nodeId).toBe('node-b')
        })

        it('leaves other tier-2 items intact', () => {
            const { setSummary, removeTier2Item } = useImportSummaryStore.getState()
            const summary = makeSummary({
                tier2Flagged: [makeFlag('alpha'), makeFlag('beta'), makeFlag('gamma')],
                tier3Unknown: 0,
            })
            setSummary(summary)

            removeTier2Item('beta')

            const remaining = useImportSummaryStore.getState().summary?.tier2Flagged ?? []
            expect(remaining.map((f) => f.nodeId)).toEqual(['alpha', 'gamma'])
        })

        it('auto-dismisses when all tier-2 items are removed and tier3Unknown is 0', () => {
            const { setSummary, removeTier2Item } = useImportSummaryStore.getState()
            const summary = makeSummary({
                tier2Flagged: [makeFlag('only-one')],
                tier3Unknown: 0,
            })
            setSummary(summary)

            removeTier2Item('only-one')

            const state = useImportSummaryStore.getState()
            expect(state.summary).toBeNull()
            expect(state.isVisible).toBe(false)
            expect(state.isPanelMode).toBe(false)
        })

        it('does NOT auto-dismiss when tier-2 is empty but tier3Unknown > 0', () => {
            const { setSummary, removeTier2Item } = useImportSummaryStore.getState()
            const summary = makeSummary({
                tier2Flagged: [makeFlag('one-flag')],
                tier3Unknown: 3,
            })
            setSummary(summary)

            removeTier2Item('one-flag')

            const state = useImportSummaryStore.getState()
            // Still visible because there are tier-3 items
            expect(state.summary).not.toBeNull()
            expect(state.isVisible).toBe(true)
        })

        it('is a no-op when summary is null', () => {
            const { removeTier2Item } = useImportSummaryStore.getState()
            expect(() => removeTier2Item('ghost-node')).not.toThrow()
            expect(useImportSummaryStore.getState().summary).toBeNull()
        })

        it('is a no-op when nodeId does not match any tier-2 item', () => {
            const { setSummary, removeTier2Item } = useImportSummaryStore.getState()
            const summary = makeSummary({
                tier2Flagged: [makeFlag('real-node')],
                tier3Unknown: 0,
            })
            setSummary(summary)

            removeTier2Item('non-existent-node')

            // Summary unchanged — the non-existent node ID was simply not found
            const state = useImportSummaryStore.getState()
            expect(state.summary?.tier2Flagged).toHaveLength(1)
            expect(state.isVisible).toBe(true)
        })
    })

    describe('replaceWithPreHeal', () => {
        it('clears summary, hides UI, and resets panel mode', () => {
            const { setSummary, openPanel, replaceWithPreHeal } =
                useImportSummaryStore.getState()
            setSummary(makeSummary())
            openPanel()

            replaceWithPreHeal()

            const state = useImportSummaryStore.getState()
            expect(state.summary).toBeNull()
            expect(state.isVisible).toBe(false)
            expect(state.isPanelMode).toBe(false)
        })

        it('is a no-op (safe) when called on empty state', () => {
            const { replaceWithPreHeal } = useImportSummaryStore.getState()
            expect(() => replaceWithPreHeal()).not.toThrow()
        })
    })

    describe('hasTier2Items derived selector', () => {
        it('returns false when summary is null', () => {
            const { hasTier2Items } = useImportSummaryStore.getState()
            expect(hasTier2Items()).toBe(false)
        })

        it('returns false when tier2Flagged is empty', () => {
            const { setSummary, hasTier2Items } = useImportSummaryStore.getState()
            setSummary(makeSummary({ tier2Flagged: [] }))
            expect(hasTier2Items()).toBe(false)
        })

        it('returns true when tier2Flagged has items', () => {
            const { setSummary, hasTier2Items } = useImportSummaryStore.getState()
            setSummary(makeSummary({ tier2Flagged: [makeFlag('node-x')] }))
            expect(hasTier2Items()).toBe(true)
        })
    })

    describe('isAllClean derived selector', () => {
        it('returns true when summary is null', () => {
            const { isAllClean } = useImportSummaryStore.getState()
            expect(isAllClean()).toBe(true)
        })

        it('returns true when tier2 is empty and tier3Unknown is 0', () => {
            const { setSummary, isAllClean } = useImportSummaryStore.getState()
            setSummary(makeSummary({ tier2Flagged: [], tier3Unknown: 0 }))
            expect(isAllClean()).toBe(true)
        })

        it('returns false when tier2Flagged has items', () => {
            const { setSummary, isAllClean } = useImportSummaryStore.getState()
            setSummary(makeSummary({ tier2Flagged: [makeFlag('node-y')], tier3Unknown: 0 }))
            expect(isAllClean()).toBe(false)
        })

        it('returns false when tier3Unknown > 0', () => {
            const { setSummary, isAllClean } = useImportSummaryStore.getState()
            setSummary(makeSummary({ tier2Flagged: [], tier3Unknown: 5 }))
            expect(isAllClean()).toBe(false)
        })

        it('returns false when both tier2 and tier3 are non-zero', () => {
            const { setSummary, isAllClean } = useImportSummaryStore.getState()
            setSummary(makeSummary({
                tier2Flagged: [makeFlag('node-z')],
                tier3Unknown: 2,
            }))
            expect(isAllClean()).toBe(false)
        })
    })
})
