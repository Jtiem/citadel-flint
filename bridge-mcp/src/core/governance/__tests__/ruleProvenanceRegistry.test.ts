/**
 * ruleProvenanceRegistry — Unit Tests
 *
 * Scope: pure in-memory logic. No I/O, no Electron, no MCP server.
 *
 * What we verify:
 *   1. Known ruleId lookup returns correct metadata
 *   2. Unknown ruleId returns safe fallback (no throw)
 *   3. All registered rules have non-empty rationale
 *   4. All registered rules have a valid ISO 8601 lastUpdated date
 *   5. buildComplianceSummary — empty violations list
 *   6. buildComplianceSummary — mixed severity aggregation
 *   7. buildComplianceSummary — authority breakdown accuracy
 *   8. buildComplianceSummary — 'amber' severity maps to 'warning'
 *   9. Query API: getProvenance, getAllProvenance, getByAuthority, getByCategory
 *  10. EXP.6a rules are all registered
 *  11. sourceAuthority filter in auditReport
 */

import { describe, it, expect } from 'vitest'
import {
    RULE_PROVENANCE_REGISTRY,
    resolveProvenance,
    buildComplianceSummary,
    getProvenance,
    getAllProvenance,
    getByAuthority,
    getByCategory,
} from '../ruleProvenanceRegistry.js'

// ── ISO 8601 date validator ────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ── Known rule set — all rules enforced by bridge-mcp ──────────────────────────

const ORIGINAL_A11Y_RULE_IDS = [
    'A11Y-001',
    'A11Y-002',
    'A11Y-003',
    'A11Y-004',
    'A11Y-005',
    'A11Y-006',
    'A11Y-007',
    'A11Y-008',
    'A11Y-009',
    'A11Y-010',
]

const EXP6A_NAMES_LABELS_IDS = [
    'A11Y-011',
    'A11Y-012',
    'A11Y-013',
    'A11Y-014',
]

const EXP6A_KEYBOARD_IDS = [
    'A11Y-020',
    'A11Y-021',
    'A11Y-022',
]

const EXP6A_STRUCTURE_IDS = [
    'A11Y-015',
    'A11Y-016',
    'A11Y-017',
]

const EXP6A_ARIA_IDS = [
    'A11Y-030',
    'A11Y-031',
    'A11Y-032',
    'A11Y-033',
    'A11Y-034',
    'A11Y-035',
    'A11Y-036',
    'A11Y-037',
    'A11Y-038',
]

const EXP6A_LANDMARKS_IDS = [
    'A11Y-050',
    'A11Y-051',
    'A11Y-052',
    'A11Y-053',
]

const EXP6A_CONTRAST_IDS = [
    'A11Y-060',
    'A11Y-061',
    'A11Y-062',
]

const EXP6A_FORMS_IDS = [
    'A11Y-070',
    'A11Y-071',
    'A11Y-072',
    'A11Y-073',
]

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

const SYSTEM_RULE_IDS = [
    'EXP-001',
]

const ALL_KNOWN_RULE_IDS = [
    ...ORIGINAL_A11Y_RULE_IDS,
    ...EXP6A_NAMES_LABELS_IDS,
    ...EXP6A_KEYBOARD_IDS,
    ...EXP6A_STRUCTURE_IDS,
    ...EXP6A_ARIA_IDS,
    ...EXP6A_LANDMARKS_IDS,
    ...EXP6A_CONTRAST_IDS,
    ...EXP6A_FORMS_IDS,
    ...MITHRIL_RULE_IDS,
    ...SYSTEM_RULE_IDS,
]

// ── 1. Known ruleId lookup ────────────────────────────────────────────────────

