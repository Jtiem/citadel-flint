/**
 * Material UI (MUI) theme adapter.
 *
 * Converts DTCG design tokens into a MUI `createTheme()` call. The output
 * is a TypeScript file with palette, typography, shape, and spacing overrides
 * ready to plug into a MUI ThemeProvider.
 *
 * MUI theme structure:
 *   palette   → primary, secondary, error, warning, info, success, background, text
 *   typography → fontFamily, h1-h6, body1/body2
 *   shape     → borderRadius
 *   spacing   → base multiplier (default 8px)
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

// ---------------------------------------------------------------------------
// MUI palette structure
// ---------------------------------------------------------------------------

/**
 * MUI palette color requires `main`, and optionally `light`, `dark`, `contrastText`.
 * We map from DTCG shade scales: 300 → light, 500 → main, 700 → dark.
 */
interface MuiPaletteColor {
    main: string
    light?: string
    dark?: string
    contrastText?: string
}

interface ClassifiedMuiTokens {
    paletteColors: Map<string, MuiPaletteColor>
    semanticColors: Map<string, string>
    background: { default?: string; paper?: string }
    textColors: { primary?: string; secondary?: string }
    fontFamily: string | null
    fontSizes: Map<string, string>
    fontWeights: Map<string, string>
    borderRadius: number | null
    spacingBase: number | null
    shadows: Map<string, string>
    skipped: SkippedToken[]
}

// ---------------------------------------------------------------------------
// Semantic path priority for MUI palette role resolution
// ---------------------------------------------------------------------------
//
// When multiple tokens match a semantic role keyword, this priority list
// resolves the ambiguity by picking the path whose segments most precisely
// designate the role. Higher index = higher priority.
//
// Example: "color/text/primary" and "color/brand/primary" both match "primary".
// "brand/primary" wins because "brand" is a higher-priority qualifier than "text".
//
// For borderRadius: avoid picking full-round radius (badge, full, pill, rounded-full).
// Prefer card/button/default/md radii.

/**
 * Score a token path for a given MUI role.
 * Higher score = more authoritative match. Returns -1 if no match.
 */
function scorePaletteRolePath(tokenPath: string, role: string): number {
    const lower = tokenPath.toLowerCase()
    // Must contain the role keyword at all
    if (!lower.includes(role)) return -1

    // Disqualifiers: paths that contain the role word but are clearly not the role
    // e.g. "color/text/primary" for role "primary" — it is text color, not brand primary
    const isTextQualified = /\b(text|foreground|on[-/])\b/.test(lower)
    const isStatusQualified = /\b(status|state)\b/.test(lower)
    const isBrandQualified = /\b(brand|palette|theme)\b/.test(lower)

    // Assign base score by role segment position
    let score = 0

    if (isBrandQualified) score += 30   // brand/primary = strong semantic signal
    if (isStatusQualified) score += 15  // status/primary = weaker
    if (isTextQualified) score -= 20    // text/primary = wrong context for palette.primary

    // Direct role-only paths score high: "primary", "primary/main", "primary/default"
    const segments = lower.replace(/\//g, '.').split('.')
    const roleIdx = segments.indexOf(role)
    if (roleIdx === segments.length - 1) score += 10  // role is last segment = most specific
    if (segments.length <= 2) score += 5  // short path = canonical token

    return score
}

/**
 * Detect a semantic role from a token path using priority scoring.
 * Returns { role, score } or null. Unlike the shared detectSemanticRole helper
 * this is private to muiAdapter and scores rather than first-match.
 */
function detectPrioritizedRole(tokenPath: string): { role: string; score: number } | null {
    const roles = ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'surface', 'background', 'text', 'muted']
    let best: { role: string; score: number } | null = null
    for (const role of roles) {
        const score = scorePaletteRolePath(tokenPath, role)
        if (score >= 0) {
            if (!best || score > best.score) {
                best = { role, score }
            }
        }
    }
    return best
}

