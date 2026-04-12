/**
 * Structure rules — flint-mcp/src/core/a11y/rules/structure.ts
 *
 * A11Y-008 (migrated): <table> must have accessible summary
 * A11Y-009 (migrated): <html> must have lang attribute
 * A11Y-010 (migrated): Headings must not skip levels
 * A11Y-015 (new): <ul>/<ol> direct children must be <li>
 * A11Y-016 (new): <dl> direct children must be <dt> or <dd>
 * A11Y-017 (new): Page must have exactly one <h1>
 *
 * WCAG: 1.3.1 Info and Relationships, 3.1.1 Language of Page, 2.4.2 Page Titled
 */

import type { A11yRule, A11yViolationDetail } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    hasNonEmptyAttr,
    hasDynamicLabel,
    hasDirectChildTag,
    getAttributeStringValue,
    getExplicitRole,
} from '../helpers.js'
import { classifyDataName } from '../../componentClassification.js'

// ── A11Y-008: <table> must have accessible summary ────────────────────────────

const rule008: A11yRule = {
    id: 'A11Y-008',
    name: 'Table Missing Accessible Summary',
    wcag: '1.3.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description: '<table> elements must have an accessible summary.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'table') return null

        const opening = path.node.openingElement
        if (hasDynamicLabel(opening)) return null

        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')
        const hasCaption = hasDirectChildTag(path, 'caption')

        if (hasAriaLabel || hasAriaLabelledBy || hasCaption) return null

        const elementId = getFlintId(opening, 'table-no-summary')
        return {
            ruleId: 'A11Y-008',
            elementId,
            message:
                'A11Y-008: <table> has no accessible summary. ' +
                'Add a <caption> child, aria-label="…", or aria-labelledby="…".',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: false,
        }
    },
}

// ── A11Y-009: <html> must have lang ──────────────────────────────────────────

const rule009: A11yRule = {
    id: 'A11Y-009',
    name: 'HTML Missing Lang Attribute',
    wcag: '3.1.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description: '<html> must have a lang attribute.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'html') return null

        const opening = path.node.openingElement

        // Dynamic lang expression — conservatively skip
        const langAttr = getJsxAttr(opening, 'lang')
        if (langAttr?.type === 'JSXAttribute' && langAttr.value?.type === 'JSXExpressionContainer') return null

        const hasLang = hasNonEmptyAttr(opening, 'lang')
        if (hasLang) return null

        const elementId = getFlintId(opening, 'html-no-lang')
        return {
            ruleId: 'A11Y-009',
            elementId,
            message:
                'A11Y-009: <html> is missing a `lang` attribute. ' +
                'Add lang="en" (or appropriate BCP 47 language tag) for screen reader language detection.',
            severity: 'critical',
            wcag: '3.1.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added lang="en" to <html>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'lang',
                        value: 'en',
                    },
                },
            ],
        }
    },
}

// ── A11Y-010: Headings must not skip levels ───────────────────────────────────

const rule010: A11yRule = {
    id: 'A11Y-010',
    name: 'Heading Level Skipped',
    wcag: '1.3.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description: 'Heading levels must not be skipped.',

    visitElement(path, context) {
        const tag = getTagName(path)
        if (!tag) return null

        const headingMatch = /^h([1-6])$/.exec(tag)
        if (!headingMatch) return null

        const level = parseInt(headingMatch[1], 10)
        // headingLevels is updated by the runner before calling visitElement
        // We need the last heading before this one
        const prevLevels = context.headingLevels.slice(0, -1) // exclude the current one just pushed
        const last = prevLevels[prevLevels.length - 1] ?? 0

        if (level <= last + 1) return null // no skip

        const opening = path.node.openingElement
        const elementId = getFlintId(opening, `${tag}-level-skip`)

        return {
            ruleId: 'A11Y-010',
            elementId,
            message:
                `A11Y-010: Heading <${tag}> skips level. Previous heading was <h${last}>. ` +
                'Heading levels must not be skipped — use sequential levels for screen readers.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: false,
        }
    },
}

// ── A11Y-015: <ul>/<ol> direct children must be <li> ─────────────────────────

