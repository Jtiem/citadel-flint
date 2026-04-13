import { describe, it, expect } from 'vitest'
import {
    CANONICAL_OP_WEIGHTS,
    CANONICAL_TIER_FLOORS,
    CANONICAL_UNKNOWN_OP_WEIGHT,
    ORCHESTRATOR_TO_CANONICAL,
} from '../mrsWeights.js'

describe('shared/mrsWeights', () => {
    it('deleteNode weight matches between canonical and orchestrator mapping', () => {
        // The orchestrator uses flint_delete_node, which maps to canonical 'deleteNode'
        const canonicalName = ORCHESTRATOR_TO_CANONICAL['flint_delete_node']
        expect(canonicalName).toBe('deleteNode')

        const weightViaCanonical = CANONICAL_OP_WEIGHTS['deleteNode']
        const weightViaMapping = CANONICAL_OP_WEIGHTS[canonicalName]

        expect(weightViaCanonical).toBe(0.90)
        expect(weightViaMapping).toBe(weightViaCanonical)
    })

    it('all orchestrator mappings resolve to valid canonical names with op weights', () => {
        for (const [orchestratorName, canonicalName] of Object.entries(ORCHESTRATOR_TO_CANONICAL)) {
            const weight = CANONICAL_OP_WEIGHTS[canonicalName]
            expect(
                weight,
                `Orchestrator tool '${orchestratorName}' maps to '${canonicalName}' which has no op weight`,
            ).toBeDefined()
            expect(weight).toBeGreaterThanOrEqual(0)
            expect(weight).toBeLessThanOrEqual(1)
        }
    })

    it('every canonical name with a tier floor also has an op weight', () => {
        for (const [canonicalName, floor] of Object.entries(CANONICAL_TIER_FLOORS)) {
            const weight = CANONICAL_OP_WEIGHTS[canonicalName]
            expect(
                weight,
                `Tier floor exists for '${canonicalName}' (${floor}) but no op weight is defined`,
            ).toBeDefined()
        }
    })

    it('unknown op weight is 0.50', () => {
        expect(CANONICAL_UNKNOWN_OP_WEIGHT).toBe(0.50)
    })

    it('insertNode and its aliases share the same weight', () => {
        expect(CANONICAL_OP_WEIGHTS['insertNode']).toBe(CANONICAL_OP_WEIGHTS['inject'])
        expect(CANONICAL_OP_WEIGHTS['insertNode']).toBe(CANONICAL_OP_WEIGHTS['injectNode'])
    })

    it('wrapNode and its alias share the same weight', () => {
        expect(CANONICAL_OP_WEIGHTS['wrapNode']).toBe(CANONICAL_OP_WEIGHTS['wrap'])
    })

    it('tier floors only contain valid tiers', () => {
        const validTiers = new Set(['green', 'amber', 'red'])
        for (const [name, tier] of Object.entries(CANONICAL_TIER_FLOORS)) {
            expect(
                validTiers.has(tier),
                `Tier floor for '${name}' has invalid tier '${tier}'`,
            ).toBe(true)
        }
    })
})
