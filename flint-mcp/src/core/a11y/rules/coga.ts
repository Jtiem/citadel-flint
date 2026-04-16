/**
 * COGA Cognitive Accessibility — flint-mcp/src/core/a11y/rules/coga.ts
 *
 * COGA-001: Visible Label Required — input/textarea/select without label or aria-label
 * COGA-002: Timeout Warning — session timer without warning dialog pattern (advisory)
 * COGA-003: Form Complexity — form with 8+ inputs without fieldset grouping
 * COGA-004: Clear Error Identification — error indicated by color only, no aria-invalid/role=alert
 * COGA-005: Help Link Consistency — help/support link without aria-label
 * COGA-006: Redundant Entry — inputs collecting personal data without autocomplete
 * COGA-007: Plain Language — placeholder text longer than 60 characters
 * COGA-008: Input Purpose Autocomplete — personal data inputs without autocomplete (normative)
 *
 * WCAG: 1.3.5, 2.2.1, 3.2.6, 3.3.1, 3.3.2, 3.3.7
 * W3C COGA guidance: https://www.w3.org/TR/coga-usable/
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeStringValue,
    hasNonEmptyAttr,
} from '../helpers.js'

// ── COGA-001: Visible Label Required ─────────────────────────────────────────

const FORM_INPUT_TAGS = new Set(['input', 'textarea', 'select'])

const rule001: A11yRule = {
    id: 'COGA-001',
    name: 'Visible Label Required',
    wcag: '3.3.2',
    level: 'A',
    category: 'forms',
    severity: 'critical',
    description:
        'Form controls must have a visible label or accessible name. ' +
        'Placeholder text alone is not a substitute for a label.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !FORM_INPUT_TAGS.has(tag)) return null

        const opening = path.node.openingElement

        // Skip hidden inputs
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal === 'hidden') return null

        // Acceptable label patterns
        const hasAriaLabel = hasNonEmptyAttr(opening, 'aria-label')
        const hasAriaLabelledBy = hasNonEmptyAttr(opening, 'aria-labelledby')
        const hasTitle = hasNonEmptyAttr(opening, 'title')

        if (hasAriaLabel || hasAriaLabelledBy || hasTitle) return null

        // Dynamic label check — if any label attr is a JSXExpressionContainer, skip
        for (const attrName of ['aria-label', 'aria-labelledby', 'title']) {
            const attr = getJsxAttr(opening, attrName)
            if (attr?.type === 'JSXAttribute' && attr.value?.type === 'JSXExpressionContainer') {
                return null
            }
        }

        // Check for an `id` that could be referenced by an external <label> for
        // — we can't statically verify the label exists elsewhere in the file,
        // but if there's an `id` attribute we conservatively allow it to pass.
        const hasId = hasNonEmptyAttr(opening, 'id')
        if (hasId) return null

        const elementId = getFlintId(opening, `${tag}-coga-no-label`)

        return {
            ruleId: 'COGA-001',
            elementId,
            message:
                `COGA-001: <${tag}> has no visible label, aria-label, aria-labelledby, or title. ` +
                'Placeholder text alone is insufficient — it disappears on input and has poor contrast. ' +
                'Add aria-label="[purpose]" or associate a <label htmlFor="[id]">.',
            severity: 'critical',
            wcag: '3.3.2',
            fixable: false,
        }
    },
}

// ── COGA-002: Timeout Warning ─────────────────────────────────────────────────
//
// Very conservative: only flag if there is a JSXText containing "session" or
// "logout" AND the element has an onClick but no role="dialog" or role="alertdialog"
// in sibling/child elements. This prevents false positives on ordinary UI.

const TIMEOUT_TEXT_PATTERN = /\b(session|logout|log out|sign out|timed? out|expire[sd]?)\b/i

/**
 * Recursively search JSX children up to `maxDepth` levels for text matching pattern.
 */
