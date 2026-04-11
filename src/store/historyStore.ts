/**
 * History Store — src/store/historyStore.ts
 *
 * Zustand v5 store for Command-Pattern undo/redo history (Phase D).
 *
 * Maintains two stacks — `past` and `future` — of HistoryEntry objects.
 * Each entry pairs the InverseMutation[] needed to undo a batch with the
 * ASTMutation[] needed to redo it.
 *
 * This store is intentionally pure state: it imports only from ASTService
 * (for types) and never from editorStore, preventing circular dependencies.
 * editorStore calls `useHistoryStore.getState().push(...)` after every
 * successful applyBatch, mirroring the pattern used by canvasStore.
 *
 * Stack discipline:
 *   push(inversions, redoMutations)  — called after every successful mutation
 *       · Appends to `past`, clears `future` (a new edit forks the timeline).
 *   popUndo()  — removes and returns the top of `past`; pushes an undo entry
 *                onto `future` for redo.
 *   popRedo()  — removes and returns the top of `future`.
 *   clear()    — resets both stacks (e.g. on file-open).
 */

import { create } from 'zustand'
import type { ASTMutation, InverseMutation } from '../core/ASTService'
import type { DropPosition } from '../utils/astModifier'

// ── Types ──────────────────────────────────────────────────────────────────────

// ── RedoPlan ───────────────────────────────────────────────────────────────────

/**
 * Deterministic replay instruction for a cross-file move (Phase H).
 *
 * Stores the exact parameters passed to `astBufferStore.crossFileMove` so the
 * RecoveryController can re-invoke the operation on Cmd+Shift+Z without
 * recalculating the AST diff. `targetNodeId` is always the resolved non-null
 * flint-id (the null-fallback is resolved inside crossFileMove before the
 * plan is built).
 */
export interface CrossFileMoveRedoPlan {
    readonly type: 'crossFileMove'
    /** Absolute path of the file the moved node originated from. */
    readonly sourceFilePath: string
    /** flint-id of the node that was moved. */
    readonly sourceNodeId: string
    /** Absolute path of the file the node was moved into. */
    readonly targetFilePath: string
    /** flint-id of the insertion target (always resolved — never null). */
    readonly targetNodeId: string
    /** Relative position for the re-insertion. */
    readonly position: DropPosition
}

/** Discriminated union of all re-executable cross-file operation plans. */
export type RedoPlan = CrossFileMoveRedoPlan

/**
 * A single entry on the undo/redo stacks.
 *
 * `inversions`    — apply these to the current code to undo the batch.
 * `redoMutations` — apply these to the restored code to redo the batch.
 * `filePath`      — absolute path of the file the mutation was applied to.
 *                   Present for headless-buffer mutations (Phase F.2 cross-file
 *                   moves). Absent when the mutation targets the active editor
 *                   file (legacy single-file path — backward compatible).
 * `batchId`       — UUID shared across all entries produced by a single atomic
 *                   operation (e.g. a cross-file move that modifies two files).
 *                   The RecoveryController uses this to pop and restore the full
 *                   group with a single Cmd+Z.
 * `redoPlan`      — deterministic replay instruction for cross-file redo
 *                   (Phase H). Carried by the source entry in a cross-file move
 *                   batch; absent for single-file mutations.
 */
export interface HistoryEntry {
    /** Absolute path of the mutated file. Absent for the active editor file. */
    filePath?: string
    /** UUID grouping entries that must be undone atomically (Phase G). */
    batchId?: string
    inversions: InverseMutation[]
    redoMutations: ASTMutation[]
    /** Deterministic replay instruction for cross-file redo (Phase H). */
    redoPlan?: RedoPlan
}

// ── Store shape ────────────────────────────────────────────────────────────────

interface HistoryState {
    /** Entries available for undo, most-recent last. */
    past: HistoryEntry[]
    /** Entries available for redo, most-recent last. */
    future: HistoryEntry[]
    /** True when there is at least one entry to undo. */
    canUndo: boolean
    /** True when there is at least one entry to redo. */
    canRedo: boolean
}

