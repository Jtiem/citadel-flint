/**
 * A11y types — flint-mcp/src/core/a11y/types.ts
 *
 * All type contracts for the EXP.6 accessibility engine.
 * Source of truth per the exp6-accessibility-expansion contract.
 */

import type { File as BabelFile, JSXElement } from '@babel/types'
import type { NodePath } from '@babel/traverse'

/**
 * WCAG 2.1 success criterion identifier.
 * Format: "X.Y.Z" (e.g., "1.1.1", "2.4.7")
 */
export type WCAGCriterion = string

/**
 * Rule severity. All A11y rules default to 'critical' per Commandment 5.
 * 'warning' is reserved for WCAG AAA or informational best-practice rules.
 */
export type A11yRuleSeverity = 'critical' | 'warning' | 'info' | 'advisory'

/**
 * Rule category for organizational grouping.
 */
export type A11yRuleCategory =
    | 'names-labels'      // SC 1.1.1, 1.3.1, 4.1.2
    | 'keyboard'          // SC 2.1.1, 2.1.2, 2.4.3, 2.4.7
    | 'structure'         // SC 1.3.1, 2.4.1, 2.4.6, 2.4.10
    | 'aria'              // SC 4.1.2, 1.3.1
    | 'landmarks'         // SC 1.3.1, 2.4.1
    | 'contrast'          // SC 1.4.3, 1.4.6, 1.4.11
    | 'forms'             // SC 1.3.1, 3.3.1, 3.3.2
    | 'live-regions'      // SC 4.1.3
    | 'motion'            // SC 2.3.1, 2.3.3

/**
 * A single A11y rule definition.
 * Each rule module exports an array of these.
 */
export interface A11yRule {
    /** Unique rule identifier (e.g., "A11Y-001"). */
    id: string
    /** Human-readable rule name. */
    name: string
    /** WCAG 2.1 success criterion this rule maps to. */
    wcag: WCAGCriterion
    /** WCAG conformance level. */
    level: 'A' | 'AA' | 'AAA'
    /** Organizational category. */
    category: A11yRuleCategory
    /** Default severity. */
    severity: A11yRuleSeverity
    /** Human-readable description of what the rule checks. */
    description: string
    /**
     * The detection function. Called once per JSXElement during traversal.
     * Returns null if no violation, or an A11yViolationDetail if violated.
     *
     * For rules that need document-level context (e.g., heading order,
     * landmark presence), use `auditDocument` instead.
     */
    visitElement?: (
        path: NodePath<JSXElement>,
        context: A11yRuleContext,
    ) => A11yViolationDetail | null
    /**
     * Document-level audit. Called once after full traversal with
     * accumulated context. Used for rules that need global view
     * (e.g., "page must have <main>", heading order).
     */
    auditDocument?: (context: A11yRuleContext) => A11yViolationDetail[]
    /**
     * Optional deterministic auto-fix function.
     * Returns the fix description and the AST mutations to apply.
     * If undefined, the rule is detection-only.
     */
    fix?: (
        violation: A11yViolationDetail,
        ast: BabelFile,
    ) => A11yFixResult | null
}

/**
 * Accumulated context passed to each rule during traversal.
 * Rules can read and write to this to share state (e.g., heading tracker).
 */
export interface A11yRuleContext {
    /** File path being audited. */
    filePath: string
    /** All heading levels encountered so far, in document order. */
    headingLevels: number[]
    /** Set of landmark roles encountered (main, nav, banner, contentinfo). */
    landmarksFound: Set<string>
    /** Map of element flint-id to its ARIA role (explicit or implicit). */
    elementRoles: Map<string, string>
    /** Map of id attribute values to their flint-ids (for label associations). */
    idToElementMap: Map<string, string>
    /** Set of aria-labelledby / htmlFor target IDs referenced in the document. */
    labelTargetIds: Set<string>
    /** Design tokens (for contrast checking). */
    tokens: import('../../types.js').DesignToken[]
    /** Extracted className-to-color mappings for contrast analysis. */
    colorContext: Map<string, { foreground: string | null; background: string | null; fontSize: string | null; fontWeight: string | null }>
    /** Landmark instances: tracks (role, aria-label) pairs for duplicate-label checking. */
    landmarkInstances: Array<{ role: string; label: string | null; elementId: string }>
    /** h1 count for A11Y-017 */
    h1Count: number
    /** Total JSX elements found during traversal (used by document rules to skip empty files) */
    totalElements: number
    /** True if the file appears to be a full page layout (has page-structure elements) */
    hasPageStructure: boolean
}

/**
 * Detail object for a single violation.
 */
export interface A11yViolationDetail {
    /** The rule ID that was violated (e.g., "A11Y-001"). */
    ruleId: string
    /** The flint-id of the offending element (or positional fallback). */
    elementId: string
    /** Human-readable violation message with remediation guidance. */
    message: string
    /** Severity inherited from the rule. */
    severity: A11yRuleSeverity
    /** WCAG criterion. */
    wcag: WCAGCriterion
    /** Whether this violation has a deterministic auto-fix available. */
    fixable: boolean
    /** Plain-language explanation of why this rule exists. Populated by CX.3 errorTaxonomy. */
    explanation?: string
    /** Actionable recovery steps. Populated by CX.3 errorTaxonomy. */
    recovery?: string
}

/**
 * Result of applying an auto-fix.
 */
export interface A11yFixResult {
    /** Description of what the fix did. */
    description: string
    /**
     * The mutations to apply via flint_ast_mutate.
     * Each mutation maps to a catalog op (updateProp, updateClassName, wrap, inject).
     */
    mutations: A11yFixMutation[]
}

/**
 * A single AST mutation produced by an auto-fix.
 * These map 1:1 to flint_ast_mutate operation types.
 */
export interface A11yFixMutation {
    type: 'updateProp' | 'updateClassName' | 'wrap' | 'inject' | 'delete'
    args: Record<string, unknown>
}

/**
 * The output of a full accessibility audit.
 */
export interface A11yAuditResult {
    /** File path audited. */
    filePath: string
    /** Total rules evaluated. */
    totalRules: number
    /** Number of rules that passed (no violations found). */
    passed: number
    /** Number of rules that failed (at least one violation). */
    failed: number
    /** Compliance percentage: passed / totalRules * 100. */
    compliancePercent: number
    /** All violations found, grouped by rule ID. */
    violations: A11yViolationDetail[]
    /** Per-criterion pass/fail breakdown. */
    criterionResults: A11yCriterionResult[]
    /** Number of violations with available auto-fixes. */
    fixableCount: number
    /** ISO 8601 timestamp. */
    timestamp: string
}

/**
 * Pass/fail result for a single WCAG success criterion.
 */
export interface A11yCriterionResult {
    /** WCAG criterion (e.g., "1.1.1"). */
    criterion: WCAGCriterion
    /** Human-readable criterion name. */
    name: string
    /** Conformance level. */
    level: 'A' | 'AA' | 'AAA'
    /** Whether all rules for this criterion passed. */
    passed: boolean
    /** Rule IDs that failed for this criterion. */
    failedRules: string[]
    /** Total violations for this criterion. */
    violationCount: number
}
