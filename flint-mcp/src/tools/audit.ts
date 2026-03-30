/**
 * flint_audit tool handler — flint-mcp/src/tools/audit.ts
 *
 * Runs Mithril + A11y audits on source code.
 * Accepts a FlintConfig to respect policy thresholds.
 */

import { parse } from '@babel/parser'
import { auditAll, visitInlineStyles, buildTokenCoverage } from '../core/MithrilLinter.js'
import { A11yLinter } from '../core/A11yLinter.js'
import type { FlintConfig } from '../core/config.js'
import type { DesignToken, TokenCoverage, TokenType } from '../types.js'
import fs from 'node:fs'
import path from 'node:path'
import { loadProjectContext } from '../core/projectContext.js'
import type { ProjectContext } from '../core/projectContext.js'
import { getErrorEntryByRuleId } from '../core/errorTaxonomy.js'
import { resolveProvenance } from '../core/governance/ruleProvenanceRegistry.js'
import type { RuleProvenance } from '../core/governance/types.js'
import { BRAND, toolName, configPath, logTag } from '../brand.js'
import { loadProjectConfig } from '../core/config-loader.js'
import { getClassificationProfile } from '../core/governance/classificationService.js'
import {
    resolveEnforcement,
    getEnforcementAction,
} from '../core/governance/enforcementService.js'
import type { ResolvedEnforcement } from '../core/governance/enforcementService.js'

export type { ProjectContext }

export const FLINT_AUDIT_TOOL = {
    name: toolName('audit'),
    description:
        'Run a comprehensive Mithril + A11y audit on component source code. ' +
        'Returns structured violations with ruleIds, severity, and fix suggestions. ' +
        'Supports batch mode via filePaths for auditing multiple files at once.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            source: {
                type: 'string',
                description: 'Raw TSX/JSX source code to audit.',
            },
            filePath: {
                type: 'string',
                description: 'File path for context (used in reporting).',
            },
            filePaths: {
                type: 'array',
                items: { type: 'string' },
                description:
                    'Audit multiple files at once. Returns aggregated results with per-file breakdown.',
            },
            ruleIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: only check specific rule IDs.',
            },
            severity: {
                type: 'string',
                enum: ['info', 'warning', 'critical'],
                description: 'Optional: minimum severity threshold.',
            },
            healOnAudit: {
                type: 'boolean',
                description:
                    'When true, applies tier-1 token healing to exact-match violations before auditing. ' +
                    'Note: heal pass requires the Glass IPC pipeline (Electron main process). ' +
                    'In headless MCP mode this flag is acknowledged but the heal pass is skipped.',
            },
        },
        required: ['source', 'filePath'],
    },
} as const

export interface AuditArgs {
    source: string
    filePath: string
    filePaths?: string[]
    ruleIds?: string[]
    severity?: 'info' | 'warning' | 'critical'
    healOnAudit?: boolean
}

export interface HealOnAuditStatus {
    skipped: true
    reason: string
}

export interface AuditResult {
    violations: Array<{
        id: string
        ruleId: string
        severity: string
        message: string
        type: string
        /** Phase 3: Source line number (1-based) where the violation occurs. */
        line?: number
        /** Plain-language explanation of why this rule exists. Populated by CX.3 errorTaxonomy. */
        explanation?: string
        /** Actionable recovery steps. Populated by CX.3 errorTaxonomy. */
        recovery?: string
        /** GOV.1: Rule provenance metadata — sourceAuthority, regulatoryReference, rationale. */
        provenance?: RuleProvenance
        /**
         * Gap 7 — PEP enforcement action at the export_gate point.
         * 'block'    — this violation blocks export
         * 'warn'     — violation is reported but does not block export
         * 'auto_fix' — violation is eligible for automatic remediation
         * 'pass'     — violation is inactive (rule mode is 'off')
         */
        enforcementAction?: 'block' | 'warn' | 'auto_fix' | 'pass'
    }>
    mithrilCount: number
    a11yCount: number
    policyMode: {
        mithril: string
        a11y: string
    }
    /** Present only when the caller passed healOnAudit: true. */
    healOnAudit?: HealOnAuditStatus
    /** One-sentence human-readable summary of audit findings. CX.1 */
    summary: string
    /** Project-level health context. Omitted when unavailable. CX.1 */
    project_context?: ProjectContext
    /** Phase 1: Token coverage stats — distinguishes checked+passed from unchecked. */
    coverage?: TokenCoverage
    /**
     * Gap 7 — Resolved enforcement configuration used for this audit.
     * Tells callers how violations are classified at each enforcement point.
     */
    enforcement?: ResolvedEnforcement
    /**
     * Gap 7 — Whether the export gate would block based on enforcement config.
     * True when any violation has enforcementAction === 'block' at the export_gate point.
     */
    exportBlocked?: boolean
    /** CLARITY: One-line actionable recommendation for the user */
    recommendation?: string
}

