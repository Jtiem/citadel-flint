/**
 * AST Buffer Store — src/store/astBufferStore.ts
 *
 * Phase F.2: Headless multi-file AST buffer for the Bridge Project Workspace.
 *
 * Maintains a `Map<filePath, BabelAST>` of parsed Babel ASTs for files that
 * are part of the open workspace but are NOT currently loaded in the Monaco
 * editor. This "headless buffer" enables cross-file surgery (e.g. moving a
 * component from ComponentA.tsx into ComponentB.tsx) without forcing a file
 * switch in the active editor.
 *
 * 7D Hardening (Commandment 13):
 *   Every buffer loaded via `loadBuffer` has `injectBridgeIds(ast)` applied
 *   immediately after parsing. This guarantees that all headless ASTs are
 *   ID-complete before any mutation function touches them, regardless of
 *   whether the source file was previously opened in the editor.
 *
 * History integration (Phase F.2 cross-file undo):
 *   `crossFileMove` pushes two `HistoryEntry` objects — one per file, each
 *   tagged with `filePath` — so the undo/redo engine knows which buffer to
 *   restore. Both inversions are full `restoreCode` snapshots; surgical redo
 *   is deferred to the Phase G undo/redo wiring pass.
 *
 * Zustand mutation contract:
 *   Always create a new Map reference on mutation so Zustand's shallow-equality
 *   check detects the change and subscribers re-render.
 */

import { create } from 'zustand'
import type { File } from '@babel/types'
import {
    parseCodeToAST,
    injectBridgeIds,
    generateCodeFromAST,
    buildVisualTree,
} from '../core/ast-parser'
import { extractNode, insertNode } from '../utils/astModifier'
import type { DropPosition } from '../utils/astModifier'
import { synthesizeImports } from '../core/ASTService'
import type { InverseMutation, ASTMutation } from '../core/ASTService'
import { useHistoryStore } from './historyStore'
import type { CrossFileMoveRedoPlan } from './historyStore'

// ── Store shape ────────────────────────────────────────────────────────────────

interface ASTBufferState {
    /**
     * Headless AST buffers — keyed by absolute file path.
     *
     * Each value is a Babel `File` AST produced by `parseCodeToAST` with
     * `injectBridgeIds` applied (7D hardening). A buffer is:
     *   • Loaded on demand by `loadBuffer(filePath)`.
     *   • Evicted explicitly by `evictBuffer(filePath)` or bulk-cleared by
     *     `clearBuffers()` when the workspace is closed.
     *
     * Always create a new Map reference on mutation — never mutate in-place.
     */
    buffers: Map<string, File>
}

interface ASTBufferActions {
    /**
     * Reads `filePath` via IPC, parses it, injects bridge IDs (7D hardening),
     * and stores the result in `buffers`.
     *
     * Idempotent: a no-op when `filePath` is already buffered. Callers should
     * `evictBuffer` first if they need a fresh re-parse (e.g. after an
     * external file change or after switching the active editor to a different
     * file and back).
     *
     * Silently swallows read or parse failures so a single unreadable file
     * does not block the rest of the workspace from loading.
     */
    loadBuffer: (filePath: string) => Promise<void>

    /**
     * Removes the buffered AST for `filePath`.
     * Silent no-op when the path is not in the buffer.
     */
    evictBuffer: (filePath: string) => void

    /**
     * Removes ALL buffered ASTs. Call when the workspace is closed or when a
     * new folder is opened to prevent stale ASTs from contaminating the new
     * workspace.
     */
    clearBuffers: () => void

