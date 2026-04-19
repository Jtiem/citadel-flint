/**
 * mcp-classification.test.ts — shared/__tests__/mcp-classification.test.ts
 *
 * MINT.5 Phase 3 — Pure classifier for MCPCallResult.classification.
 *
 * Covers contract testBoundaries:
 *   - 'classifyMCPError auth-expired'   — known auth-failure text → 'auth-expired'
 *   - 'classifyMCPError rate-limited'   — known 429 text → 'rate-limited'
 *   - 'classifyMCPError network-error'  — ECONNREFUSED text → 'network-error'
 *   - 'classifyMCPError tool-error'     — unmatched isError text → 'tool-error'
 *   - 'classifyMCPError unknown (success)' — isError=false → 'unknown'
 *   - precedence: 'auth-expired' wins over generic 'tool-error'
 */

import { describe, it, expect } from 'vitest'
import { classifyMCPError } from '../mcp-classification'
import type { MCPCallClassification, ClassifyMCPError } from '../../.flint-context/contracts/MINT.5-phase3.contract'

// Type compatibility check
const _typeCheck: ClassifyMCPError = classifyMCPError

// ── classifyMCPError auth-expired ─────────────────────────────────────────────
// boundary: classifyMCPError auth-expired

describe('classifyMCPError — auth-expired', () => {
    it('returns "auth-expired" for rawText containing "auth-expired"', () => {
        // boundary: classifyMCPError auth-expired
        const result = classifyMCPError({ rawText: 'auth-expired', isError: true })
        expect(result).toBe('auth-expired')
    })

    it('returns "auth-expired" for rawText "token expired"', () => {
        // boundary: classifyMCPError auth-expired (edge: variant text)
        const result = classifyMCPError({ rawText: 'token expired', isError: true })
        expect(result).toBe('auth-expired')
    })

    it('returns "auth-expired" for rawText containing "unauthorized"', () => {
        // boundary: classifyMCPError auth-expired (edge: unauthorized)
        const result = classifyMCPError({ rawText: 'unauthorized access', isError: true })
        expect(result).toBe('auth-expired')
    })

    it('returns "auth-expired" for rawText containing "connection revoked"', () => {
        // boundary: classifyMCPError auth-expired (edge: connection revoked)
        const result = classifyMCPError({ rawText: 'connection revoked', isError: true })
        expect(result).toBe('auth-expired')
    })

    it('returns "auth-expired" for rawText with mixed case "Auth-Expired"', () => {
        // Classifier should be case-insensitive on lowercased rawText
        const result = classifyMCPError({
            rawText: 'auth-expired: re-authenticate with figma',
            isError: true,
        })
        expect(result).toBe('auth-expired')
    })
})

// ── classifyMCPError rate-limited ─────────────────────────────────────────────
// boundary: classifyMCPError rate-limited

describe('classifyMCPError — rate-limited', () => {
    it('returns "rate-limited" for rawText containing "rate limit exceeded"', () => {
        // boundary: classifyMCPError rate-limited
        const result = classifyMCPError({ rawText: 'rate limit exceeded', isError: true })
        expect(result).toBe('rate-limited')
    })

    it('returns "rate-limited" for rawText containing "too many requests"', () => {
        // boundary: classifyMCPError rate-limited (edge: variant text)
        const result = classifyMCPError({ rawText: 'too many requests', isError: true })
        expect(result).toBe('rate-limited')
    })

    it('returns "rate-limited" for rawText containing "429"', () => {
        const result = classifyMCPError({ rawText: 'http 429 rate limit', isError: true })
        expect(result).toBe('rate-limited')
    })
})

// ── classifyMCPError network-error ────────────────────────────────────────────
// boundary: classifyMCPError network-error