export interface BatchFileResult {
    filePath: string
    violations: AuditResult['violations']
    a11y: AuditResult['violations']
    mithrilCount: number
    a11yCount: number
    error?: string
}

export interface BatchAuditResult {
    summary: {
        totalFiles: number
        totalViolations: number
        healthScore: number
        grade: string
        /** One-sentence human-readable summary. CX.1 */
        text: string
    }
    files: BatchFileResult[]
    policyMode: {
        mithril: string
        a11y: string
    }
    /** Project-level health context. Omitted when unavailable. CX.1 */
    project_context?: ProjectContext
}

// ── CX.1 Summary generation ────────────────────────────────────────────────

/**
 * Generate a one-sentence plain-English summary of single-file audit findings.
 * When coverage is provided, appends a token coverage line.
 */
export function generateAuditSummary(
    filePath: string,
    violations: AuditResult['violations'],
    mithrilCount: number,
    a11yCount: number,
    coverage?: TokenCoverage,
): string {
    const basename = path.basename(filePath)
    const total = violations.length

    let base: string
    if (total === 0) {
        base = `No violations found in ${basename}. This file is export-ready.`
    } else {
        // fixable = Mithril violations (flint_fix can auto-fix them; a11y requires manual fix)
        const fixable = mithrilCount

        if (a11yCount === 0) {
            base = `Found ${total} violation(s) in ${basename} -- ${fixable} auto-fixable.`
        } else {
            base = (
                `Found ${total} violation(s) in ${basename} -- ` +
                `${mithrilCount} design drift, ${a11yCount} accessibility. ` +
                `${fixable} auto-fixable.`
            )
        }
    }

    if (coverage === undefined) return base

    // Phase 1: append token coverage transparency lines
    const lines: string[] = [base]

    if (coverage.colorTokens === 0) {
        lines.push('Colors: unchecked (no color tokens)')
    } else {
        const colorViolations = violations.filter((v) =>
            v.type === 'color-drift' || (v.type === 'inline-style-drift' && v.ruleId === 'MITHRIL-IST-COL'),
        ).length
        if (colorViolations === 0) {
            lines.push(`Colors: passing (${coverage.colorTokens} tokens)`)
        } else {
            lines.push(`Colors: ${colorViolations} violation(s) (${coverage.colorTokens} tokens loaded)`)
        }
    }

    if (coverage.dimensionTokens === 0) {
        lines.push('Dimensions: unchecked (no dimension tokens)')
    } else {
        const dimViolations = violations.filter((v) => v.type === 'spacing-drift').length
        if (dimViolations === 0) {
            lines.push(`Dimensions: passing (${coverage.dimensionTokens} tokens)`)
        } else {
            lines.push(`Dimensions: ${dimViolations} violation(s) (${coverage.dimensionTokens} tokens loaded)`)
        }
    }

    if (coverage.shadowTokens === 0) {
        lines.push('Shadows: unchecked (no shadow tokens)')
    } else {
        const shdViolations = violations.filter((v) => v.type === 'shadow-drift').length
        if (shdViolations === 0) {
            lines.push(`Shadows: passing (${coverage.shadowTokens} tokens)`)
        } else {
            lines.push(`Shadows: ${shdViolations} violation(s) (${coverage.shadowTokens} tokens loaded)`)
        }
    }

    lines.push(
        `Inline styles: ${coverage.inlinePropsScanned} props scanned, ` +
        `${coverage.inlinePropsSkipped} skipped (dynamic refs)`,
    )

    return lines.join(' | ')
}

/**
 * Generate a one-sentence plain-English summary of a batch audit result.
 */
export function generateBatchAuditSummary(
    totalFiles: number,
    totalViolations: number,
    healthScore: number,
    grade: string,
): string {
    return (
        `Audited ${totalFiles} files. ` +
        `${totalViolations} total violation(s). ` +
        `Health: ${healthScore}/100 (Grade ${grade}).`
    )
}

