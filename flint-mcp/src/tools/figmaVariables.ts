/**
 * flint_pull_variables MCP tool
 * flint-mcp/src/tools/figmaVariables.ts
 *
 * Accepts the raw output from Figma MCP `get_variable_defs`, converts it
 * into Flint DesignToken[] format, and returns PROPOSED tokens for review.
 *
 * This is a READ-ONLY tool. Tokens are not written to disk. The caller
 * uses `flint_approve_tokens` to persist approved tokens after reviewing.
 *
 * Workflow:
 *   1. MCP client calls Figma MCP `get_variable_defs` for the file
 *   2. MCP client calls `flint_pull_variables` with that payload
 *   3. Flint converts Figma Variables into DesignToken[] proposals
 *   4. MCP client reviews and calls `flint_approve_tokens` to persist
 *
 * Commandment compliance:
 *   C1  — No writes. Pure data transformation.
 *   C2  — Returns proposals for human review.
 *   C4  — 100% local. No network calls.
 */

import { toolName } from '../brand.js'
import {
    convertFigmaVariables,
    computeStats,
} from '../core/figmaVariablesAdapter.js'
import type { FigmaVariablesResponse } from '../core/figmaVariablesAdapter.js'

// ── Tool definition ─────────────────────────────────────────────────────────

export const FLINT_PULL_VARIABLES_TOOL = {
    name: toolName('pull_variables'),
    description:
        'Pull design tokens from Figma Variables. Accepts the raw output from Figma MCP ' +
        '`get_variable_defs` and converts it into Flint token format. Returns PROPOSED ' +
        'tokens for review — does NOT write to disk. Use flint_approve_tokens to persist ' +
        'approved tokens after reviewing.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            variablesPayload: {
                type: 'string',
                description:
                    'JSON string of the Figma Variables response (from `get_variable_defs`). ' +
                    'Must contain `variables` and `variableCollections` keys.',
            },
            fileKey: {
                type: 'string',
                description: 'Figma file key (for provenance tracking).',
            },
            mode: {
                type: 'string',
                description:
                    'Variable mode to extract (e.g., "Light", "Dark"). ' +
                    'Defaults to all modes. Multi-mode collections produce suffixed tokens.',
            },
        },
        required: ['variablesPayload'],
    },
} as const

// ── Handler types ───────────────────────────────────────────────────────────

export interface PullVariablesArgs {
    variablesPayload: string
    fileKey?: string
    mode?: string
}

export interface PullVariablesOutput {
    tokens: Array<{
        path: string
        value: string
        type: string
        collection: string
        mode: string
        description: string
    }>
    stats: {
        totalVariables: number
        totalTokens: number
        byType: Record<string, number>
        byCollection: Record<string, number>
        byMode: Record<string, number>
    }
    source: string
    approvalInstructions: string
}

// ── Handler ─────────────────────────────────────────────────────────────────

export function handlePullVariables(args: PullVariablesArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // Guard: missing payload
    if (!args.variablesPayload) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'variablesPayload is required. Pass the JSON output from Figma MCP `get_variable_defs`.',
                }),
            }],
            isError: true,
        }
    }

    // Parse the payload
    let response: FigmaVariablesResponse
    try {
        response = JSON.parse(args.variablesPayload)
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Invalid variablesPayload: JSON parse failed.',
                    detail: err instanceof Error ? err.message : String(err),
                }),
            }],
            isError: true,
        }
    }

    // Validate structure
    if (!response.variables || !response.variableCollections) {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    error: 'Invalid variablesPayload: must contain `variables` and `variableCollections` keys.',
                }),
            }],
            isError: true,
        }
    }

    // Convert
    const tokens = convertFigmaVariables(response, {
        modeFilter: args.mode,
    })

    const stats = computeStats(tokens)

    // Build the output shape expected by the approval gateway
    const output: PullVariablesOutput = {
        tokens: tokens.map(t => ({
            path: t.token_path,
            value: t.token_value,
            type: t.token_type,
            collection: t.collection_name,
            mode: t.mode,
            description: t.description ?? '',
        })),
        stats,
        source: args.fileKey ? `figma-variables:${args.fileKey}` : 'figma-variables',
        approvalInstructions: buildApprovalInstructions(stats, args.fileKey),
    }

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    }
}

// ── Approval instructions ───────────────────────────────────────────────────

function buildApprovalInstructions(
    stats: PullVariablesOutput['stats'],
    fileKey?: string,
): string {
    const lines: string[] = []

    lines.push(`Pulled ${stats.totalTokens} tokens from ${stats.totalVariables} Figma Variables.`)

    const typeSummary = Object.entries(stats.byType)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')
    if (typeSummary) {
        lines.push(`  Types: ${typeSummary}`)
    }

    const collectionSummary = Object.entries(stats.byCollection)
        .map(([coll, count]) => `${count} from "${coll}"`)
        .join(', ')
    if (collectionSummary) {
        lines.push(`  Collections: ${collectionSummary}`)
    }

    if (Object.keys(stats.byMode).length > 1) {
        const modeSummary = Object.entries(stats.byMode)
            .map(([mode, count]) => `${count} in "${mode}"`)
            .join(', ')
        lines.push(`  Modes: ${modeSummary}`)
    }

    lines.push('')
    lines.push('These are Figma Variables — the authoritative token set from the design file.')
    lines.push('To approve all tokens, call flint_approve_tokens with the full tokens array.')
    lines.push('To approve a subset, pass only the tokens you want to persist.')

    if (fileKey) {
        lines.push(`Source: figma-variables:${fileKey}`)
    }

    return lines.join('\n')
}
