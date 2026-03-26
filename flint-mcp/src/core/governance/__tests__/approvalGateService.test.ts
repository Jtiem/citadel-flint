/**
 * Unit tests for approvalGateService (UCFG.5)
 *
 * Coverage:
 *   evaluateCondition — gt, gte, lt, lte, eq, ne (6 operator tests)
 *   evaluateCondition — empty operator returns false
 *   evaluateApprovalGates — returns first matching gate
 *   evaluateApprovalGates — returns no_gate when no match
 *   evaluateApprovalGates — handles undefined gates
 *   evaluateApprovalGates — multi-condition gate (all must match)
 */

import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateApprovalGates } from '../approvalGateService.js'
import type { ApprovalGate } from '../../config.js'

// ── evaluateCondition ─────────────────────────────────────────────────────────

describe('evaluateCondition — operator: gt', () => {
    it('returns true when value > threshold', () => {
        expect(evaluateCondition({ gt: 50 }, 51)).toBe(true)
    })

    it('returns false when value === threshold', () => {
        expect(evaluateCondition({ gt: 50 }, 50)).toBe(false)
    })

    it('returns false when value < threshold', () => {
        expect(evaluateCondition({ gt: 50 }, 49)).toBe(false)
    })
})

describe('evaluateCondition — operator: gte', () => {
    it('returns true when value > threshold', () => {
        expect(evaluateCondition({ gte: 50 }, 51)).toBe(true)
    })

    it('returns true when value === threshold', () => {
        expect(evaluateCondition({ gte: 50 }, 50)).toBe(true)
    })

    it('returns false when value < threshold', () => {
        expect(evaluateCondition({ gte: 50 }, 49)).toBe(false)
    })
})

describe('evaluateCondition — operator: lt', () => {
    it('returns true when value < threshold', () => {
        expect(evaluateCondition({ lt: 50 }, 49)).toBe(true)
    })

    it('returns false when value === threshold', () => {
        expect(evaluateCondition({ lt: 50 }, 50)).toBe(false)
    })

    it('returns false when value > threshold', () => {
        expect(evaluateCondition({ lt: 50 }, 51)).toBe(false)
    })
})

describe('evaluateCondition — operator: lte', () => {
    it('returns true when value < threshold', () => {
        expect(evaluateCondition({ lte: 50 }, 49)).toBe(true)
    })

    it('returns true when value === threshold', () => {
        expect(evaluateCondition({ lte: 50 }, 50)).toBe(true)
    })

    it('returns false when value > threshold', () => {
        expect(evaluateCondition({ lte: 50 }, 51)).toBe(false)
    })
})

describe('evaluateCondition — operator: eq', () => {
    it('returns true when value === threshold', () => {
        expect(evaluateCondition({ eq: 42 }, 42)).toBe(true)
    })

    it('returns false when value !== threshold', () => {
        expect(evaluateCondition({ eq: 42 }, 43)).toBe(false)
    })
})

describe('evaluateCondition — operator: ne', () => {
    it('returns true when value !== threshold', () => {
        expect(evaluateCondition({ ne: 42 }, 43)).toBe(true)
    })

    it('returns false when value === threshold', () => {
        expect(evaluateCondition({ ne: 42 }, 42)).toBe(false)
    })
})

describe('evaluateCondition — empty operator', () => {
    it('returns false when operator object has no keys', () => {
        expect(evaluateCondition({}, 50)).toBe(false)
    })
})

describe('evaluateCondition — compound operator', () => {
    it('returns true when both gt and lt are satisfied (range check)', () => {
        // value 55 is between 40 and 60
        expect(evaluateCondition({ gt: 40, lt: 60 }, 55)).toBe(true)
    })

    it('returns false when only one of two conditions is satisfied', () => {
        // value 65 satisfies gt:40 but not lt:60
        expect(evaluateCondition({ gt: 40, lt: 60 }, 65)).toBe(false)
    })
})

// ── evaluateApprovalGates ─────────────────────────────────────────────────────

describe('evaluateApprovalGates — no_gate when gates undefined', () => {
    it('returns no_gate for undefined gates', () => {
        const result = evaluateApprovalGates(undefined, { riskScore: 90 })
        expect(result.action).toBe('no_gate')
    })

    it('returns no_gate for empty gates array', () => {
        const result = evaluateApprovalGates([], { riskScore: 90 })
        expect(result.action).toBe('no_gate')
    })
})

describe('evaluateApprovalGates — first matching gate wins', () => {
    const gates: ApprovalGate[] = [
        {
            condition: { riskScore: { gte: 80 } },
            action: 'escalate',
            message: 'High risk',
        },
        {
            condition: { riskScore: { gte: 50 } },
            action: 'require_approval',
            message: 'Medium risk',
        },
    ]

    it('returns the first gate when riskScore matches first gate', () => {
        const result = evaluateApprovalGates(gates, { riskScore: 90 })
        expect(result.action).toBe('escalate')
        expect(result.message).toBe('High risk')
        expect(result.matchedGate).toBe(gates[0])
    })

    it('returns second gate when riskScore only matches second gate', () => {
        const result = evaluateApprovalGates(gates, { riskScore: 65 })
        expect(result.action).toBe('require_approval')
        expect(result.message).toBe('Medium risk')
        expect(result.matchedGate).toBe(gates[1])
    })

    it('returns no_gate when riskScore is below all gates', () => {
        const result = evaluateApprovalGates(gates, { riskScore: 10 })
        expect(result.action).toBe('no_gate')
    })
})

