/**
 * GitHub Action wrapper -- flint-ci/src/github-action.ts
 *
 * Wraps the Flint CI audit engine for use as a GitHub Action.
 * Reads action inputs, runs governance audits on PR-changed files,
 * posts/updates a PR comment with results, generates SARIF output,
 * and sets action outputs.
 *
 * All governance logic delegates to ./engine.ts -- zero duplicated
 * linter logic in this file.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {
    auditFiles,
    shouldBlock,
    loadTokens,
    loadTokensFromProject,
    loadGovernanceConfig,
    buildSarifReport,
    DEFAULT_POLICY,
    parseSource,
} from './engine.js'
import type { AuditSummary, FlintPolicy } from './engine.js'

// ── Constants ────────────────────────────────────────────────────────────────

const FLINT_VERSION = '2.0.0'
const COMMENT_MARKER = '<!-- flint-governance-gate -->'

// Shared file utilities
import { isSourceFile, collectSourceFiles as _collectSourceFiles } from './utils/files.js'

/**
 * Gets changed files for a pull request via the GitHub API.
 * Falls back to git diff if not in a PR context.
 */
async function getChangedFiles(
    octokit: ReturnType<typeof github.getOctokit>,
    context: typeof github.context,
): Promise<string[]> {
    const pr = context.payload.pull_request
    if (pr) {
        try {
            const files: string[] = []
            let page = 1
            const perPage = 100

            // Paginate through all changed files
            while (true) {
                const { data } = await octokit.rest.pulls.listFiles({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: pr.number,
                    per_page: perPage,
                    page,
                })

                for (const file of data) {
                    if (
                        file.status !== 'removed' &&
                        isSourceFile(file.filename)
                    ) {
                        files.push(file.filename)
                    }
                }

                if (data.length < perPage) break
                page++
            }

            return files
        } catch (err) {
            core.warning(
                `Failed to get PR files via API, falling back to git diff: ${
                    err instanceof Error ? err.message : String(err)
                }`,
            )
        }
    }

    // Fallback: git diff against merge base
    return getGitChangedFiles()
}

/**
 * Gets changed source files via git diff.
 * Tries origin/main, origin/master, then HEAD~1 as fallback.
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
        core.warning(
            'Could not determine git changes. Scanning all source files.',
        )
        return []
    }
}

/** Re-export shared file collector for use in this module. */
const collectSourceFiles = _collectSourceFiles

// ── PR Comment formatting ────────────────────────────────────────────────────

interface DeltaReport {
    newViolations: number
    fixedViolations: number
    unchangedViolations: number
}

/**
 * Computes delta by comparing PR violations against base branch versions.
 * Uses `git show <base>:<file>` to get the base version of each file.
 */
function computeDelta(
    summary: AuditSummary,
    baseBranch: string,
    tokens: import('./engine.js').DesignToken[],
    policy: import('./engine.js').FlintPolicy,
): DeltaReport | null {
    try {
        let totalNewViolations = 0
        let totalFixedViolations = 0
        let totalUnchanged = 0

        for (const result of summary.results) {
            const prViolationCount = result.mithrilWarnings.length +
                Object.values(result.a11yViolations).reduce((s, a) => s + a.length, 0)

            // Get the base version of this file
            let baseViolationCount = 0
            try {
                const baseContent = execSync(
                    `git show ${baseBranch}:${result.filePath}`,
                    { encoding: 'utf-8', stdio: 'pipe' },
                )
                const baseResult = auditFiles(
                    [{ path: result.filePath, content: baseContent }],
                    tokens,
                    policy,
                )
                if (baseResult.results.length > 0) {
                    const br = baseResult.results[0]
                    baseViolationCount = br.mithrilWarnings.length +
                        Object.values(br.a11yViolations).reduce((s, a) => s + a.length, 0)
                }
            } catch {
                // File is new in this PR — all violations are new
                baseViolationCount = 0
            }

            const newInThisFile = Math.max(0, prViolationCount - baseViolationCount)
            const fixedInThisFile = Math.max(0, baseViolationCount - prViolationCount)
            const unchanged = Math.min(prViolationCount, baseViolationCount)

            totalNewViolations += newInThisFile
            totalFixedViolations += fixedInThisFile
            totalUnchanged += unchanged
        }

        return {
            newViolations: totalNewViolations,
            fixedViolations: totalFixedViolations,
            unchangedViolations: totalUnchanged,
        }
    } catch {
        return null
    }
}

