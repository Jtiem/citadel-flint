/**
 * ARIA rules — bridge-mcp/src/core/a11y/rules/aria.ts
 *
 * A11Y-030: Role value must be a valid WAI-ARIA role
 * A11Y-031: Required ARIA children must be present
 * A11Y-032: Element must be inside required ARIA parent
 * A11Y-033: Required ARIA attributes must be present
 * A11Y-034: ARIA attribute names must be valid
 * A11Y-035: ARIA attribute values must match allowed types
 * A11Y-036: aria-hidden="true" must not be on focusable elements
 * A11Y-037: No duplicate ARIA attributes
 * A11Y-038: Interactive elements must not have role="presentation" or role="none"
 *
 * WCAG: 4.1.2 Name, Role, Value
 *
 * WAI-ARIA 1.2 spec reference (static lookup table).
 * Version: WAI-ARIA 1.2, W3C Recommendation 6 June 2023
 */

import type { A11yRule } from '../types.js'
import {
    getBridgeId,
    getTagName,
    getJsxAttr,
    getAttributeValue,
    getAttributeStringValue,
    isNativelyFocusable,
    hasEventHandler,
    hasDynamicLabel,
} from '../helpers.js'

// ── WAI-ARIA 1.2 Valid Role List ──────────────────────────────────────────────

const VALID_ARIA_ROLES = new Set([
    'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote',
    'button', 'caption', 'cell', 'checkbox', 'code', 'columnheader', 'combobox',
    'complementary', 'contentinfo', 'definition', 'deletion', 'dialog', 'directory',
    'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid',
    'gridcell', 'group', 'heading', 'img', 'insertion', 'link', 'list',
    'listbox', 'listitem', 'log', 'main', 'mark', 'marquee', 'math',
    'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter',
    'navigation', 'none', 'note', 'option', 'paragraph', 'presentation',
    'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
    'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider',
    'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch',
    'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer',
    'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
])

// ── Required children by role ─────────────────────────────────────────────────

const REQUIRED_CHILDREN: Record<string, string[]> = {
    list: ['listitem'],
    listbox: ['option'],
    menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
    menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
    radiogroup: ['radio'],
    row: ['cell', 'columnheader', 'gridcell', 'rowheader'],
    rowgroup: ['row'],
    table: ['row', 'rowgroup'],
    tablist: ['tab'],
    tree: ['treeitem'],
    treegrid: ['row'],
}

// ── Required parent roles ─────────────────────────────────────────────────────

const REQUIRED_PARENT: Record<string, string[]> = {
    caption: ['grid', 'table', 'treegrid'],
    cell: ['row'],
    columnheader: ['row'],
    gridcell: ['row'],
    listitem: ['list', 'directory'],
    menuitem: ['menu', 'menubar'],
    menuitemcheckbox: ['menu', 'menubar'],
    menuitemradio: ['menu', 'menubar'],
    option: ['listbox'],
    row: ['grid', 'rowgroup', 'table', 'treegrid'],
    rowheader: ['row'],
    tab: ['tablist'],
    treeitem: ['group', 'tree'],
}

// ── Required ARIA attributes by role ─────────────────────────────────────────

interface RequiredAttrSpec {
    attr: string
    defaultValue: string
}

const REQUIRED_ATTRS: Record<string, RequiredAttrSpec[]> = {
    checkbox: [{ attr: 'aria-checked', defaultValue: 'false' }],
    combobox: [{ attr: 'aria-expanded', defaultValue: 'false' }],
    heading: [{ attr: 'aria-level', defaultValue: '2' }],
    meter: [{ attr: 'aria-valuenow', defaultValue: '0' }],
    option: [{ attr: 'aria-selected', defaultValue: 'false' }],
    radio: [{ attr: 'aria-checked', defaultValue: 'false' }],
    scrollbar: [
        { attr: 'aria-valuenow', defaultValue: '0' },
        { attr: 'aria-valuemin', defaultValue: '0' },
        { attr: 'aria-valuemax', defaultValue: '100' },
        { attr: 'aria-orientation', defaultValue: 'vertical' },
        { attr: 'aria-controls', defaultValue: '' },
    ],
    separator: [{ attr: 'aria-valuenow', defaultValue: '0' }],
    slider: [
        { attr: 'aria-valuenow', defaultValue: '0' },
        { attr: 'aria-valuemin', defaultValue: '0' },
        { attr: 'aria-valuemax', defaultValue: '100' },
    ],
    spinbutton: [{ attr: 'aria-valuenow', defaultValue: '0' }],
    switch: [{ attr: 'aria-checked', defaultValue: 'false' }],
    tab: [{ attr: 'aria-selected', defaultValue: 'false' }],
}

