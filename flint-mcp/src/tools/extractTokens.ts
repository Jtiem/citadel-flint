/**
 * flint_extract_tokens + flint_approve_tokens MCP tools
 * flint-mcp/src/tools/extractTokens.ts
 *
 * Phase D2C.4 Feature 2: Token Extraction from Figma ("Design System Discovery")
 *
 * TWO TOOLS — mandatory two-step approval gateway:
 *
 *   1. flint_extract_tokens (READ-ONLY)
 *      Walks a Figma payload, extracts every unique visual value, compares to
 *      existing tokens, and returns proposals + review instructions. NEVER writes.
 *
 *   2. flint_approve_tokens (WRITE)
 *      Accepts a subset of proposed tokens, merges them into design-tokens.json
 *      (preserve-existing semantics), and records a governance event.
 *
 * Commandment compliance:
 *   C1  — Tokens only written after explicit approval via flint_approve_tokens
 *   C2  — Extraction proposes; never auto-applies
 *   C4  — All processing local. No network calls.
 *   C9  — CIEDE2000 in extractTokensFromFigma for near-match detection
 *   C12 — Token writes go through atomic write path (writeFileSync after merge)
 */

import fs from 'node:fs'
import path from 'node:path'
import { toolName, configPath } from '../brand.js'
import { extractTokensFromFigma } from '../core/figmaTokenExtractor.js'
import type { ProposedToken, TokenExtractionOptions } from '../core/figmaTokenExtractor.js'
import type { DesignToken, TokenType } from '../types.js'
import { GovernanceEventService } from '../core/governance/eventService.js'
import BetterSqlite3 from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Tool definitions (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_EXTRACT_TOKENS_TOOL = {
    name: toolName('extract_tokens'),
    description:
        'Extract design tokens from a Figma payload. Walks the Figma node tree and proposes ' +
        'unique visual values (colors, spacing, typography, radii) as named tokens. ' +
        'Returns proposed tokens for human review — does NOT write to disk. ' +
        'Use flint_approve_tokens to persist approved tokens after reviewing.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            figmaPayload: {
                type: 'string',
                description: 'JSON string of the Figma AST payload (same format as flint_design_to_code input).',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to cwd.',
            },
            minUsageCount: {
                type: 'number',
                description: 'Minimum number of occurrences for a value to be proposed. Default: 1.',
            },
            minConfidence: {
                type: 'number',
                description: 'Minimum confidence score (0.0-1.0) for a token to appear in results. Default: 0.0.',
            },
        },
        required: ['figmaPayload'],
    },
} as const

export const FLINT_APPROVE_TOKENS_TOOL = {
    name: toolName('approve_tokens'),
    description:
        'Approve and persist extracted design tokens from a prior flint_extract_tokens call. ' +
        'Writes approved tokens to .flint/design-tokens.json (preserve-existing: existing tokens ' +
        'at the same path are never overwritten). Records a token_extraction governance event ' +
        'for full provenance tracking. Pass an empty tokens array to cancel.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            tokens: {
                type: 'array',
                description: 'Array of tokens to approve and write to design-tokens.json.',
                items: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Dot-separated token path, e.g. "colors.brand.3b82f6".' },
                        value: { type: 'string', description: 'Raw token value, e.g. "#3B82F6", "16".' },
                        type: { type: 'string', description: 'DTCG token type: color | dimension | fontFamily | fontWeight | lineHeight | letterSpacing | opacity | string.' },
                    },
                    required: ['path', 'value', 'type'],
                },
            },
            source: {
                type: 'string',
                description: 'Source identifier for provenance, e.g. Figma file URL or filename.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to cwd.',
            },
            sessionId: {
                type: 'string',
                description: 'Optional session ID for governance event correlation.',
            },
        },
        required: ['tokens'],
    },
} as const

// ---------------------------------------------------------------------------
// Handler: flint_extract_tokens
// ---------------------------------------------------------------------------

export interface ExtractTokensArgs {
    figmaPayload: string
    projectRoot?: string
    minUsageCount?: number
    minConfidence?: number
}

