/**
 * Mithril Linter (CI) -- flint-ci/src/mithril-linter.ts
 *
 * Standalone CI version of src/core/MithrilLinter.ts.
 * Runs all five Mithril visitors (color, typography, spacing, shadow, opacity)
 * against a Babel AST and returns violations as LinterWarning[].
 *
 * Inlined to avoid cross-boundary imports. The logic is identical to the
 * renderer-process MithrilLinter; keeping it in sync is a manual obligation
 * documented in CLAUDE.md.
 *
 * Commandment 9: CIEDE2000 delta-E logic for perceptual drift detection.
 * Commandment 13: Deterministic surgery -- Babel AST traversal only.
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import { findClosestToken, SYSTEMIZABLE_THRESHOLD } from './color-engine.js'
import type { DesignToken, LinterWarning } from './types.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

export { SYSTEMIZABLE_THRESHOLD as MITHRIL_THRESHOLD }

// -- Shared AST Helpers --------------------------------------------------------

function getFlintId(openEl: t.JSXOpeningElement): string | null {
    const attr = openEl.attributes.find(
        (a): a is t.JSXAttribute =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name, { name: 'data-flint-id' })
    )
    if (attr === undefined || !t.isStringLiteral(attr.value)) return null
    return attr.value.value
}

function getClassString(classAttr: t.JSXAttribute): string | null {
    const valNode = classAttr.value
    if (t.isStringLiteral(valNode)) return valNode.value
    if (t.isJSXExpressionContainer(valNode) && t.isStringLiteral(valNode.expression)) {
        return valNode.expression.value
    }
    return null
}

function severity(delta: number): LinterWarning['severity'] {
    return delta > 10 ? 'critical' : 'amber'
}

/**
 * Extracts a line number from a JSXOpeningElement for SARIF location reporting.
 * Falls back to 0 if location data is unavailable.
 */
export function getElementLine(openEl: t.JSXOpeningElement): number {
    return openEl.loc?.start.line ?? 0
}

// -- Color Visitor (MITHRIL-COL-*) ---------------------------------------------

const ARBITRARY_COLOR_RE = /^(?:[\w-]+:)*[\w-]+-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

export function visitClassNames(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const colorTokens = tokens.filter((tok) => tok.token_type === 'color')
    const warnings = new Map<string, LinterWarning>()
    if (colorTokens.length === 0) return warnings

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return

            const classStr = getClassString(path.node)
            if (classStr === null) return

            let worstDelta = 0
            let worstMatch: ReturnType<typeof findClosestToken> = null

            for (const cls of classStr.split(/\s+/)) {
                const m = ARBITRARY_COLOR_RE.exec(cls)
                if (m?.groups?.hex === undefined) continue
                const match = findClosestToken(m.groups.hex, colorTokens)
                if (match !== null && match.deltaE > worstDelta) {
                    worstDelta = match.deltaE
                    worstMatch = match
                }
            }

            if (worstDelta <= SYSTEMIZABLE_THRESHOLD) return

            const tokenLabel = worstMatch?.tokenPath ?? null
            warnings.set(nodeId, {
                id: nodeId,
                type: 'color-drift',
                severity: severity(worstDelta),
                value: worstDelta,
                message: tokenLabel !== null
                    ? `MITHRIL-COL: deltaE ${worstDelta.toFixed(1)} -- use ${tokenLabel}`
                    : `MITHRIL-COL: deltaE ${worstDelta.toFixed(1)} -- no matching token`,
                nearestToken: tokenLabel,
                nearestTokenValue: worstMatch?.tokenValue ?? null,
            })
        },
    })

    return warnings
}

// -- Typography Visitor (MITHRIL-TYP-001..005) ----------------------------------

const TYP_REGEXES: ReadonlyArray<{
    rule: string
    re: RegExp
    tokenType: DesignToken['token_type']
}> = [
    { rule: 'MITHRIL-TYP-001', re: /^(?:[\w-]+:)*font-\[(?<val>[^\]]+)\]$/, tokenType: 'fontFamily' },
    { rule: 'MITHRIL-TYP-002', re: /^(?:[\w-]+:)*text-\[(?<val>[\d.]+(?:px|rem|em|%|vw|vh))\]$/, tokenType: 'dimension' },
    { rule: 'MITHRIL-TYP-003', re: /^(?:[\w-]+:)*font-\[(?<val>\d{3})\]$/, tokenType: 'fontWeight' },
    { rule: 'MITHRIL-TYP-004', re: /^(?:[\w-]+:)*leading-\[(?<val>[^\]]+)\]$/, tokenType: 'lineHeight' },
    { rule: 'MITHRIL-TYP-005', re: /^(?:[\w-]+:)*tracking-\[(?<val>[^\]]+)\]$/, tokenType: 'letterSpacing' },
]

export function visitTypography(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return
            const classStr = getClassString(path.node)
            if (classStr === null) return

            for (const cls of classStr.split(/\s+/)) {
                for (const { rule, re, tokenType } of TYP_REGEXES) {
                    const m = re.exec(cls)
                    if (m?.groups?.val === undefined) continue

                    const rawVal = m.groups.val
                    const typeTokens = tokens.filter((tok) => tok.token_type === tokenType)
                    const hasMatch = typeTokens.some((tok) =>
                        tok.token_value.toLowerCase() === rawVal.toLowerCase()
                    )
                    if (hasMatch) continue

                    const suggestion = typeTokens[0]?.token_path ?? null
                    const msg = suggestion !== null
                        ? `${rule}: arbitrary '${rawVal}' not in token set -- use ${suggestion}`
                        : `${rule}: arbitrary '${rawVal}' not in token set -- add a ${tokenType} token`

                    if (!warnings.has(nodeId)) {
                        warnings.set(nodeId, {
                            id: nodeId,
                            type: 'typography-drift',
                            severity: 'amber',
                            value: 1,
                            message: msg,
                            nearestToken: suggestion,
                            nearestTokenValue: suggestion !== null
                                ? (typeTokens.find((tok) => tok.token_path === suggestion)?.token_value ?? null)
                                : null,
                        })
                    }
                }
            }
        },
    })

    return warnings
}

