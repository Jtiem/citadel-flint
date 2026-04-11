/**
 * adapters/types.ts — src/core/adapters/types.ts
 *
 * Abstract Syntax Protocol (ASP) — Phase N.1
 *
 * Defines the core IFlintAdapter interface that every language adapter
 * (React, HTML, Vue, Angular…) must implement, and the LanguageRegistry
 * singleton that dispatches to the correct adapter based on file extension.
 *
 * Flint Core (editorStore, astBufferStore, recoveryController, ASTService)
 * MUST only interact with language-specific logic through this interface.
 * Direct Babel imports in core stores are a violation of Phase N.
 *
 * Renderer Process only — no Node.js imports.
 */

// ── Re-export the shared AST mutation types ───────────────────────────────────
// These types are language-agnostic commands representing user / AI intent.
// Adapters receive these commands and translate them into framework-specific
// AST mutations.
export type { ASTMutation, InverseMutation, BatchSideEffect } from '../ASTService'
export type { VisualLayer } from '../ast-parser'

// ── IFlintAdapter ────────────────────────────────────────────────────────────

import type { ASTMutation, InverseMutation, BatchSideEffect } from '../ASTService'
import type { VisualLayer } from '../ast-parser'

/**
 * The contract every Flint language adapter must fulfill.
 *
 * The `ast` parameter type is intentionally `unknown` — each adapter owns its
 * AST representation internally. Core flint code never inspects the raw AST;
 * it only works through the methods below.
 */
export interface IFlintAdapter {
    /**
     * Parse source code into this adapter's internal AST representation.
     * Returns `null` on parse failure (e.g., syntax error during live edit).
     */
    parse(code: string): unknown | null

    /**
     * Regenerate source code from the internal AST representation.
     */
    generate(ast: unknown): string

    /**
     * Build the VisualLayer tree used by the Layer Tree UI and property
     * inspector. This is a read-only, serialisable projection of the AST.
     */
    buildVisualTree(ast: unknown): VisualLayer[]

    /**
     * Inject `data-flint-id` attributes onto all elements that do not
     * already carry one. Mutates `ast` in-place and returns it.
     * Idempotent: calling this multiple times is safe.
     */
    injectFlintIds(ast: unknown): unknown

    /**
     * Apply an ordered batch of AST mutation operations to `code` in a
     * single parse → mutate → generate cycle.
     *
     * Returns the new source code and the `InverseMutation[]` needed to
     * reconstruct the pre-batch state (used by Undo/Redo — Phase D).
     */
    applyMutationBatch(
        code: string,
        mutations: ASTMutation[]
    ): { code: string; inversions: InverseMutation[]; sideEffects: BatchSideEffect[] }

    /**
     * Returns `true` when the element identified by `flintId`
     * (`data-flint-id` attribute) still exists in `code`.
     * Used for zombie-node pre-flight checks before applying undo.
     */
    nodeExists(code: string, flintId: string): boolean

    /**
     * Validate `code` in-memory (e.g., TypeScript type-check, HTML structure).
     * Returns a human-readable error string on failure, or `null` on success.
     *
     * Used by Phase M's invisible AI recovery loop (Commandment 16).
     * Return `null` if the adapter does not support validation.
     */
    validateInMemory(code: string): string | null

    /**
     * Extract the JSX/DOM subtree identified by `nodeId` from `ast`.
     * Returns `null` when the node is not found.
     *
     * Used by the cross-file move engine (Phase F.2 / astBufferStore).
     * The returned value is opaque to callers — it is only passed back
     * into adapter methods (e.g. as a subtree for synthesizeImports).
     */
    extractNode(ast: unknown, nodeId: string): unknown | null

    /**
     * Transplant the element identified by `nodeId` from `historicAst` into
     * the matching position in `liveAst`. Both ASTs must be of the same
     * adapter type. Mutates `liveAst` in-place.
     *
     * Part of the Macro-Recovery Engine (Phase D — Commandment 11).
     */
    transplantNode(liveAst: unknown, historicAst: unknown, nodeId: string): void
}

// ── LanguageRegistry ──────────────────────────────────────────────────────────

/**
 * Maps file extensions to their registered IFlintAdapter implementations.
 * Acts as the single dispatch point for all language-specific operations.
 *
 * Usage:
 *   const adapter = LanguageRegistry.getAdapter('/path/to/Component.tsx')
 *   const ast = adapter.parse(code)
 */
class LanguageRegistryClass {
    private readonly adapters = new Map<string, IFlintAdapter>()

    /**
     * Register an adapter for one or more file extensions.
     * Extensions should be provided without the leading dot, e.g. `'tsx'`.
     */
    register(extensions: string[], adapter: IFlintAdapter): void {
        for (const ext of extensions) {
            this.adapters.set(ext.toLowerCase(), adapter)
        }
    }

    /**
     * Retrieve the adapter for a given file path.
     * Falls back to the React adapter (`.tsx`) when no specific adapter is
     * registered for the extension — this preserves backwards compatibility
     * and means the registry is always safe to call.
     *
     * @param filePath Absolute or relative path including the file extension.
     */
    getAdapter(filePath: string): IFlintAdapter {
        const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
        const adapter = this.adapters.get(ext)
        if (adapter) return adapter

        // Fallback: warn and use the React adapter.
        // This should not happen in production once all adapters are registered,
        // but prevents hard crashes during incremental N.1 rollout.
        const fallback = this.adapters.get('tsx') ?? this.adapters.get('ts')
        if (fallback) {
            console.warn(`[Flint] LanguageRegistry: no adapter for ".${ext}", falling back to ReactAdapter`)
            return fallback
        }

        throw new Error(`[Flint] LanguageRegistry: no adapter registered and no ReactAdapter fallback available. Call LanguageRegistry.register() before using the store.`)
    }

    /**
     * Returns true if an adapter is registered for the given file extension.
     */
    hasAdapter(ext: string): boolean {
        return this.adapters.has(ext.toLowerCase())
    }
}

/**
 * The global singleton registry.
 *
 * At app startup, import this and register adapters:
 *   import { LanguageRegistry } from './core/adapters/types'
 *   import { ReactAdapter } from './core/adapters/ReactAdapter'
 *   LanguageRegistry.register(['ts', 'tsx', 'js', 'jsx'], new ReactAdapter())
 */
export const LanguageRegistry = new LanguageRegistryClass()
