/**
 * Audit Engine -- bridge-ci/src/audit-engine.ts
 *
 * Core orchestrator that parses source files and runs both Mithril and A11y
 * linters. Produces FileAuditResult and AuditSummary for the CI gate and CLI.
 *
 * This module contains no GitHub Actions dependencies -- it can be used
 * by both the Action entry point (index.ts) and the CLI (cli-gate.ts).
 *
 * Commandment 13: Deterministic surgery -- Babel AST traversal only.
 */

import { parse } from '@babel/parser'
import type { File as BabelFile } from '@babel/types'
import { auditAll } from './mithril-linter.js'
import { A11yLinter } from './a11y-linter.js'
import { buildSarifReport } from './sarif-builder.js'
import type {
    DesignToken,
    BridgePolicy,
    FileAuditResult,
    AuditSummary,
    SarifReport,
} from './types.js'
import { DEFAULT_POLICY } from './types.js'

// -- Parser --------------------------------------------------------------------

/**
 * Parses a TypeScript/JSX source string into a Babel File AST.
 * Returns null on parse failure.
 */
export function parseSource(code: string): BabelFile | null {
    try {
        return parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators-legacy'],
        })
    } catch {
        return null
    }
}

// -- Single-File Audit ---------------------------------------------------------

/**
 * Audits a single source file against all Mithril and A11y rules.
 *
 * @param filePath - Relative or absolute path (used for reporting only)
 * @param code     - Raw source code content
 * @param tokens   - Design token set to check against
 * @param policy   - Governance policy (thresholds, disabled rules, etc.)
 * @returns FileAuditResult with all violations found
 */
export function auditFile(
    filePath: string,
    code: string,
    tokens: DesignToken[],
    policy: BridgePolicy = DEFAULT_POLICY,
): FileAuditResult {
    const ast = parseSource(code)
    if (ast === null) {
        return {
            filePath,
            mithrilWarnings: [],
            a11yViolations: {},
            parseError: `Failed to parse ${filePath}`,
        }
    }

    // -- Mithril audit --
    let mithrilWarnings = Array.from(auditAll(ast, tokens).values())

    // Apply policy: filter by mode
    if (policy.mithril.mode === 'off') {
        mithrilWarnings = []
    }

    // Apply policy: filter by ignore_patterns
    if (policy.mithril.ignore_patterns.length > 0) {
        const patterns = policy.mithril.ignore_patterns.map(p => new RegExp(p))
        if (patterns.some(re => re.test(filePath))) {
            mithrilWarnings = []
        }
    }

    // -- A11y audit --
    let a11yViolations = A11yLinter.audit(ast)

    // Apply policy: filter by mode
    if (policy.a11y.mode === 'off') {
        a11yViolations = {}
    }

    // Apply policy: filter by disabled rules
    if (policy.a11y.disabled_rules.length > 0) {
        for (const key of Object.keys(a11yViolations)) {
            a11yViolations[key] = a11yViolations[key].filter(msg => {
                const ruleMatch = /^(A11Y-\d{3})/.exec(msg)
                if (!ruleMatch) return true
                return !policy.a11y.disabled_rules.includes(ruleMatch[1])
            })
            if (a11yViolations[key].length === 0) {
                delete a11yViolations[key]
            }
        }
    }

    return {
        filePath,
        mithrilWarnings,
        a11yViolations,
        parseError: null,
    }
}

// -- Multi-File Audit ----------------------------------------------------------

/**
 * Audits multiple files and produces an aggregate summary.
 *
 * @param files  - Array of { path, content } pairs
 * @param tokens - Design token set
 * @param policy - Governance policy
 * @returns AuditSummary with per-file results and aggregate counts
 */
export function auditFiles(
    files: Array<{ path: string; content: string }>,
    tokens: DesignToken[],
    policy: BridgePolicy = DEFAULT_POLICY,
): AuditSummary {
    const results: FileAuditResult[] = []
    let totalMithrilWarnings = 0
    let totalA11yViolations = 0
    let criticalCount = 0
    let amberCount = 0
    let filesWithViolations = 0

    for (const file of files) {
        const result = auditFile(file.path, file.content, tokens, policy)
        results.push(result)

        const mithrilCount = result.mithrilWarnings.length
        const a11yCount = Object.values(result.a11yViolations).reduce(
            (sum, arr) => sum + arr.length, 0
        )

        totalMithrilWarnings += mithrilCount
        totalA11yViolations += a11yCount

        for (const w of result.mithrilWarnings) {
            if (w.severity === 'critical') criticalCount++
            else amberCount++
        }

        // All a11y violations are considered critical (Commandment 5)
        criticalCount += a11yCount

        if (mithrilCount > 0 || a11yCount > 0 || result.parseError) {
            filesWithViolations++
        }
    }

    return {
        totalFiles: files.length,
        filesWithViolations,
        totalMithrilWarnings,
        totalA11yViolations,
        criticalCount,
        amberCount,
        results,
    }
}

// -- Blocking Decision ---------------------------------------------------------

/**
 * Determines whether the audit should cause a CI failure.
 *
 * @param summary        - The audit summary
 * @param policy         - Active governance policy
 * @param failOnWarning  - If true, amber-level violations also cause failure
 * @returns true if the build should be marked as failed
 */
export function shouldFail(
    summary: AuditSummary,
    policy: BridgePolicy,
    failOnWarning: boolean,
): boolean {
    // A11y violations always block if mode is 'blocking'
    if (policy.a11y.mode === 'blocking' && summary.totalA11yViolations > 0) {
        return true
    }

    // Mithril critical violations block if mode is 'blocking'
    if (policy.mithril.mode === 'blocking' && summary.criticalCount > 0) {
        return true
    }

    // If fail_on_warning is set, amber violations also block
    if (failOnWarning && summary.amberCount > 0) {
        return true
    }

    return false
}

// -- SARIF Generation (re-export for convenience) ------------------------------

export function generateSarif(summary: AuditSummary): SarifReport {
    return buildSarifReport(summary)
}
