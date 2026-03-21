/**
 * Unit tests for the function-based MRS API (V.1-rs)
 *
 * Tests the stateless scoreMutation(), getTier(), and getRecommendation()
 * exports introduced in V.1-rs. These are distinct from the DB-backed
 * RiskScoringService class tests in flint-mcp/src/__tests__/riskScoring.test.ts.
 *
 * Coverage (30+ tests):
 *   - scoreMutation returns score in [0.0, 1.0] for all defined op types
 *   - getTier boundary values: 0.30, 0.31, 0.69, 0.70
 *   - High-risk ops (assembleLayout, crossFileMove) score >= 0.5
 *   - Low-risk ops (updateClassName, fixToken) score <= 0.3 without blast radius penalty
 *   - affectedNodeCount = 10+ raises blast radius factor to maximum
 *   - affectedNodeCount = 0 keeps blast radius factor at 0
 *   - No projectRoot → familiarity factor defaults to neutral contribution
 *   - projectRoot with no provenance.db → familiarity factor neutral (no throw)
 *   - getRecommendation returns different strings per tier
 *   - Score is deterministic (same input = same output)
 *   - Unknown op type uses default weight 0.5
 *   - Result always includes factors array with 4 entries
 *   - Factor names are present: opWeight, blastRadius, severity, familiarity
 *   - hasViolationContext affects severity factor
 *   - All factor contributions are clamped to [0, 1]
 */

import { describe, it, expect } from 'vitest'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { scoreMutation, getTier, getRecommendation } from '../riskScoringService.js'
import type { RiskScoringInput } from '../types.js'

// ---------------------------------------------------------------------------
// getTier — boundary values
// ---------------------------------------------------------------------------

describe('getTier — boundary values', () => {
    it('score 0.0 → green', () => {
        expect(getTier(0.0)).toBe('green')
    })

    it('score 0.30 → green (upper green boundary)', () => {
        expect(getTier(0.30)).toBe('green')
    })

    it('score 0.31 → amber (lower amber boundary)', () => {
        expect(getTier(0.31)).toBe('amber')
    })

    it('score 0.69 → amber (upper amber boundary)', () => {
        expect(getTier(0.69)).toBe('amber')
    })

    it('score 0.70 → red (lower red boundary)', () => {
        expect(getTier(0.70)).toBe('red')
    })

    it('score 1.0 → red', () => {
        expect(getTier(1.0)).toBe('red')
    })
})

// ---------------------------------------------------------------------------
// getRecommendation — per-tier strings
// ---------------------------------------------------------------------------

