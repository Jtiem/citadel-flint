/**
 * complexityRouter.ts — Phase ACX.4: Complexity Assessment Router
 *
 * Pure deterministic function — no I/O, no async.
 * Assesses the complexity of a proposed task against a SessionContext
 * and returns a ComplexityAssessment with a tier (fast/balanced/powerful),
 * a 0-100 score, and a detailed factor breakdown.
 *
 * Scoring factors (weights sum to 100):
 *   nodeCount     (weight 25): 1–5 nodes = 0, 6–20 = 30, 21–50 = 60, 50+ = 100
 *   crossFile     (weight 20): false = 0, true = 100
 *   violationLoad (weight 15): 0 = 0, 1–5 = 20, 6–20 = 50, 20+ = 100
 *   tokenVocab    (weight 15): <10 = 0, 10–50 = 30, 50–200 = 60, 200+ = 100
 *   mutationTypes (weight 15): 1 type = 0, 2–3 = 40, 4+ = 100
 *   fileSize      (weight 10): <100 lines = 0, 100–500 = 30, 500+ = 100
 *
 * Tier mapping:
 *   score 0–30   → 'fast'      (Haiku-class: atomic edits)
 *   score 31–65  → 'balanced'  (Sonnet-class: compound mutations)
 *   score 66–100 → 'powerful'  (Opus-class: architectural refactors)
 */

import type { SessionContext } from './sessionContext.js'

// ── Types (exported for use in types.ts additions) ────────────────────────────

export type ModelTier = 'fast' | 'balanced' | 'powerful'

export interface ComplexityFactor {
    /** Factor name (e.g. "nodeCount", "crossFileScope"). */
    name: string
    /** Weight of this factor in the total score (0–100 scale). */
    weight: number
    /** The raw measured value for this factor. */
    value: number | string
    /** Score contribution from this factor (weight * rawScore / 100). */
    contribution: number
    /** Human-readable description of why this factor fired. */
    description: string
}

export interface ComplexityAssessment {
    /** Recommended model tier. */
    recommendedTier: ModelTier
    /** Numerical complexity score (0–100). */
    score: number
    /** Human-readable explanation of the assessment. */
    rationale: string
    /** Factors that contributed to the score. */
    factors: ComplexityFactor[]
}

export interface ComplexityInput {
    /** Natural language task description. */
    taskDescription: string
    /** Estimated number of AST nodes that will be affected. */
    estimatedNodeCount?: number
    /** Whether the task spans multiple source files. */
    crossFile?: boolean
    /** File paths involved (used to check file count). */
    filePaths?: string[]
    /** Mutation types that will be used (e.g. ['updateProp', 'deleteNode']). */
    mutationTypes?: string[]
}

// ── Tier mapping ──────────────────────────────────────────────────────────────

const TIER_THRESHOLDS = {
    fast: 30,
    balanced: 65,
} as const

function scoreToTier(score: number): ModelTier {
    if (score <= TIER_THRESHOLDS.fast) return 'fast'
    if (score <= TIER_THRESHOLDS.balanced) return 'balanced'
    return 'powerful'
}

const TIER_MODEL_NAMES: Record<ModelTier, string> = {
    fast: 'claude-3-5-haiku-20241022 (Haiku-class)',
    balanced: 'claude-3-5-sonnet-20241022 (Sonnet-class)',
    powerful: 'claude-opus-4-5 (Opus-class)',
}

// ── Individual factor scorers ─────────────────────────────────────────────────

/** nodeCount factor — weight 25 */
function scoreNodeCount(nodeCount: number): { rawScore: number; description: string } {
    if (nodeCount <= 5) return { rawScore: 0, description: `${nodeCount} node(s) — minimal scope` }
    if (nodeCount <= 20) return { rawScore: 30, description: `${nodeCount} nodes — moderate scope` }
    if (nodeCount <= 50) return { rawScore: 60, description: `${nodeCount} nodes — broad scope` }
    return { rawScore: 100, description: `${nodeCount} nodes — very broad scope` }
}

/** crossFile factor — weight 20 */
function scoreCrossFile(crossFile: boolean): { rawScore: number; description: string } {
    if (crossFile) return { rawScore: 100, description: 'Task crosses file boundaries' }
    return { rawScore: 0, description: 'Single-file task' }
}

/** violationLoad factor — weight 15 */
function scoreViolationLoad(totalViolations: number): { rawScore: number; description: string } {
    if (totalViolations === 0) return { rawScore: 0, description: 'No active violations' }
    if (totalViolations <= 5) return { rawScore: 20, description: `${totalViolations} active violation(s) — low load` }
    if (totalViolations <= 20) return { rawScore: 50, description: `${totalViolations} active violations — moderate load` }
    return { rawScore: 100, description: `${totalViolations} active violations — high load` }
}

/** tokenVocab factor — weight 15 */
function scoreTokenVocab(tokenCount: number): { rawScore: number; description: string } {
    if (tokenCount < 10) return { rawScore: 0, description: `${tokenCount} tokens — minimal vocabulary` }
    if (tokenCount < 50) return { rawScore: 30, description: `${tokenCount} tokens — small vocabulary` }
    if (tokenCount < 200) return { rawScore: 60, description: `${tokenCount} tokens — medium vocabulary` }
    return { rawScore: 100, description: `${tokenCount} tokens — large vocabulary` }
}

