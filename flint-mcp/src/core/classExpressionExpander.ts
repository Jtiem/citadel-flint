/**
 * classExpressionExpander.ts — flint-mcp/src/core/classExpressionExpander.ts
 *
 * Phase 1 — Tailwind Config + Class Composition Expansion
 *
 * Partial-evaluates class-utility calls (clsx, cva, classnames, cn, twMerge, tw)
 * into structured { definite, possible, unresolvable } sets that Mithril reads as
 * additional class sources.
 *
 * Commandment 13 compliance: this module is READ-ONLY against the AST. It accepts
 * a pre-parsed Babel File node and walks it with @babel/traverse without calling
 * any mutation op (no path.replaceWith, no path.insertBefore, etc.).
 *
 * Detection strategy:
 *   1. Scan ImportDeclarations at the top of the file to build a binding map:
 *      localName → ClassUtilityName (e.g. `import cn from "clsx"` → cn → "clsx").
 *   2. Scan top-level const/function declarations for local aliases of known utilities:
 *      `const cn = clsx` and `function cn(...) { return twMerge(clsx(inputs)) }`
 *      both add `cn` to the binding table as utility `'cn'`.
 *   3. Walk all CallExpression nodes whose callee resolves to a known utility,
 *      skipping nested calls that are already folded by a parent.
 *   4. Partial-evaluate each argument according to the rules below.
 *
 * Partial evaluation rules per argument node:
 *   StringLiteral               → split on whitespace, all parts → definite
 *   ObjectExpression:
 *     { key: true }             → key → definite
 *     { key: false }            → key dropped (never applied)
 *     { key: StringLiteral }    → key → definite
 *     { key: <other> }          → key → possible
 *   ArrayExpression             → recurse into each element
 *   ConditionalExpression:
 *     both branches string lit  → both → possible
 *     one literal, one dynamic  → literal → possible; unresolvable = true
 *     both dynamic              → recurse into each branch; unresolvable = true if
 *                                 the branch itself is not fully resolvable
 *   LogicalExpression (&&):
 *     right is string literal   → right → possible
 *     right is non-literal      → unresolvable = true
 *   LogicalExpression (||/??):
 *     left is dynamic           → right literal → possible; unresolvable = true
 *     left is resolvable string → right literal → possible (OR may short-circuit)
 *   TemplateLiteral no exprs    → cooked string split → definite
 *   TemplateLiteral with exprs  → static quasis → possible; unresolvable = true
 *   Identifier (local const):
 *     const x = "a b"           → treat as StringLiteral
 *     const x = { foo: true }   → treat as ObjectExpression
 *     const x = [...]           → treat as ArrayExpression
 *     other (import/fn/let/…)   → unresolvable = true
 *   CallExpression (nested utility):
 *     Recognized utility call   → fold its result into parent accumulator
 *
 * cva(base, { variants, compoundVariants }):
 *   base → definite (same rules as clsx arg)
 *   All leaf string values in variants/compoundVariants objects → possible (deduped)
 *   defaultVariants is NOT evaluated (runtime selection)
 *
 * Exports:
 *   ClassUtilityName          — union of recognized utility names
 *   ExpandedClassExpression   — per-call-site expansion result
 *   ClassExpressionExpander   — service interface
 *   expandAll(ast, source)    — Map<CallExpression, ExpandedClassExpression>
 *   expandAllList(input)      — ExpandedClassExpression[] (interface impl)
 *   classExpressionExpander   — singleton implementing ClassExpressionExpander
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Utility callee names recognized by classExpressionExpander.
 * Matched by the local binding resolved from a known npm package import.
 */
export type ClassUtilityName =
    | 'clsx'
    | 'cva'
    | 'classnames'
    | 'classNames'
    | 'cn'
    | 'twMerge'
    | 'tw'

/**
 * Output of expanding a single className-bearing call expression.
 *
 * Mithril runs drift detection against `definite ∪ possible`.
 * `unresolvable: true` means at least one argument could not be fully
 * evaluated — the coverage classifier retains `dynamic-class-expression`
 * as the reason in that case.
 */
