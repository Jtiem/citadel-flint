/**
 * cssCustomPropertyMap.ts — flint-mcp/src/core/cssCustomPropertyMap.ts
 *
 * Phase 2: Project-wide CSS custom property resolver.
 *
 * Merges `:root` custom property declarations across multiple parsed
 * stylesheets into a single flat map, and resolves `var(--x, fallback)` chains.
 *
 * Rules:
 *   - Last-import wins on duplicate keys (matches CSS cascade order)
 *   - var() chains are walked recursively with a visited-set to prevent cycles
 *   - Cyclic references return null (no infinite loop)
 *   - ok: false stylesheets are silently skipped
 *
 * Contract: PHASE2-postcss-css-modules.contract.ts
 */

import type { ParsedStylesheet } from './cssStylesheetLoader.js'

// ── Public types ─────────────────────────────────────────────────────────────

export interface CustomPropertyMap {
    /** Flat resolved map. Readonly for consumers. */
    readonly map: ReadonlyMap<string, string>
    /**
     * Resolve a `var(--x)` expression (with or without fallback) against the map.
     * Returns null when nothing resolves.
     */
    resolve(varExpression: string): string | null
    /** Origin stylesheet paths that contributed declarations (for diagnostics). */
    readonly sourcePaths: readonly string[]
}

export interface CustomPropertyMapInput {
    /** Parsed stylesheets in import order (earlier = lower precedence, last wins). */
    stylesheets: readonly ParsedStylesheet[]
}

// ── var() expression parser ──────────────────────────────────────────────────

interface VarExpression {
    type: 'var'
    name: string
    fallback: ParsedVarValue | null
}

interface LiteralValue {
    type: 'literal'
    value: string
}

type ParsedVarValue = VarExpression | LiteralValue

/**
 * Parse the inner content of a `var(...)` call.
 * Handles nested `var()` in the fallback position.
 *
 * Input: the content INSIDE the outermost `var(...)` — i.e., `--primary` or
 *        `--primary, var(--brand, #0066cc)`.
 */
function parseVarContent(inner: string): VarExpression | null {
    inner = inner.trim()
    if (!inner.startsWith('--')) return null

    // Find the first top-level comma (not inside nested parens)
    let depth = 0
    let commaIndex = -1
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i]
        if (ch === '(') depth++
        else if (ch === ')') depth--
        else if (ch === ',' && depth === 0) {
            commaIndex = i
            break
        }
    }

    if (commaIndex === -1) {
        // No fallback
        return { type: 'var', name: inner.trim(), fallback: null }
    }

    const name = inner.slice(0, commaIndex).trim()
    const fallbackStr = inner.slice(commaIndex + 1).trim()
    const fallback = parseSingleValue(fallbackStr)

    return { type: 'var', name, fallback }
}

/**
 * Parse a single value string — either a `var(...)` or a literal.
 */
function parseSingleValue(value: string): ParsedVarValue {
    const trimmed = value.trim()
    if (trimmed.startsWith('var(') && trimmed.endsWith(')')) {
        const inner = trimmed.slice(4, -1)
        const parsed = parseVarContent(inner)
        if (parsed !== null) return parsed
    }
    return { type: 'literal', value: trimmed }
}

/**
 * Resolve a `ParsedVarValue` against the map.
 * Uses `visited` to prevent infinite loops on cyclic references.
 */
function resolveValue(
    parsed: ParsedVarValue,
    map: ReadonlyMap<string, string>,
    visited: Set<string>,
): string | null {
    if (parsed.type === 'literal') {
        return parsed.value || null
    }

    // It's a var() reference
    const name = parsed.name
    if (visited.has(name)) {
        // Cycle detected — terminate
        return null
    }

    visited.add(name)
    const mapValue = map.get(name)

    if (mapValue !== undefined) {
        // The property exists in the map — its value may itself be a var()
        const nested = parseSingleValue(mapValue)
        const resolved = resolveValue(nested, map, visited)
        // If the map value itself is unresolvable, don't fall through to fallback
        // (the property IS declared, just with an unresolvable value)
        return resolved
    }

    // Not in map — try fallback
    if (parsed.fallback !== null) {
        return resolveValue(parsed.fallback, map, new Set(visited))
    }

    return null
}

// ── Public builder ────────────────────────────────────────────────────────────

/**
 * Merge `:root` declarations across stylesheets into a single map.
 * Last-import wins on duplicate keys (matches CSS cascade behavior).
 * Skips `ok: false` stylesheets silently.
 */
export function buildCustomPropertyMap(
    stylesheets: ReadonlyArray<ParsedStylesheet | { ok: false }>,
): CustomPropertyMap {
    const merged = new Map<string, string>()
    const sourcePaths: string[] = []

    for (const ss of stylesheets) {
        // The input can be either a ParsedStylesheet directly, or we accept
        // StylesheetLoadResult items too (with ok field). Handle both.
        const sheet = ss as ParsedStylesheet & { ok?: boolean }
        if ('ok' in sheet && sheet.ok === false) continue

        // It's a ParsedStylesheet
        if (sheet.sourcePath !== undefined && !sourcePaths.includes(sheet.sourcePath)) {
            sourcePaths.push(sheet.sourcePath)
        }
        for (const decl of sheet.customProperties ?? []) {
            merged.set(decl.name, decl.value)
        }
    }

    const frozenMap: ReadonlyMap<string, string> = merged

    return {
        map: frozenMap,
        sourcePaths,
        resolve(varExpression: string): string | null {
            const trimmed = varExpression.trim()
            // Accept either `var(--x, ...)` or bare `--x`
            let parsed: ParsedVarValue
            if (trimmed.startsWith('var(') && trimmed.endsWith(')')) {
                parsed = parseSingleValue(trimmed)
            } else if (trimmed.startsWith('--')) {
                // Bare property name
                parsed = { type: 'var', name: trimmed, fallback: null }
            } else {
                // Already a literal
                return trimmed || null
            }
            return resolveValue(parsed, frozenMap, new Set())
        },
    }
}

// ── Convenience standalone functions (for callers that prefer functions) ──────

/**
 * Build a project-wide custom property map from a list of parsed stylesheets.
 * Skips any stylesheets wrapped in `{ ok: false }` shells.
 *
 * This overload accepts `ParsedStylesheet[]` directly (the common case).
 */
export function buildCustomPropertyMapFromSheets(
    stylesheets: readonly ParsedStylesheet[],
): CustomPropertyMap {
    return buildCustomPropertyMap(stylesheets)
}

/**
 * Resolve a `var(--x, fallback)` expression against a custom property map.
 *
 * Convenience function for callers that have a raw `Map<string, string>` rather
 * than a `CustomPropertyMap` object.
 */
export function resolveCssVar(
    expression: string,
    map: Map<string, string> | ReadonlyMap<string, string>,
): string | null {
    const tempMap = buildCustomPropertyMap(
        // Convert the raw map into a synthetic ParsedStylesheet
        [{
            sourcePath: '__synthetic__',
            syntax: 'css',
            mtimeMs: 0,
            customProperties: Array.from(map.entries()).map(([name, value]) => ({
                name,
                value,
                selector: ':root',
                line: 0,
            })),
            themeBlocks: [],
            keyframes: [],
            applyDirectives: [],
        }],
    )
    return tempMap.resolve(expression)
}
