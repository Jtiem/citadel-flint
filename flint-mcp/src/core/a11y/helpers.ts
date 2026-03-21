/**
 * A11y helpers — flint-mcp/src/core/a11y/helpers.ts
 *
 * Shared AST helper functions extracted from the original A11yLinter.
 * All helpers operate on Babel AST nodes. No source-code regex allowed.
 */

import type { JSXOpeningElement, JSXElement } from '@babel/types'
import type { NodePath } from '@babel/traverse'

// ── Attribute access ──────────────────────────────────────────────────────────

/**
 * Returns the JSXAttribute node for the given attribute name, or undefined.
 */
export function getJsxAttr(
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
 * Returns the string value of a JSXAttribute, or null if dynamic/missing.
 * Returns '' for bare boolean attributes (e.g., `disabled`).
 */
export function getAttributeValue(attr: ReturnType<typeof getJsxAttr>): string | null {
    if (!attr) return null
    if (attr.type !== 'JSXAttribute') return null
    const { value } = attr
    if (!value) return '' // bare boolean attribute
    if (value.type === 'StringLiteral') return value.value
    if (
        value.type === 'JSXExpressionContainer' &&
        value.expression.type === 'StringLiteral'
    ) {
        return value.expression.value
    }
    return null // dynamic — conservatively skip
}

/**
 * Returns the string value of a named attribute on an opening element, or null.
 */
export function getAttributeStringValue(opening: JSXOpeningElement, name: string): string | null {
    return getAttributeValue(getJsxAttr(opening, name))
}

/**
 * Returns true if the element has a named attribute with a non-empty string value.
 */
export function hasAttribute(opening: JSXOpeningElement, name: string): boolean {
    const attr = getJsxAttr(opening, name)
    if (!attr) return false
    return true
}

/**
 * Returns true if the element has a named attribute with a non-empty, non-null string value.
 */
export function hasNonEmptyAttr(opening: JSXOpeningElement, name: string): boolean {
    const val = getAttributeValue(getJsxAttr(opening, name))
    return typeof val === 'string' && val.trim() !== ''
}

/**
 * Returns true if any of the given attributes is set on the element with a
 * dynamic expression value (JSXExpressionContainer). Used to conservatively
 * skip rules when the value cannot be statically resolved.
 */
export function hasDynamicLabel(opening: JSXOpeningElement): boolean {
    return ['aria-label', 'aria-labelledby', 'title'].some((name) => {
        const a = getJsxAttr(opening, name)
        if (!a) return false
        if (a.type === 'JSXAttribute' && a.value?.type === 'JSXExpressionContainer') return true
        return false
    })
}

// ── Text content ──────────────────────────────────────────────────────────────

/**
 * Returns true if the JSXElement has meaningful text or JSX child content.
 */
export function hasTextChildren(
    path: NodePath<JSXElement>,
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
 * Extracts the concatenated text content from JSXText children.
 * Returns an empty string if no text children.
 */
export function getTextContent(path: NodePath<JSXElement>): string {
    return path.node.children
        .filter((c) => c.type === 'JSXText')
        .map((c) => (c as import('@babel/types').JSXText).value.trim())
        .join(' ')
        .trim()
}

// ── Flint ID ─────────────────────────────────────────────────────────────────

/**
 * Returns the `data-flint-id` value for an element, or the provided fallback.
 */
export function getFlintId(opening: JSXOpeningElement, fallback: string): string {
    const attr = getJsxAttr(opening, 'data-flint-id')
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

// ── Tag name ──────────────────────────────────────────────────────────────────

/**
 * Returns the lowercase tag name of a JSXElement, or null for member expressions
 * (component references like `<Foo.Bar>`).
 */
export function getTagName(path: NodePath<JSXElement>): string | null {
    const nameNode = path.node.openingElement.name
    if (nameNode.type === 'JSXIdentifier') return nameNode.name.toLowerCase()
    return null
}

/**
 * Returns true if the tag name starts with a lowercase letter (HTML element).
 * Component names start with uppercase.
 */
export function isHtmlElement(path: NodePath<JSXElement>): boolean {
    const tag = getTagName(path)
    if (!tag) return false
    return tag[0] === tag[0].toLowerCase() && tag[0] !== tag[0].toUpperCase()
}

// ── Child element checking ────────────────────────────────────────────────────

/**
 * Returns true if the JSXElement has a direct child element with the given tag name.
 */
export function hasDirectChildTag(path: NodePath<JSXElement>, tagName: string): boolean {
    return path.node.children.some(
        (child) =>
            child.type === 'JSXElement' &&
            child.openingElement.name.type === 'JSXIdentifier' &&
            child.openingElement.name.name.toLowerCase() === tagName.toLowerCase(),
    )
}

// ── ARIA role ─────────────────────────────────────────────────────────────────

/**
 * Returns the explicit `role` attribute value, or null if not present.
 */
export function getExplicitRole(opening: JSXOpeningElement): string | null {
    return getAttributeStringValue(opening, 'role')
}

/**
 * Returns the implicit ARIA role for a given HTML tag name.
 * Based on WAI-ARIA 1.2 implicit role mappings.
 */
export function getImplicitRole(tag: string): string | null {
    const implicitRoles: Record<string, string> = {
        a: 'link',
        area: 'link',
        article: 'article',
        aside: 'complementary',
        button: 'button',
        datalist: 'listbox',
        details: 'group',
        dialog: 'dialog',
        fieldset: 'group',
        figure: 'figure',
        footer: 'contentinfo',
        form: 'form',
        h1: 'heading',
        h2: 'heading',
        h3: 'heading',
        h4: 'heading',
        h5: 'heading',
        h6: 'heading',
        header: 'banner',
        hr: 'separator',
        img: 'img',
        input: 'textbox', // simplified — type-specific
        li: 'listitem',
        link: 'link',
        main: 'main',
        math: 'math',
        menu: 'list',
        nav: 'navigation',
        ol: 'list',
        option: 'option',
        output: 'status',
        progress: 'progressbar',
        section: 'region',
        select: 'listbox',
        summary: 'button',
        table: 'table',
        tbody: 'rowgroup',
        td: 'cell',
        textarea: 'textbox',
        tfoot: 'rowgroup',
        th: 'columnheader',
        thead: 'rowgroup',
        tr: 'row',
        ul: 'list',
    }
    return implicitRoles[tag] ?? null
}

// ── Focus / interactive ───────────────────────────────────────────────────────

/**
 * Returns true if the element is inherently focusable based on its tag.
 */
export function isNativelyFocusable(tag: string): boolean {
    return ['a', 'button', 'input', 'select', 'textarea', 'details', 'summary'].includes(tag)
}

/**
 * Returns true if the element has `aria-hidden="true"`.
 */
export function isAriaHidden(opening: JSXOpeningElement): boolean {
    const val = getAttributeStringValue(opening, 'aria-hidden')
    return val === 'true'
}

// ── Event handler detection ───────────────────────────────────────────────────

/**
 * Returns true if the opening element has the given event handler prop.
 */
export function hasEventHandler(opening: JSXOpeningElement, eventName: string): boolean {
    return opening.attributes.some(
        (a) =>
            a.type === 'JSXAttribute' &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === eventName,
    )
}
