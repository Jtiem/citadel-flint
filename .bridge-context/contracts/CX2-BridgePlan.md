# Contract: CX.2 -- bridge_plan Orchestration Tool

## Status: DESIGN COMPLETE -- Ready for Phase 2 Implementation

---

## Architectural Summary

`bridge_plan` is a new MCP tool that accepts a natural language intent string and returns a structured, deterministic execution plan. The plan is an ordered sequence of Bridge tool calls, decision points requiring human judgment, and success criteria. The tool does not execute anything -- it returns a plan that the calling agent then executes step by step.

The tool lives entirely in the headless MCP engine (`bridge-mcp/`). Zero Glass changes. Zero IPC changes. Zero store changes. The implementation creates two new files (`planService.ts` and `plan.ts`) and defers the `server.ts` registration to avoid conflict with the ING.3 swarm territory.

**Key design decision:** Intent classification is deterministic keyword/pattern matching. No LLM call. The classifier runs synchronously in under 5ms on any input string. This is consistent with the Complexity Router (Phase ACX.4) pattern -- deterministic pre-flight classification with zero I/O.

**Scope estimation:** When a `projectRoot` is provided, the plan service reads `.bridge/debt-history.json` and `.bridge/design-tokens.json` to estimate violation counts and file scope. This enriches the plan with concrete numbers (e.g., "~47 files, ~200 violations") instead of generic placeholders. When `projectRoot` is absent or files are unreadable, the plan degrades gracefully to generic estimates.

---

## 1. Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `bridge-mcp/src/core/planService.ts` | NEW -- intent classification + plan generation | bridge-ast-surgeon |
| `bridge-mcp/src/tools/plan.ts` | NEW -- MCP tool handler (BRIDGE_PLAN_TOOL const + handler) | bridge-ast-surgeon |
| `bridge-mcp/src/__tests__/planService.test.ts` | NEW -- service unit tests (30+ tests) | bridge-test-writer |
| `bridge-mcp/src/__tests__/plan.tool.test.ts` | NEW -- tool handler integration tests (10+ tests) | bridge-test-writer |
| `bridge-mcp/src/server.ts` | DEFERRED MODIFY -- register `bridge_plan` in ListTools + CallTool | bridge-ast-surgeon (post-ING.3) |

---

## 2. Type Contracts (Source of Truth for Phase 2)

All types are defined in `bridge-mcp/src/core/planService.ts` and re-exported from `bridge-mcp/src/tools/plan.ts`. No new shared types file is needed -- these types do not cross any process boundary.

### 2.1 Intent Classification Types

```typescript
/**
 * The 5 supported intent categories. Each maps to a fixed plan template.
 * "unknown" is returned when the classifier cannot confidently match any category.
 */
export type PlanIntentType =
    | 'token-migration'
    | 'accessibility-sweep'
    | 'full-governance-audit'
    | 'figma-sync'
    | 'debt-remediation'
    | 'unknown'

/**
 * The result of intent classification. Includes the matched type,
 * the confidence signal (which keywords matched), and the original intent.
 */
export interface PlanIntent {
    /** The classified intent type. */
    type: PlanIntentType
    /** The original natural language intent string. */
    rawIntent: string
    /** Keywords from the intent that matched the classifier. Empty if type is "unknown". */
    matchedKeywords: string[]
    /**
     * Confidence level based on keyword density.
     * "high" = 3+ keyword matches. "medium" = 1-2 matches. "low" = 0 matches (unknown).
     */
    confidence: 'high' | 'medium' | 'low'
}
```

### 2.2 Plan Step Types

```typescript
/**
 * A single step in an execution plan. Steps are either tool calls or
 * decision points that require human judgment.
 */
export type PlanStep = ToolStep | DecisionStep

/**
 * A step that invokes a Bridge MCP tool.
 */
export interface ToolStep {
    /** Sequential step number (1-indexed). */
    step: number
    /** Discriminator -- this is a tool invocation step. */
    kind: 'tool'
    /** The MCP tool name to invoke. Must be a real, registered Bridge tool. */
    tool: string
    /**
     * Suggested parameters for the tool call. Keys are parameter names from
     * the tool's inputSchema. Values may contain template placeholders:
     *   {{glob}}        -- replaced with the user-supplied glob scope
     *   {{projectRoot}} -- replaced with the user-supplied projectRoot
     *   {{filePath}}    -- replaced per-file during iteration
     * Agents should substitute these before invoking.
     */
    params: Record<string, unknown>
    /** One-sentence human-readable purpose of this step. */
    purpose: string
    /**
     * If true, the agent should present the result of this step to the user
     * before proceeding. If false, the agent may proceed automatically.
     */
    requiresReview: boolean
}

/**
 * A step that requires human judgment before the plan can continue.
 * The agent should present the decision to the user and wait for input.
 */
export interface DecisionStep {
    /** Sequential step number (1-indexed). */
    step: number
    /** Discriminator -- this is a human decision point. */
    kind: 'decision'
    /** Description of the decision the human must make. */
    description: string
    /** Why this decision cannot be automated. */
    rationale: string
    /**
     * Suggested options the human can choose from. The agent should present
     * these as choices but may also accept freeform input.
     */
    suggestedOptions: string[]
}
```

### 2.3 Execution Plan Type

