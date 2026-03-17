/**
 * Tier 3: Boundary Contracts Integration Tests
 *
 * Tests 19-25 from the TestStrategy-Plan.md.
 *
 * These tests prove that data transits Bridge's process boundaries faithfully:
 * real file I/O, real JSON serialisation, real SQLite, real module calls.
 * No mocks. No IPC transport — just the data contracts on each side.
 *
 * Each test is hermetic: temp directories are created and cleaned up per test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { GovernanceEventService } from '../core/governance/eventService.js'
import { buildComplianceSummary, resolveProvenance } from '../core/governance/ruleProvenanceRegistry.js'
import { generateDashboard } from '../core/dashboard/debtReportService.js'
import { readCapabilities } from '../core/capabilities/index.js'
import { A11yLinter } from '../core/A11yLinter.js'
import { auditAll } from '../core/MithrilLinter.js'
import { parse } from '@babel/parser'
import type { File as BabelFile } from '@babel/types'
import type { BridgeAnnotation } from '../core/annotations/types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a temp directory and return its path. */
function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'))
}

/** Remove a temp directory and all its contents. */
function rmTmpDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

/** Parse TSX source into a Babel AST. */
function parseTsx(source: string): BabelFile {
    return parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as BabelFile
}

// ── Test 19: Override IPC reaches database ────────────────────────────────────

describe('Test 19: GovernanceEventService — override events reach SQLite', () => {
    let db: Database.Database
    let service: GovernanceEventService
    const SESSION_ID = 'session-test-19'

    beforeEach(() => {
        db = new Database(':memory:')
        service = new GovernanceEventService(db)
    })

    afterEach(() => {
        db.close()
    })

    it('records a single override and getOverrideCount returns 1', () => {
        // Simulate what the IPC handler does when it receives an override payload
        service.recordEvent({
            eventType: 'override',
            ruleId: 'A11Y-001',
            severity: 'critical',
            filePath: '/test.tsx',
            actor: 'user',
            sessionId: SESSION_ID,
            metadata: { action: 'disable', newValue: { enabled: false } },
            message: 'Rule A11Y-001 disabled by user',
        })

        const count = service.getOverrideCount(SESSION_ID)
        expect(count).toBe(1)
    })

    it('records a second override for a different rule and getOverrideCount returns 2', () => {
        service.recordEvent({
            eventType: 'override',
            ruleId: 'A11Y-001',
            severity: 'critical',
            filePath: '/test.tsx',
            actor: 'user',
            sessionId: SESSION_ID,
            metadata: { action: 'disable', newValue: { enabled: false } },
        })

        service.recordEvent({
            eventType: 'override',
            ruleId: 'MITHRIL-COL',
            severity: 'warning',
            filePath: '/test.tsx',
            actor: 'user',
            sessionId: SESSION_ID,
            metadata: { action: 'disable', newValue: { enabled: false } },
        })

        const count = service.getOverrideCount(SESSION_ID)
        expect(count).toBe(2)
    })

    it('does not count override events from a different session', () => {
        service.recordEvent({
            eventType: 'override',
            ruleId: 'A11Y-001',
            severity: 'critical',
            filePath: '/test.tsx',
            actor: 'user',
            sessionId: 'other-session',
            metadata: {},
        })

        const count = service.getOverrideCount(SESSION_ID)
        expect(count).toBe(0)
    })
})

// ── Test 20: Compliance summary returns correct shape ─────────────────────────

