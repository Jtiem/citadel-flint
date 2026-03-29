/**
 * MithrilLinter — flint-mcp/src/core/MithrilLinter.ts
 *
 * MCP-server-side port of the Mithril design system linter.
 *
 * This is the Node.js-compatible version of src/core/MithrilLinter.ts.
 * It contains the full CIEDE2000 color matching engine (inlined from
 * tokenMatcher) so the MCP server has zero dependency on the Electron
 * renderer process tree.
 *
 * Exports:
 *   auditAll      — run all six visitors and return merged Map<id, warning>
 *   visitClassNames, visitTypography, visitSpacing, visitShadows, visitOpacity,
 *   visitInlineStyles
 *   MITHRIL_THRESHOLD — 2.0 ΔE (default, overridable via PolicyOptions)
 *
 * Policy Engine (Gap 3):
 *   All threshold-dependent functions accept an optional PolicyOptions parameter
 *   that overrides the hardcoded defaults. When omitted, behaviour is identical
 *   to pre-policy-engine versions (backward compatible).
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import type Database from 'better-sqlite3'
import type { DesignToken, LinterWarning, TokenCoverage } from '../types.js'
import { getErrorEntryByRuleId } from './errorTaxonomy.js'
import { checkSyncViolations, type DesignTokenFileEntry } from './sync/syncViolationChecker.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── CIEDE2000 engine (inlined from tokenMatcher) ──────────────────────────────

export const MITHRIL_THRESHOLD = 2.0

/**
 * Optional policy overrides for threshold-dependent linter behaviour.
 * When provided, these values take precedence over the hardcoded constants.
 */
export interface PolicyOptions {
    /** ΔE threshold for amber-level violations (default: MITHRIL_THRESHOLD = 2.0). */
    deltaE_threshold?: number
    /** ΔE threshold for critical-level violations (default: 10.0). */
    deltaE_critical_threshold?: number
    /** Per-rule policy modes from POL.1. 'off' skips the visitor, 'advisory' downgrades severity. */
    ruleModes?: Record<string, 'blocking' | 'advisory' | 'off'>
}

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

interface TokenMatch {
    tokenPath: string
    tokenValue: string
    deltaE: number
}

function findClosestToken(hexValue: string, tokens: DesignToken[]): TokenMatch | null {
    const targetLab = hexToLab(hexValue)
    if (targetLab === null) return null

    const colorTokens = tokens.filter((tok) => tok.token_type === 'color')
    if (colorTokens.length === 0) return null

    let best: TokenMatch | null = null
    for (const token of colorTokens) {
        const tokenLab = hexToLab(token.token_value)
        if (tokenLab === null) continue
        const deltaE = deltaE2000(targetLab, tokenLab)
        if (best === null || deltaE < best.deltaE) {
            best = { tokenPath: token.token_path, tokenValue: token.token_value, deltaE }
        }
    }
    return best
}

// CSS Color Normalization helpers (clampByte, toHex, hslToRgb, cssColorToHex)
// are reserved for future CSS named-color → hex conversion. They have been
// commented out to avoid noUnusedLocals violations. See git history for the
// full implementation supporting hex, rgb(), rgba(), hsl(), hsla() formats.

// ── Taxonomy helpers ──────────────────────────────────────────────────────────

/** Returns { explanation, recovery } for the given ruleId, or empty strings if not found. */
function taxonomyFields(ruleId: string): { explanation?: string; recovery?: string } {
    const entry = getErrorEntryByRuleId(ruleId)
    if (entry === null) return {}
    return { explanation: entry.explanation, recovery: entry.recovery }
}

// ── Shared AST helpers ────────────────────────────────────────────────────────

