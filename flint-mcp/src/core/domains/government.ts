/**
 * Government domain policy escalation — P3.
 *
 * US federal projects must meet Section 508 + WCAG 2.1 AAA. Combine the
 * healthcare escalation (AAA + tight deltaE + all a11y blocking) with
 * additional Section 508 naming rules.
 */

import type { ResolvedPolicy } from '../policyEngine.js'
import { applyHealthcareEscalation } from './healthcare.js'

/** Section 508-specific a11y rule IDs flagged as blocking in government mode. */
export const SECTION_508_RULES = [
    'A11Y-001', // name-labels: accessible name required
    'A11Y-002', // aria-required-attr
    'A11Y-003', // landmarks
    'A11Y-004', // labels-for-inputs
] as const

export function applyGovernmentEscalation(policy: ResolvedPolicy): ResolvedPolicy {
    // Start from healthcare — AAA, tight deltaE, blocking a11y.
    const base = applyHealthcareEscalation(policy)

    const next: ResolvedPolicy = {
        ...base,
        a11y: {
            ...base.a11y,
            rules: { ...base.a11y.rules },
            section508: true,
        },
    }

    for (const ruleId of SECTION_508_RULES) {
        next.a11y.rules[ruleId] = 'blocking'
    }

    return next
}
