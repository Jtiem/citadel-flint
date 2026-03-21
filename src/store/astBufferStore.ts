/**
 * AST Buffer Store — src/store/astBufferStore.ts
 *
 * Phase F.2: Headless multi-file AST buffer for the Flint Project Workspace.
 *
 * Maintains a `Map<filePath, BabelAST>` of parsed Babel ASTs for files that
 * are part of the open workspace but are NOT currently loaded in the Monaco
 * editor. This "headless buffer" enables cross-file surgery (e.g. moving a
 * component from ComponentA.tsx into ComponentB.tsx) without forcing a file
 * switch in the active editor.
 *
 * 7D Hardening (Commandment 13):
 *   Every buffer loaded via `loadBuffer` has `injectFlintIds(ast)` applied
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
// Phase N.1: astBufferStore no longer imports Babel parse/generate/inject directly.
// Adapter resolution is done per-file via LanguageRegistry.
import { LanguageRegistry } from '../core/adapters/types'
// Internal Babel-specific helpers for the cross-file move pipeline.
// These will be absorbed into IFlintAdapter in a future Phase N sub-step
// as the cross-file move gains multi-language support.
// `File` is kept here for the explicit casts at the Babel call sites below.
import type { File } from '@babel/types'
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
     * Each value is the adapter-specific AST for the file, produced by
     * `LanguageRegistry.getAdapter(filePath).parse()` with
     * `injectFlintIds` applied (7D hardening) — Phase N.1.
     *
     * Always create a new Map reference on mutation — never mutate in-place.
     */
    buffers: Map<string, unknown>
}

