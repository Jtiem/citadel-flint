/**
 * Render utilities -- flint-ci/src/utils/render.ts
 *
 * Shared terminal output formatter for the Flint CLI.
 * Provides Biome-style violation rendering with inline source snippets,
 * caret underlining, progress bars, and health score calculation.
 *
 * This module is the SINGLE SOURCE OF TRUTH for:
 *   - Health score formula (used by both CLI and GitHub Action)
 *   - Letter grade mapping
 *   - Terminal progress indicators
 *   - Violation block rendering
 *
 * All output respects NO_COLOR, FORCE_COLOR, and CI environment vars
 * via the ANSI module.
 */

import { readFileSync } from 'node:fs'
import type { AuditSummary } from '../engine.js'
import { ANSI, BOX, SYMBOLS, isCI, boxTop, boxBottom, style } from './ansi.js'

// ── Source file cache ───────────────────────────────────────────────────────

const fileCache = new Map<string, string>()

// ── Types ───────────────────────────────────────────────────────────────────

export interface ViolationInput {
  message: string
  line?: number
  column?: number
  severity: 'critical' | 'warning'
  ruleId: string
  filePath: string
  nearestToken?: string
  fixSuggestion?: string
  explanation?: { title: string; recovery: string }
}

export interface AuditSummaryInput {
  totalFiles: number
  filesWithViolations: number
  totalViolations: number
  autoFixable: number
  healthScore: number
  grade: string
  fidelityScore: number
  a11yScore: number
  overrideCount: number
  blocked: boolean
}

export interface DiffDelta {
  newViolations: number
  fixedViolations: number
  unchangedViolations: number
}

// ── Health score ─────────────────────────────────────────────────────────────

/**
 * Calculates a health score (0-100) from an audit summary.
 * 100 = no violations. 0 = maximum violations.
 *
 * Formula:
 *   weightedPenalty = criticalCount x 10 + amberCount x 3
 *   maxPenalty      = totalFiles x 10
 *   score           = max(0, round(100 x (1 - penalty / maxPenalty)))
 *
 * This is the canonical formula. Both the CLI footer and the GitHub Action
 * import this function. Do NOT duplicate it elsewhere.
 */
export function calculateHealthScore(summary: AuditSummary): number {
  if (summary.totalFiles === 0) return 100
  const totalViolations = summary.totalMithrilWarnings + summary.totalA11yViolations
  if (totalViolations === 0) return 100
  const weightedPenalty = summary.criticalCount * 10 + summary.amberCount * 3
  const maxPenalty = summary.totalFiles * 10
  return Math.max(0, Math.round(100 * (1 - weightedPenalty / maxPenalty)))
}

/**
 * Maps a 0-100 score to a letter grade (A-F).
 */
export function formatGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

// ── Source line extraction ───────────────────────────────────────────────────

/**
 * Reads a file and returns the source line at the given 1-based line number.
 * Caches file contents to avoid re-reading.
 * Returns null if the file cannot be read or the line is out of range.
 */
export function extractSourceLine(
  filePath: string,
  line: number,
): { text: string; lineNum: number } | null {
  let content = fileCache.get(filePath)
  if (content === undefined) {
    try {
      content = readFileSync(filePath, 'utf-8')
      fileCache.set(filePath, content)
    } catch {
      return null
    }
  }
  const lines = content.split('\n')
  const idx = line - 1
  if (idx < 0 || idx >= lines.length) return null
  return { text: lines[idx], lineNum: line }
}

/** Clears the file cache (useful for testing). */
export function clearFileCache(): void {
  fileCache.clear()
}

// ── Progress indicator ───────────────────────────────────────────────────────

const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F']
let spinnerFrame = 0

/**
 * Renders a progress indicator to stderr (does not interfere with stdout).
 * - Small scans (<50 files): spinner
 * - Large scans: progress bar [|||||||...] N%
 *
 * In CI mode, emits nothing (progress bars pollute CI logs).
 */
