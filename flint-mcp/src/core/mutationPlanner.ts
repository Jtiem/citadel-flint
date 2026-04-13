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
    'tailwind-version-drift',
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
    'replaceElement', // structural element swap — always requires confirmation (R2)
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
        // MITHRIL-REG-001: Rogue intrinsic with full prop mapping → deterministic
        // but always risk-gated (structural element swap). Without prop mapping → semantic.
        if (violation.ruleId === 'MITHRIL-REG-001') {
            const hasPropMapping = violation.message?.includes('Prop mapping:')
            return {
                violation,
                classification: hasPropMapping ? 'deterministic' : 'semantic',
                confidence: hasPropMapping ? 0.85 : 0.6,
                proposedFix: hasPropMapping ? {
                    type: 'replaceElement',
                    params: { source: 'registry-adoption' },
                } : undefined,
                semanticHint: hasPropMapping
                    ? undefined
                    : (violation.recovery ?? `Replace rogue intrinsic element with a design system component. ${violation.message}`),
            }
        }
        // REG-001: Unregistered component — always semantic
        return {
            violation,
            classification: 'semantic',
            confidence: 0.6,
            semanticHint: violation.recovery
                ?? `Replace rogue intrinsic element with a design system component. ${violation.message}`,
        }
    }

    // ── Fluid suggestion violations (P6) — always semantic (advisory) ───────
    if (violation.type === 'fluid-suggestion') {
        return {
            violation,
            classification: 'semantic',
            confidence: 0.5,
            semanticHint:
                violation.recovery ??
                'Fluid scaling is a progressive enhancement; the designer may deliberately want hard breakpoints. Review intent before applying.',
        }
    }

    // ── Motion drift violations (P5) ─────────────────────────────────────────
    if (violation.type === 'motion-drift') {
        // When a matching motion token was found, this is a deterministic
        // token swap. Otherwise it's semantic (no valid token to swap in).
        if (
            violation.nearestToken !== null &&
            violation.nearestToken !== undefined &&
            violation.fixable === true
        ) {
            return {
                violation,
                classification: 'deterministic',
                confidence: 0.85,
                proposedFix: {
                    type: 'swapMotionToken',
                    params: {
                        targetToken: violation.nearestToken,
                        targetValue: violation.nearestTokenValue ?? undefined,
                        originalValue: violation.message,
                    },
                },
            }
        }
        return {
            violation,
            classification: 'semantic',
            confidence: 0.6,
            semanticHint:
                violation.recovery ??
                `Motion drift: ${violation.message}. Define or assign a motion token.`,
        }
    }

    // ── Dark-mode drift violations — mirrors motion-drift pattern ────────────
    if (violation.type === 'dark-mode-drift') {
        // Deterministic when a nearest token is known and auto-fix is possible.
        // Advisory/visual concern (not a WCAG violation) — see R3 decision.
        if (
            violation.nearestToken !== null &&
            violation.nearestToken !== undefined &&
            violation.fixable === true
        ) {
            return {
                violation,
                classification: 'deterministic',
                confidence: computeDriftConfidence(violation),
                proposedFix: {
                    type: 'swapMotionToken',
                    params: {
                        targetToken: violation.nearestToken,
                        targetValue: violation.nearestTokenValue ?? undefined,
                        originalValue: violation.message,
                    },
                },
            }
        }
        return {
            violation,
            classification: 'semantic',
            confidence: 0.5,
            semanticHint:
                violation.recovery ??
                `Dark-mode drift: ${violation.message}. Assign or create a dark-mode companion token.`,
        }
    }

    // ── Visual regression violations — always riskGated (structural territory) ─
    if (violation.type === 'visual-regression') {
        return {
            violation,
            classification: 'deterministic', // deterministic classification but always riskGated
            confidence: 0.6,
            proposedFix: {
                type: 'replaceElement',
                params: { source: 'visual-regression' },
            },
            semanticHint:
                violation.recovery ??
                'Visual regression detected. A human must review the before/after diff before applying any automated fix.',
        }
    }

    // ── Hydration violations (P4) — always semantic ─────────────────────────
    if (violation.type === 'hydration') {
        return {
            violation,
            classification: 'semantic',
            confidence: 0.75,
            semanticHint: violation.recovery
                ?? 'This text appears to be dynamic data. Extract it as a component prop like `userName` or `price`.',
        }
    }

    // ── Composition violations (P2.5) — always semantic ─────────────────────
    if (violation.type === 'composition') {
        return {
            violation,
            classification: 'semantic',
            confidence: 0.8,
            semanticHint: violation.recovery
                ?? `Composition violation: ${violation.message}. Restructure the component tree to fix this.`,
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
 * Compute a confidence score for a drift fix based on the delta value and
 * violation type.  Different drift categories use different delta scales:
 *
 *   color-drift / inline-style-drift:
 *     Uses CIEDE2000 ΔE buckets (2/5/10/20) — perceptual distance is well-defined.
 *
 *   typography-drift / spacing-drift:
 *     Uses px-distance buckets (≤1=0.95, ≤3=0.88, ≤8=0.78, else 0.6).
 *     Conservative ladder — typography and spacing deltas are not CIEDE2000-
 *     comparable, so we default to tighter thresholds. Expand in a follow-up
 *     sprint once empirical drift distributions are available.
 *
 *   dark-mode-drift:
 *     0.85 when nearestToken is present (caller guarantees it for deterministic
 *     path), 0.5 otherwise (unreachable from this function, but safe to handle).
 *
 *   shadow-drift / opacity-drift:
 *     Ordinal distance — use flat 0.6 (no meaningful continuous scale).
 *
 *   All other types:
 *     Fall back to the color ΔE ladder for forward-compat.
 */
function computeDriftConfidence(violation: LinterWarning): number {
    const delta = violation.value

    switch (violation.type) {
        case 'color-drift':
        case 'inline-style-drift':
            // CIEDE2000 ΔE ladder
            if (delta <= 2) return 0.98
            if (delta <= 5) return 0.92
            if (delta <= 10) return 0.85
            if (delta <= 20) return 0.75
            return 0.6

        case 'typography-drift':
        case 'spacing-drift':
            // px-distance ladder (conservative — not CIEDE2000-comparable)
            if (delta <= 1) return 0.95
            if (delta <= 3) return 0.88
            if (delta <= 8) return 0.78
            return 0.6

        case 'dark-mode-drift':
            // Deterministic path always has nearestToken; treat as close match
            return violation.nearestToken ? 0.85 : 0.5

        case 'shadow-drift':
        case 'opacity-drift':
            // Ordinal distance — no continuous delta scale
            return 0.6

        default:
            // Forward-compat: use color ΔE ladder for any future drift types
            if (delta <= 2) return 0.98
            if (delta <= 5) return 0.92
            if (delta <= 10) return 0.85
            if (delta <= 20) return 0.75
            return 0.6
    }
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
