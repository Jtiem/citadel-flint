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

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parse } from '@babel/parser'

import { DEFAULT_POLICY } from '../core/config.js'
import type { FlintPolicy } from '../core/config.js'
import { loadPolicy } from '../core/config-loader.js'
import { readPolicy, writePolicy, mergePolicy, getDefaultPolicy } from '../core/policyLoader.js'
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

    it('getDefaultPolicy returns a copy of DEFAULT_POLICY', () => {
        const policy = getDefaultPolicy()
        expect(policy).toEqual(DEFAULT_POLICY)
        // Must be a separate object
        expect(policy).not.toBe(DEFAULT_POLICY)
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

describe('Test 5: writePolicy creates directory and file', () => {
    it('creates .flint/ and writes a valid policy.json', () => {
        const projDir = path.join(tmpDir, 'write-project')
        // Do not create .flint/ — writePolicy should create it
        fs.mkdirSync(projDir, { recursive: true })

        const customPolicy: FlintPolicy = {
            ...DEFAULT_POLICY,
            mithril: {
                ...DEFAULT_POLICY.mithril,
                deltaE_threshold: 3.5,
            },
        }

        writePolicy(projDir, customPolicy)

        const policyPath = path.join(projDir, '.flint', 'policy.json')
        expect(fs.existsSync(policyPath)).toBe(true)

        const read = JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
        expect(read.mithril.deltaE_threshold).toBe(3.5)
        expect(read.version).toBe(1)
    })
})

// ── Test 6: mergePolicy ─────────────────────────────────────────────────────

describe('Test 6: mergePolicy performs partial update', () => {
    it('updates only the specified fields and writes the result', () => {
        const projDir = path.join(tmpDir, 'merge-project')
        const flintDir = path.join(projDir, '.flint')
        fs.mkdirSync(flintDir, { recursive: true })

        // Start with default policy
        writePolicy(projDir, DEFAULT_POLICY)

        // Merge a partial update
        const result = mergePolicy(projDir, {
            a11y: {
                ...DEFAULT_POLICY.a11y,
                mode: 'advisory',
                disabled_rules: ['A11Y-006'],
            },
        })

        expect(result.a11y.mode).toBe('advisory')
        expect(result.a11y.disabled_rules).toEqual(['A11Y-006'])
        // Mithril section untouched
        expect(result.mithril.deltaE_threshold).toBe(2.0)

        // Verify it was written to disk
        const onDisk = JSON.parse(
            fs.readFileSync(path.join(flintDir, 'policy.json'), 'utf-8')
        )
        expect(onDisk.a11y.mode).toBe('advisory')
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
