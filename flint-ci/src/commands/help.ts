/**
 * Help command -- flint-ci/src/commands/help.ts
 *
 * Prints 7 workflow situations to orient first-time users.
 * Conversational narrative, not a flags table.
 *
 * Exit code: always 0.
 */

import { ANSI } from '../utils/ansi.js'
// Mirrors HelpSituation from docs/contracts/sprint-clarity.contract.ts
export interface HelpSituation {
    title: string
    command: string
    description: string
}

// ── The 7 situations ────────────────────────────────────────────────────────

export const HELP_SITUATIONS: HelpSituation[] = [
    {
        title: 'Check if my code meets our design system',
        command: 'flint-gate audit "src/**/*.tsx"',
        description: 'Scans your components for color drift, spacing issues, and token violations.',
    },
    {
        title: 'See how healthy my project is overall',
        command: 'flint-gate debt "src/**/*.tsx"',
        description: 'Generates a health score (0-100) and letter grade for your design system compliance.',
    },
    {
        title: 'Auto-fix design drift in my components',
        command: 'flint-gate fix "src/**/*.tsx"',
        description: 'Automatically replaces hardcoded values with design tokens (dry-run by default).',
    },
    {
        title: 'Check if my tokens are in sync with Figma',
        command: 'flint-gate sync "src/**/*.tsx"',
        description: 'Detects token drift between your codebase and Figma source of truth.',
    },
    {
        title: 'Generate a compliance report for my team',
        command: 'flint-gate dbom --format markdown',
        description: 'Exports a Design Bill of Materials with token and component compliance status.',
    },
    {
        title: 'Set up Flint in CI for the first time',
        command: 'flint-gate audit --help',
        description: 'Add flint-gate audit to your CI pipeline. Run --help on any command for details.',
    },
    {
        title: "I'm not sure — show me everything",
        command: 'flint-gate --help',
        description: 'Lists all commands, flags, and options.',
    },
]

// ── Command handler ─────────────────────────────────────────────────────────

export function helpCommand(): 0 {
    const lines: string[] = []

    lines.push('')
    lines.push(`  ${ANSI.bold}What are you trying to do?${ANSI.reset}`)
    lines.push('')

    HELP_SITUATIONS.forEach((situation, i) => {
        const num = `${ANSI.cyan}${i + 1}.${ANSI.reset}`
        lines.push(`  ${num} ${situation.title}`)
        lines.push(`     ${ANSI.dim}${situation.description}${ANSI.reset}`)
        lines.push(`     ${ANSI.green}→ ${situation.command}${ANSI.reset}`)
        lines.push('')
    })

    console.log(lines.join('\n'))
    return 0
}
