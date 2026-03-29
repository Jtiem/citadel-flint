/**
 * flint-quick-audit — single-file governance audit prompt.
 *
 * When a host loads this prompt, the LLM receives instructions to:
 *   1. Resolve the target file (from arg or project context)
 *   2. Run audit_ui_component
 *   3. Present results as formatted markdown
 *   4. Offer auto-fix if violations found
 */

import { BRAND, toolName, resourceUri } from '../brand.js'

// -- MCP prompt definition ----------------------------------------------------

export const QUICK_AUDIT_PROMPT_DEF = {
    name: BRAND.productLower + '-quick-audit',
    description:
        'Audit the current file for governance violations (design tokens, accessibility, brand compliance)',
    arguments: [
        {
            name: 'filePath',
            description:
                'Path to the component file to audit. If omitted, uses the active file from project context.',
            required: false,
        },
    ],
} as const

// -- Prompt content builder ---------------------------------------------------

export function getQuickAuditContent(filePath?: string): string {
    const fileResolution = filePath
        ? `The user wants to audit this file: ${filePath}`
        : `No file path was provided. Call ${toolName('get_context')} with the projectRoot ` +
          `to discover the active file. Use the activeFile from the response.`

    return `You are running a ${BRAND.product} governance audit on a single UI component file.

${fileResolution}

STEPS:
1. ${filePath ? '' : `Call ${toolName('get_context')} to get the active file path.\n2. `}Call audit_ui_component with the file path.
${filePath ? '2' : '3'}. Present the results as formatted markdown:
   - State the verdict: APPROVED (no violations) or BLOCKED (violations found)
   - List each violation with: rule ID, severity, line number, and explanation
   - Include the "Why it matters" context for each violation
   - Show the health grade if available
${filePath ? '3' : '4'}. If violations were found, end with:
   "Say 'fix it' to auto-remediate these violations."

IMPORTANT: Present the findings in your chat response as readable markdown.
Do not rely on the raw tool output alone -- format it for the user.`
}
