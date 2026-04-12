/**
 * Fintech domain policy escalation — P3.
 *
 * Fintech apps must protect users from misclicks that trigger real money
 * movement. We enforce:
 *   - Minimum touch-target size of 44x44px (WCAG 2.1 2.5.5 Target Size)
 *   - WCAG AA+ contrast — a11y rules blocking, deltaE tightened slightly
 */

import type { ResolvedPolicy } from '../policyEngine.js'

export const FINTECH_MIN_TOUCH_TARGET_PX = 44

export function applyFintechEscalation(policy: ResolvedPolicy): ResolvedPolicy {
    const next: ResolvedPolicy = {
        ...policy,
        a11y: {
            ...policy.a11y,
            conformanceLevel: policy.a11y.conformanceLevel === 'AAA' ? 'AAA' : 'AA',
            level: policy.a11y.level === 'AAA' ? 'AAA' : 'AA',
            mode: 'blocking',
            rules: { ...policy.a11y.rules },
        },
        mithril: {
            ...policy.mithril,
            deltaEThreshold: Math.min(policy.mithril.deltaEThreshold, 1.8),
            deltaE_threshold: Math.min(policy.mithril.deltaE_threshold, 1.8),
            minTouchTargetPx: FINTECH_MIN_TOUCH_TARGET_PX,
            rules: {
                ...policy.mithril.rules,
                'MITHRIL-SPC-TOUCH': 'blocking',
            },
        },
    }

    return next
}
