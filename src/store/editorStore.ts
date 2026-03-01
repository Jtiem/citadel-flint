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
import type { File } from '@babel/types'
import {
    parseCodeToAST,
    buildVisualTree,
    generateCodeFromAST,
    updateJSXClassName,
    updateJSXTextContent,
} from '../core/ast-parser'
import type { VisualLayer } from '../core/ast-parser'
import {
    moveNode,
    injectComponent as injectComponentAST,
    applyTokenFix as applyTokenFixAST,
} from '../utils/astModifier'
import type { DropPosition } from '../utils/astModifier'
import { applyMutationBatch } from '../core/ASTService'
import type { ASTMutation } from '../core/ASTService'
import { useCanvasStore } from './canvasStore'
import { useHistoryStore } from './historyStore'

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
    /** Babel File AST — typed precisely, not as `object`, per CLAUDE.md rule: no any. */
    ast: File | null
    selectedNodeId: string | null
    /** ID of the layer currently hovered — drives bi-directional hover sync with the iframe. */
    hoveredId: string | null
    visualTree: VisualLayer[]
    /**
     * When non-null, CodeEditor scrolls to this 1-based line number and resets
     * the value to null. Clicking the same row twice therefore always jumps.
     */
    jumpToLine: number | null
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
}

type EditorStore = EditorState & EditorActions

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorStore>((set, get) => {
    // Parse the initial code synchronously at store-creation time so the
    // layer tree shows real content immediately on the first render.
    const initialAst = parseCodeToAST(INITIAL_CODE)
    const initialTree =
        initialAst !== null ? buildVisualTree(initialAst) : []

    return {
        rawCode: INITIAL_CODE,
        ast: initialAst,
        selectedNodeId: null,
        hoveredId: null,
        visualTree: initialTree,
        jumpToLine: null,

        setCode: (code: string) => {
            const parsed = parseCodeToAST(code)
            if (parsed !== null) {
                // Happy path: code is syntactically valid — update everything.
                set({
                    rawCode: code,
                    ast: parsed,
                    visualTree: buildVisualTree(parsed),
                })
                // Debounced auto-save (1 s) so rapid keystrokes don't flood IPC.
                // No-op when no project folder is open (activeFilePath is null).
                useCanvasStore.getState().triggerAutoSave(code, 1000)

                // Clear undo/redo history when loading a different file.
                // Prevents cross-file undo corruption (Commandment 10).
                // We detect "file load" vs "typing" by comparing against rawCode:
                // if the incoming code is completely different from what is
                // currently in the store, treat it as a fresh file load.
                if (code !== get().rawCode) {
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
            // Parse a FRESH copy of rawCode — never mutate the store's live ast.
            const freshAst = parseCodeToAST(get().rawCode)
            if (freshAst === null) return

            // Mutate the fresh AST in-place based on the property name.
            if (propName === 'className') {
                updateJSXClassName(freshAst, nodeId, value)
            } else if (propName === 'textContent') {
                updateJSXTextContent(freshAst, nodeId, value)
            } else {
                // Unsupported property — abort silently.
                return
            }

            // Regenerate source from the mutated AST, then re-parse for a
            // clean canonical AST (Babel's generator output is always re-parseable)
            const newCode = generateCodeFromAST(freshAst)
            const newAst = parseCodeToAST(newCode)
            if (newAst === null) return

            set({
                rawCode: newCode,
                ast: newAst,
                visualTree: buildVisualTree(newAst),
            })
            // Persist immediately — this is a discrete user mutation, not typing.
            useCanvasStore.getState().triggerAutoSave(newCode)
        },

        moveLayerNode: (sourceId, targetId, position) => {
            const freshAst = parseCodeToAST(get().rawCode)
            if (freshAst === null) return

            moveNode(freshAst, sourceId, targetId, position)

            const newCode = generateCodeFromAST(freshAst)
            const newAst = parseCodeToAST(newCode)
            if (newAst === null) return

            set({
                rawCode: newCode,
                ast: newAst,
                visualTree: buildVisualTree(newAst),
            })
            useCanvasStore.getState().triggerAutoSave(newCode)
        },

        injectComponent: (targetNodeId, jsxSnippet, importSnippet) => {
            const freshAst = parseCodeToAST(get().rawCode)
            if (freshAst === null) return

            injectComponentAST(freshAst, targetNodeId, jsxSnippet, importSnippet)

            const newCode = generateCodeFromAST(freshAst)
            const newAst = parseCodeToAST(newCode)
            if (newAst === null) return

            set({
                rawCode: newCode,
                ast: newAst,
                visualTree: buildVisualTree(newAst),
            })
            useCanvasStore.getState().triggerAutoSave(newCode)
        },

        applyTokenFix: (nodeId, hardcodedClass, tokenClass) => {
            const freshAst = parseCodeToAST(get().rawCode)
            if (freshAst === null) return

            applyTokenFixAST(freshAst, nodeId, hardcodedClass, tokenClass)

            const newCode = generateCodeFromAST(freshAst)
            const newAst = parseCodeToAST(newCode)
            if (newAst === null) return

            set({
                rawCode: newCode,
                ast: newAst,
                visualTree: buildVisualTree(newAst),
            })
            useCanvasStore.getState().triggerAutoSave(newCode)
        },

        applyBatch: (mutations) => {
            if (mutations.length === 0) return

            const { code: newCode, inversions } = applyMutationBatch(
                get().rawCode,
                mutations
            )

            const newAst = parseCodeToAST(newCode)
            if (newAst === null) return

            set({
                rawCode: newCode,
                ast: newAst,
                visualTree: buildVisualTree(newAst),
            })

            // ONE save-file IPC call for the entire batch.
            useCanvasStore.getState().triggerAutoSave(newCode)

            // Record inverse for undo/redo.
            useHistoryStore.getState().push(inversions, mutations)
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
            })

            // EXPLICIT FLUSH: bypass React/IPC tick and kill the iframe DOM instantly
            // to prevent Ghost Overlays from lingering during file switches.
            if (typeof window !== 'undefined') {
                for (let i = 0; i < window.frames.length; i++) {
                    window.frames[i].postMessage({ type: 'CLEAR_PREVIEW' }, '*')
                }
            }
        },
    }
})
