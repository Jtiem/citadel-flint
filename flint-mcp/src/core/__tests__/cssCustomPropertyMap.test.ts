/**
 * cssCustomPropertyMap.test.ts
 *
 * Contract test boundaries (from PHASE2 contract):
 *   1. Single-file: map populated correctly from parsed stylesheet
 *   2. Multi-file merge: last-wins on conflict
 *   3. Chained var(--a, var(--b, #fff)) resolves correctly
 *   4. Chain with only --a present → returns --a value
 *   5. Chain with neither --a nor --b present → returns literal #fff fallback
 *   6. Cyclic reference --a: var(--b); --b: var(--a); → returns null (no infinite loop)
 *   7. Empty map → any var() returns null unless fallback is literal
 *
 * Phase 2 Group A — flint-mcp-specialist
 */

import { describe, it, expect } from 'vitest'
import {
    buildCustomPropertyMap,
    buildCustomPropertyMapFromSheets,
    resolveCssVar,
} from '../cssCustomPropertyMap.js'
import type { ParsedStylesheet } from '../cssStylesheetLoader.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSheet(
    sourcePath: string,
    props: Record<string, string>,
    overrides: Partial<ParsedStylesheet> = {},
): ParsedStylesheet {
    return {
        sourcePath,
        syntax: 'css',
        mtimeMs: Date.now(),
        customProperties: Object.entries(props).map(([name, value]) => ({
            name,
            value,
            selector: ':root',
            line: 1,
        })),
        themeBlocks: [],
        keyframes: [],
        applyDirectives: [],
        ...overrides,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildCustomPropertyMap', () => {
    it('1. populates map from a single parsed stylesheet', () => {
        const sheet = makeSheet('/app/tokens.css', {
            '--primary': '#0066cc',
            '--secondary': '#cc6600',
        })

        const map = buildCustomPropertyMap([sheet])

        expect(map.map.get('--primary')).toBe('#0066cc')
        expect(map.map.get('--secondary')).toBe('#cc6600')
        expect(map.sourcePaths).toContain('/app/tokens.css')
    })

    it('2. multi-file merge: last-import wins on conflict', () => {
        const sheet1 = makeSheet('/app/base.css', { '--primary': '#0000ff' })
        const sheet2 = makeSheet('/app/brand.css', { '--primary': '#0066cc' })

        const map = buildCustomPropertyMap([sheet1, sheet2])

        // sheet2 is last → wins
        expect(map.map.get('--primary')).toBe('#0066cc')
        expect(map.sourcePaths).toContain('/app/base.css')
        expect(map.sourcePaths).toContain('/app/brand.css')
    })

    it('2b. first-import wins when listed first (reverse order)', () => {
        const sheet1 = makeSheet('/app/brand.css', { '--primary': '#0066cc' })
        const sheet2 = makeSheet('/app/base.css', { '--primary': '#0000ff' })

        const map = buildCustomPropertyMap([sheet1, sheet2])

        // sheet2 is last → wins
        expect(map.map.get('--primary')).toBe('#0000ff')
    })

    it('skips ok: false stylesheets silently', () => {
        const sheet = makeSheet('/app/good.css', { '--primary': '#0066cc' })
        const badEntry = { ok: false } as unknown as ParsedStylesheet

        const map = buildCustomPropertyMap([badEntry, sheet])

        expect(map.map.get('--primary')).toBe('#0066cc')
        // sourcePaths should not contain an entry for the bad sheet
        expect(map.sourcePaths).not.toContain(undefined)
    })

    it('returns empty map for empty input', () => {
        const map = buildCustomPropertyMap([])
        expect(map.map.size).toBe(0)
        expect(map.sourcePaths.length).toBe(0)
    })
})