function hasTimeoutTextInSubtree(
    children: import('@babel/types').JSXElement['children'],
    maxDepth: number,
): boolean {
    if (maxDepth <= 0) return false
    for (const child of children) {
        if (child.type === 'JSXText' && TIMEOUT_TEXT_PATTERN.test(child.value)) return true
        if (
            child.type === 'JSXExpressionContainer' &&
            child.expression.type === 'StringLiteral' &&
            TIMEOUT_TEXT_PATTERN.test(child.expression.value)
        ) return true
        if (child.type === 'JSXElement') {
            if (hasTimeoutTextInSubtree(child.children, maxDepth - 1)) return true
        }
    }
    return false
}

const rule002: A11yRule = {
    id: 'COGA-002',
    name: 'Session Timeout — No Warning Dialog Pattern',
    wcag: '2.2.1',
    level: 'A',
    category: 'names-labels',
    severity: 'warning',
    description:
        'When sessions have a time limit, users must be warned at least 20 seconds before ' +
        'timeout and given a way to extend. Look for session/logout text without a dialog pattern.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        // Only check elements likely to be notification banners or alerts
        if (!tag || !['div', 'aside', 'section', 'span', 'p'].includes(tag)) return null

        const opening = path.node.openingElement

        // Must look like a status/alert zone
        const roleVal = getAttributeStringValue(opening, 'role')
        const isAlertZone = roleVal === 'status' || roleVal === 'alert'
        if (!isAlertZone) return null

        // Check text content for timeout vocabulary — search both direct children
        // and one level deeper (e.g., text inside a <p> child).
        const hasTimeoutText = hasTimeoutTextInSubtree(path.node.children, 2)
        if (!hasTimeoutText) return null

        // Check if there is a sibling or child with role=dialog — conservative heuristic
        // We only have access to children here; a document-level check would be more accurate.
        const hasDialogChild = path.node.children.some(
            (child) =>
                child.type === 'JSXElement' &&
                child.openingElement.attributes.some(
                    (a) =>
                        a.type === 'JSXAttribute' &&
                        a.name.type === 'JSXIdentifier' &&
                        a.name.name === 'role' &&
                        a.value?.type === 'StringLiteral' &&
                        (a.value.value === 'dialog' || a.value.value === 'alertdialog'),
                ),
        )

        if (hasDialogChild) return null

        const elementId = getFlintId(opening, `${tag}-coga-timeout-no-dialog`)

        return {
            ruleId: 'COGA-002',
            elementId,
            message:
                `COGA-002: <${tag} role="${roleVal}"> appears to display a session timeout message ` +
                'without a warning dialog pattern. ' +
                'WCAG 2.2.1 requires that users are warned before a session expires and given a way ' +
                'to extend the session. Add a dialog (role="alertdialog") with extension controls.',
            severity: 'warning',
            wcag: '2.2.1',
            fixable: false,
        }
    },
}

// ── COGA-003: Form Complexity ─────────────────────────────────────────────────
//
// A <form> element (or element with role="form") that has more than 7 direct
// <input> or <select> children without any <fieldset> grouping.
// Threshold is 7 per COGA guidance ("chunking" recommendation).

const FORM_CONTROL_TAGS = new Set(['input', 'select'])

