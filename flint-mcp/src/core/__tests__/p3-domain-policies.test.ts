/**
 * P3 — Granular Design Intent Policies
 * flint-mcp/src/core/__tests__/p3-domain-policies.test.ts
 *
 * Covers three improvements:
 *   1. Domain-driven rule escalation (healthcare, fintech, government)
 *   2. Typography hierarchy enforcement (MITHRIL-TYP-HIERARCHY)
 *   3. Team-specific registry overlays
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
    DEFAULT_RESOLVED_POLICY,
    applyDomainEscalation,
    loadPolicy,
    coerceToResolved,
    type ResolvedPolicy,
} from '../policyEngine.js'
import { applyHealthcareEscalation } from '../domains/healthcare.js'
import { applyFintechEscalation, FINTECH_MIN_TOUCH_TARGET_PX } from '../domains/fintech.js'
import { applyGovernmentEscalation, SECTION_508_RULES } from '../domains/government.js'
import { visitTypographyHierarchy } from '../MithrilLinter.js'
import {
    mergeTeamRegistryOverlay,
    type ComponentEntry,
} from '../registryService.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

function makePolicy(domain: ResolvedPolicy['domain']): ResolvedPolicy {
    return { ...DEFAULT_RESOLVED_POLICY, domain }
}

// ── Domain escalation tests ──────────────────────────────────────────────────

describe('P3 — Domain-driven rule escalation', () => {
    it('healthcare domain escalates a11y to AAA + tightens deltaE to 1.5', () => {
        const base = makePolicy('healthcare')
        const escalated = applyHealthcareEscalation(base)

        expect(escalated.a11y.conformanceLevel).toBe('AAA')
        expect(escalated.a11y.level).toBe('AAA')
        expect(escalated.a11y.mode).toBe('blocking')
        expect(escalated.mithril.deltaEThreshold).toBe(1.5)
        expect(escalated.mithril.deltaE_threshold).toBe(1.5)

        // Sample a11y rules should be blocking.
        expect(escalated.a11y.rules['A11Y-001']).toBe('blocking')
        expect(escalated.a11y.rules['A11Y-005']).toBe('blocking')
    })

    it('fintech domain enforces minimum touch-target sizes (44px)', () => {
        const base = makePolicy('fintech')
        const escalated = applyFintechEscalation(base)

        expect(escalated.mithril.minTouchTargetPx).toBe(FINTECH_MIN_TOUCH_TARGET_PX)
        expect(escalated.mithril.minTouchTargetPx).toBe(44)
        expect(escalated.mithril.rules['MITHRIL-SPC-TOUCH']).toBe('blocking')
        expect(escalated.a11y.mode).toBe('blocking')
        // deltaE tightened but not as aggressively as healthcare.
        expect(escalated.mithril.deltaEThreshold).toBeLessThanOrEqual(1.8)
    })

    it('government domain combines healthcare (AAA) + Section 508 naming rules', () => {
        const base = makePolicy('government')
        const escalated = applyGovernmentEscalation(base)

        // Healthcare inheritance.
        expect(escalated.a11y.level).toBe('AAA')
        expect(escalated.mithril.deltaEThreshold).toBe(1.5)

        // Section 508 flag.
        expect(escalated.a11y.section508).toBe(true)

        // Each Section 508 rule is forced to blocking.
        for (const ruleId of SECTION_508_RULES) {
            expect(escalated.a11y.rules[ruleId]).toBe('blocking')
        }
    })

    it('default / general domain is unchanged by applyDomainEscalation', () => {
        const base = makePolicy('general')
        const out = applyDomainEscalation(base)
        expect(out).toEqual(base)
        expect(out.a11y.level).toBe('AA')
        expect(out.mithril.deltaEThreshold).toBe(2.0)
    })

    it('unknown / unmapped domain falls back to base policy', () => {
        // Force-cast to simulate policy.json specifying an unrecognised domain.
        const base = { ...DEFAULT_RESOLVED_POLICY, domain: 'e-commerce' as const }
        const out = applyDomainEscalation(base)
        expect(out).toEqual(base)
    })

    it('coerceToResolved runs domain escalation end-to-end', () => {
        const out = coerceToResolved({ domain: 'healthcare' } as any)
        expect(out.domain).toBe('healthcare')
        expect(out.a11y.level).toBe('AAA')
        expect(out.mithril.deltaEThreshold).toBe(1.5)
    })

    it('loadPolicy applies domain escalation when policy.json specifies domain', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p3-policy-'))
        try {
            fs.mkdirSync(path.join(tmp, '.flint'), { recursive: true })
            fs.writeFileSync(
                path.join(tmp, '.flint', 'policy.json'),
                JSON.stringify({ version: 2, domain: 'fintech' }),
            )
            const policy = loadPolicy(tmp)
            expect(policy.domain).toBe('fintech')
            expect(policy.mithril.minTouchTargetPx).toBe(44)
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })
})

// ── Typography hierarchy tests ───────────────────────────────────────────────

describe('P3 — Typography hierarchy enforcement (MITHRIL-TYP-HIERARCHY)', () => {
    it('h1 → h2 → h3 passes (no violation)', () => {
        const ast = parseJSX(`
            const C = () => (
                <section>
                    <h1>Title</h1>
                    <h2>Subtitle</h2>
                    <h3>Detail</h3>
                </section>
            )
        `)
        const warnings = visitTypographyHierarchy(ast)
        expect(warnings.size).toBe(0)
    })

    it('h1 → h3 flags MITHRIL-TYP-HIERARCHY on the h3', () => {
        const ast = parseJSX(`
            const C = () => (
                <section>
                    <h1>Title</h1>
                    <h3>Detail</h3>
                </section>
            )
        `)
        const warnings = visitTypographyHierarchy(ast)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-TYP-HIERARCHY')
        expect(w.severity).toBe('amber')
        expect(w.message).toContain('<h3>')
        expect(w.message).toContain('<h2>')
    })

    it('sibling headings at the same level (h2 → h2) pass', () => {
        const ast = parseJSX(`
            const C = () => (
                <>
                    <h1>Top</h1>
                    <h2>Section A</h2>
                    <h2>Section B</h2>
                </>
            )
        `)
        const warnings = visitTypographyHierarchy(ast)
        expect(warnings.size).toBe(0)
    })

    it('recovery suggests the correct intermediate heading level (auto-fix)', () => {
        const ast = parseJSX(`
            const C = () => (
                <>
                    <h1>Top</h1>
                    <h4>Too deep</h4>
                </>
            )
        `)
        const warnings = visitTypographyHierarchy(ast)
        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.fixable).toBe(true)
        // Expected intermediate from h1 is h2.
        expect(w.recovery).toContain('h2')
    })

    it('ignores headings that come from component props (not static intrinsics)', () => {
        const ast = parseJSX(`
            const C = () => (
                <>
                    <Heading level={1}>Top</Heading>
                    <Heading level={3}>Skipped</Heading>
                </>
            )
        `)
        const warnings = visitTypographyHierarchy(ast)
        expect(warnings.size).toBe(0)
    })

    it('ruleModes off disables the visitor entirely', () => {
        const ast = parseJSX(`
            const C = () => (
                <>
                    <h1>Top</h1>
                    <h3>Skipped</h3>
                </>
            )
        `)
        const warnings = visitTypographyHierarchy(ast, {
            ruleModes: { 'MITHRIL-TYP-HIERARCHY': 'off' },
        })
        expect(warnings.size).toBe(0)
    })
})

// ── Team registry overlay tests ──────────────────────────────────────────────

describe('P3 — Team-specific registry overlays', () => {
    const baseRegistry: Record<string, ComponentEntry> = {
        Button: {
            name: 'Button',
            importPath: '@/components/ui/button',
        },
        Card: {
            name: 'Card',
            importPath: '@/components/ui/card',
        },
    }

    it('team overlay adds new registry entries', () => {
        const merged = mergeTeamRegistryOverlay(baseRegistry, {
            addEntries: {
                Modal: {
                    importPath: '@acme/web/modal',
                    description: 'Acme-branded modal',
                },
            },
        })

        expect(merged.Modal).toBeDefined()
        expect(merged.Modal.importPath).toBe('@acme/web/modal')
        expect(merged.Modal.name).toBe('Modal')
        // Base entries preserved.
        expect(merged.Button).toBeDefined()
        expect(merged.Card).toBeDefined()
    })

    it('team overlay overrides the importPath of an existing entry', () => {
        const merged = mergeTeamRegistryOverlay(baseRegistry, {
            importOverrides: {
                Button: '@payments/ui/button',
            },
        })

        expect(merged.Button.importPath).toBe('@payments/ui/button')
        // Other entries untouched.
        expect(merged.Card.importPath).toBe('@/components/ui/card')
    })

    it('does not mutate the base registry', () => {
        const before = JSON.parse(JSON.stringify(baseRegistry))
        mergeTeamRegistryOverlay(baseRegistry, {
            addEntries: { X: { importPath: 'y' } },
            importOverrides: { Button: '@other/button' },
        })
        expect(baseRegistry).toEqual(before)
    })

    it('combined domain escalation + team registry overlay', () => {
        // Healthcare escalation of the policy…
        const escalated = applyHealthcareEscalation(makePolicy('healthcare'))
        expect(escalated.a11y.level).toBe('AAA')

        // …and a team registry overlay applied independently to the registry.
        const merged = mergeTeamRegistryOverlay(baseRegistry, {
            addEntries: { Alert: { importPath: '@health/ui/alert' } },
            importOverrides: { Button: '@health/ui/button' },
        })
        expect(merged.Alert.importPath).toBe('@health/ui/alert')
        expect(merged.Button.importPath).toBe('@health/ui/button')
    })

    it('coerceToResolved parses team.registry overlay from raw policy', () => {
        const resolved = coerceToResolved({
            version: 2,
            teams: {
                payments: {
                    registry: {
                        addEntries: {
                            Receipt: { importPath: '@pay/ui/receipt' } as any,
                        },
                        importOverrides: {
                            Button: '@pay/ui/button',
                        },
                    },
                },
            },
        } as any)

        const overlay = resolved.teams.payments?.registry
        expect(overlay).toBeDefined()
        expect(overlay?.addEntries?.Receipt).toBeDefined()
        expect(overlay?.importOverrides?.Button).toBe('@pay/ui/button')
    })
})
