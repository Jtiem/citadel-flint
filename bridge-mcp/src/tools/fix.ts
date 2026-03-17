/**
 * bridge_fix tool handler — bridge-mcp/src/tools/fix.ts
 *
 * Auto-fixes detected Mithril violations by replacing arbitrary
 * hardcoded values with their nearest design token equivalents.
 *
 * Strategy:
 *   Pass 1 — Color drift: traverse JSX className attributes and inline style
 *             objects. For each hardcoded hex / rgb / hsl color, find the
 *             nearest design token via CIEDE2000. If ΔE > threshold, replace
 *             the value with var(--<token-css-name>).
 *   Pass 2 — Typography drift: arbitrary Tailwind bracket values for font-size,
 *             font-family, font-weight, line-height, letter-spacing. Replace
 *             with the first matching token value found in the token set.
 *   Pass 3 — Spacing drift: arbitrary bracket values for padding / margin /
 *             gap / size utilities. Replace with first matching dimension token.
 *
 * All code changes go through Babel parse → traverse → generate.
 * No regex mutation of source strings (Commandment 13).
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import fs from 'node:fs'
import path from 'node:path'
import type { BridgeConfig } from '../core/config.js'
import type { DesignToken } from '../types.js'
import { loadProjectContext } from '../core/projectContext.js'
import type { ProjectContext } from '../core/projectContext.js'

export type { ProjectContext }

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// @ts-ignore
const generate = _generate.default || _generate

// ── CIEDE2000 engine (inlined — matches MithrilLinter.ts exactly) ─────────────

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
    const Xn = 0.95047,
        Yn = 1.0,
        Zn = 1.08883
    const epsilon = 0.008856
    const kappa = 903.3
    function f(val: number): number {
        return val > epsilon ? Math.pow(val, 1 / 3) : (kappa * val + 16) / 116
    }
    const fx = f(x / Xn),
        fy = f(y / Yn),
        fz = f(z / Zn)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function hexToLab(hex: string): [number, number, number] | null {
    const rgb = hexToRgb(hex)
    if (rgb === null) return null
    const [lr, lg, lb] = rgb.map(srgbToLinear) as [number, number, number]
    const [x, y, z] = linearRgbToXyz(lr, lg, lb)
    return xyzToLab(x, y, z)
}

const RAD = Math.PI / 180

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
            h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
    }

    const T =
        1 -
        0.17 * Math.cos((avghp - 30) * RAD) +
        0.24 * Math.cos(2 * avghp * RAD) +
        0.32 * Math.cos((3 * avghp + 6) * RAD) -
        0.2 * Math.cos((4 * avghp - 63) * RAD)

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

// ── CSS color normalization ────────────────────────────────────────────────────

function clampByte(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)))
}

function toHex(r: number, g: number, b: number): string {
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const a = s * Math.min(l, 1 - l)
    function f(n: number): number {
        const k = (n + h / 30) % 12
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    return [clampByte(f(0) * 255), clampByte(f(8) * 255), clampByte(f(4) * 255)]
}

function cssColorToHex(value: string): string | null {
    const s = value.trim()
    const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s)
    if (hexMatch !== null) {
        const h = hexMatch[1]!
        const expanded =
            h.length === 3 ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : h
        return `#${expanded.toLowerCase()}`
    }
    const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(s)
    if (rgbMatch !== null) {
        return toHex(
            clampByte(parseInt(rgbMatch[1]!, 10)),
            clampByte(parseInt(rgbMatch[2]!, 10)),
            clampByte(parseInt(rgbMatch[3]!, 10)),
        )
    }
    const hslMatch = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/.exec(s)
    if (hslMatch !== null) {
        const [r, g, b] = hslToRgb(
            parseFloat(hslMatch[1]!),
            parseFloat(hslMatch[2]!) / 100,
            parseFloat(hslMatch[3]!) / 100,
        )
        return toHex(r, g, b)
    }
    return null
}

// ── Token CSS variable name helper ────────────────────────────────────────────

/**
 * Convert a token_path like "color/primary/500" to a CSS custom property
 * name like "--color-primary-500". Slashes become hyphens.
 */