// ── Valid ARIA attribute names (WAI-ARIA 1.2 global + state/property list) ───

const VALID_ARIA_ATTRS = new Set([
    'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-braillelabel',
    'aria-brailleroledescription', 'aria-busy', 'aria-checked', 'aria-colcount',
    'aria-colindex', 'aria-colindextext', 'aria-colspan', 'aria-controls',
    'aria-current', 'aria-describedby', 'aria-description', 'aria-details',
    'aria-disabled', 'aria-dropeffect', 'aria-errormessage', 'aria-expanded',
    'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden',
    'aria-invalid', 'aria-keyshortcuts', 'aria-label', 'aria-labelledby',
    'aria-level', 'aria-live', 'aria-modal', 'aria-multiline',
    'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
    'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant',
    'aria-required', 'aria-roledescription', 'aria-rowcount', 'aria-rowindex',
    'aria-rowindextext', 'aria-rowspan', 'aria-selected', 'aria-setsize',
    'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow',
    'aria-valuetext',
])

// ── A11Y-030: Role must be valid ──────────────────────────────────────────────

const rule030: A11yRule = {
    id: 'A11Y-030',
    name: 'Invalid ARIA Role',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'role attribute must be a valid WAI-ARIA role.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const roleAttr = getJsxAttr(opening, 'role')
        if (!roleAttr) return null
        if (roleAttr.type !== 'JSXAttribute') return null

        const roleVal = getAttributeValue(roleAttr)
        if (roleVal === null) return null // dynamic — skip

        const roles = roleVal.trim().split(/\s+/)
        const invalidRoles = roles.filter((r) => r && !VALID_ARIA_ROLES.has(r))

        if (invalidRoles.length === 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-invalid-role`)

        return {
            ruleId: 'A11Y-030',
            elementId,
            message:
                `A11Y-030: role="${roleVal}" contains invalid WAI-ARIA role(s): ${invalidRoles.join(', ')}. ` +
                'Use a valid WAI-ARIA 1.2 role.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Removed invalid role attribute.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'role',
                        value: null,
                    },
                },
            ],
        }
    },
}

// ── A11Y-031: Required ARIA children must be present ─────────────────────────

const rule031: A11yRule = {
    id: 'A11Y-031',
    name: 'Required ARIA Children Missing',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'Elements with certain ARIA roles must have required child roles present.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (!roleVal) return null

        const requiredChildren = REQUIRED_CHILDREN[roleVal.trim()]
        if (!requiredChildren) return null

        // Check if any child has one of the required roles
        const hasRequiredChild = path.node.children.some((child) => {
            if (child.type !== 'JSXElement') return false
            const childOpening = child.openingElement
            const childRole = getAttributeValue(
                childOpening.attributes.find(
                    (a) =>
                        a.type === 'JSXAttribute' &&
                        a.name.type === 'JSXIdentifier' &&
                        a.name.name === 'role',
                ),
            )
            return childRole && requiredChildren.includes(childRole.trim())
        })

        if (hasRequiredChild) return null
        // Also skip if there are expression containers (dynamic children — could have required roles)
        const hasDynamicChildren = path.node.children.some(
            (c) => c.type === 'JSXExpressionContainer',
        )
        if (hasDynamicChildren) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-missing-required-children`)

        return {
            ruleId: 'A11Y-031',
            elementId,
            message:
                `A11Y-031: role="${roleVal}" requires child elements with role="${requiredChildren.join('" or "')}" but none were found.`,
            severity: 'critical',
            wcag: '4.1.2',
            fixable: false,
        }
    },
}

// ── A11Y-032: Element must be inside required ARIA parent ─────────────────────