interface ASTBufferActions {
    /**
     * Reads `filePath` via IPC, parses it, injects flint IDs (7D hardening),
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
     *   7. Re-parses and re-injects flint IDs in both buffers (7D hardening).
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
        options?: { isRecovery?: boolean; cloneMode?: boolean },
    ) => Promise<{ srcInversions: InverseMutation[], tgtInversions: InverseMutation[], batchId: string } | void>
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useASTBufferStore = create<ASTBufferState & ASTBufferActions>((set, get) => ({
    buffers: new Map(),

    loadBuffer: async (filePath: string) => {
        if (get().buffers.has(filePath)) return
        try {
            const content = await window.flintAPI.readFile(filePath)
            const adapter = LanguageRegistry.getAdapter(filePath)
            const ast = adapter.parse(content)
            if (ast === null) return
            // 7D Hardening: inject data-flint-id attributes before storing.
            adapter.injectFlintIds(ast)
            set((state) => {
                const next = new Map(state.buffers)
                next.set(filePath, ast)
                return { buffers: next }
            })
        } catch {
            // Silently suppress read errors.
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

        const cloneMode = options?.cloneMode === true

        // ── 1. Ensure both buffers are loaded ─────────────────────────────────
        await get().loadBuffer(sourceFilePath)
        await get().loadBuffer(targetFilePath)

        const sourceAST = get().buffers.get(sourceFilePath)
        const targetAST = get().buffers.get(targetFilePath)
        if (!sourceAST || !targetAST) return

        // ── 2. Capture pre-mutation code (for history inversions + rollback) ───
        const srcAdapter = LanguageRegistry.getAdapter(sourceFilePath)
        const tgtAdapter = LanguageRegistry.getAdapter(targetFilePath)
        const preMoveSourceCode = srcAdapter.generate(sourceAST)
        const preMoveTargetCode = tgtAdapter.generate(targetAST)

        // ── 3. Resolve effective target node ID ─────────────────────────────
        // When no specific target is given, fall back to the first root JSX
        // element of the target file so the drop lands somewhere reasonable.
        let effectiveTargetId = targetNodeId
        if (effectiveTargetId === null) {
            const targetTree = tgtAdapter.buildVisualTree(targetAST)
            effectiveTargetId = targetTree[0]?.id ?? null
        }
        if (effectiveTargetId === null) return  // target file has no JSX — abort

        // ── 4. Extract (or clone) source node ──────────────────────────────────
        // extractNode / synthesizeImports / insertNode are Babel-specific internal
        // helpers. The cast to File is safe: the cross-file move pipeline only
        // runs on .tsx files via ReactAdapter, which always stores Babel File ASTs.
        //
        // In cloneMode we re-parse the source AST from its pre-move code before
        // extraction so the original source buffer is never mutated (extractNode
        // removes the node from the AST in-place). The cloned parse gives us an
        // independent tree to extract from while the stored buffer stays intact.
        let extractionAST: File
        if (cloneMode) {
            const clonedAST = srcAdapter.parse(preMoveSourceCode)
            if (clonedAST === null) return
            srcAdapter.injectFlintIds(clonedAST)
            extractionAST = clonedAST as File
        } else {
            extractionAST = sourceAST as File
        }

        const extracted = extractNode(extractionAST, sourceNodeId)
        if (extracted === null) return

        // ── 5. Synthesize imports (Phase B Import Synthesizer) ─────────────────
        synthesizeImports(extractionAST, extracted, targetAST as File, sourceFilePath, targetFilePath)

        // ── 6. Insert extracted node into target AST ───────────────────────────
        const inserted = insertNode(targetAST as File, extracted, effectiveTargetId, position)
        if (!inserted) {
            if (!cloneMode) {
                // Insertion failed — restore the source AST to its pre-move state.
                const restoredSource = srcAdapter.parse(preMoveSourceCode)
                if (restoredSource !== null) {
                    srcAdapter.injectFlintIds(restoredSource)
                    set((state) => {
                        const next = new Map(state.buffers)
                        next.set(sourceFilePath, restoredSource)
                        return { buffers: next }
                    })
                }
            }
            return
        }

        // ── 7. Generate new code ───────────────────────────────────────────────
        // In cloneMode the source file is unchanged — only target needs saving.
        const newTargetCode = tgtAdapter.generate(targetAST)
        const newSourceCode = cloneMode ? preMoveSourceCode : srcAdapter.generate(sourceAST as File)

        // ── 8. Atomic batch write (Commandment 12 — Atomic Queuing) ───────────
        // In cloneMode, only write the target file (source is unchanged).
        try {
            if (cloneMode) {
                await window.flintAPI.saveFileBatch({
                    [targetFilePath]: newTargetCode,
                })
            } else {
                await window.flintAPI.saveFileBatch({
                    [sourceFilePath]: newSourceCode,
                    [targetFilePath]: newTargetCode,
                })
            }
        } catch (err) {
            console.error('[Flint] crossFileMove: saveFileBatch failed:', err)
            // Restore buffers to pre-move state.
            const restoredTarget = tgtAdapter.parse(preMoveTargetCode)
            set((state) => {
                const next = new Map(state.buffers)
                if (!cloneMode) {
                    const restoredSource = srcAdapter.parse(preMoveSourceCode)
                    if (restoredSource !== null) {
                        srcAdapter.injectFlintIds(restoredSource)
                        next.set(sourceFilePath, restoredSource)
                    }
                }
                if (restoredTarget !== null) {
                    tgtAdapter.injectFlintIds(restoredTarget)
                    next.set(targetFilePath, restoredTarget)
                }
                return { buffers: next }
            })
            return
        }

        // ── 9. Re-parse ASTs (fresh canonical ASTs) + 7D hardening ─────────────
        // In cloneMode the source buffer is left as-is (still the pre-move parse).
        const finalTarget = tgtAdapter.parse(newTargetCode)
        set((state) => {
            const next = new Map(state.buffers)
            if (!cloneMode) {
                const finalSource = srcAdapter.parse(newSourceCode)
                if (finalSource !== null) {
                    srcAdapter.injectFlintIds(finalSource)
                    next.set(sourceFilePath, finalSource)
                }
            }
            if (finalTarget !== null) {
                tgtAdapter.injectFlintIds(finalTarget)
                next.set(targetFilePath, finalTarget)
            }
            return { buffers: next }
        })

        // ── 10. Sync the active editor if either file is currently open ────────
        // Lazy imports avoid circular module dependencies.
        const { useCanvasStore } = await import('./canvasStore')
        const activeFilePath = useCanvasStore.getState().activeFilePath

        if (activeFilePath === targetFilePath) {
            const { useEditorStore } = await import('./editorStore')
            useEditorStore.getState().syncCode(newTargetCode)
        } else if (!cloneMode && activeFilePath === sourceFilePath) {
            const { useEditorStore } = await import('./editorStore')
            useEditorStore.getState().syncCode(newSourceCode)
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
        //
        // In cloneMode only the target file changes, so we push only one history
        // entry (for the target). The source is unchanged and needs no undo entry.
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
            if (!cloneMode) {
                // Source moves away — two entries, one per file.
                useHistoryStore.getState().push(srcInversions, emptyRedo, sourceFilePath, batchId, redoPlan)
                useHistoryStore.getState().push(tgtInversions, emptyRedo, targetFilePath, batchId)
            } else {
                // Clone — source is unchanged; only target file needs an undo entry.
                useHistoryStore.getState().push(tgtInversions, emptyRedo, targetFilePath, batchId)
            }
        } else {
            // Recovery redo: return inversions to the RecoveryController so it
            // can push them via pushPast (preserves the remaining future stack).
            return { srcInversions, tgtInversions, batchId }
        }
    },
}))
