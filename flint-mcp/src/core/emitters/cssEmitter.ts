/**
 * CSS Custom Properties emitter -- flint-mcp/src/core/emitters/cssEmitter.ts
 *
 * EXP.7: Converts DTCG design tokens into CSS custom properties inside :root.
 * Pure function -- no I/O. Tokens in, PlatformOutput out.
 */

import type { DesignToken, TokenType } from '../../types.js'
import type {
    PlatformEmitter,
    PlatformOutput,
    EmitOptions,
    SkippedToken,
    ValidationResult,
} from './types.js'
import { escapeCssValue } from './escape.js'

// -- Constants ----------------------------------------------------------------

/** Token types with no CSS custom property equivalent. */
const UNSUPPORTED_TYPES = new Set<TokenType>(['boolean'])

/** Human-readable category labels for CSS comment grouping. */
const TYPE_CATEGORY_LABELS: Record<string, string> = {
    color: 'Colors',
    dimension: 'Spacing',
    fontFamily: 'Typography',
    fontWeight: 'Typography',
    fontSize: 'Typography',
    lineHeight: 'Typography',
    letterSpacing: 'Typography',
    shadow: 'Shadows',
    opacity: 'Opacity',
    string: 'Strings',
}

// -- Helpers ------------------------------------------------------------------

/**
 * Convert a dot-delimited token path to a CSS custom property name.
 * e.g. "colors.primary.500" -> "--colors-primary-500"
 * With prefix: "colors.primary.500" -> "--myprefix-colors-primary-500"
 */
function toCSSPropertyName(tokenPath: string, prefix?: string): string {
    const slug = tokenPath.replace(/\./g, '-')
    if (prefix) {
        return `--${prefix}-${slug}`
    }
    return `--${slug}`
}

/**
 * Format a token value for CSS output.
 * Font family values get wrapped in quotes if they contain spaces.
 * All values are passed through escapeCssValue to neutralize injection vectors.
 */
