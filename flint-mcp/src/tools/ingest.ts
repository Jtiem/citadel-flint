/**
 * flint_ingest_figma tool handler — flint-mcp/src/tools/ingest.ts
 *
 * Ingests a Figma payload and converts it to component code using
 * HydroPasteEngine.
 */

import type { FlintConfig } from '../core/config.js'
import { HydroPasteEngine } from '../core/hydroPaste.js'
import type { GeneratedComponent } from '../core/hydroPaste.js'
import fs from 'node:fs'
import path from 'node:path'
import { BRAND, toolName, configPath } from '../brand.js'

export type { GeneratedComponent }

export const FLINT_INGEST_TOOL = {
    name: toolName('ingest_figma'),
    description:
        'Ingest a Figma payload and convert it into component code.',
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
    status: 'ok' | 'no-tokens' | 'invalid-payload' | 'error';
    components: GeneratedComponent[];
    imports: string[];
    summary: string;
    tokenMappings: Record<string, string>;
    error?: string;
}

export async function handleFlintIngest(
    args: IngestArgs,
    config: FlintConfig,
): Promise<IngestResult> {
    const projectRoot = config.projectRoot

    // Load manifest — default to empty if missing or unparseable
    let manifest: Record<string, unknown> = { components: {}, resolvers: [] }
    const manifestPath = path.join(projectRoot, BRAND.manifestFile)
    if (fs.existsSync(manifestPath)) {
        try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        } catch {
            // Use default manifest
        }
    }

    // Load design tokens — default to [] if missing or unparseable
    let tokens: unknown[] = []
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    if (fs.existsSync(tokensPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            tokens = Array.isArray(raw) ? raw : Object.values(raw)
        } catch {
            // Use empty tokens
        }
    }

    // Early return when no tokens are available
    if (tokens.length === 0) {
        return {
            status: 'no-tokens',
            components: [],
            imports: [],
            summary:
                'No design tokens found. Import tokens via Figma sync or create them manually before ingesting components.',
            tokenMappings: {},
        }
    }

    const engine = new HydroPasteEngine(manifest, tokens)

    let result: Awaited<ReturnType<typeof engine.processPayload>>
    try {
        result = await engine.processPayload(args.figmaPayload)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
            status: 'error',
            components: [],
            imports: [],
            summary: 'Engine error during Figma payload processing.',
            tokenMappings: {},
            error: msg,
        }
    }

    // Determine status based on result — zero components with any failure indicator → invalid-payload
    const summary = result.summary.toLowerCase()
    const isInvalidPayload =
        result.components.length === 0 &&
        (summary.includes('invalid') ||
            summary.includes('no payload') ||
            summary.includes('unrecognized') ||
            summary.includes('error'))

    const status: IngestResult['status'] = isInvalidPayload ? 'invalid-payload' : 'ok'

    return {
        status,
        components: result.components,
        imports: result.imports,
        summary: result.summary,
        tokenMappings: result.tokenMappings,
    }
}
