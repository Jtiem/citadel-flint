/**
 * Kotlin Compose Token Emitter -- flint-mcp/src/core/emitters/kotlinEmitter.ts
 *
 * EXP.7: Converts DTCG design tokens to Kotlin Compose Color/Dp/Sp constants.
 * Produces a single `.kt` file with typed object declarations.
 *
 * Pure function: tokens in, PlatformOutput out. No I/O.
 */

import type { DesignToken } from '../../types.js'
import type { PlatformEmitter, PlatformOutput, EmitOptions, SkippedToken, ValidationResult } from './types.js'
import { escapeKotlinStringLiteral } from './escape.js'

// -- Helpers -------------------------------------------------------------------

/**
 * Parse a hex color string and return as ARGB hex literal for Compose Color().
 * `#3B82F6` -> `0xFF3B82F6`
 * `#3B82F680` -> `0x803B82F6` (alpha from hex)
 * `#F00` -> `0xFFFF0000`
 */
function hexToComposeARGB(hex: string): string {
    let cleaned = hex.replace('#', '').toUpperCase()

    // Expand shorthand #RGB -> RRGGBB
    if (cleaned.length === 3) {
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
    }

    // Expand shorthand #RGBA -> RRGGBBAA
    if (cleaned.length === 4) {
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2] + cleaned[3] + cleaned[3]
    }

    if (cleaned.length === 8) {
        // Input is RRGGBBAA, Compose needs AARRGGBB
        const rr = cleaned.substring(0, 2)
        const gg = cleaned.substring(2, 4)
        const bb = cleaned.substring(4, 6)
        const aa = cleaned.substring(6, 8)
        return `0x${aa}${rr}${gg}${bb}`
    }

    // Standard 6-char hex: add FF alpha
    return `0xFF${cleaned}`
}

/**
 * Convert a dot-separated token path to a PascalCase identifier.
 * Drops the first segment (category prefix).
 * `colors.brand.primary` -> `BrandPrimary`
 * `spacing.sm` -> `Sm`
 */