describe('classifyMCPError — network-error', () => {
    it('returns "network-error" for rawText containing "ECONNREFUSED"', () => {
        // boundary: classifyMCPError network-error
        const result = classifyMCPError({ rawText: 'econnrefused', isError: true })
        expect(result).toBe('network-error')
    })

    it('returns "network-error" for DNS failure text "ENOTFOUND"', () => {
        // boundary: classifyMCPError network-error (edge: DNS failure)
        const result = classifyMCPError({ rawText: 'enotfound api.figma.com', isError: true })
        expect(result).toBe('network-error')
    })

    it('returns "network-error" for timeout text (e.g. "etimedout")', () => {
        // boundary: classifyMCPError network-error (edge: timeout)
        // Implementation must recognize 'etimedout' (Node.js error code)
        const result = classifyMCPError({ rawText: 'etimedout', isError: true })
        expect(result).toBe('network-error')
    })

    it('returns "network-error" for "connection refused" text', () => {
        // boundary: classifyMCPError network-error (edge: connection refused)
        const result = classifyMCPError({ rawText: 'connection refused', isError: true })
        expect(result).toBe('network-error')
    })
})

// ── classifyMCPError tool-error ───────────────────────────────────────────────
// boundary: classifyMCPError tool-error

describe('classifyMCPError — tool-error (fallthrough)', () => {
    it('returns "tool-error" for unmatched error text with isError=true', () => {
        // boundary: classifyMCPError tool-error
        const result = classifyMCPError({
            rawText: 'validation failed: token_path required',
            isError: true,
        })
        expect(result).toBe('tool-error')
    })

    it('returns "tool-error" for any generic error message that does not match specific classifiers', () => {
        // boundary: classifyMCPError tool-error (fallthrough)
        const result = classifyMCPError({
            rawText: 'something went wrong in the mcp tool',
            isError: true,
        })
        expect(result).toBe('tool-error')
    })
})

// ── classifyMCPError unknown (success) ────────────────────────────────────────
// boundary: classifyMCPError unknown (success)

describe('classifyMCPError — unknown for success results', () => {
    it('returns "unknown" when isError=false regardless of rawText', () => {
        // boundary: classifyMCPError unknown (success)
        const result = classifyMCPError({ rawText: 'ok', isError: false })
        expect(result).toBe('unknown')
    })

    it('returns "unknown" when isError=false even if rawText contains classifier keywords', () => {
        // Success result with auth-like text should still return unknown
        const result = classifyMCPError({ rawText: 'auth-expired in description', isError: false })
        expect(result).toBe('unknown')
    })

    it('returns "unknown" for empty rawText with isError=false', () => {
        const result = classifyMCPError({ rawText: '', isError: false })
        expect(result).toBe('unknown')
    })
})

// ── Precedence: auth-expired wins ─────────────────────────────────────────────

describe('classifyMCPError — precedence', () => {
    it('auth-expired wins over generic tool-error when both could match', () => {
        // boundary: classifyMCPError — auth-expired wins over tool-error
        // A message that contains auth-expired keywords + other error keywords
        const result = classifyMCPError({
            rawText: 'auth-expired: figma token invalid, validation failed',
            isError: true,
        })
        expect(result).toBe('auth-expired')
    })

    it('returns a valid MCPCallClassification union member for any input', () => {
        const validValues: MCPCallClassification[] = [
            'auth-expired',
            'rate-limited',
            'network-error',
            'tool-error',
            'validation-error',
            'unknown',
        ]

        const inputs = [
            { rawText: 'auth-expired', isError: true },
            { rawText: 'rate limit', isError: true },
            { rawText: 'econnrefused', isError: true },
            { rawText: 'random error', isError: true },
            { rawText: 'ok', isError: false },
        ]

        for (const input of inputs) {
            const result = classifyMCPError(input)
            expect(validValues).toContain(result)
        }
    })
})

// ── Optional status field ─────────────────────────────────────────────────────

describe('classifyMCPError — optional status field', () => {
    it('accepts a status field without throwing', () => {
        expect(() =>
            classifyMCPError({ rawText: 'ok', isError: false, status: '200' })
        ).not.toThrow()
    })

    it('accepts undefined status', () => {
        expect(() =>
            classifyMCPError({ rawText: 'ok', isError: false, status: undefined })
        ).not.toThrow()
    })
})
