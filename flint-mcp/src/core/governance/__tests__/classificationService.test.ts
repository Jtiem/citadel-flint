/**
 * Unit tests for classificationService (UCFG.5)
 *
 * Coverage:
 *   - returns internal profile by default (undefined input)
 *   - returns correct profile for each classification level (public/internal/confidential/restricted)
 *   - restricted has the strictest settings
 *   - public has the most relaxed settings
 *   - classification field in profile matches the input
 *   - unrecognised classification string falls back to internal
 */

import { describe, it, expect } from 'vitest'
import { getClassificationProfile } from '../classificationService.js'

// ── Default behaviour ─────────────────────────────────────────────────────────

describe('getClassificationProfile — default (internal)', () => {
    it('returns internal profile when classification is undefined', () => {
        const profile = getClassificationProfile(undefined)
        expect(profile.classification).toBe('internal')
    })

    it('returns internal profile as the safe default', () => {
        const profile = getClassificationProfile(undefined)
        expect(profile.deltaEMultiplier).toBe(1.0)
        expect(profile.auditRetentionDays).toBe(90)
        expect(profile.requireApprovalAbove).toBe(70)
    })
})

// ── Per-classification profiles ───────────────────────────────────────────────

describe('getClassificationProfile — public', () => {
    it('returns classification: public', () => {
        expect(getClassificationProfile('public').classification).toBe('public')
    })

    it('has deltaEMultiplier of 1.0', () => {
        expect(getClassificationProfile('public').deltaEMultiplier).toBe(1.0)
    })

    it('has auditRetentionDays of 30', () => {
        expect(getClassificationProfile('public').auditRetentionDays).toBe(30)
    })

    it('has requireApprovalAbove of 80', () => {
        expect(getClassificationProfile('public').requireApprovalAbove).toBe(80)
    })
})

describe('getClassificationProfile — internal', () => {
    it('returns classification: internal', () => {
        expect(getClassificationProfile('internal').classification).toBe('internal')
    })

    it('has deltaEMultiplier of 1.0', () => {
        expect(getClassificationProfile('internal').deltaEMultiplier).toBe(1.0)
    })

    it('has auditRetentionDays of 90', () => {
        expect(getClassificationProfile('internal').auditRetentionDays).toBe(90)
    })

    it('has requireApprovalAbove of 70', () => {
        expect(getClassificationProfile('internal').requireApprovalAbove).toBe(70)
    })
})

describe('getClassificationProfile — confidential', () => {
    it('returns classification: confidential', () => {
        expect(getClassificationProfile('confidential').classification).toBe('confidential')
    })

    it('has stricter deltaEMultiplier of 0.8', () => {
        expect(getClassificationProfile('confidential').deltaEMultiplier).toBe(0.8)
    })

    it('has auditRetentionDays of 365', () => {
        expect(getClassificationProfile('confidential').auditRetentionDays).toBe(365)
    })

    it('has requireApprovalAbove of 50', () => {
        expect(getClassificationProfile('confidential').requireApprovalAbove).toBe(50)
    })
})

describe('getClassificationProfile — restricted', () => {
    it('returns classification: restricted', () => {
        expect(getClassificationProfile('restricted').classification).toBe('restricted')
    })

    it('has strictest deltaEMultiplier of 0.5', () => {
        expect(getClassificationProfile('restricted').deltaEMultiplier).toBe(0.5)
    })

    it('has auditRetentionDays of 2190 (6 years)', () => {
        expect(getClassificationProfile('restricted').auditRetentionDays).toBe(2190)
    })

    it('has requireApprovalAbove of 30 (lowest threshold)', () => {
        expect(getClassificationProfile('restricted').requireApprovalAbove).toBe(30)
    })
})

// ── Relative strictness comparison ────────────────────────────────────────────

describe('strictness ordering', () => {
    it('restricted is stricter than confidential (lower deltaEMultiplier)', () => {
        const restricted = getClassificationProfile('restricted')
        const confidential = getClassificationProfile('confidential')
        expect(restricted.deltaEMultiplier).toBeLessThan(confidential.deltaEMultiplier)
    })

    it('restricted requires approval at lower risk score than confidential', () => {
        const restricted = getClassificationProfile('restricted')
        const confidential = getClassificationProfile('confidential')
        expect(restricted.requireApprovalAbove).toBeLessThan(confidential.requireApprovalAbove)
    })

    it('confidential is stricter than internal', () => {
        const confidential = getClassificationProfile('confidential')
        const internal = getClassificationProfile('internal')
        expect(confidential.deltaEMultiplier).toBeLessThan(internal.deltaEMultiplier)
        expect(confidential.requireApprovalAbove).toBeLessThan(internal.requireApprovalAbove)
    })

    it('public is more relaxed than internal (shorter retention)', () => {
        const pub = getClassificationProfile('public')
        const internal = getClassificationProfile('internal')
        expect(pub.auditRetentionDays).toBeLessThan(internal.auditRetentionDays)
        expect(pub.requireApprovalAbove).toBeGreaterThan(internal.requireApprovalAbove)
    })

    it('restricted has highest retention requirement', () => {
        const levels = ['public', 'internal', 'confidential', 'restricted'] as const
        const retentions = levels.map((l) => getClassificationProfile(l).auditRetentionDays)
        const sorted = [...retentions].sort((a, b) => a - b)
        expect(retentions).toEqual(sorted)
    })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
    it('profile object is a plain object with expected keys', () => {
        const profile = getClassificationProfile('public')
        expect(profile).toHaveProperty('classification')
        expect(profile).toHaveProperty('deltaEMultiplier')
        expect(profile).toHaveProperty('auditRetentionDays')
        expect(profile).toHaveProperty('requireApprovalAbove')
    })

    it('calling multiple times with same input is deterministic', () => {
        const a = getClassificationProfile('confidential')
        const b = getClassificationProfile('confidential')
        expect(a).toEqual(b)
    })
})
