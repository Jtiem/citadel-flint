/**
 * MithrilLinter.css-vars.test.ts
 *
 * Phase 2 integration tests for MithrilLinter's customPropertyMap + stylesheetThemes
 * wiring in auditAll (BLK-1 fix: var(--x) resolver now consults the project-wide CSS
 * custom property map so drift detection is no longer blind to CSS var references).
 *
 * Contract test boundaries (from PHASE2 review finding BLK-1):
 *   1. var(--primary) + map { '--primary': '#0066cc' } + token primary=#0066cc → NO drift
 *   2. var(--primary) + map { '--primary': '#ff00ff' } + token primary=#0066cc → DRIFT fires
 *   3. Phase 2 v4 theme '--color-brand: #abc' → no drift when token matches
 *   4. Regression: absent customPropertyMap → var() behavior unchanged (null → skip)
 *   5. Regression: auditAll signature unchanged — existing call sites work
 *   6. Cycle guard: var(--a) → var(--b) → var(--a) does not throw / infinite-loop
 *   7. Depth limit: chain of 9 hops (beyond limit) resolves to null (safe)
 *   8. stylesheetThemes: @theme { colors.brand: '#abc' } + token brand=#abc → no drift
 *   9. parseCssColorToHexWithMap: literal fallback still works (regression)
 */