const rule003: A11yRule = {
    id: 'COGA-003',
    name: 'Form Complexity — Too Many Ungrouped Fields',
    wcag: '3.3.2',
    level: 'A',
    category: 'forms',
    severity: 'warning',
    description:
        'Forms with more than 7 input or select fields without a fieldset grouping may be ' +
        'too complex for users with cognitive disabilities. Use <fieldset> to group related fields.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'form') return null

        const opening = path.node.openingElement

        // Count direct form control children (input/select) that are NOT inside a fieldset
        let ungroupedCount = 0
        let hasFieldset = false

        for (const child of path.node.children) {
            if (child.type !== 'JSXElement') continue
            const childTag = child.openingElement.name
            if (childTag.type !== 'JSXIdentifier') continue

            const childTagName = childTag.name.toLowerCase()
            if (childTagName === 'fieldset') {
                hasFieldset = true
                continue
            }
            if (FORM_CONTROL_TAGS.has(childTagName)) {
                // Skip hidden inputs
                const typeAttr = child.openingElement.attributes.find(
                    (a) =>
                        a.type === 'JSXAttribute' &&
                        a.name.type === 'JSXIdentifier' &&
                        a.name.name === 'type',
                )
                const typeVal =
                    typeAttr?.type === 'JSXAttribute' && typeAttr.value?.type === 'StringLiteral'
                        ? typeAttr.value.value
                        : null
                if (typeVal !== 'hidden') {
                    ungroupedCount++
                }
            }
        }

        // Only flag if more than 7 ungrouped AND no fieldset at all
        if (ungroupedCount <= 7 || hasFieldset) return null

        const elementId = getFlintId(opening, 'form-coga-complexity')

        return {
            ruleId: 'COGA-003',
            elementId,
            message:
                `COGA-003: <form> has ${ungroupedCount} ungrouped input/select fields with no <fieldset> ` +
                'grouping. ' +
                'COGA guidance recommends grouping related fields with <fieldset> and <legend> to reduce ' +
                'cognitive load. Consider splitting into multiple focused steps or grouping related fields.',
            severity: 'warning',
            wcag: '3.3.2',
            fixable: false,
        }
    },
}

// ── COGA-004: Clear Error Identification ─────────────────────────────────────
//
// Error state indicated only by className patterns (text-red-*, border-red-*)
// without aria-invalid or an adjacent role="alert". Conservative: only flag
// when there is a red-themed class AND no aria-invalid on the same element.

const ERROR_COLOR_PATTERN = /\b(text-red|border-red|bg-red|ring-red|text-rose|border-rose|bg-rose|ring-rose|text-destructive|border-destructive)\b/

const rule004: A11yRule = {
    id: 'COGA-004',
    name: 'Clear Error Identification — Color-Only Error State',
    wcag: '3.3.1',
    level: 'A',
    category: 'forms',
    severity: 'critical',
    description:
        'Error states must not rely on color alone. Elements with red/error color classes ' +
        'must also have aria-invalid="true" or an adjacent role="alert" message.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !FORM_INPUT_TAGS.has(tag)) return null

        const opening = path.node.openingElement

        const classNameVal = getAttributeStringValue(opening, 'className')
        if (!classNameVal) return null

        const hasErrorColor = ERROR_COLOR_PATTERN.test(classNameVal)
        if (!hasErrorColor) return null

        // If aria-invalid is set, the error is not color-only
        const ariaInvalidVal = getAttributeStringValue(opening, 'aria-invalid')
        if (ariaInvalidVal === 'true' || ariaInvalidVal === 'grammar' || ariaInvalidVal === 'spelling') return null

        // Dynamic aria-invalid — skip conservatively
        const ariaInvalidAttr = getJsxAttr(opening, 'aria-invalid')
        if (ariaInvalidAttr?.type === 'JSXAttribute' && ariaInvalidAttr.value?.type === 'JSXExpressionContainer') return null

        const elementId = getFlintId(opening, `${tag}-coga-color-only-error`)

        return {
            ruleId: 'COGA-004',
            elementId,
            message:
                `COGA-004: <${tag}> appears to indicate an error state using only color (${classNameVal.split(/\s+/).filter((c) => ERROR_COLOR_PATTERN.test(c)).join(', ')}) ` +
                'without aria-invalid. ' +
                'WCAG 3.3.1 requires errors to be identified in text or programmatically, not by color alone. ' +
                'Add aria-invalid="true" and associate an error message via aria-describedby.',
            severity: 'critical',
            wcag: '3.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added aria-invalid="true" to mark the error state programmatically.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-invalid',
                        value: 'true',
                    },
                },
            ],
        }
    },
}

// ── COGA-005: Help Link Consistency ──────────────────────────────────────────
//
// Advisory: <a> elements with href containing "help" or "support" that lack
// a consistent aria-label. We simply flag the missing aria-label — the
// "consistency" aspect cannot be fully evaluated from a single component.

const HELP_HREF_PATTERN = /\/(help|support|faq|contact|assistance)\b/i

