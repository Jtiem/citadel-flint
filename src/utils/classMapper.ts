/**
 * classMapper — src/utils/classMapper.ts
 *
 * Pure utility: maps design token paths to Tailwind class names.
 *
 * Token type → valid class prefixes (v2 — Enterprise Mithril):
 *   color        → bg-, text-, border-, fill-, stroke-
 *   dimension    → p-, px-, py-, pt-, pr-, pb-, pl-,
 *                  m-, mx-, my-, mt-, mr-, mb-, ml-,
 *                  gap-, space-x-, space-y-,
 *                  w-, h-, min-w-, min-h-, max-w-, max-h-,
 *                  rounded-, text- (font-size)
 *   fontFamily   → font-
 *   fontWeight   → font-
 *   lineHeight   → leading-
 *   letterSpacing → tracking-
 *   shadow       → shadow-
 *   opacity      → opacity-
 *
 * Path normalisation:
 *   The leading namespace segment is stripped when it matches the type's
 *   conventional strip set before joining with `-`:
 *     color.brand.primary   → 'brand-primary'
 *     spacing.md            → 'md'
 *     fontFamily.sans       → 'sans'
 *     shadow.card           → 'card'
 *
 * @example
 *   tokenToClass('color.brand.primary',  'color',    'bg-')       → 'bg-brand-primary'
 *   tokenToClass('spacing.md',           'dimension', 'p-')        → 'p-md'
 *   tokenToClass('fontFamily.sans',      'fontFamily','font-')     → 'font-sans'
 *   tokenToClass('fontWeight.bold',      'fontWeight','font-')     → 'font-bold'
 *   tokenToClass('lineHeight.normal',    'lineHeight','leading-')  → 'leading-normal'
 *   tokenToClass('letterSpacing.wide',   'letterSpacing','tracking-') → 'tracking-wide'
 *   tokenToClass('shadow.card',          'shadow',    'shadow-')   → 'shadow-card'
 *   tokenToClass('opacity.muted',        'opacity',   'opacity-')  → 'opacity-muted'
 */

import type { TokenType } from '../types/flint-api'

// ── Leading segments to strip per token type ──────────────────────────────────

const COLOR_STRIP = new Set(['color', 'colors'])
const DIM_STRIP = new Set(['spacing', 'dimension', 'dimensions'])
const FONT_FAMILY_STRIP = new Set(['fontFamily', 'font'])
const FONT_WEIGHT_STRIP = new Set(['fontWeight'])
const LINE_HEIGHT_STRIP = new Set(['lineHeight', 'leading'])
const LETTER_SPACING_STRIP = new Set(['letterSpacing', 'tracking'])
const SHADOW_STRIP = new Set(['shadow', 'boxShadow'])
const OPACITY_STRIP = new Set(['opacity'])

function getStripSet(tokenType: TokenType): ReadonlySet<string> | null {
    switch (tokenType) {
        case 'color': return COLOR_STRIP
        case 'dimension': return DIM_STRIP
        case 'fontFamily': return FONT_FAMILY_STRIP
        case 'fontWeight': return FONT_WEIGHT_STRIP
        case 'lineHeight': return LINE_HEIGHT_STRIP
        case 'letterSpacing': return LETTER_SPACING_STRIP
        case 'shadow': return SHADOW_STRIP
        case 'opacity': return OPACITY_STRIP
        default: return null
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Strips the conventional leading namespace segment from a token path and
 * joins the remaining parts with `-` to produce a Tailwind-safe suffix.
 */
export function normalizePath(tokenPath: string, tokenType: TokenType): string {
    const parts = tokenPath.split('.')
    const strip = getStripSet(tokenType)

    const effective =
        strip !== null && parts.length > 1 && strip.has(parts[0])
            ? parts.slice(1)
            : parts

    return effective.join('-')
}

/**
 * Derives the full Tailwind class string for a token + prefix pair.
 *
 * @param tokenPath   Dot-separated token path as stored in the DB.
 * @param tokenType   W3C DTCG token type.
 * @param classPrefix Tailwind class prefix (e.g. 'bg-', 'font-', 'shadow-').
 */
export function tokenToClass(
    tokenPath: string,
    tokenType: TokenType,
    classPrefix: string
): string {
    return classPrefix + normalizePath(tokenPath, tokenType)
}
