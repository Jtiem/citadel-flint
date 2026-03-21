/**
 * flint_debt_report MCP tool handler — flint-mcp/src/tools/debtReport.ts
 *
 * Scans a project's codebase for Mithril and A11y violations, aggregates them
 * into a DebtReport, and returns the result as JSON or Markdown.
 *
 * Registration: imported by server.ts and added to ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import {
    generateDebtReport,
    formatReportAsMarkdown,
} from '../core/dashboard/debtReportService.js'
import type { DebtReport } from '../core/dashboard/types.js'
import { toolName } from '../brand.js'

// ── Tool definition (MCP ListTools schema) ────────────────────────────────────

export const FLINT_DEBT_REPORT_TOOL = {
    name: toolName('debt_report'),
    description:
        'Generate a project-wide Design Debt Report. Scans all matching source files ' +
        'for Mithril (color drift, typography, spacing, shadow, opacity) and A11y (WCAG 2.1 AA) ' +
        'violations. Returns a health score (0-100), letter grade (A-F), and violation breakdown ' +
        'by severity, category, and file. Optionally tracks history in .flint/debt-history.json.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root (defaults to cwd). Must contain a .flint directory for token loading.',
            },
            glob: {
                type: 'string',
                description:
                    'Glob pattern for files to scan (default: **/*.tsx). ' +
                    'Supports ** for recursive traversal and * for single-segment wildcards.',
            },
            format: {
                type: 'string',
                enum: ['json', 'markdown'],
                description:
                    "Output format. 'json' returns the raw DebtReport object; " +
                    "'markdown' returns a formatted human-readable report (default: 'json').",
            },
            track: {
                type: 'boolean',
                description:
                    'If true, appends a snapshot to .flint/debt-history.json for trend tracking ' +
                    '(default: false). History is capped at 100 entries (oldest removed first).',
            },
        },
        required: [],
    },
} as const

// ── Handler ───────────────────────────────────────────────────────────────────

export interface DebtReportArgs {
    projectRoot?: string
    glob?: string
    format?: 'json' | 'markdown'
    track?: boolean
}

export function handleDebtReport(args: DebtReportArgs): {
    content: Array<{ type: 'text'; text: string }>
} {
    const { projectRoot = process.cwd(), glob, format = 'json', track = false } = args

    const report: DebtReport = generateDebtReport({
        projectRoot,
        glob,
        track,
    })

    const text =
        format === 'markdown'
            ? formatReportAsMarkdown(report)
            : JSON.stringify(report, null, 2)

    return {
        content: [{ type: 'text', text }],
    }
}
