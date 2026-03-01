/**
 * Normalizer — electron/normalizer.ts
 *
 * Maps raw Figma Variables API payloads to the W3C DTCG token schema
 * that Bridge stores in the design_tokens SQLite table.
 *
 * All Figma-specific types are internal to this module. The public surface
 * exports only `normalizeFigmaVariables`.
 *
 * Main Process only — no imports from src/.
 *
 * Note: the parameter is typed as `unknown` (not `any`) per CLAUDE.md directive.
 * A structural type guard narrows it before any property access.
 *
 * v2: Iterates ALL modes in valuesByMode (not just defaultModeId), mapping
 * each Figma mode name to the `mode` column and the collection name to
 * `collection_name`. The UPSERT in main.ts makes re-ingestion idempotent.
 */

import type { NewDesignToken, TokenType } from './token-types.js'

// ── Internal Figma payload shapes ──────────────────────────────────────────────
// These mirror the Figma Variables REST API / Plugin API response (v1).
// Not exported — callers only interact with NewDesignToken[].

interface FigmaRGBA {
    r: number  // 0–1
    g: number  // 0–1
    b: number  // 0–1
    a: number  // 0–1
}

type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'

/** A raw variable value for a given mode — may be an alias reference object. */
type FigmaVariableValue = FigmaRGBA | number | string | boolean

interface FigmaVariable {
    id: string
    name: string                                        // e.g. "Brand/Primary"
    resolvedType: FigmaVariableType
    valuesByMode: Record<string, FigmaVariableValue>
    description?: string
    variableCollectionId: string
}

interface FigmaVariableCollection {
    id: string
    name: string                                        // e.g. "Color Tokens"
    defaultModeId: string
    variableIds: string[]
    /** Named modes within this collection, e.g. [{ modeId: '1:0', name: 'Light' }] */
    modes: Array<{ modeId: string; name: string }>
}

/** Top-level shape of the Figma Variables API response body. */
interface FigmaVariablesPayload {
    variables: Record<string, FigmaVariable>
    variableCollections: Record<string, FigmaVariableCollection>
}

// ── Type Guards ────────────────────────────────────────────────────────────────

/**
 * Shallow structural guard — validates the top-level shape without iterating
 * every variable (which could be thousands). Per-variable access is guarded
 * inside the normalizer body with `=== undefined` checks.
 */
function isFigmaVariablesPayload(p: unknown): p is FigmaVariablesPayload {
    if (typeof p !== 'object' || p === null) return false
    const obj = p as Record<string, unknown>
    return (
        typeof obj.variables === 'object' && obj.variables !== null &&
        typeof obj.variableCollections === 'object' && obj.variableCollections !== null
    )
}

/**
 * Distinguishes a Figma RGBA color object from an alias reference
 * (which looks like `{ type: 'VARIABLE_ALIAS', id: '...' }`).
 */
