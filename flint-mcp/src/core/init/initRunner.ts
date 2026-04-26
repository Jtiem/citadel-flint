/**
 * initRunner — flint-mcp/src/core/init/initRunner.ts
 *
 * Orchestrates the Flint zero-config init flow. Wires together:
 *   1. Stack detection   — detectStack()
 *   2. Token extraction  — extractTokens()
 *   3. Component indexer — indexComponents()
 *   4. MCP config writer — writeMcpConfig()
 *   5. First governance audit — MithrilLinter.auditAll() + A11yLinter.auditStructured()
 *
 * This module runs in the MCP server process (Node.js). It MUST NOT be
 * imported anywhere inside src/ (process boundary law).
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import { auditAll } from '../MithrilLinter.js'
import { A11yLinter } from '../A11yLinter.js'
import { DEFAULT_POLICY } from '../config.js'
import type { StackDetectionResult, TokenExtractionResult, DesignToken } from './types.js'

// ── Collaborator imports (provided by other init-phase agents) ─────────────
// These modules are guaranteed to exist before initRunner is called in
// production. Tests mock them via vi.mock().

import { detectStack } from './stackDetector.js'
import { extractTokens } from './tokenExtractor.js'
import { indexComponents } from './componentIndexer.js'
import { writeMcpConfig } from './mcpConfigWriter.js'

// ── Public types ──────────────────────────────────────────────────────────────

export interface InitOptions {
    /** Absolute path to the project root directory. */
    projectRoot: string
    /** Optional path to the source directory for component indexing. */
    srcDir?: string
    /** Force token re-extraction even if .flint/design-tokens.json exists. */
    forceTokens?: boolean
    /** Suppress all console.log output. */
    quiet?: boolean
}

/**
 * Mirrors the actual return shape of componentIndexer.indexComponents().
 * `components` is a Record<name, ComponentEntry> keyed by component name.
 * `filePaths` contains paths relative to projectRoot.
 */
export interface ComponentIndexResult {
    /** Number of unique component names indexed. */
    count: number
    /** Component entries keyed by component name. */
    components: Record<string, unknown>
    /** Paths to scanned files, relative to projectRoot. */
    filePaths: string[]
    /** Total .tsx/.jsx files scanned (may be > count). */
    totalFiles: number
    /** Non-fatal warnings from the indexer. */
    warnings: string[]
}

