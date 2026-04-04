/**
 * Interactive fix command -- flint-ci/src/commands/interactive-fix.ts
 *
 * Steps through each fixable governance violation one at a time,
 * presenting a before/after diff and requesting y/n/a/q approval.
 *
 * Key bindings:
 *   y   Apply this fix
 *   n   Skip this fix
 *   a   Apply all remaining fixes without further prompting
 *   q   Quit, no more fixes applied
 *
 * Uses Node.js stdin in raw mode for single-keystroke input.
 * Falls back to line-mode input if stdin is not a TTY.
 *
 * Exit codes: 0=all clean, 1=remaining violations, 3=error.
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import {
  auditFiles,
  loadTokens,
  loadGovernanceConfig,
  extractRuleId,
} from '../engine.js'
import type { FlintPolicy, LinterWarning } from '../engine.js'
import { ANSI, BOX, SYMBOLS } from '../utils/ansi.js'
import { collectSourceFiles, isSourceFile } from '../utils/files.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FixableItem {
  filePath: string
  absolutePath: string
  warning: LinterWarning
  ruleId: string
  nearestToken: string | null
}

// ── Single-key prompt ─────────────────────────────────────────────────────────

/**
 * Waits for a single keypress and returns the lowercase character.
 * Falls back to readline line mode when stdin is not a TTY.
 */
async function getKeypress(prompt: string): Promise<string> {
  process.stdout.write(prompt)

  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-interactive mode: accept full line input
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      rl.once('line', (line) => {
        rl.close()
        resolve((line.trim().toLowerCase()[0]) ?? 'n')
      })
      return
    }

    // Raw mode: capture single keypress without Enter
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf-8')
    process.stdin.once('data', (key: string) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      // Ctrl+C → exit gracefully
      if (key === '\u0003') {
        process.exit(130)
      }
      resolve((key.toLowerCase()[0]) ?? 'n')
    })
  })
}

// ── Before/After diff display ─────────────────────────────────────────────────

/**
 * Renders an approximate before/after display of a proposed fix.
 * The actual fix is always performed by the MCP AST engine —
 * this is display-only to give the developer a visual preview.
 */
function renderBeforeAfter(
  lineContent: string,
  nearestToken: string,
  filePath: string,
  lineNumber: number | null | undefined,
): void {
  const loc = lineNumber != null ? `:${lineNumber}` : ''
  console.log(`  ${ANSI.bold}${filePath}${loc}${ANSI.reset}`)
  console.log()

  const before = lineContent.trimEnd()

  // Approximate replacement (display only — AST engine does the real transform)
  let after = before
  const hexMatch = /#[0-9a-fA-F]{3,8}/.exec(before)
  const arbitraryMatch = /[a-z]+-\[[^\]]+\]/.exec(before)
  if (hexMatch) {
    after = before.replace(hexMatch[0], nearestToken)
  } else if (arbitraryMatch) {
    after = before.replace(arbitraryMatch[0], nearestToken)
  }

  console.log(`  ${ANSI.red}${BOX.h.repeat(3)} Before ${BOX.h.repeat(3)}${ANSI.reset}`)
  console.log(`    ${ANSI.dim}${before}${ANSI.reset}`)
  console.log()
  console.log(`  ${ANSI.green}${BOX.h.repeat(3)} After  ${BOX.h.repeat(3)}${ANSI.reset}`)
  console.log(`    ${ANSI.green}${after}${ANSI.reset}`)
  console.log()
}

// ── Apply a single fix via MCP engine ────────────────────────────────────────

async function applyFix(absolutePath: string, projectRoot: string): Promise<boolean> {
  try {
    // Dynamic import via Function constructor — bypasses TypeScript's static module
    // resolution so this cross-package optional dependency compiles cleanly.
    // The module is only available when flint-mcp is installed alongside flint-ci.
    // Falls back to the catch block gracefully when unavailable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-new-func
    const dynamicImport = new Function('path', 'return import(path)') as (p: string) => Promise<any>
    const fixModule = await dynamicImport('../../../../flint-mcp/src/tools/fix.js')
    if (typeof fixModule.handleFlintFix !== 'function') return false

    await fixModule.handleFlintFix({
      filePath: absolutePath,
      dry_run: false,
      projectRoot,
    })
    return true
  } catch {
    return false
  }
}

// ── Main command ──────────────────────────────────────────────────────────────

export interface InteractiveFixOptions {
  tokens?: string
  projectRoot?: string
  dryRun?: boolean
}

