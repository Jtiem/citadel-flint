/**
 * Error Codes — bridge-mcp/src/core/errorCodes.ts
 *
 * CX.3: Structured tool-failure error codes for the Bridge MCP engine.
 *
 * These codes cover runtime failures in MCP tool handlers — file not found,
 * parse failures, permission errors, etc. They are distinct from the linter
 * rule taxonomy in errorTaxonomy.ts (which covers governance violations).
 *
 * Every Bridge tool error carries:
 *   - a stable BRIDGE-ERR-XXX code
 *   - a plain-English description the calling agent can relay to the user
 *   - a recovery instruction so agents can self-correct instead of retrying blind
 *   - optional structured context (filePath, nodeId, etc.)
 *
 * Design constraints:
 *   - No imports at runtime — pure type and constant data.
 *   - O(1) lookup via TOOL_ERROR_REGISTRY map keyed by code.
 *   - Additive — does not modify existing warning/violation shapes.
 */

// ── BridgeError shape ─────────────────────────────────────────────────────────

/** Discriminated union of all valid tool error codes. */
export type BridgeErrorCode =
    | 'BRIDGE-ERR-001'
    | 'BRIDGE-ERR-002'
    | 'BRIDGE-ERR-003'
    | 'BRIDGE-ERR-004'
    | 'BRIDGE-ERR-005'
    | 'BRIDGE-ERR-006'
    | 'BRIDGE-ERR-007'
    | 'BRIDGE-ERR-008'
    | 'BRIDGE-ERR-009'
    | 'BRIDGE-ERR-010'

/**
 * Structured error payload returned by Bridge MCP tool handlers on failure.
 * Provides the calling agent with a stable code, a human-readable message,
 * and an actionable recovery instruction.
 */
export interface BridgeError {
    /** Discriminant — always 'BridgeError'. Used by isBridgeError(). */
    readonly _type: 'BridgeError'
    /** Stable error code, e.g. "BRIDGE-ERR-001". */
    code: BridgeErrorCode
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

const TOOL_ERROR_REGISTRY: Record<BridgeErrorCode, ToolErrorDef> = {
    'BRIDGE-ERR-001': {
        message: 'Target node not found in AST (bridge-id missing or stale).',
        recovery: 'Run bridge_audit first to refresh AST state, then retry the operation with the updated node ID.',
    },
    'BRIDGE-ERR-002': {
        message: 'File not found or unreadable at the specified path.',
        recovery: 'Verify the file path exists and is within the project root. Use bridge_status to confirm the project root is correctly resolved.',
    },
    'BRIDGE-ERR-003': {
        message: 'Invalid or unparseable TSX/JSX source (Babel parse failure).',
        recovery: 'Check the file for syntax errors. Run npx tsc --noEmit to identify TypeScript issues. Ensure the file uses valid JSX syntax.',
    },
    'BRIDGE-ERR-004': {
        message: 'Design token not found in the token registry.',
        recovery: 'Run bridge_sync_tokens to refresh the token registry, then retry. Verify the token path exists in your design-tokens.json file.',
    },
    'BRIDGE-ERR-005': {
        message: 'Mutation produced invalid TypeScript (in-memory TSC validation failed).',
        recovery: 'The proposed mutation is type-unsafe. Review the operation parameters or use the dryRun flag on bridge_ast_mutate to inspect the output before committing.',
    },
    'BRIDGE-ERR-006': {
        message: 'Export blocked — active governance violations or overrides remain.',
        recovery: 'Resolve all violations via bridge_audit and bridge_fix before exporting. Check the export gate status in bridge_status.',
    },
    'BRIDGE-ERR-007': {
        message: 'File write failed (disk error or insufficient permissions).',
        recovery: 'Check disk space and file permissions. Confirm the target path is writable. All Bridge writes route through FileTransactionManager — a disk-full or permission error aborts atomically.',
    },
    'BRIDGE-ERR-008': {
        message: 'MCP tool called with missing or invalid required parameters.',
        recovery: 'See the tool schema in bridge://capabilities for all required parameters and their types. Use bridge_status to verify the server is healthy.',
    },
    'BRIDGE-ERR-009': {
        message: 'healOnAudit is not available in headless MCP mode.',
        recovery: 'Use bridge_fix directly for auto-healing in headless MCP mode. The full heal pipeline (IngestionAuditor) requires the Glass IPC pipeline (Electron main process).',
    },
    'BRIDGE-ERR-010': {
        message: 'Unknown or unexpected internal error.',
        recovery: 'Report this error with the full tool response to the Bridge issue tracker. Include the request parameters and any context shown in the error.',
    },
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a structured BridgeError for the given code.
 *
 * @param code     One of the 10 BRIDGE-ERR-XXX codes.
 * @param context  Optional key-value context (filePath, nodeId, etc.) to attach.
 * @returns        A BridgeError ready to include in a tool response.
 *
 * @example
 * ```ts
 * return { content: [{ type: 'text', text: JSON.stringify(bridgeError('BRIDGE-ERR-002', { filePath })) }], isError: true }
 * ```
 */
export function bridgeError(
    code: BridgeErrorCode,
    context?: Record<string, unknown>,
): BridgeError {
    const def = TOOL_ERROR_REGISTRY[code]
    const error: BridgeError = {
        _type: 'BridgeError',
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
 * Returns true if the value is a BridgeError object.
 * Safe to call on any unknown value — never throws.
 *
 * @example
 * ```ts
 * if (isBridgeError(response)) {
 *   console.error(`[${response.code}] ${response.message}`);
 * }
 * ```
 */
export function isBridgeError(val: unknown): val is BridgeError {
    return (
        val !== null &&
        typeof val === 'object' &&
        (val as Record<string, unknown>)['_type'] === 'BridgeError' &&
        typeof (val as Record<string, unknown>)['code'] === 'string' &&
        typeof (val as Record<string, unknown>)['message'] === 'string' &&
        typeof (val as Record<string, unknown>)['recovery'] === 'string'
    )
}

// ── Formatter ─────────────────────────────────────────────────────────────────

/**
 * Formats a BridgeError into a plain-text string suitable for MCP tool response
 * content or agent display.
 *
 * @example
 * Output:
 *   [BRIDGE-ERR-002] File not found or unreadable at the specified path.
 *   Recovery: Verify the file path exists and is within the project root.
 *   Context: {"filePath": "/src/Button.tsx"}
 */
export function formatBridgeError(error: BridgeError): string {
    const lines: string[] = [
        `[${error.code}] ${error.message}`,
        `Recovery: ${error.recovery}`,
    ]
    if (error.context !== undefined && Object.keys(error.context).length > 0) {
        lines.push(`Context: ${JSON.stringify(error.context)}`)
    }
    return lines.join('\n')
}