export interface ExpandedClassExpression {
    /** Classes that are ALWAYS applied regardless of runtime state. */
    definite: string[]
    /** Classes that MAY be applied depending on runtime conditionals. */
    possible: string[]
    /**
     * True if any argument could not be fully evaluated (unresolved identifier,
     * non-local import, runtime-only value). When true, Mithril still checks
     * `definite` and `possible`, but the coverage classifier retains
     * `dynamic-class-expression` so the file remains `partial`.
     */
    unresolvable: boolean
    /** Which utility produced this expansion. */
    utility: ClassUtilityName
    /** 1-based line number of the call expression. */
    line: number
}

/**
 * Public service interface for classExpressionExpander.
 * Accepts a pre-parsed Babel File — never calls Babel.parse() internally.
 */
export interface ClassExpressionExpander {
    /**
     * Walk the AST, expand every recognized class-utility call, and return
     * one ExpandedClassExpression per call site in source order.
     */
    expandAll(input: { filePath: string; ast: t.File }): ExpandedClassExpression[]
}

// ── Known package → utility kind map ─────────────────────────────────────────

/**
 * Maps npm package specifiers to the canonical ClassUtilityName they expose.
 * Keys are lowercased for case-insensitive matching.
 */
const PACKAGE_TO_UTILITY: ReadonlyMap<string, ClassUtilityName> = new Map([
    ['clsx', 'clsx'],
    ['clsx/lite', 'clsx'],
    ['classnames', 'classnames'],
    ['class-variance-authority', 'cva'],
    ['tailwind-merge', 'twMerge'],
])

/**
 * Well-known local function/const names that are treated as class utilities
 * even when not directly imported from a recognized package. These names are
 * commonly used as local wrappers (e.g. the shadcn/ui `cn` pattern).
 */
const WELL_KNOWN_LOCAL_NAMES: ReadonlySet<ClassUtilityName> = new Set<ClassUtilityName>([
    'cn',
    'tw',
])

// ── Binding table builder ────────────────────────────────────────────────────

interface BindingEntry {
    utility: ClassUtilityName
    /** true if it's a namespace import (`import * as c from "classnames"`) */
    isNamespace: boolean
}

/**
 * Build a table from local binding name → utility kind by scanning the
 * file's top-level ImportDeclarations and local alias declarations.
 *
 * Examples:
 *   import clsx from "clsx"                  → clsx → clsx
 *   import cn from "clsx"                    → cn → clsx
 *   import { clsx as c } from "clsx"         → c → clsx
 *   import * as classnames from "classnames" → classnames → classnames (namespace)
 *   import { cva } from "class-variance-authority" → cva → cva
 *   import { twMerge } from "tailwind-merge" → twMerge → twMerge
 *   const cn = clsx                          → cn → cn (const alias of bound utility)
 *   function cn(...) { ... }                 → cn → cn (function wrapper)
 *   const cn = (...) => ...                  → cn → cn (arrow wrapper)
 */
