# Contract Artifact: Phase ACX -- Proactive Agent Context System

**Version:** 1.0
**Date:** 2026-03-15
**Status:** CONTRACT -- Binding specification for Phase 2 agents
**Depends on:** Phase W.1 (MCP Push Channel) ONLINE, Phase W.3 (Bidirectional Action Flint) ONLINE, Phase 1A (Context Flint) ONLINE, EXP.2 (Design Debt Report) ONLINE

---

## 0. Problem Statement

An AI agent connecting to Flint MCP today must make 3-4 sequential tool calls (`flint_read_code`, `flint_read_tokens`, `flint_audit_mithril`, `flint_audit_a11y`) before performing any useful work. This costs approximately 2,000-4,000 tokens per session bootstrap, adds 3-8 seconds of latency, and means every agent session starts cold with no awareness of the user's current activity.

Phase ACX eliminates this by:
1. Assembling a rich session context as a single MCP resource read
2. Pushing context deltas when significant state changes occur
3. Pre-injecting tool-specific context into mutation calls
4. Routing tasks to the right model tier based on complexity analysis
5. Implementing the domain-configurable sentinel prompt

---

## 1. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `flint-mcp/src/core/sessionContext.ts` | NEW | `flint-ast-surgeon` | Core assembly logic: reads context.json, tokens, violations, debt, mutations |
| `flint-mcp/src/core/contextPush.ts` | NEW | `flint-ast-surgeon` | Event-driven delta computation + JSONL emission |
| `flint-mcp/src/core/complexityRouter.ts` | NEW | `flint-ast-surgeon` | Task complexity analysis + model tier recommendation |
| `flint-mcp/src/core/toolEnricher.ts` | NEW | `flint-ast-surgeon` | Pre-flight context injection for mutation tools |
| `flint-mcp/src/prompts/sentinel.ts` | NEW | `flint-ast-surgeon` | Domain-configurable governance sentinel prompt |
| `flint-mcp/src/domains/fintech.ts` | NEW | `flint-ast-surgeon` | Fintech domain rules (PCI-DSS) |
| `flint-mcp/src/domains/healthcare.ts` | NEW | `flint-ast-surgeon` | Healthcare domain rules (HIPAA) |
| `flint-mcp/src/domains/ecommerce.ts` | NEW | `flint-ast-surgeon` | E-commerce domain rules |
| `flint-mcp/src/domains/index.ts` | MODIFY | `flint-ast-surgeon` | Register new domains |
| `flint-mcp/src/server.ts` | MODIFY | `flint-ast-surgeon` | Register new resource, tool enrichment intercept, context push wiring |
| `flint-mcp/src/core/events.ts` | MODIFY | `flint-ast-surgeon` | Add new event types for context push |
| `flint-mcp/src/core/capabilities/index.ts` | MODIFY | `flint-ast-surgeon` | Add `flint://session-context` to catalog, add `flint_get_context` tool |
| `flint-mcp/src/types.ts` | MODIFY | `flint-ast-surgeon` | Add SessionContext, ContextDelta, ComplexityAssessment types |
| `src/hooks/useContextSync.ts` | MODIFY | `flint-state-architect` | Extend FlintContext with source excerpt + structured violations |
| `src/types/flint-api.d.ts` | MODIFY | `flint-state-architect` | Extend FlintContext type with new fields |
| `electron/main.ts` | MODIFY | `flint-electron-ipc` | Add `context:get-enriched` IPC for Glass-side enriched context reads |
| `electron/preload.ts` | MODIFY | `flint-electron-ipc` | Expose `context.getEnriched()` on flintAPI |
| `flint-mcp/src/__tests__/sessionContext.test.ts` | NEW | `flint-test-writer` | ACX-01 through ACX-08 |
| `flint-mcp/src/__tests__/contextPush.test.ts` | NEW | `flint-test-writer` | ACX-09 through ACX-12 |
| `flint-mcp/src/__tests__/complexityRouter.test.ts` | NEW | `flint-test-writer` | ACX-13 through ACX-17 |
| `flint-mcp/src/__tests__/toolEnricher.test.ts` | NEW | `flint-test-writer` | ACX-18 through ACX-22 |
| `flint-mcp/src/__tests__/sentinel.test.ts` | NEW | `flint-test-writer` | ACX-23 through ACX-26 |

---

## 2. Type Contracts

### 2.1 SessionContext (new, in `flint-mcp/src/types.ts`)

This is the primary payload for `flint://session-context`. It is the rich, pre-assembled snapshot that eliminates the 3-4 cold-start tool calls.

```typescript
// ── Phase ACX: Proactive Agent Context System ─────────────────────────────

/**
 * Rich session context snapshot assembled by the MCP server.
 * Returned by `flint://session-context` resource and the
 * `flint_get_context` tool. Eliminates cold-start round-trips.
 *
 * Assembly budget: < 100ms total.
 */
export interface SessionContext {
    /** Schema version for forward compatibility. */
    schemaVersion: '1.0.0'

    /** ISO 8601 UTC timestamp of assembly. */
    assembledAt: string

    /** Absolute path to the project root (.flint directory parent). */
    projectRoot: string

    // ── Active File Context ──────────────────────────────────────────────
    activeFile: ActiveFileContext | null

    // ── Violations ───────────────────────────────────────────────────────
    violations: ViolationSnapshot

    // ── Design Tokens ────────────────────────────────────────────────────
    tokens: TokenSnapshot

    // ── Recent Mutations ─────────────────────────────────────────────────
    recentMutations: MutationEntry[]

    // ── Canvas State ─────────────────────────────────────────────────────
    canvas: CanvasSnapshot

    // ── Health ───────────────────────────────────────────────────────────
    health: HealthSnapshot

    // ── Import State ─────────────────────────────────────────────────────
    lastImport: ImportSnapshot | null

    // ── Complexity Assessment ────────────────────────────────────────────
    complexity: ComplexityAssessment | null
}

/**
 * Active file context: path, source excerpt, and node-level detail.
 */
export interface ActiveFileContext {
    /** Absolute path to the currently open file. */
    filePath: string
    /** First 200 lines of the source code (UTF-8). */
    sourceExcerpt: string
    /** Total line count of the file. */
    totalLines: number
    /** data-flint-id of the currently selected node, or null. */
    selectedNodeId: string | null
    /** If a node is selected, its tag name and props summary. */
    selectedNodeSummary: NodeSummary | null
}

/**
 * Minimal node descriptor -- enough for an agent to understand
 * what is selected without reading the full AST.
 */
