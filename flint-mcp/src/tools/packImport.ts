/**
 * flint_pack_import + flint_pack_rollback MCP tools
 * -- flint-mcp/src/tools/packImport.ts
 *
 * GPX.2: Import a governance pack into the active project with
 * conflict detection, merge strategies, and rollback support.
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import { toolName } from '../brand.js'
import { importPack, rollbackImport } from '../core/packImportService.js'
import type { MergeStrategy, ConflictResolution } from '../core/governance/types.js'

// ── Tool definitions (MCP ListTools schema) ──────────────────────────────────

export const FLINT_PACK_IMPORT_TOOL = {
    name: toolName('pack_import'),
    description:
        'Import a governance pack (.flint-pack/ directory) into the active project. ' +
        'Detects conflicts between the pack and existing project configuration, ' +
        'then merges using the specified strategy (override, skip-conflicts, or interactive). ' +
        'Creates a snapshot before writing for rollback support. ' +
        'Use dry_run to preview changes without writing.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            source: {
                type: 'string',
                description:
                    'Path to an unpacked .flint-pack/ directory.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the target project root.',
            },
            strategy: {
                type: 'string',
                enum: ['override', 'skip-conflicts', 'interactive'],
                description:
                    'Merge strategy for resolving conflicts. Default: skip-conflicts.',
            },
            resolutions: {
                type: 'array',
                description:
                    'Array of ConflictResolution objects. Required when strategy is ' +
                    'interactive and conflicts were previously returned.',
                items: {
                    type: 'object',
                    properties: {
                        key: { type: 'string' },
                        action: {
                            type: 'string',
                            enum: ['accept_incoming', 'keep_current', 'custom'],
                        },
                        customValue: {},
                    },
                    required: ['key', 'action'],
                },
            },
            dry_run: {
                type: 'boolean',
                description:
                    'When true, reports conflicts and planned changes without writing files. Default: false.',
            },
        },
        required: ['source', 'projectRoot'],
    },
} as const

export const FLINT_PACK_ROLLBACK_TOOL = {
    name: toolName('pack_rollback'),
    description:
        'Roll back a previously imported governance pack by restoring the pre-import ' +
        'snapshot. Use the snapshotId from the import result.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            snapshotId: {
                type: 'string',
                description:
                    'UUID of the snapshot to restore. Use the snapshotId from the import result.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the target project root.',
            },
        },
        required: ['snapshotId', 'projectRoot'],
    },
} as const

// ── Args interfaces ─────────────────────────────────────────────────────────

export interface PackImportArgs {
    source: string
    projectRoot: string
    strategy?: MergeStrategy
    resolutions?: ConflictResolution[]
    dry_run?: boolean
}

export interface PackRollbackArgs {
    snapshotId: string
    projectRoot: string
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handles the flint_pack_import tool call.
 */
export async function handlePackImport(
    args: PackImportArgs,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    // Validate required fields
    if (!args.source || typeof args.source !== 'string') {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'MISSING_SOURCE',
                    message: 'source parameter is required and must be a string path.',
                }, null, 2),
            }],
        }
    }

    if (!args.projectRoot || typeof args.projectRoot !== 'string') {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'MISSING_PROJECT_ROOT',
                    message: 'projectRoot parameter is required and must be an absolute path.',
                }, null, 2),
            }],
        }
    }

    try {
        const result = await importPack({
            packPath: args.source,
            projectRoot: args.projectRoot,
            strategy: args.strategy ?? 'skip-conflicts',
            resolutions: args.resolutions ?? [],
            dryRun: args.dry_run ?? false,
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
                    message: `flint_pack_import failed: ${(err as Error).message}`,
                }, null, 2),
            }],
        }
    }
}

/**
 * Handles the flint_pack_rollback tool call.
 */
export async function handlePackRollback(
    args: PackRollbackArgs,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    if (!args.snapshotId || typeof args.snapshotId !== 'string') {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'MISSING_SNAPSHOT_ID',
                    message: 'snapshotId parameter is required.',
                }, null, 2),
            }],
        }
    }

    if (!args.projectRoot || typeof args.projectRoot !== 'string') {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: true,
                    code: 'MISSING_PROJECT_ROOT',
                    message: 'projectRoot parameter is required.',
                }, null, 2),
            }],
        }
    }

    try {
        const result = await rollbackImport({
            snapshotId: args.snapshotId,
            projectRoot: args.projectRoot,
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
                    message: `flint_pack_rollback failed: ${(err as Error).message}`,
                }, null, 2),
            }],
        }
    }
}
