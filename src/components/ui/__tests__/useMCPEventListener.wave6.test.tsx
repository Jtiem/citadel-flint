/**
 * useMCPEventListener.wave6.test.tsx — S7.5 Governance Delta Annotations
 *
 * Tests for the pure helper functions exported from useMCPEventListener:
 *   - formatGovernanceDelta: human-readable delta strings
 *
 * These tests cover all four documented output cases plus edge conditions.
 */

import { describe, it, expect } from 'vitest'
import { formatGovernanceDelta } from '../../../hooks/useMCPEventListener'
import type { GovernanceDelta } from '../../../hooks/useMCPEventListener'

// ── Helpers ───────────────────────────────────────────────────────────────────

function delta(fixed: number, violations: number, before?: number, after?: number): GovernanceDelta {
    return {
        before: before ?? fixed + violations,
        after: after ?? violations,
        fixed,
        violations,
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('formatGovernanceDelta', () => {
    // 1. Fixed > 0, violations > 0 → "X issues fixed, Y remaining"
    it('returns "3 issues fixed, 2 remaining" when both fixed and violations exist', () => {
        expect(formatGovernanceDelta(delta(3, 2))).toBe('3 issues fixed, 2 remaining')
    })

    // 2. Fixed = 1 singular, violations = 1 singular
    it('uses singular "issue" for counts of one', () => {
        expect(formatGovernanceDelta(delta(1, 1))).toBe('1 issue fixed, 1 remaining')
    })

    // 3. All resolved — violations === 0, fixed > 0
    it('returns "All issues resolved" when violations drop to zero after fixes', () => {
        expect(formatGovernanceDelta(delta(5, 0))).toBe('All issues resolved')
    })

    // 4. Detection-only — fixed === 0, violations > 0
    it('returns "2 issues detected" when issues are found but none fixed', () => {
        expect(formatGovernanceDelta(delta(0, 2))).toBe('2 issues detected')
    })

    // 5. Detection singular
    it('uses singular "issue" for 1 detected issue', () => {
        expect(formatGovernanceDelta(delta(0, 1))).toBe('1 issue detected')
    })

    // 6. No activity — fixed === 0, violations === 0 → empty string
    it('returns empty string when there is no activity', () => {
        expect(formatGovernanceDelta(delta(0, 0))).toBe('')
    })

    // 7. null input → empty string
    it('returns empty string for null input', () => {
        expect(formatGovernanceDelta(null)).toBe('')
    })

    // 8. undefined input → empty string
    it('returns empty string for undefined input', () => {
        expect(formatGovernanceDelta(undefined)).toBe('')
    })

    // 9. Large counts remain readable
    it('formats large counts correctly', () => {
        expect(formatGovernanceDelta(delta(42, 7))).toBe('42 issues fixed, 7 remaining')
    })

    // 10. Before/after fields do not affect the output text (only fixed/violations do)
    it('ignores before/after fields in output text', () => {
        const d = delta(3, 2, 100, 50)
        expect(formatGovernanceDelta(d)).toBe('3 issues fixed, 2 remaining')
    })
})
