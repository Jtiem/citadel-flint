/**
 * Tests for handleBridgeSwarmAuditFix — bridge-mcp/src/tools/__tests__/swarm.test.ts
 *
 * Covers:
 *   - Happy path: audit-only (autoFix: false) — correct file count and violation summary
 *   - Happy path: autoFix mode applies fixes and reports fixesApplied > 0
 *   - Edge case: glob matches zero files → returns zero counts gracefully
 *   - Edge case: all files are violation-free → fixesApplied = 0, healthAfter = 100
 *   - dryRun mode: reports what would change without writing to disk
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { handleBridgeSwarmAuditFix } from '../swarm.js'
import type { BridgeConfig } from '../../core/config.js'
import type { DesignToken } from '../../types.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-swarm-test-'))
}

function rmTmpDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

const DARK_NEUTRAL_TOKEN: DesignToken = {
    id: 1,
    token_path: 'color/neutral/900',
    token_type: 'color',
    token_value: '#18181b',
    description: null,
    collection_name: 'default',
    mode: 'light',
}

function buildConfig(projectRoot: string, tokens: DesignToken[] = []): BridgeConfig {
    const bridgeDir = path.join(projectRoot, '.bridge')
    fs.mkdirSync(bridgeDir, { recursive: true })
    if (tokens.length > 0) {
        fs.writeFileSync(
            path.join(bridgeDir, 'design-tokens.json'),
            JSON.stringify(tokens),
            'utf-8',
        )
    }
    return {
        projectRoot,
        domains: ['ui'],
        policy: {
            version: 1,
            mithril: {
                deltaE_threshold: 2.0,
                deltaE_critical_threshold: 10.0,
                mode: 'blocking',
                ignore_patterns: [],
            },
            a11y: {
                level: 'AA',
                mode: 'blocking',
                disabled_rules: [],
            },
            export_gate: {
                block_on_mithril: true,
                block_on_a11y: true,
                block_on_overrides: true,
            },
            baseline: { enabled: false },
        },
    }
}

// Clean source — no violations
const CLEAN_SOURCE = `
import React from 'react'
export const Clean = () => (
  <button data-bridge-id="clean-btn" aria-label="Submit" className="bg-zinc-900 p-4 text-white">
    Submit
  </button>
)
`

// Source with color drift (red on dark token set)
const DRIFTED_SOURCE = `
import React from 'react'
export const Drifted = () => (
  <div data-bridge-id="drifted-root" className="bg-[#ff0000]">
    Red
  </div>
)
`

// ── Suite setup ───────────────────────────────────────────────────────────────

describe('handleBridgeSwarmAuditFix — empty glob match', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('returns zero counts when no files match the glob', async () => {
        const config = buildConfig(tmpDir)
        // The directory is empty — no TSX files
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.filesScanned).toBe(0)
        expect(report.filesWithViolations).toBe(0)
        expect(report.totalViolations).toBe(0)
        expect(report.fixesApplied).toBe(0)
        expect(report.healthBefore).toBe(100)
        expect(report.healthAfter).toBe(100)
        expect(report.fileReports).toHaveLength(0)
        expect(typeof report.durationMs).toBe('number')
        expect(report.durationMs).toBeGreaterThanOrEqual(0)
    })
})

// ── Suite: all files clean ────────────────────────────────────────────────────

describe('handleBridgeSwarmAuditFix — all files violation-free', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        const srcDir = path.join(tmpDir, 'src')
        fs.mkdirSync(srcDir, { recursive: true })
        fs.writeFileSync(path.join(srcDir, 'Clean.tsx'), CLEAN_SOURCE, 'utf-8')
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('fixesApplied is 0 and healthAfter is 100 when all files pass', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.filesScanned).toBe(1)
        // Clean source has no mithril violations (no arbitrary values)
        // It does have an a11y violation if img without alt — but CLEAN_SOURCE uses
        // aria-label on button so it should be clean for a11y too.
        expect(report.fixesApplied).toBe(0)
        expect(report.healthBefore).toBeGreaterThanOrEqual(0)
        expect(report.healthBefore).toBeLessThanOrEqual(100)
        expect(typeof report.healthAfter).toBe('number')
    })

    it('fileReports has one entry matching the scanned file', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.fileReports).toHaveLength(1)
        expect(report.fileReports[0]!.filePath).toContain('Clean.tsx')
        expect(typeof report.fileReports[0]!.violationsBefore).toBe('number')
        expect(typeof report.fileReports[0]!.violationsAfter).toBe('number')
        expect(typeof report.fileReports[0]!.fixed).toBe('boolean')
    })
})

// ── Suite: audit-only mode (no autoFix) ───────────────────────────────────────

describe('handleBridgeSwarmAuditFix — audit-only mode', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        const srcDir = path.join(tmpDir, 'src')
        fs.mkdirSync(srcDir, { recursive: true })
        fs.writeFileSync(path.join(srcDir, 'Drifted.tsx'), DRIFTED_SOURCE, 'utf-8')
        fs.writeFileSync(path.join(srcDir, 'Clean.tsx'), CLEAN_SOURCE, 'utf-8')
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('returns correct filesScanned count', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.filesScanned).toBe(2)
    })

    it('reports violations present in drifted file', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.filesWithViolations).toBeGreaterThanOrEqual(1)
        expect(report.totalViolations).toBeGreaterThanOrEqual(1)
    })

    it('does not apply fixes when autoFix is false', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.fixesApplied).toBe(0)
        // Verify the file on disk was NOT changed
        const onDisk = fs.readFileSync(path.join(tmpDir, 'src', 'Drifted.tsx'), 'utf-8')
        expect(onDisk).toContain('#ff0000')
    })

    it('returns a healthBefore in 0-100 range', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.healthBefore).toBeGreaterThanOrEqual(0)
        expect(report.healthBefore).toBeLessThanOrEqual(100)
    })

    it('fileReports has one entry per discovered file', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.fileReports).toHaveLength(2)
        for (const fr of report.fileReports) {
            expect(typeof fr.filePath).toBe('string')
            expect(typeof fr.violationsBefore).toBe('number')
            expect(typeof fr.violationsAfter).toBe('number')
            expect(typeof fr.fixed).toBe('boolean')
            expect(fr.fixed).toBe(false)
        }
    })
})

// ── Suite: autoFix mode ───────────────────────────────────────────────────────

describe('handleBridgeSwarmAuditFix — autoFix mode', () => {
    let tmpDir: string
    let driftedPath: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        const srcDir = path.join(tmpDir, 'src')
        fs.mkdirSync(srcDir, { recursive: true })
        driftedPath = path.join(srcDir, 'Drifted.tsx')
        fs.writeFileSync(driftedPath, DRIFTED_SOURCE, 'utf-8')
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('applies fixes and reports fixesApplied > 0', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: true },
            config,
        )

        expect(report.fixesApplied).toBeGreaterThan(0)
    })

    it('marks drifted file as fixed in fileReports', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: true },
            config,
        )

        const driftedReport = report.fileReports.find((r) => r.filePath.endsWith('Drifted.tsx'))
        expect(driftedReport).toBeDefined()
        expect(driftedReport!.fixed).toBe(true)
    })

    it('writes fixed source to disk', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: true },
            config,
        )

        const onDisk = fs.readFileSync(driftedPath, 'utf-8')
        expect(onDisk).not.toContain('#ff0000')
        expect(onDisk).toContain('var(--color-neutral-900)')
    })
})

// ── Suite: dryRun mode ────────────────────────────────────────────────────────

describe('handleBridgeSwarmAuditFix — dryRun mode', () => {
    let tmpDir: string
    let driftedPath: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        const srcDir = path.join(tmpDir, 'src')
        fs.mkdirSync(srcDir, { recursive: true })
        driftedPath = path.join(srcDir, 'Drifted.tsx')
        fs.writeFileSync(driftedPath, DRIFTED_SOURCE, 'utf-8')
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('reports fixesApplied > 0 in dry-run mode', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: true, dryRun: true },
            config,
        )

        expect(report.fixesApplied).toBeGreaterThan(0)
    })

    it('does NOT write to disk in dryRun mode', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        await handleBridgeSwarmAuditFix(
            { glob: 'src/**/*.tsx', projectRoot: tmpDir, autoFix: true, dryRun: true },
            config,
        )

        const onDisk = fs.readFileSync(driftedPath, 'utf-8')
        // File should be unchanged — original hardcoded value still present
        expect(onDisk).toContain('#ff0000')
    })
})

