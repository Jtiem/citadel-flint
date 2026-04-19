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
    appliesTo: 'any', // FIXTURE.1: component-safe
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
    appliesTo: 'any', // FIXTURE.1: component-safe
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
    appliesTo: 'any', // FIXTURE.1: component-safe
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
    appliesTo: 'any', // FIXTURE.1: component-safe
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

// ── A11Y-100: Interactive handler on non-interactive element (P1b) ───────────
//
// Flags <div onClick={...}>, <span onMouseDown={...}>, etc. where a non-interactive
// element has an event handler but lacks role and tabIndex. Unlike A11Y-020 which
// requires all three (role + tabIndex + onKeyDown), this rule focuses on the minimum
// semantic contract: the element must at least declare itself interactive via role
// OR tabIndex. This catches the broadest class of "clickable div" anti-patterns.

/** Interactive ARIA roles that indicate the element is intentionally interactive. */
const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
    'option', 'radio', 'switch', 'checkbox', 'combobox', 'searchbox',
    'slider', 'spinbutton', 'textbox', 'treeitem', 'gridcell', 'row',
])

/** Event handlers that make a non-interactive element behave interactively. */
const INTERACTIVE_HANDLERS = ['onClick', 'onMouseDown', 'onKeyDown', 'onKeyUp', 'onKeyPress']

/** HTML elements that are inherently interactive and should not be flagged. */
const NATIVELY_INTERACTIVE_TAGS = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'details', 'summary', 'option',
])

const rule100: A11yRule = {
    id: 'A11Y-100',
    name: 'Interactive Handler on Non-Interactive Element',
    wcag: '4.1.2',
    level: 'A',
    category: 'keyboard',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description:
        'Non-interactive elements (div, span, section, etc.) with event handlers like onClick must ' +
        'have a semantic role (e.g. role="button") and tabIndex to be accessible. ' +
        'Without these, keyboard and screen reader users cannot interact with the element.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag) return null

        // Skip natively interactive elements — they already have implicit roles
        if (NATIVELY_INTERACTIVE_TAGS.has(tag)) return null

        // Skip custom React components (uppercase first letter handled by getTagName returning null for member expressions)
        // getTagName returns lowercase, so PascalCase components are already filtered

        const opening = path.node.openingElement

        // Check for any interactive event handler
        const hasInteractiveHandler = INTERACTIVE_HANDLERS.some(
            (handler) => hasEventHandler(opening, handler),
        )
        if (!hasInteractiveHandler) return null

        // Check if the element has an interactive role
        const roleValue = getAttributeStringValue(opening, 'role')
        if (roleValue && INTERACTIVE_ROLES.has(roleValue.toLowerCase())) return null

        // Check if the element has tabIndex (any value — even -1 shows developer awareness)
        const hasTabIndex = getJsxAttr(opening, 'tabIndex') !== undefined
        if (hasTabIndex) return null

        const elementId = getFlintId(opening, `${tag}-interactive-no-role`)

        // Determine which handlers are present for the message
        const presentHandlers = INTERACTIVE_HANDLERS.filter(
            (handler) => hasEventHandler(opening, handler),
        )

        return {
            ruleId: 'A11Y-100',
            elementId,
            message:
                `A11Y-100: <${tag}> has interactive handler(s) (${presentHandlers.join(', ')}) but no ` +
                'semantic role or tabIndex. Non-interactive elements with event handlers must declare ' +
                'their role (e.g. role="button") and be keyboard-focusable (tabIndex={0}), or be ' +
                'replaced with a native interactive element like <button>.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description:
                'Added role="button" and tabIndex={0} to make the non-interactive element accessible. ' +
                'Consider replacing with a <button> element for better semantics.',
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

// ── Export ────────────────────────────────────────────────────────────────────

export const keyboardRules: A11yRule[] = [rule007, rule020, rule021, rule022, rule100]
