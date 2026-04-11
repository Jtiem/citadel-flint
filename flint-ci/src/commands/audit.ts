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
    extractRuleId,
    DEFAULT_POLICY,
} from '../engine.js'
import type { AuditSummary, FlintPolicy } from '../engine.js'
import { ANSI } from '../utils/ansi.js'
import {
    isSourceFile,
    collectSourceFiles,
    loadFlintIgnore,
    isIgnored,
    loadAuditCache,
    saveAuditCache,
    contentHash,
} from '../utils/files.js'
import type { AuditCache } from '../utils/files.js'

// ── Error taxonomy (CX.3) — loaded once for explanation enrichment ───────────

let errorTaxonomy: Map<string, { title: string; recovery: string }> | null = null

async function loadErrorTaxonomy(): Promise<void> {
    if (errorTaxonomy) return
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await import(
            '../../../flint-mcp/src/core/errorTaxonomy.js'
        )
        if (typeof mod.getErrorEntryByRuleId === 'function') {
            errorTaxonomy = new Map()
            // Pre-cache lookups for known rule prefixes
            for (const prefix of ['MITHRIL-COL', 'MITHRIL-TYP-', 'MITHRIL-SPC-', 'MITHRIL-SHD-', 'MITHRIL-OPC-', 'MITHRIL-IST-', 'MITHRIL-DTO-', 'A11Y-', 'SYNC-']) {
                for (let i = 0; i < 60; i++) {
                    const ruleId = prefix.endsWith('-') ? `${prefix}${String(i).padStart(3, '0')}` : prefix
                    const entry = mod.getErrorEntryByRuleId(ruleId)
                    if (entry) {
                        errorTaxonomy.set(ruleId, { title: entry.title, recovery: entry.recovery })
                    }
                    if (!prefix.endsWith('-')) break
                }
            }
        }
    } catch {
        // Taxonomy not available — output remains functional without it
    }
}

