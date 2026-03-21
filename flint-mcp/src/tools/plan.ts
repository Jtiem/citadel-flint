/**
 * plan.ts — flint-mcp/src/tools/plan.ts
 *
 * MCP tool handler for flint_plan.
 *
 * Accepts a natural language intent and returns a structured execution plan.
 * Does not execute anything -- returns the plan for the agent to follow.
 *
 * Registration: imported by server.ts (deferred until ING.3 clears server.ts territory).
 * See .flint-context/contracts/CX2-FlintPlan.md §12 for registration instructions.
 */

import type { FlintConfig } from '../core/config.js'
import {
    generatePlan,
} from '../core/planService.js'
import { toolName } from '../brand.js'

// Re-export types for external consumers
export type {
    PlanIntentType,
    PlanIntent,
    ToolStep,
    DecisionStep,
    PlanStep,
    ExecutionPlan,
    FlintPlanParams,
    ScopeEstimate,
} from '../core/planService.js'

// ── Tool definition (MCP ListTools schema) ────────────────────────────────────

export const FLINT_PLAN_TOOL = {
    name: toolName('plan'),
    description:
        'Generate a structured execution plan for a multi-step governance task. ' +
        'Accepts a natural language intent (e.g., "migrate all hardcoded colors to design tokens") ' +
        'and returns an ordered sequence of Flint tool calls, decision points requiring human judgment, ' +
        'and success criteria. Does not execute anything -- returns the plan for the agent to follow. ' +
        'Supports 6 intent types: token-migration, accessibility-sweep, full-governance-audit, ' +
        'figma-sync, debt-remediation, component-composition.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            intent: {
                type: 'string',
                description:
                    'Natural language description of the governance task. ' +
                    'Example: "Migrate all hardcoded colors in src/components/ to design tokens"',
            },
            glob: {
                type: 'string',
                description:
                    'Glob pattern to scope the plan (default: "**/*.tsx"). ' +
                    'Example: "src/components/**/*.tsx"',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to project root. When provided, the plan includes ' +
                    'scope estimates based on real .flint/ data (violation counts, health score).',
            },
            dry_run: {
                type: 'boolean',
                description:
                    'When true, marks the plan as a preview. The agent should present ' +
                    'the plan for human review before executing. Default: false.',
            },
        },
        required: ['intent'],
    },
} as const

// ── Input type ────────────────────────────────────────────────────────────────

export interface FlintPlanArgs {
    intent: string
    glob?: string
    projectRoot?: string
    dry_run?: boolean
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * Handle the flint_plan MCP tool call.
 *
 * @param args   - Validated FlintPlanArgs
 * @param config - FlintConfig (used for projectRoot fallback)
 * @returns      - MCP-format response with content array
 */
export function handleFlintPlan(
    args: FlintPlanArgs,
    config: FlintConfig,
): { content: Array<{ type: 'text'; text: string }> } {
    const projectRoot = args.projectRoot ?? config.projectRoot

    const plan = generatePlan(args.intent, {
        glob: args.glob,
        projectRoot,
        dryRun: args.dry_run ?? false,
    })

    return {
        content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
    }
}
