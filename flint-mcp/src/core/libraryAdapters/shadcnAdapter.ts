/**
 * shadcn/ui theme adapter.
 *
 * Converts DTCG design tokens into shadcn/ui CSS variables (globals.css format).
 * Shadcn uses HSL-based CSS custom properties with a consistent naming pattern:
 *   --background, --foreground, --primary, --primary-foreground, etc.
 *
 * The adapter outputs a complete `:root` and `.dark` block ready to paste
 * into a project's globals.css.
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
import { filterTokens, detectSemanticRole } from './types.js'

// ---------------------------------------------------------------------------
// Color conversion
// ---------------------------------------------------------------------------

/**
 * Convert a hex color to HSL values (without the hsl() wrapper).
 * Shadcn expects bare HSL: "222.2 84% 4.9%"
 */
function hexToHSL(hex: string): string | null {
    const cleaned = hex.replace('#', '')
    if (!/^[0-9a-fA-F]{3,8}$/.test(cleaned)) return null

    let r: number, g: number, b: number

    if (cleaned.length === 3) {
        r = parseInt(cleaned[0] + cleaned[0], 16) / 255
        g = parseInt(cleaned[1] + cleaned[1], 16) / 255
        b = parseInt(cleaned[2] + cleaned[2], 16) / 255
    } else if (cleaned.length >= 6) {
        r = parseInt(cleaned.slice(0, 2), 16) / 255
        g = parseInt(cleaned.slice(2, 4), 16) / 255
        b = parseInt(cleaned.slice(4, 6), 16) / 255
    } else {
        return null
    }

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2

    if (max === min) {
        return `0 0% ${Math.round(l * 100)}%`
    }

    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    let h: number
    switch (max) {
        case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) * 60
            break
        case g:
            h = ((b - r) / d + 2) * 60
            break
        default:
            h = ((r - g) / d + 4) * 60
    }

    return `${Math.round(h * 10) / 10} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`
}

/**
 * Detect relative luminance to determine if a color is "light" or "dark".
 * Used to auto-assign foreground colors.
 */
function isLightColor(hex: string): boolean {
    const cleaned = hex.replace('#', '')
    if (cleaned.length < 6) return true
    const r = parseInt(cleaned.slice(0, 2), 16) / 255
    const g = parseInt(cleaned.slice(2, 4), 16) / 255
    const b = parseInt(cleaned.slice(4, 6), 16) / 255
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance > 0.5
}

// ---------------------------------------------------------------------------
// Shadcn token mapping
// ---------------------------------------------------------------------------

/**
 * Shadcn's standard CSS variable names.
 * Each maps to a semantic role from the DTCG tokens.
 */
const SHADCN_VARIABLE_MAP: Record<string, string[]> = {
    'background':           ['background', 'surface'],
    'foreground':           ['foreground', 'text'],
    'primary':              ['primary'],
    'primary-foreground':   [],  // auto-derived from primary
    'secondary':            ['secondary'],
    'secondary-foreground': [],  // auto-derived
    'muted':                ['muted', 'surface'],
    'muted-foreground':     [],  // auto-derived
    'accent':               ['info', 'secondary'],
    'accent-foreground':    [],  // auto-derived
    'destructive':          ['error'],
    'destructive-foreground': [],  // auto-derived
    'border':               ['border'],
    'input':                ['border'],
    'ring':                 ['primary'],
}

interface ShadcnVariables {
    light: Map<string, string>
    dark: Map<string, string>
}

function buildShadcnVariables(tokens: DesignToken[]): {
    variables: ShadcnVariables
    tokenMap: Record<string, string>
    tokenCount: number
    skipped: SkippedToken[]
} {
    const variables: ShadcnVariables = {
        light: new Map(),
        dark: new Map(),
    }
    const tokenMap: Record<string, string> = {}
    const skipped: SkippedToken[] = []
    let tokenCount = 0

    // Collect semantic colors from tokens
    const semanticColors = new Map<string, string>()

    for (const token of tokens) {
        if (token.token_type !== 'color') {
            if (token.token_type === 'dimension' || token.token_type === 'shadow') {
                // Shadcn uses Tailwind for spacing/shadows — skip gracefully
                skipped.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `shadcn/ui uses Tailwind for ${token.token_type} — configure in tailwind.config.ts instead`,
                })
            } else if (token.token_type !== 'fontFamily' && token.token_type !== 'fontWeight') {
                skipped.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `Token type '${token.token_type}' maps to Tailwind config, not shadcn CSS variables`,
                })
            }
            continue
        }

        const role = detectSemanticRole(token.token_path)
        if (role) {
            semanticColors.set(role, token.token_value)
        }
    }

    // Map semantic colors to shadcn variables
    for (const [varName, roleHints] of Object.entries(SHADCN_VARIABLE_MAP)) {
        // Try each role hint until one matches
        let matchedValue: string | null = null
        for (const hint of roleHints) {
            const value = semanticColors.get(hint)
            if (value) {
                matchedValue = value
                break
            }
        }

        if (matchedValue) {
            const hsl = hexToHSL(matchedValue)
            if (hsl) {
                variables.light.set(varName, hsl)
                tokenMap[`--${varName}`] = matchedValue
                tokenCount++

                // Auto-derive foreground variants
                if (!varName.endsWith('-foreground')) {
                    const fgVarName = `${varName}-foreground`
                    const fgHsl = isLightColor(matchedValue)
                        ? '0 0% 9%'    // dark text on light bg
                        : '0 0% 98%'   // light text on dark bg
                    variables.light.set(fgVarName, fgHsl)
                }
            }
        }
    }

    // Add default radius
    variables.light.set('radius', '0.5rem')

    return { variables, tokenMap, tokenCount, skipped }
}

