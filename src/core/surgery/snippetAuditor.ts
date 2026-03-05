/**
 * snippetAuditor — src/core/surgery/snippetAuditor.ts
 *
 * Mithril-Audit utility for Ralph Loop integration.
 *
 * Transforms "dirty" JSX snippets (e.g. from Ralph Loops / Ant Design) into
 * Bridge-compliant code by enforcing two invariants:
 *
 *   1. Commandment 3 — Composite IDs:
 *      Every `.map()` callback gains an `index` parameter, and the root JSX
 *      element of each loop is stamped with:
 *          data-bridge-id={`node-${index}`}
 *      These are scaffold placeholders; `injectBridgeIds` in the AST canvas
 *      replaces them with deterministic structural IDs on file load.
 *
 *   2. Perceptual Colour Gate — Mithril Safety:
 *      Inline `style` props are scanned for hardcoded hex values.
 *      Each hex is compared against the provided design-token set via CIEDE2000:
 *          ΔE < 2.0  → replaced with var(--bridge-token-<path>)
 *          ΔE ≥ 2.0  → violation — throws MithrilViolationError (hard gate)
 *      Pass an empty token array to skip colour validation (offline / CLI mode).
 *
 * Atomic contract: if ANY transform fails, throws MithrilViolationError.
 * Never returns partial code.
 *
 * Environment-agnostic — runs in both Renderer Process and Node.js (CLI).
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import {
    identifier,
    jsxAttribute,
    jsxIdentifier,
    jsxExpressionContainer,
    templateLiteral,
    templateElement,
    stringLiteral,
    isArrowFunctionExpression,
    isFunctionExpression,
    isJSXElement,
    isJSXAttribute,
    isJSXIdentifier,
    isJSXExpressionContainer,
    isObjectExpression,
    isObjectProperty,
    isStringLiteral,
    isIdentifier,
    isBlockStatement,
    isReturnStatement,
} from '@babel/types'
import type { DesignToken } from '../../types/bridge-api'
import { findClosestToken } from '../../utils/tokenMatcher'

// ── CJS interop (same pattern as ast-parser.ts) ──────────────────────────────

const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

const generate =
    typeof _generate === 'function'
        ? _generate
        : (_generate as unknown as { default: typeof _generate }).default

// ── Error type ───────────────────────────────────────────────────────────────

/**
 * Thrown by `auditSnippet` when the snippet cannot be cleaned atomically.
 * Contains a human-readable `violations` list suitable for CLI / UI display.
 */
export class MithrilViolationError extends Error {
    constructor(
        message: string,
        public readonly violations: readonly string[]
    ) {
        super(message)
        this.name = 'MithrilViolationError'
    }
}

// ── Constants ────────────────────────────────────────────────────────────────

/** CSS property names that carry a direct colour value in `style` objects. */
const CSS_COLOR_PROPS = new Set([
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'fill',
    'stroke',
    'caretColor',
    'textDecorationColor',
])

/** Matches 3-digit and 6-digit CSS hex colour strings. */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Mithril Safety threshold — mirrors SYSTEMIZABLE_THRESHOLD in tokenMatcher. */
const MITHRIL_THRESHOLD = 2.0

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Converts a design-token path to a CSS custom-property reference.
 * e.g. "color.brand.primary" → "var(--bridge-token-color-brand-primary)"
 */
function tokenPathToCssVar(tokenPath: string): string {
    return `var(--bridge-token-${tokenPath.replace(/\./g, '-')})`
}

/**
 * Returns true when the JSX element's opening tag already carries a
 * `data-bridge-id` attribute (prevents double-injection on re-audit).
 */
function hasBridgeId(elem: import('@babel/types').JSXElement): boolean {
    return elem.openingElement.attributes.some(
        (attr) =>
            isJSXAttribute(attr) &&
            isJSXIdentifier(attr.name) &&
            attr.name.name === 'data-bridge-id'
    )
}

/**
 * Injects `data-bridge-id={\`node-${<indexName>}\`}` onto a JSX element.
 * No-op if the attribute is already present.
 */
function injectBridgeId(
    elem: import('@babel/types').JSXElement,
    indexName: string
): void {
    if (hasBridgeId(elem)) return
    const attr = jsxAttribute(
        jsxIdentifier('data-bridge-id'),
        jsxExpressionContainer(
            templateLiteral(
                [
                    templateElement({ raw: 'node-', cooked: 'node-' }, false),
                    templateElement({ raw: '', cooked: '' }, true),
                ],
                [identifier(indexName)]
            )
        )
    )
    elem.openingElement.attributes.push(attr)
}

/**
 * Finds the root JSXElement returned by a `.map()` callback body.
 * Handles expression-body arrow functions and block-body functions with a
 * return statement. Returns null when no root JSX element can be identified.
 */
function findRootJSX(
    body: import('@babel/types').Node
): import('@babel/types').JSXElement | null {
    if (isJSXElement(body)) return body
    if (isBlockStatement(body)) {
        for (let i = body.body.length - 1; i >= 0; i--) {
            const stmt = body.body[i]
            if (
                isReturnStatement(stmt) &&
                stmt.argument != null &&
                isJSXElement(stmt.argument)
            ) {
                return stmt.argument
            }
        }
    }
    return null
}

/**
 * Returns the first index-param name not already used by an enclosing
 * `.map()` callback in the current traversal scope stack.
 * Results: 'index', 'index_1', 'index_2', …
 */