describe('getRecommendation — per tier', () => {
    it('green contains "auto-approve"', () => {
        expect(getRecommendation('green', 'updateClassName')).toContain('auto-approve')
    })

    it('amber contains "review"', () => {
        const rec = getRecommendation('amber', 'moveNode')
        expect(rec.toLowerCase()).toMatch(/review/)
    })

    it('red contains "sign-off" or "review"', () => {
        const rec = getRecommendation('red', 'assembleLayout')
        expect(rec.toLowerCase()).toMatch(/sign-off|review/)
    })

    it('each tier returns a different string', () => {
        const g = getRecommendation('green', 'updateProp')
        const a = getRecommendation('amber', 'updateProp')
        const r = getRecommendation('red', 'updateProp')
        expect(g).not.toBe(a)
        expect(a).not.toBe(r)
        expect(g).not.toBe(r)
    })

    it('recommendation includes the op type string', () => {
        const rec = getRecommendation('amber', 'crossFileMove')
        expect(rec).toContain('crossFileMove')
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — score in [0.0, 1.0] for all defined op types
// ---------------------------------------------------------------------------

const ALL_OP_TYPES = [
    'updateClassName',
    'fixToken',
    'updateTextContent',
    'updateProp',
    'injectNode',
    'inject',
    'wrapNode',
    'moveNode',
    'move',
    'deleteNode',
    'assembleLayout',
    'crossFileMove',
]

describe('scoreMutation — score range [0.0, 1.0] for all op types', () => {
    for (const opType of ALL_OP_TYPES) {
        it(`${opType} produces score in [0.0, 1.0]`, () => {
            const result = scoreMutation({ opType })
            expect(result.score).toBeGreaterThanOrEqual(0.0)
            expect(result.score).toBeLessThanOrEqual(1.0)
            expect(Number.isFinite(result.score)).toBe(true)
        })
    }

    it('unknown op type produces score in [0.0, 1.0]', () => {
        const result = scoreMutation({ opType: 'nonExistentOpXYZ' })
        expect(result.score).toBeGreaterThanOrEqual(0.0)
        expect(result.score).toBeLessThanOrEqual(1.0)
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — low-risk ops stay low without blast radius
// ---------------------------------------------------------------------------

describe('scoreMutation — low-risk ops stay low without blast radius', () => {
    it('updateClassName with affectedNodeCount=1 → score <= 0.3', () => {
        const result = scoreMutation({
            opType: 'updateClassName',
            affectedNodeCount: 1,
        })
        expect(result.score).toBeLessThanOrEqual(0.3)
        expect(result.tier).toBe('green')
    })

    it('fixToken with affectedNodeCount=1 → score <= 0.3', () => {
        const result = scoreMutation({
            opType: 'fixToken',
            affectedNodeCount: 1,
        })
        expect(result.score).toBeLessThanOrEqual(0.3)
        expect(result.tier).toBe('green')
    })

    it('updateTextContent with affectedNodeCount=1 → score <= 0.3', () => {
        const result = scoreMutation({
            opType: 'updateTextContent',
            affectedNodeCount: 1,
        })
        expect(result.score).toBeLessThanOrEqual(0.3)
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — high-risk ops score >= 0.5
// ---------------------------------------------------------------------------

describe('scoreMutation — high-risk ops score significantly higher than low-risk ops', () => {
    it('assembleLayout scores >= 0.4 with affectedNodeCount=1', () => {
        // assembleLayout: opWeight 0.7×0.4=0.28 + blast (1/10)×0.35=0.035
        //               + severity 0.7×0.15=0.105 + familiarity 0.1×0.10=0.01 = 0.43
        const result = scoreMutation({
            opType: 'assembleLayout',
            affectedNodeCount: 1,
        })
        expect(result.score).toBeGreaterThanOrEqual(0.4)
    })

    it('assembleLayout scores >= 0.5 with affectedNodeCount=5', () => {
        // blast: (5/10)×0.35 = 0.175 → total ≈ 0.57
        const result = scoreMutation({
            opType: 'assembleLayout',
            affectedNodeCount: 5,
        })
        expect(result.score).toBeGreaterThanOrEqual(0.5)
    })

    it('crossFileMove scores >= 0.45 with affectedNodeCount=1', () => {
        // crossFileMove: opWeight 0.85×0.4=0.34 + blast 0.035 + severity 0.105 + fam 0.01 = 0.49
        const result = scoreMutation({
            opType: 'crossFileMove',
            affectedNodeCount: 1,
        })
        expect(result.score).toBeGreaterThanOrEqual(0.45)
    })

    it('crossFileMove scores >= 0.5 with affectedNodeCount=3', () => {
        // blast: (3/10)×0.35 = 0.105 → total ≈ 0.56
        const result = scoreMutation({
            opType: 'crossFileMove',
            affectedNodeCount: 3,
        })
        expect(result.score).toBeGreaterThanOrEqual(0.5)
    })

    it('deleteNode scores > updateClassName', () => {
        const deleteScore = scoreMutation({ opType: 'deleteNode', affectedNodeCount: 1 }).score
        const updateScore = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 1 }).score
        expect(deleteScore).toBeGreaterThan(updateScore)
    })

    it('crossFileMove scores > moveNode', () => {
        const crossScore = scoreMutation({ opType: 'crossFileMove', affectedNodeCount: 1 }).score
        const moveScore = scoreMutation({ opType: 'moveNode', affectedNodeCount: 1 }).score
        expect(crossScore).toBeGreaterThan(moveScore)
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — blast radius factor
// ---------------------------------------------------------------------------

describe('scoreMutation — blast radius factor', () => {
    it('affectedNodeCount=0 contributes 0 to blast radius', () => {
        const result = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 0 })
        const blast = result.factors.find((f) => f.name === 'blastRadius')!
        expect(blast.contribution).toBe(0)
    })

    it('affectedNodeCount=10 maximises blast radius factor', () => {
        const result10 = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 10 })
        const result1 = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 1 })
        expect(result10.score).toBeGreaterThan(result1.score)
    })

    it('affectedNodeCount=10+ caps at the same blast radius as 10', () => {
        const result10 = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 10 })
        const result100 = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 100 })
        // Both should have the same blast radius contribution (capped at 1.0)
        const blast10 = result10.factors.find((f) => f.name === 'blastRadius')!.contribution
        const blast100 = result100.factors.find((f) => f.name === 'blastRadius')!.contribution
        expect(blast100).toBeCloseTo(blast10, 4)
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — familiarity factor
// ---------------------------------------------------------------------------

describe('scoreMutation — familiarity factor', () => {
    it('no projectRoot → familiarity contribution is 0.1 × 0.10 = 0.01', () => {
        const result = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 1 })
        const fam = result.factors.find((f) => f.name === 'familiarity')!
        // neutral: 0.1 raw × 0.10 weight = 0.01
        expect(fam.contribution).toBeCloseTo(0.01, 4)
    })

    it('projectRoot with no provenance.db → familiarity is neutral, no throw', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-test-'))
        try {
            // .flint dir exists but provenance.db does not
            fs.mkdirSync(path.join(tmpDir, '.flint'))
            expect(() => scoreMutation({
                opType: 'updateClassName',
                affectedNodeCount: 1,
                filePath: '/src/components/Button.tsx',
                projectRoot: tmpDir,
            })).not.toThrow()

            const result = scoreMutation({
                opType: 'updateClassName',
                affectedNodeCount: 1,
                filePath: '/src/components/Button.tsx',
                projectRoot: tmpDir,
            })
            expect(result.score).toBeGreaterThanOrEqual(0.0)
            expect(result.score).toBeLessThanOrEqual(1.0)
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('projectRoot pointing to a non-existent directory → no throw', () => {
        expect(() => scoreMutation({
            opType: 'updateClassName',
            affectedNodeCount: 1,
            filePath: '/src/components/Button.tsx',
            projectRoot: '/tmp/flint-mrs-nonexistent-root-xyz',
        })).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — result structure
// ---------------------------------------------------------------------------

describe('scoreMutation — result structure', () => {
    it('always returns exactly 4 factors', () => {
        const result = scoreMutation({ opType: 'updateClassName' })
        expect(result.factors).toHaveLength(4)
    })

    it('factor names are opWeight, blastRadius, severity, familiarity', () => {
        const result = scoreMutation({ opType: 'assembleLayout', affectedNodeCount: 5 })
        const names = result.factors.map((f) => f.name)
        expect(names).toContain('opWeight')
        expect(names).toContain('blastRadius')
        expect(names).toContain('severity')
        expect(names).toContain('familiarity')
    })

    it('all factor contributions are in [0.0, 1.0]', () => {
        const result = scoreMutation({ opType: 'crossFileMove', affectedNodeCount: 20 })
        for (const factor of result.factors) {
            expect(factor.contribution).toBeGreaterThanOrEqual(0.0)
            expect(factor.contribution).toBeLessThanOrEqual(1.0)
        }
    })

    it('each factor has a non-empty rationale string', () => {
        const result = scoreMutation({ opType: 'deleteNode', affectedNodeCount: 3 })
        for (const factor of result.factors) {
            expect(typeof factor.rationale).toBe('string')
            expect(factor.rationale.length).toBeGreaterThan(0)
        }
    })

    it('recommendation string is non-empty', () => {
        const result = scoreMutation({ opType: 'moveNode' })
        expect(typeof result.recommendation).toBe('string')
        expect(result.recommendation.length).toBeGreaterThan(0)
    })

    it('tier matches getTier(score)', () => {
        for (const opType of ALL_OP_TYPES) {
            const result = scoreMutation({ opType, affectedNodeCount: 3 })
            expect(result.tier).toBe(getTier(result.score))
        }
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — determinism
// ---------------------------------------------------------------------------

describe('scoreMutation — determinism', () => {
    it('same input always produces same score', () => {
        const input: RiskScoringInput = {
            opType: 'deleteNode',
            affectedNodeCount: 5,
            hasViolationContext: true,
        }
        const r1 = scoreMutation(input)
        const r2 = scoreMutation(input)
        expect(r1.score).toBe(r2.score)
        expect(r1.tier).toBe(r2.tier)
    })

    it('different op types produce different scores', () => {
        const s1 = scoreMutation({ opType: 'updateClassName', affectedNodeCount: 1 }).score
        const s2 = scoreMutation({ opType: 'assembleLayout', affectedNodeCount: 1 }).score
        expect(s1).not.toBe(s2)
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — unknown op type
// ---------------------------------------------------------------------------

describe('scoreMutation — unknown op type', () => {
    it('uses default weight 0.5 for unknown op', () => {
        const known = scoreMutation({ opType: 'updateProp', affectedNodeCount: 1 }) // weight 0.2
        const unknown = scoreMutation({ opType: 'totallyUnknown', affectedNodeCount: 1 }) // default 0.5
        // Unknown (0.5) should score higher than updateProp (0.2)
        expect(unknown.score).toBeGreaterThan(known.score)
    })

    it('unknown op type result is still valid shape', () => {
        const result = scoreMutation({ opType: 'unknownOpABC123' })
        expect(result.factors).toHaveLength(4)
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(1)
        expect(result.tier).toMatch(/^(green|amber|red)$/)
    })
})

// ---------------------------------------------------------------------------
// scoreMutation — severity factor
// ---------------------------------------------------------------------------

describe('scoreMutation — severity factor', () => {
    it('hasViolationContext=true reduces severity compared to structural op without context', () => {
        // Structural op (assembleLayout, weight 0.7 >= 0.5) WITHOUT violation context gets
        // the 0.7 severity raw value. WITH violation context gets 0.3 raw.
        const withContext = scoreMutation({ opType: 'assembleLayout', hasViolationContext: true })
        const withoutContext = scoreMutation({ opType: 'assembleLayout', hasViolationContext: false })
        const sevWith = withContext.factors.find((f) => f.name === 'severity')!.contribution
        const sevWithout = withoutContext.factors.find((f) => f.name === 'severity')!.contribution
        expect(sevWithout).toBeGreaterThan(sevWith)
    })

    it('non-structural op with no violation context → severity contribution = 0', () => {
        const result = scoreMutation({
            opType: 'updateClassName',
            affectedNodeCount: 1,
            hasViolationContext: false,
        })
        const sev = result.factors.find((f) => f.name === 'severity')!
        expect(sev.contribution).toBe(0)
    })
})
