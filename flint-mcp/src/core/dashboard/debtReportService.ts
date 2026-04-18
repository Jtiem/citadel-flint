/**
 * DebtReportService — flint-mcp/src/core/dashboard/debtReportService.ts
 *
 * Scans a project's codebase for design system violations (Mithril + A11y)
 * and produces an aggregated DebtReport with a health score (0-100), letter
 * grade (A-F), violation breakdown by severity / category / file, and
 * optional trend tracking via .flint/debt-history.json.
 *
 * This module runs in the MCP server process (Node.js). It MUST NOT be
 * imported anywhere inside src/ (process boundary law).
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import { auditAll } from '../MithrilLinter.js'
import { A11yLinter } from '../A11yLinter.js'
import type { DesignToken, LinterWarning } from '../../types.js'
import type { DebtReport, DebtHistoryEntry, DashboardData } from './types.js'
import { resolveWeights } from '../governance/scoringWeightsService.js'
import { loadProjectConfig } from '../config-loader.js'
import type { CoverageSummary, CoverageVerdict, CoverageReason } from '../../../../shared/coverage-types.js'

// ── Glob helper ──────────────────────────────────────────────────────────────

/**
 * Simple recursive file finder that matches files against a glob-like pattern.
 * Supports `**` for recursive directory traversal and `*` for single-segment
 * wildcards. This avoids adding a new dependency (glob/fast-glob are not in
 * flint-mcp's direct dependencies).
 *
 * Excluded directories: node_modules, dist, dist-electron, .git, .flint
 */