```typescript
/**
 * A complete execution plan returned by bridge_plan.
 */
export interface ExecutionPlan {
    /** The classified intent. */
    intent: PlanIntent
    /** Ordered steps to execute. */
    steps: PlanStep[]
    /**
     * Human-readable scope estimate. Examples:
     *   "~47 files matching src/components/**/*.tsx, ~200 estimated violations"
     *   "Full project audit across all .tsx/.jsx files"
     * When projectRoot is unavailable, this is a generic description.
     */
    estimatedScope: string
    /**
     * Risk level of the overall plan.
     *   "low"    -- read-only operations (audit, report)
     *   "medium" -- mutations with auto-fix (token migration, a11y fix)
     *   "high"   -- structural mutations or cross-file operations
     */
    riskLevel: 'low' | 'medium' | 'high'
    /**
     * One-sentence summary suitable for chat display.
     * Example: "Plan: migrate hardcoded colors to design tokens across 47 files in 6 steps."
     */
    summary: string
    /**
     * Success criteria -- what the agent should verify after executing all steps.
     */
    successCriteria: string[]
    /**
     * When true, this plan was generated in dry-run mode and no tool step
     * should actually be executed. The agent should present the plan and
     * ask for confirmation before re-invoking with dry_run=false.
     */
    dryRun: boolean
}
```

### 2.4 Tool Input Types

```typescript
/**
 * Input parameters for the bridge_plan MCP tool.
 */
export interface BridgePlanParams {
    /**
     * Natural language description of the task.
     * Examples:
     *   "Migrate all hardcoded colors in src/components/ to design tokens"
     *   "Run a full accessibility sweep on the project"
     *   "Audit the entire codebase for governance compliance"
     */
    intent: string
    /**
     * Optional glob pattern to scope the plan. When provided, tool steps
     * that accept a glob or filePaths parameter will use this scope.
     * Default: "**/*.tsx" (all TSX files).
     */
    glob?: string
    /**
     * Optional absolute path to the project root. When provided, the plan
     * service reads .bridge/ files to enrich scope estimates with real data
     * (violation counts, file counts, health score).
     */
    projectRoot?: string
    /**
     * When true, the returned plan is marked as a preview. The agent should
     * present it for human review before executing. When false (default),
     * the plan is ready for immediate execution.
     */
    dry_run?: boolean
}
```

---

## 3. Intent Classification Algorithm

Classification is pure keyword matching -- no regex on source code (Commandment 13 is about AST surgery, not plan classification, but we maintain the deterministic spirit). The algorithm runs in a single pass over the lowercased intent string.

### 3.1 Keyword Tables

```typescript
/**
 * Keyword tables for intent classification. Each intent type has a primary
 * keyword set (strong signals) and a secondary keyword set (weak signals).
 * Classification requires at least 1 primary OR 2+ secondary matches.
 */

const INTENT_KEYWORDS: Record<Exclude<PlanIntentType, 'unknown'>, {
    primary: string[]
    secondary: string[]
}> = {
    'token-migration': {
        primary: [
            'migrate token',
            'token migration',
            'hardcoded color',
            'hardcoded colours',
            'replace hardcoded',
            'convert to token',
            'convert to design token',
            'fix color drift',
            'fix colour drift',
            'adopt token',
            'adopt design token',
        ],
        secondary: [
            'hardcoded',
            'color',
            'colour',
            'token',
            'drift',
            'bg-[#',
            'text-[#',
            'arbitrary',
            'design system',
            'migrate',
        ],
    },
    'accessibility-sweep': {
        primary: [
            'accessibility sweep',
            'a11y sweep',
            'a11y audit',
            'wcag audit',
            'accessibility audit',
            'fix accessibility',
            'fix a11y',
            'wcag compliance',
            'accessibility compliance',
        ],
        secondary: [
            'accessibility',
            'a11y',
            'wcag',
            'aria',
            'alt text',
            'screen reader',
            'keyboard',
            'focus',
            'contrast',
            'label',
        ],
    },
    'full-governance-audit': {
        primary: [
            'full audit',
            'governance audit',
            'full governance',
            'audit everything',
            'audit the project',
            'audit the codebase',
            'comprehensive audit',
            'complete audit',
            'project audit',
            'codebase audit',
        ],
        secondary: [
            'audit',
            'governance',
            'compliance',
            'violations',
            'review',
            'check',
            'inspect',
            'scan',
            'health',
        ],
    },
    'figma-sync': {
        primary: [
            'figma sync',
            'sync figma',
            'sync from figma',
            'figma import',
            'import from figma',
            'figma tokens',
            'figma variables',
            'sync design',
            'pull from figma',
        ],
        secondary: [
            'figma',
            'sync',
            'import',
            'design file',
            'variables',
            'ingest',
        ],
    },
    'debt-remediation': {
        primary: [
            'reduce debt',
            'fix debt',
            'design debt',
            'remediate',
            'debt remediation',
            'improve health',
            'improve grade',
            'raise health score',
            'raise the grade',
            'clean up violations',
            'fix all violations',
        ],
        secondary: [
            'debt',
            'health score',
            'grade',
            'violations',
            'fix',
            'clean',
            'resolve',
            'remediate',
            'improve',
        ],
    },
}
```

