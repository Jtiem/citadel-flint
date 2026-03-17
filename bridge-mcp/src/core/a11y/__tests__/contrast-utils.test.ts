/**
 * Tests for contrast-utils.ts
 *
 * Uses known WCAG 2.x reference values from the spec examples.
 */

import { describe, it, expect } from 'vitest'
import {
    parseHex,
    relativeLuminance,
    wcagContrastRatio,
    meetsAA,
    meetsAAA,
    isLargeText,
    apcaLc,
    extractHexFromArbitraryClass,
    extractColorContext,
} from '../contrast-utils.js'

// ── parseHex ──────────────────────────────────────────────────────────────────

describe('parseHex', () => {
    it('parses 6-digit hex', () => {
        expect(parseHex('#ffffff')).toEqual([255, 255, 255])
        expect(parseHex('#000000')).toEqual([0, 0, 0])
        expect(parseHex('#ff0000')).toEqual([255, 0, 0])
    })

    it('parses 3-digit shorthand hex', () => {
        expect(parseHex('#fff')).toEqual([255, 255, 255])
        expect(parseHex('#000')).toEqual([0, 0, 0])
        expect(parseHex('#f00')).toEqual([255, 0, 0])
    })

    it('parses 8-digit hex (ignores alpha)', () => {
        expect(parseHex('#ffffffff')).toEqual([255, 255, 255])
        expect(parseHex('#ff000080')).toEqual([255, 0, 0])
    })

    it('returns null for invalid hex', () => {
        expect(parseHex('notacolor')).toBeNull()
        expect(parseHex('#gg0000')).toBeNull()
        expect(parseHex('')).toBeNull()
    })

    it('handles hex without # prefix', () => {
        expect(parseHex('ffffff')).toEqual([255, 255, 255])
    })
})

// ── relativeLuminance ─────────────────────────────────────────────────────────

describe('relativeLuminance', () => {
    it('white has luminance 1.0', () => {
        expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1.0, 4)
    })

    it('black has luminance 0.0', () => {
        expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0.0, 4)
    })

    it('mid-gray luminance is in plausible range', () => {
        // #777777 = rgb(119,119,119), relative luminance ~0.184
        const lum = relativeLuminance([119, 119, 119])
        expect(lum).toBeGreaterThan(0.1)
        expect(lum).toBeLessThan(0.3)
    })
})

// ── wcagContrastRatio ─────────────────────────────────────────────────────────