export async function handleFlintAudit(
    args: AuditArgs,
    config: FlintConfig,
): Promise<AuditResult> {
    const { source, filePath, healOnAudit } = args
    const policy = config.policy

    // ING.3 — healOnAudit: best-effort parameter, gracefully degraded in headless MCP mode.
    // The full heal pipeline (IngestionAuditor) requires the Electron main process (SQLite
    // token access + FileTransactionManager). When running headlessly we acknowledge the
    // parameter, emit a console notice, and continue with the standard audit.
    if (healOnAudit === true) {
        console.log(
            `${logTag()} healOnAudit: heal pass not available in headless MCP mode` +
            ' — run via Glass IPC for full pipeline',
        )
    }

    // Load tokens from project root
    const tokensPath = path.join(config.projectRoot, configPath('design-tokens.json'))
    let tokens: DesignToken[] = []
    if (fs.existsSync(tokensPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            if (Array.isArray(raw)) {
                tokens = raw
            } else {
                // DTCG nested format: walk the tree to extract flat DesignToken[]
                const dtcgTypeMap: Record<string, TokenType> = {
                    color: 'color', dimension: 'dimension', fontFamily: 'fontFamily',
                    'font-family': 'fontFamily', fontWeight: 'fontWeight',
                    'font-weight': 'fontWeight', lineHeight: 'lineHeight',
                    'line-height': 'lineHeight', letterSpacing: 'letterSpacing',
                    'letter-spacing': 'letterSpacing', shadow: 'shadow',
                    opacity: 'opacity', string: 'string', boolean: 'boolean',
                    number: 'dimension', spacing: 'dimension',
                    borderRadius: 'dimension', 'border-radius': 'dimension',
                    sizing: 'dimension', typography: 'string',
                }
                const walkDTCG = (obj: Record<string, unknown>, pathParts: string[]): void => {
                    if ('$value' in obj && '$type' in obj) {
                        const dtcgType = String(obj['$type'])
                        tokens.push({
                            id: tokens.length + 1,
                            token_path: pathParts.join('.'),
                            token_type: dtcgTypeMap[dtcgType] ?? 'dimension',
                            token_value: String(obj['$value']),
                            description: (obj['$description'] as string | null) ?? null,
                            collection_name: 'dtcg',
                            mode: 'default',
                        })
                        return
                    }
                    for (const [key, value] of Object.entries(obj)) {
                        if (key.startsWith('$')) continue
                        if (value && typeof value === 'object' && !Array.isArray(value)) {
                            walkDTCG(value as Record<string, unknown>, [...pathParts, key])
                        }
                    }
                }
                walkDTCG(raw as Record<string, unknown>, [])
            }
        } catch {
            // Use empty tokens
        }
    }

    // UCFG.7b: Adjust delta-E thresholds based on data classification.
    // A lower multiplier (e.g. restricted = 0.5) makes thresholds stricter by
    // shrinking the tolerance window — meaning more colour deviations trigger
    // violations. The default (internal, multiplier = 1.0) leaves thresholds
    // unchanged for projects that do not declare a classification.
    const yamlConfig = loadProjectConfig(config.projectRoot)
    const classProfile = getClassificationProfile(yamlConfig?.classification)
    const adjustedDeltaE = policy.mithril.deltaE_threshold * classProfile.deltaEMultiplier
    const adjustedDeltaECritical = policy.mithril.deltaE_critical_threshold * classProfile.deltaEMultiplier

    // Gap 7: Resolve PDP/PEP enforcement configuration.
    // Uses the enforcement section of flint.config.yaml when present.
    // Falls back to defaults that match pre-UCFG hardcoded behaviour exactly.
    const enforcement = resolveEnforcement(yamlConfig ?? undefined)

    // Derive the violation rule mode from the policy mode.
    // Mithril: 'blocking' → coercive, 'normative' → normative, 'advisory' → advisory
    // A11y: same mapping — both linters use PolicyMode which maps 1:1 to RuleMode.
    const policyModeToRuleMode = (mode: string): 'coercive' | 'normative' | 'advisory' | 'off' => {
        if (mode === 'blocking') return 'coercive'
        if (mode === 'normative') return 'normative'
        if (mode === 'advisory') return 'advisory'
        return 'off'
    }

    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })

    const violations: AuditResult['violations'] = []

    // Mithril audit (respects policy mode)
    let mithrilCount = 0
    // Phase 1: run visitInlineStyles separately to capture coverage stats
    const { coverage: inlineStats } = visitInlineStyles(
        ast as Parameters<typeof visitInlineStyles>[0],
        tokens,
        {
            deltaE_threshold: adjustedDeltaE,
            deltaE_critical_threshold: adjustedDeltaECritical,
        },
    )
    const coverage = buildTokenCoverage(tokens, inlineStats)

    // CR-SEAL: Load component registry for REG-001 audit.
    // Derive projectRoot from filePath when available (flint_audit receives source+filePath,
    // and config.projectRoot may be process.cwd() which differs from the actual project).
    let auditRegistry: Record<string, { importPath?: string; [key: string]: unknown }> | undefined
    let registryRoot = config.projectRoot
    if (filePath && path.isAbsolute(filePath)) {
        let cursor = path.dirname(filePath)
        while (cursor !== path.parse(cursor).root) {
            // Require manifest or design-tokens alongside .flint/ to skip nested telemetry dirs
            if (fs.existsSync(path.join(cursor, BRAND.configDir)) && (
                fs.existsSync(path.join(cursor, BRAND.manifestFile)) ||
                fs.existsSync(path.join(cursor, BRAND.configDir, 'design-tokens.json'))
            )) {
                registryRoot = cursor
                break
            }
            cursor = path.dirname(cursor)
        }
    }
    const manifestPath = path.join(registryRoot, BRAND.manifestFile)
    if (fs.existsSync(manifestPath)) {
        try {
            const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
            const components = manifestRaw.components ?? manifestRaw
            if (components && typeof components === 'object' && Object.keys(components).length > 0) {
                auditRegistry = components
            }
        } catch { /* manifest unreadable — skip registry audit */ }
    }

    if (policy.mithril.mode !== 'off') {
        const mithrilWarnings = auditAll(
            ast as Parameters<typeof auditAll>[0],
            tokens,
            {
                deltaE_threshold: adjustedDeltaE,
                deltaE_critical_threshold: adjustedDeltaECritical,
                ...(auditRegistry && { registry: auditRegistry }),
            },
        )
        mithrilCount = mithrilWarnings.size
        for (const [id, w] of mithrilWarnings) {
            const violation: AuditResult['violations'][number] = {
                id,
                ruleId: w.ruleId ?? 'MITHRIL-UNKNOWN',
                severity: w.severity,
                message: w.message,
                type: w.type,
            }
            // Phase 3: attach line number when available (format: file.tsx:42)
            if (w.line !== undefined) {
                violation.line = w.line
            }
            // CX.3: attach explanation/recovery from LinterWarning (populated by taxonomyFields) or taxonomy lookup
            const explanation = w.explanation ?? getErrorEntryByRuleId(w.ruleId ?? '')?.explanation
            const recovery = w.recovery ?? getErrorEntryByRuleId(w.ruleId ?? '')?.recovery
            if (explanation !== undefined) violation.explanation = explanation
            if (recovery !== undefined) violation.recovery = recovery
            // GOV.1: attach provenance metadata
            violation.provenance = resolveProvenance(w.ruleId ?? 'MITHRIL-UNKNOWN')
            // Gap 7: PEP enforcement action — what should happen at the export gate?
            violation.enforcementAction = getEnforcementAction(
                enforcement,
                'export_gate',
                policyModeToRuleMode(policy.mithril.mode),
            )
            violations.push(violation)
        }
    }

    // A11y audit (respects policy mode)
    let a11yCount = 0
    if (policy.a11y.mode !== 'off') {
        const a11yViolations = A11yLinter.audit(
            ast as Parameters<typeof A11yLinter.audit>[0],
        )
        for (const [id, messages] of Object.entries(a11yViolations)) {
            for (const msg of messages) {
                // Check if this rule is disabled
                const ruleIdMatch = msg.match(/^(A11Y-\d{3})/)
                const ruleId = ruleIdMatch?.[1] ?? 'A11Y-UNKNOWN'
                if (policy.a11y.disabled_rules.includes(ruleId)) continue

                a11yCount++
                const a11yViolation: AuditResult['violations'][number] = {
                    id,
                    ruleId,
                    severity: 'critical',
                    message: msg,
                    type: 'a11y',
                }
                // CX.3: attach explanation/recovery from error taxonomy
                const a11yEntry = getErrorEntryByRuleId(ruleId)
                if (a11yEntry !== null) {
                    a11yViolation.explanation = a11yEntry.explanation
                    a11yViolation.recovery = a11yEntry.recovery
                }
                // GOV.1: attach provenance metadata
                a11yViolation.provenance = resolveProvenance(ruleId)
                // Gap 7: PEP enforcement action — what should happen at the export gate?
                a11yViolation.enforcementAction = getEnforcementAction(
                    enforcement,
                    'export_gate',
                    policyModeToRuleMode(policy.a11y.mode),
                )
                violations.push(a11yViolation)
            }
        }
    }

    const summary = generateAuditSummary(filePath, violations, mithrilCount, a11yCount, coverage)

    // Gap 7: Derive exportBlocked from the resolved enforcement config.
    // A violation blocks export when its enforcementAction is 'block'.
    // This replaces the former hardcoded policy.export_gate.block_on_mithril check.
    const exportBlocked = violations.some((v) => v.enforcementAction === 'block')

    const result: AuditResult = {
        violations,
        mithrilCount,
        a11yCount,
        policyMode: {
            mithril: policy.mithril.mode,
            a11y: policy.a11y.mode,
        },
        summary,
        coverage,
        enforcement,
        exportBlocked,
    }

    // CX.1: Attach project_context footer (best-effort, never blocks audit)
    try {
        const projectCtx = loadProjectContext(config.projectRoot)
        if (projectCtx !== null) {
            result.project_context = projectCtx
        }
    } catch {
        // project_context is best-effort — never block audit result
    }

    if (healOnAudit === true) {
        result.healOnAudit = {
            skipped: true,
            reason: 'heal pass requires Glass IPC pipeline',
        }
    }

    // CLARITY: Generate recommendation based on audit findings
    const totalIssueCount = mithrilCount + a11yCount
    if (totalIssueCount > 0) {
        const fixableCount = violations.filter(v =>
            v.enforcementAction === 'auto_fix' || v.recovery !== undefined
        ).length
        const fixNote = fixableCount > 0 ? ` (${fixableCount} auto-fixable)` : ''
        result.recommendation = `${totalIssueCount} issue${totalIssueCount !== 1 ? 's' : ''} found${fixNote}. Say 'fix it' to auto-remediate.`
    } else {
        result.recommendation = 'Clean audit — this component is fully compliant.'
    }

    return result
}