export interface NodeSummary {
    /** JSX tag name (e.g. "div", "Button", "Card"). */
    tagName: string
    /** data-flint-id. */
    flintId: string
    /** Current className string, or null if none. */
    className: string | null
    /** Props as key-value pairs (values truncated to 80 chars). */
    props: Record<string, string>
    /** Number of direct JSX children. */
    childCount: number
    /** data-flint-id of the parent element, or null if root. */
    parentId: string | null
}

/**
 * Snapshot of current violations across all audited dimensions.
 */
export interface ViolationSnapshot {
    /** Total violation count. */
    total: number
    /** Breakdown by category. */
    mithril: ViolationDetail[]
    a11y: ViolationDetail[]
    /** Count of critical-severity violations. */
    criticalCount: number
    /** Whether export is currently blocked. */
    exportBlocked: boolean
    /** Reason export is blocked, or null. */
    exportBlockReason: string | null
}

/**
 * A single violation with enough detail for an agent to understand
 * and potentially fix it without a separate audit call.
 */
export interface ViolationDetail {
    /** data-flint-id of the affected element. */
    nodeId: string
    /** Stable rule identifier (e.g. "MITHRIL-COL", "A11Y-001"). */
    ruleId: string
    /** Severity level. */
    severity: 'amber' | 'critical'
    /** Human-readable description. */
    message: string
    /** The drifted value (e.g. deltaE number, or description). */
    value: number
    /** Nearest design token, if applicable. */
    nearestToken: string | null
    /** Whether an auto-fix is available. */
    fixable: boolean
}

/**
 * Design token summary -- not the full token set, but enough
 * to understand the token vocabulary without reading flint://tokens.
 */
export interface TokenSnapshot {
    /** Total token count across all collections. */
    totalCount: number
    /** Breakdown by token type. */
    byType: Record<string, number>
    /** The 20 most-used tokens (by reference count in audited files). */
    mostUsed: TokenUsage[]
    /** Collection names present in the token set. */
    collections: string[]
}

/**
 * A frequently-used token with its reference count.
 */
export interface TokenUsage {
    tokenPath: string
    tokenType: string
    tokenValue: string
    /** Number of files referencing this token. */
    referenceCount: number
}

/**
 * A recent mutation from the mutation ledger.
 */
export interface MutationEntry {
    /** ISO 8601 timestamp. */
    timestamp: string
    /** Mutation type (e.g. "updateProp", "move", "fixToken"). */
    mutationType: string
    /** Target file path. */
    filePath: string
    /** Target node flint ID. */
    nodeId: string | null
    /** Human-readable summary. */
    summary: string
    /** Agent or user who triggered the mutation. */
    actor: 'user' | 'agent' | 'auto-fix'
}

/**
 * Canvas state readable by the agent.
 */
export interface CanvasSnapshot {
    /** Current mode: 'design' or 'interact'. */
    mode: 'design' | 'interact'
    /** Save state: 'saved' | 'unsaved' | 'saving' | 'error'. */
    saveState: string
    /** data-flint-id of selected node, or null. */
    selectedNodeId: string | null
    /** Cursor position in source, if available. */
    cursorPosition: { line: number; column: number } | null
}

/**
 * Health metrics from the debt report.
 */
export interface HealthSnapshot {
    /** 0-100 score. */
    score: number
    /** Letter grade. */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Total violations across the project. */
    totalViolations: number
    /** Violation counts by severity. */
    bySeverity: { critical: number; warning: number; info: number }
    /** Top 5 most violated rules. */
    topRules: Array<{ ruleId: string; count: number }>
}

/**
 * Summary of the most recent Figma import, if one occurred
 * in this session. Helps agents understand the import context.
 */
export interface ImportSnapshot {
    /** ISO 8601 timestamp of the import. */
    importedAt: string
    /** Number of tokens imported. */
    tokenCount: number
    /** Number of components imported. */
    componentCount: number
    /** Whether the import included a heal pass. */
    healed: boolean
    /** Number of auto-healed violations (tier-1). */
    tier1FixCount: number
    /** Number of flagged near-matches (tier-2). */
    tier2FlagCount: number
}
```

### 2.2 ContextDelta (event-driven push updates)

```typescript
/**
 * A delta event pushed to MCP clients when significant
 * state changes occur in Flint.
 *
 * Written to .flint/mcp-events.jsonl using the existing
 * MCPEvent infrastructure (Phase W.1). The `type` field is
 * 'context-delta' to distinguish from existing event types.
 */
export interface ContextDelta {
    /** ISO 8601 timestamp. */
    timestamp: string
    /** The kind of state change that triggered the delta. */
    trigger: ContextDeltaTrigger
    /** The specific change payload -- shape depends on trigger. */
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
 * Discriminated union of delta payloads. Each trigger maps to
 * a specific payload shape.
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
    /** First 200 lines of the new file. */
    sourceExcerpt: string
    /** Violations for the new file. */
    violations: ViolationDetail[]
}

export interface FigmaImportPayload {
    trigger: 'figma-import-completed'
    /** Import summary. */
    import: ImportSnapshot
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
    /** New violations (full detail). */
    newViolations: ViolationDetail[]
}

export interface ExportGatePayload {
    trigger: 'export-gate-changed'
    /** New export gate status. */
    blocked: boolean
    /** Reason for the block, or null if clear. */
    reason: string | null
    /** Blocking violation count by category. */
    blockingCounts: { mithril: number; a11y: number; overrides: number }
}

export interface TokensUpdatedPayload {
    trigger: 'tokens-updated'
    /** Number of tokens added. */
    added: number
    /** Number of tokens modified. */
    modified: number
    /** Number of tokens removed. */
    removed: number
    /** New total token count. */
    newTotal: number
}

export interface HealthScorePayload {
    trigger: 'health-score-changed'
    /** Previous score. */
    previousScore: number
    /** New score. */
    newScore: number
    /** Previous grade. */
    previousGrade: string
    /** New grade. */
    newGrade: string
}
```

### 2.3 ComplexityAssessment (Commandment 8 -- Model Routing)

```typescript
/**
 * Result of the complexity analysis for a given task.
 * Used by the IDE to select the appropriate model tier
 * and by agents to understand the scope of work.
 *
 * Commandment 8: Audit-First Execution.
 */
export interface ComplexityAssessment {
    /** Recommended model tier. */
    recommendedTier: ModelTier
    /** Numerical complexity score (0-100). */
    score: number
    /** Human-readable explanation of the assessment. */
    rationale: string
    /** Factors that contributed to the score. */
    factors: ComplexityFactor[]
}

