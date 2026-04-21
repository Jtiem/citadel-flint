/**
 * astScanner — src/utils/astScanner.ts
 *
 * Strict Babel AST visitor that finds Tailwind 'arbitrary value' colour
 * classes inside JSX className attributes.
 *
 * Detected pattern: <variant-chain><property>-[#hexvalue]
 *   e.g.  bg-[#f3f3f3]   text-[#000]   hover:border-[#abc123]
 *         dark:hover:text-[#fff]
 *
 * Each match is returned as a DriftCandidate — enough information for
 * the tokenMatcher to compute ΔE2000 and for applyTokenFix to do a
 * surgical className replacement.
 *
 * Renderer Process only — no Node.js imports.
 */

import type { File, JSXElement } from '@babel/types'
import { isJSXAttribute, isJSXIdentifier } from '@babel/types'
import type { NodePath } from '@babel/traverse'
import _traverse from '@babel/traverse'

// ── CJS interop (same guard as ast-parser.ts) ─────────────────────────────────
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Regex ─────────────────────────────────────────────────────────────────────

/**
 * Matches a Tailwind arbitrary-value colour token (including leading
 * variant chains). Named groups:
 *   variants  — zero or more variant prefixes, e.g. "hover:dark:" (may be "")
 *   prefix    — the Tailwind property prefix, e.g. "bg", "text", "border-l"
 *   hex       — the hex colour inside brackets, e.g. "#f3f3f3"
 *
 * The regex is anchored via \b / class boundaries at the token level, but
 * since we split on whitespace first (see scanArbitraryColors) the per-token
 * match is unambiguous.
 */
const ARBITRARY_COLOR_RE =
    /^(?<variants>(?:[\w-]+:)*)(?<prefix>[\w-]+)-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single detected hardcoded arbitrary-value colour class within a JSX node.
 * Produced by `scanArbitraryColors`; consumed by `findClosestToken` and
 * `applyTokenFix`.
 */
export interface DriftCandidate {
    /**
     * Stable node identifier — matches the id produced by `buildVisualTree`:
     * data-flint-id value when present, otherwise "tagName:line:col".
     */
    nodeId: string
    /**
     * The complete class token as it appears in the className string,
     * including variant prefixes (e.g. "hover:bg-[#f3f3f3]").
     */
    fullClass: string
    /**
     * The arbitrary-value class without variant prefixes
     * (e.g. "bg-[#f3f3f3]").
     */
    arbitraryClass: string
    /** Variant chain including trailing colons (e.g. "hover:" or "dark:hover:"). */
    variantChain: string
    /**
     * The Tailwind CSS property prefix — the part before `-[`
     * (e.g. "bg", "text", "border-l").
     */
    prefix: string
    /** The raw hex value inside the brackets (e.g. "#f3f3f3"). */
    rawValue: string
}

// ── Arbitrary typography / spacing regex ─────────────────────────────────────

/**
 * Tailwind arbitrary-value typography class.
 * Matches patterns such as:
 *   text-[17px]   font-['Helvetica_Neue']   font-size-[1.25rem]
 *   leading-[1.6]   tracking-[0.05em]
 *
 * Named groups:
 *   prefix — Tailwind utility prefix (e.g. "text", "font", "leading", "tracking")
 *   value  — the arbitrary value inside the brackets (e.g. "17px", "'Helvetica_Neue'")
 */
const ARBITRARY_TYPOGRAPHY_RE =
    /^(?:[\w-]+:)*(?<prefix>text|font(?:-\w+)?|leading|tracking)-\[(?<value>[^\]]+)\]$/

/**
 * Tailwind arbitrary-value spacing class.
 * Matches patterns such as:
 *   p-[13px]   px-[2rem]   py-[1.5rem]   m-[10px]   mt-[8px]   gap-[12px]
 *   space-x-[4px]   w-[200px]   h-[48px]   max-w-[600px]
 *
 * Named groups:
 *   prefix — Tailwind utility prefix (e.g. "p", "m", "gap", "w")
 *   value  — the arbitrary value (e.g. "13px", "2rem")
 */
const ARBITRARY_SPACING_RE =
    /^(?:[\w-]+:)*(?<prefix>p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|space-[xy]|w|h|min-w|max-w|min-h|max-h|inset(?:-[xytblr])?|top|right|bottom|left)-\[(?<value>[^\]]+)\]$/

// ── Shared JSX visitor helper types ───────────────────────────────────────────

/**
 * A single arbitrary-value typography or spacing class detected in a JSX
 * className attribute. Produced by `scanArbitraryTypography` and
 * `scanArbitrarySpacing`.
 */
export interface ArbitraryValueCandidate {
    /** Node identifier — matches data-flint-id when present, else "tagName:line:col". */
    nodeId: string
    /** The full class token as it appears in the className string. */
    fullClass: string
    /** The Tailwind utility prefix (e.g. "text", "p", "leading"). */
    prefix: string
    /** The raw arbitrary value inside the brackets (e.g. "17px", "1.5rem"). */
    rawValue: string
}

// ── Shared traversal factory ──────────────────────────────────────────────────