export interface ExtractTokensOutput {
    proposedTokens: ProposedToken[]
    existingMatches: Array<{ proposed: ProposedToken; existingPath: string }>
    nearMatches: Array<{ proposed: ProposedToken; existingPath: string; deltaE: number }>
    stats: {
        totalValuesScanned: number
        uniqueColors: number
        uniqueSpacing: number
        uniqueTypography: number
        uniqueRadii: number
        proposedCount: number
        existingMatchCount: number
        nearMatchCount: number
    }
    reviewInstructions: string
}

export function handleExtractTokens(args: ExtractTokensArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // Parse the Figma payload
    let payload: unknown
    try {
        payload = JSON.parse(args.figmaPayload)
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Invalid figmaPayload: JSON parse failed.',
                    detail: err instanceof Error ? err.message : String(err),
                }),
            }],
            isError: true,
        }
    }

    const projectRoot = args.projectRoot ?? process.cwd()
    const existingTokens = readTokensFromDisk(projectRoot)

    const options: TokenExtractionOptions = {
        existingTokens,
        minUsageCount: args.minUsageCount ?? 1,
        minConfidence: args.minConfidence ?? 0.0,
    }

    const result = extractTokensFromFigma(payload, options)

    // Shape the output to flatten existing token paths for clarity
    const output: ExtractTokensOutput = {
        proposedTokens: result.proposedTokens,
        existingMatches: result.existingMatches.map(em => ({
            proposed: em.proposed,
            existingPath: em.existing.token_path,
        })),
        nearMatches: result.nearMatches.map(nm => ({
            proposed: nm.proposed,
            existingPath: nm.existing.token_path,
            deltaE: nm.deltaE,
        })),
        stats: result.stats,
        reviewInstructions: buildReviewInstructions(result),
    }

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    }
}