function formatPRComment(summary: AuditSummary, blocked: boolean, delta: DeltaReport | null): string {
    const statusIcon = blocked ? '`BLOCKED`' : '`PASSED`'
    const totalViolations =
        summary.totalMithrilWarnings + summary.totalA11yViolations

    const lines: string[] = [
        COMMENT_MARKER,
        `## Flint Governance Gate: ${statusIcon}`,
        '',
    ]

    // Delta banner — the most important info for PR reviewers
    if (delta) {
        if (delta.newViolations > 0) {
            lines.push(`> **This PR introduces ${delta.newViolations} new violation(s)**`)
        } else if (delta.fixedViolations > 0) {
            lines.push(`> **This PR fixes ${delta.fixedViolations} violation(s)** -- nice work`)
        } else {
            lines.push(`> No new violations introduced`)
        }
        lines.push('')
    }

    lines.push(
        '| Metric | Count |',
        '| --- | --- |',
        `| Files scanned | ${summary.totalFiles} |`,
        `| Files with violations | ${summary.filesWithViolations} |`,
        `| Total violations | ${totalViolations} |`,
        `| Critical | ${summary.criticalCount} |`,
        `| Amber | ${summary.amberCount} |`,
        `| Mithril (design drift) | ${summary.totalMithrilWarnings} |`,
        `| A11y (accessibility) | ${summary.totalA11yViolations} |`,
    )

    if (delta) {
        lines.push(
            `| New in this PR | ${delta.newViolations} |`,
            `| Fixed in this PR | ${delta.fixedViolations} |`,
        )
    }

    lines.push('')

    // Add collapsible details for files with violations
    const filesWithIssues = summary.results.filter((r) => {
        const mCount = r.mithrilWarnings.length
        const aCount = Object.values(r.a11yViolations).reduce(
            (s, a) => s + a.length,
            0,
        )
        return mCount > 0 || aCount > 0 || r.parseError !== null
    })

    if (filesWithIssues.length > 0) {
        lines.push('<details>')
        lines.push(
            `<summary>Files with violations (${filesWithIssues.length})</summary>`,
        )
        lines.push('')

        for (const result of filesWithIssues) {
            lines.push(`#### \`${result.filePath}\``)
            lines.push('')

            if (result.parseError) {
                lines.push(`- **PARSE ERROR:** ${result.parseError}`)
                lines.push('')
                continue
            }

            for (const w of result.mithrilWarnings) {
                const badge =
                    w.severity === 'critical' ? '**CRIT**' : 'AMBR'
                lines.push(`- [${badge}] ${w.message}`)
            }

            for (const [elemId, messages] of Object.entries(
                result.a11yViolations,
            )) {
                for (const msg of messages) {
                    lines.push(`- [**A11Y**] \`${elemId}\`: ${msg}`)
                }
            }

            lines.push('')
        }

        lines.push('</details>')
        lines.push('')
    }

    lines.push(
        `---`,
    )
    lines.push(
        `*Flint Governance v${FLINT_VERSION} -- design system, accessibility, and brand compliance gate*`,
    )

    return lines.join('\n')
}

/**
 * Posts or updates a PR comment with the governance report.
 * Finds an existing Flint comment by marker and updates it,
 * or creates a new one if none exists.
 */
