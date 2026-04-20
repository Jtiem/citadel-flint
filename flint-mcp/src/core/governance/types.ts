/**
 * Governance telemetry types — flint-mcp/src/core/governance/types.ts
 *
 * Shared type definitions for the governance_events table and
 * GovernanceEventService. Used by GOV.1 (Rule Provenance), GOV.2 (Override
 * Telemetry), GOV.4 (Anomaly Detection), and the Glass Governance Dashboard.
 */

// ── GOV.1: Rule Provenance types ─────────────────────────────────────────────

/**
 * Regulatory source authority that a governance rule traces back to.
 * Used by GOV.1 (Rule Provenance) to attach compliance metadata to violations.
 */
export type SourceAuthority =
    | 'WCAG 2.1 AA'
    | 'WCAG 2.2 AA'
    | 'SOC2'
    | 'FDA SaMD'
    | 'HIPAA'
    | 'Section 508'
    | 'Flint Design System'
    | 'Custom'
    // RUNTIME.1 (appended 2026-04-18) — findings produced by the axe-core
    // DOM-layer runtime adapter. Consumers that render authority as a string
    // handle this value without code change; dedup logic in
    // useMergedA11yFindings collapses AST + runtime pairs into multi-authority
    // rows when (mappedWardenRuleId, elementId) matches.
    | 'runtime-dom'

/**
 * Provenance metadata for a single governance rule.
 * Resolved from the static ruleProvenanceRegistry keyed by ruleId.
 */
export interface RuleProvenance {
    /** The rule identifier, e.g. 'A11Y-001', 'MITHRIL-TYP-002'. */
    ruleId: string
    /** Human-readable rule name. */
    ruleName: string
    /** Which regulatory body or standard this rule satisfies. */
    sourceAuthority: SourceAuthority
    /** Specific clause or section reference, e.g. 'WCAG 2.1 SC 1.1.1'. */
    regulatoryReference: string
    /** ISO 8601 date when the rule definition was last reviewed. */
    lastUpdated: string
    /** Brief rationale for why this rule exists. */
    rationale: string
}

/**
 * Compliance summary for a single audit, aggregating provenance across
 * all detected violations. Used by ExportModal "Compliance Summary" section.
 */
export interface ComplianceSummary {
    /** Total violation count. */
    totalViolations: number
    /** Breakdown by source authority. */
    byAuthority: Record<SourceAuthority, number>
    /** Breakdown by severity. */
    bySeverity: Record<'critical' | 'warning' | 'info', number>
    /** Full provenance records for each unique violated rule. */
    violatedRules: RuleProvenance[]
    /** ISO 8601 timestamp when this summary was generated. */
    generatedAt: string
}

/**
 * Rule category for filtering provenance entries.
 * Maps to the linter domain that owns the rule.
 */
export type RuleCategory =
    | 'color'
    | 'typography'
    | 'spacing'
    | 'shadow'
    | 'opacity'
    | 'names-labels'
    | 'keyboard'
    | 'structure'
    | 'aria'
    | 'landmarks'
    | 'contrast'
    | 'forms'
    | 'export-gate'
    | 'custom'

/**
 * Extended RuleProvenance with category for filtering.
 * Used by the provenance registry query API.
 */
export interface RuleProvenanceEntry extends RuleProvenance {
    /** Linter domain category for filtering. */
    category: RuleCategory
    /** Default severity assigned by the rule definition. */
    defaultSeverity: 'critical' | 'warning' | 'info'
    /** Brief human-readable description of what the rule checks. */
    description: string
}

/**
 * Full structured audit report returned by flint_audit_report.
 * Includes file path, provenance-annotated violations, and compliance summary.
 */
export interface AuditReport {
    /** Absolute path to the audited file. */
    filePath: string
    /** ISO 8601 timestamp when this report was generated. */
    timestamp: string
    /** Provenance-annotated violations. */
    violations: Array<{
        flintId: string
        ruleId: string
        message: string
        severity: string
        provenance: RuleProvenance
    }>
    /** Aggregated compliance summary. */
    complianceSummary: ComplianceSummary
}

export interface GovernanceEvent {
    id: string
    timestamp: string
    eventType: 'violation' | 'override' | 'export_block' | 'auto_fix' | 'rule_change' | 'token_extraction'
    ruleId: string
    severity: 'critical' | 'warning' | 'info'
    nodeId?: string
    filePath: string
    message?: string
    sessionId?: string
    actor: string
    metadata: Record<string, unknown>
}