function formatCSSValue(token: DesignToken): string {
    if (token.token_type === 'fontFamily') {
        return token.token_value
            .split(',')
            .map(f => {
                const trimmed = f.trim().replace(/^['"]|['"]$/g, '')
                const escaped = escapeCssValue(trimmed)
                return escaped.includes(' ') ? `'${escaped}'` : escaped
            })
            .join(', ')
    }
    return escapeCssValue(token.token_value)
}

// -- Group tokens by category for comment sections ----------------------------

interface TokenGroup {
    label: string
    tokens: DesignToken[]
}

function groupTokensByCategory(tokens: DesignToken[]): TokenGroup[] {
    const groups = new Map<string, DesignToken[]>()

    for (const token of tokens) {
        const label = TYPE_CATEGORY_LABELS[token.token_type] ?? 'Other'
        const existing = groups.get(label)
        if (existing) {
            existing.push(token)
        } else {
            groups.set(label, [token])
        }
    }

    return Array.from(groups.entries()).map(([label, groupTokens]) => ({
        label,
        tokens: groupTokens,
    }))
}

// -- Multi-mode support -------------------------------------------------------

interface ModeGroup {
    mode: string
    tokens: DesignToken[]
}

function groupByMode(tokens: DesignToken[]): ModeGroup[] {
    const modes = new Map<string, DesignToken[]>()

    for (const token of tokens) {
        const mode = token.mode || 'default'
        const existing = modes.get(mode)
        if (existing) {
            existing.push(token)
        } else {
            modes.set(mode, [token])
        }
    }

    return Array.from(modes.entries()).map(([mode, modeTokens]) => ({
        mode,
        tokens: modeTokens,
    }))
}

// -- Emitter class ------------------------------------------------------------

export class CSSEmitter implements PlatformEmitter {
    readonly platform = 'css' as const
    readonly defaultFilename = 'variables.css'

    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput {
        const filtered = this.filterTokens(tokens, options)
        const skippedTokens: SkippedToken[] = []

        // Separate emittable tokens from unsupported ones
        const emittable: DesignToken[] = []
        for (const token of filtered) {
            if (UNSUPPORTED_TYPES.has(token.token_type)) {
                skippedTokens.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `Token type '${token.token_type}' has no CSS custom property equivalent`,
                })
            } else {
                emittable.push(token)
            }
        }

        const prefix = options?.prefix

        // Determine if we need multi-mode output
        const modeGroups = groupByMode(emittable)
        const hasMultipleModes = modeGroups.length > 1

        const code = hasMultipleModes
            ? this.renderMultiMode(modeGroups, prefix)
            : this.renderSingleMode(emittable, prefix)

        return {
            platform: 'css',
            code,
            filename: this.defaultFilename,
            tokenCount: emittable.length,
            skippedTokens,
            mimeType: 'text/css',
        }
    }

    validate(output: PlatformOutput): ValidationResult {
        const errors: { line: number | null; message: string }[] = []
        const { code } = output
        const trimmed = code.trim()

        // Strip leading comments to find the first significant content
        const lines = trimmed.split('\n')
        let contentStart = ''
        for (const line of lines) {
            const stripped = line.trim()
            if (stripped && !stripped.startsWith('/*') && !stripped.startsWith('*') && !stripped.startsWith('//')) {
                contentStart = stripped
                break
            }
        }

        // Must start with :root or a data-theme selector
        if (!contentStart.startsWith(':root') && !contentStart.startsWith('[data-theme')) {
            errors.push({
                line: null,
                message: 'CSS output must begin with :root { or a [data-theme] selector',
            })
        }

        // Must end with }
        const lastChar = trimmed[trimmed.length - 1]
        if (lastChar !== '}') {
            errors.push({
                line: null,
                message: 'CSS output must end with a closing brace }',
            })
        }

        // Check balanced braces
        let braceCount = 0
        for (let i = 0; i < lines.length; i++) {
            for (const ch of lines[i]) {
                if (ch === '{') braceCount++
                if (ch === '}') braceCount--
            }
            if (braceCount < 0) {
                errors.push({
                    line: i + 1,
                    message: 'Unexpected closing brace',
                })
            }
        }
        if (braceCount !== 0) {
            errors.push({
                line: null,
                message: `Unbalanced braces: ${braceCount > 0 ? 'missing' : 'extra'} ${Math.abs(braceCount)} closing brace(s)`,
            })
        }

        // Check that CSS properties have semicolons (ignoring comments and empty lines)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (line.startsWith('--') && !line.endsWith(';')) {
                errors.push({
                    line: i + 1,
                    message: `CSS property declaration missing semicolon: ${line}`,
                })
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }

    // -- Private helpers -------------------------------------------------------

    private filterTokens(tokens: DesignToken[], options?: EmitOptions): DesignToken[] {
        let result = tokens
        if (options?.mode) {
            result = result.filter(t => t.mode === options.mode)
        }
        if (options?.collection) {
            result = result.filter(t => t.collection_name === options.collection)
        }
        return result
    }

    private renderSingleMode(tokens: DesignToken[], prefix?: string): string {
        const now = new Date().toISOString()
        const lines: string[] = [
            '/* Generated by Flint EXP.7 -- DO NOT EDIT */',
            '/* Source: .flint/design-tokens.json */',
            `/* Generated at: ${now} */`,
            '',
            ':root {',
        ]

        const groups = groupTokensByCategory(tokens)

        for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi]
            if (gi > 0) lines.push('')
            lines.push(`    /* ${group.label} */`)
            for (const token of group.tokens) {
                const name = toCSSPropertyName(token.token_path, prefix)
                const value = formatCSSValue(token)
                lines.push(`    ${name}: ${value};`)
            }
        }

        lines.push('}')
        lines.push('')

        return lines.join('\n')
    }

    private renderMultiMode(modeGroups: ModeGroup[], prefix?: string): string {
        const now = new Date().toISOString()
        const lines: string[] = [
            '/* Generated by Flint EXP.7 -- DO NOT EDIT */',
            '/* Source: .flint/design-tokens.json */',
            `/* Generated at: ${now} */`,
            '',
        ]

        for (let mi = 0; mi < modeGroups.length; mi++) {
            const { mode, tokens } = modeGroups[mi]
            if (mi > 0) lines.push('')

            // First mode (or 'default'/'light') gets :root
            const isDefaultMode =
                mi === 0 || mode.toLowerCase() === 'default' || mode.toLowerCase() === 'light'

            const selector = isDefaultMode
                ? `:root, [data-theme="${mode.toLowerCase()}"]`
                : `[data-theme="${mode.toLowerCase()}"]`

            lines.push(`${selector} {`)

            const groups = groupTokensByCategory(tokens)
            for (let gi = 0; gi < groups.length; gi++) {
                const group = groups[gi]
                if (gi > 0) lines.push('')
                lines.push(`    /* ${group.label} */`)
                for (const token of group.tokens) {
                    const name = toCSSPropertyName(token.token_path, prefix)
                    const value = formatCSSValue(token)
                    lines.push(`    ${name}: ${value};`)
                }
            }

            lines.push('}')
        }

        lines.push('')

        return lines.join('\n')
    }
}

/**
 * Factory function for creating a CSSEmitter instance.
 */
export function createCSSEmitter(): CSSEmitter {
    return new CSSEmitter()
}
