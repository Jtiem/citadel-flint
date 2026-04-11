/**
 * flint_fix tool handler — flint-mcp/src/tools/fix.ts
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
import type { FlintConfig } from '../core/config.js'
import type { DesignToken, LinterWarning } from '../types.js'
import { loadProjectContext } from '../core/projectContext.js'
import type { ProjectContext } from '../core/projectContext.js'
import { toolName, configPath } from '../brand.js'
import { hexToLab, deltaE2000, cssColorToHex, parseDimensionToPx } from '../core/colorMath.js'
import { planMutations, summarizePlan } from '../core/mutationPlanner.js'
import type { MutationPlan, PlannedMutation } from '../core/mutationPlanner.js'

export type { ProjectContext }

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// @ts-ignore
const generate = _generate.default || _generate

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

// ── Nearest typography/spacing token finders (MAJOR-3 fix) ───────────────────

/**
 * Find the most relevant typography token for a given value.
 * For dimensions (fontSize, lineHeight, etc.), sort by numeric proximity.
 * For font families/weights, sort by string similarity (longest common substring ratio).
 */
function findNearestTypographyToken(
    rawVal: string,
    candidates: DesignToken[],
    tokenType: DesignToken['token_type'],
): DesignToken {
    if (tokenType === 'dimension' || tokenType === 'lineHeight' || tokenType === 'letterSpacing') {
        return findNearestDimensionToken(rawVal, candidates)
    }
    if (tokenType === 'fontWeight') {
        const target = parseInt(rawVal, 10)
        if (!isNaN(target)) {
            const sorted = [...candidates].sort((a, b) => {
                const da = Math.abs(parseInt(a.token_value, 10) - target)
                const db = Math.abs(parseInt(b.token_value, 10) - target)
                return da - db
            })
            return sorted[0]!
        }
    }
    // fontFamily: sort by string similarity (longest common prefix ratio)
    const targetLower = rawVal.toLowerCase()
    const sorted = [...candidates].sort((a, b) => {
        const simA = stringSimilarity(targetLower, a.token_value.toLowerCase())
        const simB = stringSimilarity(targetLower, b.token_value.toLowerCase())
        return simB - simA // higher similarity first
    })
    return sorted[0]!
}

/**
 * Find the nearest dimension token by numeric proximity in px.
 */
function findNearestDimensionToken(rawVal: string, candidates: DesignToken[]): DesignToken {
    const targetPx = parseDimensionToPx(rawVal)
    if (targetPx !== null) {
        const sorted = [...candidates].sort((a, b) => {
            const aPx = parseDimensionToPx(a.token_value) ?? parseDimensionToPx(a.token_value + 'px')
            const bPx = parseDimensionToPx(b.token_value) ?? parseDimensionToPx(b.token_value + 'px')
            const da = aPx !== null ? Math.abs(aPx - targetPx) : Infinity
            const db = bPx !== null ? Math.abs(bPx - targetPx) : Infinity
            return da - db
        })
        return sorted[0]!
    }
    return candidates[0]!
}

/**
 * Simple string similarity: ratio of longest common substring length to max string length.
 */
