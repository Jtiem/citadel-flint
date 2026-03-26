/**
 * Config Loader Tests — flint-mcp/src/core/__tests__/configLoader.test.ts
 *
 * Tests for the unified YAML config loader (UCFG.1).
 *
 * Test map:
 *   1  — loadYamlConfig returns null when no YAML file exists
 *   2  — loadYamlConfig parses minimal config (project only)
 *   3  — loadYamlConfig parses full config with all sections
 *   4  — loadYamlConfig rejects config missing 'project' field
 *   5  — loadYamlConfig handles malformed YAML gracefully
 *   6  — loadYamlConfig handles empty file gracefully
 *   7  — projectConfigToPolicy maps default RuleModes correctly
 *   8  — projectConfigToPolicy maps coercive → blocking
 *   9  — projectConfigToPolicy maps normative → normative (UCFG.3)
 *  10  — projectConfigToPolicy maps advisory → advisory
 *  11  — projectConfigToPolicy maps off → off
 *  12  — projectConfigToPolicy maps custom delta_e thresholds
 *  13  — projectConfigToPolicy maps accessibility settings
 *  14  — projectConfigToPolicy maps export_gate settings
 *  15  — projectConfigToPolicy maps baseline settings
 *  16  — projectConfigToPolicy maps domain field
 *  17  — projectConfigToPolicy uses defaults for missing sections
 *  18  — normalizeTrustTier maps legacy 'untrusted' → 'intern'
 *  19  — normalizeTrustTier maps legacy 'standard' → 'junior'
 *  20  — normalizeTrustTier maps legacy 'elevated' → 'senior'
 *  21  — normalizeTrustTier maps legacy 'admin' → 'principal'
 *  22  — normalizeTrustTier passes through new tier names unchanged
 *  23  — normalizeTrustTier returns 'junior' for unknown values
 *  24  — trustTierToLegacy maps all four tiers correctly
 *  25  — ruleModeToPolicy maps all modes
 *  26  — policyToRuleMode maps all modes
 *  27  — loadConfig prefers YAML over JSON
 *  28  — loadConfig falls back to JSON when no YAML exists
 *  29  — loadConfig returns defaults when neither exists
 *  30  — applyEnvironmentOverlay applies CI overlay
 *  31  — applyEnvironmentOverlay applies development overlay
 *  32  — applyEnvironmentOverlay no-ops when FLINT_ENV is unset
 *  33  — applyEnvironmentOverlay no-ops for unknown environment
 *  34  — loadProjectConfig returns resolved config with overlay
 *  35  — Full roundtrip: YAML → FlintPolicy → correct values
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import {
    DEFAULT_POLICY,
    projectConfigToPolicy,
    normalizeTrustTier,
    trustTierToLegacy,
    ruleModeToPolicy,
    policyToRuleMode,
} from '../config.js'
import type { FlintProjectConfig, TrustTier } from '../config.js'
import {
    loadYamlConfig,
    applyEnvironmentOverlay,
    loadConfig,
    loadProjectConfig,
    deepMergeConfigs,
    validateTightenOnly,
    resolveExtends,
} from '../config-loader.js'

// ── Fixtures ────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-config-test-'))
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.FLINT_ENV
})

function writeYaml(content: string): void {
    fs.writeFileSync(path.join(tmpDir, 'flint.config.yaml'), content, 'utf-8')
}

function writeLegacyPolicy(policy: object): void {
    const flintDir = path.join(tmpDir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    fs.writeFileSync(path.join(flintDir, 'policy.json'), JSON.stringify(policy), 'utf-8')
}

// ── YAML loading tests ─────────────────────────────────────────────────────

describe('loadYamlConfig', () => {
    it('1 — returns null when no YAML file exists', () => {
        expect(loadYamlConfig(tmpDir)).toBeNull()
    })

    it('2 — parses minimal config (project only)', () => {
        writeYaml('project: My Product')
        const config = loadYamlConfig(tmpDir)
        expect(config).not.toBeNull()
        expect(config!.project).toBe('My Product')
    })

    it('3 — parses full config with all sections', () => {
        writeYaml(`
schema_version: "1.0.0"
project: "Acme Dashboard"
domain: fintech
classification: confidential
labels:
  brand: acme
  tier: critical
tighten_only: true
tokens:
  source: .flint/design-tokens.json
  library: mui
rules:
  mithril:
    mode: coercive
    delta_e: 1.5
    delta_e_critical: 8.0
    ignore:
      - "**/node_modules/**"
      - "**/legacy/**"
  accessibility:
    level: AA
    mode: coercive
    disabled:
      - A11Y-042
  export_gate:
    block_on_overrides: true
  baseline:
    enabled: true
trust:
  default_tier: junior
  allow_demotion: true
  profiles:
    - id: claude-code
      name: Claude Code
      tier: principal
  escalation:
    - when: { red_count: ">= 3", window: session }
      then: require_review
scoring:
  weights:
    coercive: 0.9
    normative: 0.7
review:
  consensus: false
content:
  style_guide: microsoft
audit:
  retention: 365d
  export: [json, sarif]
environments:
  ci:
    rules:
      mithril: { mode: coercive }
  development:
    rules:
      mithril: { mode: advisory }
`)
        const config = loadYamlConfig(tmpDir)
        expect(config).not.toBeNull()
        expect(config!.project).toBe('Acme Dashboard')
        expect(config!.domain).toBe('fintech')
        expect(config!.classification).toBe('confidential')
        expect(config!.labels).toEqual({ brand: 'acme', tier: 'critical' })
        expect(config!.tighten_only).toBe(true)
        expect(config!.tokens?.library).toBe('mui')
        expect(config!.rules?.mithril?.mode).toBe('coercive')
        expect(config!.rules?.mithril?.delta_e).toBe(1.5)
        expect(config!.rules?.mithril?.delta_e_critical).toBe(8.0)
        expect(config!.rules?.mithril?.ignore).toEqual(['**/node_modules/**', '**/legacy/**'])
        expect(config!.rules?.accessibility?.disabled).toEqual(['A11Y-042'])
        expect(config!.rules?.baseline?.enabled).toBe(true)
        expect(config!.trust?.default_tier).toBe('junior')
        expect(config!.trust?.profiles).toHaveLength(1)
        expect(config!.trust?.profiles![0].tier).toBe('principal')
        expect(config!.trust?.escalation).toHaveLength(1)
        expect(config!.scoring?.weights?.coercive).toBe(0.9)
        expect(config!.content?.style_guide).toBe('microsoft')
        expect(config!.audit?.retention).toBe('365d')
        expect(config!.environments?.ci).toBeDefined()
        expect(config!.environments?.development).toBeDefined()
    })

    it('4 — rejects config missing project field', () => {
        writeYaml('domain: general')
        expect(loadYamlConfig(tmpDir)).toBeNull()
    })

    it('5 — handles malformed YAML gracefully', () => {
        writeYaml('project: [\ninvalid yaml {{{{')
        expect(loadYamlConfig(tmpDir)).toBeNull()
    })

    it('6 — handles empty file gracefully', () => {
        writeYaml('')
        expect(loadYamlConfig(tmpDir)).toBeNull()
    })
})

// ── projectConfigToPolicy mapping tests ────────────────────────────────────

describe('projectConfigToPolicy', () => {
    const minimal: FlintProjectConfig = { project: 'Test' }

    it('7 — maps default RuleModes correctly', () => {
        const policy = projectConfigToPolicy(minimal)
        expect(policy.mithril.mode).toBe('blocking')
        expect(policy.a11y.mode).toBe('blocking')
    })

    it('8 — maps coercive → blocking', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: { mithril: { mode: 'coercive' } },
        }
        expect(projectConfigToPolicy(config).mithril.mode).toBe('blocking')
    })

    it('9 — maps normative → normative (UCFG.3)', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: { mithril: { mode: 'normative' } },
        }
        expect(projectConfigToPolicy(config).mithril.mode).toBe('normative')
    })

    it('10 — maps advisory → advisory', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: { mithril: { mode: 'advisory' } },
        }
        expect(projectConfigToPolicy(config).mithril.mode).toBe('advisory')
    })

    it('11 — maps off → off', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: { mithril: { mode: 'off' } },
        }
        expect(projectConfigToPolicy(config).mithril.mode).toBe('off')
    })

    it('12 — maps custom delta_e thresholds', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: { mithril: { delta_e: 1.5, delta_e_critical: 8.0 } },
        }
        const policy = projectConfigToPolicy(config)
        expect(policy.mithril.deltaE_threshold).toBe(1.5)
        expect(policy.mithril.deltaE_critical_threshold).toBe(8.0)
    })

    it('13 — maps accessibility settings', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: {
                accessibility: {
                    level: 'AAA',
                    mode: 'advisory',
                    disabled: ['A11Y-001', 'A11Y-019'],
                },
            },
        }
        const policy = projectConfigToPolicy(config)
        expect(policy.a11y.level).toBe('AAA')
        expect(policy.a11y.mode).toBe('advisory')
        expect(policy.a11y.disabled_rules).toEqual(['A11Y-001', 'A11Y-019'])
    })

    it('14 — maps export_gate settings', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: {
                export_gate: {
                    block_on_mithril: false,
                    block_on_a11y: true,
                    block_on_overrides: false,
                },
            },
        }
        const policy = projectConfigToPolicy(config)
        expect(policy.export_gate.block_on_mithril).toBe(false)
        expect(policy.export_gate.block_on_a11y).toBe(true)
        expect(policy.export_gate.block_on_overrides).toBe(false)
    })

    it('15 — maps baseline settings', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            rules: { baseline: { enabled: true } },
        }
        expect(projectConfigToPolicy(config).baseline.enabled).toBe(true)
    })

    it('16 — maps domain field', () => {
        const config: FlintProjectConfig = {
            project: 'Test',
            domain: 'healthcare',
        }
        expect(projectConfigToPolicy(config).domain).toBe('healthcare')
    })

    it('17 — uses defaults for missing sections', () => {
        const policy = projectConfigToPolicy(minimal)
        expect(policy.version).toBe(1)
        expect(policy.mithril.deltaE_threshold).toBe(DEFAULT_POLICY.mithril.deltaE_threshold)
        expect(policy.mithril.deltaE_critical_threshold).toBe(
            DEFAULT_POLICY.mithril.deltaE_critical_threshold
        )
        expect(policy.a11y.level).toBe(DEFAULT_POLICY.a11y.level)
        expect(policy.export_gate.block_on_mithril).toBe(
            DEFAULT_POLICY.export_gate.block_on_mithril
        )
        expect(policy.baseline.enabled).toBe(DEFAULT_POLICY.baseline.enabled)
    })
})

// ── Trust tier mapping tests ───────────────────────────────────────────────

describe('normalizeTrustTier', () => {
    it('18 — maps legacy untrusted → intern', () => {
        expect(normalizeTrustTier('untrusted')).toBe('intern')
    })

    it('19 — maps legacy standard → junior', () => {
        expect(normalizeTrustTier('standard')).toBe('junior')
    })

    it('20 — maps legacy elevated → senior', () => {
        expect(normalizeTrustTier('elevated')).toBe('senior')
    })

    it('21 — maps legacy admin → principal', () => {
        expect(normalizeTrustTier('admin')).toBe('principal')
    })

    it('22 — passes through new tier names unchanged', () => {
        const tiers: TrustTier[] = ['intern', 'junior', 'senior', 'principal']
        for (const tier of tiers) {
            expect(normalizeTrustTier(tier)).toBe(tier)
        }
    })

    it('23 — returns junior for unknown values', () => {
        expect(normalizeTrustTier('superadmin')).toBe('junior')
        expect(normalizeTrustTier('')).toBe('junior')
    })
})

describe('trustTierToLegacy', () => {
    it('24 — maps all four tiers correctly', () => {
        expect(trustTierToLegacy('intern')).toBe('untrusted')
        expect(trustTierToLegacy('junior')).toBe('standard')
        expect(trustTierToLegacy('senior')).toBe('elevated')
        expect(trustTierToLegacy('principal')).toBe('admin')
    })
})

// ── Mode mapping tests ─────────────────────────────────────────────────────

describe('ruleModeToPolicy', () => {
    it('25 — maps all modes', () => {
        expect(ruleModeToPolicy('coercive')).toBe('blocking')
        expect(ruleModeToPolicy('normative')).toBe('normative')
        expect(ruleModeToPolicy('advisory')).toBe('advisory')
        expect(ruleModeToPolicy('off')).toBe('off')
    })
})

describe('policyToRuleMode', () => {
    it('26 — maps all modes', () => {
        expect(policyToRuleMode('blocking')).toBe('coercive')
        expect(policyToRuleMode('normative')).toBe('normative')
        expect(policyToRuleMode('advisory')).toBe('advisory')
        expect(policyToRuleMode('off')).toBe('off')
    })
})

// ── loadConfig integration tests ───────────────────────────────────────────

describe('loadConfig', () => {
    it('27 — prefers YAML over JSON', () => {
        // Write both YAML and JSON with different values
        writeYaml(`
project: YAML Project
rules:
  mithril:
    delta_e: 3.0
`)
        writeLegacyPolicy({
            version: 1,
            mithril: { deltaE_threshold: 5.0 },
        })

        const config = loadConfig(tmpDir)
        // YAML should win
        expect(config.policy.mithril.deltaE_threshold).toBe(3.0)
    })

    it('28 — falls back to JSON when no YAML exists', () => {
        writeLegacyPolicy({
            version: 1,
            mithril: {
                deltaE_threshold: 4.0,
                deltaE_critical_threshold: 12.0,
                mode: 'advisory',
                ignore_patterns: ['**/vendor/**'],
            },
        })

        const config = loadConfig(tmpDir)
        expect(config.policy.mithril.deltaE_threshold).toBe(4.0)
        expect(config.policy.mithril.deltaE_critical_threshold).toBe(12.0)
        expect(config.policy.mithril.mode).toBe('advisory')
    })

    it('29 — returns defaults when neither exists', () => {
        const config = loadConfig(tmpDir)
        expect(config.policy).toEqual(expect.objectContaining({
            version: 1,
            mithril: expect.objectContaining({
                deltaE_threshold: 2.0,
                mode: 'blocking',
            }),
        }))
    })
})

// ── Environment overlay tests ──────────────────────────────────────────────

describe('applyEnvironmentOverlay', () => {
    const baseConfig: FlintProjectConfig = {
        project: 'Test',
        rules: {
            mithril: { mode: 'coercive', delta_e: 2.0 },
            accessibility: { mode: 'coercive' },
        },
        trust: { default_tier: 'junior' },
        environments: {
            ci: {
                rules: {
                    mithril: { mode: 'coercive' },
                },
                trust: { default_tier: 'intern' },
            },
            development: {
                rules: {
                    mithril: { mode: 'advisory' },
                },
                trust: { default_tier: 'senior' },
            },
        },
    }

    it('30 — applies CI overlay', () => {
        process.env.FLINT_ENV = 'ci'
        const resolved = applyEnvironmentOverlay(baseConfig)
        expect(resolved.rules?.mithril?.mode).toBe('coercive')
        expect(resolved.trust?.default_tier).toBe('intern')
        expect(resolved.environments).toBeUndefined()
    })

    it('31 — applies development overlay', () => {
        process.env.FLINT_ENV = 'development'
        const resolved = applyEnvironmentOverlay(baseConfig)
        expect(resolved.rules?.mithril?.mode).toBe('advisory')
        expect(resolved.trust?.default_tier).toBe('senior')
    })

    it('32 — no-ops when FLINT_ENV is unset', () => {
        delete process.env.FLINT_ENV
        const resolved = applyEnvironmentOverlay(baseConfig)
        expect(resolved.rules?.mithril?.mode).toBe('coercive')
        expect(resolved.trust?.default_tier).toBe('junior')
    })

    it('33 — no-ops for unknown environment', () => {
        process.env.FLINT_ENV = 'production'
        const resolved = applyEnvironmentOverlay(baseConfig)
        expect(resolved.rules?.mithril?.mode).toBe('coercive')
    })
})

// ── loadProjectConfig tests ────────────────────────────────────────────────

describe('loadProjectConfig', () => {
    it('34 — returns resolved config with overlay', () => {
        writeYaml(`
project: Test App
domain: healthcare
trust:
  default_tier: junior
environments:
  ci:
    trust:
      default_tier: intern
`)
        process.env.FLINT_ENV = 'ci'
        const config = loadProjectConfig(tmpDir)
        expect(config).not.toBeNull()
        expect(config!.project).toBe('Test App')
        expect(config!.trust?.default_tier).toBe('intern')
    })
})

// ── Deep merge tests (UCFG.2) ──────────────────────────────────────────────

describe('deepMergeConfigs', () => {
    it('36 — merges scalar fields (override wins)', () => {
        const base: FlintProjectConfig = { project: 'Base', domain: 'general' }
        const override: Partial<FlintProjectConfig> = { domain: 'healthcare' }
        const merged = deepMergeConfigs(base, override)
        expect(merged.domain).toBe('healthcare')
        expect(merged.project).toBe('Base')
    })

    it('37 — merges nested rules per-subsection', () => {
        const base: FlintProjectConfig = {
            project: 'Base',
            rules: {
                mithril: { mode: 'coercive', delta_e: 2.0 },
                accessibility: { level: 'AA' },
            },
        }
        const override: Partial<FlintProjectConfig> = {
            rules: { mithril: { delta_e: 1.5 } },
        }
        const merged = deepMergeConfigs(base, override)
        expect(merged.rules?.mithril?.delta_e).toBe(1.5)
        expect(merged.rules?.mithril?.mode).toBe('coercive') // preserved from base
        expect(merged.rules?.accessibility?.level).toBe('AA') // preserved from base
    })

    it('38 — merges scoring weights', () => {
        const base: FlintProjectConfig = {
            project: 'Base',
            scoring: { weights: { coercive: 0.8, normative: 0.6 } },
        }
        const override: Partial<FlintProjectConfig> = {
            scoring: { weights: { coercive: 0.95 } },
        }
        const merged = deepMergeConfigs(base, override)
        expect(merged.scoring?.weights?.coercive).toBe(0.95)
        expect(merged.scoring?.weights?.normative).toBe(0.6)
    })

    it('39 — merges labels additively', () => {
        const base: FlintProjectConfig = {
            project: 'Base',
            labels: { brand: 'acme' },
        }
        const override: Partial<FlintProjectConfig> = {
            labels: { tier: 'critical' },
        }
        const merged = deepMergeConfigs(base, override)
        expect(merged.labels).toEqual({ brand: 'acme', tier: 'critical' })
    })

    it('40 — arrays are replaced not concatenated', () => {
        const base: FlintProjectConfig = {
            project: 'Base',
            rules: { mithril: { ignore: ['**/node_modules/**'] } },
        }
        const override: Partial<FlintProjectConfig> = {
            rules: { mithril: { ignore: ['**/vendor/**'] } },
        }
        const merged = deepMergeConfigs(base, override)
        expect(merged.rules?.mithril?.ignore).toEqual(['**/vendor/**'])
    })
})

// ── Tighten-only validation tests (UCFG.2) ─────────────────────────────────

describe('validateTightenOnly', () => {
    it('41 — allows tightening mode from advisory to coercive', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { mithril: { mode: 'advisory' } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { mithril: { mode: 'coercive' } },
        }
        expect(validateTightenOnly(parent, child)).toEqual([])
    })

    it('42 — blocks relaxing mode from coercive to advisory', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { mithril: { mode: 'coercive' } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { mithril: { mode: 'advisory' } },
        }
        const violations = validateTightenOnly(parent, child)
        expect(violations).toHaveLength(1)
        expect(violations[0]).toContain('cannot relax')
        expect(violations[0]).toContain('mithril')
    })

    it('43 — allows lowering delta_e (tighter)', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { mithril: { delta_e: 2.0 } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { mithril: { delta_e: 1.5 } },
        }
        expect(validateTightenOnly(parent, child)).toEqual([])
    })

    it('44 — blocks raising delta_e (looser)', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { mithril: { delta_e: 1.5 } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { mithril: { delta_e: 3.0 } },
        }
        const violations = validateTightenOnly(parent, child)
        expect(violations).toHaveLength(1)
        expect(violations[0]).toContain('delta_e')
    })

    it('45 — blocks relaxing export_gate from true to false', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { export_gate: { block_on_overrides: true } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { export_gate: { block_on_overrides: false } },
        }
        const violations = validateTightenOnly(parent, child)
        expect(violations).toHaveLength(1)
        expect(violations[0]).toContain('block_on_overrides')
    })

    it('46 — blocks adding to disabled rules list', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { accessibility: { disabled: ['A11Y-001'] } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { accessibility: { disabled: ['A11Y-001', 'A11Y-042'] } },
        }
        const violations = validateTightenOnly(parent, child)
        expect(violations).toHaveLength(1)
        expect(violations[0]).toContain('A11Y-042')
    })

    it('47 — allows removing from disabled rules list (stricter)', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { accessibility: { disabled: ['A11Y-001', 'A11Y-042'] } },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: { accessibility: { disabled: ['A11Y-001'] } },
        }
        expect(validateTightenOnly(parent, child)).toEqual([])
    })

    it('48 — reports multiple violations at once', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: {
                mithril: { mode: 'coercive', delta_e: 1.5 },
                export_gate: { block_on_overrides: true },
            },
        }
        const child: FlintProjectConfig = {
            project: 'Child',
            rules: {
                mithril: { mode: 'advisory', delta_e: 3.0 },
                export_gate: { block_on_overrides: false },
            },
        }
        const violations = validateTightenOnly(parent, child)
        expect(violations.length).toBeGreaterThanOrEqual(3)
    })

    it('49 — no violations when child has no rules', () => {
        const parent: FlintProjectConfig = {
            project: 'Parent',
            rules: { mithril: { mode: 'coercive', delta_e: 1.5 } },
        }
        const child: FlintProjectConfig = { project: 'Child' }
        expect(validateTightenOnly(parent, child)).toEqual([])
    })
})

// ── Extends resolution tests (UCFG.2) ──────────────────────────────────────

describe('resolveExtends', () => {
    it('50 — resolves local file extends', () => {
        // Create a parent config
        const parentPath = path.join(tmpDir, 'parent.yaml')
        fs.writeFileSync(
            parentPath,
            'project: Parent\nrules:\n  mithril:\n    delta_e: 1.5\n',
            'utf-8'
        )

        const config: FlintProjectConfig = {
            project: 'Child',
            extends: ['./parent.yaml'],
        }

        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.rules?.mithril?.delta_e).toBe(1.5) // inherited from parent
        expect(resolved.project).toBe('Child') // child wins for scalars
        expect(resolved.extends).toBeUndefined() // stripped after resolution
    })

    it('51 — resolves @flint/ preset extends', () => {
        const config: FlintProjectConfig = {
            project: 'My App',
            extends: ['@flint/healthcare'],
        }

        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.rules?.mithril?.delta_e).toBe(1.5) // healthcare preset
        expect(resolved.project).toBe('My App')
    })

    it('52 — child overrides parent values', () => {
        const parentPath = path.join(tmpDir, 'parent.yaml')
        fs.writeFileSync(
            parentPath,
            'project: Parent\nrules:\n  mithril:\n    delta_e: 1.5\n    delta_e_critical: 6.0\n',
            'utf-8'
        )

        const config: FlintProjectConfig = {
            project: 'Child',
            extends: ['./parent.yaml'],
            rules: { mithril: { delta_e: 1.0 } }, // tighter than parent
        }

        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.rules?.mithril?.delta_e).toBe(1.0) // child wins
        expect(resolved.rules?.mithril?.delta_e_critical).toBe(6.0) // inherited
    })

    it('53 — multiple extends merge in order (later wins)', () => {
        const first = path.join(tmpDir, 'first.yaml')
        const second = path.join(tmpDir, 'second.yaml')
        fs.writeFileSync(first, 'project: First\nrules:\n  mithril:\n    delta_e: 2.0\n', 'utf-8')
        fs.writeFileSync(
            second,
            'project: Second\nrules:\n  mithril:\n    delta_e: 1.5\n',
            'utf-8'
        )

        const config: FlintProjectConfig = {
            project: 'Child',
            extends: ['./first.yaml', './second.yaml'],
        }

        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.rules?.mithril?.delta_e).toBe(1.5) // second wins over first
    })

    it('54 — detects circular extends', () => {
        const a = path.join(tmpDir, 'a.yaml')
        const b = path.join(tmpDir, 'b.yaml')
        fs.writeFileSync(a, 'project: A\nextends:\n  - ./b.yaml\n', 'utf-8')
        fs.writeFileSync(b, 'project: B\nextends:\n  - ./a.yaml\n', 'utf-8')

        const config: FlintProjectConfig = {
            project: 'Root',
            extends: ['./a.yaml'],
        }

        // Should not infinite loop — circular ref is detected and skipped
        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.project).toBe('Root')
    })

    it('55 — skips unresolvable registry refs gracefully', () => {
        const config: FlintProjectConfig = {
            project: 'My App',
            extends: ['acme-corp/some-pack'],
        }

        // Should not throw — logs info and skips
        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.project).toBe('My App')
    })

    it('56 — warns on missing extends file', () => {
        const config: FlintProjectConfig = {
            project: 'My App',
            extends: ['./nonexistent.yaml'],
        }

        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.project).toBe('My App')
    })

    it('57 — tighten_only warns when child relaxes parent', () => {
        const parentPath = path.join(tmpDir, 'strict-parent.yaml')
        fs.writeFileSync(
            parentPath,
            'project: Strict\nrules:\n  mithril:\n    mode: coercive\n    delta_e: 1.0\n',
            'utf-8'
        )

        const config: FlintProjectConfig = {
            project: 'Relaxed Child',
            extends: ['./strict-parent.yaml'],
            tighten_only: true,
            rules: { mithril: { mode: 'advisory', delta_e: 3.0 } },
        }

        // Should still resolve (warnings are advisory, not blocking)
        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.project).toBe('Relaxed Child')
        // Values are still merged (tighten_only warns but doesn't block)
        expect(resolved.rules?.mithril?.mode).toBe('advisory')
    })

    it('58 — tighten_only: false allows relaxation', () => {
        const parentPath = path.join(tmpDir, 'parent2.yaml')
        fs.writeFileSync(
            parentPath,
            'project: Parent\nrules:\n  mithril:\n    mode: coercive\n',
            'utf-8'
        )

        const config: FlintProjectConfig = {
            project: 'Child',
            extends: ['./parent2.yaml'],
            tighten_only: false,
            rules: { mithril: { mode: 'advisory' } },
        }

        // No warning expected when tighten_only is false
        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.rules?.mithril?.mode).toBe('advisory')
    })

    it('59 — recursive extends (grandparent → parent → child)', () => {
        const grandparent = path.join(tmpDir, 'grandparent.yaml')
        const parent = path.join(tmpDir, 'parent3.yaml')
        fs.writeFileSync(
            grandparent,
            'project: Grandparent\ndomain: healthcare\nrules:\n  mithril:\n    delta_e: 1.0\n',
            'utf-8'
        )
        fs.writeFileSync(
            parent,
            'project: Parent\nextends:\n  - ./grandparent.yaml\nrules:\n  mithril:\n    delta_e_critical: 5.0\n',
            'utf-8'
        )

        const config: FlintProjectConfig = {
            project: 'Child',
            extends: ['./parent3.yaml'],
        }

        const resolved = resolveExtends(config, tmpDir)
        expect(resolved.domain).toBe('healthcare') // from grandparent
        expect(resolved.rules?.mithril?.delta_e).toBe(1.0) // from grandparent
        expect(resolved.rules?.mithril?.delta_e_critical).toBe(5.0) // from parent
        expect(resolved.project).toBe('Child')
    })
})

// ── Extends + loadConfig integration (UCFG.2) ─────────────────────────────

describe('loadConfig with extends', () => {
    it('60 — loadConfig resolves @flint/ preset and maps to FlintPolicy', () => {
        writeYaml(`
project: Healthcare App
extends:
  - "@flint/healthcare"
`)
        const config = loadConfig(tmpDir)
        // Healthcare preset has delta_e: 1.5
        expect(config.policy.mithril.deltaE_threshold).toBe(1.5)
        expect(config.policy.domain).toBe('healthcare')
    })

    it('61 — loadConfig resolves local extends and maps to FlintPolicy', () => {
        const parentPath = path.join(tmpDir, 'org-base.yaml')
        fs.writeFileSync(
            parentPath,
            'project: Org Base\nrules:\n  accessibility:\n    level: AAA\n',
            'utf-8'
        )
        writeYaml(`
project: Team App
extends:
  - "./org-base.yaml"
rules:
  mithril:
    delta_e: 1.8
`)
        const config = loadConfig(tmpDir)
        expect(config.policy.a11y.level).toBe('AAA') // from parent
        expect(config.policy.mithril.deltaE_threshold).toBe(1.8) // from project
    })
})

// ── Full roundtrip test ────────────────────────────────────────────────────

describe('Full roundtrip', () => {
    it('35 — YAML → FlintPolicy → correct values', () => {
        writeYaml(`
project: Roundtrip Test
domain: fintech
rules:
  mithril:
    mode: coercive
    delta_e: 1.8
    delta_e_critical: 9.0
    ignore:
      - "**/vendor/**"
  accessibility:
    level: AAA
    mode: advisory
    disabled:
      - A11Y-042
  export_gate:
    block_on_mithril: true
    block_on_a11y: false
    block_on_overrides: true
  baseline:
    enabled: true
`)
        const config = loadConfig(tmpDir)

        expect(config.projectRoot).toBe(tmpDir)
        expect(config.policy.version).toBe(1)
        expect(config.policy.domain).toBe('fintech')

        // Mithril
        expect(config.policy.mithril.mode).toBe('blocking') // coercive → blocking
        expect(config.policy.mithril.deltaE_threshold).toBe(1.8)
        expect(config.policy.mithril.deltaE_critical_threshold).toBe(9.0)
        expect(config.policy.mithril.ignore_patterns).toEqual(['**/vendor/**'])

        // A11y
        expect(config.policy.a11y.level).toBe('AAA')
        expect(config.policy.a11y.mode).toBe('advisory')
        expect(config.policy.a11y.disabled_rules).toEqual(['A11Y-042'])

        // Export gate
        expect(config.policy.export_gate.block_on_mithril).toBe(true)
        expect(config.policy.export_gate.block_on_a11y).toBe(false)
        expect(config.policy.export_gate.block_on_overrides).toBe(true)

        // Baseline
        expect(config.policy.baseline.enabled).toBe(true)
    })
})