function tokenPathToVar(tokenPath: string): string {
    return '--' + tokenPath.replace(/\//g, '-')
}

// ── Nearest color token finder ────────────────────────────────────────────────

interface ColorTokenMatch {
    token: DesignToken
    deltaE: number
}

function findNearestColorToken(
    hexValue: string,
    tokens: DesignToken[],
): ColorTokenMatch | null {
    const targetLab = hexToLab(hexValue)
    if (targetLab === null) return null

    const colorTokens = tokens.filter((t) => t.token_type === 'color')
    if (colorTokens.length === 0) return null

    let best: ColorTokenMatch | null = null
    for (const token of colorTokens) {
        const tokenLab = hexToLab(token.token_value)
        if (tokenLab === null) continue
        const deltaE = deltaE2000(targetLab, tokenLab)
        if (best === null || deltaE < best.deltaE) {
            best = { token, deltaE }
        }
    }
    return best
}

// ── Tailwind arbitrary-value regexes ─────────────────────────────────────────

const ARBITRARY_COLOR_RE = /^((?:[\w-]+:)*)[\w-]+-\[(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\]$/
const TYP_REGEXES: ReadonlyArray<{
    re: RegExp
    tokenType: DesignToken['token_type']
}> = [
    { re: /^((?:[\w-]+:)*)font-\[([^\]]+)\]$/, tokenType: 'fontFamily' },
    { re: /^((?:[\w-]+:)*)text-\[([\d.]+(?:px|rem|em|%|vw|vh))\]$/, tokenType: 'dimension' },
    { re: /^((?:[\w-]+:)*)font-\[(\d{3})\]$/, tokenType: 'fontWeight' },
    { re: /^((?:[\w-]+:)*)leading-\[([^\]]+)\]$/, tokenType: 'lineHeight' },
    { re: /^((?:[\w-]+:)*)tracking-\[([^\]]+)\]$/, tokenType: 'letterSpacing' },
]
const SPACING_RE = /^((?:[\w-]+:)*)(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h)-\[([\d.]+(?:px|rem|em|%|vw|vh))\]$/

// ── Fix a className string — returns [newClassString, fixCount] ───────────────

function fixClassString(
    classStr: string,
    tokens: DesignToken[],
    deltaEThreshold: number,
): [string, number] {
    const classes = classStr.split(/\s+/)
    let fixes = 0

    const fixed = classes.map((cls) => {
        // Color drift fix
        const colorMatch = ARBITRARY_COLOR_RE.exec(cls)
        if (colorMatch !== null) {
            const prefix = colorMatch[1] ?? ''
            const rawColor = colorMatch[2] ?? ''
            const hex = cssColorToHex(rawColor)
            if (hex !== null) {
                const nearest = findNearestColorToken(hex, tokens)
                if (nearest !== null && nearest.deltaE > deltaEThreshold) {
                    const cssVar = `var(${tokenPathToVar(nearest.token.token_path)})`
                    // Rebuild the class with the utility prefix but replace the
                    // arbitrary bracket value with a token reference comment.
                    // Since CSS vars in Tailwind arbitrary values must be wrapped in
                    // brackets, the replacement becomes e.g. bg-[var(--color-primary)]
                    const utilityPart = cls.slice(prefix.length)
                    const utilityName = utilityPart.slice(0, utilityPart.indexOf('-['))
                    fixes++
                    return `${prefix}${utilityName}-[${cssVar}]`
                }
            }
        }

        // Typography drift fix
        for (const { re, tokenType } of TYP_REGEXES) {
            const m = re.exec(cls)
            if (m !== null) {
                const prefix = m[1] ?? ''
                const rawVal = m[2] ?? ''
                const typeTokens = tokens.filter((t) => t.token_type === tokenType)
                const matchingToken = typeTokens.find(
                    (t) => t.token_value.toLowerCase() === rawVal.toLowerCase(),
                )
                if (matchingToken === undefined && typeTokens.length > 0) {
                    // Replace with first available token value as CSS var
                    const firstToken = typeTokens[0]!
                    const utilityPart = cls.slice(prefix.length)
                    const utilityName = utilityPart.slice(0, utilityPart.indexOf('-['))
                    const cssVar = `var(${tokenPathToVar(firstToken.token_path)})`
                    fixes++
                    return `${prefix}${utilityName}-[${cssVar}]`
                }
            }
        }

        // Spacing drift fix
        const spacingMatch = SPACING_RE.exec(cls)
        if (spacingMatch !== null) {
            const prefix = spacingMatch[1] ?? ''
            const rawVal = spacingMatch[2] ?? ''
            const dimTokens = tokens.filter((t) => t.token_type === 'dimension')
            const hasMatch = dimTokens.some(
                (t) => t.token_value === rawVal || t.token_value === rawVal.replace('px', ''),
            )
            if (!hasMatch && dimTokens.length > 0) {
                const firstToken = dimTokens[0]!
                const utilityPart = cls.slice(prefix.length)
                const utilityName = utilityPart.slice(0, utilityPart.indexOf('-['))
                const cssVar = `var(${tokenPathToVar(firstToken.token_path)})`
                fixes++
                return `${prefix}${utilityName}-[${cssVar}]`
            }
        }

        return cls
    })

    return [fixed.join(' '), fixes]
}