function stringSimilarity(a: string, b: string): number {
    if (a.length === 0 || b.length === 0) return 0
    let maxLen = 0
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            let len = 0
            while (i + len < a.length && j + len < b.length && a[i + len] === b[j + len]) len++
            if (len > maxLen) maxLen = len
        }
    }
    return maxLen / Math.max(a.length, b.length)
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
                    const cssVar = `var(${tokenPathToVar(nearest.token.token_path)}, ${nearest.token.token_value})`
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

        // Typography drift fix — sort candidates by relevance instead of picking first blindly
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
                    // Sort by relevance: for dimensions use numeric proximity, for fonts use name similarity
                    const nearestToken = findNearestTypographyToken(rawVal, typeTokens, tokenType)
                    const utilityPart = cls.slice(prefix.length)
                    const utilityName = utilityPart.slice(0, utilityPart.indexOf('-['))
                    const cssVar = `var(${tokenPathToVar(nearestToken.token_path)}, ${nearestToken.token_value})`
                    fixes++
                    return `${prefix}${utilityName}-[${cssVar}]`
                }
            }
        }

        // Spacing drift fix — sort by numeric proximity to the violating value
        const spacingMatch = SPACING_RE.exec(cls)
        if (spacingMatch !== null) {
            const prefix = spacingMatch[1] ?? ''
            const rawVal = spacingMatch[2] ?? ''
            const dimTokens = tokens.filter((t) => t.token_type === 'dimension')
            const hasMatch = dimTokens.some(
                (t) => t.token_value === rawVal || t.token_value === rawVal.replace('px', ''),
            )
            if (!hasMatch && dimTokens.length > 0) {
                const nearestToken = findNearestDimensionToken(rawVal, dimTokens)
                const utilityPart = cls.slice(prefix.length)
                const utilityName = utilityPart.slice(0, utilityPart.indexOf('-['))
                const cssVar = `var(${tokenPathToVar(nearestToken.token_path)}, ${nearestToken.token_value})`
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
                return [`var(${tokenPathToVar(nearest.token.token_path)}, ${nearest.token.token_value})`, true]
            }
        }
    }

    return [value, false]
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const FLINT_FIX_TOOL = {
    name: toolName('fix'),
    description:
        'Auto-fix detected Mithril violations by replacing hardcoded values ' +
        'with their nearest design token equivalents.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            file: {
                type: 'string',
                description: 'Path to the .tsx or .jsx file to fix. Absolute or relative to cwd. When provided, source and filePath are inferred.',
            },
            source: {
                type: 'string',
                description: 'Raw TSX/JSX source code to fix (omit when using file).',
            },
            filePath: {
                type: 'string',
                description: 'File path for context (omit when using file).',
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
    },
} as const

export interface FixArgs {
    file?: string
    source?: string
    filePath?: string
    violationIds?: string[]
    dryRun?: boolean
}

export interface SemanticErrorPayload {
    violationId: string
    ruleId?: string
    message: string
    semanticHint: string
    confidence: number
}

