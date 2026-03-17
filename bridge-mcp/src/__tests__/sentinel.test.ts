/**
 * sentinel.test.ts — Phase ACX.1
 *
 * Tests for getBridgeSentinelContent() and BRIDGE_SENTINEL_PROMPT_DEF.
 * Covers:
 *   - Each domain returns non-empty prompt with expected compliance keywords
 *   - Default (no argument) returns general preset
 *   - Unknown domain falls back to general
 *   - Policy.json domain resolution
 *   - Prompt structure (BASE_BLOCK always present)
 *   - HALT criteria present in each non-general domain
 *   - BRIDGE_SENTINEL_PROMPT_DEF shape
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getBridgeSentinelContent, BRIDGE_SENTINEL_PROMPT_DEF } from '../../src/prompts/sentinel.js'

// ── Test helpers ─────────────────────────────────────────────────────────────

function createTempProject(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-sentinel-test-'))
    const bridgeDir = path.join(tmpDir, '.bridge')
    fs.mkdirSync(bridgeDir, { recursive: true })
    return tmpDir
}

function writePolicyJson(projectRoot: string, domain: string): void {
    const policyPath = path.join(projectRoot, '.bridge', 'policy.json')
    fs.writeFileSync(policyPath, JSON.stringify({ version: 1, domain }), 'utf-8')
}

function cleanup(projectRoot: string): void {
    try {
        fs.rmSync(projectRoot, { recursive: true, force: true })
    } catch {
        // Ignore cleanup errors
    }
}

// ── BRIDGE_SENTINEL_PROMPT_DEF ───────────────────────────────────────────────

describe('BRIDGE_SENTINEL_PROMPT_DEF', () => {
    it('has the correct name', () => {
        expect(BRIDGE_SENTINEL_PROMPT_DEF.name).toBe('bridge-sentinel')
    })

    it('has a non-empty description', () => {
        expect(BRIDGE_SENTINEL_PROMPT_DEF.description.length).toBeGreaterThan(0)
    })

    it('has exactly one argument: domain', () => {
        expect(BRIDGE_SENTINEL_PROMPT_DEF.arguments).toHaveLength(1)
        expect(BRIDGE_SENTINEL_PROMPT_DEF.arguments[0].name).toBe('domain')
    })

    it('domain argument is not required', () => {
        expect(BRIDGE_SENTINEL_PROMPT_DEF.arguments[0].required).toBe(false)
    })

    it('domain argument description mentions all 6 domains', () => {
        const desc = BRIDGE_SENTINEL_PROMPT_DEF.arguments[0].description
        expect(desc).toContain('general')
        expect(desc).toContain('healthcare')
        expect(desc).toContain('fintech')
        expect(desc).toContain('e-commerce')
        expect(desc).toContain('government')
        expect(desc).toContain('enterprise-saas')
    })
})

// ── getBridgeSentinelContent: base structure ─────────────────────────────────

describe('getBridgeSentinelContent - base structure', () => {
    it('returns a non-empty string for all supported domains', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            const content = getBridgeSentinelContent(domain)
            expect(typeof content).toBe('string')
            expect(content.length).toBeGreaterThan(200)
        }
    })

    it('always includes the BASE_BLOCK enforcement rules', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            const content = getBridgeSentinelContent(domain)
            expect(content).toContain('Bridge Governance Sentinel')
            expect(content).toContain('bridge_get_context')
            expect(content).toContain('bridge_audit')
            expect(content).toContain('bridge_ast_mutate is the ONLY approved way')
        }
    })

    it('always includes the Mithril threshold enforcement block', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            const content = getBridgeSentinelContent(domain)
            expect(content).toContain('MITHRIL THRESHOLD ENFORCEMENT')
            expect(content).toContain('ΔE > 2.0')
            expect(content).toContain('ΔE > 10.0')
        }
    })

    it('always includes the workflow integration footer', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            const content = getBridgeSentinelContent(domain)
            expect(content).toContain('WORKFLOW INTEGRATION')
            expect(content).toContain('bridge-intent-composer')
        }
    })
})

// ── Domain: general ───────────────────────────────────────────────────────────

describe('getBridgeSentinelContent("general")', () => {
    it('returns the general preset', () => {
        const content = getBridgeSentinelContent('general')
        expect(content).toContain('DOMAIN: General UI Governance')
        expect(content).toContain('WCAG 2.1 AA')
    })

    it('contains general forbidden patterns', () => {
        const content = getBridgeSentinelContent('general')
        expect(content).toContain('FORBIDDEN PATTERNS')
        expect(content).toContain('Hardcoded color values outside design tokens')
    })

    it('states no additional halt conditions beyond base rules', () => {
        const content = getBridgeSentinelContent('general')
        expect(content).toContain('ADDITIONAL HALT CONDITIONS: None beyond base rules')
    })

    it('references the declared domain in the policy footer', () => {
        const content = getBridgeSentinelContent('general')
        expect(content).toContain('general')
    })
})

// ── Domain: healthcare ────────────────────────────────────────────────────────

describe('getBridgeSentinelContent("healthcare")', () => {
    it('contains PHI-related rules', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('PHI')
        expect(content).toContain('SSN')
        expect(content).toContain('MRN')
    })

    it('contains HIPAA compliance reference', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('HIPAA')
    })

    it('contains FDA SaMD reference', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('FDA SaMD')
    })

    it('contains at least one HALT condition', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('HALT')
    })

    it('contains data-phi attribute requirement', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('data-phi')
    })

    it('specifies 7:1 contrast ratio for clinical text', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('7:1')
    })
})

// ── Domain: fintech ───────────────────────────────────────────────────────────

describe('getBridgeSentinelContent("fintech")', () => {
    it('contains PAN-related rules', () => {
        const content = getBridgeSentinelContent('fintech')
        expect(content).toContain('PAN')
    })

    it('contains currency formatting requirements', () => {
        const content = getBridgeSentinelContent('fintech')
        expect(content).toContain('currency')
    })

    it('contains PCI-DSS compliance reference', () => {
        const content = getBridgeSentinelContent('fintech')
        expect(content).toContain('PCI-DSS')
    })

    it('tightens Mithril ΔE threshold to 1.0', () => {
        const content = getBridgeSentinelContent('fintech')
        expect(content).toContain('1.0')
        expect(content).toContain('MITHRIL THRESHOLD OVERRIDE')
    })

    it('forbids CVV/CVC display', () => {
        const content = getBridgeSentinelContent('fintech')
        expect(content).toContain('CVV')
        expect(content).toContain('CVC')
    })

    it('contains at least one HALT condition', () => {
        const content = getBridgeSentinelContent('fintech')
        expect(content).toContain('HALT')
    })
})

// ── Domain: e-commerce ────────────────────────────────────────────────────────

describe('getBridgeSentinelContent("e-commerce")', () => {
    it('references WCAG AAA compliance level', () => {
        const content = getBridgeSentinelContent('e-commerce')
        expect(content).toContain('WCAG AAA')
    })

    it('contains product image alt text requirements', () => {
        const content = getBridgeSentinelContent('e-commerce')
        expect(content).toContain('alt text')
    })

    it('contains carousel accessibility requirements', () => {
        const content = getBridgeSentinelContent('e-commerce')
        expect(content).toContain('carousel')
    })

    it('contains star rating accessibility requirements', () => {
        const content = getBridgeSentinelContent('e-commerce')
        expect(content).toContain('star rating')
    })

    it('contains keyboard accessibility requirements for purchase actions', () => {
        const content = getBridgeSentinelContent('e-commerce')
        expect(content).toContain('keyboard')
    })

    it('contains at least one HALT condition', () => {
        const content = getBridgeSentinelContent('e-commerce')
        expect(content).toContain('HALT')
    })
})

// ── Domain: government ────────────────────────────────────────────────────────

describe('getBridgeSentinelContent("government")', () => {
    it('references Section 508', () => {
        const content = getBridgeSentinelContent('government')
        expect(content).toContain('Section 508')
    })

    it('references Plain Language requirements', () => {
        const content = getBridgeSentinelContent('government')
        expect(content).toContain('Plain Language')
    })

    it('forbids passive voice in button labels', () => {
        const content = getBridgeSentinelContent('government')
        expect(content).toContain('passive voice')
    })

    it('forbids "please" in error messages', () => {
        const content = getBridgeSentinelContent('government')
        expect(content).toContain('"please"')
    })

    it('requires multimedia captions', () => {
        const content = getBridgeSentinelContent('government')
        expect(content).toContain('captions')
    })

    it('contains at least one HALT condition', () => {
        const content = getBridgeSentinelContent('government')
        expect(content).toContain('HALT')
    })
})

// ── Domain: enterprise-saas ───────────────────────────────────────────────────

describe('getBridgeSentinelContent("enterprise-saas")', () => {
    it('references SOC 2', () => {
        const content = getBridgeSentinelContent('enterprise-saas')
        expect(content).toContain('SOC 2')
    })

    it('requires confirmation dialog for destructive actions', () => {
        const content = getBridgeSentinelContent('enterprise-saas')
        expect(content).toContain('confirmation dialog')
    })

    it('forbids plain-text API key display', () => {
        const content = getBridgeSentinelContent('enterprise-saas')
        expect(content).toContain('API key')
    })

    it('requires bulk action affected count in confirmation', () => {
        const content = getBridgeSentinelContent('enterprise-saas')
        expect(content).toContain('bulk action')
    })

    it('contains at least one HALT condition', () => {
        const content = getBridgeSentinelContent('enterprise-saas')
        expect(content).toContain('HALT')
    })
})

// ── Default / fallback behaviour ──────────────────────────────────────────────

describe('getBridgeSentinelContent - default and fallback', () => {
    it('returns general preset when domain is undefined', () => {
        const content = getBridgeSentinelContent(undefined)
        expect(content).toContain('DOMAIN: General UI Governance')
        expect(content).toContain('Bridge Governance Sentinel')
    })

    it('does not throw when domain is undefined', () => {
        expect(() => getBridgeSentinelContent(undefined)).not.toThrow()
    })

    it('returns general preset for unknown domain string', () => {
        const content = getBridgeSentinelContent('unknown-domain-xyz')
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('does not throw for unknown domain string', () => {
        expect(() => getBridgeSentinelContent('unknown-domain-xyz')).not.toThrow()
    })

    it('returns general preset for empty string domain', () => {
        const content = getBridgeSentinelContent('')
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('returns general preset when both domain and projectRoot are undefined', () => {
        const content = getBridgeSentinelContent(undefined, undefined)
        expect(content).toContain('DOMAIN: General UI Governance')
    })
})

// ── Policy.json domain resolution ────────────────────────────────────────────

describe('getBridgeSentinelContent - policy.json resolution', () => {
    let projectRoot: string

    beforeEach(() => {
        projectRoot = createTempProject()
    })

    afterEach(() => {
        cleanup(projectRoot)
    })

    it('reads domain from policy.json when domain argument is undefined', () => {
        writePolicyJson(projectRoot, 'healthcare')

        const content = getBridgeSentinelContent(undefined, projectRoot)
        expect(content).toContain('DOMAIN: Healthcare UI Governance')
        expect(content).toContain('PHI')
    })

    it('explicit domain argument takes precedence over policy.json', () => {
        writePolicyJson(projectRoot, 'healthcare')

        const content = getBridgeSentinelContent('fintech', projectRoot)
        expect(content).toContain('DOMAIN: Financial Services UI Governance')
        expect(content).not.toContain('DOMAIN: Healthcare UI Governance')
    })

    it('falls back to general when policy.json is missing', () => {
        // No policy.json in this project

        const content = getBridgeSentinelContent(undefined, projectRoot)
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('falls back to general when policy.json has unknown domain', () => {
        writePolicyJson(projectRoot, 'unknown-compliance-domain')

        const content = getBridgeSentinelContent(undefined, projectRoot)
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('falls back to general when policy.json is malformed', () => {
        const policyPath = path.join(projectRoot, '.bridge', 'policy.json')
        fs.writeFileSync(policyPath, '{ bad json }', 'utf-8')

        const content = getBridgeSentinelContent(undefined, projectRoot)
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('falls back to general when policy.json has no domain field', () => {
        const policyPath = path.join(projectRoot, '.bridge', 'policy.json')
        fs.writeFileSync(policyPath, JSON.stringify({ version: 1, mithril: {} }), 'utf-8')

        const content = getBridgeSentinelContent(undefined, projectRoot)
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('handles non-existent projectRoot gracefully', () => {
        const content = getBridgeSentinelContent(undefined, '/nonexistent/path')
        expect(content).toContain('DOMAIN: General UI Governance')
    })

    it('skips policy.json lookup when projectRoot is undefined', () => {
        // Should not throw, even if we call with just projectRoot=undefined
        const content = getBridgeSentinelContent(undefined, undefined)
        expect(content).toContain('DOMAIN: General UI Governance')
    })
})

// ── Prompt composition completeness ──────────────────────────────────────────

describe('getBridgeSentinelContent - composition completeness', () => {
    it('each domain includes DOMAIN IDENTITY block', () => {
        expect(getBridgeSentinelContent('general')).toContain('DOMAIN: General UI Governance')
        expect(getBridgeSentinelContent('healthcare')).toContain('DOMAIN: Healthcare UI Governance')
        expect(getBridgeSentinelContent('fintech')).toContain('DOMAIN: Financial Services UI Governance')
        expect(getBridgeSentinelContent('e-commerce')).toContain('DOMAIN: E-Commerce UI Governance')
        expect(getBridgeSentinelContent('government')).toContain('DOMAIN: Government / Public Sector UI Governance')
        expect(getBridgeSentinelContent('enterprise-saas')).toContain('DOMAIN: Enterprise SaaS UI Governance')
    })

    it('each domain includes FORBIDDEN PATTERNS block', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            expect(getBridgeSentinelContent(domain)).toContain('FORBIDDEN PATTERNS')
        }
    })

    it('each domain includes REQUIRED PATTERNS block', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            expect(getBridgeSentinelContent(domain)).toContain('REQUIRED PATTERNS')
        }
    })

    it('each domain includes ADDITIONAL HALT CONDITIONS block', () => {
        const domains = ['general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas']
        for (const domain of domains) {
            expect(getBridgeSentinelContent(domain)).toContain('ADDITIONAL HALT CONDITIONS')
        }
    })

    it('includes policy.json reference in footer', () => {
        const content = getBridgeSentinelContent('general')
        expect(content).toContain('policy.json')
        expect(content).toContain('.bridge/policy.json')
    })

    it('healthcare HALT conditions are non-negotiable (uses blocking language)', () => {
        const content = getBridgeSentinelContent('healthcare')
        expect(content).toContain('non-negotiable')
        expect(content).toContain('blocking violations')
    })

    it('fintech references the stricter 1.0 Mithril threshold in halt conditions', () => {
        const content = getBridgeSentinelContent('fintech')
        // Should mention ΔE > 1.0 in the halt criteria
        expect(content).toContain('ΔE > 1.0')
    })
})