function buildBindingTable(ast: t.File): Map<string, BindingEntry> {
    const table = new Map<string, BindingEntry>()

    // Pass 1: Import declarations
    for (const node of ast.program.body) {
        if (!t.isImportDeclaration(node)) continue

        const specifier = node.source.value.toLowerCase()
        const utilityKind = PACKAGE_TO_UTILITY.get(specifier)
        if (utilityKind === undefined) continue

        for (const s of node.specifiers) {
            if (t.isImportDefaultSpecifier(s)) {
                // import clsx from "clsx" or import cn from "clsx"
                table.set(s.local.name, { utility: utilityKind, isNamespace: false })
            } else if (t.isImportNamespaceSpecifier(s)) {
                // import * as c from "classnames"
                table.set(s.local.name, { utility: utilityKind, isNamespace: true })
            } else if (t.isImportSpecifier(s)) {
                // import { clsx } from "clsx" or import { cva } from "class-variance-authority"
                table.set(s.local.name, { utility: utilityKind, isNamespace: false })
            }
        }
    }

    // Pass 2: Local aliases and wrapper declarations
    // Only look at top-level statements, only well-known names
    for (const node of ast.program.body) {
        // const cn = clsx  (or another bound utility identifier)
        if (t.isVariableDeclaration(node) && node.kind === 'const') {
            for (const decl of node.declarations) {
                if (!t.isIdentifier(decl.id)) continue
                const localName = decl.id.name
                // Only bind if localName is a well-known utility name not yet in table
                if (!WELL_KNOWN_LOCAL_NAMES.has(localName as ClassUtilityName)) continue
                if (table.has(localName)) continue

                const init = decl.init
                if (init === null || init === undefined) continue

                // Case A: const cn = clsx  — init is an Identifier bound to a utility
                if (t.isIdentifier(init) && table.has(init.name)) {
                    table.set(localName, { utility: localName as ClassUtilityName, isNamespace: false })
                    continue
                }

                // Case B: const cn = (...) => ...  — arrow function wrapper
                // We don't need to inspect the body; the mere fact that a well-known name
                // is declared as an arrow function in a file that imports other utilities
                // is sufficient to treat it as a wrapper.
                if (t.isArrowFunctionExpression(init) && table.size > 0) {
                    table.set(localName, { utility: localName as ClassUtilityName, isNamespace: false })
                    continue
                }
            }
        }

        // function cn(...) { ... }  — function declaration wrapper
        if (t.isFunctionDeclaration(node) && node.id !== null && node.id !== undefined) {
            const localName = node.id.name
            if (!WELL_KNOWN_LOCAL_NAMES.has(localName as ClassUtilityName)) continue
            if (table.has(localName)) continue
            // Only add if there are other utility imports in this file
            if (table.size > 0) {
                table.set(localName, { utility: localName as ClassUtilityName, isNamespace: false })
            }
        }
    }

    return table
}

// ── Local const binding resolver ─────────────────────────────────────────────

/**
 * Walk the program body looking for top-level const declarations matching the
 * given identifier name. Returns the initializer expression if it's a
 * StringLiteral, ObjectExpression, or ArrayExpression; null otherwise.
 *
 * Only resolves top-level `const` — function-scoped consts and let/var
 * bindings are not resolved (they may be reassigned or scoped).
 */
function resolveLocalConst(
    name: string,
    ast: t.File,
): t.StringLiteral | t.ObjectExpression | t.ArrayExpression | null {
    for (const node of ast.program.body) {
        if (!t.isVariableDeclaration(node)) continue
        if (node.kind !== 'const') continue

        for (const decl of node.declarations) {
            if (!t.isIdentifier(decl.id, { name })) continue
            const init = decl.init
            if (init === null || init === undefined) continue

            if (
                t.isStringLiteral(init) ||
                t.isObjectExpression(init) ||
                t.isArrayExpression(init)
            ) {
                return init
            }
            // const x = fn() or const x = someVar — unresolvable
            return null
        }
    }
    // Not found at top level → could be function-scoped, imported, etc.
    return null
}

// ── Accumulator ───────────────────────────────────────────────────────────────

interface Accumulator {
    definite: string[]
    possible: string[]
    unresolvable: boolean
}

function pushClasses(strings: string[], target: string[]): void {
    for (const s of strings) {
        for (const cls of s.split(/\s+/).filter(Boolean)) {
            target.push(cls)
        }
    }
}

// ── Partial evaluators ───────────────────────────────────────────────────────

/**
 * Evaluate a single argument expression into the accumulator.
 *
 * @param node        The expression to evaluate
 * @param acc         Mutable accumulator
 * @param ast         The file AST (for local const resolution)
 * @param bindings    Binding table (for nested utility call recognition)
 * @param asPossible  When true, push string literals into `possible`
 *                    instead of `definite` (used for array elements that
 *                    appear inside a conditional context)
 */
