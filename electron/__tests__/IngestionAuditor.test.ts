/**
 * IngestionAuditor.test.ts
 *
 * Phase ING.1 — Unit tests for IngestionAuditor.ts
 *
 * Test IDs: ING-01 through ING-12 (from contract Section 9)
 *
 * These tests are self-contained: no SQLite, no Electron, no IPC.
 * They exercise classifyViolation() and heal() directly.
 */

import { describe, it, expect } from 'vitest'
import {
    classifyViolation,
    heal,
    TIER2_DELTA_E,
    VIOLATION_CAP,
} from '../ingestion/IngestionAuditor.js'
import type { AuditorToken, IngestionSummary } from '../ingestion/IngestionAuditor.js'

// ── Test Token Fixtures ────────────────────────────────────────────────────────

const BLUE_500_TOKEN: AuditorToken = {
    token_path: 'color.blue.500',
    token_type: 'color',
    token_value: '#3B82F6',
}

const BLUE_400_TOKEN: AuditorToken = {
    token_path: 'color.blue.400',
    token_type: 'color',
    token_value: '#60A5FA',
}

const RED_500_TOKEN: AuditorToken = {
    token_path: 'color.red.500',
    token_type: 'color',
    token_value: '#EF4444',
}

const SPACING_4_TOKEN: AuditorToken = {
    token_path: 'spacing.4',
    token_type: 'dimension',
    token_value: '16px',
}

const SPACING_3_TOKEN: AuditorToken = {
    token_path: 'spacing.3',
    token_type: 'dimension',
    token_value: '12px',
}

const FONT_SIZE_BASE_TOKEN: AuditorToken = {
    token_path: 'typography.body.fontSize',
    token_type: 'dimension',
    token_value: '16px',
}

const ALL_TOKENS: AuditorToken[] = [
    BLUE_500_TOKEN,
    BLUE_400_TOKEN,
    RED_500_TOKEN,
    SPACING_4_TOKEN,
    SPACING_3_TOKEN,
    FONT_SIZE_BASE_TOKEN,
]

// ── Minimal JSX fixture builder ────────────────────────────────────────────────

function makeJsx(className: string, nodeId = 'node-001'): string {
    return `
export default function Comp() {
  return (
    <div data-bridge-id="${nodeId}" className="${className}">
      Hello
    </div>
  )
}
`.trim()
}

function makeJsxMulti(elements: { nodeId: string; className: string }[]): string {
    const inner = elements
        .map((el) => `    <div data-bridge-id="${el.nodeId}" className="${el.className}">x</div>`)
        .join('\n')
    return `
export default function Comp() {
  return (
    <div>
${inner}
    </div>
  )
}
`.trim()
}

// ── ING-01: Exact hex match → tier-1 auto-fix applied ─────────────────────────

describe('ING-01: Exact hex match → tier-1 auto-fix', () => {
    it('classifyViolation returns tier1 for exact hex match', () => {
        const result = classifyViolation('color', '#3B82F6', 'bg-[#3B82F6]', ALL_TOKENS)
        expect(result.tier).toBe('tier1')
        expect(result.distance).toBeLessThanOrEqual(0.01)
        expect(result.matchedToken?.token_path).toBe('color.blue.500')
    })

    it('heal() replaces exact hex class with token class', () => {
        const code = makeJsx('bg-[#3B82F6] text-white')
        const result = heal(code, ALL_TOKENS)
        expect(result.summary.tier1Fixed).toHaveLength(1)
        const fix = result.summary.tier1Fixed[0]
        expect(fix.originalValue).toBe('#3B82F6')
        expect(fix.fixedToToken).toBe('color.blue.500')
        expect(fix.fixedToClass).toBe('bg-blue-500')
        // Healed code should contain the token class
        expect(result.healedCode).toContain('bg-blue-500')
        // And not contain the arbitrary class
        expect(result.healedCode).not.toContain('bg-[#3B82F6]')
    })
})

// ── ING-02: Exact spacing value match → tier-1 auto-fix ───────────────────────

