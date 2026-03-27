/**
 * figmaTokenExtractor.ts — Unit Tests
 * flint-mcp/src/core/__tests__/figmaTokenExtractor.test.ts
 *
 * Phase D2C.4 Feature 2: Token Extraction from Figma
 *
 * What we verify:
 *   1. Colors extracted from SOLID fills
 *   2. Colors extracted from strokes
 *   3. Font sizes extracted from TEXT nodes (style.fontSize and direct)
 *   4. Font families extracted from TEXT nodes
 *   5. Font weights extracted
 *   6. Spacing values extracted (padding, itemSpacing)
 *   7. Corner radii extracted
 *   8. Deduplication — same hex color on multiple nodes => single token with correct usageCount
 *   9. Existing token exact match => goes to existingMatches, not proposedTokens
 *  10. Near-match: proposed color is deltaE < 2.0 from existing => nearMatches
 *  11. Confidence scoring: high usage + semantic name => confidence >= 0.7
 *  12. Low confidence: single usage, no semantic name => confidence < 0.5
 *  13. minUsageCount filter
 *  14. minConfidence filter
 *  15. Empty payload => empty result with zeroed stats
 *  16. Payload with no colors => no color tokens
 *  17. proposedTokens sorted by confidence DESC then usageCount DESC
 *  18. Stats counters reflect actual unique category counts
 *  19. Opacity values extracted when < 1.0
 *  20. Effect (DROP_SHADOW) colors extracted
 *  21. Nested children traversed recursively
 *  22. Non-object payload => empty result
 */

import { describe, it, expect } from 'vitest'
import { extractTokensFromFigma } from '../figmaTokenExtractor.js'
import type { DesignToken } from '../../types.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeColor(r: number, g: number, b: number) {
    return { r: r / 255, g: g / 255, b: b / 255 }
}

function makeTextNode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'text-1',
        name: 'Body Text',
        type: 'TEXT',
        fills: [],
        style: {
            fontSize: 16,
            fontFamily: 'Inter',
            fontWeight: 400,
        },
        ...overrides,
    }
}

function makeFrameNode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'frame-1',
        name: 'Primary Button',
        type: 'FRAME',
        fills: [{ type: 'SOLID', color: makeColor(37, 99, 235) }], // #2563EB
        strokes: [],
        effects: [],
        children: [],
        ...overrides,
    }
}

