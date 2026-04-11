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
 * COUNSEL.1.3: Computes health score using the canonical severity-weighted formula.
 *
 * Formula: clamp(100 - a11yCount × 10 - mithrilCount × 3, 0, 100)
 *
 * This matches the canonical formula from useGovernanceHealth.ts:
 *   score = 100 - criticals × 10 - warnings × 3 - infos × 1
 * where a11y violations are always 'critical' (penalty 10) and mithril
 * violations default to 'amber/warning' (penalty 3).
 *
 * overrideCount is always 0 for file-scan reports (override data lives
 * in Glass/SQLite, not static files).
 *
 * MUST stay in sync with shared/healthSignal.formatHealthSignal and
 * src/hooks/useGovernanceHealth.computeCanonicalHealthScore.
 */
export function computeHealthScoreFromViolationTypes(mithrilCount: number, a11yCount: number): number {
    const raw = 100 - a11yCount * 10 - mithrilCount * 3
    return Math.max(0, Math.min(100, raw))
}

/**
 * Computes health score from pre-bucketed severity counts.
 * This is the canonical formula that matches useGovernanceHealth.computeCanonicalHealthScore.
 *
 * Formula: 100 - (criticals x 10 + warnings x 3 + infos x 1), clamped to [0, 100].
 */
export function computeHealthScore(
    criticals: number,
    warnings: number,
    infos: number,
): number {
    const raw = 100 - (criticals * 10 + warnings * 3 + infos * 1)
    return Math.max(0, Math.min(100, raw))
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
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
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
    // Violation-type accumulators for the canonical health score formula.
    // Rule IDs starting with 'MITHRIL-' are Mithril (fidelity) violations;
    // rule IDs starting with 'A11Y-' are accessibility violations.
    let mithrilViolationCount = 0
    let a11yViolationCount = 0
    const byCategory: Record<string, number> = {}
    const byFileMap: Map<string, { count: number; worst: string; worstSeverity: number }> = new Map()
    const ruleAccumulator: Map<string, { count: number; severity: string }> = new Map()

    for (const filePath of files) {
        let source: string
        try {
            source = fs.readFileSync(filePath, 'utf-8')
        } catch {
            continue
        }

        const violations = scanFile(source, tokens)
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

            // Violation-type counts for canonical health score formula
            if (v.ruleId.startsWith('MITHRIL-')) {
                mithrilViolationCount++
            } else if (v.ruleId.startsWith('A11Y-')) {
                a11yViolationCount++
            }

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
    // Use canonical formula (matches shared/healthSignal and GovernanceDashboard):
    // clamp(100 - mithrilCount × 5 - a11yCount × 10, 0, 100)
    // overrideCount is omitted (always 0 for file scans — overrides are live Glass state).
    const healthScore = computeHealthScoreFromViolationTypes(mithrilViolationCount, a11yViolationCount)
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
        ...(weightedScore !== undefined ? { weightedScore } : {}),
    }

    if (track) {
        appendHistory(projectRoot, report)
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
