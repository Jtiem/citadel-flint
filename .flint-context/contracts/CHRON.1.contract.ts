/**
 * CHRON.1 Executable Contract -- Reason-on-Override
 *
 * Phase: CHRON.1
 * Status: APPROVED
 * Date: 2026-04-16
 *
 * All types in this file are the binding specification for Phase 2 agents.
 * Phase 2 agents import these types directly. No implementation here.
 *
 * Key architectural finding: The schema already has the columns we need.
 *   - override_events.reason TEXT (exists in overrideTelemetryService.ts DDL)
 *   - mutations_ledger.justification TEXT (exists in mutationLedgerService.ts DDL)
 *   - mutation_provenance.provenance_reasoning TEXT (exists in mutationProvenanceService.ts DDL)
 *
 * CHRON.1 is purely a wiring + UI feature. No DDL changes on the MCP side.
 *
 * IMPORTANT: The `mutations_ledger` table is created by the MCP-side
 * `mutationLedgerService.ts` DDL, not by `electron/store.ts`. In Electron-only
 * deployments (no MCP sidecar), the table may not exist. The `governance:approve-mutation`
 * handler already wraps writes in try/catch. CHRON.1 adds a DDL guard to
 * `electron/store.ts` that ensures a minimal `mutations_ledger` table exists
 * so reason logging works even without the MCP sidecar.
 *
 * Approval flow clarification (W.B): CHRON.1 wires into the chat-based DiffCard
 * approval flow (orchestratorStore.approveToolCall -> governance:approve-mutation).
 * This is separate from the MRS ledger flow which records mutations_ledger rows
 * from the MCP side. Both paths write to the same `justification` column.
 */

// ── Reason Requirement Logic ─────────────────────────────────────────────────

/**
 * The three levels of reason collection, determined by MRS tier and override context.
 *
 *   'none'     -- Green tier, no prompt. System stores 'auto'.
 *   'optional' -- Amber tier, skippable prompt. If skipped, stores 'skipped'.
 *   'required' -- Red tier or any override. Blocks confirmation until non-empty.
 */
export type ReasonRequirement = 'none' | 'optional' | 'required'

/**
 * Auto-generated reason values used when the user does not provide text.
 *
 *   'auto'    -- Green tier mutations (no prompt shown)
 *   'skipped' -- Amber tier mutations where user dismissed the prompt
 */
export type AutoReason = 'auto' | 'skipped'

/**
 * Determines the reason requirement for a given MRS tier and override context.
 *
 * Rules:
 *   - Any governance rule override -> required (compliance-critical)
 *   - Red tier (score >= 0.70)     -> required
 *   - Amber tier (0.31-0.69)      -> optional
 *   - Green tier (0.00-0.30)      -> none
 */
export function getReasonRequirement(
    tier: 'green' | 'amber' | 'red',
    isOverride: boolean,
): ReasonRequirement {
    if (isOverride) return 'required'
    switch (tier) {
        case 'green': return 'none'
        case 'amber': return 'optional'
        case 'red': return 'required'
    }
}

/**
 * Resolves the actual reason string to store, based on user input and tier.
 *
 *   - Green tier:     always returns 'auto' (no user input)
 *   - Amber + empty:  returns 'skipped'
 *   - Amber + text:   returns the user's text
 *   - Red + text:     returns the user's text (caller must validate non-empty)
 *
 * W.C NOTE: The empty-string -> 'skipped' path for red tier is dead code.
 * The DiffCard UI disables the Apply button when the input is empty for red
 * tier, so `resolveReasonForStorage('red', '')` can never be reached via the
 * UI. The fallback exists purely as a defensive guard for programmatic callers.
 */
export function resolveReasonForStorage(
    tier: 'green' | 'amber' | 'red',
    userInput: string | undefined,
): string {
    if (tier === 'green') return 'auto'
    if (!userInput || userInput.trim().length === 0) return 'skipped'
    return userInput.trim()
}

// ── DiffCard Props Extension ─────────────────────────────────────────────────

