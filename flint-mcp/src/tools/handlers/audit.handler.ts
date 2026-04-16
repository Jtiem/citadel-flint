/**
 * Sprint 4 — D2: flint_audit extracted handler.
 *
 * Body lifted from server.ts with two edits:
 *   - projectRoot sourced from ctx (no more flintConfig.projectRoot)
 *   - disabled a11y rules derived from ctx.resolved.a11y.rules (no more
 *     legacy flintConfig.policy.a11y.disabled_rules)
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts (D2, D3)
 */

import path from 'node:path'
import crypto from 'node:crypto'
import type { ResolvedToolContext } from './types.js'
import { handleFlintAudit, handleFlintAuditBatch } from '../audit.js'
import { toolError, HINTS } from '../../core/errorResponse.js'
import { enrichToolResult } from '../../core/toolEnricher.js'
// Import the local server helpers via the barrel. Circular but safe — the
// handler does not reference them at module-init time.
import { buildAuditSummary, getOverrideTelemetryService } from '../../server.js'

export interface FlintAuditArgs {
    source?: string
    filePath?: string
    filePaths?: string[]
    ruleIds?: string[]
    severity?: 'info' | 'warning' | 'critical'
    healOnAudit?: boolean
}

export async function handleAudit(
    auditArgs: FlintAuditArgs,
    ctx: ResolvedToolContext,
) {
    const { projectRoot, flintConfig, resolved } = ctx

    // Zod already enforced the presence requirements upstream, but keep a
    // defensive guard so the handler stays usable without the hoist.
    if (!auditArgs.filePaths?.length && (!auditArgs.source || !auditArgs.filePath)) {
        return toolError(
            'flint_audit',
            new Error(
                'Missing required parameters: provide either `filePaths` (batch) or both `source` and `filePath` (single file).',
            ),
            HINTS.missingParam('flint_audit({ source: "<jsx code>", filePath: "src/App.tsx" })'),
        )
    }

    if (auditArgs.filePaths && auditArgs.filePaths.length > 0) {
        const batchResult = await handleFlintAuditBatch(
            auditArgs.filePaths,
            { ruleIds: auditArgs.ruleIds, severity: auditArgs.severity },
            flintConfig,
        )
        return {
            content: [{ type: 'text', text: JSON.stringify(batchResult, null, 2) }],
        }
    }

    const auditResult = await handleFlintAudit(
        auditArgs as Parameters<typeof handleFlintAudit>[0],
        flintConfig,
    )
    const auditResultText = JSON.stringify(auditResult, null, 2)

    // ACX.3: Append token context to audit results.
    let enrichedAuditText = auditResultText
    try {
        enrichedAuditText = enrichToolResult(
            'flint_audit',
            auditArgs as unknown as Record<string, unknown>,
            auditResultText,
            projectRoot,
        )
    } catch {
        // Enrichment is best-effort — never block the audit result
    }

    // GOV.2 + D3: Record override telemetry when audit runs with per-rule
    // modes set to 'off'. Sprint 4 migrated the disabled-rules derivation
    // from flintConfig.policy.a11y.disabled_rules to the canonical
    // ResolvedPolicy.a11y.rules map.
    try {
        const disabledRules = Object.entries(resolved.a11y.rules)
            .filter(([, m]) => m === 'off')
            .map(([ruleId]) => ruleId)
        const mithrilOff = resolved.mithril.mode === 'off'
        if ((disabledRules.length > 0 || mithrilOff) && auditArgs.filePath) {
            const ovrSvc = getOverrideTelemetryService(projectRoot)
            for (const ruleId of disabledRules) {
                ovrSvc.recordOverride({
                    id: crypto.randomUUID(),
                    nodeId: null,
                    ruleId,
                    sessionId: null,
                    agentId: 'flint_audit',
                    timestamp: new Date().toISOString(),
                    projectRoot,
                    reason: `Rule ${ruleId} skipped during audit of ${path.basename(auditArgs.filePath)}`,
                })
            }
            if (mithrilOff) {
                ovrSvc.recordOverride({
                    id: crypto.randomUUID(),
                    nodeId: null,
                    ruleId: 'MITHRIL-ALL',
                    sessionId: null,
                    agentId: 'flint_audit',
                    timestamp: new Date().toISOString(),
                    projectRoot,
                    reason: `Mithril linting disabled during audit of ${path.basename(auditArgs.filePath)}`,
                })
            }
        }
    } catch {
        // Override telemetry is best-effort — never block audit result
    }

    const auditSummaryPreamble = buildAuditSummary(
        auditResult as unknown as Parameters<typeof buildAuditSummary>[0],
        auditArgs.filePath ?? '',
    )
    return {
        content: [{ type: 'text', text: `${auditSummaryPreamble}\n\n${enrichedAuditText}` }],
    }
}
