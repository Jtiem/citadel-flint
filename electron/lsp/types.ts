/**
 * types.ts — electron/lsp/types.ts
 *
 * Generic Language Server Protocol client interface (Phase N.3).
 *
 * The orchestrator validates AI-proposed code mutations through this abstraction.
 * Concrete implementations:
 *   • TypeScriptLspClient  — TSX/TS (uses TypeScript Compiler API worker)
 *   • HtmlLspClient        — HTML (stub; returns null / no errors, Phase N.3)
 *   • VolarLspClient       — Vue SFC (Phase N.5)
 *   • AngularLspClient     — Angular templates (Phase N.6)
 *
 * Runs in Electron's main process only. None of these types reach the renderer.
 */

export interface LspDiagnostic {
    /** Short human-readable message, e.g. "Expected '>'." */
    message: string
    /** 1-based source line number if available */
    line?: number
    /** TS error code e.g. 1005, or 0 for generic errors */
    code?: number
}

/**
 * Abstract contract for all language validators used by the Flint Orchestrator.
 */
export interface ILspClient {
    /**
     * Validates a synthetic source snippet directly in memory.
     *
     * The snippet is typically a minimal JSX/HTML fragment assembled by the
     * orchestrator to check that an AI-proposed mutation is syntactically and
     * semantically valid before it is surfaced to the user.
     *
     * @returns  A human-readable error string (fed back to the AI as an invisible
     *           recovery prompt) or `null` when the snippet is clean.
     */
    validateSnippet(snippet: string): Promise<string | null>

    /**
     * Warms up the underlying worker or language service.
     * Must be called once before the first `validateSnippet` call.
     * Implementations should be idempotent (safe to call multiple times).
     */
    start(): Promise<void>

    /**
     * Gracefully shuts down the underlying worker or language service.
     * Implementations should be idempotent (safe to call multiple times).
     */
    stop(): Promise<void>
}
