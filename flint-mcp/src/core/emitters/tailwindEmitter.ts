/**
 * Tailwind CSS v4 theme config emitter -- flint-mcp/src/core/emitters/tailwindEmitter.ts
 *
 * EXP.7: Converts DTCG design tokens into a Tailwind CSS theme configuration file.
 * Pure function -- no I/O. Tokens in, PlatformOutput out.
 */

import type { DesignToken } from '../../types.js'
import type {
    PlatformEmitter,
    PlatformOutput,
    EmitOptions,
    SkippedToken,
    ValidationResult,
} from './types.js'
import { escapeTypescriptStringLiteral } from './escape.js'

// -- Token type to Tailwind section mapping -----------------------------------

/** Token types that have no Tailwind theme equivalent. */
const UNSUPPORTED_TYPES = new Set(['string', 'boolean'])

/** Path segments that indicate a dimension token belongs in fontSize. */
const FONT_SIZE_PATH_HINTS = new Set([
    'fontsize', 'font-size', 'size', 'text',
])

// -- Helpers ------------------------------------------------------------------

/**
 * Convert a dot-delimited token path to a Tailwind-friendly key.
 * e.g. "colors.primary.500" -> "primary-500"
 *
 * Strips the first segment (type prefix like "colors", "spacing") since
 * it is already represented by the Tailwind theme section.
 */
function toTailwindKey(tokenPath: string): string {
    const segments = tokenPath.split('.')
    // Drop the first segment (type category) if there are multiple segments
    const keySegments = segments.length > 1 ? segments.slice(1) : segments
    return keySegments.join('-')
}

/**
 * Determine which Tailwind theme section a dimension token belongs in
 * based on its token_path.
 */
function classifyDimension(tokenPath: string): 'spacing' | 'fontSize' {
    const lower = tokenPath.toLowerCase()
    for (const hint of FONT_SIZE_PATH_HINTS) {
        if (lower.includes(hint)) return 'fontSize'
    }
    // Default: dimension tokens are spacing
    return 'spacing'
}

/**
 * Parse a font family value into an array of family names.
 * e.g. "'Inter', sans-serif" -> ["Inter", "sans-serif"]
 */
function parseFontFamily(value: string): string[] {
    return value
        .split(',')
        .map(f => f.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
}

/**
 * Escape a string value for safe embedding in a TypeScript string literal.
 * Delegates to the shared escapeTypescriptStringLiteral helper (MINT.5 Phase 1).
 */
function escapeValue(value: string): string {
    return escapeTypescriptStringLiteral(value)
}

// -- Theme builder ------------------------------------------------------------

interface TailwindTheme {
    colors: Record<string, string>
    spacing: Record<string, string>
    fontSize: Record<string, string>
    fontFamily: Record<string, string[]>
    fontWeight: Record<string, string>
    lineHeight: Record<string, string>
    letterSpacing: Record<string, string>
    boxShadow: Record<string, string>
    opacity: Record<string, string>
}

function createEmptyTheme(): TailwindTheme {
    return {
        colors: {},
        spacing: {},
        fontSize: {},
        fontFamily: {},
        fontWeight: {},
        lineHeight: {},
        letterSpacing: {},
        boxShadow: {},
        opacity: {},
    }
}

// -- Emitter class ------------------------------------------------------------

export class TailwindEmitter implements PlatformEmitter {
    readonly platform = 'tailwind' as const
    readonly defaultFilename = 'tailwind.config.ts'

    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput {
        const filtered = this.filterTokens(tokens, options)
        const theme = createEmptyTheme()
        const skippedTokens: SkippedToken[] = []
        let emittedCount = 0

        for (const token of filtered) {
            if (UNSUPPORTED_TYPES.has(token.token_type)) {
                skippedTokens.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `Token type '${token.token_type}' has no Tailwind CSS equivalent`,
                })
                continue
            }

            const key = toTailwindKey(token.token_path)

            switch (token.token_type) {
                case 'color':
                    theme.colors[key] = token.token_value
                    break
                case 'dimension': {
                    const section = classifyDimension(token.token_path)
                    theme[section][key] = token.token_value
                    break
                }
                case 'fontFamily':
                    theme.fontFamily[key] = parseFontFamily(token.token_value)
                    break
                case 'fontWeight':
                    theme.fontWeight[key] = token.token_value
                    break
                case 'lineHeight':
                    theme.lineHeight[key] = token.token_value
                    break
                case 'letterSpacing':
                    theme.letterSpacing[key] = token.token_value
                    break
                case 'shadow':
                    theme.boxShadow[key] = token.token_value
                    break
                case 'opacity':
                    theme.opacity[key] = token.token_value
                    break
                default:
                    skippedTokens.push({
                        tokenPath: token.token_path,
                        tokenType: token.token_type,
                        reason: `Unrecognized token type '${token.token_type}'`,
                    })
                    continue
            }

            emittedCount++
        }

        const code = this.renderCode(theme)

        return {
            platform: 'tailwind',
            code,
            filename: this.defaultFilename,
            tokenCount: emittedCount,
            skippedTokens,
            mimeType: 'application/typescript',
        }
    }

    validate(output: PlatformOutput): ValidationResult {
        const errors: { line: number | null; message: string }[] = []
        const { code } = output

        // Must contain export default
        if (!code.includes('export default')) {
            errors.push({
                line: null,
                message: 'Missing "export default" statement',
            })
        }

        // Must contain satisfies Config
        if (!code.includes('satisfies Config')) {
            errors.push({
                line: null,
                message: 'Missing "satisfies Config" type assertion',
            })
        }

        // Check balanced braces
        let braceCount = 0
        const lines = code.split('\n')
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

    private renderCode(theme: TailwindTheme): string {
        const now = new Date().toISOString()
        const lines: string[] = [
            '// Generated by Flint EXP.7 -- DO NOT EDIT',
            '// Source: .flint/design-tokens.json',
            `// Generated at: ${now}`,
            '',
            "import type { Config } from 'tailwindcss'",
            '',
            'export default {',
            '    theme: {',
            '        extend: {',
        ]

        const sections: [string, Record<string, string | string[]>][] = [
            ['colors', theme.colors],
            ['spacing', theme.spacing],
            ['fontSize', theme.fontSize],
            ['fontFamily', theme.fontFamily],
            ['fontWeight', theme.fontWeight],
            ['lineHeight', theme.lineHeight],
            ['letterSpacing', theme.letterSpacing],
            ['boxShadow', theme.boxShadow],
            ['opacity', theme.opacity],
        ]

        let firstSection = true
        for (const [sectionName, entries] of sections) {
            if (Object.keys(entries).length === 0) continue

            if (!firstSection) {
                lines.push('')
            }
            firstSection = false

            lines.push(`            ${sectionName}: {`)

            for (const [key, value] of Object.entries(entries)) {
                if (Array.isArray(value)) {
                    // Font family array
                    const formatted = value.map(v => `'${escapeValue(v)}'`).join(', ')
                    lines.push(`                '${escapeValue(key)}': [${formatted}],`)
                } else {
                    lines.push(`                '${escapeValue(key)}': '${escapeValue(value)}',`)
                }
            }

            lines.push('            },')
        }

        lines.push('        },')
        lines.push('    },')
        lines.push('} satisfies Config')
        lines.push('')

        return lines.join('\n')
    }
}

/**
 * Factory function for creating a TailwindEmitter instance.
 */
export function createTailwindEmitter(): TailwindEmitter {
    return new TailwindEmitter()
}
