/**
 * flint-fix-all — audit and auto-fix all governance violations in a file.
 *
 * When a host loads this prompt, the LLM receives instructions to:
 *   1. Resolve the target file (from arg or project context)
 *   2. Run flint_fix to auto-remediate violations
 *   3. Report what was fixed and what remains
 */

import { BRAND, toolName } from '../brand.js'

// -- MCP prompt definition ----------------------------------------------------

export const FIX_ALL_PROMPT_DEF = {
    name: BRAND.productLower + '-fix-all',
    description:
        'Audit and auto-fix all governance violations in the current file',
    arguments: [
        {
            name: 'filePath',
            description:
                'Path to fix. If omitted, uses the active file.',
            required: false,
        },
    ],
} as const

// -- Prompt content builder ---------------------------------------------------

export function getFixAllContent(filePath?: string): string {
    const fileResolution = filePath
        ? `The user wants to fix this file: ${filePath}`
        : `No file path was provided. Call ${toolName('get_context')} with the projectRoot ` +
          `to discover the active file. Use the activeFile from the response.`

    return `You are running ${BRAND.product} auto-fix on a UI component file to resolve governance violations.

${fileResolution}

STEPS:
1. ${filePath ? '' : `Call ${toolName('get_context')} to get the active file path.\n2. `}Call ${toolName('fix')} with the file path to auto-fix all detected violations.
${filePath ? '2' : '3'}. Present the results as formatted markdown:
   - List each violation that was FIXED (rule ID, what changed)
   - List any violations that REMAIN and cannot be auto-fixed
   - Show the before/after health grade if available
${filePath ? '3' : '4'}. If violations remain, explain what manual action is needed.

IMPORTANT: ${toolName('fix')} handles Mithril token violations (color drift, typography, spacing).
Accessibility violations that require structural changes may need manual remediation via
${toolName('ast_mutate')}.`
}
