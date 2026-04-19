/**
 * A11yLinter — flint-mcp/src/core/A11yLinter.ts
 *
 * Backward-compatible shim that delegates to the new modular a11y engine
 * introduced in EXP.6a. Preserves the original `audit()` API so all existing
 * call sites (server.ts, debtReportService.ts, formatters.ts) continue to work
 * without modification.
 *
 * Original 10 rules:
 *   A11Y-001..006 (names/labels), A11Y-007 (keyboard), A11Y-008..010 (structure)
 *
 * EXP.6a expands this to 40 rules; EXP.6a-ext expands to 50 rules. The `audit()` return type is preserved as
 * `A11yViolations` (Record<string, string[]>) for backward compatibility.
 * New callers should use `auditStructured()` which returns `A11yAuditResult`.
 *
 * ── RUNTIME.1 (appended 2026-04-18) ─────────────────────────────────────────
 *
 * axe-core runtime findings flow through a PARALLEL pipeline and share the
 * `A11yViolationDetail` shape declared in `./a11y/types.ts`. The runtime
 * adapter (electron/main.ts `runtime:run-axe` + server/index.ts web-parity
 * handler) normalizes axe-core results into A11yViolationDetail objects with:
 *
 *   - `ruleId`: either a Warden ID (from ../axeRuleMap.ts) or `RUNTIME-<axe-id>`
 *   - `sourceAuthority: 'runtime-dom'` (attached by the merger downstream)
 *
 * A11yLinter's AST-time output is unchanged. The merger in the renderer
 * (`useMergedA11yFindings` hook) deduplicates `(mappedWardenRuleId, elementId)`
 * pairs across AST + runtime authorities; SARIF emitters that consume the
 * resulting union treat `sourceAuthority: 'runtime-dom'` identically to any
 * other authority value.
 *
 * Future Warden rule authors: do NOT add rules to axe. New AST-time rules go
 * in `./a11y/rules/*.ts` exclusively. axe-only DOM findings surface with the
 * `RUNTIME-` prefix and remain first-class in the dashboard.
 */

import type { File as BabelFile } from '@babel/types'
// ── FIXTURE.1 import (append-only) ───────────────────────────────────────────
import type { FlintFixtureSurface, RuleAppliesTo } from '../../../shared/fixture-schema.js'
import { auditSync, registerRules, getRegisteredRules } from './a11y/runner.js'
import { namesLabelsRules } from './a11y/rules/names-labels.js'
import { keyboardRules } from './a11y/rules/keyboard.js'
import { structureRules } from './a11y/rules/structure.js'
import { ariaRules } from './a11y/rules/aria.js'
import { landmarksRules } from './a11y/rules/landmarks.js'
import { contrastRules } from './a11y/rules/contrast.js'
import { formsRules } from './a11y/rules/forms.js'
import { liveRegionsRules } from './a11y/rules/live-regions.js'
import { motionRules } from './a11y/rules/motion.js'
import { wcag22Rules } from './a11y/rules/wcag22.js'
import { cogaRules } from './a11y/rules/coga.js'
import type { A11yAuditResult } from './a11y/types.js'
import { classifyCoverage } from './coverageClassifier.js'
import type { CoverageVerdict } from '../shared/coverageTypes.js'

// ── Types (backward-compatible) ───────────────────────────────────────────────

/** Maps `data-flint-id` (or positional fallback) to violation message list. */
export type A11yViolations = Record<string, string[]>

// ── Phase 0 — Coverage Honesty ────────────────────────────────────────────────

/**
 * Options for `auditStructured` with optional Phase 0 coverage passthrough.
 * When `preComputedCoverage` is supplied, the A11yLinter does NOT re-run
 * the classifier — it propagates the verdict verbatim to the result.
 * When omitted, A11yLinter runs the classifier once itself.
 *
 * This ensures the classifier is invoked at most once per file across
 * both the Mithril and A11y linters.
 */
export interface AuditStructuredOptions {
    /** Pre-computed verdict from the MithrilLinter run. Pass to skip re-classification. */
    preComputedCoverage?: CoverageVerdict
    /**
     * Full source text. Required only when `preComputedCoverage` is omitted
     * and the classifier needs supplemental source-level checks.
     */
    source?: string
    /**
     * When true and file uses Tailwind classes, classifier emits
     * `tailwind-config-extension` reason. Only used when `preComputedCoverage` is absent.
     */
    tailwindConfigUnparsed?: boolean
}

/**
 * A11yAuditResult extended with the Phase 0 coverage verdict.
 * All pre-existing fields are unchanged; `coverage` is additive-only.
 */
export interface A11yAuditResultWithCoverage extends A11yAuditResult {
    /** Per-file coverage verdict. Non-null after Phase 0 ships. */
    coverage: CoverageVerdict
}

// ── Rule registration ─────────────────────────────────────────────────────────

function ensureRulesRegistered(): void {
    if (getRegisteredRules().length > 0) return

    registerRules([
        ...namesLabelsRules,
        ...keyboardRules,
        ...structureRules,
        ...ariaRules,
        ...landmarksRules,
        ...contrastRules,
        ...formsRules,
        ...liveRegionsRules,
        ...motionRules,
        ...wcag22Rules,
        ...cogaRules,
    ])
}