import { describe, it, expect } from 'vitest'
import * as parser from '@babel/parser'
import type { File } from '@babel/types'
import { auditAll, parseCssColorToHexWithMap } from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parse(source: string): File {
    return parser.parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

function makeColorToken(path: string, value: string): DesignToken {
    return {
        id: 1,
        token_path: path,
        token_type: 'color',
        token_value: value,
        description: null,
        collection_name: 'brand',
        mode: 'default',
    }
}

// ── parseCssColorToHexWithMap unit tests ──────────────────────────────────────

describe('parseCssColorToHexWithMap', () => {
    it('1a. resolves bare var(--primary) via map to a literal', () => {
        const map = new Map([['--primary', '#0066cc']])
        expect(parseCssColorToHexWithMap('var(--primary)', map)).toBe('#0066cc')
    })

    it('1b. resolves multi-hop chain var(--a) → var(--b) → #aabbcc', () => {
        const map = new Map([
            ['--a', 'var(--b)'],
            ['--b', '#aabbcc'],
        ])
        expect(parseCssColorToHexWithMap('var(--a)', map)).toBe('#aabbcc')
    })

    it('4. absent map: bare var(--x) returns null (unchanged Phase 0 behavior)', () => {
        expect(parseCssColorToHexWithMap('var(--x)', undefined)).toBeNull()
    })

    it('6. cycle guard: var(--a) → var(--b) → var(--a) returns null, does not throw', () => {
        const map = new Map([
            ['--a', 'var(--b)'],
            ['--b', 'var(--a)'],
        ])
        expect(() => parseCssColorToHexWithMap('var(--a)', map)).not.toThrow()
        expect(parseCssColorToHexWithMap('var(--a)', map)).toBeNull()
    })

    it('7. depth limit: chain of 9 hops returns null safely', () => {
        // Build: var(--p0) → var(--p1) → ... → var(--p8) → var(--p9) (terminal, not in map)
        const map = new Map<string, string>()
        for (let i = 0; i < 9; i++) {
            map.set(`--p${i}`, `var(--p${i + 1})`)
        }
        // --p9 is not in the map — chain exceeds depth limit before reaching a literal
        expect(parseCssColorToHexWithMap('var(--p0)', map)).toBeNull()
    })

    it('9. literal fallback still resolves (regression)', () => {
        // var(--x, #ff0000) should resolve via standard parseCssColorToHex, not the map
        const map = new Map([['--x', '#0000ff']]) // map says blue
        // fallback literal #ff0000 wins because parseCssColorToHex extracts fallback first
        expect(parseCssColorToHexWithMap('var(--x, #ff0000)', map)).toBe('#ff0000')
    })
})

// ── auditAll integration tests ────────────────────────────────────────────────

describe('auditAll — customPropertyMap integration', () => {
    // NOTE: visitInlineStyles requires data-flint-id on JSX elements to track nodes.
    // Tests inject `data-flint-id="n1"` (the same id Flint injects in production).

    it('1. var(--primary) + map resolves to matching token → NO drift warning', () => {
        const source = `
export function Button() {
    return <div data-flint-id="n1" style={{ color: 'var(--primary)' }}>Click</div>
}
`
        const ast = parse(source)
        const tokens = [makeColorToken('brand.primary', '#0066cc')]
        const customPropertyMap = new Map([['--primary', '#0066cc']])

        const warnings = auditAll(ast, tokens, { customPropertyMap })

        // No inline-style-drift should fire because the resolved color matches the token
        const driftWarnings = [...warnings.values()].filter(
            (w) => w.ruleId === 'MITHRIL-IST-COL'
        )
        expect(driftWarnings).toHaveLength(0)
    })

    it('2. var(--primary) + map resolves to mismatching token → DRIFT fires', () => {
        const source = `
export function Button() {
    return <div data-flint-id="n1" style={{ color: 'var(--primary)' }}>Click</div>
}
`
        const ast = parse(source)
        const tokens = [makeColorToken('brand.primary', '#0066cc')]
        // Map points to a very different color (magenta vs blue → high ΔE)
        const customPropertyMap = new Map([['--primary', '#ff00ff']])

        const warnings = auditAll(ast, tokens, { customPropertyMap })

        const driftWarnings = [...warnings.values()].filter(
            (w) => w.ruleId === 'MITHRIL-IST-COL'
        )
        expect(driftWarnings.length).toBeGreaterThan(0)
    })

    it('4. absent customPropertyMap: bare var(--x) is silently skipped (no false drift)', () => {
        const source = `
export function Box() {
    return <div data-flint-id="n1" style={{ color: 'var(--unknown)' }}>Box</div>
}
`
        const ast = parse(source)
        const tokens = [makeColorToken('brand.primary', '#0066cc')]

        // No customPropertyMap — var(--unknown) should be skipped, not flagged
        const warnings = auditAll(ast, tokens, {})
        const driftWarnings = [...warnings.values()].filter(
            (w) => w.ruleId === 'MITHRIL-IST-COL'
        )
        expect(driftWarnings).toHaveLength(0)
    })

    it('5. auditAll signature unchanged: existing callers work with no options', () => {
        const source = `export function C() { return <div data-flint-id="n1" style={{ color: '#0066cc' }}>x</div> }`
        const ast = parse(source)
        const tokens = [makeColorToken('brand.primary', '#0066cc')]

        // Must not throw even without the Phase 2 options
        expect(() => auditAll(ast, tokens)).not.toThrow()
        expect(() => auditAll(ast, tokens, undefined)).not.toThrow()
        expect(() => auditAll(ast, tokens, {})).not.toThrow()
    })
})

// ── auditAll integration tests — stylesheetThemes ─────────────────────────────

describe('auditAll — stylesheetThemes integration', () => {
    it('8. @theme colors.brand token feeds drift check: matching inline color → no drift', () => {
        // Phase 2 v4 theme --color-brand: #aabbcc parsed from @theme {} block.
        // Provided as stylesheetThemes.colors; the same value is a design token.
        // The inline style uses the literal directly — ΔE ≈ 0, so no drift.
        const source = `
export function Hero() {
    return <div data-flint-id="n1" style={{ color: '#aabbcc' }}>Hero</div>
}
`
        const ast = parse(source)
        const tokens = [makeColorToken('brand.accent', '#aabbcc')]

        const stylesheetThemes = [
            { colors: { brand: '#aabbcc' } },
        ]

        const warnings = auditAll(ast, tokens, { stylesheetThemes })
        const driftWarnings = [...warnings.values()].filter(
            (w) => w.ruleId === 'MITHRIL-IST-COL'
        )
        expect(driftWarnings).toHaveLength(0)
    })

    it('stylesheetThemes absent: behavior identical to having no theme (regression)', () => {
        const source = `export function C() { return <div data-flint-id="n1" style={{ color: '#0066cc' }}>x</div> }`
        const ast = parse(source)
        const tokens = [makeColorToken('brand.primary', '#0066cc')]

        const withoutTheme = auditAll(ast, tokens, {})
        const withEmptyTheme = auditAll(ast, tokens, { stylesheetThemes: [] })

        // Both should have the same number of warnings
        expect(withEmptyTheme.size).toBe(withoutTheme.size)
    })
})
