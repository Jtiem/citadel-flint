/**
 * WCAG 2.2 New Criteria — flint-mcp/src/core/a11y/rules/wcag22.ts
 *
 * A11Y-110: 2.5.7 Dragging Movements — drag gestures must have pointer alternative
 * A11Y-111: 2.5.8 Target Size Minimum — touch targets must not be below 24px
 * A11Y-112: 2.4.11 Focus Not Obscured (Minimum) — fixed/sticky overlay without aria-hidden
 * A11Y-113: 2.4.13 Focus Appearance — outline-none on interactive element without focus:ring
 * A11Y-114: 3.3.7 Redundant Entry — same-type inputs without autocomplete
 * A11Y-115: 3.3.8 Accessible Authentication — password with autocomplete="off" w/o forgot link
 * A11Y-116: 2.4.12 Focus Not Obscured (Enhanced) — advisory companion to A11Y-112
 * A11Y-117: 3.3.9 Accessible Authentication (Enhanced) — password must have credential autocomplete
 *
 * WCAG: 2.4.11, 2.4.12, 2.4.13, 2.5.7, 2.5.8, 3.3.7, 3.3.8, 3.3.9
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeStringValue,
    hasEventHandler,
} from '../helpers.js'

// Interactive tags for target-size and focus-appearance checks
const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary'])

// Tailwind classes that indicate a small fixed dimension (< 24px equivalent)
// w-4 = 1rem = 16px, h-4 = 16px, w-3 = 12px, h-3 = 12px, etc.
const SMALL_DIMENSION_CLASSES = new Set([
    'w-1', 'h-1', 'w-2', 'h-2', 'w-3', 'h-3', 'w-4', 'h-4', 'w-5', 'h-5',
    'size-1', 'size-2', 'size-3', 'size-4', 'size-5',
])

// Pixel values considered too small for a touch target (< 24)
const SMALL_PX_PATTERN = /^(\d+)px$/

// ── A11Y-110: 2.5.7 Dragging Movements Alternative ───────────────────────────

const rule110: A11yRule = {
    id: 'A11Y-110',
    name: 'Dragging Movement Without Pointer Alternative',
    wcag: '2.5.7',
    level: 'AA',
    category: 'keyboard',
    severity: 'critical',
    description:
        'All functionality that uses dragging (onDragStart, onDrag, onDrop) must also be ' +
        'operable with a single pointer (onClick, onPointerDown, etc.).',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        const hasDragHandler =
            hasEventHandler(opening, 'onDragStart') ||
            hasEventHandler(opening, 'onDrag') ||
            hasEventHandler(opening, 'onDrop')

        if (!hasDragHandler) return null

        // Single-pointer alternatives
        const hasSinglePointerAlternative =
            hasEventHandler(opening, 'onClick') ||
            hasEventHandler(opening, 'onPointerDown') ||
            hasEventHandler(opening, 'onPointerUp') ||
            hasEventHandler(opening, 'onTouchStart')

        if (hasSinglePointerAlternative) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-drag-no-pointer-alt`)

        return {
            ruleId: 'A11Y-110',
            elementId,
            message:
                `A11Y-110: <${tag}> uses drag gesture handlers (onDragStart/onDrag/onDrop) without a ` +
                'single-pointer alternative (onClick, onPointerDown, etc.). ' +
                'WCAG 2.5.7 requires all drag functionality to be operable without dragging.',
            severity: 'critical',
            wcag: '2.5.7',
            fixable: false,
        }
    },
}

// ── A11Y-111: 2.5.8 Target Size Minimum ──────────────────────────────────────

const rule111: A11yRule = {
    id: 'A11Y-111',
    name: 'Target Size Below Minimum (24x24px)',
    wcag: '2.5.8',
    level: 'AA',
    category: 'keyboard',
    severity: 'warning',
    description:
        'Touch targets on interactive elements must be at least 24x24 CSS pixels. ' +
        'Detect patterns like w-4/h-4 Tailwind classes or inline width/height < 24px.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !INTERACTIVE_TAGS.has(tag)) return null

        const opening = path.node.openingElement

        // Check Tailwind className for small dimension classes on both width and height
        const classNameVal = getAttributeStringValue(opening, 'className')
        if (classNameVal) {
            const classes = new Set(classNameVal.split(/\s+/))
            const hasSmallWidth = [...SMALL_DIMENSION_CLASSES].some(
                (c) => classes.has(c) && (c.startsWith('w-') || c.startsWith('size-')),
            )
            const hasSmallHeight = [...SMALL_DIMENSION_CLASSES].some(
                (c) => classes.has(c) && (c.startsWith('h-') || c.startsWith('size-')),
            )
            if (hasSmallWidth && hasSmallHeight) {
                const elementId = getFlintId(opening, `${tag}-target-size-class`)
                return {
                    ruleId: 'A11Y-111',
                    elementId,
                    message:
                        `A11Y-111: <${tag}> has Tailwind size classes that set width/height below 24px ` +
                        `(classes: "${classNameVal.split(/\s+/).filter((c) => SMALL_DIMENSION_CLASSES.has(c)).join(' ')}"
). ` +
                        'WCAG 2.5.8 requires touch targets to be at least 24x24 CSS pixels.',
                    severity: 'warning',
                    wcag: '2.5.8',
                    fixable: false,
                }
            }
        }

        // Check inline style for width/height < 24px
        const styleAttr = getJsxAttr(opening, 'style')
        if (
            styleAttr?.type === 'JSXAttribute' &&
            styleAttr.value?.type === 'JSXExpressionContainer' &&
            styleAttr.value.expression.type === 'ObjectExpression'
        ) {
            const properties = styleAttr.value.expression.properties
            let smallWidth = false
            let smallHeight = false

            for (const prop of properties) {
                if (prop.type !== 'ObjectProperty') continue
                const key =
                    prop.key.type === 'Identifier'
                        ? prop.key.name
                        : prop.key.type === 'StringLiteral'
                          ? prop.key.value
                          : null
                if (!key) continue

                const val =
                    prop.value.type === 'StringLiteral'
                        ? prop.value.value
                        : prop.value.type === 'NumericLiteral'
                          ? String(prop.value.value)
                          : null
                if (!val) continue

                const pxMatch = SMALL_PX_PATTERN.exec(val)
                const numVal = pxMatch ? parseInt(pxMatch[1], 10) : prop.value.type === 'NumericLiteral' ? prop.value.value : null

                if (numVal !== null && numVal < 24) {
                    if (key === 'width') smallWidth = true
                    if (key === 'height') smallHeight = true
                }
            }

            if (smallWidth && smallHeight) {
                const elementId = getFlintId(opening, `${tag}-target-size-inline`)
                return {
                    ruleId: 'A11Y-111',
                    elementId,
                    message:
                        `A11Y-111: <${tag}> has inline style width/height set below 24px. ` +
                        'WCAG 2.5.8 requires touch targets to be at least 24x24 CSS pixels.',
                    severity: 'warning',
                    wcag: '2.5.8',
                    fixable: false,
                }
            }
        }

        return null
    },
}

// ── A11Y-112: 2.4.11 Focus Not Obscured (Minimum) ────────────────────────────
//
// Elements using fixed/sticky positioning with a high z-index can obscure
// focused elements below them. Conservative detection: flag only when
// className contains BOTH a position-fixed/sticky AND a z-index class,
// and the element does NOT have aria-hidden (which would remove it from
// keyboard traversal entirely).

// Use class-list splitting rather than regex to avoid matching substrings
// (e.g. "unfixed" contains "fixed" at a hyphen word boundary).
const FIXED_STICKY_CLASSES = new Set(['fixed', 'sticky'])
const Z_INDEX_PREFIX = 'z-'

const rule112: A11yRule = {
    id: 'A11Y-112',
    name: 'Fixed/Sticky Element May Obscure Focused Component',
    wcag: '2.4.11',
    level: 'AA',
    category: 'keyboard',
    severity: 'warning',
    description:
        'Elements with position fixed/sticky and a z-index may obscure keyboard-focused ' +
        'elements beneath them. Add aria-hidden="true" to purely decorative overlays, ' +
        'or ensure focus management prevents obscurement.',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        const classNameVal = getAttributeStringValue(opening, 'className')
        if (!classNameVal) return null

        const classes = new Set(classNameVal.split(/\s+/))
        const hasFixedOrSticky = [...FIXED_STICKY_CLASSES].some((c) => classes.has(c))
        if (!hasFixedOrSticky) return null

        const hasZIndex = [...classes].some((c) => c.startsWith(Z_INDEX_PREFIX) && c.length > Z_INDEX_PREFIX.length)
        if (!hasZIndex) return null

        // If aria-hidden="true" the element is removed from AT — not a focus concern
        const ariaHidden = getAttributeStringValue(opening, 'aria-hidden')
        if (ariaHidden === 'true') return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-fixed-obscure`)

        return {
            ruleId: 'A11Y-112',
            elementId,
            message:
                `A11Y-112: <${tag}> uses fixed/sticky positioning with a z-index and may obscure ` +
                'keyboard-focused elements beneath it. ' +
                'WCAG 2.4.11 requires that focused components are not entirely hidden by overlays. ' +
                'Add aria-hidden="true" if decorative, or ensure focused elements remain visible.',
            severity: 'warning',
            wcag: '2.4.11',
            fixable: false,
        }
    },
}

// ── A11Y-113: 2.4.13 Focus Appearance ────────────────────────────────────────
//
// outline-none or focus:outline-none on interactive elements without a
// compensating focus:ring-* or focus-visible:* class. This is the WCAG 2.2
// upgrade of the existing A11Y-022 (focus indicator removed) — A11Y-022 catches
// all elements; this rule specifically targets interactive elements and maps to
// the WCAG 2.2 criterion with critical severity.

const OUTLINE_REMOVAL_CLASSES = new Set([
    'outline-none',
    'focus:outline-none',
    'outline-0',
    'focus:outline-0',
])

const rule113: A11yRule = {
    id: 'A11Y-113',
    name: 'Focus Appearance — Outline Removed Without Replacement',
    wcag: '2.4.13',
    level: 'AA',
    category: 'keyboard',
    severity: 'critical',
    description:
        'Interactive elements (buttons, links, inputs) must not remove the focus outline ' +
        'without providing a visible replacement focus indicator (focus:ring-*, focus-visible:*).',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !INTERACTIVE_TAGS.has(tag)) return null

        const opening = path.node.openingElement
        const classNameVal = getAttributeStringValue(opening, 'className')
        if (!classNameVal) return null

        const classes = classNameVal.split(/\s+/)
        const removesOutline = classes.some((c) => OUTLINE_REMOVAL_CLASSES.has(c))
        if (!removesOutline) return null

        const hasFocusReplacement = classes.some(
            (c) =>
                c.startsWith('focus:ring') ||
                c.startsWith('focus:border') ||
                c.startsWith('focus:shadow') ||
                c.startsWith('focus-visible:'),
        )
        if (hasFocusReplacement) return null

        const elementId = getFlintId(opening, `${tag}-focus-appearance`)

        return {
            ruleId: 'A11Y-113',
            elementId,
            message:
                `A11Y-113: <${tag}> removes the focus outline (${classes.filter((c) => OUTLINE_REMOVAL_CLASSES.has(c)).join(', ')}) ` +
                'without a visible replacement. ' +
                'WCAG 2.4.13 requires focus indicators to meet minimum size and contrast requirements. ' +
                'Add focus:ring-* or focus-visible:ring-* classes to provide a compliant focus indicator.',
            severity: 'critical',
            wcag: '2.4.13',
            fixable: false,
        }
    },
}

// ── A11Y-114: 3.3.7 Redundant Entry ──────────────────────────────────────────
//
// Conservative: flag JSX that contains two or more <input> elements of the
// same type="email" or type="tel" without an autocomplete attribute.
// We inspect the JSXElement's child tree for sibling inputs.

const REDUNDANT_ENTRY_TYPES = new Set(['email', 'tel'])

const rule114: A11yRule = {
    id: 'A11Y-114',
    name: 'Redundant Entry — Same-Type Inputs Without Autocomplete',
    wcag: '3.3.7',
    level: 'AA',
    category: 'forms',
    severity: 'warning',
    description:
        'Forms with multiple inputs of the same type (email/tel) should use autocomplete ' +
        'so users do not have to re-enter information they have already provided.',

    visitElement(path, _context) {
        // Only inspect container elements that could be forms or form sections
        const tag = getTagName(path)
        if (!tag || INTERACTIVE_TAGS.has(tag)) return null

        // Count direct-child <input> elements by type
        const typeCounts: Map<string, number> = new Map()
        const typeAutocompleteMissing: Map<string, boolean> = new Map()

        for (const child of path.node.children) {
            if (child.type !== 'JSXElement') continue
            const childName = child.openingElement.name
            if (childName.type !== 'JSXIdentifier') continue
            if (childName.name.toLowerCase() !== 'input') continue

            // Get type attribute
            const typeAttr = child.openingElement.attributes.find(
                (a) =>
                    a.type === 'JSXAttribute' &&
                    a.name.type === 'JSXIdentifier' &&
                    a.name.name === 'type',
            )
            if (!typeAttr || typeAttr.type !== 'JSXAttribute') continue
            const typeVal =
                typeAttr.value?.type === 'StringLiteral'
                    ? typeAttr.value.value
                    : typeAttr.value?.type === 'JSXExpressionContainer' &&
                        typeAttr.value.expression.type === 'StringLiteral'
                      ? typeAttr.value.expression.value
                      : null
            if (!typeVal || !REDUNDANT_ENTRY_TYPES.has(typeVal)) continue

            typeCounts.set(typeVal, (typeCounts.get(typeVal) ?? 0) + 1)

            // Check autocomplete
            const hasAutocomplete = child.openingElement.attributes.some(
                (a) =>
                    a.type === 'JSXAttribute' &&
                    a.name.type === 'JSXIdentifier' &&
                    a.name.name === 'autoComplete',
            )
            if (!hasAutocomplete) {
                typeAutocompleteMissing.set(typeVal, true)
            }
        }

        // Find types that appear 2+ times and are missing autocomplete
        const violations: string[] = []
        for (const [type, count] of typeCounts) {
            if (count >= 2 && typeAutocompleteMissing.get(type)) {
                violations.push(type)
            }
        }

        if (violations.length === 0) return null

        const elementId = getFlintId(path.node.openingElement, `${tag}-redundant-entry`)

        return {
            ruleId: 'A11Y-114',
            elementId,
            message:
                `A11Y-114: <${tag}> contains multiple inputs of type ${violations.map((v) => `"${v}"`).join(' and ')} ` +
                'without an autocomplete attribute. ' +
                'WCAG 3.3.7 requires that previously-entered information can be auto-populated. ' +
                `Add autoComplete="${violations[0]}" to avoid requiring redundant entry.`,
            severity: 'warning',
            wcag: '3.3.7',
            fixable: false,
        }
    },
}

// ── A11Y-115: 3.3.8 Accessible Authentication (Minimum) ──────────────────────
//
// <input type="password"> with autocomplete="off" or autocomplete="new-password"
// is flagged as an advisory warning because disabling autocomplete forces users
// (especially those with cognitive disabilities or using password managers) to
// manually transcribe credentials. We emit a warning, not critical, because
// there are legitimate security contexts (OTP, new-password flows).

const rule115: A11yRule = {
    id: 'A11Y-115',
    name: 'Accessible Authentication — Password Autocomplete Disabled',
    wcag: '3.3.8',
    level: 'AA',
    category: 'forms',
    severity: 'warning',
    description:
        '<input type="password"> must not have autocomplete="off" without providing ' +
        'an alternative authentication mechanism (e.g., password manager support).',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal !== 'password') return null

        const autocompleteAttr = getJsxAttr(opening, 'autoComplete')
        if (!autocompleteAttr || autocompleteAttr.type !== 'JSXAttribute') return null

        const autocompleteVal =
            autocompleteAttr.value?.type === 'StringLiteral'
                ? autocompleteAttr.value.value
                : autocompleteAttr.value?.type === 'JSXExpressionContainer' &&
                    autocompleteAttr.value.expression.type === 'StringLiteral'
                  ? autocompleteAttr.value.expression.value
                  : null

        if (autocompleteVal === null) return null // dynamic — skip
        if (autocompleteVal !== 'off') return null

        const elementId = getFlintId(opening, 'input-password-autocomplete-off')

        return {
            ruleId: 'A11Y-115',
            elementId,
            message:
                'A11Y-115: <input type="password"> has autoComplete="off", which prevents password ' +
                'managers from assisting users. ' +
                'WCAG 3.3.8 (Accessible Authentication) requires that users are not prevented from ' +
                'using authentication assistance. Use autoComplete="current-password" instead.',
            severity: 'warning',
            wcag: '3.3.8',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Changed autoComplete from "off" to "current-password" to allow password manager assistance.',
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

// ── A11Y-116: 2.4.12 Focus Not Obscured (Enhanced) ───────────────────────────
//
// Advisory companion to A11Y-112. Same detection, lower threshold — advisory only.
// Flags any fixed/sticky element with z-index, even without a known z-level concern.

const rule116: A11yRule = {
    id: 'A11Y-116',
    name: 'Fixed/Sticky Element May Partially Obscure Focused Component (Advisory)',
    wcag: '2.4.12',
    level: 'AAA',
    category: 'keyboard',
    severity: 'warning',
    description:
        'Advisory: elements with position fixed/sticky and any z-index may partially ' +
        'obscure focused elements. WCAG 2.4.12 (Enhanced) requires full visibility.',

    visitElement(path, _context) {
        const opening = path.node.openingElement

        const classNameVal = getAttributeStringValue(opening, 'className')
        if (!classNameVal) return null

        // Only flag if BOTH fixed/sticky AND a z-index are present
        const classes116 = new Set(classNameVal.split(/\s+/))
        if (![...FIXED_STICKY_CLASSES].some((c) => classes116.has(c))) return null
        if (![...classes116].some((c) => c.startsWith(Z_INDEX_PREFIX) && c.length > Z_INDEX_PREFIX.length)) return null

        // If already flagged by A11Y-112 (no aria-hidden), skip
        // — actually A11Y-116 fires independently as an advisory note.
        // We intentionally allow both to fire; downstream policy filters severity.

        const ariaHidden = getAttributeStringValue(opening, 'aria-hidden')
        if (ariaHidden === 'true') return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-focus-obscured-enhanced`)

        return {
            ruleId: 'A11Y-116',
            elementId,
            message:
                `A11Y-116 (Advisory): <${tag}> uses fixed/sticky positioning with z-index and may ` +
                'partially obscure focused elements. ' +
                'WCAG 2.4.12 (Enhanced) requires that focused components are fully visible.',
            severity: 'warning',
            wcag: '2.4.12',
            fixable: false,
        }
    },
}

// ── A11Y-117: 3.3.9 Accessible Authentication (Enhanced) ─────────────────────
//
// <input type="password"> must have autocomplete set to a valid credential value
// (current-password or new-password). This is the enhanced criterion — advisory only.

const VALID_CREDENTIAL_AUTOCOMPLETE = new Set(['current-password', 'new-password'])

const rule117: A11yRule = {
    id: 'A11Y-117',
    name: 'Accessible Authentication Enhanced — Password Autocomplete Required',
    wcag: '3.3.9',
    level: 'AAA',
    category: 'forms',
    severity: 'warning',
    description:
        '<input type="password"> must have autocomplete set to "current-password" or ' +
        '"new-password" so that password managers and AT can assist with authentication.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'input') return null

        const opening = path.node.openingElement
        const typeVal = getAttributeStringValue(opening, 'type')
        if (typeVal !== 'password') return null

        const autocompleteAttr = getJsxAttr(opening, 'autoComplete')
        if (!autocompleteAttr || autocompleteAttr.type !== 'JSXAttribute') {
            // Missing entirely
            const elementId = getFlintId(opening, 'input-password-no-credential-autocomplete')
            return {
                ruleId: 'A11Y-117',
                elementId,
                message:
                    'A11Y-117: <input type="password"> is missing an autoComplete attribute with a ' +
                    'credential value. ' +
                    'WCAG 3.3.9 (Enhanced) requires password inputs to support copy-paste and ' +
                    'password manager assistance. Add autoComplete="current-password" or ' +
                    'autoComplete="new-password".',
                severity: 'warning',
                wcag: '3.3.9',
                fixable: true,
            }
        }

        const autocompleteVal =
            autocompleteAttr.value?.type === 'StringLiteral'
                ? autocompleteAttr.value.value
                : autocompleteAttr.value?.type === 'JSXExpressionContainer' &&
                    autocompleteAttr.value.expression.type === 'StringLiteral'
                  ? autocompleteAttr.value.expression.value
                  : null

        if (autocompleteVal === null) return null // dynamic — skip
        if (VALID_CREDENTIAL_AUTOCOMPLETE.has(autocompleteVal)) return null

        const elementId = getFlintId(opening, 'input-password-wrong-credential-autocomplete')
        return {
            ruleId: 'A11Y-117',
            elementId,
            message:
                `A11Y-117: <input type="password"> has autoComplete="${autocompleteVal}" which does not ` +
                'identify a credential value. ' +
                'WCAG 3.3.9 (Enhanced) requires autoComplete="current-password" or "new-password".',
            severity: 'warning',
            wcag: '3.3.9',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Set autoComplete="current-password" to support password manager assistance.',
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

// ── Export ────────────────────────────────────────────────────────────────────

export const wcag22Rules: A11yRule[] = [
    rule110,
    rule111,
    rule112,
    rule113,
    rule114,
    rule115,
    rule116,
    rule117,
]