function getFlintId(openEl: t.JSXOpeningElement): string | null {
    const attr = openEl.attributes.find(
        (a): a is t.JSXAttribute =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name, { name: 'data-flint-id' }),
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

function severity(delta: number, criticalThreshold = 10): LinterWarning['severity'] {
    return delta > criticalThreshold ? 'critical' : 'amber'
}

// ── Inline style prop constants (exported for Universal AST plugin) ───────────

/** CSS color property names (camelCase) that should reference color tokens. */
export const INLINE_COLOR_PROPS = new Set([
    'color', 'backgroundColor', 'borderColor',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderInlineColor', 'borderBlockColor',
    'outlineColor', 'caretColor', 'fill', 'stroke',
    'textDecorationColor', 'columnRuleColor', 'accentColor', 'scrollbarColor',
])

/** CSS typography property names → expected token type. */
export const INLINE_TYPOGRAPHY_PROPS: Readonly<Record<string, DesignToken['token_type']>> = {
    fontSize: 'dimension',
    fontWeight: 'fontWeight',
    lineHeight: 'lineHeight',
    letterSpacing: 'letterSpacing',
    fontFamily: 'fontFamily',
}

/**
 * CSS spacing/dimension property names (camelCase).
 * All values here should reference dimension tokens.
 * Excludes `fontSize` — that is handled by INLINE_TYPOGRAPHY_PROPS.
 */
export const INLINE_SPACING_PROPS = new Set([
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'marginInline', 'marginInlineStart', 'marginInlineEnd',
    'marginBlock', 'marginBlockStart', 'marginBlockEnd',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'paddingInline', 'paddingInlineStart', 'paddingInlineEnd',
    'paddingBlock', 'paddingBlockStart', 'paddingBlockEnd',
    'gap', 'rowGap', 'columnGap',
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'inlineSize', 'blockSize', 'minInlineSize', 'maxInlineSize', 'minBlockSize', 'maxBlockSize',
    'top', 'right', 'bottom', 'left',
    'inset', 'insetInline', 'insetInlineStart', 'insetInlineEnd',
    'insetBlock', 'insetBlockStart', 'insetBlockEnd',
    'flexBasis',
    'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomRightRadius', 'borderBottomLeftRadius',
    'borderStartStartRadius', 'borderStartEndRadius',
    'borderEndStartRadius', 'borderEndEndRadius',
    'outlineWidth', 'outlineOffset',
])

/** CSS shadow property names (camelCase). */
export const INLINE_SHADOW_PROPS = new Set(['boxShadow', 'textShadow'])

// ── CSS color value parser ─────────────────────────────────────────────────────

/**
 * Converts a CSS color string to hex for CIEDE2000 comparison.
 * Handles: #RGB, #RRGGBB, #RRGGBBAA, rgb(r,g,b), rgba(r,g,b,a), CSS4 space-sep rgb().
 * Returns null for: named colors, currentColor, inherit, var(), hsl() — these are
 * either semantically correct (token reference, system color) or too dynamic to flag.
 */
export function parseCssColorToHex(value: string): string | null {
    const trimmed = value.trim()
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed
    const rgbMatch = /^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i.exec(trimmed)
    if (rgbMatch !== null) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0')
        return `#${r}${g}${b}`
    }
    return null
}

// ── Language-agnostic style prop checker ──────────────────────────────────────

/**
 * A single resolved inline style property, framework-independent.
 * Produced by the Babel JSX visitor (from ObjectExpression AST nodes) and
 * by the Universal AST plugin (from parsed CSS string declarations).
 */
export interface StylePropEntry {
    /** CSS property name in camelCase (e.g. 'fontSize', 'backgroundColor'). */
    prop: string
    /** String value as written (e.g. '14px', '#ff0000'). Null for pure numeric AST nodes. */
    stringValue: string | null
    /** Numeric value for NumericLiteral nodes (e.g. `opacity: 0.5`). Null when stringValue is set. */
    numericValue: number | null
}

/**
 * Core inline-style violation checker — language agnostic.
 *
 * Evaluates a list of resolved StylePropEntry items against the design token
 * set and returns the FIRST violation found, or null if everything is clean.
 * Consistent with the "first-write-wins per node" contract of the className visitors.
 *
 * Exported so the Universal AST plugin (mithrilStylePlugin.ts) can reuse
 * CIEDE2000 and token-matching logic without re-implementing it.
 *
 * Skip conditions (not violations):
 *   - Spacing / opacity value of exactly 0 (always valid)
 *   - Opacity value of exactly 1 (fully visible, always valid)
 *   - Color/shadow when no tokens of that type are registered
 *   - Empty / null values
 */
