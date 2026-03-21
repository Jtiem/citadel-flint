# V.4 Contract -- Multi-Agent Epistemic Consensus Gate

**Phase:** V.4
**Status:** CONTRACT APPROVED
**Date:** 2026-03-21
**Author:** flint-architect

---

## Summary

For AST mutations that score Amber (0.31-0.69) or Red (0.70-1.00) on the inline MRS in `electron/orchestrator.ts`, route the proposed mutation to a stateless secondary LLM agent for independent safety evaluation before surfacing the approval UI. The secondary agent receives ONLY the current AST snapshot + proposed mutation (no primary agent reasoning history). Both verdicts are logged to the Provenance Ledger. Disagreements are flagged. Configurable per domain profile via `.flint/policy.json`.

**Key design principles:**
- Stateless evaluation: the secondary agent has zero context about the primary agent's reasoning chain, preventing confirmation bias
- The gate fires AFTER MRS scoring but BEFORE the `onChunk({ type: 'tool_call' })` emission to the renderer
- All consensus data persists to SQLite via the existing `db` instance in `electron/store.ts` (Commandment 12)
- The consensus gate is a main-process-only construct -- no `fs`, `sqlite`, or Node.js APIs in `src/` (Commandment 9 / Process Boundary Law)
- Glass observability is read-only -- it reads consensus data via MCP resource, not direct DB access

---

## 1. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `electron/consensusGateService.ts` | CREATE | `flint-electron-ipc` | Stateless secondary agent evaluator |
| `electron/orchestrator.ts` | MODIFY | `flint-electron-ipc` | Hook consensus gate after MRS, before `onChunk` |
| `electron/store.ts` | MODIFY | `flint-electron-ipc` | Add `consensus_records` DDL |
| `flint-mcp/src/core/governance/types.ts` | MODIFY | `flint-ast-surgeon` | Add `ConsensusVerdict`, `ConsensusRecord` types |
| `flint-mcp/src/core/governance/consensusQueryService.ts` | CREATE | `flint-ast-surgeon` | Query service for MCP tool (read-only) |
| `flint-mcp/src/server.ts` | MODIFY | `flint-ast-surgeon` | Register `flint_consensus_report` tool |
| `electron/preload.ts` | NO CHANGE | -- | No new IPC channel needed (see Section 6) |
| `src/components/ui/AgentDashboard.tsx` | MODIFY | `flint-design-engineer` | Add consensus stats section |
| `src/components/ui/DiffCard.tsx` | MODIFY | `flint-design-engineer` | Show consensus badge on amber/red cards |
| `src/components/ui/ActivityFeed.tsx` | NO CHANGE | -- | Already has `flint_consensus_status` label |
| `electron/consensusGateService.test.ts` | CREATE | `flint-test-writer` | Unit tests |
| `flint-mcp/src/core/governance/__tests__/consensusQueryService.test.ts` | CREATE | `flint-test-writer` | Unit tests |

---

## 2. Type Contracts

All types live in `flint-mcp/src/core/governance/types.ts` (the canonical location for governance types). The `electron/` side imports from there OR defines local mirrors -- whichever pattern is already used. Since `electron/orchestrator.ts` already defines its own `MRSTier` locally (line 937), the consensus types that are only used in `electron/` will be defined locally in `consensusGateService.ts`. Types shared with the MCP query service go in `governance/types.ts`.

### 2.1 Types in `flint-mcp/src/core/governance/types.ts`

```typescript
// ── V.4: Epistemic Consensus types ──────────────────────────────────────────

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
```

### 2.2 Types local to `electron/consensusGateService.ts`

```typescript
/**
 * Input to the consensus gate.
 */
export interface ConsensusGateInput {
    /** The tool name that was scored amber/red. */
    toolName: string
    /** The tool input object. */
    toolInput: Record<string, unknown>
    /** The MRS assessment from computeMRS(). */
    mrs: MRSAssessment
    /** Current source code of the active file (AST snapshot). */
    astSnapshot: string
    /** Whether the primary agent's reasoning should be included. MUST be false. */
    includePrimaryReasoning: false
    /** Active governance domain. */
    domain: string
    /** Session ID for provenance. */
    sessionId?: string
}

/**
 * Output from the consensus gate.
 */
export interface ConsensusGateResult {
    /** Whether the mutation should proceed to the approval UI. */
    proceed: boolean
    /** The consensus outcome. */
    outcome: ConsensusOutcome
    /** The secondary agent's verdict. */
    secondaryVerdict: EvaluatorVerdict
    /** The full consensus record (already persisted). */
    record: ConsensusRecord
}
```