export function renderProgress(current: number, total: number): void {
  if (isCI) return
  if (!process.stderr.isTTY) return

  const pct = total === 0 ? 100 : Math.round((current / total) * 100)
  let line: string

  if (total < 50) {
    const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]
    spinnerFrame++
    line = `  ${ANSI.cyan}${frame}${ANSI.reset} Scanning... ${current}/${total} files`
  } else {
    const filled = Math.round((current / total) * 20)
    const empty = 20 - filled
    const bar = `${SYMBOLS.bar.repeat(filled)}${SYMBOLS.barEmpty.repeat(empty)}`
    line = `  ${ANSI.cyan}${SYMBOLS.spark}${ANSI.reset} Scanning... ${current}/${total} files  [${bar}] ${pct}%`
  }

  process.stderr.write(`\r${line.padEnd(80)}`)
}

/**
 * Clears the progress line from stderr after a scan completes.
 */
export function clearProgress(): void {
  if (isCI) return
  if (!process.stderr.isTTY) return
  process.stderr.write(`\r${' '.repeat(80)}\r`)
}

// ── Progress bar object ─────────────────────────────────────────────────────

/**
 * Creates a progress bar object for terminal output.
 * In CI, only prints at 25% milestones to avoid log spam.
 */
export function createProgressBar(total: number): { update(current: number): void; finish(): void } {
  let lastMilestone = -1

  return {
    update(current: number): void {
      const pct = total === 0 ? 100 : Math.round((current / total) * 100)

      if (isCI) {
        // In CI, only print at 25% milestones
        const milestone = Math.floor(pct / 25) * 25
        if (milestone > lastMilestone) {
          lastMilestone = milestone
          process.stderr.write(` Scanning... ${current}/${total} files  ${pct}%\n`)
        }
        return
      }

      if (!process.stderr.isTTY) return

      const filled = Math.round((current / total) * 16)
      const empty = 16 - filled
      const bar = `${SYMBOLS.bar.repeat(filled)}${SYMBOLS.barEmpty.repeat(empty)}`
      process.stderr.write(`\r Scanning... ${current}/${total} files  [${bar}] ${pct}%`)
    },
    finish(): void {
      if (isCI) return
      if (!process.stderr.isTTY) return
      process.stderr.write(`\r${' '.repeat(80)}\r`)
    },
  }
}

// ── Source snippet + caret underline ─────────────────────────────────────────

/**
 * Extracts the line at `lineNumber` (1-based) from `source`.
 * Returns null if the line is out of range.
 */
export function getSourceLine(source: string, lineNumber: number): string | null {
  const lines = source.split('\n')
  const idx = lineNumber - 1
  if (idx < 0 || idx >= lines.length) return null
  return lines[idx]
}

/**
 * Extracts the approximate character length of the offending value
 * from a violation message. Used to size the caret underline.
 */
export function extractValueLength(message: string): number {
  // Match quoted strings: "bg-[#1a73e8]" or '#1a73e8'
  const quoted = /"([^"]+)"/.exec(message) ?? /'([^']+)'/.exec(message)
  if (quoted) return quoted[1].length

  // Match hex colors: #1a73e8
  const hex = /#[0-9a-fA-F]{3,8}/.exec(message)
  if (hex) return hex[0].length

  // Match arbitrary Tailwind class like bg-[...] or text-[...]
  const arbitrary = /[a-z]+-\[[^\]]+\]/.exec(message)
  if (arbitrary) return arbitrary[0].length

  return 8 // fallback underline width
}

/**
 * Builds a caret underline string for a violation.
 * Positions the tilde characters at `column` with `valueLength` width.
 */
function buildCaret(
  lineContent: string,
  column: number | null | undefined,
  valueLength: number,
): string {
  const col = column != null
    ? column
    : Math.max(0, lineContent.search(/\S/)) // fall back to first non-space char
  const indent = ' '.repeat(Math.max(0, col))
  const underline = '~'.repeat(Math.max(1, valueLength))
  return `${indent}${ANSI.red}${underline}${ANSI.reset}`
}

// ── Format violation (string-returning) ─────────────────────────────────────