/**
 * Internal traversal factory that scans JSX className attributes for classes
 * matching `regex` and accumulates `ArbitraryValueCandidate` records.
 *
 * Reuses the same node-ID resolution logic as `scanArbitraryColors` to ensure
 * consistent IDs across all scanner outputs.
 */
function scanArbitraryValues(ast: File, regex: RegExp): ArbitraryValueCandidate[] {
    const candidates: ArbitraryValueCandidate[] = []

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const opening = path.node.openingElement
            const loc = path.node.loc

            // ── Resolve node id ───────────────────────────────────────────────
            let flintId: string | undefined
            for (const attr of opening.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'data-flint-id' &&
                    attr.value?.type === 'StringLiteral'
                ) {
                    flintId = attr.value.value
                    break
                }
            }
            const tagName =
                opening.name.type === 'JSXIdentifier'
                    ? opening.name.name
                    : 'unknown'
            const line = loc?.start.line ?? 0
            const col = loc?.start.column ?? 0
            const nodeId = flintId ?? `${tagName}:${line}:${col}`

            // ── Scan className attribute ──────────────────────────────────────
            for (const attr of opening.attributes) {
                if (
                    !isJSXAttribute(attr) ||
                    !isJSXIdentifier(attr.name, { name: 'className' }) ||
                    attr.value?.type !== 'StringLiteral'
                ) {
                    continue
                }

                for (const token of attr.value.value.split(/\s+/)) {
                    if (token === '') continue
                    const m = regex.exec(token)
                    if (m?.groups === undefined) continue

                    const prefix = m.groups['prefix'] ?? ''
                    const rawValue = m.groups['value'] ?? ''

                    candidates.push({ nodeId, fullClass: token, prefix, rawValue })
                }
            }
        },
    })

    return candidates
}

// ── Scanner ───────────────────────────────────────────────────────────────────

/**
 * Traverses the Babel File AST and returns every hardcoded arbitrary-value
 * colour class found in any JSX element's className attribute.
 *
 * The returned array may contain candidates from multiple nodes; callers
 * should filter by `nodeId` to get candidates for a specific element.
 */
export function scanArbitraryColors(ast: File): DriftCandidate[] {
    const candidates: DriftCandidate[] = []

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const opening = path.node.openingElement
            const loc = path.node.loc

            // ── Resolve node id (mirrors buildVisualTree logic) ────────────────
            let flintId: string | undefined
            for (const attr of opening.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'data-flint-id' &&
                    attr.value?.type === 'StringLiteral'
                ) {
                    flintId = attr.value.value
                    break
                }
            }
            const tagName =
                opening.name.type === 'JSXIdentifier'
                    ? opening.name.name
                    : 'unknown'
            const line = loc?.start.line ?? 0
            const col = loc?.start.column ?? 0
            const nodeId = flintId ?? `${tagName}:${line}:${col}`

            // ── Scan className attribute ───────────────────────────────────────
            for (const attr of opening.attributes) {
                if (
                    !isJSXAttribute(attr) ||
                    !isJSXIdentifier(attr.name, { name: 'className' }) ||
                    attr.value?.type !== 'StringLiteral'
                ) {
                    continue
                }

                for (const token of attr.value.value.split(/\s+/)) {
                    if (token === '') continue
                    const m = ARBITRARY_COLOR_RE.exec(token)
                    if (m?.groups === undefined) continue

                    const variantChain = m.groups['variants'] ?? ''
                    const prefix = m.groups['prefix'] ?? ''
                    const rawValue = m.groups['hex'] ?? ''
                    const arbitraryClass = `${prefix}-[${rawValue}]`

                    candidates.push({
                        nodeId,
                        fullClass: token,
                        arbitraryClass,
                        variantChain,
                        prefix,
                        rawValue,
                    })
                }
            }
        },
    })

    return candidates
}

/**
 * Traverses the Babel File AST and returns every hardcoded arbitrary-value
 * typography class found in any JSX element's className attribute.
 *
 * Detected patterns include:
 *   text-[17px]          — font-size override
 *   font-['Helvetica']   — font-family override
 *   leading-[1.6]        — line-height override
 *   tracking-[0.05em]    — letter-spacing override
 *
 * Each result carries the utility prefix and raw value so `matchValueToToken`
 * can compare against the active token set.
 */
export function scanArbitraryTypography(ast: File): ArbitraryValueCandidate[] {
    return scanArbitraryValues(ast, ARBITRARY_TYPOGRAPHY_RE)
}

/**
 * Traverses the Babel File AST and returns every hardcoded arbitrary-value
 * spacing/sizing class found in any JSX element's className attribute.
 *
 * Detected patterns include:
 *   p-[13px]   px-[2rem]   m-[10px]   gap-[12px]
 *   w-[200px]  h-[48px]    max-w-[600px]
 *
 * Each result carries the utility prefix and raw value so `matchValueToToken`
 * can compare against the active token set.
 */
export function scanArbitrarySpacing(ast: File): ArbitraryValueCandidate[] {
    return scanArbitraryValues(ast, ARBITRARY_SPACING_RE)
}
