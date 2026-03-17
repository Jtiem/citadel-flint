/**
 * complexityRouter.test.ts — Phase ACX.4
 *
 * Tests for assessComplexity():
 *   ACX-13: fast tier for single-node, no-violation, low-token task
 *   ACX-14: balanced tier for compound mutations across moderate context
 *   ACX-15: powerful tier for cross-file, high-violation, large-file tasks
 *   ACX-16: crossFile=true from filePaths.length > 1
 *   ACX-17: ctx=null degrades gracefully (no violation/token context)
 *   Additional: factor breakdown correctness, boundary values, determinism
 */

import { describe, it, expect } from 'vitest'
import { assessComplexity } from '../../src/core/complexityRouter.js'
import type { ComplexityInput } from '../../src/core/complexityRouter.js'
import type { SessionContext } from '../../src/core/sessionContext.js'

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<{
    mithrilCount: number
    a11yCount: number
    tokenCount: number
    activeFileSource: string | null
}>): SessionContext {
    const { mithrilCount = 0, a11yCount = 0, tokenCount = 0, activeFileSource = null } = overrides
    return {
        assembledAt: new Date().toISOString(),
        projectRoot: '/tmp/test',
        canvas: {
            activeFile: '/tmp/test/src/Button.tsx',
            selectedNodeId: null,
            canvasMode: 'design',
            figmaConnected: false,
            saveState: 'saved',
        },
        activeFileSource,
        activeFilePath: '/tmp/test/src/Button.tsx',
        violations: {
            mithrilCount,
            a11yCount,
            amberCount: mithrilCount,
            criticalCount: a11yCount,
            affectedNodeIds: [],
            hasFixableViolations: false,
        },
        tokens: {
            totalCount: tokenCount,
            byType: tokenCount > 0 ? { color: tokenCount } : {},
            top20: [],
        },
        recentMutations: [],
        healthScore: null,
        healthGrade: null,
        partial: false,
    }
}

const MINIMAL_INPUT: ComplexityInput = {
    taskDescription: 'Update button background color',
    estimatedNodeCount: 1,
    crossFile: false,
    mutationTypes: ['updateClassName'],
}

// ── ACX-13: fast tier ─────────────────────────────────────────────────────────

describe('assessComplexity — fast tier (ACX-13)', () => {
    it('returns fast tier for minimal single-node atomic task', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        expect(result.recommendedTier).toBe('fast')
    })

    it('returns score <= 30 for minimal task', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        expect(result.score).toBeLessThanOrEqual(30)
    })

    it('returns fast tier when nodeCount=1, no violations, low token count', () => {
        const ctx = makeCtx({ tokenCount: 5 })
        const result = assessComplexity(
            { taskDescription: 'Change text color', estimatedNodeCount: 1, crossFile: false, mutationTypes: ['updateProp'] },
            ctx,
        )
        expect(result.recommendedTier).toBe('fast')
        expect(result.score).toBeLessThanOrEqual(30)
    })

    it('rationale string mentions fast tier', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        expect(result.rationale).toContain('fast')
    })

    it('returns exactly 6 factors', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        expect(result.factors).toHaveLength(6)
    })

    it('factor names include expected keys', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        const names = result.factors.map(f => f.name)
        expect(names).toContain('nodeCount')
        expect(names).toContain('crossFileScope')
        expect(names).toContain('violationLoad')
        expect(names).toContain('tokenVocabulary')
        expect(names).toContain('mutationTypes')
        expect(names).toContain('fileSize')
    })

    it('crossFileScope contribution is 0 when crossFile=false', () => {
        const result = assessComplexity({ ...MINIMAL_INPUT, crossFile: false }, null)
        const crossFileFactor = result.factors.find(f => f.name === 'crossFileScope')
        expect(crossFileFactor?.contribution).toBe(0)
        expect(crossFileFactor?.value).toBe('no')
    })

    it('nodeCount contribution is 0 for 1 node', () => {
        const result = assessComplexity({ ...MINIMAL_INPUT, estimatedNodeCount: 1 }, null)
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        expect(nodeCountFactor?.contribution).toBe(0)
    })

    it('mutationTypes contribution is 0 for single type', () => {
        const result = assessComplexity({ ...MINIMAL_INPUT, mutationTypes: ['updateClassName'] }, null)
        const mutFactor = result.factors.find(f => f.name === 'mutationTypes')
        expect(mutFactor?.contribution).toBe(0)
    })
})

