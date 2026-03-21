/**
 * flint_sync_tokens tool handler — flint-mcp/src/tools/sync.ts
 *
 * Synchronises design tokens between Figma and local storage.
 *
 * Stub: satisfies the import in server.ts. Full sync implementation
 * planned for Phase C.1.
 */

import type { FlintConfig } from '../core/config.js'

export const FLINT_SYNC_TOOL = {
    name: 'flint_sync_tokens',
    description:
        'Synchronise design tokens between Figma and local storage.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            direction: {
                type: 'string',
                enum: ['figma-to-local', 'diff-only'],
                description: 'Sync direction.',
            },
            localTokensPath: {
                type: 'string',
                description: 'Optional: path to local tokens file.',
            },
            incomingTokens: {
                type: 'string',
                description: 'Optional: JSON string of incoming tokens.',
            },
        },
        required: ['direction'],
    },
} as const

export interface SyncArgs {
    direction: 'figma-to-local' | 'diff-only'
    localTokensPath?: string
    incomingTokens?: string
}

export interface SyncResult {
    status: string
    tokensUpdated: number
}

export async function handleFlintSync(
    args: SyncArgs,
    _config: FlintConfig,
): Promise<SyncResult> {
    // Stub: returns empty result
    return {
        status: 'not-implemented',
        tokensUpdated: 0,
    }
}