describe('resolveProvenance — known ruleId lookup', () => {
    it('resolves A11Y-001 with correct authority and reference', () => {
        const p = resolveProvenance('A11Y-001')
        expect(p.ruleId).toBe('A11Y-001')
        expect(p.ruleName).toBe('Image Missing Alt Text')
        expect(p.sourceAuthority).toBe('WCAG 2.1 AA')
        expect(p.regulatoryReference).toContain('WCAG 2.1 SC 1.1.1')
        expect(p.rationale.length).toBeGreaterThan(10)
    })

    it('resolves MITHRIL-COL as Bridge Design System authority', () => {
        const p = resolveProvenance('MITHRIL-COL')
        expect(p.ruleId).toBe('MITHRIL-COL')
        expect(p.sourceAuthority).toBe('Bridge Design System')
        expect(p.regulatoryReference).toContain('Bridge Design System')
    })

    it('resolves MITHRIL-TYP-002 correctly', () => {
        const p = resolveProvenance('MITHRIL-TYP-002')
        expect(p.ruleId).toBe('MITHRIL-TYP-002')
        expect(p.ruleName).toContain('Font Size')
        expect(p.sourceAuthority).toBe('Bridge Design System')
    })

    it('resolves EXP-001 as Bridge Design System authority', () => {
        const p = resolveProvenance('EXP-001')
        expect(p.ruleId).toBe('EXP-001')
        expect(p.sourceAuthority).toBe('Bridge Design System')
    })

    it('returns the same object for repeated lookups (referential equality)', () => {
        const p1 = RULE_PROVENANCE_REGISTRY.get('A11Y-005')
        const p2 = RULE_PROVENANCE_REGISTRY.get('A11Y-005')
        expect(p1).toBe(p2)
    })
})

// ── 2. Unknown ruleId fallback ────────────────────────────────────────────────

describe('resolveProvenance — unknown ruleId fallback', () => {
    it('returns a fallback with Bridge Design System authority for an unknown ruleId', () => {
        const p = resolveProvenance('UNKNOWN-999')
        expect(p.ruleId).toBe('UNKNOWN-999')
        expect(p.sourceAuthority).toBe('Bridge Design System')
        expect(p.regulatoryReference).toBe('N/A')
        expect(p.rationale).toBeTruthy()
    })

    it('does not throw for empty string ruleId', () => {
        expect(() => resolveProvenance('')).not.toThrow()
    })

    it('returns a fallback for a custom ruleId prefix', () => {
        const p = resolveProvenance('CUSTOM-LOCAL-001')
        expect(p.sourceAuthority).toBe('Bridge Design System')
        expect(p.ruleName).toBe('CUSTOM-LOCAL-001') // fallback uses ruleId as ruleName
    })

    it('sets a dynamic lastUpdated (ISO date format) on fallback entries', () => {
        const p = resolveProvenance('FALLBACK-XYZ')
        expect(ISO_DATE_RE.test(p.lastUpdated)).toBe(true)
    })
})

// ── 3. All registered rules have non-empty rationale ─────────────────────────

describe('RULE_PROVENANCE_REGISTRY — data quality', () => {
    it('every registered rule has a non-empty rationale', () => {
        for (const [ruleId, entry] of RULE_PROVENANCE_REGISTRY) {
            expect(
                entry.rationale.trim().length,
                `Rule ${ruleId} has empty rationale`
            ).toBeGreaterThan(0)
        }
    })

    // ── 4. All registered rules have valid ISO 8601 lastUpdated ───────────────

    it('every registered rule has a valid ISO 8601 date in lastUpdated', () => {
        for (const [ruleId, entry] of RULE_PROVENANCE_REGISTRY) {
            expect(
                ISO_DATE_RE.test(entry.lastUpdated),
                `Rule ${ruleId} has invalid lastUpdated: "${entry.lastUpdated}"`
            ).toBe(true)
        }
    })

    it('all known rules are present in the registry', () => {
        for (const ruleId of ALL_KNOWN_RULE_IDS) {
            expect(
                RULE_PROVENANCE_REGISTRY.has(ruleId),
                `Rule ${ruleId} is missing from the registry`
            ).toBe(true)
        }
    })

    it('registry size matches the number of known rules', () => {
        expect(RULE_PROVENANCE_REGISTRY.size).toBe(ALL_KNOWN_RULE_IDS.length)
    })

    it('every registered rule has a non-empty ruleName', () => {
        for (const [ruleId, entry] of RULE_PROVENANCE_REGISTRY) {
            expect(
                entry.ruleName.trim().length,
                `Rule ${ruleId} has empty ruleName`
            ).toBeGreaterThan(0)
        }
    })
})

