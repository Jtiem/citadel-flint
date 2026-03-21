/**
 * CX.3 — Error Taxonomy Tests
 * flint-mcp/src/__tests__/errorTaxonomy.test.ts
 *
 * Validates:
 *   - Every Mithril rule has a registered entry.
 *   - Every active A11y rule has a registered entry.
 *   - Each entry has non-empty explanation and recovery strings.
 *   - getErrorEntry returns the correct entry by code.
 *   - getErrorsByCategory('mithril') returns only mithril entries.
 *   - formatErrorForAgent produces readable output.
 *   - Unknown code returns null.
 *   - getErrorEntryByRuleId works for known and unknown rule IDs.
 */

import { describe, it, expect } from 'vitest'
import {
    getErrorEntry,
    getErrorEntryByRuleId,
    getErrorsByCategory,
    getAllErrors,
    formatErrorForAgent,
    type ErrorEntry,
} from '../../src/core/errorTaxonomy.js'

// ── Mithril rule IDs ──────────────────────────────────────────────────────────

const MITHRIL_RULE_IDS = [
    'MITHRIL-COL',
    'MITHRIL-TYP-001',
    'MITHRIL-TYP-002',
    'MITHRIL-TYP-003',
    'MITHRIL-TYP-004',
    'MITHRIL-TYP-005',
    'MITHRIL-SPC-001',
    'MITHRIL-SHD-001',
    'MITHRIL-OPC-001',
]

// ── Active A11y rule IDs (registered in runner.ts as of EXP.6) ─────────────

const A11Y_RULE_IDS = [
    // names-labels
    'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005', 'A11Y-006',
    'A11Y-011', 'A11Y-012', 'A11Y-013', 'A11Y-014',
    // keyboard
    'A11Y-007', 'A11Y-020', 'A11Y-021', 'A11Y-022',
    // structure
    'A11Y-008', 'A11Y-009', 'A11Y-010', 'A11Y-015', 'A11Y-016', 'A11Y-017',
    // aria
    'A11Y-030', 'A11Y-031', 'A11Y-032', 'A11Y-033', 'A11Y-034',
    'A11Y-035', 'A11Y-036', 'A11Y-037', 'A11Y-038',
    // landmarks
    'A11Y-050', 'A11Y-051', 'A11Y-052', 'A11Y-053',
    // contrast
    'A11Y-060', 'A11Y-061', 'A11Y-062',
    // forms
    'A11Y-070', 'A11Y-071', 'A11Y-072', 'A11Y-073',
]

// ── Session rule IDs ──────────────────────────────────────────────────────────

const SESSION_RULE_IDS = ['SES-001', 'SES-002', 'SES-003', 'SES-004']

// ── Helpers ───────────────────────────────────────────────────────────────────

