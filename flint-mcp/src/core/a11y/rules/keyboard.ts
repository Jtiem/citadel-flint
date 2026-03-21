/**
 * Keyboard rules — flint-mcp/src/core/a11y/rules/keyboard.ts
 *
 * A11Y-007 (migrated): tabIndex > 0 disrupts tab order
 * A11Y-020 (new): Non-interactive elements with onClick must have role/tabIndex/onKeyDown
 * A11Y-021 (new): Mouse-only event handlers must have keyboard equivalents
 * A11Y-022 (new): Focus indicator must not be removed via outline: none/0
 *
 * WCAG: 2.4.3 Focus Order, 2.1.1 Keyboard, 2.4.7 Focus Visible
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeStringValue,
    hasNonEmptyAttr,
    hasEventHandler,
} from '../helpers.js'

// Non-interactive HTML tags that become interactive when given onClick
const NON_INTERACTIVE_TAGS = new Set(['div', 'span', 'p', 'li', 'td', 'th', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav'])

// ── A11Y-007: tabIndex > 0 disrupts tab order ─────────────────────────────────

const rule007: A11yRule = {
    id: 'A11Y-007',
    name: 'Positive TabIndex',
    wcag: '2.4.3',
    level: 'A',
    category: 'keyboard',
    severity: 'critical',
    description: 'tabIndex > 0 disrupts the natural tab order.',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        const tabIndexAttr = getJsxAttr(opening, 'tabIndex')
        if (!tabIndexAttr || tabIndexAttr.type !== 'JSXAttribute') return null

        const val = tabIndexAttr.value
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

        if (numericVal === null || numericVal <= 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-tabindex-positive`)

        return {
            ruleId: 'A11Y-007',
            elementId,
            message:
                `A11Y-007: tabIndex="${numericVal}" disrupts natural tab order. ` +
                'Use tabIndex={0} to include in natural order, or tabIndex={-1} to remove from flow.',
            severity: 'critical',
            wcag: '2.4.3',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Set tabIndex to 0 to restore natural tab order.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'tabIndex',
                        value: '0',
                    },
                },
            ],
        }
    },
}

// ── A11Y-020: Non-interactive with click must have role + tabIndex + onKeyDown ─

const rule020: A11yRule = {
    id: 'A11Y-020',
    name: 'Non-Interactive Element With Click Handler',
    wcag: '2.1.1',
    level: 'A',
    category: 'keyboard',
    severity: 'critical',
    description:
        'Non-interactive elements (div, span, etc.) with onClick must have role, tabIndex, and onKeyDown for keyboard accessibility.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !NON_INTERACTIVE_TAGS.has(tag)) return null

        const opening = path.node.openingElement

        const hasOnClick = hasEventHandler(opening, 'onClick')
        if (!hasOnClick) return null

        const hasRole = hasNonEmptyAttr(opening, 'role')
        const hasTabIndex = getJsxAttr(opening, 'tabIndex') !== undefined
        const hasOnKeyDown = hasEventHandler(opening, 'onKeyDown')
        const hasOnKeyPress = hasEventHandler(opening, 'onKeyPress')

        if (hasRole && hasTabIndex && (hasOnKeyDown || hasOnKeyPress)) return null

        const elementId = getFlintId(opening, `${tag}-click-no-keyboard`)

        const missing: string[] = []
        if (!hasRole) missing.push('role')
        if (!hasTabIndex) missing.push('tabIndex')
        if (!hasOnKeyDown && !hasOnKeyPress) missing.push('onKeyDown')

        return {
            ruleId: 'A11Y-020',
            elementId,
            message:
                `A11Y-020: <${tag}> has onClick but is missing: ${missing.join(', ')}. ` +
                'Non-interactive elements with click handlers must be keyboard accessible. ' +
                'Add role="button" tabIndex={0} and onKeyDown for keyboard support.',
            severity: 'critical',
            wcag: '2.1.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added role="button" and tabIndex={0} to make clickable element keyboard accessible.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'role',
                        value: 'button',
                    },
                },
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'tabIndex',
                        value: '0',
                    },
                },
            ],
        }
    },
}

// ── A11Y-021: Mouse-only handlers must have keyboard equivalents ──────────────

const MOUSE_ONLY_HANDLERS = ['onMouseDown', 'onMouseUp', 'onMouseOver']
const KEYBOARD_EQUIVALENTS: Record<string, string> = {
    onMouseDown: 'onKeyDown',
    onMouseUp: 'onKeyUp',
    onMouseOver: 'onFocus',
}

const rule021: A11yRule = {
    id: 'A11Y-021',
    name: 'Mouse-Only Event Handler',
    wcag: '2.1.1',
    level: 'A',
    category: 'keyboard',
    severity: 'critical',
    description: 'Mouse-only event handlers must have keyboard equivalents.',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        const violatingHandlers: string[] = []

        for (const handler of MOUSE_ONLY_HANDLERS) {
            if (!hasEventHandler(opening, handler)) continue
            const keyboardEquiv = KEYBOARD_EQUIVALENTS[handler]
            if (keyboardEquiv && hasEventHandler(opening, keyboardEquiv)) continue
            violatingHandlers.push(handler)
        }

        if (violatingHandlers.length === 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-mouse-only`)

        const suggestions = violatingHandlers
            .map((h) => `${h} → add ${KEYBOARD_EQUIVALENTS[h]}`)
            .join(', ')

        return {
            ruleId: 'A11Y-021',
            elementId,
            message:
                `A11Y-021: <${tag}> has mouse-only handlers (${violatingHandlers.join(', ')}) without keyboard equivalents. ` +
                `Add keyboard handlers: ${suggestions}.`,
            severity: 'critical',
            wcag: '2.1.1',
            fixable: false,
        }
    },
}

// ── A11Y-022: Must not remove focus indicator ─────────────────────────────────

const rule022: A11yRule = {
    id: 'A11Y-022',
    name: 'Focus Indicator Removed',
    wcag: '2.4.7',
    level: 'AA',
    category: 'keyboard',
    severity: 'critical',
    description: 'Elements must not remove the focus indicator via outline: none or outline: 0.',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        // Check className for Tailwind focus:outline-none or outline-none
        const classNameAttr = getAttributeStringValue(opening, 'className')
        if (classNameAttr) {
            const classes = classNameAttr.split(/\s+/)
            const hasFocusOutlineNone = classes.some(
                (c) =>
                    c === 'outline-none' ||
                    c === 'focus:outline-none' ||
                    c === 'outline-0' ||
                    c === 'focus:outline-0',
            )
            if (hasFocusOutlineNone) {
                // Check if there's a replacement focus style (focus:ring-*, focus:border-*, etc.)
                const hasFocusReplacement = classes.some(
                    (c) =>
                        c.startsWith('focus:ring') ||
                        c.startsWith('focus:border') ||
                        c.startsWith('focus:shadow') ||
                        c.startsWith('focus-visible:'),
                )
                if (!hasFocusReplacement) {
                    const tag = getTagName(path) ?? 'element'
                    const elementId = getFlintId(opening, `${tag}-no-focus-indicator`)
                    return {
                        ruleId: 'A11Y-022',
                        elementId,
                        message:
                            `A11Y-022: <${tag}> removes focus indicator (outline-none) without a replacement. ` +
                            'Add focus:ring-* or focus-visible:* styles to provide a visible focus indicator.',
                        severity: 'critical',
                        wcag: '2.4.7',
                        fixable: false,
                    }
                }
            }
        }

        // Check inline style for outline: none/0
        const styleAttr = getJsxAttr(opening, 'style')
        if (styleAttr?.type === 'JSXAttribute' && styleAttr.value) {
            // We only check static string literals; object expressions are dynamic
            if (styleAttr.value.type === 'StringLiteral') {
                const style = styleAttr.value.value.toLowerCase()
                if (style.includes('outline') && (style.includes('none') || style.includes(': 0'))) {
                    const tag = getTagName(path) ?? 'element'
                    const elementId = getFlintId(opening, `${tag}-style-no-focus`)
                    return {
                        ruleId: 'A11Y-022',
                        elementId,
                        message:
                            `A11Y-022: <${tag}> may remove focus indicator via inline style. ` +
                            'Ensure a visible focus indicator is provided.',
                        severity: 'critical',
                        wcag: '2.4.7',
                        fixable: false,
                    }
                }
            }
        }

        return null
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const keyboardRules: A11yRule[] = [rule007, rule020, rule021, rule022]
