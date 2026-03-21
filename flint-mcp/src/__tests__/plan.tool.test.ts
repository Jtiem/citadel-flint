/**
 * plan.tool.test.ts — Phase CX.2
 *
 * Integration tests for the flint_plan MCP tool handler.
 *
 * Tests CX2-36 through CX2-45 from the contract test matrix.
 */

import { describe, it, expect } from 'vitest'
import { handleFlintPlan, FLINT_PLAN_TOOL } from '../../src/tools/plan.js'
import type { FlintPlanArgs, ExecutionPlan, ToolStep } from '../../src/tools/plan.js'
import type { FlintConfig } from '../../src/core/config.js'
import { DEFAULT_CONFIG } from '../../src/core/config.js'

// ── Known Flint tool names (from contract §13) ───────────────────────────────

const KNOWN_FLINT_TOOLS = new Set([
    'flint_status',
    'flint_audit',
    'flint_fix',
    'flint_ast_mutate',
    'flint_debt_report',
    'flint_sync_tokens',
    'flint_accessibility_report',
    'flint_query_registry',
    'flint_ingest_figma',
    'audit_ui_component',
    'hydrate_figma_data',
    'read_design_intent',
    'flint_audit_report',
])

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_CONFIG: FlintConfig = {
    ...DEFAULT_CONFIG,
    projectRoot: '/tmp/flint-plan-test',
}

function callPlan(args: FlintPlanArgs, config: FlintConfig = TEST_CONFIG) {
    return handleFlintPlan(args, config)
}

// ── CX2-36: Happy path ────────────────────────────────────────────────────────

describe('handleFlintPlan — happy path (CX2-36)', () => {
    it('CX2-36: valid intent returns { content: [{ type: "text", text: "..." }] }', () => {
        const result = callPlan({ intent: 'Migrate all hardcoded colors to design tokens' })

        expect(result).toHaveProperty('content')
        expect(Array.isArray(result.content)).toBe(true)
        expect(result.content).toHaveLength(1)

        const item = result.content[0]
        expect(item.type).toBe('text')
        expect(typeof item.text).toBe('string')
        expect(item.text.length).toBeGreaterThan(0)
    })
})

// ── CX2-37: Response is valid JSON ────────────────────────────────────────────

describe('handleFlintPlan — JSON validity (CX2-37)', () => {
    it('CX2-37: response text is valid JSON (JSON.parse does not throw)', () => {
        const result = callPlan({ intent: 'Audit the entire codebase for governance compliance' })
        expect(() => JSON.parse(result.content[0].text)).not.toThrow()
    })
})

// ── CX2-38: Response matches ExecutionPlan shape ──────────────────────────────

describe('handleFlintPlan — ExecutionPlan shape (CX2-38)', () => {
    it('CX2-38: parsed response has all required ExecutionPlan fields', () => {
        const result = callPlan({ intent: 'Run an accessibility sweep on all components' })
        const plan = JSON.parse(result.content[0].text) as ExecutionPlan

        expect(plan).toHaveProperty('intent')
        expect(plan).toHaveProperty('steps')
        expect(plan).toHaveProperty('estimatedScope')
        expect(plan).toHaveProperty('riskLevel')
        expect(plan).toHaveProperty('summary')
        expect(plan).toHaveProperty('successCriteria')
        expect(plan).toHaveProperty('dryRun')

        expect(typeof plan.intent.type).toBe('string')
        expect(typeof plan.intent.rawIntent).toBe('string')
        expect(Array.isArray(plan.intent.matchedKeywords)).toBe(true)
        expect(['high', 'medium', 'low']).toContain(plan.intent.confidence)

        expect(Array.isArray(plan.steps)).toBe(true)
        expect(plan.steps.length).toBeGreaterThan(0)

        expect(typeof plan.estimatedScope).toBe('string')
        expect(['low', 'medium', 'high']).toContain(plan.riskLevel)
        expect(typeof plan.summary).toBe('string')
        expect(Array.isArray(plan.successCriteria)).toBe(true)
        expect(typeof plan.dryRun).toBe('boolean')
    })
})

// ── CX2-39: Missing intent (caller responsibility) ────────────────────────────

describe('handleFlintPlan — missing intent (CX2-39)', () => {
    it('CX2-39: handler receives validated args -- calling with empty string returns a valid plan', () => {
        // The MCP framework validates required fields; the handler itself receives validated args.
        // Empty string is valid from a TypeScript perspective and produces an "unknown" plan.
        const result = callPlan({ intent: '' })
        const plan = JSON.parse(result.content[0].text) as ExecutionPlan
        expect(plan.intent.type).toBe('unknown')
        expect(Array.isArray(result.content)).toBe(true)
    })
})

// ── CX2-40: Intent with glob ──────────────────────────────────────────────────

describe('handleFlintPlan — glob parameter (CX2-40)', () => {
    it('CX2-40: plan steps use the provided glob (no {{glob}} placeholder survives)', () => {
        const glob = 'src/components/**/*.tsx'
        const result = callPlan({
            intent: 'Migrate all hardcoded colors to design tokens',
            glob,
        })

        const plan = JSON.parse(result.content[0].text) as ExecutionPlan

        // No placeholders must survive
        const serialized = JSON.stringify(plan)
        expect(serialized).not.toContain('{{glob}}')

        // At least one step must reference the actual glob value
        const toolSteps = plan.steps.filter(s => s.kind === 'tool') as ToolStep[]
        const globAppears = toolSteps.some(step =>
            Object.values(step.params).some(v => v === glob)
        )
        expect(globAppears).toBe(true)
    })
})

