/**
 * flint_swarm_audit_fix tool handler -- flint-mcp/src/tools/swarm.ts
 *
 * Demo 7: Autonomous Swarm Clean-up.
 *
 * Discovers all TSX files matching a glob pattern under projectRoot,
 * audits them with the Mithril + A11y engines, and optionally applies
 * deterministic auto-fixes via handleFlintFix. Returns a consolidated
 * SwarmReport with before/after health scores.
 *
 * File discovery uses the same recursive walk strategy as debtReportService.ts
 * to avoid adding external glob dependencies.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { FlintConfig } from '../core/config.js'
import { handleFlintAuditBatch } from './audit.js'
import { handleFlintFix } from './fix.js'
import { BRAND, toolName } from '../brand.js'
// ── FIXTURE.1 import (append-only) ───────────────────────────────────────────
import { resolveFixture } from '../core/fixtureResolver.js'

// ---- Types ------------------------------------------------------------------

export interface SwarmFileReport {
    filePath: string
    violationsBefore: number
    violationsAfter: number
    fixed: boolean
}

export interface SwarmReport {
    filesScanned: number
    filesWithViolations: number
    totalViolations: number
    fixesApplied: number
    healthBefore: number
    healthAfter: number
    fileReports: SwarmFileReport[]
    durationMs: number
    /** One-sentence human-readable summary. CX.1 */
    summary: string
    /** Actionable next-step recommendation. CLARITY-2 */
    recommendation: string
}

// ── CX.1 Summary generation ────────────────────────────────────────────────

/**
 * Generate a one-sentence plain-English summary of a swarm audit/fix report.
 */
/**
 * CLARITY-2: Generate actionable recommendation for swarm results.
 */
export function generateSwarmRecommendation(report: Omit<SwarmReport, 'summary' | 'recommendation'>): string {
    if (report.totalViolations === 0) {
        return `All ${report.filesScanned} files are clean. No action needed.`
    }
    const remaining = report.filesWithViolations - report.fileReports.filter(f => f.fixed).length
    if (report.fixesApplied > 0 && remaining > 0) {
        return `Cleaned ${report.fixesApplied} drift(s). ${remaining} file(s) still need manual review.`
    }
    if (report.fixesApplied > 0) {
        return `Cleaned ${report.fixesApplied} drift(s) across all files. Run 'audit' to verify.`
    }
    return `${report.filesWithViolations} file(s) have issues. Run with autoFix to remediate.`
}

export function generateSwarmSummary(report: Omit<SwarmReport, 'summary' | 'recommendation'>): string {
    return (
        `Scanned ${report.filesScanned} files. ` +
        `${report.totalViolations} violation(s) found, ${report.fixesApplied} fixed. ` +
        `Health: ${report.healthBefore} -> ${report.healthAfter}.`
    )
}

// ---- Tool definition --------------------------------------------------------

export const FLINT_SWARM_AUDIT_FIX_TOOL = {
    name: toolName('swarm_audit_fix'),
    description:
        'Autonomously scan all TSX files matching a glob pattern, audit for ' +
        'design system violations, and optionally auto-fix them. Returns a ' +
        'consolidated remediation report.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            glob: {
                type: 'string',
                description: 'Glob pattern for files to scan (default: "**/*.tsx").',
            },
            autoFix: {
                type: 'boolean',
                description: 'If true, apply token fixes after auditing (default: false).',
            },
            dryRun: {
                type: 'boolean',
                description:
                    'If true, report what would change but do not write to disk (default: false).',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root directory (defaults to cwd).',
            },
        },
        required: [],
    },
} as const

// ---- File discovery helper --------------------------------------------------

/**
 * Recursively walks rootDir returning all files whose name matches
 * the file-name portion of globPattern.
 *
 * Strategy (mirrors debtReportService.findFiles):
 *   Strip all directory segments including the **\/ token from the glob to
 *   obtain only the file-name pattern. Handles:
 *     "**\/*.tsx"      -- recursive, any .tsx file
 *     "*.tsx"          -- root only, any .tsx file
 *     "src/**\/*.tsx"  -- recursive, any .tsx file (src/ prefix stripped)
 *
 * Excluded dirs: node_modules, dist, dist-electron, .git, .flint
 */
function discoverFiles(rootDir: string, globPattern: string): string[] {
    const results: string[] = []
    const EXCLUDED_DIRS = new Set([
        'node_modules', 'dist', 'dist-electron', '.git', BRAND.configDir,
    ])

    const isRecursive = globPattern.includes('**')

    // Strip all directory path segments and the ** wildcard to get the
    // file-name-only pattern that we test against each directory entry.
    const withoutDoublestar = globPattern.replace(/\*\*\//g, '').replace(/\*\*/g, '')
    const fileNamePattern = withoutDoublestar.includes('/')
        ? withoutDoublestar.slice(withoutDoublestar.lastIndexOf('/') + 1)
        : withoutDoublestar

    // Build a regex from the file-name pattern.
    // Escape regex special chars first, then turn glob * into [^/]*.
    const escapedPattern = fileNamePattern
        .replace(/[.+^$()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
    const fileRegex = new RegExp('^' + escapedPattern + '$')

    function walk(dir: string): void {
        let entries: fs.Dirent[]
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
            return
        }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
                if (isRecursive) {
                    walk(path.join(dir, entry.name))
                }
            } else if (entry.isFile()) {
                if (fileRegex.test(entry.name)) {
                    results.push(path.join(dir, entry.name))
                }
            }
        }
    }

    walk(rootDir)
    return results.sort()
}

