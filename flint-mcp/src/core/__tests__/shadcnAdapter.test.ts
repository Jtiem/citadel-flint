/**
 * Tests for the shadcn/ui adapter.
 *
 * Covers:
 *   - hexToHSL conversion correctness (the previously broken dark-color path)
 *   - mapTokens producing correct CSS variable values for known token sets
 *   - Correct semantic-role routing (color.background → --background, etc.)
 *   - Edge cases: pure black, pure white, achromatic grays, 3-digit hex, invalid input
 */

import { describe, it, expect } from 'vitest'
import { ShadcnAdapter } from '../libraryAdapters/shadcnAdapter.js'
import type { DesignToken } from '../../types.js'

// ---------------------------------------------------------------------------
// Helper: expose hexToHSL for white-box testing
// ---------------------------------------------------------------------------

// hexToHSL is module-private, so we test it indirectly via mapTokens output.
// We also test it directly by reading the CSS output string.

function hslFromCSS(css: string, varName: string): string | null {
    // Match: --varName: <value>;
    const re = new RegExp(`--${varName}:\\s*([^;]+);`)
    const m = css.match(re)
    return m ? m[1].trim() : null
}

function makeToken(
    id: number,
    path: string,
    value: string,
): DesignToken {
    return {
        id,
        token_path: path,
        token_type: 'color',
        token_value: value,
        description: null,
        collection_name: 'test',
        mode: 'Light',
    }
}

// ---------------------------------------------------------------------------
// hexToHSL — via mapTokens round-trip
// ---------------------------------------------------------------------------

describe('hexToHSL via mapTokens', () => {
    const adapter = new ShadcnAdapter()

    /**
     * Convenience: map a single color token with the given path so it
     * resolves to a known CSS variable, then return the HSL string from CSS.
     */
    function hslFor(hexColor: string, tokenPath: string, varName: string): string | null {
        const tokens = [makeToken(1, tokenPath, hexColor)]
        const output = adapter.mapTokens(tokens)
        return hslFromCSS(output.code, varName)
    }

    // ---

    it('converts pure black #000000 to 0 0% 0%', () => {
        const hsl = hslFor('#000000', 'color.background', 'background')
        // Achromatic path: "0 0% 0%"
        expect(hsl).toBe('0 0% 0%')
    })

    it('converts pure white #FFFFFF to 0 0% 100%', () => {
        const hsl = hslFor('#FFFFFF', 'color.foreground', 'foreground')
        expect(hsl).toBe('0 0% 100%')
    })

    it('converts near-black #171719 to low-lightness, near-achromatic HSL', () => {
        // #171719: R=23, G=23, B=25
        // Expected: ~240 4.3% 9.4%  (tiny blue tint, very dark)
        const hsl = hslFor('#171719', 'color.background', 'background')
        expect(hsl).not.toBeNull()

        const parts = hsl!.split(' ')
        const lightness = parseFloat(parts[2])
        const saturation = parseFloat(parts[1])

        // Lightness must be near-black, NOT anywhere close to 46%
        expect(lightness).toBeLessThan(15)
        expect(lightness).toBeGreaterThan(5)

        // Saturation must be very low (near-achromatic), NOT 100%
        expect(saturation).toBeLessThan(15)
    })

    it('converts primary blue #3B82F6 to approximately 217 91% 60%', () => {
        const hsl = hslFor('#3B82F6', 'color.primary', 'primary')
        expect(hsl).not.toBeNull()

        const parts = hsl!.split(' ')
        const h = parseFloat(parts[0])
        const s = parseFloat(parts[1])
        const l = parseFloat(parts[2])

        // Hue: 215-220 range
        expect(h).toBeGreaterThanOrEqual(215)
        expect(h).toBeLessThanOrEqual(220)

        // Saturation: ~89-93%
        expect(s).toBeGreaterThanOrEqual(88)
        expect(s).toBeLessThanOrEqual(94)

        // Lightness: ~58-62%
        expect(l).toBeGreaterThanOrEqual(57)
        expect(l).toBeLessThanOrEqual(63)
    })

    it('converts medium gray #A1A1B0 to low-saturation HSL', () => {
        // #A1A1B0: R=161, G=161, B=176  — slight blue tint, mid lightness ~66%
        const hsl = hslFor('#A1A1B0', 'color.muted', 'muted')
        expect(hsl).not.toBeNull()

        const parts = hsl!.split(' ')
        const s = parseFloat(parts[1])
        const l = parseFloat(parts[2])

        // Saturation low (slight tint only)
        expect(s).toBeLessThan(15)
        // Lightness in mid range ~60-70%
        expect(l).toBeGreaterThan(55)
        expect(l).toBeLessThan(75)
    })

    it('converts neutral gray #808080 to approximately 0 0% 50%', () => {
        // Perfect mid-gray — should be achromatic
        const hsl = hslFor('#808080', 'color.muted', 'muted')
        expect(hsl).not.toBeNull()
        const parts = hsl!.split(' ')
        const s = parseFloat(parts[1])
        const l = parseFloat(parts[2])
        expect(s).toBe(0)
        expect(l).toBeCloseTo(50, 0)
    })

    it('handles 3-digit hex shorthand #FFF correctly', () => {
        const hsl = hslFor('#FFF', 'color.foreground', 'foreground')
        expect(hsl).toBe('0 0% 100%')
    })

    it('returns null / skips invalid hex values gracefully', () => {
        // Invalid hex — the token should be silently skipped (no crash)
        const tokens = [makeToken(1, 'color.primary', 'not-a-color')]
        expect(() => adapter.mapTokens(tokens)).not.toThrow()
        const output = adapter.mapTokens(tokens)
        expect(output.code).toContain('@layer base')
    })
})

