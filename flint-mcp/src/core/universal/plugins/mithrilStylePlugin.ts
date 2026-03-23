/**
 * mithrilStylePlugin — Language-agnostic inline style governance
 *
 * A LinterPlugin for the Universal AST engine that catches hardcoded CSS
 * values in `style="..."` and `:style="..."` attributes across ALL supported
 * languages: HTML, Vue single-file components, Angular templates, and any
 * future Svelte or web-component adapter.
 *
 * This is the framework-agnostic complement to MithrilLinter's
 * `visitInlineStyles()` (which handles JSX/TSX object expressions via Babel).
 * Both delegates delegate to `checkStyleProps()` for consistent rule logic,
 * rule IDs, and CIEDE2000 colour matching.
 *
 * Covered rules (same IDs as JSX visitor for consistency):
 *   MITHRIL-IST-COL — hardcoded color (hex, rgb, rgba)
 *   MITHRIL-IST-TYP — hardcoded typography (fontSize, fontWeight, lineHeight, …)
 *   MITHRIL-IST-SPC — hardcoded spacing/dimension (margin, padding, gap, …)
 *   MITHRIL-IST-SHD — hardcoded shadow (boxShadow, textShadow)
 *   MITHRIL-IST-OPC — hardcoded opacity
 *
 * Token injection:
 *   Tokens are passed via `LintContext.config.tokens` (array of DesignToken).
 *   Policy options are passed via `LintContext.config.policyOptions`.
 *   If no tokens are provided the plugin is a no-op (safe, never throws).
 *
 * String style attribute format (HTML/Vue static):
 *   `style="color: #ff0000; font-size: 14px"` → parsed into CSS property declarations
 *
 * Vue dynamic binding (best-effort, string-only):
 *   `:style="{ color: '#ff0000' }"` → raw expression string; object literals with
 *   quoted string values are parsed. References (e.g. `{ color: themeColor }`) are
 *   silently skipped (cannot be statically evaluated).
 */

import type { LinterPlugin, LinterRule, LintContext, LintViolation } from '../linterPlugin.js'
import type { FlintNode } from '../flintNode.js'
import type { DesignToken } from '../../../types.js'
import {
    checkStyleProps,
    type StylePropEntry,
    type PolicyOptions,
} from '../../MithrilLinter.js'

// ── CSS string parser ────────────────────────────────────────────────────────

/**
 * Convert hyphenated CSS property name to camelCase.
 * e.g. 'font-size' → 'fontSize', 'background-color' → 'backgroundColor'
 */