function evalExpression(
    node: t.Expression | t.SpreadElement | t.JSXEmptyExpression | null | undefined,
    acc: Accumulator,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
    asPossible = false,
): void {
    if (node === null || node === undefined) return

    // ── StringLiteral ────────────────────────────────────────────────────────
    if (t.isStringLiteral(node)) {
        pushClasses([node.value], asPossible ? acc.possible : acc.definite)
        return
    }

    // ── TemplateLiteral ──────────────────────────────────────────────────────
    if (t.isTemplateLiteral(node)) {
        if (node.expressions.length === 0 && node.quasis.length === 1) {
            // `foo bar` — no interpolations
            const cooked = node.quasis[0].value.cooked ?? node.quasis[0].value.raw
            pushClasses([cooked], asPossible ? acc.possible : acc.definite)
        } else {
            // `text-${size}` — has interpolations
            // Collect static quasi chunks into possible
            for (const quasi of node.quasis) {
                const cooked = quasi.value.cooked ?? quasi.value.raw
                for (const cls of cooked.split(/\s+/).filter(Boolean)) {
                    acc.possible.push(cls)
                }
            }
            acc.unresolvable = true
        }
        return
    }

    // ── ObjectExpression ─────────────────────────────────────────────────────
    if (t.isObjectExpression(node)) {
        evalObjectExpression(node, acc, ast, bindings)
        return
    }

    // ── ArrayExpression ──────────────────────────────────────────────────────
    if (t.isArrayExpression(node)) {
        for (const element of node.elements) {
            if (element === null) continue
            if (t.isSpreadElement(element)) {
                acc.unresolvable = true
                continue
            }
            evalExpression(element, acc, ast, bindings, asPossible)
        }
        return
    }

    // ── ConditionalExpression (ternary) ───────────────────────────────────────
    if (t.isConditionalExpression(node)) {
        evalConditionalExpression(node, acc, ast, bindings)
        return
    }

    // ── LogicalExpression (&& and || and ??) ─────────────────────────────────
    if (t.isLogicalExpression(node)) {
        evalLogicalExpression(node, acc, ast, bindings)
        return
    }

    // ── SpreadElement ─────────────────────────────────────────────────────────
    if (t.isSpreadElement(node)) {
        acc.unresolvable = true
        return
    }

    // ── CallExpression — nested recognized utility call ───────────────────────
    if (t.isCallExpression(node)) {
        const nestedUtility = resolveCalleeUtility(node, bindings)
        if (nestedUtility !== null) {
            // Fold nested utility call result into the current accumulator
            foldNestedUtilityCall(node, nestedUtility, acc, ast, bindings)
            return
        }
        // Non-utility call — unresolvable
        acc.unresolvable = true
        return
    }

    // ── Identifier — resolve local const ─────────────────────────────────────
    if (t.isIdentifier(node)) {
        const resolved = resolveLocalConst(node.name, ast)
        if (resolved === null) {
            // Could not resolve: imported, function-scoped, let, etc.
            acc.unresolvable = true
        } else {
            evalExpression(resolved, acc, ast, bindings, asPossible)
        }
        return
    }

    // ── Anything else: unresolvable ───────────────────────────────────────────
    acc.unresolvable = true
}

/**
 * Evaluate a ConditionalExpression (ternary).
 *
 * Rules:
 *   - Both branches are string literals → both → possible, unresolvable=false
 *   - One is a string literal, one dynamic → literal → possible, unresolvable=true
 *   - Both are conditional expressions (nested ternary) → recurse; unresolvable
 *     only if a leaf branch is non-resolvable
 *   - Both dynamic → unresolvable=true
 */
function evalConditionalExpression(
    node: t.ConditionalExpression,
    acc: Accumulator,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
): void {
    const cons = node.consequent
    const alt = node.alternate

    const consResolvable = isBranchResolvable(cons, ast)
    const altResolvable = isBranchResolvable(alt, ast)

    if (consResolvable) {
        // Recurse with asPossible=true so all classes land in possible
        evalExpression(cons, acc, ast, bindings, true)
    } else {
        extractStaticFromBranch(cons, acc, ast)
        acc.unresolvable = true
    }

    if (altResolvable) {
        evalExpression(alt, acc, ast, bindings, true)
    } else if (!t.isNullLiteral(alt)) {
        extractStaticFromBranch(alt, acc, ast)
        acc.unresolvable = true
    }
}