### 3.2 Classification Function

```typescript
/**
 * Classify a natural language intent string into a PlanIntentType.
 *
 * Algorithm:
 *   1. Lowercase the intent string.
 *   2. For each intent type, count primary and secondary keyword matches.
 *   3. A primary match = 2 points. A secondary match = 1 point.
 *   4. Require a minimum score of 2 to classify (1 primary or 2 secondaries).
 *   5. The intent type with the highest score wins.
 *   6. Ties are broken by declaration order in INTENT_KEYWORDS (token-migration first).
 *   7. If no type reaches the minimum score, return "unknown".
 *
 * @param intent - Natural language intent string
 * @returns PlanIntent with type, matchedKeywords, and confidence
 */
export function classifyIntent(intent: string): PlanIntent {
    const lower = intent.toLowerCase()

    let bestType: PlanIntentType = 'unknown'
    let bestScore = 0
    let bestMatched: string[] = []

    for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS) as Array<
        [Exclude<PlanIntentType, 'unknown'>, { primary: string[]; secondary: string[] }]
    >) {
        let score = 0
        const matched: string[] = []

        for (const kw of keywords.primary) {
            if (lower.includes(kw)) {
                score += 2
                matched.push(kw)
            }
        }
        for (const kw of keywords.secondary) {
            if (lower.includes(kw)) {
                score += 1
                matched.push(kw)
            }
        }

        if (score > bestScore && score >= 2) {
            bestScore = score
            bestType = intentType
            bestMatched = matched
        }
    }

    const confidence: PlanIntent['confidence'] =
        bestMatched.length >= 3 ? 'high' : bestMatched.length >= 1 ? 'medium' : 'low'

    return {
        type: bestType,
        rawIntent: intent,
        matchedKeywords: bestMatched,
        confidence,
    }
}
```

### 3.3 Performance Contract

`classifyIntent()` must complete in under 5ms on any input string up to 2,000 characters. This is enforced by:
- No async operations. No I/O.
- `String.prototype.includes()` only. No regex.
- Keyword arrays are module-level constants, never re-allocated.
- O(K) where K = total keyword count (~65 keywords).

---

## 4. Plan Templates -- The 5 Intent Types

Each intent type maps to a fixed plan template. The template is parameterized by `glob` and enriched with scope estimates from `.bridge/` files when `projectRoot` is available.

### 4.1 token-migration

```typescript
const TOKEN_MIGRATION_TEMPLATE: PlanStep[] = [
    {
        step: 1,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Audit all files in scope to identify color, typography, and spacing violations.',
        requiresReview: false,
    },
    {
        step: 2,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}' },
        purpose: 'Generate a baseline health score before migration begins.',
        requiresReview: true,
    },
    {
        step: 3,
        kind: 'decision',
        description: 'Review the violation list. For each ambiguous color (multiple token candidates within deltaE threshold), confirm which design token to map to.',
        rationale: 'Token selection for ambiguous colors requires design judgment. The nearest-deltaE token may not be the semantically correct one (e.g., brand-blue vs. info-blue).',
        suggestedOptions: [
            'Accept all nearest-deltaE token mappings automatically',
            'Review each ambiguous mapping individually',
            'Skip ambiguous mappings and fix only exact matches',
        ],
    },
    {
        step: 4,
        kind: 'tool',
        tool: 'bridge_fix',
        params: { source: '{{filePath}}', filePath: '{{filePath}}' },
        purpose: 'Apply auto-fixable tier-1 violations (exact token matches) across all scoped files.',
        requiresReview: false,
    },
    {
        step: 5,
        kind: 'decision',
        description: 'For tier-2/3 violations that could not be auto-fixed, review the remaining violations and decide: apply manual fixes via bridge_ast_mutate, or defer them.',
        rationale: 'Manual token assignments require understanding the design intent behind each color usage.',
        suggestedOptions: [
            'Apply suggested fixes for all remaining violations',
            'Fix violations file-by-file with review',
            'Defer remaining violations to a follow-up session',
        ],
    },
    {
        step: 6,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Re-audit all files to verify zero regressions from the migration.',
        requiresReview: true,
    },
    {
        step: 7,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', track: true },
        purpose: 'Generate a post-migration health score and record the improvement in debt history.',
        requiresReview: true,
    },
]
// riskLevel: 'medium'
// successCriteria:
//   - "Zero color-drift violations (MITH-001) remain in scoped files"
//   - "Health score improved compared to baseline"
//   - "No new violations introduced by the migration"
```

### 4.2 accessibility-sweep