/** mutationTypes factor — weight 15 */
function scoreMutationTypes(mutationTypes: string[]): { rawScore: number; description: string } {
    const unique = new Set(mutationTypes).size
    if (unique <= 1) return { rawScore: 0, description: `${unique} mutation type(s) — atomic` }
    if (unique <= 3) return { rawScore: 40, description: `${unique} mutation types — compound` }
    return { rawScore: 100, description: `${unique} mutation types — complex` }
}

/** fileSize factor — weight 10 */
function scoreFileSize(lineCount: number): { rawScore: number; description: string } {
    if (lineCount < 100) return { rawScore: 0, description: `${lineCount} lines — small file` }
    if (lineCount < 500) return { rawScore: 30, description: `${lineCount} lines — medium file` }
    return { rawScore: 100, description: `${lineCount} lines — large file` }
}

// ── Main assessment function ──────────────────────────────────────────────────

/**
 * Assess the complexity of a proposed task against the current SessionContext.
 *
 * This is a pure function — no I/O, no async. All inputs are derived from
 * the already-assembled SessionContext and the caller-provided task description.
 *
 * @param input      - Task description and optional hints about scope
 * @param ctx        - Current session context (provides violation count, token count, file size)
 * @returns          - ComplexityAssessment with tier, score, and factor breakdown
 */
export function assessComplexity(
    input: ComplexityInput,
    ctx: SessionContext | null,
): ComplexityAssessment {
    // Derive signal values from ctx and input
    const nodeCount = input.estimatedNodeCount ?? 1
    const crossFile = input.crossFile ?? (input.filePaths !== undefined && input.filePaths.length > 1)

    const totalViolations = ctx
        ? (ctx.violations.mithrilCount + ctx.violations.a11yCount)
        : 0

    const tokenCount = ctx ? ctx.tokens.totalCount : 0

    const mutationTypes = input.mutationTypes ?? []

    // Estimate active file line count from source excerpt
    let fileLineCount = 0
    if (ctx && ctx.activeFileSource) {
        fileLineCount = ctx.activeFileSource.split('\n').length
    }

    // Score each factor
    const nodeCountResult = scoreNodeCount(nodeCount)
    const crossFileResult = scoreCrossFile(crossFile)
    const violationResult = scoreViolationLoad(totalViolations)
    const tokenResult = scoreTokenVocab(tokenCount)
    const mutationResult = scoreMutationTypes(mutationTypes)
    const fileSizeResult = scoreFileSize(fileLineCount)

    // Define factors with weights
    const WEIGHTS = {
        nodeCount: 25,
        crossFile: 20,
        violationLoad: 15,
        tokenVocab: 15,
        mutationTypes: 15,
        fileSize: 10,
    } as const

    const factors: ComplexityFactor[] = [
        {
            name: 'nodeCount',
            weight: WEIGHTS.nodeCount,
            value: nodeCount,
            contribution: Math.round((WEIGHTS.nodeCount * nodeCountResult.rawScore) / 100),
            description: nodeCountResult.description,
        },
        {
            name: 'crossFileScope',
            weight: WEIGHTS.crossFile,
            value: crossFile ? 'yes' : 'no',
            contribution: Math.round((WEIGHTS.crossFile * crossFileResult.rawScore) / 100),
            description: crossFileResult.description,
        },
        {
            name: 'violationLoad',
            weight: WEIGHTS.violationLoad,
            value: totalViolations,
            contribution: Math.round((WEIGHTS.violationLoad * violationResult.rawScore) / 100),
            description: violationResult.description,
        },
        {
            name: 'tokenVocabulary',
            weight: WEIGHTS.tokenVocab,
            value: tokenCount,
            contribution: Math.round((WEIGHTS.tokenVocab * tokenResult.rawScore) / 100),
            description: tokenResult.description,
        },
        {
            name: 'mutationTypes',
            weight: WEIGHTS.mutationTypes,
            value: mutationTypes.length > 0 ? mutationTypes.join(', ') : 'unspecified',
            contribution: Math.round((WEIGHTS.mutationTypes * mutationResult.rawScore) / 100),
            description: mutationResult.description,
        },
        {
            name: 'fileSize',
            weight: WEIGHTS.fileSize,
            value: fileLineCount,
            contribution: Math.round((WEIGHTS.fileSize * fileSizeResult.rawScore) / 100),
            description: fileSizeResult.description,
        },
    ]

    // Total score = sum of contributions
    const score = factors.reduce((acc, f) => acc + f.contribution, 0)
    const tier = scoreToTier(score)

    const rationale = [
        `Complexity score: ${score}/100 → ${tier} tier (${TIER_MODEL_NAMES[tier]}).`,
        `Key drivers: ${factors
            .filter(f => f.contribution > 0)
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 3)
            .map(f => `${f.name} (+${f.contribution})`)
            .join(', ') || 'none — minimal task'}`,
    ].join(' ')

    return {
        recommendedTier: tier,
        score,
        rationale,
        factors,
    }
}