---

## 3. SQLite Schema

Added to `electron/store.ts` after the existing `violation_baselines` DDL block.

```sql
-- ── V.4: Epistemic Consensus Gate ─────────────────────────────────────────────
-- Records each consensus evaluation: who agreed, who disagreed, and why.
-- One row per amber/red mutation that triggers the consensus gate.
CREATE TABLE IF NOT EXISTS consensus_records (
    id                    TEXT    PRIMARY KEY,
    mutation_id           TEXT,
    tool_name             TEXT    NOT NULL,
    tool_input_json       TEXT    NOT NULL DEFAULT '{}',
    mrs_score             REAL    NOT NULL CHECK (mrs_score >= 0 AND mrs_score <= 1),
    mrs_tier              TEXT    NOT NULL CHECK (mrs_tier IN ('amber', 'red')),
    primary_judgment      TEXT    NOT NULL CHECK (primary_judgment IN ('approve', 'reject', 'abstain')),
    primary_reasoning     TEXT    NOT NULL DEFAULT '',
    primary_confidence    REAL,
    primary_duration_ms   INTEGER NOT NULL DEFAULT 0,
    secondary_judgment    TEXT    NOT NULL CHECK (secondary_judgment IN ('approve', 'reject', 'abstain')),
    secondary_reasoning   TEXT    NOT NULL DEFAULT '',
    secondary_confidence  REAL,
    secondary_duration_ms INTEGER NOT NULL DEFAULT 0,
    outcome               TEXT    NOT NULL CHECK (outcome IN (
        'agree_approve', 'agree_reject', 'disagree', 'error', 'skipped'
    )),
    session_id            TEXT,
    agent_id              TEXT    NOT NULL DEFAULT 'orchestrator',
    domain                TEXT    NOT NULL DEFAULT 'general',
    timestamp             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_consensus_outcome    ON consensus_records(outcome);
CREATE INDEX IF NOT EXISTS idx_consensus_timestamp  ON consensus_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_consensus_mrs_tier   ON consensus_records(mrs_tier);
CREATE INDEX IF NOT EXISTS idx_consensus_session    ON consensus_records(session_id);
CREATE INDEX IF NOT EXISTS idx_consensus_agent      ON consensus_records(agent_id);
```

---

## 4. Orchestrator Integration

### 4.1 Where the gate fires

In `electron/orchestrator.ts`, the consensus gate fires in the `message_stop` handler, inside the `if (MUTATION_TOOL_NAMES.has(block.name))` branch, AFTER the MRS computation (line ~1891) and AFTER the escalation engine check (line ~1910), but BEFORE the `onChunk({ type: 'tool_call', ... })` emission (line ~1918).

Current flow (lines 1878-1928):
```
1. MUTATION_TOOL_NAMES.has(block.name) -> true
2. computeMRS() -> mrs
3. escalationEngine.recordMutationRisk() + checkEscalation()
4. If blocked by escalation -> emit error, continue
5. Determine requiresReview
6. emit onChunk({ type: 'tool_call', riskTier, riskScore, ... })
```

New flow with consensus gate:
```
1. MUTATION_TOOL_NAMES.has(block.name) -> true
2. computeMRS() -> mrs
3. escalationEngine.recordMutationRisk() + checkEscalation()
4. If blocked by escalation -> emit error, continue
5. Determine requiresReview
6. ** NEW ** If mrs.tier === 'amber' || mrs.tier === 'red':
   a. Read current source code (rawCode from the active file)
   b. Call consensusGate.evaluate(input)
   c. If outcome === 'disagree':
      - Set requiresReview = true (force review even if amber)
      - Add consensusOutcome + secondaryReasoning to the chunk
   d. If outcome === 'agree_reject':
      - Emit validation_error with secondary reasoning
      - Set hadValidationFailure = true
      - continue
   e. If outcome === 'error' or 'skipped':
      - Proceed normally (gate is advisory, never blocks on its own errors)
7. emit onChunk({ type: 'tool_call', riskTier, riskScore, ..., consensusOutcome?, consensusReasoning? })
```

