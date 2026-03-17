/**
 * policyEngine — Unit Tests
 * bridge-mcp/src/core/__tests__/policyEngine.test.ts
 *
 * Test map (POL.1 Group 1A):
 *
 * resolvePolicy
 *   1  — no policy file → returns default resolved policy
 *   2  — policy file present → merged correctly
 *   3  — team overlay → team values override project policy
 *   4  — unknown team ID → returns project policy unchanged
 *   5  — team overlay does not mutate base project policy
 *
 * getRuleMode
 *   6  — explicitly set Mithril rule → returns that mode
 *   7  — Mithril rule not in per-rule map → falls back to mithril.mode
 *   8  — explicitly set A11y rule → returns that mode
 *   9  — A11y rule not in per-rule map → falls back to a11y.mode
 *  10  — rule set to 'off' → returns 'off'
 *  11  — unknown rule ID → returns 'blocking'
 *
 * getDeltaEThreshold
 *  12  — default policy → 2.0
 *  13  — custom deltaE_threshold in policy file → returns custom value
 *
 * getDeltaECriticalThreshold
 *  14  — default policy → 10.0
 *  15  — custom critical threshold in policy file → returns custom value
 *
 * shouldBlockExport
 *  16  — empty violations → not blocked
 *  17  — severity floor 'critical' + only warning violations → not blocked
 *  18  — severity floor 'warning' + warning violation → blocked
 *  19  — all rules advisory → violations present but not blocked
 *  20  — per-rule 'off' → that rule's violations do not block
 *  21  — overrides exist + block_on_overrides true → blocked (no violations needed)
 *  22  — overrides exist + block_on_overrides false → not blocked by overrides alone
 *  23  — severity floor 'info' + info violation → blocked
 *  24  — critical violation always blocks when mode is blocking
 *
 * validatePolicy
 *  25  — valid v2 policy → { valid: true }
 *  26  — valid v1 policy → { valid: true, migrated }
 *  27  — null input → { valid: false }
 *  28  — array input → { valid: false }
 *  29  — version 3 → { valid: false }
 *  30  — deltaE_threshold below range (0.0) → error
 *  31  — deltaE_threshold above range (50.0) → error
 *  32  — deltaE_critical <= deltaE → error
 *  33  — unknown domain → error
 *  34  — unknown rule ID in mithril.rules → error
 *  35  — unknown rule ID in a11y.rules → error
 *  36  — invalid severity_floor → error
 *  37  — empty object → { valid: true } (resolves to defaults)
 *  38  — invalid mithril.mode → error
 *  39  — invalid a11y.level → error
 *
 * migrateV1ToV2
 *  40  — disabled_rules converted to rules map with 'off'
 *  41  — block_on_mithril=false → mithril.mode='advisory'
 *  42  — block_on_a11y=false → a11y.mode='advisory'
 *  43  — version bumped to 2
 *  44  — v2 policy with no v1 fields passes through migration unchanged
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    resolvePolicy,
    getRuleMode,
    getDeltaEThreshold,
    getDeltaECriticalThreshold,
    shouldBlockExport,
    validatePolicy,
    migrateV1ToV2,
    DEFAULT_RESOLVED_POLICY,
    type ResolvedPolicy,
} from '../policyEngine.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Creates a temporary directory with an optional .bridge/policy.json,
 * returns the temp dir path, and registers cleanup.
 */
function makeTempProject(policy?: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-pol-test-'))
    if (policy !== undefined) {
        const bridgeDir = path.join(dir, '.bridge')
        fs.mkdirSync(bridgeDir, { recursive: true })
        fs.writeFileSync(
            path.join(bridgeDir, 'policy.json'),
            JSON.stringify(policy, null, 2),
            'utf-8'
        )
    }
    return dir
}

function removeTempProject(dir: string) {
    fs.rmSync(dir, { recursive: true, force: true })
}

// ── resolvePolicy ─────────────────────────────────────────────────────────────

