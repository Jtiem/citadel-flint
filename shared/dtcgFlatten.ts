/**
 * dtcgFlatten — convert a W3C Design Token Community Group JSON tree into a
 * flat `NewDesignToken[]` payload suitable for the Flint token store.
 *
 * Path convention: nested keys join with `/` (e.g. `color.primary` → `color/primary`).
 * `generateTokenCssVars` in src/utils/tokenAdapter.ts converts `/` → `-` to
 * produce CSS custom property names (`--color-primary`).
 *
 * Shared between Electron main, Web server, and Glass renderer to guarantee
 * one parser / one shape across the process boundary.
 */

export type FlatToken = {
    token_path: string
    token_type: TokenType
    token_value: string
    description?: string
}

export type TokenType =
    | 'color'
    | 'dimension'
    | 'fontFamily'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'shadow'
    | 'opacity'
    | 'string'
    | 'boolean'

const DTCG_TYPES: ReadonlySet<string> = new Set([
    'color',
    'dimension',
    'fontFamily',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'shadow',
    'opacity',
    'string',
    'boolean',
    'number',
    'duration',
])

/**
 * Walks the DTCG tree, returning every leaf with `$value`. Skips `$schema`,
 * `$description` at the root, prototype-pollution keys, and malformed nodes.
 */
export function flattenDtcg(json: unknown): FlatToken[] {
    if (!json || typeof json !== 'object') return []
    const tokens: FlatToken[] = []
    walk(json as Record<string, unknown>, '', tokens)
    return tokens
}

function walk(node: Record<string, unknown>, prefix: string, out: FlatToken[]): void {
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
        if (!value || typeof value !== 'object') continue

        const nested = value as Record<string, unknown>
        const path = prefix ? `${prefix}/${key}` : key

        if ('$value' in nested) {
            const rawValue = nested.$value
            if (rawValue == null) continue
            const stringValue = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue)
            const type = normalizeType(nested.$type)
            const description = typeof nested.$description === 'string' ? nested.$description : undefined
            out.push({
                token_path: path,
                token_type: type,
                token_value: stringValue,
                ...(description ? { description } : {}),
            })
        } else {
            walk(nested, path, out)
        }
    }
}

function normalizeType(raw: unknown): TokenType {
    if (typeof raw !== 'string') return 'string'
    if (DTCG_TYPES.has(raw)) {
        if (raw === 'number' || raw === 'duration') return 'string'
        return raw as TokenType
    }
    return 'string'
}