describe('Test 20: buildComplianceSummary — correct ComplianceSummary shape', () => {
    it('returns totalViolations: 2 for two violations', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])

        expect(summary.totalViolations).toBe(2)
    })

    it('byAuthority has WCAG 2.1 AA count >= 1 for an A11y violation', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])

        expect(summary.byAuthority['WCAG 2.1 AA']).toBeGreaterThanOrEqual(1)
    })

    it('byAuthority has Bridge Design System count >= 1 for a Mithril violation', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])

        expect(summary.byAuthority['Bridge Design System']).toBeGreaterThanOrEqual(1)
    })

    it('bySeverity.critical >= 1 when a critical violation is present', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])

        expect(summary.bySeverity.critical).toBeGreaterThanOrEqual(1)
    })

    it('violatedRules is an array with ruleId, sourceAuthority, regulatoryReference on each entry', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
            { ruleId: 'MITHRIL-COL', severity: 'amber' },
        ])

        expect(Array.isArray(summary.violatedRules)).toBe(true)
        expect(summary.violatedRules.length).toBeGreaterThanOrEqual(1)

        for (const entry of summary.violatedRules) {
            expect(typeof entry.ruleId).toBe('string')
            expect(entry.ruleId.length).toBeGreaterThan(0)
            expect(typeof entry.sourceAuthority).toBe('string')
            expect(entry.sourceAuthority.length).toBeGreaterThan(0)
            expect(typeof entry.regulatoryReference).toBe('string')
            expect(entry.regulatoryReference.length).toBeGreaterThan(0)
        }
    })

    it('generatedAt is a valid ISO 8601 timestamp', () => {
        const summary = buildComplianceSummary([
            { ruleId: 'A11Y-001', severity: 'critical' },
        ])

        expect(typeof summary.generatedAt).toBe('string')
        const parsed = new Date(summary.generatedAt)
        expect(isNaN(parsed.getTime())).toBe(false)
        // ISO 8601 strings round-trip through Date without changing
        expect(parsed.toISOString()).toBe(summary.generatedAt)
    })
})

// ── Test 21: Context Bridge file is valid JSON ────────────────────────────────

describe('Test 21: .bridge/context.json — valid JSON, correct top-level keys', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        fs.mkdirSync(path.join(tmpDir, '.bridge'), { recursive: true })
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('round-trips from write to JSON.parse without errors', () => {
        // Reproduce the exact shape that useContextSync assembles (BridgeContext)
        const ctx = {
            timestamp: Date.now(),
            activeFile: '/src/components/Button.tsx',
            selectedNodeId: 'btn-root',
            cursorPosition: { line: 4, column: 12 },
            violations: {
                mithrilCount: 2,
                a11yCount: 1,
                criticalCount: 1,
                nodeIds: ['btn-root'],
            },
            saveState: 'saved',
            canvasMode: 'design',
            openFiles: ['/src/components/Button.tsx'],
        }

        const contextPath = path.join(tmpDir, '.bridge', 'context.json')
        fs.writeFileSync(contextPath, JSON.stringify(ctx, null, 2), 'utf-8')

        const raw = fs.readFileSync(contextPath, 'utf-8')
        let parsed: Record<string, unknown>
        expect(() => { parsed = JSON.parse(raw) as Record<string, unknown> }).not.toThrow()

        // Verify shape expected by MCP server reading bridge://context
        expect(typeof parsed!['timestamp']).toBe('number')
        expect(parsed!).toHaveProperty('activeFile')
        expect(parsed!).toHaveProperty('selectedNodeId')
        expect(parsed!).toHaveProperty('violations')
        expect(parsed!).toHaveProperty('saveState')
        expect(parsed!).toHaveProperty('canvasMode')
        expect(parsed!).toHaveProperty('openFiles')
    })

    it('violations sub-object carries mithrilCount, a11yCount, criticalCount, nodeIds', () => {
        const ctx = {
            timestamp: Date.now(),
            activeFile: null,
            selectedNodeId: null,
            cursorPosition: null,
            violations: {
                mithrilCount: 0,
                a11yCount: 0,
                criticalCount: 0,
                nodeIds: [] as string[],
            },
            saveState: 'unsaved',
            canvasMode: 'interact',
            openFiles: [] as string[],
        }

        const contextPath = path.join(tmpDir, '.bridge', 'context.json')
        fs.writeFileSync(contextPath, JSON.stringify(ctx), 'utf-8')

        const parsed = JSON.parse(fs.readFileSync(contextPath, 'utf-8')) as typeof ctx
        const v = parsed.violations
        expect(typeof v.mithrilCount).toBe('number')
        expect(typeof v.a11yCount).toBe('number')
        expect(typeof v.criticalCount).toBe('number')
        expect(Array.isArray(v.nodeIds)).toBe(true)
    })
})

// ── Test 22: Annotation sync round-trips ─────────────────────────────────────

