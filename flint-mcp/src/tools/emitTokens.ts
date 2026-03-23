/**
 * flint_emit_tokens MCP tool -- flint-mcp/src/tools/emitTokens.ts
 *
 * EXP.7: Emit design tokens from .flint/design-tokens.json to platform-native
 * formats. Supports 5 platforms: tailwind, css, react-native, swift, kotlin.
 *
 * Returns per-platform output files plus a cross-platform consistency audit.
 * Use dryRun=true to preview without writing files.
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { toolName, configPath } from '../brand.js'
import { getEmitter, getAvailablePlatforms, hasEmitter } from '../core/emitters/index.js'
import type {
    PlatformTarget,
    PlatformOutput,
    ValidationResult,
    CrossPlatformAuditResult,
    TokenCoverageEntry,
    ConsistencyIssue,
    PlatformSummary,
    TokenSyncReport,
    EmitOptions,
} from '../core/emitters/types.js'
import type { DesignToken, TokenType } from '../types.js'

// ---- All valid platform targets (used for input validation) ----
const ALL_PLATFORMS: PlatformTarget[] = ['tailwind', 'css', 'react-native', 'swift', 'kotlin']

// ---- Tool definition (MCP ListTools schema) ------------------------------------

export const FLINT_EMIT_TOKENS_TOOL = {
    name: toolName('emit_tokens'),
    description:
        'EXP.7: Emit design tokens from .flint/design-tokens.json to platform-native ' +
        'formats. Supports: tailwind (theme config), css (custom properties), ' +
        'react-native (StyleSheet.create), swift (UIColor extensions), kotlin ' +
        '(Compose Color/MaterialTheme). Returns per-platform output files plus a ' +
        'cross-platform consistency audit. Use dryRun=true to preview without writing files.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            platforms: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['tailwind', 'css', 'react-native', 'swift', 'kotlin'],
                },
                description:
                    'Target platforms to emit. Pass multiple for cross-platform sync. ' +
                    'When omitted, emits to all 5 platforms.',
            },
            outputDir: {
                type: 'string',
                description:
                    'Directory to write generated files. Defaults to .flint/platform-tokens/. ' +
                    'Ignored when dryRun is true.',
            },
            dryRun: {
                type: 'boolean',
                description:
                    'When true, returns the generated code without writing to disk. Default: false.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root. Defaults to process.cwd().',
            },
            mode: {
                type: 'string',
                description:
                    'Filter tokens to a specific mode (e.g. "Light", "Dark"). ' +
                    'When omitted, emits all modes.',
            },
            collection: {
                type: 'string',
                description:
                    'Filter tokens to a specific collection name. When omitted, emits all.',
            },
            prefix: {
                type: 'string',
                description:
                    'Identifier prefix for generated output (e.g. CSS variable prefix). ' +
                    'Platform defaults apply when omitted.',
            },
        },
    },
} as const

// ---- Args interface -----------------------------------------------------------

export interface EmitTokensArgs {
    platforms?: PlatformTarget[]
    outputDir?: string
    dryRun?: boolean
    projectRoot?: string
    mode?: string
    collection?: string
    prefix?: string
}

// ---- Token loader (lightweight DTCG walker) -----------------------------------

/**
 * Load design tokens from .flint/design-tokens.json.
 *
 * The file can be in two formats:
 *   1. An array of DesignToken objects (already flattened)
 *   2. A W3C DTCG nested JSON object with $value/$type keys
 *
 * Returns DesignToken[] suitable for emitter consumption.
 */
export function loadDesignTokens(projectRoot: string): DesignToken[] {
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    if (!fs.existsSync(tokensPath)) {
        throw new Error(
            `Design tokens file not found: ${tokensPath}. ` +
            'Run Figma ingestion or create .flint/design-tokens.json manually.',
        )
    }

    const raw = fs.readFileSync(tokensPath, 'utf-8')
    let data: unknown
    try {
        data = JSON.parse(raw)
    } catch {
        throw new Error(`Failed to parse design tokens JSON at ${tokensPath}`)
    }

    // If already an array of DesignToken-shaped objects, return as-is
    if (Array.isArray(data)) {
        return data as DesignToken[]
    }

    // Walk DTCG tree (nested JSON with $value/$type)
    const tokens: DesignToken[] = []
    let nextId = 1
    walkDTCG(data as Record<string, unknown>, [], tokens, nextId)
    return tokens
}

/**
 * Recursively walk a DTCG-formatted token tree and flatten into DesignToken[].
 */
function walkDTCG(
    node: Record<string, unknown>,
    pathSegments: string[],
    out: DesignToken[],
    nextId: number,
): number {
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue // Skip meta keys like $description

        const child = value as Record<string, unknown>
        if (child && typeof child === 'object' && '$value' in child) {
            // Leaf token node
            const tokenType = mapDTCGType(child.$type as string | undefined)
            const tokenPath = [...pathSegments, key].join('.')
            const collectionName = pathSegments[0] ?? 'default'
            const mode = (child.$extensions as Record<string, unknown>)?.mode as string ?? 'default'

            out.push({
                id: nextId++,
                token_path: tokenPath,
                token_type: tokenType,
                token_value: String(child.$value),
                description: (child.$description as string) ?? null,
                collection_name: collectionName,
                mode,
            })
        } else if (child && typeof child === 'object') {
            // Intermediate group node -- recurse
            nextId = walkDTCG(child, [...pathSegments, key], out, nextId)
        }
    }
    return nextId
}