/**
 * Compute a letter grade from a 0-100 health score.
 * A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: <60
 */
function gradeFromScore(score: number): string {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

/**
 * Health score: starts at 100, deducts per violation.
 * Critical violations cost 10 points each, amber/warning 3 points each,
 * capped at a minimum of 0.
 */
function computeHealthScore(files: BatchFileResult[]): number {
    let score = 100
    for (const file of files) {
        for (const v of file.violations) {
            score -= v.severity === 'critical' ? 10 : 3
        }
    }
    return Math.max(0, score)
}

export async function handleFlintAuditBatch(
    filePaths: string[],
    sharedArgs: Pick<AuditArgs, 'ruleIds' | 'severity'>,
    config: FlintConfig,
): Promise<BatchAuditResult> {
    const fileResults: BatchFileResult[] = []
    let policyMode = { mithril: config.policy.mithril.mode, a11y: config.policy.a11y.mode }

    for (const fp of filePaths) {
        let source: string
        try {
            source = fs.readFileSync(fp, 'utf-8')
        } catch (err) {
            fileResults.push({
                filePath: fp,
                violations: [],
                a11y: [],
                mithrilCount: 0,
                a11yCount: 0,
                error: `Could not read file: ${err instanceof Error ? err.message : String(err)}`,
            })
            continue
        }

        let result: AuditResult
        try {
            result = await handleFlintAudit(
                { source, filePath: fp, ...sharedArgs },
                config,
            )
        } catch (err) {
            fileResults.push({
                filePath: fp,
                violations: [],
                a11y: [],
                mithrilCount: 0,
                a11yCount: 0,
                error: `Audit failed: ${err instanceof Error ? err.message : String(err)}`,
            })
            continue
        }

        policyMode = result.policyMode as typeof policyMode

        const mithrilViolations = result.violations.filter((v) => v.type !== 'a11y')
        const a11yViolations = result.violations.filter((v) => v.type === 'a11y')

        fileResults.push({
            filePath: fp,
            violations: mithrilViolations,
            a11y: a11yViolations,
            mithrilCount: result.mithrilCount,
            a11yCount: result.a11yCount,
        })
    }

    const totalViolations = fileResults.reduce(
        (sum, f) => sum + f.violations.length + f.a11y.length,
        0,
    )
    const healthScore = computeHealthScore(fileResults)
    const grade = gradeFromScore(healthScore)

    const result: BatchAuditResult = {
        summary: {
            totalFiles: filePaths.length,
            totalViolations,
            healthScore,
            grade,
            text: generateBatchAuditSummary(filePaths.length, totalViolations, healthScore, grade),
        },
        files: fileResults,
        policyMode,
    }

    // CX.1: Attach project_context footer (best-effort, never blocks audit)
    try {
        const projectCtx = loadProjectContext(config.projectRoot)
        if (projectCtx !== null) {
            result.project_context = projectCtx
        }
    } catch {
        // project_context is best-effort — never block batch audit result
    }

    return result
}
