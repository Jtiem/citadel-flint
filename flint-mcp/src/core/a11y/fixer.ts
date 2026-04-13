/**
 * A11y Auto-Fix Engine — flint-mcp/src/core/a11y/fixer.ts
 *
 * Takes violations and the AST, runs the rule's fix() function, and returns
 * the set of AST mutations to apply via flint_ast_mutate.
 *
 * Auto-fix is a separate concern from detection (contract §3).
 * Fix functions are only called via flint_fix or flint_accessibility_report
 * with autoFix: true.
 */

import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import type { File as BabelFile, JSXOpeningElement } from '@babel/types'
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

// ── Prop mutation helpers ─────────────────────────────────────────────────────

/**
 * Applies a single prop add/update/remove to a JSXOpeningElement in place.
 * Extracted so both traversal strategies (by flint-id and by tag fallback) can share it.
 */
function applyPropToElement(
    opening: JSXOpeningElement,
    propName: string,
    value: string | null,
): void {
    const existing = opening.attributes.findIndex(
        (a) =>
            a.type === 'JSXAttribute' &&
            a.name.type === 'JSXIdentifier' &&
            a.name.name === propName,
    )

    if (value === null) {
        if (existing !== -1) {
            opening.attributes.splice(existing, 1)
        }
    } else if (existing !== -1) {
        const attr = opening.attributes[existing]
        if (attr.type === 'JSXAttribute') {
            attr.value = {
                type: 'StringLiteral',
                value,
                extra: { rawValue: value, raw: `"${value}"` },
            } as import('@babel/types').StringLiteral
        }
    } else {
        opening.attributes.push({
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: propName },
            value: {
                type: 'StringLiteral',
                value,
                extra: { rawValue: value, raw: `"${value}"` },
            } as import('@babel/types').StringLiteral,
        } as import('@babel/types').JSXAttribute)
    }
}

/**
 * Infers the JSX tag name from the fallback ID string used when data-flint-id
 * is absent. The fallback strings are defined in helpers.ts getFlintId().
 *
 * e.g. 'input-no-label' → 'input', 'button-no-name' → 'button'
 */
function inferTagFromFallbackId(fallbackId: string): string | null {
    if (fallbackId.startsWith('img-')) return 'img'
    if (fallbackId.startsWith('button-')) return 'button'
    if (fallbackId.startsWith('a-')) return 'a'
    if (fallbackId.startsWith('input-')) return 'input'
    if (fallbackId.startsWith('select-')) return 'select'
    if (fallbackId.startsWith('textarea-')) return 'textarea'
    if (fallbackId.startsWith('html-')) return 'html'
    if (fallbackId.startsWith('table-')) return 'table'
    if (fallbackId.startsWith('th-')) return 'th'
    if (fallbackId.startsWith('fieldset-')) return 'fieldset'
    if (fallbackId.startsWith('label-')) return 'label'
    return null
}

// ── AST mutation application ──────────────────────────────────────────────────

/**
 * Applies a single fix mutation directly to the AST.
 * Used by flint_fix to apply fixes inline without going through the full
 * flint_ast_mutate pipeline.
 *
 * Strategy:
 * 1. Primary: match by data-flint-id (accurate, handles multi-element files)
 * 2. Fallback: match by tag name inferred from the fallback nodeId string
 *    (handles files where injectFlintIds hasn't run yet)
 *
 * @param ast       The AST to mutate (modified in place)
 * @param mutation  The mutation descriptor
 */
export function applyFixMutationToAst(
    ast: BabelFile,
    mutation: A11yFixMutation,
): void {
    if (mutation.type !== 'updateProp') {
        // Other mutation types (wrap, inject, delete) are handled by flint_ast_mutate
        // pipeline — the fixer returns mutation descriptors for those.
        return
    }

    const { nodeId, propName, value } = mutation.args as {
        nodeId: string
        propName: string
        value: string | null
    }

    // ── Pass 1: match by data-flint-id ───────────────────────────────────────
    let found = false

    traverse(ast, {
        JSXOpeningElement(path) {
            if (path.node.name.type !== 'JSXIdentifier') return

            const flintIdAttr = path.node.attributes.find(
                (a) =>
                    a.type === 'JSXAttribute' &&
                    a.name.type === 'JSXIdentifier' &&
                    a.name.name === 'data-flint-id',
            )
            if (!flintIdAttr || flintIdAttr.type !== 'JSXAttribute') return
            const attrVal = flintIdAttr.value
            if (!attrVal || attrVal.type !== 'StringLiteral') return
            if (attrVal.value !== nodeId) return

            applyPropToElement(path.node, propName, value)
            found = true
            path.stop()
        },
    })

    if (found) return

    // ── Pass 2: tag-name fallback (no data-flint-id in the file) ─────────────
    // When injectFlintIds hasn't been run, getFlintId() returns a generic
    // string like 'input-no-label'. We infer the tag name from that string
    // and apply the fix to all matching elements that don't already have the prop.
    const tagName = inferTagFromFallbackId(nodeId)
    if (!tagName) return

    traverse(ast, {
        JSXOpeningElement(path) {
            const nameNode = path.node.name
            if (nameNode.type !== 'JSXIdentifier') return
            if (nameNode.name !== tagName) return

            // Skip elements that already have the target prop
            const hasProp = path.node.attributes.some(
                (a) =>
                    a.type === 'JSXAttribute' &&
                    a.name.type === 'JSXIdentifier' &&
                    a.name.name === propName,
            )
            if (hasProp) return

            applyPropToElement(path.node, propName, value)
        },
    })
}

/**
 * Generates source code from an AST after applying in-place mutations.
 * Used for the autoFix path in flint_accessibility_report.
 */
export function generateCode(ast: BabelFile): string {
    const { code } = generate(ast)
    return code
}