/**
 * Map a DTCG $type string to our TokenType enum.
 */
function mapDTCGType(dtcgType: string | undefined): TokenType {
    if (!dtcgType) return 'string'
    const lower = dtcgType.toLowerCase()
    const mapping: Record<string, TokenType> = {
        color: 'color',
        dimension: 'dimension',
        fontfamily: 'fontFamily',
        fontweight: 'fontWeight',
        lineheight: 'lineHeight',
        letterspacing: 'letterSpacing',
        shadow: 'shadow',
        opacity: 'opacity',
        string: 'string',
        boolean: 'boolean',
        number: 'dimension',
        duration: 'string',
        cubicbezier: 'string',
    }
    return mapping[lower.replace(/[-_\s]/g, '')] ?? 'string'
}

// ---- Cross-platform auditor (pure function) -----------------------------------

/**
 * Run a cross-platform consistency audit across multiple platform outputs.
 * Pure function -- no I/O.
 */
export function auditCrossPlatform(
    inputTokens: DesignToken[],
    outputs: PlatformOutput[],
): CrossPlatformAuditResult {
    const platformCount = outputs.length
    if (platformCount === 0) {
        return {
            grade: 'F',
            score: 0,
            totalTokens: inputTokens.length,
            coverage: [],
            issues: [],
            platformSummary: [],
        }
    }

    // Build a map of which tokens each platform emitted vs skipped
    const skippedByPlatform = new Map<PlatformTarget, Set<string>>()
    for (const output of outputs) {
        const skippedPaths = new Set(output.skippedTokens.map(s => s.tokenPath))
        skippedByPlatform.set(output.platform, skippedPaths)
    }

    const platforms = outputs.map(o => o.platform)

    // Build coverage entries
    const coverage: TokenCoverageEntry[] = []
    const issues: ConsistencyIssue[] = []

    for (const token of inputTokens) {
        const presentIn: PlatformTarget[] = []
        const missingFrom: PlatformTarget[] = []

        for (const platform of platforms) {
            const skipped = skippedByPlatform.get(platform)
            if (skipped?.has(token.token_path)) {
                missingFrom.push(platform)
            } else {
                presentIn.push(platform)
            }
        }

        coverage.push({
            tokenPath: token.token_path,
            tokenType: token.token_type,
            presentIn,
            missingFrom,
        })

        // Generate issues for missing tokens
        if (missingFrom.length > 0 && presentIn.length > 0) {
            const severity = getIssueSeverity(token.token_type)
            issues.push({
                severity,
                tokenPath: token.token_path,
                message: `Token '${token.token_path}' (${token.token_type}) is missing from ${missingFrom.join(', ')} but present in ${presentIn.join(', ')}`,
                platforms: missingFrom,
            })
        }
    }

    // Calculate score
    const totalEmitted = outputs.reduce((sum, o) => sum + o.tokenCount, 0)
    const maxPossible = inputTokens.length * platformCount
    const score = maxPossible > 0
        ? Math.round((totalEmitted / maxPossible) * 100)
        : 0

    // Platform summaries
    const platformSummary: PlatformSummary[] = outputs.map(output => ({
        platform: output.platform,
        emitted: output.tokenCount,
        skipped: output.skippedTokens.length,
        coveragePercent: inputTokens.length > 0
            ? Math.round((output.tokenCount / inputTokens.length) * 100)
            : 0,
    }))

    return {
        grade: scoreToGrade(score),
        score,
        totalTokens: inputTokens.length,
        coverage,
        issues,
        platformSummary,
    }
}

/**
 * Map token type to issue severity when a token is missing from a platform.
 */
function getIssueSeverity(tokenType: TokenType): 'error' | 'warning' | 'info' {
    switch (tokenType) {
        case 'color':
            return 'error' // Broken brand experience
        case 'fontFamily':
        case 'fontWeight':
        case 'lineHeight':
        case 'letterSpacing':
            return 'warning' // Typography has platform-specific behavior
        case 'dimension':
            return 'warning' // Spacing models differ
        case 'shadow':
        case 'opacity':
        case 'string':
        case 'boolean':
            return 'info' // Platform-specific skips are expected
        default:
            return 'info'
    }
}

/**
 * Convert a numeric score (0-100) to a letter grade.
 */
