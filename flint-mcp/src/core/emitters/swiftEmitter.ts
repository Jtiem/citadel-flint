/**
 * Swift UIColor Token Emitter -- flint-mcp/src/core/emitters/swiftEmitter.ts
 *
 * EXP.7: Converts DTCG design tokens to Swift UIColor extensions and typed constants.
 * Produces a single `.swift` file with UIColor extensions and enum-based spacing/typography.
 *
 * Pure function: tokens in, PlatformOutput out. No I/O.
 */

import type { DesignToken } from '../../types.js'
import type { PlatformEmitter, PlatformOutput, EmitOptions, SkippedToken, ValidationResult } from './types.js'

// -- Helpers -------------------------------------------------------------------

/**
 * Parse a hex color string to RGB components (0.0-1.0 range).
 * Handles #RGB, #RRGGBB, and #RRGGBBAA formats.
 */
function parseHexToRGBA(hex: string): { r: number; g: number; b: number; a: number } {
    let cleaned = hex.replace('#', '')

    // Expand shorthand #RGB -> #RRGGBB
    if (cleaned.length === 3) {
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
    }

    // Expand shorthand #RGBA -> #RRGGBBAA
    if (cleaned.length === 4) {
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2] + cleaned[3] + cleaned[3]
    }

    const r = parseInt(cleaned.substring(0, 2), 16) / 255
    const g = parseInt(cleaned.substring(2, 4), 16) / 255
    const b = parseInt(cleaned.substring(4, 6), 16) / 255
    const a = cleaned.length === 8 ? parseInt(cleaned.substring(6, 8), 16) / 255 : 1.0

    return { r, g, b, a }
}

/**
 * Convert a dot-separated token path to a camelCase identifier.
 * Drops the first segment (category prefix).
 * `colors.brand.primary` -> `brandPrimary`
 * `spacing.sm` -> `sm`
 */
function toSwiftIdentifier(path: string): string {
    const parts = path.split('.')
    const relevant = parts.length > 1 ? parts.slice(1) : parts
    return relevant
        .map((part, i) => {
            const cleaned = part.replace(/[^a-zA-Z0-9]/g, '')
            if (i === 0) return cleaned
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
        })
        .join('')
}

/**
 * Strip units from a dimension value and return a number.
 * `16px` -> 16, `2rem` -> 32, `1.5` -> 1.5
 */
function parseDimension(value: string): number {
    const trimmed = value.trim()
    const remMatch = trimmed.match(/^([\d.]+)\s*rem$/)
    if (remMatch) return parseFloat(remMatch[1]) * 16

    const pxMatch = trimmed.match(/^([\d.]+)\s*px$/)
    if (pxMatch) return parseFloat(pxMatch[1])

    const parsed = parseFloat(trimmed)
    return isNaN(parsed) ? 0 : parsed
}

/**
 * Format a number as a Swift CGFloat literal.
 * Ensures at least one decimal place for CGFloat readability.
 */
function toCGFloat(n: number): string {
    if (Number.isInteger(n)) return `${n}.0`
    // Cap to 3 decimal places
    return parseFloat(n.toFixed(3)).toString()
}

/**
 * Filter tokens by optional mode and collection.
 */
function filterTokens(tokens: DesignToken[], options?: EmitOptions): DesignToken[] {
    let filtered = tokens
    if (options?.mode) {
        filtered = filtered.filter(t => t.mode === options.mode)
    }
    if (options?.collection) {
        filtered = filtered.filter(t => t.collection_name === options.collection)
    }
    return filtered
}

// -- Emitter -------------------------------------------------------------------

const SUPPORTED_TYPES = new Set([
    'color', 'dimension', 'fontFamily', 'fontWeight',
    'lineHeight', 'letterSpacing', 'opacity',
])

export class SwiftEmitter implements PlatformEmitter {
    readonly platform = 'swift' as const
    readonly defaultFilename = 'Tokens.swift'

    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput {
        const filtered = filterTokens(tokens, options)

        const colors: Array<{ name: string; r: number; g: number; b: number; a: number }> = []
        const spacing: Array<{ name: string; value: number }> = []
        const typography: Array<{ name: string; value: string | number; isString: boolean }> = []
        const opacity: Array<{ name: string; value: number }> = []
        const skippedTokens: SkippedToken[] = []
        let tokenCount = 0

        for (const token of filtered) {
            if (!SUPPORTED_TYPES.has(token.token_type)) {
                skippedTokens.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: token.token_type === 'shadow'
                        ? 'Shadow tokens require NSShadow -- skipped in v1'
                        : `Token type '${token.token_type}' is not supported in Swift output`,
                })
                continue
            }