```typescript
const ACCESSIBILITY_SWEEP_TEMPLATE: PlanStep[] = [
    {
        step: 1,
        kind: 'tool',
        tool: 'bridge_accessibility_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}' },
        purpose: 'Generate a comprehensive accessibility report identifying all WCAG 2.1 AA violations.',
        requiresReview: true,
    },
    {
        step: 2,
        kind: 'decision',
        description: 'Review the accessibility report. Prioritize violations by severity: critical (export-blocking) first, then warnings. Decide whether to fix all or focus on critical violations only.',
        rationale: 'Some accessibility fixes may alter component behavior (e.g., adding keyboard handlers, changing heading hierarchy). Design review is needed.',
        suggestedOptions: [
            'Fix all violations (critical + warnings)',
            'Fix critical violations only (unblock export)',
            'Fix violations file-by-file with individual review',
        ],
    },
    {
        step: 3,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}', severity: 'critical' },
        purpose: 'Identify all critical-severity a11y violations that block export.',
        requiresReview: false,
    },
    {
        step: 4,
        kind: 'tool',
        tool: 'bridge_fix',
        params: { source: '{{filePath}}', filePath: '{{filePath}}' },
        purpose: 'Apply auto-fixable accessibility fixes (missing alt text, missing aria-labels, heading hierarchy).',
        requiresReview: false,
    },
    {
        step: 5,
        kind: 'decision',
        description: 'Review remaining a11y violations that require manual intervention (e.g., focus management, ARIA roles, keyboard navigation patterns). Decide on implementation approach.',
        rationale: 'Complex accessibility patterns (focus traps, live regions, custom keyboard shortcuts) require understanding component interaction design.',
        suggestedOptions: [
            'Implement all remaining fixes with agent assistance',
            'Implement fixes component-by-component with review',
            'Log remaining violations and address in a dedicated sprint',
        ],
    },
    {
        step: 6,
        kind: 'tool',
        tool: 'bridge_accessibility_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}' },
        purpose: 'Re-generate the accessibility report to verify all critical violations are resolved.',
        requiresReview: true,
    },
    {
        step: 7,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', track: true },
        purpose: 'Record the accessibility improvement in the debt history.',
        requiresReview: false,
    },
]
// riskLevel: 'medium'
// successCriteria:
//   - "Zero critical (export-blocking) accessibility violations remain"
//   - "All auto-fixable A11Y rules resolved"
//   - "Remaining manual fixes documented with specific component + rule"
```

### 4.3 full-governance-audit

```typescript
const FULL_GOVERNANCE_AUDIT_TEMPLATE: PlanStep[] = [
    {
        step: 1,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', format: 'json' },
        purpose: 'Generate a full design debt report as the baseline measurement.',
        requiresReview: true,
    },
    {
        step: 2,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Run Mithril + A11y audits across all files in scope.',
        requiresReview: false,
    },
    {
        step: 3,
        kind: 'tool',
        tool: 'bridge_accessibility_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}' },
        purpose: 'Generate a dedicated accessibility compliance report.',
        requiresReview: false,
    },
    {
        step: 4,
        kind: 'decision',
        description: 'Review the combined audit results. Categorize violations into: (a) auto-fixable, (b) manual fix required, (c) intentional overrides to acknowledge. Decide on remediation strategy.',
        rationale: 'A full governance audit typically surfaces a mix of quick fixes and architectural issues. Triaging before fixing prevents wasted effort on violations that will be superseded by structural changes.',
        suggestedOptions: [
            'Fix all auto-fixable violations immediately, triage the rest',
            'Generate a remediation plan sorted by severity, fix top-10 first',
            'Export the audit as a report only (no fixes in this session)',
        ],
    },
    {
        step: 5,
        kind: 'tool',
        tool: 'bridge_fix',
        params: { source: '{{filePath}}', filePath: '{{filePath}}' },
        purpose: 'Apply auto-fixes for all tier-1 violations (exact token matches, missing alt text).',
        requiresReview: false,
    },
    {
        step: 6,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Re-audit to verify fixes and detect any regressions.',
        requiresReview: true,
    },
    {
        step: 7,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', track: true },
        purpose: 'Generate final health score and record in debt history for trend tracking.',
        requiresReview: true,
    },
]
// riskLevel: 'low' (audit is read-only; fixes are opt-in at the decision step)
// successCriteria:
//   - "Health score and grade are recorded in debt-history.json"
//   - "All auto-fixable violations resolved (if fix path was chosen)"
//   - "Remaining violations categorized with clear next-step per item"
```

### 4.4 figma-sync

```typescript
const FIGMA_SYNC_TEMPLATE: PlanStep[] = [
    {
        step: 1,
        kind: 'tool',
        tool: 'bridge_status',
        params: {},
        purpose: 'Verify Bridge MCP server is running and Figma ingestion endpoint is reachable.',
        requiresReview: false,
    },
    {
        step: 2,
        kind: 'tool',
        tool: 'bridge_sync_tokens',
        params: { direction: 'diff-only' },
        purpose: 'Run a diff-only sync to identify which tokens have changed between Figma and the local token set.',
        requiresReview: true,
    },
    {
        step: 3,
        kind: 'decision',
        description: 'Review the token diff. Decide whether to accept all incoming Figma changes, selectively accept some, or reject changes that would break existing code.',
        rationale: 'Figma token changes may rename or remove tokens that are actively referenced in code. Blindly accepting can introduce violations.',
        suggestedOptions: [
            'Accept all Figma token changes',
            'Accept new and modified tokens, reject deletions',
            'Review each token change individually',
        ],
    },
    {
        step: 4,
        kind: 'tool',
        tool: 'bridge_sync_tokens',
        params: { direction: 'figma-to-local' },
        purpose: 'Apply the accepted Figma token changes to the local design-tokens.json.',
        requiresReview: false,
    },
    {
        step: 5,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Audit all files against the updated token set to identify new violations caused by token changes.',
        requiresReview: true,
    },
    {
        step: 6,
        kind: 'tool',
        tool: 'bridge_fix',
        params: { source: '{{filePath}}', filePath: '{{filePath}}' },
        purpose: 'Fix violations caused by renamed or updated tokens.',
        requiresReview: false,
    },
    {
        step: 7,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', track: true },
        purpose: 'Record post-sync health score to track the impact of the Figma sync.',
        requiresReview: false,
    },
]
// riskLevel: 'medium'
// successCriteria:
//   - "Local token set matches accepted Figma state"
//   - "No new violations introduced by the sync"
//   - "Health score stable or improved after sync"
```

