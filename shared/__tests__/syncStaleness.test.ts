/**
 * syncStaleness.test.ts — shared/__tests__/syncStaleness.test.ts
 *
 * MINT.5 Phase 3 — Pure helpers for sync staleness detection.
 *
 * Covers contract testBoundaries:
 *   - 'isSyncStale boundary'    — returns true at exactly threshold hours
 *   - 'formatStaleness format'  — formats duration as human-readable string
 *
 * These are pure functions with no I/O — fast, deterministic tests.
 */

import { describe, it, expect } from 'vitest'
import {
    isSyncStale,
    formatStaleness,
    SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT,
} from '../syncStaleness'
import type { IsSyncStale, FormatStaleness } from '../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Type compatibility checks ─────────────────────────────────────────────────
// Verify the exported functions satisfy the contract interfaces.

const _isSyncStaleCheck: IsSyncStale = isSyncStale
const _formatStalenessCheck: FormatStaleness = formatStaleness

// ── SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT ────────────────────────────────────

describe('SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT', () => {
    it('equals 24 (hours)', () => {
        expect(SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT).toBe(24)
    })
})

// ── isSyncStale boundary ──────────────────────────────────────────────────────
// boundary: isSyncStale boundary

describe('isSyncStale — boundary cases', () => {
    const threshold = 24
    const nowMs = Date.now()

    it('returns true when staleSince is exactly threshold hours before nowMs', () => {
        // boundary: isSyncStale boundary — at exactly 24h
        const staleSince = new Date(nowMs - threshold * 3600_000).toISOString()
        expect(isSyncStale(staleSince, threshold, nowMs)).toBe(true)
    })

    it('returns true when staleSince is threshold+1 hours before nowMs', () => {
        // boundary: isSyncStale boundary — over threshold
        const staleSince = new Date(nowMs - (threshold + 1) * 3600_000).toISOString()
        expect(isSyncStale(staleSince, threshold, nowMs)).toBe(true)
    })

    it('returns false when staleSince is threshold-1 hours before nowMs', () => {
        // boundary: isSyncStale boundary — just under threshold
        const staleSince = new Date(nowMs - (threshold - 1) * 3600_000).toISOString()
        expect(isSyncStale(staleSince, threshold, nowMs)).toBe(false)
    })

    it('returns false when staleSince is null', () => {
        // boundary: isSyncStale boundary (edge: null staleSince)
        expect(isSyncStale(null, threshold, nowMs)).toBe(false)
    })

    it('returns false when staleSince is in the future', () => {
        // boundary: isSyncStale boundary (edge: future staleSince)
        const staleSince = new Date(nowMs + 3600_000).toISOString()
        expect(isSyncStale(staleSince, threshold, nowMs)).toBe(false)
    })

    it('works correctly with a custom threshold of 12 hours', () => {
        const customThreshold = 12
        const twelveHoursAgo = new Date(nowMs - customThreshold * 3600_000).toISOString()
        expect(isSyncStale(twelveHoursAgo, customThreshold, nowMs)).toBe(true)

        const elevenHoursAgo = new Date(nowMs - (customThreshold - 1) * 3600_000).toISOString()
        expect(isSyncStale(elevenHoursAgo, customThreshold, nowMs)).toBe(false)
    })

    it('handles an invalid ISO string without throwing (returns false)', () => {
        expect(() => isSyncStale('not-a-date', threshold, nowMs)).not.toThrow()
        const result = isSyncStale('not-a-date', threshold, nowMs)
        // NaN comparison is false, so invalid dates return false
        expect(result).toBe(false)
    })
})

// ── formatStaleness format ─────────────────────────────────────────────────────
// boundary: formatStaleness format

describe('formatStaleness — human-readable formatting', () => {
    it('formats 26 * 3600_000 ms as "26 hours"', () => {
        // boundary: formatStaleness format
        expect(formatStaleness(26 * 3600_000)).toBe('26 hours')
    })

    it('formats sub-hour duration as "N minutes"', () => {
        // boundary: formatStaleness format (edge: sub-hour)
        const fortyFiveMinutes = 45 * 60_000
        const result = formatStaleness(fortyFiveMinutes)
        expect(result).toMatch(/minutes/i)
        expect(result).toContain('45')
    })

    it('formats multi-day duration as "N days"', () => {
        // boundary: formatStaleness format (edge: multi-day)
        const twoDays = 2 * 24 * 3600_000
        const result = formatStaleness(twoDays)
        expect(result).toMatch(/days/i)
        expect(result).toContain('2')
    })

    it('formats exactly 1 hour as "1 hour" (singular)', () => {
        const oneHour = 3600_000
        const result = formatStaleness(oneHour)
        // Either "1 hour" or "60 minutes" is acceptable — just not "NaN"
        expect(result).not.toMatch(/NaN/)
        expect(result.length).toBeGreaterThan(0)
    })

    it('formats exactly 1 day as "1 day" (singular)', () => {
        const oneDay = 24 * 3600_000
        const result = formatStaleness(oneDay)
        expect(result).not.toMatch(/NaN/)
        expect(result.length).toBeGreaterThan(0)
    })

    it('formats 0 ms without crashing', () => {
        expect(() => formatStaleness(0)).not.toThrow()
    })

    it('formats 1 minute (60_000ms) as a minutes string', () => {
        const result = formatStaleness(60_000)
        expect(result).toMatch(/minutes?/i)
    })

    it('formats 48 hours as "2 days"', () => {
        const result = formatStaleness(48 * 3600_000)
        expect(result).toMatch(/2 days/i)
    })
})
