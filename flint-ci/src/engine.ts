/**
 * Engine -- flint-ci/src/engine.ts
 *
 * Thin adapter that wraps the Flint MCP engine for headless CI use.
 * All governance logic lives in @flint-gov/mcp -- this module just
 * loads config, parses files, and calls the shared linters.
 *
 * Zero duplicated linter logic. Every audit call delegates to the
 * canonical MithrilLinter and A11yLinter in flint-mcp.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import type { File as BabelFile } from '@babel/types'

// Import from the MCP engine (sibling package, relative path)
import { loadConfig, loadProjectConfig } from '../../flint-mcp/src/core/config-loader.js'
import { DEFAULT_POLICY } from '../../flint-mcp/src/core/config.js'
import type {
    FlintConfig,
    FlintPolicy,
    FlintProjectConfig,
    PolicyMode,
} from '../../flint-mcp/src/core/config.js'
import { auditAll } from '../../flint-mcp/src/core/MithrilLinter.js'
import type { PolicyOptions } from '../../flint-mcp/src/core/MithrilLinter.js'
import { A11yLinter } from '../../flint-mcp/src/core/A11yLinter.js'
import type { DesignToken, LinterWarning } from '../../flint-mcp/src/types.js'
import {
    resolveEnforcement,
    getEnforcementAction,
} from '../../flint-mcp/src/core/governance/enforcementService.js'

// ── Re-exports for convenience ──────────────────────────────────────────────

export type { FlintConfig, FlintPolicy, FlintProjectConfig, DesignToken, LinterWarning, PolicyMode }
export { DEFAULT_POLICY }

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileAuditResult {
    filePath: string
    mithrilWarnings: LinterWarning[]
    a11yViolations: Record<string, string[]>
    parseError: string | null
}

export interface AuditSummary {
    totalFiles: number
    filesWithViolations: number
    totalMithrilWarnings: number
    totalA11yViolations: number
    criticalCount: number
    amberCount: number
    results: FileAuditResult[]
}

// ── SARIF types (subset of SARIF 2.1.0) ─────────────────────────────────────

export interface SarifReport {
    $schema: string
    version: string
    runs: SarifRun[]
}

export interface SarifRun {
    tool: {
        driver: {
            name: string
            version: string
            informationUri?: string
            rules?: SarifRule[]
        }
    }
    results: SarifResult[]
}

export interface SarifRule {
    id: string
    name?: string
    shortDescription?: { text: string }
    defaultConfiguration?: { level: string }
}

export interface SarifResult {
    ruleId: string
    level: 'error' | 'warning' | 'note' | 'none'
    message: { text: string }
    locations?: SarifLocation[]
}

export interface SarifLocation {
    physicalLocation: {
        artifactLocation: {
            uri: string
            uriBaseId?: string
        }
        region?: {
            startLine?: number
            startColumn?: number
            endLine?: number
            endColumn?: number
        }
    }
}

// ── Parse ────────────────────────────────────────────────────────────────────

/**
 * Parses a TypeScript/JSX source file into a Babel AST.
 * Returns null if the file cannot be parsed.
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

// ── Config loading ───────────────────────────────────────────────────────────

/**
 * Loads governance config from project root.
 * Resolution order: flint.config.yaml > .flint/policy.json > DEFAULT_POLICY.
 */
export function loadGovernanceConfig(projectRoot: string): {
    config: FlintConfig
    yamlConfig: FlintProjectConfig | null
} {
    const config = loadConfig(projectRoot)
    const yamlConfig = loadProjectConfig(projectRoot)
    return { config, yamlConfig }
}

// ── Token loading ────────────────────────────────────────────────────────────

/**
 * Loads design tokens from a JSON file path.
 * Tries the given path first, then falls back to .flint/design-tokens.json
 * relative to the current working directory.
 *
 * Returns an empty array if no tokens can be loaded (non-fatal).
 */
export function loadTokens(tokenPath: string): DesignToken[] {
    const tryPaths = [
        tokenPath,
        path.resolve(tokenPath),
    ]

    for (const p of tryPaths) {
        try {
            if (!fs.existsSync(p)) continue
            const raw = fs.readFileSync(p, 'utf-8')
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) return parsed
            if (typeof parsed === 'object' && parsed !== null) {
                return Object.values(parsed)
            }
        } catch {
            // Try next path
        }
    }

    return []
}

/**
 * Loads design tokens from the standard .flint/design-tokens.json location.
 */