const rule015: A11yRule = {
    id: 'A11Y-015',
    name: 'List Contains Non-List-Item Children',
    wcag: '1.3.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description: '<ul> and <ol> direct children must be <li> elements.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'ul' && tag !== 'ol') return null

        const invalidChildren = path.node.children.filter((child) => {
            if (child.type === 'JSXText' && !/\S/.test(child.value)) return false // whitespace ok
            if (child.type === 'JSXExpressionContainer') return false // dynamic content — skip
            if (child.type === 'JSXSpreadChild') return false // dynamic
            if (child.type === 'JSXFragment') return false // fragment
            if (child.type !== 'JSXElement') return false

            const childTag = child.openingElement.name
            if (childTag.type !== 'JSXIdentifier') return false // component — skip
            const childTagName = childTag.name.toLowerCase()
            return childTagName !== 'li'
        })

        if (invalidChildren.length === 0) return null

        const opening = path.node.openingElement
        const elementId = getFlintId(opening, `${tag}-invalid-children`)

        return {
            ruleId: 'A11Y-015',
            elementId,
            message:
                `A11Y-015: <${tag}> has non-<li> direct children. ` +
                'All direct children of <ul> and <ol> must be <li> elements.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: false,
        }
    },
}

// ── A11Y-016: <dl> direct children must be <dt> or <dd> ──────────────────────

const rule016: A11yRule = {
    id: 'A11Y-016',
    name: 'Definition List Contains Invalid Children',
    wcag: '1.3.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description: '<dl> direct children must be <dt> or <dd> elements.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'dl') return null

        const invalidChildren = path.node.children.filter((child) => {
            if (child.type === 'JSXText' && !/\S/.test(child.value)) return false
            if (child.type === 'JSXExpressionContainer') return false
            if (child.type === 'JSXSpreadChild') return false
            if (child.type === 'JSXFragment') return false
            if (child.type !== 'JSXElement') return false

            const childTag = child.openingElement.name
            if (childTag.type !== 'JSXIdentifier') return false
            const childTagName = childTag.name.toLowerCase()
            return childTagName !== 'dt' && childTagName !== 'dd' && childTagName !== 'div'
        })

        if (invalidChildren.length === 0) return null

        const opening = path.node.openingElement
        const elementId = getFlintId(opening, 'dl-invalid-children')

        return {
            ruleId: 'A11Y-016',
            elementId,
            message:
                'A11Y-016: <dl> has children that are not <dt> or <dd>. ' +
                'Definition lists must only contain <dt> and <dd> elements as direct children.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: false,
        }
    },
}

// ── A11Y-017: Page must have exactly one <h1> (document-level) ───────────────

const rule017: A11yRule = {
    id: 'A11Y-017',
    name: 'Page Must Have Exactly One H1',
    wcag: '2.4.2',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description: 'The page must have exactly one <h1> element.',

    auditDocument(context): A11yViolationDetail[] {
        if (context.h1Count === 1) return []
        if (context.h1Count === 0) return [] // may be a component, not a page — skip

        return [
            {
                ruleId: 'A11Y-017',
                elementId: 'document',
                message:
                    `A11Y-017: Document has ${context.h1Count} <h1> elements. ` +
                    'There must be exactly one <h1> per page for proper document structure.',
                severity: 'critical',
                wcag: '2.4.2',
                fixable: false,
            },
        ]
    },
}

// ── A11Y-101: Dialog/modal component missing aria-modal or role="dialog" (P1b) ─

/**
 * Returns the component name from a JSXElement, handling both JSXIdentifier
 * and JSXMemberExpression. For intrinsic elements (lowercase), returns null.
 */
function getComponentName(path: import('@babel/traverse').NodePath<import('@babel/types').JSXElement>): string | null {
    const nameNode = path.node.openingElement.name
    if (nameNode.type === 'JSXIdentifier') {
        // PascalCase = component; lowercase = intrinsic HTML element
        if (nameNode.name[0] === nameNode.name[0].toUpperCase() && nameNode.name[0] !== nameNode.name[0].toLowerCase()) {
            return nameNode.name
        }
        return nameNode.name // lowercase intrinsic — still useful for classification
    }
    if (nameNode.type === 'JSXMemberExpression') {
        // e.g., Dialog.Root → "Dialog.Root"
        const parts: string[] = []
        let current: import('@babel/types').JSXMemberExpression | import('@babel/types').JSXIdentifier = nameNode
        while (current.type === 'JSXMemberExpression') {
            parts.unshift(current.property.name)
            current = current.object as import('@babel/types').JSXMemberExpression | import('@babel/types').JSXIdentifier
        }
        if (current.type === 'JSXIdentifier') parts.unshift(current.name)
        return parts.join('.')
    }
    return null
}