### 4.2 OrchestratorChunk extension

Add two optional fields to the `OrchestratorChunk` interface (line 951):

```typescript
export interface OrchestratorChunk {
    // ... existing fields ...
    // ── V.4: Consensus Gate annotation ──
    /** Consensus outcome when the gate fired (amber/red mutations only). */
    consensusOutcome?: ConsensusOutcome
    /** Secondary agent's reasoning (only present when consensus gate fired). */
    consensusReasoning?: string
}
```

### 4.3 Active file source access

The orchestrator needs the current source code to pass to the secondary agent. The `sendChatMessage` function already receives `activeFilePath` as a parameter. The source code can be read via `readFile(activeFilePath, 'utf-8')` since this runs in the main process. This is safe -- the main process already reads files directly (line 29: `import { readFile } from 'node:fs/promises'`).

### 4.4 Consensus gate is async

The `evaluate()` call is async (it calls the Anthropic API). This is acceptable because the entire `message_stop` handler is already inside an async function (`runStream`). The secondary agent call adds latency only to amber/red mutations, which already require human review -- a 2-5 second delay is acceptable for safety-critical mutations.

### 4.5 Domain-aware gating

The domain string (from `.flint/policy.json`) is already read at line 1779 of `orchestrator.ts` and stored in a local variable. The consensus gate receives this domain to:
1. Decide whether to fire (configurable per domain -- see Section 7)
2. Include domain-specific safety criteria in the secondary agent's prompt

---

## 5. MCP Surface -- `flint_consensus_report` Tool

### 5.1 Tool registration in `flint-mcp/src/server.ts`

```typescript
{
    name: 'flint_consensus_report',
    description:
        'Query the epistemic consensus gate records. Returns disagreement rate, ' +
        'outcome distribution, and recent disagreements. Use this to assess whether ' +
        'the AI agent is consistently proposing safe mutations or triggering reviewer disagreements.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            mode: {
                type: 'string',
                enum: ['summary', 'by_session', 'by_agent', 'disagreements'],
                description:
                    'Query mode. "summary" returns aggregate stats. "by_session" filters by sessionId. ' +
                    '"by_agent" filters by agentId. "disagreements" returns only disagreement records.',
            },
            sessionId: {
                type: 'string',
                description: 'Session UUID to filter by (only for by_session mode).',
            },
            agentId: {
                type: 'string',
                description: 'Agent ID to filter by (only for by_agent mode).',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of records to return (default 20, max 100).',
            },
        },
        required: ['mode'],
    },
}
```

### 5.2 Query service (`flint-mcp/src/core/governance/consensusQueryService.ts`)

```typescript
import type Database from 'better-sqlite3'
import type {
    ConsensusRecord,
    ConsensusReportSummary,
    ConsensusOutcome,
    EvaluatorVerdict,
} from './types.js'

export class ConsensusQueryService {
    constructor(private readonly db: Database.Database) {
        // No DDL -- table is created by electron/store.ts
    }

    getSummary(): ConsensusReportSummary { ... }
    getBySession(sessionId: string, limit?: number): ConsensusRecord[] { ... }
    getByAgent(agentId: string, limit?: number): ConsensusRecord[] { ... }
    getDisagreements(limit?: number): ConsensusRecord[] { ... }
    pruneRecords(olderThan: string): number { ... }
}
```

### 5.3 MCP Resource extension

Add consensus stats to the existing `flint://agent-dashboard` resource. No new resource URI needed. The AgentDashboard component already reads this resource.

---

## 6. IPC Analysis -- No New Channel Required

The consensus gate runs entirely in the main process (`electron/`). It is invoked synchronously within the orchestrator's `message_stop` handler. Results are embedded in the existing `OrchestratorChunk` that flows to the renderer via the existing `ai:onChunk` IPC push channel.