// ── Fix inline style object property values ───────────────────────────────────

/**
 * Attempts to fix a string literal that is the value of a CSS-in-JS
 * style property. Returns [newValue, didFix].
 */
function fixInlineStyleValue(
    propName: string,
    value: string,
    tokens: DesignToken[],
    deltaEThreshold: number,
): [string, boolean] {
    const COLOR_PROPS = new Set([
        'color', 'backgroundColor', 'background', 'borderColor',
        'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
        'outlineColor', 'fill', 'stroke',
    ])

    if (COLOR_PROPS.has(propName)) {
        const hex = cssColorToHex(value)
        if (hex !== null) {
            const nearest = findNearestColorToken(hex, tokens)
            if (nearest !== null && nearest.deltaE > deltaEThreshold) {
                return [`var(${tokenPathToVar(nearest.token.token_path)})`, true]
            }
        }
    }

    return [value, false]
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const BRIDGE_FIX_TOOL = {
    name: 'bridge_fix',
    description:
        'Auto-fix detected Mithril violations by replacing hardcoded values ' +
        'with their nearest design token equivalents.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            source: {
                type: 'string',
                description: 'Raw TSX/JSX source code to fix.',
            },
            filePath: {
                type: 'string',
                description: 'File path for context.',
            },
            violationIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: only fix specific violation IDs.',
            },
            dryRun: {
                type: 'boolean',
                description: 'If true, return the fixed source without writing.',
            },
        },
        required: ['source', 'filePath'],
    },
} as const

export interface FixArgs {
    source: string
    filePath: string
    violationIds?: string[]
    dryRun?: boolean
}

export interface FixResult {
    fixedSource: string
    fixesApplied: number
    status: string
    /** One-sentence human-readable summary of what was fixed. CX.1 */
    summary: string
    /** True when the caller passed dryRun: true. CX.1 */
    dryRun: boolean
    /** Project-level health context. Omitted when unavailable. CX.1 */
    project_context?: ProjectContext
}

// ── CX.1 Summary generation ────────────────────────────────────────────────

/**
 * Generate a one-sentence plain-English summary of fix results.
 */
