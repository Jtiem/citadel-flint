/**
 * auditReport.chron1.test.ts — CHRON.1 SARIF override reason enrichment (TB-15)
 *
 * Tests that buildSarifOutput (via handleAuditReport) enriches SARIF result
 * properties with override reasons when an override lookup returns a
 * user-written reason, and correctly filters 'skipped' and 'auto' reasons.
 *
 * Contract: .flint-context/contracts/CHRON.1.contract.ts
 * Implementation: flint-mcp/src/tools/auditReport.ts
 *
 * W.A (from contract linter): 'skipped' reasons are noise in SARIF — only
 * user-written reasons must appear in properties.overrideReason.
 */

import { describe, it, expect } from 'vitest'
import { handleAuditReport } from '../auditReport.js'
import type { OverrideLookupFn } from '../auditReport.js'

// ---------------------------------------------------------------------------
// Minimal TSX source with a known accessibility violation so the SARIF
// output has at least one result to check properties on.
// ---------------------------------------------------------------------------

// img without alt -> A11Y-001 violation
const SOURCE_WITH_VIOLATION = `
export default function Badge() {
  return <img src="/logo.png" />
}
`

// Clean source — no violations
const SOURCE_CLEAN = `
export default function Clean() {
  return <div aria-label="section"><p>Hello</p></div>
}
`

// ---------------------------------------------------------------------------
// TB-15a: overrideReason included in SARIF properties when user-written reason exists
// ---------------------------------------------------------------------------

describe('CHRON.1 — SARIF override reason enrichment (TB-15)', () => {
    it('SARIF output includes overrideReason in properties when user-written reason exists', () => {
        const overrideLookup: OverrideLookupFn = (_ruleId, _filePath) => ({
            reason: 'brand approved by design team',
            timestamp: '2026-04-16T10:00:00.000Z',
        })

        const result = handleAuditReport({
            source: SOURCE_WITH_VIOLATION,
            filePath: '/src/components/Badge.tsx',
            format: 'sarif',
            overrideLookup,
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        const results: Array<{ properties: Record<string, unknown> }> = sarif.runs[0].results

        // At least one result must exist (the A11y violation)
        expect(results.length).toBeGreaterThan(0)

        // Every result gets the overrideReason from the lookup
        for (const r of results) {
            expect(r.properties.overrideReason).toBe('brand approved by design team')
            expect(r.properties.overrideTimestamp).toBe('2026-04-16T10:00:00.000Z')
        }
    })

    // TB-15b: 'skipped' reasons must NOT appear in SARIF properties (W.A filter)
    it('SARIF output does NOT include overrideReason for "skipped" reasons', () => {
        const overrideLookup: OverrideLookupFn = (_ruleId, _filePath) => ({
            reason: 'skipped',
            timestamp: '2026-04-16T10:00:00.000Z',
        })

        const result = handleAuditReport({
            source: SOURCE_WITH_VIOLATION,
            filePath: '/src/components/Badge.tsx',
            format: 'sarif',
            overrideLookup,
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        const results: Array<{ properties: Record<string, unknown> }> = sarif.runs[0].results

        expect(results.length).toBeGreaterThan(0)

        for (const r of results) {
            expect(r.properties).not.toHaveProperty('overrideReason')
            expect(r.properties).not.toHaveProperty('overrideTimestamp')
        }
    })

    // 'auto' reasons must also NOT appear in SARIF properties (W.A filter)
    it('SARIF output does NOT include overrideReason for "auto" reasons', () => {
        const overrideLookup: OverrideLookupFn = (_ruleId, _filePath) => ({
            reason: 'auto',
            timestamp: '2026-04-16T10:00:00.000Z',
        })

        const result = handleAuditReport({
            source: SOURCE_WITH_VIOLATION,
            filePath: '/src/components/Badge.tsx',
            format: 'sarif',
            overrideLookup,
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        const results: Array<{ properties: Record<string, unknown> }> = sarif.runs[0].results

        expect(results.length).toBeGreaterThan(0)

        for (const r of results) {
            expect(r.properties).not.toHaveProperty('overrideReason')
        }
    })

    // No overrideLookup provided -> no overrideReason in properties
    it('SARIF output has no overrideReason when no overrideLookup is provided', () => {
        const result = handleAuditReport({
            source: SOURCE_WITH_VIOLATION,
            filePath: '/src/components/Badge.tsx',
            format: 'sarif',
            // no overrideLookup
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        const results: Array<{ properties: Record<string, unknown> }> = sarif.runs[0].results

        expect(results.length).toBeGreaterThan(0)

        for (const r of results) {
            expect(r.properties).not.toHaveProperty('overrideReason')
        }
    })

    // overrideLookup returning null -> no overrideReason
    it('SARIF output has no overrideReason when lookup returns null', () => {
        const overrideLookup: OverrideLookupFn = () => null

        const result = handleAuditReport({
            source: SOURCE_WITH_VIOLATION,
            filePath: '/src/components/Badge.tsx',
            format: 'sarif',
            overrideLookup,
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        const results: Array<{ properties: Record<string, unknown> }> = sarif.runs[0].results

        for (const r of results) {
            expect(r.properties).not.toHaveProperty('overrideReason')
        }
    })

    // Required base SARIF properties are always present regardless of override
    it('SARIF result properties always include flintId, sourceAuthority, regulatoryReference', () => {
        const result = handleAuditReport({
            source: SOURCE_WITH_VIOLATION,
            filePath: '/src/components/Badge.tsx',
            format: 'sarif',
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        const results: Array<{ properties: Record<string, unknown> }> = sarif.runs[0].results

        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
            expect(r.properties).toHaveProperty('flintId')
            expect(r.properties).toHaveProperty('sourceAuthority')
            expect(r.properties).toHaveProperty('regulatoryReference')
        }
    })

    // Clean source -> empty results -> overrideLookup never called, no error
    it('SARIF output with clean source has no results and no error', () => {
        const calls: string[] = []
        const overrideLookup: OverrideLookupFn = (ruleId) => {
            calls.push(ruleId)
            return { reason: 'brand approved', timestamp: '2026-04-16T10:00:00.000Z' }
        }

        const result = handleAuditReport({
            source: SOURCE_CLEAN,
            filePath: '/src/components/Clean.tsx',
            format: 'sarif',
            overrideLookup,
        })

        expect(result.isError).toBeFalsy()
        const sarif = JSON.parse(result.content[0].text)
        // No violations -> no results -> lookup never called
        expect(sarif.runs[0].results.length).toBe(0)
        expect(calls.length).toBe(0)
    })
})