export function loadTokensFromProject(projectRoot: string): DesignToken[] {
    return loadTokens(path.join(projectRoot, '.flint', 'design-tokens.json'))
}

// ── Policy to PolicyOptions bridge ───────────────────────────────────────────

/**
 * Maps a FlintPolicy to the PolicyOptions expected by auditAll.
 */
/** All Mithril rule IDs that accept per-rule policy modes via PolicyOptions.ruleModes. */
const ALL_MITHRIL_RULE_IDS = [
    'MITHRIL-COL',
    'MITHRIL-TYP-001',
    'MITHRIL-TYP-002',
    'MITHRIL-TYP-003',
    'MITHRIL-TYP-004',
    'MITHRIL-TYP-005',
    'MITHRIL-SPC-001',
    'MITHRIL-SHD-001',
    'MITHRIL-OPC-001',
    'MITHRIL-IST-COL',
    'MITHRIL-IST-TYP',
    'MITHRIL-IST-SPC',
    'MITHRIL-IST-SHD',
    'MITHRIL-IST-OPC',
    'MITHRIL-DTO-001',
    'SYNC-001',
    'SYNC-002',
] as const

function policyToOptions(policy: FlintPolicy): PolicyOptions {
    const ruleModes: Record<string, 'blocking' | 'advisory' | 'off'> = {}

    // Map policy mode to all rule IDs the MCP engine recognizes
    if (policy.mithril.mode === 'off' || policy.mithril.mode === 'advisory') {
        const mode = policy.mithril.mode === 'off' ? 'off' : 'advisory'
        for (const ruleId of ALL_MITHRIL_RULE_IDS) {
            ruleModes[ruleId] = mode
        }
    }

    return {
        deltaE_threshold: policy.mithril.deltaE_threshold,
        deltaE_critical_threshold: policy.mithril.deltaE_critical_threshold,
        ruleModes,
    }
}

// ── Single file audit ────────────────────────────────────────────────────────

/**
 * Audits a single source file for Mithril and A11y violations.
 *
 * @param filePath  Relative or absolute path (used for display).
 * @param code      Source code string.
 * @param tokens    Design tokens to check against.
 * @param policy    Governance policy.
 * @returns         FileAuditResult with violations found.
 */
