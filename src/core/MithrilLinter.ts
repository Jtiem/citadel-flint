/**
 * MithrilLinter — src/core/MithrilLinter.ts
 *
 * Facade over the CIEDE2000 engine in tokenMatcher.ts that adds:
 *   1. CSS color normalization: parses #hex, rgb(), rgba(), hsl() strings down
 *      to clean 6-digit hex so drift calculations work on raw style values,
 *      not just Tailwind arbitrary-value literals.
 *   2. calculateDrift: compares any two CSS color strings and returns the
 *      perceptual ΔE2000 distance (or null if either value cannot be parsed)
 *   3. visitClassNames: AST color-drift visitor (MITHRIL-COL-*)
 *   4. visitTypography: AST typography-drift visitor (MITHRIL-TYP-001..005)
 *   5. visitSpacing:    AST spacing-drift visitor (MITHRIL-SPC-001)
 *   6. visitShadows:    AST shadow-drift visitor (MITHRIL-SHD-001)
 *   7. visitOpacity:    AST opacity-drift visitor (MITHRIL-OPC-001)
 *   8. auditAll:        Runs every visitor in one pass and merges results.
 *   9. MITHRIL_THRESHOLD re-export
 *
 * Soft Mithril rule (Commandment 9):
 *   ΔE < 2.0  → perceptually indistinguishable — OK
 *   ΔE ≥ 2.0  → 'Mithril Violation' — amber glow in Properties Panel,
 *               export blocked via Export Gate
 *
 * For non-color dimensions (typography, spacing, shadow, opacity) the
 * comparison is exact-match against token values rather than perceptual. Any
 * arbitrary value that doesn't match a token is flagged immediately.
 *
 * Renderer Process only — no Node.js imports.
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import { findClosestToken, SYSTEMIZABLE_THRESHOLD } from '../utils/tokenMatcher'
import type { DesignToken, LinterWarning } from '../types/flint-api'

// CJS/ESM interop — mirrors the pattern used in astScanner.ts and ASTService.ts.
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

export { SYSTEMIZABLE_THRESHOLD as MITHRIL_THRESHOLD }

// ── CSS Color Normalization ───────────────────────────────────────────────────

/**
 * Converts an arbitrary CSS color string to a clean 6-digit lowercase hex
 * string (e.g. `"#6366f1"`).
 *
 * Supported formats:
 *   - 3-digit hex:  `#abc`
 *   - 6-digit hex:  `#aabbcc`
 *   - rgb():        `rgb(99, 102, 241)`
 *   - rgba():       `rgba(99, 102, 241, 0.5)` — alpha is discarded
 *   - hsl():        `hsl(239, 84%, 67%)`
 *   - hsla():       `hsla(239, 84%, 67%, 0.5)` — alpha is discarded
 *
 * Returns `null` for any unrecognised input.
 */
export function cssColorToHex(value: string): string | null {
    const s = value.trim()

    // ── Hex (#rgb / #rrggbb) ──────────────────────────────────────────────────
    const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s)
    if (hexMatch !== null) {
        const h = hexMatch[1]
        const expanded =
            h.length === 3
                ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
                : h
        return `#${expanded.toLowerCase()}`
    }

    // ── rgb() / rgba() ────────────────────────────────────────────────────────
    const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(s)
    if (rgbMatch !== null) {
        const r = clampByte(parseInt(rgbMatch[1], 10))
        const g = clampByte(parseInt(rgbMatch[2], 10))
        const b = clampByte(parseInt(rgbMatch[3], 10))
        return toHex(r, g, b)
    }

    // ── hsl() / hsla() ────────────────────────────────────────────────────────
    const hslMatch = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/.exec(s)
    if (hslMatch !== null) {
        const h = parseFloat(hslMatch[1])
        const sl = parseFloat(hslMatch[2]) / 100
        const l = parseFloat(hslMatch[3]) / 100
        const [r, g, b] = hslToRgb(h, sl, l)
        return toHex(r, g, b)
    }

    return null
}

// ── Private helpers ───────────────────────────────────────────────────────────

function clampByte(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)))
}

