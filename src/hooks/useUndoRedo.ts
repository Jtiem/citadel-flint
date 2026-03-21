/**
 * useUndoRedo — src/hooks/useUndoRedo.ts
 *
 * Wires Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) to the Phase D Command-Pattern
 * undo/redo history stacks (historyStore).
 *
 * Undo flow (Commandments 10 + 13):
 *   1. Pop the most-recent entry from historyStore.past.
 *   2. Run nodeExists pre-flight check on each inverse — skip restoreCode
 *      inverses (they are always safe) but verify surgical inverses before
 *      applying them so stale flint IDs don't corrupt the AST.
 *   3. applyInversions(rawCode, inversions) → newCode.
 *   4. editorStore.setCode(newCode) — updates Monaco, VisualTree, LivePreview.
 *   5. Push entry.redoMutations onto historyStore.future for redo.
 *
 * Redo flow:
 *   1. Pop the most-recent entry from historyStore.future.
 *   2. Re-apply via editorStore.applyBatch(redoMutations) — this generates
 *      fresh inverses and pushes them back to historyStore.past.
 *
 * The hook returns { performUndo, performRedo } so StatusBar buttons can
 * call the same logic without duplicating it.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useHistoryStore } from '../store/historyStore'
import { applyInversions, nodeExists } from '../core/ASTService'

// ── Undo logic ────────────────────────────────────────────────────────────────

/**
 * Executes a single undo step:
 * pop from past → apply inverses → push forward entry to future.
 *
 * Safe to call even when the stack is empty (no-op).
 */
function performUndoStep(rawCode: string): void {
    const historyState = useHistoryStore.getState()
    const entry = historyState.popUndo()
    if (entry === null) return

    // Pre-flight check (Commandment 10): for surgical inverses that target a
    // specific flint ID, verify the node still exists before applying.
    // restoreCode inverses are unconditional and skip this check.
    const safeInversions = entry.inversions.filter((inv) => {
        if (inv.op === 'restoreCode') return true
        // Both surgical inverse ops reference a nodeId
        return nodeExists(rawCode, inv.nodeId)
    })

    if (safeInversions.length === 0) {
        // All surgical inverses are zombie nodes; nothing to apply.
        // We still push the redo entry so the user can redo if desired.
    }

    const newCode = applyInversions(rawCode, safeInversions)

    // Update the editor — setCode handles AST re-parse, VisualTree, and save.
    useEditorStore.getState().setCode(newCode)

    // Manually push to future for redo (setCode does NOT push to history).
    useHistoryStore.setState((s) => ({
        future: [...s.future, entry],
        canRedo: true,
    }))
}

// ── Redo logic ─────────────────────────────────────────────────────────────────

/**
 * Executes a single redo step:
 * pop from future → re-apply via applyBatch (which pushes fresh inverse to past).
 */
function performRedoStep(): void {
    const historyState = useHistoryStore.getState()
    const entry = historyState.popRedo()
    if (entry === null) return

    // Re-applying via applyBatch regenerates fresh inversions and pushes them
    // to past, so the undo stack stays consistent.
    useEditorStore.getState().applyBatch(entry.redoMutations)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UndoRedoHandlers {
    /** Call to programmatically trigger an undo (e.g. from a button). */
    performUndo: () => void
    /** Call to programmatically trigger a redo (e.g. from a button). */
    performRedo: () => void
}

/**
 * Mounts a global `keydown` listener for Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z.
 *
 * Mount once at the top of the app (App.tsx) via `useUndoRedo()`.
 * Returns { performUndo, performRedo } for use by StatusBar buttons.
 */
export function useUndoRedo(): UndoRedoHandlers {
    const rawCode = useEditorStore((s) => s.rawCode)

    const performUndo = useCallback(() => {
        performUndoStep(rawCode)
    }, [rawCode])

    const performRedo = useCallback(() => {
        performRedoStep()
    }, [])

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent): void {
            // Guard: Ctrl (Win/Linux) or Cmd (Mac)
            const ctrl = e.ctrlKey || e.metaKey
            if (!ctrl) return

            if (e.key === 'z' || e.key === 'Z') {
                // Ctrl+Shift+Z = redo on most platforms; Ctrl+Z = undo.
                if (e.shiftKey) {
                    e.preventDefault()
                    performRedoStep()
                } else {
                    e.preventDefault()
                    // Re-read rawCode at call-time (closure would be stale).
                    performUndoStep(useEditorStore.getState().rawCode)
                }
            } else if (e.key === 'y' || e.key === 'Y') {
                // Ctrl+Y = redo (Windows convention)
                e.preventDefault()
                performRedoStep()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // intentionally empty — we read store state directly at call-time

    return { performUndo, performRedo }
}
