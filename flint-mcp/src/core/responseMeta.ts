/**
 * CX.1 — Response Quality Baseline
 *
 * Lightweight metadata envelope for MCP tool responses.
 * Wraps any tool result with timing, source authority, and optional confidence.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type SourceAuthority = 'ast' | 'token' | 'heuristic' | 'cached';

export interface ResponseMeta {
    /** Wall-clock execution time in milliseconds. */
    durationMs: number;
    /** Where the answer came from. */
    sourceAuthority: SourceAuthority;
    /** Optional confidence score (0-1). */
    confidence?: number;
    /** ISO 8601 timestamp of when the response was produced. */
    respondedAt: string;
}

/**
 * An MCP tool result content block (text type).
 * Mirrors the shape returned by CallToolRequest handlers.
 */
export interface TextContent {
    type: 'text';
    text: string;
}

export interface ToolResult {
    content: TextContent[];
    isError?: boolean;
}

export interface EnrichedToolResult extends ToolResult {
    _meta: ResponseMeta;
}

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Start a timer. Returns a `finish` function that wraps a ToolResult
 * with ResponseMeta.
 *
 * Usage:
 * ```ts
 * const finish = startResponseTimer('ast');
 * // ... do work ...
 * return finish(result);
 * ```
 */
export function startResponseTimer(
    sourceAuthority: SourceAuthority,
    confidence?: number,
): (result: ToolResult) => EnrichedToolResult {
    const start = performance.now();

    return (result: ToolResult): EnrichedToolResult => {
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        const meta: ResponseMeta = {
            durationMs,
            sourceAuthority,
            respondedAt: new Date().toISOString(),
        };
        if (confidence !== undefined) {
            meta.confidence = confidence;
        }

        return {
            ...result,
            _meta: meta,
        };
    };
}

/**
 * One-shot wrapper when you already know the duration.
 */
export function withResponseMeta(
    result: ToolResult,
    sourceAuthority: SourceAuthority,
    durationMs: number,
    confidence?: number,
): EnrichedToolResult {
    const meta: ResponseMeta = {
        durationMs,
        sourceAuthority,
        respondedAt: new Date().toISOString(),
    };
    if (confidence !== undefined) {
        meta.confidence = confidence;
    }
    return { ...result, _meta: meta };
}