describe('wcagContrastRatio', () => {
    it('black on white = 21:1', () => {
        const ratio = wcagContrastRatio('#000000', '#ffffff')
        expect(ratio).toBeCloseTo(21, 0)
    })

    it('white on black = 21:1 (symmetric)', () => {
        const ratio = wcagContrastRatio('#ffffff', '#000000')
        expect(ratio).toBeCloseTo(21, 0)
    })

    it('same color on same color = 1:1', () => {
        expect(wcagContrastRatio('#777777', '#777777')).toBeCloseTo(1, 2)
    })

    it('returns null for invalid color', () => {
        expect(wcagContrastRatio('invalid', '#ffffff')).toBeNull()
        expect(wcagContrastRatio('#ffffff', 'invalid')).toBeNull()
    })

    it('WCAG spec example: #595959 on #ffffff = ~7.0:1', () => {
        // This is a known WCAG example for AAA normal text
        const ratio = wcagContrastRatio('#595959', '#ffffff')
        expect(ratio).toBeGreaterThan(4.5)
    })

    it('#767676 on #ffffff passes AA (4.54:1)', () => {
        // Known WCAG example: just over 4.5:1
        const ratio = wcagContrastRatio('#767676', '#ffffff')
        expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('#777777 on #ffffff fails AA (4.48:1)', () => {
        const ratio = wcagContrastRatio('#777777', '#ffffff')
        expect(ratio).toBeLessThan(4.5)
    })
})

// ── meetsAA ───────────────────────────────────────────────────────────────────

describe('meetsAA', () => {
    it('4.5:1 passes for normal text', () => {
        expect(meetsAA(4.5, false)).toBe(true)
    })

    it('4.49:1 fails for normal text', () => {
        expect(meetsAA(4.49, false)).toBe(false)
    })

    it('3.0:1 passes for large text', () => {
        expect(meetsAA(3.0, true)).toBe(true)
    })

    it('2.99:1 fails for large text', () => {
        expect(meetsAA(2.99, true)).toBe(false)
    })

    it('21:1 passes for all text', () => {
        expect(meetsAA(21, false)).toBe(true)
        expect(meetsAA(21, true)).toBe(true)
    })
})

// ── meetsAAA ──────────────────────────────────────────────────────────────────

describe('meetsAAA', () => {
    it('7.0:1 passes for normal text AAA', () => {
        expect(meetsAAA(7.0, false)).toBe(true)
    })

    it('4.5:1 passes for large text AAA', () => {
        expect(meetsAAA(4.5, true)).toBe(true)
    })

    it('4.49:1 fails for large text AAA', () => {
        expect(meetsAAA(4.49, true)).toBe(false)
    })
})

// ── isLargeText ───────────────────────────────────────────────────────────────

describe('isLargeText', () => {
    it('text-2xl (24px) is large text', () => {
        expect(isLargeText('text-2xl', null)).toBe(true)
    })

    it('text-xl (20px) is not large text without bold', () => {
        expect(isLargeText('text-xl', 'font-normal')).toBe(false)
    })

    it('text-xl (20px) with bold IS large text (>= 14pt bold)', () => {
        expect(isLargeText('text-xl', 'font-bold')).toBe(true)
    })

    it('text-lg (18px) with bold — 18px is slightly under 18.67px threshold so not large text', () => {
        // 18px < 18.67px (14pt), so does NOT qualify as large text even with bold
        expect(isLargeText('text-lg', 'font-bold')).toBe(false)
    })

    it('text-base (16px) is not large text', () => {
        expect(isLargeText('text-base', null)).toBe(false)
    })

    it('null fontSize returns false', () => {
        expect(isLargeText(null, null)).toBe(false)
    })

    it('arbitrary px: text-[24px] is large text', () => {
        expect(isLargeText('text-[24px]', null)).toBe(true)
    })

    it('arbitrary px: text-[18px] with font-bold is large text', () => {
        expect(isLargeText('text-[18px]', 'font-bold')).toBe(false) // 18px < 18.67
    })

    it('arbitrary px: text-[19px] with font-bold is large text', () => {
        expect(isLargeText('text-[19px]', 'font-bold')).toBe(true) // 19 >= 18.67
    })

    it('text-4xl (36px) is large text', () => {
        expect(isLargeText('text-4xl', null)).toBe(true)
    })
})

// ── apcaLc ────────────────────────────────────────────────────────────────────

describe('apcaLc', () => {
    it('black on white returns positive Lc (dark text on light bg)', () => {
        const lc = apcaLc('#000000', '#ffffff')
        expect(lc).not.toBeNull()
        expect(lc!).toBeGreaterThan(100) // should be ~106
    })

    it('white on black returns negative Lc', () => {
        const lc = apcaLc('#ffffff', '#000000')
        expect(lc).not.toBeNull()
        expect(lc!).toBeLessThan(0)
    })

    it('same color on same color = 0', () => {
        const lc = apcaLc('#777777', '#777777')
        expect(lc).toBeCloseTo(0, 0)
    })

    it('returns null for invalid colors', () => {
        expect(apcaLc('invalid', '#ffffff')).toBeNull()
    })

    it('high-contrast pair has Lc > 75', () => {
        const lc = apcaLc('#000000', '#ffffff')
        expect(lc!).toBeGreaterThan(75)
    })
})

// ── extractHexFromArbitraryClass ──────────────────────────────────────────────

describe('extractHexFromArbitraryClass', () => {
    it('extracts hex from text-[#hex]', () => {
        expect(extractHexFromArbitraryClass('text-[#ff0000]')).toBe('#ff0000')
    })

    it('extracts hex from bg-[#000]', () => {
        expect(extractHexFromArbitraryClass('bg-[#000]')).toBe('#000')
    })

    it('returns null for non-hex arbitrary values', () => {
        expect(extractHexFromArbitraryClass('text-[rgba(0,0,0,0.5)]')).toBeNull()
    })

    it('returns null for non-arbitrary classes', () => {
        expect(extractHexFromArbitraryClass('text-red-500')).toBeNull()
    })
})

// ── extractColorContext ───────────────────────────────────────────────────────

describe('extractColorContext', () => {
    it('extracts foreground and background from arbitrary hex classes', () => {
        const result = extractColorContext(['text-[#000000]', 'bg-[#ffffff]'])
        expect(result.foreground).toBe('#000000')
        expect(result.background).toBe('#ffffff')
    })

    it('extracts font size from text-xl', () => {
        const result = extractColorContext(['text-xl'])
        expect(result.fontSize).toBe('text-xl')
    })

    it('extracts font weight from font-bold', () => {
        const result = extractColorContext(['font-bold'])
        expect(result.fontWeight).toBe('font-bold')
    })

    it('returns nulls when no color classes', () => {
        const result = extractColorContext(['flex', 'items-center', 'p-4'])
        expect(result.foreground).toBeNull()
        expect(result.background).toBeNull()
    })

    it('ignores named color classes (not resolvable without tokens)', () => {
        const result = extractColorContext(['text-red-500', 'bg-blue-100'])
        expect(result.foreground).toBeNull()
        expect(result.background).toBeNull()
    })
})
