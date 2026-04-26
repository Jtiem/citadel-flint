/**
 * Dark Mode Safety Checker — flint-mcp/src/core/darkModeSafety.ts
 *
 * P1d: Detects light-mode-only hardcoded color usage in JSX elements and
 * verifies that dark mode counterparts exist via either `dark:` Tailwind
 * variants or semantic design tokens that auto-flip.
 *
 * Exports:
 *   projectHasDarkMode  — check if the token set contains dark mode values
 *   visitDarkModeSafety — MithrilLinter visitor for MITHRIL-DARK-001
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import type { DesignToken, LinterWarning } from '../types.js'
import { getErrorEntryByRuleId } from './errorTaxonomy.js'
import type { PolicyOptions } from './MithrilLinter.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Color utility patterns ───────────────────────────────────────────────────

/**
 * Matches Tailwind color utility classes including arbitrary values.
 * Captures:
 *   group 1 — variant prefix (e.g. "dark", "hover", or absent)
 *   group 2 — the utility prefix (bg, text, border, divide, accent, caret,
 *              fill, stroke, decoration, placeholder, from, via, to)
 *   group 3 — the color part (e.g. "gray-900", "white", "[#fff]", "[#ffffff]", "blue-500/50")
 *
 * Intentionally excludes `shadow`, `ring`, and `outline` because those are
 * elevation/focus utilities — their suffix (e.g. `shadow-md`, `ring-1`,
 * `outline-offset-2`) is not a color value and must not trigger dark-mode
 * drift warnings. A project using `shadow-md` without `dark:shadow-md` is
 * styling elevation, not colour.
 *
 * Also matches variant-prefixed classes (e.g. "dark:bg-gray-100").
 */
