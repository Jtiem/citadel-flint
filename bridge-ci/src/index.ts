/**
 * GitHub Action Entry Point -- flint-ci/src/index.ts
 *
 * This is the main entry point for the Flint Governance Gate GitHub Action.
 * It integrates with @actions/core and @actions/github to:
 *
 *   1. Discover changed .tsx/.ts/.jsx/.js files in the PR
 *   2. Parse each file with Babel and run Mithril + A11y linters
 *   3. Generate a SARIF report for GitHub Code Scanning
 *   4. Post a PR comment summary with violation counts
 *   5. Fail the action if blocking violations exist
 *
 * Commandment 5: Accessibility is a Compiler Error.
 * Commandment 6: The Gatekeeper Rule -- exports/merges blocked while violations remain.
 * Commandment 9: CIEDE2000 delta-E logic for perceptual drift detection.
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { auditFiles, shouldFail, generateSarif } from './audit-engine.js'
import type { DesignToken, FlintPolicy } from './types.js'
import { DEFAULT_POLICY } from './types.js'

// -- Helpers -------------------------------------------------------------------

/**
 * Source file extensions the governance gate audits.
 */
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

function isSourceFile(path: string): boolean {
    return SOURCE_EXTENSIONS.some(ext => path.endsWith(ext))
}

/**
 * Reads and parses a JSON file, returning a default value on failure.
 */
function readJsonFile<T>(path: string, defaultValue: T): T {
    try {
        if (!existsSync(path)) return defaultValue
        const raw = readFileSync(path, 'utf-8')
        return JSON.parse(raw) as T
    } catch {
        return defaultValue
    }
}

/**
 * Gets the list of changed files in the PR using @actions/github.
 * Falls back to git diff if not in a PR context.
 */
async function getChangedFiles(): Promise<string[]> {
    const context = github.context

    // If we're in a PR context, use the GitHub API
    if (context.payload.pull_request) {
        const token = process.env.GITHUB_TOKEN
        if (token) {
            try {
                const octokit = github.getOctokit(token)
                const prNumber = context.payload.pull_request.number
                const files: string[] = []
                let page = 1

                while (true) {
                    const response = await octokit.rest.pulls.listFiles({
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        pull_number: prNumber,
                        per_page: 100,
                        page,
                    })

                    for (const file of response.data) {
                        if (file.status !== 'removed' && isSourceFile(file.filename)) {
                            files.push(file.filename)
                        }
                    }

                    if (response.data.length < 100) break
                    page++
                }

                return files
            } catch (error) {
                core.warning(`Failed to get PR files via API, falling back to git diff: ${error}`)
            }
        }
    }

    // Fallback: use git diff
    try {
        const baseBranch = context.payload.pull_request?.base?.ref ?? 'main'
        const diff = execSync(
            `git diff --name-only --diff-filter=ACMR origin/${baseBranch}...HEAD`,
            { encoding: 'utf-8' }
        ).trim()

        if (!diff) return []
        return diff.split('\n').filter(isSourceFile)
    } catch {
        core.warning('Failed to get changed files via git diff. Scanning all source files.')
        // Last resort: scan common source directories
        try {
            const find = execSync(
                'find src -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \\) 2>/dev/null || true',
                { encoding: 'utf-8' }
            ).trim()
            if (!find) return []
            return find.split('\n').filter(Boolean)
        } catch {
            return []
        }
    }
}

/**
 * Formats the audit summary as a Markdown PR comment.
 */
function formatPrComment(
    summary: ReturnType<typeof auditFiles>,
    blocked: boolean,
): string {
    const statusIcon = blocked ? 'X' : 'check'
    const statusText = blocked ? 'BLOCKED' : 'PASSED'

    let body = `## Flint Governance Gate: ${statusText}\n\n`
    body += `| Metric | Count |\n`
    body += `|--------|-------|\n`
    body += `| Files scanned | ${summary.totalFiles} |\n`
    body += `| Files with violations | ${summary.filesWithViolations} |\n`
    body += `| Mithril warnings | ${summary.totalMithrilWarnings} |\n`
    body += `| A11y violations | ${summary.totalA11yViolations} |\n`
    body += `| Critical | ${summary.criticalCount} |\n`
    body += `| Amber | ${summary.amberCount} |\n\n`

    // Detail section for files with violations
    const violatedFiles = summary.results.filter(
        r => r.mithrilWarnings.length > 0 ||
             Object.keys(r.a11yViolations).length > 0 ||
             r.parseError
    )

    if (violatedFiles.length > 0) {
        body += `<details>\n<summary>Violation Details (${violatedFiles.length} files)</summary>\n\n`

        for (const result of violatedFiles) {
            body += `### \`${result.filePath}\`\n\n`

            if (result.parseError) {
                body += `- **Parse Error**: ${result.parseError}\n\n`
                continue
            }

            if (result.mithrilWarnings.length > 0) {
                body += `**Mithril Violations:**\n`
                for (const w of result.mithrilWarnings) {
                    const badge = w.severity === 'critical' ? '**CRITICAL**' : 'amber'
                    body += `- [${badge}] ${w.message}\n`
                }
                body += '\n'
            }

            const a11yEntries = Object.entries(result.a11yViolations)
            if (a11yEntries.length > 0) {
                body += `**A11y Violations:**\n`
                for (const [elementId, messages] of a11yEntries) {
                    for (const msg of messages) {
                        body += `- [**CRITICAL**] \`${elementId}\`: ${msg}\n`
                    }
                }
                body += '\n'
            }
        }

        body += `</details>\n\n`
    }

    body += `---\n`
    body += `*Flint Governance Gate v1.0.0 -- Mithril Safety + WCAG 2.1 AA*\n`

    return body
}