// -- Spacing Visitor (MITHRIL-SPC-001) ------------------------------------------

const SPACING_RE = /^(?:[\w-]+:)*(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h)-\[(?<val>[\d.]+(?:px|rem|em|%|vw|vh))\]$/

export function visitSpacing(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const dimTokens = tokens.filter((tok) => tok.token_type === 'dimension')
    const warnings = new Map<string, LinterWarning>()

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return
            const classStr = getClassString(path.node)
            if (classStr === null) return

            for (const cls of classStr.split(/\s+/)) {
                const m = SPACING_RE.exec(cls)
                if (m?.groups?.val === undefined) continue

                const rawVal = m.groups.val
                const hasMatch = dimTokens.some((tok) =>
                    tok.token_value === rawVal || tok.token_value === rawVal.replace('px', '')
                )
                if (hasMatch) continue

                const suggestion = dimTokens[0]?.token_path ?? null
                const msg = suggestion !== null
                    ? `MITHRIL-SPC-001: arbitrary '${rawVal}' not in dimension tokens -- use ${suggestion}`
                    : `MITHRIL-SPC-001: arbitrary '${rawVal}' -- no dimension tokens defined`

                if (!warnings.has(nodeId)) {
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'spacing-drift',
                        severity: 'amber',
                        value: 1,
                        message: msg,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (dimTokens.find((tok) => tok.token_path === suggestion)?.token_value ?? null)
                            : null,
                    })
                }
            }
        },
    })

    return warnings
}

// -- Shadow Visitor (MITHRIL-SHD-001) -------------------------------------------

const SHADOW_RE = /^(?:[\w-]+:)*shadow-\[(?<val>[^\]]+)\]$/

export function visitShadows(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const shadowTokens = tokens.filter((tok) => tok.token_type === 'shadow')
    const warnings = new Map<string, LinterWarning>()
    if (shadowTokens.length === 0) return warnings

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return
            const classStr = getClassString(path.node)
            if (classStr === null) return

            for (const cls of classStr.split(/\s+/)) {
                const m = SHADOW_RE.exec(cls)
                if (m?.groups?.val === undefined) continue

                const rawVal = m.groups.val.replace(/_/g, ' ')
                const hasMatch = shadowTokens.some((tok) => tok.token_value === rawVal)
                if (hasMatch) continue

                const suggestion = shadowTokens[0]?.token_path ?? null
                if (!warnings.has(nodeId)) {
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'shadow-drift',
                        severity: 'amber',
                        value: 1,
                        message: suggestion !== null
                            ? `MITHRIL-SHD-001: arbitrary shadow not in token set -- use ${suggestion}`
                            : `MITHRIL-SHD-001: arbitrary shadow -- add a shadow token`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (shadowTokens.find((tok) => tok.token_path === suggestion)?.token_value ?? null)
                            : null,
                    })
                }
            }
        },
    })

    return warnings
}

// -- Opacity Visitor (MITHRIL-OPC-001) ------------------------------------------

const OPACITY_RE = /^(?:[\w-]+:)*opacity-\[(?<val>[\d.]+%?)\]$/

export function visitOpacity(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const opacityTokens = tokens.filter((tok) => tok.token_type === 'opacity')
    const warnings = new Map<string, LinterWarning>()
    if (opacityTokens.length === 0) return warnings

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return
            const classStr = getClassString(path.node)
            if (classStr === null) return

            for (const cls of classStr.split(/\s+/)) {
                const m = OPACITY_RE.exec(cls)
                if (m?.groups?.val === undefined) continue

                const rawVal = m.groups.val
                const hasMatch = opacityTokens.some((tok) => tok.token_value === rawVal)
                if (hasMatch) continue

                const suggestion = opacityTokens[0]?.token_path ?? null
                if (!warnings.has(nodeId)) {
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'opacity-drift',
                        severity: 'amber',
                        value: 1,
                        message: suggestion !== null
                            ? `MITHRIL-OPC-001: arbitrary opacity '${rawVal}' -- use ${suggestion}`
                            : `MITHRIL-OPC-001: arbitrary opacity '${rawVal}' -- add an opacity token`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (opacityTokens.find((tok) => tok.token_path === suggestion)?.token_value ?? null)
                            : null,
                    })
                }
            }
        },
    })

    return warnings
}

// -- auditAll (unified entry point) --------------------------------------------

/**
 * Runs all five Mithril visitors over ast and merges results into a single
 * Map<flintId, LinterWarning>.
 *
 * Priority order: color > typography > spacing > shadow > opacity.
 * Each visitor only sets a warning on a node if not already set by a
 * higher-priority visitor.
 */
export function auditAll(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const merged = new Map<string, LinterWarning>()

    for (const visit of [
        () => visitClassNames(ast, tokens),
        () => visitTypography(ast, tokens),
        () => visitSpacing(ast, tokens),
        () => visitShadows(ast, tokens),
        () => visitOpacity(ast, tokens),
    ]) {
        for (const [id, warning] of visit()) {
            if (!merged.has(id)) merged.set(id, warning)
        }
    }

    return merged
}
