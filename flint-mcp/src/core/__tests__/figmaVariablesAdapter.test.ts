/**
 * figmaVariablesAdapter.ts — Unit Tests
 * flint-mcp/src/core/__tests__/figmaVariablesAdapter.test.ts
 *
 * Figma Variables → DesignToken conversion tests.
 *
 * What we verify:
 *   1. COLOR variable (RGBA 0-1) converts to uppercase hex
 *   2. FLOAT variable maps to dimension token
 *   3. Token path built from collection name + variable name
 *   4. Multi-mode (Light/Dark) creates separate tokens with mode suffix
 *   5. codeSyntax CSS variable name is preserved and used as token path
 *   6. Variable aliases (one variable referencing another) resolve correctly
 *   7. Empty response returns empty array
 *   8. Mixed types in one collection
 *   9. FLOAT scope inference (CORNER_RADIUS, FONT_SIZE, OPACITY, etc.)
 *  10. Mode filter extracts only the requested mode
 *  11. Alpha channel in COLOR produces 8-digit hex
 *  12. Circular alias reference does not infinite-loop
 *  13. STRING variable maps to string token type
 *  14. BOOLEAN variable maps to boolean token type
 *  15. Stats computation returns correct counts
 *  16. Single-mode collections do not get a mode suffix
 *  17. buildTokenPath sanitizes special characters
 *  18. figmaRgbaToHex edge cases (0, 1 boundaries)
 */

import { describe, it, expect } from 'vitest'
import {
    convertFigmaVariables,
    computeStats,
    figmaRgbaToHex,
    buildTokenPath,
} from '../figmaVariablesAdapter.js'
import type { FigmaVariablesResponse, FigmaVariable, FigmaVariableCollection } from '../figmaVariablesAdapter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVariable(overrides: Partial<FigmaVariable> & { id: string; name: string }): FigmaVariable {
    return {
        resolvedType: 'COLOR',
        valuesByMode: {},
        scopes: [],
        ...overrides,
    }
}

function makeCollection(
    overrides: Partial<FigmaVariableCollection> & { id: string; name: string; variableIds: string[] },
): FigmaVariableCollection {
    return {
        modes: [{ modeId: 'mode-1', name: 'Default' }],
        ...overrides,
    }
}