export type ModelTier = 'fast' | 'balanced' | 'powerful'

export interface ComplexityFactor {
    /** Factor name (e.g. "nodeCount", "crossFileScope", "tokenVocabulary"). */
    name: string
    /** Contribution to the total score (0-100 scale). */
    weight: number
    /** The measured value for this factor. */
    value: number | string
    /** Human-readable description. */
    description: string
}

/**
 * Input to the complexity router. Describes the task
 * the agent is about to perform.
 */
export interface ComplexityInput {
    /** Natural language task description. */
    taskDescription: string
    /** Number of nodes that will be affected (if known). */
    estimatedNodeCount?: number
    /** Whether the task spans multiple files. */
    crossFile?: boolean
    /** File paths involved. */
    filePaths?: string[]
    /** Mutation types that will be used. */
    mutationTypes?: string[]
}
```

### 2.4 ToolEnrichment (per-tool context injection)

```typescript
/**
 * Pre-flight context injected into specific tool calls.
 * The enricher intercepts tool execution and prepends
 * relevant context to the tool's input.
 */
export interface ToolEnrichment {
    /** The tool name this enrichment applies to. */
    toolName: string
    /** Context injected as a preamble to the tool result. */
    contextPreamble: string
    /** Structured data available alongside the preamble. */
    data: Record<string, unknown>
}

/**
 * Context for flint_ast_mutate: target node details.
 */
export interface MutateEnrichment {
    /** Target node's current props. */
    nodeProps: Record<string, string>
    /** Target node's current className. */
    nodeClassName: string | null
    /** Target node's parent tag + flint ID. */
    parentContext: { tagName: string; flintId: string } | null
    /** Sibling node IDs for position context. */
    siblingIds: string[]
    /** Active violations on this node. */
    nodeViolations: ViolationDetail[]
}

/**
 * Context for flint_fix: violation details + suggested fix.
 */
export interface FixEnrichment {
    /** The specific violations being fixed. */
    violations: ViolationDetail[]
    /** Suggested fix operations (from auto-fix engine). */
    suggestedOps: Array<{
        nodeId: string
        currentClass: string
        suggestedClass: string
        confidence: 'high' | 'medium'
    }>
}

/**
 * Context for flint_insert_node: insertion environment.
 */
export interface InsertEnrichment {
    /** Sibling nodes at the insertion point. */
    siblings: NodeSummary[]
    /** Parent node summary. */
    parent: NodeSummary | null
    /** Design tokens relevant to the element type being inserted. */
    relevantTokens: Array<{ tokenPath: string; tokenValue: string; tokenType: string }>
}
```

### 2.5 SentinelPrompt Types

```typescript
/**
 * Domain-specific rule set for the flint-sentinel prompt.
 * Each domain adds rules on top of the base governance rules.
 */
export interface DomainRuleSet {
    /** Domain identifier (e.g. "healthcare", "fintech", "ecommerce"). */
    domainId: string
    /** Display name. */
    displayName: string
    /** Domain-specific compliance standards. */
    standards: ComplianceStandard[]
    /** Additional rules injected into the sentinel prompt. */
    rules: DomainRule[]
    /** Keywords that trigger this domain in auto-detection. */
    keywords: string[]
}

export interface ComplianceStandard {
    /** Standard identifier (e.g. "HIPAA", "PCI-DSS", "WCAG-2.1-AA"). */
    id: string
    /** Full name. */
    name: string
    /** URL to the standard's documentation. */
    referenceUrl: string
}

export interface DomainRule {
    /** Unique rule ID within the domain (e.g. "FIN-001"). */
    id: string
    /** Human-readable rule statement. */
    statement: string
    /** Severity: how should violations be treated. */
    severity: 'critical' | 'warning' | 'info'
    /** Category within the domain (e.g. "data-masking", "audit-trail"). */
    category: string
}
```

---

## 3. MCP Resources

### 3.1 New Resource: `flint://session-context`

| Property | Value |
|----------|-------|
| URI | `flint://session-context` |
| MIME type | `application/json` |
| Payload | `SessionContext` (Section 2.1) |
| Update trigger | Fires `notifications/resources/list_changed` on file switch, violation change, token update |
| Assembly budget | < 100ms |

**Assembly Strategy:**

The `SessionContext` is assembled from 6 data sources, 4 of which are filesystem reads and 2 are in-memory:

1. `.flint/context.json` -- written by Glass `useContextSync` hook (activeFile, selectedNode, canvasMode, saveState, violation counts)
2. `.flint/design-tokens.json` -- token count, type breakdown, collection list
3. Active file source -- `fs.readFileSync(activeFilePath)` first 200 lines
4. `.flint/debt-history.json` -- latest entry for health score/grade
5. MithrilLinter + A11yLinter -- run audit on active file source (cached; only re-run when file changes)
6. Mutation ledger -- last 5 entries from SQLite via `mutationLedgerService`

**Caching:** The context is cached in memory with a 500ms TTL. Reads within the TTL return the cached value. Cache is invalidated on `TOKENS_UPDATED`, `INTENT_UPDATED`, and file-change filesystem events.

### 3.2 New Resource: `flint://complexity`

| Property | Value |
|----------|-------|
| URI | `flint://complexity?task={description}` |
| MIME type | `application/json` |
| Payload | `ComplexityAssessment` (Section 2.3) |
| Query param | `task` -- URL-encoded task description |

This resource runs the complexity router on demand, returning a model tier recommendation.

### 3.3 Modified Resource: `flint://capabilities`

Add `flint://session-context` and `flint://complexity` to the resources catalog in `flint-mcp/src/core/capabilities/index.ts`.

---

## 4. MCP Tools

### 4.1 New Tool: `flint_get_context`

Currently listed in the capabilities catalog but NOT implemented. This phase implements it.

```typescript
{
    name: "flint_get_context",
    description: "Returns the full Flint session context -- active file, violations, tokens, mutations, health, and canvas state. Call this FIRST at the start of any session to eliminate cold-start round-trips.",
    inputSchema: {
        type: "object",
        properties: {
            projectRoot: {
                type: "string",
                description: "Absolute path to the project root (must contain a .flint directory)."
            },
            includeSource: {
                type: "boolean",
                description: "Whether to include the first 200 lines of the active file source. Default true."
            },
            includeViolationDetails: {
                type: "boolean",
                description: "Whether to include full violation details (nodeId, message, fixable). Default true."
            }
        },
        required: ["projectRoot"]
    }
}
```

Returns: `SessionContext` (same payload as `flint://session-context` resource).

### 4.2 New Tool: `flint_assess_complexity`

