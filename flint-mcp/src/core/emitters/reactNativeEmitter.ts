/**
 * React Native StyleSheet Token Emitter -- flint-mcp/src/core/emitters/reactNativeEmitter.ts
 *
 * EXP.7: Converts DTCG design tokens to React Native TypeScript constants.
 * Produces typed `colors`, `spacing`, `typography`, `shadows`, and `opacity` exports.
 *
 * Pure function: tokens in, PlatformOutput out. No I/O.
 */

import type { DesignToken } from '../../types.js'
import type { PlatformEmitter, PlatformOutput, EmitOptions, SkippedToken, ValidationResult } from './types.js'

// -- Helpers -------------------------------------------------------------------

/**
 * Convert a dot-separated token path to a camelCase identifier.
 * `colors.primary.500` -> `colorsPrimary500`
 */
function toCamelCase(path: string): string {
    const parts = path.split('.')
    return parts
        .map((part, i) => {
            // Replace leading digits with underscore prefix
            const cleaned = part.replace(/[^a-zA-Z0-9]/g, '')
            if (i === 0) return cleaned
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
        })
        .join('')
}

/**
 * Extract a short identifier from a token path, dropping the category prefix.
 * `colors.brand.primary` -> `brandPrimary`
 * `spacing.base` -> `base`
 */
function toShortCamelCase(path: string): string {
    const parts = path.split('.')
    // Drop the first segment (category) if there are multiple segments
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
 * `16px` -> 16, `2rem` -> 32 (at 16px base), `1.5` -> 1.5
 */
function parseDimensionToNumber(value: string): number {
    const trimmed = value.trim()
    const remMatch = trimmed.match(/^([\d.]+)\s*rem$/)
    if (remMatch) return parseFloat(remMatch[1]) * 16

    const pxMatch = trimmed.match(/^([\d.]+)\s*px$/)
    if (pxMatch) return parseFloat(pxMatch[1])

    const numericMatch = trimmed.match(/^[\d.]+$/)
    if (numericMatch) return parseFloat(trimmed)

    // Fallback: try to parse whatever we can
    const parsed = parseFloat(trimmed)
    return isNaN(parsed) ? 0 : parsed
}

/**
 * Determine if a dimension token relates to font sizing vs spacing.
 */
function isFontSizePath(path: string): boolean {
    const lower = path.toLowerCase()
    return lower.includes('fontsize') || lower.includes('font-size') || lower.includes('font.size')
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
    'lineHeight', 'letterSpacing', 'shadow', 'opacity',
])

export class ReactNativeEmitter implements PlatformEmitter {
    readonly platform = 'react-native' as const
    readonly defaultFilename = 'tokens.ts'

    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput {
        const filtered = filterTokens(tokens, options)

        const colors: Record<string, string> = {}
        const spacing: Record<string, number> = {}
        const typography: Record<string, string | number> = {}
        const shadows: Record<string, object> = {}
        const opacity: Record<string, number> = {}
        const skippedTokens: SkippedToken[] = []
        let tokenCount = 0

        for (const token of filtered) {
            if (!SUPPORTED_TYPES.has(token.token_type)) {
                skippedTokens.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: `Token type '${token.token_type}' is not supported in React Native StyleSheet`,
                })
                continue
            }

            const key = toShortCamelCase(token.token_path)
            tokenCount++

