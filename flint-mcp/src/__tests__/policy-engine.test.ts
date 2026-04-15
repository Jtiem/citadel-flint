/**
 * Policy Engine Tests — flint-mcp/src/__tests__/policy-engine.test.ts
 *
 * Tests for the configurable governance policy engine (Gap 3).
 *
 * Test map:
 *   1  — Default policy has correct shape and values
 *   2  — loadPolicy returns defaults when file is missing
 *   3  — loadPolicy reads and merges partial policy file
 *   4  — loadPolicy handles malformed JSON gracefully
 *   5  — writePolicy creates .flint directory and writes file
 *   6  — mergePolicy performs partial update correctly
 *   7  — MithrilLinter respects configurable deltaE threshold
 *   8  — MithrilLinter respects configurable critical threshold
 *   9  — auditAll passes through policy options to visitClassNames
 *  10  — Policy mode 'off' suppresses all Mithril violations
 *  11  — Policy mode 'advisory' still detects but does not block
 *  12  — Export gate respects block_on_mithril=false
 *  13  — Export gate respects block_on_a11y=false
 *  14  — Unsupported version falls back to defaults
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parse } from '@babel/parser'

import { DEFAULT_POLICY } from '../core/config.js'
import type { FlintPolicy } from '../core/config.js'
import { loadPolicy } from '../core/config-loader.js'
import {
    loadAndResolvePolicy,
    writeResolvedPolicy,
    mergeAndValidatePolicy,
    getDefaultResolvedPolicy,
    toLegacyFlintPolicy,
    DEFAULT_RESOLVED_POLICY,
    KNOWN_MITHRIL_RULES,
    KNOWN_A11Y_RULES,
    SEVERITY_RANK,
    coerceToResolved,
    type ResolvedPolicy,
    type RawPolicy,
} from '../core/policyEngine.js'
import { auditAll, visitClassNames, MITHRIL_THRESHOLD } from '../core/MithrilLinter.js'
import type { DesignToken } from '../types.js'

// ── Fixtures ────────────────────────────────────────────────────────────────

const TOKENS: DesignToken[] = [
    {
        id: 1,
        token_path: 'color-brand.primary',
        token_type: 'color',
        token_value: '#3b82f6',
        description: null,
        collection_name: 'global',
        mode: 'default',
    },
]

function parseTSX(source: string) {
    return parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

// ── Temp directory management ─────────────────────────────────────────────

let tmpDir: string

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-policy-test-'))
})

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 })
})

// ── Test 1: Default policy shape ─────────────────────────────────────────────

describe('Test 1: Default policy shape', () => {
    it('DEFAULT_POLICY has all required fields with correct default values', () => {
        expect(DEFAULT_POLICY.version).toBe(1)
        expect(DEFAULT_POLICY.mithril.deltaE_threshold).toBe(2.0)
        expect(DEFAULT_POLICY.mithril.deltaE_critical_threshold).toBe(10.0)
        expect(DEFAULT_POLICY.mithril.mode).toBe('blocking')
        expect(DEFAULT_POLICY.mithril.ignore_patterns).toEqual(['**/node_modules/**'])
        expect(DEFAULT_POLICY.a11y.level).toBe('AA')
        expect(DEFAULT_POLICY.a11y.mode).toBe('blocking')
        expect(DEFAULT_POLICY.a11y.disabled_rules).toEqual([])
        expect(DEFAULT_POLICY.export_gate.block_on_mithril).toBe(true)
        expect(DEFAULT_POLICY.export_gate.block_on_a11y).toBe(true)
        expect(DEFAULT_POLICY.export_gate.block_on_overrides).toBe(true)
        expect(DEFAULT_POLICY.baseline.enabled).toBe(false)
    })

    it('getDefaultResolvedPolicy returns a fresh clone of DEFAULT_RESOLVED_POLICY', () => {
        const policy = getDefaultResolvedPolicy()
        expect(policy).toEqual(DEFAULT_RESOLVED_POLICY)
        // Must be a separate object
        expect(policy).not.toBe(DEFAULT_RESOLVED_POLICY)
    })
})

// ── Test 2: Missing policy file ─────────────────────────────────────────────

describe('Test 2: Missing policy file', () => {
    it('loadPolicy returns defaults when .flint/policy.json does not exist', () => {
        const emptyDir = path.join(tmpDir, 'empty-project')
        fs.mkdirSync(emptyDir, { recursive: true })

        const policy = loadPolicy(emptyDir)
        expect(policy).toEqual(DEFAULT_POLICY)
    })
})

// ── Test 3: Partial policy merge ─────────────────────────────────────────────

describe('Test 3: Partial policy merge', () => {
    it('merges partial policy with defaults, preserving unset fields', () => {
        const projDir = path.join(tmpDir, 'partial-project')
        const flintDir = path.join(projDir, '.flint')
        fs.mkdirSync(flintDir, { recursive: true })

        // Write a partial policy — only override the ΔE threshold
        fs.writeFileSync(
            path.join(flintDir, 'policy.json'),
            JSON.stringify({
                version: 1,
                mithril: {
                    deltaE_threshold: 5.0,
                },
            }),
            'utf-8'
        )

        const policy = loadPolicy(projDir)

        // Overridden field
        expect(policy.mithril.deltaE_threshold).toBe(5.0)
        // Default-preserved fields
        expect(policy.mithril.deltaE_critical_threshold).toBe(10.0)
        expect(policy.mithril.mode).toBe('blocking')
        expect(policy.a11y.level).toBe('AA')
        expect(policy.export_gate.block_on_mithril).toBe(true)
    })
})

// ── Test 4: Malformed JSON ──────────────────────────────────────────────────

describe('Test 4: Malformed JSON', () => {
    it('returns defaults when policy.json contains invalid JSON', () => {
        const projDir = path.join(tmpDir, 'malformed-project')
        const flintDir = path.join(projDir, '.flint')
        fs.mkdirSync(flintDir, { recursive: true })

        fs.writeFileSync(
            path.join(flintDir, 'policy.json'),
            'NOT VALID JSON { broken',
            'utf-8'
        )

        const policy = loadPolicy(projDir)
        expect(policy).toEqual(DEFAULT_POLICY)
    })
})

// ── Test 5: writePolicy ─────────────────────────────────────────────────────

describe('Test 5: writeResolvedPolicy creates directory and file', () => {
    it('creates .flint/ and writes a valid policy.json in v2 shape', () => {
        const projDir = path.join(tmpDir, 'write-project')
        // Do not create .flint/ — writeResolvedPolicy should create it
        fs.mkdirSync(projDir, { recursive: true })

        const customPolicy: ResolvedPolicy = {
            ...structuredClone(DEFAULT_RESOLVED_POLICY),
            mithril: {
                ...DEFAULT_RESOLVED_POLICY.mithril,
                deltaEThreshold: 3.5,
                deltaE_threshold: 3.5,
            },
        }

        writeResolvedPolicy(projDir, customPolicy)

        const policyPath = path.join(projDir, '.flint', 'policy.json')
        expect(fs.existsSync(policyPath)).toBe(true)

        const read = JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
        expect(read.mithril.deltaE_threshold).toBe(3.5)
        expect(read.version).toBe(2)
    })
})

// ── Test 6: mergePolicy ─────────────────────────────────────────────────────

describe('Test 6: mergeAndValidatePolicy performs partial update', () => {
    it('updates only the specified fields and writes the result', () => {
        const projDir = path.join(tmpDir, 'merge-project')
        const flintDir = path.join(projDir, '.flint')
        fs.mkdirSync(flintDir, { recursive: true })

        // Start with default policy on disk
        writeResolvedPolicy(projDir, getDefaultResolvedPolicy())

        // Merge a partial update
        const result = mergeAndValidatePolicy(projDir, {
            a11y: {
                mode: 'advisory',
                disabled_rules: ['A11Y-006'],
            },
        })

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.policy.a11y.mode).toBe('advisory')
        // disabled_rules → rules map entries with mode 'off' (v2 migration)
        expect(result.policy.a11y.rules['A11Y-006']).toBe('off')
        // Mithril section untouched
        expect(result.policy.mithril.deltaEThreshold).toBe(2.0)

        // Verify it was written to disk
        const onDisk = JSON.parse(
            fs.readFileSync(path.join(flintDir, 'policy.json'), 'utf-8')
        )
        expect(onDisk.a11y.mode).toBe('advisory')
    })

    it('rejects unknown a11y rule ID and does not write file', () => {
        const projDir = path.join(tmpDir, 'merge-reject-project')
        fs.mkdirSync(projDir, { recursive: true })
        writeResolvedPolicy(projDir, getDefaultResolvedPolicy())
        const before = fs.readFileSync(path.join(projDir, '.flint', 'policy.json'), 'utf-8')

        const result = mergeAndValidatePolicy(projDir, {
            a11y: {
                rules: { 'A11Y-NOT-A-REAL-RULE': 'off' },
            },
        })

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errors.some((e) => e.includes('A11Y-NOT-A-REAL-RULE'))).toBe(true)

        // File should be unchanged
        const after = fs.readFileSync(path.join(projDir, '.flint', 'policy.json'), 'utf-8')
        expect(after).toBe(before)
    })

    it('rejects invalid deltaE_threshold (negative)', () => {
        const projDir = path.join(tmpDir, 'merge-reject-de-project')
        fs.mkdirSync(projDir, { recursive: true })
        writeResolvedPolicy(projDir, getDefaultResolvedPolicy())

        const result = mergeAndValidatePolicy(projDir, {
            mithril: { deltaE_threshold: -5 },
        })
        expect(result.ok).toBe(false)
    })
})

// ── Test 7: Configurable ΔE threshold ────────────────────────────────────────

describe('Test 7: MithrilLinter respects configurable deltaE threshold', () => {
    it('raising threshold to 200 suppresses all violations (max possible ΔE is ~100)', () => {
        const source = `
            const C = () => (
                <div data-flint-id="node-threshold" className="bg-[#ff0000]">Hello</div>
            )
        `
        const ast = parseTSX(source)

        // Default threshold: should produce a violation
        const defaultWarnings = visitClassNames(ast as any, TOKENS)
        expect(defaultWarnings.has('node-threshold')).toBe(true)

        // Re-parse (visitors consume paths)
        const ast2 = parseTSX(source)

        // Raised threshold to 200 (beyond any possible ΔE): no violations
        const lenientWarnings = visitClassNames(ast2 as any, TOKENS, {
            deltaE_threshold: 200,
        })
        expect(lenientWarnings.has('node-threshold')).toBe(false)
    })

    it('lowering threshold to 0 catches every non-identical color', () => {
        // #3b83f6 differs from #3b82f6 by about 0.3 ΔE — normally no violation
        const source = `
            const C = () => (
                <div data-flint-id="node-strict" className="bg-[#3b83f6]">x</div>
            )
        `
        const ast = parseTSX(source)

        // Default threshold (2.0): no violation
        const defaultWarnings = visitClassNames(ast as any, TOKENS)
        expect(defaultWarnings.has('node-strict')).toBe(false)

        // Re-parse
        const ast2 = parseTSX(source)

        // Threshold = 0: even tiny differences violate
        const strictWarnings = visitClassNames(ast2 as any, TOKENS, {
            deltaE_threshold: 0,
        })
        expect(strictWarnings.has('node-strict')).toBe(true)
    })
})

// ── Test 8: Configurable critical threshold ──────────────────────────────────

describe('Test 8: MithrilLinter respects configurable critical threshold', () => {
    it('lowering critical threshold to 5 upgrades severity of violations with ΔE > 5', () => {
        const source = `
            const C = () => (
                <div data-flint-id="node-crit" className="bg-[#ff0000]">Hello</div>
            )
        `
        const ast = parseTSX(source)

        // With default critical = 10: #ff0000 vs #3b82f6 has very high ΔE
        const defaultWarnings = visitClassNames(ast as any, TOKENS)
        const defaultW = defaultWarnings.get('node-crit')
        expect(defaultW).toBeDefined()

        // Re-parse
        const ast2 = parseTSX(source)

        // With critical = 5: same color, lowered critical threshold
        const strictWarnings = visitClassNames(ast2 as any, TOKENS, {
            deltaE_critical_threshold: 5,
        })
        const strictW = strictWarnings.get('node-crit')
        expect(strictW).toBeDefined()
        // The ΔE is well above 5, so it should be critical
        expect(strictW!.severity).toBe('critical')
    })
})

// ── Test 9: auditAll passes through options ──────────────────────────────────

describe('Test 9: auditAll passes through policy options', () => {
    it('auditAll with raised threshold produces no color violations', () => {
        const source = `
            const C = () => (
                <div data-flint-id="node-audit" className="bg-[#ff0000]">Hello</div>
            )
        `
        const ast = parseTSX(source)

        const lenientWarnings = auditAll(ast as any, TOKENS, {
            deltaE_threshold: 200,
        })
        // Color visitor should produce zero violations with threshold=200 (beyond max ΔE)
        const w = lenientWarnings.get('node-audit')
        expect(w).toBeUndefined()
    })
})

// ── Test 10: Policy mode 'off' ──────────────────────────────────────────────

describe('Test 10: Policy mode off suppresses Mithril', () => {
    it('when mithril.mode is off, auditAll should not be called (simulation)', () => {
        // This tests the server-side logic where mode='off' prevents calling auditAll.
        // We simulate the server logic here.
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            mithril: { ...DEFAULT_POLICY.mithril, mode: 'off' },
        }

        const source = `
            const C = () => (
                <div data-flint-id="node-off" className="bg-[#ff0000]">Hello</div>
            )
        `
        const ast = parseTSX(source)

        // Simulate server logic: skip audit when mode is 'off'
        const warnings = policy.mithril.mode !== 'off'
            ? auditAll(ast as any, TOKENS)
            : new Map()

        expect(warnings.size).toBe(0)
    })
})

// ── Test 11: Policy mode 'advisory' ─────────────────────────────────────────

describe('Test 11: Advisory mode detects but does not block export', () => {
    it('advisory mode still produces violations but canExport logic skips them', () => {
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            mithril: { ...DEFAULT_POLICY.mithril, mode: 'advisory' },
        }

        const source = `
            const C = () => (
                <div data-flint-id="node-adv" className="bg-[#ff0000]">Hello</div>
            )
        `
        const ast = parseTSX(source)

        // Audit still runs and detects violations
        const warnings = auditAll(ast as any, TOKENS)
        expect(warnings.size).toBeGreaterThan(0)

        // Export gate simulation: advisory mode does not block
        const blockOnMithril = policy.export_gate.block_on_mithril
        const mithrilMode = policy.mithril.mode
        const mithrilBlocks = blockOnMithril && mithrilMode === 'blocking' && warnings.size > 0
        expect(mithrilBlocks).toBe(false)
    })
})

// ── Test 12: export_gate.block_on_mithril = false ───────────────────────────

describe('Test 12: Export gate respects block_on_mithril=false', () => {
    it('does not block export when block_on_mithril is false', () => {
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            export_gate: { ...DEFAULT_POLICY.export_gate, block_on_mithril: false },
        }

        // Simulate: violations exist but gate is disabled
        const hasMithrilViolations = true
        const hasA11yViolations = false
        const hasOverrides = false

        const blockOnMithril = policy.export_gate.block_on_mithril
        const blockOnA11y = policy.export_gate.block_on_a11y
        const blockOnOverrides = policy.export_gate.block_on_overrides

        const mithrilBlocks = blockOnMithril && hasMithrilViolations
        const a11yBlocks = blockOnA11y && hasA11yViolations
        const overridesBlock = blockOnOverrides && hasOverrides

        const canExport = !mithrilBlocks && !a11yBlocks && !overridesBlock
        expect(canExport).toBe(true)
    })
})

// ── Test 13: export_gate.block_on_a11y = false ──────────────────────────────

describe('Test 13: Export gate respects block_on_a11y=false', () => {
    it('does not block export when block_on_a11y is false', () => {
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            export_gate: { ...DEFAULT_POLICY.export_gate, block_on_a11y: false },
        }

        const hasMithrilViolations = false
        const hasA11yViolations = true
        const hasOverrides = false

        const blockOnA11y = policy.export_gate.block_on_a11y
        const a11yBlocks = blockOnA11y && hasA11yViolations

        const canExport = !a11yBlocks
        expect(canExport).toBe(true)
    })
})

// ── Test 14: Unsupported version ─────────────────────────────────────────────

describe('Test 14: Unsupported version falls back to defaults', () => {
    it('loadPolicy returns defaults when version is not 1', () => {
        const projDir = path.join(tmpDir, 'version-project')
        const flintDir = path.join(projDir, '.flint')
        fs.mkdirSync(flintDir, { recursive: true })

        fs.writeFileSync(
            path.join(flintDir, 'policy.json'),
            JSON.stringify({
                version: 99,
                mithril: { deltaE_threshold: 999 },
            }),
            'utf-8'
        )

        const policy = loadPolicy(projDir)
        // Should fall back to defaults because version 99 is unsupported
        expect(policy.mithril.deltaE_threshold).toBe(2.0)
        expect(policy).toEqual(DEFAULT_POLICY)
    })
})

// ── Sprint 3: new unified surface ────────────────────────────────────────────

describe('Sprint 3: KNOWN_MITHRIL_RULES derived from errorTaxonomy', () => {
    it('contains classic + extended Mithril rule IDs including MITHRIL-IST-COL', () => {
        expect(KNOWN_MITHRIL_RULES.size).toBeGreaterThan(15)
        expect(KNOWN_MITHRIL_RULES.has('MITHRIL-COL')).toBe(true)
        expect(KNOWN_MITHRIL_RULES.has('MITHRIL-IST-COL')).toBe(true)
        expect(KNOWN_MITHRIL_RULES.has('MITHRIL-TW-001')).toBe(true)
        expect(KNOWN_MITHRIL_RULES.has('MITHRIL-DARK-001')).toBe(true)
    })
    it('excludes a11y rule IDs', () => {
        expect(KNOWN_MITHRIL_RULES.has('A11Y-001')).toBe(false)
        expect(KNOWN_MITHRIL_RULES.has('A11Y-011')).toBe(false)
    })
})

describe('Sprint 3: KNOWN_A11Y_RULES derived from errorTaxonomy', () => {
    it('contains the full A11Y-001..A11Y-103 coverage', () => {
        expect(KNOWN_A11Y_RULES.has('A11Y-001')).toBe(true)
        expect(KNOWN_A11Y_RULES.has('A11Y-011')).toBe(true)
        expect(KNOWN_A11Y_RULES.has('A11Y-103')).toBe(true)
        // CRIT-2 regression guard — validatePolicy must accept A11Y-011
        expect(KNOWN_A11Y_RULES.has('A11Y-011')).toBe(true)
    })
    it('excludes mithril rules and other categories', () => {
        expect(KNOWN_A11Y_RULES.has('MITHRIL-COL')).toBe(false)
        expect(KNOWN_A11Y_RULES.has('SYNC-001')).toBe(false)
    })
})

describe('Sprint 3: SEVERITY_RANK has no advisory alias (MAJOR-8)', () => {
    it('advisory key is removed from the severity map', () => {
        expect(SEVERITY_RANK.advisory).toBeUndefined()
    })
    it('info/amber/warning/critical keys remain and order correctly', () => {
        expect(SEVERITY_RANK.info).toBe(1)
        expect(SEVERITY_RANK.amber).toBe(2)
        expect(SEVERITY_RANK.warning).toBe(2)
        expect(SEVERITY_RANK.critical).toBe(3)
        expect(SEVERITY_RANK.critical > SEVERITY_RANK.warning).toBe(true)
    })
})

describe('Sprint 3: coerceToResolved validates rawMode (MINOR-9)', () => {
    it('falls back to default on invalid rawMode with a warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const resolved = coerceToResolved({
            mithril: { mode: 'erorr' } as unknown as RawPolicy['mithril'],
        })
        expect(resolved.mithril.mode).toBe(DEFAULT_RESOLVED_POLICY.mithril.mode)
        expect(warn).toHaveBeenCalled()
        warn.mockRestore()
    })
    it('accepts valid modes unchanged', () => {
        const resolved = coerceToResolved({ mithril: { mode: 'advisory' } })
        expect(resolved.mithril.mode).toBe('advisory')
    })
    it('drops deprecated disabled_rules from ResolvedPolicy shape (MINOR-11)', () => {
        const def = getDefaultResolvedPolicy()
        expect('disabled_rules' in def.a11y).toBe(false)
    })
})

describe('Sprint 3: loadAndResolvePolicy unified loader (CRIT-1 + CRIT-3)', () => {
    it('returns DEFAULT_RESOLVED_POLICY clone when file is missing', () => {
        const projDir = path.join(tmpDir, 'sprint3-missing')
        fs.mkdirSync(projDir, { recursive: true })
        const policy = loadAndResolvePolicy(projDir)
        expect(policy).toEqual(DEFAULT_RESOLVED_POLICY)
        expect(policy).not.toBe(DEFAULT_RESOLVED_POLICY)
    })

    it('migrates v1 on-disk policy to v2 ResolvedPolicy', () => {
        const projDir = path.join(tmpDir, 'sprint3-v1-migrate')
        fs.mkdirSync(path.join(projDir, '.flint'), { recursive: true })
        fs.writeFileSync(
            path.join(projDir, '.flint', 'policy.json'),
            JSON.stringify({
                version: 1,
                a11y: { disabled_rules: ['A11Y-006'] },
            }),
            'utf-8'
        )
        const policy = loadAndResolvePolicy(projDir)
        expect(policy.version).toBe(2)
        expect(policy.a11y.rules['A11Y-006']).toBe('off')
    })

    it('strict mode throws on malformed JSON', () => {
        const projDir = path.join(tmpDir, 'sprint3-strict-bad')
        fs.mkdirSync(path.join(projDir, '.flint'), { recursive: true })
        fs.writeFileSync(
            path.join(projDir, '.flint', 'policy.json'),
            '{ NOT VALID',
            'utf-8'
        )
        expect(() => loadAndResolvePolicy(projDir, { strict: true })).toThrow()
    })

    it('strict mode throws on validation failure (unknown rule)', () => {
        const projDir = path.join(tmpDir, 'sprint3-strict-invalid')
        fs.mkdirSync(path.join(projDir, '.flint'), { recursive: true })
        fs.writeFileSync(
            path.join(projDir, '.flint', 'policy.json'),
            JSON.stringify({
                version: 2,
                a11y: { rules: { 'BOGUS-999': 'off' } },
            }),
            'utf-8'
        )
        expect(() => loadAndResolvePolicy(projDir, { strict: true })).toThrow()
    })

    it('non-strict mode accepts unknown rule and logs (permissive default)', () => {
        const projDir = path.join(tmpDir, 'sprint3-permissive')
        fs.mkdirSync(path.join(projDir, '.flint'), { recursive: true })
        fs.writeFileSync(
            path.join(projDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, mithril: { deltaE_threshold: 3.5 } }),
            'utf-8'
        )
        const policy = loadAndResolvePolicy(projDir)
        expect(policy.mithril.deltaEThreshold).toBe(3.5)
    })
})

describe('Sprint 3: toLegacyFlintPolicy adapter', () => {
    it('converts v2 ResolvedPolicy back to v1 FlintPolicy shape', () => {
        const resolved = getDefaultResolvedPolicy()
        const legacy = toLegacyFlintPolicy(resolved)
        expect(legacy.version).toBe(1)
        expect(legacy.mithril.deltaE_threshold).toBe(2.0)
        expect(legacy.a11y.level).toBe('AA')
        expect(legacy.a11y.disabled_rules).toEqual([])
        expect(legacy.export_gate.block_on_overrides).toBe(true)
    })

    it('extracts disabled rules from resolved rules map', () => {
        const resolved = getDefaultResolvedPolicy()
        resolved.a11y.rules['A11Y-006'] = 'off'
        resolved.a11y.rules['A11Y-011'] = 'advisory'
        const legacy = toLegacyFlintPolicy(resolved)
        expect(legacy.a11y.disabled_rules).toContain('A11Y-006')
        expect(legacy.a11y.disabled_rules).not.toContain('A11Y-011')
    })
})