```typescript
{
    name: "flint_assess_complexity",
    description: "Analyze the complexity of a proposed task and recommend the appropriate AI model tier (fast/balanced/powerful). Use this before starting complex multi-step workflows to ensure the right model is selected.",
    inputSchema: {
        type: "object",
        properties: {
            taskDescription: {
                type: "string",
                description: "Natural language description of the task to assess."
            },
            estimatedNodeCount: {
                type: "number",
                description: "Estimated number of AST nodes that will be affected."
            },
            crossFile: {
                type: "boolean",
                description: "Whether the task spans multiple source files."
            },
            filePaths: {
                type: "array",
                items: { type: "string" },
                description: "Absolute paths to files involved in the task."
            }
        },
        required: ["taskDescription"]
    }
}
```

Returns: `ComplexityAssessment`.

### 4.3 Modified Tools (enrichment intercept)

The following existing tools gain automatic context enrichment. No schema changes -- the enrichment is injected into the tool result as a `contextPreamble` field in the returned content:

| Tool | Enrichment Type | What is injected |
|------|----------------|-----------------|
| `flint_ast_mutate` | `MutateEnrichment` | Target node props, className, parent context, sibling IDs, active violations |
| `flint_fix` | `FixEnrichment` | Violation details for the target file, suggested fix ops |
| `flint_insert_node` (via `flint_ast_mutate`) | `InsertEnrichment` | Sibling nodes, parent summary, relevant design tokens |

The enrichment is prepended to the tool's response content as a separate `text` content block with `type: "text"` and a clear `--- Context Preamble ---` header.

---

## 5. IPC Channels

### 5.1 New IPC Channel: `context:get-enriched`

This channel allows Glass to request an enriched context snapshot from the main process, which in turn queries the MCP server. Used for debugging and for the Context Flint to write richer data.

| Property | Value |
|----------|-------|
| Channel | `context:get-enriched` |
| Direction | renderer -> main |
| Payload | `{ projectRoot: string }` |
| Return | `Promise<SessionContext>` |

### 5.2 Extended IPC Push: `flint:context-delta`

Extends the existing MCP event push channel. Context deltas are emitted as MCPEvents with `type: 'context-delta'` and the `ContextDelta` payload serialized in the `summary` field.

| Property | Value |
|----------|-------|
| Channel | `flint:mcp-event` (existing) |
| Direction | MCP server -> .flint/mcp-events.jsonl -> main (fs.watch) -> renderer |
| New event type | `'context-delta'` added to `MCPEventType` union |

No new IPC channels required for push -- reuses the Phase W.1 `mcp-events.jsonl` infrastructure.

---

## 6. Store Contracts

No new Zustand stores are needed. The ACX phase lives entirely in the MCP server process and the Electron main process.

### 6.1 Extended: useContextSync (renderer hook)

The existing `useContextSync` hook is extended to write richer data to `.flint/context.json`. Specifically, the `FlintContext` type gains:

```typescript
// Added to existing FlintContext in src/types/flint-api.d.ts
export interface FlintContext {
    // ... existing fields ...

    /** Phase ACX: First 200 lines of the active file source.
     *  Populated only when activeFile is non-null. */
    sourceExcerpt?: string

    /** Phase ACX: Structured violation list with node IDs and rule IDs.
     *  Supplements the existing violation counts. */
    violationDetails?: Array<{
        nodeId: string
        ruleId: string
        severity: 'amber' | 'critical'
        message: string
        fixable: boolean
    }>

    /** Phase ACX: Export gate status. */
    exportBlocked?: boolean
    exportBlockReason?: string | null
}
```

**Anti-pattern guard:** The `useContextSync` hook reads from Zustand stores only. It does NOT call `window.flintAPI` -- it only writes via the existing `syncContext` call. The source excerpt read happens in the main process when assembling SessionContext, NOT in the renderer.

**IMPORTANT REVISION:** On review, injecting `sourceExcerpt` into the renderer-side FlintContext would require the renderer to read file contents, which violates the process boundary. Instead, the MCP server reads the source file directly when assembling SessionContext. The renderer-side FlintContext extensions are limited to `violationDetails`, `exportBlocked`, and `exportBlockReason` -- all of which are already available in renderer stores.

---

## 7. Component Contracts

No new UI components. Phase ACX is a backend/MCP concern. Glass already displays health scores, violations, and canvas state through existing components. The only visible change is that the StatusBar may eventually display the recommended model tier, but that is a Phase ACX.2 concern.

---

## 8. File-Level Implementation Detail

### 8.1 sessionContext.ts -- Assembly Logic

**Location:** `flint-mcp/src/core/sessionContext.ts`

```typescript
/**
 * assembleSessionContext(projectRoot: string): SessionContext
 *
 * Reads 6 data sources and assembles a SessionContext snapshot.
 * Performance budget: < 100ms.
 *
 * Data source read order (parallelized where possible):
 *   1. .flint/context.json          -- fs.readFileSync (< 1ms)
 *   2. .flint/design-tokens.json    -- fs.readFileSync (< 5ms)
 *   3. Active file source            -- fs.readFileSync first 200 lines (< 2ms)
 *   4. .flint/debt-history.json     -- fs.readFileSync last entry (< 1ms)
 *   5. MithrilLinter + A11yLinter    -- cached audit result (< 50ms cold, 0ms warm)
 *   6. Mutation ledger               -- SQLite query last 5 rows (< 5ms)
 *
 * Caching: Entire SessionContext cached with 500ms TTL.
 * Cache key: hash of (activeFilePath + tokenFileModTime + contextFileModTime).
 */
```

**Process boundary:** This module runs in the MCP server child process. It reads `.flint/` files directly via `fs` (allowed -- MCP server is a separate Node.js process, not the Electron main or renderer). For the mutation ledger, it reads from the `.flint/mutations.db` SQLite file (if managed by the MCP server) or from the `.flint/mcp-events.jsonl` file.

**Critical design decision:** The MCP server does NOT have access to the Electron main process SQLite (`flint.db`). Mutation history must be sourced from either:
- Option A: The `mcp-events.jsonl` file (already written by `appendMCPEvent`)
- Option B: A dedicated `.flint/mutations.json` ledger file written by the MCP server

Decision: **Option A.** Parse the last N lines of `mcp-events.jsonl` where `type === 'mutation'`. This reuses existing infrastructure.

### 8.2 contextPush.ts -- Event-Driven Deltas

**Location:** `flint-mcp/src/core/contextPush.ts`

