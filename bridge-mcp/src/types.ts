/**
 * Shared types for bridge-mcp — bridge-mcp/src/types.ts
 *
 * Re-exports the core type definitions used across the MCP server.
 * These mirror the renderer-side types in src/types/bridge-api.d.ts but are
 * standalone — no cross-boundary imports.
 */

// ── Token types ─────────────────────────────────────────────────────────────

export type TokenType =
    | 'color'
    | 'dimension'
    | 'fontFamily'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'shadow'
    | 'opacity'
    | 'string'
    | 'boolean'

export interface DesignToken {
    id: number
    token_path: string
    token_type: TokenType
    token_value: string
    description: string | null
    collection_name: string
    mode: string
}

// ── Linter types ────────────────────────────────────────────────────────────

export interface LinterWarning {
    id: string
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y'
    severity: 'amber' | 'critical'
    value: number
    message: string
    nearestToken: string | null
    nearestTokenValue: string | null
    /** Stable rule identifier for provenance lookup. Added by GOV.1. */
    ruleId?: string
    /** WCAG criterion, populated only for a11y warnings. */
    wcag?: string
    /** Whether an auto-fix is available for this warning. */
    fixable?: boolean
}

// ── SDI types ───────────────────────────────────────────────────────────────

export interface BridgeSDIPayload {
    name: string
    sourceId: string
    type: 'component' | 'page'
    appliedTokens: Record<string, any>
    layoutState: Record<string, any>
    children?: BridgeSDIPayload[]
}
