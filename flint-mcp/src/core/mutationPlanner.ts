/**
 * Mutation Planner — flint-mcp/src/core/mutationPlanner.ts
 *
 * P0 foundation for the Governor Expansion. Classifies each violation
 * into two buckets:
 *
 *   1. **Deterministic** — Flint can fix silently via AST mutation:
 *      - Token swap (color, typography, spacing drift with nearestToken)
 *      - A11y rules marked fixable: true
 *      - Tailwind version class renames (direct map lookup)
 *
 *   2. **Semantic** — Requires human/LLM decision:
 *      - Missing aria-pressed state logic
 *      - Heading hierarchy depending on page context
 *      - Component composition decisions
 *      - A11y rules marked fixable: false
 *
 * Before auto-applying any deterministic fix, the planner calls the
 * stateless scoreMutation() from riskScoringService. Fixes scoring
 * above the risk threshold (default 50 on 0–100 scale, i.e. 0.50 on
 * 0–1 MRS scale) are moved to the riskGated bucket.
 *
 * Phase: P0 (Closed-Loop Auto-Fix Remediation)
 */

import type { LinterWarning, DesignToken } from '../types.js'
import { scoreMutation as scoreMutationMRS } from './governance/riskScoringService.js'
import type { RiskScoringInput, MutationRiskScore } from './governance/riskScoringService.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlannedMutation {
    violation: LinterWarning
    classification: 'deterministic' | 'semantic'
    confidence: number // 0–1
    proposedFix?: { type: string; params: Record<string, unknown> }
    semanticHint?: string // guidance for the LLM/human
    /** MRS score result, populated for deterministic fixes. */
    riskScore?: MutationRiskScore
}

export interface MutationPlan {
    deterministic: PlannedMutation[]
    semantic: PlannedMutation[]
    riskGated: PlannedMutation[] // deterministic but MRS too high, needs confirmation
}

export interface PlanMutationOptions {
    /** MRS threshold (0–100 scale). Deterministic fixes scoring above this
     *  are moved to riskGated. Default: 50. */
    riskThreshold?: number
    /** Project root for familiarity scoring in MRS. */
    projectRoot?: string
    /** File path for MRS familiarity scoring. */
    filePath?: string
}

// ── Drift types that have deterministic fixes when nearestToken is present ──

const DETERMINISTIC_DRIFT_TYPES = new Set<LinterWarning['type']>([
    'color-drift',
    'typography-drift',
    'spacing-drift',
    'shadow-drift',
    'opacity-drift',
    'inline-style-drift',
])

// ── Structural element swaps always require confirmation ─────────────────────

/**
 * Operation types that are always routed to riskGated regardless of MRS score.
 * These represent structural changes that alter DOM semantics.
 */
const ALWAYS_RISK_GATED_OPS = new Set([
    'insertNode',
    'deleteNode',
    'wrapNode',
    'assembleLayout',
])

// ── Classify a single violation ─────────────────────────────────────────────