describe('resolvePolicy — Test 1: no policy file → returns defaults', () => {
    let dir: string
    beforeEach(() => { dir = makeTempProject() })
    afterEach(() => removeTempProject(dir))

    it('returns default deltaE threshold of 2.0', () => {
        const p = resolvePolicy(dir)
        expect(p.mithril.deltaEThreshold).toBe(2.0)
    })

    it('returns default mithril mode blocking', () => {
        const p = resolvePolicy(dir)
        expect(p.mithril.mode).toBe('blocking')
    })

    it('returns default a11y level AA', () => {
        const p = resolvePolicy(dir)
        expect(p.a11y.conformanceLevel).toBe('AA')
    })

    it('returns default severity floor warning', () => {
        const p = resolvePolicy(dir)
        expect(p.exportGate.severityFloor).toBe('warning')
    })

    it('returns empty teams map', () => {
        const p = resolvePolicy(dir)
        expect(p.teams).toEqual({})
    })
})

describe('resolvePolicy — Test 2: policy file present → merged correctly', () => {
    let dir: string
    beforeEach(() => {
        dir = makeTempProject({
            version: 2,
            domain: 'fintech',
            mithril: {
                deltaE_threshold: 1.0,
                deltaE_critical_threshold: 5.0,
                mode: 'advisory',
                ignore_patterns: ['**/dist/**'],
                rules: { 'MITHRIL-COL': 'blocking' },
            },
            a11y: {
                level: 'AAA',
                mode: 'blocking',
                rules: { 'A11Y-001': 'off' },
            },
            export_gate: {
                severity_floor: 'critical',
                block_on_overrides: false,
            },
            baseline: { enabled: false },
            teams: {},
        })
    })
    afterEach(() => removeTempProject(dir))

    it('reads domain from file', () => {
        expect(resolvePolicy(dir).domain).toBe('fintech')
    })

    it('reads deltaE_threshold from file', () => {
        expect(resolvePolicy(dir).mithril.deltaEThreshold).toBe(1.0)
        expect(resolvePolicy(dir).mithril.deltaE_threshold).toBe(1.0)
    })

    it('reads critical deltaE threshold', () => {
        expect(resolvePolicy(dir).mithril.deltaE_critical_threshold).toBe(5.0)
    })

    it('reads mithril mode', () => {
        expect(resolvePolicy(dir).mithril.mode).toBe('advisory')
    })

    it('reads per-rule mithril map', () => {
        expect(resolvePolicy(dir).mithril.rules['MITHRIL-COL']).toBe('blocking')
    })

    it('reads a11y conformance level', () => {
        expect(resolvePolicy(dir).a11y.conformanceLevel).toBe('AAA')
    })

    it('reads a11y per-rule map', () => {
        expect(resolvePolicy(dir).a11y.rules['A11Y-001']).toBe('off')
    })

    it('reads severity floor', () => {
        expect(resolvePolicy(dir).exportGate.severityFloor).toBe('critical')
    })

    it('reads block_on_overrides', () => {
        expect(resolvePolicy(dir).exportGate.block_on_overrides).toBe(false)
    })
})

describe('resolvePolicy — Test 3: team overlay → team values override project', () => {
    let dir: string
    beforeEach(() => {
        dir = makeTempProject({
            version: 2,
            domain: 'general',
            mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 10.0 },
            export_gate: { severity_floor: 'warning', block_on_overrides: true },
            teams: {
                marketing: {
                    mithril: { deltaE_threshold: 5.0 },
                },
                compliance: {
                    a11y: { level: 'AAA' },
                },
            },
        })
    })
    afterEach(() => removeTempProject(dir))

    it('marketing team gets deltaE 5.0', () => {
        const p = resolvePolicy(dir, 'marketing')
        expect(p.mithril.deltaEThreshold).toBe(5.0)
        expect(p.mithril.deltaE_threshold).toBe(5.0)
    })

    it('compliance team gets AAA conformance', () => {
        const p = resolvePolicy(dir, 'compliance')
        expect(p.a11y.conformanceLevel).toBe('AAA')
        expect(p.a11y.level).toBe('AAA')
    })

    it('marketing team inherits project export gate settings', () => {
        const p = resolvePolicy(dir, 'marketing')
        expect(p.exportGate.severityFloor).toBe('warning')
    })
})