export interface EventFilters {
    since?: string
    until?: string
    ruleId?: string
    eventType?: GovernanceEvent['eventType']
    filePath?: string
    severity?: GovernanceEvent['severity']
    limit?: number
    offset?: number
}

/**
 * Mutations Ledger types — INFRA.2
 *
 * MutationLedgerEntry records every AST mutation committed through Flint MCP,
 * providing full forensic provenance for downstream consumers:
 *   - V.2-mp  (Mutation Provenance Ledger)
 *   - V.1-rs  (Risk Scoring)
 *   - GOV.3   (Session Validation)
 *   - Glass Governance Dashboard
 */

export type MutationOperationType =
    | 'updateProp'
    | 'updateClassName'
    | 'updateTextContent'
    | 'move'
    | 'inject'
    | 'fixToken'
    | 'assembleLayout'
    | 'insertNode'
    | 'deleteNode'
    | 'wrapNode'
    | 'addClass'
    | 'removeClass'
    | 'crossFileMove'

export type MutationSource = 'ai_orchestrator' | 'mcp_tool' | 'user_action' | 'auto_fix'

export interface MutationLedgerEntry {
    id: string
    timestamp: string
    filePath: string
    nodeId?: string
    operationType: MutationOperationType
    source: MutationSource
    sourceIntentHash?: string
    registryArtifactId?: string
    beforeSnapshot?: string
    afterSnapshot?: string
    sessionId?: string
    approvedBy?: string
    justification?: string
    metadata: Record<string, unknown>
}

export interface MutationFilters {
    since?: string
    until?: string
    filePath?: string
    nodeId?: string
    operationType?: MutationOperationType
    source?: MutationSource
    sessionId?: string
    limit?: number
    offset?: number
}

// ── V.2-mp: Mutation Provenance types ─────────────────────────────────────────

/**
 * Who or what caused a mutation to be applied.
 * - 'human'     — direct UI interaction in Flint Glass
 * - 'agent'     — AI agent call via MCP tool (flint_ast_mutate)
 * - 'auto-heal' — IngestionAuditor tier-1 heal pass
 * - 'auto-fix'  — flint_fix tool or GovernanceOverlay auto-fix
 * - 'import'    — bulk import / scaffolding operation
 */
export type ProvenanceSource = 'human' | 'agent' | 'auto-heal' | 'auto-fix' | 'import'

/**
 * Full provenance record for a single mutation.
 */
export interface MutationProvenance {
    /** UUID — same as the mutations_ledger.id for the referenced mutation. */
    mutationId: string
    /** ISO 8601 UTC timestamp when provenance was recorded. */
    timestamp: string
    /** Who or what triggered the mutation. */
    provenanceSource: ProvenanceSource
    /** MCP client identifier, tool name, or agent ID. Null for human actions. */
    provenanceAgentId: string | null
    /** Session UUID shared with the mutations_ledger row. */
    provenanceSessionId: string | null
    /** AI reasoning text, if the mutation was agent-driven. */
    provenanceReasoning: string | null
    /** 0–1 confidence score supplied by the AI agent. */
    provenanceConfidence: number | null
}

/**
 * Aggregate summary returned by getProvenanceSummary().
 */
export interface ProvenanceSummary {
    /** Total provenance records in the table. */
    total: number
    /** Mutation count keyed by ProvenanceSource. */
    bySource: Record<ProvenanceSource, number>
    /** Mutations recorded in the last 24 hours. */
    last24hCount: number
    /** The agent IDs with the highest mutation counts (top 5). */
    topAgents: Array<{ agentId: string; count: number }>
}

/**
 * Single entry in a file's audit trail.
 */
export interface AuditTrailEntry {
    mutationId: string
    timestamp: string
    provenanceSource: ProvenanceSource
    provenanceAgentId: string | null
    provenanceSessionId: string | null
    provenanceReasoning: string | null
    provenanceConfidence: number | null
    /** Corresponding ledger fields (joined from mutations_ledger). */
    filePath: string
    operationType: string
    nodeId: string | null
}

// ── V.1-rs: Mutation Risk Scoring types ───────────────────────────────────────

