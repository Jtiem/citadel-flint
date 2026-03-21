/**
 * projectContext.test.ts — Phase CX.1
 *
 * Unit tests for flint-mcp/src/core/projectContext.ts
 *
 * Tests:
 *   - Happy path: valid history file (top-level array format)
 *   - Happy path: valid history file (snapshots wrapper format)
 *   - Multiple entries: picks the last one
 *   - Missing file: returns null
 *   - Missing .flint directory: returns null
 *   - Empty array: returns null
 *   - Corrupt JSON: returns null without throwing
 *   - Missing required fields in entry: returns null
 *   - Performance: < 5ms
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadProjectContext } from '../../src/core/projectContext.js'
import type { ProjectContext } from '../../src/core/projectContext.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-ctx-test-'))
}

function makeFlintDir(projectRoot: string): string {
    const flintDir = path.join(projectRoot, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    return flintDir
}

function writeHistory(flintDir: string, content: unknown): void {
    fs.writeFileSync(
        path.join(flintDir, 'debt-history.json'),
        JSON.stringify(content),
        'utf-8',
    )
}

// ── Happy path: top-level array format ────────────────────────────────────────

describe('loadProjectContext — top-level array format', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns correct context from a valid single-entry history', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [
            { score: 78, grade: 'C', totalViolations: 23 },
        ])
        const ctx = loadProjectContext(tmpDir)
        expect(ctx).not.toBeNull()
        expect(ctx!.health_score).toBe(78)
        expect(ctx!.grade).toBe('C')
        expect(ctx!.total_violations).toBe(23)
        expect(ctx!.blocked_files).toBe(0)
    })

    it('returns the last entry when history has multiple entries', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [
            { score: 50, grade: 'F', totalViolations: 90 },
            { score: 65, grade: 'D', totalViolations: 45 },
            { score: 88, grade: 'B', totalViolations: 7 },
        ])
        const ctx = loadProjectContext(tmpDir)
        expect(ctx!.health_score).toBe(88)
        expect(ctx!.grade).toBe('B')
        expect(ctx!.total_violations).toBe(7)
    })

    it('supports healthScore alias (used by debtReportService)', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [
            { healthScore: 91, grade: 'A', totalViolations: 3 },
        ])
        const ctx = loadProjectContext(tmpDir)
        expect(ctx!.health_score).toBe(91)
    })

    it('supports violationCount alias', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [
            { score: 75, grade: 'C', violationCount: 15 },
        ])
        const ctx = loadProjectContext(tmpDir)
        expect(ctx!.total_violations).toBe(15)
    })
})

// ── Happy path: snapshots wrapper format ──────────────────────────────────────

describe('loadProjectContext — snapshots wrapper format', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('reads the last snapshot from the snapshots array', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, {
            snapshots: [
                { score: 40, grade: 'F', totalViolations: 120 },
                { score: 82, grade: 'B', totalViolations: 11 },
            ],
        })
        const ctx = loadProjectContext(tmpDir)
        expect(ctx!.health_score).toBe(82)
        expect(ctx!.grade).toBe('B')
        expect(ctx!.total_violations).toBe(11)
    })

    it('returns null when snapshots array is empty', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, { snapshots: [] })
        expect(loadProjectContext(tmpDir)).toBeNull()
    })
})

// ── Missing / absent files ─────────────────────────────────────────────────────

describe('loadProjectContext — missing files', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns null when debt-history.json does not exist', () => {
        makeFlintDir(tmpDir) // .flint exists but no history
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null when .flint directory does not exist', () => {
        // No .flint dir created
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null for a completely non-existent project root', () => {
        expect(loadProjectContext('/totally/nonexistent/path/xyz')).toBeNull()
    })

    it('does not throw for any missing path scenario', () => {
        expect(() => loadProjectContext('/totally/nonexistent/path/xyz')).not.toThrow()
        expect(() => loadProjectContext(tmpDir)).not.toThrow() // no .flint dir
    })
})

// ── Empty / corrupt files ──────────────────────────────────────────────────────

describe('loadProjectContext — empty or corrupt files', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns null for empty file without throwing', () => {
        const flintDir = makeFlintDir(tmpDir)
        fs.writeFileSync(path.join(flintDir, 'debt-history.json'), '', 'utf-8')
        expect(() => loadProjectContext(tmpDir)).not.toThrow()
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null for whitespace-only file without throwing', () => {
        const flintDir = makeFlintDir(tmpDir)
        fs.writeFileSync(path.join(flintDir, 'debt-history.json'), '   \n\t  ', 'utf-8')
        expect(() => loadProjectContext(tmpDir)).not.toThrow()
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null for invalid JSON without throwing', () => {
        const flintDir = makeFlintDir(tmpDir)
        fs.writeFileSync(path.join(flintDir, 'debt-history.json'), '{ not valid json', 'utf-8')
        expect(() => loadProjectContext(tmpDir)).not.toThrow()
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null when file contains null', () => {
        const flintDir = makeFlintDir(tmpDir)
        fs.writeFileSync(path.join(flintDir, 'debt-history.json'), 'null', 'utf-8')
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null when file contains a non-array non-object primitive (string)', () => {
        const flintDir = makeFlintDir(tmpDir)
        fs.writeFileSync(path.join(flintDir, 'debt-history.json'), '"just a string"', 'utf-8')
        expect(loadProjectContext(tmpDir)).toBeNull()
    })
})

// ── Incomplete entry fields ────────────────────────────────────────────────────

describe('loadProjectContext — incomplete entry fields', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns null when entry is missing score and healthScore', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ grade: 'B', totalViolations: 10 }])
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null when entry is missing grade', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ score: 75, totalViolations: 10 }])
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null when entry is missing totalViolations and violationCount', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ score: 75, grade: 'C' }])
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null when entry is null', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [null])
        expect(loadProjectContext(tmpDir)).toBeNull()
    })

    it('returns null for empty-string grade', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ score: 75, grade: '', totalViolations: 10 }])
        expect(loadProjectContext(tmpDir)).toBeNull()
    })
})

// ── Return type shape ─────────────────────────────────────────────────────────

describe('loadProjectContext — return type shape', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returned object has exactly { health_score, grade, total_violations, blocked_files }', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ score: 80, grade: 'B', totalViolations: 5 }])
        const ctx = loadProjectContext(tmpDir) as ProjectContext
        expect(Object.keys(ctx).sort()).toEqual(
            ['blocked_files', 'grade', 'health_score', 'total_violations'],
        )
    })

    it('blocked_files is always 0 (history lacks per-file data)', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ score: 70, grade: 'C', totalViolations: 20 }])
        const ctx = loadProjectContext(tmpDir)!
        expect(ctx.blocked_files).toBe(0)
    })

    it('health_score is a number, grade is a string, total_violations is a number', () => {
        const flintDir = makeFlintDir(tmpDir)
        writeHistory(flintDir, [{ score: 95, grade: 'A', totalViolations: 0 }])
        const ctx = loadProjectContext(tmpDir)!
        expect(typeof ctx.health_score).toBe('number')
        expect(typeof ctx.grade).toBe('string')
        expect(typeof ctx.total_violations).toBe('number')
        expect(typeof ctx.blocked_files).toBe('number')
    })
})

// ── Performance ────────────────────────────────────────────────────────────────

describe('loadProjectContext — performance budget < 5ms', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const flintDir = makeFlintDir(tmpDir)
        // Write a reasonably large history file (100 entries)
        writeHistory(flintDir, Array.from({ length: 100 }, (_, i) => ({
            score: i,
            grade: i >= 90 ? 'A' : i >= 80 ? 'B' : 'C',
            totalViolations: 100 - i,
        })))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('completes in under 5ms on a 100-entry history file', () => {
        const start = performance.now()
        loadProjectContext(tmpDir)
        const elapsed = performance.now() - start
        expect(elapsed).toBeLessThan(5)
    })
})