describe('resolvePolicy — Test 4: unknown team ID → returns project policy', () => {
    let dir: string
    beforeEach(() => {
        dir = makeTempProject({
            version: 2,
            mithril: { deltaE_threshold: 3.0, deltaE_critical_threshold: 10.0 },
        })
    })
    afterEach(() => removeTempProject(dir))

    it('returns project-level deltaE when team not found', () => {
        const p = resolvePolicy(dir, 'nonexistent-team')
        expect(p.mithril.deltaEThreshold).toBe(3.0)
    })
})

describe('resolvePolicy — Test 5: team overlay does not mutate base project policy', () => {
    let dir: string
    beforeEach(() => {
        dir = makeTempProject({
            version: 2,
            mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 10.0 },
            teams: {
                ops: { mithril: { deltaE_threshold: 8.0 } },
            },
        })
    })
    afterEach(() => removeTempProject(dir))

    it('base policy is not affected by team overlay resolution', () => {
        resolvePolicy(dir, 'ops') // resolve with team
        const base = resolvePolicy(dir)   // resolve without team
        expect(base.mithril.deltaEThreshold).toBe(2.0)
    })
})

// ── getRuleMode ───────────────────────────────────────────────────────────────

function makePolicy(overrides: Partial<ResolvedPolicy> = {}): ResolvedPolicy {
    return {
        ...structuredClone(DEFAULT_RESOLVED_POLICY),
        ...overrides,
    }
}

describe('getRuleMode — Test 6: explicitly set Mithril rule → returns that mode', () => {
    it('returns advisory for MITHRIL-COL when set to advisory', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                rules: { 'MITHRIL-COL': 'advisory' },
            },
        })
        expect(getRuleMode('MITHRIL-COL', policy)).toBe('advisory')
    })
})

describe('getRuleMode — Test 7: unset Mithril rule → falls back to category mode', () => {
    it('returns mithril.mode when rule not in per-rule map', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                mode: 'advisory',
                rules: {},
            },
        })
        expect(getRuleMode('MITHRIL-SPC-001', policy)).toBe('advisory')
    })
})

describe('getRuleMode — Test 8: explicitly set A11y rule → returns that mode', () => {
    it('returns blocking for A11Y-001 when explicitly set', () => {
        const policy = makePolicy({
            a11y: {
                ...DEFAULT_RESOLVED_POLICY.a11y,
                rules: { 'A11Y-001': 'blocking' },
            },
        })
        expect(getRuleMode('A11Y-001', policy)).toBe('blocking')
    })
})

describe('getRuleMode — Test 9: A11y rule not in per-rule map → falls back to a11y.mode', () => {
    it('returns a11y.mode as fallback', () => {
        const policy = makePolicy({
            a11y: {
                ...DEFAULT_RESOLVED_POLICY.a11y,
                mode: 'advisory',
                rules: {},
            },
        })
        expect(getRuleMode('A11Y-005', policy)).toBe('advisory')
    })
})

describe('getRuleMode — Test 10: rule set to off → returns off', () => {
    it('returns off for Mithril rule set to off', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                rules: { 'MITHRIL-TYP-001': 'off' },
            },
        })
        expect(getRuleMode('MITHRIL-TYP-001', policy)).toBe('off')
    })

    it('returns off for A11y rule set to off', () => {
        const policy = makePolicy({
            a11y: {
                ...DEFAULT_RESOLVED_POLICY.a11y,
                rules: { 'A11Y-007': 'off' },
            },
        })
        expect(getRuleMode('A11Y-007', policy)).toBe('off')
    })
})