// ── 5. buildComplianceSummary — empty violations ──────────────────────────────

describe('buildComplianceSummary — empty violations list', () => {
    it('returns zero totalViolations for empty input', () => {
        const summary = buildComplianceSummary([])
        expect(summary.totalViolations).toBe(0)
    })

    it('returns empty violatedRules array for empty input', () => {
        const summary = buildComplianceSummary([])
        expect(summary.violatedRules).toHaveLength(0)
    })

    it('returns zero counts for all severities', () => {
        const summary = buildComplianceSummary([])
        expect(summary.bySeverity.critical).toBe(0)
        expect(summary.bySeverity.warning).toBe(0)
        expect(summary.bySeverity.info).toBe(0)
    })

    it('returns zero counts for all authorities', () => {
        const summary = buildComplianceSummary([])
        const totalAuthorityCount = Object.values(summary.byAuthority).reduce((a, b) => a + b, 0)
        expect(totalAuthorityCount).toBe(0)
    })

    it('includes a valid ISO 8601 generatedAt timestamp', () => {
        const before = new Date().toISOString()
        const summary = buildComplianceSummary([])
        const after = new Date().toISOString()
        expect(summary.generatedAt >= before).toBe(true)
        expect(summary.generatedAt <= after).toBe(true)
    })
})

// ── 6. buildComplianceSummary — mixed severity aggregation ────────────────────

describe('buildComplianceSummary — mixed severity aggregation', () => {
    it('correctly counts critical, amber->warning, and info severities', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'A11Y-002', severity: 'critical' },
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
            { ruleId: 'MITHRIL-TYP-001', severity: 'amber' },
            { ruleId: 'EXP-001', severity: 'info' },
        ])

        expect(summary.totalViolations).toBe(5)
        expect(summary.bySeverity.critical).toBe(2)
        expect(summary.bySeverity.warning).toBe(2) // amber -> warning
        expect(summary.bySeverity.info).toBe(1)
    })

    it('maps amber severity to warning in the bySeverity output', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])
        expect(summary.bySeverity.warning).toBe(1)
        expect(summary.bySeverity.critical).toBe(0)
    })

    it('includes only unique rule entries in violatedRules (deduplicates)', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'A11Y-001', severity: 'critical' }, // duplicate
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])

        expect(summary.totalViolations).toBe(3)
        expect(summary.violatedRules).toHaveLength(2)
        const ruleIds = summary.violatedRules.map((r) => r.ruleId)
        expect(ruleIds).toContain('A11Y-001')
        expect(ruleIds).toContain('MITHRIL-COL')
    })
})

// ── 7. buildComplianceSummary — authority breakdown accuracy ──────────────────

describe('buildComplianceSummary — authority breakdown accuracy', () => {
    it('correctly separates WCAG 2.1 AA and Bridge Design System violations', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },  // WCAG 2.1 AA
            { ruleId: 'A11Y-002', severity: 'critical' },  // WCAG 2.1 AA
            { ruleId: 'MITHRIL-COL', severity: 'amber' },  // Bridge Design System
        ])

        expect(summary.byAuthority['WCAG 2.1 AA']).toBe(2)
        expect(summary.byAuthority['Bridge Design System']).toBe(1)
        expect(summary.byAuthority['WCAG 2.2 AA']).toBe(0)
        expect(summary.byAuthority['SOC2']).toBe(0)
    })

    it('attributes unknown ruleIds to Bridge Design System (fallback)', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'CUSTOM-999', severity: 'warning' },
        ])
        expect(summary.byAuthority['Bridge Design System']).toBe(1)
    })

    it('all authority keys are present in the output even at 0', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
        ])
        expect('WCAG 2.1 AA' in summary.byAuthority).toBe(true)
        expect('WCAG 2.2 AA' in summary.byAuthority).toBe(true)
        expect('SOC2' in summary.byAuthority).toBe(true)
        expect('FDA SaMD' in summary.byAuthority).toBe(true)
        expect('HIPAA' in summary.byAuthority).toBe(true)
        expect('Section 508' in summary.byAuthority).toBe(true)
        expect('Bridge Design System' in summary.byAuthority).toBe(true)
        expect('Custom' in summary.byAuthority).toBe(true)
    })
})

