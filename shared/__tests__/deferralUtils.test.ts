/**
 * deferralUtils.test.ts — shared/__tests__/deferralUtils.test.ts
 *
 * COUNSEL.2.1 — Unit tests for shared/deferralUtils.ts
 *
 * Tests for the pure utility functions durationToMs and computeExpiresAt
 * that are shared between electron/main.ts and server/index.ts.
 *
 * Contract source: docs/contracts/counsel-2-1.contract.ts
 * testBoundaries targets:
 *   - 'durationToMs (shared/deferralUtils.ts)'
 *   - 'computeExpiresAt (shared/deferralUtils.ts)'
 */

import { describe, it, expect } from 'vitest'
import { durationToMs, computeExpiresAt } from '../deferralUtils'

// ---------------------------------------------------------------------------
// durationToMs
// ---------------------------------------------------------------------------

describe('durationToMs — COUNSEL.2.1', () => {
    it('returns 86400000 (1 day in ms) for "1 day"', () => {
        expect(durationToMs('1 day')).toBe(86_400_000)
    })

    it('returns 259200000 (3 days in ms) for "3 days"', () => {
        expect(durationToMs('3 days')).toBe(259_200_000)
    })

    it('returns 604800000 (7 days in ms) for "1 week"', () => {
        expect(durationToMs('1 week')).toBe(604_800_000)
    })

    it('returns 1209600000 (14 days in ms) for "1 sprint"', () => {
        expect(durationToMs('1 sprint')).toBe(1_209_600_000)
    })

    it('returns null for "Manually"', () => {
        expect(durationToMs('Manually')).toBeNull()
    })

    it('returns null for undefined input (backward compat)', () => {
        expect(durationToMs(undefined)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// computeExpiresAt
// ---------------------------------------------------------------------------

describe('computeExpiresAt — COUNSEL.2.1', () => {
    it('returns an ISO 8601 string for "1 day" that parses to a future Date', () => {
        const before = Date.now()
        const result = computeExpiresAt('1 day')
        const after = Date.now()

        expect(result).not.toBeNull()
        expect(typeof result).toBe('string')

        const parsed = new Date(result!).getTime()
        // Must be in the future
        expect(parsed).toBeGreaterThan(before)
        // Must be approximately 1 day from now (within 1 second tolerance)
        expect(parsed).toBeGreaterThanOrEqual(before + 86_400_000)
        expect(parsed).toBeLessThanOrEqual(after + 86_400_000 + 1000)
    })

    it('returns an ISO 8601 string for "1 sprint" approximately 14 days from now', () => {
        const before = Date.now()
        const result = computeExpiresAt('1 sprint')
        const after = Date.now()

        expect(result).not.toBeNull()
        const parsed = new Date(result!).getTime()
        expect(parsed).toBeGreaterThanOrEqual(before + 1_209_600_000)
        expect(parsed).toBeLessThanOrEqual(after + 1_209_600_000 + 1000)
    })

    it('resulting expires_at date is within 1 second of Date.now() + durationToMs(duration)', () => {
        const durations = ['1 day', '3 days', '1 week', '1 sprint'] as const
        for (const duration of durations) {
            const before = Date.now()
            const result = computeExpiresAt(duration)
            const after = Date.now()
            const ms = durationToMs(duration)!

            expect(result).not.toBeNull()
            const parsed = new Date(result!).getTime()
            expect(parsed).toBeGreaterThanOrEqual(before + ms)
            expect(parsed).toBeLessThanOrEqual(after + ms + 1000)
        }
    })

    it('returns null for "Manually"', () => {
        expect(computeExpiresAt('Manually')).toBeNull()
    })

    it('returns null for undefined input', () => {
        expect(computeExpiresAt(undefined)).toBeNull()
    })
})
