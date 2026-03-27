/**
 * flint_code_connect_sync MCP tool — flint-mcp/src/tools/codeConnectSync.ts
 *
 * Phase D2C.4 / Feature 3: Code Connect Auto-Registration
 *
 * Generates Figma Code Connect mappings for the active library and
 * optionally writes them to .figma/code-connect.json.
 *
 *   action="generate"  — dry run: return mappings as JSON without writing
 *   action="write"     — write .figma/code-connect.json to projectRoot
 *
 * Library resolution order:
 *   1. Explicit `library` param
 *   2. `selectedLibrary` in .flint/policy.json
 *   3. Error — no library configured
 *
 * Registration: imported by server.ts, wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import fs from 'node:fs'
import path from 'node:path'
import { toolName } from '../brand.js'
import {
    generateCodeConnectMappings,
    getSupportedLibraries,
} from '../core/codeConnectMapper.js'
import type { CodeConnectConfig } from '../core/codeConnectMapper.js'

// ---------------------------------------------------------------------------
// Tool definition (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_CODE_CONNECT_SYNC_TOOL = {
    name: toolName('code_connect_sync'),
    description:
        'Generate Code Connect mappings for the active library and optionally write ' +
        'them to .figma/code-connect.json. Maps Flint\'s component registry to Figma ' +
        'component instances for accurate design-to-code translation. ' +
        'Use action="generate" for a dry run (returns mappings only). ' +
        'Use action="write" to persist .figma/code-connect.json.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            library: {
                type: 'string',
                enum: ['shadcn', 'mui', 'primeng'],
                description:
                    'Target library. Reads from .flint/policy.json (selectedLibrary) if omitted.',
            },
            action: {
                type: 'string',
                enum: ['generate', 'write'],
                description:
                    'generate = return mappings only (dry run). ' +
                    'write = write .figma/code-connect.json to projectRoot.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to cwd.',
            },
        },
        required: [],
    },
} as const

// ---------------------------------------------------------------------------
// Args / return types
// ---------------------------------------------------------------------------

export interface CodeConnectSyncArgs {
    library?: string
    action?: 'generate' | 'write'
    projectRoot?: string
}

export interface CodeConnectSyncResult {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function handleCodeConnectSync(args: CodeConnectSyncArgs): CodeConnectSyncResult {
    const projectRoot = args.projectRoot ?? process.cwd()
    const action = args.action ?? 'generate'

    // 1. Resolve the library
    const library = resolveLibrary(args.library, projectRoot)
    if (!library) {
        const supported = getSupportedLibraries().join(', ')
        return error(
            'No library specified and none found in .flint/policy.json. ' +
            `Pass library= one of: ${supported}. ` +
            'Or run flint_set_library first to configure the active library.',
        )
    }

    // 2. Generate mappings
    const config = generateCodeConnectMappings(library)
    if (!config) {
        const supported = getSupportedLibraries().join(', ')
        return error(
            `Unknown library: "${library}". Supported libraries: ${supported}.`,
        )
    }

    // 3. Dispatch on action
    if (action === 'write') {
        return writeConfig(config, projectRoot)
    }

    // Default: generate (dry run)
    return generateResponse(config)
}

// ---------------------------------------------------------------------------
// Action: generate (dry run)
// ---------------------------------------------------------------------------

function generateResponse(config: CodeConnectConfig): CodeConnectSyncResult {
    const summary = buildSummary(config)
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                library: config.library,
                mappingCount: config.mappings.length,
                generatedAt: config.generatedAt,
                mappings: config.mappings,
                summary,
                note: 'Dry run — use action="write" to persist .figma/code-connect.json',
            }, null, 2),
        }],
    }
}

// ---------------------------------------------------------------------------
// Action: write
// ---------------------------------------------------------------------------

function writeConfig(config: CodeConnectConfig, projectRoot: string): CodeConnectSyncResult {
    const figmaDir = path.join(projectRoot, '.figma')
    const outputPath = path.join(figmaDir, 'code-connect.json')

    try {
        if (!fs.existsSync(figmaDir)) {
            fs.mkdirSync(figmaDir, { recursive: true })
        }
        fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return error(`Failed to write ${outputPath}: ${msg}`)
    }

    const summary = buildSummary(config)
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                written: true,
                outputPath,
                library: config.library,
                mappingCount: config.mappings.length,
                generatedAt: config.generatedAt,
                summary,
            }, null, 2),
        }],
    }
}

// ---------------------------------------------------------------------------
// Library resolution
// ---------------------------------------------------------------------------

/**
 * Resolve library from explicit arg or policy.json.
 * Returns undefined when no library is configured.
 */
function resolveLibrary(explicit: string | undefined, projectRoot: string): string | undefined {
    if (explicit && explicit.trim() !== '') return explicit.trim()

    // Fall back to policy.json
    const policyPath = path.join(projectRoot, '.flint', 'policy.json')
    try {
        if (fs.existsSync(policyPath)) {
            const policy = JSON.parse(fs.readFileSync(policyPath, 'utf-8')) as Record<string, unknown>
            const sel = policy.selectedLibrary
            if (typeof sel === 'string' && sel.trim() !== '') return sel.trim()
        }
    } catch {
        // ignore read/parse errors — fall through to undefined
    }

    return undefined
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummary(config: CodeConnectConfig): string {
    const withProps = config.mappings.filter(m => Object.keys(m.props).length > 0).length
    const compound = config.mappings.filter(m => (m.compoundParts?.length ?? 0) > 0).length
    return (
        `${config.mappings.length} components mapped for ${config.library}. ` +
        `${withProps} with prop definitions, ${compound} compound components.`
    )
}

function error(message: string): CodeConnectSyncResult {
    return {
        content: [{ type: 'text', text: message }],
        isError: true,
    }
}