```typescript
/**
 * ContextPushManager
 *
 * Listens for state changes via the flintEvents emitter and
 * fs.watch on key .flint/ files. When a significant change is
 * detected, computes a ContextDelta and writes it to mcp-events.jsonl
 * with type 'context-delta'.
 *
 * Watches:
 *   - .flint/context.json       -- file switch, selection change
 *   - .flint/design-tokens.json -- token CRUD
 *   - .flint/debt-history.json  -- health score changes
 *
 * Debounce: 300ms per watched file to avoid flooding.
 *
 * Delta computation:
 *   - Stores the previous state in memory
 *   - On change: reads new state, diffs against previous
 *   - If diff is significant (file switched, violation count changed by >= 1,
 *     export gate toggled, health grade changed), emits a ContextDelta
 *   - Insignificant changes (cursor moved, same file re-saved) are suppressed
 */
```

**Significance thresholds:**
- `file-switched`: always emitted when `activeFile` changes
- `violations-changed`: emitted when violation count changes by >= 1
- `export-gate-changed`: emitted when `exportBlocked` toggles
- `tokens-updated`: emitted on any token file modification
- `health-score-changed`: emitted when grade letter changes (not on score jitter)
- `figma-import-completed`: emitted when the ingestion server fires `TOKENS_UPDATED`

### 8.3 complexityRouter.ts -- Model Tier Routing

**Location:** `flint-mcp/src/core/complexityRouter.ts`

```typescript
/**
 * assessComplexity(input: ComplexityInput, ctx: SessionContext): ComplexityAssessment
 *
 * Scoring factors (weights sum to 100):
 *
 *   nodeCount     (weight 25): 1-5 nodes = 0, 6-20 = 30, 21-50 = 60, 50+ = 100
 *   crossFile     (weight 20): false = 0, true = 100
 *   violationLoad (weight 15): 0 violations = 0, 1-5 = 20, 6-20 = 50, 20+ = 100
 *   tokenVocab    (weight 15): < 10 tokens = 0, 10-50 = 30, 50-200 = 60, 200+ = 100
 *   mutationTypes (weight 15): 1 type = 0, 2-3 = 40, 4+ = 100
 *   fileSize      (weight 10): < 100 lines = 0, 100-500 = 30, 500+ = 100
 *
 * Tier mapping:
 *   score 0-30   -> 'fast'     (Haiku-class: atomic edits, single prop changes)
 *   score 31-65  -> 'balanced' (Sonnet-class: compound mutations, moderate scope)
 *   score 66-100 -> 'powerful' (Opus-class: architectural refactors, cross-file moves)
 *
 * The router is purely deterministic -- no AI calls. It uses the
 * SessionContext to derive factor values from live project state.
 */
```

### 8.4 toolEnricher.ts -- Pre-flight Context Injection

**Location:** `flint-mcp/src/core/toolEnricher.ts`

```typescript
/**
 * enrichToolCall(toolName: string, args: Record<string, unknown>, ctx: SessionContext): ToolEnrichment | null
 *
 * Checks if the tool is enrichment-eligible. If so, assembles
 * the appropriate enrichment payload by reading the SessionContext
 * and (for mutation tools) parsing the active file's AST to extract
 * node-specific context.
 *
 * Returns null for tools that don't need enrichment.
 *
 * Enrichment-eligible tools:
 *   - flint_ast_mutate -> MutateEnrichment
 *   - flint_fix        -> FixEnrichment
 *
 * The enrichment is added as a leading content block in the tool's
 * response, formatted as:
 *
 *   --- Flint Context Preamble ---
 *   Target node: <div data-flint-id="flint-card-root" className="bg-blue-500 p-4">
 *   Parent: <section data-flint-id="flint-main">
 *   Violations on this node: MITHRIL-COL (deltaE 3.2, fixable)
 *   Siblings: [flint-header, flint-footer]
 *   ---
 *
 * Performance: The enrichment reads from the cached SessionContext
 * and performs a targeted AST traversal only for the specific node.
 * Budget: < 20ms per enrichment.
 */
```

### 8.5 sentinel.ts -- Domain-Configurable Governance Prompt

**Location:** `flint-mcp/src/prompts/sentinel.ts`

```typescript
/**
 * FLINT_SENTINEL_PROMPT_DEF — prompt definition for ListPrompts.
 * getFlintSentinelContent(domain: string) — returns the full prompt body.
 *
 * Base structure (always included):
 *   1. Identity: "You are the Flint Governance Sentinel."
 *   2. Base rules: 16 Commandments summarized for agent consumption
 *   3. Workflow mandate: audit-before-commit, token-first, registry-before-draft
 *   4. Halt criteria: critical violations block all code generation
 *
 * Domain overlay (injected when domain != "ui"):
 *   - Domain name and description
 *   - Compliance standards with reference URLs
 *   - Domain-specific rules with severity levels
 *   - Domain-specific halt criteria
 *
 * Supported domains:
 *   - "ui" (default): Base governance only
 *   - "healthcare": HIPAA compliance rules
 *   - "fintech": PCI-DSS + SOX compliance rules
 *   - "ecommerce": PCI-DSS + GDPR compliance rules
 *   - "legal": SOC2 + data retention rules
 */
export const FLINT_SENTINEL_PROMPT_DEF = {
    name: "flint-sentinel",
    description: "Governance-aware AI assistant persona scoped to a specific enforcement domain. Mandates audit-before-commit behaviour across all code generation within the chosen domain.",
    arguments: [
        {
            name: "domain",
            required: false,
            description: "Governance domain: 'ui' (default) | 'healthcare' | 'fintech' | 'ecommerce' | 'legal'."
        }
    ]
} as const;
```

**Domain rule examples:**

Healthcare (`flint-mcp/src/domains/healthcare.ts`):
```
HIPAA-001: All form inputs collecting PHI must have autocomplete="off" (critical)
HIPAA-002: No PHI field may render its value in the DOM without a data-masked attribute (critical)
HIPAA-003: Error messages must not expose patient identifiers (warning)
HIPAA-004: Session timeout UI must be present on all authenticated views (warning)
```

Fintech (`flint-mcp/src/domains/fintech.ts`):
```
PCI-001: Credit card number inputs must use inputMode="numeric" and maxLength constraints (critical)
PCI-002: CVV fields must never persist values in state beyond the submission handler (critical)
PCI-003: Payment amount displays must use locale-aware formatting tokens (warning)
SOX-001: All data modification actions must have an audit trail annotation (warning)
```

