/**
 * Token Mapper — electron/tokenMapper.ts
 *
 * Main-process mirror of the renderer's CIEDE2000 color-matching and
 * Tailwind class-mapping utilities.
 *
 * Mirrors:
 *   src/utils/tokenMatcher.ts  — hexToLab, deltaE2000, findClosestToken
 *   src/utils/classMapper.ts   — normalizePath, tokenToClass
 *
 * Why a mirror and not a shared import?
 *   The process boundary forbids main from importing `src/`. This module is
 *   pure math and string manipulation — no Node.js APIs, no SQLite — so it
 *   stays small and can be kept in sync manually when the renderer version
 *   is updated.
 *
 * Main Process only.
 */

import type { DesignToken, TokenType, ImportWarning } from './token-types.js'

// ── Thresholds ─────────────────────────────────────────────────────────────────

/** ΔE2000 < this value: colors are perceptually indistinguishable. */
export const SYSTEMIZABLE_THRESHOLD = 2.0

/** Snap tolerance in px for spacing/typography nearest-value matching. */
const SNAP_TOLERANCE_PX = 1

/** Snap tolerance in px for font-size nearest-value matching. */
const FONT_SNAP_TOLERANCE_PX = 2

// ── Hex parsing ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
    const s = hex.trim().replace(/^#/, '')
    const expanded = s.length === 3
        ? s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
        : s
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null
    return [
        parseInt(expanded.slice(0, 2), 16),
        parseInt(expanded.slice(2, 4), 16),
        parseInt(expanded.slice(4, 6), 16),
    ]
}

// ── sRGB → CIE L*a*b* ─────────────────────────────────────────────────────────

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
    const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
    const epsilon = 0.008856
    const kappa   = 903.3
    function f(t: number): number {
        return t > epsilon ? Math.pow(t, 1 / 3) : (kappa * t + 16) / 116
    }
    const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function hexToLab(hex: string): [number, number, number] | null {
    const rgb = hexToRgb(hex)
    if (rgb === null) return null
    const [lr, lg, lb] = rgb.map(srgbToLinear) as [number, number, number]
    const [x, y, z] = linearRgbToXyz(lr, lg, lb)
    return xyzToLab(x, y, z)
}

// ── CIEDE2000 ──────────────────────────────────────────────────────────────────

const RAD = Math.PI / 180

function deltaE2000(
    lab1: [number, number, number],
    lab2: [number, number, number]
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
        avghp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
    }

    const T =
        1
        - 0.17 * Math.cos((avghp - 30) * RAD)
        + 0.24 * Math.cos(2 * avghp * RAD)
        + 0.32 * Math.cos((3 * avghp + 6) * RAD)
        - 0.20 * Math.cos((4 * avghp - 63) * RAD)

    const SL = 1 + (0.015 * (avgLp - 50) * (avgLp - 50)) / Math.sqrt(20 + (avgLp - 50) * (avgLp - 50))
    const SC = 1 + 0.045 * avgCp
    const SH = 1 + 0.015 * avgCp * T

    const dTheta = 30 * Math.exp(-Math.pow((avghp - 275) / 25, 2))
    const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)))
    const RT = -Math.sin(2 * dTheta * RAD) * RC

    return Math.sqrt(
        Math.pow(dLp / SL, 2) +
        Math.pow(dCp / SC, 2) +
        Math.pow(dHp / SH, 2) +
        RT * (dCp / SC) * (dHp / SH)
    )
}

// ── Color matching ─────────────────────────────────────────────────────────────

export interface ColorMatch {
    tokenPath: string
    tokenValue: string
    deltaE: number
}

/**
 * Finds the design token whose color value is perceptually closest to `hex`
 * using CIEDE2000. Only considers tokens with token_type === 'color'.
 * Returns null if hex cannot be parsed or no color tokens exist.
 */
export function findClosestColorToken(
    hex: string,
    tokens: DesignToken[]
): ColorMatch | null {
    const targetLab = hexToLab(hex)
    if (targetLab === null) return null

    let best: ColorMatch | null = null
    for (const token of tokens) {
        if (token.token_type !== 'color') continue
        const tokenLab = hexToLab(token.token_value)
        if (tokenLab === null) continue
        const deltaE = deltaE2000(targetLab, tokenLab)
        if (best === null || deltaE < best.deltaE) {
            best = { tokenPath: token.token_path, tokenValue: token.token_value, deltaE }
        }
    }
    return best
}

// ── Dimension (spacing) matching ───────────────────────────────────────────────

export interface DimensionMatch {
    tokenPath: string
    tokenValue: string
    distance: number
}