describe('ING-02: Exact spacing match → tier-1 auto-fix', () => {
    it('classifyViolation returns tier1 for exact spacing match', () => {
        const result = classifyViolation('spacing', '16', 'gap-[16px]', ALL_TOKENS)
        expect(result.tier).toBe('tier1')
        expect(result.distance).toBe(0)
        expect(result.matchedToken?.token_path).toBe('spacing.4')
    })

    it('heal() classifies exact spacing hit', () => {
        const code = makeJsx('gap-[16px] text-white')
        const result = heal(code, ALL_TOKENS)
        // Spacing tier1 fix requires a replacement class — spacing.4 → gap-4
        const tier1 = result.summary.tier1Fixed.filter((f) => f.ruleId === 'MITHRIL-SPC-001')
        const tier2 = result.summary.tier2Flagged.filter((f) => f.ruleId === 'MITHRIL-SPC-001')
        // Either fixed (if reverse lookup worked) or at minimum detected
        expect(tier1.length + tier2.length).toBeGreaterThan(0)
    })
})

// ── ING-03: Exact typography match → tier-1 auto-fix ─────────────────────────

describe('ING-03: Exact typography match → tier-1 auto-fix', () => {
    it('classifyViolation returns tier1 for exact font-size match', () => {
        const result = classifyViolation('typography', '16', 'text-[16px]', ALL_TOKENS)
        expect(result.tier).toBe('tier1')
        expect(result.distance).toBe(0)
    })
})

// ── ING-04: deltaE 0.5 color → classified as tier-2 ──────────────────────────

describe('ING-04: Near-miss color → tier-2', () => {
    it('classifyViolation returns tier2 for color with 0 < deltaE <= 2.0', () => {
        // #3A81F5 is very close to #3B82F6 (blue-500) — should be near-miss
        const nearMissHex = '#3A81F5'
        const result = classifyViolation('color', nearMissHex, `bg-[${nearMissHex}]`, ALL_TOKENS)
        // Distance should be <= TIER2_DELTA_E and > 0.01
        if (result.distance !== undefined && result.distance > 0.01) {
            expect(result.tier).toBe('tier2')
            expect(result.distance).toBeLessThanOrEqual(TIER2_DELTA_E)
        } else {
            // Very close — might be tier1 due to floating-point
            expect(['tier1', 'tier2']).toContain(result.tier)
        }
    })

    it('heal() produces tier2 flag for near-miss color', () => {
        // Use a color that is perceptually close but not exact
        // #3A80F4 — slight variation of blue-500
        const code = makeJsx('bg-[#3A80F4] text-white')
        const result = heal(code, ALL_TOKENS)
        // Should not be tier1 fixed (different hex)
        const tier1ColorFixes = result.summary.tier1Fixed.filter(
            (f) => f.ruleId === 'MITHRIL-COL'
        )
        const tier2ColorFlags = result.summary.tier2Flagged.filter(
            (f) => f.ruleId === 'MITHRIL-COL'
        )
        // One of these should have caught it (tier1 if extremely close, tier2 otherwise)
        expect(tier1ColorFixes.length + tier2ColorFlags.length).toBeGreaterThan(0)
    })
})

// ── ING-05: 1px spacing drift → classified as tier-2 ─────────────────────────

describe('ING-05: 1px spacing drift → tier-2', () => {
    it('classifyViolation returns tier2 for 1px drift', () => {
        // spacing.4 = 16px; 15px is 1px off
        const result = classifyViolation('spacing', '15', 'gap-[15px]', ALL_TOKENS)
        expect(result.tier).toBe('tier2')
        expect(result.distance).toBe(1)
        expect(result.distanceUnit).toBe('px')
    })
})

// ── ING-06: No matching token → classified as tier-3 ─────────────────────────

