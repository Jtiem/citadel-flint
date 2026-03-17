/**
 * A11yLinter — bridge-mcp/src/core/A11yLinter.ts
 *
 * Backward-compatible shim that delegates to the new modular a11y engine
 * introduced in EXP.6a. Preserves the original `audit()` API so all existing
 * call sites (server.ts, debtReportService.ts, formatters.ts) continue to work
 * without modification.
 *
 * Original 10 rules:
 *   A11Y-001..006 (names/labels), A11Y-007 (keyboard), A11Y-008..010 (structure)
 *
 * EXP.6a expands this to 30 rules. The `audit()` return type is preserved as
 * `A11yViolations` (Record<string, string[]>) for backward compatibility.
 * New callers should use `auditStructured()` which returns `A11yAuditResult`.
 */

import type { File as BabelFile } from '@babel/types'
import { auditSync, registerRules, getRegisteredRules } from './a11y/runner.js'
import { namesLabelsRules } from './a11y/rules/names-labels.js'
import { keyboardRules } from './a11y/rules/keyboard.js'
import { structureRules } from './a11y/rules/structure.js'
import { ariaRules } from './a11y/rules/aria.js'
import { landmarksRules } from './a11y/rules/landmarks.js'
import { contrastRules } from './a11y/rules/contrast.js'
import { formsRules } from './a11y/rules/forms.js'
import type { A11yAuditResult } from './a11y/types.js'

// ── Types (backward-compatible) ───────────────────────────────────────────────

/** Maps `data-bridge-id` (or positional fallback) to violation message list. */
export type A11yViolations = Record<string, string[]>

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
    ])
}

// ── Linter ────────────────────────────────────────────────────────────────────

export const A11yLinter = {
    /**
     * Backward-compatible audit that returns violations in the original
     * `Record<bridgeId, string[]>` format.
     *
     * Traverses the provided Babel AST and returns every accessibility violation
     * grouped by `data-bridge-id` (or positional fallback key).
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
     * @param ast       A Babel `File` node.
     * @param filePath  Optional file path for reporting context.
     */
    auditStructured(ast: BabelFile, filePath = 'unknown'): A11yAuditResult {
        ensureRulesRegistered()
        return auditSync(ast, { filePath })
    },
}
