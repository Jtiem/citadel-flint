/**
 * ingestionRateLimit.test.ts
 *
 * SEC.6 — Ingestion Server Rate Limiting
 *
 * Tests the pure TokenBucket class and the checkRateLimit helper exported from
 * ingestion-server.ts.  No HTTP server or Electron APIs are used — all logic is
 * exercised as plain TypeScript functions so the suite runs in the vitest Node
 * environment without mocking SQLite or BrowserWindow.
 *
 * Coverage:
 *   RL-01  Single request to a rate-limited route → allowed
 *   RL-02  10 rapid /ingest requests → first 10 pass, 11th is rejected (429)
 *   RL-03  Rejected result includes retryAfterSecs > 0
 *   RL-04  Tokens refill after simulated time advance
 *   RL-05  OPTIONS method must never be checked (route bucket path exercise only)
 *   RL-06  Different routes have independent limits
 *   RL-07  Unknown / unregistered routes are always allowed
 *   RL-08  resetRateLimiter() restores full capacity (simulates server restart)
 *   RL-09  TokenBucket starts full (capacity == requestsPerMinute)
 *   RL-10  TokenBucket does not exceed capacity on refill
 *   RL-11  retryAfterMs is the ceiling of the wait required for one token
 *   RL-12  TokenBucket with custom clock advances correctly
 *   RL-13  /ingest-ast has 60-req/min capacity (6× higher than /ingest)
 *   RL-14  /ingest-asset has 30-req/min capacity
 *   RL-15  Retry-After seconds are always a positive integer
 */

import { describe, it, expect, beforeEach } from 'vitest'
// Import from the pure rateLimiter module — no Electron/SQLite deps, safe in
// the vitest Node environment.
import { TokenBucket, checkRateLimit, resetRateLimiter } from '../rateLimiter.js'

// ── RL-09 / RL-01: TokenBucket starts full ───────────────────────────────────

describe('TokenBucket — initial state', () => {
    it('RL-09: starts full — first N consumes all succeed for capacity N', () => {
        const bucket = new TokenBucket(5)
        for (let i = 0; i < 5; i++) {
            expect(bucket.consume()).toEqual({ allowed: true })
        }
    })

    it('RL-01: a single consume on a fresh bucket is allowed', () => {
        const bucket = new TokenBucket(10)
        expect(bucket.consume()).toEqual({ allowed: true })
    })
})

// ── RL-02: 11th /ingest request is rejected ───────────────────────────────────

describe('TokenBucket — exhaustion', () => {
    it('RL-02: first 10 consumes allowed, 11th is rejected', () => {
        const bucket = new TokenBucket(10)
        for (let i = 0; i < 10; i++) {
            const result = bucket.consume()
            expect(result.allowed).toBe(true)
        }
        const eleventh = bucket.consume()
        expect(eleventh.allowed).toBe(false)
    })

    it('RL-03: rejected result includes retryAfterMs > 0', () => {
        const bucket = new TokenBucket(10)
        for (let i = 0; i < 10; i++) bucket.consume()
        const result = bucket.consume()
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            expect(result.retryAfterMs).toBeGreaterThan(0)
        }
    })
})

// ── RL-04: Refill after time advance ─────────────────────────────────────────

