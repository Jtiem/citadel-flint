/**
 * tokenAdapter — src/utils/tokenAdapter.ts
 *
 * Converts a flat DesignToken array into a Tailwind CDN config JSON string
 * suitable for injection into a `srcdoc` iframe preview.
 *
 * Mapping rules (v2 — Enterprise Mithril):
 *   - color       → theme.extend.colors
 *   - dimension   → theme.extend.spacing  (also font-size via text- prefix)
 *   - fontFamily  → theme.extend.fontFamily
 *   - fontWeight  → theme.extend.fontWeight
 *   - lineHeight  → theme.extend.lineHeight
 *   - letterSpacing → theme.extend.letterSpacing
 *   - shadow      → theme.extend.boxShadow
 *   - opacity     → theme.extend.opacity
 *   - string / boolean → ignored (no natural Tailwind mapping)
 *
 * Leading namespace segments are stripped per type:
 *   color.*          → strip 'color'/'colors'
 *   dimension.*      → strip 'spacing'/'dimension'
 *   fontFamily.*     → strip 'fontFamily'/'font'
 *   fontWeight.*     → strip 'fontWeight'
 *   lineHeight.*     → strip 'lineHeight'/'leading'
 *   letterSpacing.*  → strip 'letterSpacing'/'tracking'
 *   shadow.*         → strip 'shadow'/'boxShadow'
 *   opacity.*        → strip 'opacity'
 */

import type { DesignToken } from '../types/flint-api'

/** Recursive nested string map used to build Tailwind theme extension objects. */
type NestedRecord = { [key: string]: string | NestedRecord }

/**
 * Writes `value` at the nested path described by `parts` inside `obj`.
 * Intermediate objects are created as needed.
 */
function setNestedPath(obj: NestedRecord, parts: string[], value: string): void {
    let current: NestedRecord = obj
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]
        if (typeof current[key] !== 'object' || current[key] === null) {
            current[key] = {}
        }
        current = current[key] as NestedRecord
    }
    const last = parts[parts.length - 1]
    if (last !== undefined) {
        current[last] = value
    }
}

/** Strip a conventional leading namespace segment from a dot-separated path. */
function stripLeading(parts: string[], stripSet: ReadonlySet<string>): string[] {
    return parts.length > 1 && stripSet.has(parts[0]) ? parts.slice(1) : parts
}

const COLOR_STRIP = new Set(['color', 'colors'])
const DIM_STRIP = new Set(['spacing', 'dimension', 'dimensions'])
const FONT_FAMILY_STRIP = new Set(['fontFamily', 'font'])
const FONT_WEIGHT_STRIP = new Set(['fontWeight'])
const LINE_HEIGHT_STRIP = new Set(['lineHeight', 'leading'])
const LETTER_SPACE_STRIP = new Set(['letterSpacing', 'tracking'])
const SHADOW_STRIP = new Set(['shadow', 'boxShadow'])
const OPACITY_STRIP = new Set(['opacity'])

/**
 * Builds a Tailwind-compatible config JSON string from a DesignToken array.
 *
 * The returned string is suitable for direct injection as:
 *   `tailwind.config = ${generateTailwindConfig(tokens)};`
 */
export function generateTailwindConfig(tokens: DesignToken[]): string {
    const colors: NestedRecord = {}
    const spacing: NestedRecord = {}
    const fontFamily: NestedRecord = {}
    const fontWeight: NestedRecord = {}
    const lineHeight: NestedRecord = {}
    const letterSpacing: NestedRecord = {}
    const boxShadow: NestedRecord = {}
    const opacity: NestedRecord = {}

    for (const token of tokens) {
        const parts = token.token_path.split('.')
        if (parts.length === 0) continue

        switch (token.token_type) {
            case 'color': {
                const p = stripLeading(parts, COLOR_STRIP)
                if (p.length > 0) setNestedPath(colors, p, token.token_value)
                break
            }
            case 'dimension': {
                const p = stripLeading(parts, DIM_STRIP)
                if (p.length > 0) setNestedPath(spacing, p, token.token_value)
                break
            }
            case 'fontFamily': {
                const p = stripLeading(parts, FONT_FAMILY_STRIP)
                if (p.length > 0) setNestedPath(fontFamily, p, token.token_value)
                break
            }
            case 'fontWeight': {
                const p = stripLeading(parts, FONT_WEIGHT_STRIP)
                if (p.length > 0) setNestedPath(fontWeight, p, token.token_value)
                break
            }
            case 'lineHeight': {
                const p = stripLeading(parts, LINE_HEIGHT_STRIP)
                if (p.length > 0) setNestedPath(lineHeight, p, token.token_value)
                break
            }
            case 'letterSpacing': {
                const p = stripLeading(parts, LETTER_SPACE_STRIP)
                if (p.length > 0) setNestedPath(letterSpacing, p, token.token_value)
                break
            }
            case 'shadow': {
                const p = stripLeading(parts, SHADOW_STRIP)
                if (p.length > 0) setNestedPath(boxShadow, p, token.token_value)
                break
            }
            case 'opacity': {
                const p = stripLeading(parts, OPACITY_STRIP)
                if (p.length > 0) setNestedPath(opacity, p, token.token_value)
                break
            }
            default:
                // 'string' | 'boolean' — no Tailwind mapping
                break
        }
    }

    const extend: Record<string, unknown> = {}
    if (Object.keys(colors).length > 0) extend.colors = colors
    if (Object.keys(spacing).length > 0) extend.spacing = spacing
    if (Object.keys(fontFamily).length > 0) extend.fontFamily = fontFamily
    if (Object.keys(fontWeight).length > 0) extend.fontWeight = fontWeight
    if (Object.keys(lineHeight).length > 0) extend.lineHeight = lineHeight
    if (Object.keys(letterSpacing).length > 0) extend.letterSpacing = letterSpacing
    if (Object.keys(boxShadow).length > 0) extend.boxShadow = boxShadow
    if (Object.keys(opacity).length > 0) extend.opacity = opacity

    return JSON.stringify({ theme: { extend } })
}
