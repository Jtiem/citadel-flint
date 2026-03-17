/**
 * IngestionAuditor.ts — electron/ingestion/IngestionAuditor.ts
 *
 * Phase ING.1 — Ingestion-Time Audit & Auto-Heal
 *
 * Core heal logic for the Bridge ingestion pipeline. Runs entirely in the
 * main process (electron/). Must NOT import from src/.
 *
 * Responsibilities:
 *   1. classifyViolation() — tiers arbitrary values against design tokens
 *   2. heal()              — Babel AST visitor, classifies all arbitrary values,
 *                            applies tier-1 fixes in-place, returns IngestionHealResult
 *
 * Commandment compliance:
 *   C4  — Local-First: zero external calls
 *   C7  — ID Preservation: className surgery only, no structural mutations
 *   C9  — CIEDE2000 for color distance (not Euclidean RGB)
 *   C13 — Babel AST traversal for className extraction (no regex on source code)
 *   C14 — No direct fs.writeFile; writes via FileTransactionManager at call site
 *
 * Performance target: < 200ms for a 50-node component
 */

import * as parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

// ESM/CJS interop for traverse and generate
// Both packages export a default that may be wrapped in a .default property
type TraverseFn = typeof import('@babel/traverse').default
type GenerateFn = typeof import('@babel/generator').default
const traverse: TraverseFn = ((_traverse as unknown as { default: TraverseFn }).default ?? _traverse) as TraverseFn
const generate: GenerateFn = ((_generate as unknown as { default: GenerateFn }).default ?? _generate) as GenerateFn

// ── Design Token shape (self-contained — no cross-boundary imports) ────────────

export interface AuditorToken {
    token_path: string
    token_type: string
    token_value: string
    mode?: string
    collection_name?: string
}

// ── ING Type contracts (mirrors src/types/bridge-api.d.ts exactly) ────────────

export type IngestionTier = 'tier1' | 'tier2' | 'tier3'

export interface IngestionHealResult {
    healedCode: string
    summary: IngestionSummary
}

export interface IngestionSummary {
    totalValues: number
    tier1Fixed: IngestionFix[]
    tier2Flagged: IngestionFlag[]
    tier3Unknown: number
    healTimeMs: number
    preHealCode: string
}

export interface IngestionFix {
    nodeId: string
    ruleId: string
    originalValue: string
    fixedToToken: string
    fixedToClass: string
}

export interface IngestionFlag {
    nodeId: string
    ruleId: string
    originalValue: string
    suggestedToken: string
    suggestedClass: string
    distance: number
    distanceUnit: 'deltaE' | 'px'
}

// ── CIEDE2000 math (inlined — no cross-package imports) ───────────────────────
// Kept in sync with electron/mithrilPreCommit.ts and bridge-mcp/src/core/MithrilLinter.ts

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

// ── Thresholds ────────────────────────────────────────────────────────────────

/** CIEDE2000 tier boundary: exact match (tier1) vs near-match (tier2) */
export const TIER1_DELTA_E = 0.0
/** CIEDE2000 tier boundary: near-match (tier2) vs unknown (tier3) */
export const TIER2_DELTA_E = 2.0
/** Pixel tolerance for spacing: exact match */
export const TIER1_PX_DIFF = 0
/** Pixel tolerance for spacing: near-match */
export const TIER2_PX_DIFF = 1
/** Typography size tolerance for near-match (px) */
export const TIER2_TYPO_PX = 2
/** Auto-fix cap: if more than this many violations, skip tier-1 mutations */
export const VIOLATION_CAP = 100

// ── Regex patterns (detect arbitrary Tailwind values) ─────────────────────────
// These match the patterns used in bridge-mcp/src/core/MithrilLinter.ts