            switch (token.token_type) {
                case 'color':
                    colors[key] = token.token_value
                    break

                case 'dimension':
                    if (isFontSizePath(token.token_path)) {
                        typography[key] = parseDimensionToNumber(token.token_value)
                    } else {
                        spacing[key] = parseDimensionToNumber(token.token_value)
                    }
                    break

                case 'fontFamily':
                    // Strip fallback stacks: 'Inter, sans-serif' -> 'Inter'
                    typography[key] = token.token_value.split(',')[0].trim().replace(/['"]/g, '')
                    break

                case 'fontWeight':
                    typography[key] = token.token_value
                    break

                case 'lineHeight':
                case 'letterSpacing':
                    typography[key] = parseDimensionToNumber(token.token_value)
                    break

                case 'shadow':
                    shadows[key] = parseShadowToRN(token.token_value)
                    break

                case 'opacity':
                    opacity[key] = parseFloat(token.token_value)
                    break
            }
        }

        const code = generateCode(colors, spacing, typography, shadows, opacity)

        return {
            platform: 'react-native',
            code,
            filename: this.defaultFilename,
            tokenCount,
            skippedTokens,
            mimeType: 'application/typescript',
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

        // Check for valid export statements
        if (code.length > 0 && !code.includes('// Generated by Flint EXP.7')) {
            errors.push({ line: 1, message: 'Missing Flint header comment' })
        }

        return { valid: errors.length === 0, errors }
    }
}

// -- Code generation -----------------------------------------------------------

function parseShadowToRN(value: string): object {
    // Parse CSS shadow: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
    // Returns React Native shadow shape
    const match = value.match(
        /^([\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+([\d.]+)(?:px)?)?\s+(.+)$/,
    )
    if (match) {
        const [, x, y, radius, , color] = match
        const opacityMatch = color?.match(/[\d.]+\)$/)
        return {
            shadowColor: '#000',
            shadowOffset: { width: parseFloat(x), height: parseFloat(y) },
            shadowOpacity: opacityMatch ? parseFloat(opacityMatch[0]) : 0.1,
            shadowRadius: parseFloat(radius),
            elevation: Math.max(1, Math.round(parseFloat(radius))),
        }
    }
    // Fallback for unparseable shadows
    return {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    }
}

function formatObjectEntries(obj: Record<string, unknown>, indent: string): string {
    const entries = Object.entries(obj)
    if (entries.length === 0) return ''
    return entries
        .map(([key, val]) => {
            if (typeof val === 'string') return `${indent}${key}: '${val}',`
            if (typeof val === 'number') return `${indent}${key}: ${val},`
            if (typeof val === 'object' && val !== null) {
                // Nested object (e.g., shadow offset)
                const nested = formatObjectEntries(val as Record<string, unknown>, indent + '    ')
                return `${indent}${key}: {\n${nested}\n${indent}},`
            }
            return `${indent}${key}: ${String(val)},`
        })
        .join('\n')
}

function generateCode(
    colors: Record<string, string>,
    spacing: Record<string, number>,
    typography: Record<string, string | number>,
    shadows: Record<string, object>,
    opacity: Record<string, number>,
): string {
    const sections: string[] = []

    sections.push('// Generated by Flint EXP.7 -- DO NOT EDIT')
    sections.push('// Source: .flint/design-tokens.json')
    sections.push(`// Generated at: ${new Date().toISOString()}`)
    sections.push('')

    // Only import StyleSheet if we have shadows (it's not actually used for the const exports)
    // but keep it for convention
    sections.push("import { StyleSheet } from 'react-native'")
    sections.push('')

    // Colors
    if (Object.keys(colors).length > 0) {
        sections.push('export const colors = {')
        for (const [key, val] of Object.entries(colors)) {
            sections.push(`    ${key}: '${val}',`)
        }
        sections.push('} as const')
        sections.push('')
    }

    // Spacing
    if (Object.keys(spacing).length > 0) {
        sections.push('export const spacing = {')
        for (const [key, val] of Object.entries(spacing)) {
            sections.push(`    ${key}: ${val},`)
        }
        sections.push('} as const')
        sections.push('')
    }

    // Typography
    if (Object.keys(typography).length > 0) {
        sections.push('export const typography = {')
        for (const [key, val] of Object.entries(typography)) {
            if (typeof val === 'string') {
                sections.push(`    ${key}: '${val}',`)
            } else {
                sections.push(`    ${key}: ${val},`)
            }
        }
        sections.push('} as const')
        sections.push('')
    }

    // Shadows
    if (Object.keys(shadows).length > 0) {
        sections.push('export const shadows = {')
        for (const [key, val] of Object.entries(shadows)) {
            const nested = formatObjectEntries(val as Record<string, unknown>, '        ')
            sections.push(`    ${key}: {`)
            sections.push(nested)
            sections.push('    },')
        }
        sections.push('} as const')
        sections.push('')
    }

    // Opacity
    if (Object.keys(opacity).length > 0) {
        sections.push('export const opacity = {')
        for (const [key, val] of Object.entries(opacity)) {
            sections.push(`    ${key}: ${val},`)
        }
        sections.push('} as const')
        sections.push('')
    }

    return sections.join('\n')
}
