/**
 * A11y Auto-Fix Engine — bridge-mcp/src/core/a11y/fixer.ts
 *
 * Takes violations and the AST, runs the rule's fix() function, and returns
 * the set of AST mutations to apply via bridge_ast_mutate.
 *
 * Auto-fix is a separate concern from detection (contract §3).
 * Fix functions are only called via bridge_fix or bridge_accessibility_report
 * with autoFix: true.
 */

import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import type { File as BabelFile } from '@babel/types'
import type {
    A11yRule,
    A11yViolationDetail,
    A11yFixResult,
    A11yFixMutation,
} from './types.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

const generate =
    typeof _generate === 'function'
        ? _generate
        : (_generate as unknown as { default: typeof _generate }).default

// ── Fix result ────────────────────────────────────────────────────────────────

export interface FixApplicationResult {
    /** Violations that were successfully fixed. */
    fixed: Array<{ violation: A11yViolationDetail; result: A11yFixResult }>
    /** Violations that could not be fixed (no fix function, or fix returned null). */
    skipped: A11yViolationDetail[]
    /** All mutations to apply, in order. */
    mutations: A11yFixMutation[]
    /** Summary descriptions of applied fixes. */
    appliedFixes: Array<{ ruleId: string; description: string }>
}

// ── Fixer ─────────────────────────────────────────────────────────────────────

/**
 * Applies deterministic auto-fixes for a set of violations.
 *
 * @param violations Violations to fix (must have fixable: true)
 * @param ast        The Babel AST of the file being fixed
 * @param rules      All registered A11y rules (to find fix functions)
 * @returns          FixApplicationResult with all mutations and descriptions
 */
export function applyFixes(
    violations: A11yViolationDetail[],
    ast: BabelFile,
    rules: A11yRule[],
): FixApplicationResult {
    const result: FixApplicationResult = {
        fixed: [],
        skipped: [],
        mutations: [],
        appliedFixes: [],
    }

    // Build a map from ruleId to fix function
    const fixMap = new Map<string, A11yRule['fix']>()
    for (const rule of rules) {
        if (rule.fix) {
            fixMap.set(rule.id, rule.fix)
        }
    }

    // Only attempt to fix violations marked fixable
    const fixableViolations = violations.filter((v) => v.fixable)
    const unfixable = violations.filter((v) => !v.fixable)
    result.skipped.push(...unfixable)

    for (const violation of fixableViolations) {
        const fixFn = fixMap.get(violation.ruleId)
        if (!fixFn) {
            result.skipped.push(violation)
            continue
        }

        try {
            const fixResult = fixFn(violation, ast)
            if (!fixResult || fixResult.mutations.length === 0) {
                result.skipped.push(violation)
                continue
            }

            result.fixed.push({ violation, result: fixResult })
            result.mutations.push(...fixResult.mutations)
            result.appliedFixes.push({
                ruleId: violation.ruleId,
                description: fixResult.description,
            })
        } catch {
            // Swallow per-fix errors — governance engine must not crash
            result.skipped.push(violation)
        }
    }

    return result
}

/**
 * Applies a single fix mutation directly to the AST.
 * Used by bridge_fix to apply fixes inline without going through the full
 * bridge_ast_mutate pipeline.
 *
 * @param ast       The AST to mutate (modified in place)
 * @param mutation  The mutation descriptor
 */
export function applyFixMutationToAst(
    ast: BabelFile,
    mutation: A11yFixMutation,
): void {
    if (mutation.type === 'updateProp') {
        const { nodeId, propName, value } = mutation.args as {
            nodeId: string
            propName: string
            value: string | null
        }

        traverse(ast, {
            JSXOpeningElement(path) {
                const nameNode = path.node.name
                if (nameNode.type !== 'JSXIdentifier') return

                // Find the element with the matching bridge-id
                const bridgeIdAttr = path.node.attributes.find(
                    (a) =>
                        a.type === 'JSXAttribute' &&
                        a.name.type === 'JSXIdentifier' &&
                        a.name.name === 'data-bridge-id',
                )
                if (!bridgeIdAttr || bridgeIdAttr.type !== 'JSXAttribute') return
                const attrVal = bridgeIdAttr.value
                if (!attrVal || attrVal.type !== 'StringLiteral') return
                if (attrVal.value !== nodeId) return

                // Find the target attribute
                const existing = path.node.attributes.findIndex(
                    (a) =>
                        a.type === 'JSXAttribute' &&
                        a.name.type === 'JSXIdentifier' &&
                        a.name.name === propName,
                )

                if (value === null) {
                    // Remove attribute
                    if (existing !== -1) {
                        path.node.attributes.splice(existing, 1)
                    }
                } else if (existing !== -1) {
                    // Update existing
                    const attr = path.node.attributes[existing]
                    if (attr.type === 'JSXAttribute') {
                        attr.value = {
                            type: 'StringLiteral',
                            value,
                            extra: { rawValue: value, raw: `"${value}"` },
                        } as import('@babel/types').StringLiteral
                    }
                } else {
                    // Add new attribute
                    path.node.attributes.push({
                        type: 'JSXAttribute',
                        name: { type: 'JSXIdentifier', name: propName },
                        value: {
                            type: 'StringLiteral',
                            value,
                            extra: { rawValue: value, raw: `"${value}"` },
                        } as import('@babel/types').StringLiteral,
                    } as import('@babel/types').JSXAttribute)
                }

                path.stop()
            },
        })
    }

    // Other mutation types (wrap, inject, delete) are handled by bridge_ast_mutate
    // pipeline — the fixer returns mutation descriptors for those.
}

/**
 * Generates source code from an AST after applying in-place mutations.
 * Used for the autoFix path in bridge_accessibility_report.
 */
export function generateCode(ast: BabelFile): string {
    const { code } = generate(ast)
    return code
}