/**
 * Formats a single violation into a Biome/Rust-style annotated block string.
 *
 * Example output:
 *
 *    12 | className="bg-[#1a73e8] text-white"
 *       |            ~~~~~~~~~~~~
 *       |  MITHRIL-COL  Color #1a73e8 drifts from token
 *       |  Why: Hardcoded color bypasses your design system
 *       |  Fix: bg-primary (deltaE 1.4)
 */
export function formatViolation(v: ViolationInput): string {
  const lines: string[] = []
  const gutterSep = `${ANSI.dim}${BOX.v}${ANSI.reset}`

  // Source snippet with line number gutter
  if (v.line != null) {
    const src = extractSourceLine(v.filePath, v.line)
    if (src) {
      const gutterNum = String(src.lineNum).padStart(4)
      lines.push(`  ${ANSI.dim}${gutterNum}${ANSI.reset} ${gutterSep} ${src.text}`)

      // Caret underline
      if (v.column != null) {
        const valueLen = extractValueLength(v.message)
        const indent = ' '.repeat(Math.max(0, v.column))
        const underline = '~'.repeat(Math.max(1, valueLen))
        lines.push(`       ${gutterSep} ${indent}${ANSI.red}${underline}${ANSI.reset}`)
      }
    }
  }

  // Rule ID + message
  const color = v.severity === 'critical' ? ANSI.red : ANSI.yellow
  const cleanMsg = v.message.replace(/^[A-Z0-9]+-[A-Z0-9-]+:\s*/, '')
  lines.push(`       ${gutterSep}  ${color}${ANSI.bold}${v.ruleId}${ANSI.reset}  ${cleanMsg}`)

  // Why line
  if (v.explanation) {
    lines.push(`       ${gutterSep}  ${ANSI.dim}Why:${ANSI.reset} ${v.explanation.title}`)
  }

  // Fix line
  const fixText = v.fixSuggestion || v.nearestToken
  if (fixText) {
    lines.push(`       ${gutterSep}  ${ANSI.green}Fix:${ANSI.reset} ${fixText}`)
  } else if (v.explanation?.recovery) {
    lines.push(`       ${gutterSep}  ${ANSI.green}Fix:${ANSI.reset} ${v.explanation.recovery.split('.')[0]}`)
  }

  return lines.join('\n')
}

// ── Format file summary (string-returning) ──────────────────────────────────

/**
 * Formats a file summary. Clean files get a checkmark; files with violations
 * get a bold header followed by each formatted violation.
 */
export function formatFileSummary(
  filePath: string,
  violations: ViolationInput[],
  clean: boolean,
): string {
  if (clean || violations.length === 0) {
    return `  ${ANSI.green}${SYMBOLS.check}${ANSI.reset} ${filePath}`
  }

  const lines: string[] = []
  lines.push(`  ${ANSI.bold}${filePath}${ANSI.reset}`)
  for (const v of violations) {
    lines.push(formatViolation(v))
  }
  return lines.join('\n')
}

// ── Format audit summary (string-returning) ──────────────────────────────────

/**
 * Formats the audit summary footer box as a string.
 */
