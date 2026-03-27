/**
 * Audit command -- flint-ci/src/commands/audit.ts
 *
 * Scans source files for Mithril design system and accessibility violations.
 * Delegates all linting to the shared MCP engine. Handles file collection,
 * terminal output formatting, optional SARIF generation, and exit code logic.
 *
 * Exit codes: 0=pass, 1=blocked, 2=usage error, 3=config error.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import {
    auditFiles,
    shouldBlock,
    loadTokens,
    loadGovernanceConfig,
    buildSarifReport,
    DEFAULT_POLICY,
} from '../engine.js'
import type { AuditSummary, FlintPolicy } from '../engine.js'
import { ANSI } from '../utils/ansi.js'
import { isSourceFile, collectSourceFiles } from '../utils/files.js'

/**
 * Gets git-changed source files relative to the merge base.
 * Tries origin/main, then origin/master, then HEAD~1 as fallback.
 */
function getGitChangedFiles(): string[] {
    try {
        let baseBranch = 'main'
        try {
            execSync('git rev-parse --verify origin/main', {
                encoding: 'utf-8',
                stdio: 'pipe',
            })
        } catch {
            try {
                execSync('git rev-parse --verify origin/master', {
                    encoding: 'utf-8',
                    stdio: 'pipe',
                })
                baseBranch = 'master'
            } catch {
                // Fall back to HEAD~1
                const diff = execSync('git diff --name-only HEAD~1', {
                    encoding: 'utf-8',
                }).trim()
                if (!diff) return []
                return diff.split('\n').filter(isSourceFile)
            }
        }

        const diff = execSync(
            `git diff --name-only --diff-filter=ACMR origin/${baseBranch}...HEAD`,
            { encoding: 'utf-8' },
        ).trim()
        if (!diff) return []
        return diff.split('\n').filter(isSourceFile)
    } catch {
        console.error(
            `${ANSI.yellow}Warning: Could not determine git changes. Use a path argument instead.${ANSI.reset}`,
        )
        return []
    }
}

// ── Output formatting ────────────────────────────────────────────────────────

function printSummary(summary: AuditSummary, blocked: boolean): void {
    const divider = '='.repeat(60)

    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log(`${ANSI.bold}  Flint Governance Gate${ANSI.reset}`)
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()
    console.log(`  Files scanned:          ${summary.totalFiles}`)
    console.log(`  Files with violations:  ${summary.filesWithViolations}`)
    console.log(`  Mithril warnings:       ${summary.totalMithrilWarnings}`)
    console.log(`  A11y violations:        ${summary.totalA11yViolations}`)
    console.log(
        `  Critical:               ${ANSI.red}${summary.criticalCount}${ANSI.reset}`,
    )
    console.log(
        `  Amber:                  ${ANSI.yellow}${summary.amberCount}${ANSI.reset}`,
    )
    console.log()

    // Detail per file
    for (const result of summary.results) {
        const mCount = result.mithrilWarnings.length
        const aCount = Object.values(result.a11yViolations).reduce(
            (s, a) => s + a.length,
            0,
        )
        if (mCount === 0 && aCount === 0 && !result.parseError) continue

        console.log(`${ANSI.bold}  ${result.filePath}${ANSI.reset}`)

        if (result.parseError) {
            console.log(
                `    ${ANSI.red}PARSE ERROR: ${result.parseError}${ANSI.reset}`,
            )
            continue
        }

        for (const w of result.mithrilWarnings) {
            const color = w.severity === 'critical' ? ANSI.red : ANSI.yellow
            const badge = w.severity === 'critical' ? 'CRIT' : 'AMBR'
            console.log(`    ${color}[${badge}]${ANSI.reset} ${w.message}`)
        }

        for (const [elemId, messages] of Object.entries(result.a11yViolations)) {
            for (const msg of messages) {
                console.log(
                    `    ${ANSI.red}[A11Y]${ANSI.reset} ${ANSI.dim}${elemId}:${ANSI.reset} ${msg}`,
                )
            }
        }
        console.log()
    }

    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    if (blocked) {
        console.log(`${ANSI.red}${ANSI.bold}  RESULT: BLOCKED${ANSI.reset}`)
    } else {
        console.log(`${ANSI.green}${ANSI.bold}  RESULT: PASSED${ANSI.reset}`)
    }
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()
}