function findFiles(rootDir: string, globPattern: string): string[] {
    const results: string[] = []
    const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.flint'])

    // Convert glob pattern to regex
    // **/*.tsx  ->  match any .tsx file recursively
    // *.tsx     ->  match .tsx files in root only
    const isRecursive = globPattern.includes('**')
    const filePattern = globPattern.replace(/\*\*\//g, '').replace(/\*\*/g, '')

    // Build a regex for the file name portion
    const fileRegex = new RegExp(
        '^' +
        filePattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '[^/]*') +
        '$'
    )

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

// ── Severity mapping ────────────────────────────────────────────────────────

/**
 * Maps linter severity strings to the DebtReport severity buckets.
 *
 * MithrilLinter uses 'amber' and 'critical'.
 * A11yLinter violations are always 'critical' (Commandment 5).
 * We map:
 *   'critical' -> 'critical'
 *   'amber'    -> 'warning'
 *   anything else -> 'info'
 */
function mapSeverity(sev: string): 'critical' | 'warning' | 'info' {
    if (sev === 'critical') return 'critical'
    if (sev === 'amber') return 'warning'
    return 'info'
}

// ── Rule ID extraction ──────────────────────────────────────────────────────

/**
 * Extracts the rule ID from a violation message string.
 * Examples:
 *   "MITHRIL-COL: deltaE 5.2 ..." -> "MITHRIL-COL"
 *   "MITHRIL-TYP-001: arbitrary ..." -> "MITHRIL-TYP-001"
 *   "MITHRIL-SPC-001: arbitrary ..." -> "MITHRIL-SPC-001"
 *   "MITHRIL-SHD-001: arbitrary ..." -> "MITHRIL-SHD-001"
 *   "MITHRIL-OPC-001: arbitrary ..." -> "MITHRIL-OPC-001"
 *   "A11Y-001: <img> is missing ..." -> "A11Y-001"
 */
function extractRuleId(message: string): string {
    const match = /^((?:MITHRIL-[A-Z]+-?\d*|A11Y-\d+))/.exec(message)
    return match?.[1] ?? 'UNKNOWN'
}

// ── Health score & grade ────────────────────────────────────────────────────

/**
 * CANONICAL HEALTH SCORE FORMULA (CHRON.1-repair / C2).
 *
 * Mirror of shared/healthScore.ts — that file is the source of truth for every
 * Flint surface (Glass hook, CI debt CLI, SARIF, DBOM). The flint-mcp build
 * uses rootDir: './src' and cannot import files outside the package, so this
 * function is inlined with a cross-package parity test that fails loudly if
 * the two ever drift.
 *
 * Formula:
 *   score = clamp(100
 *             - criticalCount * 10
 *             - amberCount    * 3
 *             - advisoryCount * 1
 *             - overrideCount * 3,
 *           0, 100)
 *
 * Grade bands: A >= 90, B >= 80, C >= 70, D >= 60, F < 60.
 */
export function computeHealthScore(
    criticals: number,
    warnings: number,
    infos: number,
    overrides: number = 0,
): number {
    const c = Math.max(0, Math.floor(criticals ?? 0))
    const w = Math.max(0, Math.floor(warnings ?? 0))
    const i = Math.max(0, Math.floor(infos ?? 0))
    const o = Math.max(0, Math.floor(overrides ?? 0))
    const raw = 100 - c * 10 - w * 3 - i * 1 - o * 3
    return Math.max(0, Math.min(100, Math.round(raw)))
}

/**
 * Maps a health score (0-100) to a letter grade.
 *   A: 90-100
 *   B: 80-89
 *   C: 70-79
 *   D: 60-69
 *   F: 0-59
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (!Number.isFinite(score)) return 'F'
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

// ── Coverage aggregation ────────────────────────────────────────────────────

/** All possible CoverageReason values in stable wire-format order. */
const ALL_COVERAGE_REASONS: readonly CoverageReason[] = [
    'css-in-js-detected',
    'external-stylesheet-imported',
    'css-modules-reference',
    'dynamic-class-expression',
    'unresolvable-var',
    'tailwind-config-extension',
    'non-jsx-framework',
    'non-literal-ternary-branch',
    'parse-failure',
] as const

/**
 * Aggregates an array of per-file CoverageVerdicts into a CoverageSummary.
 *
 * Invariants (from Phase 0 contract):
 *   - totalFiles === parsedFiles + partialFiles + skippedFiles
 *   - governedSurfacePercent === round1((parsedFiles / totalFiles) * 100)
 *     (when totalFiles === 0, governedSurfacePercent === 0)
 *   - sum(skippedFilesByReason values) === (partialFiles + skippedFiles)
 *
 * NOTE: This function does NOT feed into the grade formula. healthScore and
 * grade are computed independently (invariant coverage-grade-independence = 0).
 */
export function computeCoverageSummary(
    verdicts: Array<{ filePath: string; verdict: CoverageVerdict }>,
): CoverageSummary {
    const totalFiles = verdicts.length

    // Initialize all reason counts to 0 (every key always present per contract)
    const skippedFilesByReason = Object.fromEntries(
        ALL_COVERAGE_REASONS.map(r => [r, 0]),
    ) as Record<CoverageReason, number>

    let parsedFiles = 0
    let partialFiles = 0
    let skippedFiles = 0

    for (const { verdict } of verdicts) {
        if (verdict.status === 'parsed') {
            parsedFiles++
        } else if (verdict.status === 'partial') {
            partialFiles++
            if (verdict.reason !== null) {
                skippedFilesByReason[verdict.reason] = (skippedFilesByReason[verdict.reason] ?? 0) + 1
            }
        } else {
            // skipped-unsupported
            skippedFiles++
            if (verdict.reason !== null) {
                skippedFilesByReason[verdict.reason] = (skippedFilesByReason[verdict.reason] ?? 0) + 1
            }
        }
    }

    // Use full-precision division; round only at the serialization edge (1 dp).
    const governedSurfacePercent =
        totalFiles === 0
            ? 0
            : Math.round((parsedFiles / totalFiles) * 100 * 10) / 10

    return {
        governedSurfacePercent,
        totalFiles,
        parsedFiles,
        partialFiles,
        skippedFiles,
        skippedFilesByReason,
        timestamp: new Date().toISOString(),
    }
}

/**
 * Returns an empty CoverageSummary (all-zero) suitable for use when no
 * verdicts have been collected yet.
 */
export function emptyCoverageSummary(): CoverageSummary {
    return computeCoverageSummary([])
}

// ── Token loading ───────────────────────────────────────────────────────────

/**
 * Loads design tokens from .flint/design-tokens.json.
 * Returns an empty array if the file does not exist or cannot be parsed.
 */
function loadTokens(projectRoot: string): DesignToken[] {
    const tokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')
    if (!fs.existsSync(tokensPath)) return []

    try {
        const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
        return Array.isArray(raw) ? raw : Object.values(raw)
    } catch {
        return []
    }
}

// ── File violation scanning ─────────────────────────────────────────────────

interface FileViolation {
    ruleId: string
    severity: 'critical' | 'warning' | 'info'
    message: string
}

/**
 * Scans a single file for Mithril and A11y violations.
 * Returns an array of FileViolation objects, or an empty array if the file
 * cannot be parsed.
 */
function scanFile(source: string, tokens: DesignToken[]): FileViolation[] {
    const violations: FileViolation[] = []

    let ast
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch {
        // Unparseable files are silently skipped — not a governance violation.
        return violations
    }

    // Mithril violations (Map<flintId, LinterWarning>)
    const mithrilWarnings = auditAll(ast as any, tokens)
    for (const warning of mithrilWarnings.values()) {
        violations.push({
            ruleId: extractRuleId(warning.message),
            severity: mapSeverity(warning.severity),
            message: warning.message,
        })
    }

    // A11y violations — use the new structured runner for richer data
    const a11yResult = A11yLinter.auditStructured(ast as any)
    for (const v of a11yResult.violations) {
        violations.push({
            ruleId: v.ruleId,
            severity: 'critical', // Commandment 5: a11y is a compiler error
            message: v.message,
        })
    }

    return violations
}

// ── Report generation ───────────────────────────────────────────────────────

export interface GenerateReportOptions {
    /** Project root directory (must contain .flint/). */
    projectRoot: string
    /** Glob pattern for files to scan (default: '**\/*.tsx'). */
    glob?: string
    /** If true, append a snapshot to .flint/debt-history.json. */
    track?: boolean
}

/**
 * Scans the project codebase and generates a DebtReport.
 */
export function generateDebtReport(options: GenerateReportOptions): DebtReport {
    const { projectRoot, glob: globPattern = '**/*.tsx', track = false } = options

    const tokens = loadTokens(projectRoot)
    const files = findFiles(projectRoot, globPattern)

    // Accumulators
    const bySeverity = { critical: 0, warning: 0, info: 0 }
    const byCategory: Record<string, number> = {}
    const byFileMap: Map<string, { count: number; worst: string; worstSeverity: number }> = new Map()
    const ruleAccumulator: Map<string, { count: number; severity: string }> = new Map()

    // Coverage verdicts: one per scanned file (Phase 0 — Coverage Honesty).
    // Until MithrilLinter/A11yLinter wire in the full classifier (Group A:
    // flint-ast-surgeon), we produce a best-effort verdict based on whether
    // the file can be Babel-parsed. Fully-parseable JSX/TSX files are
    // classified `parsed`; files that throw during parse are classified
    // `skipped-unsupported`. This satisfies the coverage-emit-parity invariant
    // (one verdict per file scanned).
    const coverageVerdicts: Array<{ filePath: string; verdict: CoverageVerdict }> = []

    for (const filePath of files) {
        let source: string
        try {
            source = fs.readFileSync(filePath, 'utf-8')
        } catch {
            continue
        }

        const violations = scanFile(source, tokens)

        // Classify coverage for this file based on Babel parse outcome.
        // We re-attempt a parse check here so the verdict is accurate even
        // for files with zero violations (they are still "parsed").
        let verdict: CoverageVerdict
        try {
            parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
            verdict = { status: 'parsed', reason: null }
        } catch {
            // File matched the glob but could not be parsed — skipped.
            verdict = { status: 'skipped-unsupported', reason: 'non-jsx-framework' }
        }
        coverageVerdicts.push({ filePath, verdict })

        if (violations.length === 0) continue

        // Severity weight for "worst" ranking: critical=3, warning=2, info=1
        const severityWeight = (s: string): number =>
            s === 'critical' ? 3 : s === 'warning' ? 2 : 1

        // Use relative path for readability
        const relativePath = path.relative(projectRoot, filePath)

        let fileWorst = ''
        let fileWorstWeight = 0

        for (const v of violations) {
            // Severity counts
            bySeverity[v.severity]++

            // Category counts
            byCategory[v.ruleId] = (byCategory[v.ruleId] ?? 0) + 1

            // Rule accumulation
            const existing = ruleAccumulator.get(v.ruleId)
            if (existing) {
                existing.count++
                if (severityWeight(v.severity) > severityWeight(existing.severity)) {
                    existing.severity = v.severity
                }
            } else {
                ruleAccumulator.set(v.ruleId, { count: 1, severity: v.severity })
            }

            // Track worst violation per file
            const w = severityWeight(v.severity)
            if (w > fileWorstWeight) {
                fileWorstWeight = w
                fileWorst = v.ruleId
            }
        }

        const fileEntry = byFileMap.get(relativePath)
        if (fileEntry) {
            fileEntry.count += violations.length
            if (fileWorstWeight > fileEntry.worstSeverity) {
                fileEntry.worst = fileWorst
                fileEntry.worstSeverity = fileWorstWeight
            }
        } else {
            byFileMap.set(relativePath, {
                count: violations.length,
                worst: fileWorst,
                worstSeverity: fileWorstWeight,
            })
        }
    }

    const totalViolations = bySeverity.critical + bySeverity.warning + bySeverity.info
    // Canonical severity-bucketed formula (mirrors shared/healthScore.ts).
    // File-scan reports cannot see live overrides (those live in Glass/SQLite),
    // so overrideCount is fixed at 0 here. `flint_debt_report` callers that
    // need override-weighted scores should pull them via flint://overrides and
    // recompute client-side.
    const healthScore = computeHealthScore(
        bySeverity.critical,
        bySeverity.warning,
        bySeverity.info,
        0,
    )
    const grade = scoreToGrade(healthScore)
    const timestamp = new Date().toISOString()

    // Sort byFile by count descending
    const byFile = Array.from(byFileMap.entries())
        .map(([filePath, data]) => ({ filePath, count: data.count, worst: data.worst }))
        .sort((a, b) => b.count - a.count)

    // Sort topRules by count descending
    const topRules = Array.from(ruleAccumulator.entries())
        .map(([ruleId, data]) => ({ ruleId, count: data.count, severity: data.severity }))
        .sort((a, b) => b.count - a.count)

    // UCFG.7b: Compute weighted score using configurable scoring weights.
    // When mode-aware violation scanning is available, each violation should
    // carry an explicit 'mode' label (coercive/normative/advisory). Until then
    // we use severity as a proxy: critical → coercive, warning → normative,
    // info → advisory. This ensures coercive-weight violations inflate the
    // weighted score more than advisory ones, making the weighted score
    // meaningful for projects with domain presets (healthcare, fintech, etc.).
    let weightedScore: DebtReport['weightedScore']
    try {
        const yamlConfig = loadProjectConfig(projectRoot)
        if (yamlConfig !== null) {
            const weights = resolveWeights(yamlConfig.scoring, yamlConfig.domain)

            // Build a pseudo-violation list using severity as mode proxy.
            // TODO: replace with actual mode labels once scanFile propagates them.
            const modeProxyViolations = [
                ...Array(bySeverity.critical).fill({ mode: 'coercive' }),
                ...Array(bySeverity.warning).fill({ mode: 'normative' }),
                ...Array(bySeverity.info).fill({ mode: 'advisory' }),
            ] as { mode: string }[]

            let weighted = 0
            for (const v of modeProxyViolations) {
                switch (v.mode) {
                    case 'coercive': weighted += weights.coercive; break
                    case 'normative': weighted += weights.normative; break
                    default: weighted += weights.advisory
                }
            }

            weightedScore = { raw: totalViolations, weighted, weights }
        }
    } catch {
        // weightedScore is best-effort — never block report generation
    }

    // Compute coverage summary AFTER the health score is finalized.
    // Coverage is purely informational — it does NOT read or feed into
    // healthScore or grade (invariant: coverage-grade-independence = 0).
    const coverage = computeCoverageSummary(coverageVerdicts)

    const report: DebtReport = {
        healthScore,
        grade,
        totalViolations,
        bySeverity,
        byCategory,
        byFile,
        topRules,
        scannedFiles: files.length,
        timestamp,
        coverage,
        ...(weightedScore !== undefined ? { weightedScore } : {}),
    }

    if (track) {
        appendHistory(projectRoot, report)
    }

    // Cache coverage to .flint/coverage-cache.json so that assembleSessionContext
    // can serve it without re-scanning. Best-effort — never blocks report output.
    try {
        const flintDir = path.join(projectRoot, '.flint')
        if (!fs.existsSync(flintDir)) {
            fs.mkdirSync(flintDir, { recursive: true })
        }
        fs.writeFileSync(
            path.join(flintDir, 'coverage-cache.json'),
            JSON.stringify(coverage, null, 2),
            'utf-8',
        )
    } catch {
        // Non-fatal: cache is best-effort
    }

    return report
}

// ── Debt history tracking ───────────────────────────────────────────────────

const MAX_HISTORY_ENTRIES = 100

/**
 * Appends a snapshot to .flint/debt-history.json.
 * Rotates at MAX_HISTORY_ENTRIES by removing the oldest entries.
 */
function appendHistory(projectRoot: string, report: DebtReport): void {
    const historyPath = path.join(projectRoot, '.flint', 'debt-history.json')
    let history: DebtHistoryEntry[] = []

    if (fs.existsSync(historyPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
            if (Array.isArray(raw)) {
                history = raw
            }
        } catch {
            // Corrupt file — start fresh
            history = []
        }
    }

    const entry: DebtHistoryEntry = {
        timestamp: report.timestamp,
        healthScore: report.healthScore,
        grade: report.grade,
        totalViolations: report.totalViolations,
    }

    history.push(entry)

    // Rotate: keep only the last MAX_HISTORY_ENTRIES
    if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(history.length - MAX_HISTORY_ENTRIES)
    }

    // Ensure .flint directory exists
    const flintDir = path.join(projectRoot, '.flint')
    if (!fs.existsSync(flintDir)) {
        fs.mkdirSync(flintDir, { recursive: true })
    }

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8')
}