describe('getRuleMode — Test 11: unknown rule ID → returns blocking', () => {
    it('returns blocking for completely unknown rule', () => {
        const policy = makePolicy()
        expect(getRuleMode('UNKNOWN-999', policy)).toBe('blocking')
    })
})

// ── getDeltaEThreshold ────────────────────────────────────────────────────────

describe('getDeltaEThreshold — Test 12: default → 2.0', () => {
    it('returns 2.0 for default policy', () => {
        expect(getDeltaEThreshold(makePolicy())).toBe(2.0)
    })
})

describe('getDeltaEThreshold — Test 13: custom value', () => {
    let dir: string
    beforeEach(() => {
        dir = makeTempProject({
            version: 2,
            mithril: { deltaE_threshold: 3.5, deltaE_critical_threshold: 10.0 },
        })
    })
    afterEach(() => removeTempProject(dir))

    it('returns the custom threshold from policy file', () => {
        const p = resolvePolicy(dir)
        expect(getDeltaEThreshold(p)).toBe(3.5)
    })
})

// ── getDeltaECriticalThreshold ────────────────────────────────────────────────

describe('getDeltaECriticalThreshold — Test 14: default → 10.0', () => {
    it('returns 10.0 for default policy', () => {
        expect(getDeltaECriticalThreshold(makePolicy())).toBe(10.0)
    })
})

describe('getDeltaECriticalThreshold — Test 15: custom value', () => {
    let dir: string
    beforeEach(() => {
        dir = makeTempProject({
            version: 2,
            mithril: { deltaE_threshold: 2.0, deltaE_critical_threshold: 7.5 },
        })
    })
    afterEach(() => removeTempProject(dir))

    it('returns the custom critical threshold', () => {
        const p = resolvePolicy(dir)
        expect(getDeltaECriticalThreshold(p)).toBe(7.5)
    })
})

// ── shouldBlockExport ─────────────────────────────────────────────────────────

describe('shouldBlockExport — Test 16: empty violations → not blocked', () => {
    it('returns false when violation list is empty', () => {
        expect(shouldBlockExport([], false, makePolicy())).toBe(false)
    })
})

describe('shouldBlockExport — Test 17: severity floor critical + warning violations → not blocked', () => {
    it('warning violations do not block when floor is critical', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                severityFloor: 'critical',
                severity_floor: 'critical',
            },
        })
        const violations = [
            { ruleId: 'MITHRIL-COL', severity: 'warning' as const },
            { ruleId: 'A11Y-001', severity: 'warning' as const },
        ]
        expect(shouldBlockExport(violations, false, policy)).toBe(false)
    })

    it('amber violations do not block when floor is critical', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                severityFloor: 'critical',
                severity_floor: 'critical',
            },
        })
        expect(shouldBlockExport(
            [{ ruleId: 'MITHRIL-COL', severity: 'amber' as const }],
            false,
            policy
        )).toBe(false)
    })
})

describe('shouldBlockExport — Test 18: severity floor warning + warning violation → blocked', () => {
    it('blocks when a warning-severity blocking rule violation exists', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                severityFloor: 'warning',
                severity_floor: 'warning',
            },
        })
        expect(shouldBlockExport(
            [{ ruleId: 'MITHRIL-COL', severity: 'warning' as const }],
            false,
            policy
        )).toBe(true)
    })
})

describe('shouldBlockExport — Test 19: all rules advisory → violations present but export allowed', () => {
    it('does not block when all violations come from advisory rules', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                mode: 'advisory',
            },
            a11y: {
                ...DEFAULT_RESOLVED_POLICY.a11y,
                mode: 'advisory',
            },
        })
        const violations = [
            { ruleId: 'MITHRIL-COL', severity: 'critical' as const },
            { ruleId: 'A11Y-001', severity: 'critical' as const },
        ]
        expect(shouldBlockExport(violations, false, policy)).toBe(false)
    })
})

