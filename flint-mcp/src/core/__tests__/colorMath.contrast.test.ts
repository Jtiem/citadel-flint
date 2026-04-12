/**
 * colorMath.contrast.test.ts — Tests for WCAG contrast ratio utilities
 *
 * P1a: Contrast-aware token matching (Mithril Linter Hardening)
 */

import { describe, it, expect } from 'vitest'
import {
    computeContrastRatio,
    findClosestCompliantToken,
    relativeLuminance,
} from '../colorMath.js'

// ── computeContrastRatio ────────────────────────────────────────────────────

describe('computeContrastRatio', () => {
    it('white on black = 21:1', () => {
        const ratio = computeContrastRatio('#ffffff', '#000000')
        expect(ratio).not.toBeNull()
        expect(ratio!).toBeCloseTo(21, 0)
    })

    it('same color = 1:1', () => {
        const ratio = computeContrastRatio('#ff0000', '#ff0000')
        expect(ratio).not.toBeNull()
        expect(ratio!).toBeCloseTo(1, 2)
    })

    it('returns a known WCAG AA pass (>=4.5:1)', () => {
        // Dark blue text on white background
        const ratio = computeContrastRatio('#1a237e', '#ffffff')
        expect(ratio).not.toBeNull()
        expect(ratio!).toBeGreaterThanOrEqual(4.5)
    })

    it('returns a known WCAG AA fail (<4.5:1)', () => {
        // Light gray text on white background
        const ratio = computeContrastRatio('#cccccc', '#ffffff')
        expect(ratio).not.toBeNull()
        expect(ratio!).toBeLessThan(4.5)
    })

    it('large text threshold (3:1)', () => {
        // Medium gray on white — should pass 3:1 but fail 4.5:1
        const ratio = computeContrastRatio('#767676', '#ffffff')
        expect(ratio).not.toBeNull()
        // #767676 on white is approximately 4.54:1 — the canonical WCAG AA boundary
        // Use a lighter gray to get below 4.5 but above 3
        const ratio2 = computeContrastRatio('#888888', '#ffffff')
        expect(ratio2).not.toBeNull()
        expect(ratio2!).toBeGreaterThanOrEqual(3)
        expect(ratio2!).toBeLessThan(4.5)
    })

    it('returns null for invalid hex', () => {
        expect(computeContrastRatio('#zzzzzz', '#ffffff')).toBeNull()
        expect(computeContrastRatio('#ffffff', 'not-a-color')).toBeNull()
    })

    it('order of arguments does not matter (commutative)', () => {
        const ab = computeContrastRatio('#336699', '#ffffff')
        const ba = computeContrastRatio('#ffffff', '#336699')
        expect(ab).not.toBeNull()
        expect(ba).not.toBeNull()
        expect(ab!).toBeCloseTo(ba!, 5)
    })
})

// ── relativeLuminance ───────────────────────────────────────────────────────

describe('relativeLuminance', () => {
    it('white = 1.0', () => {
        expect(relativeLuminance('#ffffff')).toBeCloseTo(1.0, 2)
    })

    it('black = 0.0', () => {
        expect(relativeLuminance('#000000')).toBeCloseTo(0.0, 2)
    })

    it('returns null for invalid hex', () => {
        expect(relativeLuminance('nope')).toBeNull()
    })
})

// ── findClosestCompliantToken ───────────────────────────────────────────────

describe('findClosestCompliantToken', () => {
    const tokens = [
        { token_path: 'color/dark', token_type: 'color', token_value: '#1a1a1a' },
        { token_path: 'color/light', token_type: 'color', token_value: '#f0f0f0' },
        { token_path: 'color/mid-gray', token_type: 'color', token_value: '#999999' },
        { token_path: 'color/spacing', token_type: 'dimension', token_value: '16px' },
    ]

    it('picks compliant over closer non-compliant', () => {
        // Very dark text (#1b1b1b) on a dark background (#1f1f1f).
        // color/dark (#1a1a1a) is perceptually closest but fails contrast against #1f1f1f.
        // color/mid-gray (#999999) also fails (ratio ~4.1).
        // color/light (#f0f0f0) passes contrast.
        // Use a narrow set of tokens where only one passes.
        const narrowTokens = [
            { token_path: 'color/near-black', token_type: 'color', token_value: '#1a1a1a' },
            { token_path: 'color/white', token_type: 'color', token_value: '#f0f0f0' },
        ]
        const result = findClosestCompliantToken('#1b1b1b', narrowTokens, '#1f1f1f', 4.5)
        expect(result).not.toBeNull()
        expect(result!.tokenPath).toBe('color/white')
        expect(result!.meetsContrast).toBe(true)
    })

    it('falls back to nearest when no compliant exists', () => {
        // All tokens fail contrast against this paired color — fall back to nearest
        // Use a color that makes everything fail: mid-luminance that ruins contrast for all
        const narrowTokens = [
            { token_path: 'color/a', token_type: 'color', token_value: '#808080' },
            { token_path: 'color/b', token_type: 'color', token_value: '#7f7f7f' },
        ]
        // Both grays against a gray background = low contrast
        const result = findClosestCompliantToken('#808181', narrowTokens, '#808080', 4.5)
        expect(result).not.toBeNull()
        // Should fall back to the nearest perceptual match
        expect(result!.tokenPath).toBe('color/a')
        expect(result!.meetsContrast).toBe(false)
    })

    it('no pairedColor = same as perceptual-only matching (findClosestToken behavior)', () => {
        // Without a pairedColor, it should just find the closest by deltaE
        const result = findClosestCompliantToken('#1b1b1b', tokens)
        expect(result).not.toBeNull()
        expect(result!.tokenPath).toBe('color/dark') // closest perceptually
        expect(result!.meetsContrast).toBe(true) // no paired color → always true
    })

    it('respects large text threshold (3:1)', () => {
        // Use a lower contrast threshold
        const result = findClosestCompliantToken('#1b1b1b', tokens, '#222222', 3.0)
        expect(result).not.toBeNull()
        // At 3:1, more tokens might qualify. color/mid-gray on #222222 may pass.
        expect(result!.meetsContrast).toBe(true)
    })

    it('ignores non-color tokens', () => {
        const result = findClosestCompliantToken('#1a1a1a', tokens)
        expect(result).not.toBeNull()
        // Should never match the dimension token
        expect(result!.tokenPath).not.toBe('color/spacing')
    })

    it('returns null when no color tokens exist', () => {
        const noColors = [
            { token_path: 'spacing/sm', token_type: 'dimension', token_value: '8px' },
        ]
        expect(findClosestCompliantToken('#ff0000', noColors)).toBeNull()
    })

    it('returns null for invalid hex input', () => {
        expect(findClosestCompliantToken('not-hex', tokens)).toBeNull()
    })
})
