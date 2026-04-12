/**
 * hydrationLinter — flint-mcp/src/core/hydrationLinter.ts
 *
 * P4: Anti-Hardcode Linter (Data Hydration Governance)
 *
 * Detects hardcoded placeholder data in generated JSX. This is a uniquely
 * AI-native failure mode: when an LLM generates a component from a Figma
 * screenshot or AST, it notoriously bakes the designer's dummy text
 * ("John Doe", "$99.99", "Lorem ipsum") into hardcoded React strings
 * instead of parameterizing them as props.
 *
 * Two detection strategies:
 *
 *   1. Figma-informed: cross-reference JSX text literals against an optional
 *      Figma AST payload. If a Figma text layer is named with a data-binding
 *      hint (`#UserData.Name`, `{{product.price}}`, or layer names containing
 *      `.value` / `.text` / `.label`), but the generated JSX contains the
 *      placeholder string from that layer's `characters` value, raise
 *      HYDRATION-001.
 *
 *   2. Heuristic: even without Figma context, flag suspicious placeholder
 *      text via regex patterns (Lorem ipsum, "John Doe", "$99.99",
 *      "example@example.com", "MM/DD/YYYY", etc). The placeholder pattern
 *      list is configurable.
 *
 * Violations are always classified as SEMANTIC by the Mutation Planner:
 * Flint can detect hardcoded data but cannot deterministically know the
 * correct prop name.
 *
 * Commandment 13: Babel AST traversal only. Never regex on source code.
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import type { LinterWarning } from '../types.js'
import { getErrorEntryByRuleId } from './errorTaxonomy.js'

// CJS/ESM interop (matches MithrilLinter)
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * Minimal Figma node shape — only the fields the hydration linter consumes.
 * Adapters can coerce richer Figma payloads into this structure.
 */
export interface FigmaNode {
    /** Figma node id (e.g. "123:456"). */
    id?: string
    /** Layer name from the Figma source (possibly a data-binding hint). */
    name?: string
    /** Figma node type (TEXT, FRAME, etc). */
    type?: string
    /** Rendered text content for TEXT nodes. */
    characters?: string
    /** Child nodes — recursively walked during linting. */
    children?: FigmaNode[]
}

export interface HydrationOptions {
    /** Optional Figma AST payload — enables cross-reference hints. */
    figmaTree?: FigmaNode
    /**
     * Additional placeholder regex patterns to flag. Merged on top of the
     * built-in defaults. Use case-insensitive flags where appropriate.
     */
    placeholderPatterns?: RegExp[]
    /**
     * Policy mode overrides. `'off'` skips the visitor entirely.
     * `'advisory'` downgrades severity from `'amber'` to `'advisory'`.
     */
    ruleModes?: Record<string, 'blocking' | 'advisory' | 'off'>
}

// ── Default placeholder patterns ─────────────────────────────────────────────

/**
 * Built-in list of suspicious placeholder patterns. These run even when no
 * Figma AST is available. Additional patterns can be layered on via
 * `HydrationOptions.placeholderPatterns`.
 */
export const DEFAULT_PLACEHOLDER_PATTERNS: RegExp[] = [
    // Lorem ipsum filler
    /\blorem\s+ipsum\b/i,
    // Classic placeholder names
    /\bJohn\s+Doe\b/,
    /\bJane\s+(Doe|Smith)\b/,
    /\bJohn\s+Smith\b/,
    // Placeholder prices — $99.99, $0.00, $1,234.56
    /\$\s?\d{1,3}(,\d{3})*\.\d{2}\b/,
    // example@example.com / test@test.com style addresses
    /\b[\w.+-]*example[\w.+-]*@[\w.-]*example[\w.-]*\.[a-z]{2,}\b/i,
    /\btest@test\.[a-z]{2,}\b/i,
    // Date placeholders — 01/01/2024, MM/DD/YYYY
    /\b(MM|DD|YYYY)[\/\-](MM|DD|YYYY)[\/\-](MM|DD|YYYY)\b/,
    /\b01\/01\/20\d{2}\b/,
    // "Placeholder" string itself
    /\bplaceholder\s+text\b/i,
]

// ── Figma data-binding hint detection ────────────────────────────────────────

/**
 * Returns true when a Figma layer name looks like a data-binding hint rather
 * than real copy. Matches the conventions documented in the Figma plugin UI.
 */
export function isDataBindingHint(name: string | undefined): boolean {
    if (name === undefined || name === null) return false
    const trimmed = name.trim()
    if (trimmed.length === 0) return false
    if (trimmed.startsWith('#')) return true
    if (/\{\{.*\}\}/.test(trimmed)) return true
    if (/\.value\b|\.text\b|\.label\b/i.test(trimmed)) return true
    return false
}

/**
 * Walk the Figma tree and return a Set of placeholder strings taken from
 * TEXT nodes whose layer names are data-binding hints. Any matching literal
 * in the generated JSX should raise HYDRATION-001.
 */
