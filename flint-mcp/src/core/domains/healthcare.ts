/**
 * Healthcare domain policy escalation — P3.
 *
 * Healthcare apps handle PHI and must meet the strictest accessibility bar:
 *   - WCAG 2.1 AAA conformance (elevated from AA default)
 *   - Tighter CIEDE2000 threshold (1.5) — reduces color drift ambiguity for
 *     clinical UI where low-contrast misreads can harm patients
 *   - All a11y rules treated as blocking — no advisory downgrades
 */

import type { ResolvedPolicy } from '../policyEngine.js'
import { getErrorsByCategory } from '../errorTaxonomy.js'

/**
 * Collect every known a11y rule ID the project might legitimately enforce.
 * Sources:
 *   1. Rules already present on the resolved policy (whatever the user
 *      / preset / rule pack loaded).
 *   2. Rules declared in the static errorTaxonomy registry — ensures we
 *      escalate rules even when the current policy preset has not yet
 *      materialized them (prevents the A11Y-011+ silent-downgrade hole).
 *
 * Anything that starts with `A11Y-` is in scope. The previous implementation
 * hard-coded A11Y-001..010 which silently skipped 40+ WCAG 2.1 AA rules
 * (contrast, ARIA, live regions, motion, forms) — a Commandment 5 defect
 * for any healthcare or government deployment. This helper closes that hole.
 */
function collectAllA11yRuleIds(policy: ResolvedPolicy): string[] {
    const ids = new Set<string>()
    for (const k of Object.keys(policy.a11y.rules)) {
        if (k.startsWith('A11Y-')) ids.add(k)
    }
    for (const entry of getErrorsByCategory('a11y')) {
        if (entry.ruleId && entry.ruleId.startsWith('A11Y-')) {
            ids.add(entry.ruleId)
        }
    }
    return Array.from(ids)
}

export function applyHealthcareEscalation(policy: ResolvedPolicy): ResolvedPolicy {
    const next: ResolvedPolicy = {
        ...policy,
        a11y: {
            ...policy.a11y,
            conformanceLevel: 'AAA',
            level: 'AAA',
            mode: 'blocking',
            rules: { ...policy.a11y.rules },
        },
        mithril: {
            ...policy.mithril,
            deltaEThreshold: 1.5,
            deltaE_threshold: 1.5,
            mode: policy.mithril.mode === 'off' ? 'off' : 'blocking',
            rules: { ...policy.mithril.rules },
        },
    }

    // Force ALL known a11y rules to blocking unless explicitly turned off.
    // Dynamic enumeration — the registry is the source of truth so newly
    // registered WCAG 2.1 AA rules are automatically escalated in healthcare
    // / government modes without a code change.
    const allA11yRuleIds = collectAllA11yRuleIds(next)
    for (const ruleId of allA11yRuleIds) {
        if (next.a11y.rules[ruleId] !== 'off') {
            next.a11y.rules[ruleId] = 'blocking'
        }
    }

    return next
}