Glass observability reads consensus data via the existing MCP resource pattern (`flint://agent-dashboard`), not via a new IPC channel. The AgentDashboard component already fetches from MCP resources via `window.flintAPI.mcp.readResource`.

Therefore: **no new IPC channel in `preload.ts` is required**.

---

## 7. Domain Configuration

### 7.1 Policy.json extension

The existing `.flint/policy.json` gains an optional `consensus` key:

```jsonc
{
    "domain": "healthcare",
    "consensus": {
        // Whether the consensus gate is enabled. Default: true for healthcare,
        // fintech, government. Default: false for general, e-commerce, enterprise-saas.
        "enabled": true,
        // Minimum MRS tier that triggers the gate. Default: "amber".
        // Set to "red" to only gate the highest-risk mutations.
        "minimumTier": "amber",
        // Timeout in ms for the secondary agent evaluation. Default: 15000.
        // If the secondary agent does not respond in time, outcome = "skipped".
        "timeoutMs": 15000,
        // Model to use for the secondary agent. Default: "claude-3-5-haiku-20241022".
        // Must be a model from the ANTHROPIC_MODELS roster.
        "secondaryModel": "claude-3-5-haiku-20241022"
    }
}
```

### 7.2 Domain defaults

| Domain | `consensus.enabled` default | `consensus.minimumTier` default | Rationale |
|--------|---------------------------|--------------------------------|-----------|
| `general` | `false` | `amber` | Low-risk projects; opt-in |
| `healthcare` | `true` | `amber` | PHI exposure risk requires second opinion |
| `fintech` | `true` | `amber` | PCI-DSS data exposure risk |
| `e-commerce` | `false` | `red` | Only highest-risk mutations |
| `government` | `true` | `amber` | Section 508 compliance rigor |
| `enterprise-saas` | `false` | `red` | Only highest-risk mutations |

These defaults are coded in `consensusGateService.ts` as a lookup table. They are overridden by any explicit `consensus` key in `policy.json`.

### 7.3 Integration with Commandment 8 (Audit-First Execution)

The secondary agent call IS the complexity routing for amber/red mutations. This satisfies Commandment 8: high-risk mutations get an independent evaluation before reaching the user. The secondary agent uses a fast model (Haiku by default) to minimize latency while still providing a meaningful safety check.

---

## 8. `electron/consensusGateService.ts` -- Full API Design

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'node:crypto'
import db from './store.js'
import { readConfig } from './orchestrator.js'
import type { MRSAssessment, MRSTier } from './orchestrator.js'
import { BRAND, logTag } from '../shared/brand.ts'

// ── Types (local to this module) ─────────────────────────────────────────────

export type ConsensusJudgment = 'approve' | 'reject' | 'abstain'
export type ConsensusOutcome = 'agree_approve' | 'agree_reject' | 'disagree' | 'error' | 'skipped'

export interface EvaluatorVerdict {
    evaluator: 'primary' | 'secondary'
    judgment: ConsensusJudgment
    reasoning: string
    confidence: number | null
    durationMs: number
}

export interface ConsensusGateInput {
    toolName: string
    toolInput: Record<string, unknown>
    mrs: MRSAssessment
    astSnapshot: string
    domain: string
    sessionId?: string
}

export interface ConsensusGateResult {
    proceed: boolean
    outcome: ConsensusOutcome
    secondaryVerdict: EvaluatorVerdict
    recordId: string
}

export interface ConsensusConfig {
    enabled: boolean
    minimumTier: MRSTier
    timeoutMs: number
    secondaryModel: string
}

// ── Domain defaults ──────────────────────────────────────────────────────────