describe('CustomPropertyMap.resolve', () => {
    it('3. resolves chained var(--a, var(--b, #fff)) when both --a and --b are missing', () => {
        const map = buildCustomPropertyMap([])
        // Neither --a nor --b in map → resolve to literal #fff
        const result = map.resolve('var(--a, var(--b, #fff))')
        expect(result).toBe('#fff')
    })

    it('3b. resolves chained var(--a, var(--b, #fff)) when --a is present', () => {
        const sheet = makeSheet('/tokens.css', { '--a': '#0066cc' })
        const map = buildCustomPropertyMap([sheet])

        const result = map.resolve('var(--a, var(--b, #fff))')
        expect(result).toBe('#0066cc')
    })

    it('3c. resolves chained var(--a, var(--b, #fff)) when only --b is present', () => {
        const sheet = makeSheet('/tokens.css', { '--b': '#cc6600' })
        const map = buildCustomPropertyMap([sheet])

        const result = map.resolve('var(--a, var(--b, #fff))')
        expect(result).toBe('#cc6600')
    })

    it('4. returns --a value when only --a is present (no fallback needed)', () => {
        const sheet = makeSheet('/tokens.css', { '--a': '#0066cc' })
        const map = buildCustomPropertyMap([sheet])

        const result = map.resolve('var(--a)')
        expect(result).toBe('#0066cc')
    })

    it('4b. resolves chain var(--a, var(--b, #fff)) with only --a → returns --a value', () => {
        const sheet = makeSheet('/tokens.css', { '--a': '#aabbcc' })
        const map = buildCustomPropertyMap([sheet])

        const result = map.resolve('var(--a, var(--b, #fff))')
        expect(result).toBe('#aabbcc')
    })

    it('5. returns literal #fff when neither --a nor --b is present', () => {
        const map = buildCustomPropertyMap([])

        const result = map.resolve('var(--a, var(--b, #fff))')
        expect(result).toBe('#fff')
    })

    it('6. returns null for cyclic references without infinite loop', () => {
        // --a: var(--b); --b: var(--a)
        const sheet = makeSheet('/tokens.css', {
            '--a': 'var(--b)',
            '--b': 'var(--a)',
        })
        const map = buildCustomPropertyMap([sheet])

        const start = Date.now()
        const result = map.resolve('var(--a)')
        const elapsed = Date.now() - start

        expect(result).toBeNull()
        // Should terminate quickly — not loop indefinitely
        expect(elapsed).toBeLessThan(100)
    })

    it('6b. three-way cycle also terminates', () => {
        const sheet = makeSheet('/tokens.css', {
            '--a': 'var(--b)',
            '--b': 'var(--c)',
            '--c': 'var(--a)',
        })
        const map = buildCustomPropertyMap([sheet])

        const result = map.resolve('var(--a)')
        expect(result).toBeNull()
    })

    it('7. empty map → var() with no fallback returns null', () => {
        const map = buildCustomPropertyMap([])
        expect(map.resolve('var(--primary)')).toBeNull()
    })

    it('7b. empty map → var() with literal fallback returns the literal', () => {
        const map = buildCustomPropertyMap([])
        expect(map.resolve('var(--primary, #0066cc)')).toBe('#0066cc')
    })

    it('resolves transitively chained properties in the map', () => {
        const sheet = makeSheet('/tokens.css', {
            '--brand': 'var(--primary)',
            '--primary': '#0066cc',
        })
        const map = buildCustomPropertyMap([sheet])

        expect(map.resolve('var(--brand)')).toBe('#0066cc')
    })

    it('handles bare property name as input', () => {
        const sheet = makeSheet('/tokens.css', { '--primary': '#0066cc' })
        const map = buildCustomPropertyMap([sheet])

        expect(map.resolve('--primary')).toBe('#0066cc')
    })

    it('returns null for missing bare property name', () => {
        const map = buildCustomPropertyMap([])
        expect(map.resolve('--missing')).toBeNull()
    })
})

describe('buildCustomPropertyMapFromSheets', () => {
    it('is equivalent to buildCustomPropertyMap for ParsedStylesheet[]', () => {
        const sheets = [
            makeSheet('/a.css', { '--x': 'red' }),
            makeSheet('/b.css', { '--y': 'blue' }),
        ]

        const map1 = buildCustomPropertyMap(sheets)
        const map2 = buildCustomPropertyMapFromSheets(sheets)

        expect(map1.map.get('--x')).toBe(map2.map.get('--x'))
        expect(map1.map.get('--y')).toBe(map2.map.get('--y'))
    })
})

describe('resolveCssVar (standalone helper)', () => {
    it('resolves var(--primary) from a raw Map', () => {
        const rawMap = new Map([['--primary', '#0066cc']])
        expect(resolveCssVar('var(--primary)', rawMap)).toBe('#0066cc')
    })

    it('returns null for missing key in raw Map', () => {
        const rawMap = new Map<string, string>()
        expect(resolveCssVar('var(--missing)', rawMap)).toBeNull()
    })

    it('resolves fallback when key missing in raw Map', () => {
        const rawMap = new Map<string, string>()
        expect(resolveCssVar('var(--missing, #fff)', rawMap)).toBe('#fff')
    })
})