    /**
     * Moves the JSX element identified by `sourceNodeId` from `sourceFilePath`
     * to `targetFilePath`, inserting it at `position` relative to
     * `targetNodeId` (or as the last child of the target file's root JSX
     * element when `targetNodeId` is null).
     *
     * ### Algorithm
     *   1. Loads both files into the buffer (idempotent).
     *   2. Captures pre-mutation code snapshots for history inversions.
     *   3. Extracts the source node from the source AST.
     *   4. Synthesizes any missing imports into the target AST (Phase B).
     *   5. Inserts the extracted node into the target AST.
     *   6. Atomically saves both files via `saveFileBatch` (Commandment 12).
     *   7. Re-parses and re-injects bridge IDs in both buffers (7D hardening).
     *   8. Syncs the active editor if either file is currently open.
     *   9. Pushes two tagged `HistoryEntry` objects for cross-file undo
     *      (skipped when `options.isRecovery` is true — Phase H).
     *
     * ### Abort conditions (silent no-op)
     *   • `sourceFilePath === targetFilePath` — use `editorStore.moveLayerNode`.
     *   • Either file cannot be loaded or parsed.
     *   • `sourceNodeId` not found or is a root element (cannot be extracted).
     *   • No resolvable target node (empty target file with no JSX).
     *   • `insertNode` fails (target node not found or structurally invalid).
     *   • `saveFileBatch` throws — both buffers are restored to pre-move state.
     *
     * @param options.isRecovery  When `true`, skip the `historyStore.push()`
     *   calls so that a redo re-execution does not create duplicate entries on
     *   the `past` stack, and instead return the computed inversions and batchId
     *   to the RecoveryController so it can push the undo entry itself via
     *   `historyStore.pushPast` (preserving the remaining future stack).
     *
     * @returns When `isRecovery` is true and the move succeeds, returns
     *   `{ srcInversions, tgtInversions, batchId }` so the caller can push the
     *   matching undo entry onto `past` without clearing `future`.
     *   Returns `void` in all other cases (normal move or early abort).
     */
    crossFileMove: (
        sourceFilePath: string,
        targetFilePath: string,
        sourceNodeId: string,
        targetNodeId: string | null,
        position: DropPosition,
        options?: { isRecovery?: boolean },
    ) => Promise<{ srcInversions: InverseMutation[], tgtInversions: InverseMutation[], batchId: string } | void>
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useASTBufferStore = create<ASTBufferState & ASTBufferActions>((set, get) => ({
    buffers: new Map(),

    loadBuffer: async (filePath: string) => {
        // Idempotency: skip if the file is already buffered.
        if (get().buffers.has(filePath)) return

        try {
            const content = await window.bridgeAPI.readFile(filePath)

            const ast = parseCodeToAST(content)
            if (ast === null) return  // unparseable file — skip silently

            // 7D Hardening: inject data-bridge-id attributes before storing.
            // This mirrors the renderer-side injection in LivePreview (Phase E.1)
            // and guarantees every headless AST is ID-complete for surgery.
            injectBridgeIds(ast)

            set((state) => {
                const next = new Map(state.buffers)
                next.set(filePath, ast)
                return { buffers: next }
            })
        } catch {
            // Silently suppress read errors — the file may have been deleted,
            // moved, or may be temporarily inaccessible.
        }
    },

    evictBuffer: (filePath: string) => {
        if (!get().buffers.has(filePath)) return
        set((state) => {
            const next = new Map(state.buffers)
            next.delete(filePath)
            return { buffers: next }
        })
    },

    clearBuffers: () => set({ buffers: new Map() }),

    crossFileMove: async (
        sourceFilePath,
        targetFilePath,
        sourceNodeId,
        targetNodeId,
        position,
        options,
    ) => {
        // Guard: same-file moves belong to editorStore.moveLayerNode.
        if (sourceFilePath === targetFilePath) return

        // ── 1. Ensure both buffers are loaded ─────────────────────────────────
        await get().loadBuffer(sourceFilePath)
        await get().loadBuffer(targetFilePath)

        const sourceAST = get().buffers.get(sourceFilePath)
        const targetAST = get().buffers.get(targetFilePath)
        if (!sourceAST || !targetAST) return

        // ── 2. Capture pre-mutation code (for history inversions + rollback) ───
        const preMoveSourceCode = generateCodeFromAST(sourceAST)
        const preMoveTargetCode = generateCodeFromAST(targetAST)

        // ── 3. Resolve effective target node ID ───────────────────────────────
        // When no specific target is given, fall back to the first root JSX
        // element of the target file so the drop lands somewhere reasonable.
        let effectiveTargetId = targetNodeId
        if (effectiveTargetId === null) {
            const targetTree = buildVisualTree(targetAST)
            effectiveTargetId = targetTree[0]?.id ?? null
        }
        if (effectiveTargetId === null) return  // target file has no JSX — abort

        // ── 4. Extract source node ─────────────────────────────────────────────
        // extractNode removes the node from sourceAST's JSX tree and returns it.
        // Aborts when the node is not found or is a root (no JSXElement parent).
        const extracted = extractNode(sourceAST, sourceNodeId)
        if (extracted === null) return

        // ── 5. Synthesize imports (Phase B Import Synthesizer) ─────────────────
        // sourceAST still carries all original ImportDeclarations so
        // synthesizeImports can find the component's dependencies. Relative
        // import paths are re-rooted from sourceFilePath to targetFilePath.
        synthesizeImports(sourceAST, extracted, targetAST, sourceFilePath, targetFilePath)

        // ── 6. Insert extracted node into target AST ───────────────────────────
        const inserted = insertNode(targetAST, extracted, effectiveTargetId, position)
        if (!inserted) {
            // Insertion failed — restore the source AST to its pre-move state
            // because extractNode already mutated it.
            const restoredSource = parseCodeToAST(preMoveSourceCode)
            if (restoredSource !== null) {
                injectBridgeIds(restoredSource)
                set((state) => {
                    const next = new Map(state.buffers)
                    next.set(sourceFilePath, restoredSource)
                    return { buffers: next }
                })
            }
            return
        }

        // ── 7. Generate new code from both mutated ASTs ────────────────────────
        const newSourceCode = generateCodeFromAST(sourceAST)
        const newTargetCode = generateCodeFromAST(targetAST)

        // ── 8. Atomic batch write (Commandment 12 — Atomic Queuing) ───────────
        try {
            await window.bridgeAPI.saveFileBatch({
                [sourceFilePath]: newSourceCode,
                [targetFilePath]: newTargetCode,
            })
        } catch (err) {
            console.error('[Bridge] crossFileMove: saveFileBatch failed:', err)
            // Restore both buffers to pre-move state so the in-memory ASTs
            // stay consistent with what is on disk.
            const restoredSource = parseCodeToAST(preMoveSourceCode)
            const restoredTarget = parseCodeToAST(preMoveTargetCode)
            set((state) => {
                const next = new Map(state.buffers)
                if (restoredSource !== null) {
                    injectBridgeIds(restoredSource)
                    next.set(sourceFilePath, restoredSource)
                }
                if (restoredTarget !== null) {
                    injectBridgeIds(restoredTarget)
                    next.set(targetFilePath, restoredTarget)
                }
                return { buffers: next }
            })
            return
        }

        // ── 9. Re-parse both ASTs (fresh canonical ASTs) + 7D hardening ───────
        const finalSource = parseCodeToAST(newSourceCode)
        const finalTarget = parseCodeToAST(newTargetCode)
        set((state) => {
            const next = new Map(state.buffers)
            if (finalSource !== null) {
                injectBridgeIds(finalSource)
                next.set(sourceFilePath, finalSource)
            }
            if (finalTarget !== null) {
                injectBridgeIds(finalTarget)
                next.set(targetFilePath, finalTarget)
            }
            return { buffers: next }
        })

        // ── 10. Sync the active editor if either file is currently open ────────
        // Lazy imports avoid circular module dependencies.
        const { useCanvasStore } = await import('./canvasStore')
        const activeFilePath = useCanvasStore.getState().activeFilePath

        if (activeFilePath === sourceFilePath || activeFilePath === targetFilePath) {
            const { useEditorStore } = await import('./editorStore')
            const editorStore = useEditorStore.getState()
            if (activeFilePath === sourceFilePath) editorStore.syncCode(newSourceCode)
            if (activeFilePath === targetFilePath) editorStore.syncCode(newTargetCode)
        }

        // ── 11. Push tagged history entries for cross-file undo + redo ────────
        // Two entries — one per file — each carrying a restoreCode inversion
        // and tagged with its filePath for the undo/redo engine.
        // A shared batchId groups them so the RecoveryController can pop and
        // restore both files atomically with a single Cmd+Z (Phase G).
        //
        // Phase H (Cross-File Redo): the source entry additionally carries a
        // CrossFileMoveRedoPlan — a snapshot of the original call parameters.
        // applyCrossFileUndo extracts this plan and stores it in the future
        // stack so Cmd+Shift+Z can re-invoke crossFileMove deterministically
        // without recalculating the AST diff.
        const srcInversions: InverseMutation[] = [
            { op: 'restoreCode', code: preMoveSourceCode },
        ]
        const tgtInversions: InverseMutation[] = [
            { op: 'restoreCode', code: preMoveTargetCode },
        ]
        const emptyRedo: ASTMutation[] = []
        const batchId = crypto.randomUUID()

        // effectiveTargetId is guaranteed non-null here — the null guard at
        // step 3 would have returned before reaching this point.
        const redoPlan: CrossFileMoveRedoPlan = {
            type: 'crossFileMove',
            sourceFilePath,
            sourceNodeId,
            targetFilePath,
            targetNodeId: effectiveTargetId as string,
            position,
        }

        if (!options?.isRecovery) {
            // Normal move: push directly to historyStore (clears future).
            useHistoryStore.getState().push(srcInversions, emptyRedo, sourceFilePath, batchId, redoPlan)
            useHistoryStore.getState().push(tgtInversions, emptyRedo, targetFilePath, batchId)
        } else {
            // Recovery redo: return inversions to the RecoveryController so it
            // can push them via pushPast (preserves the remaining future stack).
            return { srcInversions, tgtInversions, batchId }
        }
    },
}))