// ── 9. Query API ─────────────────────────────────────────────────────────────

describe('getProvenance — single lookup with extended metadata', () => {
    it('returns full entry with category and severity for known ruleId', () => {
        const entry = getProvenance('A11Y-001')
        expect(entry).toBeDefined()
        expect(entry!.ruleId).toBe('A11Y-001')
        expect(entry!.category).toBe('names-labels')
        expect(entry!.defaultSeverity).toBe('critical')
        expect(entry!.description).toBeTruthy()
    })

    it('returns undefined for unknown ruleId (unlike resolveProvenance)', () => {
        const entry = getProvenance('UNKNOWN-999')
        expect(entry).toBeUndefined()
    })

    it('returns Mithril entry with correct category', () => {
        const entry = getProvenance('MITHRIL-COL')
        expect(entry).toBeDefined()
        expect(entry!.category).toBe('color')
        expect(entry!.defaultSeverity).toBe('warning')
    })

    it('returns EXP-001 with export-gate category', () => {
        const entry = getProvenance('EXP-001')
        expect(entry).toBeDefined()
        expect(entry!.category).toBe('export-gate')
    })
})

describe('getAllProvenance — full registry', () => {
    it('returns all registered entries', () => {
        const all = getAllProvenance()
        expect(all.length).toBe(ALL_KNOWN_RULE_IDS.length)
    })

    it('returns a new array each time (not a reference)', () => {
        const a = getAllProvenance()
        const b = getAllProvenance()
        expect(a).not.toBe(b)
    })

    it('every entry has the extended fields (category, defaultSeverity, description)', () => {
        const all = getAllProvenance()
        for (const entry of all) {
            expect(typeof entry.category).toBe('string')
            expect(entry.category.length).toBeGreaterThan(0)
            expect(['critical', 'warning', 'info']).toContain(entry.defaultSeverity)
            expect(typeof entry.description).toBe('string')
            expect(entry.description.length).toBeGreaterThan(0)
        }
    })
})

describe('getByAuthority — filter by source authority', () => {
    it('returns only WCAG 2.1 AA rules when filtering by that authority', () => {
        const wcag = getByAuthority('WCAG 2.1 AA')
        expect(wcag.length).toBeGreaterThan(0)
        for (const entry of wcag) {
            expect(entry.sourceAuthority).toBe('WCAG 2.1 AA')
        }
    })

    it('returns only Bridge Design System rules when filtering by that authority', () => {
        const bridge = getByAuthority('Bridge Design System')
        expect(bridge.length).toBeGreaterThan(0)
        for (const entry of bridge) {
            expect(entry.sourceAuthority).toBe('Bridge Design System')
        }
    })

    it('returns empty array for authorities with no rules', () => {
        const hipaa = getByAuthority('HIPAA')
        expect(hipaa).toHaveLength(0)
    })

    it('all A11y rules map to WCAG 2.1 AA', () => {
        const wcag = getByAuthority('WCAG 2.1 AA')
        const wcagRuleIds = new Set(wcag.map((e) => e.ruleId))
        for (const ruleId of ALL_KNOWN_RULE_IDS) {
            if (ruleId.startsWith('A11Y-')) {
                expect(wcagRuleIds.has(ruleId), `${ruleId} should be WCAG 2.1 AA`).toBe(true)
            }
        }
    })
})

