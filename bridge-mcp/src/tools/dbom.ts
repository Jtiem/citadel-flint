/**
 * bridge_generate_dbom MCP tool — bridge-mcp/src/tools/dbom.ts
 *
 * Tool definition and handler for the Design Bill of Materials (DBOM) generator.
 * The DBOM is a machine-readable manifest of all design tokens, their usage,
 * component compliance, and governance status — analogous to a Snyk SBOM but
 * for design system governance.
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import { generateDBOM } from '../core/dbom/generator.js'
import { formatDBOMAsMarkdown } from '../core/dbom/formatter.js'
import type { DesignBillOfMaterials } from '../core/dbom/types.js'

// ── Tool definition (MCP ListTools schema) ─────────────────────────────────────

export const BRIDGE_GENERATE_DBOM_TOOL = {
    name: 'bridge_generate_dbom',
    description:
        'Generate a Design Bill of Materials (DBOM) — a machine-readable manifest ' +
        'of all design tokens, their usage across components, Mithril governance violations, ' +
        'A11y compliance, token coverage per component, and a project health score. ' +
        'Analogous to a Snyk SBOM but for design system governance. ' +
        'Returns JSON or a human-readable Markdown summary.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root (must contain a .bridge/ directory). ' +
                    'Defaults to process.cwd() when omitted.',
            },
            format: {
                type: 'string',
                enum: ['json', 'markdown'],
                description:
                    "Output format. 'json' returns the full DBOM as a JSON object. " +
                    "'markdown' returns a human-readable report. Default: 'json'.",
            },
        },
    },
} as const

// ── Cache ──────────────────────────────────────────────────────────────────────

/**
 * In-memory cache of the last generated DBOM.
 * Used by the bridge://dbom resource to serve cached data without re-scanning.
 * Cleared on each fresh call to handleGenerateDBOM.
 */
let cachedDBOM: DesignBillOfMaterials | null = null

/**
 * Returns the last generated DBOM, or null when no DBOM has been generated
 * in this server session. Called by the bridge://dbom resource handler.
 */
export function getCachedDBOM(): DesignBillOfMaterials | null {
    return cachedDBOM
}

// ── Handler ────────────────────────────────────────────────────────────────────

export interface GenerateDBOMArgs {
    projectRoot?: string
    format?: 'json' | 'markdown'
}

export async function handleGenerateDBOM(
    args: GenerateDBOMArgs,
    defaultProjectRoot: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const projectRoot = args.projectRoot ?? defaultProjectRoot
    const format = args.format ?? 'json'

    const dbom = await generateDBOM(projectRoot)
    cachedDBOM = dbom

    const text =
        format === 'markdown'
            ? formatDBOMAsMarkdown(dbom)
            : JSON.stringify(dbom, null, 2)

    return {
        content: [{ type: 'text', text }],
    }
}
