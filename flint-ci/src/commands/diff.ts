/**
 * Diff command -- flint-ci/src/commands/diff.ts
 *
 * Answers "what did I just break?" — shows exactly which governance violations
 * were introduced or fixed compared to the git merge base branch.
 *
 *   flint diff                         # auto-detects origin/main or origin/master
 *   flint diff --base origin/my-branch # explicit base ref
 *   flint diff --format json           # machine-readable delta
 *
 * Uses the shared computeDelta() from engine.ts, which is also used by
 * the GitHub Action for PR comment delta computation.
 *
 * Exit codes: 0=no new violations, 1=new violations introduced, 3=error.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import {
  auditFiles,
  computeDelta,
  loadTokens,
  loadGovernanceConfig,
} from '../engine.js'
import type { FlintPolicy } from '../engine.js'
import { ANSI, BOX, SYMBOLS } from '../utils/ansi.js'
import { calculateHealthScore } from '../utils/render.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiffOptions {
  base?: string
  tokens?: string
  format?: 'terminal' | 'json'
  projectRoot?: string
}

// ── Git helpers ───────────────────────────────────────────────────────────────

/**
 * Resolves the best merge-base ref to diff against.
 * Priority: explicit --base > origin/main > origin/master > HEAD~1.
 */
function resolveBaseRef(base: string): string {
  if (base !== 'main') return base

  for (const ref of ['origin/main', 'origin/master']) {
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: 'pipe' })
      return ref
    } catch { /* try next */ }
  }
  return 'HEAD~1'
}

/**
 * Returns the list of source files changed vs the base ref.
 */
function getChangedSourceFiles(baseRef: string): string[] {
  try {
    const diff = execSync(
      `git diff --name-only --diff-filter=ACMR ${baseRef}...HEAD`,
      { encoding: 'utf-8', stdio: 'pipe' },
    ).trim()
    if (!diff) return []
    return diff
      .split('\n')
      .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes('node_modules'))
  } catch {
    return []
  }
}

// ── Main command ──────────────────────────────────────────────────────────────

