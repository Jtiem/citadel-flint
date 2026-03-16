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