function getExplanation(ruleId: string): { title: string; recovery: string } | null {
    return errorTaxonomy?.get(ruleId) ?? null
}

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
            // CX.3: append explanation + recovery from error taxonomy
            const ruleId = extractRuleId(w.message)
            const explain = getExplanation(ruleId)
            if (explain) {
                console.log(`           ${ANSI.dim}Why: ${explain.title}${ANSI.reset}`)
                console.log(`           ${ANSI.dim}Fix: ${explain.recovery.split('.')[0]}.${ANSI.reset}`)
            }
        }

        for (const [elemId, messages] of Object.entries(result.a11yViolations)) {
            for (const msg of messages) {
                console.log(
                    `    ${ANSI.red}[A11Y]${ANSI.reset} ${ANSI.dim}${elemId}:${ANSI.reset} ${msg}`,
                )
                const ruleId = extractRuleId(msg)
                const explain = getExplanation(ruleId)
                if (explain) {
                    console.log(`           ${ANSI.dim}Why: ${explain.title}${ANSI.reset}`)
                    console.log(`           ${ANSI.dim}Fix: ${explain.recovery.split('.')[0]}.${ANSI.reset}`)
                }
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
    fix?: boolean
    format?: 'terminal' | 'json' | 'sarif'
    tokens?: string
    policy?: string
    projectRoot?: string
    baseline?: boolean
    cache?: boolean
}

export async function auditCommand(
    paths: string[],
    opts: AuditOptions,
): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
    const useChanged = opts.changed ?? false
    const format = opts.format ?? 'terminal'

    // Load error taxonomy for enriched explanations (non-blocking)
    await loadErrorTaxonomy()

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

    // Load .flintignore patterns
    const ignorePatterns = loadFlintIgnore(projectRoot)
    if (ignorePatterns.length > 0) {
        console.log(`${ANSI.dim}Loaded ${ignorePatterns.length} ignore patterns from .flintignore${ANSI.reset}`)
    }

    // Collect files
    let filePaths: string[]

    if (useChanged) {
        filePaths = getGitChangedFiles()
        // Apply .flintignore to git-changed files too
        if (ignorePatterns.length > 0) {
            filePaths = filePaths.filter(fp => !isIgnored(fp, ignorePatterns))
        }
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
                    filePaths.push(...collectSourceFiles(resolved, ignorePatterns))
                } else if (stat.isFile() && isSourceFile(resolved)) {
                    const relPath = path.relative(projectRoot, resolved)
                    if (ignorePatterns.length === 0 || !isIgnored(relPath, ignorePatterns)) {
                        filePaths.push(resolved)
                    }
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
        filePaths = collectSourceFiles(projectRoot, ignorePatterns)
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

    // Load cache if --cache is set
    const useCache = opts.cache ?? false
    const cache: AuditCache = useCache ? loadAuditCache(projectRoot) : {}
    let cacheHits = 0

    // Read file contents
    const files: Array<{ path: string; content: string }> = []
    for (const fp of filePaths) {
        try {
            const content = fs.readFileSync(fp, 'utf-8')
            const relPath = path.relative(process.cwd(), fp) || fp

            // Skip if content hash matches cache
            if (useCache && cache[relPath]) {
                const hash = contentHash(content)
                if (cache[relPath].hash === hash) {
                    cacheHits++
                    continue
                }
            }

            files.push({ path: relPath, content })
        } catch {
            console.error(
                `${ANSI.yellow}Warning: Could not read ${fp}${ANSI.reset}`,
            )
        }
    }

    if (useCache && cacheHits > 0) {
        console.log(`${ANSI.dim}Cache: ${cacheHits} file(s) unchanged, ${files.length} to scan${ANSI.reset}`)
    }

    // Run audit (only on non-cached files)
    let summary = auditFiles(files, tokens, policy)

    // When using cache, totalFiles should reflect ALL files (cached + scanned)
    if (useCache && cacheHits > 0) {
        summary = { ...summary, totalFiles: summary.totalFiles + cacheHits }
    }

    // Update cache with new results
    if (useCache) {
        for (const result of summary.results) {
            const fileEntry = files.find(f => f.path === result.filePath)
            if (fileEntry) {
                const ruleIds: string[] = []
                for (const w of result.mithrilWarnings) ruleIds.push(extractRuleId(w.message))
                for (const msgs of Object.values(result.a11yViolations)) {
                    for (const msg of msgs) ruleIds.push(extractRuleId(msg))
                }
                cache[result.filePath] = {
                    hash: contentHash(fileEntry.content),
                    mithrilCount: result.mithrilWarnings.length,
                    a11yCount: Object.values(result.a11yViolations).reduce((s, a) => s + a.length, 0),
                    ruleIds: [...new Set(ruleIds)],
                }
            }
        }
        // Remove stale entries for files that no longer exist
        for (const cachedPath of Object.keys(cache)) {
            const absPath = path.resolve(process.cwd(), cachedPath)
            if (!fs.existsSync(absPath)) delete cache[cachedPath]
        }
        saveAuditCache(projectRoot, cache)
    }

    // Baseline suppression: filter out known violations from .flint/baseline.json
    if (opts.baseline) {
        summary = applyBaseline(summary, projectRoot)
    }

    // Generate SARIF if requested
    if (opts.sarif || format === 'sarif') {
        const sarif = buildSarifReport(summary)
        const sarifPath = opts.sarif ?? 'flint-results.sarif'
        fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2), 'utf-8')
        if (format !== 'sarif') {
            console.log(
                `${ANSI.dim}SARIF report written to ${sarifPath}${ANSI.reset}`,
            )
        } else {
            // SARIF-only mode: print to stdout
            console.log(JSON.stringify(sarif, null, 2))
        }
    }

    // Determine blocked status
    const blocked = shouldBlock(
        summary,
        projectRoot,
        opts.failOnWarning ?? false,
    )

    // Output based on format
    if (format === 'json') {
        // Machine-readable JSON output to stdout
        const jsonReport = {
            version: '2.0.0',
            verdict: blocked ? 'BLOCKED' : 'PASSED',
            summary: {
                totalFiles: summary.totalFiles,
                filesWithViolations: summary.filesWithViolations,
                totalMithrilWarnings: summary.totalMithrilWarnings,
                totalA11yViolations: summary.totalA11yViolations,
                criticalCount: summary.criticalCount,
                amberCount: summary.amberCount,
            },
            files: summary.results
                .filter(r => r.mithrilWarnings.length > 0 || Object.keys(r.a11yViolations).length > 0 || r.parseError)
                .map(r => ({
                    path: r.filePath,
                    mithrilWarnings: r.mithrilWarnings.map(w => ({
                        ruleId: extractRuleId(w.message),
                        severity: w.severity,
                        message: w.message,
                        line: w.line,
                        nearestToken: w.nearestToken,
                    })),
                    a11yViolations: r.a11yViolations,
                    parseError: r.parseError,
                })),
        }
        console.log(JSON.stringify(jsonReport, null, 2))
    } else if (format === 'terminal') {
        printSummary(summary, blocked)
    }

    // --fix: auto-fix after audit in one pass
    if (opts.fix && (summary.totalMithrilWarnings > 0 || summary.totalA11yViolations > 0)) {
        console.log()
        console.log(`${ANSI.bold}  Auto-fixing violations...${ANSI.reset}`)
        try {
            const { fixCommand } = await import('./fix.js')
            await fixCommand(paths.length > 0 ? paths : [projectRoot], {
                dryRun: false,
                tokens: opts.tokens,
                projectRoot: opts.projectRoot,
            })
        } catch {
            console.error(`${ANSI.yellow}Auto-fix unavailable. Run 'flint-gate fix' manually.${ANSI.reset}`)
        }
    }

    return blocked ? 1 : 0
}