### 4.5 debt-remediation

```typescript
const DEBT_REMEDIATION_TEMPLATE: PlanStep[] = [
    {
        step: 1,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', format: 'json' },
        purpose: 'Generate a baseline design debt report with current health score and grade.',
        requiresReview: true,
    },
    {
        step: 2,
        kind: 'decision',
        description: 'Review the debt report. Identify the top-contributing violation categories and files. Decide on a remediation strategy: target the files with the most violations first (maximum score improvement) or fix by category (systematic approach).',
        rationale: 'Debt remediation is more effective when focused. Fixing the top-5 worst files often produces 50%+ of the health score improvement.',
        suggestedOptions: [
            'Fix top-5 worst files first (maximum health score impact)',
            'Fix by category: colors first, then spacing, then typography',
            'Fix all auto-fixable violations across the entire scope',
        ],
    },
    {
        step: 3,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Audit all files in scope to get the detailed violation list for remediation.',
        requiresReview: false,
    },
    {
        step: 4,
        kind: 'tool',
        tool: 'bridge_fix',
        params: { source: '{{filePath}}', filePath: '{{filePath}}' },
        purpose: 'Apply all auto-fixable violations (tier-1 exact token matches).',
        requiresReview: false,
    },
    {
        step: 5,
        kind: 'decision',
        description: 'After auto-fixes, review remaining violations. These require manual judgment (ambiguous token mappings, structural a11y issues). Decide whether to continue with manual fixes or pause and record progress.',
        rationale: 'Diminishing returns: the first pass of auto-fixes captures the easy wins. Remaining violations often need design review.',
        suggestedOptions: [
            'Continue with manual fixes for remaining violations',
            'Pause here and record progress -- revisit remaining violations later',
            'Apply manual fixes only for critical (export-blocking) violations',
        ],
    },
    {
        step: 6,
        kind: 'tool',
        tool: 'bridge_audit',
        params: { filePaths: '{{glob}}' },
        purpose: 'Re-audit to verify all fixes and detect any regressions.',
        requiresReview: true,
    },
    {
        step: 7,
        kind: 'tool',
        tool: 'bridge_debt_report',
        params: { projectRoot: '{{projectRoot}}', glob: '{{glob}}', track: true },
        purpose: 'Generate final health score, record improvement in debt history, and report grade change.',
        requiresReview: true,
    },
]
// riskLevel: 'medium'
// successCriteria:
//   - "Health score improved by at least 10 points from baseline"
//   - "Grade improved by at least one letter (e.g., D to C)"
//   - "No new violations introduced by remediation fixes"
//   - "Debt history updated with before/after snapshots"
```

### 4.6 unknown (Fallback)

When the classifier returns `unknown`, the plan service returns a minimal diagnostic plan that helps the agent self-correct:

```typescript
const UNKNOWN_INTENT_TEMPLATE: PlanStep[] = [
    {
        step: 1,
        kind: 'decision',
        description: 'The intent could not be automatically classified. Please clarify your goal by choosing one of the supported task types, or rephrase your request.',
        rationale: 'bridge_plan supports 5 task types: token-migration, accessibility-sweep, full-governance-audit, figma-sync, and debt-remediation. The provided intent did not match any of these categories with sufficient confidence.',
        suggestedOptions: [
            'Migrate hardcoded values to design tokens',
            'Run an accessibility compliance sweep',
            'Audit the full codebase for governance violations',
            'Sync tokens from Figma',
            'Reduce design debt and improve health score',
        ],
    },
]
// riskLevel: 'low'
// successCriteria: ["User clarifies intent and re-invokes bridge_plan with a more specific request"]
```

---

## 5. Scope Estimation

When `projectRoot` is provided, the plan service reads two files to enrich the plan:

```typescript
/**
 * Scope context assembled from .bridge/ files.
 * All fields are optional -- missing files result in null values.
 */
export interface ScopeEstimate {
    /** Estimated number of files matching the glob. Null if filesystem not available. */
    fileCount: number | null
    /** Estimated total violations from last debt report. Null if no debt history. */
    violationCount: number | null
    /** Current health score. Null if no debt history. */
    healthScore: number | null
    /** Current grade. Null if no debt history. */
    healthGrade: string | null
    /** Total token count. Null if no token file. */
    tokenCount: number | null
}

/**
 * Estimate scope by reading .bridge/ files. Never throws.
 * Falls back gracefully when files are missing.
 *
 * Files read:
 *   .bridge/debt-history.json  -- latest snapshot for violation count, score, grade
 *   .bridge/design-tokens.json -- token count
 *
 * File counting: uses a synchronous glob via node:fs (readdir + filter by extension).
 * For large directories, caps at 500 to prevent blocking.
 */
export function estimateScope(projectRoot: string, glob?: string): ScopeEstimate
```