describe('TokenBucket — time-based refill', () => {
    it('RL-04: tokens refill after simulated 60 000 ms (one full minute)', () => {
        let fakeNow = 0
        const bucket = new TokenBucket(10, () => fakeNow)

        // Drain the bucket
        for (let i = 0; i < 10; i++) bucket.consume()
        expect(bucket.consume().allowed).toBe(false)

        // Advance clock by 60 000 ms → bucket should be fully refilled
        fakeNow += 60_000
        for (let i = 0; i < 10; i++) {
            expect(bucket.consume().allowed).toBe(true)
        }
    })

    it('RL-04b: partial refill restores only proportional tokens', () => {
        let fakeNow = 0
        // 10 req/min = 1 token per 6 000 ms
        const bucket = new TokenBucket(10, () => fakeNow)

        // Drain completely
        for (let i = 0; i < 10; i++) bucket.consume()

        // Advance by 6 000 ms → exactly 1 token refilled
        fakeNow += 6_000
        expect(bucket.consume().allowed).toBe(true)   // 1 token available
        expect(bucket.consume().allowed).toBe(false)  // now empty again
    })

    it('RL-10: bucket never exceeds capacity on over-refill', () => {
        let fakeNow = 0
        const bucket = new TokenBucket(5, () => fakeNow)

        // Drain partially
        bucket.consume()
        bucket.consume()

        // Advance by a full hour — should NOT produce > 5 tokens
        fakeNow += 3_600_000
        for (let i = 0; i < 5; i++) {
            expect(bucket.consume().allowed).toBe(true)
        }
        expect(bucket.consume().allowed).toBe(false)
    })
})

// ── RL-11 / RL-15: retryAfterMs / retryAfterSecs values ─────────────────────

describe('TokenBucket — retry timing', () => {
    it('RL-11: retryAfterMs is the ceiling of the wait for one token', () => {
        let fakeNow = 0
        // 10 req/min = 1 token per 6 000 ms
        const bucket = new TokenBucket(10, () => fakeNow)
        for (let i = 0; i < 10; i++) bucket.consume()

        const result = bucket.consume()
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            // We consumed exactly at t=0 and have 0 tokens; need 1 more.
            // retryAfterMs = ceil(1 / (10/60000)) = ceil(6000) = 6000
            expect(result.retryAfterMs).toBe(6_000)
        }
    })

    it('RL-15: checkRateLimit retryAfterSecs is always a positive integer', () => {
        // Drain /ingest bucket to force a rejection
        resetRateLimiter()
        for (let i = 0; i < 10; i++) checkRateLimit('/ingest')
        const result = checkRateLimit('/ingest')
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            expect(Number.isInteger(result.retryAfterSecs)).toBe(true)
            expect(result.retryAfterSecs).toBeGreaterThan(0)
        }
    })
})

// ── RL-12: Custom clock wiring ────────────────────────────────────────────────

describe('TokenBucket — custom clock', () => {
    it('RL-12: tokens do not refill when the clock does not advance', () => {
        const fakeNow = 1_000_000
        const bucket = new TokenBucket(3, () => fakeNow)
        bucket.consume()
        bucket.consume()
        bucket.consume()
        // Clock frozen — no refill
        const result = bucket.consume()
        expect(result.allowed).toBe(false)
    })
})

// ── RL-06: Independent per-route limits ──────────────────────────────────────

describe('checkRateLimit — independent route buckets', () => {
    beforeEach(() => resetRateLimiter())

    it('RL-06: exhausting /ingest does not affect /ingest-ast', () => {
        // Drain /ingest
        for (let i = 0; i < 10; i++) checkRateLimit('/ingest')
        expect(checkRateLimit('/ingest').allowed).toBe(false)

        // /ingest-ast should still be available
        expect(checkRateLimit('/ingest-ast').allowed).toBe(true)
    })

    it('RL-06b: exhausting /ingest-asset does not affect /ingest', () => {
        // Drain /ingest-asset
        for (let i = 0; i < 30; i++) checkRateLimit('/ingest-asset')
        expect(checkRateLimit('/ingest-asset').allowed).toBe(false)

        // /ingest should still be available (has its own bucket)
        expect(checkRateLimit('/ingest').allowed).toBe(true)
    })
})

// ── RL-07: Unknown routes always allowed ─────────────────────────────────────