export function checkStyleProps(
    entries: StylePropEntry[],
    nodeId: string,
    tokens: DesignToken[],
    options?: PolicyOptions,
): LinterWarning | null {
    const threshold = options?.deltaE_threshold ?? MITHRIL_THRESHOLD
    const criticalThreshold = options?.deltaE_critical_threshold ?? 10

    for (const { prop, stringValue, numericValue } of entries) {
        const rawVal = stringValue ?? (numericValue !== null ? String(numericValue) : null)
        if (rawVal === null) continue

        // ── COLOR ──────────────────────────────────────────────────────────────
        if (INLINE_COLOR_PROPS.has(prop) && stringValue !== null) {
            const colMode = options?.ruleModes?.['MITHRIL-IST-COL']
            if (colMode === 'off') continue
            const hexVal = parseCssColorToHex(stringValue)
            if (hexVal === null) continue // var(), named color, currentColor → skip
            const match = findClosestToken(hexVal, tokens)
            if (match === null) continue // no color tokens — can't evaluate
            if (match.deltaE <= threshold) continue
            const colSeverity: LinterWarning['severity'] = colMode === 'advisory' ? 'advisory'
                : severity(match.deltaE, criticalThreshold)
            return {
                id: nodeId,
                type: 'inline-style-drift',
                severity: colSeverity,
                value: match.deltaE,
                message: `MITHRIL-IST-COL: inline \`${prop}: ${stringValue}\` ΔE ${match.deltaE.toFixed(1)} — use token ${match.tokenPath}`,
                nearestToken: match.tokenPath,
                nearestTokenValue: match.tokenValue,
                ruleId: 'MITHRIL-IST-COL',
                ...taxonomyFields('MITHRIL-IST-COL'),
            }
        }

        // ── TYPOGRAPHY ─────────────────────────────────────────────────────────
        const typTokenType = (INLINE_TYPOGRAPHY_PROPS as Record<string, DesignToken['token_type']>)[prop]
        if (typTokenType !== undefined) {
            const typMode = options?.ruleModes?.['MITHRIL-IST-TYP']
            if (typMode === 'off') continue
            const typeTokens = tokens.filter((tok) => tok.token_type === typTokenType)
            const hasMatch = typeTokens.some(
                (tok) =>
                    tok.token_value.toLowerCase() === rawVal.toLowerCase() ||
                    tok.token_value === rawVal.replace('px', '') ||
                    `${tok.token_value}px` === rawVal,
            )
            if (hasMatch) continue
            const suggestion = typeTokens[0]?.token_path ?? null
            return {
                id: nodeId,
                type: 'inline-style-drift',
                severity: typMode === 'advisory' ? 'advisory' : 'amber',
                value: 1,
                message: suggestion !== null
                    ? `MITHRIL-IST-TYP: inline \`${prop}: ${rawVal}\` not in ${typTokenType} tokens — use ${suggestion}`
                    : `MITHRIL-IST-TYP: inline \`${prop}: ${rawVal}\` — no ${typTokenType} tokens defined`,
                nearestToken: suggestion,
                nearestTokenValue: suggestion !== null
                    ? (typeTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                    : null,
                ruleId: 'MITHRIL-IST-TYP',
                ...taxonomyFields('MITHRIL-IST-TYP'),
            }
        }

        // ── SPACING ────────────────────────────────────────────────────────────
        if (INLINE_SPACING_PROPS.has(prop)) {
            const spcMode = options?.ruleModes?.['MITHRIL-IST-SPC']
            if (spcMode === 'off') continue
            if (rawVal === '0' || numericValue === 0) continue // 0 is always valid
            const dimTokens = tokens.filter((tok) => tok.token_type === 'dimension')
            const hasMatch = dimTokens.some(
                (tok) =>
                    tok.token_value === rawVal ||
                    tok.token_value === rawVal.replace('px', '') ||
                    `${tok.token_value}px` === rawVal,
            )
            if (hasMatch) continue
            const suggestion = dimTokens[0]?.token_path ?? null
            return {
                id: nodeId,
                type: 'inline-style-drift',
                severity: spcMode === 'advisory' ? 'advisory' : 'amber',
                value: 1,
                message: suggestion !== null
                    ? `MITHRIL-IST-SPC: inline \`${prop}: ${rawVal}\` not in dimension tokens — use ${suggestion}`
                    : `MITHRIL-IST-SPC: inline \`${prop}: ${rawVal}\` — no dimension tokens defined`,
                nearestToken: suggestion,
                nearestTokenValue: suggestion !== null
                    ? (dimTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                    : null,
                ruleId: 'MITHRIL-IST-SPC',
                ...taxonomyFields('MITHRIL-IST-SPC'),
            }
        }

        // ── SHADOW ─────────────────────────────────────────────────────────────
        if (INLINE_SHADOW_PROPS.has(prop) && stringValue !== null) {
            const shdMode = options?.ruleModes?.['MITHRIL-IST-SHD']
            if (shdMode === 'off') continue
            const shadowTokens = tokens.filter((tok) => tok.token_type === 'shadow')
            if (shadowTokens.length === 0) continue // no shadow tokens — skip
            const hasMatch = shadowTokens.some((tok) => tok.token_value === stringValue)
            if (hasMatch) continue
            const suggestion = shadowTokens[0]?.token_path ?? null
            return {
                id: nodeId,
                type: 'inline-style-drift',
                severity: shdMode === 'advisory' ? 'advisory' : 'amber',
                value: 1,
                message: suggestion !== null
                    ? `MITHRIL-IST-SHD: inline \`${prop}\` not in shadow tokens — use ${suggestion}`
                    : `MITHRIL-IST-SHD: inline \`${prop}\` — add a shadow token`,
                nearestToken: suggestion,
                nearestTokenValue: suggestion !== null
                    ? (shadowTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                    : null,
                ruleId: 'MITHRIL-IST-SHD',
                ...taxonomyFields('MITHRIL-IST-SHD'),
            }
        }

        // ── OPACITY ────────────────────────────────────────────────────────────
        if (prop === 'opacity') {
            const opcMode = options?.ruleModes?.['MITHRIL-IST-OPC']
            if (opcMode === 'off') continue
            // 0 (invisible) and 1 (fully opaque) are semantically valid — skip
            if (numericValue === 0 || numericValue === 1 || rawVal === '0' || rawVal === '1') continue
            const opacityTokens = tokens.filter((tok) => tok.token_type === 'opacity')
            if (opacityTokens.length === 0) continue // no opacity tokens — skip
            const hasMatch = opacityTokens.some(
                (tok) =>
                    tok.token_value === rawVal ||
                    (numericValue !== null && parseFloat(tok.token_value) === numericValue),
            )
            if (hasMatch) continue
            const suggestion = opacityTokens[0]?.token_path ?? null
            return {
                id: nodeId,
                type: 'inline-style-drift',
                severity: opcMode === 'advisory' ? 'advisory' : 'amber',
                value: 1,
                message: suggestion !== null
                    ? `MITHRIL-IST-OPC: inline \`opacity: ${rawVal}\` — use ${suggestion}`
                    : `MITHRIL-IST-OPC: inline \`opacity: ${rawVal}\` — add an opacity token`,
                nearestToken: suggestion,
                nearestTokenValue: suggestion !== null
                    ? (opacityTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                    : null,
                ruleId: 'MITHRIL-IST-OPC',
                ...taxonomyFields('MITHRIL-IST-OPC'),
            }
        }
    }

    return null
}

// ── Visitor — Color (MITHRIL-COL) ─────────────────────────────────────────────

const ARBITRARY_COLOR_RE = /^(?:[\w-]+:)*[\w-]+-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

export function visitClassNames(ast: File, tokens: DesignToken[], options?: PolicyOptions): Map<string, LinterWarning> {
    const colMode = options?.ruleModes?.['MITHRIL-COL']
    if (colMode === 'off') return new Map()

    const threshold = options?.deltaE_threshold ?? MITHRIL_THRESHOLD
    const criticalThreshold = options?.deltaE_critical_threshold ?? 10
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
            let worstMatch: TokenMatch | null = null

            for (const cls of classStr.split(/\s+/)) {
                const m = ARBITRARY_COLOR_RE.exec(cls)
                if (m?.groups?.hex === undefined) continue
                const match = findClosestToken(m.groups.hex, colorTokens)
                if (match !== null && match.deltaE > worstDelta) {
                    worstDelta = match.deltaE
                    worstMatch = match
                }
            }

            if (worstDelta <= threshold) return

            const tokenLabel = worstMatch?.tokenPath ?? null
            const colSeverity: LinterWarning['severity'] = colMode === 'advisory'
                ? 'advisory'
                : severity(worstDelta, criticalThreshold)
            const loc = path.node.loc?.start
            warnings.set(nodeId, {
                id: nodeId,
                type: 'color-drift',
                severity: colSeverity,
                value: worstDelta,
                ...(loc !== undefined ? { line: loc.line, column: loc.column } : {}),
                message: tokenLabel !== null
                    ? `MITHRIL-COL: ΔE ${worstDelta.toFixed(1)} – use ${tokenLabel}`
                    : `MITHRIL-COL: ΔE ${worstDelta.toFixed(1)} – no matching token`,
                nearestToken: tokenLabel,
                nearestTokenValue: worstMatch?.tokenValue ?? null,
                ruleId: 'MITHRIL-COL',
                ...taxonomyFields('MITHRIL-COL'),
            })
        },
    })

    return warnings
}

// ── Visitor — Typography (MITHRIL-TYP-001..005) ───────────────────────────────

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

export function visitTypography(ast: File, tokens: DesignToken[], options?: PolicyOptions): Map<string, LinterWarning> {
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
                    const ruleMode = options?.ruleModes?.[rule]
                    if (ruleMode === 'off') continue

                    const m = re.exec(cls)
                    if (m?.groups?.val === undefined) continue

                    const rawVal = m.groups.val
                    const typeTokens = tokens.filter((tok) => tok.token_type === tokenType)
                    const hasMatch = typeTokens.some((tok) =>
                        tok.token_value.toLowerCase() === rawVal.toLowerCase(),
                    )
                    if (hasMatch) continue

                    const suggestion = typeTokens[0]?.token_path ?? null
                    const msg = suggestion !== null
                        ? `${rule}: arbitrary '${rawVal}' not in token set — use ${suggestion}`
                        : `${rule}: arbitrary '${rawVal}' not in token set — add a ${tokenType} token`

                    if (!warnings.has(nodeId)) {
                        const typLoc = path.node.loc?.start
                        warnings.set(nodeId, {
                            id: nodeId,
                            type: 'typography-drift',
                            severity: ruleMode === 'advisory' ? 'advisory' : 'amber',
                            value: 1,
                            ...(typLoc !== undefined ? { line: typLoc.line, column: typLoc.column } : {}),
                            message: msg,
                            nearestToken: suggestion,
                            nearestTokenValue: suggestion !== null
                                ? (typeTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                                : null,
                            ruleId: rule,
                            ...taxonomyFields(rule),
                        })
                    }
                }
            }
        },
    })

    return warnings
}