// ── ACX-14: balanced tier ─────────────────────────────────────────────────────

describe('assessComplexity — balanced tier (ACX-14)', () => {
    it('returns balanced tier for compound mutations with moderate context', () => {
        // Score calculation:
        //   nodeCount=25  (30 raw, weight 25) → contribution = round(25*30/100) = 8
        //   crossFile=true (100 raw, weight 20) → contribution = 20
        //   violationLoad=3 (20 raw, weight 15) → contribution = round(15*20/100) = 3
        //   tokenVocab=30 (30 raw, weight 15) → contribution = round(15*30/100) = 5
        //   mutationTypes=3 (40 raw, weight 15) → contribution = round(15*40/100) = 6
        //   fileSize=0 (0 raw, weight 10) → contribution = 0
        //   Total = 8+20+3+5+6+0 = 42 → balanced
        const ctx = makeCtx({ mithrilCount: 3, tokenCount: 30 })
        const result = assessComplexity(
            {
                taskDescription: 'Refactor card layout with token fixes across files',
                estimatedNodeCount: 25,
                crossFile: true,
                mutationTypes: ['updateClassName', 'updateProp', 'deleteNode'],
            },
            ctx,
        )
        expect(result.recommendedTier).toBe('balanced')
        expect(result.score).toBeGreaterThanOrEqual(31)
        expect(result.score).toBeLessThanOrEqual(65)
    })

    it('crossFile=true alone pushes score above fast threshold', () => {
        // crossFile weight 20 → contribution 20 on its own
        const result = assessComplexity(
            { taskDescription: 'Move component', estimatedNodeCount: 1, crossFile: true, mutationTypes: ['moveNode'] },
            null,
        )
        // score should include at least 20 from crossFile
        expect(result.score).toBeGreaterThanOrEqual(20)
        const crossFileFactor = result.factors.find(f => f.name === 'crossFileScope')
        expect(crossFileFactor?.contribution).toBe(20)
        expect(crossFileFactor?.value).toBe('yes')
    })

    it('rationale mentions balanced tier when score is 31-65', () => {
        const ctx = makeCtx({ mithrilCount: 3, tokenCount: 30 })
        const result = assessComplexity(
            {
                taskDescription: 'Multi-step layout fix',
                estimatedNodeCount: 15,
                crossFile: false,
                mutationTypes: ['updateClassName', 'updateProp', 'deleteNode'],
            },
            ctx,
        )
        if (result.recommendedTier === 'balanced') {
            expect(result.rationale).toContain('balanced')
        }
    })

    it('score increases with more violation load', () => {
        const ctxLow = makeCtx({ mithrilCount: 1 })
        const ctxHigh = makeCtx({ mithrilCount: 15 })
        const inputBase: ComplexityInput = { taskDescription: 'Fix violations', estimatedNodeCount: 5, crossFile: false }
        const scoreLow = assessComplexity(inputBase, ctxLow).score
        const scoreHigh = assessComplexity(inputBase, ctxHigh).score
        expect(scoreHigh).toBeGreaterThan(scoreLow)
    })

    it('score increases with larger token vocabulary', () => {
        const ctxSmall = makeCtx({ tokenCount: 5 })
        const ctxLarge = makeCtx({ tokenCount: 300 })
        const inputBase: ComplexityInput = { taskDescription: 'Apply tokens', estimatedNodeCount: 1, crossFile: false }
        const scoreSmall = assessComplexity(inputBase, ctxSmall).score
        const scoreLarge = assessComplexity(inputBase, ctxLarge).score
        expect(scoreLarge).toBeGreaterThan(scoreSmall)
    })
})