// ── Linter ────────────────────────────────────────────────────────────────────

export const A11yLinter = {
    /**
     * Backward-compatible audit that returns violations in the original
     * `Record<flintId, string[]>` format.
     *
     * Traverses the provided Babel AST and returns every accessibility violation
     * grouped by `data-flint-id` (or positional fallback key).
     *
     * @param ast  A Babel `File` node produced by `@babel/parser`.
     * @returns    Record mapping element keys to violation message arrays.
     *             An empty object means the file is fully accessible.
     */
    audit(ast: BabelFile): A11yViolations {
        ensureRulesRegistered()

        const result = auditSync(ast, { filePath: 'unknown' })
        const violations: A11yViolations = {}

        for (const violation of result.violations) {
            if (!violations[violation.elementId]) {
                violations[violation.elementId] = []
            }
            violations[violation.elementId].push(violation.message)
        }

        return violations
    },

    /**
     * Structured audit returning the full A11yAuditResult.
     * New callers should prefer this over `audit()`.
     *
     * Phase 0 extension: when `opts.preComputedCoverage` is provided, it is
     * propagated verbatim to `result.coverage` without re-running the classifier.
     * When omitted, the classifier runs once and its verdict is attached.
     *
     * @param ast       A Babel `File` node.
     * @param filePath  Optional file path for reporting context.
     * @param opts      Optional Phase 0 coverage passthrough options.
     * @returns         A11yAuditResultWithCoverage — all original fields plus `coverage`.
     */
    auditStructured(ast: BabelFile, filePath = 'unknown', opts?: AuditStructuredOptions): A11yAuditResultWithCoverage {
        ensureRulesRegistered()
        const baseResult = auditSync(ast, { filePath })

        let coverage: CoverageVerdict
        if (opts?.preComputedCoverage !== undefined) {
            // Caller supplied a pre-computed verdict — do NOT re-classify.
            coverage = opts.preComputedCoverage
        } else {
            // Fall back: classify once here (backward-compatible path).
            coverage = classifyCoverage({
                filePath,
                source: opts?.source ?? '',
                ast,
                tailwindConfigUnparsed: opts?.tailwindConfigUnparsed,
            })
        }

        return { ...baseResult, coverage }
    },
}

// ── FIXTURE.1 — Surface applicability filter (append-only) ───────────────────
//
// Added by flint-ast-surgeon. RUNTIME.1 and FIGMA-LINT.1 append their own
// sections after this one. Do NOT restructure the existing A11yLinter object.

/**
 * Single-source applicability predicate — re-exported from shared/fixture-schema.ts
 * so the inclusion table is not duplicated across linters (FIXTURE.1-CODE-002).
 * See `ruleMatchesSurface` in shared/fixture-schema.ts for the inclusion table.
 */
import { ruleMatchesSurface } from '../../../shared/fixture-schema.js'
export { ruleMatchesSurface }

/**
 * FIXTURE.1 — Surface-aware structured audit.
 *
 * Wraps `auditStructured` and silently drops violations from rules whose
 * `appliesTo` does not match the fixture surface. The filtering is applied
 * post-audit (the runner still traverses, but violations from mismatched
 * rules are removed before returning). This keeps the change append-only
 * without modifying the runner.
 *
 * For the authoritative silent-skip semantics see the contract:
 *   FIXTURE.1-contract.md § "Rule applicability metadata"
 *
 * @param ast        Babel AST.
 * @param filePath   File path for reporting.
 * @param surface    Fixture surface. When undefined, falls back to 'any' (all rules run).
 * @param opts       Optional Phase 0 coverage passthrough.
 */
export function auditWithSurface(
    ast: BabelFile,
    filePath: string,
    surface: FlintFixtureSurface | undefined,
    opts?: AuditStructuredOptions,
): A11yAuditResultWithCoverage {
    ensureRulesRegistered()
    const baseResult = A11yLinter.auditStructured(ast, filePath, opts)
    if (!surface) return baseResult

    // Build a lookup of ruleId → appliesTo from registered rules.
    const ruleAppliesTo = new Map<string, RuleAppliesTo | undefined>()
    for (const rule of getRegisteredRules()) {
        ruleAppliesTo.set(rule.id, rule.appliesTo)
    }

    // Silent-skip: filter out violations from rules that don't match the surface.
    const filteredViolations = baseResult.violations.filter((v) => {
        const appliesTo = ruleAppliesTo.get(v.ruleId)
        return ruleMatchesSurface(appliesTo, surface)
    })

    // Recalculate pass/fail counts to keep the result internally consistent.
    const failedRuleIds = new Set(filteredViolations.map((v) => v.ruleId))
    const failed = failedRuleIds.size
    const passed = baseResult.totalRules - failed
    const compliancePercent = baseResult.totalRules > 0
        ? Math.round((passed / baseResult.totalRules) * 100)
        : 100

    return {
        ...baseResult,
        violations: filteredViolations,
        failed,
        passed,
        compliancePercent,
        fixableCount: filteredViolations.filter((v) => v.fixable).length,
    }
}