async function upsertPRComment(
    octokit: ReturnType<typeof github.getOctokit>,
    context: typeof github.context,
    body: string,
): Promise<void> {
    const pr = context.payload.pull_request
    if (!pr) {
        core.info('Not in a PR context -- skipping comment.')
        return
    }

    const { owner, repo } = context.repo
    const issueNumber = pr.number

    try {
        // Look for an existing Flint comment (paginated to match listFiles pattern)
        const perPage = 100
        let page = 1
        let existingComment: { id: number; body?: string | null } | undefined
        while (!existingComment) {
            const { data: comments } = await octokit.rest.issues.listComments({
                owner,
                repo,
                issue_number: issueNumber,
                per_page: perPage,
                page,
            })
            existingComment = comments.find(
                (c: { id: number; body?: string | null }) => c.body?.includes(COMMENT_MARKER),
            )
            if (comments.length < perPage) break
            page++
        }

        if (existingComment) {
            await octokit.rest.issues.updateComment({
                owner,
                repo,
                comment_id: existingComment.id,
                body,
            })
            core.info(`Updated existing PR comment #${existingComment.id}`)
        } else {
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: issueNumber,
                body,
            })
            core.info('Created new PR comment with governance report')
        }
    } catch (err) {
        core.warning(
            `Failed to post PR comment: ${
                err instanceof Error ? err.message : String(err)
            }`,
        )
    }
}

// ── Health score calculation ─────────────────────────────────────────────────

/**
 * Calculates a health score (0-100) from the audit summary.
 * 100 = no violations, 0 = everything is broken.
 */
function calculateHealthScore(summary: AuditSummary): number {
    if (summary.totalFiles === 0) return 100

    const totalViolations =
        summary.totalMithrilWarnings + summary.totalA11yViolations

    if (totalViolations === 0) return 100

    // Weight: critical = 10 points, amber = 3 points
    const weightedPenalty =
        summary.criticalCount * 10 + summary.amberCount * 3

    // Normalize against file count (more files = higher denominator)
    const maxPenalty = summary.totalFiles * 10
    const score = Math.max(
        0,
        Math.round(100 * (1 - weightedPenalty / maxPenalty)),
    )

    return score
}

// ── Main action entry point ──────────────────────────────────────────────────