// ── ACX-15: powerful tier ─────────────────────────────────────────────────────

describe('assessComplexity — powerful tier (ACX-15)', () => {
    it('returns powerful tier for cross-file, high-violation, large-file task', () => {
        const largeSource = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n')
        const ctx = makeCtx({ mithrilCount: 20, a11yCount: 10, tokenCount: 250, activeFileSource: largeSource })
        const result = assessComplexity(
            {
                taskDescription: 'Architectural refactor across multiple files',
                estimatedNodeCount: 60,
                crossFile: true,
                mutationTypes: ['moveNode', 'injectComponent', 'deleteNode', 'updateProp', 'wrapNode'],
            },
            ctx,
        )
        expect(result.recommendedTier).toBe('powerful')
        expect(result.score).toBeGreaterThanOrEqual(66)
    })

    it('rationale mentions powerful tier', () => {
        const largeSource = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n')
        const ctx = makeCtx({ mithrilCount: 25, tokenCount: 250, activeFileSource: largeSource })
        const result = assessComplexity(
            {
                taskDescription: 'Major refactor',
                estimatedNodeCount: 60,
                crossFile: true,
                mutationTypes: ['moveNode', 'injectComponent', 'deleteNode', 'updateProp'],
            },
            ctx,
        )
        if (result.recommendedTier === 'powerful') {
            expect(result.rationale).toContain('powerful')
        }
    })

    it('50+ nodes gives nodeCount contribution of 25', () => {
        const result = assessComplexity(
            { taskDescription: 'Bulk update', estimatedNodeCount: 51, crossFile: false },
            null,
        )
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        expect(nodeCountFactor?.contribution).toBe(25)
    })

    it('fileSize contribution is 10 for source with 500+ lines', () => {
        const largeSource = Array.from({ length: 501 }, (_, i) => `line ${i}`).join('\n')
        const ctx = makeCtx({ activeFileSource: largeSource })
        const result = assessComplexity(
            { taskDescription: 'Edit large file', estimatedNodeCount: 1, crossFile: false },
            ctx,
        )
        const fileSizeFactor = result.factors.find(f => f.name === 'fileSize')
        expect(fileSizeFactor?.contribution).toBe(10)
    })

    it('violationLoad contribution is 15 for 20+ violations', () => {
        const ctx = makeCtx({ mithrilCount: 15, a11yCount: 10 })
        const result = assessComplexity(
            { taskDescription: 'Fix all violations', estimatedNodeCount: 1, crossFile: false },
            ctx,
        )
        const violFactor = result.factors.find(f => f.name === 'violationLoad')
        expect(violFactor?.contribution).toBe(15)
    })

    it('4+ mutation types gives mutationTypes contribution of 15', () => {
        const result = assessComplexity(
            {
                taskDescription: 'Complex refactor',
                estimatedNodeCount: 1,
                crossFile: false,
                mutationTypes: ['moveNode', 'injectComponent', 'deleteNode', 'updateProp'],
            },
            null,
        )
        const mutFactor = result.factors.find(f => f.name === 'mutationTypes')
        expect(mutFactor?.contribution).toBe(15)
    })
})

// ── ACX-16: crossFile from filePaths ─────────────────────────────────────────

