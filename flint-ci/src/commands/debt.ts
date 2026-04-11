/**
 * Debt command -- flint-ci/src/commands/debt.ts
 *
 * Generates a design debt report by calling the MCP engine's
 * debtReportService. Outputs health score, grade, top rules, and
 * hotspot files in either JSON or Markdown format.
 *
 * Exit codes: 0=pass (grade A-C), 1=unhealthy (grade D-F), 3=config error.
 */

import path from 'node:path'
import { ANSI } from '../utils/ansi.js'
import { formatHealthSignal } from '../../../shared/healthSignal.js'

// ── Types (mirrored from MCP for CI portability) ─────────────────────────────

interface DebtReport {
    healthScore: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    totalViolations: number
    bySeverity: { critical: number; warning: number; info: number }
    byCategory: Record<string, number>
    byFile: Array<{ filePath: string; count: number; worst: string }>
    topRules: Array<{ ruleId: string; count: number; severity: string }>
    scannedFiles: number
    timestamp: string
    weightedScore?: {
        raw: number
        weighted: number
        weights: { coercive: number; normative: number; advisory: number; recency: number }
    }
}

// ── Command ──────────────────────────────────────────────────────────────────

export interface DebtOptions {
    format?: 'markdown' | 'json'
    track?: boolean
    projectRoot?: string
}

export async function debtCommand(
    paths: string[],
    opts: DebtOptions,
): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
    const format = opts.format ?? 'json'
    const track = opts.track ?? false

    const scopeLabel = paths.length > 0 ? paths.join(', ') : projectRoot
    console.log(
        `${ANSI.dim}Generating design debt report for ${scopeLabel}...${ANSI.reset}`,
    )

    // Build glob from paths argument — if paths are given, scope the report
    const glob = paths.length > 0
        ? paths.map(p => {
            // If it looks like a directory, append recursive glob
            if (!p.includes('*') && !p.match(/\.[a-z]+$/i)) {
                const normalized = p.replace(/\/+$/, '')
                return `${normalized}/**/*.tsx`
            }
            return p
        }).join(',')
        : '**/*.tsx'

    // Import the MCP engine's debt report service
    let report: DebtReport
    try {
        // Dynamic import — cross-package boundary, typed loosely with graceful fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const debtModule: any = await import(
            '../../../flint-mcp/src/core/dashboard/debtReportService.js'
        )
        report = debtModule.generateDebtReport({
            projectRoot,
            glob,
            track,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(
            `${ANSI.red}Failed to generate debt report: ${msg}${ANSI.reset}`,
        )
        console.error(
            `${ANSI.dim}Ensure flint-mcp dependencies are installed (npm install in flint-mcp/).${ANSI.reset}`,
        )
        return 3
    }

    // Output
    if (format === 'markdown') {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fmtModule: any = await import(
                '../../../flint-mcp/src/core/dashboard/debtReportService.js'
            )
            console.log(fmtModule.formatReportAsMarkdown(report))
        } catch {
            // Fallback: generate markdown inline
            console.log(formatMarkdownFallback(report))
        }
    } else {
        console.log(JSON.stringify(report, null, 2))
    }

    // Print summary to stderr for CI log readability
    const gradeColor =
        report.grade === 'A' || report.grade === 'B'
            ? ANSI.green
            : report.grade === 'C'
              ? ANSI.yellow
              : ANSI.red

    console.error()
    console.error(
        `${ANSI.bold}  Health Score: ${report.healthScore}/100  Grade: ${gradeColor}${report.grade}${ANSI.reset}`,
    )
    console.error(
        `${ANSI.dim}  ${report.totalViolations} violations across ${report.scannedFiles} files${ANSI.reset}`,
    )

    // Break down the health signal into sub-scores (shared with Glass)
    const mithrilCount = report.byCategory['design-system'] ?? report.byCategory['color'] ?? 0
    const a11yCount = report.byCategory['accessibility'] ?? report.byCategory['a11y'] ?? 0
    const overrideCountVal = report.byCategory['override'] ?? 0
    const signal = formatHealthSignal(mithrilCount, a11yCount, overrideCountVal)
    console.error(
        `${ANSI.dim}  Fidelity: ${signal.fidelityScore}/100 | Accessibility: ${signal.a11yScore}/100 | Overrides: ${signal.overrideCount}${ANSI.reset}`,
    )
    console.error()

    if (track) {
        console.error(
            `${ANSI.dim}  Snapshot appended to .flint/debt-history.json${ANSI.reset}`,
        )
    }

    // Exit code: 0 for A-C, 1 for D-F
    return report.grade === 'D' || report.grade === 'F' ? 1 : 0
}

// ── Fallback markdown formatter ──────────────────────────────────────────────

function formatMarkdownFallback(report: DebtReport): string {
    const lines: string[] = []

    lines.push('# Design Debt Report')
    lines.push('')
    lines.push(`**Generated:** ${report.timestamp}`)
    lines.push(
        `**Health Score:** ${report.healthScore}/100 (Grade: ${report.grade})`,
    )
    lines.push(`**Total Violations:** ${report.totalViolations}`)
    lines.push(`**Files Scanned:** ${report.scannedFiles}`)
    lines.push('')

    // Severity breakdown
    lines.push('## Violations by Severity')
    lines.push('')
    lines.push('| Severity | Count |')
    lines.push('|----------|-------|')
    lines.push(`| Critical | ${report.bySeverity.critical} |`)
    lines.push(`| Warning  | ${report.bySeverity.warning} |`)
    lines.push(`| Info     | ${report.bySeverity.info} |`)
    lines.push('')

    // Top rules
    if (report.topRules.length > 0) {
        lines.push('## Top Violated Rules')
        lines.push('')
        lines.push('| Rule | Count | Severity |')
        lines.push('|------|-------|----------|')
        for (const rule of report.topRules.slice(0, 10)) {
            lines.push(`| ${rule.ruleId} | ${rule.count} | ${rule.severity} |`)
        }
        lines.push('')
    }

    // Hotspot files
    if (report.byFile.length > 0) {
        lines.push('## Hotspot Files')
        lines.push('')
        lines.push('| File | Violations | Worst Rule |')
        lines.push('|------|------------|------------|')
        for (const file of report.byFile.slice(0, 15)) {
            lines.push(`| ${file.filePath} | ${file.count} | ${file.worst} |`)
        }
        lines.push('')
    }

    // Category breakdown
    if (Object.keys(report.byCategory).length > 0) {
        lines.push('## Violations by Category')
        lines.push('')
        lines.push('| Category | Count |')
        lines.push('|----------|-------|')
        const sorted = Object.entries(report.byCategory).sort(
            (a, b) => b[1] - a[1],
        )
        for (const [cat, count] of sorted) {
            lines.push(`| ${cat} | ${count} |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}
