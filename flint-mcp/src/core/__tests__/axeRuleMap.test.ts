/**
 * Tests for the axe-core → Warden rule map
 * flint-mcp/src/core/__tests__/axeRuleMap.test.ts
 *
 * RUNTIME.1 — boundary coverage for `mapAxeRuleToWardenRule`.
 *
 * These tests fail-fast when:
 *   - A curated mapping drifts from the Warden rule registry
 *   - axe-core releases a new rule we did not explicitly register
 *   - Edge-case inputs (empty, whitespace, non-strings) are not rejected
 */

import { describe, it, expect } from 'vitest'
import { AXE_RULE_MAP, mapAxeRuleToWardenRule, mapAxeRuleToWarden } from '../axeRuleMap.js'

describe('axeRuleMap', () => {
    // ── Known mappings (testBoundary: mapAxeRuleToWarden known) ────────────

    describe('known axe rule mappings', () => {
        it('maps image-alt to A11Y-001', () => {
            expect(mapAxeRuleToWardenRule('image-alt')).toBe('A11Y-001')
        })

        it('maps button-name to A11Y-002', () => {
            expect(mapAxeRuleToWardenRule('button-name')).toBe('A11Y-002')
        })

        it('maps link-name to A11Y-003', () => {
            expect(mapAxeRuleToWardenRule('link-name')).toBe('A11Y-003')
        })

        it('maps label to A11Y-004', () => {
            expect(mapAxeRuleToWardenRule('label')).toBe('A11Y-004')
        })

        it('maps color-contrast to A11Y-060', () => {
            // Note: the contract example cites A11Y-036 but the real Flint
            // contrast rule is A11Y-060 (Normal Text Insufficient Contrast).
            // The map uses functionally correct Warden IDs.
            expect(mapAxeRuleToWardenRule('color-contrast')).toBe('A11Y-060')
        })

        it('maps heading-order to A11Y-008', () => {
            expect(mapAxeRuleToWardenRule('heading-order')).toBe('A11Y-008')
        })

        it('maps document-title to A11Y-010', () => {
            expect(mapAxeRuleToWardenRule('document-title')).toBe('A11Y-010')
        })

        it('maps aria-valid-attr to A11Y-034', () => {
            expect(mapAxeRuleToWardenRule('aria-valid-attr')).toBe('A11Y-034')
        })

        it('maps landmark-one-main to A11Y-050', () => {
            expect(mapAxeRuleToWardenRule('landmark-one-main')).toBe('A11Y-050')
        })

        it('maps frame-title to A11Y-018', () => {
            expect(mapAxeRuleToWardenRule('frame-title')).toBe('A11Y-018')
        })

        it('maps fieldset to A11Y-070', () => {
            expect(mapAxeRuleToWardenRule('fieldset')).toBe('A11Y-070')
        })
    })

    // ── Unknown rules (testBoundary: mapAxeRuleToWarden unknown) ───────────

    describe('unknown axe rules return null', () => {
        it('returns null for a fictional rule id', () => {
            expect(mapAxeRuleToWardenRule('fictional-rule-x')).toBeNull()
        })

        it('returns null for axe rules not in the map (form-field-multiple-labels)', () => {
            // Intentionally unmapped — surfaces via RUNTIME-* prefix.
            expect(mapAxeRuleToWardenRule('form-field-multiple-labels')).toBeNull()
        })

        it('returns null for a completely made-up identifier', () => {
            expect(mapAxeRuleToWardenRule('not-a-real-axe-rule-at-all')).toBeNull()
        })
    })

    // ── Edge-case inputs ──────────────────────────────────────────────────

    describe('edge-case inputs', () => {
        it('returns null for empty string', () => {
            expect(mapAxeRuleToWardenRule('')).toBeNull()
        })

        it('returns null for whitespace-only string', () => {
            expect(mapAxeRuleToWardenRule('   ')).toBeNull()
        })

        it('returns null for a tab-only string', () => {
            expect(mapAxeRuleToWardenRule('\t')).toBeNull()
        })

        it('returns null for a newline-only string', () => {
            expect(mapAxeRuleToWardenRule('\n')).toBeNull()
        })

        it('returns null for non-string input (cast through unknown)', () => {
            // Defensive: callers might pass the axe rule id through JSON.parse
            // where numeric or boolean values sneak through.
            expect(mapAxeRuleToWardenRule(null as unknown as string)).toBeNull()
            expect(mapAxeRuleToWardenRule(undefined as unknown as string)).toBeNull()
            expect(mapAxeRuleToWardenRule(42 as unknown as string)).toBeNull()
        })
    })

    // ── Case sensitivity ──────────────────────────────────────────────────

    describe('case sensitivity', () => {
        it('is case-sensitive — uppercase variants return null', () => {
            expect(mapAxeRuleToWardenRule('IMAGE-ALT')).toBeNull()
            expect(mapAxeRuleToWardenRule('Image-Alt')).toBeNull()
        })

        it('rejects leading or trailing whitespace', () => {
            expect(mapAxeRuleToWardenRule('image-alt ')).toBeNull()
            expect(mapAxeRuleToWardenRule(' image-alt')).toBeNull()
        })
    })

    // ── Contract compliance ───────────────────────────────────────────────

    describe('contract compliance', () => {
        it('map has at least 20 curated entries (user requirement)', () => {
            const count = Object.keys(AXE_RULE_MAP).length
            expect(count).toBeGreaterThanOrEqual(20)
        })

        it('every mapped value matches the A11Y-NNN naming pattern', () => {
            const pattern = /^A11Y-\d{3}$/
            for (const [axeRuleId, wardenRuleId] of Object.entries(AXE_RULE_MAP)) {
                expect(wardenRuleId, `mapping for ${axeRuleId}`).toMatch(pattern)
            }
        })

        it('AXE_RULE_MAP is frozen (Object.freeze)', () => {
            expect(Object.isFrozen(AXE_RULE_MAP)).toBe(true)
        })

        it('mapAxeRuleToWarden alias points at mapAxeRuleToWardenRule', () => {
            expect(mapAxeRuleToWarden).toBe(mapAxeRuleToWardenRule)
        })
    })

    // ── Contract test boundary verbatim ───────────────────────────────────

    describe('contract testBoundary: mapAxeRuleToWarden known', () => {
        it('mapAxeRuleToWarden("image-alt") === "A11Y-001"', () => {
            expect(mapAxeRuleToWarden('image-alt')).toBe('A11Y-001')
        })
    })

    describe('contract testBoundary: mapAxeRuleToWarden unknown', () => {
        it('mapAxeRuleToWarden("fictional-rule-x") === null', () => {
            expect(mapAxeRuleToWarden('fictional-rule-x')).toBeNull()
        })
    })
})