// ── Visitor — Spacing (MITHRIL-SPC-001) ──────────────────────────────────────

const SPACING_RE = /^(?:[\w-]+:)*(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h)-\[(?<val>[\d.]+(?:px|rem|em|%|vw|vh))\]$/

export function visitSpacing(ast: File, tokens: DesignToken[], options?: PolicyOptions): Map<string, LinterWarning> {
    const spcMode = options?.ruleModes?.['MITHRIL-SPC-001']
    if (spcMode === 'off') return new Map()

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
                    tok.token_value === rawVal || tok.token_value === rawVal.replace('px', ''),
                )
                if (hasMatch) continue

                const suggestion = dimTokens[0]?.token_path ?? null
                if (!warnings.has(nodeId)) {
                    const spcLoc = path.node.loc?.start
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'spacing-drift',
                        severity: spcMode === 'advisory' ? 'advisory' : 'amber',
                        value: 1,
                        ...(spcLoc !== undefined ? { line: spcLoc.line, column: spcLoc.column } : {}),
                        message: suggestion !== null
                            ? `MITHRIL-SPC-001: arbitrary '${rawVal}' not in dimension tokens — use ${suggestion}`
                            : `MITHRIL-SPC-001: arbitrary '${rawVal}' — no dimension tokens defined`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (dimTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                            : null,
                        ruleId: 'MITHRIL-SPC-001',
                        ...taxonomyFields('MITHRIL-SPC-001'),
                    })
                }
            }
        },
    })

    return warnings
}