/**
 * Finds the dimension token whose numeric value (in px) is closest to `px`.
 * Only considers tokens with token_type === 'dimension'.
 * Returns null if no dimension tokens exist.
 */
export function findClosestDimensionToken(
    px: number,
    tokens: DesignToken[]
): DimensionMatch | null {
    let best: DimensionMatch | null = null
    for (const token of tokens) {
        if (token.token_type !== 'dimension') continue
        const tokenPx = parseFloat(token.token_value)
        if (isNaN(tokenPx)) continue
        const distance = Math.abs(px - tokenPx)
        if (best === null || distance < best.distance) {
            best = { tokenPath: token.token_path, tokenValue: token.token_value, distance }
        }
    }
    return best
}

// ── Class mapping (mirrors src/utils/classMapper.ts) ──────────────────────────

const COLOR_STRIP = new Set(['color', 'colors'])
const DIM_STRIP = new Set(['spacing', 'dimension', 'dimensions'])
const FONT_FAMILY_STRIP = new Set(['fontFamily', 'font'])
const FONT_WEIGHT_STRIP = new Set(['fontWeight'])
const LINE_HEIGHT_STRIP = new Set(['lineHeight', 'leading'])
const LETTER_SPACING_STRIP = new Set(['letterSpacing', 'tracking'])
const SHADOW_STRIP = new Set(['shadow', 'boxShadow'])
const OPACITY_STRIP = new Set(['opacity'])

function getStripSet(tokenType: TokenType): ReadonlySet<string> | null {
    switch (tokenType) {
        case 'color': return COLOR_STRIP
        case 'dimension': return DIM_STRIP
        case 'fontFamily': return FONT_FAMILY_STRIP
        case 'fontWeight': return FONT_WEIGHT_STRIP
        case 'lineHeight': return LINE_HEIGHT_STRIP
        case 'letterSpacing': return LETTER_SPACING_STRIP
        case 'shadow': return SHADOW_STRIP
        case 'opacity': return OPACITY_STRIP
        default: return null
    }
}

export function normalizePath(tokenPath: string, tokenType: TokenType): string {
    const parts = tokenPath.split('.')
    const strip = getStripSet(tokenType)
    const effective =
        strip !== null && parts.length > 1 && strip.has(parts[0])
            ? parts.slice(1)
            : parts
    return effective.join('-')
}

export function tokenToTailwindClass(
    tokenPath: string,
    tokenType: TokenType,
    classPrefix: string
): string {
    return classPrefix + normalizePath(tokenPath, tokenType)
}

// ── Tailwind scale lookups ─────────────────────────────────────────────────────

/** Complete Tailwind v3 spacing scale: px value → scale unit string. */
const TAILWIND_SPACING_SCALE: ReadonlyMap<number, string> = new Map([
    [0, '0'], [1, 'px'], [2, '0.5'], [4, '1'], [6, '1.5'], [8, '2'], [10, '2.5'],
    [12, '3'], [14, '3.5'], [16, '4'], [20, '5'], [24, '6'], [28, '7'], [32, '8'],
    [36, '9'], [40, '10'], [44, '11'], [48, '12'], [56, '14'], [64, '16'],
    [80, '20'], [96, '24'], [112, '28'], [128, '32'], [144, '36'],
    [160, '40'], [176, '44'], [192, '48'], [208, '52'], [224, '56'],
    [240, '60'], [256, '64'], [288, '72'], [320, '80'], [384, '96'],
])

/**
 * 3-tier spacing resolution:
 * 1. Exact Tailwind scale match
 * 2. Nearest dimension token within any distance (returns token class)
 * 3. Nearest Tailwind scale snap within SNAP_TOLERANCE_PX
 * 4. null → caller emits arbitrary class + ImportWarning
 */
export function resolveSpacing(
    px: number,
    prefix: string,
    dimTokens: DesignToken[],
    nodeId: string,
    property: string,
    warnings: ImportWarning[]
): string {
    // 1. Exact Tailwind scale
    const exact = TAILWIND_SPACING_SCALE.get(px)
    if (exact !== undefined) return `${prefix}${exact}`

    // 2. Nearest dimension token
    const tokenMatch = findClosestDimensionToken(px, dimTokens)
    if (tokenMatch !== null && tokenMatch.distance <= SNAP_TOLERANCE_PX) {
        return tokenToTailwindClass(tokenMatch.tokenPath, 'dimension', prefix)
    }

    // 3. Nearest Tailwind scale snap within tolerance
    let bestScale: string | null = null
    let bestDist = Infinity
    for (const [scalePx, scaleUnit] of TAILWIND_SPACING_SCALE) {
        const dist = Math.abs(px - scalePx)
        if (dist < bestDist) { bestDist = dist; bestScale = scaleUnit }
    }
    if (bestScale !== null && bestDist <= SNAP_TOLERANCE_PX) {
        return `${prefix}${bestScale}`
    }

    // 4. Fallback — arbitrary class + warning
    const tailwindClass = `${prefix}[${px}px]`
    warnings.push({
        nodeId, property, figmaValue: `${px}px`, tailwindClass,
        reason: tokenMatch ? 'threshold-exceeded' : 'no-scale-match',
        nearestToken: tokenMatch?.tokenPath,
        distance: tokenMatch?.distance,
    })
    return tailwindClass
}