function toHex(r: number, g: number, b: number): string {
    return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`
}

function byteToHex(n: number): string {
    return n.toString(16).padStart(2, '0')
}

/**
 * Converts HSL (h in [0,360), s in [0,1], l in [0,1]) to RGB bytes [0–255].
 * Algorithm: CSS Color Level 4 §4.2.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const a = s * Math.min(l, 1 - l)
    function f(n: number): number {
        const k = (n + h / 30) % 12
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    return [
        clampByte(f(0) * 255),
        clampByte(f(8) * 255),
        clampByte(f(4) * 255),
    ]
}

// ── Public API — calculateDrift ───────────────────────────────────────────────

/**
 * Calculates the CIEDE2000 perceptual colour distance (ΔE) between two
 * arbitrary CSS color strings.
 *
 * Returns `null` if either value cannot be parsed as a colour.
 */
export function calculateDrift(styleValue: string, tokenValue: string): number | null {
    const hexA = cssColorToHex(styleValue)
    const hexB = cssColorToHex(tokenValue)
    if (hexA === null || hexB === null) return null

    const syntheticToken: DesignToken = {
        id: 0,
        token_path: '__mithril_ref__',
        token_type: 'color',
        token_value: hexB,
        description: null,
        collection_name: '__mithril__',
        mode: 'default',
    }

    const result = findClosestToken(hexA, [syntheticToken])
    return result?.deltaE ?? null
}

// ── Shared AST helpers ────────────────────────────────────────────────────────

/** Resolves `data-flint-id` from a JSXOpeningElement's attribute list. */
function getFlintId(openEl: t.JSXOpeningElement): string | null {
    const attr = openEl.attributes.find(
        (a): a is t.JSXAttribute =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name, { name: 'data-flint-id' })
    )
    if (attr === undefined || !t.isStringLiteral(attr.value)) return null
    return attr.value.value
}

/** Extracts a static className string value from a JSXAttribute node. */
function getClassString(classAttr: t.JSXAttribute): string | null {
    const valNode = classAttr.value
    if (t.isStringLiteral(valNode)) return valNode.value
    if (t.isJSXExpressionContainer(valNode) && t.isStringLiteral(valNode.expression)) {
        return valNode.expression.value
    }
    return null
}

/** Severity bucketing for violations — shared across all visitors. */
function severity(delta: number): LinterWarning['severity'] {
    return delta > 10 ? 'critical' : 'amber'
}

// ── JSX Visitor — Color (MITHRIL-COL-*) ──────────────────────────────────────

/**
 * Matches Tailwind arbitrary-value colour classes, e.g.:
 *   `bg-[#f3f3f3]`, `hover:text-[#000]`, `border-l-[#aabbcc]`
 *
 * Named capture group `hex` extracts the raw hex value (without `#`).
 */
const ARBITRARY_COLOR_RE = /^(?:[\w-]+:)*[\w-]+-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

/**
 * MITHRIL-COL — Traverses a Babel File AST and returns a `Map<flintId, LinterWarning>` for
 * every JSX element whose `className` contains at least one Tailwind
 * arbitrary-value hex colour whose closest design token exceeds
 * `MITHRIL_THRESHOLD` (2.0 ΔE).
 */
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
                    ? `MITHRIL-COL: ΔE ${worstDelta.toFixed(1)} – use ${tokenLabel}`
                    : `MITHRIL-COL: ΔE ${worstDelta.toFixed(1)} – no matching token`,
                nearestToken: tokenLabel,
                nearestTokenValue: worstMatch?.tokenValue ?? null,
            })
        },
    })

    return warnings
}

// ── JSX Visitor — Typography (MITHRIL-TYP-001..005) ─────────────────────────

/**
 * Arbitrary-value regexes for each typography dimension.
 * These catch `font-[Comic_Sans_MS]`, `text-[37px]`, `font-[900]`,
 * `leading-[1.3]`, `tracking-[0.05em]` etc.
 *
 * The `val` capture group extracts the raw arbitrary value (without brackets).
 */
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

