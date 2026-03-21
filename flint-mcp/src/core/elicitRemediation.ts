/**
 * elicitRemediation.ts — flint-mcp/src/core/elicitRemediation.ts
 *
 * Phase REM.1: MCP-native elicitation-driven remediation.
 *
 * After an audit finds fixable violations, this helper presents an
 * interactive dialog ("Fix Now / Preview / Skip") using MCP's
 * server.elicitInput() and acts on the answer within the same tool call.
 *
 * Architecture notes:
 * - Capability guard: if the client does not support elicitation the helper
 *   falls back to skipped immediately (catch "Client does not support").
 * - fix_now: calls handleFlintFix with dryRun:false, writes file to disk.
 * - dry_run: calls handleFlintFix with dryRun:true, then issues a second
 *   elicitation asking for confirmation before applying.
 * - skip / decline / cancel: no-op, returns skipped.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { handleFlintFix } from '../tools/fix.js'
import type { FixResult } from '../tools/fix.js'
import type { FlintConfig } from './config.js'

export type { FixResult }

// ── Public result type ─────────────────────────────────────────────────────────

export interface ElicitRemediationResult {
    action: 'fixed' | 'dry_run' | 'skipped'
    fixResult?: FixResult
    fixReceipt?: string
}

// ── Receipt generator ──────────────────────────────────────────────────────────

function buildFixReceipt(filePath: string, fixResult: FixResult): string {
    const basename = path.basename(filePath)
    const plural = fixResult.fixesApplied !== 1 ? 's' : ''
    return [
        '---',
        '',
        '## Remediation Applied',
        '',
        `Fixed ${fixResult.fixesApplied} violation${plural} in \`${basename}\`.`,
        '',
        fixResult.summary,
    ].join('\n')
}

// ── Main exported function ─────────────────────────────────────────────────────

/**
 * Presents an MCP elicitation dialog to the user after an audit finds fixable
 * violations, then applies or previews fixes based on the user's choice.
 *
 * Falls back to `{ action: 'skipped' }` when the client does not support
 * elicitation (SDK throws "Client does not support form elicitation").
 */
export async function elicitRemediation(
    server: Server,
    filePath: string,
    source: string,
    totalFixable: number,
    config: FlintConfig,
): Promise<ElicitRemediationResult> {
    const basename = path.basename(filePath)
    const violationPlural = totalFixable !== 1 ? 's' : ''
    const fixPlural = totalFixable !== 1 ? 's' : ''

    // ── Capability guard ──────────────────────────────────────────────────────
    // Use getClientCapabilities() if available. If the method does not exist or
    // the client reports no elicitation capability, we skip eagerly. Either way,
    // we also wrap the actual elicitInput call in try/catch to catch the runtime
    // "Client does not support" error for clients that omit the capability flag.

    if (typeof (server as unknown as { getClientCapabilities?: () => unknown }).getClientCapabilities === 'function') {
        const caps = (server as unknown as { getClientCapabilities: () => { elicitation?: unknown } | undefined }).getClientCapabilities()
        if (caps && !caps.elicitation) {
            return { action: 'skipped' }
        }
    }

    // ── First elicitation: choose action ─────────────────────────────────────
    let firstResult: { action: string; content?: Record<string, string | number | boolean | string[]> }
    try {
        firstResult = await server.elicitInput({
            message: `Flint found ${totalFixable} auto-fixable violation${violationPlural} in ${basename}. Choose a remediation action.`,
            requestedSchema: {
                type: 'object' as const,
                properties: {
                    action: {
                        type: 'string' as const,
                        title: 'Remediation Action',
                        oneOf: [
                            {
                                const: 'fix_now',
                                title: `Fix Now — apply ${totalFixable} token correction${fixPlural} to disk`,
                            },
                            {
                                const: 'dry_run',
                                title: 'Preview Fixes — see what would change before applying',
                            },
                            {
                                const: 'skip',
                                title: 'Skip — return report without fixing',
                            },
                        ],
                        default: 'dry_run',
                    },
                },
                required: ['action'],
            },
        })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('does not support') || msg.includes('elicitation')) {
            return { action: 'skipped' }
        }
        throw err
    }

    // ── Handle first-elicitation response ─────────────────────────────────────
    if (firstResult.action === 'decline' || firstResult.action === 'cancel') {
        return { action: 'skipped' }
    }

    const chosenAction = firstResult.content?.action as string | undefined

    if (!chosenAction || chosenAction === 'skip') {
        return { action: 'skipped' }
    }

    // ── fix_now path ──────────────────────────────────────────────────────────
    if (chosenAction === 'fix_now') {
        const fixResult = await handleFlintFix(
            { source, filePath, dryRun: false },
            config,
        )
        if (fixResult.fixesApplied > 0) {
            fs.writeFileSync(filePath, fixResult.fixedSource, 'utf-8')
        }
        const fixReceipt = buildFixReceipt(filePath, fixResult)
        return { action: 'fixed', fixResult, fixReceipt }
    }

    // ── dry_run path ──────────────────────────────────────────────────────────
    if (chosenAction === 'dry_run') {
        const previewResult = await handleFlintFix(
            { source, filePath, dryRun: true },
            config,
        )

        // Second elicitation: confirm application of previewed fixes
        let secondResult: { action: string; content?: Record<string, string | number | boolean | string[]> }
        try {
            const fixCountPlural = previewResult.fixesApplied !== 1 ? 'es' : ''
            secondResult = await server.elicitInput({
                message: `Preview: ${previewResult.fixesApplied} fix${fixCountPlural} ready.\n\n${previewResult.summary}\n\nApply these changes?`,
                requestedSchema: {
                    type: 'object' as const,
                    properties: {
                        confirm: {
                            type: 'boolean' as const,
                            title: 'Apply the previewed fixes',
                            default: true,
                        },
                    },
                    required: ['confirm'],
                },
            })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.includes('does not support') || msg.includes('elicitation')) {
                return { action: 'dry_run', fixResult: previewResult }
            }
            throw err
        }

        if (
            secondResult.action === 'accept' &&
            secondResult.content?.confirm === true
        ) {
            // Apply for real
            const finalResult = await handleFlintFix(
                { source, filePath, dryRun: false },
                config,
            )
            if (finalResult.fixesApplied > 0) {
                fs.writeFileSync(filePath, finalResult.fixedSource, 'utf-8')
            }
            const fixReceipt = buildFixReceipt(filePath, finalResult)
            return { action: 'fixed', fixResult: finalResult, fixReceipt }
        }

        // Declined / cancelled / confirm=false — return informational dry_run result
        return { action: 'dry_run', fixResult: previewResult }
    }

    // Unknown action string — treat as skipped
    return { action: 'skipped' }
}