/**
 * Risk tier for a scored mutation.
 *
 *   low      (0-25)   — Routine change, no additional scrutiny needed.
 *   medium   (26-50)  — Standard review recommended.
 *   high     (51-75)  — Manual review required before export.
 *   critical (76-100) — Should trigger governance alert.
 */
export type RiskTier = 'low' | 'medium' | 'high' | 'critical'

/**
 * Single factor that contributed to a mutation's risk score.
 * Stored as a JSON array in mutation_risk_scores.factors_json.
 */
export interface RiskFactor {
    /** Machine-readable factor name. */
    name: string
    /** Weight applied to this factor (0-1, all weights sum to 1). */
    weight: number
    /** Raw value on the 0-100 scale before weighting. */
    rawValue: number
    /** Weighted contribution to the final score (rawValue * weight). */
    contribution: number
    /** Human-readable description of what drove this value. */
    description: string
}

/**
 * Full risk score record for a single mutation.
 */
export interface RiskScore {
    /** UUID — same as mutations_ledger.id for the referenced mutation. */
    mutationId: string
    /** Composite score, 0-100 (higher = riskier). */
    score: number
    /** Tier derived from the composite score. */
    tier: RiskTier
    /** Breakdown of each contributing factor. */
    factors: RiskFactor[]
    /** ISO 8601 UTC timestamp when this score was computed. */
    scoredAt: string
}

/**
 * Aggregated risk profile for a single file.
 * Produced by RiskScoringService.getFileRiskProfile().
 */
export interface FileRiskProfile {
    /** Absolute or relative file path. */
    filePath: string
    /** Mean risk score across all scored mutations for this file. */
    meanScore: number
    /** Maximum risk score recorded for this file. */
    maxScore: number
    /** Total number of scored mutations for this file. */
    mutationCount: number
    /**
     * Risk trend over time.
     *   'rising'  — second-half mean > first-half mean by more than 5 points.
     *   'falling' — second-half mean < first-half mean by more than 5 points.
     *   'stable'  — within 5-point range, or fewer than 4 mutations.
     */
    trend: 'rising' | 'falling' | 'stable'
}

/**
 * Project-wide risk summary.
 * Produced by RiskScoringService.getProjectRiskSummary().
 */
export interface ProjectRiskSummary {
    /** Total number of mutations that have been scored. */
    totalScored: number
    /** Count of scored mutations in each tier. */
    distribution: Record<RiskTier, number>
    /** Top-5 files ordered by mean risk score descending. */
    riskiestFiles: Array<{ filePath: string; meanScore: number }>
    /** Top-5 agent IDs ordered by mean risk score descending. */
    riskiestAgents: Array<{ agentId: string; meanScore: number }>
}

// ── GOV.3: Session Validation types ───────────────────────────────────────────

/**
 * An individual error or warning produced by a session-level validation check.
 *
 *   code     — machine-readable check identifier (e.g. 'DUPLICATE_FLINT_ID')
 *   message  — human-readable description suitable for display to an agent
 *   nodeId   — the data-flint-id of the offending node, when applicable
 *   severity — 'error' blocks correctness; 'warning' is advisory
 */
export interface SessionValidationError {
    code: string
    message: string
    nodeId?: string
    severity: 'warning' | 'error'
}

/**
 * Result returned by validateSessionState().
 *
 *   valid          — true only when errors array is empty (warnings do not affect validity)
 *   errors         — all validation errors and warnings found in this pass
 *   validatedAt    — ISO 8601 UTC timestamp when validation ran
 *   mutationCount  — number of session mutations supplied to the validator
 */
export interface SessionValidationResult {
    valid: boolean
    errors: SessionValidationError[]
    validatedAt: string
    mutationCount: number
}

// ── V.1-rs: Function-based MRS (Mutation Risk Score) types ────────────────────
//
// These types support the lightweight, stateless scoreMutation() function API
// introduced in V.1-rs. They use a 0.0–1.0 scale and green/amber/red tiers,
// distinct from the DB-backed RiskScoringService class (0-100, low/medium/high/critical).

/**
 * Three-tier risk classification for the function-based MRS API (0.0–1.0 scale).
 *
 *   green  (0.0–0.30)  — auto-approve eligible, low blast radius
 *   amber  (0.31–0.69) — requires human review before executing
 *   red    (0.70–1.0)  — high-impact structural change, senior sign-off recommended
 */