function makeResponse(
    variables: Record<string, FigmaVariable>,
    variableCollections: Record<string, FigmaVariableCollection>,
): FigmaVariablesResponse {
    return { variables, variableCollections }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('figmaVariablesAdapter', () => {

    // 1. COLOR variable → hex
    it('converts COLOR variable (RGBA 0-1) to uppercase hex', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Primary',
                    resolvedType: 'COLOR',
                    valuesByMode: {
                        'mode-1': { r: 0.2, g: 0.4, b: 0.8, a: 1 },
                    },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Brand', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('color')
        expect(tokens[0].token_value).toBe('#3366CC')
    })

    // 2. FLOAT variable → dimension
    it('converts FLOAT variable to dimension token', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Gap/Small',
                    resolvedType: 'FLOAT',
                    scopes: ['GAP'],
                    valuesByMode: { 'mode-1': 8 },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Spacing', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('dimension')
        expect(tokens[0].token_value).toBe('8')
        expect(tokens[0].collection_name).toBe('Spacing')
    })

    // 3. Token path from collection/variable
    it('builds token path from collection name and variable name', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Colors/Blue/500',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { r: 0.231, g: 0.51, b: 0.965, a: 1 } },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Brand', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens[0].token_path).toBe('brand.colors.blue.500')
    })

    // 4. Multi-mode (Light/Dark) creates separate tokens
    it('handles multi-mode variables (Light/Dark) with mode suffix', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Background',
                    resolvedType: 'COLOR',
                    valuesByMode: {
                        'light': { r: 1, g: 1, b: 1, a: 1 },
                        'dark': { r: 0, g: 0, b: 0, a: 1 },
                    },
                }),
            },
            {
                'c1': makeCollection({
                    id: 'c1',
                    name: 'Theme',
                    variableIds: ['v1'],
                    modes: [
                        { modeId: 'light', name: 'Light' },
                        { modeId: 'dark', name: 'Dark' },
                    ],
                }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens).toHaveLength(2)

        const lightToken = tokens.find(t => t.mode === 'Light')!
        const darkToken = tokens.find(t => t.mode === 'Dark')!

        expect(lightToken.token_path).toBe('theme.background.light')
        expect(lightToken.token_value).toBe('#FFFFFF')
        expect(darkToken.token_path).toBe('theme.background.dark')
        expect(darkToken.token_value).toBe('#000000')
    })

    // 5. codeSyntax CSS variable name preserved
    it('preserves codeSyntax CSS variable name as token path', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Primary',
                    resolvedType: 'COLOR',
                    codeSyntax: { WEB: '--color-brand-primary' },
                    valuesByMode: { 'mode-1': { r: 0.2, g: 0.4, b: 0.8, a: 1 } },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Brand', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens[0].token_path).toBe('color.brand.primary')
    })

    // 6. Variable aliases resolve correctly
    it('resolves variable aliases (one referencing another)', () => {
        const resp = makeResponse(
            {
                'base-color': makeVariable({
                    id: 'base-color',
                    name: 'Blue/500',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { r: 0.231, g: 0.51, b: 0.965, a: 1 } },
                }),
                'alias-color': makeVariable({
                    id: 'alias-color',
                    name: 'Primary',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { type: 'VARIABLE_ALIAS', id: 'base-color' } },
                }),
            },
            {
                'c1': makeCollection({
                    id: 'c1',
                    name: 'Semantic',
                    variableIds: ['base-color', 'alias-color'],
                }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        const aliasToken = tokens.find(t => t.token_path === 'semantic.primary')
        expect(aliasToken).toBeDefined()
        // Should resolve to the same value as base
        expect(aliasToken!.token_value).toBe('#3B82F6')
    })

    // 7. Empty response → empty array
    it('returns empty array for empty response', () => {
        const empty = makeResponse({}, {})
        expect(convertFigmaVariables(empty)).toEqual([])
    })

    it('returns empty array for null-ish input', () => {
        expect(convertFigmaVariables(null as unknown as FigmaVariablesResponse)).toEqual([])
        expect(convertFigmaVariables(undefined as unknown as FigmaVariablesResponse)).toEqual([])
    })

    it('returns empty array when variables or collections are missing', () => {
        expect(convertFigmaVariables({ variables: {}, variableCollections: {} })).toEqual([])
        expect(convertFigmaVariables({ variables: {}, variableCollections: undefined } as unknown as FigmaVariablesResponse)).toEqual([])
    })

    // 8. Mixed types in one collection
    it('handles mixed types in one collection', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Primary',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { r: 0.2, g: 0.4, b: 0.8, a: 1 } },
                }),
                'v2': makeVariable({
                    id: 'v2',
                    name: 'Radius/Medium',
                    resolvedType: 'FLOAT',
                    scopes: ['CORNER_RADIUS'],
                    valuesByMode: { 'mode-1': 8 },
                }),
                'v3': makeVariable({
                    id: 'v3',
                    name: 'Label',
                    resolvedType: 'STRING',
                    valuesByMode: { 'mode-1': 'Submit' },
                }),
            },
            {
                'c1': makeCollection({
                    id: 'c1',
                    name: 'Design',
                    variableIds: ['v1', 'v2', 'v3'],
                }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens).toHaveLength(3)

        const color = tokens.find(t => t.token_type === 'color')
        const dim = tokens.find(t => t.token_type === 'dimension')
        const str = tokens.find(t => t.token_type === 'string')

        expect(color).toBeDefined()
        expect(dim).toBeDefined()
        expect(str).toBeDefined()
        expect(str!.token_value).toBe('Submit')
    })

    // 9. FLOAT scope inference
    it('infers token type from FLOAT scopes', () => {
        const cases: Array<{ scopes: string[]; expected: string }> = [
            { scopes: ['CORNER_RADIUS'], expected: 'dimension' },
            { scopes: ['WIDTH_HEIGHT'], expected: 'dimension' },
            { scopes: ['GAP'], expected: 'dimension' },
            { scopes: ['FONT_SIZE'], expected: 'dimension' },
            { scopes: ['FONT_WEIGHT'], expected: 'fontWeight' },
            { scopes: ['LINE_HEIGHT'], expected: 'lineHeight' },
            { scopes: ['LETTER_SPACING'], expected: 'letterSpacing' },
            { scopes: ['OPACITY'], expected: 'opacity' },
            { scopes: [], expected: 'dimension' },
        ]

        for (const { scopes, expected } of cases) {
            const resp = makeResponse(
                {
                    'v1': makeVariable({
                        id: 'v1',
                        name: 'Value',
                        resolvedType: 'FLOAT',
                        scopes,
                        valuesByMode: { 'mode-1': 16 },
                    }),
                },
                {
                    'c1': makeCollection({ id: 'c1', name: 'Test', variableIds: ['v1'] }),
                },
            )

            const tokens = convertFigmaVariables(resp)
            expect(tokens[0].token_type).toBe(expected)
        }
    })

    // 10. Mode filter
    it('filters to a specific mode when modeFilter is set', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Background',
                    resolvedType: 'COLOR',
                    valuesByMode: {
                        'light': { r: 1, g: 1, b: 1, a: 1 },
                        'dark': { r: 0, g: 0, b: 0, a: 1 },
                    },
                }),
            },
            {
                'c1': makeCollection({
                    id: 'c1',
                    name: 'Theme',
                    variableIds: ['v1'],
                    modes: [
                        { modeId: 'light', name: 'Light' },
                        { modeId: 'dark', name: 'Dark' },
                    ],
                }),
            },
        )

        const tokens = convertFigmaVariables(resp, { modeFilter: 'Dark' })
        expect(tokens).toHaveLength(1)
        expect(tokens[0].mode).toBe('Dark')
        expect(tokens[0].token_value).toBe('#000000')
    })

    // 11. Alpha channel produces 8-digit hex
    it('appends alpha hex for colors with alpha < 1.0', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Overlay',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { r: 0, g: 0, b: 0, a: 0.5 } },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Colors', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens[0].token_value).toBe('#00000080')
    })

    // 12. Circular alias does not infinite loop
    it('handles circular alias reference without infinite loop', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'A',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { type: 'VARIABLE_ALIAS', id: 'v2' } },
                }),
                'v2': makeVariable({
                    id: 'v2',
                    name: 'B',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { type: 'VARIABLE_ALIAS', id: 'v1' } },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Loop', variableIds: ['v1', 'v2'] }),
            },
        )

        // Should not throw — just skip unresolvable aliases
        const tokens = convertFigmaVariables(resp)
        // Both are circular, so neither can resolve to a concrete value
        expect(tokens).toHaveLength(0)
    })

    // 13. STRING variable → string type
    it('converts STRING variable to string token', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Button/Label',
                    resolvedType: 'STRING',
                    valuesByMode: { 'mode-1': 'Submit' },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Content', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('string')
        expect(tokens[0].token_value).toBe('Submit')
    })

    // 14. BOOLEAN variable → boolean type
    it('converts BOOLEAN variable to boolean token', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Feature/DarkMode',
                    resolvedType: 'BOOLEAN',
                    valuesByMode: { 'mode-1': true },
                }),
            },
            {
                'c1': makeCollection({ id: 'c1', name: 'Flags', variableIds: ['v1'] }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('boolean')
        expect(tokens[0].token_value).toBe('true')
    })

    // 15. Stats computation
    it('computes correct stats from tokens', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Primary',
                    resolvedType: 'COLOR',
                    valuesByMode: {
                        'light': { r: 0.2, g: 0.4, b: 0.8, a: 1 },
                        'dark': { r: 0.1, g: 0.2, b: 0.6, a: 1 },
                    },
                }),
                'v2': makeVariable({
                    id: 'v2',
                    name: 'Gap',
                    resolvedType: 'FLOAT',
                    scopes: ['GAP'],
                    valuesByMode: {
                        'light': 8,
                        'dark': 8,
                    },
                }),
            },
            {
                'c1': makeCollection({
                    id: 'c1',
                    name: 'Theme',
                    variableIds: ['v1', 'v2'],
                    modes: [
                        { modeId: 'light', name: 'Light' },
                        { modeId: 'dark', name: 'Dark' },
                    ],
                }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        const stats = computeStats(tokens)

        expect(stats.totalTokens).toBe(4) // 2 vars * 2 modes
        expect(stats.byType.color).toBe(2)
        expect(stats.byType.dimension).toBe(2)
        expect(stats.byCollection.Theme).toBe(4)
        expect(stats.byMode.Light).toBe(2)
        expect(stats.byMode.Dark).toBe(2)
    })

    // 16. Single-mode collections do not get mode suffix
    it('does not add mode suffix for single-mode collections', () => {
        const resp = makeResponse(
            {
                'v1': makeVariable({
                    id: 'v1',
                    name: 'Primary',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'mode-1': { r: 0.2, g: 0.4, b: 0.8, a: 1 } },
                }),
            },
            {
                'c1': makeCollection({
                    id: 'c1',
                    name: 'Brand',
                    variableIds: ['v1'],
                    modes: [{ modeId: 'mode-1', name: 'Default' }],
                }),
            },
        )

        const tokens = convertFigmaVariables(resp)
        expect(tokens[0].token_path).toBe('brand.primary')
        // No ".default" suffix
        expect(tokens[0].token_path).not.toContain('.default')
    })
})

