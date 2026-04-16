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
import { HydroPasteEngine, validateGeneratedComponents, type RegistryConstraintWarning } from '../core/hydroPaste.js'
import {
    getAdapter,
    hasAdapter,
    detectLibraryFromTokens,
} from '../core/libraryAdapters/index.js'
import type { LibraryTarget } from '../core/libraryAdapters/types.js'
import type { FlintConfig } from '../core/config.js'
import type { DesignToken } from '../types.js'
import { parseFigmaMcpResponse, enrichFigmaNodes } from '../core/figmaMcpParser.js'
import {
    classifyWithAI,
    refineComponent,
    resolveApiKey,
    type ClassificationResult,
    type RefinementResult,
} from '../core/d2cRefinement.js'
import {
    enrichFromCodeConnect,
    type CodeConnectSuggestion,
} from '../core/codeConnectEnricher.js'
import {
    parseDesignSystemResponse,
    buildDesignSystemContext,
    filterDocsForComponent,
    type DesignSystemDoc,
} from '../core/designSystemContext.js'
import {
    transformFigmaJsx,
    type SupportedLibrary,
    type TransformResult,
} from '../core/figmaJsxTransformer.js'

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
                description:
                    'JSON string of the Figma AST payload. Not required when figmaCode ' +
                    'is provided (D2C.6 JSX transform pipeline).',
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
                description:
                    'Raw JSX from Figma MCP get_design_context. When provided WITHOUT ' +
                    'figmaPayload, uses the D2C.6 JSX transform pipeline (Option B) ' +
                    'which directly transforms Figma JSX into library components. ' +
                    'When provided WITH figmaPayload, enriches component recognition.',
            },
            aiClassify: {
                type: 'boolean',
                description:
                    'Run AI classification pass to improve component recognition. ' +
                    'Adds ~2s latency. Default: false (deterministic-only).',
            },
            aiRefine: {
                type: 'boolean',
                description:
                    'Run AI refinement on generated components. ' +
                    'Adds 3-8s per component. Default: false.',
            },
            aiRefineThreshold: {
                type: 'number',
                description:
                    'Confidence threshold below which components trigger AI refinement. ' +
                    'Range 0.0-1.0. Default: 0.7. Only used when aiRefine=true.',
            },
            screenshotBase64: {
                type: 'string',
                description:
                    'Base64-encoded screenshot from Figma get_design_context. ' +
                    'Passed to AI refinement for visual understanding. Optional.',
            },
            designSystemDocs: {
                type: 'string',
                description:
                    'JSON string of DesignSystemDoc[] or raw search_design_system response. ' +
                    'When provided with aiRefine=true, injects component-specific design system ' +
                    'guidelines into each refinement prompt for better library-idiomatic output.',
            },
            codeConnectSuggestions: {
                type: 'string',
                description:
                    'JSON string of CodeConnectSuggestion[] from Figma MCP get_code_connect_suggestions. ' +
                    'Designer-defined mappings between Figma components and code components. ' +
                    'Takes highest classification priority (overrides heuristics and AI classification).',
            },
        },
        required: [],
    },
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DesignToCodeArgs {
    figmaPayload?: string
    library?: string
    projectRoot?: string
    writeThemeFile?: boolean
    figmaUrl?: string
    figmaCode?: string
    /** D2C.5: Run AI classification pass to improve component recognition. */
    aiClassify?: boolean
    /** D2C.5: Run AI refinement on generated components. */
    aiRefine?: boolean
    /** D2C.5: Confidence threshold below which components trigger AI refinement. Default: 0.7. */
    aiRefineThreshold?: number
    /** D2C.5: Base64-encoded screenshot for AI refinement visual context. */
    screenshotBase64?: string
    /** Design system docs (JSON string or raw search_design_system response) for AI refinement context. */
    designSystemDocs?: string
    /** JSON string of CodeConnectSuggestion[] from Figma MCP get_code_connect_suggestions. */
    codeConnectSuggestions?: string
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
    /** D2C.5: AI classification metadata (only present when aiClassify=true) */
    aiClassification?: {
        source: 'ai' | 'fallback'
        classificationCount: number
        latencyMs: number
    }
    /** D2C.5: Per-component refinement metadata (only present when aiRefine=true) */
    aiRefinements?: Array<{
        componentName: string
        status: 'refined' | 'fallback'
        latencyMs: number
        reason?: string
    }>
    /** Code Connect enrichment metadata (only present when codeConnectSuggestions provided) */
    codeConnectEnrichment?: {
        mappedCount: number
        unmappedCount: number
    }
    /** CR-SEAL: Warnings for generated components not in the project registry. */
    registryWarnings?: RegistryConstraintWarning[]
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
    // Step 0: D2C.6 — JSX Transform Pipeline (Option B)
    // When figmaCode is provided WITHOUT figmaPayload, use the direct
    // JSX transform pipeline instead of the HydroPaste engine.
    // ------------------------------------------------------------------
    const useFigmaJsxPipeline =
        args.figmaCode &&
        typeof args.figmaCode === 'string' &&
        args.figmaCode.trim().length > 0 &&
        (!args.figmaPayload || args.figmaPayload.trim().length === 0)

    if (useFigmaJsxPipeline) {
        return handleFigmaJsxTransform(args, config, projectRoot)
    }

    // ------------------------------------------------------------------
    // Step 1: Validate required param (HydroPaste pipeline)
    // ------------------------------------------------------------------
    if (!args.figmaPayload || typeof args.figmaPayload !== 'string') {
        return {
            status: 'error',
            library: 'unknown',
            component: { name: '', code: '', imports: [], tokenRefs: [] },
            components: [],
            tokenMappings: {},
            summary: 'Missing required parameter: figmaPayload (or provide figmaCode for D2C.6 JSX transform).',
            error: 'Either figmaPayload or figmaCode must be provided.',
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
    // Step 6c: D2C.5 — AI classification pass (optional)
    // ------------------------------------------------------------------
    let aiClassificationMeta: DesignToCodeResult['aiClassification']
    let classificationOverrides: Map<string, string> | undefined
    /** Per-node confidence scores from AI classification — used by refinement threshold */
    let classificationConfidences: Map<string, number> | undefined

    if (args.aiClassify) {
        const apiKey = resolveApiKey(projectRoot)
        const parsedTree = JSON.parse(enrichedPayload)
        const classResult = await classifyWithAI(parsedTree, libraryTarget, apiKey)

        aiClassificationMeta = {
            source: classResult.source,
            classificationCount: classResult.classifications.size,
            latencyMs: classResult.latencyMs,
        }

        if (classResult.classifications.size > 0) {
            classificationOverrides = classResult.classifications
            classificationConfidences = classResult.confidences
        }
    }

    // ------------------------------------------------------------------
    // Step 6d: Code Connect suggestions (highest classification priority)
    // ------------------------------------------------------------------
    let codeConnectMeta: DesignToCodeResult['codeConnectEnrichment']

    if (args.codeConnectSuggestions && typeof args.codeConnectSuggestions === 'string') {
        try {
            const parsed = JSON.parse(args.codeConnectSuggestions) as CodeConnectSuggestion[]
            const enrichResult = enrichFromCodeConnect(parsed, libraryTarget)

            codeConnectMeta = {
                mappedCount: enrichResult.mappedCount,
                unmappedCount: enrichResult.unmappedCount,
            }

            if (enrichResult.overrides.size > 0) {
                // Merge: Code Connect overrides take highest priority
                if (!classificationOverrides) {
                    classificationOverrides = new Map()
                }
                for (const [nodeId, componentType] of enrichResult.overrides) {
                    classificationOverrides.set(nodeId, componentType)
                }
            }
        } catch {
            // Malformed JSON is non-fatal — continue without Code Connect enrichment
        }
    }

    // ------------------------------------------------------------------
    // Step 7: Run ingestion (processPage handles both single + multi)
    // ------------------------------------------------------------------
    const engineOptions: { library: LibraryTarget; classificationOverrides?: Map<string, string> } = {
        library: libraryTarget,
    }
    if (classificationOverrides) {
        engineOptions.classificationOverrides = classificationOverrides
    }
    const engine = new HydroPasteEngine(manifest, tokens, engineOptions)
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

    // ------------------------------------------------------------------
    // Step 7a: CR-SEAL — Post-generation registry membership validation
    // Validate that all generated components exist in the project registry.
    // Non-registry components produce warnings (not errors) so the pipeline
    // still returns usable output, but the caller is informed.
    // ------------------------------------------------------------------
    const registryComponents = (manifest as Record<string, unknown>).components as Record<string, unknown> | undefined
    const registryWarnings = validateGeneratedComponents(hydroResult, registryComponents ?? {})

    // Build component results array
    const componentResults: ComponentResult[] = hydroResult.components.map(c => ({
        name: c.name,
        code: c.jsx,
        imports: hydroResult.imports,
        tokenRefs: c.tokenRefs,
    }))

    // ------------------------------------------------------------------
    // Step 7b: D2C.5 — AI refinement pass (optional)
    // ------------------------------------------------------------------
    let aiRefinementsMeta: DesignToCodeResult['aiRefinements']

    if (args.aiRefine && componentResults.length > 0) {
        const apiKey = resolveApiKey(projectRoot)
        const adapter = getAdapter(libraryTarget)
        const idiomBlock = adapter.getIdiomBlock()
        const parsedTree = JSON.parse(enrichedPayload)
        const refineThreshold = typeof args.aiRefineThreshold === 'number'
            ? Math.max(0, Math.min(1, args.aiRefineThreshold))
            : 0.7

        // Parse design system docs once for all components
        let allDsDocs: DesignSystemDoc[] = []
        if (args.designSystemDocs && args.designSystemDocs.trim().length > 0) {
            allDsDocs = parseDesignSystemResponse(args.designSystemDocs)
        }

        aiRefinementsMeta = []

        for (const comp of componentResults) {
            // D2C.5: Only refine components whose classification confidence is
            // below the threshold. When no classification was run (no confidences
            // available), refine all components.
            if (classificationConfidences) {
                const confidence = classificationConfidences.get(comp.name)
                if (confidence !== undefined && confidence >= refineThreshold) {
                    // High-confidence classification — skip refinement
                    continue
                }
            }

            // Build component-specific design system context
            let dsContext: string | undefined
            if (allDsDocs.length > 0) {
                const relevantDocs = filterDocsForComponent(allDsDocs, comp.name)
                // If no component-specific match, include all docs as general guidance
                const docsToUse = relevantDocs.length > 0 ? relevantDocs : allDsDocs
                const contextStr = buildDesignSystemContext(docsToUse)
                if (contextStr.length > 0) {
                    dsContext = contextStr
                }
            }

            const result = await refineComponent(
                comp.code,
                parsedTree,
                libraryTarget,
                idiomBlock,
                apiKey,
                args.screenshotBase64,
                dsContext,
            )

            aiRefinementsMeta.push({
                componentName: comp.name,
                status: result.status,
                latencyMs: result.latencyMs,
                reason: result.reason,
            })

            if (result.status === 'refined') {
                comp.code = result.code
            }
        }
    }

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

    // Build AI summary notes for the summary string
    const aiNotes: string[] = []
    if (aiClassificationMeta) {
        aiNotes.push(
            ` AI classification: ${aiClassificationMeta.classificationCount} override(s)` +
            ` (${aiClassificationMeta.source}, ${aiClassificationMeta.latencyMs}ms).`
        )
    }
    if (aiRefinementsMeta) {
        const refined = aiRefinementsMeta.filter(r => r.status === 'refined').length
        const total = aiRefinementsMeta.length
        aiNotes.push(` AI refinement: ${refined}/${total} component(s) improved.`)
    }
    if (codeConnectMeta) {
        aiNotes.push(
            ` Code Connect: ${codeConnectMeta.mappedCount} mapped, ${codeConnectMeta.unmappedCount} unmapped.`
        )
    }

    // CR-SEAL: Append registry constraint warnings to summary (Citadel: Armory)
    if (registryWarnings.length > 0) {
        const names = registryWarnings.map(w => w.componentName).join(', ')
        aiNotes.push(
            ` ⚠ Armory: ${registryWarnings.length} component(s) not in your project library: ${names}.` +
            ` Register them in your Armory or replace with registered alternatives.`
        )
    }

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
        summary: summary + aiNotes.join(''),
        ...(aiClassificationMeta && { aiClassification: aiClassificationMeta }),
        ...(aiRefinementsMeta && { aiRefinements: aiRefinementsMeta }),
        ...(codeConnectMeta && { codeConnectEnrichment: codeConnectMeta }),
        ...(registryWarnings.length > 0 && { registryWarnings }),
    }
}

// ---------------------------------------------------------------------------
// D2C.6 — Figma JSX Transform Pipeline (Option B)
// ---------------------------------------------------------------------------

async function handleFigmaJsxTransform(
    args: DesignToCodeArgs,
    config: FlintConfig,
    projectRoot: string,
): Promise<DesignToCodeResult> {
    // Read design tokens
    let tokens: DesignToken[] = []
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    if (fs.existsSync(tokensPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            tokens = Array.isArray(raw) ? raw : []
        } catch {
            // Continue with empty tokens
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

    // Resolve library
    let resolvedLibrary: string | undefined = args.library

    if (!resolvedLibrary) {
        const policyPath = path.join(projectRoot, configPath('policy.json'))
        try {
            if (fs.existsSync(policyPath)) {
                const policy = JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
                if (typeof policy.selectedLibrary === 'string') {
                    resolvedLibrary = policy.selectedLibrary
                }
            }
        } catch {
            // fall through to auto-detect
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

    // Transform tokens to the format the transformer expects.
    // Pass ALL color tokens — the transformer builds its hex lookup from these.
    const transformTokens = tokens
        .filter(t => t.token_type === 'color')
        .map(t => ({
            // Normalize path separators: slash-separated paths (color/brand/primary)
            // → dot-separated so the token className deriver splits correctly.
            name: t.token_path.replace(/\//g, '.'),
            value: t.token_value,
            type: t.token_type,
        }))

    // Run the JSX transform pipeline
    const transformResult = transformFigmaJsx(args.figmaCode!, {
        library: libraryTarget as SupportedLibrary,
        tokens: transformTokens,
    })

    // Supplement tokenMappings: scan the raw JSX for any var(--path,#hex) references
    // that the Babel pass may have missed (e.g. inline style props, non-utility-prefixed values).
    // This guarantees tokenMappings is non-empty when the input has real Figma Variable refs.
    const supplementedMappings = { ...transformResult.tokenMappings }
    const varScanRegex = /var\(--([^,)]+),\s*(#[0-9a-fA-F]{3,8})\)/g
    let varMatch: RegExpExecArray | null
    while ((varMatch = varScanRegex.exec(args.figmaCode!)) !== null) {
        const varRef = `var(--${varMatch[1]})`
        if (!supplementedMappings[varRef]) {
            // Look up by hex fallback in the token list
            const hexUpper = varMatch[2].toUpperCase()
            const matchedToken = tokens.find(
                t => t.token_type === 'color' && t.token_value.toUpperCase() === hexUpper
            )
            if (matchedToken) {
                supplementedMappings[varRef] = matchedToken.token_path
            } else {
                // Also try case-insensitive partial match
                const matchedByPath = tokens.find(
                    t => t.token_type === 'color' &&
                        t.token_path.toLowerCase().includes(varMatch![1].replace(/\//g, '.').split('.').pop()?.toLowerCase() ?? '')
                )
                if (matchedByPath) {
                    supplementedMappings[varRef] = matchedByPath.token_path
                } else {
                    // Record the fallback hex so the caller sees the reference was found
                    supplementedMappings[varRef] = hexUpper
                }
            }
        }
    }

    // Derive component name from the root data-name in the JSX (if present),
    // so the output is not always named 'FigmaComponent'.
    const rootNameMatch = args.figmaCode!.match(/data-name="([^"]+)"/)
    const derivedName = rootNameMatch
        ? rootNameMatch[1]
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .split(/\s+/)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join('') || 'FigmaComponent'
        : 'FigmaComponent'

    // Build the component result
    const component: ComponentResult = {
        name: derivedName,
        code: transformResult.code,
        imports: transformResult.imports,
        tokenRefs: Object.values(supplementedMappings),
    }

    // Generate theme file
    const adapter = getAdapter(libraryTarget)
    const themeOutput = adapter.mapTokens(tokens)

    const themeFileResult: DesignToCodeResult['themeFile'] = {
        filename: themeOutput.filename,
        code: themeOutput.code,
        tokenCount: themeOutput.tokenCount,
    }

    // Write theme file if requested
    if (args.writeThemeFile) {
        const writePath = path.join(projectRoot, themeOutput.filename)
        try {
            fs.writeFileSync(writePath, themeOutput.code, 'utf-8')
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            return {
                status: 'error',
                library: libraryTarget,
                component,
                components: [component],
                themeFile: themeFileResult,
                tokenMappings: supplementedMappings,
                summary: `Components generated but theme file write failed: ${msg}`,
                error: msg,
            }
        }
    }

    // CR-SEAL: Post-generation registry validation (same as HydroPaste pipeline)
    let d2c6ManifestComponents: Record<string, unknown> = {}
    const d2c6ManifestPath = path.join(projectRoot, BRAND.manifestFile)
    if (fs.existsSync(d2c6ManifestPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(d2c6ManifestPath, 'utf-8'))
            d2c6ManifestComponents = raw.components ?? raw ?? {}
        } catch { /* manifest unreadable */ }
    }

    // Armory-aware component naming: check if the derived name matches any registered
    // component in the project manifest. If so, this validates the output. If not,
    // keep the derived name but emit a registry warning.
    const d2c6HydroShim = {
        components: [{ name: component.name, jsx: component.code, props: {}, tokenRefs: component.tokenRefs }],
        imports: component.imports,
        summary: '',
        tokenMappings: supplementedMappings,
    }
    const d2c6RegistryWarnings = validateGeneratedComponents(d2c6HydroShim, d2c6ManifestComponents)

    const figmaUrlNote = args.figmaUrl ? ` (source: ${args.figmaUrl})` : ''
    const writeNote = args.writeThemeFile
        ? ` Theme file written to: ${path.join(projectRoot, themeOutput.filename)}.`
        : ' Theme file generated (dry run).'

    // CR-SEAL: Append registry constraint warnings
    let registryNote = ''
    if (d2c6RegistryWarnings.length > 0) {
        const names = d2c6RegistryWarnings.map(w => w.componentName).join(', ')
        registryNote =
            ` Armory: ${d2c6RegistryWarnings.length} component(s) not in your project library: ${names}.`
    }

    // Determine transformation counts: use supplementedMappings for token count
    // since the supplementary scanner may have found mappings the AST pass missed.
    const tokenMappingCount = Object.keys(supplementedMappings).length
    const transformationCount = transformResult.transformations.length
    const componentCountVal = transformResult.componentCount

    // Summary reflects reality — never claim "0 components transformed" as success
    // without explaining why. If the JSX had no recognized component data-names,
    // say so explicitly.
    let summaryDetail: string
    if (componentCountVal === 0 && transformationCount === 0) {
        summaryDetail =
            ` No component elements were recognized for transformation. ` +
            `The JSX was cleaned (Figma artifacts removed, tokens mapped) but no ` +
            `data-name attributes matched known component types (card, button, input, etc.). ` +
            `This is expected for top-level layout frames without component data-names. ` +
            `Token references were still resolved: ${tokenMappingCount} mapping(s).`
    } else {
        summaryDetail =
            ` ${componentCountVal} component(s) transformed${figmaUrlNote}.` +
            ` ${tokenMappingCount} token(s) mapped.` +
            ` ${transformationCount} element(s) replaced.`
    }

    const summary =
        `D2C.6 JSX Transform Pipeline. Library: ${adapter.displayName} (${libraryTarget}).` +
        summaryDetail +
        writeNote + registryNote

    return {
        status: 'ok',
        library: libraryTarget,
        component,
        components: [component],
        themeFile: themeFileResult,
        tokenMappings: supplementedMappings,
        summary,
        ...(d2c6RegistryWarnings.length > 0 && { registryWarnings: d2c6RegistryWarnings }),
    }
}
