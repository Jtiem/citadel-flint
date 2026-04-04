/**
 * heraldPrompt.ts — RELAY.1 Track A
 *
 * Pure utility for composing clipboard-ready "fix it" prompts that designers
 * can paste directly into their IDE chat (Claude Code, Cursor, etc.).
 *
 * No React, no Zustand, no IPC — fully testable in isolation.
 *
 * The output format is deliberately plain English so any LLM can act on it
 * without requiring knowledge of Flint internals. The `flint_fix` hint at the
 * end gives MCP-aware assistants a concrete first step.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HeraldViolation {
    /** Governance domain the violation belongs to */
    category: 'design-drift' | 'accessibility' | 'override'
    /** One-liner human-readable description suitable for a clipboard prompt */
    summary: string
    /** Optional AST node ID — included in per-row prompts for precise targeting */
    nodeId?: string
    severity: 'critical' | 'warning'
}

export interface HeraldPromptInput {
    /** Relative or absolute file path displayed in backticks in the prompt */
    filePath: string
    violations: HeraldViolation[]
}

// ── Category label helpers ────────────────────────────────────────────────────

/**
 * Returns the human-readable category label for a set of violations.
 * If all violations share a single category, uses that category's label.
 * If mixed, returns "governance".
 */
export function resolveCategoryLabel(violations: HeraldViolation[]): string {
    if (violations.length === 0) return 'governance'
    const categories = new Set(violations.map((v) => v.category))
    if (categories.size === 1) {
        const cat = [...categories][0]
        if (cat === 'design-drift') return 'design drift'
        if (cat === 'accessibility') return 'accessibility'
        if (cat === 'override') return 'override'
    }
    return 'governance'
}

// ── Main composer ─────────────────────────────────────────────────────────────

/**
 * Composes a clipboard-ready prompt for the IDE AI assistant.
 *
 * Format:
 * ```
 * Fix the {count} {category} violation(s) in `{filePath}`:
 * - {summary 1}
 * - {summary 2}
 * Use `flint_fix` with dry_run:true first to preview changes.
 * ```
 *
 * Returns an empty string when there are 0 violations — callers should check
 * for an empty return before showing any affordance.
 *
 * @example
 * composeHeraldPrompt({
 *   filePath: 'src/components/Header.tsx',
 *   violations: [
 *     { category: 'design-drift', summary: 'bg-blue-500 drifts from token brand.primary (Delta-E 4.2)', severity: 'critical' },
 *   ],
 * })
 * // => "Fix the 1 design drift violation in `src/components/Header.tsx`:\n- bg-blue-500...\nUse `flint_fix`..."
 */
export function composeHeraldPrompt(input: HeraldPromptInput): string {
    const { filePath, violations } = input

    if (violations.length === 0) return ''

    const count = violations.length
    const category = resolveCategoryLabel(violations)
    const singular = count === 1

    // "violation" vs "violations"
    const noun = singular ? 'violation' : 'violations'

    const header = `Fix the ${count} ${category} ${noun} in \`${filePath}\`:`

    const bullets = violations
        .map((v) => `- ${v.summary}`)
        .join('\n')

    const hint = 'Use `flint_fix` with dry_run:true first to preview changes.'

    return `${header}\n${bullets}\n${hint}`
}