/** Arbitrary color: bg-[#hex], text-[#hex], border-[#hex], etc. */
const ARBITRARY_COLOR_RE =
    /(?:^|(?<=\s))(?:[\w-]+:)*(?:bg|text|border|fill|stroke|from|via|to|ring|outline|caret|accent|decoration)-\[#([0-9a-fA-F]{3,8})\](?=\s|$)/g

/** Arbitrary spacing/dimension: gap-[Npx], p-[Npx], m-[Npx], w-[Npx], h-[Npx], etc. */
const ARBITRARY_SPACING_RE =
    /(?:^|(?<=\s))(?:[\w-]+:)*(?:gap|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|min-h|max-w|max-h|space-x|space-y|rounded|top|right|bottom|left|inset|translate-x|translate-y)-\[(\d+(?:\.\d+)?)(px|rem|em)\](?=\s|$)/g

/** Arbitrary font size: text-[Npx] */
const ARBITRARY_FONT_SIZE_RE =
    /(?:^|(?<=\s))(?:[\w-]+:)*text-\[(\d+(?:\.\d+)?)(px|rem|em)\](?=\s|$)/g

/** Arbitrary opacity: opacity-[N] */
const ARBITRARY_OPACITY_RE =
    /(?:^|(?<=\s))(?:[\w-]+:)*opacity-\[(\d+(?:\.\d+)?%?)\](?=\s|$)/g

/** Arbitrary shadow: shadow-[...] */
const ARBITRARY_SHADOW_RE =
    /(?:^|(?<=\s))(?:[\w-]+:)*shadow-\[([^\]]+)\](?=\s|$)/g

// ── Token path → Tailwind class reverse mapping ───────────────────────────────

/**
 * Maps the last two segments of a token_path to a Tailwind color class fragment.
 * e.g. "color.blue.500" → "blue-500"
 *      "brand.primary"  → "brand-primary"
 * Returns null when the mapping cannot be resolved deterministically.
 */
function tokenPathToColorFragment(tokenPath: string): string | null {
    const segments = tokenPath.split(/[.\-/]/).filter(Boolean)
    if (segments.length < 2) return null
    // Drop the leading "color" or "colors" segment if present
    const meaningful = segments[0].toLowerCase() === 'color' || segments[0].toLowerCase() === 'colors'
        ? segments.slice(1)
        : segments
    if (meaningful.length < 1) return null
    // Use last two meaningful segments: "blue" + "500" → "blue-500"
    const tail = meaningful.slice(-2)
    return tail.join('-').toLowerCase()
}

/**
 * Given the original arbitrary-value class (e.g. "bg-[#3B82F6]") and the
 * token color fragment (e.g. "blue-500"), compose the replacement class:
 * "bg-blue-500".
 *
 * Returns null if the prefix cannot be extracted.
 */