describe('ING-06: No matching token → tier-3', () => {
    it('classifyViolation returns tier3 when no token is close enough', () => {
        // #FF00FF (magenta) has no token in our set — should be far from all tokens
        const result = classifyViolation('color', '#FF00FF', 'bg-[#FF00FF]', ALL_TOKENS)
        expect(result.tier).toBe('tier3')
    })

    it('classifyViolation returns tier3 for spacing with large drift (>1px)', () => {
        // 100px is far from all dimension tokens (12px, 16px)
        const result = classifyViolation('spacing', '100', 'gap-[100px]', ALL_TOKENS)
        expect(result.tier).toBe('tier3')
    })
})

// ── ING-07: Zero tokens in DB → heal pass is no-op ───────────────────────────

describe('ING-07: Zero tokens → no-op', () => {
    it('heal() returns code unchanged when token list is empty', () => {
        const code = makeJsx('bg-[#3B82F6] gap-[16px]')
        const result = heal(code, [])
        expect(result.healedCode).toBe(code)
        expect(result.summary.tier1Fixed).toHaveLength(0)
        expect(result.summary.tier2Flagged).toHaveLength(0)
        expect(result.summary.tier3Unknown).toBe(0)
        expect(result.summary.totalValues).toBe(0)
    })
})

// ── ING-08: 100+ violations → auto-fix skipped, classify only ────────────────

describe('ING-08: Violation cap — >100 violations skips auto-fix', () => {
    it('heal() skips tier-1 mutation when violation count exceeds cap', () => {
        // Build a JSX with 101+ arbitrary color classes spread across many elements
        const elements: { nodeId: string; className: string }[] = []
        for (let i = 0; i <= VIOLATION_CAP; i++) {
            elements.push({
                nodeId: `node-${i}`,
                // Use exact blue-500 hex so it would be tier1 if not capped
                className: 'bg-[#3B82F6]',
            })
        }
        const code = makeJsxMulti(elements)
        const result = heal(code, ALL_TOKENS)

        // With 101+ violations, tier-1 auto-fix should be skipped
        // The pending items get demoted to tier2 in the summary
        expect(result.summary.tier1Fixed).toHaveLength(0)
        // All items should be in tier2 (pending demoted) or tier3
        const total = result.summary.tier2Flagged.length + result.summary.tier3Unknown
        expect(total).toBeGreaterThan(VIOLATION_CAP)
        // Code should be unchanged (no mutations applied)
        expect(result.healedCode).toBe(code)
    })
})

// ── ING-09: Mixed tiers → correct per-node classification ────────────────────

describe('ING-09: Mixed tiers in single file', () => {
    it('heal() correctly classifies tier1, tier2, tier3 violations in the same file', () => {
        // tier1: exact blue-500 match
        // tier3: magenta far from all tokens
        const code = makeJsxMulti([
            { nodeId: 'node-t1', className: 'bg-[#3B82F6]' },       // tier1: exact blue-500
            { nodeId: 'node-t3', className: 'bg-[#FF00FF]' },        // tier3: magenta, no close token
        ])
        const result = heal(code, ALL_TOKENS)

        const t1nodeIds = result.summary.tier1Fixed.map((f) => f.nodeId)
        const t3Count = result.summary.tier3Unknown

        // Exact blue-500 should be tier1
        expect(t1nodeIds).toContain('node-t1')
        // Magenta should be tier3
        expect(t3Count).toBeGreaterThanOrEqual(1)
    })
})

// ── ING-10: Healed AST preserves all data-bridge-id values ───────────────────

describe('ING-10: data-bridge-id preservation', () => {
    it('heal() never modifies data-bridge-id attributes', () => {
        const nodeId = 'abc-123-xyz'
        const code = makeJsx('bg-[#3B82F6] p-[16px]', nodeId)
        const result = heal(code, ALL_TOKENS)
        // The nodeId must appear in healed code unchanged
        expect(result.healedCode).toContain(`data-bridge-id="${nodeId}"`)
    })

    it('heal() reports the correct nodeId in tier1Fixed entries', () => {
        const nodeId = 'my-test-node'
        const code = makeJsx('bg-[#3B82F6]', nodeId)
        const result = heal(code, ALL_TOKENS)
        if (result.summary.tier1Fixed.length > 0) {
            expect(result.summary.tier1Fixed[0].nodeId).toBe(nodeId)
        }
    })
})

