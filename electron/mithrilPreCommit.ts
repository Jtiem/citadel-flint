/**
 * mithrilPreCommit.ts — electron/mithrilPreCommit.ts
 *
 * Commandment 17: Mithril Pre-Commit Check
 *
 * A self-contained, synchronous implementation of the CIEDE2000 color-drift
 * check for use inside the AI Orchestrator's validation loop (Phase M).
 *
 * Why a separate file (not importing flint-mcp/src/core/MithrilLinter.ts)?
 *   flint-mcp is a separate ESM package with its own node_modules resolution
 *   and build pipeline. Cross-package path imports are brittle and not permitted
 *   by the monorepo boundary rules. This module inlines the color-drift logic
 *   so the Electron main process has zero cross-boundary coupling.
 *
 * Scope: Only the color-drift visitor (MITHRIL-COL) is implemented here,
 * because it is the only visitor whose severity is driven by a continuous ΔE
 * score. The typography, spacing, shadow, and opacity visitors always produce
 * value=1 (a presence flag, not a ΔE), so they never trigger the ΔE > 2.0
 * rejection gate used in the orchestrator.
 *
 * Usage (synchronous — no async needed):
 *   import { checkClassNameForColorDrift } from './mithrilPreCommit.js'
 *   const violations = checkClassNameForColorDrift(classNameString, tokens)
 *   if (violations.length > 0) { ...reject... }
 */

// ── DesignToken shape (mirrors electron/token-types.ts + flint-mcp/src/types.ts) ──
// Kept local so this file has no cross-package imports.
export interface MithrilToken {
    token_path: string
    token_type: string
    token_value: string
}

export interface ColorViolation {
    /** The offending Tailwind arbitrary-color class, e.g. "bg-[#ff0000]" */
    className: string
    /** The raw hex value that caused the violation */
    hexValue: string
    /** CIEDE2000 ΔE distance from the nearest token color */
    deltaE: number
    /** token_path of the nearest matching token */
    nearestToken: string | null
    /** token_value (hex) of the nearest matching token */
    nearestTokenValue: string | null
}

// ── CIEDE2000 math (inlined from flint-mcp/src/core/MithrilLinter.ts) ────────
// Keeping this in sync with the MithrilLinter is Commandment 17's responsibility.
// Any change to the CIEDE2000 implementation in MithrilLinter.ts must be
// reflected here.

const RAD = Math.PI / 180

function hexToRgb(hex: string): [number, number, number] | null {
    const s = hex.trim().replace(/^#/, '')
    const expanded =
        s.length === 3 ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2] : s
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null
    return [
        parseInt(expanded.slice(0, 2), 16),
        parseInt(expanded.slice(2, 4), 16),
        parseInt(expanded.slice(4, 6), 16),
    ]
}

function srgbToLinear(c: number): number {
    const n = c / 255
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
}

function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
    return [
        r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
        r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
        r * 0.0193339 + g * 0.1191920 + b * 0.9503041,
    ]
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
    const Xn = 0.95047
    const Yn = 1.00000
    const Zn = 1.08883
    const epsilon = 0.008856
    const kappa = 903.3

    function f(val: number): number {
        return val > epsilon
            ? Math.pow(val, 1 / 3)
            : (kappa * val + 16) / 116
    }

    const fx = f(x / Xn)
    const fy = f(y / Yn)
    const fz = f(z / Zn)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function hexToLab(hex: string): [number, number, number] | null {
    const rgb = hexToRgb(hex)
    if (rgb === null) return null
    const [lr, lg, lb] = rgb.map(srgbToLinear) as [number, number, number]
    const [x, y, z] = linearRgbToXyz(lr, lg, lb)
    return xyzToLab(x, y, z)
}