// ── Visitor — Shadow (MITHRIL-SHD-001) ───────────────────────────────────────

const SHADOW_RE = /^(?:[\w-]+:)*shadow-\[(?<val>[^\]]+)\]$/

export function visitShadows(ast: File, tokens: DesignToken[], options?: PolicyOptions): Map<string, LinterWarning> {
    const shdMode = options?.ruleModes?.['MITHRIL-SHD-001']
    if (shdMode === 'off') return new Map()

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
                    const shdLoc = path.node.loc?.start
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'shadow-drift',
                        severity: shdMode === 'advisory' ? 'advisory' : 'amber',
                        value: 1,
                        ...(shdLoc !== undefined ? { line: shdLoc.line, column: shdLoc.column } : {}),
                        message: suggestion !== null
                            ? `MITHRIL-SHD-001: arbitrary shadow not in token set — use ${suggestion}`
                            : `MITHRIL-SHD-001: arbitrary shadow — add a shadow token`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (shadowTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                            : null,
                        ruleId: 'MITHRIL-SHD-001',
                        ...taxonomyFields('MITHRIL-SHD-001'),
                    })
                }
            }
        },
    })

    return warnings
}

// ── Visitor — Opacity (MITHRIL-OPC-001) ──────────────────────────────────────

const OPACITY_RE = /^(?:[\w-]+:)*opacity-\[(?<val>[\d.]+%?)\]$/

export function visitOpacity(ast: File, tokens: DesignToken[], options?: PolicyOptions): Map<string, LinterWarning> {
    const opcMode = options?.ruleModes?.['MITHRIL-OPC-001']
    if (opcMode === 'off') return new Map()

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
                    const opcLoc = path.node.loc?.start
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'opacity-drift',
                        severity: opcMode === 'advisory' ? 'advisory' : 'amber',
                        value: 1,
                        ...(opcLoc !== undefined ? { line: opcLoc.line, column: opcLoc.column } : {}),
                        message: suggestion !== null
                            ? `MITHRIL-OPC-001: arbitrary opacity '${rawVal}' — use ${suggestion}`
                            : `MITHRIL-OPC-001: arbitrary opacity '${rawVal}' — add an opacity token`,
                        nearestToken: suggestion,
                        nearestTokenValue: suggestion !== null
                            ? (opacityTokens.find((tk) => tk.token_path === suggestion)?.token_value ?? null)
                            : null,
                        ruleId: 'MITHRIL-OPC-001',
                        ...taxonomyFields('MITHRIL-OPC-001'),
                    })
                }
            }
        },
    })

    return warnings
}

// ── Visitor — Inline Style Props (MITHRIL-IST-*) ─────────────────────────────
//
// Inspects `style={{ ... }}` JSXAttribute object expressions for hardcoded
// CSS values that should be design tokens. Framework: Babel/TSX only.
// For HTML/Vue/Angular template coverage use the Universal plugin (mithrilStylePlugin.ts).
//
// Covered properties:
//   MITHRIL-IST-COL — any color prop (color, backgroundColor, borderColor, fill, stroke, …)
//   MITHRIL-IST-TYP — fontSize, fontWeight, lineHeight, letterSpacing, fontFamily
//   MITHRIL-IST-SPC — margin*, padding*, gap, width, height, borderRadius, top/right/bottom/left, …
//   MITHRIL-IST-SHD — boxShadow, textShadow
//   MITHRIL-IST-OPC — opacity
//
// Only StringLiteral and NumericLiteral property values are flagged.
// MemberExpression (tokens.colorPrimary), Identifier, CallExpression,
// TemplateLiteral values are NOT flagged — presumed to reference tokens.
// SpreadElement properties are skipped entirely.

/** Coverage statistics returned by visitInlineStyles. */
export interface InlineStyleCoverage {
    inlinePropsScanned: number
    inlinePropsSkipped: number
    inlineViolations: number
}

