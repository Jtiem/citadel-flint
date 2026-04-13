/**
 * tokenImporter.ts — flint-mcp/src/core/tokenImporter.ts
 *
 * Normalizes design tokens from JS, JSON, and CSS Custom Property formats
 * into W3C DTCG format (token tree with $type / $value leaf objects).
 *
 * Security: NO eval() or new Function(). JS files are parsed with regex-based
 * comment stripping, trailing-comma removal, and unquoted-key quoting before
 * JSON.parse(). This is safe for source-of-truth token files, not arbitrary JS.
 *
 * Value classification rules:
 *   color      — string starting with # (3–8 hex chars after #)
 *   dimension  — string matching /^\d+(\.\d+)?(rem|px|em)$/
 *   fontFamily — string containing commas or font-family keywords
 *   fontWeight — number 100–900 divisible by 100, or numeric string of same
 *   shadow     — string matching box-shadow pattern (Npx Npx Npx Npx #...)
 *   lineHeight — unitless number 0–3 (float or integer string)
 *   transition — string like "all 0.1s ease-in-out" (custom DTCG extension)
 *   (everything else is skipped with a warning path recorded)
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ImportResult {
    /** DTCG-format token tree: leaves are { $type, $value } objects */
    tokens: Record<string, unknown>
    summary: {
        imported: number
        by_type: Record<string, number>
        /** Dot-path strings that could not be classified */
        skipped: string[]
    }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Read a token file, detect its format, and return a normalised DTCG tree.
 *
 * @param filePath    Absolute or project-root-relative path to token file
 * @param projectRoot Absolute path to project root (used for relative resolution)
 */
export function importTokensFromFile(filePath: string, projectRoot: string): ImportResult {
    const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(projectRoot, filePath)

    if (!fs.existsSync(resolved)) {
        throw new Error(`Token file not found: ${resolved}`)
    }

    const content = fs.readFileSync(resolved, 'utf-8')
    const ext = path.extname(resolved).toLowerCase()

    if (ext === '.css') {
        return importFromCSS(content)
    }

    if (ext === '.json') {
        return importFromJSON(content)
    }

    // .js, .mjs, .ts, .cjs — treat as JS object literal
    return importFromJS(content)
}

// ---------------------------------------------------------------------------
// Format A: JavaScript object literal
// ---------------------------------------------------------------------------

/**
 * Strip JS-module boilerplate and comments, then parse as a JSON5-like object.
 * Does NOT use eval() or new Function(). Safe for trusted token files.
 */
export function importFromJS(source: string): ImportResult {
    // 1. Remove export declarations
    let cleaned = source
        .replace(/^\s*export\s+(default\s+)?const\s+\w+\s*=\s*/m, '')
        .replace(/^\s*module\.exports\s*=\s*/m, '')
        .replace(/^\s*export\s+default\s+/m, '')

    // 2. Strip single-line comments (// ...) — but NOT inside strings
    //    Simple approach: remove // to end of line when not preceded by : or url pattern
    cleaned = stripLineComments(cleaned)

    // 3. Strip block comments (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

    // 4. Remove trailing semicolons at end of file
    cleaned = cleaned.trimEnd().replace(/;$/, '').trimEnd()

    // 5. Fix unquoted object keys (e.g.  vibrant: → "vibrant":)
    cleaned = quoteUnquotedKeys(cleaned)

    // 6. Convert single-quoted string values to double-quoted
    cleaned = convertSingleToDoubleQuotes(cleaned)

    // 7. Fix trailing commas before } or ]
    cleaned = removeTrailingCommas(cleaned)

    // 7. Parse
    let obj: unknown
    try {
        obj = JSON.parse(cleaned)
    } catch (err) {
        throw new Error(
            `Failed to parse JS token file as JSON: ${err instanceof Error ? err.message : String(err)}\n` +
            `Cleaned source (first 400 chars):\n${cleaned.slice(0, 400)}`
        )
    }

    return walkObject(obj as Record<string, unknown>, [])
}

// ---------------------------------------------------------------------------
// Format B: JSON (non-DTCG or already DTCG)
// ---------------------------------------------------------------------------

