/**
 * A11yLinter — src/core/A11yLinter.ts
 *
 * Static AST-level accessibility linter (Phase B.3 — Commandment 5).
 *
 * Bridge Commandment 5 states: "Accessibility is a Compiler Error — Missing
 * a11y attributes trigger a 'Critical Block' for exports."
 *
 * ## Rules Enforced (v2 — Enterprise WCAG 2.1 AA)
 *
 * | Rule     | Element        | Requirement                                                             |
 * |----------|----------------|-------------------------------------------------------------------------|
 * | A11Y-001 | `<img>`        | Must have `alt` attribute                                               |
 * | A11Y-002 | `<button>`     | Must have text content OR aria-label / title                            |
 * | A11Y-003 | `<a>`          | Must have text content OR aria-label / title                            |
 * | A11Y-004 | `<input>`      | Must have id, aria-label, aria-labelledby, or title                     |
 * | A11Y-005 | `<select>`     | Must have aria-label, aria-labelledby, or title                         |
 * | A11Y-006 | `<textarea>`   | Must have aria-label, aria-labelledby, or title                         |
 * | A11Y-007 | Any            | tabIndex > 0 disrupts natural tab order — use 0 or -1                  |
 * | A11Y-008 | `<table>`      | Must have aria-label, aria-labelledby, or a `<caption>` child           |
 * | A11Y-009 | `<html>`       | Must have lang attribute                                                 |
 * | A11Y-010 | Headings       | Must not skip heading levels (h1→h3 without h2)**                       |
 *
 * ** A11Y-010 is document-scoped rather than per-element.
 *
 * All checks are deterministic Babel AST traversal — no runtime execution required.
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
 * or a child expression that might resolve to text at runtime.
 */
