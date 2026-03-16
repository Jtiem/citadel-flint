/**
 * planService.ts — bridge-mcp/src/core/planService.ts
 *
 * Intent classification + execution plan generation for the bridge_plan MCP tool.
 *
 * Design principles:
 *   - Classification is deterministic keyword/pattern matching (no LLM call)
 *   - Runs synchronously in under 5ms on any input string up to 2,000 characters
 *   - Scope estimation reads .bridge/ files only; never throws
 *   - All plan templates are module-level constants; parameterized at call time
 *   - Returned plans contain zero {{placeholder}} strings
 */

import fs from 'node:fs'
import path from 'node:path'

// ── Intent Classification Types ───────────────────────────────────────────────

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

// ── Plan Step Types ───────────────────────────────────────────────────────────

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

/**
 * A single step in an execution plan. Steps are either tool calls or
 * decision points that require human judgment.
 */
export type PlanStep = ToolStep | DecisionStep

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
     *   "~47 files matching src/components/**\/*.tsx, ~200 estimated violations"
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
     * Default: "**\/*.tsx" (all TSX files).
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

// ── Scope Estimation Types ────────────────────────────────────────────────────

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

// ── Intent Keyword Tables ─────────────────────────────────────────────────────

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

// ── Intent Classification ─────────────────────────────────────────────────────

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

// ── Plan Templates ────────────────────────────────────────────────────────────

// These are the raw templates with {{placeholder}} syntax. They are deep-cloned
// and parameterized in generatePlan() before being returned to callers.

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

// ── Plan Metadata ─────────────────────────────────────────────────────────────

interface PlanMeta {
    riskLevel: ExecutionPlan['riskLevel']
    successCriteria: string[]
}

const PLAN_META: Record<PlanIntentType, PlanMeta> = {
    'token-migration': {
        riskLevel: 'medium',
        successCriteria: [
            'Zero color-drift violations (MITH-001) remain in scoped files',
            'Health score improved compared to baseline',
            'No new violations introduced by the migration',
        ],
    },
    'accessibility-sweep': {
        riskLevel: 'medium',
        successCriteria: [
            'Zero critical (export-blocking) accessibility violations remain',
            'All auto-fixable A11Y rules resolved',
            'Remaining manual fixes documented with specific component + rule',
        ],
    },
    'full-governance-audit': {
        riskLevel: 'low',
        successCriteria: [
            'Health score and grade are recorded in debt-history.json',
            'All auto-fixable violations resolved (if fix path was chosen)',
            'Remaining violations categorized with clear next-step per item',
        ],
    },
    'figma-sync': {
        riskLevel: 'medium',
        successCriteria: [
            'Local token set matches accepted Figma state',
            'No new violations introduced by the sync',
            'Health score stable or improved after sync',
        ],
    },
    'debt-remediation': {
        riskLevel: 'medium',
        successCriteria: [
            'Health score improved by at least 10 points from baseline',
            'Grade improved by at least one letter (e.g., D to C)',
            'No new violations introduced by remediation fixes',
            'Debt history updated with before/after snapshots',
        ],
    },
    'unknown': {
        riskLevel: 'low',
        successCriteria: [
            'User clarifies intent and re-invokes bridge_plan with a more specific request',
        ],
    },
}

// ── Scope Estimation ──────────────────────────────────────────────────────────

interface DebtHistoryShape {
    snapshots?: Array<{ score?: number; grade?: string; violationCount?: number; totalViolations?: number }>
}

function safeReadJson<T>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) return null
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

/**
 * Count files matching a given extension under a directory, capped at 500.
 * Uses synchronous readdir recursion. Never throws.
 */
