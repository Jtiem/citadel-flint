/**
 * colorMath.ts — Module B.1: CIEDE2000 Perceptual Color Distance
 *
 * Pipeline: Hex → sRGB → Linear RGB → XYZ (D65) → CIE L*a*b* → ΔE₀₀
 *
 * No Euclidean approximations. Full CIEDE2000 formula per:
 *   Sharma et al. (2005) "The CIEDE2000 Color-Difference Formula"
 *   Color Research & Application, Vol. 30, No. 1, pp. 21-30.
 *
 * Mithril Safety threshold: ΔE > 2.0 → Amber warning in PropertiesPanel.
 */

// ─── Hex → sRGB ──────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace(/^#/, '')
    const expanded =
        clean.length === 3
            ? clean
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : clean
    const int = parseInt(expanded, 16)
    return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff]
}

// ─── sRGB → Linear RGB (IEC 61966-2-1 inverse gamma) ─────────────────────────

function srgbChannelToLinear(c8bit: number): number {
    const c = c8bit / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// ─── Linear RGB → XYZ D65 (sRGB primaries, IEC 61966-2-1 matrix) ─────────────
// Reference white D65: Xn = 0.95047, Yn = 1.00000, Zn = 1.08883

function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
    const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    return [X, Y, Z]
}

// ─── XYZ → CIE L*a*b* ────────────────────────────────────────────────────────

const D65_XN = 0.95047
const D65_YN = 1.00000
const D65_ZN = 1.08883

// CIE standard: f(t) = t^(1/3) for t > ε, linear approximation otherwise.
// ε = (6/29)³ ≈ 0.008856
const LAB_EPSILON = Math.pow(6 / 29, 3) // ≈ 0.008856
const LAB_KAPPA = Math.pow(29 / 6, 2) / 3 // = 841/108 ≈ 7.787

function labF(t: number): number {
    return t > LAB_EPSILON ? Math.cbrt(t) : LAB_KAPPA * t + 4 / 29
}

function xyzToLab(X: number, Y: number, Z: number): [number, number, number] {
    const fx = labF(X / D65_XN)
    const fy = labF(Y / D65_YN)
    const fz = labF(Z / D65_ZN)
    const L = 116 * fy - 16
    const a = 500 * (fx - fy)
    const b = 200 * (fy - fz)
    return [L, a, b]
}

// ─── Public: Hex → L*a*b* ────────────────────────────────────────────────────

/**
 * Converts a CSS hex colour string (3-digit or 6-digit, with or without `#`)
 * to a CIE L*a*b* triplet via the full sRGB → linearRGB → XYZ → Lab pipeline.
 *
 * @param hex  e.g. `"#3b82f6"`, `"3b82f6"`, `"#abc"`, `"abc"`
 * @returns    `[L, a, b]` — L in [0, 100], a/b in approximately [−128, 127]
 */
export function hexToLab(hex: string): [number, number, number] {
    const [r8, g8, b8] = hexToRgb(hex)
    const rLin = srgbChannelToLinear(r8)
    const gLin = srgbChannelToLinear(g8)
    const bLin = srgbChannelToLinear(b8)
    const [X, Y, Z] = linearRgbToXyz(rLin, gLin, bLin)
    return xyzToLab(X, Y, Z)
}

// ─── CIEDE2000 ────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180 // radians per degree

/** Converts degrees to radians. */
function rad(deg: number): number {
    return deg * DEG
}

/**
 * Normalises an angle (in degrees) to the range [0, 360).
 */
function normDeg(deg: number): number {
    return ((deg % 360) + 360) % 360
}

/**
 * Computes the full CIEDE2000 ΔE between two CIE L*a*b* colours.
 *
 * Uses the Sharma 2005 implementation with parametric factors kL = kC = kH = 1.
 * ΔE > 2.0 is the Mithril Safety amber threshold for perceptual drift.
 *
 * @param lab1  `[L, a, b]` for colour 1
 * @param lab2  `[L, a, b]` for colour 2
 * @returns     Non-negative perceptual distance (0 = identical)
 */
export function deltaE2000(
    lab1: [number, number, number],
    lab2: [number, number, number]
): number {
    const [L1, a1, b1] = lab1
    const [L2, a2, b2] = lab2

    // ── Step 1: C'ab and adjusted a' ─────────────────────────────────────────
    const C1 = Math.sqrt(a1 * a1 + b1 * b1)
    const C2 = Math.sqrt(a2 * a2 + b2 * b2)
    const Cbar = (C1 + C2) / 2
    const Cbar7 = Math.pow(Cbar, 7)
    const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))))

    const a1p = a1 * (1 + G)
    const a2p = a2 * (1 + G)

    const C1p = Math.sqrt(a1p * a1p + b1 * b1)
    const C2p = Math.sqrt(a2p * a2p + b2 * b2)

    // ── Step 2: h' ───────────────────────────────────────────────────────────
    const h1p = C1p === 0 ? 0 : normDeg(Math.atan2(b1, a1p) / DEG)
    const h2p = C2p === 0 ? 0 : normDeg(Math.atan2(b2, a2p) / DEG)

    // ── Step 3: ΔL', ΔC', ΔH' ────────────────────────────────────────────────
    const dLp = L2 - L1
    const dCp = C2p - C1p

    let dhp: number
    if (C1p * C2p === 0) {
        dhp = 0
    } else {
        const diff = h2p - h1p
        if (Math.abs(diff) <= 180) {
            dhp = diff
        } else if (diff > 180) {
            dhp = diff - 360
        } else {
            dhp = diff + 360
        }
    }

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2))

    // ── Step 4: Arithmetic means ──────────────────────────────────────────────
    const Lbarp = (L1 + L2) / 2
    const Cbarp = (C1p + C2p) / 2

    let Hbarp: number
    if (C1p * C2p === 0) {
        Hbarp = h1p + h2p
    } else if (Math.abs(h1p - h2p) <= 180) {
        Hbarp = (h1p + h2p) / 2
    } else if (h1p + h2p < 360) {
        Hbarp = (h1p + h2p + 360) / 2
    } else {
        Hbarp = (h1p + h2p - 360) / 2
    }

    // ── Step 5: Weighting functions ───────────────────────────────────────────
    const T =
        1 -
        0.17 * Math.cos(rad(Hbarp - 30)) +
        0.24 * Math.cos(rad(2 * Hbarp)) +
        0.32 * Math.cos(rad(3 * Hbarp + 6)) -
        0.20 * Math.cos(rad(4 * Hbarp - 63))

    const Lbarp50sq = Math.pow(Lbarp - 50, 2)
    const SL = 1 + (0.015 * Lbarp50sq) / Math.sqrt(20 + Lbarp50sq)
    const SC = 1 + 0.045 * Cbarp
    const SH = 1 + 0.015 * Cbarp * T

    // ── Step 6: Rotation term (RT) ────────────────────────────────────────────
    const Cbarp7 = Math.pow(Cbarp, 7)
    const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)))
    const dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2))
    const RT = -Math.sin(rad(2 * dTheta)) * RC

    // ── Step 7: Final ΔE₀₀ (kL = kC = kH = 1) ────────────────────────────────
    const termL = dLp / SL
    const termC = dCp / SC
    const termH = dHp / SH

    return Math.sqrt(
        termL * termL +
        termC * termC +
        termH * termH +
        RT * termC * termH
    )
}
