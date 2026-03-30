/**
 * flint_generate_dbom MCP tool — flint-mcp/src/tools/dbom.ts
 *
 * Tool definition and handler for the Design Bill of Materials (DBOM) generator.
 * The DBOM is a machine-readable manifest of all design tokens, their usage,
 * component compliance, and governance status — analogous to a Snyk SBOM but
 * for design system governance.
 *
 * Supports two output paths:
 *   - 'json' / 'markdown' — core DBOM (unchanged from pre-DBOM.1)
 *   - 'cyclonedx'         — governance-enriched DBOM in CycloneDX envelope
 *   - includeProvenance    — attaches per-component mutation provenance
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import { generateDBOM as generateCoreDBOM } from '../core/dbom/generator.js'
import { generateDBOM as generateGovernanceDBOM, formatDBOMOutput } from '../core/governance/dbomService.js'
import { formatDBOMAsMarkdown } from '../core/dbom/formatter.js'
import type { DesignBillOfMaterials } from '../core/dbom/types.js'
import type { DBOM } from '../core/governance/types.js'
import { toolName } from '../brand.js'

// ── Tool definition (MCP ListTools schema) ─────────────────────────────────────

export const FLINT_GENERATE_DBOM_TOOL = {
    name: toolName('generate_dbom'),
    description:
        'Generate a Design Bill of Materials (DBOM) — a machine-readable manifest ' +
        'of all design tokens, their usage across components, Mithril governance violations, ' +
        'A11y compliance, token coverage per component, and a project health score. ' +
        'Analogous to a Snyk SBOM but for design system governance. ' +
        "Returns JSON, Markdown, or CycloneDX-extended format. When 'includeProvenance' " +
        'is true, attaches per-component mutation provenance (who/what caused each change).',
    inputSchema: {
        type: 'object' as const,
        properties: {
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root (must contain a .flint/ directory). ' +
                    'Defaults to process.cwd() when omitted.',
            },
            format: {
                type: 'string',
                enum: ['json', 'markdown', 'cyclonedx'],
                description:
                    "Output format. 'json' returns the governance-enriched DBOM. " +
                    "'markdown' returns a human-readable report. " +
                    "'cyclonedx' returns a CycloneDX 1.5 envelope with the DBOM as an extension. " +
                    "Default: 'json'.",
            },
            includeProvenance: {
                type: 'boolean',
                description:
                    'When true, includes per-component mutation provenance data (who/what ' +
                    'caused each mutation). Requires .flint/provenance.db. Default: false.',
            },
            glob: {
                type: 'string',
                description:
                    'Optional glob pattern to scope the scan (e.g. "demos/**/*.tsx"). ' +
                    'When omitted, scans all TSX/JSX files in the project.',
            },
        },
    },
} as const

// ── Cache ──────────────────────────────────────────────────────────────────────

/**
 * In-memory cache of the last generated core DBOM.
 * Used by the flint://dbom resource to serve cached data without re-scanning.
 * Cleared on each fresh call to handleGenerateDBOM.
 */
let cachedDBOM: DesignBillOfMaterials | null = null

/**
 * In-memory cache of the last governance-enriched DBOM.
 */
let cachedGovernanceDBOM: DBOM | null = null

/**
 * Returns the last generated core DBOM, or null when no DBOM has been generated
 * in this server session. Called by the flint://dbom resource handler.
 */
export function getCachedDBOM(): DesignBillOfMaterials | null {
    return cachedDBOM
}

/**
 * Returns the last governance-enriched DBOM, or null.
 */
export function getCachedGovernanceDBOM(): DBOM | null {
    return cachedGovernanceDBOM
}

// ── Handler ────────────────────────────────────────────────────────────────────

export interface GenerateDBOMArgs {
    projectRoot?: string
    format?: 'json' | 'markdown' | 'cyclonedx'
    includeProvenance?: boolean
    glob?: string
}

export async function handleGenerateDBOM(
    args: GenerateDBOMArgs,
    defaultProjectRoot: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const projectRoot = args.projectRoot ?? defaultProjectRoot
    const format = args.format ?? 'json'
    const includeProvenance = args.includeProvenance ?? false
    const glob = args.glob

    // CLARITY-2: recommendation for DBOM
    const dbomRecommendation = 'DBOM exported. Share with stakeholders for design system compliance review.'

    // For markdown format, use the core DBOM + markdown formatter (backward compat)
    if (format === 'markdown') {
        const coreDbom = await generateCoreDBOM(projectRoot, glob)
        cachedDBOM = coreDbom
        return {
            content: [
                { type: 'text', text: formatDBOMAsMarkdown(coreDbom) },
                { type: 'text', text: JSON.stringify({ recommendation: dbomRecommendation }) },
            ],
        }
    }

    // For json and cyclonedx, use the governance-enriched DBOM
    const govDbom = await generateGovernanceDBOM(projectRoot, {
        format,
        includeProvenance,
        glob,
    })
    cachedGovernanceDBOM = govDbom

    // Also generate and cache the core DBOM for the resource handler
    const coreDbom = await generateCoreDBOM(projectRoot, glob)
    cachedDBOM = coreDbom

    const text = formatDBOMOutput(govDbom, format === 'cyclonedx' ? 'cyclonedx' : 'json')

    return {
        content: [
            { type: 'text', text },
            { type: 'text', text: JSON.stringify({ recommendation: dbomRecommendation }) },
        ],
    }
}