function hasTextChildren(
    path: import('@babel/traverse').NodePath<import('@babel/types').JSXElement>,
): boolean {
    return path.node.children.some((child) => {
        if (child.type === 'JSXText') return /\S/.test(child.value)
        if (child.type === 'JSXExpressionContainer') {
            return child.expression.type !== 'JSXEmptyExpression'
        }
        if (child.type === 'JSXElement') return true
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
    return fallback
}

/** Checks for static accessible-name surface: aria-label, title. Returns true when safe to skip. */
function hasDynamicLabel(opening: JSXOpeningElement): boolean {
    return ['aria-label', 'aria-labelledby', 'title'].some((name) => {
        const a = getJsxAttr(opening, name)
        if (!a) return false
        // dynamic expression — conservatively assume valid
        if (a.type === 'JSXAttribute' && a.value?.type === 'JSXExpressionContainer') return true
        return false
    })
}

function getNonEmptyAttr(opening: JSXOpeningElement, name: string): boolean {
    const val = getAttrStringValue(getJsxAttr(opening, name))
    return typeof val === 'string' && val.trim() !== ''
}

// ── Linter ────────────────────────────────────────────────────────────────────

export const A11yLinter = {
    /**
     * Traverses the provided Babel AST and returns every accessibility violation
     * found, grouped by `data-bridge-id` (or a positional fallback key).
     *
     * @param ast - A Babel `File` node produced by `parseCodeToAST`.
     * @returns    An object mapping element keys to arrays of violation messages.
     *             An empty object means the file is fully accessible.
     */
    audit(ast: BabelFile): A11yViolations {
        const violations: A11yViolations = {}
        let elementIndex = 0

        /** Heading levels encountered so far, for A11Y-010 ordering check. */
        const headingsSeen: number[] = []

        const addViolation = (key: string, message: string): void => {
            if (!violations[key]) violations[key] = []
            violations[key].push(message)
        }

        traverse(ast, {
            JSXElement(path) {
                const { openingElement: opening } = path.node
                const nameNode = opening.name

                if (nameNode.type !== 'JSXIdentifier') return
                const tag = nameNode.name.toLowerCase()

                const AUDITED_TAGS = ['img', 'button', 'a', 'input', 'select', 'textarea', 'table', 'html']
                const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

                // ── A11Y-010: Heading level order ──────────────────────────────
                if (HEADING_TAGS.includes(tag)) {
                    const level = parseInt(tag[1], 10)
                    const last = headingsSeen[headingsSeen.length - 1] ?? 0
                    headingsSeen.push(level)
                    if (level > last + 1) {
                        elementIndex += 1
                        const bridgeId = getBridgeId(opening, `heading-${elementIndex}`)
                        addViolation(
                            bridgeId,
                            `A11Y-010: Heading <${tag}> skips level. Previous heading was <h${last}>. ` +
                            'Heading levels must not be skipped — use sequential levels for screen readers.',
                        )
                    }
                    return
                }

                if (!AUDITED_TAGS.includes(tag)) return

                elementIndex += 1
                const bridgeId = getBridgeId(opening, `${tag}-${elementIndex}`)

                // ── A11Y-001: <img> must have alt ─────────────────────────────
                if (tag === 'img') {
                    const altAttr = getJsxAttr(opening, 'alt')
                    if (altAttr === undefined) {
                        addViolation(
                            bridgeId,
                            'A11Y-001: <img> is missing an `alt` attribute. ' +
                            'Add alt="" for decorative images or a descriptive string for informational ones.',
                        )
                    }
                    return
                }

                // ── A11Y-002/003: <button> and <a> need an accessible name ────
                if (tag === 'button' || tag === 'a') {
                    if (hasDynamicLabel(opening)) return

                    const hasAriaLabel = getNonEmptyAttr(opening, 'aria-label')
                    const hasTitle = getNonEmptyAttr(opening, 'title')
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

                // ── A11Y-004: <input> must have programmatic label ────────────
                if (tag === 'input') {
                    const hasId = getNonEmptyAttr(opening, 'id')
                    const hasAriaLabel = getNonEmptyAttr(opening, 'aria-label')
                    const hasTitle = getNonEmptyAttr(opening, 'title')
                    const hasAriaLabelledBy = getNonEmptyAttr(opening, 'aria-labelledby')
                    if (hasDynamicLabel(opening)) return

                    if (!hasId && !hasAriaLabel && !hasTitle && !hasAriaLabelledBy) {
                        addViolation(
                            bridgeId,
                            'A11Y-004: <input> has no programmatic label. ' +
                            'Add id="…" (+ a matching <label htmlFor>), aria-label="…", or aria-labelledby="…".',
                        )
                    }
                    return
                }

                // ── A11Y-005: <select> must have label ────────────────────────
                if (tag === 'select') {
                    if (hasDynamicLabel(opening)) return
                    const hasAriaLabel = getNonEmptyAttr(opening, 'aria-label')
                    const hasAriaLabelledBy = getNonEmptyAttr(opening, 'aria-labelledby')
                    const hasTitle = getNonEmptyAttr(opening, 'title')
                    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
                        addViolation(
                            bridgeId,
                            'A11Y-005: <select> has no accessible label. ' +
                            'Add aria-label="…", aria-labelledby="…", or pair with a <label htmlFor>.',
                        )
                    }
                    return
                }

                // ── A11Y-006: <textarea> must have label ──────────────────────
                if (tag === 'textarea') {
                    if (hasDynamicLabel(opening)) return
                    const hasAriaLabel = getNonEmptyAttr(opening, 'aria-label')
                    const hasAriaLabelledBy = getNonEmptyAttr(opening, 'aria-labelledby')
                    const hasTitle = getNonEmptyAttr(opening, 'title')
                    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
                        addViolation(
                            bridgeId,
                            'A11Y-006: <textarea> has no accessible label. ' +
                            'Add aria-label="…", aria-labelledby="…", or pair with a <label htmlFor>.',
                        )
                    }
                    return
                }

                // ── A11Y-008: <table> must have accessible summary ────────────
                if (tag === 'table') {
                    if (hasDynamicLabel(opening)) return
                    const hasAriaLabel = getNonEmptyAttr(opening, 'aria-label')
                    const hasAriaLabelledBy = getNonEmptyAttr(opening, 'aria-labelledby')
                    // Check for a <caption> child element.
                    const hasCaption = path.node.children.some(
                        (child) =>
                            child.type === 'JSXElement' &&
                            child.openingElement.name.type === 'JSXIdentifier' &&
                            child.openingElement.name.name.toLowerCase() === 'caption',
                    )
                    if (!hasAriaLabel && !hasAriaLabelledBy && !hasCaption) {
                        addViolation(
                            bridgeId,
                            'A11Y-008: <table> has no accessible summary. ' +
                            'Add a <caption> child, aria-label="…", or aria-labelledby="…".',
                        )
                    }
                    return
                }

                // ── A11Y-009: <html> must have lang ──────────────────────────
                if (tag === 'html') {
                    const hasLang = getNonEmptyAttr(opening, 'lang')
                    if (!hasLang) {
                        addViolation(
                            bridgeId,
                            'A11Y-009: <html> is missing a `lang` attribute. ' +
                            'Add lang="en" (or appropriate BCP 47 language tag) for screen reader language detection.',
                        )
                    }
                    return
                }
            },

            // ── A11Y-007: tabIndex > 0 disrupts tab order ─────────────────────
            JSXAttribute(path) {
                if (
                    path.node.name.type !== 'JSXIdentifier' ||
                    path.node.name.name !== 'tabIndex'
                ) return

                const val = path.node.value
                let numericVal: number | null = null

                if (val?.type === 'StringLiteral') {
                    numericVal = parseInt(val.value, 10)
                } else if (
                    val?.type === 'JSXExpressionContainer' &&
                    val.expression.type === 'NumericLiteral'
                ) {
                    numericVal = val.expression.value
                } else if (
                    val?.type === 'JSXExpressionContainer' &&
                    val.expression.type === 'StringLiteral'
                ) {
                    numericVal = parseInt(val.expression.value, 10)
                }

                if (numericVal === null || numericVal <= 0) return

                const openEl = path.parentPath?.node
                if (!openEl || openEl.type !== 'JSXOpeningElement') return

                elementIndex += 1
                const bridgeId = getBridgeId(openEl, `tabindex-${elementIndex}`)
                addViolation(
                    bridgeId,
                    `A11Y-007: tabIndex="${numericVal}" disrupts natural tab order. ` +
                    'Use tabIndex={0} to include in natural order, or tabIndex={-1} to remove from flow.',
                )
            },
        })

        return violations
    },
}
