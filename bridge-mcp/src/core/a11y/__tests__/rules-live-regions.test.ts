/**
 * Tests for live-regions rules (EXP.6b scope)
 *
 * These rules are deferred to EXP.6b. This file verifies the stub exports
 * an empty array without errors.
 */

import { describe, it, expect } from 'vitest'
import { liveRegionsRules } from '../rules/live-regions.js'

describe('live-regions rules (EXP.6b stub)', () => {
    it('exports an empty array (rules deferred to EXP.6b)', () => {
        expect(Array.isArray(liveRegionsRules)).toBe(true)
        expect(liveRegionsRules).toHaveLength(0)
    })
})