const COLOR_UTILITY_RE =
    /^(?:([a-z-]+):)?(bg|text|border|divide|accent|caret|fill|stroke|decoration|placeholder|from|via|to)-([\w[\]#/.%-]+)$/

/**
 * Non-color suffixes that slip through for `ring-*` / `outline-*` if those
 * prefixes were included. Belt-and-suspenders guard — currently unused because
 * those prefixes were removed from COLOR_UTILITY_RE above, but kept for
 * documentation and future expansion.
 */
/**
 * Property groups — maps a Tailwind prefix to a canonical "property" for
 * pairing light/dark classes. E.g. both `bg-white` and `dark:bg-gray-900`
 * map to property "bg".
 */
type ColorProperty = string

interface ColorClassInfo {
    /** The full original class string. */
    raw: string
    /** Variant prefix, e.g. "dark", "hover", or null for no variant. */
    variant: string | null
    /** The utility prefix (bg, text, border, etc.). */
    prefix: ColorProperty
    /** The color value part (gray-900, white, [#fff], etc.). */
    colorPart: string
}

// ── Token mode detection ─────────────────────────────────────────────────────

/**
 * Determines whether the project's token set includes dark mode values.
 *
 * Returns true if any token:
 *   - Has a `modes` field with a `dark` key (extended schema)
 *   - Has a `mode` field equal to 'dark' or 'Dark'
 *   - Has a token_path containing '/dark/' or '.dark.' (path convention)
 */
export function projectHasDarkMode(tokens: DesignToken[]): boolean {
    for (const token of tokens) {
        // Check extended schema modes field
        if ((token as DesignTokenWithModes).modes?.dark !== undefined) return true
        // Check mode field
        if (token.mode === 'dark' || token.mode === 'Dark') return true
        // Check path convention
        if (/[./]dark[./]/i.test(token.token_path)) return true
    }
    return false
}

/** Extended DesignToken type that supports multi-mode values. */
export interface DesignTokenWithModes extends DesignToken {
    modes?: Record<string, string>
}

/**
 * Checks whether a specific token path resolves to a semantic token that
 * has both light and dark values. Returns the dark mode value if found,
 * or null if the token is a primitive without dark mode support.
 */
function findSemanticDarkToken(
    tokenPath: string,
    tokens: DesignToken[],
): string | null {
    // Strategy 1: Check for extended modes field on the matching token
    for (const token of tokens) {
        if (token.token_path === tokenPath) {
            const extended = token as DesignTokenWithModes
            if (extended.modes?.dark !== undefined) return extended.modes.dark
        }
    }

    // Strategy 2: Check if there's a dark-mode companion token (same path, mode=dark)
    for (const token of tokens) {
        if (
            token.token_path === tokenPath &&
            (token.mode === 'dark' || token.mode === 'Dark')
        ) {
            return token.token_value
        }
    }

    return null
}

/**
 * Maps a Tailwind color class to its corresponding semantic token path, if one
 * exists. For example, `bg-[var(--color-surface)]` maps to `color.surface`.
 * Returns null if the class uses a primitive value (e.g., `bg-gray-900`).
 */
function resolveSemanticTokenPath(
    colorPart: string,
    tokens: DesignToken[],
): string | null {
    // Check for var() references — these are semantic by definition
    const varMatch = /^\[var\(--([^)]+)\)\]$/.exec(colorPart)
    if (varMatch) {
        const cssVar = varMatch[1]
        // Convert CSS var name to token path (color-surface-bg → color.surface.bg)
        const tokenPath = cssVar.replace(/-/g, '.')
        const found = tokens.find((t) => t.token_path === tokenPath)
        if (found) return found.token_path
    }

    // Check for exact token match via Tailwind utility class naming
    // e.g., "surface" might map to "color.surface"
    for (const token of tokens) {
        if (token.token_type !== 'color') continue
        // Match by last segment of token path
        const segments = token.token_path.split('.')
        const lastSegment = segments[segments.length - 1]
        if (colorPart === lastSegment && findSemanticDarkToken(token.token_path, tokens) !== null) {
            return token.token_path
        }
    }

    return null
}

// ── AST helpers ──────────────────────────────────────────────────────────────

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

// ── Visitor ──────────────────────────────────────────────────────────────────

/**
 * P1d: Dark Mode Safety visitor for MithrilLinter.
 *
 * For each JSX element with color utilities (bg-*, text-*, border-*, etc.):
 * - Skip if the project has no dark mode tokens at all.
 * - Skip if the token is semantic (has both light and dark values).
 * - Skip if the element already has a `dark:` variant for the same property.
 * - Flag as MITHRIL-DARK-001 if a primitive color is used without a dark sibling.
 *
 * Policy: `requiresDarkMode` controls severity (blocking vs advisory).
 */
export function visitDarkModeSafety(
    ast: File,
    tokens: DesignToken[],
    options?: PolicyOptions & { requiresDarkMode?: boolean },
): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    // Respect policy: rule mode 'off' disables entirely
    const ruleMode = options?.ruleModes?.['MITHRIL-DARK-001']
    if (ruleMode === 'off') return warnings

    // Skip entirely if the project has no dark mode tokens
    if (!projectHasDarkMode(tokens)) return warnings

    // Hoist taxonomy lookup
    const taxonomy = getErrorEntryByRuleId('MITHRIL-DARK-001')

    // Determine severity based on requiresDarkMode flag.
    //
    // R3 decision 2026-04-12 (binding — do not revert without WCAG citation):
    // dark-mode-drift is a Mithril advisory/visual concern, NOT a Commandment 5
    // (Accessibility is a Compiler Error) case. WCAG contrast failures, missing
    // labels, and keyboard traps live in Warden (A11yLinter.ts) and remain
    // 'critical'. This visitor flags missing dark-mode companion tokens — a
    // design-system hygiene signal — so the ceiling is capped at 'amber' to
    // stay consistent with every other Mithril advisory rule.
    const requiresDarkMode = options?.requiresDarkMode ?? false
    void requiresDarkMode // acknowledged — ceiling is amber regardless of this flag
    const baseSeverity: LinterWarning['severity'] =
        ruleMode === 'advisory'
            ? 'advisory'
            : 'amber'

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

            // Parse all color utilities in this className
            const colorClasses: ColorClassInfo[] = []
            for (const cls of classes) {
                const m = COLOR_UTILITY_RE.exec(cls)
                if (!m) continue
                colorClasses.push({
                    raw: cls,
                    variant: m[1] ?? null,
                    prefix: m[2],
                    colorPart: m[3],
                })
            }

            if (colorClasses.length === 0) return

            // Build a set of properties that have dark: variants
            const darkCoveredProperties = new Set<string>()
            for (const cc of colorClasses) {
                if (cc.variant === 'dark') {
                    darkCoveredProperties.add(cc.prefix)
                }
            }

            // Check each non-variant color class
            for (const cc of colorClasses) {
                // Only check base (non-variant) classes
                if (cc.variant !== null) continue

                // Skip if there's already a dark: variant for this property
                if (darkCoveredProperties.has(cc.prefix)) continue

                // Skip if the color resolves to a semantic token with dark mode
                const semanticPath = resolveSemanticTokenPath(cc.colorPart, tokens)
                if (semanticPath !== null) continue

                // Flag: primitive color without dark: sibling
                const warningId = `dark-${nodeId}-${cc.prefix}`

                // Check if a semantic alternative exists for suggestion
                const semanticAlternatives = findSemanticAlternatives(cc.prefix, tokens)
                const fixable = semanticAlternatives.length > 0
                const suggestion = fixable
                    ? `Consider using a semantic token: ${semanticAlternatives[0]}`
                    : `Add a \`dark:\` variant (e.g., \`dark:${cc.prefix}-gray-100\`)`

                warnings.set(warningId, {
                    id: warningId,
                    type: 'dark-mode-drift',
                    severity: baseSeverity,
                    value: 0,
                    message: `MITHRIL-DARK-001: \`${cc.raw}\` has no dark mode counterpart — ${suggestion}`,
                    nearestToken: semanticAlternatives[0] ?? null,
                    nearestTokenValue: null,
                    ruleId: 'MITHRIL-DARK-001',
                    fixable,
                    explanation: taxonomy?.explanation ??
                        'This color utility has no dark mode variant, which will break in dark mode.',
                    recovery: taxonomy?.recovery ??
                        'Add a dark: variant or switch to a semantic design token that supports both modes.',
                    line: loc?.line,
                    column: loc?.column,
                })
            }
        },
    })

    return warnings
}