export function visitInlineStyles(
    ast: File,
    tokens: DesignToken[],
    options?: PolicyOptions,
): { warnings: Map<string, LinterWarning>; coverage: InlineStyleCoverage } {
    const warnings = new Map<string, LinterWarning>()
    let inlinePropsScanned = 0
    let inlinePropsSkipped = 0
    let inlineViolations = 0

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'style' })) return

            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return
            if (warnings.has(nodeId)) return // already flagged

            const val = path.node.value
            if (!t.isJSXExpressionContainer(val)) return
            const expr = val.expression
            // Only inspect object literals — skip variables, conditional expressions, forwardRef wrappers
            if (!t.isObjectExpression(expr)) return

            // Capture loc of the style JSXAttribute for line/column reporting
            const styleLoc = path.node.loc?.start

            const entries: StylePropEntry[] = []
            for (const prop of expr.properties) {
                if (!t.isObjectProperty(prop)) continue // skip SpreadElement
                if (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key)) continue
                const propName = t.isIdentifier(prop.key)
                    ? prop.key.name
                    : (prop.key as t.StringLiteral).value
                const propValue = prop.value
                if (t.isStringLiteral(propValue)) {
                    inlinePropsScanned++
                    entries.push({ prop: propName, stringValue: propValue.value, numericValue: null })
                } else if (t.isNumericLiteral(propValue)) {
                    inlinePropsScanned++
                    entries.push({ prop: propName, stringValue: null, numericValue: propValue.value })
                } else {
                    // MemberExpression, Identifier, CallExpression, TemplateLiteral → skip (uses tokens)
                    inlinePropsSkipped++
                }
            }

            if (entries.length === 0) return

            const warning = checkStyleProps(entries, nodeId, tokens, options)
            if (warning !== null) {
                // Attach line/column from the style attribute node
                if (styleLoc !== undefined) {
                    warning.line = styleLoc.line
                    warning.column = styleLoc.column
                }
                warnings.set(nodeId, warning)
                inlineViolations++
            }
        },
    })

    return { warnings, coverage: { inlinePropsScanned, inlinePropsSkipped, inlineViolations } }
}

// ── Phase 1: buildTokenCoverage helper ───────────────────────────────────────

/**
 * Builds a TokenCoverage object by counting loaded tokens by type and merging
 * the inline style stats returned by visitInlineStyles.
 *
 * Call this after running auditAll and visitInlineStyles to populate
 * AuditResult.coverage.
 */
export function buildTokenCoverage(
    tokens: DesignToken[],
    inlineStats: { inlinePropsScanned: number; inlinePropsSkipped: number; inlineViolations: number },
): TokenCoverage {
    const colorTokens = tokens.filter((t) => t.token_type === 'color').length
    const dimensionTokens = tokens.filter((t) => t.token_type === 'dimension').length
    const shadowTokens = tokens.filter((t) => t.token_type === 'shadow').length
    const fontWeightTokens = tokens.filter((t) => t.token_type === 'fontWeight').length
    return {
        colorTokens,
        dimensionTokens,
        shadowTokens,
        fontWeightTokens,
        inlinePropsScanned: inlineStats.inlinePropsScanned,
        inlinePropsSkipped: inlineStats.inlinePropsSkipped,
        inlineViolations: inlineStats.inlineViolations,
    }
}

// ── Phase 2: visitLocalTokenObjects (MITHRIL-DTO-001) ─────────────────────────
//
// Detects module-scoped `const tokens = { colorX: '#hex', ... }` objects that
// shadow the Flint design system by duplicating token values as local literals.
//
// Detection rules:
//   1. VariableDeclarator at module scope (top-level or inside a module-scope
//      function — depth check via parent node type).
//   2. init is an ObjectExpression.
//   3. Collect all StringLiteral / NumericLiteral property values that look
//      like design tokens (hex color, px value, font-weight integer 100-900).
//   4. Count how many of those values match Flint tokens.
//   5. If ≥ 2 match, emit one MITHRIL-DTO-001 warning for the file.

/** Hex color pattern: #RGB or #RRGGBB */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
/** Pixel dimension pattern: digits + 'px' */
const PX_VALUE_RE = /^\d+(\.\d+)?px$/

/** Returns true if the value looks like a color, px dimension, or font-weight. */
function isTokenLike(value: string | number): boolean {
    if (typeof value === 'string') {
        if (HEX_COLOR_RE.test(value)) return true
        if (PX_VALUE_RE.test(value)) return true
        return false
    }
    // Numeric: pure font-weight (100-900, multiples of 100)
    return Number.isInteger(value) && value >= 100 && value <= 900 && value % 100 === 0
}

/** Returns true if the token-like value has a match in the Flint token set. */
function matchesFlintToken(value: string | number, tokens: DesignToken[], threshold: number): boolean {
    const strVal = String(value)
    for (const tok of tokens) {
        // Color comparison via CIEDE2000
        if (tok.token_type === 'color' && typeof value === 'string') {
            const hexVal = parseCssColorToHex(value)
            const tokHex = parseCssColorToHex(tok.token_value)
            if (hexVal !== null && tokHex !== null) {
                const lab1 = hexToLab(hexVal)
                const lab2 = hexToLab(tokHex)
                if (lab1 !== null && lab2 !== null && deltaE2000(lab1, lab2) <= threshold) return true
            }
            continue
        }
        // Dimension comparison (px-normalised)
        if (tok.token_type === 'dimension') {
            if (
                tok.token_value === strVal ||
                tok.token_value === strVal.replace('px', '') ||
                `${tok.token_value}px` === strVal
            ) return true
            continue
        }
        // fontWeight comparison
        if (tok.token_type === 'fontWeight') {
            if (tok.token_value === strVal) return true
            continue
        }
    }
    return false
}