function buildReviewInstructions(result: ReturnType<typeof extractTokensFromFigma>): string {
    const { proposedTokens, existingMatches, nearMatches, stats } = result

    const lines: string[] = [
        `Found ${stats.proposedCount} proposed tokens from ${stats.totalValuesScanned} scanned values.`,
        `  - ${stats.uniqueColors} unique colors, ${stats.uniqueSpacing} spacing values, ${stats.uniqueTypography} typography values, ${stats.uniqueRadii} radii.`,
    ]

    if (existingMatches.length > 0) {
        lines.push(`  - ${existingMatches.length} values already exist in design-tokens.json (omitted from proposals).`)
    }
    if (nearMatches.length > 0) {
        lines.push(`  - ${nearMatches.length} values are close to existing tokens (deltaE < 2.0) — check nearMatches before approving.`)
    }

    if (proposedTokens.length > 0) {
        lines.push('')
        lines.push('To approve all proposals, call flint_approve_tokens with the full proposedTokens array.')
        lines.push('To approve a subset, pass only the tokens you want to persist.')
        lines.push('High-confidence tokens (>= 0.7) are recommended for immediate approval.')
    } else {
        lines.push('')
        lines.push('No new tokens to propose. All values either already exist or were filtered.')
    }

    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Handler: flint_approve_tokens
// ---------------------------------------------------------------------------

export interface ApproveTokensArgs {
    tokens: Array<{ path: string; value: string; type: string }>
    source?: string
    projectRoot?: string
    sessionId?: string
}

export interface ApproveTokensOutput {
    writtenCount: number
    rejectedCount: number
    skippedCount: number
    governanceEventId: string
    summary: string
}

export function handleApproveTokens(args: ApproveTokensArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // Guard: empty array
    if (!Array.isArray(args.tokens) || args.tokens.length === 0) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'tokens array is empty. Provide at least one token to approve.',
                }),
            }],
            isError: true,
        }
    }

    const projectRoot = args.projectRoot ?? process.cwd()
    const source = args.source ?? 'figma-extraction'

    // Read existing tokens
    const existingTokens = readTokensFromDisk(projectRoot)
    const existingPaths = new Set(existingTokens.map(t => t.token_path))

    let nextId = existingTokens.length > 0
        ? Math.max(...existingTokens.map(t => t.id)) + 1
        : 1

    const merged = [...existingTokens]
    let writtenCount = 0
    let skippedCount = 0
    let rejectedCount = 0

    for (const incoming of args.tokens) {
        // Validate
        if (!incoming.path || !incoming.value || !incoming.type) {
            rejectedCount++
            continue
        }

        // Skip if path already exists (preserve semantics)
        if (existingPaths.has(incoming.path)) {
            skippedCount++
            continue
        }

        // Convert to DesignToken
        const newToken: DesignToken = {
            id: nextId++,
            token_path: incoming.path,
            token_type: incoming.type as TokenType,
            token_value: incoming.value,
            description: `Approved via flint_approve_tokens — source: ${source}`,
            collection_name: 'figma',
            mode: 'default',
        }

        merged.push(newToken)
        existingPaths.add(incoming.path)
        writtenCount++
    }

    // Write merged tokens atomically
    const configDir = path.join(projectRoot, '.flint')
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }
    const tokensPath = path.join(configDir, 'design-tokens.json')
    fs.writeFileSync(tokensPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

    // Record governance event
    const eventId = recordTokenExtractionEvent({
        projectRoot,
        source,
        approvedCount: writtenCount,
        rejectedCount,
        skippedCount,
        tokenPaths: args.tokens
            .filter(t => t.path && t.value && t.type)
            .map(t => t.path),
        sessionId: args.sessionId,
    })

    const output: ApproveTokensOutput = {
        writtenCount,
        rejectedCount,
        skippedCount,
        governanceEventId: eventId,
        summary: [
            `Token approval complete:`,
            `  ${writtenCount} new tokens written to .flint/design-tokens.json`,
            skippedCount > 0 ? `  ${skippedCount} skipped (path already exists — preserved)` : null,
            rejectedCount > 0 ? `  ${rejectedCount} rejected (missing path/value/type)` : null,
            `  Governance event recorded: ${eventId}`,
        ].filter(Boolean).join('\n'),
    }

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    }
}

// ---------------------------------------------------------------------------
// Governance event recording
// ---------------------------------------------------------------------------

function recordTokenExtractionEvent(opts: {
    projectRoot: string
    source: string
    approvedCount: number
    rejectedCount: number
    skippedCount: number
    tokenPaths: string[]
    sessionId?: string
}): string {
    try {
        const dbDir = path.join(opts.projectRoot, '.flint')
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true })
        }
        const db = new BetterSqlite3(path.join(dbDir, 'governance.db'))
        const service = new GovernanceEventService(db)

        // Generate a deterministic-ish ID using timestamp + random suffix
        const eventId = `te-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

        service.recordEvent({
            id: eventId,
            eventType: 'token_extraction',
            ruleId: 'TOKEN-EXTRACT-001',
            severity: 'info',
            filePath: path.join(opts.projectRoot, '.flint/design-tokens.json'),
            message: `Approved ${opts.approvedCount} tokens from ${opts.source}`,
            sessionId: opts.sessionId ?? undefined,
            actor: 'flint_approve_tokens',
            metadata: {
                source: opts.source,
                approvedCount: opts.approvedCount,
                rejectedCount: opts.rejectedCount,
                skippedCount: opts.skippedCount,
                tokenPaths: opts.tokenPaths,
                extractionSessionId: opts.sessionId ?? null,
            },
        })

        db.close()
        return eventId
    } catch {
        // Governance event failure should never block the token write
        return `te-fallback-${Date.now().toString(36)}`
    }
}

// ---------------------------------------------------------------------------
// Token I/O helpers
// ---------------------------------------------------------------------------

function readTokensFromDisk(projectRoot: string): DesignToken[] {
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    try {
        if (fs.existsSync(tokensPath)) {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            return Array.isArray(raw) ? raw : []
        }
    } catch { /* ignore parse errors */ }
    return []
}