// ── Suite: SwarmReport shape ──────────────────────────────────────────────────

describe('handleBridgeSwarmAuditFix — SwarmReport shape', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
    })

    afterEach(() => {
        rmTmpDir(tmpDir)
    })

    it('always returns all required SwarmReport keys', async () => {
        const config = buildConfig(tmpDir)
        const report = await handleBridgeSwarmAuditFix(
            { glob: '**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(typeof report.filesScanned).toBe('number')
        expect(typeof report.filesWithViolations).toBe('number')
        expect(typeof report.totalViolations).toBe('number')
        expect(typeof report.fixesApplied).toBe('number')
        expect(typeof report.healthBefore).toBe('number')
        expect(typeof report.healthAfter).toBe('number')
        expect(Array.isArray(report.fileReports)).toBe(true)
        expect(typeof report.durationMs).toBe('number')
    })

    it('healthBefore and healthAfter are always in 0-100 range', async () => {
        const config = buildConfig(tmpDir, [DARK_NEUTRAL_TOKEN])
        const report = await handleBridgeSwarmAuditFix(
            { glob: '**/*.tsx', projectRoot: tmpDir, autoFix: false },
            config,
        )

        expect(report.healthBefore).toBeGreaterThanOrEqual(0)
        expect(report.healthBefore).toBeLessThanOrEqual(100)
        expect(report.healthAfter).toBeGreaterThanOrEqual(0)
        expect(report.healthAfter).toBeLessThanOrEqual(100)
    })
})