export type MRSTier = 'green' | 'amber' | 'red'

/**
 * A single contributing factor in a MutationRiskScore breakdown.
 * Used by the function-based scoreMutation() API (V.1-rs).
 */
export interface MRSFactor {
    /** Machine-readable factor name (e.g. 'opWeight', 'blastRadius'). */
    name: string
    /** Weight applied to this factor in the MRS formula (sums to 1.0 across all factors). */
    weight: number
    /** Final weighted contribution to the score (weight × raw_value). */
    contribution: number
    /** Human-readable explanation of what drove this value. */
    rationale: string
}

/**
 * Full risk score result returned by the stateless scoreMutation() function.
 * Score is 0.0–1.0 (higher = riskier). Tier maps to the MRSTier thresholds.
 */
export interface MutationRiskScore {
    /** Composite risk score, 0.0–1.0 (higher = riskier). */
    score: number
    /** Tier derived from the composite score. */
    tier: MRSTier
    /** Breakdown of each contributing factor. */
    factors: MRSFactor[]
    /** Human-readable action recommendation for the caller. */
    recommendation: string
}

/**
 * Input to the stateless scoreMutation() function.
 * All fields except opType are optional; defaults apply when omitted.
 */
export interface RiskScoringInput {
    /** The mutation operation type string (e.g. 'updateClassName', 'assembleLayout'). */
    opType: string
    /**
     * Number of AST nodes potentially affected by this mutation.
     * Used to compute the blast radius factor.
     * Defaults to 1 when omitted.
     */
    affectedNodeCount?: number
    /** Absolute path to the file being mutated. Used for familiarity scoring. */
    filePath?: string
    /**
     * Whether the mutation is being applied in the context of a known violation.
     * true → amber severity factor; false/undefined → 0 severity contribution.
     */
    hasViolationContext?: boolean
    /**
     * Absolute path to the project root. When provided, the service reads
     * .flint/provenance.db to determine file familiarity.
     * When omitted, familiarity factor defaults to 0.1 (neutral).
     */
    projectRoot?: string
}

// ── GOV.2: Override Telemetry types ────────────────────────────────────────────

/**
 * A single override event captured when a governance rule is bypassed,
 * disabled, or severity-downgraded.
 *
 * Stored in the `override_events` SQLite table (GOV.2).
 */
export interface OverrideEvent {
    /** UUID primary key. */
    id: string
    /** The data-flint-id of the affected node, if applicable. */
    nodeId: string | null
    /** The governance rule that was overridden (e.g. 'CLR-001', 'A11Y-003'). */
    ruleId: string
    /** Session UUID for the session in which the override occurred. */
    sessionId: string | null
    /** Agent or actor identifier that performed the override. */
    agentId: string | null
    /** ISO 8601 UTC timestamp when the override was recorded. */
    timestamp: string
    /** Absolute path to the project root for scoping. */
    projectRoot: string
    /** Human-readable reason for the override, if provided. */
    reason: string | null
}

/**
 * Aggregate summary of override telemetry for a project.
 * Returned by OverrideTelemetryService.getOverrideSummary().
 */
export interface OverrideSummary {
    /** Total override events in the database for this project. */
    totalOverrides: number
    /** Override count grouped by rule ID (top 10 by count). */
    byRule: Array<{ ruleId: string; count: number }>
    /** Override count grouped by session ID (top 10 by count). */
    bySession: Array<{ sessionId: string; count: number }>
    /** Overrides recorded in the last 24 hours. */
    last24hCount: number
    /** ISO 8601 timestamp of the most recent override, or null if none exist. */
    lastOverrideAt: string | null
}

// ── GOV.4: Anomaly Detection types ──────────────────────────────────────────

/**
 * Types of statistical anomalies that the detection engine can flag.
 */
export type AnomalyType =
    | 'override_spike'
    | 'violation_surge'
    | 'risk_drift'
    | 'velocity_spike'
    | 'agent_behavior_change'
    | 'drift_regression'

/**
 * Severity of a detected anomaly, derived from how far the observed
 * value exceeds the baseline threshold.
 *
 *   info     — above 2σ but below 3σ (advisory)
 *   warning  — at or above 3σ threshold
 *   critical — at or above 4σ threshold
 */
export type AnomalySeverity = 'info' | 'warning' | 'critical'

