/**
 * Governance telemetry types — bridge-mcp/src/core/governance/types.ts
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
    | 'Bridge Design System'
    | 'Custom'

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

export interface GovernanceEvent {
    id: string
    timestamp: string
    eventType: 'violation' | 'override' | 'export_block' | 'auto_fix' | 'rule_change'
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
 * MutationLedgerEntry records every AST mutation committed through Bridge MCP,
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
 * - 'human'     — direct UI interaction in Bridge Glass
 * - 'agent'     — AI agent call via MCP tool (bridge_ast_mutate)
 * - 'auto-heal' — IngestionAuditor tier-1 heal pass
 * - 'auto-fix'  — bridge_fix tool or GovernanceOverlay auto-fix
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
 *   code     — machine-readable check identifier (e.g. 'DUPLICATE_BRIDGE_ID')
 *   message  — human-readable description suitable for display to an agent
 *   nodeId   — the data-bridge-id of the offending node, when applicable
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
     * .bridge/provenance.db to determine file familiarity.
     * When omitted, familiarity factor defaults to 0.1 (neutral).
     */
    projectRoot?: string
}