function isFigmaRGBA(v: unknown): v is FigmaRGBA {
    if (typeof v !== 'object' || v === null) return false
    const c = v as Record<string, unknown>
    return (
        typeof c.r === 'number' &&
        typeof c.g === 'number' &&
        typeof c.b === 'number' &&
        typeof c.a === 'number'
    )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Converts a Figma RGBA object (channels 0–1) to a CSS hex string.
 * Alpha is appended as two hex digits only when the color is not fully opaque.
 *
 * @example rgbaToHex({ r: 0.267, g: 0.463, b: 0.965, a: 1 }) → "#4476f6"
 */
function rgbaToHex(c: FigmaRGBA): string {
    const ch = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
    const hex = `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`
    return c.a < 1 ? hex + ch(c.a) : hex
}

/**
 * Maps a Figma resolvedType to the corresponding W3C DTCG $type.
 * The switch is exhaustive over FigmaVariableType — TypeScript will error
 * if a new Figma type is added without a corresponding case.
 */
function mapFigmaType(t: FigmaVariableType): TokenType {
    switch (t) {
        case 'COLOR':   return 'color'
        case 'FLOAT':   return 'dimension'
        case 'STRING':  return 'string'
        case 'BOOLEAN': return 'boolean'
    }
}

/**
 * Converts a raw Figma variable value to the string stored in `token_value`.
 * Returns `null` if the value is an unresolved alias reference or has an
 * unexpected shape — the caller skips `null` results.
 */
function serializeValue(value: FigmaVariableValue, type: FigmaVariableType): string | null {
    if (type === 'COLOR')   return isFigmaRGBA(value) ? rgbaToHex(value) : null
    if (type === 'FLOAT')   return typeof value === 'number' ? String(value) : null
    if (type === 'STRING')  return typeof value === 'string' ? value : null
    if (type === 'BOOLEAN') return typeof value === 'boolean' ? String(value) : null
    return null
}

/**
 * Constructs the Bridge `token_path` from a Figma collection name + variable name.
 *
 * Rules:
 *   - Collection name → lowercase, spaces → hyphens (e.g. "Color Tokens" → "color-tokens")
 *   - Variable name → lowercase, slashes → dots  (e.g. "Brand/Primary" → "brand.primary")
 *   - Combined: "<collection>.<variable>"  →  "color-tokens.brand.primary"
 */
function buildTokenPath(collectionName: string, variableName: string): string {
    const collection = collectionName.trim().toLowerCase().replace(/\s+/g, '-')
    const variable = variableName.trim().toLowerCase().replace(/\//g, '.')
    return `${collection}.${variable}`
}

/**
 * Resolves a Figma modeId to its human-readable name using the collection's
 * `modes` array. Falls back to the raw modeId string if the array is absent
 * or the modeId isn't found (defensive against older plugin payloads).
 */
function resolveModeNme(
    modeId: string,
    modes: FigmaVariableCollection['modes'] | undefined
): string {
    if (!Array.isArray(modes)) return modeId
    return modes.find((m) => m.modeId === modeId)?.name ?? modeId
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Converts a raw Figma Variables API payload to an array of `NewDesignToken`
 * objects ready for insertion into the `design_tokens` SQLite table.
 *
 * v2 behaviour:
 * - Iterates ALL modes in `variable.valuesByMode` (not only `defaultModeId`).
 * - Each (variable × mode) pair becomes one token row, enabling Light/Dark
 *   theming: the same `token_path` appears twice with `mode: "Light"` and
 *   `mode: "Dark"` respectively.
 * - The Figma collection name is stored verbatim in `collection_name`.
 * - The UPSERT in `tokens:create` makes repeated ingestion idempotent.
 *
 * Other behaviour:
 * - Returns `[]` if the payload fails the type guard.
 * - Skips values that are unresolved alias references (e.g. VARIABLE_ALIAS
 *   objects), identified by the `isFigmaRGBA` / type checks in serializeValue.
 *
 * @param figmaPayload - The raw, un-typed body from the Figma plugin or REST API.
 *                       Typed as `unknown` per the CLAUDE.md no-any directive.
 */
export function normalizeFigmaVariables(figmaPayload: unknown): NewDesignToken[] {
    if (!isFigmaVariablesPayload(figmaPayload)) {
        console.warn('[Bridge] normalizeFigmaVariables: payload failed type guard — skipping')
        return []
    }

    const tokens: NewDesignToken[] = []
    const { variables, variableCollections } = figmaPayload

    for (const collection of Object.values(variableCollections)) {
        for (const variableId of collection.variableIds) {
            const variable = variables[variableId]
            if (variable === undefined) continue

            // ── Iterate every mode, not just the default ──────────────────────
            for (const [modeId, rawValue] of Object.entries(variable.valuesByMode)) {
                const token_value = serializeValue(rawValue, variable.resolvedType)
                // Skip unresolved alias references (serializeValue returns null)
                if (token_value === null) continue

                // Resolve the human-readable mode name; fall back to modeId
                const mode = resolveModeNme(modeId, collection.modes)

                tokens.push({
                    token_path:      buildTokenPath(collection.name, variable.name),
                    token_type:      mapFigmaType(variable.resolvedType),
                    token_value,
                    mode,
                    collection_name: collection.name,
                    ...(variable.description ? { description: variable.description } : {}),
                })
            }
        }
    }

    console.log(
        `[Bridge] normalizeFigmaVariables: produced ${tokens.length} tokens` +
        ` (${Object.keys(variableCollections).length} collections)`
    )
    return tokens
}
