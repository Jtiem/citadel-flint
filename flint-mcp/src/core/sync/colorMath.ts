/**
 * SYNC.3 — Shared CIEDE2000 color math for sync violation checking.
 *
 * Extracted from MithrilLinter's inlined CIEDE2000 engine to avoid
 * circular dependencies. Both MithrilLinter and syncViolationChecker
 * need these functions.
 */

export const MITHRIL_THRESHOLD = 2.0

export function hexToRgb(hex: string): [number, number, number] | null {
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
    const kappa = 903.3
    function f(val: number): number {
        return val > epsilon ? Math.pow(val, 1 / 3) : (kappa * val + 16) / 116
    }
    const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function hexToLab(hex: string): [number, number, number] | null {
    const rgb = hexToRgb(hex)
    if (rgb === null) return null
    const [lr, lg, lb] = rgb.map(srgbToLinear) as [number, number, number]
    const [x, y, z] = linearRgbToXyz(lr, lg, lb)
    return xyzToLab(x, y, z)
}

const RAD = Math.PI / 180

export function deltaE2000(
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
        RT * (dCp / SC) * (dHp / SH),
    )
}