/**
 * Baseline statistics computed from historical data within a time window.
 * Used as the reference point for anomaly detection.
 */
export interface BaselineStats {
    /** ISO 8601 timestamp when the baseline was computed. */
    computedAt: string
    /** Number of days in the baseline window. */
    windowDays: number
    /** Number of data points (sessions/days) in the baseline. */
    dataPoints: number
    /** Override events: mean and stddev per period. */
    overrides: { mean: number; stddev: number }
    /** Violation events: mean and stddev per period. */
    violations: { mean: number; stddev: number }
    /** Mutation velocity (mutations/hour): mean and stddev. */
    mutationVelocity: { mean: number; stddev: number }
    /** Average MRS risk score: mean and stddev. */
    avgRiskScore: { mean: number; stddev: number }
}

/**
 * A single detected anomaly, persisted in the anomaly_history table.
 */
export interface Anomaly {
    /** UUID primary key. */
    id: string
    /** The type of anomaly detected. */
    type: AnomalyType
    /** Severity derived from sigma distance. */
    severity: AnomalySeverity
    /** ISO 8601 timestamp when the anomaly was detected. */
    detectedAt: string
    /** The observed value that triggered the anomaly. */
    observedValue: number
    /** The baseline mean for this metric. */
    baselineMean: number
    /** The baseline standard deviation for this metric. */
    baselineStddev: number
    /** The threshold that was exceeded (mean + 3σ or mean * 1.5 when σ=0). */
    threshold: number
    /** Human-readable description of the anomaly. */
    message: string
    /** Absolute path to the project root. */
    projectRoot: string
    /** Optional agent ID (for agent_behavior_change type). */
    agentId: string | null
}

// ── AGV.2: Agent Risk Dashboard types ──────────────────────────────────────────

/**
 * Risk profile for a single agent, aggregated from mutation provenance,
 * risk scores, and override events.
 */
export interface AgentRiskProfile {
    /** Agent identifier (from provenance_agent_id). */
    agentId: string
    /** Total mutations attributed to this agent. */
    mutationCount: number
    /** Mean risk score across all scored mutations (0-100 scale). */
    avgRiskScore: number
    /** Count of mutations in the 'critical' (76-100) risk tier. */
    redCount: number
    /** Count of mutations in the 'high' (51-75) risk tier. */
    amberCount: number
    /** Count of mutations in the 'low' + 'medium' (0-50) risk tier. */
    greenCount: number
    /** Number of governance overrides attributed to this agent. */
    overrideCount: number
    /** ISO 8601 timestamp of the agent's most recent mutation. */
    lastActive: string | null
}

/**
 * Aggregate agent risk summary for the AGV.2 dashboard.
 * Returned by AgentRiskService.getAgentRiskSummary().
 */
export interface AgentRiskSummary {
    /** Per-agent risk profiles, ordered by avgRiskScore descending. */
    agents: AgentRiskProfile[]
    /** Top 5 riskiest agents by avgRiskScore. */
    topRiskiest: AgentRiskProfile[]
    /** Time period covered by this summary (e.g. 'last_7_days'). */
    period: string
}

// ── DBOM.1: Design Bill of Materials (Governance Layer) ─────────────────────

/**
 * Options for the governance-enriched DBOM generator.
 */
export interface DBOMOptions {
    /** Output format. 'json' is the default DBOM. 'cyclonedx' wraps in CycloneDX-extended envelope. */
    format?: 'json' | 'cyclonedx'
    /** When true, includes per-component mutation provenance data. Default: false. */
    includeProvenance?: boolean
    /** When true, skips writing to .flint/dbom.json. Default: false. */
    dryRun?: boolean
    /**
     * Optional glob pattern to scope the file scan (e.g. "demos/**\/*.tsx").
     * When omitted, all TSX/TS files under src/ (or projectRoot) are scanned.
     * Paths are matched against the relative path from projectRoot.
     */
    glob?: string
}

/**
 * A design token entry in the governance DBOM with compliance status.
 */
export interface DBOMTokenEntry {
    /** Dot-separated token path (e.g. 'colors.brand.primary'). */
    name: string
    /** Raw token value (e.g. '#1A73E8', '16px'). */
    value: string
    /** Token category/type (e.g. 'color', 'dimension', 'fontFamily'). */
    category: string
    /** Relative file paths where this token is referenced. */
    usedInFiles: string[]
    /**
     * Compliance status of this token:
     *   'compliant'  — no violations reference this token's domain
     *   'drifted'    — at least one violation references a value this token should govern
     *   'unknown'    — unable to determine (e.g. token not referenced anywhere)
     */
    complianceStatus: 'compliant' | 'drifted' | 'unknown'
}