/**
 * Returns true if a branch expression is fully resolvable to one or more
 * string literals (possibly via recursion into nested ternaries).
 */
function isBranchResolvable(
    node: t.Expression | t.JSXEmptyExpression,
    ast: t.File,
): boolean {
    if (t.isStringLiteral(node)) return true
    if (t.isNullLiteral(node)) return true
    if (t.isTemplateLiteral(node) && node.expressions.length === 0) return true
    if (t.isIdentifier(node)) {
        const resolved = resolveLocalConst(node.name, ast)
        return resolved !== null && t.isStringLiteral(resolved)
    }
    // Nested ternary — resolvable if BOTH branches are resolvable
    if (t.isConditionalExpression(node)) {
        return (
            isBranchResolvable(node.consequent, ast) &&
            isBranchResolvable(node.alternate, ast)
        )
    }
    return false
}

/**
 * Evaluate a LogicalExpression (&& / || / ??).
 *
 * Rules for &&:
 *   - right is string literal → right → possible, unresolvable unchanged
 *   - right is non-literal → unresolvable = true
 *
 * Rules for || and ??:
 *   - left is dynamic → right literal → possible, unresolvable = true
 *   - left is resolvable → right literal → possible (OR may short-circuit)
 *     In either case the string is in possible (not definite — runtime chooses)
 */
function evalLogicalExpression(
    node: t.LogicalExpression,
    acc: Accumulator,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
): void {
    const { operator, left, right } = node

    if (operator === '&&') {
        if (t.isStringLiteral(right)) {
            pushClasses([right.value], acc.possible)
        } else if (t.isTemplateLiteral(right) && right.expressions.length === 0) {
            const cooked = right.quasis[0].value.cooked ?? right.quasis[0].value.raw
            pushClasses([cooked], acc.possible)
        } else {
            extractStaticFromBranch(right, acc, ast)
            acc.unresolvable = true
        }
        return
    }

    // || and ??
    if (operator === '||' || operator === '??') {
        const leftResolvable = isBranchResolvable(left, ast)

        if (t.isStringLiteral(right)) {
            pushClasses([right.value], acc.possible)
        } else if (t.isTemplateLiteral(right) && right.expressions.length === 0) {
            const cooked = right.quasis[0].value.cooked ?? right.quasis[0].value.raw
            pushClasses([cooked], acc.possible)
        } else {
            extractStaticFromBranch(right, acc, ast)
        }

        // If left is dynamic, the entire expression may resolve to the dynamic left
        if (!leftResolvable) {
            acc.unresolvable = true
        }
        return
    }

    // Unknown operator — fallback
    acc.unresolvable = true
}

/**
 * Best-effort extraction of static string literals from a dynamic branch
 * expression (e.g. the dynamic side of a ternary). Only extracts string
 * literals without recursing deeply — this is advisory, not comprehensive.
 * The caller is responsible for setting unresolvable.
 */
function extractStaticFromBranch(
    node: t.Expression | t.JSXEmptyExpression,
    acc: Accumulator,
    ast: t.File,
): void {
    if (t.isStringLiteral(node)) {
        pushClasses([node.value], acc.possible)
    } else if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
        const cooked = node.quasis[0].value.cooked ?? node.quasis[0].value.raw
        pushClasses([cooked], acc.possible)
    } else if (t.isIdentifier(node)) {
        const resolved = resolveLocalConst(node.name, ast)
        if (resolved !== null && t.isStringLiteral(resolved)) {
            pushClasses([resolved.value], acc.possible)
        }
        // Don't set unresolvable here — caller handles the flag
    }
}

