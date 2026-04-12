/**
 * Fluid Interpolator — flint-mcp/src/core/fluidInterpolator.ts
 *
 * P6: Breakpoint Governance — detects when a component has 2+ breakpoint-
 * specific Tailwind values for the same property and suggests a fluid
 * `clamp()` expression as an advisory progressive enhancement.
 *
 * Example: `text-base lg:text-xl` (16px → 20px between 1024px)
 *   → `text-[clamp(1rem,0.5rem+0.78vw,1.25rem)]`
 *
 * Exports:
 *   findFluidOpportunities — AST visitor returning a list of FluidSuggestion
 *   visitFluidOpportunities — MithrilLinter visitor for MITHRIL-FLUID-001
 *   computeClampExpression — pure math helper (exported for tests)
 *
 * This rule is **advisory only** by default. It never blocks export and is
 * never auto-fixable — designers may deliberately want hard breakpoints for
 * editorial control over intermediate viewport widths.
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import type { LinterWarning } from '../types.js'
import { getErrorEntryByRuleId } from './errorTaxonomy.js'
import type { PolicyOptions } from './MithrilLinter.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Tailwind scale tables ────────────────────────────────────────────────────

/** Tailwind font-size scale → pixel values (default Tailwind config). */
const TEXT_SIZE_PX: Record<string, number> = {
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

/** Tailwind spacing scale → pixel values (4px base unit). */
const SPACING_PX: Record<string, number> = {
    '0': 0,
    px: 1,
    '0.5': 2,
    '1': 4,
    '1.5': 6,
    '2': 8,
    '2.5': 10,
    '3': 12,
    '3.5': 14,
    '4': 16,
    '5': 20,
    '6': 24,
    '7': 28,
    '8': 32,
    '9': 36,
    '10': 40,
    '11': 44,
    '12': 48,
    '14': 56,
    '16': 64,
    '20': 80,
    '24': 96,
    '28': 112,
    '32': 128,
    '36': 144,
    '40': 160,
    '44': 176,
    '48': 192,
    '52': 208,
    '56': 224,
    '60': 240,
    '64': 256,
    '72': 288,
    '80': 320,
    '96': 384,
}

/** Tailwind default breakpoint widths in pixels. */
const BREAKPOINT_PX: Record<string, number> = {
    base: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
}

const BREAKPOINTS = new Set(Object.keys(BREAKPOINT_PX))

/** Spacing-producing property prefixes and the canonical property name. */
const SPACING_PREFIXES: Record<string, string> = {
    p: 'padding',
    px: 'padding-x',
    py: 'padding-y',
    pt: 'padding-top',
    pr: 'padding-right',
    pb: 'padding-bottom',
    pl: 'padding-left',
    m: 'margin',
    mx: 'margin-x',
    my: 'margin-y',
    mt: 'margin-top',
    mr: 'margin-right',
    mb: 'margin-bottom',
    ml: 'margin-left',
    gap: 'gap',
    'gap-x': 'gap-x',
    'gap-y': 'gap-y',
}

/** Minimum pixel delta to bother suggesting fluid scaling. */
const MIN_DELTA_PX = 4

// ── Types ────────────────────────────────────────────────────────────────────

export interface FluidSuggestionValue {
    breakpoint: string
    value: string
    px: number
}

export interface FluidSuggestion {
    property: string
    values: FluidSuggestionValue[]
    suggestedClamp: string
    /** The original Tailwind class string list that triggered the suggestion. */
    originalClasses: string[]
    /** The nearest JSX data-flint-id (if any) and source location. */
    flintId: string | null
    line?: number
    column?: number
}

// ── Class parsing ────────────────────────────────────────────────────────────

interface ParsedClass {
    raw: string
    breakpoint: string // 'base' when no prefix
    property: string // canonical property name (e.g. 'text-size', 'padding')
    rawValue: string // the Tailwind scale key (e.g. 'base', '4', 'xl')
    px: number
}

/**
 * Parse a single Tailwind class. Returns null if:
 *   - it is not a recognized size/spacing utility
 *   - it uses a non-standard arbitrary value
 *   - the scale key is unknown
 *
 * Only classes with zero or one known-breakpoint variant are returned. Other
 * variants (hover:, focus:, dark:, etc.) are skipped.
 */
function parseClass(cls: string): ParsedClass | null {
    // Split variant prefix from utility body (one level only).
    let breakpoint = 'base'
    let body = cls
    const colonIdx = cls.indexOf(':')
    if (colonIdx !== -1) {
        const prefix = cls.slice(0, colonIdx)
        // Skip unknown / non-breakpoint variants entirely.
        if (!BREAKPOINTS.has(prefix)) return null
        breakpoint = prefix
        body = cls.slice(colonIdx + 1)
    }

    // Reject arbitrary values (contain brackets) — off-scale.
    if (body.includes('[') || body.includes(']')) return null

    // text-* font-size utilities
    if (body.startsWith('text-')) {
        const key = body.slice('text-'.length)
        const px = TEXT_SIZE_PX[key]
        if (px === undefined) return null
        return {
            raw: cls,
            breakpoint,
            property: 'text-size',
            rawValue: key,
            px,
        }
    }

    // Spacing utilities — match longest prefix first so that `px` (padding-x)
    // is tried before `p` (padding).
    const spacingKeys = Object.keys(SPACING_PREFIXES).sort(
        (a, b) => b.length - a.length,
    )
    for (const prefix of spacingKeys) {
        const needle = `${prefix}-`
        if (!body.startsWith(needle)) continue
        const key = body.slice(needle.length)
        const px = SPACING_PX[key]
        if (px === undefined) return null
        return {
            raw: cls,
            breakpoint,
            property: SPACING_PREFIXES[prefix],
            rawValue: key,
            px,
        }
    }

    return null
}

// ── Clamp math ───────────────────────────────────────────────────────────────

/**
 * Round a number to a fixed number of decimal places, stripping trailing zeros.
 */
function round(n: number, places = 4): number {
    const m = Math.pow(10, places)
    return Math.round(n * m) / m
}

/**
 * Build a CSS `clamp(min, preferred, max)` expression that interpolates
 * linearly between two viewport widths.
 *
 * Given:
 *   - minPx at viewport minVwPx
 *   - maxPx at viewport maxVwPx
 *
 * The preferred value is a linear function of viewport width expressed in
 * rem + vw units. All px values are normalized to rem (16px base).
 *
 * Example:
 *   computeClampExpression(16, 20, 768, 1024)
 *   → "clamp(1rem, 0.5rem + 0.78vw, 1.25rem)"
 */
export function computeClampExpression(
    minPx: number,
    maxPx: number,
    minVwPx: number,
    maxVwPx: number,
): string {
    const [lo, hi] =
        minPx <= maxPx ? [minPx, maxPx] : [maxPx, minPx]
    const [loVw, hiVw] =
        minPx <= maxPx ? [minVwPx, maxVwPx] : [maxVwPx, minVwPx]

    // Slope in px per px of viewport.
    const slope = (hi - lo) / (hiVw - loVw)
    // Intercept in px at viewport=0.
    const interceptPx = lo - slope * loVw

    const minRem = round(lo / 16)
    const maxRem = round(hi / 16)
    const interceptRem = round(interceptPx / 16)
    const vwCoeff = round(slope * 100, 4)

    // Build the preferred expression. Prefer `a + b` form, handle negatives.
    let preferred: string
    if (interceptRem === 0 && vwCoeff === 0) {
        preferred = `${minRem}rem`
    } else if (interceptRem === 0) {
        preferred = `${vwCoeff}vw`
    } else if (vwCoeff === 0) {
        preferred = `${interceptRem}rem`
    } else if (vwCoeff < 0) {
        preferred = `${interceptRem}rem - ${Math.abs(vwCoeff)}vw`
    } else {
        preferred = `${interceptRem}rem + ${vwCoeff}vw`
    }

    return `clamp(${minRem}rem, ${preferred}, ${maxRem}rem)`
}

// ── AST visitor ──────────────────────────────────────────────────────────────

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

/**
 * Compare breakpoint widths so values are sorted small → large.
 */
function bpOrder(bp: string): number {
    return BREAKPOINT_PX[bp] ?? 0
}

/**
 * Identify fluid scaling opportunities in a JSX AST.
 *
 * Walks every className and groups breakpoint-variant classes by
 * (element, property). Any group with 2+ distinct breakpoint values whose
 * min→max delta exceeds MIN_DELTA_PX yields a FluidSuggestion.
 */
export function findFluidOpportunities(ast: File): FluidSuggestion[] {
    const suggestions: FluidSuggestion[] = []

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return

            const classStr = getClassString(path.node)
            if (classStr === null) return

            const classes = classStr.split(/\s+/).filter(Boolean)
            if (classes.length === 0) return

            // Group parsed classes by canonical property name.
            const byProperty = new Map<string, ParsedClass[]>()
            for (const cls of classes) {
                const parsed = parseClass(cls)
                if (parsed === null) continue
                const bucket = byProperty.get(parsed.property) ?? []
                bucket.push(parsed)
                byProperty.set(parsed.property, bucket)
            }

            if (byProperty.size === 0) return

            const flintId = getFlintId(openEl)
            const loc = path.node.loc?.start

            for (const [property, parsedList] of byProperty) {
                // Deduplicate by breakpoint — last write wins, though duplicate
                // breakpoints are unusual.
                const byBp = new Map<string, ParsedClass>()
                for (const p of parsedList) byBp.set(p.breakpoint, p)

                // Need at least two distinct breakpoints.
                if (byBp.size < 2) continue

                // Sort by breakpoint viewport width.
                const sorted = [...byBp.values()].sort(
                    (a, b) => bpOrder(a.breakpoint) - bpOrder(b.breakpoint),
                )

                const minEntry = sorted[0]
                const maxEntry = sorted[sorted.length - 1]

                // Skip if all values are identical (same px across breakpoints).
                const uniquePx = new Set(sorted.map((p) => p.px))
                if (uniquePx.size < 2) continue

                // Skip if the delta is too small to bother with fluid.
                const delta = Math.abs(maxEntry.px - minEntry.px)
                if (delta < MIN_DELTA_PX) continue

                // The base (unprefixed) breakpoint corresponds to viewport 0,
                // but fluid scaling needs a real lower anchor. Use 375px
                // (mobile baseline) when the floor is `base`, otherwise use
                // the named breakpoint's width.
                const MOBILE_FLOOR_PX = 375
                const minVwPx =
                    minEntry.breakpoint === 'base'
                        ? MOBILE_FLOOR_PX
                        : BREAKPOINT_PX[minEntry.breakpoint] ?? MOBILE_FLOOR_PX
                const maxVwPx = BREAKPOINT_PX[maxEntry.breakpoint] ?? 1280

                // Guard against degenerate viewport spans.
                if (maxVwPx <= minVwPx) continue

                const suggestedClamp = computeClampExpression(
                    minEntry.px,
                    maxEntry.px,
                    minVwPx,
                    maxVwPx,
                )

                suggestions.push({
                    property,
                    values: sorted.map((p) => ({
                        breakpoint: p.breakpoint,
                        value: p.raw,
                        px: p.px,
                    })),
                    suggestedClamp,
                    originalClasses: sorted.map((p) => p.raw),
                    flintId,
                    line: loc?.line,
                    column: loc?.column,
                })
            }
        },
    })

    return suggestions
}