// ── CX2-41: Intent with projectRoot ──────────────────────────────────────────

describe('handleFlintPlan — projectRoot parameter (CX2-41)', () => {
    it('CX2-41: plan steps use the provided projectRoot (no {{projectRoot}} placeholder survives)', () => {
        const projectRoot = '/Users/test/my-project'
        const result = callPlan({
            intent: 'Migrate all hardcoded colors to design tokens',
            projectRoot,
        })

        const plan = JSON.parse(result.content[0].text) as ExecutionPlan
        const serialized = JSON.stringify(plan)

        expect(serialized).not.toContain('{{projectRoot}}')

        // At least one step must reference the actual projectRoot
        const toolSteps = plan.steps.filter(s => s.kind === 'tool') as ToolStep[]
        const rootAppears = toolSteps.some(step =>
            Object.values(step.params).some(v => v === projectRoot)
        )
        expect(rootAppears).toBe(true)
    })
})

// ── CX2-42: dry_run=true ──────────────────────────────────────────────────────

describe('handleFlintPlan — dry_run flag (CX2-42)', () => {
    it('CX2-42: dry_run=true sets plan.dryRun to true', () => {
        const result = callPlan({
            intent: 'Audit the entire codebase for governance compliance',
            dry_run: true,
        })

        const plan = JSON.parse(result.content[0].text) as ExecutionPlan
        expect(plan.dryRun).toBe(true)
    })
})

// ── CX2-43: Falls back to config.projectRoot ─────────────────────────────────

describe('handleFlintPlan — config.projectRoot fallback (CX2-43)', () => {
    it('CX2-43: uses config.projectRoot when args.projectRoot is absent', () => {
        const config: FlintConfig = {
            ...DEFAULT_CONFIG,
            projectRoot: '/Users/config-project',
        }

        const result = handleFlintPlan(
            { intent: 'Migrate all hardcoded colors to design tokens' },
            config,
        )

        const plan = JSON.parse(result.content[0].text) as ExecutionPlan
        const serialized = JSON.stringify(plan)

        // The config.projectRoot should be substituted into projectRoot params
        expect(serialized).toContain('/Users/config-project')
        expect(serialized).not.toContain('{{projectRoot}}')
    })
})

// ── CX2-44: Unknown intent returns valid plan ─────────────────────────────────

describe('handleFlintPlan — unknown intent fallback (CX2-44)', () => {
    it('CX2-44: unknown intent returns a valid plan with 1 decision step', () => {
        const result = callPlan({ intent: 'Do something unrecognizable xyz123' })
        const plan = JSON.parse(result.content[0].text) as ExecutionPlan

        expect(plan.intent.type).toBe('unknown')
        expect(plan.steps).toHaveLength(1)
        expect(plan.steps[0].kind).toBe('decision')

        const decision = plan.steps[0]
        expect(decision.kind).toBe('decision')
        if (decision.kind === 'decision') {
            expect(Array.isArray(decision.suggestedOptions)).toBe(true)
            expect(decision.suggestedOptions.length).toBeGreaterThan(0)
        }

        // Plan is still structurally valid
        expect(plan).toHaveProperty('estimatedScope')
        expect(plan).toHaveProperty('riskLevel')
        expect(plan).toHaveProperty('summary')
        expect(plan).toHaveProperty('successCriteria')
    })
})

// ── CX2-45: Every ToolStep.tool is a known Flint tool ───────────────────────

describe('handleFlintPlan — tool names are known Flint tools (CX2-45)', () => {
    const intentExamples = [
        'Migrate all hardcoded colors in src/components/ to design tokens',
        'Run an accessibility sweep on all components',
        'Audit the entire codebase for governance compliance',
        'Sync tokens from Figma',
        'Reduce design debt and improve the health score',
        'Build a signup form with email and password fields',
    ]

    for (const intent of intentExamples) {
        it(`all ToolStep.tool names are known for: "${intent.slice(0, 50)}..."`, () => {
            const result = callPlan({ intent })
            const plan = JSON.parse(result.content[0].text) as ExecutionPlan

            const toolSteps = plan.steps.filter(s => s.kind === 'tool') as ToolStep[]
            for (const step of toolSteps) {
                expect(KNOWN_FLINT_TOOLS.has(step.tool)).toBe(true)
            }
        })
    }
})

// ── FLINT_PLAN_TOOL schema validation ────────────────────────────────────────

describe('FLINT_PLAN_TOOL definition', () => {
    it('has the correct tool name', () => {
        expect(FLINT_PLAN_TOOL.name).toBe('flint_plan')
    })

    it('has a description', () => {
        expect(typeof FLINT_PLAN_TOOL.description).toBe('string')
        expect(FLINT_PLAN_TOOL.description.length).toBeGreaterThan(0)
    })

    it('requires "intent" as the only required field', () => {
        expect(FLINT_PLAN_TOOL.inputSchema.required).toContain('intent')
        expect(FLINT_PLAN_TOOL.inputSchema.required).toHaveLength(1)
    })

    it('schema has all 4 input properties', () => {
        const props = Object.keys(FLINT_PLAN_TOOL.inputSchema.properties)
        expect(props).toContain('intent')
        expect(props).toContain('glob')
        expect(props).toContain('projectRoot')
        expect(props).toContain('dry_run')
    })
})