export interface InitResult {
    stack: StackDetectionResult
    tokensExtracted: number
    tokenSource: string
    componentsIndexed: number
    mcpConfigured: boolean
    healthScore: number | null
    grade: string | null
    violations: { critical: number; warning: number; advisory: number }
    topViolations: Array<{ rule: string; count: number }>
    warnings: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extracts the rule ID from a violation message string.
 * Mirrors the logic in debtReportService.ts.
 */
function extractRuleId(message: string): string {
    const match = /^((?:MITHRIL-[A-Z]+-?\d*|A11Y-\d+))/.exec(message)
    return match?.[1] ?? 'UNKNOWN'
}

/**
 * Init-time health heuristic — DELIBERATELY DIVERGENT from the canonical
 * project health score in `shared/healthScore.ts::computeHealthScore`.
 *
 * Formula: clamp(100 - critical*10 - warning*1 - advisory*0.5, 0, 100)
 *
 * Why it diverges from the canonical formula (carve-out, COUNSEL.1 contract §13):
 *   - This runs ONCE during `flint init` against a freshly-onboarded project
 *     that has not yet been touched by Flint. The canonical weights
 *     (amber×3, advisory×1, override×3) would deterministically push every
 *     real-world project to "F" on first contact and turn the Forge welcome
 *     experience into a wall of red. The init spec explicitly chose softer
 *     weights so the first audit can produce an informative score without
 *     punishing the user for pre-Flint code.
 *   - It does NOT feed any persisted surface (dashboard, DBOM, debt report,
 *     CI gate) — those all read from the canonical formula. The init score is
 *     printed to stdout and returned in `InitResult.healthScore` for the
 *     welcome banner only.
 *   - The parameter name `warning` (vs. canonical `amber`) is preserved
 *     because the canonical "amber" bucket and this heuristic's "warning"
 *     bucket are not the same thing semantically (canonical = severity
 *     bucket; init = "any non-critical Mithril result").
 *
 * If you are looking for the project health score, you almost certainly want
 * `computeHealthScore` from `shared/healthScore.ts`, not this function.
 */
export function computeInitHeuristic(
    critical: number,
    warning: number,
    advisory: number,
): number {
    const raw = 100 - (critical * 10) - (warning * 1) - (advisory * 0.5)
    return Math.max(0, Math.min(100, Math.round(raw)))
}

/**
 * @deprecated Renamed to `computeInitHeuristic` to make non-equivalence with
 * the canonical project health score explicit. This alias preserves the old
 * symbol for one release. New callers must use `computeInitHeuristic` and
 * understand it is an init-time onboarding heuristic, not a project score.
 */
export const computeInitHealthScore = computeInitHeuristic

/**
 * Maps a health score (0-100) to a letter grade.
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

/**
 * Scans a single source file for Mithril + A11y violations.
 * Returns a map from rule ID to occurrence count.
 */
function scanFileViolations(
    source: string,
    tokens: DesignToken[],
): { ruleId: string; isCritical: boolean; isAdvisory: boolean }[] {
    const results: { ruleId: string; isCritical: boolean; isAdvisory: boolean }[] = []

    let ast
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch {
        return results
    }

    // Mithril violations
    const mithrilWarnings = auditAll(ast as any, tokens)
    for (const warning of mithrilWarnings.values()) {
        results.push({
            ruleId: extractRuleId(warning.message),
            isCritical: warning.severity === 'critical',
            isAdvisory: warning.severity === 'advisory',
        })
    }

    // A11y violations — always critical (Commandment 5)
    const a11yResult = A11yLinter.auditStructured(ast as any)
    for (const v of a11yResult.violations) {
        results.push({
            ruleId: v.ruleId,
            isCritical: true,
            isAdvisory: false,
        })
    }

    return results
}

// ── Stack description helper ──────────────────────────────────────────────────

function describeStack(stack: StackDetectionResult): string {
    const parts: string[] = []

    if (stack.uiFramework !== 'unknown') {
        const uiLabel = stack.uiFramework.charAt(0).toUpperCase() + stack.uiFramework.slice(1)
        parts.push(uiLabel)
    }

    if (stack.typescript) {
        parts.push('TypeScript')
    }

    switch (stack.framework) {
        case 'tailwind-v3':
            parts.push('Tailwind CSS 3')
            break
        case 'tailwind-v4':
            parts.push('Tailwind CSS 4')
            break
        case 'css-custom-props':
            parts.push('CSS Custom Properties')
            break
        case 'dtcg':
            parts.push('DTCG Tokens')
            break
        case 'tokens-studio':
            parts.push('Tokens Studio')
            break
        case 'chakra':
            parts.push('Chakra UI')
            break
        case 'mui':
            parts.push('MUI')
            break
        case 'radix':
            parts.push('Radix UI')
            break
        case 'none':
        default:
            break
    }

    return parts.length > 0 ? parts.join(' + ') : 'Unknown'
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Runs the Flint zero-config init flow against a project directory.
 */
export async function runInit(options: InitOptions): Promise<InitResult> {
    const { projectRoot, srcDir, forceTokens = false, quiet = false } = options
    const log = quiet ? () => undefined : (msg: string) => console.log(msg)

    const warnings: string[] = []

    // ── 1. Header ──────────────────────────────────────────────────────────────
    log('Flint — Zero-Config Init')
    log('\u2500'.repeat(25))

    // ── 2. Stack detection ─────────────────────────────────────────────────────
    log('Scanning project...')
    const stack = await detectStack(projectRoot)
    const stackLabel = describeStack(stack)
    log(`  Stack: ${stackLabel}`)

    // ── 3. Token extraction ────────────────────────────────────────────────────
    const flintDir = path.join(projectRoot, '.flint')
    const tokensPath = path.join(flintDir, 'design-tokens.json')

    let tokensExtracted = 0
    let tokenSource = 'skipped'
    let extractedTokens: DesignToken[] = []

    const tokensExist =
        fs.existsSync(tokensPath) &&
        (() => {
            try {
                const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
                return Array.isArray(raw) && raw.length > 0
            } catch {
                return false
            }
        })()

    log('Extracting design tokens...')

    if (tokensExist && !forceTokens) {
        log('  Tokens already exist \u2014 skipping extraction')
        tokenSource = 'existing'
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            extractedTokens = Array.isArray(raw) ? raw : []
            tokensExtracted = extractedTokens.length
        } catch {
            extractedTokens = []
            tokensExtracted = 0
        }
    } else {
        let extractionResult: TokenExtractionResult
        try {
            extractionResult = await extractTokens(projectRoot, stack)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            warnings.push(`Token extraction failed: ${msg}`)
            extractionResult = { tokens: [], source: 'failed', warnings: [msg] }
        }

        extractedTokens = extractionResult.tokens
        tokensExtracted = extractedTokens.length
        tokenSource = extractionResult.source
        warnings.push(...extractionResult.warnings)

        // Ensure .flint/ directory exists
        if (!fs.existsSync(flintDir)) {
            fs.mkdirSync(flintDir, { recursive: true })
        }

        // Write tokens to disk
        if (extractedTokens.length > 0) {
            fs.writeFileSync(tokensPath, JSON.stringify(extractedTokens, null, 2), 'utf-8')
        }

        // Print category breakdown
        const byType = new Map<string, number>()
        for (const token of extractedTokens) {
            byType.set(token.token_type, (byType.get(token.token_type) ?? 0) + 1)
        }

        for (const [type, count] of byType.entries()) {
            const label = type.charAt(0).toUpperCase() + type.slice(1)
            log(`  ${label.padEnd(12)}${count} tokens from ${stack.configPath ?? tokenSource}`)
        }

        log(`  Total: ${tokensExtracted} tokens \u2192 .flint/design-tokens.json`)
    }

    // ── 4. Component indexing ──────────────────────────────────────────────────
    log('Indexing components...')
    let componentsIndexed = 0
    let componentData: ComponentIndexResult = { count: 0, components: {}, filePaths: [], totalFiles: 0, warnings: [] }

    try {
        componentData = await indexComponents(projectRoot, srcDir) as ComponentIndexResult
        componentsIndexed = componentData.count
        warnings.push(...(componentData.warnings ?? []))
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        warnings.push(`Component indexing failed: ${msg}`)
    }

    // Write flint-manifest.json in the project root.
    // Preserve the existing manifest shape (wrapper object with version, resolvers, components).
    const manifestPath = path.join(projectRoot, 'flint-manifest.json')
    let existingManifest: Record<string, unknown> = {}
    if (fs.existsSync(manifestPath)) {
        try {
            existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        } catch {
            existingManifest = {}
        }
    }

    // Determine manifest shape: if existing file has a top-level `components` key
    // or `resolvers` key (i.e., it's a wrapper object), preserve the shape.
    const hasWrapperShape =
        'components' in existingManifest ||
        'resolvers' in existingManifest ||
        'version' in existingManifest

    let manifestToWrite: unknown
    if (hasWrapperShape) {
        manifestToWrite = {
            ...existingManifest,
            components: componentData.components,
        }
    } else if (Array.isArray(existingManifest)) {
        // Flat array shape — write the components as an array of values
        manifestToWrite = Object.values(componentData.components)
    } else {
        // No existing manifest — use the wrapper shape (matches flint-manifest.json schema)
        manifestToWrite = {
            version: '2.0',
            resolvers: [],
            components: componentData.components,
        }
    }

    if (componentsIndexed > 0) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifestToWrite, null, 4), 'utf-8')
    }

    log(`  ${componentsIndexed} components \u2192 flint-manifest.json`)

    // ── 5. MCP config + policy ─────────────────────────────────────────────────
    const policyPath = path.join(flintDir, 'policy.json')
    if (!fs.existsSync(policyPath)) {
        if (!fs.existsSync(flintDir)) {
            fs.mkdirSync(flintDir, { recursive: true })
        }
        fs.writeFileSync(policyPath, JSON.stringify(DEFAULT_POLICY, null, 2), 'utf-8')
    }

    let mcpConfigured = false
    try {
        const configResult = writeMcpConfig(projectRoot)
        mcpConfigured = configResult.written
        log(`  MCP config \u2192 ${configResult.path}`)
        if (configResult.message) {
            log(`  ${configResult.message}`)
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        warnings.push(`MCP config write failed: ${msg}`)
    }

    // ── 6. First governance audit ──────────────────────────────────────────────
    let healthScore: number | null = null
    let grade: string | null = null
    const violationCounts = { critical: 0, warning: 0, advisory: 0 }
    const topViolations: Array<{ rule: string; count: number }> = []

    if (tokensExtracted > 0 && componentsIndexed > 0) {
        log('First governance audit...')
        log('\u2500'.repeat(41))

        const ruleCounts = new Map<string, number>()

        for (const relOrAbsPath of componentData.filePaths) {
            // filePaths from indexComponents may be relative or absolute.
            // Normalise to absolute before reading.
            const filePath = path.isAbsolute(relOrAbsPath)
                ? relOrAbsPath
                : path.join(projectRoot, relOrAbsPath)
            let source: string
            try {
                source = fs.readFileSync(filePath, 'utf-8')
            } catch {
                continue
            }

            const fileViolations = scanFileViolations(source, extractedTokens)
            for (const v of fileViolations) {
                if (v.isCritical) {
                    violationCounts.critical++
                } else if (v.isAdvisory) {
                    violationCounts.advisory++
                } else {
                    violationCounts.warning++
                }
                ruleCounts.set(v.ruleId, (ruleCounts.get(v.ruleId) ?? 0) + 1)
            }
        }

        healthScore = computeInitHeuristic(
            violationCounts.critical,
            violationCounts.warning,
            violationCounts.advisory,
        )
        grade = scoreToGrade(healthScore)

        // Top 3 rules by occurrence count
        const sortedRules = Array.from(ruleCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
        for (const [rule, count] of sortedRules) {
            topViolations.push({ rule, count })
        }

        log(`  Health Score:  ${healthScore} / 100   Grade: ${grade}`)
        log('')
        log(`  Critical:    ${violationCounts.critical}`)
        log(`  Warnings:   ${violationCounts.warning}`)
        log(`  Advisory:   ${violationCounts.advisory}`)

        if (topViolations.length > 0) {
            log('')
            log('  Top violations:')
            topViolations.forEach((v, i) => {
                log(`    ${i + 1}. ${v.rule.padEnd(12)} (${v.count} files)`)
            })
        }

        log('\u2500'.repeat(41))
    }

    // ── 7. Next steps ──────────────────────────────────────────────────────────
    log('')
    log('Say "audit" in Claude Code to inspect any component.')
    log('Say "fix it" to start auto-remediation.')

    return {
        stack,
        tokensExtracted,
        tokenSource,
        componentsIndexed,
        mcpConfigured,
        healthScore,
        grade,
        violations: violationCounts,
        topViolations,
        warnings,
    }
}