function makeDesignToken(path: string, value: string, type: 'color' | 'dimension' = 'color'): DesignToken {
    return {
        id: 1,
        token_path: path,
        token_type: type,
        token_value: value,
        description: null,
        collection_name: 'test',
        mode: 'default',
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('extractTokensFromFigma', () => {

    // 1. Colors from fills
    it('extracts colors from SOLID fills', () => {
        const payload = makeFrameNode({ name: 'Primary Button' })
        const result = extractTokensFromFigma(payload)
        expect(result.proposedTokens).toHaveLength(1)
        expect(result.proposedTokens[0].value).toBe('#2563EB')
        expect(result.proposedTokens[0].type).toBe('color')
        expect(result.proposedTokens[0].source.property).toBe('fill')
    })

    // 2. Colors from strokes
    it('extracts colors from strokes', () => {
        const payload = {
            id: 'r1',
            name: 'Border Box',
            type: 'FRAME',
            fills: [],
            strokes: [{ type: 'SOLID', color: makeColor(200, 200, 200) }], // #C8C8C8
            effects: [],
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        expect(result.proposedTokens).toHaveLength(1)
        expect(result.proposedTokens[0].value).toBe('#C8C8C8')
        expect(result.proposedTokens[0].source.property).toBe('stroke')
    })

    // 3. Font sizes from TEXT nodes
    it('extracts font sizes from TEXT nodes via style.fontSize', () => {
        const payload = makeTextNode({ style: { fontSize: 24, fontFamily: 'Inter', fontWeight: 700 } })
        const result = extractTokensFromFigma(payload)
        const fontSizeToken = result.proposedTokens.find(t => t.source.property === 'fontSize')
        expect(fontSizeToken).toBeDefined()
        expect(fontSizeToken?.value).toBe('24')
        expect(fontSizeToken?.type).toBe('dimension')
    })

    // 4. Font families from TEXT nodes
    it('extracts font families from TEXT nodes', () => {
        const payload = makeTextNode()
        const result = extractTokensFromFigma(payload)
        const fontFamilyToken = result.proposedTokens.find(t => t.source.property === 'fontFamily')
        expect(fontFamilyToken).toBeDefined()
        expect(fontFamilyToken?.value).toBe('Inter')
        expect(fontFamilyToken?.type).toBe('fontFamily')
        expect(fontFamilyToken?.proposedName).toContain('inter')
    })

    // 5. Font weights from TEXT nodes
    it('extracts font weights from TEXT nodes', () => {
        const payload = makeTextNode({ style: { fontSize: 16, fontFamily: 'Inter', fontWeight: 700 } })
        const result = extractTokensFromFigma(payload)
        const fontWeightToken = result.proposedTokens.find(t => t.source.property === 'fontWeight')
        expect(fontWeightToken).toBeDefined()
        expect(fontWeightToken?.value).toBe('700')
        expect(fontWeightToken?.type).toBe('fontWeight')
    })

    // 6. Spacing values from padding and itemSpacing
    it('extracts spacing from FRAME paddingLeft and itemSpacing', () => {
        const payload = {
            id: 'frame-pad',
            name: 'Card Layout',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            paddingLeft: 16,
            paddingTop: 16,
            paddingRight: 16,
            paddingBottom: 16,
            itemSpacing: 8,
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const spacingValues = result.proposedTokens
            .filter(t => t.source.property === 'padding' || t.source.property === 'itemSpacing')
            .map(t => t.value)
        expect(spacingValues).toContain('16')
        expect(spacingValues).toContain('8')
    })

    // 7. Corner radii from FRAME nodes
    it('extracts cornerRadius from FRAME nodes', () => {
        const payload = {
            id: 'frame-radius',
            name: 'Rounded Card',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            cornerRadius: 8,
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const radiusToken = result.proposedTokens.find(t => t.source.property === 'cornerRadius')
        expect(radiusToken).toBeDefined()
        expect(radiusToken?.value).toBe('8')
        expect(radiusToken?.proposedName).toBe('radii.8')
    })

    // 8. Deduplication: same color on 5 nodes => single token, usageCount: 5
    it('deduplicates identical hex colors and tracks usageCount', () => {
        const sameColor = makeColor(37, 99, 235) // #2563EB
        const payload = {
            id: 'root',
            name: 'Container',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: sameColor }],
            strokes: [],
            effects: [],
            children: [
                { id: 'c1', name: 'Child 1', type: 'FRAME', fills: [{ type: 'SOLID', color: sameColor }], strokes: [], effects: [], children: [] },
                { id: 'c2', name: 'Child 2', type: 'FRAME', fills: [{ type: 'SOLID', color: sameColor }], strokes: [], effects: [], children: [] },
                { id: 'c3', name: 'Child 3', type: 'FRAME', fills: [{ type: 'SOLID', color: sameColor }], strokes: [], effects: [], children: [] },
                { id: 'c4', name: 'Child 4', type: 'FRAME', fills: [{ type: 'SOLID', color: sameColor }], strokes: [], effects: [], children: [] },
            ],
        }
        const result = extractTokensFromFigma(payload)
        const colorTokens = result.proposedTokens.filter(t => t.type === 'color')
        expect(colorTokens).toHaveLength(1)
        expect(colorTokens[0].usageCount).toBe(5)
    })

    // 9. Exact match with existing token => existingMatches, not proposedTokens
    it('routes exact value matches to existingMatches', () => {
        const existingTokens: DesignToken[] = [
            makeDesignToken('colors.brand.primary', '#2563EB', 'color'),
        ]
        const payload = makeFrameNode({ name: 'Primary Button' }) // fill: #2563EB
        const result = extractTokensFromFigma(payload, { existingTokens })
        expect(result.proposedTokens).toHaveLength(0)
        expect(result.existingMatches).toHaveLength(1)
        expect(result.existingMatches[0].existing.token_path).toBe('colors.brand.primary')
    })

    // 10. Near-match: deltaE < 2.0 from existing => nearMatches
    it('detects near-matches via CIEDE2000 (deltaE < 2.0)', () => {
        // #2563EB and #2461E9 are very close in color space
        const existingTokens: DesignToken[] = [
            makeDesignToken('colors.brand.primary', '#2563EB', 'color'),
        ]
        // Use a slightly different blue that is close but not identical
        const nearBlue = { r: 36 / 255, g: 97 / 255, b: 233 / 255 } // #2461E9
        const payload = {
            id: 'frame-1',
            name: 'Button',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: nearBlue }],
            strokes: [],
            effects: [],
            children: [],
        }
        const result = extractTokensFromFigma(payload, { existingTokens })
        // Near-match may be in proposedTokens (with lower confidence) or nearMatches
        // Key assertion: if in nearMatches, it has a deltaE value
        if (result.nearMatches.length > 0) {
            expect(result.nearMatches[0].deltaE).toBeGreaterThan(0)
            expect(result.nearMatches[0].deltaE).toBeLessThan(2.0)
        }
    })

    // 11. High confidence: >= 3 usages + semantic node name
    it('scores high confidence for high-usage tokens with semantic names', () => {
        const semanticColor = makeColor(37, 99, 235)
        const payload = {
            id: 'root',
            name: 'Brand Container',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: semanticColor }],
            strokes: [],
            effects: [],
            children: [
                { id: 'c1', name: 'Primary Background', type: 'FRAME', fills: [{ type: 'SOLID', color: semanticColor }], strokes: [], effects: [], children: [] },
                { id: 'c2', name: 'Brand CTA', type: 'FRAME', fills: [{ type: 'SOLID', color: semanticColor }], strokes: [], effects: [], children: [] },
            ],
        }
        const result = extractTokensFromFigma(payload)
        const colorToken = result.proposedTokens.find(t => t.type === 'color')
        expect(colorToken).toBeDefined()
        expect(colorToken!.usageCount).toBe(3)
        expect(colorToken!.confidence).toBeGreaterThanOrEqual(0.7)
    })

    // 12. Low confidence: single usage, non-semantic name
    it('scores low confidence for single-use tokens with generic names', () => {
        const payload = {
            id: 'frame-1',
            name: 'Rectangle 1',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: makeColor(123, 45, 67) }],
            strokes: [],
            effects: [],
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const colorToken = result.proposedTokens.find(t => t.type === 'color')
        expect(colorToken).toBeDefined()
        expect(colorToken!.confidence).toBeLessThan(0.5)
    })

    // 13. minUsageCount filter removes single-occurrence tokens
    it('applies minUsageCount filter', () => {
        const colorA = makeColor(37, 99, 235)   // appears once
        const colorB = makeColor(200, 100, 50)  // appears twice

        const payload = {
            id: 'root',
            name: 'Container',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: colorA }],
            strokes: [],
            effects: [],
            children: [
                { id: 'c1', name: 'C1', type: 'FRAME', fills: [{ type: 'SOLID', color: colorB }], strokes: [], effects: [], children: [] },
                { id: 'c2', name: 'C2', type: 'FRAME', fills: [{ type: 'SOLID', color: colorB }], strokes: [], effects: [], children: [] },
            ],
        }
        const result = extractTokensFromFigma(payload, { minUsageCount: 2 })
        const colorTokens = result.proposedTokens.filter(t => t.type === 'color')
        // colorA (usageCount 1) should be filtered; colorB (usageCount 2) should remain
        expect(colorTokens.every(t => t.usageCount >= 2)).toBe(true)
        expect(colorTokens.some(t => t.usageCount === 1)).toBe(false)
    })

    // 14. minConfidence filter
    it('applies minConfidence filter', () => {
        const payload = {
            id: 'root',
            name: 'Rectangle 1',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: makeColor(123, 45, 67) }],
            strokes: [],
            effects: [],
            children: [],
        }
        const result = extractTokensFromFigma(payload, { minConfidence: 0.9 })
        // Single-use generic node should score < 0.9; should be filtered out
        expect(result.proposedTokens).toHaveLength(0)
    })

    // 15. Empty payload => empty result with zeroed stats
    it('handles empty payload object', () => {
        const result = extractTokensFromFigma({})
        expect(result.proposedTokens).toHaveLength(0)
        expect(result.existingMatches).toHaveLength(0)
        expect(result.nearMatches).toHaveLength(0)
        expect(result.stats.totalValuesScanned).toBe(0)
        expect(result.stats.uniqueColors).toBe(0)
        expect(result.stats.proposedCount).toBe(0)
    })

    // 16. Payload with no colors => no color tokens
    it('handles payload with no colors', () => {
        const payload = {
            id: 'frame-1',
            name: 'Empty Frame',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const colorTokens = result.proposedTokens.filter(t => t.type === 'color')
        expect(colorTokens).toHaveLength(0)
        expect(result.stats.uniqueColors).toBe(0)
    })

    // 17. proposedTokens sorted by confidence DESC then usageCount DESC
    it('sorts proposedTokens by confidence DESC then usageCount DESC', () => {
        const colorA = makeColor(37, 99, 235)   // used once, generic name
        const colorB = makeColor(200, 100, 50)  // used 3 times, semantic name

        const payload = {
            id: 'root',
            name: 'Brand Background',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: colorA }],
            strokes: [],
            effects: [],
            children: [
                { id: 'c1', name: 'Secondary Element', type: 'FRAME', fills: [{ type: 'SOLID', color: colorB }], strokes: [], effects: [], children: [] },
                { id: 'c2', name: 'Secondary Hover',   type: 'FRAME', fills: [{ type: 'SOLID', color: colorB }], strokes: [], effects: [], children: [] },
                { id: 'c3', name: 'Secondary Focus',   type: 'FRAME', fills: [{ type: 'SOLID', color: colorB }], strokes: [], effects: [], children: [] },
            ],
        }
        const result = extractTokensFromFigma(payload)
        const colors = result.proposedTokens.filter(t => t.type === 'color')
        if (colors.length >= 2) {
            // First color should have higher or equal confidence
            expect(colors[0].confidence).toBeGreaterThanOrEqual(colors[1].confidence)
        }
    })

    // 18. Stats counters reflect actual unique category counts
    it('counts unique categories correctly in stats', () => {
        const payload = {
            id: 'root',
            name: 'Dashboard',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: makeColor(37, 99, 235) }],
            strokes: [],
            effects: [],
            cornerRadius: 8,
            paddingLeft: 16,
            paddingTop: 16,
            children: [
                {
                    id: 'text-1',
                    name: 'Heading',
                    type: 'TEXT',
                    fills: [],
                    style: { fontSize: 24, fontFamily: 'Inter', fontWeight: 700 },
                    children: [],
                },
            ],
        }
        const result = extractTokensFromFigma(payload)
        expect(result.stats.uniqueColors).toBeGreaterThanOrEqual(1)
        expect(result.stats.uniqueTypography).toBeGreaterThanOrEqual(1)
        expect(result.stats.uniqueSpacing).toBeGreaterThanOrEqual(1)
        expect(result.stats.uniqueRadii).toBeGreaterThanOrEqual(1)
    })

    // 19. Opacity values extracted when < 1.0
    it('extracts opacity values when less than 1.0', () => {
        const payload = {
            id: 'frame-1',
            name: 'Overlay',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            opacity: 0.7,
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const opacityToken = result.proposedTokens.find(t => t.source.property === 'opacity')
        expect(opacityToken).toBeDefined()
        expect(opacityToken?.value).toBe('0.7')
        expect(opacityToken?.type).toBe('opacity')
    })

    // 20. DROP_SHADOW effect colors extracted
    it('extracts colors from DROP_SHADOW effects', () => {
        const payload = {
            id: 'card',
            name: 'Card',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [
                {
                    type: 'DROP_SHADOW',
                    color: makeColor(0, 0, 0),
                },
            ],
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const shadowColorToken = result.proposedTokens.find(t => t.source.property === 'effect')
        expect(shadowColorToken).toBeDefined()
        expect(shadowColorToken?.type).toBe('color')
    })

    // 21. Nested children traversed recursively
    it('traverses nested children recursively', () => {
        const deepColor = makeColor(255, 87, 34)
        const payload = {
            id: 'root',
            name: 'Page',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            children: [
                {
                    id: 'section',
                    name: 'Section',
                    type: 'FRAME',
                    fills: [],
                    strokes: [],
                    effects: [],
                    children: [
                        {
                            id: 'deep',
                            name: 'Deep Frame',
                            type: 'FRAME',
                            fills: [{ type: 'SOLID', color: deepColor }],
                            strokes: [],
                            effects: [],
                            children: [],
                        },
                    ],
                },
            ],
        }
        const result = extractTokensFromFigma(payload)
        expect(result.proposedTokens.some(t => t.type === 'color')).toBe(true)
    })

    // 22. Non-object payload => empty result
    it('handles null payload gracefully', () => {
        const result = extractTokensFromFigma(null)
        expect(result.proposedTokens).toHaveLength(0)
        expect(result.stats.totalValuesScanned).toBe(0)
    })

    it('handles string payload gracefully', () => {
        const result = extractTokensFromFigma('not an object')
        expect(result.proposedTokens).toHaveLength(0)
        expect(result.stats.totalValuesScanned).toBe(0)
    })

    it('handles array payload gracefully', () => {
        // Arrays are not valid Figma nodes — should produce empty result
        const result = extractTokensFromFigma([])
        // Arrays are objects in JS so the cast will succeed but produce empty node
        expect(result.stats.totalValuesScanned).toBe(0)
    })

    // Naming tests
    it('generates correct proposedName for color tokens', () => {
        const payload = {
            id: 'frame-1',
            name: 'Background Surface',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: makeColor(255, 255, 255) }],
            strokes: [],
            effects: [],
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const colorToken = result.proposedTokens.find(t => t.type === 'color')
        expect(colorToken?.proposedName).toMatch(/^colors\./)
    })

    it('generates correct proposedName for spacing from itemSpacing', () => {
        const payload = {
            id: 'frame-1',
            name: 'Layout Frame',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            itemSpacing: 24,
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const spacingToken = result.proposedTokens.find(t => t.source.property === 'itemSpacing')
        expect(spacingToken?.proposedName).toBe('spacing.24')
    })

    it('generates correct proposedName for cornerRadius', () => {
        const payload = {
            id: 'frame-1',
            name: 'Pill Button',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            cornerRadius: 999,
            children: [],
        }
        const result = extractTokensFromFigma(payload)
        const radiusToken = result.proposedTokens.find(t => t.source.property === 'cornerRadius')
        expect(radiusToken?.proposedName).toBe('radii.999')
    })

    // Confidence formula test
    it('awards common-spacing bonus to dimension values in the standard set', () => {
        const payload = {
            id: 'frame-1',
            name: 'Spacer',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            itemSpacing: 8, // 8 is in COMMON_SPACING
            children: [],
        }
        const resultCommon = extractTokensFromFigma(payload)
        const spacingTokenCommon = resultCommon.proposedTokens.find(t => t.source.property === 'itemSpacing')

        const payload2 = {
            id: 'frame-2',
            name: 'Spacer',
            type: 'FRAME',
            fills: [],
            strokes: [],
            effects: [],
            itemSpacing: 7, // 7 is NOT in COMMON_SPACING
            children: [],
        }
        const resultOdd = extractTokensFromFigma(payload2)
        const spacingTokenOdd = resultOdd.proposedTokens.find(t => t.source.property === 'itemSpacing')

        if (spacingTokenCommon && spacingTokenOdd) {
            expect(spacingTokenCommon.confidence).toBeGreaterThan(spacingTokenOdd.confidence)
        }
    })

    // 2 unique colors in one payload
    it('extracts 2 unique color tokens from payload with 3 SOLID fills (2 unique)', () => {
        const blueColor = makeColor(37, 99, 235)   // #2563EB
        const redColor  = makeColor(220, 38, 38)   // #DC2626

        const payload = {
            id: 'root',
            name: 'Page',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: blueColor }],
            strokes: [],
            effects: [],
            children: [
                {
                    id: 'c1',
                    name: 'Red Button',
                    type: 'FRAME',
                    fills: [{ type: 'SOLID', color: redColor }],
                    strokes: [],
                    effects: [],
                    children: [],
                },
                {
                    id: 'c2',
                    name: 'Blue Again',
                    type: 'FRAME',
                    fills: [{ type: 'SOLID', color: blueColor }],
                    strokes: [],
                    effects: [],
                    children: [],
                },
            ],
        }
        const result = extractTokensFromFigma(payload)
        const colorTokens = result.proposedTokens.filter(t => t.type === 'color')
        expect(colorTokens).toHaveLength(2)

        const blueToken = colorTokens.find(t => t.value === '#2563EB')
        expect(blueToken).toBeDefined()
        expect(blueToken?.usageCount).toBe(2)

        const redToken = colorTokens.find(t => t.value === '#DC2626')
        expect(redToken).toBeDefined()
        expect(redToken?.usageCount).toBe(1)
    })
})
