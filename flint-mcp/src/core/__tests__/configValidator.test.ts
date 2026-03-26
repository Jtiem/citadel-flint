/**
 * Config Validator Tests — flint-mcp/src/core/__tests__/configValidator.test.ts
 *
 * Tests for validateProjectConfig() (UCFG.7c).
 *
 * Test map:
 *   1  — valid minimal config (project only) passes with no errors
 *   2  — valid full config passes with no errors
 *   3  — missing project field returns error
 *   4  — project as number returns error
 *   5  — project as empty string returns error
 *   6  — unknown domain returns error
 *   7  — unknown classification returns error
 *   8  — invalid mithril rule mode returns error
 *   9  — invalid a11y mode returns error
 *  10  — delta_e as string returns error
 *  11  — delta_e as negative number returns error
 *  12  — delta_e_critical as string returns error
 *  13  — delta_e_critical < delta_e returns error
 *  14  — delta_e_critical == delta_e returns error (must be strictly greater)
 *  15  — invalid a11y level returns error
 *  16  — invalid trust.default_tier returns error
 *  17  — valid legacy trust tier is accepted
 *  18  — all valid new trust tiers are accepted
 *  19  — scoring weight > 1 returns error
 *  20  — scoring weight < 0 returns error
 *  21  — scoring weight as string returns error
 *  22  — extends as string (not array) returns error
 *  23  — tighten_only as string returns error
 *  24  — multiple errors are collected in one pass
 *  25  — null config returns error
 *  26  — array config returns error
 *  27  — schema_version as number returns error
 *  28  — schema_version as string passes
 *  29  — valid scoring weights (0.0 and 1.0 boundaries) pass
 *  30  — delta_e = 0 returns error (must be positive)
 */