describe('shouldBlockExport — Test 20: per-rule off → violations do not block', () => {
    it('does not block when the only violation is from a rule set to off', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                rules: { 'MITHRIL-COL': 'off' },
            },
        })
        // MITHRIL-COL is explicitly off — its violations must not block export.
        expect(shouldBlockExport(
            [{ ruleId: 'MITHRIL-COL', severity: 'critical' as const }],
            false,
            policy
        )).toBe(false)
    })

    it('off rule does not block but other blocking rules still do', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                rules: { 'MITHRIL-COL': 'off' },
            },
        })
        // MITHRIL-COL is off, but MITHRIL-SPC-001 is blocking by default.
        expect(shouldBlockExport(
            [
                { ruleId: 'MITHRIL-COL', severity: 'critical' as const },
                { ruleId: 'MITHRIL-SPC-001', severity: 'critical' as const },
            ],
            false,
            policy
        )).toBe(true)
    })

    it('returns false when the only violation is for an off rule', () => {
        const policy = makePolicy({
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                rules: { 'MITHRIL-COL': 'off' },
            },
        })
        expect(shouldBlockExport(
            [{ ruleId: 'MITHRIL-COL', severity: 'critical' as const }],
            false,
            makePolicy({
                mithril: {
                    ...DEFAULT_RESOLVED_POLICY.mithril,
                    rules: { 'MITHRIL-COL': 'off' },
                },
                a11y: { ...DEFAULT_RESOLVED_POLICY.a11y, mode: 'off' as any },
            })
        )).toBe(false)
    })
})

describe('shouldBlockExport — Test 21: overrides + block_on_overrides true → blocked', () => {
    it('blocks immediately when overrides exist and policy requires it', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                block_on_overrides: true,
            },
        })
        expect(shouldBlockExport([], true, policy)).toBe(true)
    })
})

describe('shouldBlockExport — Test 22: overrides + block_on_overrides false → not blocked by overrides', () => {
    it('overrides alone do not block when block_on_overrides is false', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                block_on_overrides: false,
            },
        })
        expect(shouldBlockExport([], true, policy)).toBe(false)
    })
})

describe('shouldBlockExport — Test 23: severity floor info + info violation → blocked', () => {
    it('blocks on info-severity violations when floor is info', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                severityFloor: 'info',
                severity_floor: 'info',
            },
        })
        expect(shouldBlockExport(
            [{ ruleId: 'MITHRIL-SPC-001', severity: 'info' as const }],
            false,
            policy
        )).toBe(true)
    })
})

describe('shouldBlockExport — Test 24: critical violation always blocks with blocking mode', () => {
    it('critical blocking violation always blocks regardless of floor', () => {
        const policy = makePolicy({
            exportGate: {
                ...DEFAULT_RESOLVED_POLICY.exportGate,
                severityFloor: 'warning',
                severity_floor: 'warning',
            },
        })
        expect(shouldBlockExport(
            [{ ruleId: 'A11Y-001', severity: 'critical' as const }],
            false,
            policy
        )).toBe(true)
    })
})

// ── validatePolicy ────────────────────────────────────────────────────────────

describe('validatePolicy — Test 25: valid v2 policy → valid: true', () => {
    it('accepts a complete valid v2 policy', () => {
        const result = validatePolicy({
            version: 2,
            domain: 'fintech',
            mithril: {
                deltaE_threshold: 1.0,
                deltaE_critical_threshold: 5.0,
                mode: 'blocking',
                ignore_patterns: ['**/node_modules/**'],
                rules: { 'MITHRIL-COL': 'blocking' },
            },
            a11y: {
                level: 'AA',
                mode: 'blocking',
                rules: { 'A11Y-001': 'off' },
            },
            export_gate: {
                severity_floor: 'warning',
                block_on_overrides: true,
            },
            baseline: { enabled: false },
            teams: {},
        })
        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.policy.domain).toBe('fintech')
            expect(result.policy.mithril.deltaEThreshold).toBe(1.0)
        }
    })
})

