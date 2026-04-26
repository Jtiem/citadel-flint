/**
 * Sprint 4 — D2: flint_fix extracted handler.
 *
 * Body lifted from server.ts. Sprint 4 edits:
 *   - projectRoot sourced from ctx, not flintConfig.projectRoot
 *   - findProjectRoot imported from server.js (live binding; no cycle
 *     at module-init time)
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts (D2)
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ResolvedToolContext } from './types.js'
import { handleFlintFix } from '../fix.js'
import { enrichToolResult } from '../../core/toolEnricher.js'
import {
    findProjectRoot,
    getProvenanceService,
    getOverrideTelemetryService,
} from '../../server.js'

export interface FlintFixArgs {
    file?: string
    source?: string
    filePath?: string
    violationIds?: string[]
    dryRun?: boolean
}

export async function handleFix(
    fixArgs: FlintFixArgs,
    ctx: ResolvedToolContext,
) {
    const { projectRoot, flintConfig } = ctx
    const fixResult = await handleFlintFix(
        fixArgs as Parameters<typeof handleFlintFix>[0],
        flintConfig,
    )

    // Write fixed source to disk when fixes were applied and not in
    // dry-run mode. handleFlintFix resolves the path internally but does
    // not write — the server is responsible for persistence.
    const resolvedFixPath = fixArgs.filePath ?? fixArgs.file
    if (fixResult.fixesApplied > 0 && !fixResult.dryRun && resolvedFixPath) {
        try {
            // Commandment 12: atomic write via .tmp → rename
            const tmpFixPath = resolvedFixPath + '.flint-tmp-' + crypto.randomUUID().slice(0, 8)
            fs.writeFileSync(tmpFixPath, fixResult.fixedSource, 'utf-8')
            fs.renameSync(tmpFixPath, resolvedFixPath)
        } catch (writeErr) {
            console.warn('[flint_fix] Failed to write fixed source to disk:', writeErr)
        }
    }

    const fixResultText = JSON.stringify(fixResult, null, 2)
    let enrichedFixText = fixResultText
    try {
        enrichedFixText = enrichToolResult(
            'flint_fix',
            fixArgs as unknown as Record<string, unknown>,
            fixResultText,
            projectRoot,
        )
    } catch {
        // Enrichment is best-effort — never block the fix result
    }

    // V.2-mp: Record provenance when flint_fix actually applied fixes.
    if (fixResult.fixesApplied > 0 && !fixArgs.dryRun && resolvedFixPath) {
        try {
            const fixProjectRoot = findProjectRoot(resolvedFixPath) ?? projectRoot
            const provSvc = getProvenanceService(fixProjectRoot)
            const fixMutationId = crypto.randomUUID()
            provSvc.recordProvenance(
                fixMutationId,
                'auto-fix',
                'flint_fix',
                null,
                `flint_fix applied ${fixResult.fixesApplied} token fix(es) to ${path.basename(resolvedFixPath)}`,
                null,
            )
        } catch {
            // Provenance recording is best-effort — never block fix result
        }
    }

    // GOV.2: Record override telemetry for each token correction.
    if (fixResult.fixesApplied > 0 && resolvedFixPath) {
        try {
            const fixProjectRoot = findProjectRoot(resolvedFixPath) ?? projectRoot
            const ovrSvc = getOverrideTelemetryService(fixProjectRoot)
            ovrSvc.recordOverride({
                id: crypto.randomUUID(),
                nodeId: null,
                ruleId: 'MITHRIL-TOKEN-DRIFT',
                sessionId: null,
                agentId: 'flint_fix',
                timestamp: new Date().toISOString(),
                projectRoot: fixProjectRoot,
                reason: `${fixResult.fixesApplied} token override(s) corrected in ${path.basename(resolvedFixPath)}${fixArgs.dryRun ? ' (dry run)' : ''}`,
            })
        } catch {
            // Override telemetry is best-effort — never block fix result
        }
    }

    // MAJOR-4 / P0: Prepend a human-readable preamble.
    const planSummaryLine = fixResult._summary ? `\n\n**Mutation Plan:** ${fixResult._summary}` : ''
    const semanticLine = fixResult.semanticErrors?.length
        ? `\n\n**Semantic issues (${fixResult.semanticErrors.length}):** ${fixResult.semanticErrors
              .map((e) => e.semanticHint)
              .join('; ')}`
        : ''
    const riskLine = fixResult.riskGatedFixes?.length
        ? `\n\n**Risk-gated fixes (${fixResult.riskGatedFixes.length}):** These fixes need human confirmation before applying.`
        : ''
    const fixesDetail = fixResult.fixesApplied > 0
        ? `\n\n**Fixes applied:** ${fixResult.fixesApplied} token violation(s) corrected.${fixResult.dryRun ? ' (dry run — no changes written)' : ''}`
        : ''
    const fixSummaryPreamble = `## Flint Fix Result\n\n${fixResult.summary}\n\n**Recommendation:** ${fixResult.recommendation}${planSummaryLine}${semanticLine}${riskLine}${fixesDetail}`
    return {
        content: [{ type: 'text', text: fixSummaryPreamble }],
    }
}
