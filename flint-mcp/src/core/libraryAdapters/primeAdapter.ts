/**
 * PrimeNG / PrimeReact / PrimeVue theme adapter.
 *
 * Converts DTCG design tokens into a PrimeTek `definePreset()` call that
 * overrides the Aura base preset. The output is a TypeScript file ready
 * to drop into any Prime-family project.
 *
 * PrimeTek's 3-tier token hierarchy:
 *   Primitive  → raw color palettes (50-950), border-radius, base measurements
 *   Semantic   → primary, surface, text — reference primitives via {token.path}
 *   Component  → per-component overrides — reference semantics
 *
 * This adapter maps DTCG tokens into that hierarchy automatically.
 */

import type { DesignToken } from '../../types.js'
import type {
    LibraryAdapter,
    LibraryMatchResult,
    LibraryThemeOutput,
    MapOptions,
    SkippedToken,
    ValidationResult,
} from './types.js'
import {
    filterTokens,
    detectSemanticRole,
    detectShade,
    extractColorFamily,
} from './types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeValue(v: string): string {
    return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Standard Prime shade steps. */
const PRIME_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/**
 * Build a PrimeTek primitive color scale object from a set of shade→value pairs.
 */
function buildColorScale(shades: Map<number, string>): Record<string, string> {
    const scale: Record<string, string> = {}
    for (const step of PRIME_SHADES) {
        const value = shades.get(step)
        if (value) scale[String(step)] = value
    }
    return scale
}

// ---------------------------------------------------------------------------
// Token classifiers
// ---------------------------------------------------------------------------

interface ClassifiedTokens {
    /** Color palettes: family → shade → hex */
    colorFamilies: Map<string, Map<number, string>>
    /** Semantic role colors: role → value */
    semanticColors: Map<string, string>
    /** Border radius values */
    borderRadius: Map<string, string>
    /** Spacing values */
    spacing: Map<string, string>
    /** Font families */
    fontFamily: Map<string, string>
    /** Font sizes */
    fontSize: Map<string, string>
    /** Font weights */
    fontWeight: Map<string, string>
    /** Shadows */
    shadows: Map<string, string>
    /** Skipped tokens */
    skipped: SkippedToken[]
}

function classifyTokens(tokens: DesignToken[]): ClassifiedTokens {
    const result: ClassifiedTokens = {
        colorFamilies: new Map(),
        semanticColors: new Map(),
        borderRadius: new Map(),
        spacing: new Map(),
        fontFamily: new Map(),
        fontSize: new Map(),
        fontWeight: new Map(),
        shadows: new Map(),
        skipped: [],
    }

    for (const token of tokens) {
        switch (token.token_type) {
            case 'color': {
                const shade = detectShade(token.token_path)
                const family = extractColorFamily(token.token_path)
                const role = detectSemanticRole(token.token_path)

                if (shade !== null && family) {
                    // Palette color with shade → primitive
                    if (!result.colorFamilies.has(family)) {
                        result.colorFamilies.set(family, new Map())
                    }
                    result.colorFamilies.get(family)!.set(shade, token.token_value)
                } else if (role) {
                    // Semantic role color
                    result.semanticColors.set(role, token.token_value)
                } else if (family) {
                    // Single-value color (no shade) → treat as semantic
                    result.semanticColors.set(family, token.token_value)
                }
                break
            }
            case 'dimension': {
                const lower = token.token_path.toLowerCase()
                if (lower.includes('radius') || lower.includes('round')) {
                    const key = token.token_path.split('.').pop() ?? token.token_path
                    result.borderRadius.set(key, token.token_value)
                } else if (lower.includes('font') && lower.includes('size')) {
                    const key = token.token_path.split('.').pop() ?? token.token_path
                    result.fontSize.set(key, token.token_value)
                } else {
                    const key = token.token_path.split('.').pop() ?? token.token_path
                    result.spacing.set(key, token.token_value)
                }
                break
            }
            case 'fontFamily': {
                const key = token.token_path.split('.').pop() ?? token.token_path
                result.fontFamily.set(key, token.token_value)
                break
            }
            case 'fontWeight': {
                const key = token.token_path.split('.').pop() ?? token.token_path
                result.fontWeight.set(key, token.token_value)
                break
            }
            case 'shadow': {
                const key = token.token_path.split('.').pop() ?? token.token_path
                result.shadows.set(key, token.token_value)
                break
            }
            default:
                result.skipped.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `Token type '${token.token_type}' has no PrimeNG equivalent`,
                })
        }
    }

    return result
}

// ---------------------------------------------------------------------------
// Code renderer
// ---------------------------------------------------------------------------

