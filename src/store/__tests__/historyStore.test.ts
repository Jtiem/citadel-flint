/**
 * historyStore.test.ts — src/store/__tests__/historyStore.test.ts
 *
 * Tests for the undo/redo history Zustand store.
 *
 * Covers:
 *   - push: appends to past, clears future
 *   - popUndo: returns most-recent entry, updates canUndo
 *   - popRedo: returns most-recent future entry, updates canRedo
 *   - clear: resets both stacks
 *   - boundary: empty undo/redo returns null
 *   - MAX_HISTORY: evicts oldest entries when stack exceeds limit
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useHistoryStore } from '../../store/historyStore'
import type { HistoryEntry } from '../../store/historyStore'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(code = 'restore'): Pick<HistoryEntry, 'inversions' | 'redoMutations'> {
    return {
        inversions: [{ op: 'restoreCode' as const, code }],
        redoMutations: [],
    }
}

function resetStore() {
    useHistoryStore.getState().clear()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('historyStore', () => {
    beforeEach(resetStore)

    it('starts with empty stacks and canUndo/canRedo false', () => {
        const state = useHistoryStore.getState()
        expect(state.past).toEqual([])
        expect(state.future).toEqual([])
        expect(state.canUndo).toBe(false)
        expect(state.canRedo).toBe(false)
    })

    it('push appends to past and sets canUndo true', () => {
        const { inversions, redoMutations } = makeEntry('code-a')
        useHistoryStore.getState().push(inversions, redoMutations)

        const state = useHistoryStore.getState()
        expect(state.past).toHaveLength(1)
        expect(state.past[0].inversions[0]).toMatchObject({ op: 'restoreCode', code: 'code-a' })
        expect(state.canUndo).toBe(true)
        expect(state.canRedo).toBe(false)
    })

    it('push clears the future stack (new edit forks timeline)', () => {
        const { inversions, redoMutations } = makeEntry()
        const store = useHistoryStore.getState()

        // Push, pop undo (creates redo opportunity), then push again
        store.push(inversions, redoMutations)
        const entry = store.popUndo()
        expect(entry).not.toBeNull()
        useHistoryStore.getState().pushFuture(entry!)

        expect(useHistoryStore.getState().canRedo).toBe(true)

        // New push should clear future
        useHistoryStore.getState().push(inversions, redoMutations)
        expect(useHistoryStore.getState().future).toHaveLength(0)
        expect(useHistoryStore.getState().canRedo).toBe(false)
    })

    it('popUndo returns null on empty stack', () => {
        const entry = useHistoryStore.getState().popUndo()
        expect(entry).toBeNull()
    })

    it('popUndo returns the most recent entry and updates canUndo', () => {
        const store = useHistoryStore.getState()
        store.push(makeEntry('first').inversions, makeEntry('first').redoMutations)
        store.push(makeEntry('second').inversions, makeEntry('second').redoMutations)

        const entry = useHistoryStore.getState().popUndo()
        expect(entry?.inversions[0]).toMatchObject({ code: 'second' })
        expect(useHistoryStore.getState().canUndo).toBe(true) // still has 'first'

        const entry2 = useHistoryStore.getState().popUndo()
        expect(entry2?.inversions[0]).toMatchObject({ code: 'first' })
        expect(useHistoryStore.getState().canUndo).toBe(false)
    })

    it('popRedo returns null on empty stack', () => {
        const entry = useHistoryStore.getState().popRedo()
        expect(entry).toBeNull()
    })

    it('popRedo returns most recent future entry', () => {
        const store = useHistoryStore.getState()
        store.pushFuture({
            inversions: [{ op: 'restoreCode' as const, code: 'redo-code' }],
            redoMutations: [],
        })

        expect(useHistoryStore.getState().canRedo).toBe(true)
        const entry = useHistoryStore.getState().popRedo()
        expect(entry?.inversions[0]).toMatchObject({ code: 'redo-code' })
        expect(useHistoryStore.getState().canRedo).toBe(false)
    })

    it('clear resets both stacks', () => {
        const store = useHistoryStore.getState()
        store.push(makeEntry().inversions, makeEntry().redoMutations)
        store.pushFuture({ inversions: [{ op: 'restoreCode', code: 'x' }], redoMutations: [] })

        useHistoryStore.getState().clear()
        const state = useHistoryStore.getState()
        expect(state.past).toHaveLength(0)
        expect(state.future).toHaveLength(0)
        expect(state.canUndo).toBe(false)
        expect(state.canRedo).toBe(false)
    })

    it('pushPast appends without clearing future', () => {
        const store = useHistoryStore.getState()
        store.pushFuture({ inversions: [{ op: 'restoreCode', code: 'f' }], redoMutations: [] })

        useHistoryStore.getState().pushPast(
            [{ op: 'restoreCode', code: 'pp' }],
            [],
        )

        const state = useHistoryStore.getState()
        expect(state.past).toHaveLength(1)
        expect(state.future).toHaveLength(1) // future NOT cleared
        expect(state.canUndo).toBe(true)
        expect(state.canRedo).toBe(true)
    })

    it('evicts oldest entries when past exceeds MAX_HISTORY (100)', () => {
        const store = useHistoryStore.getState()
        // Push 105 entries
        for (let i = 0; i < 105; i++) {
            store.push([{ op: 'restoreCode', code: `code-${i}` }], [])
        }

        const state = useHistoryStore.getState()
        expect(state.past.length).toBeLessThanOrEqual(100)
        // The oldest entries (0-4) should have been evicted
        const firstCode = (state.past[0].inversions[0] as { code: string }).code
        expect(firstCode).toBe('code-5')
    })
})