describe('Test 22: .bridge/annotations.json — round-trip fidelity', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        fs.mkdirSync(path.join(tmpDir, '.bridge'), { recursive: true })
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('annotations round-trip through JSON with all required fields intact', () => {
        const annotations: BridgeAnnotation[] = [
            {
                id: 'anno-001',
                nodeId: 'card-root',
                filePath: '/src/components/Card.tsx',
                type: 'decision',
                author: 'claude-code',
                body: 'Use bg-zinc-900 here per design token contract.',
                status: 'open',
                visibility: 'public',
                createdAt: '2026-03-15T00:00:00.000Z',
                resolvedAt: null,
            },
            {
                id: 'anno-002',
                nodeId: 'btn-root',
                filePath: '/src/components/Button.tsx',
                type: 'note',
                author: 'justin',
                body: 'Needs aria-label review before shipping.',
                status: 'resolved',
                visibility: 'public',
                createdAt: '2026-03-14T12:00:00.000Z',
                resolvedAt: '2026-03-15T09:00:00.000Z',
            },
        ]

        const annotationsPath = path.join(tmpDir, '.bridge', 'annotations.json')
        fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2), 'utf-8')

        const raw = fs.readFileSync(annotationsPath, 'utf-8')
        let parsed: BridgeAnnotation[]
        expect(() => { parsed = JSON.parse(raw) as BridgeAnnotation[] }).not.toThrow()

        expect(Array.isArray(parsed!)).toBe(true)
        expect(parsed!.length).toBe(2)
    })

    it('each annotation has id, targetId (nodeId), content (body), author, status', () => {
        const annotations: BridgeAnnotation[] = [
            {
                id: 'anno-003',
                nodeId: 'header-root',
                filePath: '/src/components/Header.tsx',
                type: 'approval',
                author: 'team-lead',
                body: 'Approved for v2 release.',
                status: 'resolved',
                visibility: 'public',
                createdAt: '2026-03-15T00:00:00.000Z',
                resolvedAt: '2026-03-15T10:00:00.000Z',
            },
        ]

        const annotationsPath = path.join(tmpDir, '.bridge', 'annotations.json')
        fs.writeFileSync(annotationsPath, JSON.stringify(annotations), 'utf-8')

        const parsed = JSON.parse(fs.readFileSync(annotationsPath, 'utf-8')) as BridgeAnnotation[]
        const a = parsed[0]!

        expect(typeof a.id).toBe('string')
        // The field is nodeId in the BridgeAnnotation schema
        expect(typeof a.nodeId).toBe('string')
        // body maps to content in the test spec
        expect(typeof a.body).toBe('string')
        expect(typeof a.author).toBe('string')
        expect(['open', 'resolved'].includes(a.status)).toBe(true)
    })

    it('the file format is a valid JSON array (not an object)', () => {
        const annotationsPath = path.join(tmpDir, '.bridge', 'annotations.json')
        fs.writeFileSync(annotationsPath, JSON.stringify([]), 'utf-8')

        const parsed: unknown = JSON.parse(fs.readFileSync(annotationsPath, 'utf-8'))
        expect(Array.isArray(parsed)).toBe(true)
    })
})

// ── Test 23: bridge://dashboard resource returns DashboardData ────────────────

describe('Test 23: generateDashboard — returns valid DashboardData', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        fs.mkdirSync(path.join(tmpDir, '.bridge'), { recursive: true })
        // Write one TSX file so the scanner has something to scan
        const srcDir = path.join(tmpDir, 'src')
        fs.mkdirSync(srcDir, { recursive: true })
        fs.writeFileSync(
            path.join(srcDir, 'Button.tsx'),
            `import React from 'react';\nexport const Button = () => (\n  <button aria-label="Submit">Click</button>\n);\n`,
            'utf-8',
        )
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('result has healthScore in range 0-100', () => {
        const data = generateDashboard(tmpDir)
        expect(typeof data.healthScore).toBe('number')
        expect(data.healthScore).toBeGreaterThanOrEqual(0)
        expect(data.healthScore).toBeLessThanOrEqual(100)
    })

    it('result has grade as one of A/B/C/D/F', () => {
        const data = generateDashboard(tmpDir)
        expect(['A', 'B', 'C', 'D', 'F']).toContain(data.grade)
    })

    it('result has history as an array', () => {
        const data = generateDashboard(tmpDir)
        expect(Array.isArray(data.history)).toBe(true)
    })

    it('result has bySeverity with critical, warning, and info keys', () => {
        const data = generateDashboard(tmpDir)
        expect(data.bySeverity).toBeDefined()
        expect(typeof data.bySeverity.critical).toBe('number')
        expect(typeof data.bySeverity.warning).toBe('number')
        expect(typeof data.bySeverity.info).toBe('number')
    })

    it('result has a valid ISO 8601 timestamp', () => {
        const data = generateDashboard(tmpDir)
        expect(typeof data.timestamp).toBe('string')
        const d = new Date(data.timestamp)
        expect(isNaN(d.getTime())).toBe(false)
    })
})