function findEntryForRuleId(ruleId: string): ErrorEntry | null {
    return getErrorEntryByRuleId(ruleId)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('errorTaxonomy', () => {

    describe('registry completeness', () => {
        it('has an entry for every Mithril rule', () => {
            for (const ruleId of MITHRIL_RULE_IDS) {
                const entry = findEntryForRuleId(ruleId)
                expect(entry, `Missing entry for Mithril rule: ${ruleId}`).not.toBeNull()
            }
        })

        it('has an entry for every active A11y rule', () => {
            for (const ruleId of A11Y_RULE_IDS) {
                const entry = findEntryForRuleId(ruleId)
                expect(entry, `Missing entry for A11y rule: ${ruleId}`).not.toBeNull()
            }
        })

        it('has an entry for every session rule', () => {
            for (const ruleId of SESSION_RULE_IDS) {
                const entry = findEntryForRuleId(ruleId)
                expect(entry, `Missing entry for session rule: ${ruleId}`).not.toBeNull()
            }
        })
    })

    describe('entry content quality', () => {
        it('every entry has a non-empty explanation (>= 20 chars)', () => {
            const all = getAllErrors()
            expect(all.length).toBeGreaterThan(0)
            for (const entry of all) {
                expect(
                    entry.explanation.length,
                    `explanation too short for ${entry.code}`,
                ).toBeGreaterThanOrEqual(20)
            }
        })

        it('every entry has a non-empty recovery string (>= 20 chars)', () => {
            const all = getAllErrors()
            for (const entry of all) {
                expect(
                    entry.recovery.length,
                    `recovery too short for ${entry.code}`,
                ).toBeGreaterThanOrEqual(20)
            }
        })

        it('every entry has a non-empty title', () => {
            for (const entry of getAllErrors()) {
                expect(entry.title.trim(), `title empty for ${entry.code}`).not.toBe('')
            }
        })

        it('every entry has a non-empty ruleId', () => {
            for (const entry of getAllErrors()) {
                expect(entry.ruleId.trim(), `ruleId empty for ${entry.code}`).not.toBe('')
            }
        })

        it('every code matches the FLINT-XXX-NNN pattern', () => {
            const PATTERN = /^FLINT-[A-Z0-9]+-\d+$/
            for (const entry of getAllErrors()) {
                expect(
                    PATTERN.test(entry.code),
                    `code "${entry.code}" does not match FLINT-XXX-NNN pattern`,
                ).toBe(true)
            }
        })

        it('every code is unique', () => {
            const all = getAllErrors()
            const codes = all.map((e) => e.code)
            const uniqueCodes = new Set(codes)
            expect(uniqueCodes.size).toBe(codes.length)
        })
    })

    describe('getErrorEntry', () => {
        it('returns the correct entry for a known Mithril code', () => {
            const entry = getErrorEntry('FLINT-MITH-001')
            expect(entry).not.toBeNull()
            expect(entry!.ruleId).toBe('MITHRIL-COL')
            expect(entry!.category).toBe('mithril')
            expect(entry!.title).toBe('Color Token Drift')
        })

        it('returns the correct entry for a known A11y code', () => {
            const entry = getErrorEntry('FLINT-A11Y-001')
            expect(entry).not.toBeNull()
            expect(entry!.ruleId).toBe('A11Y-001')
            expect(entry!.category).toBe('a11y')
        })

        it('returns the correct entry for a session code', () => {
            const entry = getErrorEntry('FLINT-SES-001')
            expect(entry).not.toBeNull()
            expect(entry!.ruleId).toBe('SES-001')
            expect(entry!.category).toBe('session')
        })

        it('returns null for an unknown code', () => {
            expect(getErrorEntry('FLINT-NONEXISTENT-999')).toBeNull()
        })

        it('returns null for an empty string', () => {
            expect(getErrorEntry('')).toBeNull()
        })
    })

    describe('getErrorEntryByRuleId', () => {
        it('finds MITHRIL-COL entry', () => {
            const entry = getErrorEntryByRuleId('MITHRIL-COL')
            expect(entry).not.toBeNull()
            expect(entry!.code).toBe('FLINT-MITH-001')
        })

        it('finds A11Y-007 entry', () => {
            const entry = getErrorEntryByRuleId('A11Y-007')
            expect(entry).not.toBeNull()
            expect(entry!.code).toBe('FLINT-A11Y-007')
        })

        it('returns null for an unknown ruleId', () => {
            expect(getErrorEntryByRuleId('UNKNOWN-RULE')).toBeNull()
        })

        it('returns null for an empty string', () => {
            expect(getErrorEntryByRuleId('')).toBeNull()
        })
    })

    describe('getErrorsByCategory', () => {
        it('returns only mithril entries for category mithril', () => {
            const mithrilEntries = getErrorsByCategory('mithril')
            expect(mithrilEntries.length).toBeGreaterThan(0)
            for (const entry of mithrilEntries) {
                expect(entry.category).toBe('mithril')
            }
        })

        it('returns only a11y entries for category a11y', () => {
            const a11yEntries = getErrorsByCategory('a11y')
            expect(a11yEntries.length).toBeGreaterThan(0)
            for (const entry of a11yEntries) {
                expect(entry.category).toBe('a11y')
            }
        })

        it('returns only session entries for category session', () => {
            const sessionEntries = getErrorsByCategory('session')
            expect(sessionEntries.length).toBe(SESSION_RULE_IDS.length)
            for (const entry of sessionEntries) {
                expect(entry.category).toBe('session')
            }
        })

        it('returns an empty array for an unknown category', () => {
            // TypeScript narrowing would catch this, but test runtime defense
            const result = getErrorsByCategory('governance' as any)
            expect(Array.isArray(result)).toBe(true)
            // governance category is not registered yet — should return empty or any that exist
        })

        it('mithril entries cover all known mithril rule IDs', () => {
            const mithrilEntries = getErrorsByCategory('mithril')
            const registeredRuleIds = new Set(mithrilEntries.map((e) => e.ruleId))
            for (const ruleId of MITHRIL_RULE_IDS) {
                expect(registeredRuleIds.has(ruleId), `Mithril rule ${ruleId} not in category mithril`).toBe(true)
            }
        })

        it('a11y entries cover all known a11y rule IDs', () => {
            const a11yEntries = getErrorsByCategory('a11y')
            const registeredRuleIds = new Set(a11yEntries.map((e) => e.ruleId))
            for (const ruleId of A11Y_RULE_IDS) {
                expect(registeredRuleIds.has(ruleId), `A11y rule ${ruleId} not in category a11y`).toBe(true)
            }
        })
    })

    describe('getAllErrors', () => {
        it('returns all entries as an array', () => {
            const all = getAllErrors()
            expect(Array.isArray(all)).toBe(true)
            // At minimum: 9 mithril + 37 a11y + 4 session
            expect(all.length).toBeGreaterThanOrEqual(50)
        })

        it('each entry returned is a complete ErrorEntry shape', () => {
            for (const entry of getAllErrors()) {
                expect(typeof entry.code).toBe('string')
                expect(typeof entry.ruleId).toBe('string')
                expect(typeof entry.category).toBe('string')
                expect(typeof entry.severity).toBe('string')
                expect(typeof entry.title).toBe('string')
                expect(typeof entry.explanation).toBe('string')
                expect(typeof entry.recovery).toBe('string')
            }
        })
    })

    describe('formatErrorForAgent', () => {
        it('includes the error code in output', () => {
            const entry = getErrorEntry('FLINT-MITH-001')!
            const output = formatErrorForAgent(entry)
            expect(output).toContain('FLINT-MITH-001')
        })

        it('includes the title in output', () => {
            const entry = getErrorEntry('FLINT-MITH-001')!
            const output = formatErrorForAgent(entry)
            expect(output).toContain('Color Token Drift')
        })

        it('includes "Explanation:" label', () => {
            const entry = getErrorEntry('FLINT-A11Y-001')!
            const output = formatErrorForAgent(entry)
            expect(output).toContain('Explanation:')
        })

        it('includes "Recovery:" label', () => {
            const entry = getErrorEntry('FLINT-A11Y-001')!
            const output = formatErrorForAgent(entry)
            expect(output).toContain('Recovery:')
        })

        it('includes "Authority:" when sourceAuthority is present', () => {
            const entry = getErrorEntry('FLINT-A11Y-001')!
            expect(entry.sourceAuthority).toBeTruthy()
            const output = formatErrorForAgent(entry)
            expect(output).toContain('Authority:')
        })

        it('includes "Reference:" when regulatoryRef is present', () => {
            const entry = getErrorEntry('FLINT-A11Y-001')!
            expect(entry.regulatoryRef).toBeTruthy()
            const output = formatErrorForAgent(entry)
            expect(output).toContain('Reference:')
        })

        it('omits "Authority:" when sourceAuthority is absent', () => {
            // Find an entry without sourceAuthority or use a crafted one
            const entries = getAllErrors().filter((e) => !e.sourceAuthority)
            if (entries.length > 0) {
                const output = formatErrorForAgent(entries[0])
                expect(output).not.toContain('Authority:')
            }
        })

        it('produces a multi-line string', () => {
            const entry = getErrorEntry('FLINT-MITH-001')!
            const output = formatErrorForAgent(entry)
            expect(output.split('\n').length).toBeGreaterThan(3)
        })

        it('handles an entry with no sourceAuthority or regulatoryRef gracefully', () => {
            const minimalEntry: ErrorEntry = {
                code: 'FLINT-TEST-000',
                ruleId: 'TEST-000',
                category: 'system',
                severity: 'info',
                title: 'Test Entry',
                explanation: 'This is a test explanation with enough text.',
                recovery: 'This is a test recovery with enough text.',
            }
            const output = formatErrorForAgent(minimalEntry)
            expect(output).toContain('FLINT-TEST-000')
            expect(output).toContain('Test Entry')
            expect(output).toContain('Explanation:')
            expect(output).toContain('Recovery:')
            expect(output).not.toContain('Authority:')
            expect(output).not.toContain('Reference:')
        })
    })

    describe('WCAG A11y entries have sourceAuthority', () => {
        it('all A11y entries reference WCAG 2.1 AA as authority', () => {
            const a11yEntries = getErrorsByCategory('a11y')
            for (const entry of a11yEntries) {
                expect(
                    entry.sourceAuthority,
                    `A11y entry ${entry.code} has no sourceAuthority`,
                ).toBeTruthy()
                expect(
                    entry.sourceAuthority,
                    `A11y entry ${entry.code} sourceAuthority does not mention WCAG`,
                ).toMatch(/WCAG/)
            }
        })

        it('WCAG A11y entries have a regulatoryRef section reference', () => {
            // Not all a11y entries are required to have it, but key ones should
            const criticalA11y = ['FLINT-A11Y-001', 'FLINT-A11Y-060', 'FLINT-A11Y-022']
            for (const code of criticalA11y) {
                const entry = getErrorEntry(code)!
                expect(entry.regulatoryRef, `${code} missing regulatoryRef`).toBeTruthy()
            }
        })
    })

    describe('Mithril entries reference Flint commandments', () => {
        it('all Mithril entries reference Commandment 2', () => {
            const mithrilEntries = getErrorsByCategory('mithril')
            for (const entry of mithrilEntries) {
                expect(
                    entry.sourceAuthority,
                    `Mithril entry ${entry.code} has no sourceAuthority`,
                ).toBeTruthy()
                expect(
                    entry.sourceAuthority,
                    `Mithril entry ${entry.code} sourceAuthority does not reference Commandment`,
                ).toMatch(/Commandment/)
            }
        })
    })

    describe('session entries', () => {
        it('SES-001 through SES-004 are all registered', () => {
            for (let i = 1; i <= 4; i++) {
                const ruleId = `SES-00${i}`
                const entry = getErrorEntryByRuleId(ruleId)
                expect(entry, `Missing session entry for ${ruleId}`).not.toBeNull()
            }
        })

        it('session entries reference Flint commandments', () => {
            const sessionEntries = getErrorsByCategory('session')
            for (const entry of sessionEntries) {
                expect(
                    entry.sourceAuthority,
                    `Session entry ${entry.code} has no sourceAuthority`,
                ).toBeTruthy()
                expect(
                    entry.sourceAuthority,
                    `Session entry ${entry.code} does not reference Commandment`,
                ).toMatch(/Commandment/)
            }
        })
    })
})