/**
 * Extended onApprove callback signature for DiffCard.
 *
 * BEFORE: onApprove(id: string) => void
 * AFTER:  onApprove(id: string, reason?: string) => void
 *
 * - Green tier: called with reason=undefined (auto-logged server-side)
 * - Amber tier: called with reason='skipped' or user text
 * - Red tier: called with user text (never empty)
 */
export type DiffCardOnApprove = (id: string, reason?: string) => void

/**
 * Extended onReject callback (unchanged signature, documented for completeness).
 */
export type DiffCardOnReject = (id: string) => void

// ── IPC Payload Types ────────────────────────────────────────────────────────

/**
 * Updated payload for the governance:approve-mutation IPC channel.
 *
 * BEFORE: (id: number) => void
 * AFTER:  (id: number, reason?: string) => void
 *
 * The handler writes `reason` to the `justification` column of mutations_ledger.
 */
export interface ApproveMutationPayload {
    /** mutations_ledger row ID. */
    id: number
    /** Human-provided reason. null/undefined means no reason provided. */
    reason?: string
}

/**
 * Extended PendingMutation returned by governance:get-pending-mutations.
 * Adds the `reason` field populated from `justification` column.
 */
export interface PendingMutationWithReason {
    id: number
    type: string
    filePath: string
    riskScore: number
    riskTier: string
    agentId?: string
    /** Stored justification/reason, if one was provided at approval time. */
    reason?: string
}

// ── OrchestratorStore Action Extension ───────────────────────────────────────

/**
 * Updated approveToolCall signature for orchestratorStore.
 *
 * BEFORE: approveToolCall(id: string) => Promise<void>
 * AFTER:  approveToolCall(id: string, reason?: string) => Promise<void>
 *
 * The reason is stored in provenance (via recordProvenance's reasoning param)
 * and passed to the governance:approve-mutation IPC handler.
 */
export type ApproveToolCallAction = (id: string, reason?: string) => Promise<void>

// ── Override Reason Display ──────────────────────────────────────────────────

/**
 * Data shape for displaying a past override reason on a ViolationCard.
 *
 * Fetched via `governance:get-audit-log` IPC (already exists in electron/main.ts).
 * The parent (GovernanceDashboard) queries governance_events where
 * event_type='override', filters by ruleId+filePath, and extracts
 * the reason from the `metadata` JSON column (which stores
 * { action, newValue, reason? }). No new IPC channel needed.
 */
export interface OverrideReasonDisplay {
    /** The reason text. null if override exists but no reason was provided. */
    reason: string | null
    /** ISO 8601 timestamp when the override was recorded. */
    timestamp: string
    /** Actor who performed the override (agent ID or 'human'). */
    actor?: string
    /** The rule that was overridden. */
    ruleId: string
}

// ── SARIF Extension ──────────────────────────────────────────────────────────

/**
 * Extended SARIF result properties that include override reason.
 * Added to the existing SarifResult.properties in auditReport.ts.
 *
 * W.A NOTE: The SARIF builder fetches override data by querying the
 * MCP-side overrideTelemetryService with (ruleId, filePath) to find
 * matching override_events rows. When a match is found, `reason` and
 * `timestamp` from the override_events row populate these properties.
 */
export interface SarifOverrideProperties {
    flintId: string
    sourceAuthority: string
    regulatoryReference: string
    /** Override reason, when a matching override_events row exists. */
    overrideReason?: string
    /** ISO timestamp of the override. */
    overrideTimestamp?: string
}

// ── Contract Metadata ────────────────────────────────────────────────────────

import type { LegacyFlintContract } from '../../shared/contract-schema.ts'