function scoreToGrade(score: number): string {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

// ---- Atomic file writer -------------------------------------------------------

/**
 * Write a file atomically using the tmp+rename pattern (Commandment 12).
 * Since this runs in the MCP server process, FileTransactionManager is not
 * available. This replicates the same safety guarantee.
 */
function writeFileAtomic(filePath: string, content: string): void {
    const tmpPath = filePath + '.tmp.' + process.pid
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.renameSync(tmpPath, filePath)
}

// ---- Handler ------------------------------------------------------------------

export async function handleEmitTokens(
    args: EmitTokensArgs,
    defaultProjectRoot: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    // 1. Resolve project root
    const projectRoot = args.projectRoot ?? defaultProjectRoot

    // 2. Load design tokens
    let tokens: DesignToken[]
    try {
        tokens = loadDesignTokens(projectRoot)
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: `flint_emit_tokens error: ${(err as Error).message}`,
            }],
        }
    }

    if (tokens.length === 0) {
        return {
            content: [{
                type: 'text',
                text: 'flint_emit_tokens: No design tokens found in ' +
                    configPath('design-tokens.json') + '. Nothing to emit.',
            }],
        }
    }

    // 3. Determine target platforms
    const requestedPlatforms: PlatformTarget[] = args.platforms && args.platforms.length > 0
        ? args.platforms
        : ALL_PLATFORMS

    // Validate that requested platforms are valid
    for (const p of requestedPlatforms) {
        if (!ALL_PLATFORMS.includes(p)) {
            return {
                content: [{
                    type: 'text',
                    text: `flint_emit_tokens: Unknown platform '${p}'. Valid platforms: ${ALL_PLATFORMS.join(', ')}`,
                }],
            }
        }
    }

    // 4. Apply token filters
    let filteredTokens = tokens
    if (args.mode) {
        filteredTokens = filteredTokens.filter(t => t.mode === args.mode)
    }
    if (args.collection) {
        filteredTokens = filteredTokens.filter(t => t.collection_name === args.collection)
    }

    if (filteredTokens.length === 0) {
        const filters: string[] = []
        if (args.mode) filters.push(`mode='${args.mode}'`)
        if (args.collection) filters.push(`collection='${args.collection}'`)
        return {
            content: [{
                type: 'text',
                text: `flint_emit_tokens: No tokens match filters (${filters.join(', ')}). ` +
                    `Total tokens before filtering: ${tokens.length}.`,
            }],
        }
    }

    // 5. Build emit options
    const emitOptions: EmitOptions = {}
    if (args.mode) emitOptions.mode = args.mode
    if (args.collection) emitOptions.collection = args.collection
    if (args.prefix) emitOptions.prefix = args.prefix

    // 6. Run emitters
    const outputs: PlatformOutput[] = []
    const validations: Record<string, ValidationResult> = {}
    const errors: string[] = []

    for (const platform of requestedPlatforms) {
        if (!hasEmitter(platform)) {
            errors.push(`No emitter registered for platform '${platform}'. ` +
                'The emitter module may not be implemented yet.')
            continue
        }

        try {
            const emitter = getEmitter(platform)
            const output = emitter.emit(filteredTokens, emitOptions)
            const validation = emitter.validate(output)
            outputs.push(output)
            validations[platform] = validation
        } catch (err) {
            errors.push(`Emitter '${platform}' failed: ${(err as Error).message}`)
        }
    }

    // 7. Cross-platform audit (only when 2+ platforms produced output)
    let audit: CrossPlatformAuditResult | null = null
    if (outputs.length >= 2) {
        audit = auditCrossPlatform(filteredTokens, outputs)
    }

    // 8. Determine dry run
    const dryRun = args.dryRun ?? false

    // 9. Write files if not dry run
    let outputDir: string | null = null
    if (!dryRun && outputs.length > 0) {
        outputDir = args.outputDir
            ? (path.isAbsolute(args.outputDir) ? args.outputDir : path.join(projectRoot, args.outputDir))
            : path.join(projectRoot, configPath('platform-tokens'))

        // Ensure output directory exists
        fs.mkdirSync(outputDir, { recursive: true })

        // Write each platform output
        for (const output of outputs) {
            const filePath = path.join(outputDir, output.filename)
            writeFileAtomic(filePath, output.code)
        }

        // Always write the report file
        const report: TokenSyncReport = {
            generatedAt: new Date().toISOString(),
            inputTokenCount: filteredTokens.length,
            dryRun,
            outputs,
            validations: validations as Record<PlatformTarget, ValidationResult>,
            audit,
            outputDir,
        }
        const reportPath = path.join(outputDir, '_report.json')
        writeFileAtomic(reportPath, JSON.stringify(report, null, 2))
    }

    // 10. Build the response report
    const report: TokenSyncReport = {
        generatedAt: new Date().toISOString(),
        inputTokenCount: filteredTokens.length,
        dryRun,
        outputs,
        validations: validations as Record<PlatformTarget, ValidationResult>,
        audit,
        outputDir,
    }

    // Append any errors that occurred
    let responseText = JSON.stringify(report, null, 2)
    if (errors.length > 0) {
        responseText = JSON.stringify({
            ...report,
            errors,
        }, null, 2)
    }

    return {
        content: [{ type: 'text', text: responseText }],
    }
}
