/**
 * flint_accessibility_report tool handler — flint-mcp/src/tools/accessibility.ts
 *
 * Provides a WCAG-structured compliance report with pass/fail per criterion,
 * compliance percentage, and optional auto-fix application.
 *
 * This is a dedicated tool separate from flint_audit, optimized for
 * compliance officers and CI/CD gates.
 */

import fs from 'node:fs'
import { parse } from '@babel/parser'
import { audit } from '../core/a11y/runner.js'
import { applyFixes, applyFixMutationToAst, generateCode } from '../core/a11y/fixer.js'
import { getRegisteredRules, registerRules } from '../core/a11y/runner.js'
import type {
    A11yRuleCategory,
    A11yAuditResult,
    A11yViolationDetail,
} from '../core/a11y/types.js'

// ── Tool schema ───────────────────────────────────────────────────────────────

export const FLINT_ACCESSIBILITY_REPORT_TOOL = {
    name: 'flint_accessibility_report',
    description:
        'Run a WCAG 2.1 AA accessibility audit on a component file or source snippet. ' +
        'Returns a structured compliance report with pass/fail per WCAG success criterion, ' +
        'compliance percentage, and optional deterministic auto-fix.',
    inputSchema: {
        type: 'object',
        properties: {
            source: {
                type: 'string',
                description: 'Source code string to audit (mutually exclusive with filePath).',
            },
            filePath: {
                type: 'string',
                description: 'Absolute path to file to audit (mutually exclusive with source).',
            },
            criteria: {
                type: 'array',
                items: { type: 'string' },
                description: 'Only check rules for specific WCAG criteria (e.g., ["1.1.1", "4.1.2"]).',
            },
            categories: {
                type: 'array',
                items: { type: 'string' },
                description: 'Only check rules in specific categories (names-labels, keyboard, structure, aria, landmarks, contrast, forms).',
            },
            autoFix: {
                type: 'boolean',
                description: 'If true, apply deterministic auto-fixes and return the fixed source.',
            },
            includePassingRules: {
                type: 'boolean',
                description: 'If true, return results even for passing rules.',
            },
        },
    },
}

// ── Handler ───────────────────────────────────────────────────────────────────

export interface AccessibilityReportArgs {
    source?: string
    filePath?: string
    criteria?: string[]
    categories?: A11yRuleCategory[]
    autoFix?: boolean
    includePassingRules?: boolean
}

export interface AccessibilityReportOutput {
    status: 'PASS' | 'FAIL'
    auditResult: A11yAuditResult
    fixedSource?: string
    appliedFixes?: Array<{ ruleId: string; description: string }>
    /** Actionable next-step recommendation. CLARITY-2 */
    recommendation: string
}

export async function handleAccessibilityReport(
    args: AccessibilityReportArgs,
): Promise<AccessibilityReportOutput> {
    const { source: argSource, filePath, criteria, categories, autoFix = false, includePassingRules = false } = args

    if (!argSource && !filePath) {
        throw new Error('Either source or filePath must be provided.')
    }

    // Resolve source code
    let source: string
    let resolvedFilePath: string

    if (filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`)
        }
        source = fs.readFileSync(filePath, 'utf-8')
        resolvedFilePath = filePath
    } else {
        source = argSource!
        resolvedFilePath = 'inline-source.tsx'
    }

    // Parse the AST
    let ast
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`Failed to parse source: ${message}`)
    }

    // Run the audit
    const auditResult = await audit(ast as import('@babel/types').File, {
        filePath: resolvedFilePath,
        criteria,
        categories,
    })

    // Apply auto-fixes if requested
    let fixedSource: string | undefined
    let appliedFixes: Array<{ ruleId: string; description: string }> | undefined

    if (autoFix && auditResult.violations.some((v) => v.fixable)) {
        const rules = getRegisteredRules()
        const fixResult = applyFixes(auditResult.violations, ast as import('@babel/types').File, rules)

        if (fixResult.mutations.length > 0) {
            // Apply updateProp mutations directly to AST
            for (const mutation of fixResult.mutations) {
                if (mutation.type === 'updateProp') {
                    applyFixMutationToAst(ast as import('@babel/types').File, mutation)
                }
            }
            fixedSource = generateCode(ast as import('@babel/types').File)
            appliedFixes = fixResult.appliedFixes
        }
    }

    // Filter out passing rules if includePassingRules is false
    if (!includePassingRules) {
        // violations array already only has violations — criterion results just need to be filtered
        auditResult.criterionResults = auditResult.criterionResults.filter((c) => !c.passed)
    }

    const status: 'PASS' | 'FAIL' = auditResult.violations.length === 0 ? 'PASS' : 'FAIL'

    // CLARITY-2: Generate actionable recommendation
    const violationCount = auditResult.violations.length
    let recommendation: string
    if (violationCount === 0) {
        recommendation = 'Full WCAG 2.1 AA compliance — no accessibility gaps found.'
    } else {
        const fixableCount = auditResult.violations.filter((v) => v.fixable).length
        recommendation = fixableCount > 0
            ? `${violationCount} accessibility gap(s) found, ${fixableCount} auto-fixable. Say 'fix it' to remediate.`
            : `${violationCount} accessibility gap(s) found. Review each for manual remediation.`
    }

    const output: AccessibilityReportOutput = {
        status,
        auditResult,
        recommendation,
    }

    if (fixedSource !== undefined) {
        output.fixedSource = fixedSource
    }

    if (appliedFixes !== undefined) {
        output.appliedFixes = appliedFixes
    }

    return output
}
