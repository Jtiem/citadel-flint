/**
 * flint_map_tokens MCP tool — flint-mcp/src/tools/mapTokens.ts
 *
 * Maps DTCG design tokens from .flint/design-tokens.json to a library-specific
 * theme configuration. Supports: PrimeNG, shadcn/ui, MUI, Tailwind CSS.
 *
 * This is the bridge between a Figma design (extracted as DTCG tokens) and
 * any supported component library's theming API.
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { toolName, configPath } from '../brand.js'
import { validateProjectRoot } from '../shared/tokenPath.js'
import {
    getAdapter,
    getAvailableLibraries,
    hasAdapter,
    getAdapterCatalog,
} from '../core/libraryAdapters/index.js'
import type { LibraryTarget, LibraryThemeOutput, MapOptions } from '../core/libraryAdapters/types.js'
import type { DesignToken } from '../types.js'

// ---------------------------------------------------------------------------
// Tool definition (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_MAP_TOKENS_TOOL = {
    name: toolName('map_tokens'),
    description:
        'Map design tokens from .flint/design-tokens.json to a component library theme ' +
        'configuration. Converts your Figma-extracted DTCG tokens into the exact format ' +
        'your component library expects. Supported libraries: PrimeNG/PrimeReact/PrimeVue ' +
        '(definePreset), shadcn/ui (CSS variables), Material UI (createTheme), Tailwind CSS ' +
        '(theme config). Pass library="list" to see all available adapters.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            library: {
                type: 'string',
                enum: ['primeng', 'shadcn', 'mui', 'tailwind', 'list'],
                description:
                    'Target component library. Use "list" to see all available adapters ' +
                    'with descriptions. primeng = PrimeNG/PrimeReact/PrimeVue, ' +
                    'shadcn = shadcn/ui, mui = Material UI, tailwind = Tailwind CSS.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root (must contain .flint/design-tokens.json). ' +
                    'Defaults to cwd.',
            },
            basePreset: {
                type: 'string',
                description:
                    'Base preset to extend (library-specific). For PrimeNG: "aura" (default), ' +
                    '"material", "lara", "nora".',
            },
            mode: {
                type: 'string',
                description:
                    'Filter tokens by mode (e.g. "Light", "Dark"). When omitted, maps all modes.',
            },
            collection: {
                type: 'string',
                description:
                    'Filter tokens by collection name. When omitted, maps all collections.',
            },
            writeFile: {
                type: 'boolean',
                description:
                    'Write the generated theme file to disk (default false — dry run). ' +
                    'When true, writes to the project root with the adapter\'s default filename.',
            },
            outputPath: {
                type: 'string',
                description:
                    'Custom output path for the generated file. Only used when writeFile=true. ' +
                    'Defaults to projectRoot + adapter\'s defaultFilename.',
            },
        },
        required: ['library'],
    },
} as const

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export interface MapTokensArgs {
    library: string
    projectRoot?: string
    basePreset?: string
    mode?: string
    collection?: string
    writeFile?: boolean
    outputPath?: string
}

export function handleMapTokens(args: MapTokensArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // --- "list" mode: show available adapters ---
    if (args.library === 'list') {
        const catalog = getAdapterCatalog()
        const listing = catalog.map(a =>
            `  ${a.library.padEnd(10)} ${a.displayName}\n` +
            `             ${a.description}\n` +
            `             Output: ${a.defaultFilename}`,
        ).join('\n\n')

        return {
            content: [{
                type: 'text',
                text: `Available library adapters (${catalog.length}):\n\n${listing}`,
            }],
        }
    }

    // --- Validate projectRoot (Commandment 14) ---
    try {
        // Validate early — before any I/O
        validateProjectRoot(args.projectRoot ?? process.cwd(), os.homedir())
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Invalid projectRoot',
                    detail: err instanceof Error ? err.message : String(err),
                }),
            }],
            isError: true,
        }
    }

    // --- Validate outputPath extension (if provided) ---
    const OUTPUT_PATH_ALLOWED_EXTS = new Set(['.ts', '.js', '.css', '.json', '.scss'])
    if (args.outputPath) {
        const ext = path.extname(args.outputPath).toLowerCase()
        if (!OUTPUT_PATH_ALLOWED_EXTS.has(ext)) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        error: 'outputPath extension not allowed',
                        detail: `Extension '${ext}' is not in the allowed list: ${[...OUTPUT_PATH_ALLOWED_EXTS].join(', ')}`,
                    }),
                }],
                isError: true,
            }
        }
    }

    // --- Validate library target ---
    const libraryTarget = args.library as LibraryTarget
    if (!hasAdapter(libraryTarget)) {
        const available = getAvailableLibraries().join(', ')
        return {
            content: [{
                type: 'text',
                text: `Unknown library: "${args.library}". Available: ${available}. ` +
                    'Pass library="list" for descriptions.',
            }],
            isError: true,
        }
    }

    // --- Resolve project root and read tokens ---
    const projectRoot = args.projectRoot ?? process.cwd()
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))

    if (!fs.existsSync(tokensPath)) {
        return {
            content: [{
                type: 'text',
                text: `No design tokens found at ${tokensPath}. ` +
                    'Run flint_sync_tokens or flint_ingest_figma first to populate tokens.',
            }],
            isError: true,
        }
    }

    let tokens: DesignToken[]
    try {
        const raw = fs.readFileSync(tokensPath, 'utf-8')
        tokens = JSON.parse(raw) as DesignToken[]
        if (!Array.isArray(tokens)) {
            throw new Error('design-tokens.json must be a JSON array')
        }
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: `Failed to read design tokens: ${err instanceof Error ? err.message : String(err)}`,
            }],
            isError: true,
        }
    }

    if (tokens.length === 0) {
        return {
            content: [{
                type: 'text',
                text: 'design-tokens.json is empty. Import tokens from Figma first: flint_sync_tokens or flint_ingest_figma.',
            }],
            isError: true,
        }
    }

    // --- Map tokens ---
    const adapter = getAdapter(libraryTarget)
    const options: MapOptions = {
        mode: args.mode,
        collection: args.collection,
        basePreset: args.basePreset,
    }

    const output = adapter.mapTokens(tokens, options)

    // --- Validate output ---
    const validation = adapter.validate(output)

    // --- Write file if requested ---
    let writtenPath: string | null = null
    if (args.writeFile) {
        writtenPath = args.outputPath ?? path.join(projectRoot, output.filename)
        try {
            fs.writeFileSync(writtenPath, output.code, 'utf-8')
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: `Token mapping succeeded but file write failed: ${err instanceof Error ? err.message : String(err)}`,
                }],
                isError: true,
            }
        }
    }

    // --- Build response ---
    const skippedSummary = output.skippedTokens.length > 0
        ? `\n\nSkipped ${output.skippedTokens.length} tokens:\n` +
            output.skippedTokens.slice(0, 5).map(s =>
                `  - ${s.tokenPath} (${s.tokenType}): ${s.reason}`,
            ).join('\n') +
            (output.skippedTokens.length > 5
                ? `\n  ... and ${output.skippedTokens.length - 5} more`
                : '')
        : ''

    const validationSummary = validation.valid
        ? 'Output validation: PASSED'
        : 'Output validation: FAILED\n' +
            validation.errors.map(e =>
                `  - ${e.line ? `Line ${e.line}: ` : ''}${e.message}`,
            ).join('\n')

    const writeSummary = writtenPath
        ? `\nWritten to: ${writtenPath}`
        : '\nDry run — pass writeFile=true to write to disk.'

    const responseText =
        `Library: ${adapter.displayName}\n` +
        `Tokens mapped: ${output.tokenCount} / ${tokens.length}\n` +
        `${validationSummary}\n` +
        `${writeSummary}` +
        `${skippedSummary}\n\n` +
        `--- Generated ${output.filename} ---\n\n` +
        output.code

    return {
        content: [{ type: 'text', text: responseText }],
    }
}