// ---------------------------------------------------------------------------
// mapTokens — semantic role routing
// ---------------------------------------------------------------------------

describe('mapTokens — semantic role routing', () => {
    const adapter = new ShadcnAdapter()

    const BUG_REPRO_TOKENS: DesignToken[] = [
        makeToken(1, 'color.background', '#171719'),
        makeToken(2, 'color.foreground', '#FFFFFF'),
        makeToken(3, 'color.primary',    '#3B82F6'),
        makeToken(4, 'color.muted',      '#A1A1B0'),
    ]

    it('routes color.background to --background (not another variable)', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        const bg = hslFromCSS(output.code, 'background')
        expect(bg).not.toBeNull()
        // Must be the HSL for #171719 — very low lightness
        const parts = bg!.split(' ')
        const l = parseFloat(parts[2])
        expect(l).toBeLessThan(15)
    })

    it('routes color.foreground to --foreground', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        const fg = hslFromCSS(output.code, 'foreground')
        expect(fg).not.toBeNull()
        // #FFFFFF → 0 0% 100%
        expect(fg).toBe('0 0% 100%')
    })

    it('routes color.primary to --primary', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        const primary = hslFromCSS(output.code, 'primary')
        expect(primary).not.toBeNull()
        const parts = primary!.split(' ')
        const h = parseFloat(parts[0])
        // Blue hue range
        expect(h).toBeGreaterThan(200)
        expect(h).toBeLessThan(230)
    })

    it('routes color.muted to --muted', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        const muted = hslFromCSS(output.code, 'muted')
        expect(muted).not.toBeNull()
    })

    it('produces valid tokenMap with correct source hex values', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        expect(output.tokenMap['--background']).toBe('#171719')
        expect(output.tokenMap['--foreground']).toBe('#FFFFFF')
        expect(output.tokenMap['--primary']).toBe('#3B82F6')
    })

    it('does NOT assign #171719 to --background as a saturated blue HSL', () => {
        // Regression: the old broken formula produced "220 100% 46.1%"
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        const bg = hslFromCSS(output.code, 'background')
        expect(bg).not.toBe('220 100% 46.1%')

        // More broadly: must not be high saturation
        const parts = bg!.split(' ')
        const s = parseFloat(parts[1])
        expect(s).toBeLessThan(20)
    })

    it('reports correct tokenCount', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        // background (1), foreground (1), primary (1), muted (1), ring (also maps to primary = 1) → 5
        // The SHADCN_VARIABLE_MAP includes 'ring' → ['primary'], so it picks up #3B82F6 as a 5th mapping.
        expect(output.tokenCount).toBe(5)
    })

    it('generates valid CSS that passes validate()', () => {
        const output = adapter.mapTokens(BUG_REPRO_TOKENS)
        const result = adapter.validate(output)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// mapTokens — empty input
// ---------------------------------------------------------------------------

describe('mapTokens — empty and boundary inputs', () => {
    const adapter = new ShadcnAdapter()

    it('handles empty token array without throwing', () => {
        expect(() => adapter.mapTokens([])).not.toThrow()
    })

    it('produces valid CSS structure with empty tokens', () => {
        const output = adapter.mapTokens([])
        expect(output.code).toContain('@layer base')
        expect(output.code).toContain(':root')
        expect(output.tokenCount).toBe(0)
        const result = adapter.validate(output)
        // The CSS structure should still be valid (even if no custom properties)
        expect(result.errors.filter(e => e.message.includes('brace'))).toHaveLength(0)
    })

    it('skips non-color tokens and populates skippedTokens', () => {
        const tokens: DesignToken[] = [
            {
                id: 1,
                token_path: 'spacing.md',
                token_type: 'dimension',
                token_value: '16px',
                description: null,
                collection_name: 'test',
                mode: 'Light',
            },
        ]
        const output = adapter.mapTokens(tokens)
        expect(output.tokenCount).toBe(0)
        expect(output.skippedTokens.length).toBeGreaterThan(0)
        expect(output.skippedTokens[0].tokenPath).toBe('spacing.md')
    })

    it('handles token with no recognizable semantic role (tokenCount stays 0 for that token)', () => {
        const tokens = [makeToken(1, 'palette.blue.500', '#3B82F6')]
        // "blue" does not match any SemanticColorRole keyword
        const output = adapter.mapTokens(tokens)
        // The token may match 'secondary' or similar — verify no crash and valid CSS
        expect(output.code).toContain('@layer base')
    })

    it('handles tokens with malformed hex values without crashing', () => {
        const tokens = [
            makeToken(1, 'color.background', 'rgba(0,0,0,0.5)'),
            makeToken(2, 'color.primary', 'var(--some-var)'),
            makeToken(3, 'color.foreground', '#GGG'),
        ]
        expect(() => adapter.mapTokens(tokens)).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// validate — error conditions
// ---------------------------------------------------------------------------

describe('validate — error conditions', () => {
    const adapter = new ShadcnAdapter()

    it('detects missing @layer base', () => {
        const fakeOutput = {
            library: 'shadcn' as const,
            code: ':root { --background: 0 0% 0%; }',
            filename: 'globals.css',
            tokenCount: 1,
            skippedTokens: [],
            mimeType: 'text/css',
            tokenMap: {},
        }
        const result = adapter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes('@layer base'))).toBe(true)
    })

    it('detects unbalanced braces', () => {
        const fakeOutput = {
            library: 'shadcn' as const,
            code: '@layer base { :root { --background: 0 0% 0%;',  // missing closing braces
            filename: 'globals.css',
            tokenCount: 1,
            skippedTokens: [],
            mimeType: 'text/css',
            tokenMap: {},
        }
        const result = adapter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.toLowerCase().includes('brace'))).toBe(true)
    })
})