describe('evaluateApprovalGates — auto_approve action', () => {
    it('returns auto_approve when gate matches', () => {
        const gates: ApprovalGate[] = [
            { condition: { riskScore: { lt: 20 } }, action: 'auto_approve' },
        ]
        const result = evaluateApprovalGates(gates, { riskScore: 5 })
        expect(result.action).toBe('auto_approve')
    })
})

describe('evaluateApprovalGates — multi-condition gate (AND semantics)', () => {
    const gates: ApprovalGate[] = [
        {
            condition: {
                riskScore: { gte: 70 },
                violationCount: { gt: 5 },
            },
            action: 'require_approval',
            message: 'Both thresholds exceeded',
        },
    ]

    it('matches only when ALL conditions are satisfied', () => {
        const result = evaluateApprovalGates(gates, { riskScore: 80, violationCount: 10 })
        expect(result.action).toBe('require_approval')
    })

    it('does not match when riskScore condition fails', () => {
        const result = evaluateApprovalGates(gates, { riskScore: 50, violationCount: 10 })
        expect(result.action).toBe('no_gate')
    })

    it('does not match when violationCount condition fails', () => {
        const result = evaluateApprovalGates(gates, { riskScore: 80, violationCount: 3 })
        expect(result.action).toBe('no_gate')
    })

    it('missing context key defaults to 0', () => {
        // violationCount missing from context → defaults to 0, fails gt:5
        const result = evaluateApprovalGates(gates, { riskScore: 80 })
        expect(result.action).toBe('no_gate')
    })
})

describe('evaluateApprovalGates — matchedGate included in decision', () => {
    it('decision includes reference to the matched gate object', () => {
        const gate: ApprovalGate = {
            condition: { score: { gt: 0 } },
            action: 'require_approval',
            message: 'any score above zero',
        }
        const result = evaluateApprovalGates([gate], { score: 1 })
        expect(result.matchedGate).toBe(gate)
    })

    it('no_gate decision does not include matchedGate', () => {
        const result = evaluateApprovalGates(
            [{ condition: { score: { gt: 100 } }, action: 'escalate' }],
            { score: 50 }
        )
        expect(result.matchedGate).toBeUndefined()
    })
})

// ── UCFG.7a integration-context tests ─────────────────────────────────────────
// These cover the context keys used by the flint_ast_mutate approval gate wiring.

describe('evaluateApprovalGates — risk_score context (UCFG.7a)', () => {
    it('returns require_approval when risk_score exceeds threshold', () => {
        const gates: ApprovalGate[] = [
            {
                condition: { risk_score: { gt: 50 } },
                action: 'require_approval',
                message: 'Risk score too high',
            },
        ]
        const result = evaluateApprovalGates(gates, { risk_score: 60, mutation_count: 6 })
        expect(result.action).toBe('require_approval')
        expect(result.message).toBe('Risk score too high')
    })

    it('returns auto_approve when risk_score is below threshold', () => {
        const gates: ApprovalGate[] = [
            {
                condition: { risk_score: { gt: 50 } },
                action: 'require_approval',
                message: 'Risk score too high',
            },
        ]
        const result = evaluateApprovalGates(gates, { risk_score: 30, mutation_count: 3 })
        expect(result.action).toBe('no_gate')
    })
})

describe('evaluateApprovalGates — mutation_count context (UCFG.7a)', () => {
    it('returns require_approval when mutation_count exceeds threshold', () => {
        const gates: ApprovalGate[] = [
            {
                condition: { mutation_count: { gte: 5 } },
                action: 'require_approval',
                message: 'Too many mutations in one batch',
            },
        ]

        const result = evaluateApprovalGates(gates, { risk_score: 40, mutation_count: 5 })
        expect(result.action).toBe('require_approval')
        expect(result.message).toBe('Too many mutations in one batch')
    })

    it('returns no_gate when mutation_count is below threshold', () => {
        const gates: ApprovalGate[] = [
            {
                condition: { mutation_count: { gte: 5 } },
                action: 'require_approval',
                message: 'Too many mutations in one batch',
            },
        ]
        const result = evaluateApprovalGates(gates, { risk_score: 40, mutation_count: 3 })
        expect(result.action).toBe('no_gate')
    })

    it('returns require_approval when both risk_score and mutation_count exceed compound gate', () => {
        const gates: ApprovalGate[] = [
            {
                condition: {
                    risk_score: { gt: 50 },
                    mutation_count: { gte: 5 },
                },
                action: 'require_approval',
                message: 'High risk batch',
            },
        ]
        const result = evaluateApprovalGates(gates, { risk_score: 70, mutation_count: 7 })
        expect(result.action).toBe('require_approval')
    })
})