const DOMAIN_DEFAULTS: Record<string, ConsensusConfig> = {
    general:          { enabled: false, minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-3-5-haiku-20241022' },
    healthcare:       { enabled: true,  minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-3-5-haiku-20241022' },
    fintech:          { enabled: true,  minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-3-5-haiku-20241022' },
    'e-commerce':     { enabled: false, minimumTier: 'red',   timeoutMs: 15000, secondaryModel: 'claude-3-5-haiku-20241022' },
    government:       { enabled: true,  minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-3-5-haiku-20241022' },
    'enterprise-saas':{ enabled: false, minimumTier: 'red',   timeoutMs: 15000, secondaryModel: 'claude-3-5-haiku-20241022' },
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the consensus configuration for the current domain.
 * Merges domain defaults with any explicit policy.json overrides.
 *
 * @param domain     The active governance domain.
 * @param policyOverrides  The consensus block from policy.json (may be undefined).
 */
export function resolveConfig(
    domain: string,
    policyOverrides?: Partial<ConsensusConfig>,
): ConsensusConfig

/**
 * Determine whether the consensus gate should fire for the given MRS assessment.
 *
 * @param mrs     The MRS assessment from computeMRS().
 * @param config  The resolved consensus configuration.
 * @returns true if the gate should fire.
 */
export function shouldFireGate(mrs: MRSAssessment, config: ConsensusConfig): boolean

/**
 * Run the consensus gate: send the proposed mutation to a secondary agent
 * for independent safety evaluation.
 *
 * The secondary agent receives:
 *   1. A stripped system prompt (safety evaluator persona, domain rules)
 *   2. The current AST snapshot (source code)
 *   3. The proposed mutation (tool name + input)
 *   4. The MRS assessment (score, tier, factors)
 *
 * It does NOT receive:
 *   - The primary agent's reasoning history
 *   - The conversation context
 *   - Any prior tool call results
 *
 * The function:
 *   1. Calls the Anthropic API with the secondary model
 *   2. Parses the response as a structured verdict
 *   3. Computes the consensus outcome (agree/disagree)
 *   4. Persists a ConsensusRecord to the consensus_records table
 *   5. Returns the result
 *
 * On any error (API failure, timeout, parse error), returns
 * outcome = 'error' with proceed = true (fail open -- the gate is advisory).
 *
 * @param input  The consensus gate input.
 * @returns The consensus gate result.
 */
export async function evaluate(input: ConsensusGateInput): Promise<ConsensusGateResult>

/**
 * Persist a consensus record to SQLite.
 * Called internally by evaluate(). Exported for testing.
 */
export function persistRecord(record: {
    id: string
    mutationId: string | null
    toolName: string
    toolInputJson: string
    mrsScore: number
    mrsTier: string
    primaryVerdict: EvaluatorVerdict
    secondaryVerdict: EvaluatorVerdict
    outcome: ConsensusOutcome
    sessionId: string | null
    agentId: string
    domain: string
}): void
```

### 8.1 Secondary Agent System Prompt

```typescript
const SECONDARY_AGENT_PROMPT = `You are an independent safety evaluator for the Flint governance system.

Your task: evaluate whether a proposed AST mutation is safe to execute.

You will receive:
1. The current source code of the file being modified
2. The proposed mutation (tool name and parameters)
3. The Mutation Risk Score (MRS) assessment

You must respond with a JSON object:
{
  "judgment": "approve" | "reject",
  "reasoning": "one paragraph explaining your decision",
  "confidence": 0.0-1.0
}

EVALUATION CRITERIA:
- Does the mutation preserve the structural integrity of the component?
- Does the mutation introduce accessibility violations?
- Does the mutation break existing functionality (removing event handlers, breaking props)?
- For deleteNode: is the node referenced by state hooks, callbacks, or other nodes?
- For insertNode/wrapNode: is the proposed JSX structurally valid?
- For structural mutations: could this break the component's public API?

DOMAIN-SPECIFIC RULES:
{domain_rules}

IMPORTANT:
- You have NO context about WHY this mutation was proposed. Evaluate it purely on safety.
- If you cannot determine safety, lean toward "approve" with low confidence.
- Never approve a mutation that would render a component syntactically invalid.
- Respond with ONLY the JSON object, no surrounding text.`
```

The `{domain_rules}` placeholder is replaced with domain-specific halt conditions from the sentinel preset for the active domain.

### 8.2 Fail-open behavior

The consensus gate is advisory. It NEVER blocks a mutation on its own errors. Specific failure modes:

| Failure | Outcome | Proceed? | Rationale |
|---------|---------|----------|-----------|
| API timeout (> `timeoutMs`) | `skipped` | Yes | User should not wait indefinitely |
| API error (network, auth) | `error` | Yes | Infrastructure failure should not block work |
| Response parse error | `error` | Yes | Model output malformed -- treat as abstain |
| Secondary says "reject" | `agree_reject` | No | Both primary (via MRS red) and secondary agree it is dangerous |
| Secondary says "reject" on amber | `disagree` | Yes (but force review) | Disagreement escalates to mandatory human review |

Wait -- the primary agent does not produce a judgment in the traditional sense. The "primary verdict" is derived from the MRS tier:
- Green: primary implicitly "approves" (but gate does not fire for green)
- Amber: primary implicitly "approves with caution" -> judgment = `approve`
- Red: primary implicitly "flags for sign-off" -> judgment = `approve` (the AI proposed the mutation, so it wants it approved, but MRS flagged it as risky)

So the primary verdict is always `approve` (the AI agent proposed the mutation). The consensus outcome is then:
- Secondary approves + primary approves = `agree_approve`
- Secondary rejects + primary approves = `disagree`
- Secondary abstains = `skipped`

The `agree_reject` outcome only applies if we add future support for the primary agent itself rejecting (not applicable in V.4).

Correction to the flow in Section 4.1:
```
If outcome === 'disagree':
    - Set requiresReview = true (force review even if it would have been auto-approved)
    - Attach consensusOutcome + secondaryReasoning to the chunk
    - Proceed = true (the human reviewer makes the final call)
If outcome === 'agree_approve':
    - No change to the existing flow (mutation proceeds normally through approval UI)
If outcome === 'error' or 'skipped':
    - No change to the existing flow (fail open)
```

---

## 9. Component Contracts (Glass UI)

### 9.1 DiffCard -- Consensus Badge

The `DiffCard` component (line 283 of `DiffCard.tsx`) gains an optional consensus annotation:

```typescript
export interface DiffCardProps {
    call: PendingToolCall
    onApprove: (id: string) => void
    onReject: (id: string) => void
    riskTier?: RiskTier
    // ── V.4: Consensus Gate ──
    /** Consensus outcome when the gate fired. */
    consensusOutcome?: 'agree_approve' | 'disagree' | 'error' | 'skipped'
    /** Secondary agent's reasoning. */
    consensusReasoning?: string
}
```

UI behavior:
- `agree_approve`: subtle emerald "Consensus: Agreed" badge below the risk tier badge
- `disagree`: amber "Consensus: Disagreed" badge with expandable reasoning tooltip
- `error`/`skipped`: zinc "Consensus: Unavailable" badge (do not alarm the user)
- `undefined` (green tier): no badge (gate did not fire)

### 9.2 AgentDashboard -- Consensus Stats

The `AgentDashboard.tsx` component adds a "Consensus" section below the existing agent risk profiles. This section reads from the `flint://agent-dashboard` MCP resource (which will be extended to include consensus stats).

Display:
- Disagreement rate (percentage)
- Total evaluations count
- Outcome breakdown (small bar chart: agree / disagree / error)

Data source: the MCP resource `flint://agent-dashboard` is extended with a `consensus` field in its response shape.

---

## 10. Commandment Checklist

| # | Commandment | Applicable? | How Satisfied |
|---|------------|-------------|---------------|
| 1 | Code is Truth | No | Consensus gate does not mutate AST |
| 2 | No Hallucinated Styling | No | Not a styling operation |
| 8 | Audit-First Execution | **Yes** | The secondary agent IS the audit-first check for amber/red mutations. Fast model (Haiku) for speed. |
| 9 | CIEDE2000 | No | Not a color operation |
| 12 | Atomic Queuing | **Yes** | All SQLite writes go through the existing `db` instance in `electron/store.ts`. ConsensusGateService uses `db.prepare().run()`. |
| 13 | Deterministic Surgery | No | Consensus gate does not modify source code |
| 14 | Bypass Prohibition | **Yes** | No direct `fs` or `git` calls. Source code read uses the same `readFile` already imported in orchestrator.ts. SQLite via `db`. |
| 15 | Granular AST Tools Only | No | Consensus gate does not emit AST ops |
| 16 | In-Memory Validation | **Yes** | The consensus gate IS an additional validation layer before the mutation surfaces in the UI. Commandment 16 is satisfied by the existing `validateToolInput` call PLUS this new consensus check. |

Process Boundary Law:
- `consensusGateService.ts` lives in `electron/` (main process) -- correct
- `consensusQueryService.ts` lives in `flint-mcp/src/core/governance/` (MCP server) -- correct
- No new code in `src/` touches Node.js APIs -- correct
- Glass reads consensus data via existing MCP resource pattern -- correct

---

## 11. Implementation Order

### Phase 2a (Parallel Group 1 -- can run simultaneously)

| Step | Agent | Task | Blocked By |
|------|-------|------|-----------|
| 2a.1 | `flint-ast-surgeon` | Add consensus types to `flint-mcp/src/core/governance/types.ts` | Nothing |
| 2a.2 | `flint-electron-ipc` | Add `consensus_records` DDL to `electron/store.ts` | Nothing |

### Phase 2b (Parallel Group 2 -- depends on 2a)

| Step | Agent | Task | Blocked By |
|------|-------|------|-----------|
| 2b.1 | `flint-electron-ipc` | Create `electron/consensusGateService.ts` | 2a.1, 2a.2 |
| 2b.2 | `flint-ast-surgeon` | Create `flint-mcp/src/core/governance/consensusQueryService.ts` | 2a.1, 2a.2 |

### Phase 2c (Parallel Group 3 -- depends on 2b)

| Step | Agent | Task | Blocked By |
|------|-------|------|-----------|
| 2c.1 | `flint-electron-ipc` | Integrate consensus gate into `electron/orchestrator.ts` | 2b.1 |
| 2c.2 | `flint-ast-surgeon` | Register `flint_consensus_report` in `flint-mcp/src/server.ts` | 2b.2 |
| 2c.3 | `flint-design-engineer` | Update `DiffCard.tsx` with consensus badge | 2a.1 (types only) |
| 2c.4 | `flint-design-engineer` | Update `AgentDashboard.tsx` with consensus stats section | 2a.1 (types only) |

### Phase 2d (Sequential -- depends on 2c)

| Step | Agent | Task | Blocked By |
|------|-------|------|-----------|
| 2d.1 | `flint-test-writer` | Write tests for `consensusGateService.ts` | 2b.1 |
| 2d.2 | `flint-test-writer` | Write tests for `consensusQueryService.ts` | 2b.2 |
| 2d.3 | `flint-test-writer` | Write tests for DiffCard consensus badge | 2c.3 |
| 2d.4 | `flint-test-writer` | Write tests for AgentDashboard consensus section | 2c.4 |

### Phase 3

| Step | Agent | Task |
|------|-------|------|
| 3.1 | `flint-integration-validator` | Full integration validation: TSC + all test suites + E2E smoke test |

---

## 12. Test Matrix

### 12.1 `electron/consensusGateService.test.ts`

| Test Case | Description |
|-----------|-------------|
| `resolveConfig returns domain defaults` | Each of the 6 domains returns the correct default config |
| `resolveConfig merges policy overrides` | Explicit policy.json fields override domain defaults |
| `shouldFireGate returns false for green` | Green MRS never triggers the gate |
| `shouldFireGate returns true for amber when minimumTier=amber` | Amber triggers when threshold is amber |
| `shouldFireGate returns false for amber when minimumTier=red` | Amber does not trigger when threshold is red |
| `shouldFireGate returns true for red regardless of minimumTier` | Red always triggers |
| `shouldFireGate returns false when enabled=false` | Gate disabled means no firing |
| `evaluate returns agree_approve on secondary approve` | Happy path: secondary agrees |
| `evaluate returns disagree on secondary reject` | Disagreement path |
| `evaluate returns error on API failure` | Network error -> fail open |
| `evaluate returns skipped on timeout` | AbortSignal timeout -> fail open |
| `evaluate returns error on malformed response` | Non-JSON response -> fail open |
| `persistRecord inserts into consensus_records` | SQLite round-trip |
| `persistRecord handles duplicate id gracefully` | Idempotent insert |
| `evaluate does not include primary reasoning in secondary prompt` | Verify the secondary agent receives no conversation history |
| `evaluate includes domain-specific rules in secondary prompt` | Healthcare domain injects PHI rules |

### 12.2 `flint-mcp/src/core/governance/__tests__/consensusQueryService.test.ts`

| Test Case | Description |
|-----------|-------------|
| `getSummary returns zero counts on empty table` | Empty state |
| `getSummary computes disagreement rate correctly` | 3 disagree / 10 total = 0.3 |
| `getSummary returns recent disagreements up to limit` | Limit = 10 |
| `getBySession filters correctly` | Only returns records for the given session |
| `getByAgent filters correctly` | Only returns records for the given agent |
| `getDisagreements returns only disagree outcomes` | Filters by outcome |
| `pruneRecords deletes old records` | Prune by timestamp |
| `getSummary handles concurrent reads` | No locking issues |

### 12.3 DiffCard consensus badge tests

| Test Case | Description |
|-----------|-------------|
| `renders no badge when consensusOutcome is undefined` | Green tier, no gate |
| `renders agree badge when consensusOutcome is agree_approve` | Emerald badge |
| `renders disagree badge with reasoning when consensusOutcome is disagree` | Amber badge + tooltip |
| `renders unavailable badge when consensusOutcome is error` | Zinc badge |
| `renders unavailable badge when consensusOutcome is skipped` | Zinc badge |

### 12.4 AgentDashboard consensus section tests

| Test Case | Description |
|-----------|-------------|
| `renders consensus section when data is available` | Shows disagreement rate |
| `renders empty state when no consensus data` | Graceful empty |
| `disagreement rate displays as percentage` | 0.3 -> "30%" |

---

## 13. Risks

| Risk | Severity | Commandment Threatened | Mitigation |
|------|----------|----------------------|------------|
| Secondary agent latency adds 2-5s to amber/red mutations | Medium | UX responsiveness | Use Haiku (fast model). Configurable timeout (default 15s). Fail open on timeout. |
| Secondary agent API call doubles API cost for amber/red mutations | Low | Cost | Haiku is cheap. Only fires on amber/red (minority of mutations). Disabled by default for `general` domain. |
| Circular import: `consensusGateService.ts` imports from `orchestrator.ts` | High | Module isolation | Only import TYPE definitions (`MRSAssessment`, `MRSTier`) -- use `import type`. `readConfig` is also needed but can be passed as a dependency. |
| Secondary agent shares the same API key as primary | Low | Security | Acceptable -- same user, same project, same billing. The key is already in main process memory. |
| Race condition: multiple tool_call blocks in one `message_stop` event | Medium | Correctness | Each `block` in the `for (const block of finalMsg.content)` loop is evaluated independently. Consensus gate calls are sequential within the loop. |
| `consensus_records` table grows unbounded | Low | Performance | Add `pruneRecords()` to the existing session cleanup. MCP tool provides a prune API. |
| Primary reasoning leaks into secondary agent context | High | Epistemic independence | The `ConsensusGateInput` type enforces `includePrimaryReasoning: false`. The secondary prompt is constructed from scratch with only the AST snapshot + mutation. No conversation history crosses. |

---

## 14. What This Contract Does NOT Cover

- **Multi-provider support**: V.4 assumes Anthropic for the secondary agent. If the user has configured OpenAI or Gemini as their provider, the consensus gate uses Anthropic Haiku regardless (it has its own API key config). If no Anthropic key is available, the gate is disabled (outcome = `skipped`). Multi-provider secondary agents are deferred to a future phase.
- **Custom secondary models**: The `secondaryModel` config field allows users to override the default Haiku model, but only within the Anthropic roster. Cross-provider models are deferred.
- **Consensus on non-mutation tools**: Only mutation tools trigger the gate. Read-only tools (`flint_read_code`, etc.) never trigger consensus.
- **Inter-agent consensus**: V.4 covers a single secondary agent. A future phase could extend to N evaluators with majority voting. The `EvaluatorVerdict` type is designed to accommodate this (each evaluator gets a verdict record).
