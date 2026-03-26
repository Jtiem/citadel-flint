/**
 * Unit tests for scoringWeightsService (UCFG.5)
 *
 * Coverage:
 *   resolveWeights — returns defaults when no config
 *   resolveWeights — merges partial custom weights
 *   resolveWeights — uses domain preset when available
 *   resolveWeights — custom weights override domain preset
 *   computeWeightedScore — empty violations returns 0
 *   computeWeightedScore — weights violations correctly by mode
 *   computeWeightedScore — applies recency weighting
 */

import { describe, it, expect } from 'vitest'
import { resolveWeights, computeWeightedScore } from '../scoringWeightsService.js'

// ── resolveWeights ─────────────────────────────────────────────────────────────

describe('resolveWeights — default weights', () => {
    it('returns default weights when no scoring config is provided', () => {
        const w = resolveWeights(undefined, undefined)
        expect(w.coercive).toBe(0.8)
        expect(w.normative).toBe(0.6)
        expect(w.advisory).toBe(0.3)
        expect(w.recency).toBe(0.4)
    })

    it('returns default weights when scoring config is empty', () => {
        const w = resolveWeights({})
        expect(w.coercive).toBe(0.8)
        expect(w.normative).toBe(0.6)
        expect(w.advisory).toBe(0.3)
        expect(w.recency).toBe(0.4)
    })
})

describe('resolveWeights — partial custom weights', () => {
    it('overrides only the keys that are defined', () => {
        const w = resolveWeights({ weights: { coercive: 0.99 } })
        expect(w.coercive).toBe(0.99)
        // Other keys stay at default
        expect(w.normative).toBe(0.6)
        expect(w.advisory).toBe(0.3)
        expect(w.recency).toBe(0.4)
    })

    it('handles all four keys being overridden', () => {
        const w = resolveWeights({
            weights: { coercive: 1.0, normative: 0.9, advisory: 0.5, recency: 0.7 },
        })
        expect(w.coercive).toBe(1.0)
        expect(w.normative).toBe(0.9)
        expect(w.advisory).toBe(0.5)
        expect(w.recency).toBe(0.7)
    })
})

describe('resolveWeights — domain presets', () => {
    it('returns healthcare preset when domain is healthcare', () => {
        const w = resolveWeights(undefined, 'healthcare')
        expect(w.coercive).toBe(0.95)
        expect(w.normative).toBe(0.8)
        expect(w.advisory).toBe(0.5)
        expect(w.recency).toBe(0.7)
    })

    it('returns fintech preset when domain is fintech', () => {
        const w = resolveWeights(undefined, 'fintech')
        expect(w.coercive).toBe(0.9)
        expect(w.normative).toBe(0.7)
        expect(w.advisory).toBe(0.4)
        expect(w.recency).toBe(0.6)
    })

    it('returns government preset when domain is government', () => {
        const w = resolveWeights(undefined, 'government')
        expect(w.coercive).toBe(0.95)
        expect(w.normative).toBe(0.85)
        expect(w.advisory).toBe(0.6)
        expect(w.recency).toBe(0.8)
    })

    it('falls back to defaults for unknown domain', () => {
        const w = resolveWeights(undefined, 'e-commerce')
        // e-commerce has no preset, should fall back to defaults
        expect(w.coercive).toBe(0.8)
        expect(w.normative).toBe(0.6)
        expect(w.advisory).toBe(0.3)
        expect(w.recency).toBe(0.4)
    })
})

describe('resolveWeights — custom weights override domain preset', () => {
    it('custom coercive weight beats the healthcare preset', () => {
        const w = resolveWeights({ weights: { coercive: 1.0 } }, 'healthcare')
        // healthcare preset has coercive=0.95, custom overrides to 1.0
        expect(w.coercive).toBe(1.0)
        // Other keys still from preset
        expect(w.normative).toBe(0.8)
        expect(w.advisory).toBe(0.5)
        expect(w.recency).toBe(0.7)
    })
})

// ── computeWeightedScore ───────────────────────────────────────────────────────