interface HistoryActions {
    /**
     * Records a completed batch mutation. Appends to `past` and clears
     * `future` (new edits invalidate the redo timeline).
     *
     * @param inversions    InverseMutation[] returned by applyMutationBatch.
     * @param redoMutations The original ASTMutation[] that produced the batch.
     * @param filePath      Absolute path of the mutated file. Omit for the
     *                      active editor file; provide for headless-buffer
     *                      mutations (Phase F.2 cross-file moves).
     * @param batchId       Optional UUID shared across all entries from one
     *                      atomic operation (e.g. a cross-file move). The
     *                      RecoveryController pops all entries with the same
     *                      batchId together on a single Cmd+Z.
     * @param redoPlan      Optional deterministic replay plan (Phase H).
     *                      Pass on the source entry of a cross-file move so
     *                      `applyRedo` can re-invoke the operation without
     *                      recalculating the AST diff.
     */
    push: (inversions: InverseMutation[], redoMutations: ASTMutation[], filePath?: string, batchId?: string, redoPlan?: RedoPlan) => void

    /**
     * Appends an entry to the `past` stack without clearing `future`.
     * Called by the RecoveryController after a cross-file redo so that the
     * redo operation is itself undoable without discarding any remaining
     * redo chain (i.e. entries queued ahead of it in `future`).
     *
     * Signature mirrors `push` but intentionally omits the `future: []` clear.
     */
    pushPast: (inversions: InverseMutation[], redoMutations: ASTMutation[], filePath?: string, batchId?: string, redoPlan?: RedoPlan) => void

    /**
     * Appends `entry` to the `future` stack without touching `past`.
     * Called by the RecoveryController after a successful undo so that the
     * operation can be re-applied with Cmd+Shift+Z.
     */
    pushFuture: (entry: HistoryEntry) => void

    /**
     * Pops the most-recent undo entry. Returns it (or null if the stack is
     * empty). The caller must apply `entry.inversions` to the current code and
     * push `entry.redoMutations` onto `future`.
     */
    popUndo: () => HistoryEntry | null

    /**
     * Pops the most-recent redo entry. Returns it (or null if empty). The
     * caller must re-apply `entry.redoMutations` via applyBatch so a fresh
     * inverse is generated and pushed back onto `past`.
     */
    popRedo: () => HistoryEntry | null

    /** Clears both stacks. Call on file-open to prevent cross-file undo. */
    clear: () => void
}

// ── REVIEW FIX (2026-04-10): Bounded stacks ─────────────────────────────────
// Each entry can hold a full file snapshot (restoreCode). Cap at 100 to prevent
// unbounded memory growth during long editing sessions.
const MAX_HISTORY = 100

// ── Store ─────────────────────────────────────────────────────────────────────

export const useHistoryStore = create<HistoryState & HistoryActions>((set, get) => ({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,

    push: (inversions, redoMutations, filePath?, batchId?, redoPlan?) => {
        const entry: HistoryEntry = { inversions, redoMutations }
        if (filePath !== undefined) entry.filePath = filePath
        if (batchId !== undefined) entry.batchId = batchId
        if (redoPlan !== undefined) entry.redoPlan = redoPlan
        let newPast = [...get().past, entry]
        // Evict oldest entries when the stack exceeds MAX_HISTORY
        if (newPast.length > MAX_HISTORY) {
            newPast = newPast.slice(newPast.length - MAX_HISTORY)
        }
        set({ past: newPast, future: [], canUndo: true, canRedo: false })
    },

    pushPast: (inversions, redoMutations, filePath?, batchId?, redoPlan?) => {
        const entry: HistoryEntry = { inversions, redoMutations }
        if (filePath !== undefined) entry.filePath = filePath
        if (batchId !== undefined) entry.batchId = batchId
        if (redoPlan !== undefined) entry.redoPlan = redoPlan
        let newPast = [...get().past, entry]
        if (newPast.length > MAX_HISTORY) {
            newPast = newPast.slice(newPast.length - MAX_HISTORY)
        }
        set({ past: newPast, canUndo: true })
    },

    pushFuture: (entry) => {
        const newFuture = [...get().future, entry]
        set({ future: newFuture, canRedo: true })
    },

    popUndo: () => {
        const past = get().past
        if (past.length === 0) return null
        const entry = past[past.length - 1]
        const newPast = past.slice(0, -1)
        set({
            past: newPast,
            canUndo: newPast.length > 0,
        })
        return entry
    },

    popRedo: () => {
        const future = get().future
        if (future.length === 0) return null
        const entry = future[future.length - 1]
        const newFuture = future.slice(0, -1)
        set({
            future: newFuture,
            canRedo: newFuture.length > 0,
        })
        return entry
    },

    clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}))
