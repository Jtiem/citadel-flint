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
     * data-bridge-id value when present, otherwise "tagName:line:col".
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
            let bridgeId: string | undefined
            for (const attr of opening.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'data-bridge-id' &&
                    attr.value?.type === 'StringLiteral'
                ) {
                    bridgeId = attr.value.value
                    break
                }
            }
            const tagName =
                opening.name.type === 'JSXIdentifier'
                    ? opening.name.name
                    : 'unknown'
            const line = loc?.start.line ?? 0
            const col = loc?.start.column ?? 0
            const nodeId = bridgeId ?? `${tagName}:${line}:${col}`

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