const rule101: A11yRule = {
    id: 'A11Y-101',
    name: 'Dialog Missing Accessibility Attributes',
    wcag: '4.1.2',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description:
        'Components classified as dialog/modal must have aria-modal="true" or role="dialog" ' +
        'to communicate their modal nature to assistive technologies.',

    visitElement(path, _context) {
        const componentName = getComponentName(path)
        if (!componentName) return null

        // Classify the component name using the shared classification engine
        const classification = classifyDataName(componentName)
        if (classification !== 'dialog') return null

        const opening = path.node.openingElement

        // Check for aria-modal="true"
        const ariaModal = getAttributeStringValue(opening, 'aria-modal')
        if (ariaModal === 'true') return null

        // Check for role="dialog" or role="alertdialog"
        const role = getExplicitRole(opening)
        if (role === 'dialog' || role === 'alertdialog') return null

        // Check if the element is a native <dialog> HTML element (has implicit dialog role)
        // We check the raw identifier name (not lowercased) to distinguish <dialog> from <Dialog>
        const nameNode = path.node.openingElement.name
        if (nameNode.type === 'JSXIdentifier' && nameNode.name === 'dialog') return null

        const elementId = getFlintId(opening, `${componentName}-dialog-no-a11y`)

        return {
            ruleId: 'A11Y-101',
            elementId,
            message:
                `A11Y-101: "${componentName}" is classified as a dialog/modal but is missing ` +
                'aria-modal="true" or role="dialog". Dialogs must communicate their modal nature ' +
                'to assistive technologies for proper focus management and screen reader behavior.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added role="dialog" and aria-modal="true" to dialog component.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'role',
                        value: 'dialog',
                    },
                },
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-modal',
                        value: 'true',
                    },
                },
            ],
        }
    },
}

// ── A11Y-102: Navigation component missing nav landmark (P1b) ───────────────

const rule102: A11yRule = {
    id: 'A11Y-102',
    name: 'Navigation Component Missing Nav Landmark',
    wcag: '1.3.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description:
        'Components classified as navigation must use a <nav> element or role="navigation" ' +
        'to be identified as a navigation landmark by assistive technologies.',

    visitElement(path, _context) {
        const componentName = getComponentName(path)
        if (!componentName) return null

        const classification = classifyDataName(componentName)
        if (classification !== 'nav') return null

        // Check if it's a native <nav> HTML element (has implicit navigation role)
        const nameNode = path.node.openingElement.name
        if (nameNode.type === 'JSXIdentifier' && nameNode.name === 'nav') return null

        const opening = path.node.openingElement

        // Check for role="navigation"
        const role = getExplicitRole(opening)
        if (role === 'navigation') return null

        const elementId = getFlintId(opening, `${componentName}-nav-no-landmark`)

        return {
            ruleId: 'A11Y-102',
            elementId,
            message:
                `A11Y-102: "${componentName}" is classified as navigation but is missing ` +
                'a <nav> wrapper or role="navigation". Navigation regions must be identified ' +
                'as landmarks for screen reader users to skip to or bypass.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added role="navigation" to navigation component.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'role',
                        value: 'navigation',
                    },
                },
            ],
        }
    },
}

// ── A11Y-103: Form component missing form element (P1b) ─────────────────────

const rule103: A11yRule = {
    id: 'A11Y-103',
    name: 'Form Component Missing Form Landmark',
    wcag: '1.3.1',
    level: 'A',
    category: 'structure',
    severity: 'critical',
    description:
        'Components classified as forms must use a <form> element or role="form" ' +
        'to communicate form semantics to assistive technologies.',

    visitElement(path, _context) {
        const componentName = getComponentName(path)
        if (!componentName) return null

        // classifyDataName maps 'form' inputs to 'input' type, not 'form'
        // We need to check for component names that contain 'form' directly
        const lower = componentName.toLowerCase()
        const isFormComponent =
            lower === 'form' || lower.includes('form') && !lower.includes('format') && !lower.includes('transform')

        if (!isFormComponent) return null

        // Check if it's a native <form> HTML element (has implicit form role)
        const nameNode = path.node.openingElement.name
        if (nameNode.type === 'JSXIdentifier' && nameNode.name === 'form') return null

        const opening = path.node.openingElement

        // Check for role="form"
        const role = getExplicitRole(opening)
        if (role === 'form') return null

        const elementId = getFlintId(opening, `${componentName}-form-no-landmark`)

        return {
            ruleId: 'A11Y-103',
            elementId,
            message:
                `A11Y-103: "${componentName}" appears to be a form component but is missing ` +
                'a <form> wrapper or role="form". Form regions should use semantic form elements ' +
                'for assistive technology support and proper form submission behavior.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added role="form" to form component.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'role',
                        value: 'form',
                    },
                },
            ],
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const structureRules: A11yRule[] = [
    rule008,
    rule009,
    rule010,
    rule015,
    rule016,
    rule017,
    rule101,
    rule102,
    rule103,
]