// ── History reading ─────────────────────────────────────────────────────────

/**
 * Reads the last N debt history entries from .flint/debt-history.json.
 * Returns an empty array if the file does not exist.
 */
export function readHistory(projectRoot: string, limit = 10): DebtHistoryEntry[] {
    const historyPath = path.join(projectRoot, '.flint', 'debt-history.json')

    if (!fs.existsSync(historyPath)) return []

    try {
        const raw = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
        if (!Array.isArray(raw)) return []
        // Return newest first, limited
        return raw.slice(-limit).reverse()
    } catch {
        return []
    }
}

// ── Dashboard data ──────────────────────────────────────────────────────────

/**
 * Generates the DashboardData payload for the flint://dashboard resource.
 * Runs a full scan if no cached report exists.
 */
export function generateDashboard(projectRoot: string): DashboardData {
    const report = generateDebtReport({ projectRoot })
    const history = readHistory(projectRoot, 10)

    // SYNC.4: Attempt to include sync health metrics
    let syncStatus: 'synced' | 'stale' | 'conflicts' | 'disconnected' = 'disconnected'
    let lastSyncAt: string | null = null
    let pendingConflicts = 0

    try {
        const BetterSqlite3 = require('better-sqlite3')
        const dbPath = path.join(projectRoot, '.flint', 'sync.db')
        if (fs.existsSync(dbPath)) {
            const { SyncCheckService } = require('../sync/syncCheckService.js')
            const { SyncSchema } = require('../sync/syncSchema.js')
            const db = new BetterSqlite3(dbPath)
            new SyncSchema(db)
            const checkSvc = new SyncCheckService(db)
            const report2 = checkSvc.runSyncCheck(projectRoot)
            pendingConflicts = report2.pendingConflicts
            lastSyncAt = report2.staleSince

            if (report2.inSync) {
                syncStatus = 'synced'
            } else if (report2.pendingConflicts > 0) {
                syncStatus = 'conflicts'
            } else if (report2.tokensDrifted > 0) {
                syncStatus = 'stale'
            }
            db.close()
        }
    } catch {
        // sync.db may not exist yet — that's fine
    }

    return {
        healthScore: report.healthScore,
        grade: report.grade,
        bySeverity: report.bySeverity,
        history,
        timestamp: report.timestamp,
        syncStatus,
        lastSyncAt,
        pendingConflicts,
        coverage: report.coverage,
    }
}

