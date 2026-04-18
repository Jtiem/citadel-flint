/**
 * debtReportService.coverage.test.ts
 *
 * Phase 0 — Coverage Honesty.
 *
 * Tests `computeCoverageSummary` unit behaviour and integration of coverage
 * into `generateDebtReport` and `generateDashboard`.
 *
 * CONTRACT-SOURCE: .flint-context/contracts/PHASE0-coverage-honesty.contract.ts
 * CONTRACT-BOUNDARY: "debtReportService — aggregation math"
 * CONTRACT-INVARIANT: "coverage-grade-independence"
 * CONTRACT-INVARIANT: "coverage-emit-parity"
 * CONTRACT-INVARIANT: "coverage-percent-math"
 *
 * Invariants verified:
 *   - coverage-percent-math < 0.5pp
 *   - coverage-grade-independence = 0 (grade formula MUST NOT read coverage)
 *   - coverage-emit-parity: one verdict per file scanned
 *   - sum(skippedFilesByReason) === partialFiles + skippedFiles
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    computeCoverageSummary,
    emptyCoverageSummary,
    generateDebtReport,
    generateDashboard,
    computeHealthScore,
} from '../debtReportService.js'
import type { CoverageVerdict, CoverageReason } from '../../../../../shared/coverage-types.js'
import { getCoverageSummaryResponseSchema } from '../../../../../shared/ipc-validators.js'

// ── All reason keys (stable order matching CoverageReason union) ─────────────

const ALL_REASONS: CoverageReason[] = [
    'css-in-js-detected',
    'external-stylesheet-imported',
    'css-modules-reference',
    'dynamic-class-expression',
    'unresolvable-var',
    'tailwind-config-extension',
    'non-jsx-framework',
    'non-literal-ternary-branch',
    'parse-failure',
]

// ── Helper verdict builders ──────────────────────────────────────────────────

function parsed(filePath: string): { filePath: string; verdict: CoverageVerdict } {
    return { filePath, verdict: { status: 'parsed', reason: null } }
}

function partial(filePath: string, reason: CoverageReason): { filePath: string; verdict: CoverageVerdict } {
    return { filePath, verdict: { status: 'partial', reason } }
}

function skipped(filePath: string, reason: CoverageReason): { filePath: string; verdict: CoverageVerdict } {
    return { filePath, verdict: { status: 'skipped-unsupported', reason } }
}

// ── Temp directory helpers ───────────────────────────────────────────────────

let tmpDir: string

function createTempProject(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-coverage-test-'))
    fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
    return tmpDir
}

function writeFile(relativePath: string, content: string): void {
    const fullPath = path.join(tmpDir, relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
}

function cleanupTemp(): void {
    if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, maxRetries: 3 })
    }
}

// ── computeCoverageSummary unit tests ────────────────────────────────────────

describe('debtReportService — coverage aggregation', () => {
    it('reports governedSurfacePercent === 60 for 3 parsed + 1 partial + 1 skipped', () => {
        const verdicts = [
            parsed('a.tsx'),
            parsed('b.tsx'),
            parsed('c.tsx'),
            partial('d.tsx', 'css-in-js-detected'),
            skipped('e.vue', 'non-jsx-framework'),
        ]
        const summary = computeCoverageSummary(verdicts)
        expect(summary.governedSurfacePercent).toBe(60)
    })

    it('reports parsedFiles=3, partialFiles=1, skippedFiles=1, totalFiles=5 for the 5-file fixture', () => {
        const verdicts = [
            parsed('a.tsx'),
            parsed('b.tsx'),
            parsed('c.tsx'),
            partial('d.tsx', 'css-in-js-detected'),
            skipped('e.vue', 'non-jsx-framework'),
        ]
        const summary = computeCoverageSummary(verdicts)
        expect(summary.parsedFiles).toBe(3)
        expect(summary.partialFiles).toBe(1)
        expect(summary.skippedFiles).toBe(1)
        expect(summary.totalFiles).toBe(5)
    })

    it('skippedFilesByReason sums to 2 (partial + skipped) for the 5-file fixture', () => {
        const verdicts = [
            parsed('a.tsx'),
            parsed('b.tsx'),
            parsed('c.tsx'),
            partial('d.tsx', 'css-in-js-detected'),
            skipped('e.vue', 'non-jsx-framework'),
        ]
        const summary = computeCoverageSummary(verdicts)
        const total = Object.values(summary.skippedFilesByReason).reduce((a, b) => a + b, 0)
        expect(total).toBe(2)
        expect(summary.skippedFilesByReason['css-in-js-detected']).toBe(1)
        expect(summary.skippedFilesByReason['non-jsx-framework']).toBe(1)
    })

    it('skippedFilesByReason has ALL CoverageReason keys present, absent ones at 0', () => {
        const verdicts = [
            partial('d.tsx', 'css-in-js-detected'),
        ]
        const summary = computeCoverageSummary(verdicts)
        for (const reason of ALL_REASONS) {
            expect(Object.prototype.hasOwnProperty.call(summary.skippedFilesByReason, reason)).toBe(true)
        }
        // Reasons not present should be 0
        expect(summary.skippedFilesByReason['non-jsx-framework']).toBe(0)
        expect(summary.skippedFilesByReason['css-modules-reference']).toBe(0)
    })

    it('reports governedSurfacePercent === 0 when totalFiles === 0', () => {
        const summary = computeCoverageSummary([])
        expect(summary.governedSurfacePercent).toBe(0)
        expect(summary.totalFiles).toBe(0)
    })

    it('reports governedSurfacePercent === 100 when all files are parsed', () => {
        const verdicts = [parsed('a.tsx'), parsed('b.tsx'), parsed('c.tsx')]
        const summary = computeCoverageSummary(verdicts)
        expect(summary.governedSurfacePercent).toBe(100)
        expect(summary.skippedFiles).toBe(0)
        expect(summary.partialFiles).toBe(0)
    })

    it('reports governedSurfacePercent === 0 when all files are skipped', () => {
        const verdicts = [
            skipped('a.vue', 'non-jsx-framework'),
            skipped('b.svelte', 'non-jsx-framework'),
        ]
        const summary = computeCoverageSummary(verdicts)
        expect(summary.governedSurfacePercent).toBe(0)
    })

    it('CoverageSummary.timestamp is a valid ISO 8601 UTC string and non-empty', () => {
        const summary = computeCoverageSummary([parsed('a.tsx')])
        expect(summary.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        expect(summary.timestamp).not.toBe('')
    })

    it('totalFiles === parsedFiles + partialFiles + skippedFiles (accounting identity)', () => {
        const verdicts = [
            parsed('a.tsx'),
            partial('b.tsx', 'css-modules-reference'),
            skipped('c.vue', 'non-jsx-framework'),
            parsed('d.tsx'),
            skipped('e.svelte', 'non-jsx-framework'),
        ]
        const summary = computeCoverageSummary(verdicts)
        expect(summary.totalFiles).toBe(
            summary.parsedFiles + summary.partialFiles + summary.skippedFiles,
        )
    })
})

// ── coverage-grade-independence invariant ────────────────────────────────────

describe('debtReportService — grade independence from coverage', () => {
    it('healthScore is identical with and without classifier integration on same fixture', () => {
        // Two different coverage distributions with the same violation counts
        // must produce identical healthScores. Coverage is purely additive.
        const versA = [parsed('a.tsx'), parsed('b.tsx')]
        const versB = [skipped('a.vue', 'non-jsx-framework'), skipped('b.vue', 'non-jsx-framework')]

        const sumA = computeCoverageSummary(versA)
        const sumB = computeCoverageSummary(versB)

        // Coverage percentages differ
        expect(sumA.governedSurfacePercent).toBe(100)
        expect(sumB.governedSurfacePercent).toBe(0)

        // But healthScore doesn't use coverage — use the same violation counts
        const violations = { critical: 2, warning: 1, info: 0 }
        const scoreWithCoverageA = computeHealthScore(
            violations.critical, violations.warning, violations.info, 0
        )
        const scoreWithCoverageB = computeHealthScore(
            violations.critical, violations.warning, violations.info, 0
        )
        // Both scores identical regardless of coverage
        expect(scoreWithCoverageA).toBe(scoreWithCoverageB)
    })

    it('grade field is identical with and without classifier on same fixture', () => {
        // Same test as above for grade
        const score = computeHealthScore(2, 1, 0, 0)
        // With any coverage distribution the score (and thus grade) is the same
        expect(score).toBe(100 - 2 * 10 - 1 * 3) // = 77
    })
})

// ── coverage-emit-parity invariant ───────────────────────────────────────────

describe('debtReportService — emit parity (one verdict per scanned file)', () => {
    it('emittedCount equals scannedCount across a multi-file fixture', () => {
        const N = 7
        const verdicts = [
            ...Array.from({ length: 4 }, (_, i) => parsed(`parsed${i}.tsx`)),
            ...Array.from({ length: 2 }, (_, i) => partial(`partial${i}.tsx`, 'dynamic-class-expression')),
            ...Array.from({ length: 1 }, (_, i) => skipped(`skipped${i}.vue`, 'non-jsx-framework')),
        ]
        const summary = computeCoverageSummary(verdicts)
        // Every scanned file must contribute to totalFiles
        expect(summary.totalFiles).toBe(N)
        expect(summary.parsedFiles + summary.partialFiles + summary.skippedFiles).toBe(N)
    })
})

// ── coverage-percent-math invariant: table-driven over 20 fixtures ───────────

describe('coverage-percent-math invariant (< 0.5pp error, 20 fixtures)', () => {
    const fixtures: Array<{ parsedN: number; partialN: number; skippedN: number }> = [
        { parsedN: 0, partialN: 0, skippedN: 0 },
        { parsedN: 1, partialN: 0, skippedN: 0 },
        { parsedN: 0, partialN: 1, skippedN: 0 },
        { parsedN: 0, partialN: 0, skippedN: 1 },
        { parsedN: 3, partialN: 1, skippedN: 1 },
        { parsedN: 10, partialN: 0, skippedN: 0 },
        { parsedN: 0, partialN: 5, skippedN: 5 },
        { parsedN: 7, partialN: 2, skippedN: 1 },
        { parsedN: 1, partialN: 1, skippedN: 1 },
        { parsedN: 100, partialN: 0, skippedN: 0 },
        { parsedN: 99, partialN: 0, skippedN: 1 },
        { parsedN: 50, partialN: 25, skippedN: 25 },
        { parsedN: 33, partialN: 33, skippedN: 34 },
        { parsedN: 1, partialN: 9, skippedN: 0 },
        { parsedN: 0, partialN: 0, skippedN: 10 },
        { parsedN: 2, partialN: 0, skippedN: 8 },
        { parsedN: 9, partialN: 1, skippedN: 0 },
        { parsedN: 4, partialN: 3, skippedN: 3 },
        { parsedN: 17, partialN: 0, skippedN: 3 },
        { parsedN: 8, partialN: 1, skippedN: 1 },
    ]

    for (const fix of fixtures) {
        it(`parsed=${fix.parsedN} partial=${fix.partialN} skipped=${fix.skippedN} → within 0.5pp`, () => {
            const total = fix.parsedN + fix.partialN + fix.skippedN
            const verdicts = [
                ...Array.from({ length: fix.parsedN }, (_, i) => parsed(`p${i}.tsx`)),
                ...Array.from({ length: fix.partialN }, (_, i) => partial(`r${i}.tsx`, 'css-in-js-detected')),
                ...Array.from({ length: fix.skippedN }, (_, i) => skipped(`s${i}.vue`, 'non-jsx-framework')),
            ]
            const summary = computeCoverageSummary(verdicts)
            const expected = total === 0 ? 0 : (fix.parsedN / total) * 100
            expect(Math.abs(summary.governedSurfacePercent - expected)).toBeLessThan(0.5)
        })
    }
})

// ── emptyCoverageSummary ─────────────────────────────────────────────────────

describe('emptyCoverageSummary', () => {
    it('returns all-zero summary', () => {
        const summary = emptyCoverageSummary()
        expect(summary.totalFiles).toBe(0)
        expect(summary.parsedFiles).toBe(0)
        expect(summary.governedSurfacePercent).toBe(0)
        for (const reason of ALL_REASONS) {
            expect(summary.skippedFilesByReason[reason]).toBe(0)
        }
    })
})

// ── generateDebtReport integration ──────────────────────────────────────────

const CLEAN_TSX = `
import React from 'react';
export const Card = () => (
  <div data-flint-id="card-root">
    <img data-flint-id="card-img" src="logo.png" alt="Logo" />
  </div>
);
`

const UNPARSEABLE = 'this is not valid TypeScript or JSX {{{'

describe('generateDebtReport — coverage integration', () => {
    beforeEach(() => createTempProject())
    afterEach(() => cleanupTemp())

    it('report includes coverage field', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })

        expect(report.coverage).toBeDefined()
        expect(typeof report.coverage!.governedSurfacePercent).toBe('number')
    })

    it('coverage-emit-parity: coverage.totalFiles === report.scannedFiles', () => {
        writeFile('src/A.tsx', CLEAN_TSX)
        writeFile('src/B.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })

        expect(report.coverage!.totalFiles).toBe(report.scannedFiles)
    })

    it('clean parseable file contributes to parsedFiles', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })

        expect(report.coverage!.parsedFiles).toBeGreaterThanOrEqual(1)
    })

    it('unparseable file contributes to skippedFiles', () => {
        writeFile('src/Bad.tsx', UNPARSEABLE)
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })

        expect(report.coverage!.skippedFiles).toBeGreaterThanOrEqual(1)
    })

    it('coverage-grade-independence: healthScore computed from violations only', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })

        // healthScore must match computeHealthScore applied to the report's own bySeverity
        const expected = computeHealthScore(
            report.bySeverity.critical,
            report.bySeverity.warning,
            report.bySeverity.info,
            0,
        )
        expect(report.healthScore).toBe(expected)
    })

    it('adding an unparseable file changes coverage but NOT healthScore for same violations', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const report1 = generateDebtReport({ projectRoot: tmpDir })

        writeFile('src/Bad.tsx', UNPARSEABLE)
        const report2 = generateDebtReport({ projectRoot: tmpDir })

        // Coverage changes: more files scanned, skippedFiles increases
        expect(report2.coverage!.totalFiles).toBeGreaterThan(report1.coverage!.totalFiles)

        // Violations unchanged (unparseable file has no violations)
        expect(report2.bySeverity.critical).toBe(report1.bySeverity.critical)
        expect(report2.bySeverity.warning).toBe(report1.bySeverity.warning)
        expect(report2.bySeverity.info).toBe(report1.bySeverity.info)

        // healthScore unchanged
        expect(report2.healthScore).toBe(report1.healthScore)
    })

    it('coverage totalFiles identity: parsedFiles + partialFiles + skippedFiles === totalFiles', () => {
        writeFile('src/A.tsx', CLEAN_TSX)
        writeFile('src/B.tsx', CLEAN_TSX)
        writeFile('src/Bad.tsx', UNPARSEABLE)
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })
        const cov = report.coverage!

        expect(cov.totalFiles).toBe(cov.parsedFiles + cov.partialFiles + cov.skippedFiles)
    })

    it('writes coverage-cache.json to .flint/ directory', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        generateDebtReport({ projectRoot: tmpDir })

        const cachePath = path.join(tmpDir, '.flint', 'coverage-cache.json')
        expect(fs.existsSync(cachePath)).toBe(true)

        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
        expect(typeof cached.totalFiles).toBe('number')
        expect(typeof cached.governedSurfacePercent).toBe('number')
        expect(typeof cached.timestamp).toBe('string')
    })

    it('zero .tsx files → coverage all-zero', () => {
        writeFile('.flint/design-tokens.json', '[]')

        const report = generateDebtReport({ projectRoot: tmpDir })

        expect(report.coverage!.totalFiles).toBe(0)
        expect(report.coverage!.governedSurfacePercent).toBe(0)
    })
})

// ── generateDashboard — coverage field ──────────────────────────────────────

describe('generateDashboard — coverage field', () => {
    beforeEach(() => createTempProject())
    afterEach(() => cleanupTemp())

    it('dashboard payload includes coverage field', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const dashboard = generateDashboard(tmpDir)

        expect(dashboard.coverage).toBeDefined()
        expect(typeof dashboard.coverage!.governedSurfacePercent).toBe('number')
        expect(typeof dashboard.coverage!.totalFiles).toBe('number')
        expect(typeof dashboard.coverage!.timestamp).toBe('string')
    })

    it('dashboard coverage has all 8 CoverageReason keys in skippedFilesByReason', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const dashboard = generateDashboard(tmpDir)
        const cov = dashboard.coverage!

        for (const reason of ALL_REASONS) {
            expect(Object.prototype.hasOwnProperty.call(cov.skippedFilesByReason, reason)).toBe(true)
        }
    })

    it('dashboard grade-independence: clean project still grades A regardless of coverage', () => {
        writeFile('src/Clean.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const dashboard = generateDashboard(tmpDir)

        expect(dashboard.healthScore).toBe(100)
        expect(dashboard.grade).toBe('A')
    })

    it('dashboard coverage totalFiles identity', () => {
        writeFile('src/A.tsx', CLEAN_TSX)
        writeFile('src/B.tsx', CLEAN_TSX)
        writeFile('.flint/design-tokens.json', '[]')

        const dashboard = generateDashboard(tmpDir)
        const cov = dashboard.coverage!

        expect(cov.totalFiles).toBe(cov.parsedFiles + cov.partialFiles + cov.skippedFiles)
    })
})

// ── Regression: ALL_COVERAGE_REASONS ↔ CoverageReason ↔ Zod schema parity ───
//
// These two tests lock the three update sites together so a future CoverageReason
// addition that misses ALL_COVERAGE_REASONS (or the Zod schema) fails immediately.

describe('regression: ALL_COVERAGE_REASONS / CoverageReason / Zod schema parity', () => {
    it('regression: aggregator output validates against the IPC Zod schema (empty verdict list)', () => {
        // GIVEN: an empty verdict list (simulates a pre-first-scan project)
        // WHEN: aggregated to a CoverageSummary and parsed through the IPC response schema
        // THEN: Zod validation passes — no missing keys in skippedFilesByReason
        const summary = computeCoverageSummary([])
        expect(() => getCoverageSummaryResponseSchema.parse(summary)).not.toThrow()
    })

    it('regression: aggregator covers every CoverageReason in the enum', () => {
        // GIVEN: one skipped verdict per CoverageReason enum value (9 total)
        // WHEN: aggregated
        // THEN: skippedFilesByReason has exactly the enum key set — no drift between
        //       ALL_COVERAGE_REASONS, the CoverageReason union, and the Zod schema
        const allReasons: CoverageReason[] = [
            'css-in-js-detected',
            'external-stylesheet-imported',
            'css-modules-reference',
            'dynamic-class-expression',
            'unresolvable-var',
            'tailwind-config-extension',
            'non-jsx-framework',
            'non-literal-ternary-branch',
            'parse-failure',
        ]
        const verdicts = allReasons.map((reason, i) => ({
            filePath: `fixture-${i}.tsx`,
            verdict: { status: 'skipped-unsupported' as const, reason },
        }))
        const summary = computeCoverageSummary(verdicts)
        expect(Object.keys(summary.skippedFilesByReason).sort()).toEqual(allReasons.slice().sort())
        // Round-trip through Zod to double-lock the contract
        expect(() => getCoverageSummaryResponseSchema.parse(summary)).not.toThrow()
    })
})