export function importFromJSON(source: string): ImportResult {
    let obj: unknown
    try {
        obj = JSON.parse(source)
    } catch (err) {
        throw new Error(`Failed to parse JSON token file: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Detect DTCG passthrough: if ANY leaf has $type, treat as pre-formatted
    if (isDTCG(obj)) {
        return { tokens: obj as Record<string, unknown>, summary: countDTCG(obj as Record<string, unknown>) }
    }

    return walkObject(obj as Record<string, unknown>, [])
}

// ---------------------------------------------------------------------------
// Format C: CSS Custom Properties
// ---------------------------------------------------------------------------

export function importFromCSS(source: string): ImportResult {
    // Match `--token-name: value;` declarations
    const decl = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi
    const rawTokens: Array<{ dotPath: string; value: string }> = []

    let match: RegExpExecArray | null
    while ((match = decl.exec(source)) !== null) {
        const name = match[1].trim()
        const value = match[2].trim()
        // Convert kebab-case to dot-path: color-brand-primary → color.brand.primary
        const dotPath = name.replace(/-/g, '.')
        rawTokens.push({ dotPath, value })
    }

    const result: ImportResult = {
        tokens: {},
        summary: { imported: 0, by_type: {}, skipped: [] },
    }

    for (const { dotPath, value } of rawTokens) {
        const classified = classifyValue(value, dotPath)
        if (classified === null) {
            result.summary.skipped.push(dotPath)
            continue
        }
        setNestedPath(result.tokens, dotPath, classified.dtcg)
        result.summary.imported++
        result.summary.by_type[classified.type] = (result.summary.by_type[classified.type] ?? 0) + 1
    }

    return result
}

// ---------------------------------------------------------------------------
// Object walker — shared by JS and plain-JSON formats
// ---------------------------------------------------------------------------

function walkObject(
    obj: Record<string, unknown>,
    pathParts: string[],
): ImportResult {
    const result: ImportResult = {
        tokens: {},
        summary: { imported: 0, by_type: {}, skipped: [] },
    }

    walkNode(obj, pathParts, result)
    return result
}

function walkNode(
    node: unknown,
    pathParts: string[],
    acc: ImportResult,
): void {
    if (node === null || node === undefined) return

    // Leaf: string value
    if (typeof node === 'string') {
        const dotPath = pathParts.join('.')
        const classified = classifyValue(node, dotPath)
        if (classified === null) {
            acc.summary.skipped.push(dotPath)
            return
        }
        setNestedPath(acc.tokens, dotPath, classified.dtcg)
        acc.summary.imported++
        acc.summary.by_type[classified.type] = (acc.summary.by_type[classified.type] ?? 0) + 1
        return
    }

    // Leaf: number value
    if (typeof node === 'number') {
        const dotPath = pathParts.join('.')
        const classified = classifyNumber(node, dotPath)
        if (classified === null) {
            acc.summary.skipped.push(dotPath)
            return
        }
        setNestedPath(acc.tokens, dotPath, classified.dtcg)
        acc.summary.imported++
        acc.summary.by_type[classified.type] = (acc.summary.by_type[classified.type] ?? 0) + 1
        return
    }

    // Object: recurse into children
    if (typeof node === 'object' && !Array.isArray(node)) {
        for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
            walkNode(child, [...pathParts, key], acc)
        }
        return
    }

    // Arrays and booleans — skip
    if (pathParts.length > 0) {
        acc.summary.skipped.push(pathParts.join('.'))
    }
}

// ---------------------------------------------------------------------------
// Value classification
// ---------------------------------------------------------------------------

interface Classified {
    type: string
    dtcg: { $type: string; $value: unknown }
}

function classifyValue(value: string, dotPath: string): Classified | null {
    const v = value.trim()

    // Color: starts with # followed by 3–8 hex chars
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
        return { type: 'color', dtcg: { $type: 'color', $value: v } }
    }

    // Dimension: number + rem/px/em
    if (/^\d+(\.\d+)?(rem|px|em)$/.test(v)) {
        return { type: 'dimension', dtcg: { $type: 'dimension', $value: v } }
    }

    // Shadow: box-shadow pattern — at minimum "Npx Npx" followed by more parts + a color-ish value
    // Pattern: <offset-x> <offset-y> [blur] [spread] [color]
    if (/^-?\d+px\s+-?\d+px/.test(v)) {
        return { type: 'shadow', dtcg: { $type: 'shadow', $value: v } }
    }

    // FontFamily: contains comma and looks like font name list, not a CSS function call.
    // Font family strings: "Space Grotesk", Helvetica, sans-serif — commas between names,
    // optionally quoted, no parentheses (which would indicate CSS functions like clamp()).
    if (v.includes(',') && !v.includes('(') && /["']?\s*[a-zA-Z]/.test(v)) {
        return { type: 'fontFamily', dtcg: { $type: 'fontFamily', $value: v } }
    }

    // FontWeight as string: "400", "700", etc.
    const fwNum = Number(v)
    if (!isNaN(fwNum) && isFontWeight(fwNum)) {
        return { type: 'fontWeight', dtcg: { $type: 'fontWeight', $value: fwNum } }
    }

    // LineHeight as unitless string: "1", "1.5", "2.0"
    const lhNum = Number(v)
    if (!isNaN(lhNum) && lhNum >= 0 && lhNum <= 3 && v !== '') {
        return { type: 'lineHeight', dtcg: { $type: 'lineHeight', $value: lhNum } }
    }

    // Transition: "all Xs ease-in-out" or similar patterns
    if (/^(all|none|[\w-]+)\s+\d+(\.\d+)?s\s+/.test(v)) {
        return { type: 'transition', dtcg: { $type: 'transition', $value: v } }
    }

    // Could not classify — path key hint for context (caller logs to skipped)
    void dotPath
    return null
}

function classifyNumber(value: number, _dotPath: string): Classified | null {
    if (isFontWeight(value)) {
        return { type: 'fontWeight', dtcg: { $type: 'fontWeight', $value: value } }
    }
    if (value >= 0 && value <= 3) {
        return { type: 'lineHeight', dtcg: { $type: 'lineHeight', $value: value } }
    }
    return null
}

function isFontWeight(n: number): boolean {
    return Number.isInteger(n) && n >= 100 && n <= 900 && n % 100 === 0
}

// ---------------------------------------------------------------------------
// DTCG detection
// ---------------------------------------------------------------------------

function isDTCG(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) return false
    return hasDTCGLeaf(obj as Record<string, unknown>)
}

function hasDTCGLeaf(node: Record<string, unknown>): boolean {
    for (const [key, val] of Object.entries(node)) {
        if (key === '$type') return true
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            if (hasDTCGLeaf(val as Record<string, unknown>)) return true
        }
    }
    return false
}

function countDTCG(tree: Record<string, unknown>): ImportResult['summary'] {
    const summary: ImportResult['summary'] = { imported: 0, by_type: {}, skipped: [] }
    countDTCGNode(tree, summary)
    return summary
}

function countDTCGNode(node: Record<string, unknown>, summary: ImportResult['summary']): void {
    if ('$type' in node && '$value' in node) {
        const t = String(node['$type'])
        summary.imported++
        summary.by_type[t] = (summary.by_type[t] ?? 0) + 1
        return
    }
    for (const val of Object.values(node)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            countDTCGNode(val as Record<string, unknown>, summary)
        }
    }
}

// ---------------------------------------------------------------------------
// Deep merge helpers
// ---------------------------------------------------------------------------

/**
 * Deep-merge `incoming` into `base`. When a leaf path exists in both,
 * the `base` value wins (preserve-existing semantics).
 */
export function deepMergePreserve(
    base: Record<string, unknown>,
    incoming: Record<string, unknown>,
): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base }
    for (const [key, incomingVal] of Object.entries(incoming)) {
        const baseVal = result[key]
        if (
            typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal) &&
            typeof incomingVal === 'object' && incomingVal !== null && !Array.isArray(incomingVal)
        ) {
            result[key] = deepMergePreserve(
                baseVal as Record<string, unknown>,
                incomingVal as Record<string, unknown>,
            )
        } else if (baseVal === undefined) {
            // Only set if not already present
            result[key] = incomingVal
        }
        // else: base wins, do nothing
    }
    return result
}

/**
 * Count the number of leaf nodes (DTCG tokens) added by `incoming` that were
 * not already in `base` — for conflict reporting.
 */
export function countConflicts(
    base: Record<string, unknown>,
    incoming: Record<string, unknown>,
): number {
    let count = 0
    for (const [key, incomingVal] of Object.entries(incoming)) {
        const baseVal = base[key]
        if (typeof incomingVal === 'object' && incomingVal !== null && !Array.isArray(incomingVal)) {
            if ('$type' in (incomingVal as Record<string, unknown>)) {
                // Leaf in incoming
                if (baseVal !== undefined) count++
            } else if (typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal)) {
                count += countConflicts(
                    baseVal as Record<string, unknown>,
                    incomingVal as Record<string, unknown>,
                )
            }
        }
    }
    return count
}

// ---------------------------------------------------------------------------
// Nested path helpers
// ---------------------------------------------------------------------------

/** Set a value at a dot-separated path, creating intermediate objects as needed */
function setNestedPath(
    root: Record<string, unknown>,
    dotPath: string,
    value: unknown,
): void {
    const parts = dotPath.split('.')
    let cursor: Record<string, unknown> = root
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        if (typeof cursor[part] !== 'object' || cursor[part] === null) {
            cursor[part] = {}
        }
        cursor = cursor[part] as Record<string, unknown>
    }
    cursor[parts[parts.length - 1]] = value
}

// ---------------------------------------------------------------------------
// JS parsing helpers (no eval / no new Function)
// ---------------------------------------------------------------------------

/**
 * Strip `// single-line comments` from source.
 * Skips lines that are inside string literals (best-effort for token files).
 */
function stripLineComments(source: string): string {
    // Process line by line; track whether we're inside a string literal
    const lines = source.split('\n')
    return lines.map(line => {
        // Find // that's not inside a string literal
        let inString = false
        let strChar = ''
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (inString) {
                if (ch === strChar && line[i - 1] !== '\\') inString = false
            } else {
                if (ch === '"' || ch === "'" || ch === '`') {
                    inString = true
                    strChar = ch
                } else if (ch === '/' && line[i + 1] === '/') {
                    return line.slice(0, i)
                }
            }
        }
        return line
    }).join('\n')
}

/**
 * Quote unquoted object keys in a JSON-like string.
 * Transforms: `  keyName:` → `  "keyName":`
 * Also handles numeric keys like `  400:` → `  "400":`
 */
function quoteUnquotedKeys(source: string): string {
    // Match keys that are not already quoted:
    // - Word at start-of-value position followed by colon
    // - Also handles numeric keys
    return source.replace(
        /([{,\[\n\r]\s*)(['"]?)([a-zA-Z_$][a-zA-Z0-9_$-]*|[0-9]+(?:\.[0-9]+)?)(['"]?)\s*:/g,
        (match, prefix, openQuote, key, closeQuote) => {
            if (openQuote === '"' && closeQuote === '"') return match
            return `${prefix}"${key}":`
        }
    )
}

/**
 * Remove trailing commas before `}` or `]`.
 */
function removeTrailingCommas(source: string): string {
    return source.replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Convert single-quoted string values to double-quoted strings.
 * Only replaces the outer string delimiters; preserves any double-quotes inside.
 * This handles JS object literals where values are single-quoted, e.g.:
 *   { "key": 'value' }  →  { "key": "value" }
 *
 * Algorithm: scan char-by-char, track whether inside a double-quoted or
 * single-quoted string, and replace single-quoted delimiters with double-quotes
 * while escaping any literal double-quotes found inside single-quoted strings.
 */
function convertSingleToDoubleQuotes(source: string): string {
    const out: string[] = []
    let i = 0
    while (i < source.length) {
        const ch = source[i]

        if (ch === '"') {
            // Already in a double-quoted string — copy until closing "
            out.push(ch)
            i++
            while (i < source.length) {
                const c = source[i]
                out.push(c)
                if (c === '\\') {
                    i++
                    if (i < source.length) out.push(source[i])
                } else if (c === '"') {
                    break
                }
                i++
            }
            i++
            continue
        }

        if (ch === "'") {
            // Single-quoted string: convert to double-quoted
            out.push('"')
            i++
            while (i < source.length) {
                const c = source[i]
                if (c === '\\') {
                    // Preserve escape sequences
                    i++
                    if (i < source.length) {
                        const escaped = source[i]
                        if (escaped === "'") {
                            out.push("'") // \' → ' (unescape in new double-quoted context)
                        } else if (escaped === '"') {
                            out.push('\\"') // \" stays escaped
                        } else {
                            out.push('\\')
                            out.push(escaped)
                        }
                    }
                } else if (c === "'") {
                    // Closing single quote
                    break
                } else if (c === '"') {
                    // Literal " inside single-quoted string — needs escaping
                    out.push('\\"')
                } else {
                    out.push(c)
                }
                i++
            }
            out.push('"')
            i++
            continue
        }

        out.push(ch)
        i++
    }
    return out.join('')
}