export function formatAuditSummary(opts: AuditSummaryInput): string {
  const divider = BOX.h.repeat(38)
  const violColor = opts.totalViolations === 0 ? ANSI.green : ANSI.yellow
  const gradeColor = opts.healthScore >= 80 ? ANSI.green : opts.healthScore >= 60 ? ANSI.yellow : ANSI.red

  const lines: string[] = []
  lines.push(` ${ANSI.dim}${divider}${ANSI.reset}`)
  lines.push(
    `  ${opts.totalFiles} files scanned  ${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `${violColor}${opts.totalViolations} violation${opts.totalViolations !== 1 ? 's' : ''}${ANSI.reset}  ` +
    `${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `${ANSI.cyan}${opts.autoFixable} auto-fixable${ANSI.reset}`,
  )
  lines.push('')
  lines.push(
    `  Health: ${gradeColor}${ANSI.bold}${opts.healthScore}/100 (${opts.grade})${ANSI.reset}  ` +
    `${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `Fidelity: ${opts.fidelityScore}  ` +
    `${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `A11y: ${opts.a11yScore}`,
  )
  lines.push('')

  if (opts.blocked) {
    lines.push(
      `  ${ANSI.red}${ANSI.bold}BLOCKED${ANSI.reset}` +
      ` ${ANSI.dim}— run${ANSI.reset} ${ANSI.cyan}\`flint fix\`${ANSI.reset}` +
      ` ${ANSI.dim}to auto-remediate${ANSI.reset}`,
    )
  } else {
    lines.push(
      `  ${ANSI.green}${ANSI.bold}PASSED${ANSI.reset}` +
      ` ${ANSI.dim}— no governance violations${ANSI.reset}`,
    )
  }

  lines.push(` ${ANSI.dim}${divider}${ANSI.reset}`)
  return lines.join('\n')
}

// ── Format diff summary (string-returning) ──────────────────────────────────

/**
 * Formats a diff summary showing new, fixed, and unchanged violations.
 */
export function formatDiffSummary(delta: DiffDelta): string {
  const lines: string[] = []
  if (delta.newViolations > 0) {
    lines.push(`  ${ANSI.red}+${delta.newViolations} new violation${delta.newViolations !== 1 ? 's' : ''} introduced${ANSI.reset}`)
  }
  if (delta.fixedViolations > 0) {
    lines.push(`  ${ANSI.green}-${delta.fixedViolations} violation${delta.fixedViolations !== 1 ? 's' : ''} fixed${ANSI.reset}`)
  }
  if (delta.unchangedViolations > 0) {
    lines.push(`  ${ANSI.dim} ${delta.unchangedViolations} unchanged${ANSI.reset}`)
  }
  return lines.join('\n')
}

// ── File violation block (console-based, legacy) ────────────────────────────

/**
 * Renders a single violation as a Biome-style annotated block:
 *
 *   12 | className="bg-[#1a73e8] text-white"
 *              ~~~~~~~~~~~~
 *      MITHRIL-COL  [CRIT]  Color drifts from token
 *      Why: Hardcoded color bypasses design system
 *      Fix: Use token -> bg-primary
 */
export function renderViolationBlock(
  message: string,
  severity: 'critical' | 'warning' | 'advisory',
  line: number | null | undefined,
  column: number | null | undefined,
  sourceContent: string | null,
  ruleId: string,
  explanation: { title: string; recovery: string } | null,
  nearestToken?: string | null,
): void {
  const color = severity === 'critical' ? ANSI.red : ANSI.yellow
  const badge = severity === 'critical'
    ? `${ANSI.red}[CRIT]${ANSI.reset}`
    : `${ANSI.yellow}[AMBR]${ANSI.reset}`

  // Source snippet with line number gutter
  if (line != null && sourceContent) {
    const lineContent = getSourceLine(sourceContent, line)
    if (lineContent) {
      const gutterNum = String(line).padStart(4)
      const gutterSep = `${ANSI.dim}${BOX.v}${ANSI.reset}`
      console.log(`  ${ANSI.dim}${gutterNum}${ANSI.reset} ${gutterSep} ${lineContent}`)

      // Caret underline positioned under the offending value
      const valueLen = extractValueLength(message)
      const caretLine = buildCaret(lineContent, column, valueLen)
      console.log(`       ${gutterSep} ${caretLine}`)
    }
  }

  // Rule badge + message
  const cleanMsg = message.replace(/^[A-Z0-9]+-[A-Z0-9-]+:\s*/, '')
  console.log(`  ${color}${ANSI.bold}${ruleId}${ANSI.reset}  ${badge}  ${ANSI.dim}${cleanMsg}${ANSI.reset}`)

  // Why + Fix
  if (explanation) {
    console.log(`         ${ANSI.dim}Why:${ANSI.reset} ${explanation.title}`)
    const fixHint = explanation.recovery.split('.')[0]
    const tokenHint = nearestToken
      ? `  ${ANSI.dim}${SYMBOLS.arrow}${ANSI.reset} ${ANSI.green}${nearestToken}${ANSI.reset}`
      : ''
    console.log(`         ${ANSI.dim}Fix:${ANSI.reset} ${fixHint}${tokenHint}`)
  } else if (nearestToken) {
    console.log(`         ${ANSI.dim}Fix:${ANSI.reset} Use token ${ANSI.green}${nearestToken}${ANSI.reset}`)
  }

  console.log()
}

// ── File header ──────────────────────────────────────────────────────────────

/**
 * Renders a per-file header line.
 * Clean files get a check inline; files with violations get a bold path on its own line.
 */
export function renderFileHeader(filePath: string, violationCount: number): void {
  if (violationCount === 0) {
    console.log(
      `  ${ANSI.green}${SYMBOLS.check}${ANSI.reset} ${ANSI.dim}${filePath}${ANSI.reset}  ${ANSI.green}clean${ANSI.reset}`
    )
  } else {
    console.log()
    console.log(`  ${ANSI.bold}${filePath}${ANSI.reset}`)
  }
}

// ── Version banner ────────────────────────────────────────────────────────────

/** Renders the Flint version banner (suppressed in CI). */
export function renderBanner(version: string): void {
  if (isCI) return
  console.log(
    `  ${ANSI.cyan}${ANSI.bold}${SYMBOLS.spark} Flint v${version}${ANSI.reset}` +
    `  ${ANSI.dim}design governance for code${ANSI.reset}`
  )
  console.log()
}

// ── Summary footer ───────────────────────────────────────────────────────────

/**
 * Renders the summary footer box:
 *
 *   ------
 *    3 files scanned  .  2 violations  .  1 auto-fixable
 *
 *    Health: 85/100 (B)  .  Fidelity: 90  .  A11y: 80
 *
 *    BLOCKED -- run `flint fix` to auto-remediate
 *   ------
 */
export function renderSummaryFooter(
  summary: AuditSummary,
  blocked: boolean,
  autoFixable: number,
): void {
  const score = calculateHealthScore(summary)
  const grade = formatGrade(score)
  const totalViolations = summary.totalMithrilWarnings + summary.totalA11yViolations

  const fidelityScore = summary.totalMithrilWarnings === 0
    ? 100
    : Math.max(0, Math.round(100 - (summary.totalMithrilWarnings / Math.max(1, summary.totalFiles)) * 50))
  const a11yScore = summary.totalA11yViolations === 0
    ? 100
    : Math.max(0, Math.round(100 - (summary.totalA11yViolations / Math.max(1, summary.totalFiles)) * 50))

  const divider = BOX.h.repeat(54)
  const violColor = totalViolations === 0 ? ANSI.green : ANSI.yellow
  const gradeColor = score >= 80 ? ANSI.green : score >= 60 ? ANSI.yellow : ANSI.red

  console.log()
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log(
    `   ${summary.totalFiles} files scanned  ${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `${violColor}${totalViolations} violation${totalViolations !== 1 ? 's' : ''}${ANSI.reset}  ` +
    `${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `${ANSI.cyan}${autoFixable} auto-fixable${ANSI.reset}`
  )
  console.log()
  console.log(
    `   Health: ${gradeColor}${ANSI.bold}${score}/100 (${grade})${ANSI.reset}  ` +
    `${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `Fidelity: ${fidelityScore}  ` +
    `${ANSI.dim}${SYMBOLS.dot}${ANSI.reset}  ` +
    `A11y: ${a11yScore}`
  )
  console.log()

  if (blocked) {
    console.log(
      `   ${ANSI.red}${ANSI.bold}BLOCKED${ANSI.reset}` +
      `  ${ANSI.dim}— run${ANSI.reset} ${ANSI.cyan}\`flint fix\`${ANSI.reset}` +
      ` ${ANSI.dim}to auto-remediate${ANSI.reset}`
    )
  } else {
    console.log(
      `   ${ANSI.green}${ANSI.bold}PASSED${ANSI.reset}` +
      `  ${ANSI.dim}— no governance violations${ANSI.reset}`
    )
  }
  console.log(`  ${ANSI.dim}${divider}${ANSI.reset}`)
  console.log()
}
