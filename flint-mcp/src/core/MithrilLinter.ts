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
 *   auditAll      — run all visitors and return merged Map<id, warning>
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
import { hexToLab, deltaE2000, computeContrastRatio } from './colorMath.js'
import { TW_V3_TO_V4_MAP } from './tailwindMigrator.js'
import type { TailwindVersion } from './tailwindVersionResolver.js'
import { visitDarkModeSafety, projectHasDarkMode } from './darkModeSafety.js'
import { validateComposition } from './compositionValidator.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── CIEDE2000 engine — shared via colorMath.ts ──────────────────────────────

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
 * The 16 basic CSS named colors that matter for CIEDE2000 comparison.
 * Does not attempt to cover all 140+ CSS named colors — only the ones
 * common enough to appear as hardcoded design values.
 */
const CSS_NAMED_COLORS: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    gray: '#808080',
    grey: '#808080',
    brown: '#a52a2a',
    lime: '#00ff00',
    navy: '#000080',
}

/**
 * Converts an HSL(A) color to a hex string.
 * Handles both comma-separated (`hsl(H, S%, L%)`) and CSS4 space-separated
 * (`hsl(H S% L%)`) forms. Alpha component is ignored for CIEDE2000 purposes.
 */
function hslToHex(h: number, s: number, l: number): string {
    const sNorm = s / 100
    const lNorm = l / 100
    const a = sNorm * Math.min(lNorm, 1 - lNorm)
    const f = (n: number): string => {
        const k = (n + h / 30) % 12
        const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Converts a CSS color string to hex for CIEDE2000 comparison.
 * Handles: #RGB, #RRGGBB, #RRGGBBAA, rgb(r,g,b), rgba(r,g,b,a), CSS4 space-sep rgb(),
 *          hsl(H,S%,L%), hsla(H,S%,L%,A), CSS4 space-sep hsl(H S% L%),
 *          16 basic CSS named colors.
 * Returns null for: currentColor, inherit, var() — these are token references or
 *          dynamic values that cannot be statically evaluated.
 * Returns null for: oklch(), oklab() — modern perceptual color spaces that require
 *          a full color science library to convert; treated as skipped-dynamic.
 */
export function parseCssColorToHex(value: string): string | null {
    const trimmed = value.trim()

    // Hex literals
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed

    // rgb() / rgba() — comma-separated or CSS4 space-separated
    const rgbMatch = /^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i.exec(trimmed)
    if (rgbMatch !== null) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0')
        return `#${r}${g}${b}`
    }

    // hsl() / hsla() — comma-separated and CSS4 space-separated forms
    // Alpha is ignored; only H, S, L are used for CIEDE2000 comparison.
    const hslMatch = /^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/i.exec(trimmed)
    if (hslMatch !== null) {
        const h = parseFloat(hslMatch[1])
        const s = parseFloat(hslMatch[2])
        const l = parseFloat(hslMatch[3])
        if (!isNaN(h) && !isNaN(s) && !isNaN(l)) {
            return hslToHex(h, s, l)
        }
    }

    // oklch() / oklab() — modern perceptual color spaces. A full conversion
    // requires gamut-mapping and a CIE matrix that is out of scope here.
    // Return null so the caller treats these as skipped-dynamic.
    if (/^oklch\s*\(/i.test(trimmed) || /^oklab\s*\(/i.test(trimmed)) return null

    // CSS var() references — attempt to extract fallback value first.
    // var(--token, <fallback>) — the fallback is a hardcoded literal that should be flagged
    // if it drifts from tokens. Recurse through the same parser so nested forms like
    // var(--x, hsl(0, 100%, 50%)) and var(--a, var(--b, #0000ff)) also resolve.
    if (/^var\s*\(/i.test(trimmed)) {
        const varFallbackMatch = /^var\([^,]+,\s*(.+)\)$/.exec(trimmed)
        if (varFallbackMatch !== null) {
            return parseCssColorToHex(varFallbackMatch[1].trim())
        }
        return null
    }

    // CSS named colors (16 basic set)
    const named = CSS_NAMED_COLORS[trimmed.toLowerCase()]
    if (named !== undefined) return named

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

/** Regex to detect background color classes (arbitrary hex values) */
const BG_ARBITRARY_COLOR_RE = /^(?:[\w-]+:)*bg-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

/** Regex to detect text/foreground color classes (arbitrary hex values) */
const TEXT_ARBITRARY_COLOR_RE = /^(?:[\w-]+:)*text-\[(?<hex>#[0-9a-fA-F]{3,8})\]$/

/**
 * Extract the background hex color from a className string, if present as an
 * arbitrary Tailwind value (e.g. `bg-[#1a1a1a]`).
 */
function extractBgHex(classStr: string): string | null {
    for (const cls of classStr.split(/\s+/)) {
        const m = BG_ARBITRARY_COLOR_RE.exec(cls)
        if (m?.groups?.hex !== undefined) return m.groups.hex
    }
    return null
}

/**
 * Extract the text hex color from a className string, if present as an
 * arbitrary Tailwind value (e.g. `text-[#ffffff]`).
 */
function extractTextHex(classStr: string): string | null {
    for (const cls of classStr.split(/\s+/)) {
        const m = TEXT_ARBITRARY_COLOR_RE.exec(cls)
        if (m?.groups?.hex !== undefined) return m.groups.hex
    }
    return null
}

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
            let worstHex: string | null = null

            for (const cls of classStr.split(/\s+/)) {
                const m = ARBITRARY_COLOR_RE.exec(cls)
                if (m?.groups?.hex === undefined) continue
                const match = findClosestToken(m.groups.hex, colorTokens)
                if (match !== null && match.deltaE > worstDelta) {
                    worstDelta = match.deltaE
                    worstMatch = match
                    worstHex = m.groups.hex
                }
            }

            if (worstDelta <= threshold) return

            const tokenLabel = worstMatch?.tokenPath ?? null
            const colSeverity: LinterWarning['severity'] = colMode === 'advisory'
                ? 'advisory'
                : severity(worstDelta, criticalThreshold)
            const loc = path.node.loc?.start

            // ── Contrast-awareness: check if the suggested token would fail
            //    WCAG AA contrast against the detected paired color ──────────
            let contrastNote = ''
            if (worstMatch !== null && worstHex !== null) {
                // Determine paired color: if the drifted color is a text-* class,
                // pair against bg-*; if it's a bg-* class, pair against text-*.
                const bgHex = extractBgHex(classStr)
                const textHex = extractTextHex(classStr)
                let pairedHex: string | null = null

                if (worstHex === textHex && bgHex !== null) {
                    pairedHex = bgHex
                } else if (worstHex === bgHex && textHex !== null) {
                    pairedHex = textHex
                }

                if (pairedHex !== null) {
                    const ratio = computeContrastRatio(worstMatch.tokenValue, pairedHex)
                    if (ratio !== null && ratio < 4.5) {
                        contrastNote = '. Note: suggested token may not meet WCAG AA contrast requirements'
                    }
                }
            }

            warnings.set(nodeId, {
                id: nodeId,
                type: 'color-drift',
                severity: colSeverity,
                value: worstDelta,
                ...(loc !== undefined ? { line: loc.line, column: loc.column } : {}),
                message: tokenLabel !== null
                    ? `MITHRIL-COL: ΔE ${worstDelta.toFixed(1)} – use ${tokenLabel}${contrastNote}`
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
    /** Props skipped because their value was dynamic (conditional, logical, spread,
     *  template literal with expressions, MemberExpression, Identifier, CallExpression).
     *  A superset of inlinePropsSkipped — reported separately for coverage transparency. */
    skippedDynamic: number
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
    let skippedDynamic = 0

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
                // SpreadElement — attempt same-file resolution; otherwise count as skipped-dynamic
                if (t.isSpreadElement(prop)) {
                    if (t.isIdentifier(prop.argument)) {
                        const binding = path.scope.getBinding(prop.argument.name)
                        if (
                            binding !== undefined &&
                            t.isVariableDeclarator(binding.path.node) &&
                            t.isObjectExpression(binding.path.node.init)
                        ) {
                            // Extract literal properties from the resolved same-file object
                            for (const spreadProp of binding.path.node.init.properties) {
                                if (!t.isObjectProperty(spreadProp)) continue
                                if (!t.isIdentifier(spreadProp.key) && !t.isStringLiteral(spreadProp.key)) continue
                                const spreadPropName = t.isIdentifier(spreadProp.key)
                                    ? spreadProp.key.name
                                    : (spreadProp.key as t.StringLiteral).value
                                const spreadPropValue = spreadProp.value
                                if (t.isStringLiteral(spreadPropValue)) {
                                    inlinePropsScanned++
                                    entries.push({ prop: spreadPropName, stringValue: spreadPropValue.value, numericValue: null })
                                } else if (t.isNumericLiteral(spreadPropValue)) {
                                    inlinePropsScanned++
                                    entries.push({ prop: spreadPropName, stringValue: null, numericValue: spreadPropValue.value })
                                } else {
                                    skippedDynamic++
                                }
                            }
                        } else {
                            // Binding not found, imported, or not a plain object literal — skipped-dynamic
                            skippedDynamic++
                        }
                    } else {
                        // Non-identifier spread (e.g. CallExpression) — cannot resolve statically
                        skippedDynamic++
                    }
                    continue
                }
                if (!t.isObjectProperty(prop)) continue
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
                } else if (t.isConditionalExpression(propValue)) {
                    // Ternary: extract both branches if they are literals; otherwise count as dynamic
                    const { consequent, alternate } = propValue
                    const consLit = t.isStringLiteral(consequent) || t.isNumericLiteral(consequent)
                    const altLit = t.isStringLiteral(alternate) || t.isNumericLiteral(alternate)
                    if (consLit) {
                        inlinePropsScanned++
                        entries.push({
                            prop: propName,
                            stringValue: t.isStringLiteral(consequent) ? consequent.value : null,
                            numericValue: t.isNumericLiteral(consequent) ? consequent.value : null,
                        })
                    }
                    if (altLit) {
                        inlinePropsScanned++
                        entries.push({
                            prop: propName,
                            stringValue: t.isStringLiteral(alternate) ? alternate.value : null,
                            numericValue: t.isNumericLiteral(alternate) ? alternate.value : null,
                        })
                    }
                    if (!consLit || !altLit) {
                        // At least one branch is dynamic
                        skippedDynamic++
                        inlinePropsSkipped++
                    }
                } else if (t.isLogicalExpression(propValue)) {
                    // Logical (&&, ||, ??): extract right operand if it is a literal
                    const { right } = propValue
                    if (t.isStringLiteral(right)) {
                        inlinePropsScanned++
                        entries.push({ prop: propName, stringValue: right.value, numericValue: null })
                    } else if (t.isNumericLiteral(right)) {
                        inlinePropsScanned++
                        entries.push({ prop: propName, stringValue: null, numericValue: right.value })
                    } else {
                        skippedDynamic++
                        inlinePropsSkipped++
                    }
                } else if (t.isTemplateLiteral(propValue)) {
                    // Template literal with zero expressions is a static string
                    if (propValue.expressions.length === 0 && propValue.quasis.length === 1) {
                        const cooked = propValue.quasis[0].value.cooked
                        if (cooked !== null && cooked !== undefined) {
                            inlinePropsScanned++
                            entries.push({ prop: propName, stringValue: cooked, numericValue: null })
                        } else {
                            skippedDynamic++
                            inlinePropsSkipped++
                        }
                    } else {
                        // Has interpolated expressions — dynamic
                        skippedDynamic++
                        inlinePropsSkipped++
                    }
                } else {
                    // MemberExpression, Identifier, CallExpression → skip (uses tokens)
                    skippedDynamic++
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

    return { warnings, coverage: { inlinePropsScanned, inlinePropsSkipped, inlineViolations, skippedDynamic } }
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

// ── P2: Rogue Intrinsic Detection (MITHRIL-REG-001) ────────────────────────────

import type { ComponentEntry } from './registryService.js'

/**
 * Mapping from HTML intrinsic tag names to the design system classification
 * keywords used to match against registry component names.
 *
 * Each entry maps an intrinsic → array of possible component name patterns
 * (lowercased). The first registry component whose lowercased name matches
 * any of these patterns wins.
 */
const INTRINSIC_TO_COMPONENT_KEYWORDS: Record<string, string[]> = {
    button: ['button'],
    input: ['input', 'textfield'],
    select: ['select', 'dropdown', 'combobox'],
    textarea: ['textarea'],
    table: ['table', 'datatable', 'data-table'],
    dialog: ['dialog', 'modal'],
    a: ['link'],
    img: ['image', 'avatar'],
    nav: ['navigation', 'navbar', 'nav'],
    form: ['form'],
}

/** The set of intrinsic tags we check for rogue usage. */
const ROGUE_INTRINSIC_TAGS = new Set(Object.keys(INTRINSIC_TO_COMPONENT_KEYWORDS))

/**
 * Build a lookup map: intrinsic tag → ComponentEntry from the registry.
 * For each intrinsic, scan registry entries whose lowercased name matches
 * one of the classification keywords.
 */
function buildIntrinsicToRegistryMap(
    registryEntries: ComponentEntry[],
): Map<string, ComponentEntry> {
    const map = new Map<string, ComponentEntry>()

    for (const tag of ROGUE_INTRINSIC_TAGS) {
        const keywords = INTRINSIC_TO_COMPONENT_KEYWORDS[tag]
        for (const entry of registryEntries) {
            const lowerName = entry.name.toLowerCase()
            if (keywords.some(kw => lowerName === kw || lowerName.includes(kw))) {
                map.set(tag, entry)
                break // first match wins per intrinsic tag
            }
        }
    }

    return map
}

/**
 * Build prop translation hints for a rogue intrinsic replacement.
 * Compares the HTML attribute names against the registry component's PropDefinition.
 */
function buildPropHints(
    intrinsicTag: string,
    attrs: t.JSXAttribute[],
    registryEntry: ComponentEntry,
): string[] {
    const hints: string[] = []

    // Common HTML attr → design system prop mappings
    const attrTranslations: Record<string, Record<string, string>> = {
        button: { disabled: 'isDisabled', type: 'type' },
        input: { disabled: 'isDisabled', type: 'type', placeholder: 'placeholder', value: 'value' },
        select: { disabled: 'isDisabled', value: 'value' },
        textarea: { disabled: 'isDisabled', placeholder: 'placeholder', rows: 'rows' },
        a: { href: 'href', target: 'target' },
        img: { src: 'src', alt: 'alt' },
    }

    const translations = attrTranslations[intrinsicTag] ?? {}
    const registryProps = registryEntry.props ?? {}

    for (const attr of attrs) {
        if (!t.isJSXIdentifier(attr.name)) continue
        const htmlAttr = attr.name.name
        const dsName = translations[htmlAttr]

        if (dsName && dsName !== htmlAttr) {
            // Prop name differs — always hint regardless of PropDefinition presence
            hints.push(`${htmlAttr} → ${dsName}`)
        }
    }

    return hints
}

/**
 * MITHRIL-REG-001: Walk JSX elements and flag intrinsic HTML elements
 * that have a design system component equivalent in the registry.
 *
 * Only fires when `registryEntries` is non-empty. This is the P2
 * "Rogue Intrinsic Detector" — the inverse of REG-001.
 *
 * REG-001 flags PascalCase components NOT in the registry.
 * MITHRIL-REG-001 flags lowercase intrinsics that SHOULD be registry components.
 */
export function visitRogueIntrinsics(
    ast: File,
    registryEntries: ComponentEntry[],
    options?: PolicyOptions,
): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    // Respect per-rule modes
    const mode = options?.ruleModes?.['MITHRIL-REG-001']
    if (mode === 'off') return warnings

    // No registry → skip entirely
    if (!registryEntries || registryEntries.length === 0) return warnings

    // Build O(1) lookup map: intrinsic tag → registry component
    const intrinsicMap = buildIntrinsicToRegistryMap(registryEntries)
    if (intrinsicMap.size === 0) return warnings

    // Hoist taxonomy lookup
    const taxonomyEntry = getErrorEntryByRuleId('MITHRIL-REG-001')

    traverse(ast, {
        JSXOpeningElement(path) {
            const nameNode = path.node.name

            // Only JSXIdentifier (lowercase intrinsics)
            if (!t.isJSXIdentifier(nameNode)) return
            const tag = nameNode.name

            // Must be a rogue-detectable intrinsic
            if (!ROGUE_INTRINSIC_TAGS.has(tag)) return

            // Check if registry has a matching component
            const registryMatch = intrinsicMap.get(tag)
            if (!registryMatch) return

            // Build warning ID
            const loc = nameNode.loc?.start
            const warningId = `rogue-${tag}-${loc?.line ?? 0}-${loc?.column ?? 0}`

            const severity: LinterWarning['severity'] = mode === 'advisory' ? 'advisory' : 'amber'

            // Collect prop hints
            const jsxAttrs = path.node.attributes.filter(
                (a): a is t.JSXAttribute => t.isJSXAttribute(a),
            )
            const propHints = buildPropHints(tag, jsxAttrs, registryMatch)
            const propHintNote = propHints.length > 0
                ? ` Prop mapping: ${propHints.join(', ')}.`
                : ''

            const importNote = registryMatch.importPath
                ? ` from '${registryMatch.importPath}'`
                : ''

            const message = `Use <${registryMatch.name}>${importNote} instead of <${tag}>.${propHintNote}`

            warnings.set(warningId, {
                id: warningId,
                type: 'registry',
                severity,
                value: 0,
                message,
                nearestToken: null,
                nearestTokenValue: null,
                ruleId: 'MITHRIL-REG-001',
                fixable: false,
                explanation: taxonomyEntry?.explanation ??
                    'A raw HTML element was used when a design system component is available. ' +
                    'Replace the intrinsic with the library component for consistency and accessibility.',
                recovery: taxonomyEntry?.recovery ??
                    `Replace <${tag}> with <${registryMatch.name}>${importNote}.`,
                line: loc?.line,
                column: loc?.column,
            })
        },
    })

    return warnings
}

// ── Visitor — Tailwind Version Drift (MITHRIL-TW-001, MITHRIL-TW-002) ────────

/**
 * Build a reverse map: v4 replacement → v3 original class.
 * Only includes entries where key !== value (real renames, not identity transforms).
 */
const TW_V4_TO_V3_MAP: Readonly<Record<string, string>> = (() => {
    const rev: Record<string, string> = {}
    for (const [v3, v4] of Object.entries(TW_V3_TO_V4_MAP)) {
        if (v3 !== v4) rev[v4] = v3
    }
    return rev
})()

/**
 * Opacity modifier pattern: matches v3 `bg-opacity-N`, `text-opacity-N`, etc.
 * Used for the merged fix suggestion (e.g. `bg-blue-500/50`).
 */
const OPACITY_MODIFIER_RE = /^(bg|text|border|divide|ring|placeholder)-opacity-(\d+)$/

/**
 * Color class pattern: matches utility color classes like `bg-blue-500`, `text-red-300`, etc.
 * Captures the prefix (bg, text, border, etc.) and the color part.
 */
const COLOR_CLASS_RE = /^(bg|text|border|divide|ring)-([\w][\w-]*\d{2,3})$/

/**
 * P1c: Walk JSX elements and flag Tailwind classes that are mismatched with the
 * project's Tailwind version.
 *
 * - MITHRIL-TW-001: v3 deprecated class in a v4 project
 * - MITHRIL-TW-002: v4-only class in a v3 project
 *
 * Handles the opacity modifier edge case: when `bg-opacity-50` is found alongside
 * a color class like `bg-blue-500`, the fix suggestion merges them to `bg-blue-500/50`.
 */
export function visitTailwindVersionDrift(
    ast: File,
    tailwindVersion: TailwindVersion,
    options?: PolicyOptions,
): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    // Respect policy: `mithril.tailwindVersionCheck` maps to both TW-001 and TW-002
    const tw001Mode = options?.ruleModes?.['MITHRIL-TW-001']
    const tw002Mode = options?.ruleModes?.['MITHRIL-TW-002']

    // If both are off, skip entirely
    if (tw001Mode === 'off' && tw002Mode === 'off') return warnings

    const isV4 = tailwindVersion.major === 4
    const isV3 = tailwindVersion.major === 3

    // Hoist taxonomy lookups
    const tw001Taxonomy = getErrorEntryByRuleId('MITHRIL-TW-001')
    const tw002Taxonomy = getErrorEntryByRuleId('MITHRIL-TW-002')

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl)
            if (nodeId === null) return

            const classStr = getClassString(path.node)
            if (classStr === null) return

            const classes = classStr.split(/\s+/).filter(Boolean)
            const loc = path.node.loc?.start

            // ── v4 project: flag deprecated v3 classes (MITHRIL-TW-001) ──────
            if (isV4 && tw001Mode !== 'off') {
                for (const cls of classes) {
                    const replacement = TW_V3_TO_V4_MAP[cls]
                    // Identity transforms (key === value) are not real deprecations
                    if (replacement === undefined || replacement === cls) continue

                    // Check for opacity modifier edge case
                    const opMatch = OPACITY_MODIFIER_RE.exec(cls)
                    let fixSuggestion = replacement
                    if (opMatch) {
                        const prefix = opMatch[1]     // e.g. 'bg'
                        const opacity = opMatch[2]    // e.g. '50'
                        // Find sibling color class with matching prefix
                        const siblingColor = classes.find(c => {
                            const cm = COLOR_CLASS_RE.exec(c)
                            return cm !== null && cm[1] === prefix
                        })
                        if (siblingColor) {
                            fixSuggestion = `${siblingColor}/${opacity} (remove ${cls})`
                        }
                    }

                    const warningId = `tw-${nodeId}-${cls}`
                    const twSeverity: LinterWarning['severity'] = tw001Mode === 'advisory'
                        ? 'advisory'
                        : 'amber'

                    warnings.set(warningId, {
                        id: warningId,
                        type: 'tailwind-version-drift',
                        severity: twSeverity,
                        value: 0,
                        message: `MITHRIL-TW-001: \`${cls}\` is deprecated in Tailwind v4 — use \`${fixSuggestion}\``,
                        nearestToken: null,
                        nearestTokenValue: null,
                        ruleId: 'MITHRIL-TW-001',
                        fixable: true,
                        explanation: tw001Taxonomy?.explanation ??
                            'This Tailwind class was deprecated or renamed in v4.',
                        recovery: tw001Taxonomy?.recovery ??
                            'Replace the deprecated class with its v4 equivalent.',
                        line: loc?.line,
                        column: loc?.column,
                    })
                }
            }

            // ── v3 project: flag v4-only classes (MITHRIL-TW-002) ────────────
            if (isV3 && tw002Mode !== 'off') {
                for (const cls of classes) {
                    const v3Original = TW_V4_TO_V3_MAP[cls]
                    if (v3Original === undefined) continue

                    const warningId = `tw-${nodeId}-${cls}`
                    const twSeverity: LinterWarning['severity'] = tw002Mode === 'advisory'
                        ? 'advisory'
                        : 'amber'

                    warnings.set(warningId, {
                        id: warningId,
                        type: 'tailwind-version-drift',
                        severity: twSeverity,
                        value: 0,
                        message: `MITHRIL-TW-002: \`${cls}\` is a v4-only class — use \`${v3Original}\` for Tailwind v3`,
                        nearestToken: null,
                        nearestTokenValue: null,
                        ruleId: 'MITHRIL-TW-002',
                        fixable: true,
                        explanation: tw002Taxonomy?.explanation ??
                            'This Tailwind class only exists in v4.',
                        recovery: tw002Taxonomy?.recovery ??
                            'Replace the v4-only class with its v3 equivalent.',
                        line: loc?.line,
                        column: loc?.column,
                    })
                }
            }
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
    /** P1c: When provided, enables MITHRIL-TW-001/TW-002 Tailwind version drift checking. */
    tailwindVersion?: TailwindVersion
    /** P1d: When true, MITHRIL-DARK-001 violations are blocking; when false (default), advisory. */
    requiresDarkMode?: boolean
    /** P2: When provided, enables MITHRIL-REG-001 rogue intrinsic detection against these registry entries. */
    registryEntries?: ComponentEntry[]
    /** P2.5: When provided, enables MITHRIL-COMP-001/002/003 composition validation against these registry entries. */
    compositionRegistry?: Record<string, ComponentEntry>
}

/**
 * Runs all Mithril visitors (up to nine) and merges results into a single
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

    // P2: Rogue intrinsic detection — MITHRIL-REG-001
    if (options?.registryEntries && options.registryEntries.length > 0) {
        const rogueWarnings = visitRogueIntrinsics(ast, options.registryEntries, options)
        for (const [id, warning] of rogueWarnings) {
            if (!merged.has(id)) merged.set(id, warning)
        }
    }

    // P1c: Tailwind version drift checking
    if (options?.tailwindVersion) {
        const twWarnings = visitTailwindVersionDrift(ast, options.tailwindVersion, options)
        for (const [id, warning] of twWarnings) {
            if (!merged.has(id)) merged.set(id, warning)
        }
    }

    // P1d: Dark mode safety checking (skips automatically if no dark mode tokens exist)
    {
        const darkWarnings = visitDarkModeSafety(ast, tokens, {
            ...options,
            requiresDarkMode: options?.requiresDarkMode,
        })
        for (const [id, warning] of darkWarnings) {
            if (!merged.has(id)) merged.set(id, warning)
        }
    }

    // P2.5: Composition validation — MITHRIL-COMP-001/002/003
    if (options?.compositionRegistry && Object.keys(options.compositionRegistry).length > 0) {
        const compWarnings = validateComposition(ast, options.compositionRegistry, options)
        for (const [id, warning] of compWarnings) {
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