export function visitLocalTokenObjects(
    ast: File,
    tokens: DesignToken[],
    options?: PolicyOptions,
): Map<string, LinterWarning> {
    const dtoMode = options?.ruleModes?.['MITHRIL-DTO-001']
    if (dtoMode === 'off') return new Map()
    if (tokens.length === 0) return new Map()

    const threshold = options?.deltaE_threshold ?? MITHRIL_THRESHOLD
    const warnings = new Map<string, LinterWarning>()

    traverse(ast, {
        VariableDeclarator(path) {
            const init = path.node.init
            if (!t.isObjectExpression(init)) return

            // Only inspect module-scope declarators — parent chain must be
            // VariableDeclaration → Program (or ExportNamedDeclaration → Program)
            const parentDecl = path.parentPath?.node
            if (!t.isVariableDeclaration(parentDecl)) return
            const grandParent = path.parentPath?.parentPath?.node
            const isModuleScope = t.isProgram(grandParent) || t.isExportNamedDeclaration(grandParent)
            if (!isModuleScope) return

            // Only named declarators (const tokens = {...})
            if (!t.isIdentifier(path.node.id)) return
            const varName = path.node.id.name

            let matchCount = 0
            let unregisteredCount = 0

            for (const prop of init.properties) {
                if (!t.isObjectProperty(prop)) continue
                const propValue = prop.value

                let rawValue: string | number | null = null
                if (t.isStringLiteral(propValue)) {
                    rawValue = propValue.value
                } else if (t.isNumericLiteral(propValue)) {
                    rawValue = propValue.value
                }
                if (rawValue === null) continue
                if (!isTokenLike(rawValue)) continue

                if (matchesFlintToken(rawValue, tokens, threshold)) {
                    matchCount++
                } else {
                    unregisteredCount++
                }
            }

            if (matchCount < 2) return

            const nodeId = `dto-${varName}-${path.node.loc?.start.line ?? 0}`
            const loc = path.node.loc?.start

            let message =
                `Local token object "${varName}" shadows ${matchCount} Flint design tokens. ` +
                'Remove this local copy and reference tokens via CSS variables or Tailwind classes to prevent drift.'

            if (unregisteredCount >= 1) {
                message += ` ${unregisteredCount} values have no matching Flint token — register them in design-tokens.json.`
            }

            const severity: LinterWarning['severity'] = dtoMode === 'advisory' ? 'advisory' : 'amber'

            const warning: LinterWarning = {
                id: nodeId,
                type: 'inline-style-drift',
                severity,
                value: matchCount,
                message,
                nearestToken: null,
                nearestTokenValue: null,
                ruleId: 'MITHRIL-DTO-001',
                ...taxonomyFields('MITHRIL-DTO-001'),
                ...(loc !== undefined ? { line: loc.line, column: loc.column } : {}),
            }

            if (!warnings.has(nodeId)) {
                warnings.set(nodeId, warning)
            }
        },
    })

    return warnings
}

// ── CR-SEAL: visitRegistryUsage (REG-001) ────────────────────────────────────

import { HTML_INTRINSIC_TAGS, REACT_BUILTINS } from './htmlIntrinsics.js'

/**
 * REG-001: Walk JSX elements and flag PascalCase component usages that are
 * not present in the project component registry.
 *
 * Only fires when `registry` is non-empty. HTML intrinsics (lowercase) are
 * always allowed. This is the audit-time counterpart to CR.2 runtime validation.
 */
export function visitRegistryUsage(
    ast: File,
    registry: Record<string, RegistryComponentEntry>,
    options?: PolicyOptions,
): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    // Respect per-rule modes
    const mode = options?.ruleModes?.['REG-001']
    if (mode === 'off') return warnings

    // No registry → no constraint
    if (!registry || Object.keys(registry).length === 0) return warnings

    const registryNames = new Set(Object.keys(registry))
    const seen = new Set<string>()

    // Hoist taxonomy lookup outside the traversal — REG-001 is a static rule ID.
    const taxonomyEntry = getErrorEntryByRuleId('REG-001')

    traverse(ast, {
        JSXOpeningElement(path) {
            const nameNode = path.node.name

            let name: string

            if (t.isJSXIdentifier(nameNode)) {
                name = nameNode.name
            } else if (t.isJSXMemberExpression(nameNode)) {
                // Extract root: <Dialog.Header> → "Dialog", <Tabs.List> → "Tabs"
                // Walk to the leftmost identifier in the chain
                let cursor: t.JSXMemberExpression | t.JSXIdentifier = nameNode
                while (t.isJSXMemberExpression(cursor)) {
                    cursor = cursor.object
                }
                if (!t.isJSXIdentifier(cursor)) return
                name = cursor.name
            } else {
                // JSXNamespacedName — skip
                return
            }

            // HTML intrinsics always pass
            if (HTML_INTRINSIC_TAGS.has(name)) return

            // Lowercase first char → HTML intrinsic or custom element
            if (name[0] === name[0]?.toLowerCase()) return

            // React built-ins (Fragment, Suspense, StrictMode, Profiler) always pass
            if (REACT_BUILTINS.has(name)) return

            // Already warned about this component name in this file
            if (seen.has(name)) return
            seen.add(name)

            // Check registry membership
            if (registryNames.has(name)) return

            // Build a synthetic ID for the warning
            const loc = nameNode.loc?.start
            const warningId = `reg-${name}-${loc?.line ?? 0}`

            const severity: LinterWarning['severity'] = mode === 'advisory' ? 'advisory' : 'amber'

            // Build targeted suggestions (prefix match, capped at 5)
            const prefix = name.toLowerCase().slice(0, 4)
            const suggestions = [...registryNames]
                .filter(r => r.toLowerCase().includes(prefix))
                .slice(0, 5)
            const suggestionNote = suggestions.length > 0
                ? ` Try: ${suggestions.join(', ')}.`
                : ''

            warnings.set(warningId, {
                id: warningId,
                type: 'registry',
                severity,
                value: 0,
                message: `<${name}> is not in your project's component library.${suggestionNote}`,
                nearestToken: null,
                nearestTokenValue: null,
                ruleId: 'REG-001',
                fixable: false,
                explanation: taxonomyEntry?.explanation ??
                    'Only components from your project\'s registered library are allowed. ' +
                    'This ensures design system consistency and prevents unauthorized component drift.',
                recovery: taxonomyEntry?.recovery ??
                    'Add this component to your Armory (project registry), or replace it with a registered alternative.',
                line: loc?.line,
                column: loc?.column,
            })
        },
    })

    return warnings
}