E-commerce (`flint-mcp/src/domains/ecommerce.ts`):
```
GDPR-001: Cookie consent banner must be present before any tracking script loads (critical)
GDPR-002: Personal data collection forms must link to a privacy policy (warning)
ECOM-001: Price display components must use the design system currency token (warning)
ECOM-002: Add-to-cart buttons must have aria-label including the product name (warning)
```

---

## 9. Integration with Existing Architecture

### 9.1 server.ts Modifications

The MCP server's `CallToolRequestSchema` handler gains:

1. A new `flint_get_context` case that calls `assembleSessionContext()`
2. A new `flint_assess_complexity` case that calls `assessComplexity()`
3. An enrichment intercept: after every tool call resolves, if the tool is enrichment-eligible, prepend the enrichment content block

```typescript
// Pseudocode for the enrichment intercept in server.ts
case "flint_ast_mutate": {
    // ... existing mutation logic ...
    const result = await handleMutation(args);

    // ACX: Enrich the response with target node context
    const enrichment = enrichToolCall("flint_ast_mutate", args, cachedContext);
    if (enrichment) {
        result.content.unshift({
            type: "text",
            text: enrichment.contextPreamble
        });
    }
    return result;
}
```

### 9.2 ReadResource Handler Extension

Add `flint://session-context` handling to the existing ReadResource handler:

```typescript
if (request.params.uri === "flint://session-context") {
    const ctx = assembleSessionContext(projectRoot);
    return {
        contents: [{
            uri: "flint://session-context",
            mimeType: "application/json",
            text: JSON.stringify(ctx, null, 2),
        }]
    };
}
```

### 9.3 Context Push Initialization

The `ContextPushManager` is instantiated once during MCP server startup (after `projectRoot` is resolved) and destroyed on server shutdown. It watches `.flint/` files and emits deltas to `mcp-events.jsonl`.

```typescript
// In server.ts, after projectRoot resolution:
const contextPush = new ContextPushManager(projectRoot);
contextPush.start();

// On server shutdown:
contextPush.stop();
```

### 9.4 events.ts Extension

Add `'context-delta'` to the `MCPEventType` union:

```typescript
export type MCPEventType = 'violation' | 'annotation' | 'mutation' | 'audit' | 'fix' | 'debt' | 'context-delta'
```

---

## 10. Commandment Compliance Checklist

| # | Commandment | Applies | How ACX Complies |
|---|-------------|---------|-----------------|
| C1 | Code is Truth | NO | ACX is read-only -- it assembles context from existing canonical sources. It writes nothing to `.tsx` files. |
| C2 | No Hallucinated Styling | YES | TokenSnapshot includes only tokens read from `design-tokens.json`. No fabricated values. |
| C4 | Local-First Only | YES | All data sources are local files (`.flint/`) and local SQLite. No external URLs. |
| C8 | Audit-First Execution | YES | This is the primary commandment ACX fulfills. The `ComplexityAssessment` routes tasks to the right model tier. SessionContext includes pre-computed audit results. |
| C9 | CIEDE2000 deltaE Logic | YES | ViolationDetail includes the `value` field (deltaE for color drift). The audit results embedded in SessionContext are produced by the existing MithrilLinter which uses CIEDE2000. |
| C12 | Atomic Queuing | N/A | ACX reads existing files; it does not write source code. Context deltas are written to `mcp-events.jsonl` using `appendMCPEvent` which uses `appendFileSync` (atomic for small writes). |
| C13 | Deterministic Surgery | YES | The `toolEnricher` parses the active file AST with Babel to extract node-level context. No regex. |
| C14 | Bypass Prohibition | N/A | ACX does not modify source files. Reads from `.flint/` are standard MCP server behavior. |
| C15 | Granular AST Tools Only | YES | `flint_get_context` and `flint_assess_complexity` are read-only tools. The enrichment layer does not add new mutation verbs. |
| C16 | In-Memory Validation | N/A | ACX tools are read-only; they produce no code that needs validation. |

---

## 11. Performance Budget

| Operation | Budget | Strategy |
|-----------|--------|----------|
| `assembleSessionContext()` full assembly | < 100ms | Parallel fs.readFile for .flint/ files; cached audit results |
| SessionContext cache TTL | 500ms | In-memory LRU cache, invalidated on file change events |
| Audit cache (MithrilLinter + A11yLinter) | < 50ms cold, 0ms warm | Cache keyed by file content hash; invalidated on file write |
| Token snapshot assembly | < 10ms | Read token file once, compute byType/mostUsed in-memory |
| Mutation ledger query | < 5ms | Parse last 20 lines of mcp-events.jsonl, filter type='mutation', take 5 |
| ContextDelta computation | < 10ms | Diff previous vs current state in memory |
| ContextDelta debounce | 300ms | Per-file debounce to avoid flooding |
| Tool enrichment | < 20ms | Targeted Babel traversal for single node by flint-id |
| Complexity assessment | < 5ms | Pure computation, no I/O |

---

## 12. Implementation Order

### Phase ACX.1 -- Session Context Resource + Tool (Parallel Group A)

**Agents:** `flint-ast-surgeon`
**Blocking:** Nothing -- can start immediately.

1. Create `flint-mcp/src/core/sessionContext.ts`
   - Implement `assembleSessionContext()` with all 6 data sources
   - Implement in-memory cache with 500ms TTL
   - Implement audit result caching keyed by content hash
2. Create `flint-mcp/src/prompts/sentinel.ts`
   - Implement `FLINT_SENTINEL_PROMPT_DEF` and `getFlintSentinelContent()`
   - Create base governance prompt body
3. Create `flint-mcp/src/domains/healthcare.ts`, `fintech.ts`, `ecommerce.ts`
   - Register domain rules
4. Modify `flint-mcp/src/domains/index.ts`
   - Register new domains
5. Modify `flint-mcp/src/types.ts`
   - Add all types from Section 2.1 through 2.5
6. Modify `flint-mcp/src/server.ts`
   - Register `flint://session-context` resource
   - Implement `flint_get_context` tool handler
   - Implement `flint_assess_complexity` tool handler
7. Modify `flint-mcp/src/core/capabilities/index.ts`
   - Add new resource and tools to catalog

### Phase ACX.2 -- Event-Driven Push (Parallel Group A -- runs simultaneously with ACX.1)

**Agents:** `flint-ast-surgeon`
**Blocking:** Needs types from ACX.1 (commit types first as standalone change).

1. Create `flint-mcp/src/core/contextPush.ts`
   - Implement `ContextPushManager` with fs.watch on .flint/ files
   - Implement delta computation logic
   - Implement debounce (300ms per file)
2. Modify `flint-mcp/src/core/events.ts`
   - Add `'context-delta'` to `MCPEventType`
