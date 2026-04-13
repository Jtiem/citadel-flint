/**
 * AnimationLinter — flint-mcp/src/core/AnimationLinter.ts
 *
 * P5: Behavioral & Motion Governance.
 *
 * Identifies Tailwind transition/duration/easing/animation classes and inline
 * `transition` / `animation` CSS properties, and flags any value that does not
 * correspond to a registered motion token as MOTION-001 (motion drift).
 *
 * Design principles:
 *   - Additive: projects without motion tokens (and without any motion usage)
 *     are not audited. Projects with motion usage but no tokens receive
 *     advisory-only warnings.
 *   - Preset-aware: standard Tailwind motion presets (e.g. `duration-200`,
 *     `ease-linear`) are matched against motion tokens for suggested swaps.
 *     Arbitrary values (e.g. `duration-[347ms]`) are always flagged.
 *   - Token suggestion: when a motion token matches the extracted value,
 *     the warning's `nearestToken` / `nearestTokenValue` point at the token.
 *
 * Exports:
 *   visitMotionDrift — main visitor producing LinterWarning[]
 *   extractDurationMs / extractEasing — helpers used by tests
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import type { LinterWarning, MotionToken } from '../types.js'
import { getErrorEntryByRuleId } from './errorTaxonomy.js'
import type { PolicyOptions } from './MithrilLinter.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Options ──────────────────────────────────────────────────────────────────

export interface AuditOptions extends PolicyOptions {
    /** When true, the project is explicitly known to use a motion language. */
    projectHasMotionConfig?: boolean
}

// ── Tailwind preset maps ────────────────────────────────────────────────────

/** Standard Tailwind duration-* presets → milliseconds. */
const DURATION_PRESET_MS: Readonly<Record<string, number>> = {
    'duration-0': 0,
    'duration-75': 75,
    'duration-100': 100,
    'duration-150': 150,
    'duration-200': 200,
    'duration-300': 300,
    'duration-500': 500,
    'duration-700': 700,
    'duration-1000': 1000,
}

/** Standard Tailwind ease-* presets → canonical easing string. */
const EASE_PRESET: Readonly<Record<string, string>> = {
    'ease-linear': 'linear',
    'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    'ease-initial': 'initial',
}

/** Standard Tailwind transition-* presets (non-arbitrary) that are safe. */
const TRANSITION_PRESETS: ReadonlySet<string> = new Set([
    'transition',
    'transition-none',
    'transition-all',
    'transition-colors',
    'transition-opacity',
    'transition-shadow',
    'transition-transform',
])

/**
 * Ease presets that are safe / browser-native and produce no motion advisory.
 * `ease-initial` resets the easing to the browser default — it is not a
 * design-token concern and should never generate MOTION-001 noise.
 */
const EASE_SAFE_PRESETS: ReadonlySet<string> = new Set([
    'ease-initial',
])

/** Standard Tailwind animate-* presets that are library-builtin. */
const ANIMATE_PRESETS: ReadonlySet<string> = new Set([
    'animate-none',
    'animate-spin',
    'animate-ping',
    'animate-pulse',
    'animate-bounce',
])

// ── Class classification ────────────────────────────────────────────────────

type MotionClassKind = 'duration' | 'ease' | 'transition' | 'animate'

interface MotionClass {
    raw: string
    kind: MotionClassKind
    /** The value inside the brackets for arbitrary values, or the preset suffix. */
    value: string
    /** True if this is an arbitrary value `[...]`. */
    arbitrary: boolean
}

const DURATION_RE = /^duration-(\[([^\]]+)\]|(\d+))$/
const EASE_RE = /^ease-(\[([^\]]+)\]|([a-z-]+))$/
const TRANSITION_ARB_RE = /^transition-\[([^\]]+)\]$/
const ANIMATE_ARB_RE = /^animate-\[([^\]]+)\]$/

function classifyMotionClass(cls: string): MotionClass | null {
    let m = DURATION_RE.exec(cls)
    if (m) {
        return {
            raw: cls,
            kind: 'duration',
            value: m[2] ?? m[3],
            arbitrary: m[2] !== undefined,
        }
    }
    m = EASE_RE.exec(cls)
    if (m) {
        return {
            raw: cls,
            kind: 'ease',
            value: m[2] ?? m[3],
            arbitrary: m[2] !== undefined,
        }
    }
    m = TRANSITION_ARB_RE.exec(cls)
    if (m) {
        return { raw: cls, kind: 'transition', value: m[1], arbitrary: true }
    }
    m = ANIMATE_ARB_RE.exec(cls)
    if (m) {
        return { raw: cls, kind: 'animate', value: m[1], arbitrary: true }
    }
    return null
}

