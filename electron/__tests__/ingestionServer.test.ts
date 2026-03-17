/**
 * ingestionServer.test.ts
 *
 * P2 Journey 8: Tests the Figma ingestion pipeline.
 *
 * Coverage:
 *   - normalizeFigmaVariables: Figma Variables → W3C DTCG token mapping
 *   - rgbaToHex conversion
 *   - buildTokenPath (collection + variable naming)
 *   - Multi-mode expansion (Light/Dark → separate rows)
 *   - Alias skip (unresolved VARIABLE_ALIAS references)
 *   - Type guard rejection (malformed payloads return [])
 */

import { describe, it, expect } from 'vitest'
import { normalizeFigmaVariables } from '../normalizer'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePayload(
    variables: Record<string, unknown>,
    variableCollections: Record<string, unknown>,
) {
    return { variables, variableCollections }
}

const SINGLE_COLOR_PAYLOAD = makePayload(
    {
        'var-1': {
            id: 'var-1',
            name: 'Brand/Primary',
            resolvedType: 'COLOR',
            valuesByMode: {
                'm1': { r: 0.388, g: 0.400, b: 0.945, a: 1 },
            },
            variableCollectionId: 'col-1',
        },
    },
    {
        'col-1': {
            id: 'col-1',
            name: 'Color Tokens',
            defaultModeId: 'm1',
            variableIds: ['var-1'],
            modes: [{ modeId: 'm1', name: 'Light' }],
        },
    },
)

const MULTI_MODE_PAYLOAD = makePayload(
    {
        'var-1': {
            id: 'var-1',
            name: 'Brand/Primary',
            resolvedType: 'COLOR',
            valuesByMode: {
                'm1': { r: 0.388, g: 0.400, b: 0.945, a: 1 },
                'm2': { r: 0.310, g: 0.275, b: 0.898, a: 1 },
            },
            variableCollectionId: 'col-1',
        },
    },
    {
        'col-1': {
            id: 'col-1',
            name: 'Color Tokens',
            defaultModeId: 'm1',
            variableIds: ['var-1'],
            modes: [
                { modeId: 'm1', name: 'Light' },
                { modeId: 'm2', name: 'Dark' },
            ],
        },
    },
)

const FLOAT_PAYLOAD = makePayload(
    {
        'var-2': {
            id: 'var-2',
            name: 'Spacing/Small',
            resolvedType: 'FLOAT',
            valuesByMode: { 'm1': 8 },
            variableCollectionId: 'col-2',
        },
    },
    {
        'col-2': {
            id: 'col-2',
            name: 'Spacing',
            defaultModeId: 'm1',
            variableIds: ['var-2'],
            modes: [{ modeId: 'm1', name: 'default' }],
        },
    },
)

const ALIAS_PAYLOAD = makePayload(
    {
        'var-a': {
            id: 'var-a',
            name: 'Alias/Link',
            resolvedType: 'COLOR',
            valuesByMode: {
                'm1': { type: 'VARIABLE_ALIAS', id: 'var-1' },
            },
            variableCollectionId: 'col-1',
        },
    },
    {
        'col-1': {
            id: 'col-1',
            name: 'Aliases',
            defaultModeId: 'm1',
            variableIds: ['var-a'],
            modes: [{ modeId: 'm1', name: 'default' }],
        },
    },
)

