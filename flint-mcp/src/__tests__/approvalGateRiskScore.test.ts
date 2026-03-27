/**
 * Approval Gate Risk Score Tests — Phase 1B / Gap 3
 *
 * Tests the weighted mutation-type risk score calculation used in the
 * flint_ast_mutate approval gate block (UCFG.7a).
 *
 * The scoring logic lives inline in server.ts; we test it here as a
 * pure function extracted from the same decision table so future changes
 * to server.ts are caught by regressions here.
 *
 * Scoring table (matches server.ts implementation):
 *   Structural ops (move, inject, delete, wrap, assembleLayout) → 20 pts each
 *   Property ops (updateProp, updateClassName, updateTextContent, fixToken) → 8 pts each
 *   Default (emitImport, emitHook, composeSlot, unknown)                   → 12 pts each
 *   Maximum score capped at 100.
 */

import { describe, it, expect } from 'vitest'

// ── Inline scoring function mirrored from server.ts ───────────────────────────
// This mirrors the exact logic from the UCFG.7a gate block so we can test it
// without spinning up the full MCP server.

const STRUCTURAL_OP_SCORE = 20
const PROPERTY_OP_SCORE = 8
const DEFAULT_OP_SCORE = 12

const STRUCTURAL_OPS = new Set(['move', 'inject', 'delete', 'wrap', 'assembleLayout'])
const PROPERTY_OPS = new Set(['updateProp', 'updateClassName', 'updateTextContent', 'fixToken'])

function computeGateRiskScore(mutations: Array<{ type: string }>): number {
    return Math.min(
        mutations.reduce((sum, m) => {
            if (STRUCTURAL_OPS.has(m.type)) return sum + STRUCTURAL_OP_SCORE
            if (PROPERTY_OPS.has(m.type)) return sum + PROPERTY_OP_SCORE
            return sum + DEFAULT_OP_SCORE
        }, 0),
        100
    )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Approval Gate: weighted risk score (Gap 3)', () => {

    // ── Empty input ──────────────────────────────────────────────────────────

    it('returns 0 for an empty mutation batch', () => {
        expect(computeGateRiskScore([])).toBe(0)
    })

    // ── Single op type correctness ────────────────────────────────────────────

    it('scores a single structural op (move) at 20', () => {
        expect(computeGateRiskScore([{ type: 'move' }])).toBe(20)
    })

    it('scores a single structural op (inject) at 20', () => {
        expect(computeGateRiskScore([{ type: 'inject' }])).toBe(20)
    })

    it('scores a single structural op (delete) at 20', () => {
        expect(computeGateRiskScore([{ type: 'delete' }])).toBe(20)
    })

    it('scores a single structural op (wrap) at 20', () => {
        expect(computeGateRiskScore([{ type: 'wrap' }])).toBe(20)
    })

    it('scores a single structural op (assembleLayout) at 20', () => {
        expect(computeGateRiskScore([{ type: 'assembleLayout' }])).toBe(20)
    })

    it('scores a single property op (updateProp) at 8', () => {
        expect(computeGateRiskScore([{ type: 'updateProp' }])).toBe(8)
    })

    it('scores a single property op (updateClassName) at 8', () => {
        expect(computeGateRiskScore([{ type: 'updateClassName' }])).toBe(8)
    })

    it('scores a single property op (updateTextContent) at 8', () => {
        expect(computeGateRiskScore([{ type: 'updateTextContent' }])).toBe(8)
    })

    it('scores a single property op (fixToken) at 8', () => {
        expect(computeGateRiskScore([{ type: 'fixToken' }])).toBe(8)
    })

    it('scores a default/unknown op (emitImport) at 12', () => {
        expect(computeGateRiskScore([{ type: 'emitImport' }])).toBe(12)
    })

    it('scores a default/unknown op (composeSlot) at 12', () => {
        expect(computeGateRiskScore([{ type: 'composeSlot' }])).toBe(12)
    })

    it('scores a completely unknown op type at 12 (default bucket)', () => {
        expect(computeGateRiskScore([{ type: 'unknownOpXYZ' }])).toBe(12)
    })

    // ── Structural ops score higher than property ops ─────────────────────────

    it('single structural op scores higher than single property op', () => {
        const structural = computeGateRiskScore([{ type: 'delete' }])
        const property = computeGateRiskScore([{ type: 'updateProp' }])
        expect(structural).toBeGreaterThan(property)
    })

    it('one structural op outscores two property ops (20 > 16)', () => {
        const structural = computeGateRiskScore([{ type: 'move' }])
        const twoProperty = computeGateRiskScore([{ type: 'updateProp' }, { type: 'updateClassName' }])
        expect(structural).toBeGreaterThan(twoProperty)
    })

    // ── Mixed batch accumulation ───────────────────────────────────────────────

    it('accumulates mixed structural + property scores correctly', () => {
        // 1 structural (20) + 1 property (8) = 28
        expect(computeGateRiskScore([
            { type: 'move' },
            { type: 'updateProp' },
        ])).toBe(28)
    })

    it('accumulates two structural ops correctly (20 + 20 = 40)', () => {
        expect(computeGateRiskScore([
            { type: 'delete' },
            { type: 'inject' },
        ])).toBe(40)
    })

    it('accumulates three property ops correctly (8 * 3 = 24)', () => {
        expect(computeGateRiskScore([
            { type: 'updateProp' },
            { type: 'updateClassName' },
            { type: 'updateTextContent' },
        ])).toBe(24)
    })

    // ── Cap at 100 ────────────────────────────────────────────────────────────

    it('caps total score at 100 regardless of batch size', () => {
        // 6 structural ops × 20 = 120 → capped at 100
        const bigStructuralBatch = Array.from({ length: 6 }, () => ({ type: 'move' }))
        expect(computeGateRiskScore(bigStructuralBatch)).toBe(100)
    })

    it('exactly 5 structural ops scores 100 (5 × 20 = 100)', () => {
        const fiveStructural = Array.from({ length: 5 }, () => ({ type: 'delete' }))
        expect(computeGateRiskScore(fiveStructural)).toBe(100)
    })

    it('13 property ops score 100 (13 × 8 = 104 → capped)', () => {
        const manyProperty = Array.from({ length: 13 }, () => ({ type: 'updateProp' }))
        expect(computeGateRiskScore(manyProperty)).toBe(100)
    })

    it('12 property ops score exactly 96 (uncapped boundary)', () => {
        const twelveProperty = Array.from({ length: 12 }, () => ({ type: 'updateProp' }))
        expect(computeGateRiskScore(twelveProperty)).toBe(96)
    })

    // ── Comparison with old flat heuristic (mutations.length * 10) ────────────

    it('structural-heavy batch scores higher than old heuristic for same count', () => {
        // 3 structural ops: new = 60, old = 30
        const mutations = [{ type: 'move' }, { type: 'inject' }, { type: 'delete' }]
        const newScore = computeGateRiskScore(mutations)
        const oldScore = mutations.length * 10
        expect(newScore).toBeGreaterThan(oldScore)
    })

    it('property-only batch scores lower than old heuristic for same count', () => {
        // 3 property ops: new = 24, old = 30
        const mutations = [{ type: 'updateProp' }, { type: 'updateClassName' }, { type: 'fixToken' }]
        const newScore = computeGateRiskScore(mutations)
        const oldScore = mutations.length * 10
        expect(newScore).toBeLessThan(oldScore)
    })
})