function generateUniqueIndexName(activeNames: string[]): string {
    if (!activeNames.includes('index')) return 'index'
    let n = 1
    while (activeNames.includes(`index_${n}`)) n++
    return `index_${n}`
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Audits a raw JSX snippet from a Ralph Loop and returns Bridge-compliant code.
 *
 * @param rawCode  Raw JSX string, e.g. a scaffold generated by Ralph Loops.
 * @param tokens   Design-token set for perceptual drift checks.
 *                 Pass an empty array (default) to skip colour validation.
 *
 * @throws {MithrilViolationError}
 *   - Parse failure
 *   - A `style` prop hex colour has ΔE ≥ 2.0 against the nearest token
 *   - A `style` prop hex appears but the token list is empty
 *
 * @returns Cleaned, Bridge-compliant JSX source string.
 */
export function auditSnippet(rawCode: string, tokens: DesignToken[] = []): string {
    // ── Step 1: Parse ────────────────────────────────────────────────────────
    let ast: import('@babel/types').File
    try {
        ast = parse(rawCode, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch (err) {
        throw new MithrilViolationError(
            `Parse failure — cannot audit snippet: ${String(err)}`,
            [String(err)]
        )
    }

    // Accumulate violations so we can report ALL offending colours at once.
    const violations: string[] = []

    // ── Step 2: Commandment 3 — inject index + data-bridge-id ───────────────
    // Track the index param names injected by ancestor `.map()` callbacks so
    // we can generate unique names (index, index_1, index_2…) and prevent
    // variable shadowing in nested map expressions.
    const processedMaps = new WeakSet<import('@babel/types').CallExpression>()
    const activeIndexNames: string[] = []

    traverse(ast, {
        CallExpression: {
            enter(path) {
                const { callee, arguments: callArgs } = path.node

                // Only target <expr>.map(callback) calls
                if (
                    callee.type !== 'MemberExpression' ||
                    callee.property.type !== 'Identifier' ||
                    callee.property.name !== 'map'
                ) return

                const callback = callArgs[0]
                if (callback === undefined) return
                if (!isArrowFunctionExpression(callback) && !isFunctionExpression(callback)) return

                const params = callback.params
                let indexName: string

                // Ensure the callback has an `index` second parameter,
                // using a unique name to avoid shadowing ancestor maps.
                if (params.length === 0) {
                    indexName = generateUniqueIndexName(activeIndexNames)
                    params.push(identifier('_item'))
                    params.push(identifier(indexName))
                } else if (params.length === 1) {
                    indexName = generateUniqueIndexName(activeIndexNames)
                    params.push(identifier(indexName))
                } else {
                    // params.length >= 2: use the existing second param as-is
                    const existingIndex = params[1]
                    if (!isIdentifier(existingIndex)) return
                    indexName = existingIndex.name
                }

                // Stamp data-bridge-id on the root JSX element of this loop
                const rootJSX = findRootJSX(callback.body)
                if (rootJSX !== null) {
                    injectBridgeId(rootJSX, indexName)
                }

                processedMaps.add(path.node)
                activeIndexNames.push(indexName)
            },
            exit(path) {
                if (processedMaps.has(path.node)) {
                    activeIndexNames.pop()
                }
            },
        },
    })

    // ── Step 3: Perceptual colour gate ───────────────────────────────────────
    // Skip when no tokens are provided (offline / CLI mode without token file).
    if (tokens.length > 0) {
        traverse(ast, {
            JSXAttribute(path) {
                const { name, value } = path.node

                // Only inspect `style={...}` attributes
                if (!isJSXIdentifier(name) || name.name !== 'style') return
                if (!isJSXExpressionContainer(value)) return
                if (!isObjectExpression(value.expression)) return

                for (const prop of value.expression.properties) {
                    if (!isObjectProperty(prop)) continue
                    if (!isStringLiteral(prop.value)) continue

                    const propKey =
                        prop.key.type === 'Identifier'
                            ? prop.key.name
                            : prop.key.type === 'StringLiteral'
                            ? prop.key.value
                            : null

                    if (propKey === null || !CSS_COLOR_PROPS.has(propKey)) continue

                    const rawColor = prop.value.value
                    if (!HEX_RE.test(rawColor)) continue

                    // Run CIEDE2000 against the token set
                    const match = findClosestToken(rawColor, tokens)
                    if (match === null) {
                        violations.push(
                            `style.${propKey}: "${rawColor}" — no colour tokens to match against`
                        )
                        continue
                    }

                    if (match.deltaE >= MITHRIL_THRESHOLD) {
                        violations.push(
                            `style.${propKey}: "${rawColor}" — ΔE ${match.deltaE.toFixed(2)} ≥ ` +
                            `${MITHRIL_THRESHOLD} (nearest: ${match.tokenPath} = ${match.tokenValue})`
                        )
                    } else {
                        // ΔE < threshold — safe to replace with CSS custom property
                        prop.value = stringLiteral(tokenPathToCssVar(match.tokenPath))
                    }
                }
            },
        })
    }

    // ── Step 4: Atomic contract — throw before emitting any partial output ───
    if (violations.length > 0) {
        throw new MithrilViolationError(
            `${violations.length} Mithril violation(s) — hardcoded colour(s) exceed ΔE ${MITHRIL_THRESHOLD}`,
            violations
        )
    }

    // ── Step 5: Generate cleaned code ────────────────────────────────────────
    try {
        const result = generate(ast, { retainLines: false }, rawCode)
        return result.code
    } catch (err) {
        throw new MithrilViolationError(
            `Code generation failed: ${String(err)}`,
            [String(err)]
        )
    }
}