The `estimatedScope` string in the `ExecutionPlan` is generated from `ScopeEstimate`:
- With data: `"~47 files matching src/components/**/*.tsx, ~200 estimated violations, health score 62 (D)"`
- Without data: `"Files matching ${glob || '**/*.tsx'} (scope estimate unavailable -- no .bridge/ data found)"`

---

## 6. MCP Tool Definition

### 6.1 Tool Registration Schema (for deferred server.ts integration)

```typescript
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
```

### 6.2 Tool Handler

```typescript
/**
 * Handle the bridge_plan MCP tool call.
 *
 * @param args - Validated BridgePlanParams
 * @param config - BridgeConfig (used for projectRoot fallback)
 * @returns MCP-format response with content array
 */
export function handleBridgePlan(
    args: BridgePlanParams,
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
```

The return format matches the MCP `CallToolResult` schema and follows the same `{ content: [{ type: 'text', text: string }] }` pattern used by `handleDebtReport`, `handleAuditReport`, and all other tool handlers in the codebase.

### 6.3 Deferred server.ts Registration

The following additions to `bridge-mcp/src/server.ts` are DEFERRED until the ING.3 swarm territory clears `server.ts` from its MODIFY list.

**Import line (add near other tool imports):**
```typescript
import { handleBridgePlan, BRIDGE_PLAN_TOOL } from './tools/plan.js'
```

**ListToolsRequestSchema (add BRIDGE_PLAN_TOOL to the tools array):**
```typescript
BRIDGE_PLAN_TOOL,
```

**CallToolRequestSchema (add case in the switch/if chain):**
```typescript
case 'bridge_plan': {
    const result = handleBridgePlan(
        args as unknown as BridgePlanParams,
        bridgeConfig,
    )
    return result
}
```

---

## 7. File Structure

### 7.1 `bridge-mcp/src/core/planService.ts`

Contains:
- All type exports: `PlanIntentType`, `PlanIntent`, `ToolStep`, `DecisionStep`, `PlanStep`, `ExecutionPlan`, `BridgePlanParams`, `ScopeEstimate`
- `INTENT_KEYWORDS` constant (keyword tables)
- `classifyIntent()` function
- Plan template constants (5 templates + unknown fallback)
- `estimateScope()` function
- `generatePlan()` function (main entry point that classifies, selects template, parameterizes, and returns `ExecutionPlan`)

### 7.2 `bridge-mcp/src/tools/plan.ts`

Contains:
- `BRIDGE_PLAN_TOOL` constant (MCP tool schema)
- `handleBridgePlan()` function (MCP handler)
- Re-exports types from `planService.ts` for external consumers

### 7.3 `bridge-mcp/src/__tests__/planService.test.ts`

Contains unit tests for the plan service (see Section 8).

### 7.4 `bridge-mcp/src/__tests__/plan.tool.test.ts`

Contains integration tests for the tool handler (see Section 8).

---

## 8. Test Matrix

### 8.1 Intent Classification Tests (planService.test.ts -- 20 tests)

| Test ID | Input Intent | Expected Type | Why |
|---------|-------------|---------------|-----|
| CX2-01 | "Migrate all hardcoded colors in src/components/ to design tokens" | token-migration | Primary keyword "hardcoded color" + secondary "migrate", "token" |
| CX2-02 | "Replace all arbitrary bracket colors with tokens" | token-migration | Secondary keywords "arbitrary", "token", "color" (3 = threshold) |
| CX2-03 | "Fix color drift across the codebase" | token-migration | Primary "fix color drift" |
| CX2-04 | "Run an accessibility sweep on all components" | accessibility-sweep | Primary "accessibility sweep" |
| CX2-05 | "Fix all WCAG violations" | accessibility-sweep | Secondary "wcag" + primary "fix a11y" path (via "wcag" + "fix") |
| CX2-06 | "Check ARIA labels and alt text in forms" | accessibility-sweep | Secondary "aria" + "alt text" |
| CX2-07 | "Audit the entire codebase for governance compliance" | full-governance-audit | Primary "audit the codebase" + secondary "governance", "compliance" |
| CX2-08 | "Run a full audit on the project" | full-governance-audit | Primary "full audit" |
| CX2-09 | "Sync tokens from Figma" | figma-sync | Primary "sync from figma" |
| CX2-10 | "Import the latest Figma variables" | figma-sync | Primary "figma variables" + secondary "import" |
| CX2-11 | "Reduce design debt and improve the health score" | debt-remediation | Primary "reduce debt" + secondary "improve", "health score" |
| CX2-12 | "Fix all violations and raise the grade" | debt-remediation | Primary "fix all violations" + "raise the grade" |
| CX2-13 | "Hello, what can you do?" | unknown | No keyword matches |
| CX2-14 | "" (empty string) | unknown | No input to classify |
| CX2-15 | "Migrate tokens from Figma" | figma-sync or token-migration | Ambiguous -- test that one wins deterministically (score-based) |
| CX2-16 | "Fix the button color" | token-migration | Secondary "color" + "fix" -- should still classify (score >= 2) |
| CX2-17 | Very long intent (2000 chars) | Correct type | Performance: classification under 5ms |
| CX2-18 | Intent with mixed case: "MIGRATE ALL HARDCODED COLORS" | token-migration | Case-insensitive matching |
| CX2-19 | "audit" (single word, secondary only) | unknown | Single secondary keyword (score=1) below threshold of 2 |
| CX2-20 | "audit all violations and fix accessibility issues" | Full split test | Multiple categories referenced -- highest score wins |