// ── MithrilLinter integration ────────────────────────────────────────────────

export type FluidSuggestionMode = 'off' | 'advisory'

export interface FluidPolicyOptions extends PolicyOptions {
    /** `off` suppresses the visitor entirely. `advisory` (default) emits advisories. */
    fluidSuggestions?: FluidSuggestionMode
}

/**
 * MithrilLinter visitor wrapper. Returns a Map keyed by stable suggestion id.
 *
 * MITHRIL-FLUID-001 is always emitted as severity 'advisory' and always
 * `fixable: false`. It never blocks export.
 */
export function visitFluidOpportunities(
    ast: File,
    options?: FluidPolicyOptions,
): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    const mode: FluidSuggestionMode =
        options?.fluidSuggestions ?? 'advisory'
    if (mode === 'off') return warnings

    // Per-rule mode override takes precedence.
    const ruleMode = options?.ruleModes?.['MITHRIL-FLUID-001']
    if (ruleMode === 'off') return warnings

    const taxonomy = getErrorEntryByRuleId('MITHRIL-FLUID-001')

    const suggestions = findFluidOpportunities(ast)
    for (const suggestion of suggestions) {
        const idSeed =
            suggestion.flintId !== null
                ? `${suggestion.flintId}-${suggestion.property}`
                : `fluid-${suggestion.line ?? 0}-${suggestion.column ?? 0}-${suggestion.property}`
        const warningId = `fluid-${idSeed}`
        warnings.set(warningId, {
            id: warningId,
            type: 'fluid-suggestion',
            severity: 'advisory',
            value: 0,
            message: `MITHRIL-FLUID-001: Consider fluid scaling for \`${suggestion.property}\` — ${suggestion.suggestedClamp}`,
            nearestToken: null,
            nearestTokenValue: null,
            ruleId: 'MITHRIL-FLUID-001',
            fixable: false,
            explanation:
                taxonomy?.explanation ??
                'Multiple breakpoint-specific values were found for the same property. Fluid typography and spacing via `clamp()` provide smooth scaling between breakpoints and avoid awkward intermediate states.',
            recovery:
                taxonomy?.recovery ??
                `Consider replacing the breakpoint variants with a single fluid value: ${suggestion.suggestedClamp}. Keep hard breakpoints only when you need editorial control over intermediate viewport widths.`,
            line: suggestion.line,
            column: suggestion.column,
        })
    }

    return warnings
}
