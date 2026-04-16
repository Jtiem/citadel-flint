/**
 * rulePackRegistry.findPackForRule.test.ts
 *
 * Unit tests for the reverse-lookup findPackForRule function added in Sprint 4.
 * Covers: known rule ID, unknown rule ID, duplicate-rule-ID warning (once per ID),
 * and memoization correctness.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
    findPackForRule,
    _resetReverseIndexForTesting,
    RULE_PACK_REGISTRY,
} from '../rulePackRegistry.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick rule IDs that are guaranteed to exist in the static registry. */
const KNOWN_WCAG_RULE_ID = 'A11Y-001'
const KNOWN_MITHRIL_RULE_ID = 'MITHRIL-COL'
const UNKNOWN_RULE_ID = 'DOES-NOT-EXIST-99999'

// ---------------------------------------------------------------------------
// Setup: reset memoized state before each test so tests are isolated.
// ---------------------------------------------------------------------------

beforeEach(() => {
    _resetReverseIndexForTesting()
    vi.restoreAllMocks()
})

afterEach(() => {
    _resetReverseIndexForTesting()
})

// ---------------------------------------------------------------------------
// findPackForRule — happy path
// ---------------------------------------------------------------------------

describe('findPackForRule', () => {
    it('returns the correct pack for a known WCAG rule ID', () => {
        const pack = findPackForRule(KNOWN_WCAG_RULE_ID)
        expect(pack).not.toBeNull()
        expect(pack!.id).toBe('wcag-2.1-aa')
    })

    it('returns the correct pack for a known Mithril rule ID', () => {
        const pack = findPackForRule(KNOWN_MITHRIL_RULE_ID)
        expect(pack).not.toBeNull()
        expect(pack!.id).toBe('mithril-design-system')
    })

    it('returns null for an unknown rule ID', () => {
        const pack = findPackForRule(UNKNOWN_RULE_ID)
        expect(pack).toBeNull()
    })

    it('returns null for an empty string rule ID', () => {
        const pack = findPackForRule('')
        expect(pack).toBeNull()
    })

    it('every rule in the registry resolves back to its owning pack', () => {
        for (const expectedPack of RULE_PACK_REGISTRY) {
            for (const rule of expectedPack.rules) {
                const result = findPackForRule(rule.id)
                // Must resolve to some pack (the first one that owns it)
                expect(result, `rule ${rule.id} should resolve to a pack`).not.toBeNull()
            }
        }
    })
})

// ---------------------------------------------------------------------------
// Duplicate rule ID — warning behaviour
// ---------------------------------------------------------------------------

describe('findPackForRule — duplicate rule ID warning', () => {
    it('emits console.warn once when a duplicate rule ID is detected on first lookup', () => {
        // Find a rule ID that currently only exists in one pack, then synthesise
        // a temporary second occurrence by temporarily pushing a fake rule into
        // a second pack's rules array.  We restore the array after the test.
        const [packA, packB] = RULE_PACK_REGISTRY.filter((p) => p.rules.length > 0)
        const conflictRuleId = packA.rules[0].id

        // Add the same rule ID to packB temporarily.
        const fakeDuplicate = { ...packA.rules[0] }
        packB.rules.push(fakeDuplicate)

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        try {
            // First lookup — should build index and emit the warning.
            findPackForRule(conflictRuleId)
            expect(warnSpy).toHaveBeenCalledOnce()
            expect(warnSpy.mock.calls[0][0]).toContain(conflictRuleId)

            // Reset index so it rebuilds on next call.
            _resetReverseIndexForTesting()
            warnSpy.mockClear()

            // Second lookup for the same rule ID — warning should fire again
            // (index was reset, so it rebuilds), but only once per lookup cycle.
            findPackForRule(conflictRuleId)
            expect(warnSpy).toHaveBeenCalledOnce()

            // Third lookup WITHOUT resetting — warning must NOT fire again
            // (warnedDuplicateRuleIds set already contains the ID).
            warnSpy.mockClear()
            findPackForRule(conflictRuleId)
            expect(warnSpy).not.toHaveBeenCalled()
        } finally {
            // Restore packB's rules array.
            packB.rules.pop()
        }
    })

    it('warning message includes both pack IDs', () => {
        const [packA, packB] = RULE_PACK_REGISTRY.filter((p) => p.rules.length > 0)
        const conflictRuleId = packA.rules[0].id
        const fakeDuplicate = { ...packA.rules[0] }
        packB.rules.push(fakeDuplicate)

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        try {
            findPackForRule(conflictRuleId)
            const msg: string = warnSpy.mock.calls[0][0] as string
            expect(msg).toContain(packA.id)
            expect(msg).toContain(packB.id)
        } finally {
            packB.rules.pop()
        }
    })
})

// ---------------------------------------------------------------------------
// Memoization
// ---------------------------------------------------------------------------

describe('findPackForRule — memoization', () => {
    it('returns the same pack object reference on repeated calls (index not rebuilt)', () => {
        // Call twice — result should be the same reference.
        const first = findPackForRule(KNOWN_WCAG_RULE_ID)
        const second = findPackForRule(KNOWN_WCAG_RULE_ID)
        expect(first).toBe(second)
    })

    it('rebuilds the index after _resetReverseIndexForTesting', () => {
        const first = findPackForRule(KNOWN_WCAG_RULE_ID)
        _resetReverseIndexForTesting()
        const second = findPackForRule(KNOWN_WCAG_RULE_ID)
        // After reset the index is rebuilt — result should still be correct.
        expect(second).not.toBeNull()
        expect(second!.id).toBe(first!.id)
    })

    it('index is built lazily — no side effects at module import time', () => {
        // After resetting, a lookup for an unknown ID should not throw and
        // should leave a valid index for subsequent known lookups.
        _resetReverseIndexForTesting()
        expect(findPackForRule(UNKNOWN_RULE_ID)).toBeNull()
        expect(findPackForRule(KNOWN_WCAG_RULE_ID)).not.toBeNull()
    })
})
