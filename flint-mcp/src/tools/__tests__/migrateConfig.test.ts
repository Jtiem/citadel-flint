/**
 * Migrate Config Tests — flint-mcp/src/tools/__tests__/migrateConfig.test.ts
 *
 * Tests for the flint_migrate_config MCP tool (UCFG.4).
 *
 * Test map:
 *   1  — builds config from policy.json only
 *   2  — maps policy modes to RuleMode names
 *   3  — includes agent profiles from agent-policy.json
 *   4  — maps legacy trust tiers to new names
 *   5  — includes escalation rules from escalation-rules.json
 *   6  — handles missing legacy files gracefully
 *   7  — handleMigrateConfig dry_run returns YAML preview
 *   8  — handleMigrateConfig writes file and backs up legacy
 *   9  — handleMigrateConfig skips if flint.config.yaml exists
 *  10  — handleMigrateConfig skips if no legacy files
 *  11  — cleans undefined values from output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { buildProjectConfigFromLegacy, handleMigrateConfig } from '../migrateConfig.js'
import type { FlintConfig } from '../../core/config.js'
import { DEFAULT_POLICY } from '../../core/config.js'

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-migrate-test-'))
    fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writePolicy(policy: object): void {
    fs.writeFileSync(
        path.join(tmpDir, '.flint', 'policy.json'),
        JSON.stringify(policy),
        'utf-8'
    )
}

function writeAgentPolicy(policy: object): void {
    fs.writeFileSync(
        path.join(tmpDir, '.flint', 'agent-policy.json'),
        JSON.stringify(policy),
        'utf-8'
    )
}

function writeEscalation(rules: object): void {
    fs.writeFileSync(
        path.join(tmpDir, '.flint', 'escalation-rules.json'),
        JSON.stringify(rules),
        'utf-8'
    )
}

function makeConfig(): FlintConfig {
    return { projectRoot: tmpDir, domains: ['ui'], policy: { ...DEFAULT_POLICY } }
}

describe('buildProjectConfigFromLegacy', () => {
    it('1 — builds config from policy.json only', () => {
        writePolicy({
            version: 1,
            mithril: {
                deltaE_threshold: 1.5,
                deltaE_critical_threshold: 8.0,
                mode: 'blocking',
                ignore_patterns: ['**/vendor/**'],
            },
            a11y: { level: 'AAA', mode: 'advisory', disabled_rules: ['A11Y-042'] },
            export_gate: { block_on_mithril: true, block_on_a11y: false, block_on_overrides: true },
            baseline: { enabled: true },
            domain: 'healthcare',
        })

        const config = buildProjectConfigFromLegacy(tmpDir, 'Test App')
        expect(config.project).toBe('Test App')
        expect(config.domain).toBe('healthcare')
        expect(config.rules?.mithril?.delta_e).toBe(1.5)
        expect(config.rules?.mithril?.delta_e_critical).toBe(8.0)
        expect(config.rules?.accessibility?.level).toBe('AAA')
        expect(config.rules?.accessibility?.disabled).toEqual(['A11Y-042'])
        expect(config.rules?.export_gate?.block_on_a11y).toBe(false)
        expect(config.rules?.baseline?.enabled).toBe(true)
    })

    it('2 — maps policy modes to RuleMode names', () => {
        writePolicy({
            version: 1,
            mithril: { mode: 'blocking' },
            a11y: { mode: 'advisory' },
        })

        const config = buildProjectConfigFromLegacy(tmpDir, 'Test')
        expect(config.rules?.mithril?.mode).toBe('coercive')
        expect(config.rules?.accessibility?.mode).toBe('advisory')
    })

    it('3 — includes agent profiles from agent-policy.json', () => {
        writePolicy({ version: 1 })
        writeAgentPolicy({
            version: 1,
            defaultTier: 'elevated',
            agents: [
                {
                    agentId: 'claude-code',
                    displayName: 'Claude Code',
                    tier: 'admin',
                    maxMutationsPerSession: 500,
                    requireManualReview: false,
                },
            ],
        })

        const config = buildProjectConfigFromLegacy(tmpDir, 'Test')
        expect(config.trust?.default_tier).toBe('senior')
        expect(config.trust?.profiles).toHaveLength(1)
        expect(config.trust?.profiles![0].id).toBe('claude-code')
        expect(config.trust?.profiles![0].tier).toBe('principal')
    })

    it('4 — maps legacy trust tiers to new names', () => {
        writePolicy({ version: 1 })
        writeAgentPolicy({
            version: 1,
            defaultTier: 'untrusted',
            agents: [
                { agentId: 'a', tier: 'untrusted' },
                { agentId: 'b', tier: 'standard' },
                { agentId: 'c', tier: 'elevated' },
                { agentId: 'd', tier: 'admin' },
            ],
        })

        const config = buildProjectConfigFromLegacy(tmpDir, 'Test')
        expect(config.trust?.default_tier).toBe('intern')
        expect(config.trust?.profiles![0].tier).toBe('intern')
        expect(config.trust?.profiles![1].tier).toBe('junior')
        expect(config.trust?.profiles![2].tier).toBe('senior')
        expect(config.trust?.profiles![3].tier).toBe('principal')
    })

    it('5 — includes escalation rules', () => {
        writePolicy({ version: 1 })
        writeEscalation({
            version: 1,
            rules: [
                {
                    ruleId: 'RULE-001',
                    trigger: { type: 'red_count', threshold: 3, window: 'session' },
                    action: { type: 'require_review' },
                },
            ],
        })

        const config = buildProjectConfigFromLegacy(tmpDir, 'Test')
        expect(config.trust?.escalation).toHaveLength(1)
        expect(config.trust?.escalation![0].then).toBe('require_review')
    })

    it('6 — handles missing legacy files gracefully', () => {
        // No files written — .flint/ exists but is empty
        const config = buildProjectConfigFromLegacy(tmpDir, 'Empty Project')
        expect(config.project).toBe('Empty Project')
        expect(config.rules).toBeUndefined()
        expect(config.trust).toBeUndefined()
    })
})

describe('handleMigrateConfig', () => {
    it('7 — dry_run returns YAML preview', () => {
        writePolicy({
            version: 1,
            mithril: { deltaE_threshold: 1.8, mode: 'blocking' },
            domain: 'fintech',
        })

        const result = handleMigrateConfig(
            { dry_run: true, project_name: 'Fintech App' },
            makeConfig()
        )
        const text = result.content[0].text
        expect(text).toContain('Migration Preview')
        expect(text).toContain('fintech')
        expect(text).toContain('1.8')
        // File should NOT be written
        expect(fs.existsSync(path.join(tmpDir, 'flint.config.yaml'))).toBe(false)
    })

    it('8 — writes file and backs up legacy', () => {
        writePolicy({ version: 1, mithril: { mode: 'advisory' } })

        const result = handleMigrateConfig(
            { dry_run: false, backup: true, project_name: 'My App' },
            makeConfig()
        )
        const text = result.content[0].text
        expect(text).toContain('Migration Complete')

        // YAML file should exist
        expect(fs.existsSync(path.join(tmpDir, 'flint.config.yaml'))).toBe(true)
        // Legacy file should be backed up
        expect(fs.existsSync(path.join(tmpDir, '.flint', 'policy.json.bak'))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, '.flint', 'policy.json'))).toBe(false)
    })

    it('9 — skips if flint.config.yaml already exists', () => {
        writePolicy({ version: 1 })
        fs.writeFileSync(path.join(tmpDir, 'flint.config.yaml'), 'project: Existing', 'utf-8')

        const result = handleMigrateConfig({ dry_run: false }, makeConfig())
        expect(result.content[0].text).toContain('Migration Skipped')
        expect(result.content[0].text).toContain('already exists')
    })

    it('10 — skips if no legacy files exist', () => {
        // .flint/ exists but no config files
        const result = handleMigrateConfig({ dry_run: false }, makeConfig())
        expect(result.content[0].text).toContain('Migration Skipped')
        expect(result.content[0].text).toContain('No legacy config files')
    })

    it('11 — cleans undefined values from output', () => {
        writePolicy({ version: 1, mithril: { mode: 'blocking' } })

        const result = handleMigrateConfig(
            { dry_run: true, project_name: 'Clean Test' },
            makeConfig()
        )
        const text = result.content[0].text
        // Should not contain "undefined" or "null" as YAML values
        expect(text).not.toContain(': undefined')
        expect(text).not.toContain(': null')
    })
})
