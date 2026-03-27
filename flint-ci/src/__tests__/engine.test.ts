/**
 * Engine tests -- flint-ci/src/__tests__/engine.test.ts
 *
 * Comprehensive test suite for the Flint CI audit engine.
 * Tests parsing, rule extraction, token loading, single/batch auditing,
 * blocking logic, and SARIF report generation.
 *
 * Note: auditFile and shouldBlock depend on imports from flint-mcp.
 * If better-sqlite3 native module is unavailable, those imports are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import {
    parseSource,
    extractRuleId,
    loadTokens,
    auditFile,
    auditFiles,
    shouldBlock,
    buildSarifReport,
    DEFAULT_POLICY,
} from '../engine.js'
import type { AuditSummary, FlintPolicy, FileAuditResult } from '../engine.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const cleanCode = `
import React from 'react'
export function MyComponent() {
  return <div data-flint-id="root" className="p-4">
    <img data-flint-id="img-1" alt="test" src="test.png" />
    <button data-flint-id="btn-1">Click me</button>
  </div>
}
`

const badA11yCode = `
import React from 'react'
export function Bad() {
  return <div data-flint-id="root">
    <img data-flint-id="img-1" src="test.png" />
  </div>
}
`

const arbitraryColorCode = `
import React from 'react'
export function Colored() {
  return <div data-flint-id="root" className="bg-[#ff00ff] p-4">
    <img data-flint-id="img-1" alt="test" src="test.png" />
  </div>
}
`

const unparsableCode = `
export function Bad( {
  return <div>
  // missing closing bracket
`

const multiViolationCode = `
import React from 'react'
export function Multi() {
  return <div data-flint-id="root" className="bg-[#123456]">
    <img data-flint-id="img-1" src="no-alt.png" />
    <img data-flint-id="img-2" src="also-no-alt.png" />
    <button data-flint-id="btn-1"></button>
  </div>
}
`

// ── parseSource ──────────────────────────────────────────────────────────────

describe('parseSource', () => {
    it('should parse valid TSX code and return a Babel AST', () => {
        const ast = parseSource(cleanCode)
        expect(ast).not.toBeNull()
        expect(ast!.type).toBe('File')
        expect(ast!.program).toBeDefined()
        expect(ast!.program.body.length).toBeGreaterThan(0)
    })

    it('should parse minimal valid code', () => {
        const ast = parseSource('const x = 1')
        expect(ast).not.toBeNull()
        expect(ast!.type).toBe('File')
    })

    it('should parse JSX with TypeScript types', () => {
        const code = `
import React from 'react'
interface Props { name: string }
export const Comp: React.FC<Props> = ({ name }) => <div>{name}</div>
`
        const ast = parseSource(code)
        expect(ast).not.toBeNull()
    })

    it('should parse decorators (legacy plugin)', () => {
        const code = `
function log(target: any) {}
@log
class MyClass {}
`
        const ast = parseSource(code)
        expect(ast).not.toBeNull()
    })

    it('should return null for invalid/unparsable code', () => {
        const ast = parseSource(unparsableCode)
        expect(ast).toBeNull()
    })

    it('should parse empty string as valid JS', () => {
        const ast = parseSource('')
        expect(ast).not.toBeNull()
    })

    it('should return null for binary garbage', () => {
        const ast = parseSource('\x00\x01\x02\xff\xfe{{{')
        expect(ast).toBeNull()
    })
})

// ── extractRuleId ────────────────────────────────────────────────────────────

describe('extractRuleId', () => {
    it('should extract MITHRIL-COL from a color drift message', () => {
        expect(
            extractRuleId('MITHRIL-COL: bg-[#ff00ff] drifts from token'),
        ).toBe('MITHRIL-COL')
    })

    it('should extract MITHRIL-TYP-001 from a typography message', () => {
        expect(
            extractRuleId(
                'MITHRIL-TYP-001: font-family "Comic Sans" not in token set',
            ),
        ).toBe('MITHRIL-TYP-001')
    })

    it('should extract MITHRIL-TYP-002', () => {
        expect(
            extractRuleId('MITHRIL-TYP-002: font-size 13px not in token set'),
        ).toBe('MITHRIL-TYP-002')
    })

    it('should extract MITHRIL-SPC-001', () => {
        expect(
            extractRuleId(
                'MITHRIL-SPC-001: spacing value 17px not in dimension token set',
            ),
        ).toBe('MITHRIL-SPC-001')
    })

    it('should extract MITHRIL-SHD-001', () => {
        expect(
            extractRuleId(
                'MITHRIL-SHD-001: box-shadow not in shadow token set',
            ),
        ).toBe('MITHRIL-SHD-001')
    })

    it('should extract MITHRIL-OPC-001', () => {
        expect(
            extractRuleId(
                'MITHRIL-OPC-001: opacity 0.3 not in opacity token set',
            ),
        ).toBe('MITHRIL-OPC-001')
    })

    it('should extract MITHRIL-INL', () => {
        expect(
            extractRuleId(
                'MITHRIL-INL: inline style "color" drifts from token',
            ),
        ).toBe('MITHRIL-INL')
    })

    it('should extract A11Y-001 from an accessibility message', () => {
        expect(
            extractRuleId('A11Y-001: img element missing alt attribute'),
        ).toBe('A11Y-001')
    })

    it('should extract A11Y-002', () => {
        expect(
            extractRuleId('A11Y-002: button has no accessible label'),
        ).toBe('A11Y-002')
    })

    it('should extract SYNC-001 from a sync drift message', () => {
        expect(
            extractRuleId('SYNC-001: token "primary" drifts from remote'),
        ).toBe('SYNC-001')
    })

    it('should extract SYNC-002', () => {
        expect(extractRuleId('SYNC-002: orphaned token "accent"')).toBe(
            'SYNC-002',
        )
    })

    it('should return UNKNOWN for unrecognized message formats', () => {
        expect(extractRuleId('Some random warning message')).toBe('UNKNOWN')
    })

    it('should return UNKNOWN for empty string', () => {
        expect(extractRuleId('')).toBe('UNKNOWN')
    })

    it('should return UNKNOWN for message without a colon', () => {
        expect(extractRuleId('MITHRIL without a colon')).toBe('UNKNOWN')
    })

    it('should extract MITHRIL-IST-COL from inline style message', () => {
        expect(
            extractRuleId('MITHRIL-IST-COL: inline `color: #ff0000` drifts'),
        ).toBe('MITHRIL-IST-COL')
    })

    it('should extract MITHRIL-IST-TYP from inline typography message', () => {
        expect(
            extractRuleId('MITHRIL-IST-TYP: inline `font-size: 13px` not in tokens'),
        ).toBe('MITHRIL-IST-TYP')
    })

    it('should extract MITHRIL-DTO-001 from orphan token message', () => {
        expect(
            extractRuleId('MITHRIL-DTO-001: token class references unknown token'),
        ).toBe('MITHRIL-DTO-001')
    })

    it('should handle rule ID at start without extra text', () => {
        expect(extractRuleId('A11Y-042')).toBe('A11Y-042')
    })
})

// ── loadTokens ───────────────────────────────────────────────────────────────

describe('loadTokens', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-ci-test-'))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('should return an empty array for a missing file', () => {
        const tokens = loadTokens(
            path.join(tmpDir, 'nonexistent-tokens.json'),
        )
        expect(tokens).toEqual([])
    })

    it('should parse a JSON array of tokens', () => {
        const tokenData = [
            { name: 'primary', value: '#3b82f6', type: 'color' },
            { name: 'secondary', value: '#10b981', type: 'color' },
        ]
        const tokenPath = path.join(tmpDir, 'tokens.json')
        fs.writeFileSync(tokenPath, JSON.stringify(tokenData), 'utf-8')

        const tokens = loadTokens(tokenPath)
        expect(tokens).toHaveLength(2)
        expect(tokens[0]).toEqual(tokenData[0])
        expect(tokens[1]).toEqual(tokenData[1])
    })

    it('should handle non-array JSON (object with token values)', () => {
        const tokenData = {
            primary: { name: 'primary', value: '#3b82f6', type: 'color' },
            secondary: {
                name: 'secondary',
                value: '#10b981',
                type: 'color',
            },
        }
        const tokenPath = path.join(tmpDir, 'tokens-obj.json')
        fs.writeFileSync(tokenPath, JSON.stringify(tokenData), 'utf-8')

        const tokens = loadTokens(tokenPath)
        expect(tokens).toHaveLength(2)
    })

    it('should return empty array for invalid JSON', () => {
        const tokenPath = path.join(tmpDir, 'bad.json')
        fs.writeFileSync(tokenPath, '{{{invalid json', 'utf-8')

        const tokens = loadTokens(tokenPath)
        expect(tokens).toEqual([])
    })

    it('should return empty array for a directory path', () => {
        const tokens = loadTokens(tmpDir)
        expect(tokens).toEqual([])
    })
})

// ── auditFile ────────────────────────────────────────────────────────────────

describe('auditFile', () => {
    const defaultPolicy = { ...DEFAULT_POLICY }

    it('should return empty results for a clean file', () => {
        const result = auditFile('clean.tsx', cleanCode, [], defaultPolicy)
        expect(result.filePath).toBe('clean.tsx')
        expect(result.parseError).toBeNull()
        expect(result.mithrilWarnings).toEqual([])
        expect(Object.keys(result.a11yViolations)).toHaveLength(0)
    })

    it('should detect missing alt on img (A11Y-001)', () => {
        const result = auditFile(
            'bad-a11y.tsx',
            badA11yCode,
            [],
            defaultPolicy,
        )
        expect(result.parseError).toBeNull()

        // A11y violations should be present
        const allViolations = Object.values(result.a11yViolations).flat()
        expect(allViolations.length).toBeGreaterThan(0)

        // Should find at least one message about missing alt or image accessibility
        const hasAltViolation = allViolations.some(
            (msg) =>
                msg.toLowerCase().includes('alt') ||
                msg.toLowerCase().includes('img') ||
                msg.includes('A11Y-001'),
        )
        expect(hasAltViolation).toBe(true)
    })

    it('should detect arbitrary color class as MITHRIL-COL when tokens are provided', () => {
        // Provide tokens matching the DesignToken interface from flint-mcp
        const tokens = [
            {
                id: 1,
                token_path: 'colors.primary',
                token_type: 'color' as const,
                token_value: '#3b82f6',
                description: null,
                collection_name: 'brand',
                mode: 'default',
            },
        ]
        const result = auditFile(
            'color-drift.tsx',
            arbitraryColorCode,
            tokens,
            defaultPolicy,
        )
        expect(result.parseError).toBeNull()

        // With tokens provided and an arbitrary color, Mithril must flag it
        expect(result.mithrilWarnings.length).toBeGreaterThan(0)
        const hasColorDrift = result.mithrilWarnings.some(
            (w) =>
                w.message.includes('MITHRIL-COL') ||
                w.type === 'color-drift',
        )
        expect(hasColorDrift).toBe(true)
    })

    it('should return parseError for unparsable code', () => {
        const result = auditFile(
            'broken.tsx',
            unparsableCode,
            [],
            defaultPolicy,
        )
        expect(result.parseError).not.toBeNull()
        expect(result.parseError).toContain('broken.tsx')
        expect(result.mithrilWarnings).toEqual([])
    })

    it('should skip mithril checks when policy mithril mode is off', () => {
        const offPolicy: FlintPolicy = {
            ...defaultPolicy,
            mithril: {
                ...defaultPolicy.mithril,
                mode: 'off',
            },
        }
        const tokens = [
            {
                id: 1,
                token_path: 'colors.primary',
                token_type: 'color' as const,
                token_value: '#3b82f6',
                description: null,
                collection_name: 'brand',
                mode: 'default',
            },
        ]
        const result = auditFile(
            'skip-mithril.tsx',
            arbitraryColorCode,
            tokens,
            offPolicy,
        )
        expect(result.mithrilWarnings).toEqual([])
    })

    it('should skip a11y checks when policy a11y mode is off', () => {
        const offPolicy: FlintPolicy = {
            ...defaultPolicy,
            a11y: {
                ...defaultPolicy.a11y,
                mode: 'off',
            },
        }
        const result = auditFile(
            'skip-a11y.tsx',
            badA11yCode,
            [],
            offPolicy,
        )
        expect(Object.keys(result.a11yViolations)).toHaveLength(0)
    })

    it('should filter disabled A11y rules from violations', () => {
        const policyWithDisabled: FlintPolicy = {
            ...defaultPolicy,
            a11y: {
                ...defaultPolicy.a11y,
                disabled_rules: ['A11Y-001'],
            },
        }
        const result = auditFile(
            'disabled-rules.tsx',
            badA11yCode,
            [],
            policyWithDisabled,
        )

        // Any A11Y-001 violations should be filtered out
        const allViolations = Object.values(result.a11yViolations).flat()
        const hasA11y001 = allViolations.some((msg) =>
            msg.startsWith('A11Y-001'),
        )
        expect(hasA11y001).toBe(false)
    })

    it('should handle both mithril and a11y modes set to off', () => {
        const allOffPolicy: FlintPolicy = {
            ...defaultPolicy,
            mithril: { ...defaultPolicy.mithril, mode: 'off' },
            a11y: { ...defaultPolicy.a11y, mode: 'off' },
        }
        const result = auditFile(
            'all-off.tsx',
            multiViolationCode,
            [],
            allOffPolicy,
        )
        expect(result.mithrilWarnings).toEqual([])
        expect(Object.keys(result.a11yViolations)).toHaveLength(0)
        expect(result.parseError).toBeNull()
    })

    it('should handle empty code string gracefully', () => {
        const result = auditFile('empty.tsx', '', [], defaultPolicy)
        // Empty string is parseable JS
        expect(result.parseError).toBeNull()
        expect(result.mithrilWarnings).toEqual([])
    })
})

// ── auditFiles (batch) ───────────────────────────────────────────────────────

describe('auditFiles', () => {
    const defaultPolicy = { ...DEFAULT_POLICY }

    it('should aggregate results across multiple files', () => {
        const files = [
            { path: 'clean.tsx', content: cleanCode },
            { path: 'bad-a11y.tsx', content: badA11yCode },
        ]
        const summary = auditFiles(files, [], defaultPolicy)

        expect(summary.totalFiles).toBe(2)
        expect(summary.results).toHaveLength(2)
    })

    it('should count files with violations correctly', () => {
        const files = [
            { path: 'clean.tsx', content: cleanCode },
            { path: 'bad-a11y.tsx', content: badA11yCode },
            { path: 'broken.tsx', content: unparsableCode },
        ]
        const summary = auditFiles(files, [], defaultPolicy)

        expect(summary.totalFiles).toBe(3)
        // bad-a11y and broken should both have violations/errors
        expect(summary.filesWithViolations).toBeGreaterThanOrEqual(2)
    })

    it('should count a11y violations as critical (Commandment 5)', () => {
        const files = [{ path: 'bad-a11y.tsx', content: badA11yCode }]
        const summary = auditFiles(files, [], defaultPolicy)

        // A11y violations MUST be detected — unconditional assertion
        expect(summary.totalA11yViolations).toBeGreaterThan(0)
        // All A11y violations count as critical (Commandment 5)
        expect(summary.criticalCount).toBeGreaterThanOrEqual(
            summary.totalA11yViolations,
        )
    })

    it('should handle empty file list', () => {
        const summary = auditFiles([], [], defaultPolicy)
        expect(summary.totalFiles).toBe(0)
        expect(summary.filesWithViolations).toBe(0)
        expect(summary.totalMithrilWarnings).toBe(0)
        expect(summary.totalA11yViolations).toBe(0)
        expect(summary.criticalCount).toBe(0)
        expect(summary.amberCount).toBe(0)
        expect(summary.results).toEqual([])
    })

    it('should handle all clean files with zero violations', () => {
        const files = [
            { path: 'clean1.tsx', content: cleanCode },
            { path: 'clean2.tsx', content: cleanCode },
        ]
        const summary = auditFiles(files, [], defaultPolicy)

        expect(summary.totalFiles).toBe(2)
        expect(summary.filesWithViolations).toBe(0)
        expect(summary.totalMithrilWarnings).toBe(0)
        expect(summary.totalA11yViolations).toBe(0)
    })
})

// ── shouldBlock ──────────────────────────────────────────────────────────────

describe('shouldBlock', () => {
    // Use a non-existent project root so YAML config loading falls through
    // to legacy logic, which is what we want to test here.
    const noConfigRoot = path.join(os.tmpdir(), 'flint-ci-test-no-config')

    it('should return false when no violations exist', () => {
        const summary: AuditSummary = {
            totalFiles: 5,
            filesWithViolations: 0,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [],
        }
        expect(shouldBlock(summary, noConfigRoot)).toBe(false)
    })

    it('should return true when criticalCount > 0 in legacy mode', () => {
        const summary: AuditSummary = {
            totalFiles: 3,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 2,
            criticalCount: 2,
            amberCount: 0,
            results: [],
        }
        expect(shouldBlock(summary, noConfigRoot)).toBe(true)
    })

    it('should return false for amber-only violations without failOnWarning', () => {
        const summary: AuditSummary = {
            totalFiles: 3,
            filesWithViolations: 1,
            totalMithrilWarnings: 2,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 2,
            results: [],
        }
        expect(shouldBlock(summary, noConfigRoot, false)).toBe(false)
    })

    it('should return true for amber violations when failOnWarning is true', () => {
        const summary: AuditSummary = {
            totalFiles: 3,
            filesWithViolations: 1,
            totalMithrilWarnings: 2,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 2,
            results: [],
        }
        expect(shouldBlock(summary, noConfigRoot, true)).toBe(true)
    })

    it('should return true when both critical and amber violations exist', () => {
        const summary: AuditSummary = {
            totalFiles: 5,
            filesWithViolations: 3,
            totalMithrilWarnings: 3,
            totalA11yViolations: 1,
            criticalCount: 1,
            amberCount: 3,
            results: [],
        }
        expect(shouldBlock(summary, noConfigRoot)).toBe(true)
    })

    it('should return false for an empty summary', () => {
        const summary: AuditSummary = {
            totalFiles: 0,
            filesWithViolations: 0,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [],
        }
        expect(shouldBlock(summary, noConfigRoot)).toBe(false)
    })
})

// ── buildSarifReport ─────────────────────────────────────────────────────────

describe('buildSarifReport', () => {
    it('should generate a valid SARIF 2.1.0 structure', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 0,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [
                {
                    filePath: 'src/App.tsx',
                    mithrilWarnings: [],
                    a11yViolations: {},
                    parseError: null,
                },
            ],
        }

        const sarif = buildSarifReport(summary)

        expect(sarif.$schema).toContain('sarif-schema-2.1.0')
        expect(sarif.version).toBe('2.1.0')
        expect(sarif.runs).toHaveLength(1)
        expect(sarif.runs[0].tool.driver.name).toBe('Flint Governance')
        expect(sarif.runs[0].tool.driver.version).toBe('2.0.0')
        expect(sarif.runs[0].results).toEqual([])
    })

    it('should include correct rule IDs for Mithril warnings', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 2,
            totalA11yViolations: 0,
            criticalCount: 1,
            amberCount: 1,
            results: [
                {
                    filePath: 'src/Component.tsx',
                    mithrilWarnings: [
                        {
                            id: 'node-1',
                            type: 'color-drift',
                            severity: 'critical',
                            value: 15.5,
                            message:
                                'MITHRIL-COL: bg-[#ff00ff] drifts from primary (#3b82f6), deltaE=15.5',
                            nearestToken: 'primary',
                            nearestTokenValue: '#3b82f6',
                            line: 5,
                            column: 10,
                        },
                        {
                            id: 'node-2',
                            type: 'typography-drift',
                            severity: 'amber',
                            value: 1,
                            message:
                                'MITHRIL-TYP-001: font-family "Comic Sans" not in token set',
                            nearestToken: null,
                            nearestTokenValue: null,
                        },
                    ],
                    a11yViolations: {},
                    parseError: null,
                },
            ],
        }

        const sarif = buildSarifReport(summary)

        expect(sarif.runs[0].results).toHaveLength(2)

        // First result: critical color drift
        const colorResult = sarif.runs[0].results[0]
        expect(colorResult.ruleId).toBe('MITHRIL-COL')
        expect(colorResult.level).toBe('error')
        expect(colorResult.locations).toHaveLength(1)
        expect(
            colorResult.locations![0].physicalLocation.artifactLocation.uri,
        ).toBe('src/Component.tsx')
        expect(
            colorResult.locations![0].physicalLocation.region?.startLine,
        ).toBe(5)
        expect(
            colorResult.locations![0].physicalLocation.region?.startColumn,
        ).toBe(11) // column + 1

        // Second result: amber typography drift
        const typResult = sarif.runs[0].results[1]
        expect(typResult.ruleId).toBe('MITHRIL-TYP-001')
        expect(typResult.level).toBe('warning')

        // Rules should include both
        const ruleIds = sarif.runs[0].tool.driver.rules!.map((r) => r.id)
        expect(ruleIds).toContain('MITHRIL-COL')
        expect(ruleIds).toContain('MITHRIL-TYP-001')
    })

    it('should include A11y violations as error-level results', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 1,
            criticalCount: 1,
            amberCount: 0,
            results: [
                {
                    filePath: 'src/Bad.tsx',
                    mithrilWarnings: [],
                    a11yViolations: {
                        'img-1': [
                            'A11Y-001: img element missing alt attribute',
                        ],
                    },
                    parseError: null,
                },
            ],
        }

        const sarif = buildSarifReport(summary)
        expect(sarif.runs[0].results).toHaveLength(1)

        const result = sarif.runs[0].results[0]
        expect(result.ruleId).toBe('A11Y-001')
        expect(result.level).toBe('error')
        expect(result.message.text).toContain('img-1')
        expect(result.message.text).toContain('A11Y-001')

        // Rule should be dynamically created for A11Y
        const rules = sarif.runs[0].tool.driver.rules!
        expect(rules).toHaveLength(1)
        expect(rules[0].id).toBe('A11Y-001')
        expect(rules[0].defaultConfiguration?.level).toBe('error')
    })

    it('should include parse errors as FLINT-PARSE results', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [
                {
                    filePath: 'src/broken.tsx',
                    mithrilWarnings: [],
                    a11yViolations: {},
                    parseError: 'Failed to parse src/broken.tsx',
                },
            ],
        }

        const sarif = buildSarifReport(summary)
        expect(sarif.runs[0].results).toHaveLength(1)

        const result = sarif.runs[0].results[0]
        expect(result.ruleId).toBe('FLINT-PARSE')
        expect(result.level).toBe('error')
        expect(result.message.text).toContain('broken.tsx')

        const rules = sarif.runs[0].tool.driver.rules!
        expect(rules.some((r) => r.id === 'FLINT-PARSE')).toBe(true)
    })

    it('should handle an empty summary with no results', () => {
        const summary: AuditSummary = {
            totalFiles: 0,
            filesWithViolations: 0,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [],
        }

        const sarif = buildSarifReport(summary)
        expect(sarif.runs).toHaveLength(1)
        expect(sarif.runs[0].results).toEqual([])
        expect(sarif.runs[0].tool.driver.rules).toEqual([])
    })

    it('should normalize file paths in SARIF locations', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 1,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 1,
            results: [
                {
                    filePath: './src\\components\\Button.tsx',
                    mithrilWarnings: [
                        {
                            id: 'node-1',
                            type: 'color-drift',
                            severity: 'amber',
                            value: 3.5,
                            message: 'MITHRIL-COL: color drift detected',
                            nearestToken: 'primary',
                            nearestTokenValue: '#3b82f6',
                        },
                    ],
                    a11yViolations: {},
                    parseError: null,
                },
            ],
        }

        const sarif = buildSarifReport(summary)
        const uri =
            sarif.runs[0].results[0].locations![0].physicalLocation
                .artifactLocation.uri
        // Backslashes converted to forward slashes, leading ./ stripped
        expect(uri).toBe('src/components/Button.tsx')
        expect(uri).not.toContain('\\')
        expect(uri).not.toMatch(/^\.\//)
    })

    it('should handle multiple file results with mixed violation types', () => {
        const summary: AuditSummary = {
            totalFiles: 3,
            filesWithViolations: 2,
            totalMithrilWarnings: 1,
            totalA11yViolations: 2,
            criticalCount: 3,
            amberCount: 0,
            results: [
                {
                    filePath: 'src/Clean.tsx',
                    mithrilWarnings: [],
                    a11yViolations: {},
                    parseError: null,
                },
                {
                    filePath: 'src/Drifty.tsx',
                    mithrilWarnings: [
                        {
                            id: 'node-1',
                            type: 'color-drift',
                            severity: 'critical',
                            value: 12.0,
                            message: 'MITHRIL-COL: major color drift',
                            nearestToken: null,
                            nearestTokenValue: null,
                        },
                    ],
                    a11yViolations: {},
                    parseError: null,
                },
                {
                    filePath: 'src/Inaccessible.tsx',
                    mithrilWarnings: [],
                    a11yViolations: {
                        'img-1': ['A11Y-001: missing alt'],
                        'btn-1': ['A11Y-002: empty button'],
                    },
                    parseError: null,
                },
            ],
        }

        const sarif = buildSarifReport(summary)
        // 1 mithril + 2 a11y = 3 results
        expect(sarif.runs[0].results).toHaveLength(3)

        // Should have 3 distinct rules
        const ruleIds = sarif.runs[0].tool.driver.rules!.map((r) => r.id)
        expect(ruleIds).toContain('MITHRIL-COL')
        expect(ruleIds).toContain('A11Y-001')
        expect(ruleIds).toContain('A11Y-002')
    })

    it('should set uriBaseId to %SRCROOT% on all locations', () => {
        const summary: AuditSummary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 1,
            criticalCount: 1,
            amberCount: 0,
            results: [
                {
                    filePath: 'src/Comp.tsx',
                    mithrilWarnings: [],
                    a11yViolations: {
                        'elem-1': ['A11Y-001: missing alt'],
                    },
                    parseError: null,
                },
            ],
        }

        const sarif = buildSarifReport(summary)
        for (const result of sarif.runs[0].results) {
            for (const loc of result.locations ?? []) {
                expect(
                    loc.physicalLocation.artifactLocation.uriBaseId,
                ).toBe('%SRCROOT%')
            }
        }
    })
})

// ── DEFAULT_POLICY ───────────────────────────────────────────────────────────

describe('DEFAULT_POLICY', () => {
    it('should have expected structure', () => {
        expect(DEFAULT_POLICY).toBeDefined()
        expect(DEFAULT_POLICY.version).toBe(1)
        expect(DEFAULT_POLICY.mithril).toBeDefined()
        expect(DEFAULT_POLICY.mithril.mode).toBe('blocking')
        expect(DEFAULT_POLICY.mithril.deltaE_threshold).toBe(2.0)
        expect(DEFAULT_POLICY.mithril.deltaE_critical_threshold).toBe(10.0)
        expect(DEFAULT_POLICY.a11y).toBeDefined()
        expect(DEFAULT_POLICY.a11y.mode).toBe('blocking')
        expect(DEFAULT_POLICY.a11y.level).toBe('AA')
        expect(DEFAULT_POLICY.a11y.disabled_rules).toEqual([])
        expect(DEFAULT_POLICY.export_gate).toBeDefined()
    })
})
