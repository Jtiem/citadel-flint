#!/usr/bin/env node
/**
 * CLI Gate -- bridge-ci/src/cli-gate.ts
 *
 * Standalone CLI that runs the same Bridge governance checks locally.
 * No GitHub Actions dependency -- can be run by any developer before pushing.
 *
 * Usage:
 *   npx bridge-gate src/                    # Scan all source files in src/
 *   npx bridge-gate --changed               # Scan only git-changed files
 *   npx bridge-gate --sarif out.sarif       # Write SARIF report
 *   npx bridge-gate --fail-on-warning       # Fail on amber-level violations too
 *   npx bridge-gate --tokens .bridge/tokens.json  # Custom token file
 *   npx bridge-gate --policy .bridge/policy.json   # Custom policy file
 *
 * Exit codes:
 *   0 -- All checks passed
 *   1 -- Governance violations found (blocked)
 *   2 -- CLI usage error
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { auditFiles, shouldFail, generateSarif } from './audit-engine.js'
import type { DesignToken, BridgePolicy } from './types.js'
import { DEFAULT_POLICY } from './types.js'

// -- Constants -----------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js'])

const ANSI = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
}

// -- Helpers -------------------------------------------------------------------

function isSourceFile(path: string): boolean {
    for (const ext of SOURCE_EXTENSIONS) {
        if (path.endsWith(ext)) return true
    }
    return false
}

/**
 * Recursively collects all source files under a directory.
 * Skips node_modules, dist, .git, and hidden directories.
 */
function collectSourceFiles(dir: string): string[] {
    const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', '.git', 'coverage', '__pycache__'])
    const results: string[] = []

    function walk(currentDir: string): void {
        let entries: string[]
        try {
            entries = readdirSync(currentDir)
        } catch {
            return
        }

        for (const entry of entries) {
            if (entry.startsWith('.') && entry !== '.') continue
            if (SKIP_DIRS.has(entry)) continue

            const fullPath = join(currentDir, entry)
            let stat
            try {
                stat = statSync(fullPath)
            } catch {
                continue
            }

            if (stat.isDirectory()) {
                walk(fullPath)
            } else if (stat.isFile() && isSourceFile(entry)) {
                results.push(fullPath)
            }
        }
    }

    walk(dir)
    return results
}

/**
 * Gets git-changed source files relative to the merge base.
 */
function getGitChangedFiles(): string[] {
    try {
        // Try to find the merge base with main/master
        let baseBranch = 'main'
        try {
            execSync('git rev-parse --verify origin/main', { encoding: 'utf-8', stdio: 'pipe' })
        } catch {
            try {
                execSync('git rev-parse --verify origin/master', { encoding: 'utf-8', stdio: 'pipe' })
                baseBranch = 'master'
            } catch {
                // Fall back to HEAD~1
                const diff = execSync('git diff --name-only HEAD~1', { encoding: 'utf-8' }).trim()
                if (!diff) return []
                return diff.split('\n').filter(isSourceFile)
            }
        }

        const diff = execSync(
            `git diff --name-only --diff-filter=ACMR origin/${baseBranch}...HEAD`,
            { encoding: 'utf-8' }
        ).trim()
        if (!diff) return []
        return diff.split('\n').filter(isSourceFile)
    } catch {
        // Not in a git repo or no commits
        console.error(`${ANSI.yellow}Warning: Could not determine git changes. Use a path argument instead.${ANSI.reset}`)
        return []
    }
}

function readJsonFile<T>(path: string, defaultValue: T): T {
    try {
        if (!existsSync(path)) return defaultValue
        const raw = readFileSync(path, 'utf-8')
        return JSON.parse(raw) as T
    } catch {
        return defaultValue
    }
}

// -- Argument Parsing ----------------------------------------------------------

interface CliArgs {
    paths: string[]
    changed: boolean
    sarifOutput: string | null
    failOnWarning: boolean
    tokenFile: string
    policyFile: string
    help: boolean
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        paths: [],
        changed: false,
        sarifOutput: null,
        failOnWarning: false,
        tokenFile: '.bridge/tokens.json',
        policyFile: '.bridge/policy.json',
        help: false,
    }

    let i = 2 // skip node and script path
    while (i < argv.length) {
        const arg = argv[i]
        switch (arg) {
            case '--changed':
            case '-c':
                args.changed = true
                break
            case '--sarif':
            case '-s':
                i++
                args.sarifOutput = argv[i] ?? 'bridge-results.sarif'
                break
            case '--fail-on-warning':
            case '-w':
                args.failOnWarning = true
                break
            case '--tokens':
            case '-t':
                i++
                args.tokenFile = argv[i] ?? '.bridge/tokens.json'
                break
            case '--policy':
            case '-p':
                i++
                args.policyFile = argv[i] ?? '.bridge/policy.json'
                break
            case '--help':
            case '-h':
                args.help = true
                break
            default:
                if (!arg.startsWith('-')) {
                    args.paths.push(arg)
                } else {
                    console.error(`${ANSI.red}Unknown option: ${arg}${ANSI.reset}`)
                    args.help = true
                }
        }
        i++
    }

    return args
}