/**
 * Evaluate an ObjectExpression argument.
 *
 * Key handling:
 *   - String or identifier key where value is BooleanLiteral(true) → definite
 *   - String or identifier key where value is BooleanLiteral(false) → drop
 *   - String or identifier key where value is StringLiteral → definite (key name)
 *   - String or identifier key where value is anything else → possible (key name)
 *   - Computed key → unresolvable
 *   - SpreadElement → unresolvable
 */
function evalObjectExpression(
    node: t.ObjectExpression,
    acc: Accumulator,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
): void {
    for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
            acc.unresolvable = true
            continue
        }
        if (!t.isObjectProperty(prop)) continue

        // Computed keys: { [dynamic]: ... } — key name is unknown
        if (prop.computed) {
            acc.unresolvable = true
            continue
        }

        // Extract the key name
        let keyName: string | null = null
        if (t.isIdentifier(prop.key)) {
            keyName = prop.key.name
        } else if (t.isStringLiteral(prop.key)) {
            keyName = prop.key.value
        }

        if (keyName === null) {
            acc.unresolvable = true
            continue
        }

        const val = prop.value as t.Expression

        // { foo: true } → definite
        if (t.isBooleanLiteral(val) && val.value === true) {
            for (const cls of keyName.split(/\s+/).filter(Boolean)) {
                acc.definite.push(cls)
            }
            continue
        }

        // { foo: false } → drop (never applied at runtime)
        if (t.isBooleanLiteral(val) && val.value === false) {
            continue
        }

        // { foo: "bar" } — string value, key is always applied → definite
        if (t.isStringLiteral(val)) {
            for (const cls of keyName.split(/\s+/).filter(Boolean)) {
                acc.definite.push(cls)
            }
            continue
        }

        // { foo: someCondition } → possible (key may or may not apply at runtime)
        for (const cls of keyName.split(/\s+/).filter(Boolean)) {
            acc.possible.push(cls)
        }
    }
}

// ── cva-specific evaluation ───────────────────────────────────────────────────

/**
 * Recursively collect all leaf string values from a nested object/array.
 * Used to extract variant class strings from the `variants` and
 * `compoundVariants` config objects in a cva(...) call.
 *
 * All leaf strings become `possible` (they are runtime-selected variants).
 */
function collectLeafStrings(
    node: t.Expression | t.SpreadElement | null | undefined,
    acc: Accumulator,
): void {
    if (node === null || node === undefined) return

    if (t.isStringLiteral(node)) {
        pushClasses([node.value], acc.possible)
        return
    }

    if (t.isObjectExpression(node)) {
        for (const prop of node.properties) {
            if (t.isSpreadElement(prop)) {
                acc.unresolvable = true
                continue
            }
            if (!t.isObjectProperty(prop)) continue
            collectLeafStrings(prop.value as t.Expression, acc)
        }
        return
    }

    if (t.isArrayExpression(node)) {
        for (const el of node.elements) {
            if (el === null) continue
            collectLeafStrings(el, acc)
        }
        return
    }

    // Non-null, non-string, non-object leaves in variant maps are not classes
    // (e.g. numeric values for non-class variants) — skip without marking unresolvable
}

/**
 * Evaluate a cva(...) call expression.
 *
 * Signature: cva(base, { variants, compoundVariants, defaultVariants })
 *
 * - base arg → evaluated as definite (same rules as clsx arg)
 * - variants values → leaf strings → possible (deduped)
 * - compoundVariants class strings → possible (deduped)
 * - defaultVariants → NOT evaluated (runtime selection — non-goal #3)
 */
