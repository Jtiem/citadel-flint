/**
 * Sprint 4 — D2: flint_agent_trust extracted handler.
 *
 * Dynamic agent trust tier management: profile / list / promote / demote / reset.
 * Body lifted verbatim from server.ts.
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts (D2)
 */

import fs from 'node:fs'
import type { ResolvedToolContext } from './types.js'
import type { TrustTier } from '../../core/governance/trustTierService.js'
import { loadProjectConfig } from '../../core/config-loader.js'
import { toolError, HINTS } from '../../core/errorResponse.js'
import { getTrustTierService } from '../../server.js'

export interface FlintAgentTrustArgs {
    action: 'profile' | 'list' | 'promote' | 'demote' | 'reset'
    projectRoot: string
    agentId?: string
    targetTier?: TrustTier
}

export async function handleAgentTrust(
    trustArgs: FlintAgentTrustArgs,
    _ctx: ResolvedToolContext,
) {
    if (!trustArgs.projectRoot || !fs.existsSync(trustArgs.projectRoot)) {
        return toolError(
            'flint_agent_trust',
            new Error("'projectRoot' must be an existing directory."),
            HINTS.fileNotFound,
        )
    }

    const trustSvc = getTrustTierService(trustArgs.projectRoot)

    switch (trustArgs.action) {
        case 'list': {
            const all = trustSvc.listAll()
            return {
                content: [{ type: 'text', text: JSON.stringify(all, null, 2) }],
            }
        }

        case 'profile': {
            if (!trustArgs.agentId) {
                return toolError(
                    'flint_agent_trust',
                    new Error("action='profile' requires 'agentId'."),
                    HINTS.missingParam(
                        "flint_agent_trust action='profile' agentId='my-agent' projectRoot='...'",
                    ),
                )
            }
            const profile = trustSvc.getAgentTrustProfile(trustArgs.agentId)
            return {
                content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
            }
        }

        case 'promote': {
            if (!trustArgs.agentId || !trustArgs.targetTier) {
                return toolError(
                    'flint_agent_trust',
                    new Error("action='promote' requires 'agentId' and 'targetTier'."),
                    HINTS.missingParam(
                        "flint_agent_trust action='promote' agentId='my-agent' targetTier='trusted' projectRoot='...'",
                    ),
                )
            }
            // Load YAML promotion gates and let evaluatePromotion decide.
            const trustYamlConfig = loadProjectConfig(trustArgs.projectRoot)
            const promotionGates = trustYamlConfig?.trust?.promotion
            const autoPromotedTier = trustSvc.evaluatePromotion(
                trustArgs.agentId,
                promotionGates,
            )
            const autoRecord = trustSvc.getAgentTrustProfile(trustArgs.agentId)
            if (
                autoRecord.currentTier === autoPromotedTier &&
                autoPromotedTier === trustArgs.targetTier
            ) {
                return {
                    content: [{ type: 'text', text: JSON.stringify(autoRecord, null, 2) }],
                }
            }
            const promoted = trustSvc.manualPromote(trustArgs.agentId, trustArgs.targetTier)
            return {
                content: [{ type: 'text', text: JSON.stringify(promoted, null, 2) }],
            }
        }

        case 'demote': {
            if (!trustArgs.agentId) {
                return toolError(
                    'flint_agent_trust',
                    new Error("action='demote' requires 'agentId'."),
                    HINTS.missingParam(
                        "flint_agent_trust action='demote' agentId='my-agent' projectRoot='...'",
                    ),
                )
            }
            const demoted = trustSvc.manualDemote(trustArgs.agentId)
            return {
                content: [{ type: 'text', text: JSON.stringify(demoted, null, 2) }],
            }
        }

        case 'reset': {
            if (!trustArgs.agentId) {
                return toolError(
                    'flint_agent_trust',
                    new Error("action='reset' requires 'agentId'."),
                    HINTS.missingParam(
                        "flint_agent_trust action='reset' agentId='my-agent' projectRoot='...'",
                    ),
                )
            }
            const resetResult = trustSvc.resetTrust(trustArgs.agentId)
            return {
                content: [{ type: 'text', text: JSON.stringify(resetResult, null, 2) }],
            }
        }

        default:
            return toolError(
                'flint_agent_trust',
                new Error(
                    `unknown action '${(trustArgs as { action: string }).action}'. Must be 'profile', 'list', 'promote', 'demote', or 'reset'.`,
                ),
                HINTS.missingParam("flint_agent_trust action='list' projectRoot='...'"),
            )
    }
}
