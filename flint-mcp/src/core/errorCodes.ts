/**
 * Error Codes — flint-mcp/src/core/errorCodes.ts
 *
 * CX.3: Structured tool-failure error codes for the Flint MCP engine.
 *
 * These codes cover runtime failures in MCP tool handlers — file not found,
 * parse failures, permission errors, etc. They are distinct from the linter
 * rule taxonomy in errorTaxonomy.ts (which covers governance violations).
 *
 * Every Flint tool error carries:
 *   - a stable FLINT-ERR-XXX code
 *   - a plain-English description the calling agent can relay to the user
 *   - a recovery instruction so agents can self-correct instead of retrying blind
 *   - optional structured context (filePath, nodeId, etc.)
 *
 * Design constraints:
 *   - No imports at runtime — pure type and constant data.
 *   - O(1) lookup via TOOL_ERROR_REGISTRY map keyed by code.
 *   - Additive — does not modify existing warning/violation shapes.
 */

// ── FlintError shape ─────────────────────────────────────────────────────────

/** Discriminated union of all valid tool error codes. */
export type FlintErrorCode =
    | 'FLINT-ERR-001'
    | 'FLINT-ERR-002'
    | 'FLINT-ERR-003'
    | 'FLINT-ERR-004'
    | 'FLINT-ERR-005'
    | 'FLINT-ERR-006'
    | 'FLINT-ERR-007'
    | 'FLINT-ERR-008'
    | 'FLINT-ERR-009'
    | 'FLINT-ERR-010'

/**
 * Structured error payload returned by Flint MCP tool handlers on failure.
 * Provides the calling agent with a stable code, a human-readable message,
 * and an actionable recovery instruction.
 */
export interface FlintError {
    /** Discriminant — always 'FlintError'. Used by isFlintError(). */
    readonly _type: 'FlintError'
    /** Stable error code, e.g. "FLINT-ERR-001". */
    code: FlintErrorCode
    /** Plain-English description of what went wrong. */
    message: string
    /** What the calling agent should do to recover or retry. */
    recovery: string
    /** Optional structured data (filePath, nodeId, ruleId, etc.). */
    context?: Record<string, unknown>
}

// ── Error definitions ─────────────────────────────────────────────────────────

interface ToolErrorDef {
    message: string
    recovery: string
}

const TOOL_ERROR_REGISTRY: Record<FlintErrorCode, ToolErrorDef> = {
    'FLINT-ERR-001': {
        message: 'Target node not found in AST (flint-id missing or stale).',
        recovery: 'Run flint_audit first to refresh AST state, then retry the operation with the updated node ID.',
    },
    'FLINT-ERR-002': {
        message: 'File not found or unreadable at the specified path.',
        recovery: 'Verify the file path exists and is within the project root. Use flint_status to confirm the project root is correctly resolved.',
    },
    'FLINT-ERR-003': {
        message: 'Invalid or unparseable TSX/JSX source (Babel parse failure).',
        recovery: 'Check the file for syntax errors. Run npx tsc --noEmit to identify TypeScript issues. Ensure the file uses valid JSX syntax.',
    },
    'FLINT-ERR-004': {
        message: 'Design token not found in the token registry.',
        recovery: 'Run flint_sync_tokens to refresh the token registry, then retry. Verify the token path exists in your design-tokens.json file.',
    },
    'FLINT-ERR-005': {
        message: 'Mutation produced invalid TypeScript (in-memory TSC validation failed).',
        recovery: 'The proposed mutation is type-unsafe. Review the operation parameters or use the dryRun flag on flint_ast_mutate to inspect the output before committing.',
    },
    'FLINT-ERR-006': {
        message: 'Export blocked — active governance violations or overrides remain.',
        recovery: 'Resolve all violations via flint_audit and flint_fix before exporting. Check the export gate status in flint_status.',
    },
    'FLINT-ERR-007': {
        message: 'File write failed (disk error or insufficient permissions).',
        recovery: 'Check disk space and file permissions. Confirm the target path is writable. All Flint writes route through FileTransactionManager — a disk-full or permission error aborts atomically.',
    },
    'FLINT-ERR-008': {
        message: 'MCP tool called with missing or invalid required parameters.',
        recovery: 'See the tool schema in flint://capabilities for all required parameters and their types. Use flint_status to verify the server is healthy.',
    },
    'FLINT-ERR-009': {
        message: 'healOnAudit is not available in headless MCP mode.',
        recovery: 'Use flint_fix directly for auto-healing in headless MCP mode. The full heal pipeline (IngestionAuditor) requires the Glass IPC pipeline (Electron main process).',
    },
    'FLINT-ERR-010': {
        message: 'Unknown or unexpected internal error.',
        recovery: 'Report this error with the full tool response to the Flint issue tracker. Include the request parameters and any context shown in the error.',
    },
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a structured FlintError for the given code.
 *
 * @param code     One of the 10 FLINT-ERR-XXX codes.
 * @param context  Optional key-value context (filePath, nodeId, etc.) to attach.
 * @returns        A FlintError ready to include in a tool response.
 *
 * @example
 * ```ts
 * return { content: [{ type: 'text', text: JSON.stringify(flintError('FLINT-ERR-002', { filePath })) }], isError: true }
 * ```
 */
export function flintError(
    code: FlintErrorCode,
    context?: Record<string, unknown>,
): FlintError {
    const def = TOOL_ERROR_REGISTRY[code]
    const error: FlintError = {
        _type: 'FlintError',
        code,
        message: def.message,
        recovery: def.recovery,
    }
    if (context !== undefined) {
        error.context = context
    }
    return error
}

// ── Type guard ────────────────────────────────────────────────────────────────

/**
 * Returns true if the value is a FlintError object.
 * Safe to call on any unknown value — never throws.
 *
 * @example
 * ```ts
 * if (isFlintError(response)) {
 *   console.error(`[${response.code}] ${response.message}`);
 * }
 * ```
 */
export function isFlintError(val: unknown): val is FlintError {
    return (
        val !== null &&
        typeof val === 'object' &&
        (val as Record<string, unknown>)['_type'] === 'FlintError' &&
        typeof (val as Record<string, unknown>)['code'] === 'string' &&
        typeof (val as Record<string, unknown>)['message'] === 'string' &&
        typeof (val as Record<string, unknown>)['recovery'] === 'string'
    )
}

// ── Formatter ─────────────────────────────────────────────────────────────────

/**
 * Formats a FlintError into a plain-text string suitable for MCP tool response
 * content or agent display.
 *
 * @example
 * Output:
 *   [FLINT-ERR-002] File not found or unreadable at the specified path.
 *   Recovery: Verify the file path exists and is within the project root.
 *   Context: {"filePath": "/src/Button.tsx"}
 */
export function formatFlintError(error: FlintError): string {
    const lines: string[] = [
        `[${error.code}] ${error.message}`,
        `Recovery: ${error.recovery}`,
    ]
    if (error.context !== undefined && Object.keys(error.context).length > 0) {
        lines.push(`Context: ${JSON.stringify(error.context)}`)
    }
    return lines.join('\n')
}
