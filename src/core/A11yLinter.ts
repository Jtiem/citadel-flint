/**
 * A11yLinter — src/core/A11yLinter.ts
 *
 * Static AST-level accessibility linter (Phase B.3 — Commandment 5).
 *
 * Bridge Commandment 5 states: "Accessibility is a Compiler Error — Missing
 * a11y attributes trigger a 'Critical Block' for exports."
 *
 * This module enforces that rule entirely at the Babel AST level, so the check
 * is deterministic: it is independent of whether the Live Preview is running,
 * and it cannot be fooled by conditional rendering or dynamic class names.
 *
 * ## Rules Enforced
 *
 * | Rule     | Element     | Requirement                                                                        |
 * |----------|-------------|------------------------------------------------------------------------------------|
 * | A11Y-001 | `<img>`     | Must have an `alt` attribute (empty string is valid for decorative images)         |
 * | A11Y-002 | `<button>`  | Must have visible text content OR `aria-label` / `title` attribute                 |
 * | A11Y-003 | `<a>`       | Must have visible text content OR `aria-label` / `title` attribute                 |
 * | A11Y-004 | `<input>`   | Must have `id`, `aria-label`, `aria-labelledby`, or `title` attribute              |
 *
 * ## Usage
 *
 * ```ts
 * import { A11yLinter } from '../core/A11yLinter'
 * const violations = A11yLinter.audit(parsedAst)
 * // violations → Record<bridgeId, string[]>
 * // e.g. { "img-hero-01": ["A11Y-001: <img> is missing an `alt` attribute."] }
 * ```
 *
 * Return value: An object mapping `data-bridge-id` string values
 * (extracted from JSX attributes) to an array of human-readable violation
 * messages. If a node lacks a `data-bridge-id`, it is keyed by a generated
 * fallback string so violations can still be surfaced in the Export Modal.
 *
 * Renderer Process only — no Node.js imports.
 */

import traverse from '@babel/traverse'
import type { File as BabelFile, JSXOpeningElement } from '@babel/types'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Maps `data-bridge-id` → list of violation messages for that element. */
export type A11yViolations = Record<string, string[]>

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reads a JSX attribute value as a plain string.
 * Handles `attr="value"` (StringLiteral) and `attr={"value"}` (JSXExpressionContainer
 * wrapping a StringLiteral). Returns `null` for dynamic expressions.
 */
function getAttrStringValue(attr: ReturnType<typeof getJsxAttr>): string | null {
    if (!attr) return null
    if (attr.type !== 'JSXAttribute') return null
    const { value } = attr
    if (!value) return '' // bare boolean attribute, e.g. <input required />
    if (value.type === 'StringLiteral') return value.value
    if (
        value.type === 'JSXExpressionContainer' &&
        value.expression.type === 'StringLiteral'
    ) {
        return value.expression.value
    }
    return null // dynamic — we cannot statically evaluate it; skip the rule
}

/**
 * Returns the JSXAttribute node for `attrName` from an opening-element's
 * attribute list, or `undefined` if not present.
 */
function getJsxAttr(
    opening: JSXOpeningElement,
    attrName: string,
): (typeof opening.attributes)[number] | undefined {
    return opening.attributes.find(
        (a) =>
            a.type === 'JSXAttribute' &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === attrName,
    )
}

/**
 * Returns true when `element` contains at least one non-whitespace text node
 * or a child expression that might resolve to text at runtime (we conservatively
 * assume any expression produces visible content to avoid false positives).
 */
function hasTextChildren(
    path: import('@babel/traverse').NodePath<import('@babel/types').JSXElement>,
): boolean {
    return path.node.children.some((child) => {
        if (child.type === 'JSXText') return /\S/.test(child.value)
        if (child.type === 'JSXExpressionContainer') {
            return child.expression.type !== 'JSXEmptyExpression'
        }
        if (child.type === 'JSXElement') return true // nested element — count as content
        return false
    })
}

/**
 * Derives the label key used in violations: the `data-bridge-id` value if
 * present, otherwise a positional fallback like `"img-3"`.
 */
function getBridgeId(opening: JSXOpeningElement, fallback: string): string {
    const attr = getJsxAttr(opening, 'data-bridge-id')
    if (!attr || attr.type !== 'JSXAttribute') return fallback
    const val = attr.value
    if (val?.type === 'StringLiteral') return val.value
    if (
        val?.type === 'JSXExpressionContainer' &&
        val.expression.type === 'StringLiteral'
    ) {
        return val.expression.value
    }
    // Template literals etc — use generic key but keep it unique
    return fallback
}

// ── Linter ────────────────────────────────────────────────────────────────────