/**
 * Check if a radius token path is a full-round / pill radius that should NOT
 * be used as the global borderRadius default.
 */
function isFullRoundRadius(tokenPath: string): boolean {
    const lower = tokenPath.toLowerCase()
    // Exact keywords that indicate a full-round (9999px) badge/pill radius
    return /\b(badge|pill|full|circular|chip|tag|icon)\b/.test(lower)
        || /rounded-full/.test(lower)
        || (/\bround\b/.test(lower) && !/\baround\b/.test(lower))
}

/**
 * Score a radius token path for use as the global borderRadius.
 * Returns higher score for card/button/default/md; lower for badge/full/pill.
 */
function scoreRadiusPath(tokenPath: string): number {
    if (isFullRoundRadius(tokenPath)) return -100
    const lower = tokenPath.toLowerCase()
    let score = 0
    if (/\b(card|button|default|base|md|medium)\b/.test(lower)) score += 20
    if (/\b(sm|small)\b/.test(lower)) score += 10
    if (/\b(lg|large|xl)\b/.test(lower)) score += 5
    return score
}

function classifyTokens(tokens: DesignToken[]): ClassifiedMuiTokens {
    const result: ClassifiedMuiTokens = {
        paletteColors: new Map(),
        semanticColors: new Map(),
        background: {},
        textColors: {},
        fontFamily: null,
        fontSizes: new Map(),
        fontWeights: new Map(),
        borderRadius: null,
        spacingBase: null,
        shadows: new Map(),
        skipped: [],
    }

    // First pass: collect color families for palette building + priority semantic role map
    const colorFamilies = new Map<string, Map<number, string>>()

    // Track best (highest-score) semantic color per MUI palette role to avoid last-write-wins.
    // This is separate from the general semanticColors map which stores ALL semantic roles.
    const paletteRoleScores = new Map<string, number>()
    // paletteRoleWinner: role → best token value
    const paletteRoleWinner = new Map<string, string>()

    // Track best radius token: { value, score }
    let bestRadiusScore = -Infinity
    let bestRadiusValue: number | null = null

    for (const token of tokens) {
        switch (token.token_type) {
            case 'color': {
                const shade = detectShade(token.token_path)
                const family = extractColorFamily(token.token_path)

                if (shade !== null && family) {
                    if (!colorFamilies.has(family)) {
                        colorFamilies.set(family, new Map())
                    }
                    colorFamilies.get(family)!.set(shade, token.token_value)
                }

                // Store ALL semantic roles using the shared detectSemanticRole (includes foreground, border, etc.)
                // Last-write-wins here — used for background, text, muted lookups below.
                const genericRole = detectSemanticRole(token.token_path)
                if (genericRole) {
                    result.semanticColors.set(genericRole, token.token_value)
                }

                // Additionally, track priority-scored winners for the MUI palette roles
                // (primary, secondary, error, warning, info, success) to prevent
                // color/text/primary from overwriting color/brand/primary.
                const muiPaletteRoles = ['primary', 'secondary', 'error', 'warning', 'info', 'success']
                for (const paletteRole of muiPaletteRoles) {
                    const score = scorePaletteRolePath(token.token_path, paletteRole)
                    if (score >= 0) {
                        const existing = paletteRoleScores.get(paletteRole) ?? -Infinity
                        if (score > existing) {
                            paletteRoleScores.set(paletteRole, score)
                            paletteRoleWinner.set(paletteRole, token.token_value)
                        }
                    }
                }
                break
            }
            case 'dimension': {
                const lower = token.token_path.toLowerCase()
                if (lower.includes('radius') || lower.includes('round')) {
                    // Use priority scoring to pick the canonical card/button radius,
                    // not the full-round badge radius.
                    const numValue = parseFloat(token.token_value)
                    if (!isNaN(numValue)) {
                        const score = scoreRadiusPath(token.token_path)
                        if (score > bestRadiusScore || bestRadiusValue === null) {
                            bestRadiusScore = score
                            bestRadiusValue = numValue
                        }
                    }
                } else if (lower.includes('font') && lower.includes('size')) {
                    const key = token.token_path.split(/[./]/).pop() ?? token.token_path
                    result.fontSizes.set(key, token.token_value)
                } else if (lower.includes('spacing') && lower.includes('base')) {
                    const numValue = parseFloat(token.token_value)
                    if (!isNaN(numValue)) result.spacingBase = numValue
                }
                break
            }
            case 'fontFamily':
                result.fontFamily = token.token_value
                break
            case 'fontWeight': {
                const key = token.token_path.split(/[./]/).pop() ?? token.token_path
                result.fontWeights.set(key, token.token_value)
                break
            }
            case 'shadow': {
                const key = token.token_path.split(/[./]/).pop() ?? token.token_path
                result.shadows.set(key, token.token_value)
                break
            }
            default:
                result.skipped.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `Token type '${token.token_type}' has no MUI theme equivalent`,
                })
        }
    }

    // Commit best radius (priority-scored, not last-write)
    if (bestRadiusValue !== null) {
        result.borderRadius = bestRadiusValue
    }

    // Build palette colors from priority-scored semantic paths and shade scales.
    // Priority: priority-winner (brand/primary beats text/primary) > shade family
    const muiRoles: Array<{ role: string; families: string[] }> = [
        { role: 'primary',   families: ['primary', 'brand', 'blue'] },
        { role: 'secondary', families: ['secondary', 'accent', 'purple', 'violet'] },
        { role: 'error',     families: ['error', 'red', 'danger', 'destructive'] },
        { role: 'warning',   families: ['warning', 'amber', 'orange', 'yellow'] },
        { role: 'info',      families: ['info', 'cyan', 'teal', 'blue'] },
        { role: 'success',   families: ['success', 'green', 'emerald'] },
    ]

    for (const { role, families } of muiRoles) {
        // Use priority-scored winner (avoids text/primary overwriting brand/primary)
        const priorityValue = paletteRoleWinner.get(role)
        if (priorityValue) {
            result.paletteColors.set(role, { main: priorityValue })
            continue
        }

        // Fall back to color family shades
        for (const familyName of families) {
            const shades = colorFamilies.get(familyName)
            if (shades) {
                const palette: MuiPaletteColor = {
                    main: shades.get(500) ?? shades.values().next().value!,
                }
                const light = shades.get(300)
                const dark = shades.get(700)
                if (light) palette.light = light
                if (dark) palette.dark = dark
                result.paletteColors.set(role, palette)
                break
            }
        }
    }

    // Background: prefer color/surface/page → default, color/surface/card → paper
    // The 'background' semantic role maps to the page background, not card background.
    // 'surface' maps to card/paper.
    const bgValue = result.semanticColors.get('background')
    const surfaceValue = result.semanticColors.get('surface')

    // Also do a targeted lookup for surface.page and surface.card paths
    let surfacePageValue: string | undefined
    let surfaceCardValue: string | undefined
    for (const token of tokens) {
        if (token.token_type !== 'color') continue
        const lower = token.token_path.toLowerCase()
        if (lower.includes('surface') && lower.includes('page') && !surfacePageValue) {
            surfacePageValue = token.token_value
        }
        if (lower.includes('surface') && lower.includes('card') && !surfaceCardValue) {
            surfaceCardValue = token.token_value
        }
    }

    if (surfacePageValue) result.background.default = surfacePageValue
    else if (bgValue) result.background.default = bgValue

    if (surfaceCardValue) result.background.paper = surfaceCardValue
    else if (surfaceValue) result.background.paper = surfaceValue

    // Text colors: prefer text.primary path over muted/foreground catch-all
    let textPrimaryValue: string | undefined
    let textSecondaryValue: string | undefined
    for (const token of tokens) {
        if (token.token_type !== 'color') continue
        const lower = token.token_path.toLowerCase()
        if (!textPrimaryValue && lower.includes('text') && lower.includes('primary')) {
            textPrimaryValue = token.token_value
        }
        if (!textSecondaryValue && lower.includes('text') && lower.includes('secondary')) {
            textSecondaryValue = token.token_value
        }
    }

    if (textPrimaryValue) result.textColors.primary = textPrimaryValue
    else {
        // Fall back to 'text' or 'foreground' semantic color (both are valid text sources)
        const textColor = result.semanticColors.get('text') ?? result.semanticColors.get('foreground')
        if (textColor) result.textColors.primary = textColor
    }

    if (textSecondaryValue) result.textColors.secondary = textSecondaryValue
    else {
        const mutedColor = result.semanticColors.get('muted')
        if (mutedColor) result.textColors.secondary = mutedColor
    }

    return result
}