/**
 * Finds semantic color tokens that have dark mode support and could replace
 * a primitive color class for a given property prefix (bg, text, border).
 *
 * Surfaces the LIGHT-mode (default) companion token — the one the developer
 * should use instead of a primitive. A semantic companion qualifies when:
 *   a) It has `modes.dark` set on the token itself (extended schema), OR
 *   b) Another token with the same `token_path` has `mode === 'dark'`
 *      (semantic companion strategy — separate rows per mode).
 *
 * Fix 2026-04-12: previously, path (b) was missed because the filter only
 * accepted tokens where `mode === 'dark'`, which returned the dark row, not
 * the light row. The corrected filter builds a Set of paths that have a dark
 * companion, then accepts any token whose path is in that set AND whose mode
 * is the light/default mode.
 */
function findSemanticAlternatives(
    prefix: string,
    tokens: DesignToken[],
): string[] {
    const alternatives: string[] = []

    // Map Tailwind prefixes to semantic token categories
    const categoryHints: Record<string, string[]> = {
        bg: ['surface', 'background'],
        text: ['on-surface', 'text', 'foreground'],
        border: ['border', 'outline', 'divider'],
    }

    // Build a set of token paths that have a dark companion (via any strategy).
    const pathsWithDark = new Set<string>()
    for (const token of tokens) {
        if (token.token_type !== 'color') continue
        const extended = token as DesignTokenWithModes
        // Extended schema: token has embedded modes.dark
        if (extended.modes?.dark !== undefined) {
            pathsWithDark.add(token.token_path)
        }
        // Companion strategy: a separate row with mode='dark' exists for this path
        if (token.mode === 'dark' || token.mode === 'Dark') {
            pathsWithDark.add(token.token_path)
        }
    }

    const hints = categoryHints[prefix] ?? []
    for (const token of tokens) {
        if (token.token_type !== 'color') continue
        // Only surface the light/default companion — not the dark row itself.
        if (token.mode === 'dark' || token.mode === 'Dark') continue
        // Must have a dark companion to qualify as a semantic alternative.
        if (!pathsWithDark.has(token.token_path)) continue

        // Check if the token path matches any category hint
        const pathLower = token.token_path.toLowerCase()
        for (const hint of hints) {
            if (pathLower.includes(hint)) {
                alternatives.push(token.token_path)
                break
            }
        }
    }

    return alternatives
}