### 8.2 Plan Generation Tests (planService.test.ts -- 10 tests)

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| CX2-21 | token-migration intent | Returns 7 steps; steps 3 and 5 are decision steps |
| CX2-22 | accessibility-sweep intent | Returns 7 steps; step 1 is bridge_accessibility_report |
| CX2-23 | full-governance-audit intent | riskLevel is "low" |
| CX2-24 | unknown intent | Returns 1 step; step is a decision step with suggestedOptions |
| CX2-25 | glob parameter substitution | All ToolStep params containing "{{glob}}" are replaced with the actual glob |
| CX2-26 | projectRoot parameter substitution | All ToolStep params containing "{{projectRoot}}" are replaced |
| CX2-27 | dry_run=true | Plan has dryRun=true |
| CX2-28 | dry_run=false (default) | Plan has dryRun=false |
| CX2-29 | summary string | Summary is a non-empty string containing the intent type name |
| CX2-30 | successCriteria | successCriteria is a non-empty array of strings |

### 8.3 Scope Estimation Tests (planService.test.ts -- 5 tests)

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| CX2-31 | Valid projectRoot with .bridge/debt-history.json | healthScore and violationCount populated |
| CX2-32 | Valid projectRoot, no .bridge/ directory | All scope fields are null, no throw |
| CX2-33 | Valid projectRoot with tokens only | tokenCount populated, healthScore null |
| CX2-34 | estimatedScope string with data | String contains file count and violation estimate |
| CX2-35 | estimatedScope string without data | String contains fallback text |

### 8.4 Tool Handler Tests (plan.tool.test.ts -- 10 tests)

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| CX2-36 | Happy path -- valid intent | Returns { content: [{ type: 'text', text: '...' }] } |
| CX2-37 | Response is valid JSON | JSON.parse(result.content[0].text) does not throw |
| CX2-38 | Parsed response matches ExecutionPlan shape | Has intent, steps, estimatedScope, riskLevel, summary, successCriteria, dryRun |
| CX2-39 | Missing intent (required field) | Caller is responsible for validation; handler receives validated args |
| CX2-40 | Intent with glob | Plan steps use the provided glob |
| CX2-41 | Intent with projectRoot | Plan steps use the provided projectRoot |
| CX2-42 | Intent with dry_run=true | Plan.dryRun is true |
| CX2-43 | Falls back to config.projectRoot when args.projectRoot is absent | Uses config.projectRoot for scope estimation |
| CX2-44 | Unknown intent returns valid plan with 1 decision step | Fallback plan is structurally valid |
| CX2-45 | Every ToolStep.tool references a real Bridge tool name | All tool names in all templates exist in the known tool list |

### 8.5 Determinism Tests (planService.test.ts -- 3 tests)

| Test ID | Scenario | Assertion |
|---------|----------|-----------|
| CX2-46 | Same input produces same output | Two calls with identical args return deep-equal plans |
| CX2-47 | classifyIntent is a pure function | Does not mutate input string |
| CX2-48 | Performance | classifyIntent completes in < 5ms for 2000-char input |

Total: 48 tests minimum.

---

## 9. Commandment Checklist

- [x] **C4 Local-First Only** -- no external URLs, no network calls. Classification is pure string matching. Scope estimation reads local `.bridge/` files only.
- [x] **C8 Audit-First Execution** -- `bridge_plan` is itself an audit-first pattern: classify the task before choosing a model or execution strategy. The plan includes `bridge_audit` as the first tool step in every template.
- [x] **C12 Atomic Queuing** -- `bridge_plan` itself performs no file writes. Tool steps that reference `bridge_fix` or `bridge_ast_mutate` are executed by the calling agent, which routes through the existing atomic pipelines.
- [x] **C13 Deterministic Surgery** -- no regex on source code. Keyword matching uses `String.prototype.includes()`. The plan templates reference tools that use Babel AST traversal internally.
- [x] **C15 Granular AST Tools Only** -- every `ToolStep.tool` in every template references a real, registered Bridge MCP tool. No raw code generation.
- [x] **C16 In-Memory Validation** -- not directly applicable (this tool returns plans, not code mutations). The tools referenced in plans are subject to the existing validation loop when executed.

---

## 10. Implementation Order

### Group A (Parallel -- no dependencies between them)

1. **bridge-ast-surgeon**: Implement `bridge-mcp/src/core/planService.ts`
   - All types
   - INTENT_KEYWORDS constant
   - classifyIntent() function
   - 5 plan templates + unknown fallback
   - estimateScope() function
   - generatePlan() function

2. **bridge-ast-surgeon**: Implement `bridge-mcp/src/tools/plan.ts`
   - BRIDGE_PLAN_TOOL constant
   - handleBridgePlan() function
   - Re-exports

These two files can be written by the same agent in sequence (plan.ts depends on planService.ts). A single agent assignment is recommended.