function deltaE2000(
    lab1: [number, number, number],
    lab2: [number, number, number],
): number {
    const [L1, a1, b1] = lab1
    const [L2, a2, b2] = lab2

    const C1 = Math.sqrt(a1 * a1 + b1 * b1)
    const C2 = Math.sqrt(a2 * a2 + b2 * b2)
    const avgC7 = Math.pow((C1 + C2) / 2, 7)
    const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))))

    const a1p = a1 * (1 + G)
    const a2p = a2 * (1 + G)
    const C1p = Math.sqrt(a1p * a1p + b1 * b1)
    const C2p = Math.sqrt(a2p * a2p + b2 * b2)

    let h1p = Math.atan2(b1, a1p) / RAD
    if (h1p < 0) h1p += 360
    let h2p = Math.atan2(b2, a2p) / RAD
    if (h2p < 0) h2p += 360

    const dLp = L2 - L1
    const dCp = C2p - C1p

    let dhp: number
    if (C1p * C2p === 0) {
        dhp = 0
    } else if (Math.abs(h2p - h1p) <= 180) {
        dhp = h2p - h1p
    } else {
        dhp = h2p > h1p ? h2p - h1p - 360 : h2p - h1p + 360
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD)

    const avgLp = (L1 + L2) / 2
    const avgCp = (C1p + C2p) / 2
    const avgCp7 = Math.pow(avgCp, 7)

    let avghp: number
    if (C1p * C2p === 0) {
        avghp = h1p + h2p
    } else if (Math.abs(h1p - h2p) <= 180) {
        avghp = (h1p + h2p) / 2
    } else {
        avghp =
            h1p + h2p < 360
                ? (h1p + h2p + 360) / 2
                : (h1p + h2p - 360) / 2
    }

    const T =
        1 -
        0.17 * Math.cos((avghp - 30) * RAD) +
        0.24 * Math.cos(2 * avghp * RAD) +
        0.32 * Math.cos((3 * avghp + 6) * RAD) -
        0.20 * Math.cos((4 * avghp - 63) * RAD)

    const SL =
        1 +
        (0.015 * (avgLp - 50) * (avgLp - 50)) /
            Math.sqrt(20 + (avgLp - 50) * (avgLp - 50))
    const SC = 1 + 0.045 * avgCp
    const SH = 1 + 0.015 * avgCp * T

    const dTheta = 30 * Math.exp(-Math.pow((avghp - 275) / 25, 2))
    const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)))
    const RT = -Math.sin(2 * dTheta * RAD) * RC

    return Math.sqrt(
        Math.pow(dLp / SL, 2) +
            Math.pow(dCp / SC, 2) +
            Math.pow(dHp / SH, 2) +
            RT * (dCp / SC) * (dHp / SH),
    )
}

// ── Arbitrary-color class regex (matches Tailwind arbitrary color values) ─────
// Examples: "bg-[#ff0000]", "text-[#abc]", "hover:border-[#123456]"
// Captures the hex value in group `hex`.
const ARBITRARY_COLOR_RE =
    /^(?:[\w-]+:)*[\w-]+-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

// ── Public threshold (mirrors MithrilLinter.MITHRIL_THRESHOLD) ────────────────
export const MITHRIL_THRESHOLD = 2.0

// ── Core check function ───────────────────────────────────────────────────────

/**
 * Checks a proposed className string for Mithril color-drift violations.
 *
 * Splits `classNameString` on whitespace, extracts any Tailwind arbitrary-color
 * classes (e.g. "bg-[#ff0000]"), computes CIEDE2000 ΔE against every color token,
 * and returns a violation for every class whose nearest-token distance exceeds
 * MITHRIL_THRESHOLD (2.0).
 *
 * This is synchronous — it performs no I/O.
 *
 * @param classNameString  The full className attribute value proposed by the AI.
 * @param tokens           All design tokens from the SQLite store (filtered to
 *                         `token_type === 'color'` internally).
 * @returns Array of ColorViolation objects, empty if the className is compliant.
 */
export function checkClassNameForColorDrift(
    classNameString: string,
    tokens: MithrilToken[],
): ColorViolation[] {
    const colorTokens = tokens.filter((t) => t.token_type === 'color')
    if (colorTokens.length === 0) return []

    const violations: ColorViolation[] = []

    for (const cls of classNameString.split(/\s+/)) {
        const m = ARBITRARY_COLOR_RE.exec(cls)
        if (m?.groups?.hex === undefined) continue

        const hexValue = m.groups.hex
        const targetLab = hexToLab(hexValue)
        if (targetLab === null) continue

        let best: { deltaE: number; tokenPath: string; tokenValue: string } | null = null
        for (const token of colorTokens) {
            const tokenLab = hexToLab(token.token_value)
            if (tokenLab === null) continue
            const de = deltaE2000(targetLab, tokenLab)
            if (best === null || de < best.deltaE) {
                best = {
                    deltaE: de,
                    tokenPath: token.token_path,
                    tokenValue: token.token_value,
                }
            }
        }

        if (best !== null && best.deltaE > MITHRIL_THRESHOLD) {
            violations.push({
                className: cls,
                hexValue,
                deltaE: best.deltaE,
                nearestToken: best.tokenPath,
                nearestTokenValue: best.tokenValue,
            })
        }
    }

    return violations
}

/**
 * Formats a list of ColorViolations into a single human-readable error string
 * suitable for feeding back to the AI as a tool_result.
 */
export function formatViolationsForAI(violations: ColorViolation[]): string {
    const parts = violations.map(
        (v) =>
            `'${v.className}' (ΔE=${v.deltaE.toFixed(1)}, nearest token: ${v.nearestToken ?? 'none'} = ${v.nearestTokenValue ?? 'N/A'})`,
    )
    return (
        `Mithril color-drift violation (Commandment 17). ` +
        `The following arbitrary color class(es) deviate from the design token set by more than ΔE 2.0: ` +
        parts.join('; ') +
        `. Replace these with token-aligned Tailwind classes. ` +
        `Call flint_read_tokens to find the correct class names.`
    )
}
