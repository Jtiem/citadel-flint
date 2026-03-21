/**
 * Names and Labels rules — flint-mcp/src/core/a11y/rules/names-labels.ts
 *
 * A11Y-001 through A11Y-006 (migrated from A11yLinter)
 * A11Y-011 through A11Y-014 (new)
 *
 * WCAG: 1.1.1 Non-text Content, 4.1.2 Name/Role/Value, 2.4.4 Link Purpose
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeValue,
    getAttributeStringValue,
    hasNonEmptyAttr,
    hasDynamicLabel,
    hasTextChildren,
} from '../helpers.js'

// Generic names that indicate a generic/problematic alt text pattern
const FILENAME_PATTERN = /\.(png|jpg|jpeg|gif|svg|webp|avif|bmp|ico)$/i
const GENERIC_LINK_TEXTS = new Set([
    'click here', 'here', 'read more', 'more', 'learn more',
    'link', 'this link', 'click', 'details', 'info', 'information',
])

// ── A11Y-001: <img> must have alt ─────────────────────────────────────────────

const rule001: A11yRule = {
    id: 'A11Y-001',
    name: 'Image Missing Alt Text',
    wcag: '1.1.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<img> elements must have an alt attribute.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'img') return null

        const opening = path.node.openingElement
        const altAttr = getJsxAttr(opening, 'alt')
        if (altAttr !== undefined) return null // has alt (even empty is OK)

        const elementId = getFlintId(opening, `img-missing-alt`)
        return {
            ruleId: 'A11Y-001',
            elementId,
            message:
                'A11Y-001: <img> is missing an `alt` attribute. ' +
                'Add alt="" for decorative images or a descriptive string for informational ones.',
            severity: 'critical',
            wcag: '1.1.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added alt="" to decorative <img>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'alt',
                        value: '',
                    },
                },
            ],
        }
    },
}

// ── A11Y-002: <button> must have accessible name ──────────────────────────────

const rule002: A11yRule = {
    id: 'A11Y-002',
    name: 'Button Missing Accessible Name',
    wcag: '4.1.2',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<button> elements must have an accessible name.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'button') return null

        const opening = path.node.openingElement
        if (hasDynamicLabel(opening)) return null

        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasTitle = hasNonEmptyAttr(opening, 'title')
        const hasText = hasTextChildren(path)
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')

        if (hasAriaLabel || hasTitle || hasText || hasAriaLabelledBy) return null

        const elementId = getFlintId(opening, 'button-no-name')
        return {
            ruleId: 'A11Y-002',
            elementId,
            message:
                'A11Y-002: <button> has no accessible name. ' +
                'Add text content, aria-label="…", or title="…".',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added placeholder aria-label to <button>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-label',
                        value: '[NEEDS LABEL]',
                    },
                },
            ],
        }
    },
}

// ── A11Y-003: <a> must have accessible name ───────────────────────────────────

const rule003: A11yRule = {
    id: 'A11Y-003',
    name: 'Link Missing Accessible Name',
    wcag: '4.1.2',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<a> elements must have an accessible name.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'a') return null

        const opening = path.node.openingElement
        if (hasDynamicLabel(opening)) return null

        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasTitle = hasNonEmptyAttr(opening, 'title')
        const hasText = hasTextChildren(path)
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')

        if (hasAriaLabel || hasTitle || hasText || hasAriaLabelledBy) return null

        const elementId = getFlintId(opening, 'a-no-name')
        return {
            ruleId: 'A11Y-003',
            elementId,
            message:
                'A11Y-003: <a> has no accessible name. ' +
                'Add text content, aria-label="…", or title="…".',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added placeholder aria-label to <a>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-label',
                        value: '[NEEDS LABEL]',
                    },
                },
            ],
        }
    },
}

// ── A11Y-004: <input> must have programmatic label ────────────────────────────

const rule004: A11yRule = {
    id: 'A11Y-004',
    name: 'Input Missing Label',
    wcag: '1.3.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<input> elements must have a programmatic label.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement
        if (hasDynamicLabel(opening)) return null

        const hasId = hasNonEmptyAttr(opening, 'id')
        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasTitle = hasNonEmptyAttr(opening, 'title')
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')

        if (hasId || hasAriaLabel || hasTitle || hasAriaLabelledBy) return null

        const elementId = getFlintId(opening, 'input-no-label')
        return {
            ruleId: 'A11Y-004',
            elementId,
            message:
                'A11Y-004: <input> has no programmatic label. ' +
                'Add id="…" (+ a matching <label htmlFor>), aria-label="…", or aria-labelledby="…".',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added placeholder aria-label to <input>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-label',
                        value: '[NEEDS LABEL]',
                    },
                },
            ],
        }
    },
}

// ── A11Y-005: <select> must have accessible label ─────────────────────────────

const rule005: A11yRule = {
    id: 'A11Y-005',
    name: 'Select Missing Label',
    wcag: '1.3.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<select> elements must have an accessible label.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'select') return null

        const opening = path.node.openingElement
        if (hasDynamicLabel(opening)) return null

        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')
        const hasTitle = hasNonEmptyAttr(opening, 'title')

        if (hasAriaLabel || hasAriaLabelledBy || hasTitle) return null

        const elementId = getFlintId(opening, 'select-no-label')
        return {
            ruleId: 'A11Y-005',
            elementId,
            message:
                'A11Y-005: <select> has no accessible label. ' +
                'Add aria-label="…", aria-labelledby="…", or pair with a <label htmlFor>.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added placeholder aria-label to <select>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-label',
                        value: '[NEEDS LABEL]',
                    },
                },
            ],
        }
    },
}

// ── A11Y-006: <textarea> must have accessible label ───────────────────────────

const rule006: A11yRule = {
    id: 'A11Y-006',
    name: 'Textarea Missing Label',
    wcag: '1.3.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<textarea> elements must have an accessible label.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'textarea') return null

        const opening = path.node.openingElement
        if (hasDynamicLabel(opening)) return null

        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')
        const hasTitle = hasNonEmptyAttr(opening, 'title')

        if (hasAriaLabel || hasAriaLabelledBy || hasTitle) return null

        const elementId = getFlintId(opening, 'textarea-no-label')
        return {
            ruleId: 'A11Y-006',
            elementId,
            message:
                'A11Y-006: <textarea> has no accessible label. ' +
                'Add aria-label="…", aria-labelledby="…", or pair with a <label htmlFor>.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added placeholder aria-label to <textarea>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-label',
                        value: '[NEEDS LABEL]',
                    },
                },
            ],
        }
    },
}

// ── A11Y-011: <img> alt must not be filename ──────────────────────────────────

const rule011: A11yRule = {
    id: 'A11Y-011',
    name: 'Image Alt Is Filename',
    wcag: '1.1.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<img> alt attribute must not be a filename.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'img') return null

        const opening = path.node.openingElement
        const altVal = getAttributeValue(getJsxAttr(opening, 'alt'))
        if (altVal === null) return null // dynamic — skip (A11Y-001 handles missing)
        if (!altVal) return null // empty is OK (decorative)

        if (!FILENAME_PATTERN.test(altVal.trim())) return null

        const elementId = getFlintId(opening, 'img-filename-alt')
        return {
            ruleId: 'A11Y-011',
            elementId,
            message:
                `A11Y-011: <img> alt="${altVal}" looks like a filename. ` +
                'Replace with a descriptive string or use alt="" for decorative images.',
            severity: 'critical',
            wcag: '1.1.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Replaced filename alt with empty alt (decorative).',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'alt',
                        value: '',
                    },
                },
            ],
        }
    },
}

// ── A11Y-012: <svg> must have accessible name ─────────────────────────────────

const rule012: A11yRule = {
    id: 'A11Y-012',
    name: 'SVG Missing Accessible Name',
    wcag: '1.1.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<svg> elements must have a <title>, aria-label, or role="img" + aria-label.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'svg') return null

        const opening = path.node.openingElement

        // aria-hidden="true" is acceptable (decorative)
        const ariaHidden = getAttributeStringValue(opening, 'aria-hidden')
        if (ariaHidden === 'true') return null

        // Dynamic aria-label
        const ariaLabelAttr = getJsxAttr(opening, 'aria-label')
        if (ariaLabelAttr?.type === 'JSXAttribute' && ariaLabelAttr.value?.type === 'JSXExpressionContainer') return null

        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasTitle = path.node.children.some(
            (child) =>
                child.type === 'JSXElement' &&
                child.openingElement.name.type === 'JSXIdentifier' &&
                child.openingElement.name.name.toLowerCase() === 'title',
        )

        if (hasAriaLabel || hasTitle) return null

        const elementId = getFlintId(opening, 'svg-no-name')
        return {
            ruleId: 'A11Y-012',
            elementId,
            message:
                'A11Y-012: <svg> has no accessible name. ' +
                'Add aria-hidden="true" for decorative SVGs, or aria-label="…" / <title> for informational ones.',
            severity: 'critical',
            wcag: '1.1.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added aria-hidden="true" to decorative <svg>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-hidden',
                        value: 'true',
                    },
                },
            ],
        }
    },
}

// ── A11Y-013: <input type="image"> must have alt ──────────────────────────────

const rule013: A11yRule = {
    id: 'A11Y-013',
    name: 'Image Input Missing Alt',
    wcag: '1.1.1',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<input type="image"> must have an alt attribute.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal !== 'image') return null

        const altAttr = getJsxAttr(opening, 'alt')
        if (altAttr !== undefined) return null

        const elementId = getFlintId(opening, 'input-image-no-alt')
        return {
            ruleId: 'A11Y-013',
            elementId,
            message:
                'A11Y-013: <input type="image"> is missing an `alt` attribute. ' +
                'Add alt="" for decorative inputs or a descriptive string for informational ones.',
            severity: 'critical',
            wcag: '1.1.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added alt="" to <input type="image">.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'alt',
                        value: '',
                    },
                },
            ],
        }
    },
}

// ── A11Y-014: <a> link text must not be generic ───────────────────────────────

const rule014: A11yRule = {
    id: 'A11Y-014',
    name: 'Generic Link Text',
    wcag: '2.4.4',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: 'Link text must not be generic ("click here", "read more", etc.).',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'a') return null

        const opening = path.node.openingElement

        // If aria-label is set and non-empty, the generic text doesn't matter
        if (hasNonEmptyAttr(opening, 'aria-label')) return null
        if (hasDynamicLabel(opening)) return null

        // Get the text content
        const textContent = path.node.children
            .filter((c) => c.type === 'JSXText')
            .map((c) => (c as import('@babel/types').JSXText).value.trim())
            .join(' ')
            .trim()
            .toLowerCase()

        if (!textContent) return null
        if (!GENERIC_LINK_TEXTS.has(textContent)) return null

        const elementId = getFlintId(opening, 'a-generic-text')
        return {
            ruleId: 'A11Y-014',
            elementId,
            message:
                `A11Y-014: <a> link text "${textContent}" is generic and does not describe the link destination. ` +
                'Replace with descriptive text or add aria-label="…" with context.',
            severity: 'critical',
            wcag: '2.4.4',
            fixable: false,
        }
    },
}

// ── A11Y-018: <iframe> must have a title ─────────────────────────────────────

const rule018: A11yRule = {
    id: 'A11Y-018',
    name: 'IFrame Missing Title',
    wcag: '4.1.2',
    level: 'A',
    category: 'names-labels',
    severity: 'critical',
    description: '<iframe> elements must have a title attribute describing the embedded content.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'iframe') return null

        const opening = path.node.openingElement

        // Dynamic title — skip
        const titleAttr = getJsxAttr(opening, 'title')
        if (titleAttr?.type === 'JSXAttribute' && titleAttr.value?.type === 'JSXExpressionContainer') return null

        if (hasNonEmptyAttr(opening, 'title')) return null

        const elementId = getFlintId(opening, 'iframe-no-title')
        return {
            ruleId: 'A11Y-018',
            elementId,
            message:
                'A11Y-018: <iframe> is missing a title attribute. ' +
                'Screen readers use the title to describe the embedded content to users. ' +
                'Add title="Description of embedded content".',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added placeholder title to <iframe>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'title',
                        value: '[NEEDS TITLE]',
                    },
                },
            ],
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const namesLabelsRules: A11yRule[] = [
    rule001,
    rule002,
    rule003,
    rule004,
    rule005,
    rule006,
    rule011,
    rule012,
    rule013,
    rule014,
    rule018,
]