function kebabToCamel(prop: string): string {
    return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Parse a CSS declaration string into StylePropEntry array.
 * e.g. "color: #ff0000; font-size: 14px; margin-top: 8px"
 *
 * - Properties are converted from hyphenated to camelCase.
 * - Numeric-only values (e.g. `opacity: 0.5`) are parsed as numericValue.
 * - Returns an empty array for empty/invalid input (never throws).
 */
function parseCssString(css: string): StylePropEntry[] {
    const entries: StylePropEntry[] = []
    for (const decl of css.split(';')) {
        const colonIdx = decl.indexOf(':')
        if (colonIdx === -1) continue
        const rawProp = decl.slice(0, colonIdx).trim()
        const rawVal = decl.slice(colonIdx + 1).trim()
        if (!rawProp || !rawVal) continue
        const camelProp = kebabToCamel(rawProp)
        const numCandidate = parseFloat(rawVal)
        const isNumOnly = !isNaN(numCandidate) && String(numCandidate) === rawVal
        entries.push({
            prop: camelProp,
            stringValue: isNumOnly ? null : rawVal,
            numericValue: isNumOnly ? numCandidate : null,
        })
    }
    return entries
}

/**
 * Best-effort parser for Vue `:style="{ prop: 'value', ... }"` expressions.
 * Only extracts properties whose values are single-quoted or double-quoted
 * string literals. Dynamic references are silently dropped.
 *
 * e.g. `{ color: '#ff0000', fontWeight: 'bold', margin: dynamicVal }`
 *   → [{prop:'color', stringValue:'#ff0000', numericValue:null},
 *      {prop:'fontWeight', stringValue:'bold', numericValue:null}]
 *
 * Handles both camelCase and hyphenated property names.
 * Returns empty array for non-object-literal expressions (never throws).
 */
function parseVueStyleBinding(expr: string): StylePropEntry[] {
    const entries: StylePropEntry[] = []
    // Match identifier or quoted-string key: 'value' or "value"
    const propRe = /['"]?([\w-]+)['"]?\s*:\s*(?:'([^']*)'|"([^"]*)"|([\d.]+))/g
    let m: RegExpExecArray | null
    while ((m = propRe.exec(expr)) !== null) {
        const rawProp = m[1]
        const strVal = m[2] ?? m[3] ?? null
        const numRaw = m[4] ?? null
        if (!rawProp) continue
        const camelProp = kebabToCamel(rawProp)
        if (strVal !== null) {
            entries.push({ prop: camelProp, stringValue: strVal, numericValue: null })
        } else if (numRaw !== null) {
            const n = parseFloat(numRaw)
            entries.push({ prop: camelProp, stringValue: null, numericValue: isNaN(n) ? null : n })
        }
    }
    return entries
}

// ── Plugin factory ───────────────────────────────────────────────────────────

/**
 * Build a LinterPlugin that inspects `style` and `:style` attributes on any
 * FlintNode and flags hardcoded values that should be design tokens.
 *
 * Tokens and policy options are resolved at visit-time from LintContext.config
 * so the plugin factory does not need to be recreated when tokens change.
 */
export function createMithrilStylePlugin(): LinterPlugin {
    const rule: LinterRule = {
        id: 'MITHRIL-IST',
        severity: 'warning',
        visit(node: FlintNode, context: LintContext): LintViolation | null {
            // Resolve tokens from context config (injected by the audit handler)
            const tokens = (context.config['tokens'] as DesignToken[] | undefined) ?? []
            const policyOptions = context.config['policyOptions'] as PolicyOptions | undefined

            // No tokens → nothing to check against (not an error)
            if (tokens.length === 0) return null

            let entries: StylePropEntry[] = []

            // ── Static style attribute (HTML, Vue static, Angular) ──────────
            const styleAttr = node.attributes.get('style')
            if (typeof styleAttr === 'string' && styleAttr.trim() !== '') {
                entries = parseCssString(styleAttr)
            }

            // ── Vue dynamic :style binding (best-effort) ────────────────────
            if (entries.length === 0) {
                const vueStyle = node.attributes.get(':style')
                if (typeof vueStyle === 'string' && vueStyle.trim() !== '') {
                    // Object literal: { color: '#ff0000' }
                    if (vueStyle.includes('{')) {
                        entries = parseVueStyleBinding(vueStyle)
                    }
                    // String binding: "'color: #ff0000'" — unwrap and parse as CSS
                    else if (/^['"]/.test(vueStyle.trim())) {
                        const unwrapped = vueStyle.trim().replace(/^['"]|['"]$/g, '')
                        entries = parseCssString(unwrapped)
                    }
                }
            }

            // ── Angular [style.*] directives ────────────────────────────────
            // Angular uses [style.font-size]="expr" which produces an attribute
            // named `[style.font-size]` with a dynamic value. Skip dynamic
            // expressions; only flag literal string/number values.
            for (const [attrName, attrValue] of node.attributes.entries()) {
                const angularMatch = /^\[style\.([\w-]+)\]$/.exec(String(attrName))
                if (angularMatch === null) continue
                const propName = kebabToCamel(angularMatch[1])
                const rawVal = String(attrValue ?? '')
                // Only flag quoted string literals or bare numbers
                const strMatch = /^['"]([^'"]+)['"]$/.exec(rawVal)
                if (strMatch !== null) {
                    entries.push({ prop: propName, stringValue: strMatch[1], numericValue: null })
                } else {
                    const n = parseFloat(rawVal)
                    if (!isNaN(n) && String(n) === rawVal) {
                        entries.push({ prop: propName, stringValue: null, numericValue: n })
                    }
                }
            }

            if (entries.length === 0) return null

            const warning = checkStyleProps(entries, node.id, tokens, policyOptions)
            if (warning === null) return null

            // Map LinterWarning severity to LintViolation severity
            const sev: LintViolation['severity'] =
                warning.severity === 'critical' ? 'error' : 'warning'

            return {
                ruleId: warning.ruleId ?? 'MITHRIL-IST',
                nodeId: node.id,
                message: warning.message,
                severity: sev,
                fixable: false,
            }
        },
    }

    return {
        id: 'mithril-inline-style',
        name: 'Mithril Inline Style Governance',
        rules: [rule],
    }
}
