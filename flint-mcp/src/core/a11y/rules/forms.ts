/**
 * Forms rules — flint-mcp/src/core/a11y/rules/forms.ts
 *
 * A11Y-070: <fieldset> must contain a <legend> child
 * A11Y-071: <input> with required must have visible required indicator or aria-required
 * A11Y-072: <input> with aria-invalid must have aria-describedby
 * A11Y-073: autocomplete attribute must use valid values
 *
 * WCAG: 1.3.1 Info and Relationships, 3.3.1 Error Identification,
 *        3.3.2 Labels or Instructions, 1.3.5 Identify Input Purpose
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeValue,
    getAttributeStringValue,
    hasDirectChildTag,
    hasNonEmptyAttr,
} from '../helpers.js'

// ── Valid autocomplete values (HTML5 autofill detail tokens) ──────────────────

const VALID_AUTOCOMPLETE_VALUES = new Set([
    'off', 'on',
    'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name',
    'honorific-suffix', 'nickname', 'email', 'username', 'new-password',
    'current-password', 'one-time-code', 'organization-title', 'organization',
    'street-address', 'shipping', 'billing', 'address-line1', 'address-line2',
    'address-line3', 'address-level4', 'address-level3', 'address-level2',
    'address-level1', 'country', 'country-name', 'postal-code',
    'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name',
    'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
    'transaction-currency', 'transaction-amount', 'language', 'bday',
    'bday-day', 'bday-month', 'bday-year', 'sex', 'tel', 'tel-country-code',
    'tel-national', 'tel-area-code', 'tel-local', 'tel-extension', 'impp',
    'url', 'photo', 'webauthn',
])

// ── A11Y-070: <fieldset> must contain <legend> ────────────────────────────────

const rule070: A11yRule = {
    id: 'A11Y-070',
    name: 'Fieldset Missing Legend',
    wcag: '1.3.1',
    level: 'A',
    category: 'forms',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: '<fieldset> elements must contain a <legend> child.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'fieldset') return null

        const hasLegend = hasDirectChildTag(path, 'legend')
        if (hasLegend) return null

        // Skip if fieldset has dynamic children (could include <legend>)
        const hasDynamicChildren = path.node.children.some(
            (c) => c.type === 'JSXExpressionContainer',
        )
        if (hasDynamicChildren) return null

        const opening = path.node.openingElement
        const elementId = getFlintId(opening, 'fieldset-no-legend')

        return {
            ruleId: 'A11Y-070',
            elementId,
            message:
                'A11Y-070: <fieldset> has no <legend> child. ' +
                'Add a <legend> element as the first child to describe the group of form controls.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Injected empty <legend>[NEEDS LABEL]</legend> into <fieldset>.',
            mutations: [
                {
                    type: 'inject',
                    args: {
                        targetNodeId: violation.elementId,
                        jsxSnippet: '<legend>[NEEDS LABEL]</legend>',
                        importSnippet: null,
                    },
                },
            ],
        }
    },
}

// ── A11Y-071: <input> with required must have aria-required ──────────────────

const rule071: A11yRule = {
    id: 'A11Y-071',
    name: 'Required Input Missing aria-required',
    wcag: '3.3.2',
    level: 'A',
    category: 'forms',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: '<input> with required attribute must also have aria-required="true".',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement

        // Check for required attribute (bare or explicit)
        const requiredAttr = getJsxAttr(opening, 'required')
        if (!requiredAttr) return null

        // Dynamic required — skip
        if (requiredAttr.type === 'JSXAttribute' && requiredAttr.value?.type === 'JSXExpressionContainer') return null

        // Check if aria-required is already set
        const ariaRequiredVal = getAttributeStringValue(opening, 'aria-required')
        if (ariaRequiredVal === 'true') return null

        const elementId = getFlintId(opening, 'input-required-no-aria')

        return {
            ruleId: 'A11Y-071',
            elementId,
            message:
                'A11Y-071: <input> has the required attribute but no aria-required="true". ' +
                'Add aria-required="true" so assistive technologies can announce the field as required.',
            severity: 'warning',
            wcag: '3.3.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added aria-required="true" to required <input>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'aria-required',
                        value: 'true',
                    },
                },
            ],
        }
    },
}

// ── A11Y-072: <input> with aria-invalid must have aria-describedby ───────────

const rule072: A11yRule = {
    id: 'A11Y-072',
    name: 'Invalid Input Missing Error Description',
    wcag: '3.3.1',
    level: 'A',
    category: 'forms',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: '<input> with aria-invalid must have aria-describedby pointing to an error message.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement

        const ariaInvalidAttr = getJsxAttr(opening, 'aria-invalid')
        if (!ariaInvalidAttr) return null

        const ariaInvalidVal = getAttributeValue(ariaInvalidAttr)
        if (ariaInvalidVal === null) return null // dynamic — skip
        if (ariaInvalidVal !== 'true' && ariaInvalidVal !== 'grammar' && ariaInvalidVal !== 'spelling') return null

        // Check for aria-describedby
        const hasAriaDescribedBy = hasNonEmptyAttr(opening, 'aria-describedby')
        if (hasAriaDescribedBy) return null

        const elementId = getFlintId(opening, 'input-invalid-no-describedby')

        return {
            ruleId: 'A11Y-072',
            elementId,
            message:
                'A11Y-072: <input> has aria-invalid but no aria-describedby. ' +
                'Add aria-describedby="[error-element-id]" pointing to an element that describes the error.',
            severity: 'critical',
            wcag: '3.3.1',
            fixable: false,
        }
    },
}

// ── A11Y-073: autocomplete must use valid values ──────────────────────────────

const rule073: A11yRule = {
    id: 'A11Y-073',
    name: 'Invalid Autocomplete Value',
    wcag: '1.3.5',
    level: 'AA',
    category: 'forms',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: 'The autocomplete attribute must use valid HTML5 autofill detail tokens.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement
        const autocompleteAttr = getJsxAttr(opening, 'autoComplete')
        if (!autocompleteAttr) return null

        const val = getAttributeValue(autocompleteAttr)
        if (val === null) return null // dynamic — skip

        const tokens = val.trim().split(/\s+/)
        const invalidTokens = tokens.filter((t) => t && !VALID_AUTOCOMPLETE_VALUES.has(t))

        if (invalidTokens.length === 0) return null

        const elementId = getFlintId(opening, 'input-invalid-autocomplete')

        return {
            ruleId: 'A11Y-073',
            elementId,
            message:
                `A11Y-073: <input> has invalid autocomplete value(s): "${invalidTokens.join('", "')}" ` +
                'Use valid HTML5 autocomplete tokens like "name", "email", "tel", "current-password", etc.',
            severity: 'critical',
            wcag: '1.3.5',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Removed invalid autocomplete value.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'autoComplete',
                        value: null,
                    },
                },
            ],
        }
    },
}

// ── A11Y-074: <input type="password"> should have autocomplete ────────────────

const rule074: A11yRule = {
    id: 'A11Y-074',
    name: 'Password Input Missing Autocomplete',
    wcag: '1.3.5',
    level: 'AA',
    category: 'forms',
    severity: 'warning',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description:
        '<input type="password"> must have an autocomplete attribute of "current-password" or "new-password" ' +
        'so password managers and ATs can correctly identify the field.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal !== 'password') return null

        const autocompleteAttr = getJsxAttr(opening, 'autoComplete')
        if (!autocompleteAttr) {
            // Missing entirely — flag it
            const elementId = getFlintId(opening, 'input-password-no-autocomplete')
            return {
                ruleId: 'A11Y-074',
                elementId,
                message:
                    'A11Y-074: <input type="password"> is missing an autoComplete attribute. ' +
                    'Add autoComplete="current-password" or autoComplete="new-password" ' +
                    'so password managers and assistive technologies can identify the field purpose.',
                severity: 'warning',
                wcag: '1.3.5',
                fixable: true,
            }
        }

        const autocompleteVal = getAttributeValue(autocompleteAttr)
        if (autocompleteVal === null) return null // dynamic — skip
        if (autocompleteVal === 'current-password' || autocompleteVal === 'new-password') return null

        const elementId = getFlintId(opening, 'input-password-wrong-autocomplete')
        return {
            ruleId: 'A11Y-074',
            elementId,
            message:
                `A11Y-074: <input type="password"> has autoComplete="${autocompleteVal}" which does not identify the password purpose. ` +
                'Use autoComplete="current-password" for login forms or autoComplete="new-password" for registration.',
            severity: 'warning',
            wcag: '1.3.5',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added autoComplete="current-password" to password input.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'autoComplete',
                        value: 'current-password',
                    },
                },
            ],
        }
    },
}

// ── A11Y-075: <output> must have htmlFor or aria-live ────────────────────────

const rule075: A11yRule = {
    id: 'A11Y-075',
    name: 'Output Element Missing Association',
    wcag: '1.3.1',
    level: 'A',
    category: 'forms',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description:
        '<output> elements should be associated with form controls via htmlFor, ' +
        'or must have aria-live to announce dynamic results.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'output') return null

        const opening = path.node.openingElement

        // Has htmlFor — associated with form control
        if (hasNonEmptyAttr(opening, 'htmlFor')) return null

        // Has aria-live — announces results dynamically
        const ariaLiveAttr = getJsxAttr(opening, 'aria-live')
        if (ariaLiveAttr?.type === 'JSXAttribute' && ariaLiveAttr.value?.type === 'JSXExpressionContainer') return null
        if (hasNonEmptyAttr(opening, 'aria-live')) return null

        // Dynamic htmlFor — skip
        const htmlForAttr = getJsxAttr(opening, 'htmlFor')
        if (htmlForAttr?.type === 'JSXAttribute' && htmlForAttr.value?.type === 'JSXExpressionContainer') return null

        const elementId = getFlintId(opening, 'output-no-association')

        return {
            ruleId: 'A11Y-075',
            elementId,
            message:
                'A11Y-075: <output> element has no htmlFor association and no aria-live attribute. ' +
                'Add htmlFor="[control-id]" to associate with a form control, ' +
                'or aria-live="polite" so screen readers announce result changes.',
            severity: 'critical',
            wcag: '1.3.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added aria-live="polite" to <output> element.',
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

// ── Export ────────────────────────────────────────────────────────────────────

export const formsRules: A11yRule[] = [rule070, rule071, rule072, rule073, rule074, rule075]
