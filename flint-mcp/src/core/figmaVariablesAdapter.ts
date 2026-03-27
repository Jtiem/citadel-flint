/**
 * figmaVariablesAdapter.ts — flint-mcp/src/core/figmaVariablesAdapter.ts
 *
 * Converts raw Figma Variables API output (from `get_variable_defs`)
 * into Flint DesignToken[] format.
 *
 * Figma Variables are the authoritative token set when they exist in a
 * file. This adapter replaces heuristic extraction with deterministic
 * mapping, producing tokens that slot directly into the existing
 * flint_approve_tokens approval gateway.
 *
 * Commandment compliance:
 *   C1  — Pure data transformation. No writes.
 *   C2  — Returns proposals for human review via approval gateway.
 *   C4  — 100% local. No network calls.
 *   C9  — Not applicable (no drift detection — these are authoritative values).
 */

import type { DesignToken, TokenType } from '../types.js'

// ── Figma Variables API types ───────────────────────────────────────────────

export interface FigmaColor {
    r: number
    g: number
    b: number
    a: number
}

export interface FigmaVariable {
    id: string
    name: string
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
    valuesByMode: Record<string, unknown>
    scopes: string[]
    codeSyntax?: Record<string, string>
}

export interface FigmaVariableCollection {
    id: string
    name: string
    modes: Array<{ modeId: string; name: string }>
    variableIds: string[]
}

export interface FigmaVariablesResponse {
    variables: Record<string, FigmaVariable>
    variableCollections: Record<string, FigmaVariableCollection>
}

// ── Options ─────────────────────────────────────────────────────────────────

export interface ConvertOptions {
    /** If set, only extract tokens for this mode name. */
    modeFilter?: string
}

// ── Color conversion ────────────────────────────────────────────────────────

function clampByte(v: number): number {
    return Math.round(Math.max(0, Math.min(255, v * 255)))
}

/**
 * Convert Figma RGBA (0-1 float range) to 6-digit hex string.
 * Alpha is only appended when < 1.0.
 */
export function figmaRgbaToHex(color: FigmaColor): string {
    const r = clampByte(color.r)
    const g = clampByte(color.g)
    const b = clampByte(color.b)
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()

    if (typeof color.a === 'number' && color.a < 1.0) {
        const a = clampByte(color.a)
        return `${hex}${a.toString(16).padStart(2, '0').toUpperCase()}`
    }

    return hex
}

// ── Token path builder ──────────────────────────────────────────────────────

/**
 * Build a dot-separated token path from collection name + variable name.
 *
 * Examples:
 *   "Brand" / "Primary"         → "brand.primary"
 *   "Brand" / "Colors/Blue/500" → "brand.colors.blue.500"
 *   "Spacing" / "Gap/Small"     → "spacing.gap.small"
 */
