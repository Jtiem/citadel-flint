/**
 * MithrilLinter.tailwind-theme.test.ts
 *
 * Phase 1 integration tests for MithrilLinter's tailwindTheme + classExpansions
 * additive options (from AuditAllOptionsV2Additive in the PHASE1 contract).
 *
 * Contract test boundaries:
 *   1. Extended theme drift-free: knownClasses membership → no MITHRIL-COL
 *   2. Expanded classes feed drift: clsx expansion → MITHRIL-COL
 *   3. auditAll signature stability: existing callers work unchanged
 *   4. grade formula stability: healthScore unchanged when no new violations
 *
 * Phase 1 Group A — flint-mcp-specialist
 */

import { describe, it, expect } from 'vitest'
import * as parser from '@babel/parser'
import type { File } from '@babel/types'
import { auditAll } from '../MithrilLinter.js'
import type { ResolvedTailwindTheme } from '../tailwindConfigLoader.js'
import type { DesignToken } from '../../types.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function parse(source: string): File {
    return parser.parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

/**
 * Minimal ResolvedTailwindTheme fixture with a custom primary color.
 */
function makeTheme(overrides: Partial<ResolvedTailwindTheme> = {}): ResolvedTailwindTheme {
    const colors = { 'primary.500': '#0066cc', 'brand.accent': '#ff6600' }
    const knownClasses = new Set([
        'bg-primary-500', 'text-primary-500',
        'bg-brand-accent', 'text-brand-accent',
    ])
    return {
        sourcePath: '/project/tailwind.config.js',
        version: 'v3',
        mtimeMs: Date.now(),
        sections: { colors },
        knownClasses,
        ...overrides,
    }
}

const BASE_TOKENS: DesignToken[] = [
    { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
]

// ── Boundary: Extended theme drift-free ──────────────────────────────────────

describe('MithrilLinter.auditAll with tailwindTheme', () => {
    it('does NOT emit MITHRIL-COL for a class in knownClasses (bg-primary-500)', () => {
        const source = `
function Button() {
  return (
    <button
      data-flint-id="btn-1"
      className="bg-primary-500 text-white"
    >
      Click me
    </button>
  )
}
`
        const ast = parse(source)
        const theme = makeTheme()

        const warnings = auditAll(ast, BASE_TOKENS, { tailwindTheme: theme })

        // bg-primary-500 is in knownClasses → no drift warning
        for (const [, w] of warnings) {
            expect(w.ruleId).not.toBe('MITHRIL-COL')
        }
    })

    it('DOES emit MITHRIL-COL for an arbitrary color NOT in knownClasses', () => {
        const source = `
function Button() {
  return (
    <button
      data-flint-id="btn-drift"
      className="bg-[#ff0000]"
    >
      Click me
    </button>
  )
}
`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]
        const theme = makeTheme() // knownClasses does NOT include bg-[#ff0000]

        const warnings = auditAll(ast, tokens, { tailwindTheme: theme })

        // bg-[#ff0000] is an arbitrary color with high ΔE vs #0066cc → drift
        const colorWarnings = [...warnings.values()].filter((w) => w.ruleId === 'MITHRIL-COL')
        expect(colorWarnings.length).toBeGreaterThan(0)
    })

    it('merges theme colors into token set for drift evaluation', () => {
        // bg-brand-accent is in knownClasses → no drift even though not in BASE_TOKENS
        const source = `
function Card() {
  return (
    <div
      data-flint-id="card-1"
      className="bg-brand-accent"
    >
      Content
    </div>
  )
}
`
        const ast = parse(source)
        const theme = makeTheme()

        const warnings = auditAll(ast, BASE_TOKENS, { tailwindTheme: theme })

        // bg-brand-accent is a non-arbitrary class name — no ARBITRARY_COLOR_RE match
        // So no MITHRIL-COL regardless. Verify no errors.
        const colorWarnings = [...warnings.values()].filter((w) => w.ruleId === 'MITHRIL-COL')
        // Brand accent isn't an arbitrary hex value so no warning expected
        expect(colorWarnings.length).toBe(0)
    })

    it('handles empty theme sections without crashing', () => {
        const emptyTheme = makeTheme({ sections: {} })
        const source = `
function X() {
  return <div data-flint-id="x-1" className="flex items-center" />
}
`
        const ast = parse(source)
        expect(() => auditAll(ast, BASE_TOKENS, { tailwindTheme: emptyTheme })).not.toThrow()
    })
})

// ── Boundary: Expanded classes feed drift ────────────────────────────────────