3. Modify `flint-mcp/src/server.ts`
   - Instantiate and start `ContextPushManager` on server init
   - Wire `TOKENS_UPDATED` event to trigger `figma-import-completed` delta

### Phase ACX.3 -- Tool Enrichment (Sequential, after ACX.1)

**Agents:** `flint-ast-surgeon`
**Blocking:** ACX.1 must be ONLINE (needs assembleSessionContext).

1. Create `flint-mcp/src/core/toolEnricher.ts`
   - Implement `enrichToolCall()` for `flint_ast_mutate` and `flint_fix`
   - Implement AST-based node summary extraction (Babel traverse)
2. Modify `flint-mcp/src/server.ts`
   - Add enrichment intercept to `flint_ast_mutate` and `flint_fix` handlers

### Phase ACX.4 -- Complexity Router (Parallel Group B -- after ACX.1)

**Agents:** `flint-ast-surgeon`
**Blocking:** ACX.1 must be ONLINE (needs SessionContext for factor computation).

1. Create `flint-mcp/src/core/complexityRouter.ts`
   - Implement `assessComplexity()` with weighted scoring
   - Implement tier mapping (fast/balanced/powerful)
2. Wire into `flint_assess_complexity` tool (already registered in ACX.1)

### Phase ACX.5 -- Extended Context Sync (Parallel Group A)

**Agents:** `flint-state-architect` + `flint-electron-ipc`
**Blocking:** Nothing -- can start immediately (only extends existing hook).

1. Modify `src/types/flint-api.d.ts`
   - Extend `FlintContext` with `violationDetails`, `exportBlocked`, `exportBlockReason`
2. Modify `src/hooks/useContextSync.ts`
   - Populate new fields from editorStore linterWarnings and canvasStore
3. Modify `electron/main.ts`
   - Add `context:get-enriched` IPC handler
4. Modify `electron/preload.ts`
   - Expose `context.getEnriched()` on flintAPI

### Phase ACX.6 -- Tests (Parallel -- each subphase gets tests)

**Agents:** `flint-test-writer`
**Blocking:** Each test module waits for its corresponding implementation.

See Test ID Map (Section 13).

### Phase ACX.7 -- Integration Validation (Sequential, after all above)

**Agents:** `flint-integration-validator`
**Blocking:** ACX.1 through ACX.6 must be ONLINE.

1. End-to-end: MCP client connects -> reads `flint://session-context` -> gets full context in one call
2. End-to-end: File switch in Glass -> `flint:mcp-event` with `context-delta` -> delta arrives in host IDE
3. End-to-end: `flint_ast_mutate` call -> enrichment prepended -> agent sees node context
4. End-to-end: `flint_assess_complexity` -> correct tier for known test cases
5. End-to-end: `flint-sentinel` prompt with `domain: "healthcare"` -> HIPAA rules in prompt
6. Update `HANDOFF.md` and `CLAUDE.md` with ACX as ONLINE

---

## 13. Test ID Map

| Test ID | Test Description | File Location | Priority |
|---------|-----------------|---------------|----------|
| ACX-01 | assembleSessionContext returns valid SessionContext shape | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-02 | assembleSessionContext completes in < 100ms | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-03 | SessionContext includes active file source excerpt (first 200 lines) | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-04 | SessionContext includes violation details with nodeIds | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-05 | SessionContext token snapshot has correct byType breakdown | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-06 | SessionContext with no active file returns activeFile: null | `flint-mcp/src/__tests__/sessionContext.test.ts` | MEDIUM |
| ACX-07 | SessionContext caching: second call within 500ms returns cached value | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-08 | SessionContext cache invalidation on token file change | `flint-mcp/src/__tests__/sessionContext.test.ts` | MEDIUM |
| ACX-09 | ContextPushManager emits file-switched delta on activeFile change | `flint-mcp/src/__tests__/contextPush.test.ts` | HIGH |
| ACX-10 | ContextPushManager emits violations-changed delta on count change | `flint-mcp/src/__tests__/contextPush.test.ts` | HIGH |
| ACX-11 | ContextPushManager suppresses delta for cursor-only changes | `flint-mcp/src/__tests__/contextPush.test.ts` | MEDIUM |
| ACX-12 | ContextPushManager debounces at 300ms per file | `flint-mcp/src/__tests__/contextPush.test.ts` | HIGH |
| ACX-13 | assessComplexity returns 'fast' for single-prop edit (score < 30) | `flint-mcp/src/__tests__/complexityRouter.test.ts` | HIGH |
| ACX-14 | assessComplexity returns 'balanced' for multi-node, single-file task | `flint-mcp/src/__tests__/complexityRouter.test.ts` | HIGH |
| ACX-15 | assessComplexity returns 'powerful' for cross-file refactor | `flint-mcp/src/__tests__/complexityRouter.test.ts` | HIGH |
| ACX-16 | assessComplexity factors sum to 100 | `flint-mcp/src/__tests__/complexityRouter.test.ts` | MEDIUM |
| ACX-17 | assessComplexity with empty input returns 'fast' (safe default) | `flint-mcp/src/__tests__/complexityRouter.test.ts` | MEDIUM |
| ACX-18 | enrichToolCall for flint_ast_mutate includes target node props | `flint-mcp/src/__tests__/toolEnricher.test.ts` | HIGH |
| ACX-19 | enrichToolCall for flint_ast_mutate includes active violations on node | `flint-mcp/src/__tests__/toolEnricher.test.ts` | HIGH |
| ACX-20 | enrichToolCall for flint_fix includes suggested fix ops | `flint-mcp/src/__tests__/toolEnricher.test.ts` | HIGH |
| ACX-21 | enrichToolCall returns null for non-enrichable tools | `flint-mcp/src/__tests__/toolEnricher.test.ts` | MEDIUM |
| ACX-22 | enrichToolCall completes in < 20ms | `flint-mcp/src/__tests__/toolEnricher.test.ts` | MEDIUM |
| ACX-23 | getFlintSentinelContent("ui") returns base rules only | `flint-mcp/src/__tests__/sentinel.test.ts` | HIGH |
| ACX-24 | getFlintSentinelContent("healthcare") includes HIPAA rules | `flint-mcp/src/__tests__/sentinel.test.ts` | HIGH |
| ACX-25 | getFlintSentinelContent("fintech") includes PCI-DSS rules | `flint-mcp/src/__tests__/sentinel.test.ts` | HIGH |
| ACX-26 | getFlintSentinelContent with unknown domain falls back to "ui" | `flint-mcp/src/__tests__/sentinel.test.ts` | MEDIUM |
| ACX-27 | flint_get_context tool returns SessionContext | `flint-mcp/src/__tests__/sessionContext.test.ts` | HIGH |
| ACX-28 | flint://session-context resource returns same data as tool | `flint-mcp/src/__tests__/sessionContext.test.ts` | MEDIUM |
| ACX-29 | FlintContext extended fields (violationDetails, exportBlocked) populated | `src/hooks/__tests__/useContextSync.test.ts` | HIGH |
| ACX-30 | context:get-enriched IPC returns enriched context from main process | `electron/__tests__/contextIPC.test.ts` | MEDIUM |