function evalCvaCall(
    args: readonly (t.Expression | t.SpreadElement)[],
    acc: Accumulator,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
): void {
    if (args.length === 0) return

    // First arg: base classes
    const base = args[0]
    if (!t.isSpreadElement(base)) {
        evalExpression(base, acc, ast, bindings, false)
    } else {
        acc.unresolvable = true
    }

    // Second arg: { variants, compoundVariants, defaultVariants }
    if (args.length < 2) return
    const config = args[1]
    if (t.isSpreadElement(config)) {
        acc.unresolvable = true
        return
    }
    if (!t.isObjectExpression(config)) {
        acc.unresolvable = true
        return
    }

    // Collect possible classes into a temporary accumulator so we can dedup
    const variantAcc: Accumulator = { definite: [], possible: [], unresolvable: false }

    for (const prop of config.properties) {
        if (t.isSpreadElement(prop)) {
            acc.unresolvable = true
            continue
        }
        if (!t.isObjectProperty(prop)) continue

        const keyName = t.isIdentifier(prop.key)
            ? prop.key.name
            : t.isStringLiteral(prop.key)
              ? prop.key.value
              : null

        // Skip defaultVariants — those select a runtime variant, not expose class names
        if (keyName === 'defaultVariants') continue

        // variants and compoundVariants — collect all leaf strings as possible
        collectLeafStrings(prop.value as t.Expression, variantAcc)
    }

    // Merge deduped variant classes into the main accumulator's possible
    const deduped = [...new Set(variantAcc.possible)]
    for (const cls of deduped) {
        acc.possible.push(cls)
    }
    if (variantAcc.unresolvable) {
        acc.unresolvable = true
    }
}

// ── Utility call resolution helpers ──────────────────────────────────────────

/**
 * Given a CallExpression node, return its resolved ClassUtilityName if the
 * callee is a recognized utility, or null otherwise.
 */
function resolveCalleeUtility(
    callNode: t.CallExpression,
    bindings: Map<string, BindingEntry>,
): ClassUtilityName | null {
    const callee = callNode.callee

    if (t.isIdentifier(callee)) {
        const entry = bindings.get(callee.name)
        if (entry !== undefined && !entry.isNamespace) {
            return entry.utility
        }
    } else if (
        t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.object)
    ) {
        // Namespace import: `c.default(...)` where `c` is `import * as c from "classnames"`
        const entry = bindings.get(callee.object.name)
        if (entry !== undefined && entry.isNamespace) {
            const memberName = t.isIdentifier(callee.property) ? callee.property.name : null
            if (memberName === 'default') {
                return entry.utility
            }
        }
    }

    return null
}

/**
 * Fold the result of a nested recognized utility call into the parent accumulator.
 * This prevents nested utility calls from emitting separate Map entries.
 */
function foldNestedUtilityCall(
    callNode: t.CallExpression,
    utility: ClassUtilityName,
    acc: Accumulator,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
): void {
    const args = callNode.arguments as (t.Expression | t.SpreadElement)[]

    if (utility === 'cva') {
        evalCvaCall(args, acc, ast, bindings)
    } else {
        for (const arg of args) {
            if (t.isSpreadElement(arg)) {
                acc.unresolvable = true
                continue
            }
            evalExpression(arg, acc, ast, bindings)
        }
    }
}

// ── Call site evaluator ───────────────────────────────────────────────────────

/**
 * Evaluate a single CallExpression node identified as a class utility call.
 * Returns an ExpandedClassExpression without mutating the AST.
 */
function evalCallSite(
    callNode: t.CallExpression,
    utility: ClassUtilityName,
    ast: t.File,
    bindings: Map<string, BindingEntry>,
    line: number,
): ExpandedClassExpression {
    const acc: Accumulator = { definite: [], possible: [], unresolvable: false }

    const args = callNode.arguments as (t.Expression | t.SpreadElement)[]

    if (utility === 'cva') {
        evalCvaCall(args, acc, ast, bindings)
    } else {
        // clsx, classnames, cn, twMerge, tw — all accept variadic args
        for (const arg of args) {
            if (t.isSpreadElement(arg)) {
                acc.unresolvable = true
                continue
            }
            evalExpression(arg, acc, ast, bindings)
        }
    }

    return {
        definite: acc.definite,
        possible: acc.possible,
        unresolvable: acc.unresolvable,
        utility,
        line,
    }
}

// ── Top-level call predicate ─────────────────────────────────────────────────

