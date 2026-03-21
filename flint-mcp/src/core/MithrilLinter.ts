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
 *   auditAll      — run all five visitors and return merged Map<id, warning>
 *   visitClassNames, visitTypography, visitSpacing, visitShadows, visitOpacity
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
import type { DesignToken, LinterWarning } from '../types.js'
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
            warnings.set(nodeId, {
                id: nodeId,
                type: 'color-drift',
                severity: colSeverity,
                value: worstDelta,
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
                        warnings.set(nodeId, {
                            id: nodeId,
                            type: 'typography-drift',
                            severity: ruleMode === 'advisory' ? 'advisory' : 'amber',
                            value: 1,
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
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'spacing-drift',
                        severity: spcMode === 'advisory' ? 'advisory' : 'amber',
                        value: 1,
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
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'shadow-drift',
                        severity: shdMode === 'advisory' ? 'advisory' : 'amber',
                        value: 1,
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
                    warnings.set(nodeId, {
                        id: nodeId,
                        type: 'opacity-drift',
                        severity: opcMode === 'advisory' ? 'advisory' : 'amber',
                        value: 1,
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

// ── auditAll ──────────────────────────────────────────────────────────────────

/** Options for auditAll, extending PolicyOptions with optional sync DB. */
export interface AuditAllOptions extends PolicyOptions {
    /** When provided, enables SYNC-001/SYNC-002 violation checking against the token_source table. */
    syncDb?: Database.Database
    /** Project root path for token_source lookups (required when syncDb is set). */
    projectRoot?: string
}

/**
 * Runs all five Mithril visitors and merges results into a single
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
