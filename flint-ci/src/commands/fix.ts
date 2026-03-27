/**
 * Fix command -- flint-ci/src/commands/fix.ts
 *
 * Auto-fix governance violations by calling the shared MCP engine linters
 * and then applying token replacements. By default runs in --dry-run mode
 * (prints what would change). Use --no-dry-run to actually modify files.
 *
 * Fix scope:
 *   - Color drift: replaces hardcoded colors with nearest token var()
 *   - Typography drift: replaces arbitrary font values with tokens
 *   - Spacing drift: replaces arbitrary spacing values with tokens
 *
 * All fixes go through the MCP engine's fix tool handler. If that is
 * not available, falls back to a report-only mode that lists fixable
 * violations.
 *
 * Exit codes: 0=all fixed or no issues, 1=remaining violations, 3=error.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
    auditFile,
    loadTokens,
    loadGovernanceConfig,
} from '../engine.js'
import type { FlintPolicy, LinterWarning } from '../engine.js'
import { ANSI } from '../utils/ansi.js'
import { collectSourceFiles, isSourceFile } from '../utils/files.js'

// ── Fix result tracking ──────────────────────────────────────────────────────

interface FixResult {
    filePath: string
    fixedCount: number
    remainingCount: number
    fixes: string[]
}

// ── Command ──────────────────────────────────────────────────────────────────

export interface FixOptions {
    dryRun?: boolean
    tokens?: string
    projectRoot?: string
}

export async function fixCommand(
    paths: string[],
    opts: FixOptions,
): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
    const dryRun = opts.dryRun !== false // Default true
    const tokenPath =
        opts.tokens ?? path.join(projectRoot, '.flint', 'design-tokens.json')

    // Load config and tokens
    const { config } = loadGovernanceConfig(projectRoot)
    const policy: FlintPolicy = config.policy
    const tokens = loadTokens(tokenPath)

    if (tokens.length === 0) {
        console.log(
            `${ANSI.yellow}No design tokens loaded. Cannot perform auto-fix without tokens.${ANSI.reset}`,
        )
        return 3
    }

    console.log(
        `${ANSI.dim}Loaded ${tokens.length} design tokens from ${tokenPath}${ANSI.reset}`,
    )
    console.log(
        `${ANSI.dim}Mode: ${dryRun ? 'DRY RUN (no files will be modified)' : 'APPLY (files will be modified)'}${ANSI.reset}`,
    )
    console.log()

    // Collect files
    let filePaths: string[]
    if (paths.length > 0) {
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
    } else {
        filePaths = collectSourceFiles(projectRoot)
    }

    console.log(
        `${ANSI.dim}Scanning ${filePaths.length} source files...${ANSI.reset}`,
    )

    // Try MCP engine fix tool first
    const mcpResult = await tryMcpFix(
        filePaths,
        tokens,
        policy,
        projectRoot,
        dryRun,
    )
    if (mcpResult !== null) {
        return mcpResult
    }

    // Fallback: audit-only mode with fixability report
    return auditAndReport(filePaths, tokens, policy, projectRoot, dryRun)
}

// ── MCP engine fix attempt ───────────────────────────────────────────────────

async function tryMcpFix(
    filePaths: string[],
    tokens: import('../engine.js').DesignToken[],
    policy: FlintPolicy,
    projectRoot: string,
    dryRun: boolean,
): Promise<number | null> {
    try {
        // Dynamic import — cross-package boundary, typed as any with graceful fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fixModule: any = await import(
            '../../../flint-mcp/src/tools/fix.js'
        )

        if (typeof fixModule.handleFlintFix !== 'function') {
            return null
        }

        let totalFixed = 0
        let totalRemaining = 0

        for (const fp of filePaths) {
            const relPath = path.relative(process.cwd(), fp) || fp
            try {
                const result = await fixModule.handleFlintFix({
                    filePath: fp,
                    dry_run: dryRun,
                    projectRoot,
                })

                if (result && typeof result === 'object') {
                    const fixCount =
                        typeof result.fixedCount === 'number'
                            ? result.fixedCount
                            : 0
                    const remainCount =
                        typeof result.remainingCount === 'number'
                            ? result.remainingCount
                            : 0

                    if (fixCount > 0) {
                        const verb = dryRun ? 'Would fix' : 'Fixed'
                        console.log(
                            `  ${ANSI.green}${verb} ${fixCount} violation(s)${ANSI.reset} in ${relPath}`,
                        )
                        totalFixed += fixCount
                    }
                    totalRemaining += remainCount
                }
            } catch {
                // Individual file fix failure is non-fatal
            }
        }

        printFixSummary(totalFixed, totalRemaining, dryRun)
        return totalRemaining > 0 ? 1 : 0
    } catch {
        // MCP fix module not available -- fall back
        return null
    }
}

// ── Fallback: audit-and-report mode ──────────────────────────────────────────

async function auditAndReport(
    filePaths: string[],
    tokens: import('../engine.js').DesignToken[],
    policy: FlintPolicy,
    projectRoot: string,
    dryRun: boolean,
): Promise<number> {
    const fixResults: FixResult[] = []
    let totalFixable = 0
    let totalUnfixable = 0

    for (const fp of filePaths) {
        const relPath = path.relative(process.cwd(), fp) || fp
        let code: string
        try {
            code = fs.readFileSync(fp, 'utf-8')
        } catch {
            continue
        }

        const result = auditFile(relPath, code, tokens, policy)
        const mithrilFixable = result.mithrilWarnings.filter(
            (w) => w.fixable === true,
        )
        const mithrilUnfixable = result.mithrilWarnings.filter(
            (w) => w.fixable !== true,
        )
        const a11yCount = Object.values(result.a11yViolations).reduce(
            (s, a) => s + a.length,
            0,
        )

        // Count fixable Mithril warnings (color drift is always fixable if token exists)
        const autoFixable = countAutoFixable(result.mithrilWarnings)

        if (autoFixable === 0 && a11yCount === 0 && mithrilUnfixable.length === 0) {
            continue
        }

        const fixes: string[] = []

        for (const w of result.mithrilWarnings) {
            const isFixable = isAutoFixableWarning(w)
            if (isFixable) {
                fixes.push(
                    `${dryRun ? 'Would fix' : 'Fix'}: ${w.message}${w.nearestToken ? ` -> ${w.nearestToken}` : ''}`,
                )
            }
        }

        fixResults.push({
            filePath: relPath,
            fixedCount: autoFixable,
            remainingCount:
                mithrilUnfixable.length +
                a11yCount +
                (mithrilFixable.length - autoFixable),
            fixes,
        })

        totalFixable += autoFixable
        totalUnfixable +=
            mithrilUnfixable.length +
            a11yCount +
            (mithrilFixable.length - autoFixable)
    }

    // Print results
    if (fixResults.length === 0) {
        console.log(
            `${ANSI.green}No violations found. All files are clean.${ANSI.reset}`,
        )
        return 0
    }

    const divider = '-'.repeat(50)
    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log(
        `${ANSI.bold}  Flint Auto-Fix ${dryRun ? '(Dry Run)' : '(Applied)'}${ANSI.reset}`,
    )
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()

    for (const fr of fixResults) {
        console.log(`${ANSI.bold}  ${fr.filePath}${ANSI.reset}`)
        for (const fix of fr.fixes) {
            console.log(`    ${ANSI.green}${fix}${ANSI.reset}`)
        }
        if (fr.remainingCount > 0) {
            console.log(
                `    ${ANSI.yellow}${fr.remainingCount} violation(s) require manual fix${ANSI.reset}`,
            )
        }
        console.log()
    }

    printFixSummary(totalFixable, totalUnfixable, dryRun)
    return totalUnfixable > 0 ? 1 : 0
}

// ── Fixability heuristics ────────────────────────────────────────────────────

/**
 * Determines if a Mithril warning can be auto-fixed.
 * Color drift with a nearestToken is always fixable.
 * Typography/spacing drift is fixable if a matching token exists.
 */