function classifyViolation(
    violation: LinterWarning,
    tokens: DesignToken[],
): PlannedMutation {
    // ── A11y violations ──────────────────────────────────────────────────────
    if (violation.type === 'a11y') {
        if (violation.fixable === true) {
            return {
                violation,
                classification: 'deterministic',
                confidence: 0.9,
                proposedFix: {
                    type: 'updateProp',
                    params: {
                        ruleId: violation.ruleId ?? 'unknown',
                        source: 'a11y-fixer',
                    },
                },
            }
        }
        return {
            violation,
            classification: 'semantic',
            confidence: 0.7,
            semanticHint: violation.recovery
                ?? `A11y rule ${violation.ruleId ?? violation.id} requires manual attention. ${violation.message}`,
        }
    }

    // ── Drift violations (color, typography, spacing, shadow, opacity, inline) ─
    if (DETERMINISTIC_DRIFT_TYPES.has(violation.type)) {
        if (violation.nearestToken !== null && violation.nearestToken !== undefined) {
            // We have a nearest token — deterministic swap
            const opType = mapDriftToOpType(violation.type)
            return {
                violation,
                classification: 'deterministic',
                confidence: computeDriftConfidence(violation),
                proposedFix: {
                    type: opType,
                    params: {
                        targetToken: violation.nearestToken,
                        targetValue: violation.nearestTokenValue ?? undefined,
                        originalValue: violation.message,
                    },
                },
            }
        }
        // No nearest token — semantic, needs human/LLM decision
        return {
            violation,
            classification: 'semantic',
            confidence: 0.5,
            semanticHint: `No matching design token found for this ${violation.type} violation. A human or LLM must choose the correct token or refactor the value.`,
        }
    }

    // ── Registry violations ──────────────────────────────────────────────────
    if (violation.type === 'registry') {
        // Registry adoption violations are structural (element swap) — always semantic
        return {
            violation,
            classification: 'semantic',
            confidence: 0.6,
            semanticHint: violation.recovery
                ?? `Replace rogue intrinsic element with a design system component. ${violation.message}`,
        }
    }

    // ── Sync violations ──────────────────────────────────────────────────────
    if (violation.type === 'sync') {
        return {
            violation,
            classification: 'semantic',
            confidence: 0.4,
            semanticHint: `Token sync drift detected. Review the sync state and resolve manually. ${violation.message}`,
        }
    }

    // ── Fallback: unknown violation type — treat as semantic ─────────────────
    return {
        violation,
        classification: 'semantic',
        confidence: 0.3,
        semanticHint: `Unrecognized violation type "${violation.type}". Manual review required.`,
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a drift violation type to the MRS operation type for risk scoring.
 */
function mapDriftToOpType(type: LinterWarning['type']): string {
    switch (type) {
        case 'color-drift':
        case 'typography-drift':
        case 'spacing-drift':
        case 'shadow-drift':
        case 'opacity-drift':
        case 'inline-style-drift':
            return 'fixToken'
        default:
            return 'updateClassName'
    }
}

/**
 * Compute a confidence score for a drift fix based on the delta value.
 * Lower delta = higher confidence (the token is a close match).
 */
function computeDriftConfidence(violation: LinterWarning): number {
    const delta = violation.value
    if (delta <= 2) return 0.98
    if (delta <= 5) return 0.92
    if (delta <= 10) return 0.85
    if (delta <= 20) return 0.75
    return 0.6
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Classify a batch of violations into deterministic, semantic, and riskGated
 * buckets. Deterministic fixes with MRS scores above the risk threshold are
 * moved to riskGated for human confirmation.
 *
 * @param violations  Array of LinterWarning from Mithril + Warden audit
 * @param tokens      Design tokens loaded from the project
 * @param options     Optional configuration (risk threshold, project root)
 * @returns           MutationPlan with the three buckets
 */
export async function planMutations(
    violations: LinterWarning[],
    tokens: DesignToken[],
    options?: PlanMutationOptions,
): Promise<MutationPlan> {
    const riskThreshold = (options?.riskThreshold ?? 50) / 100 // convert 0–100 to 0–1 MRS scale

    const plan: MutationPlan = {
        deterministic: [],
        semantic: [],
        riskGated: [],
    }

    if (violations.length === 0) {
        return plan
    }

    for (const violation of violations) {
        const planned = classifyViolation(violation, tokens)

        if (planned.classification === 'semantic') {
            plan.semantic.push(planned)
            continue
        }

        // Deterministic — run MRS risk scoring
        const opType = planned.proposedFix?.type ?? 'fixToken'
        const mrsInput: RiskScoringInput = {
            opType,
            affectedNodeCount: 1,
            filePath: options?.filePath,
            hasViolationContext: true,
            projectRoot: options?.projectRoot,
        }

        const mrsResult = scoreMutationMRS(mrsInput)
        planned.riskScore = mrsResult

        // Structural ops always go to riskGated
        if (ALWAYS_RISK_GATED_OPS.has(opType)) {
            planned.classification = 'deterministic' // keep classification truthful
            plan.riskGated.push(planned)
            continue
        }

        // High MRS score → riskGated
        if (mrsResult.score > riskThreshold) {
            plan.riskGated.push(planned)
            continue
        }

        plan.deterministic.push(planned)
    }

    return plan
}

/**
 * Generate a human-readable summary of the mutation plan.
 */
export function summarizePlan(plan: MutationPlan): string {
    const parts: string[] = []
    if (plan.deterministic.length > 0) {
        parts.push(`Fixed ${plan.deterministic.length} automatically`)
    }
    if (plan.semantic.length > 0) {
        parts.push(`${plan.semantic.length} semantic issue${plan.semantic.length !== 1 ? 's' : ''} require attention`)
    }
    if (plan.riskGated.length > 0) {
        parts.push(`${plan.riskGated.length} high-risk fix${plan.riskGated.length !== 1 ? 'es' : ''} need${plan.riskGated.length === 1 ? 's' : ''} confirmation`)
    }
    if (parts.length === 0) {
        return 'No violations to fix.'
    }
    return parts.join('. ') + '.'
}
