/**
 * DBOM command -- flint-ci/src/commands/dbom.ts
 *
 * Generates a Design Bill of Materials by calling the MCP engine's
 * dbomService. Outputs the full token/component/violation inventory
 * in JSON, Markdown, or CycloneDX format.
 *
 * Exit codes: 0=success, 3=config/generation error.
 */

import path from 'node:path'
import { ANSI } from '../utils/ansi.js'

// ── Command ──────────────────────────────────────────────────────────────────

export interface DbomOptions {
    format?: 'json' | 'markdown' | 'cyclonedx'
    projectRoot?: string
}

export async function dbomCommand(opts: DbomOptions): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
    const format = opts.format ?? 'json'

    console.error(
        `${ANSI.dim}Generating Design Bill of Materials for ${projectRoot}...${ANSI.reset}`,
    )

    // Try the governance-enriched DBOM service first
    const govResult = await tryGovernanceDBOM(projectRoot, format)
    if (govResult !== null) {
        return govResult
    }

    // Fall back to the core DBOM generator
    const coreResult = await tryCoreDBOM(projectRoot, format)
    if (coreResult !== null) {
        return coreResult
    }

    // Neither service available
    console.error(
        `${ANSI.red}Failed to generate DBOM. Ensure flint-mcp dependencies are installed.${ANSI.reset}`,
    )
    console.error(
        `${ANSI.dim}Run: cd flint-mcp && npm install${ANSI.reset}`,
    )
    return 3
}

// ── Governance-enriched DBOM ─────────────────────────────────────────────────

async function tryGovernanceDBOM(
    projectRoot: string,
    format: string,
): Promise<number | null> {
    try {
        // Dynamic import — cross-package boundary, typed loosely with graceful fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbomModule: any = await import(
            '../../../flint-mcp/src/core/governance/dbomService.js'
        )
        const { generateDBOM, formatDBOMOutput } = dbomModule

        const dbom = await generateDBOM(projectRoot, { dryRun: true })

        if (format === 'markdown') {
            console.log(formatDBOMAsMarkdown(dbom))
        } else if (format === 'cyclonedx') {
            console.log(formatDBOMOutput(dbom, 'cyclonedx'))
        } else {
            console.log(formatDBOMOutput(dbom, 'json'))
        }

        printDbomSummary(dbom)
        return 0
    } catch {
        // Governance DBOM service requires better-sqlite3; fall back
        return null
    }
}

// ── Core DBOM fallback ───────────────────────────────────────────────────────

async function tryCoreDBOM(
    projectRoot: string,
    format: string,
): Promise<number | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coreModule: any = await import(
            '../../../flint-mcp/src/core/dbom/generator.js'
        )
        const { generateDBOM } = coreModule

        const dbom = await generateDBOM(projectRoot)

        if (format === 'markdown') {
            console.log(formatCoreDBOMAsMarkdown(dbom))
        } else {
            // JSON and CycloneDX both output JSON for the core DBOM
            console.log(JSON.stringify(dbom, null, 2))
        }

        console.error()
        console.error(
            `${ANSI.bold}  DBOM Generated${ANSI.reset}`,
        )
        console.error(
            `${ANSI.dim}  Components: ${dbom.components?.length ?? 0}  Tokens: ${dbom.tokens?.length ?? 0}${ANSI.reset}`,
        )
        console.error()

        return 0
    } catch {
        return null
    }
}

// ── Summary printer ──────────────────────────────────────────────────────────

function printDbomSummary(dbom: Record<string, unknown>): void {
    const posture = dbom.posture as
        | { healthScore?: number; grade?: string; totalViolations?: number }
        | undefined

    console.error()
    console.error(`${ANSI.bold}  DBOM Generated${ANSI.reset}`)

    if (posture) {
        const gradeColor =
            posture.grade === 'A' || posture.grade === 'B'
                ? ANSI.green
                : posture.grade === 'C'
                  ? ANSI.yellow
                  : ANSI.red

        console.error(
            `${ANSI.dim}  Health: ${posture.healthScore ?? '?'}/100  Grade: ${gradeColor}${posture.grade ?? '?'}${ANSI.reset}`,
        )
        console.error(
            `${ANSI.dim}  Violations: ${posture.totalViolations ?? 0}${ANSI.reset}`,
        )
    }

    const tokens = dbom.tokens as unknown[] | undefined
    const components = dbom.components as unknown[] | undefined
    console.error(
        `${ANSI.dim}  Tokens: ${tokens?.length ?? 0}  Components: ${components?.length ?? 0}${ANSI.reset}`,
    )
    console.error()
}