// ---------------------------------------------------------------------------
// Code renderer
// ---------------------------------------------------------------------------

function renderCSS(variables: ShadcnVariables): string {
    const lines: string[] = [
        '/* Generated by Flint — DO NOT EDIT */',
        '/* Source: .flint/design-tokens.json */',
        `/* Generated at: ${new Date().toISOString()} */`,
        '',
        '@layer base {',
        '    :root {',
    ]

    // Light mode
    for (const [name, value] of variables.light) {
        lines.push(`        --${name}: ${value};`)
    }

    lines.push('    }')
    lines.push('')
    lines.push('    .dark {')

    // Dark mode — if we have dark-specific values, use them; otherwise invert
    if (variables.dark.size > 0) {
        for (const [name, value] of variables.dark) {
            lines.push(`        --${name}: ${value};`)
        }
    } else {
        lines.push('        /* Dark mode: override these values from your Figma dark theme */')
        lines.push('        /* Run Flint with mode: "Dark" to generate dark values */')
    }

    lines.push('    }')
    lines.push('}')
    lines.push('')

    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class ShadcnAdapter implements LibraryAdapter {
    readonly library = 'shadcn' as const
    readonly defaultFilename = 'globals.css'
    readonly displayName = 'shadcn/ui'
    readonly description =
        'Generates CSS variables for shadcn/ui globals.css to match your Figma design.'

    mapTokens(tokens: DesignToken[], options?: MapOptions): LibraryThemeOutput {
        const filtered = filterTokens(tokens, options)
        const { variables, tokenMap, tokenCount, skipped } = buildShadcnVariables(filtered)
        const code = renderCSS(variables)

        return {
            library: 'shadcn',
            code,
            filename: this.defaultFilename,
            tokenCount,
            skippedTokens: skipped,
            mimeType: 'text/css',
            tokenMap,
        }
    }

    validate(output: LibraryThemeOutput): ValidationResult {
        const errors: { line: number | null; message: string }[] = []
        const { code } = output

        if (!code.includes('@layer base')) {
            errors.push({ line: null, message: 'Missing @layer base wrapper' })
        }
        if (!code.includes(':root')) {
            errors.push({ line: null, message: 'Missing :root selector' })
        }
        if (!code.includes('--')) {
            errors.push({ line: null, message: 'No CSS custom properties found' })
        }

        // Check balanced braces
        let braceCount = 0
        const codeLines = code.split('\n')
        for (let i = 0; i < codeLines.length; i++) {
            for (const ch of codeLines[i]) {
                if (ch === '{') braceCount++
                if (ch === '}') braceCount--
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
        const c = (
            id: number,
            name: string,
            value: string,
            description: string,
        ): DesignToken => ({
            id,
            token_path: `shadcn.${name}`,
            token_type: 'color',
            token_value: value,
            description,
            collection_name: 'shadcn',
            mode: 'Light',
        })

        // Source: shadcn/ui neutral theme (current defaults verified 2025)
        // Ref: https://ui.shadcn.com/themes, Tailwind neutral scale
        const light: DesignToken[] = [
            c(1,  'background',             '#ffffff', 'Default page background'),
            c(2,  'foreground',              '#0a0a0a', 'Default body text color'),
            c(3,  'primary',                 '#171717', 'Primary action color'),
            c(4,  'primary-foreground',      '#fafafa', 'Text on primary backgrounds'),
            c(5,  'secondary',               '#f5f5f5', 'Secondary action color'),
            c(6,  'secondary-foreground',    '#171717', 'Text on secondary backgrounds'),
            c(7,  'muted',                   '#f5f5f5', 'Muted background for subtle UI'),
            c(8,  'muted-foreground',        '#737373', 'Text on muted backgrounds'),
            c(9,  'accent',                  '#f5f5f5', 'Accent highlight color'),
            c(10, 'accent-foreground',       '#171717', 'Text on accent backgrounds'),
            c(11, 'destructive',             '#ef4444', 'Destructive action color'),
            c(12, 'destructive-foreground',  '#fafafa', 'Text on destructive backgrounds'),
            c(13, 'border',                  '#e5e5e5', 'Default border color'),
            c(14, 'input',                   '#e5e5e5', 'Input field border color'),
            c(15, 'ring',                    '#a3a3a3', 'Focus ring color (neutral-400)'),
            c(16, 'card',                    '#ffffff', 'Card surface background'),
            c(17, 'card-foreground',         '#0a0a0a', 'Text on card surfaces'),
            c(18, 'popover',                 '#ffffff', 'Popover surface background'),
            c(19, 'popover-foreground',      '#0a0a0a', 'Text on popover surfaces'),
            // Dimension
            {
                id: 20,
                token_path: 'shadcn.radius',
                token_type: 'dimension',
                token_value: '0.625rem',
                description: 'Default border radius (10px)',
                collection_name: 'shadcn',
                mode: 'Light',
            },
        ]

        // Dark mode — inverted neutral scale
        // Source: shadcn/ui .dark block, neutral palette inverted
        const d = (
            id: number,
            name: string,
            value: string,
            description: string,
        ): DesignToken => ({
            id,
            token_path: `shadcn.${name}`,
            token_type: 'color' as const,
            token_value: value,
            description,
            collection_name: 'shadcn',
            mode: 'Dark',
        })

        const dark: DesignToken[] = [
            d(21, 'background',             '#0a0a0a', 'Dark page background (neutral-950)'),
            d(22, 'foreground',              '#fafafa', 'Dark body text (neutral-50)'),
            d(23, 'primary',                 '#fafafa', 'Dark primary (neutral-50)'),
            d(24, 'primary-foreground',      '#171717', 'Dark text on primary (neutral-900)'),
            d(25, 'secondary',               '#262626', 'Dark secondary (neutral-800)'),
            d(26, 'secondary-foreground',    '#fafafa', 'Dark text on secondary (neutral-50)'),
            d(27, 'muted',                   '#262626', 'Dark muted background (neutral-800)'),
            d(28, 'muted-foreground',        '#a3a3a3', 'Dark muted text (neutral-400)'),
            d(29, 'accent',                  '#262626', 'Dark accent (neutral-800)'),
            d(30, 'accent-foreground',       '#fafafa', 'Dark accent text (neutral-50)'),
            d(31, 'destructive',             '#dc2626', 'Dark destructive (red-600)'),
            d(32, 'destructive-foreground',  '#fafafa', 'Dark text on destructive (neutral-50)'),
            d(33, 'border',                  '#262626', 'Dark border (neutral-800)'),
            d(34, 'input',                   '#262626', 'Dark input border (neutral-800)'),
            d(35, 'ring',                    '#d4d4d4', 'Dark focus ring (neutral-300)'),
            d(36, 'card',                    '#171717', 'Dark card surface (neutral-900)'),
            d(37, 'card-foreground',         '#fafafa', 'Dark card text (neutral-50)'),
            d(38, 'popover',                 '#171717', 'Dark popover surface (neutral-900)'),
            d(39, 'popover-foreground',      '#fafafa', 'Dark popover text (neutral-50)'),
        ]

        return [...light, ...dark]
    }

    getIdiomBlock(): string {
        return [
            '## Active Library: shadcn/ui',
            '',
            '**Import convention:** `import { ComponentName } from "@/components/ui/component-name"`',
            '**Utility:** Use `cn()` from `@/lib/utils` for conditional class merging.',
            '**Styling:** All colors use CSS custom properties (e.g., `bg-background`, `text-foreground`, `border-border`).',
            '**Rules:**',
            '- Do NOT use raw hex colors or Tailwind color utilities (e.g., `bg-blue-500`). Use semantic variables instead.',
            '- Do NOT mix arbitrary Tailwind values with shadcn CSS variables.',
            '- Prefer shadcn components over raw HTML elements when a matching component exists in the registry.',
            '- Use `className` prop with `cn()` for style overrides, never inline styles.',
        ].join('\n')
    }

    matchTokens(tokens: DesignToken[]): LibraryMatchResult {
        let score = 0
        const reasons: string[] = []
        const paths = new Set(tokens.map(t => {
            const segments = t.token_path.split('.')
            return segments[segments.length - 1].toLowerCase()
        }))

        // background + foreground pair
        if (paths.has('background') && paths.has('foreground')) {
            score += 15
            reasons.push('Found background/foreground token pair')
        }

        // destructive
        if (paths.has('destructive')) {
            score += 15
            reasons.push('Found "destructive" token (shadcn signature)')
        }

        // muted + muted-foreground pair
        if (paths.has('muted') && paths.has('muted-foreground')) {
            score += 15
            reasons.push('Found muted/muted-foreground token pair')
        }

        // ring
        if (paths.has('ring')) {
            score += 15
            reasons.push('Found "ring" token (focus ring variable)')
        }

        // accent
        if (paths.has('accent')) {
            score += 10
            reasons.push('Found "accent" token')
        }

        // card + card-foreground pair
        if (paths.has('card') && paths.has('card-foreground')) {
            score += 10
            reasons.push('Found card/card-foreground token pair')
        }

        // popover + popover-foreground pair
        if (paths.has('popover') && paths.has('popover-foreground')) {
            score += 10
            reasons.push('Found popover/popover-foreground token pair')
        }

        // input (exact leaf match, already guaranteed by taking last segment)
        if (paths.has('input')) {
            score += 10
            reasons.push('Found "input" token (input border variable)')
        }

        return { score: Math.min(score, 100), reasons }
    }
}

export function createShadcnAdapter(): ShadcnAdapter {
    return new ShadcnAdapter()
}
