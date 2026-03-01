/**
 * classMapper — src/utils/classMapper.ts
 *
 * Pure utility: maps design token paths to Tailwind class names.
 *
 * Token type → valid class prefixes:
 *   color     → bg-, text-, border-
 *   dimension → p-, m-, w-, h-, rounded-, text- (font-size)
 *
 * Path normalisation:
 *   Leading namespace segments are stripped before joining with `-`:
 *     color / colors   → stripped for color tokens
 *     spacing / dimension / dimensions → stripped for dimension tokens
 *
 * @example
 *   tokenToClass('color.brand.primary', 'color', 'bg-')      → 'bg-brand-primary'
 *   tokenToClass('color.brand.primary', 'color', 'text-')    → 'text-brand-primary'
 *   tokenToClass('color.brand.primary', 'color', 'border-')  → 'border-brand-primary'
 *   tokenToClass('spacing.md', 'dimension', 'p-')            → 'p-md'
 *   tokenToClass('spacing.md', 'dimension', 'w-')            → 'w-md'
 *   tokenToClass('spacing.md', 'dimension', 'h-')            → 'h-md'
 */

import type { TokenType } from '../types/bridge-api'

// Leading path segments that are stripped before producing a Tailwind suffix.
const COLOR_STRIP = new Set(['color', 'colors'])
const DIM_STRIP = new Set(['spacing', 'dimension', 'dimensions'])

/**
 * Strips the conventional leading namespace segment from a token path and
 * joins the remaining parts with `-` to produce a Tailwind-safe suffix.
 *
 * @example
 *   normalizePath('color.brand.primary', 'color') → 'brand-primary'
 *   normalizePath('spacing.md', 'dimension')      → 'md'
 *   normalizePath('brand.primary', 'color')       → 'brand-primary'  // no strip needed
 */
export function normalizePath(tokenPath: string, tokenType: TokenType): string {
    const parts = tokenPath.split('.')
    const strip =
        tokenType === 'color'
            ? COLOR_STRIP
            : tokenType === 'dimension'
              ? DIM_STRIP
              : null

    const effective =
        strip !== null && parts.length > 1 && strip.has(parts[0])
            ? parts.slice(1)
            : parts

    return effective.join('-')
}

/**
 * Derives the full Tailwind class string for a token + prefix pair.
 *
 * @param tokenPath   Dot-separated token path as stored in the DB (e.g. 'color.brand.primary').
 * @param tokenType   W3C DTCG token type ('color' | 'dimension' | ...).
 * @param classPrefix Tailwind class prefix (e.g. 'bg-', 'text-', 'border-', 'w-', 'h-').
 */
export function tokenToClass(
    tokenPath: string,
    tokenType: TokenType,
    classPrefix: string
): string {
    return classPrefix + normalizePath(tokenPath, tokenType)
}