### Group B (After Group A)

3. **bridge-test-writer**: Implement `bridge-mcp/src/__tests__/planService.test.ts` (CX2-01 through CX2-48 minus tool handler tests)
4. **bridge-test-writer**: Implement `bridge-mcp/src/__tests__/plan.tool.test.ts` (CX2-36 through CX2-45)

These can be written in parallel by the same agent. They only import from Group A files.

### Group C (Deferred -- after ING.3 clears server.ts)

5. **bridge-ast-surgeon**: Modify `bridge-mcp/src/server.ts`
   - Import plan tool
   - Register in ListTools
   - Add CallTool case

### Verification

6. **bridge-integration-validator**: Run full test suite + TSC.
   - `cd bridge-mcp && npm test`
   - `npx tsc --noEmit`
   - Report: `MCP: X/Y passing (Z new) | TSC: 0 errors`

---

## 11. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Ambiguous intents classify to wrong type (e.g., "fix colors" could be token-migration or debt-remediation) | Medium | -- | Scoring algorithm with primary/secondary keyword weighting. Ambiguous intents fall to the higher-scoring type deterministically. The "unknown" fallback exists for genuinely ambiguous cases. |
| Plan templates reference tool parameters that change in a future phase | Low | C15 | Templates use `{{placeholder}}` substitution for dynamic values. Tool names reference the stable registered tool surface. If a tool's inputSchema changes, only the template needs updating. |
| `estimateScope()` reads files synchronously, blocking the event loop | Low | C4 | Capped at 500 file entries via `readdir`. `.bridge/` files are small (< 100KB). Total I/O budget < 20ms. If this becomes a problem, the function can be made async without changing the public API. |
| ING.3 swarm modifies audit tool schema in server.ts | Low | -- | Deferred registration. The plan service and tool handler are standalone modules with no dependency on server.ts. Registration is a 3-line addition after ING.3 completes. |
| Agent misinterprets `{{placeholder}}` syntax and passes it literally | Medium | -- | The `generatePlan()` function performs substitution before returning. No placeholders appear in the returned `ExecutionPlan`. This is a build-time concern, not a runtime one. |

---

## 12. Deferred server.ts Registration -- Handoff Note

The `server.ts` registration is deferred because the ING.3 swarm currently claims `server.ts` as a MODIFY target (see `.bridge-context/ACTIVE-SWARM-TERRITORY.md`). When ING.3 is complete and its territory is released:

1. Add the import line for `plan.ts`
2. Add `BRIDGE_PLAN_TOOL` to the `ListToolsRequestSchema` handler's tools array
3. Add a `case 'bridge_plan'` to the `CallToolRequestSchema` handler's switch
4. Run `cd bridge-mcp && npm test` and `npx tsc --noEmit` to verify no regressions
5. Update `ACTIVE-SWARM-TERRITORY.md` to release CX.2 territory

This is a 3-line code change with zero architectural risk. It does not warrant a separate contract.

---

## 13. Implementation Notes for Phase 2 Agent

### Import Conventions

Follow the existing ESM import pattern with `.js` extensions:
```typescript
import { classifyIntent, generatePlan } from '../core/planService.js'
```

### CJS/ESM Interop

No Babel or CJS interop needed in these files. `planService.ts` uses only `node:fs` and `node:path`, which are native ESM modules.

### Error Handling

`estimateScope()` must never throw. All file reads must be wrapped in try/catch with null fallbacks. Follow the `safeReadJson` pattern from `sessionContext.ts`.

### Do Not Touch

- `bridge-mcp/src/server.ts` -- deferred (ING.3 territory)
- `bridge-mcp/src/types.ts` -- no new shared types needed
- Any file in `electron/` or `src/` -- this is a pure MCP engine addition
- Any existing tool handler -- plan templates reference tools by name, they do not import or modify them

### Template Parameterization

The `generatePlan()` function must replace all `{{placeholder}}` strings in the template before returning. This is a simple string replacement on the serialized template. The returned `ExecutionPlan` must contain zero placeholder strings.

Example:
```typescript
// In generatePlan():
const glob = params.glob ?? '**/*.tsx'
const projectRoot = params.projectRoot ?? ''

// Deep-clone the template, then replace placeholders in params
for (const step of plan.steps) {
    if (step.kind === 'tool') {
        for (const [key, value] of Object.entries(step.params)) {
            if (typeof value === 'string') {
                step.params[key] = value
                    .replace('{{glob}}', glob)
                    .replace('{{projectRoot}}', projectRoot)
                    .replace('{{filePath}}', '(per-file -- iterate over audit results)')
            }
        }
    }
}
```

### Known Tool Names for Validation

The complete list of tool names that may appear in plan templates:

```typescript
const KNOWN_BRIDGE_TOOLS = new Set([
    'bridge_status',
    'bridge_audit',
    'bridge_fix',
    'bridge_ast_mutate',
    'bridge_debt_report',
    'bridge_sync_tokens',
    'bridge_accessibility_report',
    'bridge_query_registry',
    'bridge_ingest_figma',
    'audit_ui_component',
    'hydrate_figma_data',
    'read_design_intent',
    'bridge_audit_report',
])
```

Test CX2-45 should validate that every `ToolStep.tool` in every template exists in this set.