describe('checkRateLimit — unknown routes', () => {
    it('RL-07: unknown path is always allowed', () => {
        expect(checkRateLimit('/health').allowed).toBe(true)
        expect(checkRateLimit('/').allowed).toBe(true)
        expect(checkRateLimit(undefined).allowed).toBe(true)
        expect(checkRateLimit('/ingest-unknown').allowed).toBe(true)
    })

    it('RL-07b: query strings are stripped before route lookup', () => {
        // /ingest?foo=bar should count against the /ingest bucket
        resetRateLimiter()
        for (let i = 0; i < 10; i++) checkRateLimit('/ingest?foo=bar')
        expect(checkRateLimit('/ingest?foo=bar').allowed).toBe(false)
    })
})

// ── RL-05: OPTIONS requests — route bucket path exercise ─────────────────────
// The HTTP handler short-circuits before calling checkRateLimit for OPTIONS.
// We verify here that even if checkRateLimit WERE called with /ingest, it
// returns the correct bucket result (the OPTIONS guard lives in handleRequest,
// not in checkRateLimit itself).

describe('checkRateLimit — OPTIONS exemption note', () => {
    beforeEach(() => resetRateLimiter())

    it('RL-05: checkRateLimit for /ingest still counts when called (OPTIONS guard is in handleRequest)', () => {
        // This confirms the rate limiter has no special OPTIONS awareness —
        // the handleRequest layer is responsible for the exemption.
        const result = checkRateLimit('/ingest')
        expect(result.allowed).toBe(true) // bucket still has capacity
    })
})

// ── RL-08: resetRateLimiter simulates server restart ─────────────────────────

describe('resetRateLimiter', () => {
    it('RL-08: restores full capacity after exhaustion', () => {
        // Drain /ingest
        for (let i = 0; i < 10; i++) checkRateLimit('/ingest')
        expect(checkRateLimit('/ingest').allowed).toBe(false)

        // Simulate server restart
        resetRateLimiter()

        // All 10 tokens should be available again
        for (let i = 0; i < 10; i++) {
            expect(checkRateLimit('/ingest').allowed).toBe(true)
        }
        expect(checkRateLimit('/ingest').allowed).toBe(false)
    })

    it('RL-08b: resetRateLimiter restores /ingest-ast capacity (60)', () => {
        for (let i = 0; i < 60; i++) checkRateLimit('/ingest-ast')
        expect(checkRateLimit('/ingest-ast').allowed).toBe(false)

        resetRateLimiter()

        for (let i = 0; i < 60; i++) {
            expect(checkRateLimit('/ingest-ast').allowed).toBe(true)
        }
        expect(checkRateLimit('/ingest-ast').allowed).toBe(false)
    })

    it('RL-08c: resetRateLimiter restores /ingest-asset capacity (30)', () => {
        for (let i = 0; i < 30; i++) checkRateLimit('/ingest-asset')
        expect(checkRateLimit('/ingest-asset').allowed).toBe(false)

        resetRateLimiter()

        for (let i = 0; i < 30; i++) {
            expect(checkRateLimit('/ingest-asset').allowed).toBe(true)
        }
        expect(checkRateLimit('/ingest-asset').allowed).toBe(false)
    })
})

// ── RL-13 / RL-14: Capacity constants ────────────────────────────────────────

describe('Route capacity constants', () => {
    beforeEach(() => resetRateLimiter())

    it('RL-13: /ingest-ast allows exactly 60 requests before rejecting', () => {
        let allowed = 0
        for (let i = 0; i < 61; i++) {
            if (checkRateLimit('/ingest-ast').allowed) allowed++
        }
        expect(allowed).toBe(60)
    })

    it('RL-14: /ingest-asset allows exactly 30 requests before rejecting', () => {
        let allowed = 0
        for (let i = 0; i < 31; i++) {
            if (checkRateLimit('/ingest-asset').allowed) allowed++
        }
        expect(allowed).toBe(30)
    })

    it('RL-02b: /ingest allows exactly 10 requests before rejecting', () => {
        let allowed = 0
        for (let i = 0; i < 11; i++) {
            if (checkRateLimit('/ingest').allowed) allowed++
        }
        expect(allowed).toBe(10)
    })
})
