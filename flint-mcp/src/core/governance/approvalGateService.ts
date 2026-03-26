/**
 * ApprovalGateService — flint-mcp/src/core/governance/approvalGateService.ts
 *
 * Pure-function service that evaluates conditional approval gates defined in
 * the `trust.approval` section of flint.config.yaml (FlintProjectConfig).
 *
 * Gates are evaluated in order; the first fully-matching gate wins.
 * All conditions in a gate's `condition` map must satisfy their operator for
 * the gate to match (logical AND across conditions).
 *
 * Phase: UCFG.5 — Conditional Approval Gates + Scoring Weights + Data Classification
 */

import type { ApprovalGate, ConditionOperator } from '../config.js'

// ── Public types ─────────────────────────────────────────────────────────────

export interface ApprovalDecision {
    action: 'require_approval' | 'auto_approve' | 'escalate' | 'no_gate'
    message?: string
    matchedGate?: ApprovalGate
}

// ── evaluateCondition ─────────────────────────────────────────────────────────

/**
 * Evaluates a single ConditionOperator against a numeric value.
 *
 * Supports: gt, gte, lt, lte, eq, ne.
 * Returns false when the operator object is empty or has no recognised keys.
 */
export function evaluateCondition(operator: ConditionOperator, value: number): boolean {
    let matched = false

    if (operator.gt !== undefined) {
        if (!(value > operator.gt)) return false
        matched = true
    }
    if (operator.gte !== undefined) {
        if (!(value >= operator.gte)) return false
        matched = true
    }
    if (operator.lt !== undefined) {
        if (!(value < operator.lt)) return false
        matched = true
    }
    if (operator.lte !== undefined) {
        if (!(value <= operator.lte)) return false
        matched = true
    }
    if (operator.eq !== undefined) {
        if (!(value === operator.eq)) return false
        matched = true
    }
    if (operator.ne !== undefined) {
        if (!(value !== operator.ne)) return false
        matched = true
    }

    // No recognised operator keys — treat as no-match
    return matched
}

// ── evaluateApprovalGates ─────────────────────────────────────────────────────

/**
 * Evaluates a list of approval gates against a mutation context map.
 *
 * - Gates are evaluated in declaration order (first match wins).
 * - A gate matches when ALL of its condition entries are satisfied.
 * - Context keys not present in the gate's condition map are ignored.
 * - Missing context keys referenced in a gate condition default to 0.
 *
 * Returns `{ action: 'no_gate' }` when:
 *   - `gates` is undefined or empty
 *   - No gate's conditions are satisfied
 */
export function evaluateApprovalGates(
    gates: ApprovalGate[] | undefined,
    context: Record<string, number>
): ApprovalDecision {
    if (!gates || gates.length === 0) {
        return { action: 'no_gate' }
    }

    for (const gate of gates) {
        const entries = Object.entries(gate.condition)

        // Empty condition block — skip (no conditions = no meaningful match)
        if (entries.length === 0) continue

        const allMatch = entries.every(([key, operator]) => {
            const contextValue = context[key] ?? 0
            return evaluateCondition(operator, contextValue)
        })

        if (allMatch) {
            return {
                action: gate.action,
                message: gate.message,
                matchedGate: gate,
            }
        }
    }

    return { action: 'no_gate' }
}
