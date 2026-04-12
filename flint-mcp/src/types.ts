/**
 * Shared types for flint-mcp — flint-mcp/src/types.ts
 *
 * Re-exports the core type definitions used across the MCP server.
 * These mirror the renderer-side types in src/types/flint-api.d.ts but are
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
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y' | 'sync' | 'inline-style-drift' | 'registry' | 'tailwind-version-drift' | 'dark-mode-drift' | 'composition' | 'hydration'
    severity: 'amber' | 'critical' | 'advisory'
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
    /** Plain-language explanation of why this rule exists. Populated by CX.3 errorTaxonomy. */
    explanation?: string
    /** Actionable recovery steps. Populated by CX.3 errorTaxonomy. */
    recovery?: string
    /** Source line number (1-based) where the violation occurs. Populated by Phase 3. */
    line?: number
    /** Source column number (0-based) where the violation occurs. Populated by Phase 3. */
    column?: number
}

// ── Phase 1: Token Coverage types ────────────────────────────────────────────

/**
 * Reports how many design tokens of each category were loaded during an audit
 * and how many inline style props were inspected vs. skipped.
 * Attached to AuditResult.coverage to distinguish "checked and passed"
 * from "unchecked (no tokens of this category)".
 */
export interface TokenCoverage {
    /** How many color tokens were loaded. */
    colorTokens: number
    /** How many dimension tokens were loaded. */
    dimensionTokens: number
    /** How many shadow tokens were loaded. */
    shadowTokens: number
    /** How many fontWeight tokens were loaded. */
    fontWeightTokens: number
    /** How many style={} props were inspected by visitInlineStyles. */
    inlinePropsScanned: number
    /** How many style props were skipped (MemberExpression/dynamic refs). */
    inlinePropsSkipped: number
    /** How many inline style violations were found. */
    inlineViolations: number
}

// ── Phase ACX.2: Context Delta types ────────────────────────────────────────

/**
 * A delta event pushed to MCP clients when significant state changes occur
 * in Flint. Written to .flint/mcp-events.jsonl with type 'context-delta'.
 */
export interface ContextDelta {
    /** ISO 8601 timestamp. */
    timestamp: string
    /** The kind of state change that triggered the delta. */
    trigger: ContextDeltaTrigger
    /** The specific change payload — shape depends on trigger. */
    payload: ContextDeltaPayload
}

export type ContextDeltaTrigger =
    | 'file-switched'
    | 'figma-import-completed'
    | 'violations-changed'
    | 'export-gate-changed'
    | 'tokens-updated'
    | 'health-score-changed'

/**
 * Discriminated union of delta payloads. Each trigger maps to a specific
 * payload shape.
 */
export type ContextDeltaPayload =
    | FileSwitchedPayload
    | FigmaImportPayload
    | ViolationsChangedPayload
    | ExportGatePayload
    | TokensUpdatedPayload
    | HealthScorePayload

export interface FileSwitchedPayload {
    trigger: 'file-switched'
    /** New active file path. */
    filePath: string
}

export interface FigmaImportPayload {
    trigger: 'figma-import-completed'
    /** Updated token count. */
    newTokenCount: number
}

export interface ViolationsChangedPayload {
    trigger: 'violations-changed'
    /** File that changed. */
    filePath: string
    /** Number of new violations since last push. */
    added: number
    /** Number of resolved violations since last push. */
    resolved: number
    /** Current total. */
    currentTotal: number
}

export interface ExportGatePayload {
    trigger: 'export-gate-changed'
    /** New export gate status. */
    blocked: boolean
    /** Reason for the block, or null if clear. */
    reason: string | null
}

export interface TokensUpdatedPayload {
    trigger: 'tokens-updated'
    /** New total token count (0 if unknown). */
    newTotal: number
}

export interface HealthScorePayload {
    trigger: 'health-score-changed'
    /** Previous grade. */
    previousGrade: string
    /** New grade. */
    newGrade: string
}

// ── SDI types ───────────────────────────────────────────────────────────────

export interface FlintSDIPayload {
    name: string
    sourceId: string
    type: 'component' | 'page'
    appliedTokens: Record<string, any>
    layoutState: Record<string, any>
    children?: FlintSDIPayload[]
}

// ── Session Context types (Phase ACX.1) ──────────────────────────────────────

/**
 * Governance domain preset identifier.
 * Matches the domain presets in flint-mcp/src/prompts/sentinel.ts.
 */
export type GovernanceDomain =
    | 'general'
    | 'healthcare'
    | 'fintech'
    | 'e-commerce'
    | 'government'
    | 'enterprise-saas'

export interface ViolationSummary {
    /** Total mithril (design drift) violations */
    mithrilCount: number
    /** Total accessibility violations */
    a11yCount: number
    /** Count of amber-severity violations */
    amberCount: number
    /** Count of critical-severity violations */
    criticalCount: number
    /** Node IDs with violations, up to 20 */
    affectedNodeIds: string[]
    /** Whether any violation has an available auto-fix */
    hasFixableViolations: boolean
}

export interface TokenSummary {
    /** Total number of tokens */
    totalCount: number
    /** Count of tokens by type (e.g. { color: 12, dimension: 8 }) */
    byType: Record<string, number>
    /** First 20 tokens (token_path + token_value) */
    top20: Array<{ path: string; value: string; type: string }>
}

