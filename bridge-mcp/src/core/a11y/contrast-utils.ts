/**
 * contrast-utils — bridge-mcp/src/core/a11y/contrast-utils.ts
 *
 * WCAG 2.x contrast ratio and APCA Lc calculation utilities.
 *
 * All functions operate on hex color strings (#RGB, #RRGGBB, #RRGGBBAA).
 * Non-resolvable colors return null/false (conservative — no false positives,
 * per Risk R1 in the EXP.6 contract).
 */

// ── Hex parsing ───────────────────────────────────────────────────────────────

/**
 * Parses a hex color string into [r, g, b] components in the range [0, 255].
 * Supports #RGB, #RRGGBB, and #RRGGBBAA formats.
 * Returns null for invalid input.
 */
export function parseHex(hex: string): [number, number, number] | null {
    const clean = hex.replace(/^#/, '')

    if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16)
        const g = parseInt(clean[1] + clean[1], 16)
        const b = parseInt(clean[2] + clean[2], 16)
        if (isNaN(r) || isNaN(g) || isNaN(b)) return null
        return [r, g, b]
    }

    if (clean.length === 6 || clean.length === 8) {
        const r = parseInt(clean.slice(0, 2), 16)
        const g = parseInt(clean.slice(2, 4), 16)
        const b = parseInt(clean.slice(4, 6), 16)
        if (isNaN(r) || isNaN(g) || isNaN(b)) return null
        return [r, g, b]
    }

    return null
}

// ── WCAG 2.x relative luminance ───────────────────────────────────────────────

/**
 * Converts a linear sRGB component value (0–1) to linearized form.
 * Per WCAG 2.x formula (IEC 61966-2-1 sRGB transfer function).
 */
function linearize(c: number): number {
    const cs = c / 255
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

/**
 * Computes the relative luminance of a color.
 * Per WCAG 2.x: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * @param rgb [r, g, b] in [0, 255]
 * @returns Relative luminance in [0, 1]
 */
export function relativeLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb
    const R = linearize(r)
    const G = linearize(g)
    const B = linearize(b)
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Computes the WCAG 2.x contrast ratio between two colors.
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 >= L2.
 *
 * @param fg Foreground hex color string
 * @param bg Background hex color string
 * @returns Contrast ratio, or null if either color is invalid
 */
export function wcagContrastRatio(fg: string, bg: string): number | null {
    const fgRgb = parseHex(fg)
    const bgRgb = parseHex(bg)
    if (!fgRgb || !bgRgb) return null

    const L1 = relativeLuminance(fgRgb)
    const L2 = relativeLuminance(bgRgb)

    const lighter = Math.max(L1, L2)
    const darker = Math.min(L1, L2)

    return (lighter + 0.05) / (darker + 0.05)
}

// ── WCAG 2.x AA compliance check ─────────────────────────────────────────────

/**
 * Returns true if the contrast ratio meets WCAG 2.x AA requirements.
 *
 * AA thresholds:
 *   Normal text: 4.5:1
 *   Large text:  3.0:1
 *   UI components (non-text): 3.0:1
 *
 * @param ratio Contrast ratio from wcagContrastRatio()
 * @param isLargeText Whether the text qualifies as large text (>= 18pt or >= 14pt bold)
 */
export function meetsAA(ratio: number, isLargeText: boolean): boolean {
    return ratio >= (isLargeText ? 3.0 : 4.5)
}

/**
 * Returns true if the contrast ratio meets WCAG 2.x AAA requirements.
 *
 * AAA thresholds:
 *   Normal text: 7.0:1
 *   Large text:  4.5:1
 */
export function meetsAAA(ratio: number, isLargeText: boolean): boolean {
    return ratio >= (isLargeText ? 4.5 : 7.0)
}

// ── Large text detection ──────────────────────────────────────────────────────

/**
 * Tailwind text size class to approximate px mapping.
 * Based on Tailwind CSS v3 defaults (1rem = 16px).
 */
const TAILWIND_FONT_SIZE_PX: Record<string, number> = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
    '7xl': 72,
    '8xl': 96,
    '9xl': 128,
}

/**
 * Tailwind font weight class to numeric weight mapping.
 */
const TAILWIND_FONT_WEIGHT: Record<string, number> = {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
}

/**
 * Determines whether text qualifies as "large text" per WCAG 2.x.
 *
 * WCAG 2.x large text criteria:
 *   >= 18pt (24px) — any weight
 *   >= 14pt (18.67px) bold (weight >= 700)
 *
 * @param fontSize Tailwind size class (e.g., "text-xl") or CSS px value (e.g., "24px")
 * @param fontWeight Tailwind weight class (e.g., "font-bold") or CSS numeric (e.g., "700")
 */