// ---- Main handler -----------------------------------------------------------

export async function handleFlintSwarmAuditFix(
    args: {
        glob?: string
        autoFix?: boolean
        projectRoot?: string
        dryRun?: boolean
    },
    config: FlintConfig,
): Promise<SwarmReport> {
    const startMs = Date.now()
    const { glob = '**/*.tsx', projectRoot = process.cwd(), autoFix = false, dryRun = false } = args

    // Step 1: Discover files
    const filePaths = discoverFiles(projectRoot, glob)

    if (filePaths.length === 0) {
        const emptyReport = {
            filesScanned: 0,
            filesWithViolations: 0,
            totalViolations: 0,
            fixesApplied: 0,
            healthBefore: 100,
            healthAfter: 100,
            fileReports: [],
            durationMs: Date.now() - startMs,
        }
        return { ...emptyReport, summary: generateSwarmSummary(emptyReport), recommendation: generateSwarmRecommendation(emptyReport) }
    }

    // ── FIXTURE.1: pre-warm the fixture-resolver cache ───────────────────────
    // The resolver uses a module-level Map keyed by directory. Calling it once
    // per unique directory primes the cache so all per-file audit calls within
    // the same swarm run pay the disk read at most once per directory.
    const seenDirs = new Set<string>()
    for (const fp of filePaths) {
        const dir = path.dirname(fp)
        if (!seenDirs.has(dir)) {
            seenDirs.add(dir)
            try {
                resolveFixture(fp, projectRoot)
            } catch {
                // Malformed fixture — let the per-file audit surface the error.
            }
        }
    }
    // ── end FIXTURE.1 ────────────────────────────────────────────────────────

    // Step 2: Audit all discovered files
    const batchResult = await handleFlintAuditBatch(
        filePaths,
        { severity: undefined },
        config,
    )

    const healthBefore = batchResult.summary.healthScore

    // Build per-file violation counts for the "before" state
    const beforeCounts = new Map<string, number>()
    for (const fileResult of batchResult.files) {
        const count = fileResult.violations.length + fileResult.a11y.length
        beforeCounts.set(fileResult.filePath, count)
    }

    const filesWithViolations = batchResult.files.filter(
        (f) => f.violations.length + f.a11y.length > 0,
    ).length

    // Step 3: Apply fixes if requested
    let totalFixesApplied = 0
    const fileFixCounts = new Map<string, number>()

    if (autoFix && !dryRun) {
        for (const fileResult of batchResult.files) {
            const violationCount = fileResult.violations.length + fileResult.a11y.length
            if (violationCount === 0) continue

            let source: string
            try {
                source = fs.readFileSync(fileResult.filePath, 'utf-8')
            } catch {
                continue
            }

            const fixResult = await handleFlintFix(
                { source, filePath: fileResult.filePath },
                config,
            )

            if (fixResult.fixesApplied > 0) {
                try {
                    // Commandment 12: atomic write via .tmp → rename
                    const tmpPath = fileResult.filePath + '.flint-tmp-' + crypto.randomUUID().slice(0, 8)
                    fs.writeFileSync(tmpPath, fixResult.fixedSource, 'utf-8')
                    fs.renameSync(tmpPath, fileResult.filePath)
                    totalFixesApplied += fixResult.fixesApplied
                    fileFixCounts.set(fileResult.filePath, fixResult.fixesApplied)
                } catch {
                    // Write failed -- do not count as fixed
                }
            }
        }
    } else if (autoFix && dryRun) {
        // Dry-run: compute what would be fixed without writing to disk
        for (const fileResult of batchResult.files) {
            const violationCount = fileResult.violations.length + fileResult.a11y.length
            if (violationCount === 0) continue

            let source: string
            try {
                source = fs.readFileSync(fileResult.filePath, 'utf-8')
            } catch {
                continue
            }

            const fixResult = await handleFlintFix(
                { source, filePath: fileResult.filePath },
                config,
            )

            if (fixResult.fixesApplied > 0) {
                totalFixesApplied += fixResult.fixesApplied
                fileFixCounts.set(fileResult.filePath, fixResult.fixesApplied)
            }
        }
    }

    // Step 4: Re-audit to get healthAfter (only when files were actually written)
    let healthAfter = healthBefore
    const afterCounts = new Map<string, number>(beforeCounts)

    if (autoFix && !dryRun && totalFixesApplied > 0) {
        const afterBatch = await handleFlintAuditBatch(filePaths, {}, config)
        healthAfter = afterBatch.summary.healthScore
        for (const f of afterBatch.files) {
            afterCounts.set(f.filePath, f.violations.length + f.a11y.length)
        }
    }

    // Step 5: Build per-file reports
    const fileReports: SwarmFileReport[] = filePaths.map((fp) => {
        const before = beforeCounts.get(fp) ?? 0
        const after = afterCounts.get(fp) ?? before
        const wasFixed = (fileFixCounts.get(fp) ?? 0) > 0
        return {
            filePath: fp,
            violationsBefore: before,
            violationsAfter: after,
            fixed: wasFixed,
        }
    })

    const report = {
        filesScanned: filePaths.length,
        filesWithViolations,
        totalViolations: batchResult.summary.totalViolations,
        fixesApplied: totalFixesApplied,
        healthBefore,
        healthAfter,
        fileReports,
        durationMs: Date.now() - startMs,
    }
    return { ...report, summary: generateSwarmSummary(report), recommendation: generateSwarmRecommendation(report) }
}
