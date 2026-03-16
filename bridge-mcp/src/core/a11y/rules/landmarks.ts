/**
 * Landmark rules — bridge-mcp/src/core/a11y/rules/landmarks.ts
 *
 * A11Y-050: Page must have a <main> or role="main"
 * A11Y-051: Page should have a <nav> or role="navigation" (warning-level)
 * A11Y-052: <main> must not appear more than once
 * A11Y-053: Multiple landmarks of same type must have distinct aria-label
 *
 * WCAG: 1.3.1 Info and Relationships, 2.4.1 Bypass Blocks
 */

import type { A11yRule, A11yRuleContext, A11yViolationDetail } from '../types.js'
import {
    getBridgeId,
    getTagName,
    getAttributeValue,
    getJsxAttr,
} from '../helpers.js'

// ── A11Y-050: Page must have <main> ──────────────────────────────────────────

const rule050: A11yRule = {
    id: 'A11Y-050',
    name: 'Missing Main Landmark',
    wcag: '1.3.1',
    level: 'A',
    category: 'landmarks',
    severity: 'critical',
    description: 'The page must have a <main> element or an element with role="main".',

    auditDocument(context): A11yViolationDetail[] {
        // Skip if no HTML elements found — this is a utility module, not a page
        if (context.totalElements === 0) return []
        // Only flag full-page layouts (has page-structure elements like header, footer, section, etc.)
        if (!context.hasPageStructure) return []
        if (context.landmarksFound.has('main')) return []

        return [
            {
                ruleId: 'A11Y-050',
                elementId: 'document',
                message:
                    'A11Y-050: No <main> landmark found. ' +
                    'Add a <main> element or role="main" to identify the main content area.',
                severity: 'critical',
                wcag: '1.3.1',
                fixable: false,
            },
        ]
    },
}

// ── A11Y-051: Page should have <nav> (warning) ────────────────────────────────

const rule051: A11yRule = {
    id: 'A11Y-051',
    name: 'Missing Navigation Landmark',
    wcag: '1.3.1',
    level: 'A',
    category: 'landmarks',
    severity: 'warning',
    description: 'The page should have a <nav> element or an element with role="navigation".',

    auditDocument(context): A11yViolationDetail[] {
        // Skip if no HTML elements found — this is a utility module, not a page
        if (context.totalElements === 0) return []
        // Only flag full-page layouts
        if (!context.hasPageStructure) return []
        if (context.landmarksFound.has('navigation')) return []

        return [
            {
                ruleId: 'A11Y-051',
                elementId: 'document',
                message:
                    'A11Y-051: No <nav> landmark found. ' +
                    'Consider adding a <nav> element for the primary navigation to improve structure for screen reader users.',
                severity: 'warning',
                wcag: '1.3.1',
                fixable: false,
            },
        ]
    },
}

// ── A11Y-052: <main> must not appear more than once ───────────────────────────

const rule052: A11yRule = {
    id: 'A11Y-052',
    name: 'Multiple Main Landmarks',
    wcag: '1.3.1',
    level: 'A',
    category: 'landmarks',
    severity: 'critical',
    description: '<main> must not appear more than once per page.',

    auditDocument(context): A11yViolationDetail[] {
        if (context.totalElements === 0) return []
        if (!context.hasPageStructure) return []
        const mainInstances = context.landmarkInstances.filter((l) => l.role === 'main')
        if (mainInstances.length <= 1) return []

        return [
            {
                ruleId: 'A11Y-052',
                elementId: 'document',
                message:
                    `A11Y-052: Found ${mainInstances.length} <main> landmarks. ` +
                    'A page must have at most one <main> element.',
                severity: 'critical',
                wcag: '1.3.1',
                fixable: false,
            },
        ]
    },
}

// ── A11Y-053: Multiple same-type landmarks must have distinct aria-label ──────

const rule053: A11yRule = {
    id: 'A11Y-053',
    name: 'Duplicate Landmark Without Distinct Label',
    wcag: '1.3.1',
    level: 'A',
    category: 'landmarks',
    severity: 'critical',
    description: 'Multiple landmarks of the same type must have distinct aria-labels.',

    auditDocument(context): A11yViolationDetail[] {
        if (context.totalElements === 0) return []
        if (!context.hasPageStructure) return []
        const violations: A11yViolationDetail[] = []

        // Group by role
        const byRole = new Map<string, Array<{ label: string | null; elementId: string }>>()
        for (const instance of context.landmarkInstances) {
            const existing = byRole.get(instance.role) ?? []
            existing.push({ label: instance.label, elementId: instance.elementId })
            byRole.set(instance.role, existing)
        }

        for (const [role, instances] of byRole.entries()) {
            if (instances.length <= 1) continue

            // Check if any are missing labels or have duplicate labels
            const labels = instances.map((i) => i.label)
            const hasUnlabeled = labels.some((l) => !l)
            const uniqueLabels = new Set(labels.filter(Boolean))
            const hasDuplicateLabels = uniqueLabels.size < instances.filter((i) => i.label).length

            if (hasUnlabeled || hasDuplicateLabels) {
                violations.push({
                    ruleId: 'A11Y-053',
                    elementId: instances[0].elementId,
                    message:
                        `A11Y-053: Multiple "${role}" landmarks found (${instances.length}) without distinct aria-labels. ` +
                        `Add aria-label="…" to each <${role === 'navigation' ? 'nav' : role}> to distinguish them for screen reader users.`,
                    severity: 'critical',
                    wcag: '1.3.1',
                    fixable: false,
                })
            }
        }

        return violations
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const landmarksRules: A11yRule[] = [rule050, rule051, rule052, rule053]