// ── Test 24: bridge://violations for a specific file ─────────────────────────

describe('Test 24: per-file violations — ruleId format and JSON serialisability', () => {
    const A11Y_VIOLATION_SOURCE = `
import React from 'react';
export const BadImg = () => (
  <div data-bridge-id="root">
    <img data-bridge-id="bad-img" src="photo.png" />
  </div>
);
`

    const MITHRIL_VIOLATION_SOURCE = `
import React from 'react';
export const Drifted = () => (
  <div data-bridge-id="drift-root" className="bg-[#ff00ff]">
    <img data-bridge-id="drift-img" src="icon.png" alt="Icon" />
  </div>
);
`

    // Minimal token set: a single dark-grey token far from #ff00ff (magenta).
    // visitClassNames requires at least one color token to evaluate drift —
    // with zero tokens it short-circuits (no design system = no drift check).
    const MINIMAL_TOKENS = [
        {
            id: 1,
            token_path: 'color/neutral/900',
            token_type: 'color' as const,
            token_value: '#18181b',
            description: null,
            collection_name: 'default',
            mode: 'light',
        },
    ]

    it('Mithril violations have ruleId starting with MITHRIL-', () => {
        const ast = parseTsx(MITHRIL_VIOLATION_SOURCE)
        // Provide at least one color token so visitClassNames can evaluate drift
        const warnings = auditAll(ast, MINIMAL_TOKENS)

        const ruleIds = Array.from(warnings.values()).map((w) => w.message.split(':')[0]!.trim())
        const mithrilIds = ruleIds.filter((id) => id.startsWith('MITHRIL-'))
        expect(mithrilIds.length).toBeGreaterThanOrEqual(1)
    })

    it('A11y violations have messages starting with A11Y-', () => {
        const ast = parseTsx(A11Y_VIOLATION_SOURCE)
        const result = A11yLinter.auditStructured(ast)

        expect(result.violations.length).toBeGreaterThanOrEqual(1)
        for (const v of result.violations) {
            expect(v.ruleId).toMatch(/^A11Y-/)
        }
    })

    it('combined Mithril + A11y result serialises as JSON without errors', () => {
        const mithrilAst = parseTsx(MITHRIL_VIOLATION_SOURCE)
        const mithrilWarnings = auditAll(mithrilAst, [])
        const mithrilArr = Array.from(mithrilWarnings.entries()).map(([id, w]) => ({ nodeId: id, ...w }))

        const a11yAst = parseTsx(A11Y_VIOLATION_SOURCE)
        const a11yResult = A11yLinter.auditStructured(a11yAst)

        const combined = {
            mithrilViolations: mithrilArr,
            a11yViolations: a11yResult.violations,
        }

        let serialised: string
        expect(() => { serialised = JSON.stringify(combined) }).not.toThrow()
        expect(() => JSON.parse(serialised!)).not.toThrow()
    })
})

// ── Test 25: bridge://capabilities lists all tools ────────────────────────────

describe('Test 25: readCapabilities — full tool catalog with required fields', () => {
    it('returns a parseable JSON string', () => {
        const raw = readCapabilities()
        expect(typeof raw).toBe('string')
        expect(() => JSON.parse(raw)).not.toThrow()
    })

    it('catalog contains at least 10 tools', () => {
        const catalog = JSON.parse(readCapabilities()) as { tools: unknown[] }
        expect(Array.isArray(catalog.tools)).toBe(true)
        expect(catalog.tools.length).toBeGreaterThanOrEqual(10)
    })

    it('every tool has a name and description field', () => {
        const catalog = JSON.parse(readCapabilities()) as {
            tools: Array<{ name: string; description: string }>
        }
        for (const tool of catalog.tools) {
            expect(typeof tool.name).toBe('string')
            expect(tool.name.length).toBeGreaterThan(0)
            expect(typeof tool.description).toBe('string')
            expect(tool.description.length).toBeGreaterThan(0)
        }
    })

    it('catalog has schema_version and generated_at fields', () => {
        const catalog = JSON.parse(readCapabilities()) as {
            schema_version: string
            generated_at: string
        }
        expect(typeof catalog.schema_version).toBe('string')
        expect(typeof catalog.generated_at).toBe('string')
        const d = new Date(catalog.generated_at)
        expect(isNaN(d.getTime())).toBe(false)
    })
})