describe('assessComplexity — crossFile from filePaths (ACX-16)', () => {
    it('infers crossFile=true when filePaths has more than 1 entry', () => {
        const result = assessComplexity(
            {
                taskDescription: 'Move component',
                filePaths: ['/src/Foo.tsx', '/src/Bar.tsx'],
            },
            null,
        )
        const crossFileFactor = result.factors.find(f => f.name === 'crossFileScope')
        expect(crossFileFactor?.value).toBe('yes')
        expect(crossFileFactor?.contribution).toBe(20)
    })

    it('does not infer crossFile=true when filePaths has exactly 1 entry', () => {
        const result = assessComplexity(
            {
                taskDescription: 'Edit one file',
                filePaths: ['/src/Foo.tsx'],
            },
            null,
        )
        const crossFileFactor = result.factors.find(f => f.name === 'crossFileScope')
        expect(crossFileFactor?.value).toBe('no')
        expect(crossFileFactor?.contribution).toBe(0)
    })

    it('explicit crossFile=true overrides filePaths.length=1', () => {
        const result = assessComplexity(
            {
                taskDescription: 'Force cross-file',
                crossFile: true,
                filePaths: ['/src/Foo.tsx'],
            },
            null,
        )
        const crossFileFactor = result.factors.find(f => f.name === 'crossFileScope')
        expect(crossFileFactor?.value).toBe('yes')
    })

    it('explicit crossFile=false overrides filePaths.length > 1', () => {
        const result = assessComplexity(
            {
                taskDescription: 'Force single-file',
                crossFile: false,
                filePaths: ['/src/Foo.tsx', '/src/Bar.tsx'],
            },
            null,
        )
        const crossFileFactor = result.factors.find(f => f.name === 'crossFileScope')
        expect(crossFileFactor?.value).toBe('no')
    })
})

// ── ACX-17: ctx=null degradation ──────────────────────────────────────────────

describe('assessComplexity — null ctx degradation (ACX-17)', () => {
    it('does not throw when ctx is null', () => {
        expect(() => assessComplexity(MINIMAL_INPUT, null)).not.toThrow()
    })

    it('returns a valid ComplexityAssessment when ctx is null', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        expect(result).toHaveProperty('recommendedTier')
        expect(result).toHaveProperty('score')
        expect(result).toHaveProperty('rationale')
        expect(result).toHaveProperty('factors')
        expect(typeof result.score).toBe('number')
        expect(['fast', 'balanced', 'powerful']).toContain(result.recommendedTier)
    })

    it('violationLoad contribution is 0 when ctx is null', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        const violFactor = result.factors.find(f => f.name === 'violationLoad')
        expect(violFactor?.contribution).toBe(0)
    })

    it('tokenVocabulary contribution is 0 when ctx is null', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        const tokenFactor = result.factors.find(f => f.name === 'tokenVocabulary')
        expect(tokenFactor?.contribution).toBe(0)
    })

    it('fileSize contribution is 0 when ctx is null (no source available)', () => {
        const result = assessComplexity(MINIMAL_INPUT, null)
        const fileSizeFactor = result.factors.find(f => f.name === 'fileSize')
        expect(fileSizeFactor?.contribution).toBe(0)
    })

    it('defaults estimatedNodeCount to 1 when not provided', () => {
        const result = assessComplexity({ taskDescription: 'Do something' }, null)
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        expect(nodeCountFactor?.value).toBe(1)
    })
})

// ── Determinism ───────────────────────────────────────────────────────────────

describe('assessComplexity — determinism', () => {
    it('returns identical results for identical inputs', () => {
        const ctx = makeCtx({ mithrilCount: 5, tokenCount: 50 })
        const input: ComplexityInput = {
            taskDescription: 'Update card styles',
            estimatedNodeCount: 10,
            crossFile: false,
            mutationTypes: ['updateClassName', 'updateProp'],
        }
        const r1 = assessComplexity(input, ctx)
        const r2 = assessComplexity(input, ctx)
        expect(r1.score).toBe(r2.score)
        expect(r1.recommendedTier).toBe(r2.recommendedTier)
    })

    it('is a pure function — does not mutate the input', () => {
        const input: ComplexityInput = {
            taskDescription: 'Update button',
            estimatedNodeCount: 3,
            crossFile: false,
            mutationTypes: ['updateClassName'],
        }
        const inputCopy = JSON.parse(JSON.stringify(input))
        assessComplexity(input, null)
        expect(input).toEqual(inputCopy)
    })

    it('score is always between 0 and 100', () => {
        const inputs: ComplexityInput[] = [
            MINIMAL_INPUT,
            { taskDescription: 'Max complexity', estimatedNodeCount: 100, crossFile: true, mutationTypes: ['moveNode', 'inject', 'delete', 'wrap'] },
            { taskDescription: 'No context' },
        ]
        for (const input of inputs) {
            const result = assessComplexity(input, null)
            expect(result.score).toBeGreaterThanOrEqual(0)
            expect(result.score).toBeLessThanOrEqual(100)
        }
    })

    it('score is always an integer (no floating point drift)', () => {
        const ctx = makeCtx({ mithrilCount: 7, tokenCount: 123 })
        const result = assessComplexity(
            { taskDescription: 'Update', estimatedNodeCount: 18, crossFile: false, mutationTypes: ['updateClassName', 'updateProp'] },
            ctx,
        )
        expect(Number.isInteger(result.score)).toBe(true)
    })
})