describe('validatePolicy — Test 26: valid v1 policy → valid: true with migration', () => {
    it('accepts a v1 policy and migrates disabled_rules', () => {
        const result = validatePolicy({
            version: 1,
            mithril: {
                deltaE_threshold: 2.0,
                deltaE_critical_threshold: 10.0,
                mode: 'blocking',
                ignore_patterns: [],
            },
            a11y: {
                level: 'AA',
                mode: 'blocking',
                disabled_rules: ['A11Y-007'],
            },
            export_gate: {
                block_on_mithril: true,
                block_on_a11y: true,
                block_on_overrides: true,
            },
            baseline: { enabled: false },
        })
        expect(result.valid).toBe(true)
        if (result.valid) {
            // Migration should have converted A11Y-007 to rules map.
            expect(result.policy.a11y.rules['A11Y-007']).toBe('off')
        }
    })
})

describe('validatePolicy — Test 27: null input → invalid', () => {
    it('returns valid:false for null', () => {
        const result = validatePolicy(null)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.length).toBeGreaterThan(0)
        }
    })
})

describe('validatePolicy — Test 28: array input → invalid', () => {
    it('returns valid:false for array input', () => {
        const result = validatePolicy([1, 2, 3])
        expect(result.valid).toBe(false)
    })
})

