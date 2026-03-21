/**
 * ingestion-integration.test.ts
 *
 * Phase ING — Integration tests ING-13 and ING-14.
 *
 * These are UNIT tests that call heal() directly with controlled inputs.
 * They do NOT require HTTP, Electron, SQLite, or IPC.
 *
 * Test map:
 *   ING-13 — Full pipeline: tokens present → heal produces tier-1 fix
 *   ING-14 — No prior tokens → heal is no-op
 */

import { describe, it, expect } from 'vitest'
import { heal } from '../ingestion/IngestionAuditor.js'
import type { AuditorToken } from '../ingestion/IngestionAuditor.js'

// ── Token fixture ─────────────────────────────────────────────────────────────

/**
 * Exact blue-500 color token.
 * token_value is the precise hex that bg-[#3B82F6] encodes.
 * classifyViolation will return tier1 (deltaE ≈ 0.0) for this pair.
 */
const BLUE_500_TOKEN: AuditorToken = {
    token_path: 'color.blue.500',
    token_type: 'color',
    token_value: '#3B82F6',
}

const TOKENS: AuditorToken[] = [BLUE_500_TOKEN]

// ── JSX fixture builders ──────────────────────────────────────────────────────

function makeComponent(className: string, nodeId = 'node-ing-001'): string {
    return `export default function Card() {
  return (
    <div data-flint-id="${nodeId}" className="${className}">
      Hello
    </div>
  )
}`
}

// ── ING-13: Full pipeline — tokens present → heal produces tier-1 fix ─────────

describe('ING-13: Full pipeline — tokens present → tier-1 fix applied', () => {
    it('heal() replaces exact hex arbitrary class with token class', () => {
        const code = makeComponent('bg-[#3B82F6] text-white p-4')

        const result = heal(code, TOKENS)

        // At least one tier-1 fix must have been applied
        expect(result.summary.tier1Fixed.length).toBeGreaterThanOrEqual(1)

        // The healed code must contain the token class
        expect(result.healedCode).toContain('bg-blue-500')

        // The healed code must NOT contain the original arbitrary class
        expect(result.healedCode).not.toContain('bg-[#3B82F6]')
    })

    it('the tier-1 fix record carries the correct fields', () => {
        const code = makeComponent('bg-[#3B82F6]', 'node-field-check')

        const result = heal(code, TOKENS)

        expect(result.summary.tier1Fixed.length).toBeGreaterThanOrEqual(1)

        const fix = result.summary.tier1Fixed[0]
        expect(fix.originalValue).toBe('#3B82F6')
        expect(fix.fixedToToken).toBe('color.blue.500')
        expect(fix.fixedToClass).toBe('bg-blue-500')
        expect(fix.ruleId).toBe('MITHRIL-COL')
    })

    it('heal completes within the 200ms performance budget', () => {
        const code = makeComponent('bg-[#3B82F6] text-white p-4')

        const result = heal(code, TOKENS)

        expect(result.summary.healTimeMs).toBeLessThan(200)
    })

    it('the healed code is valid JSX (parse round-trip succeeds)', async () => {
        const { parse } = await import('@babel/parser')

        const code = makeComponent('bg-[#3B82F6] text-white p-4')
        const result = heal(code, TOKENS)

        expect(() =>
            parse(result.healedCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            })
        ).not.toThrow()
    })

    it('data-flint-id is preserved verbatim after tier-1 fix', () => {
        const nodeId = 'ing-13-preserve-id'
        const code = makeComponent('bg-[#3B82F6]', nodeId)

        const result = heal(code, TOKENS)

        expect(result.healedCode).toContain(`data-flint-id="${nodeId}"`)
    })

    it('preHealCode in the summary equals the original input', () => {
        const code = makeComponent('bg-[#3B82F6] text-white')

        const result = heal(code, TOKENS)

        expect(result.summary.preHealCode).toBe(code)
    })
})

// ── ING-14: No prior tokens → heal is no-op ───────────────────────────────────

describe('ING-14: No prior tokens → heal is no-op', () => {
    it('heal() returns code unchanged when token list is empty', () => {
        const code = makeComponent('bg-[#3B82F6] text-white p-4')

        const result = heal(code, [])

        // healedCode must be byte-for-byte identical to the input
        expect(result.healedCode).toBe(code)
    })

    it('summary has zero counts when token list is empty', () => {
        const code = makeComponent('bg-[#3B82F6] gap-[16px]')

        const result = heal(code, [])

        expect(result.summary.tier1Fixed.length).toBe(0)
        expect(result.summary.tier2Flagged.length).toBe(0)
        expect(result.summary.tier3Unknown).toBe(0)
        expect(result.summary.totalValues).toBe(0)
    })

    it('heal() completes within 200ms even with empty token list (fast-exit path)', () => {
        const code = makeComponent('bg-[#3B82F6] text-white p-4')

        const result = heal(code, [])

        expect(result.summary.healTimeMs).toBeLessThan(200)
    })

    it('preHealCode is still preserved in the summary when tokens are empty', () => {
        const code = makeComponent('bg-[#3B82F6]')

        const result = heal(code, [])

        expect(result.summary.preHealCode).toBe(code)
    })

    it('heal() is a no-op for code with no arbitrary classes and empty tokens', () => {
        // Token-free AND no arbitrary classes — doubly clean
        const code = makeComponent('bg-blue-500 text-white p-4')

        const result = heal(code, [])

        expect(result.healedCode).toBe(code)
        expect(result.summary.totalValues).toBe(0)
    })
})
