/**
 * Cross-Platform Token Emitter types -- flint-mcp/src/core/emitters/types.ts
 *
 * EXP.7: Shared type definitions for the platform token emission pipeline.
 * All emitters consume DesignToken[] and produce PlatformOutput.
 */

import type { DesignToken, TokenType } from '../../types.js'

// Re-export for convenience
export type { DesignToken, TokenType }

// -- Platform targets ----------------------------------------------------------

/**
 * Supported platform output targets.
 * Adding a new platform (e.g. 'flutter') requires:
 *   1. A new emitter file implementing PlatformEmitter
 *   2. Registration in the emitter registry (index.ts)
 */
export type PlatformTarget =
    | 'tailwind'
    | 'css'
    | 'react-native'
    | 'swift'
    | 'kotlin'

// -- Emitter output ------------------------------------------------------------

/**
 * The result of a single platform emission.
 */
export interface PlatformOutput {
    /** Which platform this output targets. */
    platform: PlatformTarget
    /** The generated source code string. */
    code: string
    /** Suggested filename for this output (e.g. 'tailwind.config.ts'). */
    filename: string
    /** Number of tokens successfully emitted. */
    tokenCount: number
    /** Tokens that were skipped (unsupported type for this platform). */
    skippedTokens: SkippedToken[]
    /** MIME type of the output file (for MCP content negotiation). */
    mimeType: string
}

/**
 * A token that could not be emitted for a specific platform.
 */
export interface SkippedToken {
    /** The token_path of the skipped token. */
    tokenPath: string
    /** The token_type of the skipped token. */
    tokenType: TokenType
    /** Human-readable reason it was skipped. */
    reason: string
}

// -- Validation ----------------------------------------------------------------

/**
 * Result of validating a platform output.
 * Each emitter validates its own output for syntactic correctness.
 */
export interface ValidationResult {
    /** Whether the output is valid. */
    valid: boolean
    /** Validation errors, if any. */
    errors: ValidationError[]
}

export interface ValidationError {
    /** Line number in the generated output (1-based), or null if not applicable. */
    line: number | null
    /** Human-readable error description. */
    message: string
}

// -- Emitter interface ---------------------------------------------------------

/**
 * Contract for a platform-specific token emitter.
 *
 * Design constraints:
 *   - emit() is a PURE FUNCTION: tokens in, PlatformOutput out. No I/O.
 *   - validate() checks the output string for syntactic correctness.
 *   - Each emitter is a standalone module with no cross-emitter dependencies.
 */
export interface PlatformEmitter {
    /** Which platform this emitter targets. */
    readonly platform: PlatformTarget
    /** The default filename for this platform's output. */
    readonly defaultFilename: string
    /**
     * Emit platform-native token definitions from the given design tokens.
     *
     * @param tokens    The full set of DTCG-normalized design tokens.
     * @param options   Platform-specific options (optional).
     * @returns         The generated output with metadata.
     */
    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput
    /**
     * Validate the generated output for syntactic correctness.
     * Does NOT validate runtime behavior -- only structure/syntax.
     */
    validate(output: PlatformOutput): ValidationResult
}

/**
 * Optional emitter configuration passed through from the tool handler.
 */
export interface EmitOptions {
    /** Filter tokens to a specific mode (e.g. 'Light', 'Dark'). When omitted, emits all modes. */
    mode?: string
    /** Filter tokens to a specific collection. When omitted, emits all collections. */
    collection?: string
    /** Prefix for generated identifiers (e.g. CSS variable prefix). Defaults vary by platform. */
    prefix?: string
}

// -- Cross-platform audit ------------------------------------------------------

/**
 * Token presence record across all targeted platforms.
 */
export interface TokenCoverageEntry {
    /** The token_path. */
    tokenPath: string
    /** The token_type. */
    tokenType: TokenType
    /** Which platforms successfully emitted this token. */
    presentIn: PlatformTarget[]
    /** Which platforms skipped this token. */
    missingFrom: PlatformTarget[]
}

/**
 * A consistency issue found during cross-platform audit.
 */
export interface ConsistencyIssue {
    /** Severity of the inconsistency. */
    severity: 'error' | 'warning' | 'info'
    /** Which token is affected. */
    tokenPath: string
    /** Human-readable description of the issue. */
    message: string
    /** Platforms involved in the inconsistency. */
    platforms: PlatformTarget[]
}

/**
 * Result of the cross-platform audit.
 */
export interface CrossPlatformAuditResult {
    /** Overall consistency grade: A (all tokens in all platforms) through F. */
    grade: string
    /** Consistency score 0-100. */
    score: number
    /** Total unique tokens across all platforms. */
    totalTokens: number
    /** Per-token coverage across platforms. */
    coverage: TokenCoverageEntry[]
    /** Specific consistency issues found. */
    issues: ConsistencyIssue[]
    /** Summary statistics by platform. */
    platformSummary: PlatformSummary[]
}

/**
 * Per-platform summary in the audit result.
 */
export interface PlatformSummary {
    platform: PlatformTarget
    /** Tokens emitted for this platform. */
    emitted: number
    /** Tokens skipped for this platform. */
    skipped: number
    /** Coverage percentage (emitted / total * 100). */
    coveragePercent: number
}

// -- Sync report ---------------------------------------------------------------

/**
 * Full report returned by the flint_emit_tokens tool.
 */
export interface TokenSyncReport {
    /** ISO 8601 timestamp when this report was generated. */
    generatedAt: string
    /** Total input tokens from design-tokens.json. */
    inputTokenCount: number
    /** Whether this was a dry run (no files written). */
    dryRun: boolean
    /** Per-platform emission results. */
    outputs: PlatformOutput[]
    /** Per-platform validation results. */
    validations: Record<PlatformTarget, ValidationResult>
    /** Cross-platform consistency audit (null if only one platform was targeted). */
    audit: CrossPlatformAuditResult | null
    /** Output directory where files were written (null for dry run). */
    outputDir: string | null
}