// ── Baseline suppression ────────────────────────────────────────────────────

/**
 * Loads .flint/baseline.json and removes known violations from the summary.
 * Baseline entries are keyed by filePath + ruleId. Only NEW violations block.
 */
function applyBaseline(summary: AuditSummary, projectRoot: string): AuditSummary {
    const baselinePath = path.join(projectRoot, '.flint', 'baseline.json')
    if (!fs.existsSync(baselinePath)) return summary

    let baseline: Record<string, string[]>
    try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
    } catch {
        console.error(`${ANSI.yellow}Warning: Could not parse .flint/baseline.json — skipping baseline${ANSI.reset}`)
        return summary
    }

    let suppressedCount = 0
    const filteredResults = summary.results.map(result => {
        const baselineRules = new Set(baseline[result.filePath] ?? [])
        if (baselineRules.size === 0) return result

        // Filter Mithril warnings
        const filteredWarnings = result.mithrilWarnings.filter(w => {
            const ruleId = extractRuleId(w.message)
            if (baselineRules.has(ruleId)) { suppressedCount++; return false }
            return true
        })

        // Filter A11y violations
        const filteredA11y: Record<string, string[]> = {}
        for (const [elemId, messages] of Object.entries(result.a11yViolations)) {
            const kept = messages.filter(msg => {
                const ruleId = extractRuleId(msg)
                if (baselineRules.has(ruleId)) { suppressedCount++; return false }
                return true
            })
            if (kept.length > 0) filteredA11y[elemId] = kept
        }

        return { ...result, mithrilWarnings: filteredWarnings, a11yViolations: filteredA11y }
    })

    if (suppressedCount > 0) {
        console.log(`${ANSI.dim}Baseline: suppressed ${suppressedCount} known violation(s)${ANSI.reset}`)
    }

    // Recompute summary counts
    let totalMithrilWarnings = 0
    let totalA11yViolations = 0
    let criticalCount = 0
    let amberCount = 0
    let filesWithViolations = 0

    for (const r of filteredResults) {
        const mCount = r.mithrilWarnings.length
        const aCount = Object.values(r.a11yViolations).reduce((s, a) => s + a.length, 0)
        if (mCount > 0 || aCount > 0 || r.parseError) filesWithViolations++
        totalMithrilWarnings += mCount
        totalA11yViolations += aCount
        for (const w of r.mithrilWarnings) {
            if (w.severity === 'critical') criticalCount++
            else amberCount++
        }
        criticalCount += aCount
    }

    return {
        totalFiles: summary.totalFiles,
        filesWithViolations,
        totalMithrilWarnings,
        totalA11yViolations,
        criticalCount,
        amberCount,
        results: filteredResults,
    }
}
