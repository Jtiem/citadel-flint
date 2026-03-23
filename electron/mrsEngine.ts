/**
 * mrsEngine.ts — Stateless Mutation Risk Scorer
 *
 * Extracted from orchestrator.ts to enable direct import in tests
 * (orchestrator.ts contains Unicode template literals that esbuild 0.27.x
 * cannot parse, making it unimportable in the vitest environment).
 *
 * Formula:
 *   mrs = clamp(opWeight×0.40 + blastRadius×0.35 + severity×0.15 + familiarity×0.10)
 *
 * Three-tier risk classification (0.0–1.0 scale):
 *   green  (0.00–0.30) — auto-approve eligible
 *   amber  (0.31–0.69) — requires human review
 *   red    (0.70–1.00) — requires explicit sign-off
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type MRSTier = 'green' | 'amber' | 'red'

export interface MRSFactor {
    name: string
    contribution: number
    description: string
}

export interface MRSAssessment {
    tier: MRSTier
    score: number
    factors: MRSFactor[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Op risk weights (0.0–1.0) for each tool name. */
export const MRS_OP_WEIGHTS: Record<string, number> = {
    flint_update_text:    0.15,
    flint_update_props:   0.20,
    flint_add_class:      0.10,
    flint_remove_class:   0.10,
    flint_insert_node:    0.55,   // structural — above the 0.50 threshold
    flint_wrap_node:      0.60,   // structural
    flint_delete_node:    0.90,   // destructive — structural, highest weight
    // CATALOG.1
    flint_emit_hook:      0.35,
    flint_emit_handler:   0.30,
    flint_emit_callback:  0.25,
    flint_emit_import:    0.10,
    // CATALOG.2
    flint_emit_conditional: 0.40,
    flint_emit_map:         0.50,
    // CATALOG.3
    flint_compose_slot:     0.45,
}

export const MRS_UNKNOWN_OP_WEIGHT = 0.50

/**
 * Minimum tier floor for specific tools.
 * Ensures that destructive operations always reach a baseline tier regardless
 * of blast radius or violation context.
 */
export const MRS_TIER_FLOORS: Record<string, MRSTier> = {
    flint_insert_node: 'amber',
    flint_wrap_node:   'amber',
    flint_delete_node: 'red',
    // CATALOG.1
    flint_emit_hook:    'amber',
    flint_emit_handler: 'amber',
    // CATALOG.2
    flint_emit_conditional: 'amber',
    flint_emit_map:         'amber',
    // CATALOG.3
    flint_compose_slot:     'amber',
}

export const MRS_TIER_RANK: Record<MRSTier, number> = { green: 0, amber: 1, red: 2 }

// ── Helpers ───────────────────────────────────────────────────────────────────

export function mrsClamped(n: number): number {
    return Math.round(Math.max(0.0, Math.min(1.0, n)) * 10000) / 10000
}

export function mrsTier(score: number): MRSTier {
    if (score <= 0.30) return 'green'
    if (score <= 0.69) return 'amber'
    return 'red'
}

/** Apply a tier floor — never lower a computed tier. */
export function applyTierFloor(computed: MRSTier, floor: MRSTier | undefined): MRSTier {
    if (!floor) return computed
    return MRS_TIER_RANK[floor] > MRS_TIER_RANK[computed] ? floor : computed
}

// ── Main scorer ───────────────────────────────────────────────────────────────

/**
 * Compute a stateless MRS assessment for a proposed mutation tool call.
 *
 * Never throws — returns a green/0.0 assessment on any internal error.
 *
 * @param toolName         The Flint tool name (e.g. 'flint_delete_node').
 * @param affectedNodes    Number of nodes the op will touch (default 1).
 * @param hasViolations    True if the current file has active violations.
 */
export function computeMRS(
    toolName: string,
    affectedNodes: number = 1,
    hasViolations: boolean = false,
): MRSAssessment {
    try {
        // Factor 1: operation weight (40%)
        const opWeightRaw = MRS_OP_WEIGHTS[toolName] ?? MRS_UNKNOWN_OP_WEIGHT
        const opContribution = mrsClamped(opWeightRaw * 0.40)
        const opFactor: MRSFactor = {
            name: 'opWeight',
            contribution: opContribution,
            description: `Operation '${toolName}' has base risk weight ${opWeightRaw.toFixed(2)}`,
        }

        // Factor 2: blast radius (35%)
        const blastRaw = Math.min(affectedNodes / 10, 1.0)
        const blastContribution = mrsClamped(blastRaw * 0.35)
        const blastFactor: MRSFactor = {
            name: 'blastRadius',
            contribution: blastContribution,
            description: `${affectedNodes} affected node(s); blast radius ${blastRaw.toFixed(2)}`,
        }

        // Factor 3: severity context (15%)
        const isStructural = opWeightRaw >= 0.50
        let severityRaw: number
        if (isStructural && !hasViolations) {
            severityRaw = 0.70  // structural op, no audit baseline
        } else if (hasViolations) {
            severityRaw = 0.30  // mutation on a file with known violations
        } else {
            severityRaw = 0.00
        }
        const severityContribution = mrsClamped(severityRaw * 0.15)
        const severityFactor: MRSFactor = {
            name: 'severity',
            contribution: severityContribution,
            description: isStructural && !hasViolations
                ? 'Structural op with no audit baseline'
                : hasViolations
                ? 'File has active violations'
                : 'No violation context',
        }

        // Factor 4: familiarity — always 'agent' provenance in orchestrator, neutral (10%)
        const familiarityContribution = mrsClamped(0.10 * 0.10)
        const familiarityFactor: MRSFactor = {
            name: 'familiarity',
            contribution: familiarityContribution,
            description: 'Agent-provenance mutation — neutral familiarity',
        }

        const rawScore =
            opContribution +
            blastContribution +
            severityContribution +
            familiarityContribution

        const score = mrsClamped(rawScore)
        const formulaTier = mrsTier(score)

        // Apply policy tier floor (never lower a computed tier)
        const tier = applyTierFloor(formulaTier, MRS_TIER_FLOORS[toolName])

        return {
            tier,
            score,
            factors: [opFactor, blastFactor, severityFactor, familiarityFactor],
        }
    } catch {
        // Fallback — never block the approval flow on a scorer error
        return { tier: 'green', score: 0.0, factors: [] }
    }
}
