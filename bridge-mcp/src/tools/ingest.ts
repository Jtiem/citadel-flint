/**
 * bridge_ingest_figma tool handler — bridge-mcp/src/tools/ingest.ts
 *
 * Ingests a Figma payload and converts it to React component code.
 *
 * Stub: satisfies the import in server.ts. Full implementation
 * delegated to HydroPasteEngine.
 */

import type { BridgeConfig } from '../core/config.js'

export const BRIDGE_INGEST_TOOL = {
    name: 'bridge_ingest_figma',
    description:
        'Ingest a Figma payload and convert it into React component code.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            figmaPayload: {
                type: 'string',
                description: 'JSON string of the Figma AST payload.',
            },
            figmaUrl: {
                type: 'string',
                description: 'Optional Figma URL for traceability.',
            },
            outputFormat: {
                type: 'string',
                enum: ['jsx', 'tsx', 'vue'],
                description: 'Output format (default: tsx).',
            },
            componentName: {
                type: 'string',
                description: 'Optional component name override.',
            },
        },
        required: ['figmaPayload'],
    },
} as const

export interface IngestArgs {
    figmaPayload: string
    figmaUrl?: string
    outputFormat?: 'jsx' | 'tsx' | 'vue'
    componentName?: string
}

export interface IngestResult {
    status: string
    components: string[]
}

export async function handleBridgeIngest(
    args: IngestArgs,
    _config: BridgeConfig,
): Promise<IngestResult> {
    // Stub: returns empty result
    return {
        status: 'not-implemented',
        components: [],
    }
}