import { describe, it, expect } from 'vitest'
import { validateProjectConfig } from '../configValidator.js'
import type { ValidationError } from '../configValidator.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function paths(errors: ValidationError[]): string[] {
    return errors.map((e) => e.path)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateProjectConfig', () => {
    // ── Test 1: valid minimal config ──────────────────────────────────────────
    it('valid minimal config (project only) passes with no errors', () => {
        const errors = validateProjectConfig({ project: 'my-app' })
        expect(errors).toHaveLength(0)
    })

    // ── Test 2: valid full config ─────────────────────────────────────────────
    it('valid full config passes with no errors', () => {
        const config = {
            project: '@acme/design-system',
            schema_version: '1.0',
            domain: 'healthcare',
            classification: 'restricted',
            extends: ['@flint/healthcare'],
            tighten_only: true,
            rules: {
                mithril: {
                    mode: 'coercive',
                    delta_e: 1.5,
                    delta_e_critical: 6.0,
                },
                accessibility: {
                    level: 'AA',
                    mode: 'normative',
                },
            },
            trust: {
                default_tier: 'junior',
            },
            scoring: {
                weights: {
                    coercive: 0.95,
                    normative: 0.8,
                    advisory: 0.5,
                    recency: 0.7,
                },
            },
        }
        const errors = validateProjectConfig(config)
        expect(errors).toHaveLength(0)
    })

    // ── Test 3: missing project field ─────────────────────────────────────────
    it('missing project field returns error', () => {
        const errors = validateProjectConfig({ domain: 'general' })
        expect(paths(errors)).toContain('project')
        const err = errors.find((e) => e.path === 'project')
        expect(err?.message).toMatch(/missing/)
    })

    // ── Test 4: project as number ─────────────────────────────────────────────
    it('project as number returns error', () => {
        const errors = validateProjectConfig({ project: 42 })
        expect(paths(errors)).toContain('project')
        const err = errors.find((e) => e.path === 'project')
        expect(err?.message).toMatch(/string/)
        expect(err?.value).toBe(42)
    })

    // ── Test 5: project as empty string ───────────────────────────────────────
    it('project as empty string returns error', () => {
        const errors = validateProjectConfig({ project: '   ' })
        expect(paths(errors)).toContain('project')
        const err = errors.find((e) => e.path === 'project')
        expect(err?.message).toMatch(/non-empty/)
    })

    // ── Test 6: unknown domain ────────────────────────────────────────────────
    it('unknown domain returns error', () => {
        const errors = validateProjectConfig({ project: 'app', domain: 'banana' })
        expect(paths(errors)).toContain('domain')
        const err = errors.find((e) => e.path === 'domain')
        expect(err?.message).toMatch(/banana/)
        expect(err?.value).toBe('banana')
    })

    // ── Test 7: unknown classification ───────────────────────────────────────
    it('unknown classification returns error', () => {
        const errors = validateProjectConfig({ project: 'app', classification: 'top-secret' })
        expect(paths(errors)).toContain('classification')
        const err = errors.find((e) => e.path === 'classification')
        expect(err?.message).toMatch(/top-secret/)
    })

    // ── Test 8: invalid mithril rule mode ─────────────────────────────────────
    it('invalid mithril rule mode returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { mode: 'strict' } },
        })
        expect(paths(errors)).toContain('rules.mithril.mode')
        const err = errors.find((e) => e.path === 'rules.mithril.mode')
        expect(err?.message).toMatch(/strict/)
    })

    // ── Test 9: invalid a11y mode ─────────────────────────────────────────────
    it('invalid a11y mode returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { accessibility: { mode: 'required' } },
        })
        expect(paths(errors)).toContain('rules.accessibility.mode')
    })

    // ── Test 10: delta_e as string ────────────────────────────────────────────
    it('delta_e as string returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { delta_e: 'banana' } },
        })
        expect(paths(errors)).toContain('rules.mithril.delta_e')
        const err = errors.find((e) => e.path === 'rules.mithril.delta_e')
        expect(err?.message).toMatch(/number/)
        expect(err?.value).toBe('banana')
    })

    // ── Test 11: delta_e as negative number ───────────────────────────────────
    it('delta_e as negative number returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { delta_e: -1.5 } },
        })
        expect(paths(errors)).toContain('rules.mithril.delta_e')
        const err = errors.find((e) => e.path === 'rules.mithril.delta_e')
        expect(err?.message).toMatch(/positive/)
    })

    // ── Test 12: delta_e_critical as string ───────────────────────────────────
    it('delta_e_critical as string returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { delta_e: 2.0, delta_e_critical: 'high' } },
        })
        expect(paths(errors)).toContain('rules.mithril.delta_e_critical')
        const err = errors.find((e) => e.path === 'rules.mithril.delta_e_critical')
        expect(err?.message).toMatch(/number/)
    })

    // ── Test 13: delta_e_critical < delta_e ───────────────────────────────────
    it('delta_e_critical < delta_e returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { delta_e: 5.0, delta_e_critical: 3.0 } },
        })
        expect(paths(errors)).toContain('rules.mithril.delta_e_critical')
        const err = errors.find((e) => e.path === 'rules.mithril.delta_e_critical')
        expect(err?.message).toMatch(/greater than/)
        expect(err?.value).toBe(3.0)
    })

    // ── Test 14: delta_e_critical == delta_e ──────────────────────────────────
    it('delta_e_critical == delta_e returns error (must be strictly greater)', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { delta_e: 2.0, delta_e_critical: 2.0 } },
        })
        expect(paths(errors)).toContain('rules.mithril.delta_e_critical')
    })

    // ── Test 15: invalid a11y level ───────────────────────────────────────────
    it('invalid a11y level returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { accessibility: { level: 'AAAA' } },
        })
        expect(paths(errors)).toContain('rules.accessibility.level')
        const err = errors.find((e) => e.path === 'rules.accessibility.level')
        expect(err?.message).toMatch(/AAAA/)
    })

    // ── Test 16: invalid trust tier ───────────────────────────────────────────
    it('invalid trust.default_tier returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            trust: { default_tier: 'superuser' },
        })
        expect(paths(errors)).toContain('trust.default_tier')
        const err = errors.find((e) => e.path === 'trust.default_tier')
        expect(err?.message).toMatch(/superuser/)
    })

    // ── Test 17: valid legacy trust tier ─────────────────────────────────────
    it('valid legacy trust tier is accepted', () => {
        const legacyTiers = ['untrusted', 'standard', 'elevated', 'admin']
        for (const tier of legacyTiers) {
            const errors = validateProjectConfig({ project: 'app', trust: { default_tier: tier } })
            const tierErrors = errors.filter((e) => e.path === 'trust.default_tier')
            expect(tierErrors, `legacy tier '${tier}' should be valid`).toHaveLength(0)
        }
    })

    // ── Test 18: all valid new trust tiers ────────────────────────────────────
    it('all valid new trust tiers are accepted', () => {
        const tiers = ['intern', 'junior', 'senior', 'principal']
        for (const tier of tiers) {
            const errors = validateProjectConfig({ project: 'app', trust: { default_tier: tier } })
            const tierErrors = errors.filter((e) => e.path === 'trust.default_tier')
            expect(tierErrors, `tier '${tier}' should be valid`).toHaveLength(0)
        }
    })

    // ── Test 19: scoring weight > 1 ───────────────────────────────────────────
    it('scoring weight > 1 returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            scoring: { weights: { coercive: 1.5 } },
        })
        expect(paths(errors)).toContain('scoring.weights.coercive')
        const err = errors.find((e) => e.path === 'scoring.weights.coercive')
        expect(err?.message).toMatch(/between 0 and 1/)
        expect(err?.value).toBe(1.5)
    })

    // ── Test 20: scoring weight < 0 ───────────────────────────────────────────
    it('scoring weight < 0 returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            scoring: { weights: { advisory: -0.1 } },
        })
        expect(paths(errors)).toContain('scoring.weights.advisory')
    })

    // ── Test 21: scoring weight as string ─────────────────────────────────────
    it('scoring weight as string returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            scoring: { weights: { normative: 'high' } },
        })
        expect(paths(errors)).toContain('scoring.weights.normative')
        const err = errors.find((e) => e.path === 'scoring.weights.normative')
        expect(err?.message).toMatch(/number/)
    })

    // ── Test 22: extends as string (not array) ────────────────────────────────
    it('extends as string (not array) returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            extends: '@flint/healthcare',
        })
        expect(paths(errors)).toContain('extends')
        const err = errors.find((e) => e.path === 'extends')
        expect(err?.message).toMatch(/array/)
    })

    // ── Test 23: tighten_only as string ───────────────────────────────────────
    it('tighten_only as string returns error', () => {
        const errors = validateProjectConfig({
            project: 'app',
            tighten_only: 'yes',
        })
        expect(paths(errors)).toContain('tighten_only')
        const err = errors.find((e) => e.path === 'tighten_only')
        expect(err?.message).toMatch(/boolean/)
    })

    // ── Test 24: multiple errors collected in one pass ────────────────────────
    it('multiple errors are returned at once', () => {
        const errors = validateProjectConfig({
            project: '',                            // error: empty
            domain: 'banana',                       // error: invalid domain
            classification: 'top-secret',           // error: invalid classification
            rules: {
                mithril: {
                    mode: 'strict',                 // error: invalid mode
                    delta_e: 'bad',                 // error: not a number
                },
                accessibility: {
                    level: 'AAAA',                  // error: invalid level
                },
            },
            trust: { default_tier: 'superuser' },   // error: invalid tier
            extends: '@flint/base',                 // error: not an array
        })

        // We expect at least 7 distinct error paths
        expect(errors.length).toBeGreaterThanOrEqual(7)
        expect(paths(errors)).toContain('project')
        expect(paths(errors)).toContain('domain')
        expect(paths(errors)).toContain('classification')
        expect(paths(errors)).toContain('rules.mithril.mode')
        expect(paths(errors)).toContain('rules.mithril.delta_e')
        expect(paths(errors)).toContain('rules.accessibility.level')
        expect(paths(errors)).toContain('trust.default_tier')
        expect(paths(errors)).toContain('extends')
    })

    // ── Test 25: null config returns error ────────────────────────────────────
    it('null config returns a root error', () => {
        const errors = validateProjectConfig(null)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].path).toBe('(root)')
    })

    // ── Test 26: array config returns error ───────────────────────────────────
    it('array config returns a root error', () => {
        const errors = validateProjectConfig(['project', 'app'])
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].path).toBe('(root)')
    })

    // ── Test 27: schema_version as number returns error ───────────────────────
    it('schema_version as number returns error', () => {
        const errors = validateProjectConfig({ project: 'app', schema_version: 1 })
        expect(paths(errors)).toContain('schema_version')
        const err = errors.find((e) => e.path === 'schema_version')
        expect(err?.message).toMatch(/string/)
    })

    // ── Test 28: schema_version as string passes ──────────────────────────────
    it('schema_version as string passes', () => {
        const errors = validateProjectConfig({ project: 'app', schema_version: '1.0' })
        const schemaErrors = errors.filter((e) => e.path === 'schema_version')
        expect(schemaErrors).toHaveLength(0)
    })

    // ── Test 29: boundary scoring weights 0.0 and 1.0 pass ───────────────────
    it('scoring weights at exact boundaries (0.0 and 1.0) are valid', () => {
        const errors = validateProjectConfig({
            project: 'app',
            scoring: {
                weights: {
                    coercive: 1.0,
                    normative: 0.0,
                    advisory: 0.5,
                    recency: 1.0,
                },
            },
        })
        const weightErrors = errors.filter((e) => e.path.startsWith('scoring.weights'))
        expect(weightErrors).toHaveLength(0)
    })

    // ── Test 30: delta_e = 0 returns error (must be positive) ────────────────
    it('delta_e = 0 returns error (must be positive)', () => {
        const errors = validateProjectConfig({
            project: 'app',
            rules: { mithril: { delta_e: 0 } },
        })
        expect(paths(errors)).toContain('rules.mithril.delta_e')
        const err = errors.find((e) => e.path === 'rules.mithril.delta_e')
        expect(err?.message).toMatch(/positive/)
    })
})