export async function run(): Promise<void> {
    try {
        // Read inputs
        const tokenFile = core.getInput('token_file') || ''
        const policyPath = core.getInput('policy_path') || ''
        const failOnWarning =
            core.getInput('fail_on_warning').toLowerCase() === 'true'
        const sarifOutput = core.getInput('sarif_output') || ''
        const projectRoot = path.resolve(
            core.getInput('project_root') || process.cwd(),
        )

        core.info(`Flint Governance Gate v${FLINT_VERSION}`)
        core.info(`Project root: ${projectRoot}`)

        // Load governance policy
        let policy: FlintPolicy
        if (policyPath && fs.existsSync(policyPath)) {
            try {
                const raw = fs.readFileSync(policyPath, 'utf-8')
                policy = { ...DEFAULT_POLICY, ...JSON.parse(raw) }
                core.info(`Loaded policy from ${policyPath}`)
            } catch (err) {
                core.setFailed(
                    `Failed to parse policy file ${policyPath}: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                )
                return
            }
        } else {
            const { config } = loadGovernanceConfig(projectRoot)
            policy = config.policy
            core.info('Using project governance config (YAML/JSON/defaults)')
        }

        // Load design tokens
        let tokens
        if (tokenFile) {
            const resolvedTokenPath = path.resolve(projectRoot, tokenFile)
            tokens = loadTokens(resolvedTokenPath)
            core.info(`Loaded ${tokens.length} tokens from ${resolvedTokenPath}`)
        } else {
            tokens = loadTokensFromProject(projectRoot)
            core.info(
                `Loaded ${tokens.length} tokens from project defaults`,
            )
        }

        // Get GitHub token for API access
        const githubToken = core.getInput('github_token') || process.env.GITHUB_TOKEN || ''
        let changedFiles: string[] = []

        if (githubToken) {
            const octokit = github.getOctokit(githubToken)
            changedFiles = await getChangedFiles(octokit, github.context)
            core.info(`Found ${changedFiles.length} changed source files`)
        } else {
            core.info('No GitHub token provided -- scanning all source files')
        }

        // Determine files to scan
        let filePaths: string[]
        if (changedFiles.length > 0) {
            filePaths = changedFiles
        } else {
            filePaths = collectSourceFiles(projectRoot)
            core.info(
                `Scanning ${filePaths.length} source files in ${projectRoot}`,
            )
        }

        if (filePaths.length === 0) {
            core.info('No source files to scan. Governance gate passed.')
            core.setOutput('total_violations', '0')
            core.setOutput('critical_count', '0')
            core.setOutput('amber_count', '0')
            core.setOutput('health_score', '100')
            return
        }

        // Read file contents
        const files: Array<{ path: string; content: string }> = []
        for (const fp of filePaths) {
            const resolvedPath = path.isAbsolute(fp)
                ? fp
                : path.resolve(projectRoot, fp)
            try {
                const content = fs.readFileSync(resolvedPath, 'utf-8')
                // Use relative path for cleaner output
                const relPath =
                    path.relative(projectRoot, resolvedPath) || fp
                files.push({ path: relPath, content })
            } catch (err) {
                core.warning(
                    `Could not read ${fp}: ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                )
            }
        }

        // Run audit
        core.info(`Auditing ${files.length} files...`)
        const summary = auditFiles(files, tokens, policy)

        const totalViolations =
            summary.totalMithrilWarnings + summary.totalA11yViolations
        const healthScore = calculateHealthScore(summary)

        core.info(
            `Audit complete: ${totalViolations} violations (${summary.criticalCount} critical, ${summary.amberCount} amber)`,
        )
        core.info(`Health score: ${healthScore}/100`)

        // Generate SARIF output
        let sarifFile = ''
        if (sarifOutput) {
            const sarif = buildSarifReport(summary)
            const resolvedSarifPath = path.resolve(sarifOutput)
            fs.writeFileSync(
                resolvedSarifPath,
                JSON.stringify(sarif, null, 2),
                'utf-8',
            )
            sarifFile = resolvedSarifPath
            core.info(`SARIF report written to ${resolvedSarifPath}`)
        }

        // Determine blocked status
        const blocked = shouldBlock(summary, projectRoot, failOnWarning)

        // Compute delta (new vs existing violations) for PR context
        let delta: DeltaReport | null = null
        if (github.context.payload.pull_request) {
            const baseBranch = github.context.payload.pull_request.base?.ref ?? 'main'
            core.info(`Computing violation delta against ${baseBranch}...`)
            delta = computeDelta(summary, `origin/${baseBranch}`, tokens, policy)
            if (delta) {
                core.info(`Delta: ${delta.newViolations} new, ${delta.fixedViolations} fixed`)
            }
        }

        // Post/update PR comment
        if (githubToken) {
            const octokit = github.getOctokit(githubToken)
            const commentBody = formatPRComment(summary, blocked, delta)
            await upsertPRComment(octokit, github.context, commentBody)
        }

        // Set outputs
        core.setOutput('total_violations', String(totalViolations))
        core.setOutput('critical_count', String(summary.criticalCount))
        core.setOutput('amber_count', String(summary.amberCount))
        core.setOutput('sarif_file', sarifFile)
        core.setOutput('health_score', String(healthScore))

        // Set annotations for file violations
        for (const result of summary.results) {
            for (const w of result.mithrilWarnings) {
                const annotation = {
                    file: result.filePath,
                    startLine: w.line ?? 1,
                    title: w.severity === 'critical' ? 'Flint Critical' : 'Flint Amber',
                }
                if (w.severity === 'critical') {
                    core.error(w.message, annotation)
                } else {
                    core.warning(w.message, annotation)
                }
            }

            for (const [elemId, messages] of Object.entries(
                result.a11yViolations,
            )) {
                for (const msg of messages) {
                    core.error(`[${elemId}] ${msg}`, {
                        file: result.filePath,
                        title: 'Flint A11y',
                    })
                }
            }

            if (result.parseError) {
                core.error(result.parseError, {
                    file: result.filePath,
                    title: 'Flint Parse Error',
                })
            }
        }

        // Fail the action if blocked
        if (blocked) {
            core.setFailed(
                `Flint Governance Gate: BLOCKED -- ${summary.criticalCount} critical, ${summary.amberCount} amber violations found`,
            )
        }
    } catch (err) {
        core.setFailed(
            `Flint Governance Gate failed: ${
                err instanceof Error ? err.message : String(err)
            }`,
        )
    }
}

// Only auto-run when executing as a GitHub Action (not when imported for testing)
if (process.env.GITHUB_ACTIONS) {
    run()
}
