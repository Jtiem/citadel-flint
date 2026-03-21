/**
 * Editor Store — src/store/editorStore.ts
 *
 * Zustand v5 store for the Monaco code editor and AST pipeline.
 *
 * State:
 *   rawCode       — The raw TypeScript/JSX source text in the editor.
 *   ast           — The last successfully-parsed Babel File AST (or null).
 *   selectedNodeId — The synthetic ID of the currently selected VisualLayer.
 *   visualTree    — Simplified JSX layer hierarchy extracted from the AST.
 *
 * Actions:
 *   setCode             — Updates rawCode and re-parses; preserves the last
 *                         valid AST if the new code has a syntax error.
 *   setSelectedNode     — Sets the selected layer by ID.
 *   updateNodeProperty  — Mutates a JSX node property via the AST pipeline
 *                         and regenerates source code.
 */

import { create } from 'zustand'
// Phase N.1: editorStore no longer imports Babel directly.
// All AST operations are routed through LanguageRegistry so the same store
// works for any language the adapter registry supports.
import { LanguageRegistry } from '../core/adapters/types'
import type { VisualLayer } from '../core/ast-parser'
import type { DropPosition } from '../utils/astModifier'
import type { ASTMutation } from '../core/ASTService'
import { useCanvasStore } from './canvasStore'
import { useHistoryStore } from './historyStore'
import type { LinterWarning } from '../types/flint-api'
import { A11yLinter } from '../core/A11yLinter'

// ── Seed content ──────────────────────────────────────────────────────────────
// A realistic React component with JSX nesting, TypeScript interfaces, and
// Tailwind classes so the layer tree is populated with real data on first load.
const INITIAL_CODE = `import React from 'react'

interface Props {
  title: string
}

export default function Card({ title }: Props) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-400">
        Edit this component to see the AST update in real time.
      </p>
    </div>
  )
}
`

// ── Store shape ───────────────────────────────────────────────────────────────

interface EditorState {
    rawCode: string
    /**
     * The last successfully-parsed AST (type is adapter-specific, treated as
     * unknown by Flint Core per the IFlintAdapter contract — Phase N.1).
     */
    ast: unknown | null
    selectedNodeId: string | null
    /** ID of the layer currently hovered — drives bi-directional hover sync with the iframe. */
    hoveredId: string | null
    visualTree: VisualLayer[]
    /**
     * When non-null, CodeEditor scrolls to this 1-based line number and resets
     * the value to null. Clicking the same row twice therefore always jumps.
     */
    jumpToLine: number | null
    /**
     * Rich perceptual-drift warnings indexed by `data-flint-id`.
     *
     * This is the single source of truth for all Mithril Violation state:
     * - `MithrilProvider` populates it after every full-file AST scan.
     * - `PropertiesPanel.checkMithrilDrift` upserts/removes single entries
     *   immediately on className commit for pre-AST-update feedback.
     * - The Export Gate reads `linterWarnings.size` via `canvasStore.canExport`.
     *
     * Cleared on `clearAST()` (file close / project switch).
     */
    linterWarnings: Map<string, LinterWarning>
}

