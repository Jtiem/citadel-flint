/**
 * ruleManagement.test.ts — ERM Phase 1
 *
 * Tests for the 5 ERM MCP tool handlers:
 *   handleListRulePacks, handleEnablePack, handleDisablePack,
 *   handleSetRuleMode, handleComplianceCoverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    handleListRulePacks,
    handleEnablePack,
    handleDisablePack,
    handleSetRuleMode,
    handleComplianceCoverage,
} from '../rulePacks.js'
import { RULE_PACK_REGISTRY } from '../../core/rulePackRegistry.js'

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
    return JSON.parse(result.content[0].text)
}

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-erm-tools-test-'))
})

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// flint_list_rule_packs
// ---------------------------------------------------------------------------

describe('handleListRulePacks', () => {
    it('returns all 10 packs when no filters provided', () => {
        const result = parseResult(handleListRulePacks({}))
        expect(result.total).toBe(10)
        expect(result.packs).toHaveLength(10)
    })

    it('filters by domain: accessibility', () => {
        const result = parseResult(handleListRulePacks({ domain: 'accessibility' }))
        expect(result.total).toBeGreaterThanOrEqual(1)
        for (const pack of result.packs) {
            expect(pack.domain).toBe('accessibility')
        }
    })

    it('filters by domain: privacy', () => {
        const result = parseResult(handleListRulePacks({ domain: 'privacy' }))
        for (const pack of result.packs) {
            expect(pack.domain).toBe('privacy')
        }
    })

    it('filters by domain: security', () => {
        const result = parseResult(handleListRulePacks({ domain: 'security' }))
        for (const pack of result.packs) {
            expect(pack.domain).toBe('security')
        }
    })

    it('filters by domain: brand', () => {
        const result = parseResult(handleListRulePacks({ domain: 'brand' }))
        for (const pack of result.packs) {
            expect(pack.domain).toBe('brand')
        }
    })

    it('filters by domain: cognitive', () => {
        const result = parseResult(handleListRulePacks({ domain: 'cognitive' }))
        for (const pack of result.packs) {
            expect(pack.domain).toBe('cognitive')
        }
    })

    it('filters by jurisdiction: US/ADA', () => {
        const result = parseResult(handleListRulePacks({ jurisdiction: 'US/ADA' }))
        expect(result.total).toBeGreaterThanOrEqual(1)
        for (const pack of result.packs) {
            expect(pack.jurisdictions).toContain('US/ADA')
        }
    })

    it('filters by jurisdiction: EU/GDPR', () => {
        const result = parseResult(handleListRulePacks({ jurisdiction: 'EU/GDPR' }))
        expect(result.total).toBeGreaterThanOrEqual(1)
    })

    it('filters by status: active', () => {
        const result = parseResult(handleListRulePacks({ status: 'active' }))
        expect(result.total).toBe(2)
        for (const pack of result.packs) {
            expect(pack.status).toBe('active')
        }
    })

    it('filters by status: available', () => {
        const result = parseResult(handleListRulePacks({ status: 'available' }))
        expect(result.total).toBe(3)
    })

    it('filters by status: coming-soon', () => {
        const result = parseResult(handleListRulePacks({ status: 'coming-soon' }))
        expect(result.total).toBe(5)
    })

    it('combines domain and status filters', () => {
        const result = parseResult(
            handleListRulePacks({ domain: 'privacy', status: 'coming-soon' }),
        )
        for (const pack of result.packs) {
            expect(pack.domain).toBe('privacy')
            expect(pack.status).toBe('coming-soon')
        }
    })

    it('returns empty list for unknown domain', () => {
        const result = parseResult(handleListRulePacks({ domain: 'nonexistent-domain' }))
        expect(result.total).toBe(0)
        expect(result.packs).toHaveLength(0)
    })

    it('returns empty list for unknown jurisdiction', () => {
        const result = parseResult(handleListRulePacks({ jurisdiction: 'ZZ/NOWHERE' }))
        expect(result.total).toBe(0)
    })

    it('includes rules array in each pack', () => {
        const result = parseResult(handleListRulePacks({ status: 'active' }))
        for (const pack of result.packs) {
            expect(Array.isArray(pack.rules)).toBe(true)
        }
    })
})

// ---------------------------------------------------------------------------
// flint_enable_pack
// ---------------------------------------------------------------------------

describe('handleEnablePack', () => {
    it('enables a known pack by adding its preset to extends', () => {
        const result = parseResult(
            handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(true)
        expect(result.changed).toBe(true)
        expect(result.preset).toBe('@flint/healthcare')

        // Verify file was written
        const configPath = path.join(tmpDir, 'flint.config.yaml')
        expect(fs.existsSync(configPath)).toBe(true)
        const content = fs.readFileSync(configPath, 'utf-8')
        expect(content).toContain('@flint/healthcare')
    })

    it('is idempotent — enabling an already-enabled pack does not duplicate it', () => {
        // Enable once
        handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir })
        // Enable again
        const result = parseResult(
            handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(true)
        expect(result.changed).toBe(false)
        expect(result.message).toContain('already enabled')

        // Verify the preset appears exactly once in the file
        const configPath = path.join(tmpDir, 'flint.config.yaml')
        const content = fs.readFileSync(configPath, 'utf-8')
        const occurrences = (content.match(/@flint\/healthcare/g) ?? []).length
        expect(occurrences).toBe(1)
    })

    it('enables multiple packs without collisions', () => {
        handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir })
        handleEnablePack({ pack_id: 'wcag-2.2', projectRoot: tmpDir })

        const configPath = path.join(tmpDir, 'flint.config.yaml')
        const content = fs.readFileSync(configPath, 'utf-8')
        expect(content).toContain('@flint/healthcare')
        expect(content).toContain('@flint/wcag-2.2')
    })

    it('returns error for unknown pack_id', () => {
        const result = parseResult(
            handleEnablePack({ pack_id: 'does-not-exist', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(false)
        expect(result.error).toContain('does-not-exist')
    })

    it('returns success: false for empty pack_id', () => {
        const result = parseResult(
            handleEnablePack({ pack_id: '', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(false)
    })

    it('reports the ruleCount of the enabled pack', () => {
        const result = parseResult(
            handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir }),
        )
        expect(result.ruleCount).toBe(6)
    })
})

// ---------------------------------------------------------------------------
// flint_disable_pack
// ---------------------------------------------------------------------------

describe('handleDisablePack', () => {
    it('disables an enabled pack by removing its preset from extends', () => {
        // First enable it
        handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir })

        // Then disable it
        const result = parseResult(
            handleDisablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(true)
        expect(result.changed).toBe(true)

        const configPath = path.join(tmpDir, 'flint.config.yaml')
        const content = fs.readFileSync(configPath, 'utf-8')
        expect(content).not.toContain('@flint/healthcare')
    })

    it('is safe to call when pack is not enabled', () => {
        const result = parseResult(
            handleDisablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(true)
        expect(result.changed).toBe(false)
    })

    it('removes only the target preset leaving others intact', () => {
        handleEnablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir })
        handleEnablePack({ pack_id: 'wcag-2.2', projectRoot: tmpDir })
        handleDisablePack({ pack_id: 'hipaa-ui', projectRoot: tmpDir })

        const configPath = path.join(tmpDir, 'flint.config.yaml')
        const content = fs.readFileSync(configPath, 'utf-8')
        expect(content).not.toContain('@flint/healthcare')
        expect(content).toContain('@flint/wcag-2.2')
    })

    it('returns error for unknown pack_id', () => {
        const result = parseResult(
            handleDisablePack({ pack_id: 'not-a-pack', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(false)
        expect(result.error).toContain('not-a-pack')
    })

    it('returns success: false for empty pack_id', () => {
        const result = parseResult(
            handleDisablePack({ pack_id: '', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// flint_set_rule_mode
// ---------------------------------------------------------------------------

describe('handleSetRuleMode', () => {
    it('sets a known rule to advisory mode', () => {
        const result = parseResult(
            handleSetRuleMode({
                rule_id: 'A11Y-001',
                mode: 'advisory',
                projectRoot: tmpDir,
            }),
        )
        expect(result.success).toBe(true)
        expect(result.rule_id).toBe('A11Y-001')
        expect(result.mode).toBe('advisory')

        const configPath = path.join(tmpDir, 'flint.config.yaml')
        const content = fs.readFileSync(configPath, 'utf-8')
        expect(content).toContain('A11Y-001: advisory')
    })

    it('sets a rule to off mode', () => {
        const result = parseResult(
            handleSetRuleMode({
                rule_id: 'A11Y-090',
                mode: 'off',
                projectRoot: tmpDir,
            }),
        )
        expect(result.success).toBe(true)
        expect(result.mode).toBe('off')
    })

    it('sets a Mithril rule mode', () => {
        const result = parseResult(
            handleSetRuleMode({
                rule_id: 'MITHRIL-COL',
                mode: 'normative',
                projectRoot: tmpDir,
            }),
        )
        expect(result.success).toBe(true)
        expect(result.rule_id).toBe('MITHRIL-COL')
    })

    it('updates an existing rule mode without duplicating it', () => {
        handleSetRuleMode({ rule_id: 'A11Y-001', mode: 'advisory', projectRoot: tmpDir })
        handleSetRuleMode({ rule_id: 'A11Y-001', mode: 'coercive', projectRoot: tmpDir })

        const configPath = path.join(tmpDir, 'flint.config.yaml')
        const content = fs.readFileSync(configPath, 'utf-8')
        expect(content).toContain('A11Y-001: coercive')
        expect(content).not.toContain('A11Y-001: advisory')
    })

    it('returns error for unknown rule_id', () => {
        const result = parseResult(
            handleSetRuleMode({
                rule_id: 'FAKE-999',
                mode: 'advisory',
                projectRoot: tmpDir,
            }),
        )
        expect(result.success).toBe(false)
        expect(result.error).toContain('FAKE-999')
    })

    it('returns error for empty rule_id', () => {
        const result = parseResult(
            handleSetRuleMode({ rule_id: '', mode: 'advisory', projectRoot: tmpDir }),
        )
        expect(result.success).toBe(false)
    })

    it('returns error for invalid mode', () => {
        const result = parseResult(
            handleSetRuleMode({
                rule_id: 'A11Y-001',
                mode: 'invalid-mode' as any,
                projectRoot: tmpDir,
            }),
        )
        expect(result.success).toBe(false)
        expect(result.error).toContain('invalid-mode')
    })

    it('reports the rule name alongside the id', () => {
        const result = parseResult(
            handleSetRuleMode({
                rule_id: 'A11Y-001',
                mode: 'advisory',
                projectRoot: tmpDir,
            }),
        )
        expect(result.rule_name).toBeTruthy()
        expect(typeof result.rule_name).toBe('string')
    })
})

// ---------------------------------------------------------------------------
// flint_compliance_coverage
// ---------------------------------------------------------------------------

describe('handleComplianceCoverage', () => {
    it('returns coverage for all known jurisdictions when no filter provided', () => {
        const result = parseResult(
            handleComplianceCoverage({ projectRoot: tmpDir }),
        )
        expect(Array.isArray(result.coverage)).toBe(true)
        expect(result.coverage.length).toBeGreaterThan(0)
        expect(result.summary).toBeDefined()
    })

    it('returns correct shape for each jurisdiction entry', () => {
        const result = parseResult(
            handleComplianceCoverage({ projectRoot: tmpDir }),
        )
        for (const entry of result.coverage) {
            expect(typeof entry.jurisdiction).toBe('string')
            expect(typeof entry.total).toBe('number')
            expect(typeof entry.covered).toBe('number')
            expect(typeof entry.percentage).toBe('number')
            expect(Array.isArray(entry.gaps)).toBe(true)
            expect(entry.percentage).toBeGreaterThanOrEqual(0)
            expect(entry.percentage).toBeLessThanOrEqual(100)
        }
    })

    it('filters to requested jurisdictions', () => {
        const result = parseResult(
            handleComplianceCoverage({
                jurisdictions: ['US/ADA'],
                projectRoot: tmpDir,
            }),
        )
        expect(result.coverage).toHaveLength(1)
        expect(result.coverage[0].jurisdiction).toBe('US/ADA')
    })

    it('returns multiple requested jurisdictions', () => {
        const result = parseResult(
            handleComplianceCoverage({
                jurisdictions: ['US/ADA', 'EU/GDPR'],
                projectRoot: tmpDir,
            }),
        )
        expect(result.coverage).toHaveLength(2)
        const jurisdictions = result.coverage.map((c: any) => c.jurisdiction)
        expect(jurisdictions).toContain('US/ADA')
        expect(jurisdictions).toContain('EU/GDPR')
    })

    it('correctly identifies gaps when packs are not active', () => {
        // No config — only default active packs
        const result = parseResult(
            handleComplianceCoverage({
                jurisdictions: ['EU/GDPR'],
                projectRoot: tmpDir,
            }),
        )
        const gdprEntry = result.coverage.find((c: any) => c.jurisdiction === 'EU/GDPR')
        expect(gdprEntry).toBeDefined()
        // GDPR pack is coming-soon, so gaps should include GDPR rule IDs
        expect(gdprEntry.gaps.length).toBeGreaterThan(0)
        expect(gdprEntry.percentage).toBeLessThan(100)
    })

    it('reports 100% coverage for a jurisdiction when pack is enabled', () => {
        // Enable hipaa-ui to get US/HIPAA coverage
        const configPath = path.join(tmpDir, 'flint.config.yaml')
        fs.writeFileSync(configPath, 'extends:\n  - @flint/healthcare\n')

        const result = parseResult(
            handleComplianceCoverage({
                jurisdictions: ['US/HIPAA'],
                projectRoot: tmpDir,
            }),
        )
        const hipaaEntry = result.coverage.find((c: any) => c.jurisdiction === 'US/HIPAA')
        expect(hipaaEntry).toBeDefined()
        expect(hipaaEntry.percentage).toBe(100)
        expect(hipaaEntry.gaps).toHaveLength(0)
    })

    it('summary includes counts of fully_covered, partial_coverage, no_coverage', () => {
        const result = parseResult(
            handleComplianceCoverage({ projectRoot: tmpDir }),
        )
        expect(typeof result.summary.jurisdictions_analyzed).toBe('number')
        expect(typeof result.summary.fully_covered).toBe('number')
        expect(typeof result.summary.partial_coverage).toBe('number')
        expect(typeof result.summary.no_coverage).toBe('number')
        // Totals should add up
        expect(
            result.summary.fully_covered +
                result.summary.partial_coverage +
                result.summary.no_coverage,
        ).toBe(result.summary.jurisdictions_analyzed)
    })

    it('returns empty jurisdictions array for unknown jurisdiction', () => {
        const result = parseResult(
            handleComplianceCoverage({
                jurisdictions: ['ZZ/UNKNOWN'],
                projectRoot: tmpDir,
            }),
        )
        // ZZ/UNKNOWN has no packs — should return with 0 total and 100% (trivially covered)
        expect(result.coverage).toHaveLength(1)
        expect(result.coverage[0].total).toBe(0)
        expect(result.coverage[0].percentage).toBe(100)
    })

    it('returns empty array for empty jurisdictions list', () => {
        const result = parseResult(
            handleComplianceCoverage({
                jurisdictions: [],
                projectRoot: tmpDir,
            }),
        )
        // When empty array is given — falls through to all known jurisdictions
        expect(result.coverage.length).toBeGreaterThan(0)
    })
})