// ── Main command ─────────────────────────────────────────────────────────────

export interface AuditOptions {
    changed?: boolean
    sarif?: string
    failOnWarning?: boolean
    tokens?: string
    policy?: string
    projectRoot?: string
}

export async function auditCommand(
    paths: string[],
    opts: AuditOptions,
): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
    const useChanged = opts.changed ?? false

    // Load governance config (YAML first, then legacy JSON, then defaults)
    let policy: FlintPolicy
    if (opts.policy && fs.existsSync(opts.policy)) {
        // Explicit policy file overrides everything
        try {
            const raw = fs.readFileSync(opts.policy, 'utf-8')
            policy = { ...DEFAULT_POLICY, ...JSON.parse(raw) }
        } catch {
            console.error(
                `${ANSI.red}Error: Could not parse policy file ${opts.policy}${ANSI.reset}`,
            )
            return 3
        }
    } else {
        const { config } = loadGovernanceConfig(projectRoot)
        policy = config.policy
    }

    // Load tokens
    const tokenPath = opts.tokens ?? path.join(projectRoot, '.flint', 'design-tokens.json')
    const tokens = loadTokens(tokenPath)

    if (tokens.length > 0) {
        console.log(
            `${ANSI.dim}Loaded ${tokens.length} design tokens from ${tokenPath}${ANSI.reset}`,
        )
    } else {
        console.log(
            `${ANSI.yellow}No design tokens found at ${tokenPath} -- Mithril color drift checks will be limited${ANSI.reset}`,
        )
    }

    // Collect files
    let filePaths: string[]

    if (useChanged) {
        filePaths = getGitChangedFiles()
        console.log(
            `${ANSI.dim}Found ${filePaths.length} git-changed source files${ANSI.reset}`,
        )
    } else if (paths.length > 0) {
        filePaths = []
        for (const p of paths) {
            const resolved = path.resolve(p)
            try {
                const stat = fs.statSync(resolved)
                if (stat.isDirectory()) {
                    filePaths.push(...collectSourceFiles(resolved))
                } else if (stat.isFile() && isSourceFile(resolved)) {
                    filePaths.push(resolved)
                }
            } catch {
                console.error(
                    `${ANSI.yellow}Warning: Cannot access ${p}${ANSI.reset}`,
                )
            }
        }
        console.log(
            `${ANSI.dim}Found ${filePaths.length} source files to scan${ANSI.reset}`,
        )
    } else {
        // Default: scan current directory
        filePaths = collectSourceFiles(projectRoot)
        console.log(
            `${ANSI.dim}Found ${filePaths.length} source files in ${projectRoot}${ANSI.reset}`,
        )
    }

    if (filePaths.length === 0) {
        console.log(
            `${ANSI.green}No source files to scan. Governance gate passed.${ANSI.reset}`,
        )
        return 0
    }

    // Read file contents
    const files: Array<{ path: string; content: string }> = []
    for (const fp of filePaths) {
        try {
            const content = fs.readFileSync(fp, 'utf-8')
            // Use relative path for cleaner output
            const relPath = path.relative(process.cwd(), fp) || fp
            files.push({ path: relPath, content })
        } catch {
            console.error(
                `${ANSI.yellow}Warning: Could not read ${fp}${ANSI.reset}`,
            )
        }
    }

    // Run audit
    const summary = auditFiles(files, tokens, policy)

    // Generate SARIF if requested
    if (opts.sarif) {
        const sarif = buildSarifReport(summary)
        fs.writeFileSync(opts.sarif, JSON.stringify(sarif, null, 2), 'utf-8')
        console.log(
            `${ANSI.dim}SARIF report written to ${opts.sarif}${ANSI.reset}`,
        )
    }

    // Determine blocked status
    const blocked = shouldBlock(
        summary,
        projectRoot,
        opts.failOnWarning ?? false,
    )

    // Print summary
    printSummary(summary, blocked)

    return blocked ? 1 : 0
}