function buildColorClass(arbitraryClass: string, colorFragment: string): string | null {
    // Extract the utility prefix (everything before the [-[#hex]] part)
    // Handles variants like "hover:", "dark:", etc.
    const prefixMatch = arbitraryClass.match(/^((?:[\w-]+:)*)([a-z-]+)-\[#[0-9a-fA-F]{3,8}\]$/)
    if (!prefixMatch) return null
    const variantPrefix = prefixMatch[1] ?? '' // e.g. "hover:" or ""
    const utilityPrefix = prefixMatch[2]       // e.g. "bg", "text", "border"
    return `${variantPrefix}${utilityPrefix}-${colorFragment}`
}

/**
 * Given the original arbitrary spacing class (e.g. "gap-[16px]") and the
 * token_path (e.g. "spacing.4"), compose the replacement class: "gap-4".
 * Returns null when the mapping cannot be resolved.
 */
function buildSpacingClass(arbitraryClass: string, tokenPath: string): string | null {
    const segments = tokenPath.split(/[.\-/]/).filter(Boolean)
    const meaningful = segments[0].toLowerCase() === 'spacing'
        ? segments.slice(1)
        : segments
    if (meaningful.length === 0) return null
    const scaleValue = meaningful[meaningful.length - 1]

    const prefixMatch = arbitraryClass.match(/^((?:[\w-]+:)*)([a-z-]+)-\[\d+(?:\.\d+)?(?:px|rem|em)\]$/)
    if (!prefixMatch) return null
    const variantPrefix = prefixMatch[1] ?? ''
    const utilityPrefix = prefixMatch[2]
    return `${variantPrefix}${utilityPrefix}-${scaleValue}`
}

// ── Core classification result ─────────────────────────────────────────────────

interface ClassificationResult {
    tier: IngestionTier
    distance?: number
    distanceUnit?: 'deltaE' | 'px'
    matchedToken?: AuditorToken
    replacementClass?: string
}

// ── classifyViolation ─────────────────────────────────────────────────────────

/**
 * Classifies a single arbitrary value against the token set into tier 1/2/3.
 *
 * Classification logic (from contract Section 2.3):
 *   Color (hex):
 *     - deltaE = 0.0            → tier1 (exact match)
 *     - 0.0 < deltaE <= 2.0    → tier2 (near-match)
 *     - deltaE > 2.0            → tier3 (too far)
 *   Spacing (px value, dimension token):
 *     - px diff = 0             → tier1
 *     - px diff <= 1            → tier2
 *     - no token or px diff > 1 → tier3
 *   Typography (font-size, dimension token):
 *     - exact value match       → tier1
 *     - size diff <= 2px        → tier2
 *     - no token                → tier3
 *   Shadow / Opacity:
 *     - exact match             → tier1
 *     - no exact match          → tier3 (no fuzzy matching)
 */
export function classifyViolation(
    type: 'color' | 'spacing' | 'typography' | 'shadow' | 'opacity',
    rawValue: string,
    arbitraryClass: string,
    tokens: AuditorToken[],
): ClassificationResult {
    if (type === 'color') {
        const targetHex = rawValue.startsWith('#') ? rawValue : `#${rawValue}`
        const targetLab = hexToLab(targetHex)
        if (targetLab === null) return { tier: 'tier3' }

        const colorTokens = tokens.filter((t) => t.token_type === 'color')
        if (colorTokens.length === 0) return { tier: 'tier3' }

        let bestDeltaE = Infinity
        let bestToken: AuditorToken | null = null

        for (const token of colorTokens) {
            const tokenLab = hexToLab(token.token_value)
            if (tokenLab === null) continue
            const de = deltaE2000(targetLab, tokenLab)
            if (de < bestDeltaE) {
                bestDeltaE = de
                bestToken = token
            }
        }

        if (bestToken === null) return { tier: 'tier3' }

        const fragment = tokenPathToColorFragment(bestToken.token_path)
        const replacementClass = fragment ? buildColorClass(arbitraryClass, fragment) ?? undefined : undefined

        // Use a small epsilon for "exact" to handle floating-point comparisons
        if (bestDeltaE <= 0.01) {
            return {
                tier: 'tier1',
                distance: bestDeltaE,
                distanceUnit: 'deltaE',
                matchedToken: bestToken,
                replacementClass,
            }
        }
        if (bestDeltaE <= TIER2_DELTA_E) {
            return {
                tier: 'tier2',
                distance: bestDeltaE,
                distanceUnit: 'deltaE',
                matchedToken: bestToken,
                replacementClass,
            }
        }
        return { tier: 'tier3', distance: bestDeltaE, distanceUnit: 'deltaE', matchedToken: bestToken }
    }

    if (type === 'spacing') {
        // rawValue is the numeric portion (e.g. "16" from "16px")
        const targetPx = parseFloat(rawValue)
        if (isNaN(targetPx)) return { tier: 'tier3' }

        const dimTokens = tokens.filter((t) => t.token_type === 'dimension')
        if (dimTokens.length === 0) return { tier: 'tier3' }

        let bestDiff = Infinity
        let bestToken: AuditorToken | null = null

        for (const token of dimTokens) {
            // token_value may be "16px", "1rem", or bare "16"
            const tokenPx = parsePxValue(token.token_value)
            if (tokenPx === null) continue
            const diff = Math.abs(targetPx - tokenPx)
            if (diff < bestDiff) {
                bestDiff = diff
                bestToken = token
            }
        }

        if (bestToken === null) return { tier: 'tier3' }

        const replacementClass = buildSpacingClass(arbitraryClass, bestToken.token_path) ?? undefined

        if (bestDiff <= TIER1_PX_DIFF) {
            return { tier: 'tier1', distance: bestDiff, distanceUnit: 'px', matchedToken: bestToken, replacementClass }
        }
        if (bestDiff <= TIER2_PX_DIFF) {
            return { tier: 'tier2', distance: bestDiff, distanceUnit: 'px', matchedToken: bestToken, replacementClass }
        }
        return { tier: 'tier3', distance: bestDiff, distanceUnit: 'px', matchedToken: bestToken }
    }

    if (type === 'typography') {
        const targetPx = parseFloat(rawValue)
        if (isNaN(targetPx)) return { tier: 'tier3' }

        const dimTokens = tokens.filter((t) =>
            t.token_type === 'dimension' || t.token_type === 'fontFamily' || t.token_type === 'lineHeight'
        )
        if (dimTokens.length === 0) return { tier: 'tier3' }

        let bestDiff = Infinity
        let bestToken: AuditorToken | null = null

        for (const token of dimTokens) {
            const tokenPx = parsePxValue(token.token_value)
            if (tokenPx === null) continue
            const diff = Math.abs(targetPx - tokenPx)
            if (diff < bestDiff) {
                bestDiff = diff
                bestToken = token
            }
        }

        if (bestToken === null) return { tier: 'tier3' }

        if (bestDiff <= TIER1_PX_DIFF) {
            return { tier: 'tier1', distance: bestDiff, distanceUnit: 'px', matchedToken: bestToken }
        }
        if (bestDiff <= TIER2_TYPO_PX) {
            return { tier: 'tier2', distance: bestDiff, distanceUnit: 'px', matchedToken: bestToken }
        }
        return { tier: 'tier3', distance: bestDiff, distanceUnit: 'px', matchedToken: bestToken }
    }

    if (type === 'shadow') {
        const shadowTokens = tokens.filter((t) => t.token_type === 'shadow')
        for (const token of shadowTokens) {
            if (token.token_value === rawValue) {
                return { tier: 'tier1', matchedToken: token }
            }
        }
        return { tier: 'tier3' }
    }

    if (type === 'opacity') {
        const opacityTokens = tokens.filter((t) => t.token_type === 'opacity')
        for (const token of opacityTokens) {
            if (token.token_value === rawValue) {
                return { tier: 'tier1', matchedToken: token }
            }
        }
        return { tier: 'tier3' }
    }

    return { tier: 'tier3' }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parses a CSS length value to pixels. Supports: "16px", "1rem" (→16px), bare "16".
 */
function parsePxValue(value: string): number | null {
    const trimmed = value.trim()
    const pxMatch = trimmed.match(/^(\d+(?:\.\d+)?)px$/)
    if (pxMatch) return parseFloat(pxMatch[1])
    const remMatch = trimmed.match(/^(\d+(?:\.\d+)?)rem$/)
    if (remMatch) return parseFloat(remMatch[1]) * 16
    const emMatch = trimmed.match(/^(\d+(?:\.\d+)?)em$/)
    if (emMatch) return parseFloat(emMatch[1]) * 16
    const bare = parseFloat(trimmed)
    if (!isNaN(bare)) return bare
    return null
}

// ── Visitor: find all arbitrary-value classes in a JSX element ────────────────

interface ArbitraryValueHit {
    type: 'color' | 'spacing' | 'typography' | 'shadow' | 'opacity'
    rawValue: string
    arbitraryClass: string
    fullClass: string
}

/**
 * Scans a className string and returns all detected arbitrary-value classes.
 * This replaces running auditAll() — it captures ALL arbitrary values (not just
 * violations above the threshold) so we can tier-classify everything including
 * exact matches that auditAll would ignore.
 *
 * Commandment 13 note: the regex patterns below are applied to the className
 * string value only (a plain string literal), not to TSX source code.
 */
function findArbitraryValues(className: string): ArbitraryValueHit[] {
    const hits: ArbitraryValueHit[] = []

    // Color: bg-[#hex], text-[#hex], etc.
    for (const cls of className.split(/\s+/)) {
        const colorMatch = cls.match(/^(?:[\w-]+:)*(?:bg|text|border|fill|stroke|from|via|to|ring|outline|caret|accent|decoration)-\[(#[0-9a-fA-F]{3,8})\]$/)
        if (colorMatch) {
            hits.push({ type: 'color', rawValue: colorMatch[1], arbitraryClass: cls, fullClass: cls })
            continue
        }

        // Spacing: gap-[16px], p-[8px], etc.
        const spacingMatch = cls.match(/^(?:[\w-]+:)*(?:gap|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|min-h|max-w|max-h|space-x|space-y|rounded|top|right|bottom|left|inset|translate-x|translate-y)-\[(\d+(?:\.\d+)?)(px|rem|em)\]$/)
        if (spacingMatch) {
            hits.push({ type: 'spacing', rawValue: spacingMatch[1], arbitraryClass: cls, fullClass: cls })
            continue
        }

        // Typography (font-size): text-[16px]
        const fontSizeMatch = cls.match(/^(?:[\w-]+:)*text-\[(\d+(?:\.\d+)?)(px|rem|em)\]$/)
        if (fontSizeMatch) {
            hits.push({ type: 'typography', rawValue: fontSizeMatch[1], arbitraryClass: cls, fullClass: cls })
            continue
        }

        // Opacity: opacity-[50%] or opacity-[0.5]
        const opacityMatch = cls.match(/^(?:[\w-]+:)*opacity-\[(\d+(?:\.\d+)?%?)\]$/)
        if (opacityMatch) {
            hits.push({ type: 'opacity', rawValue: opacityMatch[1], arbitraryClass: cls, fullClass: cls })
            continue
        }

        // Shadow: shadow-[...]
        const shadowMatch = cls.match(/^(?:[\w-]+:)*shadow-\[([^\]]+)\]$/)
        if (shadowMatch) {
            hits.push({ type: 'shadow', rawValue: shadowMatch[1], arbitraryClass: cls, fullClass: cls })
        }
    }

    // Remove potential duplicates (font-size text-[Npx] vs. text-[color] are mutually exclusive above)
    return hits
}

// ── heal() ───────────────────────────────────────────────────────────────────

/**
 * Core entry point for the ingestion heal pass.
 *
 * Safety guarantees:
 *   - Empty token list → no-op (returns code unchanged, empty summary)
 *   - > VIOLATION_CAP violations → classify only (no AST mutations)
 *   - No structural mutations — className value surgery only (Commandment 7)
 *   - data-bridge-id attributes are never touched
 *
 * @param code   The hydrated JSX source code (with bridge IDs already injected)
 * @param tokens Design tokens read from SQLite at call time
 */
export function heal(code: string, tokens: AuditorToken[]): IngestionHealResult {
    const startMs = performance.now()
    const preHealCode = code

    const noOpSummary = (): IngestionSummary => ({
        totalValues: 0,
        tier1Fixed: [],
        tier2Flagged: [],
        tier3Unknown: 0,
        healTimeMs: performance.now() - startMs,
        preHealCode,
    })

    // Safety: empty token list → no-op
    if (tokens.length === 0) {
        return {
            healedCode: code,
            summary: noOpSummary(),
        }
    }

    // ── Phase 1: Parse to AST ────────────────────────────────────────────────
    let ast: t.File
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch {
        // Non-parseable code — return unchanged
        return {
            healedCode: code,
            summary: noOpSummary(),
        }
    }

    // ── Phase 2: Collect all arbitrary values via Babel visitor ──────────────
    // This is the Commandment 13 compliant traversal: we walk the AST to find
    // className StringLiterals, then apply findArbitraryValues() to their string
    // value (not to source code). No regex is applied to source code directly.

    interface PendingFix {
        nodeId: string
        originalClass: string
        replacementClass: string
        ruleId: string
        originalValue: string
        tokenPath: string
        stringLiteralPath: {
            node: t.StringLiteral
        }
    }

    const pending: PendingFix[] = []
    const tier2Items: IngestionFlag[] = []
    let tier3Count = 0
    let totalValues = 0

    // Map nodeId → JSXElement path for data-bridge-id lookup
    // We collect pending fixes keyed by the exact StringLiteral node reference
    // so we can mutate in-place during Phase 3.

    traverse(ast, {
        JSXOpeningElement(elementPath) {
            // Extract data-bridge-id from this element
            let nodeId = ''
            for (const attr of elementPath.node.attributes) {
                if (
                    t.isJSXAttribute(attr) &&
                    t.isJSXIdentifier(attr.name, { name: 'data-bridge-id' }) &&
                    t.isStringLiteral(attr.value)
                ) {
                    nodeId = attr.value.value
                    break
                }
            }

            // Find className attribute
            for (const attr of elementPath.node.attributes) {
                if (
                    !t.isJSXAttribute(attr) ||
                    !t.isJSXIdentifier(attr.name, { name: 'className' })
                ) continue

                // className="..." — StringLiteral value
                if (t.isStringLiteral(attr.value)) {
                    const hits = findArbitraryValues(attr.value.value)
                    for (const hit of hits) {
                        totalValues++
                        const result = classifyViolation(hit.type, hit.rawValue, hit.arbitraryClass, tokens)

                        if (result.tier === 'tier1' && result.matchedToken && result.replacementClass) {
                            pending.push({
                                nodeId,
                                originalClass: hit.fullClass,
                                replacementClass: result.replacementClass,
                                ruleId: ruleIdForType(hit.type),
                                originalValue: hit.rawValue,
                                tokenPath: result.matchedToken.token_path,
                                stringLiteralPath: { node: attr.value as t.StringLiteral },
                            })
                        } else if (result.tier === 'tier2' && result.matchedToken) {
                            const suggestedClass = result.replacementClass ?? ''
                            // Only flag if we can suggest a class
                            if (suggestedClass) {
                                tier2Items.push({
                                    nodeId,
                                    ruleId: ruleIdForType(hit.type),
                                    originalValue: hit.rawValue,
                                    suggestedToken: result.matchedToken.token_path,
                                    suggestedClass,
                                    distance: result.distance ?? 0,
                                    distanceUnit: result.distanceUnit ?? 'deltaE',
                                })
                            } else {
                                tier3Count++
                            }
                        } else {
                            tier3Count++
                        }
                    }
                }
            }
        },
    })

    // ── Phase 3: Apply tier-1 fixes (if under cap) ────────────────────────────
    const tier1Fixed: IngestionFix[] = []
    const violationCap = pending.length + tier2Items.length + tier3Count

    if (violationCap <= VIOLATION_CAP) {
        // Apply in-place AST mutations — replace class string within StringLiteral.value
        // This is surgical and safe: only className string values are modified.
        for (const fix of pending) {
            const strNode = fix.stringLiteralPath.node
            const currentValue = strNode.value
            // Replace all occurrences of the original arbitrary class
            const updatedValue = replaceClass(currentValue, fix.originalClass, fix.replacementClass)
            if (updatedValue !== currentValue) {
                strNode.value = updatedValue
                tier1Fixed.push({
                    nodeId: fix.nodeId,
                    ruleId: fix.ruleId,
                    originalValue: fix.originalValue,
                    fixedToToken: fix.tokenPath,
                    fixedToClass: fix.replacementClass,
                })
            }
        }
    } else {
        // Violation cap exceeded — classify only, no mutations
        // pending items are demoted to tier2 flags for reporting
        for (const fix of pending) {
            tier2Items.push({
                nodeId: fix.nodeId,
                ruleId: fix.ruleId,
                originalValue: fix.originalValue,
                suggestedToken: fix.tokenPath,
                suggestedClass: fix.replacementClass,
                distance: 0,
                distanceUnit: 'deltaE',
            })
        }
    }

    // ── Phase 4: Generate code from (possibly mutated) AST ────────────────────
    let healedCode = code
    if (tier1Fixed.length > 0) {
        try {
            const result = generate(ast, {
                retainLines: false,
                jsescOption: { minimal: true },
            }, code)
            healedCode = result.code
        } catch {
            // Generation failed — return original code, clear tier1 fixes
            healedCode = code
            tier1Fixed.length = 0
        }
    }

    const summary: IngestionSummary = {
        totalValues,
        tier1Fixed,
        tier2Flagged: tier2Items,
        tier3Unknown: tier3Count,
        healTimeMs: performance.now() - startMs,
        preHealCode,
    }

    return { healedCode, summary }
}

// ── snapToToken ───────────────────────────────────────────────────────────────

/**
 * Applies a single tier-2 "snap to token" fix to a source file in memory.
 *
 * Called by the `import:snap-to-token` IPC handler in `electron/main.ts` when
 * the user clicks "Snap" on an IngestionFlag in the ImportSummary panel.
 *
 * Algorithm:
 *   1. Parse `code` to a Babel AST (JSX + TypeScript).
 *   2. Find the JSXOpeningElement whose `data-bridge-id` matches `nodeId`.
 *   3. In that element's `className` StringLiteral, replace every occurrence of
 *      `originalClass` with `replacementClass`.
 *   4. Generate code from the (possibly mutated) AST and return it.
 *
 * Commandment compliance:
 *   C7  — data-bridge-id is read only (never mutated).
 *   C13 — Babel AST traversal for className surgery; no regex on source code.
 *
 * @param code            The current TSX source code of the file.
 * @param nodeId          The data-bridge-id value of the target element.
 * @param originalClass   The arbitrary-value Tailwind class to replace.
 * @param replacementClass  The token-based class to insert.
 * @returns  `{ ok: true, code: string }` on success,
 *           `{ ok: false, error: string }` on failure.
 */
export function snapToToken(
    code: string,
    nodeId: string,
    originalClass: string,
    replacementClass: string,
): { ok: true; code: string } | { ok: false; error: string } {
    // Parse
    let ast: t.File
    try {
        ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch (err) {
        return { ok: false, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` }
    }

    let mutated = false

    traverse(ast, {
        JSXOpeningElement(elementPath) {
            // Find the element with the matching data-bridge-id
            let matchesNodeId = false
            for (const attr of elementPath.node.attributes) {
                if (
                    t.isJSXAttribute(attr) &&
                    t.isJSXIdentifier(attr.name, { name: 'data-bridge-id' }) &&
                    t.isStringLiteral(attr.value) &&
                    attr.value.value === nodeId
                ) {
                    matchesNodeId = true
                    break
                }
            }
            if (!matchesNodeId) return

            // Find className attribute and apply the swap
            for (const attr of elementPath.node.attributes) {
                if (
                    t.isJSXAttribute(attr) &&
                    t.isJSXIdentifier(attr.name, { name: 'className' }) &&
                    t.isStringLiteral(attr.value)
                ) {
                    const before = attr.value.value
                    const after = replaceClass(before, originalClass, replacementClass)
                    if (after !== before) {
                        attr.value.value = after
                        mutated = true
                    }
                    break
                }
            }

            // Stop traversal once we've found and processed the target node
            if (mutated) elementPath.stop()
        },
    })

    if (!mutated) {
        return { ok: false, error: `Node '${nodeId}' not found or class '${originalClass}' not present` }
    }

    // Regenerate code from the mutated AST
    try {
        const result = generate(ast, { retainLines: false, jsescOption: { minimal: true } }, code)
        return { ok: true, code: result.code }
    } catch (err) {
        return { ok: false, error: `Code generation error: ${err instanceof Error ? err.message : String(err)}` }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Maps violation type to the Mithril rule ID string. */
function ruleIdForType(type: 'color' | 'spacing' | 'typography' | 'shadow' | 'opacity'): string {
    switch (type) {
        case 'color':      return 'MITHRIL-COL'
        case 'spacing':    return 'MITHRIL-SPC-001'
        case 'typography': return 'MITHRIL-TYP-001'
        case 'shadow':     return 'MITHRIL-SHD-001'
        case 'opacity':    return 'MITHRIL-OPC-001'
    }
}

/**
 * Replaces a single exact arbitrary class within a className string.
 * Operates on the string value only — not on source code.
 * Preserves all other classes and whitespace compression.
 */
function replaceClass(classString: string, original: string, replacement: string): string {
    return classString
        .split(/\s+/)
        .map((cls) => (cls === original ? replacement : cls))
        .filter(Boolean)
        .join(' ')
}
