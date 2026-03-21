/**
 * Token extractor tests — flint-mcp/src/__tests__/tokenExtractor.test.ts
 *
 * Validates that extractTokens() correctly extracts design tokens from each
 * supported framework type, with proper type inference and error handling.
 *
 * Test map:
 *   1  — Extracts flat colors from Tailwind v3 theme
 *   2  — Extracts nested colors: { primary: { 500: '#...' } }
 *   3  — Extracts spacing from Tailwind v3 theme
 *   4  — Skips inherit/transparent/currentColor/current in Tailwind
 *   5  — Extracts CSS custom properties from :root block
 *   6  — Infers token type from CSS property name (shadow, fontFamily, etc.)
 *   7  — Infers token type from CSS value format (hex → color, px → dimension)
 *   8  — Reads W3C DTCG format ($value + $type keys)
 *   9  — Returns static tokens for Chakra UI
 *   10 — Returns static tokens for Material UI
 *   11 — Returns static tokens for Radix UI
 *   12 — Returns empty with warning for 'none'
 *   13 — Handles Tailwind config import failure gracefully (no crash)
 *   14 — Extracts Tailwind v4 @theme CSS custom properties
 *   15 — Reads Tokens Studio format (value/type without $)
 *   16 — flattenThemeObject: handles font family arrays
 *   17 — extractTokens with dtcg returns Flint native JSON array as-is
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'

// ── Shared mock file map (same pattern as stackDetector tests) ────────────────
const mockFiles: Map<string, string> = new Map()

vi.mock('node:fs', () => {
    return {
        default: {
            existsSync: (p: string) => mockFiles.has(p),
            readFileSync: (p: string, _enc?: string) => {
                const v = mockFiles.get(p)
                if (v === undefined) throw new Error(`ENOENT: no such file: ${p}`)
                return v
            },
            readdirSync: (_dir: string) => [],
        },
        existsSync: (p: string) => mockFiles.has(p),
        readFileSync: (p: string, _enc?: string) => {
            const v = mockFiles.get(p)
            if (v === undefined) throw new Error(`ENOENT: no such file: ${p}`)
            return v
        },
        readdirSync: (_dir: string) => [],
    }
})

// Mock dynamic import so we can simulate tailwind config loading
vi.mock('node:module', () => ({
    createRequire: () => (configPath: string) => {
        const content = mockFiles.get(configPath)
        if (!content) throw new Error(`Cannot require ${configPath}`)
        // Evaluate the content as a simple JSON-like object
        // (tests use JSON-serializable config objects)
        return JSON.parse(content) as unknown
    },
    pathToFileURL: (p: string) => ({ href: `file://${p}` }),
}))

// We also mock the dynamic import() calls for tailwind configs.
// The module uses: await import(fileUrl).catch(() => null)
// We can't easily mock import() itself in Vitest ESM, so we rely on the
// createRequire fallback path that is used when import() returns null.
vi.mock('node:url', () => ({
    pathToFileURL: (p: string) => ({ href: `file://${p}` }),
}))

import { extractTokens, flattenThemeObject } from '../core/init/tokenExtractor.js'
import type { StackDetectionResult } from '../core/init/types.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = '/project'

function file(relativePath: string, content: string): void {
    mockFiles.set(path.join(ROOT, relativePath), content)
}

function makeStack(overrides: Partial<StackDetectionResult>): StackDetectionResult {
    return {
        framework: 'none',
        configPath: null,
        cssFiles: [],
        tokenFiles: [],
        packageDeps: [],
        uiFramework: 'unknown',
        typescript: false,
        ...overrides,
    }
}

// ── flattenThemeObject unit tests ────────────────────────────────────────────

describe('flattenThemeObject()', () => {
    it('flattens a flat object to tokens', () => {
        const tokens = flattenThemeObject({ sm: '4px', md: '8px' }, 'spacing', '')
        expect(tokens).toHaveLength(2)
        expect(tokens[0].token_path).toBe('spacing.sm')
        expect(tokens[0].token_value).toBe('4px')
        expect(tokens[0].token_type).toBe('spacing')
        expect(tokens[1].token_path).toBe('spacing.md')
    })

    it('flattens nested objects with dot-path', () => {
        const tokens = flattenThemeObject(
            { primary: { 500: '#3B82F6', 600: '#2563EB' } },
            'color',
            '',
        )
        expect(tokens).toHaveLength(2)
        expect(tokens[0].token_path).toBe('color.primary.500')
        expect(tokens[0].token_value).toBe('#3B82F6')
        expect(tokens[1].token_path).toBe('color.primary.600')
    })

    it('handles font family arrays', () => {
        const tokens = flattenThemeObject(
            { sans: ['Inter', 'ui-sans-serif', 'sans-serif'] },
            'fontFamily',
            '',
        )
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_path).toBe('fontFamily.sans')
        expect(tokens[0].token_value).toBe('Inter, ui-sans-serif, sans-serif')
        expect(tokens[0].token_type).toBe('fontFamily')
    })

    it('skips inherit, transparent, currentColor, current', () => {
        const tokens = flattenThemeObject(
            {
                inherit: 'inherit',
                current: 'current',
                transparent: 'transparent',
                currentColor: 'currentColor',
                primary: '#3B82F6',
            },
            'color',
            '',
        )
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_path).toBe('color.primary')
        expect(tokens[0].token_value).toBe('#3B82F6')
    })

    it('respects prefix parameter', () => {
        const tokens = flattenThemeObject({ 500: '#3B82F6' }, 'color', 'primary')
        expect(tokens[0].token_path).toBe('color.primary.500')
    })

    it('handles numeric values (line-height)', () => {
        const tokens = flattenThemeObject({ normal: '1.5', tight: '1.25' }, 'lineHeight', '')
        expect(tokens).toHaveLength(2)
        expect(tokens[0].token_value).toBe('1.5')
    })
})

// ── extractTokens() tests ────────────────────────────────────────────────────

describe('extractTokens()', () => {
    beforeEach(() => {
        mockFiles.clear()
    })

    afterEach(() => {
        mockFiles.clear()
    })

    // ── Test 1: Flat colors from Tailwind v3 ────────────────────────────────
    it('extracts flat colors from tailwind-v3 theme', async () => {
        const configPath = path.join(ROOT, 'tailwind.config.js')
        // createRequire fallback expects JSON-parseable content
        mockFiles.set(configPath, JSON.stringify({
            theme: {
                colors: {
                    white: '#FFFFFF',
                    black: '#000000',
                },
            },
        }))

        const stack = makeStack({ framework: 'tailwind-v3', configPath })
        const result = await extractTokens(ROOT, stack)

        expect(result.source).toContain('tailwind.config.js')
        const colorTokens = result.tokens.filter((t) => t.token_type === 'color')
        expect(colorTokens.length).toBeGreaterThanOrEqual(2)
        const white = colorTokens.find((t) => t.token_value === '#FFFFFF')
        expect(white).toBeDefined()
        expect(white?.token_path).toBe('color.white')
    })

    // ── Test 2: Nested colors ────────────────────────────────────────────────
    it('extracts nested colors from tailwind-v3 config', async () => {
        const configPath = path.join(ROOT, 'tailwind.config.js')
        mockFiles.set(configPath, JSON.stringify({
            theme: {
                colors: {
                    primary: {
                        500: '#3B82F6',
                        600: '#2563EB',
                    },
                },
            },
        }))

        const stack = makeStack({ framework: 'tailwind-v3', configPath })
        const result = await extractTokens(ROOT, stack)

        const primary500 = result.tokens.find((t) => t.token_path === 'color.primary.500')
        expect(primary500).toBeDefined()
        expect(primary500?.token_value).toBe('#3B82F6')
        expect(primary500?.token_type).toBe('color')

        const primary600 = result.tokens.find((t) => t.token_path === 'color.primary.600')
        expect(primary600).toBeDefined()
    })

    // ── Test 3: Spacing from Tailwind v3 ────────────────────────────────────
    it('extracts spacing tokens from tailwind-v3 config', async () => {
        const configPath = path.join(ROOT, 'tailwind.config.js')
        mockFiles.set(configPath, JSON.stringify({
            theme: {
                spacing: {
                    '4': '1rem',
                    '8': '2rem',
                },
            },
        }))

        const stack = makeStack({ framework: 'tailwind-v3', configPath })
        const result = await extractTokens(ROOT, stack)

        const spacing4 = result.tokens.find((t) => t.token_path === 'spacing.4')
        expect(spacing4).toBeDefined()
        expect(spacing4?.token_value).toBe('1rem')
        expect(spacing4?.token_type).toBe('spacing')
    })

    // ── Test 4: Skip Tailwind special values ─────────────────────────────────
    it('skips inherit, transparent, currentColor, current in tailwind-v3', async () => {
        const configPath = path.join(ROOT, 'tailwind.config.js')
        mockFiles.set(configPath, JSON.stringify({
            theme: {
                colors: {
                    inherit: 'inherit',
                    current: 'current',
                    transparent: 'transparent',
                    currentColor: 'currentColor',
                    primary: '#3B82F6',
                },
            },
        }))

        const stack = makeStack({ framework: 'tailwind-v3', configPath })
        const result = await extractTokens(ROOT, stack)

        const special = result.tokens.filter((t) =>
            ['inherit', 'transparent', 'currentColor', 'current'].includes(t.token_value)
        )
        expect(special).toHaveLength(0)
        const primary = result.tokens.find((t) => t.token_path === 'color.primary')
        expect(primary).toBeDefined()
    })

    // ── Test 5: CSS custom properties ────────────────────────────────────────
    it('extracts CSS custom properties from :root blocks', async () => {
        const cssPath = path.join(ROOT, 'src/globals.css')
        mockFiles.set(cssPath, `
:root {
  --color-primary: #3B82F6;
  --spacing-4: 16px;
  --font-family-sans: Inter, sans-serif;
}
        `.trim())

        const stack = makeStack({
            framework: 'css-custom-props',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        expect(result.tokens.length).toBeGreaterThanOrEqual(3)
        const colorToken = result.tokens.find((t) => t.token_path.includes('color-primary'))
        expect(colorToken).toBeDefined()
        expect(colorToken?.token_type).toBe('color')

        const spacingToken = result.tokens.find((t) => t.token_path.includes('spacing-4'))
        expect(spacingToken).toBeDefined()
        expect(spacingToken?.token_type).toBe('dimension')
    })

    // ── Test 6: Infer type from CSS property name ────────────────────────────
    it('infers shadow type from CSS property name containing "shadow"', async () => {
        const cssPath = path.join(ROOT, 'styles/theme.css')
        mockFiles.set(cssPath, `:root { --shadow-md: 0 4px 6px rgba(0,0,0,0.1); }`)

        const stack = makeStack({
            framework: 'css-custom-props',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        const shadowToken = result.tokens.find((t) => t.token_path.includes('shadow-md'))
        expect(shadowToken).toBeDefined()
        expect(shadowToken?.token_type).toBe('shadow')
    })

    it('infers fontFamily type from CSS property name containing "font-family"', async () => {
        const cssPath = path.join(ROOT, 'styles/theme.css')
        mockFiles.set(cssPath, `:root { --font-family-sans: Inter, sans-serif; }`)

        const stack = makeStack({
            framework: 'css-custom-props',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        const fontToken = result.tokens.find((t) => t.token_path.includes('font-family-sans'))
        expect(fontToken).toBeDefined()
        expect(fontToken?.token_type).toBe('fontFamily')
    })

    it('infers opacity type from CSS property name containing "opacity"', async () => {
        const cssPath = path.join(ROOT, 'styles/theme.css')
        mockFiles.set(cssPath, `:root { --opacity-50: 0.5; }`)

        const stack = makeStack({
            framework: 'css-custom-props',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        const opacityToken = result.tokens.find((t) => t.token_path.includes('opacity-50'))
        expect(opacityToken).toBeDefined()
        expect(opacityToken?.token_type).toBe('opacity')
    })

    // ── Test 7: Infer type from value format ─────────────────────────────────
    it('infers color type from hex value format', async () => {
        const cssPath = path.join(ROOT, 'styles/theme.css')
        // CSS var name has no type hint; value is hex
        mockFiles.set(cssPath, `:root { --brand: #FF5500; }`)

        const stack = makeStack({
            framework: 'css-custom-props',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        const brandToken = result.tokens.find((t) => t.token_path.includes('brand'))
        expect(brandToken).toBeDefined()
        // Should infer color from hex value
        expect(brandToken?.token_type).toBe('color')
    })

    it('infers color from rgba() value', async () => {
        const cssPath = path.join(ROOT, 'styles/theme.css')
        mockFiles.set(cssPath, `:root { --overlay: rgba(0, 0, 0, 0.5); }`)

        const stack = makeStack({
            framework: 'css-custom-props',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        const overlayToken = result.tokens.find((t) => t.token_path.includes('overlay'))
        expect(overlayToken?.token_type).toBe('color')
    })

    // ── Test 8: W3C DTCG format ──────────────────────────────────────────────
    it('reads W3C DTCG format with $value and $type keys', async () => {
        const tokenFile = path.join(ROOT, 'tokens.json')
        mockFiles.set(tokenFile, JSON.stringify({
            $schema: 'https://design-tokens.org/schema.json',
            color: {
                primary: { $value: '#3B82F6', $type: 'color', $description: 'Brand primary' },
                secondary: { $value: '#9333EA', $type: 'color' },
            },
            spacing: {
                base: { $value: '16px', $type: 'dimension' },
            },
        }))

        const stack = makeStack({
            framework: 'dtcg',
            configPath: tokenFile,
            tokenFiles: [tokenFile],
        })
        const result = await extractTokens(ROOT, stack)

        expect(result.source).toContain('tokens.json')
        const primary = result.tokens.find((t) => t.token_path === 'color.primary')
        expect(primary).toBeDefined()
        expect(primary?.token_value).toBe('#3B82F6')
        expect(primary?.token_type).toBe('color')
        expect(primary?.description).toBe('Brand primary')

        const spacing = result.tokens.find((t) => t.token_path === 'spacing.base')
        expect(spacing).toBeDefined()
        expect(spacing?.token_value).toBe('16px')
        expect(spacing?.token_type).toBe('dimension')
    })

    // ── Test 9: Chakra static defaults ──────────────────────────────────────
    it('returns static Chakra UI tokens with a default warning', async () => {
        const stack = makeStack({ framework: 'chakra' })
        const result = await extractTokens(ROOT, stack)

        expect(result.tokens.length).toBeGreaterThanOrEqual(20)
        expect(result.source).toContain('Chakra')
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('Chakra')

        const blue500 = result.tokens.find((t) => t.token_path === 'color.blue.500')
        expect(blue500).toBeDefined()
        expect(blue500?.token_type).toBe('color')
    })

    // ── Test 10: MUI static defaults ────────────────────────────────────────
    it('returns static Material UI tokens with a default warning', async () => {
        const stack = makeStack({ framework: 'mui' })
        const result = await extractTokens(ROOT, stack)

        expect(result.tokens.length).toBeGreaterThanOrEqual(20)
        expect(result.source).toContain('Material UI')
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('Material UI')

        const primaryMain = result.tokens.find((t) => t.token_path === 'color.primary.main')
        expect(primaryMain).toBeDefined()
        expect(primaryMain?.token_value).toBe('#1976D2')
    })

    // ── Test 11: Radix static defaults ──────────────────────────────────────
    it('returns static Radix UI tokens with a default warning', async () => {
        const stack = makeStack({ framework: 'radix' })
        const result = await extractTokens(ROOT, stack)

        expect(result.tokens.length).toBeGreaterThanOrEqual(20)
        expect(result.source).toContain('Radix')
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('Radix')

        const accent9 = result.tokens.find((t) => t.token_path === 'color.accent.9')
        expect(accent9).toBeDefined()
    })

    // ── Test 12: None returns empty + warning ────────────────────────────────
    it('returns empty tokens with guidance warning for framework: none', async () => {
        const stack = makeStack({ framework: 'none' })
        const result = await extractTokens(ROOT, stack)

        expect(result.tokens).toHaveLength(0)
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('No design system detected')
    })

    // ── Test 13: Tailwind config require failure ──────────────────────────────
    it('handles tailwind config require failure gracefully', async () => {
        const configPath = path.join(ROOT, 'tailwind.config.js')
        // File does NOT exist in mockFiles → createRequire will throw
        // (mockFiles is empty for this path)

        const stack = makeStack({ framework: 'tailwind-v3', configPath })
        const result = await extractTokens(ROOT, stack)

        // Should not throw; returns tokens (possibly empty) with a warning
        expect(Array.isArray(result.tokens)).toBe(true)
        expect(result.warnings.some((w) => w.includes('tailwind.config'))).toBe(true)
    })

    // ── Test 14: Tailwind v4 @theme extraction ───────────────────────────────
    it('extracts color tokens from Tailwind v4 @theme CSS block', async () => {
        const cssPath = path.join(ROOT, 'src/index.css')
        mockFiles.set(cssPath, `
@import "tailwindcss";

@theme {
  --color-primary: #3B82F6;
  --color-secondary: #9333EA;
  --spacing-4: 1rem;
  --font-size-base: 1rem;
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
        `.trim())

        const stack = makeStack({
            framework: 'tailwind-v4',
            configPath: cssPath,
            cssFiles: [cssPath],
        })
        const result = await extractTokens(ROOT, stack)

        expect(result.source).toContain('Tailwind v4')
        const primary = result.tokens.find((t) => t.token_value === '#3B82F6')
        expect(primary).toBeDefined()
        expect(primary?.token_type).toBe('color')

        const spacing = result.tokens.find((t) => t.token_value === '1rem' && t.token_path.includes('spacing'))
        expect(spacing).toBeDefined()
        expect(spacing?.token_type).toBe('dimension')

        const shadow = result.tokens.find((t) => t.token_path.includes('shadow'))
        expect(shadow).toBeDefined()
        expect(shadow?.token_type).toBe('shadow')
    })

    // ── Test 15: Tokens Studio format ────────────────────────────────────────
    it('reads Tokens Studio format (value/type without $ prefix)', async () => {
        const tokenFile = path.join(ROOT, 'tokens.json')
        mockFiles.set(tokenFile, JSON.stringify({
            global: {
                'color-primary': {
                    value: '#3B82F6',
                    type: 'color',
                    description: 'Primary brand color',
                },
                'spacing-base': {
                    value: '16px',
                    type: 'dimension',
                },
            },
        }))

        const stack = makeStack({
            framework: 'tokens-studio',
            configPath: tokenFile,
            tokenFiles: [tokenFile],
        })
        const result = await extractTokens(ROOT, stack)

        expect(result.source).toContain('Tokens Studio')
        const primary = result.tokens.find((t) => t.token_value === '#3B82F6')
        expect(primary).toBeDefined()
        expect(primary?.token_type).toBe('color')

        const spacing = result.tokens.find((t) => t.token_value === '16px')
        expect(spacing).toBeDefined()
        expect(spacing?.token_type).toBe('dimension')
    })

    // ── Test 16: Flint native design-tokens.json (dtcg special case) ────────
    it('reads .flint/design-tokens.json as Flint native JSON array', async () => {
        const flintTokensPath = path.join(ROOT, '.flint/design-tokens.json')
        mockFiles.set(flintTokensPath, JSON.stringify([
            {
                id: 1, token_path: 'color.primary', token_type: 'color',
                token_value: '#0066FF', description: null, collection_name: 'global', mode: 'default',
            },
            {
                id: 2, token_path: 'spacing.4', token_type: 'dimension',
                token_value: '16px', description: null, collection_name: 'global', mode: 'default',
            },
        ]))

        const stack = makeStack({
            framework: 'dtcg',
            configPath: flintTokensPath,
            tokenFiles: [flintTokensPath],
        })
        const result = await extractTokens(ROOT, stack)

        expect(result.source).toContain('.flint/design-tokens.json')
        expect(result.tokens).toHaveLength(2)
        expect(result.tokens[0].token_path).toBe('color.primary')
        expect(result.tokens[0].token_value).toBe('#0066FF')
        expect(result.tokens[1].token_path).toBe('spacing.4')
    })

    // ── Test 17: DTCG nested structure ────────────────────────────────────────
    it('handles DTCG deeply nested token groups', async () => {
        const tokenFile = path.join(ROOT, 'tokens.json')
        mockFiles.set(tokenFile, JSON.stringify({
            brand: {
                color: {
                    blue: {
                        '500': { $value: '#3B82F6', $type: 'color' },
                        '600': { $value: '#2563EB', $type: 'color' },
                    },
                },
            },
        }))

        const stack = makeStack({
            framework: 'dtcg',
            configPath: tokenFile,
            tokenFiles: [tokenFile],
        })
        const result = await extractTokens(ROOT, stack)

        const blue500 = result.tokens.find((t) => t.token_path === 'brand.color.blue.500')
        expect(blue500).toBeDefined()
        expect(blue500?.token_value).toBe('#3B82F6')
        expect(blue500?.token_type).toBe('color')
    })

    // ── Test: Multiple CSS files ──────────────────────────────────────────────
    it('aggregates tokens from multiple CSS files in css-custom-props mode', async () => {
        const cssFile1 = path.join(ROOT, 'src/colors.css')
        const cssFile2 = path.join(ROOT, 'src/spacing.css')
        mockFiles.set(cssFile1, `:root { --color-primary: #3B82F6; }`)
        mockFiles.set(cssFile2, `:root { --spacing-base: 16px; }`)

        const stack = makeStack({
            framework: 'css-custom-props',
            cssFiles: [cssFile1, cssFile2],
        })
        const result = await extractTokens(ROOT, stack)

        expect(result.tokens.length).toBeGreaterThanOrEqual(2)
        const colorToken = result.tokens.find((t) => t.token_path.includes('color-primary'))
        expect(colorToken).toBeDefined()
        const spacingToken = result.tokens.find((t) => t.token_path.includes('spacing-base'))
        expect(spacingToken).toBeDefined()
    })
})