interface EditorActions {
    setCode: (code: string) => void
    setSelectedNode: (id: string) => void
    /** Triggers a jump-to-line in the code editor. Pass null to clear. */
    setJumpToLine: (line: number | null) => void
    /** Sets the hovered layer ID for bi-directional hover sync. Pass null to clear. */
    setHoveredId: (id: string | null) => void
    /**
     * Mutates the JSX element identified by `nodeId`, setting `propName`
     * to `value`. Currently supports 'className'. Triggers a full
     * re-parse cycle: fresh AST → mutate → regenerate → re-parse → set.
     */
    updateNodeProperty: (
        nodeId: string,
        propName: string,
        value: string
    ) => void
    /**
     * Moves the JSX element identified by `sourceId` to a position relative
     * to `targetId`. Triggers the same fresh AST → mutate → regenerate cycle
     * as updateNodeProperty.
     */
    moveLayerNode: (
        sourceId: string,
        targetId: string,
        position: DropPosition
    ) => void
    /**
     * Appends a new JSX element (from `jsxSnippet`) as the last child of the
     * element identified by `targetNodeId`, and optionally prepends a deduped
     * import declaration. Triggers a fresh AST → mutate → regenerate cycle.
     */
    injectComponent: (
        targetNodeId: string,
        jsxSnippet: string,
        importSnippet?: string
    ) => void
    /**
     * Surgically replaces a single hardcoded Tailwind arbitrary-value class
     * (e.g. "hover:bg-[#f3f3f3]") with a token-derived class
     * (e.g. "hover:bg-brand-primary") on the element identified by `nodeId`,
     * leaving all other classes untouched.
     */
    applyTokenFix: (
        nodeId: string,
        hardcodedClass: string,
        tokenClass: string
    ) => void
    /**
     * Applies a batch of AST mutations in a **single** parse→mutate→generate
     * cycle and triggers exactly ONE `ast:save-file` IPC call.
     *
     * Also records the inverse mutations in historyStore so the batch can be
     * undone via `applyInversions`.
     *
     * Silent no-op when `rawCode` cannot be parsed.
     */
    applyBatch: (mutations: ASTMutation[]) => void
    /**
     * Wipes all editor state: rawCode, AST, visual tree, selection, and undo
     * history. Call this (via `editorStore.getState().clearAST()`) before
     * loading a new file to prevent "Ghost Layers" from the previous file
     * bleeding through (Clean Slate Protocol — Mithril Rule).
     */
    clearAST: () => void
    /**
     * Replaces the entire `linterWarnings` map with the provided one.
     * Called by `MithrilProvider` after a full-file AST scan.
     */
    setLinterWarnings: (warnings: Map<string, LinterWarning>) => void
    /**
     * Upserts a single entry in `linterWarnings`.
     * Called by `PropertiesPanel.checkMithrilDrift` for immediate pre-commit feedback.
     */
    setLinterWarning: (id: string, warning: LinterWarning) => void
    /**
     * Removes a single entry from `linterWarnings`.
     * Called by `PropertiesPanel.checkMithrilDrift` when drift resolves.
     */
    clearLinterWarning: (id: string) => void
    /**
     * Wipes all entries from `linterWarnings`.
     * Called by `clearAST` as part of the Clean Slate Protocol.
     */
    clearAllLinterWarnings: () => void
    /**
     * Updates rawCode, ast, and visualTree without triggering auto-save or
     * clearing undo/redo history. Used after programmatic mutations that have
     * already been persisted externally (e.g., crossFileMove via astBufferStore).
     *
     * Silent no-op when `code` cannot be parsed.
     */
    syncCode: (code: string) => void
    /**
     * Reverts the JSX element identified by `nodeId` to its last-committed
     * (HEAD) state using a surgical AST transplant (Phase D.1 / Commandment 11).
     * Thin wrapper over `revertNodeToCommit(nodeId, 'HEAD')`.
     */
    revertNodeToHead: (nodeId: string) => Promise<void>
    /**
     * Reverts the JSX element identified by `nodeId` to its state at
     * `commitHash` using a surgical AST transplant.
     *
     * Flow:
     *   1. Fetches the file's content at `commitHash` via `window.flintAPI.gitShow`.
     *   2. Parses historic code to a Babel AST.
     *   3. Calls `transplantNode` to replace the live node with a deep clone
     *      of the corresponding historic node, leaving all other nodes intact.
     *   4. Regenerates, re-parses, and updates store state via `triggerAutoSave`.
     *
     * Silent no-op when no file is open, the file is not tracked by git, or
     * `nodeId` cannot be resolved in either AST.
     */
    revertNodeToCommit: (nodeId: string, commitHash: string) => Promise<void>
}