describe('getByCategory — filter by rule category', () => {
    it('returns names-labels rules', () => {
        const rules = getByCategory('names-labels')
        expect(rules.length).toBeGreaterThan(0)
        for (const entry of rules) {
            expect(entry.category).toBe('names-labels')
        }
        // Should include original A11Y-001..006 + EXP.6a A11Y-011..014
        const ruleIds = rules.map((r) => r.ruleId)
        expect(ruleIds).toContain('A11Y-001')
        expect(ruleIds).toContain('A11Y-014')
    })

    it('returns keyboard rules', () => {
        const rules = getByCategory('keyboard')
        expect(rules.length).toBe(4) // A11Y-007, 020, 021, 022
        const ruleIds = rules.map((r) => r.ruleId)
        expect(ruleIds).toContain('A11Y-007')
        expect(ruleIds).toContain('A11Y-022')
    })

    it('returns aria rules', () => {
        const rules = getByCategory('aria')
        expect(rules.length).toBe(9) // A11Y-030..038
        for (const entry of rules) {
            expect(entry.ruleId).toMatch(/^A11Y-03/)
        }
    })

    it('returns color rules (Mithril)', () => {
        const rules = getByCategory('color')
        expect(rules.length).toBe(1)
        expect(rules[0].ruleId).toBe('MITHRIL-COL')
    })

    it('returns typography rules (Mithril)', () => {
        const rules = getByCategory('typography')
        expect(rules.length).toBe(5)
    })

    it('returns empty array for custom category with no rules', () => {
        const rules = getByCategory('custom')
        expect(rules).toHaveLength(0)
    })

    it('returns forms rules', () => {
        const rules = getByCategory('forms')
        expect(rules.length).toBe(4) // A11Y-070..073
        const ruleIds = rules.map((r) => r.ruleId)
        expect(ruleIds).toContain('A11Y-070')
        expect(ruleIds).toContain('A11Y-073')
    })

    it('returns contrast rules', () => {
        const rules = getByCategory('contrast')
        expect(rules.length).toBe(3) // A11Y-060..062
    })

    it('returns landmarks rules', () => {
        const rules = getByCategory('landmarks')
        expect(rules.length).toBe(4) // A11Y-050..053
    })

    it('returns structure rules', () => {
        const rules = getByCategory('structure')
        const ruleIds = rules.map((r) => r.ruleId)
        expect(ruleIds).toContain('A11Y-008')
        expect(ruleIds).toContain('A11Y-017')
    })
})

// ── 10. EXP.6a rules are all registered ──────────────────────────────────────

describe('EXP.6a rule coverage', () => {
    const allExp6aIds = [
        ...EXP6A_NAMES_LABELS_IDS,
        ...EXP6A_KEYBOARD_IDS,
        ...EXP6A_STRUCTURE_IDS,
        ...EXP6A_ARIA_IDS,
        ...EXP6A_LANDMARKS_IDS,
        ...EXP6A_CONTRAST_IDS,
        ...EXP6A_FORMS_IDS,
    ]

    it('all 30 EXP.6a A11y rules are registered', () => {
        for (const ruleId of allExp6aIds) {
            expect(
                RULE_PROVENANCE_REGISTRY.has(ruleId),
                `EXP.6a rule ${ruleId} is missing from the provenance registry`
            ).toBe(true)
        }
    })

    it('all EXP.6a rules have WCAG 2.1 AA source authority', () => {
        for (const ruleId of allExp6aIds) {
            const entry = RULE_PROVENANCE_REGISTRY.get(ruleId)
            expect(entry).toBeDefined()
            expect(entry!.sourceAuthority).toBe('WCAG 2.1 AA')
        }
    })

    it('all EXP.6a rules have valid regulatory references', () => {
        for (const ruleId of allExp6aIds) {
            const entry = RULE_PROVENANCE_REGISTRY.get(ruleId)
            expect(entry).toBeDefined()
            expect(entry!.regulatoryReference).toMatch(/^WCAG 2\.1 SC/)
        }
    })
})

// ── 11. Section 508 authority key is present ─────────────────────────────────

describe('Section 508 authority support', () => {
    it('Section 508 key exists in compliance summary authority breakdown', () => {
        const summary = buildComplianceSummary([])
        expect('Section 508' in summary.byAuthority).toBe(true)
        expect(summary.byAuthority['Section 508']).toBe(0)
    })
})