// ── Markdown formatting ─────────────────────────────────────────────────────

/**
 * Formats a DebtReport as a human-readable Markdown document.
 */
export function formatReportAsMarkdown(report: DebtReport): string {
    const lines: string[] = []

    lines.push(`# Design Debt Report`)
    lines.push('')
    lines.push(`**Generated:** ${report.timestamp}`)
    lines.push(`**Health Score:** ${report.healthScore}/100 (Grade: ${report.grade})`)
    lines.push(`**Total Violations:** ${report.totalViolations}`)
    lines.push(`**Files Scanned:** ${report.scannedFiles}`)
    lines.push('')

    // Coverage narrative grammar (Phase 0 contract)
    if (report.coverage) {
        const cov = report.coverage
        lines.push(
            `**Governing ${cov.parsedFiles} of ${cov.totalFiles} files ` +
            `(${cov.governedSurfacePercent}% governed surface area)**`,
        )
        const nonZeroReasons = Object.entries(cov.skippedFilesByReason)
            .filter(([, count]) => count > 0)
        if (nonZeroReasons.length > 0) {
            const reasonList = nonZeroReasons
                .map(([reason, count]) => `${reason}: ${count}`)
                .join(', ')
            lines.push(`${cov.skippedFiles + cov.partialFiles} files skipped: ${reasonList}`)
        }
        lines.push('')
    }

    // Severity breakdown
    lines.push(`## Violations by Severity`)
    lines.push('')
    lines.push(`| Severity | Count |`)
    lines.push(`|----------|-------|`)
    lines.push(`| Critical | ${report.bySeverity.critical} |`)
    lines.push(`| Warning  | ${report.bySeverity.warning} |`)
    lines.push(`| Info     | ${report.bySeverity.info} |`)
    lines.push('')

    // Top rules
    if (report.topRules.length > 0) {
        lines.push(`## Top Violated Rules`)
        lines.push('')
        lines.push(`| Rule | Count | Severity |`)
        lines.push(`|------|-------|----------|`)
        for (const rule of report.topRules.slice(0, 10)) {
            lines.push(`| ${rule.ruleId} | ${rule.count} | ${rule.severity} |`)
        }
        lines.push('')
    }

    // Files with most violations
    if (report.byFile.length > 0) {
        lines.push(`## Hotspot Files`)
        lines.push('')
        lines.push(`| File | Violations | Worst Rule |`)
        lines.push(`|------|------------|------------|`)
        for (const file of report.byFile.slice(0, 15)) {
            lines.push(`| ${file.filePath} | ${file.count} | ${file.worst} |`)
        }
        lines.push('')
    }

    // Category breakdown
    if (Object.keys(report.byCategory).length > 0) {
        lines.push(`## Violations by Category`)
        lines.push('')
        lines.push(`| Category | Count |`)
        lines.push(`|----------|-------|`)
        const sorted = Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])
        for (const [cat, count] of sorted) {
            lines.push(`| ${cat} | ${count} |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}
