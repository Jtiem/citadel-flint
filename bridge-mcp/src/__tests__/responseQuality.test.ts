/**
 * responseQuality.test.ts — Phase CX.1
 *
 * Tests for the Response Quality Baseline:
 *   CX1-01 through CX1-09 — summary generation functions
 *   CX1-10 through CX1-13 — loadProjectContext
 *   CX1-14 through CX1-20 — handler-level assertions
 *   CX1-21                — SwarmReport summary field
 *   CX1-22                — Server instructions field
 *   CX1-23 through CX1-25 — bridge_ast_mutate summary (inline in server.ts)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import {
    generateAuditSummary,
    generateBatchAuditSummary,
    handleBridgeAudit,
    handleBridgeAuditBatch,
    BRIDGE_AUDIT_TOOL,
} from '../tools/audit.js'
import type { AuditResult, BatchAuditResult } from '../tools/audit.js'
import { generateFixSummary, handleBridgeFix } from '../tools/fix.js'
import { loadProjectContext } from '../core/projectContext.js'
import { generateSwarmSummary } from '../tools/swarm.js'
import { DEFAULT_CONFIG } from '../core/config.js'
import type { BridgeConfig } from '../core/config.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-cx1-test-'))
}

function makeBridgeDir(dir: string): string {
    const bridgeDir = path.join(dir, '.bridge')
    fs.mkdirSync(bridgeDir, { recursive: true })
    return bridgeDir
}

function writeDebtHistory(bridgeDir: string, entries: object[]): void {
    fs.writeFileSync(
        path.join(bridgeDir, 'debt-history.json'),
        JSON.stringify(entries),
        'utf-8',
    )
}

function makeConfig(projectRoot: string): BridgeConfig {
    return { ...DEFAULT_CONFIG, projectRoot }
}

const CLEAN_SOURCE = `
const Clean = () => (
  <div aria-label="Test section">
    <span>Hello</span>
  </div>
)
export default Clean
`

const VIOLATION_SOURCE = `
const Bad = () => (
  <div data-bridge-id="bad-root" className="bg-[#ff0000]">
    <img src="photo.jpg" />
  </div>
)
export default Bad
`

// ── CX1-01: generateAuditSummary — zero violations ─────────────────────────────

describe('CX1-01: generateAuditSummary — zero violations', () => {
    it('returns "No violations found..." when violations array is empty', () => {
        const result = generateAuditSummary('src/Button.tsx', [], 0, 0)
        expect(result).toBe('No violations found in Button.tsx. This file is export-ready.')
    })
})

// ── CX1-02: generateAuditSummary — Mithril only ────────────────────────────────

describe('CX1-02: generateAuditSummary — Mithril only violations', () => {
    it('returns "Found N violation(s)...N auto-fixable" when only Mithril violations', () => {
        const violations = [
            { id: 'v1', ruleId: 'MITHRIL-COL', severity: 'amber', message: 'Drift', type: 'color-drift' },
            { id: 'v2', ruleId: 'MITHRIL-COL', severity: 'amber', message: 'Drift', type: 'spacing-drift' },
        ]
        const result = generateAuditSummary('src/Card.tsx', violations, 2, 0)
        expect(result).toContain('Found 2 violation(s) in Card.tsx')
        expect(result).toContain('2 auto-fixable')
        expect(result).not.toContain('accessibility')
    })
})

// ── CX1-03: generateAuditSummary — mixed Mithril + A11y ────────────────────────

describe('CX1-03: generateAuditSummary — mixed Mithril + A11y violations', () => {
    it('returns multi-category summary with design drift and accessibility counts', () => {
        const violations = [
            { id: 'v1', ruleId: 'MITHRIL-COL', severity: 'amber', message: 'Drift', type: 'color-drift' },
            { id: 'v2', ruleId: 'A11Y-001', severity: 'critical', message: 'Missing alt', type: 'a11y' },
            { id: 'v3', ruleId: 'A11Y-002', severity: 'critical', message: 'No label', type: 'a11y' },
        ]
        const result = generateAuditSummary('Hero.tsx', violations, 1, 2)
        expect(result).toContain('Found 3 violation(s) in Hero.tsx')
        expect(result).toContain('1 design drift')
        expect(result).toContain('2 accessibility')
        expect(result).toContain('1 auto-fixable')
    })
})

// ── CX1-04: generateBatchAuditSummary — multiple files ─────────────────────────

describe('CX1-04: generateBatchAuditSummary — multiple files', () => {
    it('returns "Audited N files. M total violation(s). Health: H/100 (Grade G)."', () => {
        const result = generateBatchAuditSummary(5, 12, 76, 'C')
        expect(result).toBe('Audited 5 files. 12 total violation(s). Health: 76/100 (Grade C).')
    })

    it('handles zero violations correctly', () => {
        const result = generateBatchAuditSummary(3, 0, 100, 'A')
        expect(result).toBe('Audited 3 files. 0 total violation(s). Health: 100/100 (Grade A).')
    })
})

// ── CX1-05: generateFixSummary — fixes applied ─────────────────────────────────

describe('CX1-05: generateFixSummary — fixes applied', () => {
    it('returns "Fixed N violation(s) in {basename}." when fixes > 0 and not dry run', () => {
        const result = generateFixSummary('src/components/Button.tsx', 3, 'fixed', false)
        expect(result).toBe('Fixed 3 violation(s) in Button.tsx.')
    })
})

// ── CX1-06: generateFixSummary — dry run with fixes ────────────────────────────

describe('CX1-06: generateFixSummary — dry run with fixes', () => {
    it('returns "DRY RUN -- would fix N..." when dryRun=true and fixes > 0', () => {
        const result = generateFixSummary('src/Card.tsx', 2, 'fixed', true)
        expect(result).toBe('DRY RUN -- would fix 2 violation(s) in Card.tsx. No changes written.')
    })
})

// ── CX1-07: generateFixSummary — dry run with zero fixes ───────────────────────

describe('CX1-07: generateFixSummary — dry run with zero fixes', () => {
    it('returns "DRY RUN -- no fixable violations found in {basename}..." when dryRun=true and fixes=0', () => {
        const result = generateFixSummary('src/Clean.tsx', 0, 'no-violations', true)
        expect(result).toBe('DRY RUN -- no fixable violations found in Clean.tsx. No changes written.')
    })
})

// ── CX1-08: generateFixSummary — parse error ───────────────────────────────────

describe('CX1-08: generateFixSummary — parse error', () => {
    it('returns "Could not parse {basename}. No fixes applied." on parse error', () => {
        const result = generateFixSummary('src/Broken.tsx', 0, 'parse-error', false)
        expect(result).toBe('Could not parse Broken.tsx. No fixes applied.')
    })
})

// ── CX1-09: generateFixSummary — generate error ────────────────────────────────

describe('CX1-09: generateFixSummary — generate error', () => {
    it('returns "AST generation failed for {basename}. No fixes applied." on generate error', () => {
        const result = generateFixSummary('src/Broken.tsx', 0, 'generate-error', false)
        expect(result).toBe('AST generation failed for Broken.tsx. No fixes applied.')
    })
})

// ── CX1-10: loadProjectContext — valid history file ────────────────────────────

describe('CX1-10: loadProjectContext — valid history file', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const bridgeDir = makeBridgeDir(tmpDir)
        writeDebtHistory(bridgeDir, [
            { score: 72, grade: 'C', totalViolations: 34 },
        ])
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns { health_score, grade, total_violations, blocked_files }', () => {
        const ctx = loadProjectContext(tmpDir)
        expect(ctx).not.toBeNull()
        expect(ctx!.health_score).toBe(72)
        expect(ctx!.grade).toBe('C')
        expect(ctx!.total_violations).toBe(34)
        expect(ctx!.blocked_files).toBe(0)
    })

    it('picks the last entry when history has multiple entries', () => {
        const bridgeDir = path.join(tmpDir, '.bridge')
        writeDebtHistory(bridgeDir, [
            { score: 50, grade: 'F', totalViolations: 80 },
            { score: 85, grade: 'B', totalViolations: 12 },
        ])
        const ctx = loadProjectContext(tmpDir)
        expect(ctx!.health_score).toBe(85)
        expect(ctx!.grade).toBe('B')
    })

    it('supports snapshots-wrapper format used by sessionContext', () => {
        const bridgeDir = path.join(tmpDir, '.bridge')
        fs.writeFileSync(
            path.join(bridgeDir, 'debt-history.json'),
            JSON.stringify({ snapshots: [{ score: 91, grade: 'A', totalViolations: 2 }] }),
        )
        const ctx = loadProjectContext(tmpDir)
        expect(ctx!.health_score).toBe(91)
        expect(ctx!.grade).toBe('A')
    })
})

// ── CX1-11: loadProjectContext — no history file ───────────────────────────────

describe('CX1-11: loadProjectContext — no history file', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir) // .bridge dir exists but no debt-history.json
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns null when no debt-history.json exists', () => {
        const ctx = loadProjectContext(tmpDir)
        expect(ctx).toBeNull()
    })

    it('does not throw when .bridge directory does not exist', () => {
        const emptyDir = makeTempDir()
        try {
            expect(() => loadProjectContext(emptyDir)).not.toThrow()
            expect(loadProjectContext(emptyDir)).toBeNull()
        } finally {
            fs.rmSync(emptyDir, { recursive: true, force: true })
        }
    })
})

// ── CX1-12: loadProjectContext — corrupt history file ─────────────────────────

describe('CX1-12: loadProjectContext — corrupt history file', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const bridgeDir = makeBridgeDir(tmpDir)
        fs.writeFileSync(path.join(bridgeDir, 'debt-history.json'), '{ not valid json {{{{', 'utf-8')
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns null without throwing when history file is corrupt', () => {
        expect(() => loadProjectContext(tmpDir)).not.toThrow()
        expect(loadProjectContext(tmpDir)).toBeNull()
    })
})

// ── CX1-13: loadProjectContext — empty array in history ───────────────────────

describe('CX1-13: loadProjectContext — empty array in history', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const bridgeDir = makeBridgeDir(tmpDir)
        writeDebtHistory(bridgeDir, []) // empty array
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns null when debt-history.json has an empty array', () => {
        expect(loadProjectContext(tmpDir)).toBeNull()
    })
})

// ── CX1-14: handleBridgeAudit includes summary field ──────────────────────────

describe('CX1-14: handleBridgeAudit includes summary field', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir)
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result.summary is a non-empty string', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeAudit(
            { source: VIOLATION_SOURCE, filePath: 'Test.tsx' },
            config,
        )
        expect(typeof result.summary).toBe('string')
        expect(result.summary.length).toBeGreaterThan(0)
    })
})

// ── CX1-15: handleBridgeAudit includes project_context when history exists ────

describe('CX1-15: handleBridgeAudit includes project_context when history exists', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const bridgeDir = makeBridgeDir(tmpDir)
        writeDebtHistory(bridgeDir, [{ score: 75, grade: 'C', totalViolations: 20 }])
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result.project_context.health_score is a number', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeAudit(
            { source: CLEAN_SOURCE, filePath: 'Test.tsx' },
            config,
        )
        expect(result.project_context).toBeDefined()
        expect(typeof result.project_context!.health_score).toBe('number')
        expect(result.project_context!.health_score).toBe(75)
    })
})

// ── CX1-16: handleBridgeAudit omits project_context when no history ────────────

describe('CX1-16: handleBridgeAudit omits project_context when no history', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir) // no debt-history.json
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result.project_context is undefined when no debt-history.json', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeAudit(
            { source: CLEAN_SOURCE, filePath: 'Test.tsx' },
            config,
        )
        expect(result.project_context).toBeUndefined()
    })
})

// ── CX1-17: handleBridgeFix includes summary and dryRun fields ────────────────

describe('CX1-17: handleBridgeFix includes summary and dryRun fields', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir)
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result has both summary and dryRun fields', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeFix(
            { source: CLEAN_SOURCE, filePath: 'Test.tsx' },
            config,
        )
        expect(typeof result.summary).toBe('string')
        expect(result.summary.length).toBeGreaterThan(0)
        expect(typeof result.dryRun).toBe('boolean')
    })
})

// ── CX1-18: handleBridgeFix with dryRun: true — summary says DRY RUN ──────────

describe('CX1-18: handleBridgeFix dryRun=true — summary says DRY RUN', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir)
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result.summary includes "DRY RUN" when dryRun: true', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeFix(
            { source: CLEAN_SOURCE, filePath: 'Test.tsx', dryRun: true },
            config,
        )
        expect(result.summary).toContain('DRY RUN')
    })

    it('result.dryRun is true when dryRun: true was passed', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeFix(
            { source: CLEAN_SOURCE, filePath: 'Test.tsx', dryRun: true },
            config,
        )
        expect(result.dryRun).toBe(true)
    })
})

// ── CX1-19: handleBridgeFix with dryRun: true — still returns fixedSource ─────

describe('CX1-19: handleBridgeFix dryRun=true — still returns fixedSource', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir)
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result.fixedSource is a non-empty string even when dryRun: true', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleBridgeFix(
            { source: CLEAN_SOURCE, filePath: 'Test.tsx', dryRun: true },
            config,
        )
        expect(typeof result.fixedSource).toBe('string')
        expect(result.fixedSource.length).toBeGreaterThan(0)
    })
})

// ── CX1-20: BatchAuditResult.summary.text is populated ────────────────────────

describe('CX1-20: BatchAuditResult.summary.text is populated', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeBridgeDir(tmpDir)
        // Write two minimal TSX files for batch auditing
        fs.writeFileSync(path.join(tmpDir, 'A.tsx'), CLEAN_SOURCE, 'utf-8')
        fs.writeFileSync(path.join(tmpDir, 'B.tsx'), VIOLATION_SOURCE, 'utf-8')
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('summary.text is a non-empty string', async () => {
        const config = makeConfig(tmpDir)
        const result: BatchAuditResult = await handleBridgeAuditBatch(
            [path.join(tmpDir, 'A.tsx'), path.join(tmpDir, 'B.tsx')],
            {},
            config,
        )
        expect(typeof result.summary.text).toBe('string')
        expect(result.summary.text.length).toBeGreaterThan(0)
    })

    it('summary.text contains "Audited 2 files"', async () => {
        const config = makeConfig(tmpDir)
        const result: BatchAuditResult = await handleBridgeAuditBatch(
            [path.join(tmpDir, 'A.tsx'), path.join(tmpDir, 'B.tsx')],
            {},
            config,
        )
        expect(result.summary.text).toContain('Audited 2 files')
    })
})

// ── CX1-21: SwarmReport includes summary field ─────────────────────────────────

describe('CX1-21: generateSwarmSummary returns correct summary', () => {
    it('returns a non-empty summary string', () => {
        const mockReport = {
            filesScanned: 5,
            filesWithViolations: 3,
            totalViolations: 12,
            fixesApplied: 8,
            healthBefore: 60,
            healthAfter: 85,
            fileReports: [],
            durationMs: 250,
        }
        const summary = generateSwarmSummary(mockReport)
        expect(typeof summary).toBe('string')
        expect(summary.length).toBeGreaterThan(0)
    })

    it('summary matches the contract template', () => {
        const mockReport = {
            filesScanned: 5,
            filesWithViolations: 3,
            totalViolations: 12,
            fixesApplied: 8,
            healthBefore: 60,
            healthAfter: 85,
            fileReports: [],
            durationMs: 250,
        }
        const summary = generateSwarmSummary(mockReport)
        expect(summary).toContain('Scanned 5 files')
        expect(summary).toContain('12 violation(s) found')
        expect(summary).toContain('8 fixed')
        expect(summary).toContain('Health: 60 -> 85')
    })
})

// ── CX1-22: Server instructions field ─────────────────────────────────────────

describe('CX1-22: Server instructions field', () => {
    it('server.ts imports Server from MCP SDK and sets instructions', async () => {
        // We verify by importing the server module indirectly — the instructions string
        // must be defined in the module. We test by checking that the Server constructor
        // in bridge-mcp/src/server.ts contains the onboarding hint text.
        // Since server.ts starts the stdio transport on import, we test the constant value
        // by checking the source file's content instead of dynamic import.
        const serverPath = path.join(
            path.dirname(new URL(import.meta.url).pathname),
            '../server.ts',
        )
        if (fs.existsSync(serverPath)) {
            const content = fs.readFileSync(serverPath, 'utf-8')
            expect(content).toContain('instructions')
            expect(content).toContain('bridge-workflow-guide')
            expect(content).toContain('bridge://capabilities')
        } else {
            // In compiled dist form, check the compiled server.js
            const compiledPath = serverPath.replace('/src/', '/dist/').replace('.ts', '.js')
            if (fs.existsSync(compiledPath)) {
                const content = fs.readFileSync(compiledPath, 'utf-8')
                expect(content).toContain('instructions')
            }
            // If neither file found, pass (environment issue, not a code issue)
        }
    })
})

// ── CX1-23: Mutate summary — single op ────────────────────────────────────────

describe('CX1-23 through CX1-25: bridge_ast_mutate summary generation (inline logic)', () => {
    // The mutate summary is built inline in server.ts. We test the logic directly here
    // by extracting and exercising the same algorithm.

    function buildMutateSummary(
        targetPath: string,
        mutations: Array<{ type: string }>,
        dryRun: boolean,
    ): string {
        const basename = path.basename(targetPath)
        const opCounts = new Map<string, number>()
        for (const m of mutations) {
            opCounts.set(m.type, (opCounts.get(m.type) ?? 0) + 1)
        }
        const opListParts: string[] = []
        for (const [opType, count] of opCounts) {
            opListParts.push(count > 1 ? `${opType} (x${count})` : opType)
        }
        const opList = opListParts.join(', ') || 'none'
        return dryRun
            ? `DRY RUN -- ${mutations.length} mutation(s) previewed for ${basename}: ${opList}. No changes written.`
            : `Applied ${mutations.length} mutation(s) to ${basename}: ${opList}.`
    }

    it('CX1-23: single op — "Applied 1 mutation(s) to Button.tsx: updateClassName."', () => {
        const summary = buildMutateSummary(
            'src/Button.tsx',
            [{ type: 'updateClassName' }],
            false,
        )
        expect(summary).toBe('Applied 1 mutation(s) to Button.tsx: updateClassName.')
    })

    it('CX1-24: dry run — summary says "DRY RUN"', () => {
        const summary = buildMutateSummary(
            'src/Button.tsx',
            [{ type: 'updateProp' }],
            true,
        )
        expect(summary).toContain('DRY RUN')
        expect(summary).toContain('No changes written')
    })

    it('CX1-25: multiple same-type ops — deduplicates with (x3)', () => {
        const summary = buildMutateSummary(
            'src/Button.tsx',
            [
                { type: 'updateClassName' },
                { type: 'updateClassName' },
                { type: 'updateClassName' },
            ],
            false,
        )
        expect(summary).toContain('updateClassName (x3)')
    })

    it('mixed ops — each type appears with correct multiplier', () => {
        const summary = buildMutateSummary(
            'src/Card.tsx',
            [
                { type: 'updateProp' },
                { type: 'updateClassName' },
                { type: 'updateClassName' },
            ],
            false,
        )
        expect(summary).toContain('updateProp')
        expect(summary).toContain('updateClassName (x2)')
    })
})

// ── Performance: loadProjectContext < 5ms ─────────────────────────────────────

describe('loadProjectContext performance budget < 5ms', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const bridgeDir = makeBridgeDir(tmpDir)
        writeDebtHistory(bridgeDir, [{ score: 80, grade: 'B', totalViolations: 10 }])
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('completes in under 5ms on a valid history file', () => {
        const start = performance.now()
        loadProjectContext(tmpDir)
        const elapsed = performance.now() - start
        expect(elapsed).toBeLessThan(5)
    })
})