const rule032: A11yRule = {
    id: 'A11Y-032',
    name: 'Element Outside Required ARIA Parent',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'Elements with certain ARIA roles must be inside a required parent role.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (!roleVal) return null

        const requiredParents = REQUIRED_PARENT[roleVal.trim()]
        if (!requiredParents) return null

        // Walk up the parent chain to find a matching role
        let parentPath = path.parentPath
        let hasRequiredParent = false

        while (parentPath) {
            if (parentPath.node.type === 'JSXElement') {
                const parentOpening = (parentPath.node as import('@babel/types').JSXElement).openingElement
                const parentRole = getAttributeValue(
                    parentOpening.attributes.find(
                        (a) =>
                            a.type === 'JSXAttribute' &&
                            a.name.type === 'JSXIdentifier' &&
                            a.name.name === 'role',
                    ),
                )
                if (parentRole && requiredParents.includes(parentRole.trim())) {
                    hasRequiredParent = true
                    break
                }
            }
            parentPath = parentPath.parentPath
        }

        if (hasRequiredParent) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-wrong-parent`)

        return {
            ruleId: 'A11Y-032',
            elementId,
            message:
                `A11Y-032: role="${roleVal}" must be inside an element with role="${requiredParents.join('" or "')}".`,
            severity: 'critical',
            wcag: '4.1.2',
            fixable: false,
        }
    },
}

// ── A11Y-033: Required ARIA attributes must be present ────────────────────────

const rule033: A11yRule = {
    id: 'A11Y-033',
    name: 'Required ARIA Attribute Missing',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'Elements with certain ARIA roles must have required ARIA attributes.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (!roleVal) return null

        const requiredAttrs = REQUIRED_ATTRS[roleVal.trim()]
        if (!requiredAttrs) return null

        const missingAttrs: RequiredAttrSpec[] = []
        for (const spec of requiredAttrs) {
            const attr = getJsxAttr(opening, spec.attr)
            if (!attr) {
                // Only flag if not a dynamic expression either
                missingAttrs.push(spec)
            }
        }

        if (missingAttrs.length === 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-missing-required-attrs`)
        const missing = missingAttrs.map((s) => s.attr).join(', ')

        return {
            ruleId: 'A11Y-033',
            elementId,
            message:
                `A11Y-033: role="${roleVal}" requires attributes: ${missing}. ` +
                'Add the required ARIA attributes to fully describe the widget state.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        // Extract role from the message to look up required attrs
        const roleMatch = /role="([^"]+)"/.exec(violation.message)
        const role = roleMatch?.[1]
        if (!role) return null

        const requiredAttrs = REQUIRED_ATTRS[role]
        if (!requiredAttrs) return null

        return {
            description: `Added required ARIA attributes for role="${role}".`,
            mutations: requiredAttrs.map((spec) => ({
                type: 'updateProp' as const,
                args: {
                    nodeId: violation.elementId,
                    propName: spec.attr,
                    value: spec.defaultValue,
                },
            })),
        }
    },
}

// ── A11Y-034: ARIA attribute names must be valid ──────────────────────────────