/**
 * A component entry in the governance DBOM with audit and provenance data.
 */
export interface DBOMComponentEntry {
    /** Component name (PascalCase, inferred from filename). */
    name: string
    /** Absolute path to the source file. */
    filePath: string
    /** Origin of the component. */
    source: 'figma' | 'flint' | 'handwritten'
    /** Audit result for this component. */
    auditResult: {
        /** Total violation count (Mithril + A11y). */
        violations: number
        /** Component health score (0-100). */
        score: number
    }
    /** Mutation provenance data. Present only when includeProvenance is true. */
    provenance?: DBOMComponentProvenance
}

/**
 * Provenance data for a component in the DBOM.
 */
export interface DBOMComponentProvenance {
    /** Total mutations recorded for this file. */
    totalMutations: number
    /** Breakdown by provenance source. */
    bySource: Record<string, number>
    /** Most recent mutation timestamp, or null if none. */
    lastMutatedAt: string | null
}

/**
 * Project-wide compliance posture in the governance DBOM.
 */
export interface DBOMPosture {
    /** Health score (0-100). */
    healthScore: number
    /** Letter grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60). */
    grade: string
    /** Total design tokens in the project. */
    totalTokens: number
    /** Total components scanned. */
    totalComponents: number
    /** Total violations (Mithril + A11y). */
    totalViolations: number
    /** Violation count grouped by regulatory authority. */
    complianceByAuthority: Record<string, number>
}

/**
 * The full governance-enriched Design Bill of Materials.
 */
export interface DBOM {
    /** Schema version. */
    version: '1.0'
    /** ISO 8601 UTC timestamp when this DBOM was generated. */
    generatedAt: string
    /** Flint MCP server version identifier. */
    flintVersion: string
    /** Absolute path to the project root. */
    projectRoot: string
    /** Project-wide compliance posture. */
    posture: DBOMPosture
    /** Design token inventory with compliance status. */
    tokens: DBOMTokenEntry[]
    /** Component inventory with audit results and optional provenance. */
    components: DBOMComponentEntry[]
    /** One-sentence plain-English summary of the DBOM. */
    summary: string
}

// ── V.4: Epistemic Consensus Gate ────────────────────────────────────────────

/**
 * Verdict from a single evaluator (primary or secondary agent).
 */
export type ConsensusJudgment = 'approve' | 'reject' | 'abstain'

/**
 * Overall consensus outcome after comparing primary and secondary verdicts.
 */
export type ConsensusOutcome = 'agree_approve' | 'agree_reject' | 'disagree' | 'error' | 'skipped'

/**
 * A single evaluator's verdict within the consensus gate.
 */
export interface EvaluatorVerdict {
    /** Which evaluator produced this verdict. */
    evaluator: 'primary' | 'secondary'
    /** The judgment: approve, reject, or abstain (timeout/error). */
    judgment: ConsensusJudgment
    /** Plain-text reasoning from the evaluator. */
    reasoning: string
    /** Confidence score, 0.0-1.0. Null if unavailable. */
    confidence: number | null
    /** Wall-clock duration of the evaluation in milliseconds. */
    durationMs: number
}

/**
 * Full consensus record persisted to the consensus_records table.
 */
export interface ConsensusRecord {
    /** UUID primary key. */
    id: string
    /** The mutation_id this consensus evaluated (if available). */
    mutationId: string | null
    /** Tool name that triggered the consensus gate. */
    toolName: string
    /** Tool input serialized as JSON string. */
    toolInput: string
    /** MRS score (0.0-1.0) that triggered the gate. */
    mrsScore: number
    /** MRS tier that triggered the gate. */
    mrsTier: 'amber' | 'red'
    /** Primary agent's verdict. */
    primaryVerdict: EvaluatorVerdict
    /** Secondary agent's verdict. */
    secondaryVerdict: EvaluatorVerdict
    /** Overall outcome after comparing verdicts. */
    outcome: ConsensusOutcome
    /** ISO 8601 timestamp. */
    timestamp: string
    /** Session ID for the orchestrator session. */
    sessionId: string | null
    /** Agent ID (always 'orchestrator' for the built-in agent). */
    agentId: string
    /** Governance domain active when the gate fired. */
    domain: string
}

