/**
 * Recovery Controller — src/core/recoveryController.ts
 *
 * Phase G.1: Global Undo/Redo engine for the Flint AST Command Pattern.
 *
 * Exports two async functions — `applyUndo` and `applyRedo` — that the App
 * shell calls in response to `Cmd+Z` / `Cmd+Shift+Z` keyboard events.
 *
 * ## Undo algorithm
 *
 * 1. Pop the top `HistoryEntry` from `historyStore.past`.
 * 2. If the entry has a `batchId`, pop all consecutive sibling entries with
 *    the same `batchId` (cross-file moves push two tagged entries; a single
 *    Cmd+Z must restore both files atomically — Commandment 12).
 * 3. Route to the correct restoration path:
 *    • **Single-file** (no `filePath`): `applyInversions` → `syncCode` →
 *      `triggerAutoSave`. Push a redo entry to `future`.
 *    • **Cross-file** (one or more entries have `filePath`): collect
 *      `restoreCode` snapshots, `saveFileBatch`, evict + reload affected
 *      buffers, sync the active editor if needed.
 *
 * ## Redo algorithm (Phase H)
 *
 * 1. Pop the top `HistoryEntry` from `historyStore.future`.
 * 2. If the entry carries a `redoPlan` (cross-file move), dispatch to
 *    `applyRedoPlan` which re-invokes `astBufferStore.crossFileMove` with the
 *    original parameters — no AST diff recalculation needed.
 * 3. Otherwise, call `editorStore.applyBatch(redoMutations)` which handles
 *    code generation, auto-save, and pushing a fresh inversion onto `past`.
 *
 * ## Monaco coexistence
 *
 * The keyboard listener in `App.tsx` skips this engine whenever the Monaco
 * editor has focus (detected via `document.activeElement.closest('.monaco-editor')`),
 * allowing Monaco to handle text-level undo for raw typing.
 *
 * ## Abort conditions (silent no-ops)
 *  - History stack is empty.
 *  - `applyInversions` returns the same code (no-op mutation).
 *  - `saveFileBatch` throws (error is logged; buffers are left unchanged).
 */

import { useHistoryStore } from '../store/historyStore'
import type { HistoryEntry, RedoPlan } from '../store/historyStore'
import { applyInversions } from './ASTService'
import { useEditorStore } from '../store/editorStore'
import { useCanvasStore } from '../store/canvasStore'
import { useASTBufferStore } from '../store/astBufferStore'

// ── Undo ───────────────────────────────────────────────────────────────────────

/**
 * Pops the most-recent history entry (or batch group) and reverts the
 * affected file(s) to their pre-mutation state.
 */
export async function applyUndo(): Promise<boolean> {
    const entry = useHistoryStore.getState().popUndo()
    if (entry === null) return false

    // Collect all sibling entries in the same atomic batch (cross-file moves
    // push multiple entries with a shared batchId).
    const group: HistoryEntry[] = [entry]
    if (entry.batchId !== undefined) {
        while (true) {
            const past = useHistoryStore.getState().past
            const top = past[past.length - 1]
            if (top === undefined || top.batchId !== entry.batchId) break
            const sibling = useHistoryStore.getState().popUndo()
            if (sibling === null) break
            group.push(sibling)
        }
    }

    // Cross-file: at least one entry carries a filePath.
    if (group.some((e) => e.filePath !== undefined)) {
        await applyCrossFileUndo(group)
    } else {
        applySingleFileUndo(entry)
    }
    return true
}

// ── Single-file undo ───────────────────────────────────────────────────────────

function applySingleFileUndo(entry: HistoryEntry): void {
    const editorStore = useEditorStore.getState()
    const restoredCode = applyInversions(editorStore.rawCode, entry.inversions)

    // Sync the editor without triggering auto-save or clearing history.
    editorStore.syncCode(restoredCode)

    // Persist the restored code immediately (no debounce — undo is discrete).
    useCanvasStore.getState().triggerAutoSave(restoredCode)

    // Push a redo entry so Cmd+Shift+Z can re-apply the original mutations.
    if (entry.redoMutations.length > 0) {
        useHistoryStore.getState().pushFuture({
            // inversions not used in the redo path — applyBatch generates them fresh
            inversions: [],
            redoMutations: entry.redoMutations,
        })
    }
}

// ── Cross-file undo ────────────────────────────────────────────────────────────