const rule034: A11yRule = {
    id: 'A11Y-034',
    name: 'Invalid ARIA Attribute Name',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'ARIA attribute names must be valid WAI-ARIA attributes.',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        const invalidAttrs: string[] = []
        for (const attr of opening.attributes) {
            if (attr.type !== 'JSXAttribute') continue
            if (attr.name.type !== 'JSXIdentifier') continue
            const name = attr.name.name
            if (!name.startsWith('aria-')) continue
            if (!VALID_ARIA_ATTRS.has(name)) {
                invalidAttrs.push(name)
            }
        }

        if (invalidAttrs.length === 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-invalid-aria-attr`)

        return {
            ruleId: 'A11Y-034',
            elementId,
            message:
                `A11Y-034: <${tag}> has invalid ARIA attribute(s): ${invalidAttrs.join(', ')}. ` +
                'Check for typos — common errors: "aria-lable" → "aria-label", "aria-labelby" → "aria-labelledby".',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        // Extract invalid attrs from message and remove them
        const attrMatch = /invalid ARIA attribute\(s\): ([^\n.]+)\./.exec(violation.message)
        if (!attrMatch) return null

        const invalidAttrs = attrMatch[1].split(',').map((s) => s.trim())
        return {
            description: `Removed invalid ARIA attribute(s): ${invalidAttrs.join(', ')}.`,
            mutations: invalidAttrs.map((attrName) => ({
                type: 'updateProp' as const,
                args: {
                    nodeId: violation.elementId,
                    propName: attrName,
                    value: null,
                },
            })),
        }
    },
}

// ── A11Y-035: ARIA attribute values must be valid ─────────────────────────────

const ARIA_VALUE_TYPES: Record<string, 'boolean' | 'tristate' | 'token' | 'string' | 'integer'> = {
    'aria-atomic': 'boolean',
    'aria-busy': 'boolean',
    'aria-checked': 'tristate',
    'aria-current': 'token', // false | true | page | step | location | date | time
    'aria-disabled': 'boolean',
    'aria-expanded': 'boolean',
    'aria-grabbed': 'boolean',
    'aria-hidden': 'boolean',
    'aria-invalid': 'token', // false | true | grammar | spelling
    'aria-modal': 'boolean',
    'aria-multiline': 'boolean',
    'aria-multiselectable': 'boolean',
    'aria-pressed': 'tristate',
    'aria-readonly': 'boolean',
    'aria-required': 'boolean',
    'aria-selected': 'boolean',
}

const BOOLEAN_VALUES = new Set(['true', 'false'])
const TRISTATE_VALUES = new Set(['true', 'false', 'mixed', 'undefined'])
const ARIA_CURRENT_VALUES = new Set(['false', 'true', 'page', 'step', 'location', 'date', 'time'])
const ARIA_INVALID_VALUES = new Set(['false', 'true', 'grammar', 'spelling'])

const rule035: A11yRule = {
    id: 'A11Y-035',
    name: 'Invalid ARIA Attribute Value',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'ARIA attribute values must match allowed types.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const violations: string[] = []

        for (const attr of opening.attributes) {
            if (attr.type !== 'JSXAttribute') continue
            if (attr.name.type !== 'JSXIdentifier') continue
            const name = attr.name.name
            if (!name.startsWith('aria-')) continue

            const val = getAttributeValue(attr)
            if (val === null) continue // dynamic — skip

            const valueType = ARIA_VALUE_TYPES[name]
            if (!valueType) continue

            if (valueType === 'boolean' && !BOOLEAN_VALUES.has(val)) {
                violations.push(`${name}="${val}" (must be "true" or "false")`)
            } else if (valueType === 'tristate' && !TRISTATE_VALUES.has(val)) {
                violations.push(`${name}="${val}" (must be "true", "false", "mixed", or "undefined")`)
            } else if (name === 'aria-current' && !ARIA_CURRENT_VALUES.has(val)) {
                violations.push(`${name}="${val}" (must be page | step | location | date | time | true | false)`)
            } else if (name === 'aria-invalid' && !ARIA_INVALID_VALUES.has(val)) {
                violations.push(`${name}="${val}" (must be true | false | grammar | spelling)`)
            }
        }

        if (violations.length === 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-invalid-aria-value`)

        return {
            ruleId: 'A11Y-035',
            elementId,
            message:
                `A11Y-035: <${tag}> has invalid ARIA attribute value(s): ${violations.join('; ')}.`,
            severity: 'critical',
            wcag: '4.1.2',
            fixable: false,
        }
    },
}

// ── A11Y-036: aria-hidden must not be on focusable elements ──────────────────