// ── Boundary values ───────────────────────────────────────────────────────────

describe('assessComplexity — boundary values', () => {
    it('nodeCount=5 gives 0 raw score (boundary: <= 5)', () => {
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 5, crossFile: false }, null)
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        expect(nodeCountFactor?.contribution).toBe(0)
    })

    it('nodeCount=6 gives 30 raw score (boundary: 6-20)', () => {
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 6, crossFile: false }, null)
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        // contribution = 25 * 30 / 100 = 7.5 → rounded to 8
        expect(nodeCountFactor?.contribution).toBe(Math.round(25 * 30 / 100))
    })

    it('nodeCount=20 gives 30 raw score (boundary: 6-20)', () => {
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 20, crossFile: false }, null)
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        expect(nodeCountFactor?.contribution).toBe(Math.round(25 * 30 / 100))
    })

    it('nodeCount=21 gives 60 raw score (boundary: 21-50)', () => {
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 21, crossFile: false }, null)
        const nodeCountFactor = result.factors.find(f => f.name === 'nodeCount')
        expect(nodeCountFactor?.contribution).toBe(Math.round(25 * 60 / 100))
    })

    it('violationLoad=5 gives 20 raw score (boundary: 1-5)', () => {
        const ctx = makeCtx({ mithrilCount: 5 })
        const result = assessComplexity({ taskDescription: 'Fix', estimatedNodeCount: 1, crossFile: false }, ctx)
        const violFactor = result.factors.find(f => f.name === 'violationLoad')
        expect(violFactor?.contribution).toBe(Math.round(15 * 20 / 100))
    })

    it('violationLoad=6 gives 50 raw score (boundary: 6-20)', () => {
        const ctx = makeCtx({ mithrilCount: 6 })
        const result = assessComplexity({ taskDescription: 'Fix', estimatedNodeCount: 1, crossFile: false }, ctx)
        const violFactor = result.factors.find(f => f.name === 'violationLoad')
        expect(violFactor?.contribution).toBe(Math.round(15 * 50 / 100))
    })

    it('tokenCount=0 gives 0 raw score', () => {
        const ctx = makeCtx({ tokenCount: 0 })
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 1, crossFile: false }, ctx)
        const tokenFactor = result.factors.find(f => f.name === 'tokenVocabulary')
        expect(tokenFactor?.contribution).toBe(0)
    })

    it('empty mutationTypes array gives 0 raw score', () => {
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 1, crossFile: false, mutationTypes: [] }, null)
        const mutFactor = result.factors.find(f => f.name === 'mutationTypes')
        expect(mutFactor?.contribution).toBe(0)
    })

    it('fileSize < 100 lines gives 0 contribution', () => {
        const shortSource = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
        const ctx = makeCtx({ activeFileSource: shortSource })
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 1, crossFile: false }, ctx)
        const fileSizeFactor = result.factors.find(f => f.name === 'fileSize')
        expect(fileSizeFactor?.contribution).toBe(0)
    })

    it('fileSize 100-499 lines gives 30 raw score contribution', () => {
        const mediumSource = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n')
        const ctx = makeCtx({ activeFileSource: mediumSource })
        const result = assessComplexity({ taskDescription: 'Update', estimatedNodeCount: 1, crossFile: false }, ctx)
        const fileSizeFactor = result.factors.find(f => f.name === 'fileSize')
        expect(fileSizeFactor?.contribution).toBe(Math.round(10 * 30 / 100))
    })
})
