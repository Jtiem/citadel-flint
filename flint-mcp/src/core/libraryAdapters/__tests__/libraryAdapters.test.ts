/**
 * Library Token Adapter system — comprehensive Vitest test suite.
 *
 * Covers:
 *   - types.ts:        detectSemanticRole, detectShade, extractColorFamily, filterTokens
 *   - index.ts:        getAdapter, hasAdapter, getAvailableLibraries, getAdapterCatalog, unknown lib
 *   - primeAdapter.ts: palette → primitive tier, semantic tier, borderRadius, fontFamily,
 *                      definePreset() codegen, validate(), skipped types
 *   - shadcnAdapter.ts: semantic → CSS vars, hex→HSL, foreground auto-derive, @layer base, validate()
 *   - muiAdapter.ts:   palette roles, shade→light/main/dark, typography, shape, createTheme(), validate()
 *   - tailwindAdapter.ts: TailwindEmitter delegation, LibraryThemeOutput shape
 *   - mapTokens.ts:    "list" mode, unknown library error, missing tokens file error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ---------------------------------------------------------------------------
// Helpers under test
// ---------------------------------------------------------------------------
import {
    detectSemanticRole,
    detectShade,
    extractColorFamily,
    filterTokens,
} from '../types.js'
import type { DesignToken, MapOptions } from '../types.js'

// ---------------------------------------------------------------------------
// Registry under test
// ---------------------------------------------------------------------------
import {
    getAdapter,
    hasAdapter,
    getAvailableLibraries,
    getAdapterCatalog,
} from '../index.js'
import type { LibraryTarget } from '../index.js'

// ---------------------------------------------------------------------------
// Individual adapters
// ---------------------------------------------------------------------------
import { PrimeAdapter } from '../primeAdapter.js'
import { ShadcnAdapter } from '../shadcnAdapter.js'
import { MuiAdapter } from '../muiAdapter.js'
import { TailwindAdapter } from '../tailwindAdapter.js'

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------
import { handleMapTokens } from '../../../tools/mapTokens.js'

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const SAMPLE_TOKENS: DesignToken[] = [
    { id: 1,  token_path: 'colors.blue.50',                token_type: 'color',      token_value: '#eff6ff',                          description: null, collection_name: 'primitives', mode: 'Light' },
    { id: 2,  token_path: 'colors.blue.500',               token_type: 'color',      token_value: '#3b82f6',                          description: null, collection_name: 'primitives', mode: 'Light' },
    { id: 3,  token_path: 'colors.blue.700',               token_type: 'color',      token_value: '#1d4ed8',                          description: null, collection_name: 'primitives', mode: 'Light' },
    { id: 4,  token_path: 'colors.blue.900',               token_type: 'color',      token_value: '#1e3a5f',                          description: null, collection_name: 'primitives', mode: 'Light' },
    { id: 5,  token_path: 'colors.primary',                token_type: 'color',      token_value: '#3b82f6',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 6,  token_path: 'colors.secondary',              token_type: 'color',      token_value: '#8b5cf6',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 7,  token_path: 'colors.success',                token_type: 'color',      token_value: '#22c55e',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 8,  token_path: 'colors.error',                  token_type: 'color',      token_value: '#ef4444',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 9,  token_path: 'colors.background',             token_type: 'color',      token_value: '#ffffff',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 10, token_path: 'colors.foreground',             token_type: 'color',      token_value: '#0f172a',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 11, token_path: 'colors.surface',                token_type: 'color',      token_value: '#f8fafc',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 12, token_path: 'colors.muted',                  token_type: 'color',      token_value: '#94a3b8',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 13, token_path: 'colors.border',                 token_type: 'color',      token_value: '#e2e8f0',                          description: null, collection_name: 'semantic',   mode: 'Light' },
    { id: 14, token_path: 'spacing.base',                  token_type: 'dimension',  token_value: '8px',                              description: null, collection_name: 'spacing',    mode: 'Light' },
    { id: 15, token_path: 'radius.md',                     token_type: 'dimension',  token_value: '6px',                              description: null, collection_name: 'shape',      mode: 'Light' },
    { id: 16, token_path: 'typography.fontFamily.sans',    token_type: 'fontFamily', token_value: "'Inter', sans-serif",              description: null, collection_name: 'typography', mode: 'Light' },
    { id: 17, token_path: 'typography.fontWeight.bold',    token_type: 'fontWeight', token_value: '700',                              description: null, collection_name: 'typography', mode: 'Light' },
    { id: 18, token_path: 'shadows.md',                    token_type: 'shadow',     token_value: '0 4px 6px -1px rgba(0,0,0,0.1)', description: null, collection_name: 'effects',   mode: 'Light' },
    { id: 19, token_path: 'misc.enabled',                  token_type: 'boolean',    token_value: 'true',                             description: null, collection_name: 'misc',       mode: 'Light' },
]

// ---------------------------------------------------------------------------
// 1. Helper functions (types.ts)
// ---------------------------------------------------------------------------

describe('detectSemanticRole', () => {
    it('detects "primary" from a simple path', () => {
        expect(detectSemanticRole('colors.primary')).toBe('primary')
    })

    it('detects "secondary" from a nested path', () => {
        expect(detectSemanticRole('brand.secondary.default')).toBe('secondary')
    })

    it('detects "success" regardless of surrounding segments', () => {
        expect(detectSemanticRole('semantic.success.light')).toBe('success')
    })

    it('detects "warning" when embedded mid-path', () => {
        expect(detectSemanticRole('palette.warning')).toBe('warning')
    })

    it('detects "error" from a token path containing "error"', () => {
        expect(detectSemanticRole('colors.error')).toBe('error')
    })

    it('detects "info" from token path', () => {
        expect(detectSemanticRole('ui.info.muted')).toBe('info')
    })

    it('detects "surface" from token path', () => {
        expect(detectSemanticRole('colors.surface')).toBe('surface')
    })

    it('detects "background" from token path', () => {
        expect(detectSemanticRole('colors.background')).toBe('background')
    })

    it('detects "foreground" from token path', () => {
        expect(detectSemanticRole('colors.foreground')).toBe('foreground')
    })

    it('detects "text" from token path', () => {
        expect(detectSemanticRole('typography.text.base')).toBe('text')
    })

    it('detects "border" from token path', () => {
        expect(detectSemanticRole('colors.border')).toBe('border')
    })

    it('detects "muted" from token path', () => {
        expect(detectSemanticRole('colors.muted')).toBe('muted')
    })

    it('returns null for a palette shade path with no role keyword', () => {
        expect(detectSemanticRole('colors.blue.500')).toBeNull()
    })

    it('returns null for an unrecognised generic path', () => {
        expect(detectSemanticRole('animation.duration.fast')).toBeNull()
    })

    it('is case-insensitive', () => {
        expect(detectSemanticRole('Colors.PRIMARY')).toBe('primary')
    })
})

// ---------------------------------------------------------------------------

describe('detectShade', () => {
    it('extracts a 3-digit shade from a standard palette path', () => {
        expect(detectShade('colors.blue.500')).toBe(500)
    })

    it('extracts a 2-digit shade', () => {
        expect(detectShade('palette.gray.50')).toBe(50)
    })

    it('returns null for a path without a numeric shade', () => {
        expect(detectShade('colors.primary')).toBeNull()
    })

    it('returns null for a path ending in a non-shade word', () => {
        expect(detectShade('typography.fontFamily.sans')).toBeNull()
    })

    it('returns null for a single-segment path', () => {
        expect(detectShade('primary')).toBeNull()
    })

    it('does not match a 4-digit number (not a shade)', () => {
        // regex requires exactly 2–3 digits at end of path segment
        expect(detectShade('animation.delay.1000')).toBeNull()
    })

    it('extracts shade 100 correctly', () => {
        expect(detectShade('colors.zinc.100')).toBe(100)
    })

    it('extracts shade 950 correctly', () => {
        expect(detectShade('colors.slate.950')).toBe(950)
    })
})

// ---------------------------------------------------------------------------

describe('extractColorFamily', () => {
    it('extracts the family before a 3-digit shade', () => {
        expect(extractColorFamily('colors.blue.500')).toBe('blue')
    })

    it('extracts the family from a deeper path before a shade', () => {
        expect(extractColorFamily('colors.brand.emerald.100')).toBe('emerald')
    })

    it('returns the last segment when no shade is present (semantic path)', () => {
        expect(extractColorFamily('colors.primary')).toBe('primary')
    })

    it('returns the last segment for a two-segment path with no shade', () => {
        expect(extractColorFamily('palette.accent')).toBe('accent')
    })

    it('extracts family before a 2-digit shade', () => {
        expect(extractColorFamily('palette.gray.50')).toBe('gray')
    })

    it('returns null for a single-segment path', () => {
        expect(extractColorFamily('blue')).toBeNull()
    })
})

// ---------------------------------------------------------------------------

describe('filterTokens', () => {
    it('returns all tokens when no options are given', () => {
        expect(filterTokens(SAMPLE_TOKENS)).toHaveLength(SAMPLE_TOKENS.length)
    })

    it('returns all tokens when options is an empty object', () => {
        expect(filterTokens(SAMPLE_TOKENS, {})).toHaveLength(SAMPLE_TOKENS.length)
    })

    it('filters by mode', () => {
        const darkToken: DesignToken = {
            ...SAMPLE_TOKENS[0],
            id: 99,
            mode: 'Dark',
        }
        const combined = [...SAMPLE_TOKENS, darkToken]
        const result = filterTokens(combined, { mode: 'Dark' })
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe(99)
    })

    it('returns empty array when mode matches nothing', () => {
        expect(filterTokens(SAMPLE_TOKENS, { mode: 'HighContrast' })).toHaveLength(0)
    })

    it('filters by collection', () => {
        const result = filterTokens(SAMPLE_TOKENS, { collection: 'primitives' })
        expect(result.every(t => t.collection_name === 'primitives')).toBe(true)
        expect(result.length).toBeGreaterThan(0)
    })

    it('filters by both mode and collection simultaneously', () => {
        const extra: DesignToken = {
            ...SAMPLE_TOKENS[0],
            id: 88,
            mode: 'Dark',
            collection_name: 'primitives',
        }
        const combined = [...SAMPLE_TOKENS, extra]
        const result = filterTokens(combined, { mode: 'Dark', collection: 'primitives' })
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe(88)
    })

    it('does not mutate the input array', () => {
        const original = [...SAMPLE_TOKENS]
        filterTokens(SAMPLE_TOKENS, { mode: 'Dark' })
        expect(SAMPLE_TOKENS).toHaveLength(original.length)
    })
})

// ---------------------------------------------------------------------------
// 2. Adapter registry (index.ts)
// ---------------------------------------------------------------------------

describe('adapter registry', () => {
    describe('hasAdapter', () => {
        it('returns true for "primeng"', () => {
            expect(hasAdapter('primeng')).toBe(true)
        })

        it('returns true for "shadcn"', () => {
            expect(hasAdapter('shadcn')).toBe(true)
        })

        it('returns true for "mui"', () => {
            expect(hasAdapter('mui')).toBe(true)
        })

        it('returns true for "tailwind"', () => {
            expect(hasAdapter('tailwind')).toBe(true)
        })

        it('returns false for an unregistered library', () => {
            expect(hasAdapter('antd' as LibraryTarget)).toBe(false)
        })
    })

    describe('getAvailableLibraries', () => {
        it('includes all four shipped adapters', () => {
            const libs = getAvailableLibraries()
            expect(libs).toContain('primeng')
            expect(libs).toContain('shadcn')
            expect(libs).toContain('mui')
            expect(libs).toContain('tailwind')
        })

        it('returns an array', () => {
            expect(Array.isArray(getAvailableLibraries())).toBe(true)
        })
    })

    describe('getAdapter', () => {
        it('returns an adapter with the correct library field', () => {
            const adapter = getAdapter('primeng')
            expect(adapter.library).toBe('primeng')
        })

        it('returns a fresh instance on each call (factory pattern)', () => {
            const a1 = getAdapter('shadcn')
            const a2 = getAdapter('shadcn')
            expect(a1).not.toBe(a2)
        })

        it('throws for an unregistered library with a helpful message', () => {
            expect(() => getAdapter('carbon' as LibraryTarget)).toThrowError(
                /No adapter registered for library: carbon/,
            )
        })

        it('the thrown error message lists available libraries', () => {
            try {
                getAdapter('chakra' as LibraryTarget)
            } catch (err) {
                expect((err as Error).message).toMatch(/Available:/)
            }
        })
    })

    describe('getAdapterCatalog', () => {
        it('returns an entry for every registered adapter', () => {
            const catalog = getAdapterCatalog()
            const libs = getAvailableLibraries()
            expect(catalog).toHaveLength(libs.length)
        })

        it('each entry has the required shape', () => {
            const catalog = getAdapterCatalog()
            for (const entry of catalog) {
                expect(entry).toHaveProperty('library')
                expect(entry).toHaveProperty('displayName')
                expect(entry).toHaveProperty('description')
                expect(entry).toHaveProperty('defaultFilename')
                expect(typeof entry.displayName).toBe('string')
                expect(entry.displayName.length).toBeGreaterThan(0)
            }
        })

        it('includes the PrimeNG entry with correct metadata', () => {
            const catalog = getAdapterCatalog()
            const prime = catalog.find(e => e.library === 'primeng')
            expect(prime).toBeDefined()
            expect(prime!.defaultFilename).toBe('flint-preset.ts')
        })

        it('includes the shadcn entry with globals.css filename', () => {
            const catalog = getAdapterCatalog()
            const shadcn = catalog.find(e => e.library === 'shadcn')
            expect(shadcn).toBeDefined()
            expect(shadcn!.defaultFilename).toBe('globals.css')
        })
    })
})

// ---------------------------------------------------------------------------
// 3. PrimeAdapter (primeAdapter.ts)
// ---------------------------------------------------------------------------

describe('PrimeAdapter', () => {
    let adapter: PrimeAdapter

    beforeEach(() => {
        adapter = new PrimeAdapter()
    })

    // metadata
    it('has the correct library identifier', () => {
        expect(adapter.library).toBe('primeng')
    })

    it('has a non-empty displayName', () => {
        expect(adapter.displayName.length).toBeGreaterThan(0)
    })

    it('reports "flint-preset.ts" as the default filename', () => {
        expect(adapter.defaultFilename).toBe('flint-preset.ts')
    })

    // code generation shape
    it('generates TypeScript output with definePreset() call', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('definePreset')
    })

    it('imports from @primeng/themes', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain("'@primeng/themes'")
    })

    it('exports FlintPreset', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('FlintPreset')
    })

    it('uses "aura" as the default base preset', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('Aura')
    })

    it('honours a custom basePreset option', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS, { basePreset: 'material' })
        expect(output.code).toContain('Material')
    })

    // primitive tier — color palettes
    it('places blue palette tokens in the primitive tier', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('primitive:')
        expect(output.code).toContain('blue:')
    })

    it('includes shade steps 50, 500, 700, 900 in the blue scale', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain("50: '#eff6ff'")
        expect(output.code).toContain("500: '#3b82f6'")
        expect(output.code).toContain("700: '#1d4ed8'")
        expect(output.code).toContain("900: '#1e3a5f'")
    })

    it('maps tokenMap entries for palette colors', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['primitive.blue.500']).toBe('#3b82f6')
        expect(output.tokenMap['primitive.blue.700']).toBe('#1d4ed8')
    })

    // primitive tier — border radius
    it('places radius.md in the primitive borderRadius block', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('borderRadius:')
        expect(output.code).toContain("md: '6px'")
    })

    it('maps borderRadius to tokenMap', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['primitive.borderRadius.md']).toBe('6px')
    })

    // semantic tier — roles
    it('places primary color in the semantic colorScheme', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('semantic:')
        expect(output.code).toContain("color: '#3b82f6'")
    })

    it('places secondary color in the highlight block', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain("background: '#8b5cf6'")
    })

    it('maps semantic.primary to tokenMap', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['semantic.primary']).toBe('#3b82f6')
    })

    // semantic tier — fontFamily
    it('outputs fontFamily in the semantic tier', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('fontFamily:')
        expect(output.code).toContain('Inter')
    })

    it('maps semantic.fontFamily to tokenMap', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['semantic.fontFamily.sans']).toContain('Inter')
    })

    // output metadata
    it('sets library to "primeng"', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.library).toBe('primeng')
    })

    it('sets mimeType to application/typescript', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.mimeType).toBe('application/typescript')
    })

    it('reports a positive tokenCount', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenCount).toBeGreaterThan(0)
    })

    // skipped tokens
    it('skips boolean tokens and records the reason', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const booleanSkip = output.skippedTokens.find(
            s => s.tokenPath === 'misc.enabled',
        )
        expect(booleanSkip).toBeDefined()
        expect(booleanSkip!.tokenType).toBe('boolean')
        expect(booleanSkip!.reason).toMatch(/no PrimeNG equivalent/i)
    })

    it('does not skip color or dimension tokens', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const skippedPaths = output.skippedTokens.map(s => s.tokenPath)
        expect(skippedPaths).not.toContain('colors.blue.500')
        expect(skippedPaths).not.toContain('radius.md')
    })

    // collection filter
    it('respects the collection option and only maps tokens from that collection', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS, { collection: 'primitives' })
        // Only primitive blue tokens should map; semantic tokens are in 'semantic' collection
        expect(output.tokenMap['semantic.primary']).toBeUndefined()
        expect(output.tokenMap['primitive.blue.500']).toBe('#3b82f6')
    })

    // validate
    describe('validate()', () => {
        it('returns valid=true for well-formed output', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const result = adapter.validate(output)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('returns valid=false when definePreset is absent', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replaceAll('definePreset', 'REMOVED') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('definePreset'))).toBe(true)
        })

        it('returns valid=false when @primeng/themes import is absent', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replaceAll('@primeng/themes', 'other-pkg') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('@primeng/themes'))).toBe(true)
        })

        it('returns valid=false for unbalanced braces', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code + '{{{' }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('brace'))).toBe(true)
        })

        it('returns an empty error array (not null/undefined) when valid', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const result = adapter.validate(output)
            expect(Array.isArray(result.errors)).toBe(true)
        })
    })

    // empty token set
    it('handles an empty token array without throwing', () => {
        expect(() => adapter.mapTokens([])).not.toThrow()
    })

    it('reports tokenCount 0 for an empty token array', () => {
        const output = adapter.mapTokens([])
        expect(output.tokenCount).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// 4. ShadcnAdapter (shadcnAdapter.ts)
// ---------------------------------------------------------------------------

describe('ShadcnAdapter', () => {
    let adapter: ShadcnAdapter

    beforeEach(() => {
        adapter = new ShadcnAdapter()
    })

    // metadata
    it('has the correct library identifier', () => {
        expect(adapter.library).toBe('shadcn')
    })

    it('reports "globals.css" as the default filename', () => {
        expect(adapter.defaultFilename).toBe('globals.css')
    })

    it('sets mimeType to text/css', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.mimeType).toBe('text/css')
    })

    // CSS structure
    it('generates @layer base wrapper', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('@layer base')
    })

    it('generates a :root selector', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain(':root')
    })

    it('generates a .dark selector', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('.dark')
    })

    it('outputs CSS custom properties (-- prefix)', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('--')
    })

    // semantic color → CSS variable mapping
    it('maps primary color to --primary in HSL format', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        // #3b82f6 should become an HSL string like "217.2 91.2% 59.8%"
        expect(output.code).toMatch(/--primary:\s+[\d.]+ [\d.]+% [\d.]+%;/)
    })

    it('maps the "error" semantic token to --destructive', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('--destructive:')
    })

    it('maps the "border" semantic token to --border', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('--border:')
    })

    it('maps the "muted" semantic token to --muted', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('--muted:')
    })

    it('maps the "background" semantic token to --background', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('--background:')
    })

    // hex to HSL conversion
    it('converts pure white (#ffffff) to HSL 0 0% 100%', () => {
        const whiteOnly: DesignToken[] = [{
            id: 1, token_path: 'colors.background', token_type: 'color',
            token_value: '#ffffff', description: null, collection_name: 'semantic', mode: 'Light',
        }]
        const output = adapter.mapTokens(whiteOnly)
        expect(output.code).toContain('0 0% 100%')
    })

    it('converts pure black (#000000) to HSL 0 0% 0%', () => {
        const blackOnly: DesignToken[] = [{
            id: 1, token_path: 'colors.foreground', token_type: 'color',
            token_value: '#000000', description: null, collection_name: 'semantic', mode: 'Light',
        }]
        const output = adapter.mapTokens(blackOnly)
        expect(output.code).toContain('0 0% 0%')
    })

    // foreground auto-derivation
    it('auto-derives a light --primary-foreground for a dark primary color', () => {
        // #0f172a is very dark → should get a light foreground
        const darkPrimary: DesignToken[] = [{
            id: 1, token_path: 'colors.primary', token_type: 'color',
            token_value: '#0f172a', description: null, collection_name: 'semantic', mode: 'Light',
        }]
        const output = adapter.mapTokens(darkPrimary)
        // dark background → foreground should be "0 0% 98%"
        expect(output.code).toContain('--primary-foreground:')
        expect(output.code).toContain('0 0% 98%')
    })

    it('auto-derives a dark --background-foreground for a light background color', () => {
        // #ffffff is light → foreground should be "0 0% 9%"
        const lightBg: DesignToken[] = [{
            id: 1, token_path: 'colors.background', token_type: 'color',
            token_value: '#ffffff', description: null, collection_name: 'semantic', mode: 'Light',
        }]
        const output = adapter.mapTokens(lightBg)
        expect(output.code).toContain('--background-foreground:')
        expect(output.code).toContain('0 0% 9%')
    })

    // tokenMap
    it('populates tokenMap with source hex values for mapped variables', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        // --primary should reference the original hex value
        expect(output.tokenMap['--primary']).toBe('#3b82f6')
    })

    it('includes a default radius in the output', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('--radius:')
    })

    // skipped tokens — dimension and shadow go to Tailwind
    it('skips dimension tokens with an informative reason', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const skip = output.skippedTokens.find(s => s.tokenPath === 'spacing.base')
        expect(skip).toBeDefined()
        expect(skip!.reason).toMatch(/tailwind/i)
    })

    it('skips shadow tokens with an informative reason', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const skip = output.skippedTokens.find(s => s.tokenPath === 'shadows.md')
        expect(skip).toBeDefined()
        expect(skip!.reason).toMatch(/tailwind/i)
    })

    it('does not skip fontFamily or fontWeight tokens (treated silently)', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const skippedPaths = output.skippedTokens.map(s => s.tokenPath)
        expect(skippedPaths).not.toContain('typography.fontFamily.sans')
        expect(skippedPaths).not.toContain('typography.fontWeight.bold')
    })

    // validate
    describe('validate()', () => {
        it('returns valid=true for well-formed output', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const result = adapter.validate(output)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('returns valid=false when @layer base is missing', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replace('@layer base', '@layer OTHER') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('@layer base'))).toBe(true)
        })

        it('returns valid=false when :root is missing', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replace(':root', ':host') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes(':root'))).toBe(true)
        })

        it('returns valid=false when there are no CSS custom properties', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: '@layer base { :root { } .dark { } }' }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('custom properties'))).toBe(true)
        })

        it('returns valid=false for unbalanced braces', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code + '{' }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('brace'))).toBe(true)
        })
    })

    // edge cases
    it('handles an empty token array without throwing', () => {
        expect(() => adapter.mapTokens([])).not.toThrow()
    })

    it('returns tokenCount 0 when no color tokens are present', () => {
        const nonColorOnly = SAMPLE_TOKENS.filter(t => t.token_type !== 'color')
        const output = adapter.mapTokens(nonColorOnly)
        expect(output.tokenCount).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// 5. MuiAdapter (muiAdapter.ts)
// ---------------------------------------------------------------------------

describe('MuiAdapter', () => {
    let adapter: MuiAdapter

    beforeEach(() => {
        adapter = new MuiAdapter()
    })

    // metadata
    it('has the correct library identifier', () => {
        expect(adapter.library).toBe('mui')
    })

    it('reports "flint-theme.ts" as the default filename', () => {
        expect(adapter.defaultFilename).toBe('flint-theme.ts')
    })

    it('sets mimeType to application/typescript', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.mimeType).toBe('application/typescript')
    })

    // code structure
    it('generates createTheme() call', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('createTheme')
    })

    it('imports from @mui/material/styles', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain("'@mui/material/styles'")
    })

    it('exports flintTheme', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('flintTheme')
    })

    // palette — semantic role mapping
    it('maps the primary semantic color to palette.primary.main', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('primary:')
        expect(output.code).toContain("main: '#3b82f6'")
    })

    it('maps the secondary semantic color to palette.secondary.main', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('secondary:')
        expect(output.code).toContain("main: '#8b5cf6'")
    })

    it('maps the error semantic color to palette.error.main', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('error:')
        expect(output.code).toContain("main: '#ef4444'")
    })

    it('maps the success semantic color to palette.success.main', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('success:')
        expect(output.code).toContain("main: '#22c55e'")
    })

    // palette — shade scale mapping (300→light, 500→main, 700→dark)
    it('maps shade 500 to main, 300 to light, 700 to dark when using a shade scale', () => {
        const shadeTokens: DesignToken[] = [
            { id: 1, token_path: 'colors.blue.300', token_type: 'color', token_value: '#93c5fd', description: null, collection_name: 'primitives', mode: 'Light' },
            { id: 2, token_path: 'colors.blue.500', token_type: 'color', token_value: '#3b82f6', description: null, collection_name: 'primitives', mode: 'Light' },
            { id: 3, token_path: 'colors.blue.700', token_type: 'color', token_value: '#1d4ed8', description: null, collection_name: 'primitives', mode: 'Light' },
        ]
        const output = adapter.mapTokens(shadeTokens)
        // "blue" maps to the "info" MUI role
        expect(output.code).toContain("main: '#3b82f6'")
        expect(output.code).toContain("light: '#93c5fd'")
        expect(output.code).toContain("dark: '#1d4ed8'")
    })

    it('populates tokenMap with palette.primary.main', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['palette.primary.main']).toBe('#3b82f6')
    })

    it('populates tokenMap with palette.error.main', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['palette.error.main']).toBe('#ef4444')
    })

    // background
    it('maps the background semantic token to palette.background.default', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('background:')
        expect(output.code).toContain("default: '#ffffff'")
    })

    it('maps the surface semantic token to palette.background.paper', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain("paper: '#f8fafc'")
    })

    // text
    it('maps the foreground token to palette.text.primary', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('text:')
        expect(output.code).toContain("primary: '#0f172a'")
    })

    it('maps the muted token to palette.text.secondary', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain("secondary: '#94a3b8'")
    })

    // typography
    it('emits the typography.fontFamily block', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('typography:')
        expect(output.code).toContain('fontFamily:')
        expect(output.code).toContain("fontFamily:")
        expect(output.code).toContain("Inter")
    })

    it('maps typography.fontFamily to tokenMap', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['typography.fontFamily']).toContain('Inter')
    })

    // shape — borderRadius
    it('emits the shape.borderRadius from radius dimension token', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('shape:')
        expect(output.code).toContain('borderRadius: 6')
    })

    it('maps shape.borderRadius to tokenMap', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenMap['shape.borderRadius']).toBe('6')
    })

    // spacing
    it('emits spacing when a spacing.base dimension token is present', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('spacing:')
        expect(output.code).toContain('8')
    })

    // skipped tokens
    it('skips boolean tokens and records the reason', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const skip = output.skippedTokens.find(s => s.tokenPath === 'misc.enabled')
        expect(skip).toBeDefined()
        expect(skip!.reason).toMatch(/no MUI theme equivalent/i)
    })

    // validate
    describe('validate()', () => {
        it('returns valid=true for well-formed output', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const result = adapter.validate(output)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('returns valid=false when createTheme is missing', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replaceAll('createTheme', 'buildTheme') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('createTheme'))).toBe(true)
        })

        it('returns valid=false when @mui/material/styles import is missing', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = {
                ...output,
                code: output.code.replace("'@mui/material/styles'", "'@emotion/react'"),
            }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('@mui/material/styles'))).toBe(true)
        })

        it('returns valid=false for unbalanced braces', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code + '}}}' }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
            expect(result.errors.some(e => e.message.includes('brace'))).toBe(true)
        })
    })

    // edge cases
    it('handles an empty token array without throwing', () => {
        expect(() => adapter.mapTokens([])).not.toThrow()
    })

    it('reports a non-negative tokenCount', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenCount).toBeGreaterThanOrEqual(0)
    })
})

// ---------------------------------------------------------------------------
// 6. TailwindAdapter (tailwindAdapter.ts)
// ---------------------------------------------------------------------------

describe('TailwindAdapter', () => {
    let adapter: TailwindAdapter

    beforeEach(() => {
        adapter = new TailwindAdapter()
    })

    // metadata
    it('has the correct library identifier', () => {
        expect(adapter.library).toBe('tailwind')
    })

    it('reports "tailwind.config.ts" as the default filename', () => {
        expect(adapter.defaultFilename).toBe('tailwind.config.ts')
    })

    // LibraryThemeOutput shape contract
    it('returns a LibraryThemeOutput with all required fields', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output).toHaveProperty('library', 'tailwind')
        expect(output).toHaveProperty('code')
        expect(output).toHaveProperty('filename')
        expect(output).toHaveProperty('tokenCount')
        expect(output).toHaveProperty('skippedTokens')
        expect(output).toHaveProperty('mimeType')
        expect(output).toHaveProperty('tokenMap')
    })

    it('delegates code generation to TailwindEmitter (contains "export default")', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('export default')
    })

    it('delegates code generation to TailwindEmitter (contains "satisfies Config")', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.code).toContain('satisfies Config')
    })

    it('populates tokenMap with every filtered token path', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        // All tokens are in mode 'Light' — no filter applied, so all paths should appear
        for (const token of SAMPLE_TOKENS) {
            expect(output.tokenMap[token.token_path]).toBe(token.token_value)
        }
    })

    it('applies mode filter before building tokenMap', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS, { mode: 'Dark' })
        // No Dark tokens in fixture → tokenMap should be empty
        expect(Object.keys(output.tokenMap)).toHaveLength(0)
    })

    it('reports a non-negative tokenCount', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.tokenCount).toBeGreaterThanOrEqual(0)
    })

    it('skippedTokens is an array (possibly empty)', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(Array.isArray(output.skippedTokens)).toBe(true)
    })

    it('skips boolean tokens (no Tailwind equivalent)', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        const skip = output.skippedTokens.find(s => s.tokenPath === 'misc.enabled')
        expect(skip).toBeDefined()
    })

    it('sets mimeType to application/typescript', () => {
        const output = adapter.mapTokens(SAMPLE_TOKENS)
        expect(output.mimeType).toBe('application/typescript')
    })

    // validate delegates to TailwindEmitter
    describe('validate()', () => {
        it('returns valid=true for well-formed TailwindEmitter output', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const result = adapter.validate(output)
            expect(result.valid).toBe(true)
        })

        it('returns valid=false when "export default" is missing', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replace('export default', 'module.exports =') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
        })

        it('returns valid=false when "satisfies Config" is missing', () => {
            const output = adapter.mapTokens(SAMPLE_TOKENS)
            const broken = { ...output, code: output.code.replace('satisfies Config', '') }
            const result = adapter.validate(broken)
            expect(result.valid).toBe(false)
        })
    })

    it('handles an empty token array without throwing', () => {
        expect(() => adapter.mapTokens([])).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// 7. handleMapTokens tool handler (mapTokens.ts)
// ---------------------------------------------------------------------------

describe('handleMapTokens', () => {
    // ── "list" mode ─────────────────────────────────────────────────────────

    describe('"list" mode', () => {
        it('returns content without isError', () => {
            const result = handleMapTokens({ library: 'list' })
            expect(result.isError).toBeUndefined()
        })

        it('lists all four registered adapters', () => {
            const result = handleMapTokens({ library: 'list' })
            const text = result.content[0].text
            expect(text).toContain('primeng')
            expect(text).toContain('shadcn')
            expect(text).toContain('mui')
            expect(text).toContain('tailwind')
        })

        it('includes the word "adapters" in the response', () => {
            const result = handleMapTokens({ library: 'list' })
            expect(result.content[0].text).toMatch(/adapters/i)
        })

        it('returns content as an array with a text element', () => {
            const result = handleMapTokens({ library: 'list' })
            expect(Array.isArray(result.content)).toBe(true)
            expect(result.content[0].type).toBe('text')
        })
    })

    // ── unknown library ──────────────────────────────────────────────────────

    describe('unknown library', () => {
        it('returns isError=true for an unregistered library name', () => {
            const result = handleMapTokens({ library: 'bootstrap' })
            expect(result.isError).toBe(true)
        })

        it('names the unknown library in the error text', () => {
            const result = handleMapTokens({ library: 'bootstrap' })
            expect(result.content[0].text).toContain('bootstrap')
        })

        it('suggests using library="list" in the error message', () => {
            const result = handleMapTokens({ library: 'chakra' })
            expect(result.content[0].text).toMatch(/list/i)
        })

        it('still returns a content array (not throws)', () => {
            expect(() => handleMapTokens({ library: 'antd' })).not.toThrow()
            const result = handleMapTokens({ library: 'antd' })
            expect(Array.isArray(result.content)).toBe(true)
        })
    })

    // ── missing tokens file ──────────────────────────────────────────────────

    describe('missing tokens file', () => {
        it('returns isError=true when projectRoot has no .flint/design-tokens.json', () => {
            const nonexistentRoot = path.join(os.tmpdir(), 'flint-no-such-dir-' + Date.now())
            const result = handleMapTokens({ library: 'primeng', projectRoot: nonexistentRoot })
            expect(result.isError).toBe(true)
        })

        it('mentions the missing file path in the error text', () => {
            const nonexistentRoot = path.join(os.tmpdir(), 'flint-no-such-dir-' + Date.now())
            const result = handleMapTokens({ library: 'shadcn', projectRoot: nonexistentRoot })
            expect(result.content[0].text).toMatch(/design-tokens\.json/i)
        })

        it('suggests running flint_sync_tokens or flint_ingest_figma', () => {
            const nonexistentRoot = path.join(os.tmpdir(), 'flint-empty-' + Date.now())
            const result = handleMapTokens({ library: 'mui', projectRoot: nonexistentRoot })
            expect(result.content[0].text).toMatch(/flint_sync_tokens|flint_ingest_figma/i)
        })
    })

    // ── file read tests (real fs via temp dir) ───────────────────────────────

    describe('with a real tokens file', () => {
        let tmpDir: string

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-maptoken-test-'))
            const flintDir = path.join(tmpDir, '.flint')
            fs.mkdirSync(flintDir, { recursive: true })
        })

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        })

        it('returns a successful response for primeng with valid tokens', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'primeng', projectRoot: tmpDir })
            expect(result.isError).toBeUndefined()
            expect(result.content[0].text).toContain('definePreset')
        })

        it('returns a successful response for shadcn with valid tokens', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'shadcn', projectRoot: tmpDir })
            expect(result.isError).toBeUndefined()
            expect(result.content[0].text).toContain('@layer base')
        })

        it('returns a successful response for mui with valid tokens', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'mui', projectRoot: tmpDir })
            expect(result.isError).toBeUndefined()
            expect(result.content[0].text).toContain('createTheme')
        })

        it('returns a successful response for tailwind with valid tokens', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'tailwind', projectRoot: tmpDir })
            expect(result.isError).toBeUndefined()
            expect(result.content[0].text).toContain('export default')
        })

        it('returns isError=true for a malformed JSON tokens file', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                'NOT_VALID_JSON',
                'utf-8',
            )
            const result = handleMapTokens({ library: 'primeng', projectRoot: tmpDir })
            expect(result.isError).toBe(true)
            expect(result.content[0].text).toMatch(/Failed to read design tokens/i)
        })

        it('returns isError=true when tokens file contains a non-array JSON value', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify({ tokens: [] }),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'primeng', projectRoot: tmpDir })
            expect(result.isError).toBe(true)
        })

        it('returns isError=true when design-tokens.json is an empty array', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify([]),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'shadcn', projectRoot: tmpDir })
            expect(result.isError).toBe(true)
            expect(result.content[0].text).toMatch(/empty/i)
        })

        it('reports how many tokens were mapped in the success response', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'primeng', projectRoot: tmpDir })
            // Response format: "Tokens mapped: X / Y"
            expect(result.content[0].text).toMatch(/Tokens mapped: \d+ \/ \d+/)
        })

        it('includes validation result in response text', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'primeng', projectRoot: tmpDir })
            expect(result.content[0].text).toMatch(/validation/i)
        })

        it('indicates dry run when writeFile is not set', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'shadcn', projectRoot: tmpDir })
            expect(result.content[0].text).toMatch(/dry run/i)
        })

        it('writes the output file to disk when writeFile=true', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            handleMapTokens({ library: 'primeng', projectRoot: tmpDir, writeFile: true })
            const written = path.join(tmpDir, 'flint-preset.ts')
            expect(fs.existsSync(written)).toBe(true)
        })

        it('writes to a custom outputPath when writeFile=true and outputPath is set', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const customPath = path.join(tmpDir, 'custom-theme.ts')
            handleMapTokens({
                library: 'primeng',
                projectRoot: tmpDir,
                writeFile: true,
                outputPath: customPath,
            })
            expect(fs.existsSync(customPath)).toBe(true)
        })

        it('mentions "Written to:" in the response when writeFile=true', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({
                library: 'shadcn',
                projectRoot: tmpDir,
                writeFile: true,
            })
            expect(result.content[0].text).toContain('Written to:')
        })

        it('passes mode option through to the adapter', () => {
            // All fixture tokens are mode: 'Light' — using mode: 'Dark' should map 0 tokens
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({
                library: 'primeng',
                projectRoot: tmpDir,
                mode: 'Dark',
            })
            // Should succeed but map 0 tokens
            expect(result.isError).toBeUndefined()
            expect(result.content[0].text).toMatch(/Tokens mapped: 0/)
        })

        it('passes collection option through to the adapter', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({
                library: 'primeng',
                projectRoot: tmpDir,
                collection: 'primitives',
            })
            expect(result.isError).toBeUndefined()
        })

        it('passes basePreset option through to PrimeAdapter', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({
                library: 'primeng',
                projectRoot: tmpDir,
                basePreset: 'lara',
            })
            expect(result.content[0].text).toContain('Lara')
        })

        it('includes skipped token summary when tokens were skipped', () => {
            fs.writeFileSync(
                path.join(tmpDir, '.flint', 'design-tokens.json'),
                JSON.stringify(SAMPLE_TOKENS),
                'utf-8',
            )
            const result = handleMapTokens({ library: 'primeng', projectRoot: tmpDir })
            // SAMPLE_TOKENS contains boolean token which is skipped by PrimeAdapter
            expect(result.content[0].text).toMatch(/Skipped \d+ token/i)
        })
    })
})
