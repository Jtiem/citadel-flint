/**
 * Sprint 4 — D2: flint_set_policy extracted handler.
 *
 * Body lifted verbatim from server.ts (the old inline case) with these
 * edits:
 *   - projectRoot sourced from ctx, not process.cwd()
 *   - flintConfig reload routed through ctx.reloadFlintConfig()
 *   - Zod validation (tools/schemas.ts) runs upstream in server.ts, so
 *     no per-action parsing beyond the discriminator is required here
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts (D2, D5)
 */

import crypto from 'node:crypto'
import type { ResolvedToolContext } from './types.js'
import type { RawPolicy } from '../../core/policyEngine.js'
import {
    loadAndResolvePolicy,
    writeResolvedPolicy,
    mergeAndValidatePolicy,
    getDefaultResolvedPolicy,
} from '../../core/policyEngine.js'
import { toolError, HINTS } from '../../core/errorResponse.js'
import { getOverrideTelemetryService } from '../../server.js'

export interface FlintSetPolicyArgs {
    action: 'read' | 'update' | 'reset'
    policy?: Partial<RawPolicy>
}

export async function handleSetPolicy(
    args: FlintSetPolicyArgs,
    ctx: ResolvedToolContext,
) {
    const { action, policy: policyUpdate } = args
    const { projectRoot } = ctx

    switch (action) {
        case 'read': {
            const current = loadAndResolvePolicy(projectRoot)
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(current, null, 2),
                }],
            }
        }

        case 'update': {
            if (!policyUpdate || typeof policyUpdate !== 'object') {
                return toolError(
                    'flint_set_policy',
                    new Error(
                        "'update' action requires a 'policy' object with partial policy fields.",
                    ),
                    HINTS.missingParam(
                        "flint_set_policy action='update' policy={\"mithril\":{\"mode\":\"advisory\"}}",
                    ),
                )
            }
            // Sprint 3 MAJOR-6: route through mergeAndValidatePolicy so
            // no invalid policy can be written to disk.
            const mergeResult = mergeAndValidatePolicy(projectRoot, policyUpdate)
            if (!mergeResult.ok) {
                return toolError(
                    'flint_set_policy',
                    new Error(
                        `policy validation failed:\n  - ${mergeResult.errors.join('\n  - ')}`,
                    ),
                    HINTS.missingParam(
                        "flint_set_policy action='update' policy={...valid fields...}",
                    ),
                )
            }
            const merged = mergeResult.policy
            // Reload into active server-level config so subsequent audits
            // pick up the new thresholds immediately.
            ctx.reloadFlintConfig?.()

            // GOV.2: Record override telemetry for disabled rules in
            // policy update. Fire-and-forget — never blocks the response.
            try {
                const ovrSvc = getOverrideTelemetryService(projectRoot)
                const a11yUpdate = (policyUpdate as Record<string, unknown>).a11y
                const disabledA11yRules =
                    a11yUpdate &&
                    typeof a11yUpdate === 'object' &&
                    Array.isArray((a11yUpdate as Record<string, unknown>).disabled_rules)
                        ? ((a11yUpdate as Record<string, unknown>).disabled_rules as string[])
                        : []
                for (const ruleId of disabledA11yRules) {
                    ovrSvc.recordOverride({
                        id: crypto.randomUUID(),
                        nodeId: null,
                        ruleId,
                        sessionId: null,
                        agentId: 'flint_set_policy',
                        timestamp: new Date().toISOString(),
                        projectRoot,
                        reason: `Rule ${ruleId} disabled via policy update`,
                    })
                }
                // Track Mithril mode changes as overrides.
                const mithrilUpdate = (policyUpdate as Record<string, unknown>).mithril
                if (
                    mithrilUpdate &&
                    typeof mithrilUpdate === 'object' &&
                    'mode' in (mithrilUpdate as Record<string, unknown>)
                ) {
                    const mode = (mithrilUpdate as Record<string, string>).mode
                    if (mode === 'off' || mode === 'advisory') {
                        ovrSvc.recordOverride({
                            id: crypto.randomUUID(),
                            nodeId: null,
                            ruleId: 'MITHRIL-ALL',
                            sessionId: null,
                            agentId: 'flint_set_policy',
                            timestamp: new Date().toISOString(),
                            projectRoot,
                            reason: `Mithril mode changed to '${mode}' via policy update`,
                        })
                    }
                }
            } catch {
                // Override telemetry is best-effort — never block the update
            }

            return {
                content: [{
                    type: 'text',
                    text: `Policy updated successfully.\n\n${JSON.stringify(merged, null, 2)}`,
                }],
            }
        }

        case 'reset': {
            const defaults = getDefaultResolvedPolicy()
            writeResolvedPolicy(projectRoot, defaults)
            ctx.reloadFlintConfig?.()
            return {
                content: [{
                    type: 'text',
                    text: `Policy reset to defaults.\n\n${JSON.stringify(defaults, null, 2)}`,
                }],
            }
        }

        default:
            return toolError(
                'flint_set_policy',
                new Error(
                    `unknown action '${action}'. Must be 'read', 'update', or 'reset'.`,
                ),
                HINTS.missingParam("flint_set_policy action='read' projectRoot='...'"),
            )
    }
}