/**
 * MITHRIL-TYP — Flags elements with arbitrary typography values not represented
 * in the token set (fontFamily, fontWeight, lineHeight, letterSpacing,
 * or font-size as a dimension token).
 */
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
                    // Check if this value matches any token of the relevant type.
                    const typeTokens = tokens.filter((tok) => tok.token_type === tokenType)
                    const hasMatch = typeTokens.some((tok) =>
                        tok.token_value.toLowerCase() === rawVal.toLowerCase()
                    )
                    if (hasMatch) continue

                    const suggestion = typeTokens[0]?.token_path ?? null
                    const msg = suggestion !== null
                        ? `${rule}: arbitrary '${rawVal}' not in token set — use ${suggestion}`
                        : `${rule}: arbitrary '${rawVal}' not in token set — add a ${tokenType} token`

                    // Worst-case per node: keep first violation per rule (don't overwrite).
                    if (!warnings.has(nodeId)) {
                        warnings.set(nodeId, {
                            id: nodeId,
                            type: 'typography-drift',
                            severity: 'amber',
                            value: 1,
                            message: msg,
                            nearestToken: suggestion,
                            nearestTokenValue: suggestion !== null
                                ? (typeTokens.find((t) => t.token_path === suggestion)?.token_value ?? null)
                                : null,
                        })
                    }
                }
            }
        },
    })

    return warnings
}

// ── JSX Visitor — Spacing (MITHRIL-SPC-001) ──────────────────────────────────

/**
 * Matches arbitrary spacing classes across all Tailwind spacing utilities.
 * Examples: `p-[37px]`, `mt-[13px]`, `gap-[22px]`, `w-[400px]`.
 *
 * Only flags pixel/rem/em values — not Tailwind scale integers which are
 * safe (they use the default scale, not arbitrary injection).
 */
const SPACING_RE = /^(?:[\w-]+:)*(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h)-\[(?<val>[\d.]+(?:px|rem|em|%|vw|vh))\]$/

/**
 * MITHRIL-SPC-001 — Flags elements with arbitrary spacing / sizing values
 * not found in the `dimension` token set.
 */
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
                    ? `MITHRIL-SPC-001: arbitrary '${rawVal}' not in dimension tokens — use ${suggestion}`
                    : `MITHRIL-SPC-001: arbitrary '${rawVal}' — no dimension tokens defined`

                if (!warnings.has(nodeId)) {
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'spacing-drift',
                        severity: 'amber',
                        value: 1,
                        message: msg,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (dimTokens.find((t) => t.token_path === suggestion)?.token_value ?? null)
                            : null,
                    })
                }
            }
        },
    })

    return warnings
}

// ── JSX Visitor — Shadow (MITHRIL-SHD-001) ───────────────────────────────────

/** Matches arbitrary Tailwind shadow classes, e.g. `shadow-[0_4px_6px_rgba(0,0,0,0.1)]` */
const SHADOW_RE = /^(?:[\w-]+:)*shadow-\[(?<val>[^\]]+)\]$/

/**
 * MITHRIL-SHD-001 — Flags arbitrary box-shadow values not matching a shadow token.
 */
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

                // Normalize underscores → spaces (Tailwind arbitrary value convention)
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
                            ? `MITHRIL-SHD-001: arbitrary shadow not in token set — use ${suggestion}`
                            : `MITHRIL-SHD-001: arbitrary shadow — add a shadow token`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (shadowTokens.find((t) => t.token_path === suggestion)?.token_value ?? null)
                            : null,
                    })
                }
            }
        },
    })

    return warnings
}

// ── JSX Visitor — Opacity (MITHRIL-OPC-001) ──────────────────────────────────

/** Matches arbitrary Tailwind opacity classes, e.g. `opacity-[0.73]` */
const OPACITY_RE = /^(?:[\w-]+:)*opacity-\[(?<val>[\d.]+%?)\]$/

/**
 * MITHRIL-OPC-001 — Flags arbitrary opacity values not matching an opacity token.
 */
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
                            ? `MITHRIL-OPC-001: arbitrary opacity '${rawVal}' — use ${suggestion}`
                            : `MITHRIL-OPC-001: arbitrary opacity '${rawVal}' — add an opacity token`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (opacityTokens.find((t2) => t2.token_path === suggestion)?.token_value ?? null)
                            : null,
                    })
                }
            }
        },
    })

    return warnings
}

// ── auditAll — unified entry point ────────────────────────────────────────────

/**
 * Runs all five Mithril visitors over `ast` and merges results into a single
 * `Map<flintId, LinterWarning>`.
 *
 * When a node has multiple violations, the **color drift** warning takes
 * precedence (ΔE is the most precise signal); other dimensions are recorded
 * on the first-encountered basis.
 *
 * This is the canonical function called by `editorStore.setCode` on every
 * successful parse.
 */
export function auditAll(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const merged = new Map<string, LinterWarning>()

    // Priority order: color > typography > spacing > shadow > opacity.
    // Each visitor only sets a warning on a node if not already set by a higher-priority visitor.
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
