/**
 * Baseline command -- flint-ci/src/commands/baseline.ts
 *
 * Generates .flint/baseline.json from the current state of violations.
 * This enables incremental adoption: existing violations are suppressed
 * so CI only fails on NEW violations introduced by a PR.
 *
 * Usage:
 *   flint-gate baseline              — generate baseline from all source files
 *   flint-gate baseline src/         — generate baseline from specific paths
 *   flint-gate baseline --update     — update existing baseline (add new, keep old)
 *
 * The baseline file maps each file to the rule IDs of its current violations:
 *   {
 *     "src/Button.tsx": ["MITHRIL-COL", "A11Y-001"],
 *     "src/Card.tsx": ["A11Y-003"]
 *   }
 *
 * Exit codes: 0=baseline written, 1=no violations (baseline empty), 3=error.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
    auditFiles,
    loadTokens,
    loadGovernanceConfig,
    extractRuleId,
} from '../engine.js'
import type { FlintPolicy } from '../engine.js'
import { ANSI } from '../utils/ansi.js'
import { isSourceFile, collectSourceFiles } from '../utils/files.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface BaselineOptions {
    projectRoot?: string
    tokens?: string
    update?: boolean
}

export type BaselineMap = Record<string, string[]>

// ── Command ─────────────────────────────────────────────────────────────────

export async function baselineCommand(
    paths: string[],
    opts: BaselineOptions,
): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
    const tokenPath = opts.tokens ?? path.join(projectRoot, '.flint', 'design-tokens.json')
    const baselinePath = path.join(projectRoot, '.flint', 'baseline.json')
    const shouldUpdate = opts.update ?? false

    // Load config and tokens
    const { config } = loadGovernanceConfig(projectRoot)
    const policy: FlintPolicy = config.policy
    const tokens = loadTokens(tokenPath)

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
                console.error(`${ANSI.yellow}Warning: Cannot access ${p}${ANSI.reset}`)
            }
        }
    } else {
        filePaths = collectSourceFiles(projectRoot)
    }

    console.log(`${ANSI.dim}Scanning ${filePaths.length} files to generate baseline...${ANSI.reset}`)

    // Read and audit
    const files: Array<{ path: string; content: string }> = []
    for (const fp of filePaths) {
        try {
            const content = fs.readFileSync(fp, 'utf-8')
            const relPath = path.relative(projectRoot, fp) || fp
            files.push({ path: relPath, content })
        } catch {
            // Skip unreadable files
        }
    }

    const summary = auditFiles(files, tokens, policy)

    // Build baseline map: file -> [ruleIds]
    const baseline: BaselineMap = {}
    let totalSuppressed = 0

    for (const result of summary.results) {
        const ruleIds = new Set<string>()

        for (const w of result.mithrilWarnings) {
            ruleIds.add(extractRuleId(w.message))
        }

        for (const messages of Object.values(result.a11yViolations)) {
            for (const msg of messages) {
                ruleIds.add(extractRuleId(msg))
            }
        }

        if (ruleIds.size > 0) {
            baseline[result.filePath] = [...ruleIds].sort()
            totalSuppressed += ruleIds.size
        }
    }

    // Merge with existing baseline if --update
    if (shouldUpdate && fs.existsSync(baselinePath)) {
        try {
            const existing: BaselineMap = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
            for (const [file, rules] of Object.entries(existing)) {
                if (!baseline[file]) {
                    baseline[file] = rules
                } else {
                    const merged = new Set([...baseline[file], ...rules])
                    baseline[file] = [...merged].sort()
                }
            }
            console.log(`${ANSI.dim}Merged with existing baseline${ANSI.reset}`)
        } catch {
            console.error(`${ANSI.yellow}Warning: Could not read existing baseline — creating fresh${ANSI.reset}`)
        }
    }

    // Write baseline
    const flintDir = path.join(projectRoot, '.flint')
    if (!fs.existsSync(flintDir)) {
        fs.mkdirSync(flintDir, { recursive: true })
    }

    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8')

    // Summary
    const fileCount = Object.keys(baseline).length
    const divider = '-'.repeat(50)
    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log(`${ANSI.bold}  Flint Baseline Generated${ANSI.reset}`)
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()
    console.log(`  Files with violations:  ${fileCount}`)
    console.log(`  Rule IDs suppressed:    ${totalSuppressed}`)
    console.log(`  Written to:             ${ANSI.cyan}${path.relative(process.cwd(), baselinePath)}${ANSI.reset}`)
    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)

    if (fileCount === 0) {
        console.log(`${ANSI.green}No violations found. Baseline is empty.${ANSI.reset}`)
        console.log()
        return 1
    }

    console.log()
    console.log(`${ANSI.dim}Next steps:${ANSI.reset}`)
    console.log(`  1. Commit ${ANSI.cyan}.flint/baseline.json${ANSI.reset} to your repository`)
    console.log(`  2. Add ${ANSI.cyan}--baseline${ANSI.reset} to your CI audit command:`)
    console.log(`     ${ANSI.dim}flint-gate audit --baseline${ANSI.reset}`)
    console.log(`  3. New PRs will only fail on ${ANSI.bold}new${ANSI.reset} violations`)
    console.log(`  4. Fix existing violations over time, then run:`)
    console.log(`     ${ANSI.dim}flint-gate baseline${ANSI.reset}  (to shrink the baseline)`)
    console.log()

    return 0
}