describe('validatePolicy — Test 29: version 3 → invalid', () => {
    it('rejects version 3 as unsupported', () => {
        const result = validatePolicy({ version: 3 })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('version'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 30: deltaE_threshold below range → error', () => {
    it('rejects deltaE_threshold of 0.0', () => {
        const result = validatePolicy({
            version: 2,
            mithril: { deltaE_threshold: 0.0, deltaE_critical_threshold: 10.0 },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('deltaE_threshold'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 31: deltaE_threshold above range → error', () => {
    it('rejects deltaE_threshold of 50.0', () => {
        const result = validatePolicy({
            version: 2,
            mithril: { deltaE_threshold: 50.0, deltaE_critical_threshold: 60.0 },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('deltaE_threshold'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 32: deltaE_critical <= deltaE → error', () => {
    it('rejects critical threshold not greater than normal threshold', () => {
        const result = validatePolicy({
            version: 2,
            mithril: { deltaE_threshold: 5.0, deltaE_critical_threshold: 5.0 },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('deltaE_critical_threshold'))).toBe(true)
        }
    })

    it('rejects critical threshold less than normal threshold', () => {
        const result = validatePolicy({
            version: 2,
            mithril: { deltaE_threshold: 5.0, deltaE_critical_threshold: 4.0 },
        })
        expect(result.valid).toBe(false)
    })
})

describe('validatePolicy — Test 33: unknown domain → error', () => {
    it('rejects unknown domain string', () => {
        const result = validatePolicy({ version: 2, domain: 'space-agency' })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('domain'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 34: unknown rule ID in mithril.rules → error', () => {
    it('rejects unknown Mithril rule ID', () => {
        const result = validatePolicy({
            version: 2,
            mithril: {
                deltaE_threshold: 2.0,
                deltaE_critical_threshold: 10.0,
                rules: { 'MITHRIL-FAKE-999': 'blocking' },
            },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('MITHRIL-FAKE-999'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 35: unknown rule ID in a11y.rules → error', () => {
    it('rejects unknown A11y rule ID', () => {
        const result = validatePolicy({
            version: 2,
            a11y: { rules: { 'A11Y-999': 'blocking' } },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('A11Y-999'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 36: invalid severity_floor → error', () => {
    it('rejects unknown severity_floor value', () => {
        const result = validatePolicy({
            version: 2,
            export_gate: { severity_floor: 'severe' },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('severity_floor'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 37: empty object → valid: true (defaults)', () => {
    it('accepts an empty object and resolves to defaults', () => {
        const result = validatePolicy({})
        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.policy.mithril.deltaEThreshold).toBe(2.0)
            expect(result.policy.exportGate.severityFloor).toBe('warning')
        }
    })
})

describe('validatePolicy — Test 38: invalid mithril.mode → error', () => {
    it('rejects invalid mode value in mithril section', () => {
        const result = validatePolicy({
            version: 2,
            mithril: { mode: 'strict' },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('mithril.mode'))).toBe(true)
        }
    })
})

describe('validatePolicy — Test 39: invalid a11y.level → error', () => {
    it('rejects invalid conformance level', () => {
        const result = validatePolicy({
            version: 2,
            a11y: { level: 'AAA+' },
        })
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors.some(e => e.includes('a11y.level'))).toBe(true)
        }
    })
})

// ── migrateV1ToV2 ─────────────────────────────────────────────────────────────

describe('migrateV1ToV2 — Test 40: disabled_rules → rules map with off', () => {
    it('converts each disabled rule to rules[ruleId] = off', () => {
        const migrated = migrateV1ToV2({
            version: 1,
            a11y: {
                level: 'AA',
                mode: 'blocking',
                disabled_rules: ['A11Y-007', 'A11Y-003'],
            },
        })
        expect(migrated.a11y?.rules?.['A11Y-007']).toBe('off')
        expect(migrated.a11y?.rules?.['A11Y-003']).toBe('off')
    })

    it('handles empty disabled_rules array gracefully', () => {
        const migrated = migrateV1ToV2({
            version: 1,
            a11y: { disabled_rules: [] },
        })
        expect(migrated.a11y?.rules).toEqual({})
    })
})

describe('migrateV1ToV2 — Test 41: block_on_mithril=false → mithril.mode=advisory', () => {
    it('sets mithril mode to advisory when block_on_mithril is false', () => {
        const migrated = migrateV1ToV2({
            version: 1,
            export_gate: { block_on_mithril: false, block_on_a11y: true, block_on_overrides: true },
        })
        expect(migrated.mithril?.mode).toBe('advisory')
    })

    it('does not change mithril mode when block_on_mithril is true', () => {
        const migrated = migrateV1ToV2({
            version: 1,
            mithril: { mode: 'blocking' },
            export_gate: { block_on_mithril: true },
        })
        expect(migrated.mithril?.mode).toBe('blocking')
    })
})

describe('migrateV1ToV2 — Test 42: block_on_a11y=false → a11y.mode=advisory', () => {
    it('sets a11y mode to advisory when block_on_a11y is false', () => {
        const migrated = migrateV1ToV2({
            version: 1,
            export_gate: { block_on_mithril: true, block_on_a11y: false, block_on_overrides: true },
        })
        expect(migrated.a11y?.mode).toBe('advisory')
    })

    it('does not change a11y mode when block_on_a11y is true', () => {
        const migrated = migrateV1ToV2({
            version: 1,
            a11y: { mode: 'blocking' },
            export_gate: { block_on_a11y: true },
        })
        expect(migrated.a11y?.mode).toBe('blocking')
    })
})

describe('migrateV1ToV2 — Test 43: version bumped to 2', () => {
    it('outputs version 2 regardless of input version', () => {
        expect(migrateV1ToV2({ version: 1 }).version).toBe(2)
        expect(migrateV1ToV2({ version: undefined }).version).toBe(2)
    })
})

describe('migrateV1ToV2 — Test 44: v2 policy passes through migration without losing data', () => {
    it('does not corrupt v2 fields during migration pass', () => {
        const v2: Record<string, unknown> = {
            version: 2,
            mithril: { deltaE_threshold: 3.0, mode: 'advisory', rules: { 'MITHRIL-COL': 'off' } },
            a11y: { level: 'AAA', rules: { 'A11Y-001': 'blocking' } },
        }
        const migrated = migrateV1ToV2(v2)
        expect(migrated.mithril?.mode).toBe('advisory')
        expect(migrated.mithril?.rules?.['MITHRIL-COL']).toBe('off')
        expect(migrated.a11y?.level).toBe('AAA')
        expect(migrated.a11y?.rules?.['A11Y-001']).toBe('blocking')
    })
})