/**
 * Summary statistics returned by flint_consensus_report.
 */
export interface ConsensusReportSummary {
    /** Total consensus evaluations performed. */
    totalEvaluations: number
    /** Count by outcome. */
    byOutcome: Record<ConsensusOutcome, number>
    /** Disagreement rate (disagree / totalEvaluations), 0.0-1.0. */
    disagreementRate: number
    /** Average secondary agent evaluation duration in ms. */
    avgSecondaryDurationMs: number
    /** Evaluations in the last 24 hours. */
    last24hCount: number
    /** Most recent disagreements (up to 10). */
    recentDisagreements: ConsensusRecord[]
}

// ── GPX.2: Governance Pack Import types ──────────────────────────────────────

import type { PackManifest } from '../packTypes.js'

/**
 * User-selected strategy for resolving conflicts during pack import.
 */
export type MergeStrategy = 'override' | 'skip-conflicts' | 'interactive'

/**
 * Machine-readable conflict domain for pack import conflicts.
 */
export type ConflictDomain =
    | 'policy_value'
    | 'rule_mode'
    | 'agent_id'
    | 'fragment_file'

/**
 * Describes a single conflict detected between the incoming pack
 * and the active project's existing configuration.
 */
export interface PackConflict {
    /** Machine-readable conflict domain. */
    domain: ConflictDomain
    /** Human-readable key path (e.g. 'mithril.deltaE_threshold', 'agent:hipaa-sentinel'). */
    key: string
    /** The value currently in the project. */
    currentValue: unknown
    /** The value the pack wants to set. */
    incomingValue: unknown
    /** Human-readable description of the conflict. */
    message: string
    /** Severity hint for UI rendering. */
    severity: 'blocking' | 'advisory'
}

/**
 * A single user resolution for an interactive-mode conflict.
 * Passed back to the import engine after the user has reviewed conflicts.
 */
export interface ConflictResolution {
    /** The conflict key (matches PackConflict.key). */
    key: string
    /** User decision: accept the pack value, keep the project value, or provide a custom value. */
    action: 'accept_incoming' | 'keep_current' | 'custom'
    /** Custom value, required when action is 'custom'. */
    customValue?: unknown
}

/**
 * Records a pre-import snapshot of the .flint/ directory.
 * Stored in .flint/pack-snapshots/<uuid>/ as a directory copy.
 */
export interface PackSnapshot {
    /** UUID for this snapshot. */
    id: string
    /** Pack ID that triggered this snapshot. */
    packId: string
    /** Pack version. */
    packVersion: string
    /** ISO 8601 timestamp when the snapshot was taken. */
    createdAt: string
    /** Absolute path to the snapshot directory. */
    snapshotPath: string
    /** Files that were backed up (relative to project root). */
    backedUpFiles: string[]
    /** Files that were added by the import (relative to project root). */
    addedFiles: string[]
}

/**
 * Result returned by the pack import engine and surfaced by the MCP tool.
 */
export interface PackImportResult {
    /** Whether the import completed successfully. */
    success: boolean
    /** The pack manifest that was imported. */
    manifest: PackManifest
    /** Merge strategy used. */
    strategy: MergeStrategy
    /** Conflicts detected. Empty when no conflicts exist. */
    conflicts: PackConflict[]
    /** Conflicts that were skipped (for 'skip-conflicts' strategy). */
    skippedConflicts: PackConflict[]
    /** Conflicts resolved (for 'interactive' strategy). */
    resolvedConflicts: ConflictResolution[]
    /** Files written to the project. */
    filesWritten: string[]
    /** Snapshot ID for rollback. Null if import did not proceed. */
    snapshotId: string | null
    /** Error message, if import failed. */
    error?: string
    /** Human-readable summary. */
    summary: string
}

/**
 * Result returned by the pack rollback engine.
 */
export interface PackRollbackResult {
    /** Whether rollback succeeded. */
    success: boolean
    /** Snapshot that was restored. */
    snapshotId: string
    /** Files restored. */
    filesRestored: string[]
    /** Error message, if rollback failed. */
    error?: string
    /** Human-readable summary. */
    summary: string
}