describe('computeWeightedScore — empty input', () => {
    it('returns raw=0, weighted=0 for empty violations array', () => {
        const result = computeWeightedScore([])
        expect(result.raw).toBe(0)
        expect(result.weighted).toBe(0)
    })

    it('includes weights in result even for empty input', () => {
        const result = computeWeightedScore([])
        expect(result.weights.coercive).toBe(0.8)
        expect(result.weights.normative).toBe(0.6)
        expect(result.weights.advisory).toBe(0.3)
        expect(result.weights.recency).toBe(0.4)
    })
})

describe('computeWeightedScore — mode-based weighting', () => {
    it('coercive violation contributes base weight 0.8 (no recency)', () => {
        const result = computeWeightedScore([{ mode: 'coercive' }])
        expect(result.raw).toBe(1)
        // base=0.8, recency modifier=1 (no recency field)
        expect(result.weighted).toBeCloseTo(0.8)
    })

    it('normative violation contributes base weight 0.6 (no recency)', () => {
        const result = computeWeightedScore([{ mode: 'normative' }])
        expect(result.weighted).toBeCloseTo(0.6)
    })

    it('advisory violation contributes base weight 0.3 (no recency)', () => {
        const result = computeWeightedScore([{ mode: 'advisory' }])
        expect(result.weighted).toBeCloseTo(0.3)
    })

    it('blocking mode (legacy) maps to coercive weight', () => {
        const result = computeWeightedScore([{ mode: 'blocking' }])
        expect(result.weighted).toBeCloseTo(0.8)
    })

    it('unknown mode defaults to advisory weight', () => {
        const result = computeWeightedScore([{ mode: 'unknown-mode' }])
        expect(result.weighted).toBeCloseTo(0.3)
    })

    it('raw is always the violation count regardless of mode', () => {
        const result = computeWeightedScore([
            { mode: 'coercive' },
            { mode: 'advisory' },
            { mode: 'normative' },
        ])
        expect(result.raw).toBe(3)
    })

    it('sums contributions correctly for mixed modes', () => {
        const result = computeWeightedScore([
            { mode: 'coercive' }, // 0.8
            { mode: 'normative' }, // 0.6
            { mode: 'advisory' }, // 0.3
        ])
        // 0.8 + 0.6 + 0.3 = 1.7
        expect(result.weighted).toBeCloseTo(1.7)
    })
})

describe('computeWeightedScore — recency weighting', () => {
    it('recency=1 (most recent) inflates score by recency weight', () => {
        // base=0.8, modifier = 1 + 1.0 * 0.4 = 1.4, contribution = 0.8 * 1.4 = 1.12
        const result = computeWeightedScore([{ mode: 'coercive', recency: 1 }])
        expect(result.weighted).toBeCloseTo(1.12)
    })

    it('recency=0 (oldest) gives no recency bonus (modifier = 1)', () => {
        const result = computeWeightedScore([{ mode: 'coercive', recency: 0 }])
        expect(result.weighted).toBeCloseTo(0.8)
    })

    it('recency=0.5 gives half the recency bonus', () => {
        // modifier = 1 + 0.5 * 0.4 = 1.2, contribution = 0.8 * 1.2 = 0.96
        const result = computeWeightedScore([{ mode: 'coercive', recency: 0.5 }])
        expect(result.weighted).toBeCloseTo(0.96)
    })

    it('violations without recency field use neutral modifier of 1', () => {
        const withRecency = computeWeightedScore([{ mode: 'advisory', recency: 0 }])
        const withoutRecency = computeWeightedScore([{ mode: 'advisory' }])
        expect(withRecency.weighted).toBeCloseTo(withoutRecency.weighted)
    })
})

describe('computeWeightedScore — custom weights applied', () => {
    it('uses custom coercive weight when scoring config is provided', () => {
        const result = computeWeightedScore(
            [{ mode: 'coercive' }],
            { weights: { coercive: 1.0 } }
        )
        expect(result.weighted).toBeCloseTo(1.0)
        expect(result.weights.coercive).toBe(1.0)
    })

    it('domain preset affects final score', () => {
        const defaultResult = computeWeightedScore([{ mode: 'coercive' }])
        const healthcareResult = computeWeightedScore(
            [{ mode: 'coercive' }],
            undefined,
            'healthcare'
        )
        // healthcare coercive=0.95 vs default 0.8
        expect(healthcareResult.weighted).toBeGreaterThan(defaultResult.weighted)
    })
})
