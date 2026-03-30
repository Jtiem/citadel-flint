/**
 * toolSuggester.ts — Pure function that selects contextually relevant MCP tools.
 *
 * Sprint: CLARITY-2, Item 5 — Progressive MCP Tool Surfacing
 *
 * No side effects, no imports beyond types.
 */

export interface ToolSuggestion {
    tool: string
    reason: string
}

export const MAX_SUGGESTED_TOOLS = 5

export function suggestTools(context: {
    tokenCount: number
    mithrilCount: number
    a11yCount: number
    healthScore: number | null
    figmaConnected: boolean
    hasManifest: boolean
}): ToolSuggestion[] {
    const suggestions: ToolSuggestion[] = []

    if (context.tokenCount === 0) {
        suggestions.push({ tool: 'flint_extract_tokens', reason: 'Start by extracting design tokens' })
    }

    if (!context.hasManifest) {
        suggestions.push({ tool: 'flint_reindex_registry', reason: 'Seed the component registry' })
    }

    if (context.mithrilCount > 0) {
        suggestions.push({ tool: 'flint_fix', reason: `Auto-fix ${context.mithrilCount} color drift${context.mithrilCount !== 1 ? 's' : ''}` })
    }

    if (context.a11yCount > 0) {
        suggestions.push({ tool: 'flint_accessibility_report', reason: `Review ${context.a11yCount} accessibility gap${context.a11yCount !== 1 ? 's' : ''}` })
    }

    if (context.healthScore !== null && context.healthScore < 70) {
        suggestions.push({ tool: 'flint_debt_report', reason: 'See your full health breakdown' })
    }

    if (!context.figmaConnected) {
        suggestions.push({ tool: 'flint_figma_connect', reason: 'Connect Figma for token sync' })
    }

    // If nothing else triggered, suggest a general audit
    if (suggestions.length === 0) {
        suggestions.push({ tool: 'flint_audit', reason: 'Verify ongoing compliance' })
    }

    return suggestions.slice(0, MAX_SUGGESTED_TOOLS)
}
