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
 *   Callers that mutate a headless buffer via `applyMutationBatch` should
 *   push the resulting inversions to historyStore with `filePath` set so the
 *   undo/redo engine knows which buffer to restore.
 *
 * Zustand mutation contract:
 *   Always create a new Map reference on mutation so Zustand's shallow-equality
 *   check detects the change and subscribers re-render.
 */

import { create } from 'zustand'
import type { File } from '@babel/types'
import { parseCodeToAST, injectBridgeIds } from '../core/ast-parser'

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
}))
