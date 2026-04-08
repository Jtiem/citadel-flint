/**
 * errorResponse.ts — IDE Chat UX A+ fix
 *
 * Standardises MCP tool error responses with:
 *   1. What went wrong (error message)
 *   2. Why it likely happened (optional causes list)
 *   3. What to try next (optional recovery list)
 *
 * Stack traces are logged to stderr in non-production environments
 * but never exposed in chat responses.
 */

export interface ToolErrorResult {
    isError: true;
    content: Array<{ type: "text"; text: string }>;
}

/**
 * Build a structured MCP error response that gives the model (and therefore
 * the user) enough context to self-recover without leaving chat.
 *
 * @param toolName  Human-readable tool name (e.g. "audit_ui_component")
 * @param err       The caught error value
 * @param hints     Optional plain-English causes and recovery steps
 */
export function toolError(
    toolName: string,
    err: unknown,
    hints?: { causes?: readonly string[] | string[]; recovery?: readonly string[] | string[] },
): ToolErrorResult {
    const error = err instanceof Error ? err : new Error(String(err));
    const parts: string[] = [`${toolName} failed: ${error.message}`];

    if (hints?.causes?.length) {
        parts.push("", "Common causes:", ...hints.causes.map((c) => `• ${c}`));
    }

    if (hints?.recovery?.length) {
        parts.push("", "Try:", ...hints.recovery.map((r) => `• ${r}`));
    }

    // Full stack only in development — never leaks into chat responses
    if (process.env.NODE_ENV !== "production") {
        console.error(`[${toolName}]`, error.stack ?? error.message);
    }

    return {
        isError: true,
        content: [{ type: "text", text: parts.join("\n") }],
    };
}

// ---------------------------------------------------------------------------
// Pre-built hint sets for the most common error categories
// ---------------------------------------------------------------------------

export const HINTS = {
    fileNotFound: {
        causes: [
            "The path is relative — Flint needs the full absolute path from the project root",
            "The file was recently renamed or moved",
        ],
        recovery: [
            "Run flint_get_context to see which file is currently active",
            "Use flint_swarm_audit_fix with a glob pattern to locate the file",
        ],
    },

    missingParam: (toolExample?: string) => ({
        causes: [
            "A required parameter was omitted or misspelled",
            "You may be calling the wrong tool for this task",
        ],
        recovery: [
            ...(toolExample ? [`Example usage: ${toolExample}`] : []),
            "Run flint_status or check flint://capabilities for the full tool list",
        ],
    }),

    parseError: {
        causes: [
            "The file contains a syntax error or is not valid TSX/JSX",
            "The file may have been partially written",
        ],
        recovery: [
            "Open the file manually and verify it parses without errors",
            "Run your editor's TypeScript checker on the file first",
        ],
    },

    noTokens: {
        causes: [
            "No design-tokens.json has been imported into this project yet",
            "The token file may be in a different location than .flint/design-tokens.json",
        ],
        recovery: [
            "Run flint_sync_pull to pull tokens from a connected Figma file",
            "Run flint_ingest_figma to import tokens from a Figma payload",
        ],
    },

    libraryNotSet: {
        causes: [
            "This is a new project with no component library configured yet",
            "Library auto-detection found multiple candidates and could not choose",
        ],
        recovery: [
            "Run flint_set_library to choose your component library (e.g. mui, shadcn, tailwind)",
            "Pass projectRoot explicitly so Flint can detect the library from package.json",
        ],
    },

    noFigmaConnection: {
        causes: [
            "No Figma file has been connected to this project yet",
            "The connection was disconnected or the access token expired",
        ],
        recovery: [
            "Run flint_figma_connect with your Figma file key and access token",
            "Check the connection status with flint_figma_connect action='status'",
        ],
    },

    registryEmpty: {
        causes: [
            "The component registry has never been indexed for this project",
            "The flint-manifest.json file is missing or empty",
        ],
        recovery: [
            "Run flint_reindex_registry to build the registry index",
            "Run flint_add_remote_library to seed the registry from an npm package or URL",
        ],
    },
} as const;
