// ---------------------------------------------------------------------------
// dtcgTokenAdapter.ts — DTCG → DesignToken[] shape adapter
//
// Pure adapter module. No I/O. Detects whether a loaded JSON blob is a
// W3C DTCG nested document or an already-flat DesignToken array and returns
// a flat DesignToken[] ready for MithrilLinter consumption.
//
// Integration point: normalizeTokenShape(raw).tokens replaces the two-liner
//   Array.isArray(raw) ? raw : Object.values(raw)
// at server.ts:2038.
//
// Implements FIXTURE.1.1 (DTCG Token Shape Adapter). See the contract at
// .flint-context/contracts/FIXTURE.1.1-contract.md for the full spec.
// ---------------------------------------------------------------------------

import type { DesignToken, TokenType } from '../types.js'

// ── Re-exported contract types (Phase 2 imports these) ─────────────────────

/** A single DTCG leaf node. $value may be a literal, a ref object, or the
 *  bare-string DTCG alias form "{group.name}". */
export interface DTCGLeaf {
    $value: string | { $ref: string }
    $type?: string
    $description?: string
}

/** Recursive DTCG document. Every value is either another group or a leaf. */
export interface DTCGDocument {
    [groupOrTokenName: string]: DTCGDocument | DTCGLeaf
}

/** Typed error emitted for alias resolution failures. The adapter never throws. */
export interface TokenAdapterError {
    code: 'ALIAS_CYCLE' | 'ALIAS_BROKEN_REF' | 'DEPTH_EXCEEDED' | 'INVALID_VALUE_TYPE'
    /** Dotted path of the offending leaf. */
    tokenPath: string
    /** The unresolved ref target path. */
    ref: string
    /** For ALIAS_CYCLE: the ordered visit chain that closed the loop. */
    chain?: string[]
}

/** Diagnostic-rich return from normalizeTokenShape. Call sites consume .tokens
 *  and may log the diagnostic fields at debug verbosity. */
export interface TokenAdapterResult {
    /** Flat DesignToken[] ready for MithrilLinter. */
    tokens: DesignToken[]
    /** True when input matched neither DTCG nor flat-array shape. */
    unknownShape: boolean
    /** Count of DTCG leaves successfully flattened (0 for flat-array input). */
    leafCount: number
    /** Alias resolution errors. Empty on clean documents. */
    errors: TokenAdapterError[]
}

// ── FNV-1a hash helpers ─────────────────────────────────────────────────────

/** 32-bit FNV-1a hash of a UTF-8 string. Returns a signed 32-bit integer.
 *  We force the sign bit ON (bitwise OR with 0x80000000 after masking to
 *  32 bits) so the result is always negative — keeping the synthesized id
 *  space fully disjoint from positive DB-issued ids.
 *
 *  Collision probability (birthday): ~N²/2³² per pair. At N=1,000 tokens,
 *  ~1-in-4.3M per pair — negligible. Downstream consumers must key on
 *  `token_path` (unique) rather than `id` (hash) if collision-freedom is
 *  a hard requirement. */
function fnv1a32(input: string): number {
    let hash = 0x811c9dc5 // FNV offset basis
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i)
        // Multiply by FNV prime 0x01000193, keeping within 32 bits.
        // JavaScript bitwise ops operate on signed 32-bit integers, so
        // Math.imul is used for the correct unsigned-multiply behaviour.
        hash = Math.imul(hash, 0x01000193)
    }
    // Force into the negative 32-bit range: set the high bit, then coerce
    // via |0 to obtain a signed 32-bit integer.
    return ((hash | 0x80000000) | 0)
}

// ── Shape-detection helpers ─────────────────────────────────────────────────

/** Returns true when `value` is a non-null plain object (not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Returns true when `node` looks like a DTCG leaf — it has a `$value` key
 *  and optionally `$type` / `$description`. We require `$value` to exist at
 *  the node level; mere presence of `$type` without `$value` is a group. */
function isDTCGLeafNode(node: Record<string, unknown>): boolean {
    return '$value' in node
}

/** Returns true when `node` looks like an already-flat DesignToken entry.
 *  Checks for the mandatory fields defined in types.ts:26. */