/** Tailwind font-size scale: px → class suffix */
const FONT_SIZE_SCALE: ReadonlyArray<[number, string]> = [
    [12, 'xs'], [14, 'sm'], [16, 'base'], [18, 'lg'], [20, 'xl'],
    [24, '2xl'], [30, '3xl'], [36, '4xl'], [48, '5xl'], [60, '6xl'],
    [72, '7xl'], [96, '8xl'], [128, '9xl'],
]

/**
 * Resolves a Figma font size to a Tailwind text-* class.
 * Snaps to the nearest scale entry within FONT_SNAP_TOLERANCE_PX.
 * Falls back to arbitrary text-[Npx] + ImportWarning.
 */
export function resolveFontSize(
    px: number,
    nodeId: string,
    warnings: ImportWarning[]
): string {
    // Exact match
    for (const [scalePx, suffix] of FONT_SIZE_SCALE) {
        if (scalePx === px) return `text-${suffix}`
    }
    // Nearest snap within tolerance
    let bestSuffix: string | null = null
    let bestDist = Infinity
    for (const [scalePx, suffix] of FONT_SIZE_SCALE) {
        const dist = Math.abs(px - scalePx)
        if (dist < bestDist) { bestDist = dist; bestSuffix = suffix }
    }
    if (bestSuffix !== null && bestDist <= FONT_SNAP_TOLERANCE_PX) {
        return `text-${bestSuffix}`
    }
    // Fallback
    const tailwindClass = `text-[${px}px]`
    warnings.push({
        nodeId, property: 'fontSize', figmaValue: String(px),
        tailwindClass, reason: 'no-scale-match',
    })
    return tailwindClass
}

/** Tailwind letter-spacing (tracking) scale: em value → class suffix */
const TRACKING_SCALE: ReadonlyArray<[number, string]> = [
    [-0.05, 'tighter'], [-0.025, 'tight'], [0, 'normal'],
    [0.025, 'wide'], [0.05, 'wider'], [0.1, 'widest'],
]

/**
 * Converts Figma letterSpacing (px) to a Tailwind tracking-* class.
 * Converts to em relative to fontSize first, then snaps to nearest scale.
 * Falls back to arbitrary tracking-[Nem] + ImportWarning.
 */
export function resolveLetterSpacing(
    letterSpacingPx: number,
    fontSizePx: number,
    nodeId: string,
    warnings: ImportWarning[]
): string {
    if (letterSpacingPx === 0) return 'tracking-normal'
    const em = fontSizePx > 0 ? letterSpacingPx / fontSizePx : 0
    let bestSuffix: string | null = null
    let bestDist = Infinity
    for (const [scaleEm, suffix] of TRACKING_SCALE) {
        const dist = Math.abs(em - scaleEm)
        if (dist < bestDist) { bestDist = dist; bestSuffix = suffix }
    }
    if (bestSuffix !== null && bestDist <= 0.01) {
        return `tracking-${bestSuffix}`
    }
    const emStr = em.toFixed(3)
    const tailwindClass = `tracking-[${emStr}em]`
    warnings.push({
        nodeId, property: 'letterSpacing', figmaValue: `${letterSpacingPx}px`,
        tailwindClass, reason: 'no-scale-match',
    })
    return tailwindClass
}

/** Tailwind line-height (leading) scale: ratio → class suffix */
const LEADING_SCALE: ReadonlyArray<[number, string]> = [
    [1, 'none'], [1.25, 'tight'], [1.375, 'snug'],
    [1.5, 'normal'], [1.625, 'relaxed'], [2, 'loose'],
]

/**
 * Converts Figma lineHeight (px) to a Tailwind leading-* class.
 * Converts to ratio relative to fontSize first, then snaps to nearest scale.
 * Falls back to arbitrary leading-[Npx] + ImportWarning.
 */
