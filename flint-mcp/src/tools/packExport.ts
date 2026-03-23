/**
 * flint_pack_export MCP tool -- flint-mcp/src/tools/packExport.ts
 *
 * GPX.1: Bundle the active project's governance configuration into a
 * portable .flint-pack/ directory. Collects policy.json, agent-policy.json,
 * customized rules, and optional CLAUDE.md fragments. Validates that no
 * secrets or absolute paths are included.
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import { toolName } from '../brand.js'
import { assemblePack } from '../core/packAssembler.js'
import type { PackAuthor } from '../core/packTypes.js'

// ── Pack ID validation ──────────────────────────────────────────────────────

const PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Validates that a pack ID is a lowercase slug with hyphens only.
 */
function isValidPackId(id: string): boolean {
    return PACK_ID_PATTERN.test(id) && id.length >= 2 && id.length <= 128
}

// ── Semver validation ───────────────────────────────────────────────────────

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?(?:\+[a-zA-Z0-9.]+)?$/

/**
 * Validates that a version string is valid semver.
 */
function isValidSemver(version: string): boolean {
    return SEMVER_PATTERN.test(version)
}

// ── Tool definition (MCP ListTools schema) ──────────────────────────────────

export const FLINT_PACK_EXPORT_TOOL = {
    name: toolName('pack_export'),
    description:
        'Bundle the active project\'s governance configuration into a portable ' +
        '.flint-pack/ directory. Collects policy.json, agent-policy.json, ' +
        'customized rules, and optional CLAUDE.md fragments. Validates that no ' +
        'secrets or absolute paths are included. Use dry_run to preview contents ' +
        'without writing.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            id: {
                type: 'string',
                description:
                    'Pack identifier slug. Lowercase, hyphens only (e.g. "acme-healthcare-governance"). ' +
                    'Used as the manifest.id field.',
            },
            name: {
                type: 'string',
                description: 'Human-readable display name for the pack.',
            },
            version: {
                type: 'string',
                description: 'Semver version string (e.g. "1.0.0").',
            },
            description: {
                type: 'string',
                description: 'Plain-language summary of what this governance pack enforces.',
            },
            author: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    org: { type: 'string' },
                },
                required: ['name'],
                description: 'Pack author identity.',
            },
            stack_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Searchable technology tags (e.g. ["react", "tailwind"]).',
            },
            include_claude_fragments: {
                type: 'array',
                items: { type: 'string' },
                description:
                    'Relative paths within .claude/ to include (e.g. ["agents/hipaa-sentinel.md"]). ' +
                    'Files are scrubbed for local paths before inclusion.',
            },
            output_path: {
                type: 'string',
                description:
                    'Absolute path where the .flint-pack/ directory should be written. ' +
                    'Defaults to <project-root>/<id>.flint-pack.',
            },
            dry_run: {
                type: 'boolean',
                description:
                    'When true, reports what would be bundled without writing the directory. ' +
                    'Default: false.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root. Defaults to process.cwd().',
            },
        },
        required: ['id', 'name', 'version', 'description', 'author'],
    },
} as const

// ── Args interface ──────────────────────────────────────────────────────────

export interface PackExportArgs {
    id: string;
    name: string;
    version: string;
    description: string;
    author: PackAuthor;
    stack_tags?: string[];
    include_claude_fragments?: string[];
    output_path?: string;
    dry_run?: boolean;
    projectRoot?: string;
}

// ── Handler ─────────────────────────────────────────────────────────────────

/**
 * Handles the flint_pack_export tool call.
 *
 * 1. Resolve projectRoot
 * 2. Validate pack ID format
 * 3. Validate version is valid semver
 * 4. Call assemblePack
 * 5. Return result as JSON
 */
export async function handlePackExport(
    args: PackExportArgs,
    defaultProjectRoot: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    // 1. Resolve project root
    const projectRoot = args.projectRoot ?? defaultProjectRoot

    // 2. Validate pack ID
    if (!isValidPackId(args.id)) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'INVALID_PACK_ID',
                    message: `Invalid pack ID "${args.id}". Must be lowercase, hyphens only, 2-128 characters (e.g. "acme-healthcare-governance").`,
                }, null, 2),
            }],
        }
    }

    // 3. Validate semver
    if (!isValidSemver(args.version)) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'INVALID_SEMVER',
                    message: `Invalid version "${args.version}". Must be valid semver (e.g. "1.0.0").`,
                }, null, 2),
            }],
        }
    }

    // 4. Validate author
    if (!args.author || typeof args.author.name !== 'string' || args.author.name.trim().length === 0) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'INVALID_AUTHOR',
                    message: 'Author must have a non-empty "name" field.',
                }, null, 2),
            }],
        }
    }

    // 5. Call assemblePack
    try {
        const result = await assemblePack({
            id: args.id,
            name: args.name,
            version: args.version,
            description: args.description,
            author: args.author,
            projectRoot,
            stack_tags: args.stack_tags,
            include_claude_fragments: args.include_claude_fragments,
            output_path: args.output_path,
            dry_run: args.dry_run,
        })

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
            }],
        }
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    message: `flint_pack_export failed: ${(err as Error).message}`,
                }, null, 2),
            }],
        }
    }
}