// ---------------------------------------------------------------------------
// Code renderer
// ---------------------------------------------------------------------------

function renderTheme(classified: ClassifiedMuiTokens): string {
    const lines: string[] = [
        '// Generated by Flint — DO NOT EDIT',
        '// Source: .flint/design-tokens.json',
        `// Generated at: ${new Date().toISOString()}`,
        '',
        "import { createTheme } from '@mui/material/styles';",
        '',
        'export const flintTheme = createTheme({',
    ]

    // --- Palette ---
    const hasPalette = classified.paletteColors.size > 0 ||
        classified.background.default ||
        classified.textColors.primary
    if (hasPalette) {
        lines.push('    palette: {')

        for (const [role, color] of classified.paletteColors) {
            lines.push(`        ${role}: {`)
            lines.push(`            main: '${escapeValue(color.main)}',`)
            if (color.light) lines.push(`            light: '${escapeValue(color.light)}',`)
            if (color.dark) lines.push(`            dark: '${escapeValue(color.dark)}',`)
            if (color.contrastText) lines.push(`            contrastText: '${escapeValue(color.contrastText)}',`)
            lines.push('        },')
        }

        if (classified.background.default || classified.background.paper) {
            lines.push('        background: {')
            if (classified.background.default) {
                lines.push(`            default: '${escapeValue(classified.background.default)}',`)
            }
            if (classified.background.paper) {
                lines.push(`            paper: '${escapeValue(classified.background.paper)}',`)
            }
            lines.push('        },')
        }

        if (classified.textColors.primary || classified.textColors.secondary) {
            lines.push('        text: {')
            if (classified.textColors.primary) {
                lines.push(`            primary: '${escapeValue(classified.textColors.primary)}',`)
            }
            if (classified.textColors.secondary) {
                lines.push(`            secondary: '${escapeValue(classified.textColors.secondary)}',`)
            }
            lines.push('        },')
        }

        lines.push('    },')
    }

    // --- Typography ---
    if (classified.fontFamily) {
        lines.push('    typography: {')
        lines.push(`        fontFamily: '${escapeValue(classified.fontFamily)}',`)
        lines.push('    },')
    }

    // --- Shape ---
    if (classified.borderRadius !== null) {
        lines.push('    shape: {')
        lines.push(`        borderRadius: ${classified.borderRadius},`)
        lines.push('    },')
    }

    // --- Spacing ---
    if (classified.spacingBase !== null) {
        lines.push(`    spacing: ${classified.spacingBase},`)
    }

    lines.push('});')
    lines.push('')
    lines.push('// Usage:')
    lines.push('//   import { ThemeProvider } from "@mui/material/styles";')
    lines.push('//   <ThemeProvider theme={flintTheme}>...</ThemeProvider>')
    lines.push('')

    return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class MuiAdapter implements LibraryAdapter {
    readonly library = 'mui' as const
    readonly defaultFilename = 'flint-theme.ts'
    readonly displayName = 'Material UI (MUI)'
    readonly description =
        'Generates a createTheme() call with palette, typography, and shape overrides to match your Figma design.'

    mapTokens(tokens: DesignToken[], options?: MapOptions): LibraryThemeOutput {
        const filtered = filterTokens(tokens, options)
        const classified = classifyTokens(filtered)
        const code = renderTheme(classified)

        // Build token map
        const tokenMap: Record<string, string> = {}
        for (const [role, color] of classified.paletteColors) {
            tokenMap[`palette.${role}.main`] = color.main
            if (color.light) tokenMap[`palette.${role}.light`] = color.light
            if (color.dark) tokenMap[`palette.${role}.dark`] = color.dark
        }
        if (classified.fontFamily) {
            tokenMap['typography.fontFamily'] = classified.fontFamily
        }
        if (classified.borderRadius !== null) {
            tokenMap['shape.borderRadius'] = String(classified.borderRadius)
        }

        const tokenCount = classified.paletteColors.size +
            (classified.fontFamily ? 1 : 0) +
            (classified.borderRadius !== null ? 1 : 0) +
            (classified.spacingBase !== null ? 1 : 0) +
            classified.fontSizes.size +
            classified.fontWeights.size

        return {
            library: 'mui',
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

        if (!code.includes('createTheme')) {
            errors.push({ line: null, message: 'Missing createTheme() call' })
        }
        if (!code.includes("'@mui/material/styles'")) {
            errors.push({ line: null, message: 'Missing @mui/material/styles import' })
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
        const base = { collection_name: 'mui', mode: 'Light', description: null }
        let id = 0
        const color = (path: string, value: string): DesignToken => ({
            ...base,
            id: ++id,
            token_path: `mui.${path}`,
            token_type: 'color',
            token_value: value,
        })
        const dimension = (path: string, value: string): DesignToken => ({
            ...base,
            id: ++id,
            token_path: `mui.${path}`,
            token_type: 'dimension',
            token_value: value,
        })
        const font = (path: string, value: string): DesignToken => ({
            ...base,
            id: ++id,
            token_path: `mui.${path}`,
            token_type: 'fontFamily',
            token_value: value,
        })

        return [
            // Primary
            color('palette.primary.main', '#1976d2'),
            color('palette.primary.light', '#42a5f5'),
            color('palette.primary.dark', '#1565c0'),
            color('palette.primary.contrastText', '#ffffff'),
            // Secondary
            color('palette.secondary.main', '#9c27b0'),
            color('palette.secondary.light', '#ba68c8'),
            color('palette.secondary.dark', '#7b1fa2'),
            color('palette.secondary.contrastText', '#ffffff'),
            // Error
            color('palette.error.main', '#d32f2f'),
            color('palette.error.light', '#ef5350'),
            color('palette.error.dark', '#c62828'),
            // Warning
            color('palette.warning.main', '#ed6c02'),
            color('palette.warning.light', '#ff9800'),
            color('palette.warning.dark', '#e65100'),
            // Info
            color('palette.info.main', '#0288d1'),
            color('palette.info.light', '#03a9f4'),
            color('palette.info.dark', '#01579b'),
            // Success
            color('palette.success.main', '#2e7d32'),
            color('palette.success.light', '#4caf50'),
            color('palette.success.dark', '#1b5e20'),
            // Background
            color('palette.background.default', '#ffffff'),
            color('palette.background.paper', '#ffffff'),
            // Text
            color('palette.text.primary', 'rgba(0, 0, 0, 0.87)'),
            color('palette.text.secondary', 'rgba(0, 0, 0, 0.6)'),
            // Contrast text (error, warning, info, success)
            color('palette.error.contrastText', '#ffffff'),
            color('palette.warning.contrastText', '#ffffff'),
            color('palette.info.contrastText', '#ffffff'),
            color('palette.success.contrastText', '#ffffff'),
            // Disabled text + divider
            color('palette.text.disabled', 'rgba(0, 0, 0, 0.38)'),
            color('palette.divider', 'rgba(0, 0, 0, 0.12)'),
            // Source: MUI v5 default theme — https://mui.com/material-ui/customization/default-theme/
            // Shape
            dimension('shape.borderRadius', '4px'),
            // Spacing
            dimension('spacing.base', '8px'),
            // Typography
            font('typography.fontFamily', '"Roboto", "Helvetica", "Arial", sans-serif'),
        ]
    }

    getIdiomBlock(): string {
        return [
            '## Active Library: Material UI (MUI)',
            '',
            '**Import convention:** `import { ComponentName } from "@mui/material/ComponentName"` or `import { ComponentName } from "@mui/material"`',
            '**Theming:** Use `useTheme()` hook or `sx` prop to access theme values. Do NOT use raw CSS.',
            '**Styling:** Prefer the `sx` prop over `styled()` for one-off styling. Use `styled()` for reusable styled components.',
            '**Rules:**',
            '- Do NOT use raw hex colors. Reference theme tokens via `theme.palette.primary.main` or sx shorthand `color="primary"`.',
            '- Always use `<Box>` or `<Stack>` for layout instead of raw `<div>` with Flexbox classes.',
            '- Use `spacing()` function for margins/padding (e.g., `sx={{ p: 2 }}` = 16px with default 8px base).',
            '- Wrap the app in `<ThemeProvider theme={flintTheme}>` — never apply theme values inline.',
        ].join('\n')
    }

    matchTokens(tokens: DesignToken[]): LibraryMatchResult {
        let score = 0
        const reasons: string[] = []

        const paths = tokens.map(t => t.token_path.toLowerCase())

        // palette + main → +20
        if (paths.some(p => p.includes('palette') && p.includes('main'))) {
            score += 20
            reasons.push('Token paths contain palette.*.main (MUI palette structure)')
        }

        // palette + light + dark → +15
        if (
            paths.some(p => p.includes('palette') && p.includes('light')) &&
            paths.some(p => p.includes('palette') && p.includes('dark'))
        ) {
            score += 15
            reasons.push('Token paths contain palette.*.light and palette.*.dark variants')
        }

        // palette + contrastText → +15
        if (paths.some(p => p.includes('palette') && p.includes('contrasttext'))) {
            score += 15
            reasons.push('Token paths contain palette.*.contrastText (MUI contrast convention)')
        }

        // palette.background.default or palette.background.paper → +10
        if (
            paths.some(p => p.includes('palette.background.default')) ||
            paths.some(p => p.includes('palette.background.paper'))
        ) {
            score += 10
            reasons.push('Token paths contain palette.background.default/paper')
        }

        // palette.text.primary or palette.text.secondary → +10
        if (
            paths.some(p => p.includes('palette.text.primary')) ||
            paths.some(p => p.includes('palette.text.secondary'))
        ) {
            score += 10
            reasons.push('Token paths contain palette.text.primary/secondary')
        }

        // shape.borderRadius → +10
        if (paths.some(p => p.includes('shape.borderradius'))) {
            score += 10
            reasons.push('Token paths contain shape.borderRadius')
        }

        // typography.fontFamily → +10
        if (paths.some(p => p.includes('typography.fontfamily'))) {
            score += 10
            reasons.push('Token paths contain typography.fontFamily')
        }

        // spacing with a numeric base value → +10
        const spacingTokens = tokens.filter(t =>
            t.token_path.toLowerCase().includes('spacing'),
        )
        if (spacingTokens.some(t => !isNaN(parseFloat(t.token_value)))) {
            score += 10
            reasons.push('Token paths contain spacing with numeric base value')
        }

        score = Math.min(score, 100)

        return { score, reasons }
    }
}

export function createMuiAdapter(): MuiAdapter {
    return new MuiAdapter()
}