export function buildTokenPath(collectionName: string, variableName: string): string {
    const sanitize = (s: string) =>
        s
            .replace(/\//g, '.')       // Figma uses / as group separator
            .replace(/\s+/g, '-')      // spaces to hyphens
            .replace(/[^a-zA-Z0-9.\-_]/g, '') // strip special chars
            .toLowerCase()

    const prefix = sanitize(collectionName)
    const suffix = sanitize(variableName)

    return `${prefix}.${suffix}`
}

// ── Type inference from scopes ──────────────────────────────────────────────

/**
 * Infer the Flint TokenType for a FLOAT variable based on its Figma scopes.
 * Figma scopes include: CORNER_RADIUS, WIDTH_HEIGHT, GAP, TEXT_CONTENT,
 * FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT, LETTER_SPACING, OPACITY, etc.
 */
function inferFloatTokenType(scopes: string[]): TokenType {
    const scopeSet = new Set(scopes.map(s => s.toUpperCase()))

    if (scopeSet.has('FONT_SIZE')) return 'dimension'
    if (scopeSet.has('FONT_WEIGHT')) return 'fontWeight'
    if (scopeSet.has('LINE_HEIGHT')) return 'lineHeight'
    if (scopeSet.has('LETTER_SPACING')) return 'letterSpacing'
    if (scopeSet.has('OPACITY')) return 'opacity'

    // All remaining FLOAT scopes map to dimension
    // (CORNER_RADIUS, WIDTH_HEIGHT, GAP, STROKE_FLOAT, etc.)
    return 'dimension'
}

// ── Alias detection ─────────────────────────────────────────────────────────

interface VariableAlias {
    type: 'VARIABLE_ALIAS'
    id: string
}

function isVariableAlias(value: unknown): value is VariableAlias {
    if (value === null || typeof value !== 'object') return false
    const obj = value as Record<string, unknown>
    return obj.type === 'VARIABLE_ALIAS' && typeof obj.id === 'string'
}

// ── Resolve a value (handling aliases) ──────────────────────────────────────

function resolveValue(
    value: unknown,
    resolvedType: FigmaVariable['resolvedType'],
    variables: Record<string, FigmaVariable>,
    modeId: string,
    visited: Set<string> = new Set(),
): unknown {
    // Handle alias chains (prevent infinite loops)
    if (isVariableAlias(value)) {
        if (visited.has(value.id)) return undefined
        visited.add(value.id)

        const aliasedVar = variables[value.id]
        if (!aliasedVar) return undefined

        const aliasedValue = aliasedVar.valuesByMode[modeId]
        if (aliasedValue === undefined) {
            // Try first available mode as fallback
            const firstModeValue = Object.values(aliasedVar.valuesByMode)[0]
            return resolveValue(firstModeValue, aliasedVar.resolvedType, variables, modeId, visited)
        }

        return resolveValue(aliasedValue, aliasedVar.resolvedType, variables, modeId, visited)
    }

    return value
}

// ── Convert a single value to string ────────────────────────────────────────

function valueToString(
    value: unknown,
    resolvedType: FigmaVariable['resolvedType'],
): string | null {
    if (value === undefined || value === null) return null

    switch (resolvedType) {
        case 'COLOR': {
            if (typeof value !== 'object') return null
            const color = value as FigmaColor
            if (typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') return null
            return figmaRgbaToHex({ r: color.r, g: color.g, b: color.b, a: color.a ?? 1 })
        }
        case 'FLOAT': {
            if (typeof value !== 'number') return null
            // Round to 2 decimal places to avoid floating-point noise
            return String(Math.round(value * 100) / 100)
        }
        case 'STRING': {
            if (typeof value !== 'string') return null
            return value
        }
        case 'BOOLEAN': {
            if (typeof value !== 'boolean') return null
            return String(value)
        }
        default:
            return null
    }
}

// ── Map Figma resolvedType to Flint TokenType ───────────────────────────────

function mapTokenType(
    resolvedType: FigmaVariable['resolvedType'],
    scopes: string[],
): TokenType {
    switch (resolvedType) {
        case 'COLOR':
            return 'color'
        case 'FLOAT':
            return inferFloatTokenType(scopes)
        case 'STRING':
            return 'string'
        case 'BOOLEAN':
            return 'boolean'
        default:
            return 'string'
    }
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Convert Figma Variables API response into Flint DesignToken[].
 *
 * Multi-mode handling:
 *   - If `options.modeFilter` is set, only that mode is extracted
 *   - Otherwise, first mode produces tokens without suffix,
 *     subsequent modes produce tokens with `.{mode-name}` suffix
 *   - Single-mode collections never get a suffix
 */
export function convertFigmaVariables(
    response: FigmaVariablesResponse,
    options: ConvertOptions = {},
): DesignToken[] {
    if (!response || !response.variables || !response.variableCollections) {
        return []
    }

    const { variables, variableCollections } = response
    const { modeFilter } = options

    // Build a lookup: variableId -> collection
    const varToCollection = new Map<string, FigmaVariableCollection>()
    for (const collection of Object.values(variableCollections)) {
        for (const varId of collection.variableIds) {
            varToCollection.set(varId, collection)
        }
    }

    const tokens: DesignToken[] = []
    let nextId = 1

    for (const [varId, variable] of Object.entries(variables)) {
        const collection = varToCollection.get(varId)
        if (!collection) continue

        const collectionName = collection.name
        const modes = collection.modes
        const isMultiMode = modes.length > 1

        // Determine which modes to process
        let modesToProcess = modes
        if (modeFilter) {
            const filtered = modes.filter(m => m.name.toLowerCase() === modeFilter.toLowerCase())
            if (filtered.length === 0) continue
            modesToProcess = filtered
        }

        for (let modeIdx = 0; modeIdx < modesToProcess.length; modeIdx++) {
            const mode = modesToProcess[modeIdx]
            const rawValue = variable.valuesByMode[mode.modeId]
            if (rawValue === undefined) continue

            // Resolve aliases
            const resolved = resolveValue(rawValue, variable.resolvedType, variables, mode.modeId)
            const strValue = valueToString(resolved, variable.resolvedType)
            if (strValue === null) continue

            // Build the token path
            let tokenPath = buildTokenPath(collectionName, variable.name)

            // Use codeSyntax CSS variable name if present (designer's intended name)
            if (variable.codeSyntax?.WEB) {
                const cssName = variable.codeSyntax.WEB
                    .replace(/^--/, '')       // strip leading --
                    .replace(/-/g, '.')       // hyphens to dots
                tokenPath = cssName
            }

            // Add mode suffix for multi-mode collections
            if (isMultiMode) {
                const modeName = mode.name.toLowerCase().replace(/\s+/g, '-')
                tokenPath = `${tokenPath}.${modeName}`
            }

            const tokenType = mapTokenType(variable.resolvedType, variable.scopes)

            tokens.push({
                id: nextId++,
                token_path: tokenPath,
                token_type: tokenType,
                token_value: strValue,
                description: `Figma Variable: ${collectionName}/${variable.name}${isMultiMode ? ` [${mode.name}]` : ''}`,
                collection_name: collectionName,
                mode: mode.name,
            })
        }
    }

    return tokens
}

// ── Stats helper ────────────────────────────────────────────────────────────

export interface VariableConversionStats {
    totalVariables: number
    totalTokens: number
    byType: Record<string, number>
    byCollection: Record<string, number>
    byMode: Record<string, number>
}

export function computeStats(tokens: DesignToken[]): VariableConversionStats {
    const byType: Record<string, number> = {}
    const byCollection: Record<string, number> = {}
    const byMode: Record<string, number> = {}

    for (const token of tokens) {
        byType[token.token_type] = (byType[token.token_type] ?? 0) + 1
        byCollection[token.collection_name] = (byCollection[token.collection_name] ?? 0) + 1
        byMode[token.mode] = (byMode[token.mode] ?? 0) + 1
    }

    return {
        totalVariables: new Set(tokens.map(t => {
            // Strip mode suffix to count unique variables
            const desc = t.description ?? ''
            const match = desc.match(/Figma Variable: (.+?)(?:\s*\[.+\])?$/)
            return match ? match[1] : t.token_path
        })).size,
        totalTokens: tokens.length,
        byType,
        byCollection,
        byMode,
    }
}