export const CONTRACT: LegacyFlintContract = {
    meta: {
        name: 'CHRON.1-ReasonOnOverride',
        phase: 'CHRON.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-16',
    },
    impact: [
        { file: 'src/components/ui/DiffCard.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Add reason input UI (optional at amber, required at red)' },
        { file: 'src/store/orchestratorStore.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'approveToolCall gains reason param' },
        { file: 'electron/main.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'governance:approve-mutation writes reason to justification column; DDL guard for mutations_ledger' },
        { file: 'electron/store.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'DDL guard: CREATE TABLE IF NOT EXISTS mutations_ledger with minimal schema for reason logging without MCP sidecar' },
        { file: 'electron/orchestrator.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'tool_call chunk gains reason?: string in onChunk payload when user approves' },
        { file: 'electron/preload.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'approveMutation bridge passes reason param' },
        { file: 'src/adapters/web-api.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Web adapter approveMutation passes reason param' },
        { file: 'src/types/flint-api.d.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'OrchestratorChunk and PendingMutation gain reason?: string field' },
        { file: 'flint-mcp/src/core/governance/mutationProvenanceService.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'recordProvenance() gains reason param (maps to existing provenance_reasoning column)' },
        { file: 'flint-mcp/src/tools/auditReport.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'SARIF properties include override reason fetched via overrideTelemetryService(ruleId, filePath)' },
        { file: 'src/components/ui/governance/ViolationCard.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Show past override reason when one exists (data from governance:get-audit-log, no new IPC)' },
        { file: 'src/components/ui/__tests__/DiffCard.test.tsx', changeType: 'MODIFY', owner: 'flint-test-writer', summary: '8 new tests for reason input by tier' },
        { file: 'flint-mcp/src/__tests__/mutationProvenance.test.ts', changeType: 'MODIFY', owner: 'flint-test-writer', summary: '4 new tests for reason storage and retrieval' },
    ],
    ipc: [
        {
            channel: 'governance:approve-mutation',
            direction: 'renderer\u2192main',
            payloadType: 'ApproveMutationPayload',
            returnType: 'void',
            handler: 'electron/main.ts',
        },
    ],
    stores: [
        {
            store: 'orchestratorStore',
            newState: {},
            newActions: { approveToolCall: '(id: string, reason?: string) => Promise<void>' },
            newSelectors: {},
        },
    ],
    components: [
        {
            name: 'DiffCard',
            file: 'src/components/ui/DiffCard.tsx',
            propsType: 'DiffCardProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'ViolationCard',
            file: 'src/components/ui/governance/ViolationCard.tsx',
            propsType: 'ViolationCardProps',
            consumesStores: [],
            emitsIPC: [],
        },
    ],
    commandments: [12, 14],
    testBoundaries: [
        // ── DiffCard: Green tier ──────────────────────────────────────────
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Green tier renders no reason input',
            assertion: 'queryByLabelText(/reason|why/i) returns null',
            edgeCases: ['riskTier prop is undefined (defaults to inferred tier)'],
        },
        // ── DiffCard: Amber tier ──────────────────────────────────────────
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Amber tier renders optional reason input with Apply always enabled',
            assertion: 'getByLabelText(/reason|why/i) is visible; Apply button is not disabled',
            edgeCases: ['Empty input submits reason="skipped"'],
        },
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Amber tier skipped reason sends "skipped" to onApprove',
            assertion: 'onApprove called with (id, "skipped")',
            edgeCases: [],
        },
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Amber tier typed reason is forwarded to onApprove',
            assertion: 'onApprove called with (id, "brand team approved")',
            edgeCases: [],
        },
        // ── DiffCard: Red tier ────────────────────────────────────────────
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Red tier renders required reason input with Apply disabled until non-empty',
            assertion: 'Apply button has disabled attribute when input is empty',
            edgeCases: ['Whitespace-only input does not enable Apply'],
        },
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Red tier Apply button enables after typing valid text',
            assertion: 'Apply button enabled after typing "justified because X"',
            edgeCases: [],
        },
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Red tier Apply sends typed reason to onApprove',
            assertion: 'onApprove called with (id, "justified because X")',
            edgeCases: [],
        },
        {
            target: 'DiffCard',
            kind: 'component',
            behavior: 'Red tier whitespace-only does not enable Apply',
            assertion: 'Apply button has disabled attribute after typing "   "',
            edgeCases: [],
        },
        // ── Provenance service ────────────────────────────────────────────
        {
            target: 'MutationProvenanceService.recordProvenance',
            kind: 'service',
            behavior: 'Stores reason in provenance_reasoning column',
            assertion: 'getProvenance(id).provenanceReasoning === "brand approved"',
            edgeCases: ['reason="skipped" stores "skipped"', 'reason=null stores null'],
        },
        {
            target: 'MutationProvenanceService.getAuditTrail',
            kind: 'service',
            behavior: 'Includes provenanceReasoning in audit trail results',
            assertion: 'trail[0].provenanceReasoning === "compliance requirement"',
            edgeCases: [],
        },
        // ── IPC handler ───────────────────────────────────────────────────
        {
            target: 'governance:approve-mutation',
            kind: 'ipc-handler',
            behavior: 'Writes reason to justification column',
            assertion: 'SELECT justification FROM mutations_ledger WHERE id = 42 returns "compliance requirement"',
            edgeCases: ['No reason provided writes null justification'],
        },
        {
            target: 'governance:get-pending-mutations',
            kind: 'ipc-handler',
            behavior: 'Returns reason field populated from justification column',
            assertion: 'result[0].reason === "compliance requirement" after approval with reason',
            edgeCases: ['Returns reason: null when no justification stored'],
        },
        // ── SARIF ─────────────────────────────────────────────────────────
        {
            target: 'buildSarifOutput',
            kind: 'service',
            behavior: 'SARIF output includes overrideReason in properties when available',
            assertion: 'result.runs[0].results[0].properties.overrideReason === "brand approved"',
            edgeCases: ['Missing override produces no overrideReason property'],
        },
        // ── ViolationCard ─────────────────────────────────────────────────
        {
            target: 'ViolationCard',
            kind: 'component',
            behavior: 'Override reason displayed when present',
            assertion: 'getByText("brand team approved") is visible',
            edgeCases: ['overrideReason=null renders no reason text'],
        },
    ],
    risks: [
        {
            risk: 'mutations_ledger DDL guard in electron/store.ts creates a minimal table that lacks columns the MCP-side DDL defines (e.g., before_snapshot, after_snapshot). MCP startup will CREATE IF NOT EXISTS and no-op if the table already exists with fewer columns.',
            severity: 'medium',
            commandment: 12,
            mitigation: 'The Electron DDL guard includes all columns from the MCP DDL schema so both paths produce identical tables. The MCP CREATE IF NOT EXISTS is idempotent when the table already exists.',
        },
        {
            risk: 'Amber "skipped" reasons pollute audit reports with noise',
            severity: 'low',
            mitigation: 'SARIF builder filters out reason="skipped" from display or marks distinctly',
        },
        {
            risk: 'DiffCard vertical space too tight for text input',
            severity: 'low',
            mitigation: 'Use compact single-line input below reasoning section; collapse when not needed',
        },
    ],
    parallelismGroups: {
        // Group A: DiffCard UI + IPC wiring + test scaffolds (no cross-dependencies)
        'A': ['flint-design-engineer', 'flint-electron-ipc', 'flint-test-writer'],
        // Group B: Store wiring + SARIF enrichment (depends on Group A IPC being complete)
        // NOTE: flint-design-engineer works on ViolationCard in Group B. ViolationCard.tsx
        // does NOT import from DiffCard.tsx (verified -- zero shared imports). The Group A
        // DiffCard work and Group B ViolationCard work are fully independent components.
        'B': ['flint-state-architect', 'flint-design-engineer', 'flint-ast-surgeon'],
        'C': ['flint-test-writer', 'flint-integration-validator'],
    },
    nonGoals: [
        'No reason prompts for Green-tier mutations (too much friction)',
        'No changes to export gate logic (Gate blocks on violations regardless of reasons)',
        'No new approval workflow -- extends the existing chat-based DiffCard approval flow (not the MRS ledger flow)',
        'No new IPC channels -- ViolationCard reads override reasons from existing governance:get-audit-log IPC (governance_events.metadata JSON)',
        'No DDL changes to MCP-side tables (override_events.reason, mutations_ledger.justification, mutation_provenance.provenance_reasoning already exist). Electron-side gets a DDL guard for mutations_ledger only.',
    ],
}