const SEMI_TRANSPARENT_PAYLOAD = makePayload(
    {
        'var-t': {
            id: 'var-t',
            name: 'Overlay/Black50',
            resolvedType: 'COLOR',
            valuesByMode: {
                'm1': { r: 0, g: 0, b: 0, a: 0.5 },
            },
            variableCollectionId: 'col-1',
        },
    },
    {
        'col-1': {
            id: 'col-1',
            name: 'Effects',
            defaultModeId: 'm1',
            variableIds: ['var-t'],
            modes: [{ modeId: 'm1', name: 'default' }],
        },
    },
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('normalizeFigmaVariables — J8 token normalization', () => {
    it('converts a single Figma COLOR variable to a W3C DTCG token', () => {
        const tokens = normalizeFigmaVariables(SINGLE_COLOR_PAYLOAD)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_path).toBe('color-tokens.brand.primary')
        expect(tokens[0].token_type).toBe('color')
        expect(tokens[0].token_value).toMatch(/^#[0-9a-f]{6}$/i)
        expect(tokens[0].mode).toBe('Light')
        expect(tokens[0].collection_name).toBe('Color Tokens')
    })

    it('expands multi-mode variables into separate token rows', () => {
        const tokens = normalizeFigmaVariables(MULTI_MODE_PAYLOAD)
        expect(tokens).toHaveLength(2)
        const modes = tokens.map((t) => t.mode).sort()
        expect(modes).toEqual(['Dark', 'Light'])
        // Both share the same token_path but different mode
        expect(tokens[0].token_path).toBe(tokens[1].token_path)
    })

    it('converts FLOAT variables to dimension tokens', () => {
        const tokens = normalizeFigmaVariables(FLOAT_PAYLOAD)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('dimension')
        expect(tokens[0].token_value).toBe('8')
        expect(tokens[0].token_path).toBe('spacing.spacing.small')
    })

    it('skips unresolved alias references (returns empty for alias-only payload)', () => {
        const tokens = normalizeFigmaVariables(ALIAS_PAYLOAD)
        expect(tokens).toHaveLength(0)
    })

    it('appends alpha channel for semi-transparent colors', () => {
        const tokens = normalizeFigmaVariables(SEMI_TRANSPARENT_PAYLOAD)
        expect(tokens).toHaveLength(1)
        // Should be #000000 + 2-hex alpha (80 = 50% of 255)
        expect(tokens[0].token_value).toMatch(/^#000000[0-9a-f]{2}$/i)
    })

    it('returns empty array for null payload', () => {
        expect(normalizeFigmaVariables(null)).toEqual([])
    })

    it('returns empty array for undefined payload', () => {
        expect(normalizeFigmaVariables(undefined)).toEqual([])
    })

    it('returns empty array for payload missing variables key', () => {
        expect(normalizeFigmaVariables({ variableCollections: {} })).toEqual([])
    })

    it('returns empty array for payload missing variableCollections key', () => {
        expect(normalizeFigmaVariables({ variables: {} })).toEqual([])
    })

    it('returns empty array for string payload', () => {
        expect(normalizeFigmaVariables('not an object')).toEqual([])
    })

    it('handles empty variables and collections gracefully', () => {
        const tokens = normalizeFigmaVariables(makePayload({}, {}))
        expect(tokens).toEqual([])
    })

    it('skips variables not referenced in any collection', () => {
        const payload = makePayload(
            {
                'orphan': {
                    id: 'orphan',
                    name: 'Lost/Variable',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'm1': { r: 1, g: 0, b: 0, a: 1 } },
                    variableCollectionId: 'col-missing',
                },
            },
            {
                'col-1': {
                    id: 'col-1',
                    name: 'Empty',
                    defaultModeId: 'm1',
                    variableIds: [],  // no references
                    modes: [{ modeId: 'm1', name: 'default' }],
                },
            },
        )
        const tokens = normalizeFigmaVariables(payload)
        expect(tokens).toEqual([])
    })

    it('handles STRING variable type', () => {
        const payload = makePayload(
            {
                'var-s': {
                    id: 'var-s',
                    name: 'Label/Button',
                    resolvedType: 'STRING',
                    valuesByMode: { 'm1': 'Click me' },
                    variableCollectionId: 'col-1',
                },
            },
            {
                'col-1': {
                    id: 'col-1',
                    name: 'Strings',
                    defaultModeId: 'm1',
                    variableIds: ['var-s'],
                    modes: [{ modeId: 'm1', name: 'default' }],
                },
            },
        )
        const tokens = normalizeFigmaVariables(payload)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('string')
        expect(tokens[0].token_value).toBe('Click me')
    })

    it('handles BOOLEAN variable type', () => {
        const payload = makePayload(
            {
                'var-b': {
                    id: 'var-b',
                    name: 'Feature/DarkMode',
                    resolvedType: 'BOOLEAN',
                    valuesByMode: { 'm1': true },
                    variableCollectionId: 'col-1',
                },
            },
            {
                'col-1': {
                    id: 'col-1',
                    name: 'Flags',
                    defaultModeId: 'm1',
                    variableIds: ['var-b'],
                    modes: [{ modeId: 'm1', name: 'default' }],
                },
            },
        )
        const tokens = normalizeFigmaVariables(payload)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_type).toBe('boolean')
        expect(tokens[0].token_value).toBe('true')
    })

    it('builds token_path with lowercased collection and dot-separated variable name', () => {
        const payload = makePayload(
            {
                'var-p': {
                    id: 'var-p',
                    name: 'Surface/Card/Background',
                    resolvedType: 'COLOR',
                    valuesByMode: { 'm1': { r: 1, g: 1, b: 1, a: 1 } },
                    variableCollectionId: 'col-1',
                },
            },
            {
                'col-1': {
                    id: 'col-1',
                    name: 'Design System V2',
                    defaultModeId: 'm1',
                    variableIds: ['var-p'],
                    modes: [{ modeId: 'm1', name: 'default' }],
                },
            },
        )
        const tokens = normalizeFigmaVariables(payload)
        expect(tokens[0].token_path).toBe('design-system-v2.surface.card.background')
    })

    it('preserves description when provided', () => {
        const payload = makePayload(
            {
                'var-d': {
                    id: 'var-d',
                    name: 'Brand/Primary',
                    resolvedType: 'COLOR',
                    description: 'Main brand color',
                    valuesByMode: { 'm1': { r: 0, g: 0, b: 1, a: 1 } },
                    variableCollectionId: 'col-1',
                },
            },
            {
                'col-1': {
                    id: 'col-1',
                    name: 'Colors',
                    defaultModeId: 'm1',
                    variableIds: ['var-d'],
                    modes: [{ modeId: 'm1', name: 'default' }],
                },
            },
        )
        const tokens = normalizeFigmaVariables(payload)
        expect(tokens[0].description).toBe('Main brand color')
    })
})