const rule005: A11yRule = {
    id: 'COGA-005',
    name: 'Help Link Missing Accessible Label',
    wcag: '3.2.6',
    level: 'A',
    category: 'names-labels',
    severity: 'warning',
    description:
        'Help and support links should have a consistent, descriptive aria-label so ' +
        'screen reader users can reliably find them across pages.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'a') return null

        const opening = path.node.openingElement

        const hrefVal = getAttributeStringValue(opening, 'href')
        if (!hrefVal || !HELP_HREF_PATTERN.test(hrefVal)) return null

        // If aria-label is present — compliant
        if (hasNonEmptyAttr(opening, 'aria-label')) return null
        if (hasNonEmptyAttr(opening, 'aria-labelledby')) return null

        // Dynamic label — skip
        const ariaLabelAttr = getJsxAttr(opening, 'aria-label')
        if (ariaLabelAttr?.type === 'JSXAttribute' && ariaLabelAttr.value?.type === 'JSXExpressionContainer') return null

        const elementId = getFlintId(opening, 'a-coga-help-link-no-label')

        return {
            ruleId: 'COGA-005',
            elementId,
            message:
                `COGA-005: Help/support link (href="${hrefVal}") has no aria-label. ` +
                'WCAG 3.2.6 requires help mechanisms to appear consistently. ' +
                'Add aria-label="Help" or aria-label="Get help and support" to ensure ' +
                'screen reader users can reliably identify this link.',
            severity: 'warning',
            wcag: '3.2.6',
            fixable: false,
        }
    },
}

// ── COGA-006: Redundant Entry ─────────────────────────────────────────────────
//
// <input> fields that collect common personal data (name, email, address, phone)
// without an autocomplete attribute. This overlaps with WCAG 1.3.5 but is
// framed specifically through the COGA lens of cognitive load.

const PERSONAL_DATA_NAME_PATTERN = /\b(name|email|address|phone|tel|zip|postal|city|country|first[-_]?name|last[-_]?name|full[-_]?name)\b/i

const rule006: A11yRule = {
    id: 'COGA-006',
    name: 'Redundant Entry — Personal Data Field Without Autocomplete',
    wcag: '3.3.7',
    level: 'AA',
    category: 'forms',
    severity: 'warning',
    description:
        'Input fields collecting personal data (name, email, address, phone) should have ' +
        'autocomplete attributes to help users with cognitive disabilities avoid re-entering ' +
        'information they have already provided.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement

        // Skip hidden and submit/button inputs
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal && ['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(typeVal)) return null

        // Check if name or id attribute matches personal data patterns
        const nameVal = getAttributeStringValue(opening, 'name')
        const idVal = getAttributeStringValue(opening, 'id')
        const placeholderVal = getAttributeStringValue(opening, 'placeholder')
        const ariaLabelVal = getAttributeStringValue(opening, 'aria-label')

        const isPersonalData =
            (nameVal && PERSONAL_DATA_NAME_PATTERN.test(nameVal)) ||
            (idVal && PERSONAL_DATA_NAME_PATTERN.test(idVal)) ||
            (placeholderVal && PERSONAL_DATA_NAME_PATTERN.test(placeholderVal)) ||
            (ariaLabelVal && PERSONAL_DATA_NAME_PATTERN.test(ariaLabelVal))

        if (!isPersonalData) return null

        // If autocomplete is set — compliant
        const hasAutocomplete = opening.attributes.some(
            (a) =>
                a.type === 'JSXAttribute' &&
                a.name.type === 'JSXIdentifier' &&
                a.name.name === 'autoComplete',
        )
        if (hasAutocomplete) return null

        const elementId = getFlintId(opening, 'input-coga-redundant-entry')

        return {
            ruleId: 'COGA-006',
            elementId,
            message:
                `COGA-006: <input> collecting personal data (${nameVal ?? idVal ?? ariaLabelVal ?? 'unknown field'}) ` +
                'has no autoComplete attribute. ' +
                'WCAG 3.3.7 requires that previously-entered information can be auto-populated. ' +
                'Add autoComplete with the appropriate value (e.g., "name", "email", "tel").',
            severity: 'warning',
            wcag: '3.3.7',
            fixable: false,
        }
    },
}