async function applyCrossFileUndo(group: HistoryEntry[]): Promise<void> {
    // Build filePath → restored-code map from each entry's restoreCode snapshot.
    const batch: Record<string, string> = {}
    for (const e of group) {
        if (e.filePath === undefined) continue
        for (const inv of e.inversions) {
            if (inv.op === 'restoreCode') {
                batch[e.filePath] = inv.code
                break
            }
        }
    }
    if (Object.keys(batch).length === 0) return

    // Atomically write all restored files (Commandment 12).
    try {
        await window.flintAPI.saveFileBatch(batch)
    } catch (err) {
        console.error('[Flint] applyUndo (cross-file): saveFileBatch failed:', err)
        return
    }

    // Evict stale buffers and reload from the freshly-saved restored code.
    // loadBuffer applies 7D hardening (injectFlintIds) automatically.
    const bufferStore = useASTBufferStore.getState()
    for (const filePath of Object.keys(batch)) {
        bufferStore.evictBuffer(filePath)
        await bufferStore.loadBuffer(filePath)
    }

    // Sync the active editor if it's one of the restored files.
    const activeFilePath = useCanvasStore.getState().activeFilePath
    if (activeFilePath !== null && batch[activeFilePath] !== undefined) {
        useEditorStore.getState().syncCode(batch[activeFilePath])
    }

    // Phase H: extract the RedoPlan from the source entry (the one that has it)
    // and push a single redo entry so Cmd+Shift+Z can replay the move.
    const redoPlan = group.find((e) => e.redoPlan !== undefined)?.redoPlan
    if (redoPlan !== undefined) {
        useHistoryStore.getState().pushFuture({
            inversions: [],
            redoMutations: [],
            redoPlan,
        })
    }
}

// ── Redo ───────────────────────────────────────────────────────────────────────

/**
 * Pops the most-recent redo entry and re-applies its original mutations.
 *
 * Cross-file redo (Phase H): entries that carry a `redoPlan` are dispatched
 * to `applyRedoPlan`, which re-invokes `astBufferStore.crossFileMove` with
 * the stored parameters — no AST diff recalculation needed.
 *
 * Single-file redo delegates to `editorStore.applyBatch`, which handles code
 * generation, auto-save, and pushing a fresh inversion onto `past`.
 */
export async function applyRedo(): Promise<boolean> {
    const entry = useHistoryStore.getState().popRedo()
    if (entry === null) return false

    // Cross-file redo: re-invoke the original operation via its RedoPlan.
    if (entry.redoPlan !== undefined) {
        await applyRedoPlan(entry.redoPlan)
        return true
    }

    // Single-file redo: re-apply original mutations.
    if (entry.redoMutations.length === 0) return false
    useEditorStore.getState().applyBatch(entry.redoMutations)
    return true
}

// ── Cross-file redo ─────────────────────────────────────────────────────────

/**
 * Re-executes a cross-file operation from its deterministic replay plan.
 *
 * `crossFileMove` handles all buffer loading, AST surgery, file writes, and
 * editor sync. When called with `isRecovery: true` it skips its own history
 * push and instead returns the computed inversions + batchId so THIS function
 * can push them onto `past` via `pushPast` — preserving any remaining entries
 * in `future` rather than clearing them (as the standard `push` would do).
 *
 * This makes every cross-file redo itself fully undoable, enabling the
 * infinite Cmd+Z / Cmd+Shift+Z toggle described in Phase I.
 */
async function applyRedoPlan(plan: RedoPlan): Promise<void> {
    if (plan.type === 'crossFileMove') {
        const result = await useASTBufferStore.getState().crossFileMove(
            plan.sourceFilePath,
            plan.targetFilePath,
            plan.sourceNodeId,
            plan.targetNodeId,
            plan.position,
            { isRecovery: true },
        )

        // Push undo entries so this redo is itself undoable (Phase I).
        // pushPast appends to `past` without clearing `future`, preserving
        // any queued redo entries that sit ahead of this operation.
        if (result !== undefined) {
            const { srcInversions, tgtInversions, batchId } = result
            const historyStore = useHistoryStore.getState()
            historyStore.pushPast(srcInversions, [], plan.sourceFilePath, batchId, plan)
            historyStore.pushPast(tgtInversions, [], plan.targetFilePath, batchId)
        }
    }
}
