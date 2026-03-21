/**
 * SARIF Builder Tests -- flint-ci/src/sarif-builder.test.ts
 *
 * Verifies the SARIF 2.1.0 output format is correct and GitHub Code Scanning
 * compatible.
 */

import { describe, it, expect } from 'vitest'
import { buildSarifReport } from './sarif-builder.js'
import type { AuditSummary } from './types.js'

describe('buildSarifReport', () => {
    it('produces valid SARIF 2.1.0 structure', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 1,
            totalA11yViolations: 1,
            criticalCount: 1,
            amberCount: 1,
            results: [{
                filePath: 'src/App.tsx',
                mithrilWarnings: [{
                    id: 'node-1',
                    type: 'color-drift',
                    severity: 'amber',
                    value: 3.2,
                    message: 'MITHRIL-COL: deltaE 3.2 -- use color-brand.primary',
                    nearestToken: 'color-brand.primary',
                    nearestTokenValue: '#3b82f6',
                }],
                a11yViolations: {
                    'img-1': ['A11Y-001: <img> is missing an `alt` attribute.'],
                },
                parseError: null,
            }],
        }

        const report = buildSarifReport(summary)

        // Schema and version
        expect(report.$schema).toContain('sarif-schema-2.1.0.json')
        expect(report.version).toBe('2.1.0')

        // Runs
        expect(report.runs).toHaveLength(1)
        expect(report.runs[0].tool.driver.name).toBe('Flint Governance')
        expect(report.runs[0].tool.driver.version).toBe('1.0.0')

        // Results
        expect(report.runs[0].results).toHaveLength(2) // 1 mithril + 1 a11y

        // Mithril result
        const mithrilResult = report.runs[0].results.find(r => r.ruleId === 'MITHRIL-COL')
        expect(mithrilResult).toBeDefined()
        expect(mithrilResult!.level).toBe('warning')
        expect(mithrilResult!.message.text).toContain('deltaE 3.2')

        // A11y result
        const a11yResult = report.runs[0].results.find(r => r.ruleId === 'A11Y-001')
        expect(a11yResult).toBeDefined()
        expect(a11yResult!.level).toBe('error')

        // Rules
        const rules = report.runs[0].tool.driver.rules ?? []
        expect(rules.some(r => r.id === 'MITHRIL-COL')).toBe(true)
        expect(rules.some(r => r.id === 'A11Y-001')).toBe(true)
    })

    it('handles empty results', () => {
        const summary: AuditSummary = {
            totalFiles: 0,
            filesWithViolations: 0,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [],
        }

        const report = buildSarifReport(summary)
        expect(report.runs[0].results).toHaveLength(0)
        expect(report.runs[0].tool.driver.rules).toHaveLength(0)
    })

    it('maps critical severity to error level', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 1,
            totalA11yViolations: 0,
            criticalCount: 1,
            amberCount: 0,
            results: [{
                filePath: 'src/Danger.tsx',
                mithrilWarnings: [{
                    id: 'node-1',
                    type: 'color-drift',
                    severity: 'critical',
                    value: 15.0,
                    message: 'MITHRIL-COL: deltaE 15.0 -- no matching token',
                    nearestToken: null,
                    nearestTokenValue: null,
                }],
                a11yViolations: {},
                parseError: null,
            }],
        }

        const report = buildSarifReport(summary)
        expect(report.runs[0].results[0].level).toBe('error')
    })

    it('includes parse errors as results', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [{
                filePath: 'src/Broken.tsx',
                mithrilWarnings: [],
                a11yViolations: {},
                parseError: 'Failed to parse src/Broken.tsx',
            }],
        }

        const report = buildSarifReport(summary)
        expect(report.runs[0].results).toHaveLength(1)
        expect(report.runs[0].results[0].ruleId).toBe('FLINT-PARSE')
        expect(report.runs[0].results[0].level).toBe('error')
    })

    it('normalizes file paths in artifact locations', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 1,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 1,
            results: [{
                filePath: './src/components/Button.tsx',
                mithrilWarnings: [{
                    id: 'node-1',
                    type: 'color-drift',
                    severity: 'amber',
                    value: 3.0,
                    message: 'MITHRIL-COL: deltaE 3.0 -- use color-brand.primary',
                    nearestToken: 'color-brand.primary',
                    nearestTokenValue: '#3b82f6',
                }],
                a11yViolations: {},
                parseError: null,
            }],
        }

        const report = buildSarifReport(summary)
        const uri = report.runs[0].results[0].locations?.[0]?.physicalLocation.artifactLocation.uri
        expect(uri).toBe('src/components/Button.tsx') // leading ./ stripped
    })
})