// ── COGA-007: Plain Language ──────────────────────────────────────────────────
//
// Advisory: placeholder text longer than 60 characters is likely too complex
// for users with cognitive disabilities. This is a pure advisory rule.

const MAX_PLACEHOLDER_LENGTH = 60

const rule007: A11yRule = {
    id: 'COGA-007',
    name: 'Plain Language — Placeholder Text Too Long',
    wcag: '3.3.2',
    level: 'A',
    category: 'forms',
    severity: 'warning',
    description:
        'Placeholder text longer than 60 characters is too complex for users with cognitive ' +
        'disabilities. Keep placeholder text short and use visible labels for instructions.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !FORM_INPUT_TAGS.has(tag)) return null

        const opening = path.node.openingElement
        const placeholderVal = getAttributeStringValue(opening, 'placeholder')
        if (!placeholderVal) return null
        if (placeholderVal.length <= MAX_PLACEHOLDER_LENGTH) return null

        const elementId = getFlintId(opening, `${tag}-coga-placeholder-length`)

        return {
            ruleId: 'COGA-007',
            elementId,
            message:
                `COGA-007: <${tag}> has placeholder text of ${placeholderVal.length} characters ` +
                `(max recommended: ${MAX_PLACEHOLDER_LENGTH}). ` +
                'Long placeholder text may be too complex for users with cognitive disabilities. ' +
                'Keep placeholder text brief and use a visible <label> for detailed instructions.',
            severity: 'warning',
            wcag: '3.3.2',
            fixable: false,
        }
    },
}

// ── COGA-008: Input Purpose Autocomplete ─────────────────────────────────────
//
// <input> elements that collect personal data (name/email/tel/address inferred
// from name/id/aria-label) without an autocomplete attribute. Normative severity —
// this is WCAG 1.3.5 expressed as a COGA-specific enforcement rule.

const rule008: A11yRule = {
    id: 'COGA-008',
    name: 'Input Purpose — Personal Data Without Autocomplete',
    wcag: '1.3.5',
    level: 'AA',
    category: 'forms',
    severity: 'warning',
    description:
        '<input> elements collecting personal data must have an autocomplete attribute ' +
        'so that users with cognitive disabilities can use saved data to complete forms.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement

        // Skip non-text input types
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal && ['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio', 'range', 'color'].includes(typeVal)) return null

        // Use the name, id, or aria-label to infer personal data purpose
        const nameVal = getAttributeStringValue(opening, 'name')
        const idVal = getAttributeStringValue(opening, 'id')
        const ariaLabelVal = getAttributeStringValue(opening, 'aria-label')

        const isPersonalData =
            (nameVal && PERSONAL_DATA_NAME_PATTERN.test(nameVal)) ||
            (idVal && PERSONAL_DATA_NAME_PATTERN.test(idVal)) ||
            (ariaLabelVal && PERSONAL_DATA_NAME_PATTERN.test(ariaLabelVal))

        if (!isPersonalData) return null

        // If autocomplete is set — compliant (regardless of value)
        const autocompleteAttr = getJsxAttr(opening, 'autoComplete')
        if (autocompleteAttr) return null

        const fieldName = nameVal ?? idVal ?? ariaLabelVal ?? 'unknown'
        const elementId = getFlintId(opening, `input-coga-input-purpose-${fieldName}`)

        return {
            ruleId: 'COGA-008',
            elementId,
            message:
                `COGA-008: <input> with name/id/label "${fieldName}" collects personal data but has ` +
                'no autoComplete attribute. ' +
                'WCAG 1.3.5 (Identify Input Purpose) requires autocomplete tokens on personal data fields ' +
                'so users can auto-fill from their browser or assistive technology. ' +
                'Add autoComplete="name", "email", "tel", "street-address", etc.',
            severity: 'warning',
            wcag: '1.3.5',
            fixable: false,
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const cogaRules: A11yRule[] = [
    rule001,
    rule002,
    rule003,
    rule004,
    rule005,
    rule006,
    rule007,
    rule008,
]