export function isLargeText(fontSize: string | null, fontWeight: string | null): boolean {
    if (!fontSize) return false

    let sizePx: number | null = null

    // Tailwind class: "text-xl", "text-2xl", etc.
    const tailwindSizeMatch = /^text-(.+)$/.exec(fontSize)
    if (tailwindSizeMatch) {
        const sizeKey = tailwindSizeMatch[1]
        sizePx = TAILWIND_FONT_SIZE_PX[sizeKey] ?? null
    }

    // Arbitrary Tailwind: "text-[24px]"
    if (!sizePx) {
        const arbitraryPxMatch = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(fontSize)
        if (arbitraryPxMatch) {
            sizePx = parseFloat(arbitraryPxMatch[1])
        }
    }

    // Raw CSS px value: "24px"
    if (!sizePx) {
        const rawPxMatch = /^(\d+(?:\.\d+)?)px$/.exec(fontSize)
        if (rawPxMatch) {
            sizePx = parseFloat(rawPxMatch[1])
        }
    }

    // pt value: "18pt"
    if (!sizePx) {
        const ptMatch = /^(\d+(?:\.\d+)?)pt$/.exec(fontSize)
        if (ptMatch) {
            sizePx = parseFloat(ptMatch[1]) * (4 / 3) // 1pt = 4/3 px
        }
    }

    if (!sizePx) return false

    // >= 24px (18pt) is always large text
    if (sizePx >= 24) return true

    // >= 18.67px (14pt) + bold (weight >= 700)
    if (sizePx >= 18.67) {
        let weight: number | null = null

        if (fontWeight) {
            // Tailwind class: "font-bold", "font-semibold", etc.
            const tailwindWeightMatch = /^font-(.+)$/.exec(fontWeight)
            if (tailwindWeightMatch) {
                weight = TAILWIND_FONT_WEIGHT[tailwindWeightMatch[1]] ?? null
            }

            // Numeric: "700"
            if (!weight) {
                const numWeight = parseInt(fontWeight, 10)
                if (!isNaN(numWeight)) weight = numWeight
            }
        }

        if (weight !== null && weight >= 700) return true
    }

    return false
}

// ── APCA Lc (WCAG 3.0 draft) ──────────────────────────────────────────────────

/**
 * Computes the APCA (Advanced Perceptual Contrast Algorithm) Lc value.
 *
 * Based on APCA W3 version 0.1.9 (WCAG 3.0 public working draft).
 * Reference: https://github.com/Myndex/SAPC-APCA
 *
 * Lc values:
 *   >= 90: Very high contrast (equivalent to AAA)
 *   >= 75: High contrast (equivalent to AA for normal text)
 *   >= 60: Medium contrast (equivalent to AA for large text)
 *   >= 45: Low contrast (informational use only)
 *
 * @param fg Foreground hex color
 * @param bg Background hex color
 * @returns Lc value (signed float), or null if colors are invalid
 */
export function apcaLc(fg: string, bg: string): number | null {
    const fgRgb = parseHex(fg)
    const bgRgb = parseHex(bg)
    if (!fgRgb || !bgRgb) return null

    // APCA exponents
    const normBG = 0.56
    const normTXT = 0.57
    const revTXT = 0.62
    const revBG = 0.65
    const scaleBoW = 1.14
    const scaleWoB = 1.14
    const loClip = 0.1
    const deltaYmin = 0.0005

    function apcaLinearize(c: number): number {
        const cs = c / 255
        return Math.pow(cs, 2.4)
    }

    function apcaLuminance(rgb: [number, number, number]): number {
        const [r, g, b] = rgb
        return (
            0.2126729 * apcaLinearize(r) +
            0.7151522 * apcaLinearize(g) +
            0.0721750 * apcaLinearize(b)
        )
    }

    const Ytxt = apcaLuminance(fgRgb)
    const Ybg = apcaLuminance(bgRgb)

    if (Math.abs(Ybg - Ytxt) < deltaYmin) return 0

    let Lc: number

    if (Ybg >= Ytxt) {
        // Dark text on light background
        const Sapc = (Math.pow(Ybg, normBG) - Math.pow(Ytxt, normTXT)) * scaleBoW
        Lc = Sapc < loClip ? 0 : Sapc * 100
    } else {
        // Light text on dark background
        const Sapc = (Math.pow(Ybg, revBG) - Math.pow(Ytxt, revTXT)) * scaleWoB
        Lc = Sapc > -loClip ? 0 : Sapc * 100
    }

    return Math.round(Lc * 10) / 10
}

// ── Color extraction from Tailwind classes ────────────────────────────────────

/**
 * Extracts a hex color value from a Tailwind arbitrary color class.
 * Supports: text-[#hex], bg-[#hex], border-[#hex], etc.
 * Returns null if the class is not an arbitrary hex color.
 */
export function extractHexFromArbitraryClass(cls: string): string | null {
    const match = /\[#([0-9a-fA-F]{3,8})\]/.exec(cls)
    if (match) return `#${match[1]}`
    return null
}

/**
 * Extracts foreground and background colors from a list of Tailwind class names.
 * Returns { foreground, background, fontSize, fontWeight } with nulls for
 * unresolvable values.
 *
 * Only statically resolvable arbitrary hex colors are returned (e.g., `text-[#fff]`).
 * Named color classes (e.g., `text-red-500`) are not resolved here — they require
 * token lookup.
 */
export function extractColorContext(classNames: string[]): {
    foreground: string | null
    background: string | null
    fontSize: string | null
    fontWeight: string | null
} {
    let foreground: string | null = null
    let background: string | null = null
    let fontSize: string | null = null
    let fontWeight: string | null = null

    for (const cls of classNames) {
        // Foreground color: text-[#hex]
        if (cls.startsWith('text-[#') || cls.startsWith('text-[')) {
            const hex = extractHexFromArbitraryClass(cls)
            if (hex) foreground = hex
        }

        // Background color: bg-[#hex]
        if (cls.startsWith('bg-[#') || cls.startsWith('bg-[')) {
            const hex = extractHexFromArbitraryClass(cls)
            if (hex) background = hex
        }

        // Font size: text-{size} (not text-[...])
        if (/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(cls)) {
            fontSize = cls
        }

        // Arbitrary font size: text-[24px], text-[1.5rem]
        if (/^text-\[\d/.test(cls)) {
            fontSize = cls
        }

        // Font weight: font-{weight}
        if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(cls)) {
            fontWeight = cls
        }
    }

    return { foreground, background, fontSize, fontWeight }
}
