/**
 * Live Regions rules — flint-mcp/src/core/a11y/rules/live-regions.ts
 *
 * A11Y-080: Elements with ARIA alert/status roles must use appropriate live region attributes
 * A11Y-081: role="dialog" elements must have aria-modal="true"
 * A11Y-082: aria-live="assertive" overuse — high-interruption live regions should use role="alert"
 * A11Y-083: aria-live regions without aria-atomic are ambiguous for partial updates
 *
 * WCAG: 4.1.3 Status Messages, 4.1.2 Name Role Value
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeValue,
    getAttributeStringValue,
    hasNonEmptyAttr,
} from '../helpers.js'

// ── A11Y-080: role="alert" elements should also set aria-live="assertive" ────
// Conversely, notification-pattern elements (common class names) without
// role="status" or aria-live are flagged. We target role="alert" / role="status"
// elements that contradict themselves with a conflicting aria-live value.

const rule080: A11yRule = {
    id: 'A11Y-080',
    name: 'Alert Role With Wrong aria-live',
    wcag: '4.1.3',
    level: 'AA',
    category: 'live-regions',
    severity: 'critical',
    description:
        'Elements with role="alert" must not set aria-live="polite". ' +
        'role="alert" implies aria-live="assertive". ' +
        'Elements with role="status" must not set aria-live="assertive".',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (!roleVal) return null

        const ariaLiveVal = getAttributeStringValue(opening, 'aria-live')
        if (!ariaLiveVal) return null // no conflict if aria-live not set

        const tag = getTagName(path) ?? 'element'

        // role="alert" implies assertive — setting polite contradicts spec
        if (roleVal === 'alert' && ariaLiveVal === 'polite') {
            const elementId = getFlintId(opening, `${tag}-alert-polite-conflict`)
            return {
                ruleId: 'A11Y-080',
                elementId,
                message:
                    'A11Y-080: role="alert" already implies aria-live="assertive". ' +
                    'Setting aria-live="polite" overrides this and reduces urgency. ' +
                    'Remove aria-live or set it to "assertive".',
                severity: 'critical',
                wcag: '4.1.3',
                fixable: true,
            }
        }

        // role="status" implies polite — setting assertive makes it more disruptive
        if (roleVal === 'status' && ariaLiveVal === 'assertive') {
            const elementId = getFlintId(opening, `${tag}-status-assertive-conflict`)
            return {
                ruleId: 'A11Y-080',
                elementId,
                message:
                    'A11Y-080: role="status" implies aria-live="polite". ' +
                    'Setting aria-live="assertive" overrides this and interrupts the user. ' +
                    'Remove aria-live or change to "polite".',
                severity: 'critical',
                wcag: '4.1.3',
                fixable: true,
            }
        }

        return null
    },

    fix(violation, _ast) {
        return {
            description: 'Removed conflicting aria-live attribute.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-live',
                        value: null,
                    },
                },
            ],
        }
    },
}

// ── A11Y-081: role="dialog" must have aria-modal="true" ───────────────────────

const rule081: A11yRule = {
    id: 'A11Y-081',
    name: 'Dialog Missing aria-modal',
    wcag: '4.1.2',
    level: 'A',
    category: 'live-regions',
    severity: 'critical',
    description: 'Elements with role="dialog" or role="alertdialog" must have aria-modal="true".',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (roleVal !== 'dialog' && roleVal !== 'alertdialog') return null

        const ariaModalVal = getAttributeStringValue(opening, 'aria-modal')
        if (ariaModalVal === 'true') return null

        // Dynamic aria-modal — skip
        const ariaModalAttr = getJsxAttr(opening, 'aria-modal')
        if (ariaModalAttr?.type === 'JSXAttribute' && ariaModalAttr.value?.type === 'JSXExpressionContainer') return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-dialog-no-modal`)

        return {
            ruleId: 'A11Y-081',
            elementId,
            message:
                `A11Y-081: role="${roleVal}" element is missing aria-modal="true". ` +
                'Without aria-modal, screen readers may allow users to navigate content behind the dialog. ' +
                'Add aria-modal="true" to confine the AT virtual cursor to the dialog.',
            severity: 'critical',
            wcag: '4.1.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added aria-modal="true" to dialog element.',
            mutations: [
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

// ── A11Y-082: aria-live="assertive" overuse ───────────────────────────────────
// Only role="alert" elements warrant assertive. Other uses should be polite or
// use role="status". This flags non-alert elements with assertive.

const rule082: A11yRule = {
    id: 'A11Y-082',
    name: 'Unnecessary Assertive Live Region',
    wcag: '4.1.3',
    level: 'AA',
    category: 'live-regions',
    severity: 'warning',
    description:
        'aria-live="assertive" on non-alert elements interrupts the user. ' +
        'Use aria-live="polite" or role="status" for non-urgent updates.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const ariaLiveVal = getAttributeStringValue(opening, 'aria-live')
        if (ariaLiveVal !== 'assertive') return null

        // If element already has role="alert" or role="alertdialog", assertive is correct
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (roleVal === 'alert' || roleVal === 'alertdialog') return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-assertive-overuse`)

        return {
            ruleId: 'A11Y-082',
            elementId,
            message:
                `A11Y-082: <${tag}> uses aria-live="assertive" without role="alert". ` +
                'Assertive regions interrupt ongoing AT speech. ' +
                'Use aria-live="polite" for non-urgent status updates, or add role="alert" only for critical errors.',
            severity: 'warning',
            wcag: '4.1.3',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Changed aria-live="assertive" to aria-live="polite".',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-live',
                        value: 'polite',
                    },
                },
            ],
        }
    },
}

// ── A11Y-083: aria-live regions without aria-atomic are ambiguous ─────────────

const rule083: A11yRule = {
    id: 'A11Y-083',
    name: 'Live Region Missing aria-atomic',
    wcag: '4.1.3',
    level: 'AA',
    category: 'live-regions',
    severity: 'warning',
    description:
        'Elements with aria-live should set aria-atomic to clarify whether the whole region ' +
        'or only changed nodes should be announced.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const ariaLiveVal = getAttributeStringValue(opening, 'aria-live')
        if (!ariaLiveVal || ariaLiveVal === 'off') return null

        // Dynamic aria-live — skip
        const ariaLiveAttr = getJsxAttr(opening, 'aria-live')
        if (ariaLiveAttr?.type === 'JSXAttribute' && ariaLiveAttr.value?.type === 'JSXExpressionContainer') return null

        // Already has aria-atomic — compliant
        if (hasNonEmptyAttr(opening, 'aria-atomic')) return null

        // role="alert"/"status" have implicit aria-atomic="true" per ARIA spec — skip
        const roleVal = getAttributeValue(getJsxAttr(opening, 'role'))
        if (roleVal === 'alert' || roleVal === 'status') return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-live-no-atomic`)

        return {
            ruleId: 'A11Y-083',
            elementId,
            message:
                `A11Y-083: <${tag}> has aria-live="${ariaLiveVal}" but no aria-atomic. ` +
                'Add aria-atomic="true" to announce the entire region on change, ' +
                'or aria-atomic="false" to announce only the changed nodes.',
            severity: 'warning',
            wcag: '4.1.3',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added aria-atomic="true" to live region.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-atomic',
                        value: 'true',
                    },
                },
            ],
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const liveRegionsRules: A11yRule[] = [rule080, rule081, rule082, rule083]
