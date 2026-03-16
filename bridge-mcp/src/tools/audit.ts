/**
 * bridge_audit tool handler — bridge-mcp/src/tools/audit.ts
 *
 * Runs Mithril + A11y audits on source code.
 * Accepts a BridgeConfig to respect policy thresholds.
 */

import { parse } from '@babel/parser'
import { auditAll } from '../core/MithrilLinter.js'
import { A11yLinter } from '../core/A11yLinter.js'
import type { BridgeConfig } from '../core/config.js'
import type { DesignToken } from '../types.js'
import fs from 'node:fs'
import path from 'node:path'

export const BRIDGE_AUDIT_TOOL = {
    name: 'bridge_audit',
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
}

export interface AuditResult {
    violations: Array<{
        id: string
        ruleId: string
        severity: string
        message: string
        type: string
    }>
    mithrilCount: number
    a11yCount: number
    policyMode: {
        mithril: string
        a11y: string
    }
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
    }
    files: BatchFileResult[]
    policyMode: {
        mithril: string
        a11y: string
    }
}

export async function handleBridgeAudit(
    args: AuditArgs,
    config: BridgeConfig,
): Promise<AuditResult> {
    const { source, filePath } = args
    const policy = config.policy

    // Load tokens from project root
    const tokensPath = path.join(config.projectRoot, '.bridge', 'design-tokens.json')
    let tokens: DesignToken[] = []
    if (fs.existsSync(tokensPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            tokens = Array.isArray(raw) ? raw : Object.values(raw)
        } catch {
            // Use empty tokens
        }
    }

    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })

    const violations: AuditResult['violations'] = []

    // Mithril audit (respects policy mode)
    let mithrilCount = 0
    if (policy.mithril.mode !== 'off') {
        const mithrilWarnings = auditAll(
            ast as Parameters<typeof auditAll>[0],
            tokens,
            {
                deltaE_threshold: policy.mithril.deltaE_threshold,
                deltaE_critical_threshold: policy.mithril.deltaE_critical_threshold,
            },
        )
        mithrilCount = mithrilWarnings.size
        for (const [id, w] of mithrilWarnings) {
            violations.push({
                id,
                ruleId: w.ruleId ?? 'MITHRIL-UNKNOWN',
                severity: w.severity,
                message: w.message,
                type: w.type,
            })
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
                violations.push({
                    id,
                    ruleId,
                    severity: 'critical',
                    message: msg,
                    type: 'a11y',
                })
            }
        }
    }

    return {
        violations,
        mithrilCount,
        a11yCount,
        policyMode: {
            mithril: policy.mithril.mode,
            a11y: policy.a11y.mode,
        },
    }
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

export async function handleBridgeAuditBatch(
    filePaths: string[],
    sharedArgs: Pick<AuditArgs, 'ruleIds' | 'severity'>,
    config: BridgeConfig,
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
            result = await handleBridgeAudit(
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

        policyMode = result.policyMode

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

    return {
        summary: {
            totalFiles: filePaths.length,
            totalViolations,
            healthScore,
            grade: gradeFromScore(healthScore),
        },
        files: fileResults,
        policyMode,
    }
}