// -- Main ----------------------------------------------------------------------

async function run(): Promise<void> {
    try {
        // Read action inputs
        const tokenFilePath = core.getInput('token_file') || '.flint/tokens.json'
        const policyPath = core.getInput('policy_path') || '.flint/policy.json'
        const failOnWarning = core.getInput('fail_on_warning') === 'true'
        const sarifOutput = core.getInput('sarif_output') || 'flint-results.sarif'

        core.info('Flint Governance Gate starting...')

        // Load design tokens
        const tokens = readJsonFile<DesignToken[]>(tokenFilePath, [])
        core.info(`Loaded ${tokens.length} design tokens from ${tokenFilePath}`)

        // Load policy
        const policy = readJsonFile<FlintPolicy>(policyPath, DEFAULT_POLICY)
        core.info(`Policy loaded: Mithril=${policy.mithril.mode}, A11y=${policy.a11y.mode}`)

        // Get changed files
        const changedFiles = await getChangedFiles()
        core.info(`Found ${changedFiles.length} changed source files`)

        if (changedFiles.length === 0) {
            core.info('No source files changed. Governance gate passed.')
            // Write an empty SARIF report
            const emptySarif = generateSarif({
                totalFiles: 0,
                filesWithViolations: 0,
                totalMithrilWarnings: 0,
                totalA11yViolations: 0,
                criticalCount: 0,
                amberCount: 0,
                results: [],
            })
            writeFileSync(sarifOutput, JSON.stringify(emptySarif, null, 2), 'utf-8')
            return
        }

        // Read file contents
        const files: Array<{ path: string; content: string }> = []
        for (const filePath of changedFiles) {
            try {
                const content = readFileSync(filePath, 'utf-8')
                files.push({ path: filePath, content })
            } catch {
                core.warning(`Could not read file: ${filePath}`)
            }
        }

        // Run audit
        const summary = auditFiles(files, tokens, policy)

        // Generate SARIF
        const sarif = generateSarif(summary)
        writeFileSync(sarifOutput, JSON.stringify(sarif, null, 2), 'utf-8')
        core.info(`SARIF report written to ${sarifOutput}`)

        // Set outputs
        core.setOutput('total_violations', summary.totalMithrilWarnings + summary.totalA11yViolations)
        core.setOutput('critical_count', summary.criticalCount)
        core.setOutput('amber_count', summary.amberCount)
        core.setOutput('sarif_file', sarifOutput)

        // Determine pass/fail
        const blocked = shouldFail(summary, policy, failOnWarning)

        // Post PR comment (if in a PR context with a token)
        const ghToken = process.env.GITHUB_TOKEN
        if (ghToken && github.context.payload.pull_request) {
            try {
                const octokit = github.getOctokit(ghToken)
                const prNumber = github.context.payload.pull_request.number
                const commentBody = formatPrComment(summary, blocked)

                // Look for an existing Flint comment to update
                const comments = await octokit.rest.issues.listComments({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    issue_number: prNumber,
                    per_page: 100,
                })

                const existingComment = comments.data.find(
                    c => c.body?.includes('Flint Governance Gate')
                )

                if (existingComment) {
                    await octokit.rest.issues.updateComment({
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        comment_id: existingComment.id,
                        body: commentBody,
                    })
                    core.info('Updated existing PR comment')
                } else {
                    await octokit.rest.issues.createComment({
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        issue_number: prNumber,
                        body: commentBody,
                    })
                    core.info('Posted PR comment')
                }
            } catch (error) {
                core.warning(`Failed to post PR comment: ${error}`)
            }
        }

        // Log summary
        core.info(`--- Audit Summary ---`)
        core.info(`Files scanned: ${summary.totalFiles}`)
        core.info(`Files with violations: ${summary.filesWithViolations}`)
        core.info(`Mithril warnings: ${summary.totalMithrilWarnings}`)
        core.info(`A11y violations: ${summary.totalA11yViolations}`)
        core.info(`Critical: ${summary.criticalCount}, Amber: ${summary.amberCount}`)

        if (blocked) {
            core.setFailed(
                `Flint Governance Gate BLOCKED: ${summary.criticalCount} critical, ` +
                `${summary.amberCount} amber violations across ${summary.filesWithViolations} files.`
            )
        } else {
            core.info('Flint Governance Gate PASSED.')
        }
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(`Flint Governance Gate failed: ${error.message}`)
        } else {
            core.setFailed(`Flint Governance Gate failed with unexpected error`)
        }
    }
}

run()