// ── Motion value extraction (for inline CSS `transition` / `animation`) ─────

/**
 * Extracts the first duration in milliseconds from a free-form motion value
 * string (e.g. 'all 200ms ease-out', '0.2s linear', '200ms').
 * Returns null if no duration could be parsed.
 */
export function extractDurationMs(value: string): number | null {
    const match = /(\d+(?:\.\d+)?)(ms|s)\b/.exec(value)
    if (!match) return null
    const num = parseFloat(match[1])
    if (Number.isNaN(num)) return null
    return match[2] === 's' ? num * 1000 : num
}

/**
 * Extracts the easing component from a free-form motion value string.
 * Returns null if none can be identified.
 */
export function extractEasing(value: string): string | null {
    const cubic = /cubic-bezier\([^)]+\)/.exec(value)
    if (cubic) return cubic[0].replace(/\s+/g, '')
    const keyword = /\b(linear|ease-in-out|ease-in|ease-out|ease|step-start|step-end|steps\([^)]+\))\b/.exec(
        value,
    )
    if (keyword) return keyword[1].replace(/\s+/g, '')
    return null
}

// ── Motion token matching ──────────────────────────────────────────────────

function durationTokenMs(token: MotionToken): number | null {
    if (token.duration) {
        const ms = extractDurationMs(token.duration)
        if (ms !== null) return ms
    }
    return extractDurationMs(token.token_value)
}

function easingTokenValue(token: MotionToken): string | null {
    if (token.easing) return token.easing.replace(/\s+/g, '')
    return extractEasing(token.token_value)
}

/**
 * Finds a motion token whose duration matches `ms`. Returns null if none.
 */
function findDurationToken(ms: number, motionTokens: MotionToken[]): MotionToken | null {
    for (const tok of motionTokens) {
        const tokMs = durationTokenMs(tok)
        if (tokMs !== null && tokMs === ms) return tok
    }
    return null
}

/**
 * Finds a motion token whose easing matches `easing` (normalized whitespace).
 */
function findEasingToken(easing: string, motionTokens: MotionToken[]): MotionToken | null {
    const norm = easing.replace(/\s+/g, '')
    for (const tok of motionTokens) {
        const tokEase = easingTokenValue(tok)
        if (tokEase !== null && tokEase.replace(/\s+/g, '') === norm) return tok
    }
    return null
}

// ── AST helpers ─────────────────────────────────────────────────────────────

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
    const v = classAttr.value
    if (t.isStringLiteral(v)) return v.value
    if (t.isJSXExpressionContainer(v) && t.isStringLiteral(v.expression)) {
        return v.expression.value
    }
    return null
}

// ── Warning factory ─────────────────────────────────────────────────────────

const TAXONOMY = (): { explanation: string; recovery: string } => {
    const entry = getErrorEntryByRuleId('MOTION-001')
    return {
        explanation: entry?.explanation
            ?? 'A transition / animation duration or easing value does not correspond to a registered motion token.',
        recovery: entry?.recovery
            ?? 'Replace the literal duration / easing with a motion token (e.g. `transition.interactive`), or add a new motion token if none fits.',
    }
}

function buildWarning(params: {
    nodeId: string
    suffix: string
    message: string
    nearestToken: string | null
    nearestTokenValue: string | null
    line?: number
    column?: number
    severity: LinterWarning['severity']
    fixable: boolean
}): LinterWarning {
    const tax = TAXONOMY()
    return {
        id: `motion-${params.nodeId}-${params.suffix}`,
        type: 'motion-drift',
        severity: params.severity,
        value: 0,
        message: params.message,
        nearestToken: params.nearestToken,
        nearestTokenValue: params.nearestTokenValue,
        ruleId: 'MOTION-001',
        fixable: params.fixable,
        explanation: tax.explanation,
        recovery: tax.recovery,
        line: params.line,
        column: params.column,
    }
}

// ── Main visitor ────────────────────────────────────────────────────────────