export function collectFigmaPlaceholders(tree: FigmaNode | undefined): Set<string> {
    const set = new Set<string>()
    if (tree === undefined) return set

    function walk(node: FigmaNode): void {
        if (isDataBindingHint(node.name) && typeof node.characters === 'string') {
            const literal = node.characters.trim()
            if (literal.length > 0) set.add(literal)
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children) walk(child)
        }
    }

    walk(tree)
    return set
}

// ── Main detector ────────────────────────────────────────────────────────────

/**
 * Detect HYDRATION-001 violations in a TSX/JSX source string.
 *
 * Returns an array of `LinterWarning` objects ordered by position. When the
 * source fails to parse, returns an empty array — the caller's main linter
 * will surface the syntax error through its own channels.
 */
export function detectHydrationViolations(
    source: string,
    options: HydrationOptions = {},
): LinterWarning[] {
    // Policy gate: `'off'` short-circuits before parsing.
    const mode = options.ruleModes?.['HYDRATION-001']
    if (mode === 'off') return []

    let ast: File
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            errorRecovery: true,
        })
    } catch {
        return []
    }

    const figmaPlaceholders = collectFigmaPlaceholders(options.figmaTree)
    const patterns = [
        ...DEFAULT_PLACEHOLDER_PATTERNS,
        ...(options.placeholderPatterns ?? []),
    ]

    const warnings: LinterWarning[] = []
    const taxonomy = getErrorEntryByRuleId('HYDRATION-001')
    const severity: LinterWarning['severity'] = mode === 'advisory' ? 'advisory' : 'amber'

    let counter = 0
    const pushWarning = (
        literal: string,
        reason: 'figma' | 'pattern',
        loc: { line?: number; column?: number },
        patternSource?: string,
    ): void => {
        counter += 1
        const id = `hydration-${counter}`
        const displayLiteral = literal.length > 60 ? `${literal.slice(0, 57)}...` : literal
        const messageDetail = reason === 'figma'
            ? `matches Figma data-binding layer with placeholder text "${displayLiteral}"`
            : `matches placeholder pattern ${patternSource ?? '(built-in)'} — "${displayLiteral}"`
        warnings.push({
            id,
            type: 'hydration',
            severity,
            value: 0,
            message: `HYDRATION-001: Hardcoded placeholder data in JSX — ${messageDetail}. Extract as a component prop (e.g. \`userName\`, \`price\`).`,
            nearestToken: null,
            nearestTokenValue: null,
            ruleId: 'HYDRATION-001',
            fixable: false,
            explanation: taxonomy?.explanation,
            recovery: taxonomy?.recovery
                ?? 'Replace the hardcoded literal with a component prop or data binding. '
                    + 'Flint cannot infer the correct prop name — a human or LLM must choose it.',
            line: loc.line,
            column: loc.column,
        })
    }

    const literalMatches = (literal: string): { reason: 'figma' | 'pattern'; patternSource?: string } | null => {
        const trimmed = literal.trim()
        if (trimmed.length === 0) return null
        if (figmaPlaceholders.has(trimmed)) {
            return { reason: 'figma' }
        }
        for (const pattern of patterns) {
            if (pattern.test(trimmed)) {
                return { reason: 'pattern', patternSource: pattern.toString() }
            }
        }
        return null
    }

    traverse(ast, {
        JSXText(path) {
            const raw = path.node.value
            const match = literalMatches(raw)
            if (match === null) return
            const loc = path.node.loc?.start
            pushWarning(raw.trim(), match.reason, { line: loc?.line, column: loc?.column }, match.patternSource)
        },
        JSXAttribute(path) {
            // Flag hardcoded placeholder text in props that render user-visible
            // copy (alt, placeholder, title, aria-label, label). Dynamic
            // expressions `{...}` are never flagged.
            const name = path.node.name
            if (!t.isJSXIdentifier(name)) return
            const attrName = name.name
            if (!['alt', 'placeholder', 'title', 'aria-label', 'label', 'value', 'defaultValue'].includes(attrName)) {
                return
            }
            const value = path.node.value
            if (!t.isStringLiteral(value)) return
            const literal = value.value
            const match = literalMatches(literal)
            if (match === null) return
            const loc = value.loc?.start
            pushWarning(literal, match.reason, { line: loc?.line, column: loc?.column }, match.patternSource)
        },
        JSXExpressionContainer(path) {
            // Catch string literals wrapped in `{}` inside JSX children, e.g.
            // `<p>{'John Doe'}</p>`. Dynamic expressions (Identifier,
            // MemberExpression, CallExpression) are explicitly NOT flagged —
            // they are already hydrated via props.
            const expr = path.node.expression
            if (!t.isStringLiteral(expr)) return
            // Only treat as content when the parent is a JSXElement (children),
            // not when it's a JSXAttribute (props are handled above).
            if (!t.isJSXElement(path.parent) && !t.isJSXFragment(path.parent)) return
            const match = literalMatches(expr.value)
            if (match === null) return
            const loc = expr.loc?.start
            pushWarning(expr.value, match.reason, { line: loc?.line, column: loc?.column }, match.patternSource)
        },
    })

    return warnings
}