function printHelp(): void {
    console.log(`
${ANSI.bold}Bridge Governance Gate${ANSI.reset} -- Local CI governance checks

${ANSI.cyan}USAGE:${ANSI.reset}
  bridge-gate [options] [paths...]

${ANSI.cyan}ARGUMENTS:${ANSI.reset}
  paths              One or more directories or files to scan

${ANSI.cyan}OPTIONS:${ANSI.reset}
  --changed, -c      Scan only git-changed files (vs merge base)
  --sarif, -s FILE   Write SARIF 2.1.0 report to FILE
  --fail-on-warning  Exit 1 on amber violations (not just critical)
  --tokens, -t FILE  Path to design tokens JSON (default: .bridge/tokens.json)
  --policy, -p FILE  Path to policy JSON (default: .bridge/policy.json)
  --help, -h         Show this help message

${ANSI.cyan}EXAMPLES:${ANSI.reset}
  bridge-gate src/                           Scan all source files in src/
  bridge-gate --changed                      Scan only git-changed files
  bridge-gate --sarif report.sarif src/      Scan and write SARIF
  bridge-gate -w --changed                   Strict mode on changed files

${ANSI.cyan}EXIT CODES:${ANSI.reset}
  0  All checks passed
  1  Governance violations found (blocked)
  2  CLI usage error
`)
}

// -- Output Formatting ---------------------------------------------------------

function printSummary(summary: ReturnType<typeof auditFiles>, blocked: boolean): void {
    const divider = '='.repeat(60)

    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log(`${ANSI.bold}  Bridge Governance Gate  ${ANSI.reset}`)
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()
    console.log(`  Files scanned:          ${summary.totalFiles}`)
    console.log(`  Files with violations:  ${summary.filesWithViolations}`)
    console.log(`  Mithril warnings:       ${summary.totalMithrilWarnings}`)
    console.log(`  A11y violations:        ${summary.totalA11yViolations}`)
    console.log(`  Critical:               ${ANSI.red}${summary.criticalCount}${ANSI.reset}`)
    console.log(`  Amber:                  ${ANSI.yellow}${summary.amberCount}${ANSI.reset}`)
    console.log()

    // Detail per file
    for (const result of summary.results) {
        const mCount = result.mithrilWarnings.length
        const aCount = Object.values(result.a11yViolations).reduce((s, a) => s + a.length, 0)
        if (mCount === 0 && aCount === 0 && !result.parseError) continue

        console.log(`${ANSI.bold}  ${result.filePath}${ANSI.reset}`)

        if (result.parseError) {
            console.log(`    ${ANSI.red}PARSE ERROR: ${result.parseError}${ANSI.reset}`)
            continue
        }

        for (const w of result.mithrilWarnings) {
            const color = w.severity === 'critical' ? ANSI.red : ANSI.yellow
            const badge = w.severity === 'critical' ? 'CRIT' : 'AMBR'
            console.log(`    ${color}[${badge}]${ANSI.reset} ${w.message}`)
        }

        for (const [elemId, messages] of Object.entries(result.a11yViolations)) {
            for (const msg of messages) {
                console.log(`    ${ANSI.red}[A11Y]${ANSI.reset} ${ANSI.dim}${elemId}:${ANSI.reset} ${msg}`)
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

// -- Main ----------------------------------------------------------------------

function main(): void {
    const args = parseArgs(process.argv)

    if (args.help) {
        printHelp()
        process.exit(args.paths.length === 0 && !args.changed ? 2 : 0)
    }

    // Load tokens and policy
    const tokens = readJsonFile<DesignToken[]>(args.tokenFile, [])
    const policy = readJsonFile<BridgePolicy>(args.policyFile, DEFAULT_POLICY)

    if (tokens.length > 0) {
        console.log(`${ANSI.dim}Loaded ${tokens.length} design tokens from ${args.tokenFile}${ANSI.reset}`)
    } else {
        console.log(`${ANSI.yellow}No design tokens found at ${args.tokenFile} -- Mithril color drift checks will be limited${ANSI.reset}`)
    }

    // Collect files
    let filePaths: string[]

    if (args.changed) {
        filePaths = getGitChangedFiles()
        console.log(`${ANSI.dim}Found ${filePaths.length} git-changed source files${ANSI.reset}`)
    } else if (args.paths.length > 0) {
        filePaths = []
        for (const p of args.paths) {
            try {
                const stat = statSync(p)
                if (stat.isDirectory()) {
                    filePaths.push(...collectSourceFiles(p))
                } else if (stat.isFile() && isSourceFile(p)) {
                    filePaths.push(p)
                }
            } catch {
                console.error(`${ANSI.yellow}Warning: Cannot access ${p}${ANSI.reset}`)
            }
        }
        console.log(`${ANSI.dim}Found ${filePaths.length} source files to scan${ANSI.reset}`)
    } else {
        // Default: scan current directory
        filePaths = collectSourceFiles('.')
        console.log(`${ANSI.dim}Found ${filePaths.length} source files in current directory${ANSI.reset}`)
    }

    if (filePaths.length === 0) {
        console.log(`${ANSI.green}No source files to scan. Governance gate passed.${ANSI.reset}`)
        process.exit(0)
    }

    // Read file contents
    const files: Array<{ path: string; content: string }> = []
    for (const fp of filePaths) {
        try {
            const content = readFileSync(fp, 'utf-8')
            // Use relative path for cleaner output
            const relPath = relative(process.cwd(), fp) || fp
            files.push({ path: relPath, content })
        } catch {
            console.error(`${ANSI.yellow}Warning: Could not read ${fp}${ANSI.reset}`)
        }
    }

    // Run audit
    const summary = auditFiles(files, tokens, policy)

    // Generate SARIF if requested
    if (args.sarifOutput) {
        const sarif = generateSarif(summary)
        writeFileSync(args.sarifOutput, JSON.stringify(sarif, null, 2), 'utf-8')
        console.log(`${ANSI.dim}SARIF report written to ${args.sarifOutput}${ANSI.reset}`)
    }

    // Print summary
    const blocked = shouldFail(summary, policy, args.failOnWarning)
    printSummary(summary, blocked)

    // Exit with appropriate code
    process.exit(blocked ? 1 : 0)
}

main()