/**
 * Returns true if the given CallExpression path is a "top-level" recognized
 * utility call — meaning:
 *   1. No ancestor in the path is also a recognized utility CallExpression
 *      (prevents duplicate entries for nested calls like clsx(clsx(...))).
 *   2. No ancestor is a FunctionDeclaration or ArrowFunctionExpression whose
 *      binding name is itself in the bindings table (prevents evaluating
 *      wrapper function bodies like `function cn(...) { return twMerge(clsx(...)) }`).
 *
 * Used to skip nested utility calls in the traverse loop; they are folded into
 * their parent's result by evalExpression → foldNestedUtilityCall.
 */
function isTopLevelUtilityCall(
    path: { parentPath: { node?: t.Node; parentPath?: unknown } | null },
    bindings: Map<string, BindingEntry>,
): boolean {
    let current = path.parentPath
    while (current !== null && current !== undefined) {
        const node = (current as { node?: t.Node }).node

        if (node !== undefined) {
            // Check 1: ancestor is a recognized utility CallExpression
            if (t.isCallExpression(node)) {
                if (resolveCalleeUtility(node, bindings) !== null) {
                    return false
                }
            }

            // Check 2: ancestor is a wrapper function whose name is a bound utility
            // FunctionDeclaration: function cn(...) { ... }
            if (t.isFunctionDeclaration(node) && node.id !== null && node.id !== undefined) {
                if (bindings.has(node.id.name)) {
                    return false
                }
            }

            // VariableDeclarator: const cn = (...) => ...  or  const cn = function(...) { ... }
            if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
                if (bindings.has(node.id.name)) {
                    const init = node.init
                    if (
                        init !== null &&
                        init !== undefined &&
                        (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
                    ) {
                        return false
                    }
                }
            }
        }

        current = (current as { parentPath?: unknown }).parentPath as typeof current
    }
    return true
}

// ── Main entry points ─────────────────────────────────────────────────────────

/**
 * Walk the AST and expand every recognized class-utility call.
 *
 * Returns a Map keyed on the SAME CallExpression node objects that exist in
 * `ast` — no new nodes are created, and the AST is not mutated (Commandment 13).
 *
 * The optional `_source` parameter is accepted for API symmetry with callers
 * that provide both ast and source; it is not used in evaluation.
 */
export function expandAll(ast: t.File, _source?: string): Map<t.CallExpression, ExpandedClassExpression> {
    const result = new Map<t.CallExpression, ExpandedClassExpression>()
    const bindings = buildBindingTable(ast)

    if (bindings.size === 0) {
        // No known utility imports — nothing to expand
        return result
    }

    try {
        traverse(ast, {
            CallExpression(path) {
                const utility = resolveCalleeUtility(path.node, bindings)
                if (utility === null) return

                // Skip nested utility calls — they are folded by their parent
                if (!isTopLevelUtilityCall(path, bindings)) return

                const line = path.node.loc?.start.line ?? 0
                const expansion = evalCallSite(path.node, utility, ast, bindings, line)
                result.set(path.node, expansion)
            },
        })
    } catch {
        // Traverse errors are non-fatal — return whatever was collected so far
    }

    return result
}

/**
 * List-returning entry point that implements the ClassExpressionExpander
 * interface from the contract. Results are in source order (sorted by line).
 *
 * @param input.filePath  Absolute file path (carried through for callers that
 *                        need to associate results back to files)
 * @param input.ast       Pre-parsed Babel File node — NOT re-parsed here
 */
export function expandAllList(input: { filePath: string; ast: t.File }): ExpandedClassExpression[] {
    const map = expandAll(input.ast)
    const results: ExpandedClassExpression[] = []
    for (const exp of map.values()) {
        results.push(exp)
    }
    results.sort((a, b) => a.line - b.line)
    return results
}

/**
 * Singleton service instance implementing ClassExpressionExpander.
 * Prefer importing `expandAll` or `expandAllList` directly in most contexts;
 * use this when dependency-injection or interface conformance is needed.
 */
export const classExpressionExpander: ClassExpressionExpander = {
    expandAll: expandAllList,
}