type EditorStore = EditorState & EditorActions

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorStore>((set, get) => {
    // Parse the initial code at store-creation time so the layer tree shows
    // real content immediately on first render. Wrapped in try/catch because
    // module evaluation order in Vite's dev server is not guaranteed — if this
    // store module is evaluated before App.tsx has registered adapters the
    // getAdapter() call would throw. In that case we start with an empty tree;
    // it populates on the first setCode() call once adapters are live.
    let initialAst: unknown = null
    let initialTree: VisualLayer[] = []
    try {
        const _adapter = LanguageRegistry.getAdapter('initial.tsx')
        initialAst = _adapter.parse(INITIAL_CODE)
        initialTree = initialAst !== null ? _adapter.buildVisualTree(initialAst) : []
    } catch {
        // Registry not yet populated — tree will be rebuilt on first setCode().
    }

    return {
        rawCode: INITIAL_CODE,
        ast: initialAst,
        selectedNodeId: null,
        hoveredId: null,
        visualTree: initialTree,
        jumpToLine: null,
        linterWarnings: new Map(),

        setCode: (code: string) => {
            // Capture BEFORE set() so the file-load vs. typing check is
            // comparing against the previous value (Commandment 10 fix).
            const previousCode = get().rawCode
            const activeFilePath = useCanvasStore.getState().activeFilePath ?? 'file.tsx'
            const adapter = LanguageRegistry.getAdapter(activeFilePath)
            const parsed = adapter.parse(code)
            if (parsed !== null) {
                // Happy path: code is syntactically valid — update everything.
                set({
                    rawCode: code,
                    ast: parsed,
                    visualTree: adapter.buildVisualTree(parsed),
                })
                // Debounced auto-save (1 s) so rapid keystrokes don't flood IPC.
                useCanvasStore.getState().triggerAutoSave(code, 1000)

                // ── Phase B.3: Accessibility Gate ─────────────────────────
                // A11yLinter still operates on Babel ASTs internally.
                // Cast is safe: for React files the adapter returns a Babel File.
                // Phase N.3 will introduce a normalised IR lint path.
                const a11yViolations = A11yLinter.audit(parsed as import('@babel/types').File)
                useCanvasStore.getState().setA11yViolations(a11yViolations)

                // Clear undo/redo history when loading a different file.
                if (code !== previousCode) {
                    useHistoryStore.getState().clear()
                }
            } else {
                // Parse error (normal during live editing): update rawCode so
                // Monaco reflects what the user typed, but keep the last valid
                // AST so the layer tree and inspector panel don't go blank.
                set((state) => ({ ...state, rawCode: code }))
            }
        },

        setSelectedNode: (id: string) => {
            set({ selectedNodeId: id })
        },

        setJumpToLine: (line: number | null) => {
            set({ jumpToLine: line })
        },

        setHoveredId: (id: string | null) => {
            set({ hoveredId: id })
        },

        updateNodeProperty: (
            nodeId: string,
            propName: string,
            value: string
        ) => {
            if (propName === 'className') {
                get().applyBatch([{ op: 'updateClassName', nodeId, className: value }])
            } else if (propName === 'textContent') {
                get().applyBatch([{ op: 'updateTextContent', nodeId, text: value }])
            } else {
                get().applyBatch([{ op: 'updateProp', nodeId, propName, value }])
            }
        },

        moveLayerNode: (sourceId, targetId, position) => {
            get().applyBatch([{ op: 'moveNode', sourceId, targetId, position }])
        },

        injectComponent: (targetNodeId, jsxSnippet, importSnippet) => {
            get().applyBatch([{ op: 'injectComponent', targetNodeId, jsxSnippet, importSnippet }])
        },

        applyTokenFix: (nodeId, hardcodedClass, tokenClass) => {
            get().applyBatch([{ op: 'applyTokenFix', nodeId, hardcodedClass, tokenClass }])
        },

        applyBatch: (mutations) => {
            if (mutations.length === 0) return

            const activeFilePath = useCanvasStore.getState().activeFilePath ?? 'file.tsx'
            const adapter = LanguageRegistry.getAdapter(activeFilePath)

            const { code: newCode, inversions } = adapter.applyMutationBatch(
                get().rawCode,
                mutations
            )

            // No-op detection: structural mutation silently failed.
            const firstInv = inversions[0]
            if (firstInv?.op === 'restoreCode' && firstInv.code === newCode) {
                return
            }

            const newAst = adapter.parse(newCode)
            if (newAst === null) return

            // Commandment 7 — ID Preservation: inject data-flint-id onto any
            // newly created or moved nodes produced by structural mutations.
            // Non-structural ops (updateClassName, updateProp, updateTextContent,
            // applyTokenFix) do not create new nodes so the call is skipped when
            // no structural op is present, keeping the hot path allocation-free.
            const STRUCTURAL_OPS = new Set([
                'moveNode',
                'injectComponent',
                'deleteNode',
            ])
            const hasStructural = mutations.some((m) => STRUCTURAL_OPS.has(m.op))

            let finalCode = newCode
            let finalAst: unknown = newAst
            if (hasStructural) {
                adapter.injectFlintIds(newAst)
                finalCode = adapter.generate(newAst)
                // Re-parse so the stored AST reflects the injected IDs.
                const reAst = adapter.parse(finalCode)
                if (reAst !== null) {
                    finalAst = reAst
                }
            }

            set({
                rawCode: finalCode,
                ast: finalAst,
                visualTree: adapter.buildVisualTree(finalAst),
            })

            // ONE save-file IPC call for the entire batch.
            useCanvasStore.getState().triggerAutoSave(finalCode)

            // Record inverse for undo/redo.
            useHistoryStore.getState().push(inversions, mutations)
        },

        syncCode: (code: string) => {
            const activeFilePath = useCanvasStore.getState().activeFilePath ?? 'file.tsx'
            const adapter = LanguageRegistry.getAdapter(activeFilePath)
            const parsed = adapter.parse(code)
            if (parsed === null) return
            set({
                rawCode: code,
                ast: parsed,
                visualTree: adapter.buildVisualTree(parsed),
            })
        },

        clearAST: () => {
            // Clear undo/redo history first so cross-file undo is impossible.
            useHistoryStore.getState().clear()
            set({
                rawCode: '',
                ast: null,
                visualTree: [],
                selectedNodeId: null,
                hoveredId: null,
                jumpToLine: null,
                linterWarnings: new Map(),
            })

            // EXPLICIT FLUSH: bypass React/IPC tick and kill the iframe DOM instantly
            // to prevent Ghost Overlays from lingering during file switches.
            if (typeof window !== 'undefined') {
                for (let i = 0; i < window.frames.length; i++) {
                    window.frames[i].postMessage({ type: 'CLEAR_PREVIEW' }, '*')
                }
            }
        },

        setLinterWarnings: (warnings) => {
            set({ linterWarnings: warnings })
        },

        setLinterWarning: (id, warning) => {
            const updated = new Map(get().linterWarnings)
            updated.set(id, warning)
            set({ linterWarnings: updated })
        },

        clearLinterWarning: (id) => {
            const prev = get().linterWarnings
            if (!prev.has(id)) return
            const updated = new Map(prev)
            updated.delete(id)
            set({ linterWarnings: updated })
        },

        clearAllLinterWarnings: () => {
            set({ linterWarnings: new Map() })
        },

        revertNodeToHead: async (nodeId: string) => {
            return get().revertNodeToCommit(nodeId, 'HEAD')
        },

        revertNodeToCommit: async (nodeId: string, commitHash: string) => {
            const activeFilePath = useCanvasStore.getState().activeFilePath
            if (activeFilePath === null) return

            const historicCode = await window.flintAPI.gitShow(activeFilePath, commitHash)
            if (historicCode === null) return

            const adapter = LanguageRegistry.getAdapter(activeFilePath)

            const historicAst = adapter.parse(historicCode)
            if (historicAst === null) return

            const freshAst = adapter.parse(get().rawCode)
            if (freshAst === null) return

            const preTransplantCode = get().rawCode

            // Surgically swap the historic node into the live AST.
            adapter.transplantNode(freshAst, historicAst, nodeId)

            const newCode = adapter.generate(freshAst)
            const newAst = adapter.parse(newCode)
            if (newAst === null) return

            set({
                rawCode: newCode,
                ast: newAst,
                visualTree: adapter.buildVisualTree(newAst),
            })
            useCanvasStore.getState().triggerAutoSave(newCode)

            useHistoryStore.getState().push(
                [{ op: 'restoreCode', code: preTransplantCode }],
                []
            )
        },
    }
})