---

## 14. Risks

| Risk | Likelihood | Impact | Commandment Threatened | Mitigation |
|------|-----------|--------|----------------------|------------|
| **Assembly exceeds 100ms budget** | Medium | HIGH | C8 (Audit-First must not block agent) | Cache aggressively (500ms TTL). Parallelize file reads. Audit caching keyed by content hash. Performance test ACX-02 is gating. |
| **context.json stale or missing** | Low | MEDIUM | None -- degrades gracefully | `assembleSessionContext` returns partial context with null fields when context.json is missing or stale. Never throws. |
| **MCP SDK notification limits** | Low | LOW | None | Context deltas use the existing `mcp-events.jsonl` file channel (Phase W.1), which has no protocol-level limits. |
| **Tool enrichment adds latency to mutations** | Medium | MEDIUM | C12 (Atomic Queuing) | Enrichment budget is 20ms. Enrichment is non-blocking -- if it exceeds budget, it is skipped and the tool executes without enrichment. |
| **Audit cache invalidation races** | Low | LOW | C9 (CIEDE2000 Logic) | Cache key includes file content hash. Even if the file changes between cache check and read, the next call will re-audit. Stale audit results for 500ms are acceptable. |
| **sentinel.ts import from server.ts already references the file** | HIGH | HIGH | Build breakage | The import `from "./prompts/sentinel.js"` already exists in server.ts but the file is missing. Creating `sentinel.ts` MUST happen first or the server fails to compile. This is a pre-existing build issue. |
| **Cross-process data freshness** | Medium | LOW | None | The MCP server reads .flint/ files which are written by the Electron main process. There is a latency window (200ms debounce + fs.watch propagation). The 500ms cache TTL absorbs this. |
| **Domain rules too prescriptive** | Low | MEDIUM | None | Domain rules are guidance, not enforcement. They add to the sentinel prompt but do not block exports. Violations are advisory severity unless explicitly elevated. |
| **Large token sets blow up mostUsed computation** | Low | MEDIUM | Performance | Token reference counting requires scanning all audited files. For ACX.1, `mostUsed` is populated only from the active file's token references, not project-wide. Project-wide reference counting is a Phase ACX.2+ enhancement. |

---

## 15. Open Design Decisions

### 15.1 SessionContext Source Excerpt Length

The spec calls for "first 200 lines." For very large files (1000+ lines), should we instead provide a focused excerpt around the selected node? Decision: **First 200 lines for ACX.1.** Selected-node-focused excerpts are a Phase ACX.2 enhancement.

### 15.2 Token MostUsed Computation Scope

Computing "most used across the project" requires scanning all source files, which could blow the 100ms budget. Decision: **For ACX.1, compute mostUsed from the active file only.** The `referenceCount` field counts occurrences within the active file. Project-wide reference counting is deferred.

### 15.3 Enrichment Opt-Out

Should agents be able to disable enrichment (e.g. for performance-sensitive batch operations)? Decision: **Not for ACX.1.** Enrichment adds < 20ms per tool call. If this becomes a bottleneck, add an `enrichment: false` parameter to tool schemas in ACX.2.

### 15.4 Context Push Protocol

The MCP SDK supports `notifications/resources/list_changed` (already used for token updates) but does NOT support arbitrary push messages to clients. The `mcp-events.jsonl` file channel is a Flint-specific mechanism that works only when Glass is running. For pure CLI agents (Claude Code without Glass), context deltas must be polled via `flint://session-context`.

Decision: **Dual path.** Glass gets deltas via `mcp-events.jsonl` -> `flint:mcp-event` IPC. CLI agents poll `flint://session-context` with the built-in MCP resource read. The resource emits `notifications/resources/list_changed` when context changes, which is the MCP-standard way to signal "re-read this resource."

### 15.5 Sentinel Prompt Composition vs Replacement

Should the sentinel prompt compose with `flint-intent-composer` or replace it? Decision: **Compose.** The sentinel prompt is a standalone persona. An agent can load both prompts if desired: `flint-intent-composer` for the design-to-code persona plus `flint-sentinel` for domain-specific governance overlay. They are additive.

---

## 16. Files to Read Before Implementation

Agents assigned to ACX.1 + ACX.2 MUST read these files before writing code:

| File | Why |
|------|-----|
| `flint-mcp/src/server.ts` | Resource/tool registration patterns, existing event wiring |
| `flint-mcp/src/core/events.ts` | MCPEvent types, appendMCPEvent pattern, file rotation |
| `flint-mcp/src/core/capabilities/index.ts` | Catalog structure for adding new resources/tools |
| `flint-mcp/src/core/dashboard/debtReportService.ts` | How to read .flint/debt-history.json |
| `flint-mcp/src/core/dashboard/types.ts` | DebtReport, DashboardData shapes |
| `flint-mcp/src/core/MithrilLinter.ts` | auditAll() signature and return type |
| `flint-mcp/src/core/A11yLinter.ts` | A11yLinter audit signature |
| `flint-mcp/src/types.ts` | Existing LinterWarning, DesignToken shapes |
| `flint-mcp/src/domains/index.ts` | Domain registry pattern |
| `flint-mcp/src/prompts/workflow-guide.ts` | Pattern for prompt module structure |
| `src/hooks/useContextSync.ts` | How context.json is assembled and written |
| `src/types/flint-api.d.ts` | FlintContext type, FlintAPI surface |
| `electron/mcpClient.ts` | How Glass communicates with MCP server |
| `electron/main.ts` | IPC handler registration patterns |
| `electron/preload.ts` | contextBridge surface patterns |

Agents assigned to ACX.3 (Tool Enrichment) MUST additionally read:

| File | Why |
|------|-----|
| `flint-mcp/src/core/ast-modifier.ts` | How mutations locate nodes by flint-id |
| `flint-mcp/src/tools/audit.ts` | handleFlintAudit patterns |
| `flint-mcp/src/tools/fix.ts` | handleFlintFix patterns |