// ── buildTokenPath ──────────────────────────────────────────────────────────

describe('buildTokenPath', () => {
    it('converts slashes to dots', () => {
        expect(buildTokenPath('Brand', 'Colors/Blue/500')).toBe('brand.colors.blue.500')
    })

    it('converts spaces to hyphens', () => {
        expect(buildTokenPath('My Brand', 'Primary Color')).toBe('my-brand.primary-color')
    })

    it('strips special characters', () => {
        expect(buildTokenPath('Brand!', 'Primary@Color#')).toBe('brand.primarycolor')
    })

    it('lowercases everything', () => {
        expect(buildTokenPath('BRAND', 'PRIMARY')).toBe('brand.primary')
    })
})

// ── figmaRgbaToHex ──────────────────────────────────────────────────────────

describe('figmaRgbaToHex', () => {
    it('converts 0,0,0 to #000000', () => {
        expect(figmaRgbaToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000')
    })

    it('converts 1,1,1 to #FFFFFF', () => {
        expect(figmaRgbaToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#FFFFFF')
    })

    it('converts fractional values correctly', () => {
        // 0.2 * 255 = 51 = 0x33
        // 0.4 * 255 = 102 = 0x66
        // 0.8 * 255 = 204 = 0xCC
        expect(figmaRgbaToHex({ r: 0.2, g: 0.4, b: 0.8, a: 1 })).toBe('#3366CC')
    })

    it('appends alpha for transparency', () => {
        // alpha 0.5 * 255 = 128 = 0x80
        expect(figmaRgbaToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
    })

    it('does not append alpha when a = 1', () => {
        const hex = figmaRgbaToHex({ r: 1, g: 0, b: 0, a: 1 })
        expect(hex).toBe('#FF0000')
        expect(hex).toHaveLength(7) // #RRGGBB only
    })

    it('clamps out-of-range values', () => {
        expect(figmaRgbaToHex({ r: -0.5, g: 1.5, b: 0.5, a: 1 })).toBe('#00FF80')
    })
})