// ── Markdown formatters ──────────────────────────────────────────────────────

function formatDBOMAsMarkdown(dbom: Record<string, unknown>): string {
    const lines: string[] = []
    const meta = dbom.metadata as
        | { projectRoot?: string; generatedAt?: string; flintVersion?: string }
        | undefined
    const posture = dbom.posture as
        | { healthScore?: number; grade?: string; totalViolations?: number }
        | undefined
    const tokens = (dbom.tokens ?? []) as Array<{
        path?: string
        type?: string
        value?: string
        compliance?: string
    }>
    const components = (dbom.components ?? []) as Array<{
        name?: string
        filePath?: string
        source?: string
        violationCount?: number
    }>

    lines.push('# Design Bill of Materials')
    lines.push('')
    lines.push(`**Project:** ${meta?.projectRoot ?? 'unknown'}`)
    lines.push(`**Generated:** ${meta?.generatedAt ?? new Date().toISOString()}`)
    lines.push(`**Flint Version:** ${meta?.flintVersion ?? '2.0.0'}`)
    lines.push('')

    if (posture) {
        lines.push('## Governance Posture')
        lines.push('')
        lines.push(`- **Health Score:** ${posture.healthScore ?? '?'}/100`)
        lines.push(`- **Grade:** ${posture.grade ?? '?'}`)
        lines.push(`- **Total Violations:** ${posture.totalViolations ?? 0}`)
        lines.push('')
    }

    if (tokens.length > 0) {
        lines.push('## Tokens')
        lines.push('')
        lines.push('| Path | Type | Value | Status |')
        lines.push('|------|------|-------|--------|')
        for (const t of tokens.slice(0, 50)) {
            lines.push(
                `| ${t.path ?? ''} | ${t.type ?? ''} | ${t.value ?? ''} | ${t.compliance ?? 'unknown'} |`,
            )
        }
        if (tokens.length > 50) {
            lines.push(`| ... | | | ${tokens.length - 50} more |`)
        }
        lines.push('')
    }

    if (components.length > 0) {
        lines.push('## Components')
        lines.push('')
        lines.push('| Name | Source | Violations |')
        lines.push('|------|--------|------------|')
        for (const c of components.slice(0, 30)) {
            lines.push(
                `| ${c.name ?? c.filePath ?? ''} | ${c.source ?? 'unknown'} | ${c.violationCount ?? 0} |`,
            )
        }
        if (components.length > 30) {
            lines.push(`| ... | | ${components.length - 30} more |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

function formatCoreDBOMAsMarkdown(dbom: Record<string, unknown>): string {
    const lines: string[] = []
    const tokens = (dbom.tokens ?? []) as Array<{
        path?: string
        type?: string
        value?: string
    }>
    const components = (dbom.components ?? []) as Array<{
        filePath?: string
        violations?: unknown[]
    }>

    lines.push('# Design Bill of Materials (Core)')
    lines.push('')
    lines.push(`**Generated:** ${(dbom as Record<string, string>).generatedAt ?? new Date().toISOString()}`)
    lines.push(`**Project:** ${(dbom as Record<string, string>).projectRoot ?? 'unknown'}`)
    lines.push('')

    if (tokens.length > 0) {
        lines.push('## Tokens')
        lines.push('')
        lines.push(`Total: ${tokens.length}`)
        lines.push('')
        lines.push('| Path | Type | Value |')
        lines.push('|------|------|-------|')
        for (const t of tokens.slice(0, 50)) {
            lines.push(`| ${t.path ?? ''} | ${t.type ?? ''} | ${t.value ?? ''} |`)
        }
        if (tokens.length > 50) {
            lines.push(`| ... | | ${tokens.length - 50} more |`)
        }
        lines.push('')
    }

    if (components.length > 0) {
        lines.push('## Components')
        lines.push('')
        lines.push(`Total: ${components.length}`)
        lines.push('')
        lines.push('| File | Violations |')
        lines.push('|------|------------|')
        for (const c of components.slice(0, 30)) {
            lines.push(
                `| ${c.filePath ?? ''} | ${c.violations?.length ?? 0} |`,
            )
        }
        if (components.length > 30) {
            lines.push(`| ... | ${components.length - 30} more |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}