const rule036: A11yRule = {
    id: 'A11Y-036',
    name: 'Aria-Hidden On Focusable Element',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'aria-hidden="true" must not be applied to focusable elements.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const ariaHiddenVal = getAttributeValue(getJsxAttr(opening, 'aria-hidden'))
        if (ariaHiddenVal !== 'true') return null

        const tag = getTagName(path) ?? ''
        const isNativeFocusable = isNativelyFocusable(tag)
        const hasTabIndex = getJsxAttr(opening, 'tabIndex') !== undefined
        const hasHref = getJsxAttr(opening, 'href') !== undefined

        if (!isNativeFocusable && !hasTabIndex && !hasHref) return null

        // Check if explicitly tabIndex={-1} (removed from flow — acceptable)
        const tabIndexAttr = getJsxAttr(opening, 'tabIndex')
        if (tabIndexAttr?.type === 'JSXAttribute') {
            const val = getAttributeValue(tabIndexAttr)
            if (val === '-1') return null
            // Also handle JSXExpressionContainer with NumericLiteral -1
            const attrVal = tabIndexAttr.value
            if (
                attrVal?.type === 'JSXExpressionContainer' &&
                attrVal.expression.type === 'UnaryExpression' &&
                attrVal.expression.operator === '-' &&
                attrVal.expression.argument.type === 'NumericLiteral' &&
                attrVal.expression.argument.value === 1
            ) {
                return null
            }
            if (
                attrVal?.type === 'JSXExpressionContainer' &&
                attrVal.expression.type === 'NumericLiteral' &&
                attrVal.expression.value === -1
            ) {
                return null
            }
        }

        const elementId = getBridgeId(opening, `${tag}-aria-hidden-focusable`)

        return {
            ruleId: 'A11Y-036',
            elementId,
            message:
                `A11Y-036: <${tag}> has aria-hidden="true" but is a focusable element. ` +
                'Focusable elements with aria-hidden will still be reachable by keyboard users but invisible to AT. ' +
                'Remove aria-hidden or add tabIndex={-1}.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Removed aria-hidden from focusable element.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-hidden',
                        value: null,
                    },
                },
            ],
        }
    },
}

// ── A11Y-037: No duplicate ARIA attributes ────────────────────────────────────

const rule037: A11yRule = {
    id: 'A11Y-037',
    name: 'Duplicate ARIA Attributes',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'Elements must not have duplicate ARIA attributes.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const seen = new Map<string, number>()

        for (const attr of opening.attributes) {
            if (attr.type !== 'JSXAttribute') continue
            if (attr.name.type !== 'JSXIdentifier') continue
            const name = attr.name.name
            if (!name.startsWith('aria-')) continue
            seen.set(name, (seen.get(name) ?? 0) + 1)
        }

        const duplicates = Array.from(seen.entries())
            .filter(([, count]) => count > 1)
            .map(([name]) => name)

        if (duplicates.length === 0) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getBridgeId(opening, `${tag}-duplicate-aria`)

        return {
            ruleId: 'A11Y-037',
            elementId,
            message:
                `A11Y-037: <${tag}> has duplicate ARIA attribute(s): ${duplicates.join(', ')}. ` +
                'Remove duplicate attributes — only the last value will be used by ATs.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        const attrMatch = /duplicate ARIA attribute\(s\): ([^\n.]+)\./.exec(violation.message)
        if (!attrMatch) return null

        const duplicates = attrMatch[1].split(',').map((s) => s.trim())
        return {
            description: `Removed duplicate ARIA attribute(s): ${duplicates.join(', ')}.`,
            mutations: duplicates.map((attrName) => ({
                type: 'updateProp' as const,
                args: {
                    nodeId: violation.elementId,
                    propName: attrName,
                    value: null,
                },
            })),
        }
    },
}

// ── A11Y-038: Interactive elements must not have role=presentation/none ───────

const INTERACTIVE_TAGS = new Set(['input', 'select', 'textarea', 'button', 'a'])

const rule038: A11yRule = {
    id: 'A11Y-038',
    name: 'Interactive Element With Presentation Role',
    wcag: '4.1.2',
    level: 'A',
    category: 'aria',
    severity: 'critical',
    description: 'Interactive elements must not have role="presentation" or role="none".',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !INTERACTIVE_TAGS.has(tag)) return null

        const opening = path.node.openingElement
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (!roleVal) return null

        if (roleVal !== 'presentation' && roleVal !== 'none') return null

        const elementId = getBridgeId(opening, `${tag}-presentation-role`)

        return {
            ruleId: 'A11Y-038',
            elementId,
            message:
                `A11Y-038: <${tag}> has role="${roleVal}" but is an interactive element. ` +
                'Interactive elements must not use role="presentation" or role="none" as it removes their semantic meaning from the accessibility tree.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Removed presentation/none role from interactive element.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'role',
                        value: null,
                    },
                },
            ],
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const ariaRules: A11yRule[] = [
    rule030,
    rule031,
    rule032,
    rule033,
    rule034,
    rule035,
    rule036,
    rule037,
    rule038,
]
