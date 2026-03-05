/**
 * MithrilLinter — src/core/MithrilLinter.ts
 *
 * Facade over the CIEDE2000 engine in tokenMatcher.ts that adds:
 *   1. CSS color normalization: parses #hex, rgb(), rgba(), hsl() strings down
 *      to clean 6-digit hex so drift calculations work on raw style values,
 *      not just Tailwind arbitrary-value literals.
 *   2. calculateDrift: compares any two CSS color strings and returns the
 *      perceptual ΔE2000 distance (or null if either value cannot be parsed).
 *   3. MITHRIL_THRESHOLD re-export: the 2.0 boundary that separates
 *      "Mithril Violation" warnings from systemizable matches.
 *
 * Soft Mithril rule (Commandment 9):
 *   ΔE < 2.0  → colours are perceptually indistinguishable — OK
 *   ΔE ≥ 2.0  → 'Mithril Violation' — Properties Panel input glows Amber
 *
 * Renderer Process only — no Node.js imports.
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import { findClosestToken, SYSTEMIZABLE_THRESHOLD } from '../utils/tokenMatcher'
import type { DesignToken, LinterWarning } from '../types/bridge-api'

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculates the CIEDE2000 perceptual colour distance (ΔE) between two
 * arbitrary CSS color strings.
 *
 * Both values are normalised to hex before being passed to the CIEDE2000
 * engine, so `rgb()`, `rgba()`, `hsl()`, and raw hex inputs are all accepted.
 *
 * Returns `null` if either value cannot be parsed as a colour.
 *
 * ### Usage
 * ```ts
 * const dE = calculateDrift('#6366f1', 'rgb(100, 104, 245)')
 * if (dE !== null && dE > MITHRIL_THRESHOLD) {
 *   // show amber warning
 * }
 * ```
 */
export function calculateDrift(styleValue: string, tokenValue: string): number | null {
    const hexA = cssColorToHex(styleValue)
    const hexB = cssColorToHex(tokenValue)
    if (hexA === null || hexB === null) return null

    // Build a minimal DesignToken shape so we can reuse findClosestToken's
    // Lab conversion + CIEDE2000 engine without duplicating math.
    // The id and metadata fields are not used by the matching logic.
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

// ── JSX Visitor ───────────────────────────────────────────────────────────────

/**
 * Matches Tailwind arbitrary-value colour classes, e.g.:
 *   `bg-[#f3f3f3]`, `hover:text-[#000]`, `border-l-[#aabbcc]`
 *
 * Named capture group `hex` extracts the raw hex value (without `#`).
 */
const ARBITRARY_COLOR_RE = /^(?:[\w-]+:)*[\w-]+-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

/**
 * Traverses a Babel File AST and returns a `Map<bridgeId, LinterWarning>` for
 * every JSX element whose `className` contains at least one Tailwind
 * arbitrary-value hex colour whose closest design token exceeds
 * `MITHRIL_THRESHOLD` (2.0 ΔE).
 *
 * **Visitor pattern (Commandment 13 — Deterministic Surgery):**
 *   - Intercepts `JSXAttribute` nodes where `name.name === 'className'`.
 *   - Resolves the `data-bridge-id` from sibling attributes on the same element.
 *   - Extracts hex values from arbitrary-value classes via `ARBITRARY_COLOR_RE`.
 *   - Computes CIEDE2000 ΔE for each hex against `tokens` via `findClosestToken`.
 *   - Reports the worst-offender per element as a `LinterWarning`.
 *
 * Returns an empty map when `tokens` has no colour entries.
 *
 * @param ast    - Babel File AST of the currently-open source file.
 * @param tokens - Full design token list from `tokenStore.tokens`.
 */
export function visitClassNames(ast: File, tokens: DesignToken[]): Map<string, LinterWarning> {
    const colorTokens = tokens.filter((tok) => tok.token_type === 'color')
    const warnings = new Map<string, LinterWarning>()
    if (colorTokens.length === 0) return warnings

    traverse(ast, {
        JSXAttribute(path) {
            // Only handle `className` attributes.
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return

            // Resolve the parent JSXOpeningElement to look up `data-bridge-id`.
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return

            const bridgeAttr = openEl.attributes.find(
                (a): a is t.JSXAttribute =>
                    t.isJSXAttribute(a) &&
                    t.isJSXIdentifier(a.name, { name: 'data-bridge-id' })
            )
            const nodeId =
                bridgeAttr !== undefined && t.isStringLiteral(bridgeAttr.value)
                    ? bridgeAttr.value.value
                    : null
            if (nodeId === null) return

            // Extract the className string value — handles literal strings and
            // JSX expressions wrapping a string literal (common after Prettier).
            const valNode = path.node.value
            const classStr = t.isStringLiteral(valNode)
                ? valNode.value
                : t.isJSXExpressionContainer(valNode) && t.isStringLiteral(valNode.expression)
                  ? valNode.expression.value
                  : null
            if (classStr === null) return

            // Find the worst-case arbitrary hex colour across all className tokens.
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

            // Only record a warning when the worst offender exceeds the threshold.
            if (worstDelta <= SYSTEMIZABLE_THRESHOLD) return

            const severity: LinterWarning['severity'] = worstDelta > 10 ? 'critical' : 'amber'
            const tokenLabel = worstMatch?.tokenPath ?? null
            warnings.set(nodeId, {
                id: nodeId,
                type: 'drift',
                severity,
                value: worstDelta,
                message: tokenLabel !== null
                    ? `ΔE ${worstDelta.toFixed(1)} – use ${tokenLabel}`
                    : `ΔE ${worstDelta.toFixed(1)} – no matching token`,
                nearestToken: tokenLabel,
                nearestTokenValue: worstMatch?.tokenValue ?? null,
            })
        },
    })

    return warnings
}