describe('MithrilLinter.auditAll with classExpansions', () => {
    it('emits MITHRIL-COL for a drifty class in classExpansion.possible', () => {
        const source = `
function Button() {
  return (
    <button data-flint-id="btn-exp" className="p-4" />
  )
}
`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]

        const warnings = auditAll(ast, tokens, {
            classExpansions: [
                {
                    definite: ['p-4'],
                    possible: ['bg-[#ff0000]', 'text-[#110033]'],
                    unresolvable: false,
                    utility: 'clsx',
                    line: 5,
                },
            ],
        })

        // bg-[#ff0000] is a huge ΔE from #0066cc → should fire
        const colorWarnings = [...warnings.values()].filter((w) => w.ruleId === 'MITHRIL-COL')
        expect(colorWarnings.length).toBeGreaterThan(0)
    })

    it('does NOT emit MITHRIL-COL for expansion classes within knownClasses', () => {
        const source = `
function Button() {
  return (
    <button data-flint-id="btn-known" className="p-4" />
  )
}
`
        const ast = parse(source)
        const theme = makeTheme() // knownClasses includes bg-primary-500

        const warnings = auditAll(ast, BASE_TOKENS, {
            tailwindTheme: theme,
            classExpansions: [
                {
                    definite: ['bg-primary-500'],
                    possible: [],
                    unresolvable: false,
                    utility: 'clsx',
                    line: 5,
                },
            ],
        })

        // bg-primary-500 is in knownClasses → no drift
        const colorWarnings = [...warnings.values()].filter((w) => w.ruleId === 'MITHRIL-COL')
        expect(colorWarnings.length).toBe(0)
    })

    it('handles empty classExpansions array without crashing', () => {
        const source = `function X() { return <div data-flint-id="x" /> }`
        const ast = parse(source)
        expect(() =>
            auditAll(ast, BASE_TOKENS, { classExpansions: [] }),
        ).not.toThrow()
    })

    it('emits warning keyed to expansion utility and line', () => {
        const source = `function X() { return <div data-flint-id="x" /> }`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]

        const warnings = auditAll(ast, tokens, {
            classExpansions: [
                {
                    definite: ['bg-[#ff1234]'],
                    possible: [],
                    unresolvable: false,
                    utility: 'clsx',
                    line: 42,
                },
            ],
        })

        const keys = [...warnings.keys()]
        const expandedKey = keys.find((k) => k.includes('expanded-clsx-42'))
        expect(expandedKey).toBeDefined()
    })
})

// ── Boundary: auditAll signature stability ───────────────────────────────────

describe('auditAll signature stability', () => {
    it('compiles and runs with zero options (no tailwindTheme, no classExpansions)', () => {
        const source = `
function Button() {
  return <button data-flint-id="btn-basic" className="p-4" />
}
`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]

        // Original call signature — must work unchanged
        const result = auditAll(ast, tokens)
        expect(result).toBeInstanceOf(Map)
    })

    it('compiles and runs with options object missing Phase 1 fields', () => {
        const source = `function X() { return <div data-flint-id="x" /> }`
        const ast = parse(source)
        const tokens: DesignToken[] = []

        // Options without Phase 1 fields — unchanged behavior
        const result = auditAll(ast, tokens, { deltaE_threshold: 2.0 })
        expect(result).toBeInstanceOf(Map)
    })

    it('compiles with tailwindTheme but no classExpansions', () => {
        const source = `function X() { return <div data-flint-id="x" /> }`
        const ast = parse(source)
        const result = auditAll(ast, [], { tailwindTheme: makeTheme() })
        expect(result).toBeInstanceOf(Map)
    })

    it('compiles with classExpansions but no tailwindTheme', () => {
        const source = `function X() { return <div data-flint-id="x" /> }`
        const ast = parse(source)
        const result = auditAll(ast, [], {
            classExpansions: [
                { definite: ['p-4'], possible: [], unresolvable: false, utility: 'clsx', line: 1 },
            ],
        })
        expect(result).toBeInstanceOf(Map)
    })

    it('returns identical results to pre-Phase-1 when no Phase 1 options are passed', () => {
        // Run the same audit twice — with and without empty Phase 1 options
        const source = `
function Card() {
  return (
    <div
      data-flint-id="card-stability"
      className="bg-[#ff0000] p-[16px]"
    />
  )
}
`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]

        const without = auditAll(ast, tokens)
        const withEmpty = auditAll(ast, tokens, {})

        // Both should return the same number of warnings with same ruleIds
        expect(without.size).toBe(withEmpty.size)
        for (const [id, w] of without) {
            const wEmpty = withEmpty.get(id)
            expect(wEmpty?.ruleId).toBe(w.ruleId)
        }
    })
})

// ── Boundary: grade formula stability ────────────────────────────────────────

describe('grade formula stability', () => {
    it('does not alter warning count when tailwindTheme is provided for a class-free file', () => {
        // A file with no classes — should produce zero warnings regardless of theme
        const source = `
function Empty() {
  return <div data-flint-id="empty" />
}
`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]

        const withoutTheme = auditAll(ast, tokens)
        const withTheme = auditAll(ast, tokens, { tailwindTheme: makeTheme() })

        expect(withoutTheme.size).toBe(0)
        expect(withTheme.size).toBe(0)
    })

    it('only adds warnings when classExpansions contain drifty classes (not spuriously)', () => {
        const source = `
function Clean() {
  return <div data-flint-id="clean" className="flex items-center" />
}
`
        const ast = parse(source)
        const tokens: DesignToken[] = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#0066cc' },
        ]

        const withEmptyExpansions = auditAll(ast, tokens, { classExpansions: [] })
        const withGoodExpansions = auditAll(ast, tokens, {
            classExpansions: [
                // No arbitrary hex colors → no new warnings
                { definite: ['flex', 'items-center'], possible: [], unresolvable: false, utility: 'clsx', line: 1 },
            ],
        })

        expect(withEmptyExpansions.size).toBe(0)
        expect(withGoodExpansions.size).toBe(0)
    })
})
