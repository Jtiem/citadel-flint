/**
 * plan.ts — bridge-mcp/src/tools/plan.ts
 *
 * MCP tool handler for bridge_plan.
 *
 * Accepts a natural language intent and returns a structured execution plan.
 * Does not execute anything -- returns the plan for the agent to follow.
 *
 * Registration: imported by server.ts (deferred until ING.3 clears server.ts territory).
 * See .bridge-context/contracts/CX2-BridgePlan.md §12 for registration instructions.
 */

import type { BridgeConfig } from '../core/config.js'
import {
    generatePlan,
} from '../core/planService.js'

// Re-export types for external consumers
export type {
    PlanIntentType,
    PlanIntent,
    ToolStep,
    DecisionStep,
    PlanStep,
    ExecutionPlan,
    BridgePlanParams,
    ScopeEstimate,
} from '../core/planService.js'

// ── Tool definition (MCP ListTools schema) ────────────────────────────────────

export const BRIDGE_PLAN_TOOL = {
    name: 'bridge_plan',
    description:
        'Generate a structured execution plan for a multi-step governance task. ' +
        'Accepts a natural language intent (e.g., "migrate all hardcoded colors to design tokens") ' +
        'and returns an ordered sequence of Bridge tool calls, decision points requiring human judgment, ' +
        'and success criteria. Does not execute anything -- returns the plan for the agent to follow. ' +
        'Supports 5 intent types: token-migration, accessibility-sweep, full-governance-audit, ' +
        'figma-sync, debt-remediation.',
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
                    'scope estimates based on real .bridge/ data (violation counts, health score).',
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

export interface BridgePlanArgs {
    intent: string
    glob?: string
    projectRoot?: string
    dry_run?: boolean
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * Handle the bridge_plan MCP tool call.
 *
 * @param args   - Validated BridgePlanArgs
 * @param config - BridgeConfig (used for projectRoot fallback)
 * @returns      - MCP-format response with content array
 */
export function handleBridgePlan(
    args: BridgePlanArgs,
    config: BridgeConfig,
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
