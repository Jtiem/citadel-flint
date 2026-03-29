/**
 * flint-onboard-project — first-time project setup workflow prompt.
 *
 * When a host loads this prompt, the LLM receives instructions to:
 *   1. Read current project state via flint_get_context
 *   2. Index the component registry via flint_reindex_registry
 *   3. Run flint_debt_report to establish a baseline health score
 *   4. Suggest concrete next steps based on the grade received
 */

import { BRAND, toolName, resourceUri } from '../brand.js'

// -- MCP prompt definition ----------------------------------------------------

export const ONBOARD_PROJECT_PROMPT_DEF = {
    name: BRAND.productLower + '-onboard-project',
    description:
        'First-time project setup — index design system, run baseline audit, and get a governance health score',
    arguments: [
        {
            name: 'projectRoot',
            description:
                'Absolute path to the project root. If omitted, uses the current working directory.',
            required: false,
        },
    ],
} as const

// Resolved at module load time — avoids circular import with server.ts.
// Keep in sync with REGISTERED_TOOL_COUNT in server.ts.
const REGISTERED_TOOL_COUNT_PLACEHOLDER = '54'

// -- Prompt content builder ---------------------------------------------------

export function getOnboardProjectContent(projectRoot?: string): string {
    const rootHint = projectRoot
        ? `Project root: ${projectRoot}`
        : `No project root was specified. Use the current working directory.`

    return `You are running the ${BRAND.product} first-time project setup workflow.

${rootHint}

STEPS:

1. Call ${toolName('get_context')} to read current project state.
   - Check the healthGrade and violations fields.
   - If healthGrade already exists, this project has been set up before — let the user know and proceed to step 3.
   - If the response includes a \`coldStartHint\` field, Glass is not running. Tell the user:
     "Flint Glass is not connected. You can still govern headlessly — the audit tools work without it."
     Show the user the \`coldStartHint\` message so they know how to start Glass if they want it.
     Then skip to step 3 (reindex and debt report work without Glass).

**Step 1.5: Initialize governance policy**
   - Call ${toolName('set_policy')} with action: "read" to check whether a policy already exists.
   - If the response is empty, returns an error, or contains no policy fields, call ${toolName('set_policy')} with action: "reset" to initialize defaults.
     Then tell the user: "Governance policy initialized with defaults. You can customize thresholds in \`.flint/policy.json\` or via \`flint_set_policy\`."
   - If a policy already exists, skip this step and continue.

2. Call ${toolName('reindex_registry')} to index the component registry.
   - This scans the project source tree and builds the component inventory.
   - Report how many components were indexed.

3. Call ${toolName('debt_report')} with format="markdown" to establish a baseline health score.
   - This runs Mithril and Warden audits across the project and returns a health score (0-100, A-F grade).

4. Present the results as formatted markdown:
   - Show the health score and grade prominently.
   - List the top 3 most-violated rules and their descriptions.
   - Suggest concrete next steps based on the grade:
     * Grade A (90-100): "Your project is in excellent health. Run 'audit my component' to stay on top of new additions."
     * Grade B (80-89): "Good health. A few patterns to clean up. Try 'fix it' on the top-violated files."
     * Grade C (70-79): "Some violations to address. Run 'fix it' on your most active components first."
     * Grade D (60-69): "Governance debt is accumulating. Consider 'sweep' to batch-fix across all files."
     * Grade F (<60): "Significant governance debt. Run 'sweep' to batch-fix, then review remaining manual violations."

5. End with:
   "Say 'audit my component' to scan a specific file, 'fix it' to auto-remediate, or read ${resourceUri('capabilities')} to explore all ${REGISTERED_TOOL_COUNT_PLACEHOLDER} tools."

IMPORTANT: This is a read-only diagnostic workflow. Do not modify any files unless the user explicitly asks.`
}