export async function interactiveFixCommand(
  paths: string[],
  opts: InteractiveFixOptions,
): Promise<number> {
  const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())
  const tokenPath = opts.tokens ?? path.join(projectRoot, '.flint', 'design-tokens.json')

  const { config } = loadGovernanceConfig(projectRoot)
  const policy: FlintPolicy = config.policy
  const tokens = loadTokens(tokenPath)

  if (tokens.length === 0) {
    console.log(
      `${ANSI.yellow}No design tokens loaded. Cannot perform interactive fix without tokens.${ANSI.reset}`
    )
    console.log(
      `${ANSI.dim}Ensure .flint/design-tokens.json exists or pass --tokens <file>${ANSI.reset}`
    )
    return 3
  }

  // ── Collect files ─────────────────────────────────────────────────────────

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
      } catch { /* skip inaccessible paths */ }
    }
  } else {
    filePaths = collectSourceFiles(projectRoot)
  }

  // Build source content map (used for before/after rendering)
  const fileContents = new Map<string, string>()
  const files: Array<{ path: string; content: string }> = []
  for (const fp of filePaths) {
    try {
      const content = fs.readFileSync(fp, 'utf-8')
      const relPath = path.relative(process.cwd(), fp) || fp
      fileContents.set(relPath, content)
      files.push({ path: relPath, content })
    } catch { /* skip unreadable files */ }
  }

  if (files.length === 0) {
    console.log(`${ANSI.green}No source files to scan.${ANSI.reset}`)
    return 0
  }

  // ── Audit ────────────────────────────────────────────────────────────────

  const summary = auditFiles(files, tokens, policy)

  // ── Collect fixable items ─────────────────────────────────────────────────

  const fixable: FixableItem[] = []
  for (const result of summary.results) {
    // Map relative path back to an absolute path for the MCP engine
    const absPath =
      filePaths.find(
        (fp) => (path.relative(process.cwd(), fp) || fp) === result.filePath
      ) ?? path.resolve(projectRoot, result.filePath)

    for (const w of result.mithrilWarnings) {
      if (w.nearestToken != null || w.fixable === true) {
        fixable.push({
          filePath: result.filePath,
          absolutePath: absPath,
          warning: w,
          ruleId: extractRuleId(w.message),
          nearestToken: w.nearestToken ?? null,
        })
      }
    }
  }

  if (fixable.length === 0) {
    console.log(`${ANSI.green}${SYMBOLS.check} No auto-fixable violations found.${ANSI.reset}`)
    const totalViolations = summary.totalMithrilWarnings + summary.totalA11yViolations
    if (totalViolations > 0) {
      console.log(
        `${ANSI.dim}${totalViolations} violation(s) require manual remediation.${ANSI.reset}`
      )
    }
    return totalViolations > 0 ? 1 : 0
  }

  // ── Header ────────────────────────────────────────────────────────────────

  console.log()
  console.log(
    `  ${ANSI.bold}${ANSI.cyan}${SYMBOLS.spark} Flint Interactive Fix${ANSI.reset}` +
    `  ${ANSI.dim}${fixable.length} fixable violation(s)${ANSI.reset}`
  )
  console.log()

  // ── Step-through loop ─────────────────────────────────────────────────────

  let applied = 0
  let skipped = 0
  let applyAll = false

  for (let i = 0; i < fixable.length; i++) {
    const { filePath, absolutePath, warning, ruleId, nearestToken } = fixable[i]

    if (!applyAll) {
      console.log(
        `  ${ANSI.bold}${SYMBOLS.dot} [${i + 1}/${fixable.length}]${ANSI.reset}` +
        `  ${ANSI.dim}${filePath}${ANSI.reset}`
      )
      console.log()

      // Before/after display
      const source = fileContents.get(filePath)
      if (source && warning.line != null && nearestToken) {
        const lines = source.split('\n')
        const lineContent = lines[(warning.line ?? 1) - 1] ?? ''
        renderBeforeAfter(lineContent, nearestToken, filePath, warning.line)
      }

      // Rule metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = warning as any
      const deltaE =
        typeof w.deltaE === 'number' ? `  ΔE: ${w.deltaE.toFixed(1)}` : ''
      const tokenLabel = nearestToken
        ? `  Token: ${ANSI.green}${nearestToken}${ANSI.reset}`
        : ''
      console.log(
        `  Rule: ${ANSI.cyan}${ruleId}${ANSI.reset}${ANSI.dim}${deltaE}${ANSI.reset}${tokenLabel}`
      )
      console.log()

      // Prompt
      const key = await getKeypress(
        `  ${ANSI.bold}[y]${ANSI.reset} Apply  ` +
        `${ANSI.bold}[n]${ANSI.reset} Skip  ` +
        `${ANSI.bold}[a]${ANSI.reset} Apply all  ` +
        `${ANSI.bold}[q]${ANSI.reset} Quit  ${ANSI.dim}>${ANSI.reset} `
      )

      if (key === 'q') {
        console.log()
        console.log(
          `  ${ANSI.dim}Quit — ${applied} applied, ${skipped} skipped.${ANSI.reset}`
        )
        break
      }
      if (key === 'a') {
        applyAll = true
      } else if (key !== 'y') {
        skipped++
        console.log(`  ${ANSI.dim}Skipped.${ANSI.reset}`)
        console.log()
        continue
      }
    }

    // Apply
    const success = await applyFix(absolutePath, projectRoot)
    if (success) {
      applied++
      if (!applyAll) {
        console.log(`  ${ANSI.green}${SYMBOLS.check} Applied.${ANSI.reset}`)
        console.log()
      }
    } else {
      skipped++
      if (!applyAll) {
        console.log(
          `  ${ANSI.yellow}${SYMBOLS.warn} MCP fix engine unavailable — manual fix needed.${ANSI.reset}`
        )
        console.log()
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log()
  const divider = BOX.h.repeat(44)
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log(
    `   Applied: ${ANSI.green}${applied}${ANSI.reset}` +
    `  ${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}` +
    `  Skipped: ${ANSI.dim}${skipped}${ANSI.reset}` +
    `  ${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}` +
    `  Total: ${fixable.length}`
  )
  if (applied > 0) {
    console.log(
      `   ${ANSI.dim}Run${ANSI.reset} ${ANSI.cyan}flint audit${ANSI.reset}` +
      ` ${ANSI.dim}to verify the remaining state.${ANSI.reset}`
    )
  }
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log()

  const remaining =
    summary.totalMithrilWarnings + summary.totalA11yViolations - applied
  return remaining > 0 ? 1 : 0
}
