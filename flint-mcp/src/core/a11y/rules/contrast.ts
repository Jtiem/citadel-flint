/**
 * Contrast rules — flint-mcp/src/core/a11y/rules/contrast.ts
 *
 * A11Y-060: Normal text contrast ratio >= 4.5:1 (AA)
 * A11Y-061: Large text contrast ratio >= 3:1 (AA)
 * A11Y-062: Non-text UI component contrast >= 3:1
 *
 * WCAG: 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast
 *
 * Risk R1 mitigation: Only flag when both foreground and background are
 * statically resolvable hex values. Skip all dynamic/inherited colors.
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getAttributeStringValue,
} from '../helpers.js'
import {
    wcagContrastRatio,
    meetsAA,
    isLargeText,
    extractColorContext,
} from '../contrast-utils.js'

// Text-bearing tags (check contrast for these)
const TEXT_TAGS = new Set([
    'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'label', 'li', 'td', 'th', 'caption', 'dt', 'dd',
    'button', 'strong', 'em', 'small', 'cite', 'code', 'abbr',
])

// Non-text interactive UI component tags
const UI_COMPONENT_TAGS = new Set([
    'input', 'select', 'textarea', 'button',
])

// ── A11Y-060: Normal text contrast >= 4.5:1 ──────────────────────────────────

const rule060: A11yRule = {
    id: 'A11Y-060',
    name: 'Normal Text Insufficient Contrast',
    wcag: '1.4.3',
    level: 'AA',
    category: 'contrast',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: 'Normal text must have a contrast ratio of at least 4.5:1.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !TEXT_TAGS.has(tag)) return null

        const opening = path.node.openingElement
        const classNameAttr = getAttributeStringValue(opening, 'className')
        if (!classNameAttr) return null

        const classes = classNameAttr.split(/\s+/).filter(Boolean)
        const colors = extractColorContext(classes)

        // Risk R1: skip if either color is not resolvable
        if (!colors.foreground || !colors.background) return null

        const ratio = wcagContrastRatio(colors.foreground, colors.background)
        if (ratio === null) return null

        const large = isLargeText(colors.fontSize, colors.fontWeight)
        if (large) return null // handled by A11Y-061

        if (meetsAA(ratio, false)) return null

        const elementId = getFlintId(opening, `${tag}-contrast-normal`)

        return {
            ruleId: 'A11Y-060',
            elementId,
            message:
                `A11Y-060: <${tag}> text contrast ratio is ${ratio.toFixed(2)}:1 ` +
                `(${colors.foreground} on ${colors.background}). ` +
                'Normal text requires at least 4.5:1 per WCAG 2.x AA.',
            severity: 'critical',
            wcag: '1.4.3',
            fixable: false,
        }
    },
}

// ── A11Y-061: Large text contrast >= 3:1 ─────────────────────────────────────

const rule061: A11yRule = {
    id: 'A11Y-061',
    name: 'Large Text Insufficient Contrast',
    wcag: '1.4.3',
    level: 'AA',
    category: 'contrast',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: 'Large text must have a contrast ratio of at least 3:1.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !TEXT_TAGS.has(tag)) return null

        const opening = path.node.openingElement
        const classNameAttr = getAttributeStringValue(opening, 'className')
        if (!classNameAttr) return null

        const classes = classNameAttr.split(/\s+/).filter(Boolean)
        const colors = extractColorContext(classes)

        // Risk R1: skip if either color is not resolvable
        if (!colors.foreground || !colors.background) return null

        const large = isLargeText(colors.fontSize, colors.fontWeight)
        if (!large) return null // handled by A11Y-060

        const ratio = wcagContrastRatio(colors.foreground, colors.background)
        if (ratio === null) return null

        if (meetsAA(ratio, true)) return null

        const elementId = getFlintId(opening, `${tag}-contrast-large`)

        return {
            ruleId: 'A11Y-061',
            elementId,
            message:
                `A11Y-061: <${tag}> large text contrast ratio is ${ratio.toFixed(2)}:1 ` +
                `(${colors.foreground} on ${colors.background}). ` +
                'Large text requires at least 3:1 per WCAG 2.x AA.',
            severity: 'critical',
            wcag: '1.4.3',
            fixable: false,
        }
    },
}

// ── A11Y-062: Non-text UI component contrast >= 3:1 ──────────────────────────

const rule062: A11yRule = {
    id: 'A11Y-062',
    name: 'UI Component Insufficient Contrast',
    wcag: '1.4.11',
    level: 'AA',
    category: 'contrast',
    severity: 'critical',
    appliesTo: 'any', // FIXTURE.1: component-safe
    description: 'UI components must have a non-text contrast ratio of at least 3:1.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (!tag || !UI_COMPONENT_TAGS.has(tag)) return null

        const opening = path.node.openingElement
        const classNameAttr = getAttributeStringValue(opening, 'className')
        if (!classNameAttr) return null

        const classes = classNameAttr.split(/\s+/).filter(Boolean)

        // Look for border color classes: border-[#hex]
        let borderColor: string | null = null
        let bgColor: string | null = null

        for (const cls of classes) {
            if (cls.startsWith('border-[#') || cls.startsWith('border-[')) {
                const match = /\[#([0-9a-fA-F]{3,8})\]/.exec(cls)
                if (match) borderColor = `#${match[1]}`
            }
            if (cls.startsWith('bg-[#') || cls.startsWith('bg-[')) {
                const match = /\[#([0-9a-fA-F]{3,8})\]/.exec(cls)
                if (match) bgColor = `#${match[1]}`
            }
        }

        // Risk R1: skip if neither border nor bg is statically resolvable
        if (!borderColor || !bgColor) return null

        const ratio = wcagContrastRatio(borderColor, bgColor)
        if (ratio === null) return null

        // Non-text contrast: >= 3:1
        if (ratio >= 3.0) return null

        const elementId = getFlintId(opening, `${tag}-non-text-contrast`)

        return {
            ruleId: 'A11Y-062',
            elementId,
            message:
                `A11Y-062: <${tag}> UI component contrast ratio is ${ratio.toFixed(2)}:1 ` +
                `(border ${borderColor} on background ${bgColor}). ` +
                'UI components require at least 3:1 per WCAG 1.4.11.',
            severity: 'critical',
            wcag: '1.4.11',
            fixable: false,
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const contrastRules: A11yRule[] = [rule060, rule061, rule062]