export interface RiskGatedPayload {
    violationId: string
    ruleId?: string
    message: string
    mrsScore: number
    mrsTier: string
    proposedFix?: { type: string; params: Record<string, unknown> }
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
    /** Actionable next-step recommendation. CLARITY-2 */
    recommendation: string
    /** P0: Mutation plan breakdown — deterministic/semantic/riskGated split. */
    _plan?: MutationPlan
    /** P0: Human-readable plan summary. */
    _summary?: string
    /** P0: Semantic violations that require human/LLM attention. */
    semanticErrors?: SemanticErrorPayload[]
    /** P0: High-risk deterministic fixes that need human confirmation. */
    riskGatedFixes?: RiskGatedPayload[]
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

export async function handleFlintFix(
    args: FixArgs,
    config: FlintConfig,
): Promise<FixResult> {
    // Resolve file-path shorthand: read source from disk when `file` is provided
    let source = args.source
    let filePath = args.filePath
    if (args.file) {
        const resolvedPath = path.isAbsolute(args.file)
            ? args.file
            : path.resolve(process.cwd(), args.file)
        filePath = resolvedPath
        source = fs.readFileSync(resolvedPath, 'utf-8')
    }
    if (!source || !filePath) {
        throw new Error(`${toolName('fix')}: provide either \`file\` (path) or both \`source\` and \`filePath\`.`)
    }
    const dryRun = args.dryRun === true
    const deltaEThreshold = config.policy.mithril.deltaE_threshold

    // Load design tokens
    const tokensPath = path.join(config.projectRoot, configPath('design-tokens.json'))
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

    // ── Pass 4 — A11y Auto-Fixes ─────────────────────────────────────────────
    // Uses the same fixer pipeline as flint_accessibility_report.
    // Only applies safe updateProp mutations (adding missing attributes).
    try {
        const { audit: a11yAudit } = await import('../core/a11y/runner.js')
        const { applyFixes: a11yApplyFixes, applyFixMutationToAst } = await import('../core/a11y/fixer.js')
        const { getRegisteredRules } = await import('../core/a11y/runner.js')

        const a11yResult = await a11yAudit(ast, { filePath: filePath! })
        const fixableViolations = a11yResult.violations.filter((v: { fixable: boolean }) => v.fixable)

        if (fixableViolations.length > 0) {
            const rules = getRegisteredRules()
            const fixResult = a11yApplyFixes(fixableViolations, ast as import('@babel/types').File, rules)

            for (const mutation of fixResult.mutations) {
                if (mutation.type === 'updateProp') {
                    applyFixMutationToAst(ast as import('@babel/types').File, mutation)
                }
            }
            totalFixes += fixResult.fixed.length
        }
    } catch (err) {
        // A11y fix is best-effort — never block the Mithril fix result
        console.error('[flint_fix] A11y pass failed:', err)
    }

    // ── P0: Mutation Planner — classify all violations ────────────────────────
    // Run the Mithril audit on the *original* source to get the full violation
    // set, then classify each violation as deterministic/semantic/riskGated.
    // The planner runs after fixes are applied so we can report the plan split
    // alongside the actual fix results.
    let plan: MutationPlan | undefined
    try {
        const { auditAll } = await import('../core/MithrilLinter.js')
        const originalAst = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
        const mithrilWarnings = auditAll(originalAst as import('@babel/types').File, tokens, {
            deltaE_threshold: deltaEThreshold,
        })

        // Gather a11y violations too
        let a11yViolations: LinterWarning[] = []
        try {
            const { audit: a11yAudit } = await import('../core/a11y/runner.js')
            const a11yResult = await a11yAudit(originalAst, { filePath: filePath! })
            a11yViolations = a11yResult.violations.map((v: {
                ruleId: string
                message: string
                severity: string
                fixable: boolean
                wcag?: string
                flintId?: string
            }) => ({
                id: v.ruleId + '-' + (v.flintId ?? 'unknown'),
                type: 'a11y' as const,
                severity: (v.severity === 'critical' ? 'critical' : 'amber') as LinterWarning['severity'],
                value: 0,
                message: v.message,
                nearestToken: null,
                nearestTokenValue: null,
                ruleId: v.ruleId,
                wcag: v.wcag,
                fixable: v.fixable,
            }))
        } catch {
            // a11y audit is best-effort for planning
        }

        const allViolations: LinterWarning[] = [
            ...Array.from(mithrilWarnings.values()),
            ...a11yViolations,
        ]

        plan = await planMutations(allViolations, tokens, {
            projectRoot: config.projectRoot,
            filePath,
        })
    } catch {
        // Planner is best-effort — never blocks the fix result
    }

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
        plan,
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
    plan?: MutationPlan
}): FixResult {
    const { fixedSource, fixesApplied, status, filePath, dryRun, projectRoot, plan } = opts
    const summary = generateFixSummary(filePath, fixesApplied, status, dryRun)

    // CLARITY-2: Generate actionable recommendation
    let recommendation: string
    if (fixesApplied > 0) {
        recommendation = dryRun
            ? `${fixesApplied} drift(s) can be fixed. Run again without dry-run to apply.`
            : `Fixed ${fixesApplied} drift(s). Run 'audit' to verify no gaps remain.`
    } else {
        recommendation = status === 'parse-error' || status === 'generate-error'
            ? 'Could not process this file. Check for syntax errors.'
            : '0 fixable issues — this file looks clean.'
    }

    const result: FixResult = {
        fixedSource,
        fixesApplied,
        status,
        summary,
        dryRun,
        recommendation,
    }

    // P0: Attach mutation plan breakdown
    if (plan) {
        result._plan = plan
        result._summary = summarizePlan(plan)

        // Extract semantic errors as structured payloads
        if (plan.semantic.length > 0) {
            result.semanticErrors = plan.semantic.map((pm) => ({
                violationId: pm.violation.id,
                ruleId: pm.violation.ruleId,
                message: pm.violation.message,
                semanticHint: pm.semanticHint ?? 'Requires manual review.',
                confidence: pm.confidence,
            }))
        }

        // Extract riskGated items with MRS scores
        if (plan.riskGated.length > 0) {
            result.riskGatedFixes = plan.riskGated.map((pm) => ({
                violationId: pm.violation.id,
                ruleId: pm.violation.ruleId,
                message: pm.violation.message,
                mrsScore: pm.riskScore?.score ?? 0,
                mrsTier: pm.riskScore?.tier ?? 'green',
                proposedFix: pm.proposedFix,
            }))
        }
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
