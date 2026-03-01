/**
 * tokenAdapter — src/utils/tokenAdapter.ts
 *
 * Converts a flat DesignToken array into a Tailwind CDN config JSON string
 * suitable for injection into a `srcdoc` iframe preview.
 *
 * Mapping rules:
 *   - color tokens   → theme.extend.colors
 *     A leading 'color' or 'colors' segment in token_path is stripped so that
 *     `color.brand.primary` → colors.brand.primary (class: bg-brand-primary).
 *   - dimension tokens → theme.extend.spacing
 *     A leading 'spacing' segment is stripped so that
 *     `spacing.md` → spacing.md (class: p-md / m-md).
 *   - All other types are ignored (no natural Tailwind mapping).
 *
 * Token paths use dot notation as stored by tokenStore / flattenDTCG.
 */

import type { DesignToken } from '../types/bridge-api'

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

/**
 * Builds a Tailwind-compatible config JSON string from a DesignToken array.
 *
 * The returned string is suitable for direct injection as:
 *   `tailwind.config = ${generateTailwindConfig(tokens)};`
 *
 * @example
 *   // token: { token_path: 'color.brand.primary', token_value: '#0066ff', token_type: 'color' }
 *   // → class bg-brand-primary resolves to background-color: #0066ff
 */
export function generateTailwindConfig(tokens: DesignToken[]): string {
    const colors: NestedRecord = {}
    const spacing: NestedRecord = {}

    for (const token of tokens) {
        const parts = token.token_path.split('.')
        if (parts.length === 0) continue

        if (token.token_type === 'color') {
            // Strip conventional leading 'color' / 'colors' namespace segment.
            const pathParts =
                parts[0] === 'color' || parts[0] === 'colors' ? parts.slice(1) : parts
            if (pathParts.length > 0) {
                setNestedPath(colors, pathParts, token.token_value)
            }
        } else if (token.token_type === 'dimension') {
            // Strip conventional leading 'spacing' segment.
            const pathParts = parts[0] === 'spacing' ? parts.slice(1) : parts
            if (pathParts.length > 0) {
                setNestedPath(spacing, pathParts, token.token_value)
            }
        }
    }

    const extend: Record<string, unknown> = {}
    if (Object.keys(colors).length > 0) extend.colors = colors
    if (Object.keys(spacing).length > 0) extend.spacing = spacing

    return JSON.stringify({ theme: { extend } })
}