function renderPreset(classified: ClassifiedTokens, basePreset: string): string {
    const lines: string[] = [
        '// Generated by Flint — DO NOT EDIT',
        '// Source: .flint/design-tokens.json',
        `// Generated at: ${new Date().toISOString()}`,
        '',
        `import ${capitalize(basePreset)} from '@primeng/themes/${basePreset}';`,
        "import { definePreset } from '@primeng/themes';",
        '',
        `export const FlintPreset = definePreset(${capitalize(basePreset)}, {`,
    ]

    // --- Primitive tier ---
    const hasPrimitives = classified.colorFamilies.size > 0 || classified.borderRadius.size > 0
    if (hasPrimitives) {
        lines.push('    primitive: {')

        // Border radius
        if (classified.borderRadius.size > 0) {
            lines.push('        borderRadius: {')
            for (const [key, value] of classified.borderRadius) {
                lines.push(`            ${safeKey(key)}: '${escapeValue(value)}',`)
            }
            lines.push('        },')
        }

        // Color families
        for (const [family, shades] of classified.colorFamilies) {
            const scale = buildColorScale(shades)
            if (Object.keys(scale).length > 0) {
                lines.push(`        ${safeKey(family)}: {`)
                for (const [step, value] of Object.entries(scale)) {
                    lines.push(`            ${step}: '${escapeValue(value)}',`)
                }
                lines.push('        },')
            }
        }

        lines.push('    },')
    }

    // --- Semantic tier ---
    const hasSemantics = classified.semanticColors.size > 0 ||
        classified.fontFamily.size > 0 ||
        classified.fontSize.size > 0
    if (hasSemantics) {
        lines.push('    semantic: {')

        // Map semantic roles to Prime's semantic token structure
        const primary = classified.semanticColors.get('primary')
        const secondary = classified.semanticColors.get('secondary')

        if (primary || secondary) {
            lines.push('        colorScheme: {')
            lines.push('            light: {')
            if (primary) {
                lines.push('                primary: {')
                lines.push(`                    color: '${escapeValue(primary)}',`)
                lines.push('                },')
            }
            if (secondary) {
                lines.push('                highlight: {')
                lines.push(`                    background: '${escapeValue(secondary)}',`)
                lines.push('                },')
            }

            // Surface / background
            const surface = classified.semanticColors.get('surface')
            const bg = classified.semanticColors.get('background')
            if (surface || bg) {
                lines.push('                surface: {')
                if (bg) lines.push(`                    0: '${escapeValue(bg)}',`)
                if (surface) lines.push(`                    50: '${escapeValue(surface)}',`)
                lines.push('                },')
            }

            // Text
            const textColor = classified.semanticColors.get('text')
            const foreground = classified.semanticColors.get('foreground')
            if (textColor || foreground) {
                lines.push('                text: {')
                lines.push(`                    color: '${escapeValue(textColor ?? foreground!)}',`)
                const muted = classified.semanticColors.get('muted')
                if (muted) {
                    lines.push(`                    mutedColor: '${escapeValue(muted)}',`)
                }
                lines.push('                },')
            }

            lines.push('            },')
            lines.push('        },')
        }

        // Font family at semantic level
        if (classified.fontFamily.size > 0) {
            const defaultFont = classified.fontFamily.values().next().value
            if (defaultFont) {
                lines.push(`        fontFamily: '${escapeValue(defaultFont)}',`)
            }
        }

        lines.push('    },')
    }

    lines.push('});')
    lines.push('')
    lines.push('// Usage (Angular):')
    lines.push('//   providePrimeNG({ theme: { preset: FlintPreset } })')
    lines.push('//')
    lines.push('// Usage (React — PrimeReact):')
    lines.push('//   <PrimeReactProvider value={{ theme: { preset: FlintPreset } }}>')
    lines.push('//')
    lines.push('// Usage (Vue — PrimeVue):')
    lines.push('//   app.use(PrimeVue, { theme: { preset: FlintPreset } })')
    lines.push('')

    return lines.join('\n')
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function safeKey(key: string): string {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${escapeValue(key)}'`
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class PrimeAdapter implements LibraryAdapter {
    readonly library = 'primeng' as const
    readonly defaultFilename = 'flint-preset.ts'
    readonly displayName = 'PrimeNG / PrimeReact / PrimeVue'
    readonly description =
        'Generates a definePreset() call that overrides PrimeTek theme tokens to match your Figma design.'

    mapTokens(tokens: DesignToken[], options?: MapOptions): LibraryThemeOutput {
        const filtered = filterTokens(tokens, options)
        const classified = classifyTokens(filtered)
        const basePreset = options?.basePreset ?? 'aura'
        const code = renderPreset(classified, basePreset)

        // Build token map for audit/diff
        const tokenMap: Record<string, string> = {}
        for (const [family, shades] of classified.colorFamilies) {
            for (const [shade, value] of shades) {
                tokenMap[`primitive.${family}.${shade}`] = value
            }
        }
        for (const [role, value] of classified.semanticColors) {
            tokenMap[`semantic.${role}`] = value
        }
        for (const [key, value] of classified.borderRadius) {
            tokenMap[`primitive.borderRadius.${key}`] = value
        }
        for (const [key, value] of classified.fontFamily) {
            tokenMap[`semantic.fontFamily.${key}`] = value
        }

        const tokenCount =
            classified.colorFamilies.size +
            classified.semanticColors.size +
            classified.borderRadius.size +
            classified.spacing.size +
            classified.fontFamily.size +
            classified.fontSize.size +
            classified.fontWeight.size +
            classified.shadows.size

        return {
            library: 'primeng',
            code,
            filename: this.defaultFilename,
            tokenCount,
            skippedTokens: classified.skipped,
            mimeType: 'application/typescript',
            tokenMap,
        }
    }

    validate(output: LibraryThemeOutput): ValidationResult {
        const errors: { line: number | null; message: string }[] = []
        const { code } = output

        if (!code.includes('definePreset')) {
            errors.push({ line: null, message: 'Missing definePreset() call' })
        }
        if (!code.includes('import') || !code.includes("'@primeng/themes")) {
            errors.push({ line: null, message: 'Missing @primeng/themes import' })
        }

        // Check balanced braces
        let braceCount = 0
        const codeLines = code.split('\n')
        for (let i = 0; i < codeLines.length; i++) {
            for (const ch of codeLines[i]) {
                if (ch === '{') braceCount++
                if (ch === '}') braceCount--
            }
            if (braceCount < 0) {
                errors.push({ line: i + 1, message: 'Unexpected closing brace' })
            }
        }
        if (braceCount !== 0) {
            errors.push({
                line: null,
                message: `Unbalanced braces: ${braceCount > 0 ? 'missing' : 'extra'} ${Math.abs(braceCount)} closing brace(s)`,
            })
        }

        return { valid: errors.length === 0, errors }
    }

    seedTokens(): DesignToken[] {
        let id = 1
        const t = (
            path: string,
            type: DesignToken['token_type'],
            value: string,
            description: string | null = null,
        ): DesignToken => ({
            id: id++,
            token_path: `primeng.${path}`,
            token_type: type,
            token_value: value,
            description,
            collection_name: 'primeng',
            mode: 'Light',
        })

        return [
            // Source: PrimeNG Aura preset (primeuix)
            // Ref: https://github.com/primefaces/primeuix/blob/main/packages/themes/src/presets/aura/base/index.ts

            // Primitive color palette — emerald
            t('primitive.emerald.50', 'color', '#ecfdf5', 'Emerald 50'),
            t('primitive.emerald.100', 'color', '#d1fae5', 'Emerald 100'),
            t('primitive.emerald.200', 'color', '#a7f3d0', 'Emerald 200'),
            t('primitive.emerald.300', 'color', '#6ee7b7', 'Emerald 300'),
            t('primitive.emerald.400', 'color', '#34d399', 'Emerald 400'),
            t('primitive.emerald.500', 'color', '#10b981', 'Emerald 500'),
            t('primitive.emerald.600', 'color', '#059669', 'Emerald 600'),
            t('primitive.emerald.700', 'color', '#047857', 'Emerald 700'),
            t('primitive.emerald.800', 'color', '#065f46', 'Emerald 800'),
            t('primitive.emerald.900', 'color', '#064e3b', 'Emerald 900'),
            t('primitive.emerald.950', 'color', '#022c22', 'Emerald 950'),

            // Primitive color palette — blue
            t('primitive.blue.50', 'color', '#eff6ff', 'Blue 50'),
            t('primitive.blue.100', 'color', '#dbeafe', 'Blue 100'),
            t('primitive.blue.200', 'color', '#bfdbfe', 'Blue 200'),
            t('primitive.blue.300', 'color', '#93c5fd', 'Blue 300'),
            t('primitive.blue.400', 'color', '#60a5fa', 'Blue 400'),
            t('primitive.blue.500', 'color', '#3b82f6', 'Blue 500'),
            t('primitive.blue.600', 'color', '#2563eb', 'Blue 600'),
            t('primitive.blue.700', 'color', '#1d4ed8', 'Blue 700'),
            t('primitive.blue.800', 'color', '#1e40af', 'Blue 800'),
            t('primitive.blue.900', 'color', '#1e3a8a', 'Blue 900'),
            t('primitive.blue.950', 'color', '#172554', 'Blue 950'),

            // Semantic roles
            t('semantic.primary.color', 'color', '#10b981', 'Primary brand color (emerald-500)'),
            t('semantic.surface.0', 'color', '#ffffff', 'Base surface'),
            t('semantic.surface.50', 'color', '#fafafa', 'Elevated surface'),
            t('semantic.text.color', 'color', '#3f3f46', 'Default text color'),
            t('semantic.text.mutedColor', 'color', '#71717a', 'Muted text color'),
            t('semantic.background', 'color', '#ffffff', 'Page background'),
            t('semantic.border', 'color', '#e4e4e7', 'Default border color'),

            // Dimensions — border radius
            t('primitive.borderRadius.sm', 'dimension', '4px', 'Small border radius'),
            t('primitive.borderRadius.md', 'dimension', '6px', 'Medium border radius'),
            t('primitive.borderRadius.lg', 'dimension', '8px', 'Large border radius'),

            // Note: PrimeNG does not define fontFamily — components inherit from the app.
            // See: https://github.com/primefaces/primeng/issues/17696
        ]
    }

    getIdiomBlock(): string {
        return [
            '## Active Library: PrimeNG / PrimeReact / PrimeVue',
            '',
            '**Import convention (Angular):** `import { ButtonModule } from "primeng/button"`',
            '**Import convention (React):** `import { Button } from "primereact/button"`',
            '**Import convention (Vue):** `import Button from "primevue/button"`',
            '**Theming:** Uses `definePreset()` from `@primeng/themes` with a base preset (Aura by default).',
            '**Rules:**',
            '- Do NOT use raw hex colors. Use PrimeTek\'s semantic token references (e.g., `var(--p-primary-color)`).',
            '- Use PrimeFlex utility classes for layout (e.g., `flex`, `align-items-center`, `gap-3`).',
            '- Components are unstyled by default \u2014 theme preset provides all visual styling.',
            '- Use `severity` prop for semantic color variants (e.g., `<Button severity="danger">`).',
        ].join('\n')
    }

    matchTokens(tokens: DesignToken[]): LibraryMatchResult {
        let score = 0
        const reasons: string[] = []

        // Signal: primitive shade pattern (primitive.*.50 through primitive.*.950)
        const shadePattern = /\.primitive\.[^.]+\.(50|100|200|300|400|500|600|700|800|900|950)$/
        const hasShadePattern = tokens.some(t => shadePattern.test(t.token_path))
        if (hasShadePattern) {
            score += 20
            reasons.push('Token paths match PrimeTek primitive shade pattern (50-950)')
        }

        // Signal: semantic.colorScheme or semantic.primary
        const hasSemanticPrimary = tokens.some(t => {
            const lower = t.token_path.toLowerCase()
            return lower.includes('semantic.colorscheme') || lower.includes('semantic.primary')
        })
        if (hasSemanticPrimary) {
            score += 20
            reasons.push('Token paths contain semantic.colorScheme or semantic.primary')
        }

        // Signal: semantic.surface
        const hasSemanticSurface = tokens.some(t =>
            t.token_path.toLowerCase().includes('semantic.surface'),
        )
        if (hasSemanticSurface) {
            score += 15
            reasons.push('Token paths contain semantic.surface')
        }

        // Signal: primitive.borderRadius
        const hasBorderRadius = tokens.some(t =>
            t.token_path.toLowerCase().includes('primitive.borderradius'),
        )
        if (hasBorderRadius) {
            score += 15
            reasons.push('Token paths contain primitive.borderRadius')
        }

        // Signal: semantic.text.color or semantic.text.mutedColor
        const hasTextTokens = tokens.some(t => {
            const lower = t.token_path.toLowerCase()
            return lower.includes('semantic.text.color') || lower.includes('semantic.text.mutedcolor')
        })
        if (hasTextTokens) {
            score += 10
            reasons.push('Token paths contain semantic.text.color or semantic.text.mutedColor')
        }

        // Signal: semantic.fontFamily
        const hasFontFamily = tokens.some(t =>
            t.token_path.toLowerCase().includes('semantic.fontfamily'),
        )
        if (hasFontFamily) {
            score += 10
            reasons.push('Token paths contain semantic.fontFamily')
        }

        // Signal: "primitive" as a path segment (3-tier structure bonus)
        const hasPrimitiveSegment = tokens.some(t => {
            const segments = t.token_path.toLowerCase().split('.')
            return segments.includes('primitive')
        })
        if (hasPrimitiveSegment) {
            score += 10
            reasons.push('Token paths use "primitive" segment (3-tier hierarchy)')
        }

        return {
            score: Math.min(score, 100),
            reasons,
        }
    }
}

export function createPrimeAdapter(): PrimeAdapter {
    return new PrimeAdapter()
}
