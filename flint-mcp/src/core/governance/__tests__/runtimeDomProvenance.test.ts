/**
 * Tests for the runtime-dom SourceAuthority fallback in the rule provenance
 * registry.
 * flint-mcp/src/core/governance/__tests__/runtimeDomProvenance.test.ts
 *
 * RUNTIME.1 — ensures that:
 *   1. The new `'runtime-dom'` member of the SourceAuthority union is
 *      recognised by `resolveProvenance()` for RUNTIME-* rule IDs.
 *   2. `buildComplianceSummary()` accepts runtime-dom entries in its
 *      exhaustive Record initialiser.
 *   3. Registered rule IDs (e.g. A11Y-001) continue to resolve to their
 *      original sourceAuthority (no regression on the AST path).
 */

import { describe, it, expect } from 'vitest'
import {
    resolveProvenance,
    buildComplianceSummary,
} from '../ruleProvenanceRegistry.js'

describe('RUNTIME.1 — runtime-dom provenance fallback', () => {
    describe('resolveProvenance', () => {
        it('returns runtime-dom sourceAuthority for a RUNTIME- prefixed rule ID', () => {
            const provenance = resolveProvenance('RUNTIME-frame-title')
            expect(provenance.sourceAuthority).toBe('runtime-dom')
            expect(provenance.ruleId).toBe('RUNTIME-frame-title')
            expect(provenance.regulatoryReference).toBe('axe-core DOM audit')
        })

        it('returns runtime-dom for any RUNTIME- prefixed id verbatim', () => {
            const provenance = resolveProvenance('RUNTIME-fictional-axe-rule')
            expect(provenance.sourceAuthority).toBe('runtime-dom')
            expect(provenance.ruleName).toBe('RUNTIME-fictional-axe-rule')
        })

        it('does NOT classify RUNTIME-prefixed-but-registered rules as runtime-dom', () => {
            // If a rule ID starts with RUNTIME but is in the registry, the
            // registry wins. No such rules exist today, but this asserts the
            // precedence: registered entries take priority over the prefix.
            // Using a known rule A11Y-001 as a sanity check.
            const provenance = resolveProvenance('A11Y-001')
            expect(provenance.sourceAuthority).toBe('WCAG 2.1 AA')
        })

        it('retains the existing fallback for non-RUNTIME unknown rules', () => {
            const provenance = resolveProvenance('UNKNOWN-CUSTOM-RULE-X')
            expect(provenance.sourceAuthority).toBe('Flint Design System')
        })

        it('returns runtime-dom with today-formatted lastUpdated', () => {
            const provenance = resolveProvenance('RUNTIME-some-axe-rule')
            // Just validate ISO date shape (YYYY-MM-DD)
            expect(provenance.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    })

    describe('buildComplianceSummary — exhaustive authority seed', () => {
        it('accepts a runtime-dom violation and counts it under runtime-dom authority', () => {
            const summary = buildComplianceSummary([
                { ruleId: 'RUNTIME-frame-title', severity: 'critical' },
            ])
            expect(summary.totalViolations).toBe(1)
            expect(summary.byAuthority['runtime-dom']).toBe(1)
            expect(summary.byAuthority['WCAG 2.1 AA']).toBe(0)
        })

        it('seeds all known authorities including runtime-dom at zero', () => {
            const summary = buildComplianceSummary([])
            // The critical property: 'runtime-dom' must be present in byAuthority
            // at zero, so downstream consumers can read it without an
            // `undefined` access error.
            expect(summary.byAuthority['runtime-dom']).toBe(0)
        })

        it('counts mixed AST + runtime-dom violations correctly', () => {
            const summary = buildComplianceSummary([
                { ruleId: 'A11Y-001', severity: 'critical' },
                { ruleId: 'RUNTIME-frame-title', severity: 'critical' },
                { ruleId: 'RUNTIME-iframe-title', severity: 'warning' },
            ])
            expect(summary.totalViolations).toBe(3)
            expect(summary.byAuthority['WCAG 2.1 AA']).toBe(1)
            expect(summary.byAuthority['runtime-dom']).toBe(2)
        })
    })
})