/**
 * P5: Run the animation / motion drift visitor.
 *
 * @param ast            Parsed Babel file.
 * @param motionTokens   Registered motion tokens. Empty array = advisory-only mode.
 * @param options        Optional policy overrides.
 *
 * Behaviour:
 *   - If `options.ruleModes['MOTION-001'] === 'off'`, returns no warnings.
 *   - If no motion tokens AND no motion usage is detected anywhere in the
 *     file AND `options.projectHasMotionConfig !== true`, returns no warnings.
 *   - Arbitrary values (`duration-[347ms]`, `ease-[cubic-bezier(...)]`,
 *     `transition-[...]`, `animate-[...]`) are always flagged.
 *   - Standard Tailwind presets (`duration-200`, `ease-linear`) are matched
 *     against motion tokens. A match suggests the token swap. A miss is
 *     flagged advisory when tokens exist, otherwise advisory without tokens.
 *   - Inline `style={{ transition, animation, transitionDuration, ... }}`
 *     literal string values are extracted and flagged when no token matches.
 *   - Builtin animate-* presets (`animate-spin`, `animate-pulse`, ...) are
 *     never flagged — they are library utilities with no token equivalent.
 */
export function visitMotionDrift(
    ast: File,
    motionTokens: MotionToken[],
    options?: AuditOptions,
): LinterWarning[] {
    const mode = options?.ruleModes?.['MOTION-001']
    if (mode === 'off') return []

    const hasTokens = motionTokens.length > 0
    const projectHasMotionConfig = options?.projectHasMotionConfig === true

    // Single warnings buffer. `warningsSoFar` was a dead duplicate that was
    // only ever merged back into `warnings` unconditionally — collapsed here
    // to prevent any future double-push regression.
    const warnings: LinterWarning[] = []
    let motionUsageSeen = false

    const baseSeverity: LinterWarning['severity'] =
        mode === 'advisory' ? 'advisory' : 'amber'

    traverse(ast, {
        JSXAttribute(path) {
            const name = path.node.name
            if (!t.isJSXIdentifier(name)) return
            const openEl = path.parentPath?.node
            if (!t.isJSXOpeningElement(openEl)) return
            const nodeId = getFlintId(openEl) ?? 'unknown'
            const loc = path.node.loc?.start

            // ── className motion classes ─────────────────────────────────
            if (name.name === 'className') {
                const classStr = getClassString(path.node)
                if (classStr === null) return
                const classes = classStr.split(/\s+/).filter(Boolean)

                for (const cls of classes) {
                    // Skip safe intrinsic presets
                    if (TRANSITION_PRESETS.has(cls)) { motionUsageSeen = true; continue }
                    if (ANIMATE_PRESETS.has(cls)) { motionUsageSeen = true; continue }
                    // Skip ease presets that are browser-native and not token-governed
                    if (EASE_SAFE_PRESETS.has(cls)) { motionUsageSeen = true; continue }

                    const info = classifyMotionClass(cls)
                    if (info === null) continue
                    motionUsageSeen = true

                    // ── duration-* ────────────────────────────────────
                    if (info.kind === 'duration') {
                        const ms = info.arbitrary
                            ? extractDurationMs(info.value)
                            : DURATION_PRESET_MS[cls] ?? null

                        if (ms === null) {
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: `MOTION-001: \`${cls}\` is not a recognized duration — use a motion token.`,
                                    nearestToken: null,
                                    nearestTokenValue: null,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: baseSeverity,
                                    fixable: false,
                                }),
                            )
                            continue
                        }

                        const matched = hasTokens ? findDurationToken(ms, motionTokens) : null
                        if (matched) {
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: `MOTION-001: \`${cls}\` (${ms}ms) should use motion token \`${matched.token_path}\``,
                                    nearestToken: matched.token_path,
                                    nearestTokenValue: matched.token_value,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: baseSeverity,
                                    fixable: true,
                                }),
                            )
                        } else if (info.arbitrary) {
                            // Arbitrary value with no token → always flag
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: `MOTION-001: arbitrary duration \`${cls}\` (${ms}ms) is not part of the motion language.`,
                                    nearestToken: null,
                                    nearestTokenValue: null,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: baseSeverity,
                                    fixable: false,
                                }),
                            )
                        } else {
                            // Preset duration with no matching token — advisory. When tokens
                            // exist but none match, still advisory (soft nudge).
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: hasTokens
                                        ? `MOTION-001: \`${cls}\` (${ms}ms) does not match any registered motion token.`
                                        : `MOTION-001: \`${cls}\` (${ms}ms) is not backed by a motion token.`,
                                    nearestToken: null,
                                    nearestTokenValue: null,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: 'advisory',
                                    fixable: false,
                                }),
                            )
                        }
                        continue
                    }

                    // ── ease-* ────────────────────────────────────────
                    if (info.kind === 'ease') {
                        const easingValue = info.arbitrary
                            ? info.value.replace(/\s+/g, '')
                            : EASE_PRESET[cls] ?? info.value

                        const matched = hasTokens
                            ? findEasingToken(easingValue, motionTokens)
                            : null

                        if (matched) {
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: `MOTION-001: \`${cls}\` should use motion token \`${matched.token_path}\``,
                                    nearestToken: matched.token_path,
                                    nearestTokenValue: matched.token_value,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: baseSeverity,
                                    fixable: true,
                                }),
                            )
                        } else if (info.arbitrary) {
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: `MOTION-001: arbitrary easing \`${cls}\` is not part of the motion language.`,
                                    nearestToken: null,
                                    nearestTokenValue: null,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: baseSeverity,
                                    fixable: false,
                                }),
                            )
                        } else {
                            warnings.push(
                                buildWarning({
                                    nodeId,
                                    suffix: cls,
                                    message: hasTokens
                                        ? `MOTION-001: \`${cls}\` does not match any registered motion token.`
                                        : `MOTION-001: \`${cls}\` is not backed by a motion token.`,
                                    nearestToken: null,
                                    nearestTokenValue: null,
                                    line: loc?.line,
                                    column: loc?.column,
                                    severity: 'advisory',
                                    fixable: false,
                                }),
                            )
                        }
                        continue
                    }

                    // ── transition-[...] or animate-[...] arbitrary ──
                    if (info.kind === 'transition' || info.kind === 'animate') {
                        warnings.push(
                            buildWarning({
                                nodeId,
                                suffix: cls,
                                message: `MOTION-001: arbitrary ${info.kind} value \`${cls}\` is not part of the motion language.`,
                                nearestToken: null,
                                nearestTokenValue: null,
                                line: loc?.line,
                                column: loc?.column,
                                severity: baseSeverity,
                                fixable: false,
                            }),
                        )
                        continue
                    }
                }
                return
            }

            // ── style={{ ... }} inline motion props ──────────────────────
            if (name.name === 'style') {
                const v = path.node.value
                if (!t.isJSXExpressionContainer(v)) return
                const expr = v.expression
                if (!t.isObjectExpression(expr)) return

                for (const prop of expr.properties) {
                    if (!t.isObjectProperty(prop)) continue
                    let propName: string | null = null
                    if (t.isIdentifier(prop.key)) propName = prop.key.name
                    else if (t.isStringLiteral(prop.key)) propName = prop.key.value
                    if (propName === null) continue

                    const isMotionProp =
                        propName === 'transition' ||
                        propName === 'animation' ||
                        propName === 'transitionDuration' ||
                        propName === 'transitionTimingFunction' ||
                        propName === 'animationDuration' ||
                        propName === 'animationTimingFunction'
                    if (!isMotionProp) continue
                    if (!t.isStringLiteral(prop.value)) continue

                    motionUsageSeen = true
                    const raw = prop.value.value
                    const ms = extractDurationMs(raw)
                    const easing = extractEasing(raw)
                    const propLoc = prop.loc?.start

                    let matched: MotionToken | null = null
                    if (hasTokens) {
                        if (ms !== null) matched = findDurationToken(ms, motionTokens)
                        if (matched === null && easing !== null) {
                            matched = findEasingToken(easing, motionTokens)
                        }
                    }

                    if (matched) {
                        warnings.push(
                            buildWarning({
                                nodeId,
                                suffix: `style-${propName}`,
                                message: `MOTION-001: inline \`${propName}: '${raw}'\` should use motion token \`${matched.token_path}\``,
                                nearestToken: matched.token_path,
                                nearestTokenValue: matched.token_value,
                                line: propLoc?.line,
                                column: propLoc?.column,
                                severity: baseSeverity,
                                fixable: false,
                            }),
                        )
                    } else {
                        warnings.push(
                            buildWarning({
                                nodeId,
                                suffix: `style-${propName}`,
                                message: `MOTION-001: inline \`${propName}: '${raw}'\` is not part of the motion language.`,
                                nearestToken: null,
                                nearestTokenValue: null,
                                line: propLoc?.line,
                                column: propLoc?.column,
                                severity: hasTokens ? baseSeverity : (projectHasMotionConfig ? baseSeverity : 'advisory'),
                                fixable: false,
                            }),
                        )
                    }
                }
            }
        },
    })

    // If no tokens and no explicit motion config and we never saw any motion
    // usage at all, skip entirely — the project isn't governing motion.
    if (!hasTokens && !projectHasMotionConfig && !motionUsageSeen) {
        return []
    }

    return warnings
}