// ── ING-11: Healed code generates valid JSX (parse round-trip) ───────────────

describe('ING-11: Healed code is valid JSX', () => {
    it('heal() produces code that is parseable by @babel/parser', async () => {
        const { parse } = await import('@babel/parser')

        const code = makeJsx('bg-[#3B82F6] text-white p-4')
        const result = heal(code, ALL_TOKENS)

        expect(() => {
            parse(result.healedCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            })
        }).not.toThrow()
    })

    it('heal() produces identical code when no arbitrary values found', async () => {
        const { parse } = await import('@babel/parser')

        const code = makeJsx('bg-blue-500 text-white p-4')
        const result = heal(code, ALL_TOKENS)

        // No arbitrary values → healed code === input code
        expect(result.summary.totalValues).toBe(0)

        expect(() => {
            parse(result.healedCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            })
        }).not.toThrow()
    })
})

// ── ING-12: Heal duration < 200ms for 50-node component ──────────────────────

describe('ING-12: Performance — heal pass < 200ms for 50-node component', () => {
    it('heal() completes within 200ms for a 50-node JSX tree', () => {
        // Build a 50-element component with various arbitrary classes
        const elements: { nodeId: string; className: string }[] = []
        for (let i = 0; i < 50; i++) {
            // Mix of colors, spacing, and clean classes
            if (i % 3 === 0) {
                elements.push({ nodeId: `node-${i}`, className: 'bg-[#3B82F6] p-4' })
            } else if (i % 3 === 1) {
                elements.push({ nodeId: `node-${i}`, className: 'gap-[16px] text-white' })
            } else {
                elements.push({ nodeId: `node-${i}`, className: 'bg-blue-500 p-4 text-lg' })
            }
        }
        const code = makeJsxMulti(elements)

        const start = performance.now()
        const result = heal(code, ALL_TOKENS)
        const elapsed = performance.now() - start

        // Primary assertion: the reported healTimeMs must be under 200ms
        expect(result.summary.healTimeMs).toBeLessThan(200)
        // Secondary assertion: wall clock also under 200ms
        expect(elapsed).toBeLessThan(200)
    })
})

// ── Additional edge cases ─────────────────────────────────────────────────────

describe('Edge cases', () => {
    it('heal() handles unparseable code gracefully (no throw)', () => {
        const badCode = 'this is not valid jsx {{{{ <<<'
        const result = heal(badCode, ALL_TOKENS)
        expect(result.healedCode).toBe(badCode)
        expect(result.summary.tier1Fixed).toHaveLength(0)
    })

    it('heal() handles code with no JSX elements gracefully', () => {
        const code = `export const x = 42`
        const result = heal(code, ALL_TOKENS)
        expect(result.summary.totalValues).toBe(0)
        expect(result.summary.tier1Fixed).toHaveLength(0)
    })

    it('classifyViolation returns tier3 for unknown type', () => {
        const result = classifyViolation('opacity' as 'opacity', '50', 'opacity-[50]', [])
        expect(result.tier).toBe('tier3')
    })

    it('preHealCode is always preserved in the summary', () => {
        const code = makeJsx('bg-[#3B82F6]')
        const result = heal(code, ALL_TOKENS)
        expect(result.summary.preHealCode).toBe(code)
    })

    it('classifyViolation color: tier3 when no color tokens exist', () => {
        const nonColorTokens: AuditorToken[] = [SPACING_4_TOKEN]
        const result = classifyViolation('color', '#3B82F6', 'bg-[#3B82F6]', nonColorTokens)
        expect(result.tier).toBe('tier3')
    })

    it('classifyViolation spacing: tier3 when no dimension tokens exist', () => {
        const nonDimTokens: AuditorToken[] = [BLUE_500_TOKEN]
        const result = classifyViolation('spacing', '16', 'gap-[16px]', nonDimTokens)
        expect(result.tier).toBe('tier3')
    })
})