export function resolveLineHeight(
    lineHeightPx: number,
    fontSizePx: number,
    nodeId: string,
    warnings: ImportWarning[]
): string {
    const ratio = fontSizePx > 0 ? lineHeightPx / fontSizePx : lineHeightPx
    let bestSuffix: string | null = null
    let bestDist = Infinity
    for (const [scaleRatio, suffix] of LEADING_SCALE) {
        const dist = Math.abs(ratio - scaleRatio)
        if (dist < bestDist) { bestDist = dist; bestSuffix = suffix }
    }
    if (bestSuffix !== null && bestDist <= 0.05) {
        return `leading-${bestSuffix}`
    }
    const tailwindClass = `leading-[${lineHeightPx}px]`
    warnings.push({
        nodeId, property: 'lineHeight', figmaValue: `${lineHeightPx}px`,
        tailwindClass, reason: 'no-scale-match',
    })
    return tailwindClass
}

/** Extended corner radius scale: px → class. 9 entries covering Tailwind defaults. */
const RADIUS_SCALE: ReadonlyArray<[number, string]> = [
    [2, 'rounded-sm'], [4, 'rounded'], [6, 'rounded-md'], [8, 'rounded-lg'],
    [12, 'rounded-xl'], [16, 'rounded-2xl'], [24, 'rounded-3xl'], [9999, 'rounded-full'],
]

/**
 * Resolves a Figma cornerRadius to a Tailwind rounded-* class.
 * Snaps to nearest within SNAP_TOLERANCE_PX.
 * Falls back to arbitrary rounded-[Npx] + ImportWarning.
 */
export function resolveRadius(
    px: number,
    nodeId: string,
    warnings: ImportWarning[]
): string {
    for (const [scalePx, cls] of RADIUS_SCALE) {
        if (scalePx === px) return cls
    }
    let bestCls: string | null = null
    let bestDist = Infinity
    for (const [scalePx, cls] of RADIUS_SCALE) {
        const dist = Math.abs(px - scalePx)
        if (dist < bestDist) { bestDist = dist; bestCls = cls }
    }
    if (bestCls !== null && bestDist <= SNAP_TOLERANCE_PX) return bestCls

    const tailwindClass = `rounded-[${px}px]`
    warnings.push({
        nodeId, property: 'cornerRadius', figmaValue: `${px}px`,
        tailwindClass, reason: 'no-scale-match',
    })
    return tailwindClass
}

/** Snaps an opacity percentage to the nearest Tailwind opacity step. */
export function roundOpacity(pct: number): number {
    const steps = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100]
    return steps.reduce((prev, curr) =>
        Math.abs(curr - pct) < Math.abs(prev - pct) ? curr : prev
    )
}

// ── Color resolver with token matching + fallback ──────────────────────────────

/**
 * Resolves a hex color to the best Tailwind class:
 * 1. CIEDE2000 match within threshold → token class
 * 2. Fallback → arbitrary class + ImportWarning
 *
 * @param hex        Hex color string from Figma (e.g. '#4476f6')
 * @param prefix     Tailwind prefix: 'bg-' | 'text-' | 'border-'
 * @param colorTokens Design tokens with token_type === 'color'
 * @param nodeId     Figma node ID for warning attribution
 * @param property   Style property name for warning attribution
 * @param warnings   Accumulator for fallback warnings
 * @param opacity    Optional opacity value 0–100 for modern /opacity syntax
 */
export function resolveColor(
    hex: string,
    prefix: string,
    colorTokens: DesignToken[],
    nodeId: string,
    property: string,
    warnings: ImportWarning[],
    opacity?: number
): string {
    const match = findClosestColorToken(hex, colorTokens)
    if (match && match.deltaE < SYSTEMIZABLE_THRESHOLD) {
        const tokenClass = tokenToTailwindClass(match.tokenPath, 'color', prefix)
        // Append opacity using modern /opacity syntax if provided
        if (opacity !== undefined && opacity < 100) {
            const opacityPct = roundOpacity(opacity)
            return `${tokenClass}/${opacityPct}`
        }
        return tokenClass
    }

    // Fallback: arbitrary class
    const opacitySuffix = (opacity !== undefined && opacity < 100)
        ? `/${roundOpacity(opacity)}`
        : ''
    const tailwindClass = `${prefix}[${hex}]${opacitySuffix}`
    warnings.push({
        nodeId, property, figmaValue: hex, tailwindClass,
        reason: match ? 'threshold-exceeded' : 'no-token-match',
        nearestToken: match?.tokenPath,
        distance: match?.deltaE,
    })
    return tailwindClass
}