export function auditFile(
    filePath: string,
    code: string,
    tokens: DesignToken[],
    policy: FlintPolicy,
): FileAuditResult {
    const result: FileAuditResult = {
        filePath,
        mithrilWarnings: [],
        a11yViolations: {},
        parseError: null,
    }

    // Parse the source
    const ast = parseSource(code)
    if (!ast) {
        result.parseError = `Failed to parse ${filePath}`
        return result
    }

    // Run Mithril linter (unless mode is 'off')
    if (policy.mithril.mode !== 'off') {
        try {
            const options = policyToOptions(policy)
            const warnings = auditAll(ast, tokens, options)
            result.mithrilWarnings = Array.from(warnings.values())
        } catch (err) {
            // Non-fatal: log but continue
            const msg = err instanceof Error ? err.message : String(err)
            result.parseError = `Mithril audit error on ${filePath}: ${msg}`
        }
    }

    // Run A11y linter (unless mode is 'off')
    if (policy.a11y.mode !== 'off') {
        try {
            const violations = A11yLinter.audit(ast)

            // Filter disabled rules
            if (policy.a11y.disabled_rules.length > 0) {
                const disabled = new Set(policy.a11y.disabled_rules)
                for (const [elemId, messages] of Object.entries(violations)) {
                    const filtered = messages.filter((msg) => {
                        const ruleId = extractRuleId(msg)
                        return !disabled.has(ruleId)
                    })
                    if (filtered.length > 0) {
                        result.a11yViolations[elemId] = filtered
                    }
                }
            } else {
                result.a11yViolations = violations
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (!result.parseError) {
                result.parseError = `A11y audit error on ${filePath}: ${msg}`
            }
        }
    }

    return result
}

// ── Batch file audit ─────────────────────────────────────────────────────────

/**
 * Audits multiple files and returns an aggregated summary.
 *
 * @param files   Array of { path, content } objects.
 * @param tokens  Design tokens to check against.
 * @param policy  Governance policy.
 * @returns       AuditSummary with per-file results and aggregate counts.
 */
export function auditFiles(
    files: Array<{ path: string; content: string }>,
    tokens: DesignToken[],
    policy: FlintPolicy,
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

        const mCount = result.mithrilWarnings.length
        const aCount = Object.values(result.a11yViolations).reduce(
            (sum, msgs) => sum + msgs.length,
            0,
        )

        if (mCount > 0 || aCount > 0 || result.parseError) {
            filesWithViolations++
        }

        totalMithrilWarnings += mCount
        totalA11yViolations += aCount

        // Count by severity
        for (const w of result.mithrilWarnings) {
            if (w.severity === 'critical') {
                criticalCount++
            } else {
                amberCount++
            }
        }

        // All A11y violations are critical (Commandment 5)
        criticalCount += aCount
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

// ── Enforcement check ────────────────────────────────────────────────────────

/**
 * Determines whether the CI gate should block based on audit results
 * and enforcement policy configuration.
 *
 * Uses the enforcement service from flint-mcp to check the 'ci_gate'
 * decision point. Falls back to legacy policy if no YAML config exists.
 *
 * @param summary       Audit summary from auditFiles.
 * @param projectRoot   Project root for loading config.
 * @param failOnWarning If true, amber-level violations also block.
 * @returns             true if the build should be blocked.
 */
export function shouldBlock(
    summary: AuditSummary,
    projectRoot: string,
    failOnWarning = false,
): boolean {
    // If no violations at all, never block
    if (summary.criticalCount === 0 && summary.amberCount === 0) {
        return false
    }

    // Try YAML enforcement config first
    try {
        const yamlConfig = loadProjectConfig(projectRoot)
        if (yamlConfig) {
            const enforcement = resolveEnforcement(yamlConfig)

            // Check if any violation mode triggers a 'block' action at the ci_gate point
            // Critical violations map to 'coercive' mode
            if (summary.criticalCount > 0) {
                const action = getEnforcementAction(enforcement, 'ci_gate', 'coercive')
                if (action === 'block') return true
            }

            // Amber violations map to 'normative' mode
            if (summary.amberCount > 0) {
                const action = getEnforcementAction(enforcement, 'ci_gate', 'normative')
                if (action === 'block') return true
            }

            // If failOnWarning is set, also check advisory mode
            if (failOnWarning && (summary.amberCount > 0)) {
                return true
            }

            return false
        }
    } catch {
        // Fall through to legacy logic
    }

    // Legacy policy logic: block on critical violations
    if (summary.criticalCount > 0) return true

    // Block on amber if --fail-on-warning is set
    if (failOnWarning && summary.amberCount > 0) return true

    return false
}

// ── SARIF generation ─────────────────────────────────────────────────────────

/** Known SARIF rule definitions for Flint governance rules. */
const SARIF_RULE_DEFINITIONS: Record<string, SarifRule> = {
    'MITHRIL-COL': {
        id: 'MITHRIL-COL',
        name: 'ColorDrift',
        shortDescription: { text: 'Arbitrary color value drifts from design token (CIEDE2000 deltaE > 2.0)' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-001': {
        id: 'MITHRIL-TYP-001',
        name: 'FontFamilyDrift',
        shortDescription: { text: 'Arbitrary font-family not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-002': {
        id: 'MITHRIL-TYP-002',
        name: 'FontSizeDrift',
        shortDescription: { text: 'Arbitrary font-size not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-003': {
        id: 'MITHRIL-TYP-003',
        name: 'FontWeightDrift',
        shortDescription: { text: 'Arbitrary font-weight not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-004': {
        id: 'MITHRIL-TYP-004',
        name: 'LineHeightDrift',
        shortDescription: { text: 'Arbitrary line-height not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-005': {
        id: 'MITHRIL-TYP-005',
        name: 'LetterSpacingDrift',
        shortDescription: { text: 'Arbitrary letter-spacing not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-SPC-001': {
        id: 'MITHRIL-SPC-001',
        name: 'SpacingDrift',
        shortDescription: { text: 'Arbitrary spacing/sizing value not in dimension token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-SHD-001': {
        id: 'MITHRIL-SHD-001',
        name: 'ShadowDrift',
        shortDescription: { text: 'Arbitrary box-shadow not in shadow token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-OPC-001': {
        id: 'MITHRIL-OPC-001',
        name: 'OpacityDrift',
        shortDescription: { text: 'Arbitrary opacity not in opacity token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-IST-COL': {
        id: 'MITHRIL-IST-COL',
        name: 'InlineColorDrift',
        shortDescription: { text: 'Inline style color drifts from design token (CIEDE2000)' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-IST-TYP': {
        id: 'MITHRIL-IST-TYP',
        name: 'InlineTypographyDrift',
        shortDescription: { text: 'Inline style typography value not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-IST-SPC': {
        id: 'MITHRIL-IST-SPC',
        name: 'InlineSpacingDrift',
        shortDescription: { text: 'Inline style spacing value not in dimension token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-IST-SHD': {
        id: 'MITHRIL-IST-SHD',
        name: 'InlineShadowDrift',
        shortDescription: { text: 'Inline style shadow not in shadow token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-IST-OPC': {
        id: 'MITHRIL-IST-OPC',
        name: 'InlineOpacityDrift',
        shortDescription: { text: 'Inline style opacity not in opacity token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-DTO-001': {
        id: 'MITHRIL-DTO-001',
        name: 'DesignTokenOrphan',
        shortDescription: { text: 'Token class references a token not in the design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'FLINT-PARSE': {
        id: 'FLINT-PARSE',
        name: 'ParseError',
        shortDescription: { text: 'Source file could not be parsed by Babel' },
        defaultConfiguration: { level: 'error' },
    },
}

/**
 * Extracts a rule ID from a violation message string.
 * Matches patterns like "MITHRIL-COL:", "MITHRIL-TYP-001:", "A11Y-001:".
 */
export function extractRuleId(message: string): string {
    const match = /^((?:MITHRIL-[A-Z]+(?:-[A-Z0-9]+)*|A11Y-\d+|SYNC-\d+))/.exec(message)
    return match?.[1] ?? 'UNKNOWN'
}

/**
 * Normalizes a file path to a relative URI suitable for SARIF output.
 * Strips leading ./ and converts backslashes to forward slashes.
 */
function normalizeSarifUri(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * Builds a SARIF 2.1.0 report from an AuditSummary.
 * Each violation becomes a SARIF result with file location, rule ID,
 * severity level, and human-readable message.
 */
export function buildSarifReport(summary: AuditSummary): SarifReport {
    const results: SarifResult[] = []
    const usedRuleIds = new Set<string>()

    for (const fileResult of summary.results) {
        // Mithril warnings
        for (const warning of fileResult.mithrilWarnings) {
            const ruleId = extractRuleId(warning.message)
            usedRuleIds.add(ruleId)

            const location: SarifLocation = {
                physicalLocation: {
                    artifactLocation: {
                        uri: normalizeSarifUri(fileResult.filePath),
                        uriBaseId: '%SRCROOT%',
                    },
                },
            }

            // Add line/column info if available
            if (warning.line != null) {
                location.physicalLocation.region = {
                    startLine: warning.line,
                    startColumn: warning.column != null ? warning.column + 1 : undefined,
                }
            }

            results.push({
                ruleId,
                level: warning.severity === 'critical' ? 'error' : 'warning',
                message: { text: warning.message },
                locations: [location],
            })
        }

        // A11y violations
        for (const [elementId, messages] of Object.entries(fileResult.a11yViolations)) {
            for (const message of messages) {
                const ruleId = extractRuleId(message)
                usedRuleIds.add(ruleId)

                results.push({
                    ruleId,
                    level: 'error',
                    message: { text: `[${elementId}] ${message}` },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: {
                                    uri: normalizeSarifUri(fileResult.filePath),
                                    uriBaseId: '%SRCROOT%',
                                },
                            },
                        },
                    ],
                })
            }
        }

        // Parse errors
        if (fileResult.parseError) {
            usedRuleIds.add('FLINT-PARSE')
            results.push({
                ruleId: 'FLINT-PARSE',
                level: 'error',
                message: { text: fileResult.parseError },
                locations: [
                    {
                        physicalLocation: {
                            artifactLocation: {
                                uri: normalizeSarifUri(fileResult.filePath),
                                uriBaseId: '%SRCROOT%',
                            },
                        },
                    },
                ],
            })
        }
    }

    // Collect rules used in this run
    const rules: SarifRule[] = []
    for (const ruleId of usedRuleIds) {
        if (SARIF_RULE_DEFINITIONS[ruleId]) {
            rules.push(SARIF_RULE_DEFINITIONS[ruleId])
        } else {
            // Dynamic rule (A11Y-NNN or unknown)
            rules.push({
                id: ruleId,
                name: ruleId,
                shortDescription: { text: `Flint governance rule ${ruleId}` },
                defaultConfiguration: {
                    level: ruleId.startsWith('A11Y') ? 'error' : 'warning',
                },
            })
        }
    }

    return {
        $schema:
            'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'Flint Governance',
                        version: '2.0.0',
                        informationUri: 'https://flint.dev',
                        rules,
                    },
                },
                results,
            },
        ],
    }
}
