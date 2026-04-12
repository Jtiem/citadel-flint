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

    // Force all known a11y rules to blocking unless explicitly turned off.
    const A11Y_RULES = [
        'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005',
        'A11Y-006', 'A11Y-007', 'A11Y-008', 'A11Y-009', 'A11Y-010',
    ]
    for (const ruleId of A11Y_RULES) {
        if (next.a11y.rules[ruleId] !== 'off') {
            next.a11y.rules[ruleId] = 'blocking'
        }
    }

    return next
}