// ── auditAll ──────────────────────────────────────────────────────────────────

/** Minimal component entry shape for registry validation. */
export interface RegistryComponentEntry {
    importPath?: string
    [key: string]: unknown
}

/** Options for auditAll, extending PolicyOptions with optional sync DB. */
export interface AuditAllOptions extends PolicyOptions {
    /** When provided, enables SYNC-001/SYNC-002 violation checking against the token_source table. */
    syncDb?: Database.Database
    /** Project root path for token_source lookups (required when syncDb is set). */
    projectRoot?: string
    /** CR-SEAL: When provided, enables REG-001 registry membership checking for JSX elements. */
    registry?: Record<string, RegistryComponentEntry>
}

/**
 * Runs all seven Mithril visitors and merges results into a single
 * Map<flintId, LinterWarning>. Color drift takes precedence over other
 * dimensions (first-write wins per node).
 *
 * When `options.syncDb` is provided, also runs SYNC-001/SYNC-002 checks
 * against the token_source baseline table.
 */
export function auditAll(ast: File, tokens: DesignToken[], options?: AuditAllOptions): Map<string, LinterWarning> {
    const merged = new Map<string, LinterWarning>()

    for (const visit of [
        () => visitClassNames(ast, tokens, options),
        () => visitTypography(ast, tokens, options),
        () => visitSpacing(ast, tokens, options),
        () => visitShadows(ast, tokens, options),
        () => visitOpacity(ast, tokens, options),
    ]) {
        for (const [id, warning] of visit()) {
            if (!merged.has(id)) merged.set(id, warning)
        }
    }

    // visitInlineStyles returns { warnings, coverage } — unpack warnings only for merge
    const { warnings: inlineWarnings } = visitInlineStyles(ast, tokens, options)
    for (const [id, warning] of inlineWarnings) {
        if (!merged.has(id)) merged.set(id, warning)
    }

    // visitLocalTokenObjects — 7th visitor (Phase 2: MITHRIL-DTO-001)
    const dtoWarnings = visitLocalTokenObjects(ast, tokens, options)
    for (const [id, warning] of dtoWarnings) {
        if (!merged.has(id)) merged.set(id, warning)
    }

    // CR-SEAL: REG-001 — Registry membership audit for JSX elements
    if (options?.registry && Object.keys(options.registry).length > 0) {
        const regWarnings = visitRegistryUsage(ast, options.registry, options)
        for (const [id, warning] of regWarnings) {
            if (!merged.has(id)) merged.set(id, warning)
        }
    }

    // SYNC.3: Append sync violations when syncDb is available
    if (options?.syncDb && options.projectRoot) {
        const syncMode = options.ruleModes?.['SYNC-001']
        const orphanMode = options.ruleModes?.['SYNC-002']
        if (syncMode !== 'off' || orphanMode !== 'off') {
            const localTokens: DesignTokenFileEntry[] = tokens.map((t) => ({
                token_path: t.token_path,
                token_type: t.token_type,
                token_value: t.token_value,
            }))
            const syncWarnings = checkSyncViolations(
                localTokens,
                options.syncDb,
                options.projectRoot,
                options.deltaE_threshold,
            )
            for (const warning of syncWarnings) {
                // Respect per-rule off mode
                if (warning.ruleId === 'SYNC-001' && syncMode === 'off') continue
                if (warning.ruleId === 'SYNC-002' && orphanMode === 'off') continue
                // Advisory downgrade
                if (warning.ruleId === 'SYNC-001' && syncMode === 'advisory') {
                    warning.severity = 'advisory'
                }
                if (warning.ruleId === 'SYNC-002' && orphanMode === 'advisory') {
                    warning.severity = 'advisory'
                }
                if (!merged.has(warning.id)) merged.set(warning.id, warning)
            }
        }
    }

    return merged
}
