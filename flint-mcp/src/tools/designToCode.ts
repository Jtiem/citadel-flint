/**
 * flint_design_to_code MCP tool — flint-mcp/src/tools/designToCode.ts
 *
 * End-to-end Figma design → library code pipeline in a single call.
 * Chains: Figma payload ingestion → token mapping → theme file generation.
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import fs from 'node:fs'
import path from 'node:path'
import { BRAND, toolName, configPath } from '../brand.js'
import { HydroPasteEngine } from '../core/hydroPaste.js'
import {
    getAdapter,
    hasAdapter,
    detectLibraryFromTokens,
} from '../core/libraryAdapters/index.js'
import type { LibraryTarget } from '../core/libraryAdapters/types.js'
import type { FlintConfig } from '../core/config.js'
import type { DesignToken } from '../types.js'
import { parseFigmaMcpResponse, enrichFigmaNodes } from '../core/figmaMcpParser.js'

// ---------------------------------------------------------------------------
// Tool definition (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_DESIGN_TO_CODE_TOOL = {
    name: toolName('design_to_code'),
    description:
        'End-to-end Figma design to library code pipeline. Ingests a Figma payload, ' +
        'maps design tokens to the selected component library, and generates ' +
        'library-specific component code — all in one call. ' +
        'Supported libraries: shadcn, mui, primeng, tailwind.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            figmaPayload: {
                type: 'string',
                description: 'JSON string of the Figma AST payload.',
            },
            library: {
                type: 'string',
                enum: ['shadcn', 'mui', 'primeng', 'tailwind', 'auto'],
                description:
                    'Target UI library. Use "auto" to detect from existing tokens. ' +
                    'If omitted, reads from .flint/policy.json selectedLibrary.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to cwd.',
            },
            writeThemeFile: {
                type: 'boolean',
                description: 'Write the generated library theme file to disk (default false).',
            },
            figmaUrl: {
                type: 'string',
                description: 'Optional Figma URL for traceability.',
            },
            figmaCode: {
                type: 'string',
                description: 'Raw JSX from Figma MCP get_design_context. When provided, enriches component recognition using data-name attributes.',
            },
        },
        required: ['figmaPayload'],
    },
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DesignToCodeArgs {
    figmaPayload: string
    library?: string
    projectRoot?: string
    writeThemeFile?: boolean
    figmaUrl?: string
    figmaCode?: string
}

export interface ComponentResult {
    name: string
    code: string
    imports: string[]
    tokenRefs: string[]
}

export interface DesignToCodeResult {
    status: 'ok' | 'error'
    library: string
    /** Primary component (first/only). Always present for backward compat. */
    component: ComponentResult
    /** All generated components (multiple when processing a full page). */
    components: ComponentResult[]
    /** Page compositor that imports and assembles all section components. */
    page?: {
        name: string
        code: string
        imports: string[]
    }
    themeFile?: {
        filename: string
        code: string
        tokenCount: number
    }
    tokenMappings: Record<string, string>
    summary: string
    error?: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleDesignToCode(
    args: DesignToCodeArgs,
    config: FlintConfig,
): Promise<DesignToCodeResult> {
    const projectRoot = args.projectRoot ?? config.projectRoot ?? process.cwd()

    // ------------------------------------------------------------------
    // Step 1: Validate required param
    // ------------------------------------------------------------------
    if (!args.figmaPayload || typeof args.figmaPayload !== 'string') {
        return {
            status: 'error',
            library: 'unknown',
            component: { name: '', code: '', imports: [], tokenRefs: [] },
            components: [],
            tokenMappings: {},
            summary: 'Missing required parameter: figmaPayload',
            error: 'figmaPayload is required and must be a non-empty string.',
        }
    }

    // ------------------------------------------------------------------
    // Step 2: Validate JSON early — give a clear error before reading disk
    // ------------------------------------------------------------------
    try {
        JSON.parse(args.figmaPayload)
    } catch {
        return {
            status: 'error',
            library: 'unknown',
            component: { name: '', code: '', imports: [], tokenRefs: [] },
            components: [],
            tokenMappings: {},
            summary: 'Invalid Figma payload: JSON parse failed.',
            error: 'figmaPayload is not valid JSON.',
        }
    }

    // ------------------------------------------------------------------
    // Step 3: Read design tokens
    // ------------------------------------------------------------------
    let tokens: DesignToken[] = []
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    if (fs.existsSync(tokensPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            tokens = Array.isArray(raw) ? raw : []
        } catch {
            // Continue with empty tokens — handled below
        }
    }

    if (tokens.length === 0) {
        return {
            status: 'ok',
            library: 'none',
            component: { name: '', code: '', imports: [], tokenRefs: [] },
            components: [],
            tokenMappings: {},
            summary:
                'No design tokens found. Import tokens via flint_sync_pull or flint_ingest_figma ' +
                'before using flint_design_to_code.',
        }
    }

    // ------------------------------------------------------------------
    // Step 4: Resolve library
    // ------------------------------------------------------------------
    let resolvedLibrary: string | undefined = args.library

    if (!resolvedLibrary) {
        // Read from policy.json
        const policyPath = path.join(projectRoot, configPath('policy.json'))
        try {
            if (fs.existsSync(policyPath)) {
                const policy = JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
                if (typeof policy.selectedLibrary === 'string') {
                    resolvedLibrary = policy.selectedLibrary
                }
            }
        } catch {
            // policy.json unreadable — fall through to auto-detect
        }
    }

    if (!resolvedLibrary || resolvedLibrary === 'auto') {
        const detection = detectLibraryFromTokens(tokens)
        if (detection.library) {
            resolvedLibrary = detection.library
        } else {
            return {
                status: 'error',
                library: 'unknown',
                component: { name: '', code: '', imports: [], tokenRefs: [] },
                components: [],
                tokenMappings: {},
                summary:
                    'Could not determine target library. Pass library="shadcn|mui|primeng|tailwind" ' +
                    'or run flint_set_library to set a project-level default.',
                error: 'Library auto-detection inconclusive. No library selected in policy.json.',
            }
        }
    }

    // ------------------------------------------------------------------
    // Step 5: Validate library target
    // ------------------------------------------------------------------
    const libraryTarget = resolvedLibrary as LibraryTarget
    if (!hasAdapter(libraryTarget)) {
        return {
            status: 'error',
            library: resolvedLibrary,
            component: { name: '', code: '', imports: [], tokenRefs: [] },
            components: [],
            tokenMappings: {},
            summary: `Unknown library: "${resolvedLibrary}". Supported: shadcn, mui, primeng, tailwind.`,
            error: `No adapter registered for library: "${resolvedLibrary}".`,
        }
    }

    // ------------------------------------------------------------------
    // Step 6: Read manifest
    // ------------------------------------------------------------------
    let manifest: Record<string, unknown> = { components: {}, resolvers: [] }
    const manifestPath = path.join(projectRoot, BRAND.manifestFile)
    if (fs.existsSync(manifestPath)) {
        try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        } catch {
            // Use default manifest
        }
    }

    // ------------------------------------------------------------------
    // Step 6b: Enrich payload with Figma MCP data-name hints (when available)
    // ------------------------------------------------------------------
    let enrichedPayload = args.figmaPayload
    if (args.figmaCode) {
        try {
            const hints = parseFigmaMcpResponse(args.figmaCode)
            if (hints.size > 0) {
                const parsed = JSON.parse(args.figmaPayload)
                const nodes = Array.isArray(parsed) ? parsed : parsed.children ? [parsed] : [parsed]
                enrichFigmaNodes(nodes, hints)
                enrichedPayload = JSON.stringify(Array.isArray(parsed) ? parsed : parsed)
            }
        } catch {
            // Enrichment failure is non-fatal — continue with unenriched payload
        }
    }

    // ------------------------------------------------------------------
    // Step 7: Run ingestion (processPage handles both single + multi)
    // ------------------------------------------------------------------
    const engine = new HydroPasteEngine(manifest, tokens, { library: libraryTarget })
    let hydroResult: Awaited<ReturnType<typeof engine.processPage>>
    try {
        hydroResult = await engine.processPage(enrichedPayload)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const empty: ComponentResult = { name: '', code: '', imports: [], tokenRefs: [] }
        return {
            status: 'error',
            library: libraryTarget,
            component: empty,
            components: [],
            tokenMappings: {},
            summary: 'Engine error during Figma payload processing.',
            error: msg,
        }
    }

    // Build component results array
    const componentResults: ComponentResult[] = hydroResult.components.map(c => ({
        name: c.name,
        code: c.jsx,
        imports: hydroResult.imports,
        tokenRefs: c.tokenRefs,
    }))

    // First component is the primary output (backward compat)
    const primaryComponent = componentResults[0] ?? { name: '', code: '', imports: [], tokenRefs: [] }

    // ------------------------------------------------------------------
    // Step 8: Generate theme file via library adapter
    // ------------------------------------------------------------------
    const adapter = getAdapter(libraryTarget)
    const themeOutput = adapter.mapTokens(tokens)

    const themeFileResult: DesignToCodeResult['themeFile'] = {
        filename: themeOutput.filename,
        code: themeOutput.code,
        tokenCount: themeOutput.tokenCount,
    }

    // ------------------------------------------------------------------
    // Step 9: Optionally write theme file to disk
    // ------------------------------------------------------------------
    if (args.writeThemeFile) {
        const writePath = path.join(projectRoot, themeOutput.filename)
        try {
            fs.writeFileSync(writePath, themeOutput.code, 'utf-8')
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            return {
                status: 'error',
                library: libraryTarget,
                component: primaryComponent,
                components: componentResults,
                themeFile: themeFileResult,
                tokenMappings: hydroResult.tokenMappings,
                summary: `Components generated but theme file write failed: ${msg}`,
                error: msg,
            }
        }
    }

    // ------------------------------------------------------------------
    // Step 10: Build combined summary
    // ------------------------------------------------------------------
    const componentCount = hydroResult.components.length
    const figmaUrlNote = args.figmaUrl ? ` (source: ${args.figmaUrl})` : ''
    const writeNote = args.writeThemeFile
        ? ` Theme file written to: ${path.join(projectRoot, themeOutput.filename)}.`
        : ' Theme file generated (dry run — pass writeThemeFile=true to write to disk).'
    const pageNote = hydroResult.page ? ` Page compositor: ${hydroResult.page.name}.` : ''

    const summary =
        `Library: ${adapter.displayName} (${libraryTarget}).` +
        ` ${componentCount} component(s) generated${figmaUrlNote}.${pageNote}` +
        ` ${Object.keys(hydroResult.tokenMappings).length} token(s) mapped.` +
        writeNote

    return {
        status: 'ok',
        library: libraryTarget,
        component: primaryComponent,
        components: componentResults,
        ...(hydroResult.page && {
            page: {
                name: hydroResult.page.name,
                code: hydroResult.page.jsx,
                imports: hydroResult.page.imports,
            },
        }),
        themeFile: themeFileResult,
        tokenMappings: hydroResult.tokenMappings,
        summary,
    }
}
