/**
 * rulePackRegistry.test.ts — ERM Phase 1
 *
 * Tests for the static rule pack registry.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    RULE_PACK_REGISTRY,
    getPackById,
    getPacksByDomain,
    getPacksByJurisdiction,
    getActivePackIds,
} from '../rulePackRegistry.js'

// ---------------------------------------------------------------------------
// Registry structure
// ---------------------------------------------------------------------------

describe('RULE_PACK_REGISTRY', () => {
    it('contains exactly 10 packs', () => {
        expect(RULE_PACK_REGISTRY).toHaveLength(10)
    })

    it('has 2 active packs', () => {
        const active = RULE_PACK_REGISTRY.filter((p) => p.status === 'active')
        expect(active).toHaveLength(2)
    })

    it('has 3 available packs', () => {
        const available = RULE_PACK_REGISTRY.filter((p) => p.status === 'available')
        expect(available).toHaveLength(3)
    })

    it('has 5 coming-soon packs', () => {
        const comingSoon = RULE_PACK_REGISTRY.filter((p) => p.status === 'coming-soon')
        expect(comingSoon).toHaveLength(5)
    })

    it('every pack has required fields', () => {
        for (const pack of RULE_PACK_REGISTRY) {
            expect(pack.id, `${pack.id} missing id`).toBeTruthy()
            expect(pack.name, `${pack.id} missing name`).toBeTruthy()
            expect(pack.domain, `${pack.id} missing domain`).toBeTruthy()
            expect(pack.description, `${pack.id} missing description`).toBeTruthy()
            expect(typeof pack.ruleCount, `${pack.id} ruleCount not number`).toBe('number')
            expect(Array.isArray(pack.rules), `${pack.id} rules not array`).toBe(true)
            expect(Array.isArray(pack.jurisdictions), `${pack.id} jurisdictions not array`).toBe(true)
            expect(['active', 'available', 'coming-soon']).toContain(pack.status)
        }
    })

    it('ruleCount matches rules.length for all packs', () => {
        for (const pack of RULE_PACK_REGISTRY) {
            expect(pack.ruleCount, `${pack.id} ruleCount mismatch`).toBe(pack.rules.length)
        }
    })

    it('all rule IDs are unique across all packs', () => {
        const allIds: string[] = []
        for (const pack of RULE_PACK_REGISTRY) {
            for (const rule of pack.rules) {
                allIds.push(rule.id)
            }
        }
        const uniqueIds = new Set(allIds)
        expect(uniqueIds.size).toBe(allIds.length)
    })

    it('all pack IDs are unique', () => {
        const ids = RULE_PACK_REGISTRY.map((p) => p.id)
        const unique = new Set(ids)
        expect(unique.size).toBe(ids.length)
    })
})

// ---------------------------------------------------------------------------
// WCAG 2.1 AA pack
// ---------------------------------------------------------------------------

describe('wcag-2.1-aa pack', () => {
    const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'wcag-2.1-aa')!

    it('exists and is active', () => {
        expect(pack).toBeDefined()
        expect(pack.status).toBe('active')
    })

    it('has exactly 50 rules', () => {
        expect(pack.rules).toHaveLength(50)
        expect(pack.ruleCount).toBe(50)
    })

    it('covers the expected jurisdictions', () => {
        expect(pack.jurisdictions).toContain('US/ADA')
        expect(pack.jurisdictions).toContain('EU/EAA')
        expect(pack.jurisdictions).toContain('CA/AODA')
        expect(pack.jurisdictions).toContain('AU/DDA')
        expect(pack.jurisdictions).toContain('JP/JIS')
    })

    it('contains real rule IDs from the A11y linter', () => {
        const ids = pack.rules.map((r) => r.id)
        // names-labels
        expect(ids).toContain('A11Y-001')
        expect(ids).toContain('A11Y-002')
        expect(ids).toContain('A11Y-003')
        expect(ids).toContain('A11Y-014')
        expect(ids).toContain('A11Y-018')
        // keyboard
        expect(ids).toContain('A11Y-007')
        expect(ids).toContain('A11Y-020')
        expect(ids).toContain('A11Y-021')
        expect(ids).toContain('A11Y-022')
        // structure
        expect(ids).toContain('A11Y-008')
        expect(ids).toContain('A11Y-009')
        expect(ids).toContain('A11Y-017')
        // aria
        expect(ids).toContain('A11Y-030')
        expect(ids).toContain('A11Y-038')
        // landmarks
        expect(ids).toContain('A11Y-050')
        expect(ids).toContain('A11Y-053')
        // contrast
        expect(ids).toContain('A11Y-060')
        expect(ids).toContain('A11Y-062')
        // forms
        expect(ids).toContain('A11Y-070')
        expect(ids).toContain('A11Y-075')
        // live-regions
        expect(ids).toContain('A11Y-080')
        expect(ids).toContain('A11Y-083')
        // motion
        expect(ids).toContain('A11Y-090')
        expect(ids).toContain('A11Y-092')
    })

    it('every rule has required fields', () => {
        for (const rule of pack.rules) {
            expect(rule.id).toBeTruthy()
            expect(rule.name).toBeTruthy()
            expect(rule.description).toBeTruthy()
            expect(['coercive', 'normative', 'advisory', 'off']).toContain(rule.defaultMode)
            expect(typeof rule.autoFixable).toBe('boolean')
            expect(rule.category).toBeTruthy()
        }
    })

    it('has a preset', () => {
        expect(pack.preset).toBe('@flint/wcag-2.1-aa')
    })
})

// ---------------------------------------------------------------------------
// Mithril Design System pack
// ---------------------------------------------------------------------------

describe('mithril-design-system pack', () => {
    const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'mithril-design-system')!

    it('exists and is active', () => {
        expect(pack).toBeDefined()
        expect(pack.status).toBe('active')
    })

    it('has exactly 9 rules', () => {
        expect(pack.rules).toHaveLength(9)
        expect(pack.ruleCount).toBe(9)
    })

    it('contains real Mithril rule IDs', () => {
        const ids = pack.rules.map((r) => r.id)
        expect(ids).toContain('MITHRIL-COL')
        expect(ids).toContain('MITHRIL-IST-COL')
        expect(ids).toContain('MITHRIL-IST-TYP')
        expect(ids).toContain('MITHRIL-IST-SPC')
        expect(ids).toContain('MITHRIL-IST-SHD')
        expect(ids).toContain('MITHRIL-IST-OPC')
        expect(ids).toContain('MITHRIL-SPC-001')
        expect(ids).toContain('MITHRIL-SHD-001')
        expect(ids).toContain('MITHRIL-OPC-001')
    })

    it('domain is brand', () => {
        expect(pack.domain).toBe('brand')
    })
})

// ---------------------------------------------------------------------------
// Coming-soon packs have planned rule entries
// ---------------------------------------------------------------------------

describe('coming-soon packs', () => {
    it('wcag-2.2 has 8 planned rules', () => {
        const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'wcag-2.2')!
        expect(pack.rules).toHaveLength(8)
        expect(pack.ruleCount).toBe(8)
    })

    it('gdpr-consent has 12 planned rules', () => {
        const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'gdpr-consent')!
        expect(pack.rules).toHaveLength(12)
        expect(pack.ruleCount).toBe(12)
    })

    it('ccpa-privacy has 6 planned rules', () => {
        const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'ccpa-privacy')!
        expect(pack.rules).toHaveLength(6)
        expect(pack.ruleCount).toBe(6)
    })

    it('pci-dss-ui has 7 planned rules', () => {
        const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'pci-dss-ui')!
        expect(pack.rules).toHaveLength(7)
        expect(pack.ruleCount).toBe(7)
    })

    it('coga-cognitive has 8 planned rules', () => {
        const pack = RULE_PACK_REGISTRY.find((p) => p.id === 'coga-cognitive')!
        expect(pack.rules).toHaveLength(8)
        expect(pack.ruleCount).toBe(8)
    })

    it('coming-soon packs have descriptions for each rule', () => {
        const comingSoon = RULE_PACK_REGISTRY.filter((p) => p.status === 'coming-soon')
        for (const pack of comingSoon) {
            for (const rule of pack.rules) {
                expect(rule.description, `${pack.id}/${rule.id} missing description`).toBeTruthy()
            }
        }
    })
})

// ---------------------------------------------------------------------------
// getPackById
// ---------------------------------------------------------------------------

describe('getPackById', () => {
    it('returns the correct pack for a known id', () => {
        const pack = getPackById('wcag-2.1-aa')
        expect(pack).toBeDefined()
        expect(pack!.id).toBe('wcag-2.1-aa')
    })

    it('returns undefined for an unknown id', () => {
        expect(getPackById('does-not-exist')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
        expect(getPackById('')).toBeUndefined()
    })

    it('is case-sensitive', () => {
        expect(getPackById('WCAG-2.1-AA')).toBeUndefined()
    })
})

// ---------------------------------------------------------------------------
// getPacksByDomain
// ---------------------------------------------------------------------------

describe('getPacksByDomain', () => {
    it('returns accessibility packs', () => {
        const packs = getPacksByDomain('accessibility')
        expect(packs.length).toBeGreaterThanOrEqual(1)
        for (const p of packs) {
            expect(p.domain).toBe('accessibility')
        }
    })

    it('returns privacy packs', () => {
        const packs = getPacksByDomain('privacy')
        expect(packs.length).toBeGreaterThanOrEqual(1)
        for (const p of packs) {
            expect(p.domain).toBe('privacy')
        }
    })

    it('returns security packs', () => {
        const packs = getPacksByDomain('security')
        expect(packs.length).toBeGreaterThanOrEqual(1)
        for (const p of packs) {
            expect(p.domain).toBe('security')
        }
    })

    it('returns brand packs', () => {
        const packs = getPacksByDomain('brand')
        expect(packs.length).toBeGreaterThanOrEqual(1)
        for (const p of packs) {
            expect(p.domain).toBe('brand')
        }
    })

    it('returns cognitive packs', () => {
        const packs = getPacksByDomain('cognitive')
        expect(packs.length).toBeGreaterThanOrEqual(1)
    })

    it('returns empty array for unknown domain', () => {
        const packs = getPacksByDomain('unknown-domain')
        expect(packs).toHaveLength(0)
    })

    it('returns empty array for empty string', () => {
        expect(getPacksByDomain('')).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// getPacksByJurisdiction
// ---------------------------------------------------------------------------

describe('getPacksByJurisdiction', () => {
    it('returns packs for US/ADA', () => {
        const packs = getPacksByJurisdiction('US/ADA')
        expect(packs.length).toBeGreaterThanOrEqual(1)
        for (const p of packs) {
            expect(p.jurisdictions).toContain('US/ADA')
        }
    })

    it('returns packs for EU/GDPR', () => {
        const packs = getPacksByJurisdiction('EU/GDPR')
        expect(packs.length).toBeGreaterThanOrEqual(1)
    })

    it('returns packs for US/HIPAA', () => {
        const packs = getPacksByJurisdiction('US/HIPAA')
        expect(packs.length).toBeGreaterThanOrEqual(1)
    })

    it('returns empty array for unknown jurisdiction', () => {
        const packs = getPacksByJurisdiction('ZZ/UNKNOWN')
        expect(packs).toHaveLength(0)
    })

    it('returns empty array for empty string', () => {
        expect(getPacksByJurisdiction('')).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// getActivePackIds
// ---------------------------------------------------------------------------

describe('getActivePackIds', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-erm-test-'))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns default active packs when no config exists', () => {
        const ids = getActivePackIds(tmpDir)
        expect(ids).toContain('wcag-2.1-aa')
        expect(ids).toContain('mithril-design-system')
    })

    it('reads presets from flint.config.yaml block-sequence extends', () => {
        const configPath = path.join(tmpDir, 'flint.config.yaml')
        fs.writeFileSync(
            configPath,
            'extends:\n  - @flint/wcag-2.1-aa\n  - @flint/healthcare\n',
        )
        const ids = getActivePackIds(tmpDir)
        expect(ids).toContain('wcag-2.1-aa')
        expect(ids).toContain('hipaa-ui')
    })

    it('returns empty list when extends is empty in config', () => {
        const configPath = path.join(tmpDir, 'flint.config.yaml')
        fs.writeFileSync(configPath, 'extends: []\n')
        const ids = getActivePackIds(tmpDir)
        expect(ids).toHaveLength(0)
    })

    it('returns only matching packs for configured presets', () => {
        const configPath = path.join(tmpDir, 'flint.config.yaml')
        fs.writeFileSync(configPath, 'extends:\n  - @flint/mithril\n')
        const ids = getActivePackIds(tmpDir)
        expect(ids).toContain('mithril-design-system')
        expect(ids).not.toContain('wcag-2.1-aa')
    })
})