export function generateFixSummary(
    filePath: string,
    fixesApplied: number,
    status: string,
    dryRun: boolean,
): string {
    const basename = path.basename(filePath)

    if (status === 'parse-error') {
        return `Could not parse ${basename}. No fixes applied.`
    }
    if (status === 'generate-error') {
        return `AST generation failed for ${basename}. No fixes applied.`
    }

    if (dryRun) {
        if (fixesApplied > 0) {
            return `DRY RUN -- would fix ${fixesApplied} violation(s) in ${basename}. No changes written.`
        }
        return `DRY RUN -- no fixable violations found in ${basename}. No changes written.`
    }

    if (fixesApplied > 0) {
        return `Fixed ${fixesApplied} violation(s) in ${basename}.`
    }
    return `No fixable violations found in ${basename}.`
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleBridgeFix(
    args: FixArgs,
    config: BridgeConfig,
): Promise<FixResult> {
    const { source, filePath } = args
    const dryRun = args.dryRun === true
    const deltaEThreshold = config.policy.mithril.deltaE_threshold

    // Load design tokens
    const tokensPath = path.join(config.projectRoot, '.bridge', 'design-tokens.json')
    let tokens: DesignToken[] = []
    if (fs.existsSync(tokensPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            tokens = Array.isArray(raw) ? raw : Object.values(raw)
        } catch {
            // Proceed with empty token set
        }
    }

    // Parse fresh copy of the source (Commandment 3)
    let ast: ReturnType<typeof parse>
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch {
        return buildFixResult({
            fixedSource: source,
            fixesApplied: 0,
            status: 'parse-error',
            filePath,
            dryRun,
            projectRoot: config.projectRoot,
        })
    }

    let totalFixes = 0

    // Traverse the AST and mutate in-place.
    // Both className and style are handled in a single JSXAttribute visitor
    // to avoid the duplicate-key trap (Babel traverse only honours one handler
    // per node type key in an object literal).
    traverse(ast, {
        JSXAttribute(nodePath) {
            const attrName = t.isJSXIdentifier(nodePath.node.name)
                ? nodePath.node.name.name
                : null

            // Fix className JSX attributes
            if (attrName === 'className') {
                const valNode = nodePath.node.value
                let classStr: string | null = null

                if (t.isStringLiteral(valNode)) {
                    classStr = valNode.value
                } else if (
                    t.isJSXExpressionContainer(valNode) &&
                    t.isStringLiteral(valNode.expression)
                ) {
                    classStr = valNode.expression.value
                }

                if (classStr === null) return

                const [fixedClass, fixes] = fixClassString(classStr, tokens, deltaEThreshold)
                if (fixes === 0) return

                totalFixes += fixes

                if (t.isStringLiteral(valNode)) {
                    valNode.value = fixedClass
                } else if (
                    t.isJSXExpressionContainer(valNode) &&
                    t.isStringLiteral(valNode.expression)
                ) {
                    valNode.expression.value = fixedClass
                }
                return
            }

            // Fix inline style objects: style={{ color: '#FF3333' }}
            if (attrName === 'style') {
                const valNode = nodePath.node.value
                if (!t.isJSXExpressionContainer(valNode)) return
                const expr = valNode.expression
                if (!t.isObjectExpression(expr)) return

                for (const prop of expr.properties) {
                    if (!t.isObjectProperty(prop)) continue
                    if (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key)) continue

                    const propName = t.isIdentifier(prop.key)
                        ? prop.key.name
                        : (prop.key as t.StringLiteral).value

                    if (!t.isStringLiteral(prop.value)) continue

                    const [newVal, didFix] = fixInlineStyleValue(
                        propName,
                        prop.value.value,
                        tokens,
                        deltaEThreshold,
                    )
                    if (didFix) {
                        prop.value.value = newVal
                        totalFixes++
                    }
                }
            }
        },
    })

    // Generate fixed source from mutated AST
    let fixedSource = source
    try {
        const result = generate(ast, { retainLines: false, compact: false }, source)
        fixedSource = result.code
    } catch {
        // If generation fails, return original source
        return buildFixResult({
            fixedSource: source,
            fixesApplied: 0,
            status: 'generate-error',
            filePath,
            dryRun,
            projectRoot: config.projectRoot,
        })
    }

    return buildFixResult({
        fixedSource,
        fixesApplied: totalFixes,
        status: totalFixes > 0 ? 'fixed' : 'no-violations',
        filePath,
        dryRun,
        projectRoot: config.projectRoot,
    })
}

// ── Internal helper: build FixResult with CX.1 fields ────────────────────────

function buildFixResult(opts: {
    fixedSource: string
    fixesApplied: number
    status: string
    filePath: string
    dryRun: boolean
    projectRoot: string
}): FixResult {
    const { fixedSource, fixesApplied, status, filePath, dryRun, projectRoot } = opts
    const summary = generateFixSummary(filePath, fixesApplied, status, dryRun)

    const result: FixResult = {
        fixedSource,
        fixesApplied,
        status,
        summary,
        dryRun,
    }

    // CX.1: Attach project_context footer (best-effort, never blocks fix result)
    try {
        const projectCtx = loadProjectContext(projectRoot)
        if (projectCtx !== null) {
            result.project_context = projectCtx
        }
    } catch {
        // project_context is best-effort — never block fix result
    }

    return result
}