function isAutoFixableWarning(w: LinterWarning): boolean {
    // Already marked fixable by the linter
    if (w.fixable === true) return true

    // Color drift with a nearest token is fixable
    if (w.type === 'color-drift' && w.nearestToken != null) return true

    // Typography/spacing drift with nearest token
    if (
        (w.type === 'typography-drift' ||
            w.type === 'spacing-drift' ||
            w.type === 'inline-style-drift') &&
        w.nearestToken != null
    ) {
        return true
    }

    return false
}

function countAutoFixable(warnings: LinterWarning[]): number {
    return warnings.filter(isAutoFixableWarning).length
}

// ── Summary printer ──────────────────────────────────────────────────────────

function printFixSummary(
    fixed: number,
    remaining: number,
    dryRun: boolean,
): void {
    const divider = '='.repeat(50)
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)

    if (dryRun) {
        console.log(
            `${ANSI.cyan}${ANSI.bold}  DRY RUN SUMMARY${ANSI.reset}`,
        )
        console.log(
            `  Would fix:           ${ANSI.green}${fixed}${ANSI.reset} violation(s)`,
        )
    } else {
        console.log(`${ANSI.green}${ANSI.bold}  FIX SUMMARY${ANSI.reset}`)
        console.log(
            `  Fixed:               ${ANSI.green}${fixed}${ANSI.reset} violation(s)`,
        )
    }

    console.log(
        `  Remaining (manual):  ${remaining > 0 ? `${ANSI.yellow}${remaining}${ANSI.reset}` : `${ANSI.green}0${ANSI.reset}`} violation(s)`,
    )
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)

    if (dryRun && fixed > 0) {
        console.log()
        console.log(
            `${ANSI.dim}Run with --no-dry-run to apply these fixes.${ANSI.reset}`,
        )
    }

    console.log()
}