function toKotlinIdentifier(path: string): string {
    const parts = path.split('.')
    const relevant = parts.length > 1 ? parts.slice(1) : parts
    return relevant
        .map((part) => {
            const cleaned = part.replace(/[^a-zA-Z0-9]/g, '')
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
    'lineHeight', 'letterSpacing', 'opacity',
])

export class KotlinEmitter implements PlatformEmitter {
    readonly platform = 'kotlin' as const
    readonly defaultFilename = 'Tokens.kt'

    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput {
        const filtered = filterTokens(tokens, options)

        const colors: Array<{ name: string; argb: string }> = []
        const spacing: Array<{ name: string; value: number }> = []
        const typography: Array<{ name: string; value: string | number; kind: 'string' | 'sp' | 'int' }> = []
        const opacity: Array<{ name: string; value: number }> = []
        const skippedTokens: SkippedToken[] = []
        let tokenCount = 0

        for (const token of filtered) {
            if (!SUPPORTED_TYPES.has(token.token_type)) {
                skippedTokens.push({
                    tokenPath: token.token_path,
                    tokenType: token.token_type,
                    reason: token.token_type === 'shadow'
                        ? 'Shadow tokens require Modifier.shadow -- skipped in v1'
                        : `Token type '${token.token_type}' is not supported in Kotlin Compose output`,
                })
                continue
            }

            const name = toKotlinIdentifier(token.token_path)
            tokenCount++

            switch (token.token_type) {
                case 'color':
                    colors.push({ name, argb: hexToComposeARGB(token.token_value) })
                    break

                case 'dimension':
                    if (isFontSizePath(token.token_path)) {
                        typography.push({ name, value: parseDimension(token.token_value), kind: 'sp' })
                    } else {
                        spacing.push({ name, value: parseDimension(token.token_value) })
                    }
                    break

                case 'fontFamily':
                    typography.push({
                        name,
                        value: token.token_value.split(',')[0].trim().replace(/['"]/g, ''),
                        kind: 'string',
                    })
                    break

                case 'fontWeight': {
                    const weight = parseInt(token.token_value, 10)
                    typography.push({
                        name,
                        value: isNaN(weight) ? 400 : weight,
                        kind: 'int',
                    })
                    break
                }

                case 'lineHeight':
                case 'letterSpacing':
                    typography.push({
                        name,
                        value: parseDimension(token.token_value),
                        kind: 'sp',
                    })
                    break

                case 'opacity':
                    opacity.push({ name, value: parseFloat(token.token_value) })
                    break
            }
        }

        const packageName = options?.prefix ?? 'com.project.tokens'
        const code = generateKotlinCode(packageName, colors, spacing, typography, opacity)

        return {
            platform: 'kotlin',
            code,
            filename: this.defaultFilename,
            tokenCount,
            skippedTokens,
            mimeType: 'text/x-kotlin',
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

        // Check for package declaration
        if (code.length > 0 && !code.includes('package ')) {
            errors.push({ line: null, message: 'Missing package declaration' })
        }

        return { valid: errors.length === 0, errors }
    }
}

// -- Code generation -----------------------------------------------------------

function formatDpValue(n: number): string {
    if (Number.isInteger(n)) return `${n}.dp`
    return `${n}.dp`
}

function formatSpValue(n: number): string {
    if (Number.isInteger(n)) return `${n}.sp`
    return `${n}.sp`
}

function generateKotlinCode(
    packageName: string,
    colors: Array<{ name: string; argb: string }>,
    spacing: Array<{ name: string; value: number }>,
    typography: Array<{ name: string; value: string | number; kind: 'string' | 'sp' | 'int' }>,
    opacity: Array<{ name: string; value: number }>,
): string {
    const sections: string[] = []

    sections.push('// Generated by Flint EXP.7 -- DO NOT EDIT')
    sections.push('// Source: .flint/design-tokens.json')
    sections.push(`// Generated at: ${new Date().toISOString()}`)
    sections.push('')
    sections.push(`package ${packageName}`)
    sections.push('')

    // Imports
    const imports: string[] = []
    if (colors.length > 0) imports.push('import androidx.compose.ui.graphics.Color')
    if (spacing.length > 0) imports.push('import androidx.compose.ui.unit.dp')
    if (typography.some(t => t.kind === 'sp')) imports.push('import androidx.compose.ui.unit.sp')

    if (imports.length > 0) {
        sections.push(...imports)
        sections.push('')
    }

    // Colors
    if (colors.length > 0) {
        sections.push('// -- Colors --')
        sections.push('')
        sections.push('object TokenColors {')
        for (const c of colors) {
            sections.push(`    val ${c.name} = Color(${c.argb})`)
        }
        sections.push('}')
        sections.push('')
    }

    // Spacing
    if (spacing.length > 0) {
        sections.push('// -- Spacing --')
        sections.push('')
        sections.push('object TokenSpacing {')
        for (const s of spacing) {
            sections.push(`    val ${s.name} = ${formatDpValue(s.value)}`)
        }
        sections.push('}')
        sections.push('')
    }

    // Typography
    if (typography.length > 0) {
        sections.push('// -- Typography --')
        sections.push('')
        sections.push('object TokenTypography {')
        for (const t of typography) {
            switch (t.kind) {
                case 'string':
                    sections.push(`    const val ${t.name} = "${escapeKotlinStringLiteral(String(t.value))}"`)
                    break
                case 'sp':
                    sections.push(`    val ${t.name} = ${formatSpValue(t.value as number)}`)
                    break
                case 'int':
                    sections.push(`    const val ${t.name} = ${t.value}`)
                    break
            }
        }
        sections.push('}')
        sections.push('')
    }

    // Opacity
    if (opacity.length > 0) {
        sections.push('// -- Opacity --')
        sections.push('')
        sections.push('object TokenOpacity {')
        for (const o of opacity) {
            sections.push(`    const val ${o.name} = ${o.value}f`)
        }
        sections.push('}')
        sections.push('')
    }

    return sections.join('\n')
}