function countFilesWithExtensions(dir: string, extensions: string[], cap: number): number {
    let count = 0

    function walk(currentDir: string): void {
        if (count >= cap) return
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true })
            for (const entry of entries) {
                if (count >= cap) return
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
                const fullPath = path.join(currentDir, entry.name)
                if (entry.isDirectory()) {
                    walk(fullPath)
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name)
                    if (extensions.includes(ext)) {
                        count++
                    }
                }
            }
        } catch {
            // Unreadable directory — skip silently
        }
    }

    walk(dir)
    return Math.min(count, cap)
}

/**
 * Estimate scope by reading .bridge/ files. Never throws.
 * Falls back gracefully when files are missing.
 *
 * Files read:
 *   .bridge/debt-history.json  -- latest snapshot for violation count, score, grade
 *   .bridge/design-tokens.json -- token count
 *
 * File counting: uses synchronous readdir recursion (capped at 500).
 *
 * @param projectRoot - Absolute path to the project root containing .bridge/
 * @param glob        - Optional glob pattern (used for display only)
 * @returns           - ScopeEstimate (never throws)
 */
export function estimateScope(projectRoot: string, glob?: string): ScopeEstimate {
    const bridgeDir = path.join(projectRoot, '.bridge')

    // Read debt-history.json for health score + violation count
    const debtHistoryPath = path.join(bridgeDir, 'debt-history.json')
    const debtHistory = safeReadJson<DebtHistoryShape>(debtHistoryPath)

    let healthScore: number | null = null
    let healthGrade: string | null = null
    let violationCount: number | null = null

    if (debtHistory && Array.isArray(debtHistory.snapshots) && debtHistory.snapshots.length > 0) {
        const latest = debtHistory.snapshots[debtHistory.snapshots.length - 1]
        if (typeof latest.score === 'number') healthScore = latest.score
        if (typeof latest.grade === 'string') healthGrade = latest.grade
        // Support both violationCount and totalViolations field names
        const vc = latest.violationCount ?? latest.totalViolations
        if (typeof vc === 'number') violationCount = vc
    }

    // Read design-tokens.json for token count
    const tokensPath = path.join(bridgeDir, 'design-tokens.json')
    const tokens = safeReadJson<unknown[]>(tokensPath)
    const tokenCount = Array.isArray(tokens) ? tokens.length : null

    // Count matching files
    let fileCount: number | null = null
    try {
        if (fs.existsSync(projectRoot)) {
            // Determine which extensions to count based on the glob hint
            const extensions = glob?.includes('.jsx')
                ? ['.tsx', '.jsx', '.ts', '.js']
                : ['.tsx', '.ts']
            fileCount = countFilesWithExtensions(projectRoot, extensions, 500)
        }
    } catch {
        fileCount = null
    }

    return {
        fileCount,
        violationCount,
        healthScore,
        healthGrade,
        tokenCount,
    }
}

// ── Placeholder Substitution ──────────────────────────────────────────────────

const FILE_PATH_PLACEHOLDER = '(per-file -- iterate over audit results)'

function substituteParams(params: Record<string, unknown>, glob: string, projectRoot: string): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') {
            result[key] = value
                .replace('{{glob}}', glob)
                .replace('{{projectRoot}}', projectRoot)
                .replace('{{filePath}}', FILE_PATH_PLACEHOLDER)
        } else {
            result[key] = value
        }
    }
    return result
}

function parameterizePlan(steps: PlanStep[], glob: string, projectRoot: string): PlanStep[] {
    return steps.map(step => {
        if (step.kind === 'tool') {
            return {
                ...step,
                params: substituteParams(step.params, glob, projectRoot),
            }
        }
        return { ...step }
    })
}

// ── Template Selection ────────────────────────────────────────────────────────

function getTemplate(intentType: PlanIntentType): PlanStep[] {
    switch (intentType) {
        case 'token-migration': return TOKEN_MIGRATION_TEMPLATE
        case 'accessibility-sweep': return ACCESSIBILITY_SWEEP_TEMPLATE
        case 'full-governance-audit': return FULL_GOVERNANCE_AUDIT_TEMPLATE
        case 'figma-sync': return FIGMA_SYNC_TEMPLATE
        case 'debt-remediation': return DEBT_REMEDIATION_TEMPLATE
        case 'unknown': return UNKNOWN_INTENT_TEMPLATE
    }
}