export interface MutationEntry {
    batchId: string
    timestamp: string
    tool: string
    filePath: string
    mutationCount: number
    outcome: string
}

export interface CanvasState {
    /** Currently active file in Flint Glass */
    activeFile: string | null
    /** Currently selected node ID */
    selectedNodeId: string | null
    /** Current canvas mode */
    canvasMode: 'design' | 'interact' | null
    /** Whether Figma connection is active */
    figmaConnected: boolean
    /** Current save state */
    saveState: 'saved' | 'unsaved' | 'saving' | null
}

export interface SessionContext {
    /** ISO timestamp of when this context was assembled */
    assembledAt: string
    /** Active project root */
    projectRoot: string
    /** Canvas/editor state from context.json */
    canvas: CanvasState
    /** First 200 lines of the active file source */
    activeFileSource: string | null
    /** Active file path */
    activeFilePath: string | null
    /** Violation summary from most recent linter pass stored in context.json */
    violations: ViolationSummary
    /** Token set summary */
    tokens: TokenSummary
    /** Last 5 mutation entries from mcp-events.jsonl */
    recentMutations: MutationEntry[]
    /** Current health score (0-100) */
    healthScore: number | null
    /** Current health grade (A-F) */
    healthGrade: string | null
    /** Whether all source files were readable */
    partial: boolean
    /** Session summary from last session (Strategy 4: Context-First Briefing) */
    sessionSummary: SessionSummary | null
    /** Persona inferred from user's first message (Strategy 2: Persona Handshake) */
    sessionPersona: SessionPersona
    /** Resolved style guide content from content.style_guide in flint.config.yaml, or null */
    styleGuide?: string | null
    /**
     * Present only when partial=true and context.json is missing (no Glass session).
     * Provides actionable guidance for headless governance without Glass.
     */
    coldStartHint?: string
    /** Plain-English next step based on current project state */
    nextStep?: string
    /** Contextually suggested MCP tools based on project state */
    suggestedTools?: Array<{ tool: string; reason: string }>
}

// ── Phase ACX: ComplexityAssessment ─────────────────────────────────────────

export type ModelTier = 'fast' | 'balanced' | 'powerful'

export interface ComplexityFactor {
    /** Factor name (e.g. "nodeCount", "crossFileScope"). */
    name: string
    /** Weight of this factor in the scoring (0-100 scale). */
    weight: number
    /** The raw measured value for this factor. */
    value: number | string
    /** Human-readable description. */
    description: string
    /** Score contribution from this factor (weight * rawScore / 100). */
    contribution: number
}

export interface ComplexityAssessment {
    /** Recommended model tier. */
    recommendedTier: ModelTier
    /** Numerical complexity score (0-100). */
    score: number
    /** Human-readable explanation. */
    rationale: string
    /** Factors that contributed to the score. */
    factors: ComplexityFactor[]
}

export interface ComplexityInput {
    /** Natural language task description. */
    taskDescription: string
    /** Estimated number of AST nodes that will be affected. */
    estimatedNodeCount?: number
    /** Whether the task spans multiple source files. */
    crossFile?: boolean
    /** File paths involved. */
    filePaths?: string[]
    /** Mutation types that will be used. */
    mutationTypes?: string[]
}

// ── Phase ACX: ToolEnrichment types ─────────────────────────────────────────

export interface ToolEnrichment {
    toolName: string
    contextPreamble: string
    data: Record<string, unknown>
}

// ── Phase ACX: DomainRuleSet types ───────────────────────────────────────────

export interface DomainRuleSet {
    domainId: string
    displayName: string
    standards: ComplianceStandard[]
    rules: DomainRule[]
    keywords: string[]
}

export interface ComplianceStandard {
    id: string
    name: string
    referenceUrl: string
}

export interface DomainRule {
    id: string
    statement: string
    severity: 'critical' | 'warning' | 'info'
    category: string
}

// ── Phase IDO.4: Session Summary types ────────────────────────────────────

/**
 * Summary of the previous session's activity.
 * Populated by `assembleSessionContext` from the mutations ledger
 * and the `deferred_violations` table. Used by the Context-First
 * Briefing (Strategy 4) and Breadcrumb Trail (Strategy 7).
 */
export interface SessionSummary {
    /** ISO date of the last session */
    lastSessionDate: string | null
    /** Files that had violations fixed in the last session */
    fixedFiles: string[]
    /** Total violations fixed last session */
    fixedViolationCount: number
    /** Violations still open from the last session */
    openFromLastSession: Array<{
        file: string
        ruleId: string
        description: string
    }>
    /** Violations the user explicitly deferred */
    deferredViolations: Array<{
        file: string
        ruleId: string
        nodeId: string | null
        reason: string | null
        deferredAt: string
    }>
}

/**
 * Persona type for the session — inferred from the user's first message
 * (Strategy 2: Persona Handshake). Written to context.json by Glass.
 */
export type SessionPersona = 'designer' | 'developer' | null

// ── Phase CX.1: Response Quality Baseline ────────────────────────────────────

export type { ResponseMeta, SourceAuthority, EnrichedToolResult } from './core/responseMeta.js'