export async function diffCommand(opts: DiffOptions): Promise<number> {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
  const tokenPath = opts.tokens ?? path.join(projectRoot, '.flint', 'design-tokens.json')
  const format = opts.format ?? 'terminal'

  const { config } = loadGovernanceConfig(projectRoot)
  const policy: FlintPolicy = config.policy
  const tokens = loadTokens(tokenPath)

  const baseRef = resolveBaseRef(opts.base ?? 'main')

  if (format === 'terminal') {
    console.log()
    console.log(
      `  ${ANSI.bold}${ANSI.cyan}${SYMBOLS.spark} Flint Diff${ANSI.reset}` +
      `  ${ANSI.dim}vs ${baseRef}${ANSI.reset}`
    )
    console.log()
  }

  // ── Changed files ─────────────────────────────────────────────────────────

  const changedFiles = getChangedSourceFiles(baseRef)

  if (changedFiles.length === 0) {
    if (format === 'terminal') {
      console.log(
        `  ${ANSI.green}${SYMBOLS.check} No changed source files detected.${ANSI.reset}`
      )
      console.log(
        `  ${ANSI.dim}Make sure you have commits vs ${baseRef}.${ANSI.reset}`
      )
      console.log()
    } else {
      console.log(JSON.stringify({ base: baseRef, filesScanned: 0, delta: { new: 0, fixed: 0, unchanged: 0 } }, null, 2))
    }
    return 0
  }

  if (format === 'terminal') {
    console.log(`  ${ANSI.dim}Scanning ${changedFiles.length} changed file(s)...${ANSI.reset}`)
  }

  // Read current versions
  const files: Array<{ path: string; content: string }> = []
  for (const fp of changedFiles) {
    const absPath = path.isAbsolute(fp) ? fp : path.resolve(projectRoot, fp)
    try {
      const content = fs.readFileSync(absPath, 'utf-8')
      files.push({ path: fp, content })
    } catch { /* file may have been deleted or is inaccessible */ }
  }

  if (files.length === 0) {
    if (format === 'terminal') {
      console.log(
        `  ${ANSI.yellow}Could not read any changed files.${ANSI.reset}`
      )
    }
    return 0
  }

  // ── Audit + delta ─────────────────────────────────────────────────────────

  const summary = auditFiles(files, tokens, policy)
  const delta = computeDelta(summary, baseRef, tokens, policy)

  if (!delta) {
    if (format === 'terminal') {
      console.log(
        `  ${ANSI.yellow}${SYMBOLS.warn} Could not compute delta — ` +
        `git history may be shallow.${ANSI.reset}`
      )
      console.log(`  ${ANSI.dim}Try: git fetch --unshallow${ANSI.reset}`)
      console.log()
    }
    return 0
  }

  // ── JSON output ───────────────────────────────────────────────────────────

  if (format === 'json') {
    console.log(
      JSON.stringify(
        {
          base: baseRef,
          filesScanned: files.length,
          delta: {
            new: delta.newViolations,
            fixed: delta.fixedViolations,
            unchanged: delta.unchangedViolations,
          },
          newViolations: delta.newDetails,
          fixedViolations: delta.fixedDetails,
        },
        null,
        2,
      )
    )
    return delta.newViolations > 0 ? 1 : 0
  }

  // ── Terminal output ───────────────────────────────────────────────────────

  const divider = BOX.h.repeat(50)
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log()

  if (delta.newViolations > 0) {
    console.log(
      `  ${ANSI.red}${ANSI.bold}+${delta.newViolations}${ANSI.reset}` +
      ` new violation(s) introduced`
    )
  } else {
    console.log(
      `  ${ANSI.green}${SYMBOLS.check} No new violations introduced${ANSI.reset}`
    )
  }

  if (delta.fixedViolations > 0) {
    console.log(
      `  ${ANSI.green}-${delta.fixedViolations}${ANSI.reset} violation(s) fixed`
    )
  }

  if (delta.unchangedViolations > 0) {
    console.log(
      `  ${ANSI.dim}  ${delta.unchangedViolations} unchanged${ANSI.reset}`
    )
  }

  console.log()

  if (delta.newDetails.length > 0) {
    console.log(`  ${ANSI.red}${ANSI.bold}New:${ANSI.reset}`)
    for (const v of delta.newDetails) {
      const shortMsg = v.message
        .replace(/^[A-Z0-9]+-[A-Z0-9-]+:\s*/, '')
        .substring(0, 55)
      console.log(
        `    ${ANSI.dim}${v.filePath}${ANSI.reset}  ` +
        `${ANSI.yellow}${v.ruleId}${ANSI.reset}  ${shortMsg}`
      )
    }
    console.log()
  }

  if (delta.fixedDetails.length > 0) {
    console.log(`  ${ANSI.green}${ANSI.bold}Fixed:${ANSI.reset}`)
    for (const v of delta.fixedDetails) {
      console.log(
        `    ${ANSI.dim}${v.filePath}${ANSI.reset}  ${ANSI.green}resolved${ANSI.reset}`
      )
    }
    console.log()
  }

  const score = calculateHealthScore(summary)
  const scoreColor =
    score >= 80 ? ANSI.green : score >= 60 ? ANSI.yellow : ANSI.red
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log(
    `   Changed-file health: ${scoreColor}${ANSI.bold}${score}/100${ANSI.reset}`
  )

  if (delta.newViolations > 0) {
    console.log()
    console.log(
      `   ${ANSI.dim}Run${ANSI.reset} ${ANSI.cyan}flint fix -i${ANSI.reset}` +
      ` ${ANSI.dim}to step through fixes interactively.${ANSI.reset}`
    )
  }
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log()

  return delta.newViolations > 0 ? 1 : 0
}