            const name = toSwiftIdentifier(token.token_path)
            tokenCount++

            switch (token.token_type) {
                case 'color': {
                    const rgba = parseHexToRGBA(token.token_value)
                    colors.push({ name, ...rgba })
                    break
                }

                case 'dimension':
                    spacing.push({ name, value: parseDimension(token.token_value) })
                    break

                case 'fontFamily':
                    typography.push({
                        name,
                        value: token.token_value.split(',')[0].trim().replace(/['"]/g, ''),
                        isString: true,
                    })
                    break

                case 'fontWeight': {
                    const weight = parseFloat(token.token_value)
                    typography.push({
                        name,
                        value: isNaN(weight) ? 400 : weight,
                        isString: false,
                    })
                    break
                }

                case 'lineHeight':
                case 'letterSpacing':
                    typography.push({
                        name,
                        value: parseDimension(token.token_value),
                        isString: false,
                    })
                    break

                case 'opacity':
                    opacity.push({ name, value: parseFloat(token.token_value) })
                    break
            }
        }

        const code = generateSwiftCode(colors, spacing, typography, opacity)

        return {
            platform: 'swift',
            code,
            filename: this.defaultFilename,
            tokenCount,
            skippedTokens,
            mimeType: 'text/x-swift',
        }
    }

    validate(output: PlatformOutput): ValidationResult {
        const errors: { line: number | null; message: string }[] = []
        const code = output.code

        // Check balanced braces
        let braceCount = 0
        const lines = code.split('\n')
        for (let i = 0; i < lines.length; i++) {
            for (const ch of lines[i]) {
                if (ch === '{') braceCount++
                if (ch === '}') braceCount--
                if (braceCount < 0) {
                    errors.push({ line: i + 1, message: 'Unexpected closing brace' })
                }
            }
        }
        if (braceCount !== 0) {
            errors.push({ line: null, message: `Unbalanced braces: ${braceCount > 0 ? 'missing closing' : 'extra closing'} brace(s)` })
        }

        // Check for header
        if (code.length > 0 && !code.includes('// Generated by Flint EXP.7')) {
            errors.push({ line: 1, message: 'Missing Flint header comment' })
        }

        // Check for import UIKit
        if (code.length > 0 && !code.includes('import UIKit')) {
            errors.push({ line: null, message: 'Missing import UIKit statement' })
        }

        return { valid: errors.length === 0, errors }
    }
}

// -- Code generation -----------------------------------------------------------

function generateSwiftCode(
    colors: Array<{ name: string; r: number; g: number; b: number; a: number }>,
    spacing: Array<{ name: string; value: number }>,
    typography: Array<{ name: string; value: string | number; isString: boolean }>,
    opacity: Array<{ name: string; value: number }>,
): string {
    const sections: string[] = []

    sections.push('// Generated by Flint EXP.7 -- DO NOT EDIT')
    sections.push('// Source: .flint/design-tokens.json')
    sections.push(`// Generated at: ${new Date().toISOString()}`)
    sections.push('')
    sections.push('import UIKit')

    // Colors
    if (colors.length > 0) {
        sections.push('')
        sections.push('// MARK: - Colors')
        sections.push('')
        sections.push('extension UIColor {')
        for (const c of colors) {
            sections.push(`    static let ${c.name} = UIColor(red: ${toCGFloat(c.r)}, green: ${toCGFloat(c.g)}, blue: ${toCGFloat(c.b)}, alpha: ${toCGFloat(c.a)})`)
        }
        sections.push('}')
    }

    // Spacing
    if (spacing.length > 0) {
        sections.push('')
        sections.push('// MARK: - Spacing')
        sections.push('')
        sections.push('enum Spacing {')
        for (const s of spacing) {
            sections.push(`    static let ${s.name}: CGFloat = ${toCGFloat(s.value)}`)
        }
        sections.push('}')
    }

    // Typography
    if (typography.length > 0) {
        sections.push('')
        sections.push('// MARK: - Typography')
        sections.push('')
        sections.push('enum Typography {')
        for (const t of typography) {
            if (t.isString) {
                sections.push(`    static let ${t.name} = "${t.value}"`)
            } else {
                sections.push(`    static let ${t.name}: CGFloat = ${toCGFloat(t.value as number)}`)
            }
        }
        sections.push('}')
    }

    // Opacity
    if (opacity.length > 0) {
        sections.push('')
        sections.push('// MARK: - Opacity')
        sections.push('')
        sections.push('enum Opacity {')
        for (const o of opacity) {
            sections.push(`    static let ${o.name}: CGFloat = ${toCGFloat(o.value)}`)
        }
        sections.push('}')
    }

    sections.push('')

    return sections.join('\n')
}
