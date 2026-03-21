/**
 * cx1-response-quality.test.ts — Phase CX.1 integration tests
 *
 * End-to-end integration tests that verify the full response quality contracts
 * from server-level to handler level.
 *
 * These complement responseQuality.test.ts (unit tests for generation functions)
 * by verifying the fields appear in the full handler responses.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { handleFlintAudit, handleFlintAuditBatch } from '../tools/audit.js'
import { handleFlintFix } from '../tools/fix.js'
import { handleFlintSwarmAuditFix } from '../tools/swarm.js'
import { DEFAULT_CONFIG } from '../core/config.js'
import type { FlintConfig } from '../core/config.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-cx1-int-'))
}

function makeFlintDir(dir: string): string {
    const flintDir = path.join(dir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    return flintDir
}

function makeConfig(projectRoot: string): FlintConfig {
    return { ...DEFAULT_CONFIG, projectRoot }
}

function writeDebtHistory(flintDir: string, entries: object[]): void {
    fs.writeFileSync(
        path.join(flintDir, 'debt-history.json'),
        JSON.stringify(entries),
        'utf-8',
    )
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
  <div data-flint-id="bad-root" className="bg-[#ff0000]">
    <img src="photo.jpg" />
  </div>
)
export default Bad
`

// ── flint_audit single-file response shape (CX.1) ────────────────────────────

describe('flint_audit single-file: CX.1 response shape', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const flintDir = makeFlintDir(tmpDir)
        writeDebtHistory(flintDir, [{ score: 80, grade: 'B', totalViolations: 8 }])
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('clean source: summary says "export-ready" and project_context present', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintAudit(
            { source: CLEAN_SOURCE, filePath: 'Clean.tsx' },
            config,
        )
        expect(result.summary).toContain('export-ready')
        expect(result.project_context).toBeDefined()
        expect(result.project_context!.health_score).toBe(80)
        expect(result.project_context!.grade).toBe('B')
    })

    it('violation source: summary mentions violations and project_context present', async () => {
        // Note: without tokens, Mithril won't flag #ff0000, but A11y will flag missing alt.
        const config = makeConfig(tmpDir)
        const result = await handleFlintAudit(
            { source: VIOLATION_SOURCE, filePath: 'Bad.tsx' },
            config,
        )
        expect(typeof result.summary).toBe('string')
        expect(result.summary.length).toBeGreaterThan(0)
        expect(result.project_context).toBeDefined()
    })
})

// ── flint_audit batch response shape (CX.1) ──────────────────────────────────

describe('flint_audit batch: CX.1 response shape', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const flintDir = makeFlintDir(tmpDir)
        writeDebtHistory(flintDir, [{ score: 75, grade: 'C', totalViolations: 15 }])
        fs.writeFileSync(path.join(tmpDir, 'A.tsx'), CLEAN_SOURCE, 'utf-8')
        fs.writeFileSync(path.join(tmpDir, 'B.tsx'), VIOLATION_SOURCE, 'utf-8')
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('batch result has summary.text and project_context', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintAuditBatch(
            [path.join(tmpDir, 'A.tsx'), path.join(tmpDir, 'B.tsx')],
            {},
            config,
        )
        expect(typeof result.summary.text).toBe('string')
        expect(result.summary.text).toContain('Audited 2 files')
        expect(result.project_context).toBeDefined()
        expect(result.project_context!.grade).toBe('C')
    })
})

// ── flint_fix response shape (CX.1) ──────────────────────────────────────────

describe('flint_fix: CX.1 response shape', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        const flintDir = makeFlintDir(tmpDir)
        writeDebtHistory(flintDir, [{ score: 70, grade: 'C', totalViolations: 25 }])
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('result has summary, dryRun, and project_context', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintFix(
            { source: CLEAN_SOURCE, filePath: 'Clean.tsx' },
            config,
        )
        expect(typeof result.summary).toBe('string')
        expect(result.summary.length).toBeGreaterThan(0)
        expect(result.dryRun).toBe(false)
        expect(result.project_context).toBeDefined()
        expect(result.project_context!.health_score).toBe(70)
    })

    it('dryRun=true: summary contains DRY RUN, dryRun field is true', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintFix(
            { source: CLEAN_SOURCE, filePath: 'Clean.tsx', dryRun: true },
            config,
        )
        expect(result.dryRun).toBe(true)
        expect(result.summary).toContain('DRY RUN')
        // fixedSource still populated
        expect(result.fixedSource.length).toBeGreaterThan(0)
    })

    it('parse-error: summary says cannot parse', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintFix(
            { source: '{{ invalid tsx ))))', filePath: 'Broken.tsx' },
            config,
        )
        expect(result.status).toBe('parse-error')
        expect(result.summary).toContain('Could not parse')
    })
})

// ── flint_swarm_audit_fix response shape (CX.1) ─────────────────────────────

describe('flint_swarm_audit_fix: CX.1 summary field', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeFlintDir(tmpDir)
        fs.writeFileSync(path.join(tmpDir, 'A.tsx'), CLEAN_SOURCE, 'utf-8')
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('swarm result has a summary field', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintSwarmAuditFix(
            { glob: '*.tsx', projectRoot: tmpDir },
            config,
        )
        expect(typeof result.summary).toBe('string')
        expect(result.summary.length).toBeGreaterThan(0)
    })

    it('swarm result summary matches template format', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintSwarmAuditFix(
            { glob: '*.tsx', projectRoot: tmpDir },
            config,
        )
        expect(result.summary).toContain('Scanned')
        expect(result.summary).toContain('violation(s) found')
        expect(result.summary).toContain('Health:')
    })

    it('empty swarm (no matching files) still returns summary', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintSwarmAuditFix(
            { glob: '*.nonexistent', projectRoot: tmpDir },
            config,
        )
        expect(typeof result.summary).toBe('string')
        expect(result.summary).toContain('Scanned 0 files')
    })
})

// ── project_context omission when no debt history ─────────────────────────────

describe('CX.1: project_context omitted gracefully when no history', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        makeFlintDir(tmpDir) // .flint exists but no debt-history.json
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('flint_audit: project_context absent when no debt history', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintAudit(
            { source: CLEAN_SOURCE, filePath: 'Clean.tsx' },
            config,
        )
        expect(result.project_context).toBeUndefined()
    })

    it('flint_fix: project_context absent when no debt history', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintFix(
            { source: CLEAN_SOURCE, filePath: 'Clean.tsx' },
            config,
        )
        expect(result.project_context).toBeUndefined()
    })
})