function isFlatDesignToken(node: unknown): node is DesignToken {
    if (!isPlainObject(node)) return false
    return (
        typeof (node as Record<string, unknown>).token_path === 'string' &&
        typeof (node as Record<string, unknown>).token_type === 'string' &&
        typeof (node as Record<string, unknown>).token_value === 'string'
    )
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true when `obj` appears to be a W3C DTCG nested document.
 *
 * Detection heuristic: `obj` is a plain object (not an array) and contains at
 * least one nested value that is itself a plain object with a `$value` key
 * (a DTCG leaf). We recurse one level at a time until we find a leaf or
 * exhaust all top-level entries.
 */
export function isDTCGDocument(obj: unknown): obj is DTCGDocument {
    if (!isPlainObject(obj)) return false
    return _containsDTCGLeaf(obj, 0)
}

/** Recurse up to `maxDepth` levels to find any leaf with `$value`. */
function _containsDTCGLeaf(node: Record<string, unknown>, depth: number): boolean {
    if (depth > 20) return false // guard against malformed deep objects
    for (const key of Object.keys(node)) {
        const val = node[key]
        if (!isPlainObject(val)) continue
        if (isDTCGLeafNode(val)) return true
        if (_containsDTCGLeaf(val as Record<string, unknown>, depth + 1)) return true
    }
    return false
}

/**
 * Recursively flattens a DTCG document into a flat DesignToken[].
 *
 * - `token_path` = dot-joined group chain (e.g. "fontSize.xs").
 * - `token_type` = DTCG `$type` cast to TokenType; falls back to `'string'`.
 * - `token_value` = resolved literal value (after alias resolution).
 * - `description` = DTCG `$description` or `null`.
 * - `collection_name` = `'fixture'`.
 * - `mode` = `'default'`.
 * - `id` = FNV-1a negative integer hash of `token_path` (stable, negative to
 *   stay disjoint from positive DB-issued ids).
 *
 * Alias leaves (`{$value:{$ref:"a.b"}}` or `{$value:"{a.b}"}`) are resolved
 * iteratively within the same document using a visited-set guard.
 *
 * Broken refs and cycles emit typed TokenAdapterError entries and the
 * offending leaf is omitted from the result.
 *
 * Returns a flat `DesignToken[]` directly. To obtain the full diagnostic
 * result (errors, leafCount, unknownShape), use `normalizeTokenShape` instead.
 */
export function flattenDTCGTokens(doc: unknown): DesignToken[] {
    if (!isPlainObject(doc)) return []
    const tokens: DesignToken[] = []
    const errors: TokenAdapterError[] = []
    _walkDTCG(doc as DTCGDocument, doc as DTCGDocument, [], tokens, errors, 0)
    return tokens
}

/** Internal version that also returns errors and leafCount for use by
 *  normalizeTokenShape. */
function _flattenDTCGTokensWithDiagnostics(doc: DTCGDocument): TokenAdapterResult {
    const tokens: DesignToken[] = []
    const errors: TokenAdapterError[] = []
    _walkDTCG(doc, doc, [], tokens, errors, 0)
    return { tokens, unknownShape: false, leafCount: tokens.length, errors }
}

/** Recursive walker. `root` is always the top-level document (for alias
 *  resolution). `node` is the current sub-tree. `pathParts` accumulates the
 *  dot-joined path as we descend. `depth` tracks nesting level — capped at 64
 *  to prevent stack overflow from adversarially-deep token files (BLK-1). */
function _walkDTCG(
    root: DTCGDocument,
    node: DTCGDocument,
    pathParts: string[],
    tokens: DesignToken[],
    errors: TokenAdapterError[],
    depth: number,
): void {
    // BLK-1: depth cap — 64 levels is deeper than any real design system.
    if (depth > 64) {
        errors.push({
            code: 'DEPTH_EXCEEDED',
            tokenPath: pathParts.join('.') || '(root)',
            ref: '',
        })
        return
    }

    for (const key of Object.keys(node)) {
        const val = node[key]
        if (!isPlainObject(val)) continue
        const childPath = [...pathParts, key]

        if (isDTCGLeafNode(val as Record<string, unknown>)) {
            const leaf = val as unknown as DTCGLeaf
            const tokenPath = childPath.join('.')
            const rawValue = leaf.$value

            // ── Alias resolution ─────────────────────────────────────────
            let resolvedValue: string
            if (typeof rawValue === 'string' && _isDTCGBareRef(rawValue)) {
                // Bare-string DTCG alias form: "{group.token}" (must contain a dot,
                // no whitespace — tighter than the naive startsWith/endsWith check
                // so literal strings like "{notARef}" are not treated as refs).
                const refPath = rawValue.slice(1, -1)
                const result = _resolveAlias(root, tokenPath, refPath)
                if (result.error) {
                    errors.push(result.error)
                    continue
                }
                resolvedValue = result.value!
            } else if (
                typeof rawValue === 'object' && rawValue !== null &&
                '$ref' in rawValue
            ) {
                // BLK-3: $ref key present — must be a string. Non-string $ref is
                // a malformed alias; emit typed error rather than stringifying to
                // "[object Object]" which would poison downstream token matching.
                const refValue = (rawValue as { $ref: unknown }).$ref
                if (typeof refValue !== 'string') {
                    errors.push({
                        code: 'INVALID_VALUE_TYPE',
                        tokenPath,
                        ref: '',
                    })
                    continue
                }
                // Object alias form: { $ref: "group.name" }
                const result = _resolveAlias(root, tokenPath, refValue)
                if (result.error) {
                    errors.push(result.error)
                    continue
                }
                resolvedValue = result.value!
            } else if (typeof rawValue === 'string') {
                resolvedValue = rawValue
            } else {
                // BLK-2: Symbol and function types cannot be safely stringified.
                // A getter that throws also lands here via the try/catch.
                if (typeof rawValue === 'symbol' || typeof rawValue === 'function') {
                    errors.push({
                        code: 'INVALID_VALUE_TYPE',
                        tokenPath,
                        ref: '',
                    })
                    continue
                }
                // Non-string, non-ref value — best-effort stringify; guard throws.
                let stringified: string
                try {
                    stringified = String(rawValue)
                } catch {
                    errors.push({
                        code: 'INVALID_VALUE_TYPE',
                        tokenPath,
                        ref: '',
                    })
                    continue
                }
                resolvedValue = stringified
            }

            const tokenType = _normalizeTokenType(leaf.$type)
            tokens.push({
                id: fnv1a32(tokenPath),
                token_path: tokenPath,
                token_type: tokenType,
                token_value: resolvedValue,
                description: leaf.$description ?? null,
                collection_name: 'fixture',
                mode: 'default',
            })
        } else {
            // It is a group — recurse deeper
            _walkDTCG(root, val as DTCGDocument, childPath, tokens, errors, depth + 1)
        }
    }
}

/** Returns true only for a tightly-formed DTCG bare-string reference:
 *  wrapped in braces, contains at least one dot, and has no whitespace.
 *  This is stricter than a naive startsWith/endsWith check (INFO-1) to
 *  avoid treating literal string values like "{notARef}" as alias refs. */
function _isDTCGBareRef(value: string): boolean {
    if (!value.startsWith('{') || !value.endsWith('}')) return false
    const inner = value.slice(1, -1)
    return inner.includes('.') && !/\s/.test(inner)
}

/** Iteratively resolve an alias ref within the same document.
 *  Returns { value } on success or { error } on cycle / broken ref.
 *
 *  WARN-2: Uses Set<string> for O(1) cycle detection rather than Array.includes
 *  (O(N)). Also caps chain length at 1024 as defense-in-depth against non-cyclic
 *  but excessively long chains. */
function _resolveAlias(
    root: DTCGDocument,
    originPath: string,
    initialRef: string,
): { value?: string; error?: TokenAdapterError } {
    // WARN-2: Set<string> gives O(1) .has() vs O(N) Array.includes.
    const visited = new Set<string>([originPath])
    let currentRef = initialRef

    while (true) {
        if (visited.has(currentRef)) {
            // Cycle detected
            return {
                error: {
                    code: 'ALIAS_CYCLE',
                    tokenPath: originPath,
                    ref: initialRef,
                    chain: [...visited, currentRef],
                },
            }
        }

        // Defense-in-depth: cap non-cyclic chains at 1024 hops.
        if (visited.size > 1024) {
            return {
                error: {
                    code: 'ALIAS_CYCLE',
                    tokenPath: originPath,
                    ref: currentRef,
                },
            }
        }

        const target = _lookupByDotPath(root, currentRef)
        if (target === undefined) {
            return {
                error: {
                    code: 'ALIAS_BROKEN_REF',
                    tokenPath: originPath,
                    ref: currentRef,
                },
            }
        }

        if (!isPlainObject(target) || !isDTCGLeafNode(target as Record<string, unknown>)) {
            // Resolved to a group node, not a leaf — treat as broken ref
            return {
                error: {
                    code: 'ALIAS_BROKEN_REF',
                    tokenPath: originPath,
                    ref: currentRef,
                },
            }
        }

        const leaf = target as unknown as DTCGLeaf
        visited.add(currentRef)

        if (typeof leaf.$value === 'string' && _isDTCGBareRef(leaf.$value)) {
            // Bare-string hop — continue chain
            currentRef = leaf.$value.slice(1, -1)
            continue
        }
        // BLK-3: require $ref to be a string before treating as an alias hop.
        if (
            typeof leaf.$value === 'object' && leaf.$value !== null &&
            '$ref' in leaf.$value &&
            typeof (leaf.$value as { $ref: unknown }).$ref === 'string'
        ) {
            // Object hop — continue chain
            currentRef = (leaf.$value as { $ref: string }).$ref
            continue
        }
        if (typeof leaf.$value === 'string') {
            return { value: leaf.$value }
        }
        // Non-string terminal value — best-effort stringify
        try {
            return { value: String(leaf.$value) }
        } catch {
            return {
                error: {
                    code: 'INVALID_VALUE_TYPE',
                    tokenPath: originPath,
                    ref: currentRef,
                },
            }
        }
    }
}

/** Walk the root document by a dot-separated path, returning the node at
 *  that path or `undefined` if any segment is missing.
 *
 *  WARN-1: Uses Object.hasOwn before each bracket read to prevent traversal
 *  of the prototype chain (e.g. "$ref: __proto__.toString" would otherwise
 *  resolve to Object.prototype.toString). */
function _lookupByDotPath(
    root: Record<string, unknown>,
    dotPath: string,
): unknown {
    const parts = dotPath.split('.')
    let current: unknown = root
    for (const part of parts) {
        if (!isPlainObject(current)) return undefined
        // WARN-1: own-property guard — never traverse prototype chain.
        if (!Object.hasOwn(current as object, part)) return undefined
        current = (current as Record<string, unknown>)[part]
    }
    return current
}

/** Map a DTCG `$type` string to the closest Flint `TokenType`. Falls back to
 *  `'string'` for unknown or undefined types. The mapping is additive — we
 *  accept any DTCG type string that exactly matches a TokenType. */
function _normalizeTokenType(dtcgType: string | undefined): TokenType {
    const validTypes: ReadonlySet<string> = new Set<string>([
        'color', 'dimension', 'fontFamily', 'fontWeight',
        'lineHeight', 'letterSpacing', 'shadow', 'opacity',
        'string', 'boolean',
    ])
    if (dtcgType && validTypes.has(dtcgType)) {
        return dtcgType as TokenType
    }
    return 'string'
}

/**
 * Single integration point — auto-detects input shape and returns a
 * TokenAdapterResult whose `.tokens` is ready for MithrilLinter consumption.
 *
 * | Input shape | Behaviour |
 * |---|---|
 * | Already-flat `DesignToken[]` | Returns input by reference; leafCount === 0 |
 * | DTCG nested document | Flattens; builds token_path, resolves aliases |
 * | Empty object `{}` | Returns empty tokens; unknownShape === false |
 * | Unknown shape | Returns empty tokens; unknownShape === true; single warning in errors |
 * | null / undefined / non-object | Returns empty tokens; unknownShape === true |
 */
export function normalizeTokenShape(raw: unknown): TokenAdapterResult {
    // ── Case 1: already a flat DesignToken[] ──────────────────────────────
    if (Array.isArray(raw)) {
        if (raw.length === 0 || raw.every(isFlatDesignToken)) {
            return {
                tokens: raw as DesignToken[],
                unknownShape: false,
                leafCount: 0,
                errors: [],
            }
        }
        // Array but elements are not DesignToken — unknown shape
        return {
            tokens: [],
            unknownShape: true,
            leafCount: 0,
            errors: [{
                code: 'ALIAS_BROKEN_REF',
                tokenPath: '(root)',
                ref: '(array elements do not match DesignToken shape)',
            }],
        }
    }

    // ── Case 2: plain object — could be DTCG or unknown ───────────────────
    if (!isPlainObject(raw)) {
        return { tokens: [], unknownShape: true, leafCount: 0, errors: [] }
    }

    // Empty object — valid but yields no tokens
    if (Object.keys(raw).length === 0) {
        return { tokens: [], unknownShape: false, leafCount: 0, errors: [] }
    }

    // ── Case 3: DTCG nested document ─────────────────────────────────────
    if (isDTCGDocument(raw)) {
        return _flattenDTCGTokensWithDiagnostics(raw as DTCGDocument)
    }

    // ── Case 4: unknown non-empty object ─────────────────────────────────
    return { tokens: [], unknownShape: true, leafCount: 0, errors: [] }
}
