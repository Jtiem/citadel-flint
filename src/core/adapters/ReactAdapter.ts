/**
 * ReactAdapter.ts — src/core/adapters/ReactAdapter.ts
 *
 * Abstract Syntax Protocol (ASP) — Phase N.1
 *
 * Implements IFlintAdapter for React/TypeScript/JSX source files (.tsx, .ts,
 * .jsx, .js). Wraps all existing Babel-based AST logic from:
 *   - src/core/ast-parser.ts       — parse, generate, buildVisualTree, injectFlintIds
 *   - src/core/ASTService.ts       — applyMutationBatch, nodeExists, applyInversions, transplantNode
 *
 * This is a zero-behaviour-change refactor. No logic is modified — only
 * encapsulated behind the IFlintAdapter interface so Flint Core can call
 * language-specific operations without knowing which language is active.
 *
 * Renderer Process only — no Node.js imports.
 */

import type { IFlintAdapter } from './types'
import type { ASTMutation, InverseMutation } from '../ASTService'
import type { VisualLayer } from '../ast-parser'

// ── Pull in all Babel-backed implementations ──────────────────────────────────
import {
    parseCodeToAST,
    generateCodeFromAST,
    buildVisualTree,
    injectFlintIds,
    transplantNode as babelTransplantNode,
} from '../ast-parser'

import {
    applyMutationBatch as babelApplyMutationBatch,
    nodeExists as babelNodeExists,
} from '../ASTService'

import type { File } from '@babel/types'

// ── ReactAdapter ──────────────────────────────────────────────────────────────

/**
 * Flint language adapter for React / TypeScript / JSX files.
 *
 * Internally uses Babel for all AST operations. The `ast` passed between
 * methods is always a Babel `File` node, but callers treat it as `unknown`
 * per the IFlintAdapter contract—callers never inspect the AST directly.
 */
export class ReactAdapter implements IFlintAdapter {

    /**
     * Parse TSX/JSX/TS/JS source into a Babel File AST.
     * Returns `null` on syntax error so the caller can preserve the last
     * valid AST during live editing (syntax errors are expected mid-keystroke).
     */
    parse(code: string): File | null {
        return parseCodeToAST(code)
    }

    /**
     * Regenerate source code from a Babel File AST.
     */
    generate(ast: unknown): string {
        return generateCodeFromAST(ast as File)
    }

    /**
     * Build the VisualLayer tree for the Layer Tree UI and property inspector.
     */
    buildVisualTree(ast: unknown): VisualLayer[] {
        return buildVisualTree(ast as File)
    }

    /**
     * Inject `data-flint-id` attributes onto all JSX elements that do not
     * already carry one. Idempotent. Mutates `ast` in-place and returns it.
     */
    injectFlintIds(ast: unknown): unknown {
        injectFlintIds(ast as File)
        return ast
    }

    /**
     * Apply an ordered batch of ASTMutations in a single parse→mutate→generate
     * cycle, returning the new source code and the undo InverseMutation[].
     */
    applyMutationBatch(
        code: string,
        mutations: ASTMutation[]
    ): { code: string; inversions: InverseMutation[] } {
        return babelApplyMutationBatch(code, mutations)
    }

    /**
     * Returns `true` when the element identified by `flintId` (data-flint-id)
     * still exists in `code`. Used for zombie-node pre-flight checks before undo.
     */
    nodeExists(code: string, flintId: string): boolean {
        return babelNodeExists(code, flintId)
    }

    /**
     * In-memory TypeScript/JSX validation used by Phase M's AI recovery loop.
     * Currently delegates to the orchestrator's `validateToolInput` for structural
     * checks. Full TSC type-checking via LSP is planned for Phase N.3.
     *
     * Returns `null` (no error) for now — validation happens at the orchestrator
     * layer via `validateToolInput` in orchestrator.ts, not here.
     * This method exists as the integration point for the Phase N.3 LSP client.
     */
    validateInMemory(_code: string): string | null {
        // Phase N.3: wire ILspClient here.
        return null
    }

    /**
     * Extract the JSX element identified by `nodeId` from `ast`.
     * Returns the raw Babel JSXElement node (as `unknown`) or `null`.
     *
     * Used by the cross-file move engine (Phase F.2 / astBufferStore).
     * The returned node is opaque to callers — it is only passed back into
     * adapter methods (e.g. synthesizeImports in astBufferStore).
     */
    extractNode(ast: unknown, nodeId: string): unknown | null {
        const file = ast as File
        const parts = nodeId.split(':')
        const col = parseInt(parts[parts.length - 1], 10)
        const line = parseInt(parts[parts.length - 2], 10)
        const isStructuralId = parts.length >= 2 && !isNaN(col) && !isNaN(line)

        let found: import('@babel/types').JSXElement | null = null

        // Use dynamic import of traverse to match the CJS interop pattern in ast-parser.ts
        // We import traverse at module level below.
        _reactAdapterTraverse(file, {
            JSXElement(path: import('@babel/traverse').NodePath<import('@babel/types').JSXElement>) {
                const loc = path.node.loc
                let matched = false
                if (isStructuralId) {
                    matched = loc?.start.line === line && loc.start.column === col
                } else {
                    for (const attr of path.node.openingElement.attributes) {
                        if (
                            attr.type === 'JSXAttribute' &&
                            attr.name.type === 'JSXIdentifier' &&
                            attr.name.name === 'data-flint-id' &&
                            attr.value?.type === 'StringLiteral' &&
                            attr.value.value === nodeId
                        ) {
                            matched = true
                            break
                        }
                    }
                }
                if (!matched) return
                found = path.node
                path.stop()
            },
        })

        return found
    }

    /**
     * Transplant the node identified by `nodeId` from `historicAst` into the
     * matching position in `liveAst`. Used by the Macro-Recovery Engine (Phase D).
     */
    transplantNode(liveAst: unknown, historicAst: unknown, nodeId: string): void {
        babelTransplantNode(liveAst as File, historicAst as File, nodeId)
    }
}

// ── Module-level Babel traverse (CJS interop) ─────────────────────────────────
// @babel/traverse exports `default` which may be wrapped depending on Vite's
// CJS interop resolution. Mirror the same pattern used in ast-parser.ts.

import _traverseRaw from '@babel/traverse'

const _reactAdapterTraverse: typeof _traverseRaw =
    typeof _traverseRaw === 'function'
        ? _traverseRaw
        : (_traverseRaw as unknown as { default: typeof _traverseRaw }).default

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * The shared ReactAdapter instance.
 * Register with LanguageRegistry at app startup (see src/main.tsx or App.tsx).
 */
export const reactAdapter = new ReactAdapter()