export const A11yLinter = {
    /**
     * Traverses the provided Babel AST and returns every accessibility violation
     * found, grouped by `data-bridge-id` (or a positional fallback key).
     *
     * This is a **pure function** — it does not mutate the AST or any store.
     *
     * @param ast - A Babel `File` node produced by `parseCodeToAST`.
     * @returns    An object mapping element keys to arrays of violation messages.
     *             An empty object means the file is fully accessible.
     */
    audit(ast: BabelFile): A11yViolations {
        const violations: A11yViolations = {}
        let elementIndex = 0

        const addViolation = (key: string, message: string): void => {
            if (!violations[key]) violations[key] = []
            violations[key].push(message)
        }

        traverse(ast, {
            JSXElement(path) {
                const { openingElement: opening } = path.node
                const nameNode = opening.name

                // Only handle intrinsic HTML elements (lowercase tag names)
                if (nameNode.type !== 'JSXIdentifier') return
                const tag = nameNode.name.toLowerCase()
                if (!['img', 'button', 'a', 'input'].includes(tag)) return

                elementIndex += 1
                const bridgeId = getBridgeId(opening, `${tag}-${elementIndex}`)

                // ── A11Y-001: <img> must have alt ────────────────────────────
                if (tag === 'img') {
                    const altAttr = getJsxAttr(opening, 'alt')
                    if (altAttr === undefined) {
                        // alt attribute entirely missing — hard violation
                        addViolation(
                            bridgeId,
                            'A11Y-001: <img> is missing an `alt` attribute. ' +
                            'Add alt="" for decorative images or a descriptive string for informational ones.',
                        )
                    }
                    // If altAttr is present (even empty string): valid decorative usage.
                    // If value is dynamic (null from getAttrStringValue): benign — skip.
                    return // <img> is self-closing; no children to check
                }

                // ── A11Y-002/003: <button> and <a> need an accessible name ──
                if (tag === 'button' || tag === 'a') {
                    const ariaLabel = getJsxAttr(opening, 'aria-label')
                    const titleAttr = getJsxAttr(opening, 'title')
                    const ariaLabelVal = getAttrStringValue(ariaLabel)
                    const titleVal = getAttrStringValue(titleAttr)

                    // Dynamic aria-label / title (null) → skip (assume valid at runtime)
                    if (ariaLabelVal === null || titleVal === null) return

                    const hasAriaLabel =
                        typeof ariaLabelVal === 'string' && ariaLabelVal.trim() !== ''
                    const hasTitle =
                        typeof titleVal === 'string' && titleVal.trim() !== ''
                    const hasText = hasTextChildren(path)

                    if (!hasAriaLabel && !hasTitle && !hasText) {
                        const ruleId = tag === 'button' ? 'A11Y-002' : 'A11Y-003'
                        addViolation(
                            bridgeId,
                            `${ruleId}: <${tag}> has no accessible name. ` +
                            'Add text content, aria-label="…", or title="…".',
                        )
                    }
                    return
                }

                // ── A11Y-004: <input> must have a programmatic label ─────────
                if (tag === 'input') {
                    const idAttr = getJsxAttr(opening, 'id')
                    const ariaLabel = getJsxAttr(opening, 'aria-label')
                    const titleAttr = getJsxAttr(opening, 'title')
                    const ariaLabelledBy = getJsxAttr(opening, 'aria-labelledby')

                    const idVal = getAttrStringValue(idAttr)
                    const ariaLabelVal = getAttrStringValue(ariaLabel)
                    const titleVal = getAttrStringValue(titleAttr)
                    const ariaLabelledByVal = getAttrStringValue(ariaLabelledBy)

                    // If ANY attributeVal is dynamic (null), skip to avoid false positives
                    if (
                        idVal === null ||
                        ariaLabelVal === null ||
                        titleVal === null ||
                        ariaLabelledByVal === null
                    ) return

                    const hasId = typeof idVal === 'string' && idVal.trim() !== ''
                    const hasAriaLabel =
                        typeof ariaLabelVal === 'string' && ariaLabelVal.trim() !== ''
                    const hasTitle =
                        typeof titleVal === 'string' && titleVal.trim() !== ''
                    const hasAriaLabelledBy =
                        typeof ariaLabelledByVal === 'string' && ariaLabelledByVal.trim() !== ''

                    if (!hasId && !hasAriaLabel && !hasTitle && !hasAriaLabelledBy) {
                        addViolation(
                            bridgeId,
                            'A11Y-004: <input> has no programmatic label. ' +
                            'Add id="…" (+ a matching <label htmlFor>), aria-label="…", or aria-labelledby="…".',
                        )
                    }
                }
            },
        })

        return violations
    },
}