// ── Summary Generation ────────────────────────────────────────────────────────

function buildSummary(
    intentType: PlanIntentType,
    stepCount: number,
    scope: ScopeEstimate | null,
): string {
    const typeLabel: Record<PlanIntentType, string> = {
        'token-migration': 'token-migration',
        'accessibility-sweep': 'accessibility-sweep',
        'full-governance-audit': 'full-governance-audit',
        'figma-sync': 'figma-sync',
        'debt-remediation': 'debt-remediation',
        'unknown': 'unknown',
    }

    const label = typeLabel[intentType]

    if (intentType === 'unknown') {
        return 'Plan: intent could not be classified. Please clarify your request.'
    }

    const filesPart = scope?.fileCount != null ? `across ~${scope.fileCount} files ` : ''
    return `Plan: ${label} ${filesPart}in ${stepCount} steps.`
}

// ── Scope String Generation ───────────────────────────────────────────────────

function buildScopeString(scope: ScopeEstimate | null, glob: string, projectRoot?: string): string {
    if (!projectRoot || scope === null) {
        return `Files matching ${glob} (scope estimate unavailable -- no .bridge/ data found)`
    }

    const parts: string[] = []

    if (scope.fileCount != null) {
        parts.push(`~${scope.fileCount} files matching ${glob}`)
    } else {
        parts.push(`Files matching ${glob}`)
    }

    if (scope.violationCount != null) {
        parts.push(`~${scope.violationCount} estimated violations`)
    }

    if (scope.healthScore != null && scope.healthGrade != null) {
        parts.push(`health score ${scope.healthScore} (${scope.healthGrade})`)
    } else if (scope.healthScore != null) {
        parts.push(`health score ${scope.healthScore}`)
    }

    // If we only have file count or the bridge dir exists but has no data
    if (parts.length === 1 && scope.fileCount === null && scope.violationCount === null) {
        return `Files matching ${glob} (scope estimate unavailable -- no .bridge/ data found)`
    }

    return parts.join(', ')
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

interface GeneratePlanOptions {
    glob?: string
    projectRoot?: string
    dryRun?: boolean
}

/**
 * Generate a structured execution plan from a natural language intent.
 *
 * Steps:
 *   1. Classify the intent
 *   2. Select the matching template
 *   3. Estimate scope (if projectRoot provided)
 *   4. Parameterize the template (substitute {{placeholder}} tokens)
 *   5. Build the ExecutionPlan
 *
 * @param intent  - Natural language description of the task
 * @param options - Optional glob, projectRoot, dryRun flag
 * @returns       - Complete ExecutionPlan with no placeholder strings
 */
export function generatePlan(intent: string, options: GeneratePlanOptions = {}): ExecutionPlan {
    const glob = options.glob ?? '**/*.tsx'
    const projectRoot = options.projectRoot ?? ''
    const dryRun = options.dryRun ?? false

    // 1. Classify
    const planIntent = classifyIntent(intent)

    // 2. Select template
    const rawTemplate = getTemplate(planIntent.type)

    // 3. Estimate scope
    const scope: ScopeEstimate | null = projectRoot
        ? estimateScope(projectRoot, glob)
        : null

    // 4. Parameterize
    const steps = parameterizePlan(rawTemplate, glob, projectRoot)

    // 5. Build plan
    const meta = PLAN_META[planIntent.type]
    const summary = buildSummary(planIntent.type, steps.length, scope)
    const estimatedScope = buildScopeString(scope, glob, projectRoot || undefined)

    return {
        intent: planIntent,
        steps,
        estimatedScope,
        riskLevel: meta.riskLevel,
        summary,
        successCriteria: meta.successCriteria,
        dryRun,
    }
}
