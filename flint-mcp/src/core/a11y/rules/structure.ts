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
} from '../helpers.js'

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

// ── Export ────────────────────────────────────────────────────────────────────

export const structureRules: A11yRule[] = [
    rule008,
    rule009,
    rule010,
    rule015,
    rule016,
    rule017,
]
