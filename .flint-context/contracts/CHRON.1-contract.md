# CHRON.1 Contract Artifact -- Reason-on-Override

**Phase:** CHRON.1
**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-16
**Citadel Name:** Chronicle

---

## Summary

Adds risk-tiered reason collection to governance overrides and high-risk mutations. Green-tier mutations auto-log `"auto"`. Amber mutations show an optional reason prompt. Red mutations and all overrides require a reason before confirmation.

---

## Architectural Discovery: Minimal DDL Guard Required

After reading the source, the MCP-side schema already supports reasons:

- `override_events` table (in `overrideTelemetryService.ts` line 36): **already has `reason TEXT`**
- `mutations_ledger` table (in `mutationLedgerService.ts` line 48): **already has `justification TEXT`**
- `mutation_provenance` table (in `mutationProvenanceService.ts` line 46): **already has `provenance_reasoning TEXT`**

The `OverrideEvent` type already has `reason: string | null`. The `MutationLedgerEntry` type already has `justification?: string`. The `MutationProvenance` type already has `provenanceReasoning: string | null`.

**No ALTER TABLE statements on the MCP side. No DDL migrations.** The columns exist but are never populated from the UI. CHRON.1 is primarily a wiring + UI feature.

**DDL Guard for Electron-only deployments:** The `mutations_ledger` table is created by the MCP-side `mutationLedgerService.ts`, not by `electron/store.ts`. In Electron-only deployments (no MCP sidecar running), the table does not exist and the `governance:approve-mutation` handler's `UPDATE` silently fails inside try/catch. This violates Commandment 12 (Atomic Queuing) for a compliance feature. CHRON.1 adds a `CREATE TABLE IF NOT EXISTS mutations_ledger` DDL guard to `electron/store.ts` that mirrors the MCP-side schema, ensuring reason logging works regardless of whether the MCP sidecar has initialized.

**Approval flow clarification:** CHRON.1 wires into the chat-based DiffCard approval flow (`orchestratorStore.approveToolCall` -> `governance:approve-mutation` IPC). This is separate from the MRS ledger flow which records mutations_ledger rows from the MCP side. Both paths write to the same `justification` column.

---

## Impact Map

| File | Change Type | Owner Agent | Summary |
|------|------------|-------------|---------|
| `src/components/ui/DiffCard.tsx` | MODIFY | flint-design-engineer | Add reason input (optional at amber, required at red); change `onApprove` to `onApprove(id, reason)` |
| `src/components/ui/DiffCard.tsx` (types) | MODIFY | flint-design-engineer | `DiffCardProps.onApprove` gains `reason?: string` param |
| `src/store/orchestratorStore.ts` | MODIFY | flint-state-architect | `approveToolCall` action gains `reason?: string` param, passes it to IPC |
| `electron/main.ts` | MODIFY | flint-electron-ipc | `governance:approve-mutation` IPC gains `reason` param, writes to `justification` column |
| `electron/store.ts` | MODIFY | flint-electron-ipc | DDL guard: `CREATE TABLE IF NOT EXISTS mutations_ledger` with full schema mirroring MCP-side DDL |
| `electron/orchestrator.ts` | MODIFY | flint-electron-ipc | `tool_call` chunk type gains `reason?: string` in the onChunk payload when user approves |
| `src/types/flint-api.d.ts` | MODIFY | flint-state-architect | `OrchestratorChunk` gains `reason?: string`; `PendingMutation` gains `reason?: string` |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | `governance:approve-mutation` bridge passes reason param |
| `src/adapters/web-api.ts` | MODIFY | flint-electron-ipc | Web adapter `approveMutation` passes reason param |
| `flint-mcp/src/core/governance/mutationProvenanceService.ts` | MODIFY | flint-ast-surgeon | `recordProvenance()` adds `reason` param (maps to existing `provenance_reasoning` column) |
| `flint-mcp/src/tools/auditReport.ts` | MODIFY | flint-ast-surgeon | SARIF `message.text` includes override reason when available (fetched via overrideTelemetryService by ruleId+filePath) |
| `src/components/ui/governance/ViolationCard.tsx` | MODIFY | flint-design-engineer | Show past override reason when one exists for rule+file (data from existing `governance:get-audit-log` IPC) |
| `src/hooks/useGovernanceDefer.ts` | NO CHANGE | -- | Deferrals already have `reason` -- no change needed |
| `src/components/ui/__tests__/DiffCard.test.tsx` | MODIFY | flint-test-writer | Test reason input visibility by tier, required validation at red |
| `flint-mcp/src/__tests__/mutationProvenance.test.ts` | MODIFY | flint-test-writer | Test `recordProvenance` with reason param |

---

## Type Contracts

### 1. DiffCard Props Change

```typescript
// BEFORE
onApprove: (id: string) => void

// AFTER
onApprove: (id: string, reason?: string) => void
```

### 2. OrchestratorChunk Extension

```typescript
// Add to existing OrchestratorChunk interface in flint-api.d.ts:
export interface OrchestratorChunk {
    // ... existing fields unchanged ...
    /** MRS risk tier for tool_call chunks. */
    riskTier?: 'green' | 'amber' | 'red'
    /** MRS risk score (0.0-1.0) for tool_call chunks. */
    riskScore?: number
    /** Whether the mutation requires human review (amber + escalation). */
    requiresReview?: boolean
    /** Whether the mutation requires explicit sign-off (red tier). */
    requiresSignoff?: boolean
    /** Human-provided reason for approving this mutation (CHRON.1). */
    reason?: string
}
```

### 3. PendingMutation Extension

```typescript
export interface PendingMutation {
    id: number
    type: string
    filePath: string
    riskScore: number
    riskTier: string
    agentId?: string
    /** Override/approval reason from the user (CHRON.1). */
    reason?: string
}
```

### 4. ReasonRequirement Utility Type

```typescript
/** Determines reason requirement based on MRS tier. */
export type ReasonRequirement = 'none' | 'optional' | 'required'

export function getReasonRequirement(tier: 'green' | 'amber' | 'red', isOverride: boolean): ReasonRequirement {
    if (isOverride) return 'required'
    switch (tier) {
        case 'green': return 'none'
        case 'amber': return 'optional'
        case 'red': return 'required'
    }
}
```

### 5. resolveReasonForStorage Utility

```typescript
/**
 * Resolves the actual reason string to store, based on user input and tier.
 *
 * NOTE (W.C): The empty-string -> 'skipped' path for red tier is dead code.
 * The DiffCard UI disables the Apply button when input is empty for red tier,
 * so resolveReasonForStorage('red', '') can never be reached via the UI.
 * The fallback exists purely as a defensive guard for programmatic callers.
 */
export function resolveReasonForStorage(
    tier: 'green' | 'amber' | 'red',
    userInput: string | undefined,
): string {
    if (tier === 'green') return 'auto'
    if (!userInput || userInput.trim().length === 0) return 'skipped'
    return userInput.trim()
}
```

### 6. Override Reason Display Props (ViolationCard)

```typescript
/**
 * Props extension for ViolationCard to show past override reason.
 *
 * Data source: GovernanceDashboard fetches governance_events via the existing
 * governance:get-audit-log IPC, filters for event_type='override' matching
 * ruleId+filePath, and extracts reason from the metadata JSON column.
 * No new IPC channel required.
 */
export interface OverrideReasonDisplayProps {
    /** The override reason text, or null if no override exists. */
    overrideReason: string | null
    /** When the override was recorded. */
    overrideTimestamp?: string
    /** Who performed the override. */
    overrideActor?: string
}
```

---

## IPC Channel Changes

No new IPC channels created. Existing channels gain parameters:

| Channel | Direction | Current Signature | New Signature |
|---------|-----------|-------------------|---------------|
| `governance:approve-mutation` | renderer -> main | `(id: number) => void` | `(id: number, reason?: string) => void` |
| `governance:get-pending-mutations` | renderer -> main | returns `PendingMutation[]` | returns `PendingMutation[]` (with `reason` field populated from `justification` column) |

### Electron main.ts IPC Handler Changes

**`governance:approve-mutation`** (line 3835):
```typescript
// BEFORE
ipcMain.handle('governance:approve-mutation', (_event, id: unknown): void => {
    if (typeof id !== 'number') throw new TypeError(...)
    db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now') WHERE id = ?`).run(id)
})

// AFTER
ipcMain.handle('governance:approve-mutation', (_event, id: unknown, reason: unknown): void => {
    if (typeof id !== 'number') throw new TypeError(...)
    const reasonStr = typeof reason === 'string' ? reason : null
    db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?`).run(reasonStr, id)
})
```

### preload.ts Bridge Change

```typescript
// BEFORE
approveMutation: (id: number) => ipcRenderer.invoke('governance:approve-mutation', id)

// AFTER
approveMutation: (id: number, reason?: string) => ipcRenderer.invoke('governance:approve-mutation', id, reason)
```

### web-api.ts Adapter Change

```typescript
// BEFORE
approveMutation: (id: number) => invoke('governance:approve-mutation', id)

// AFTER
approveMutation: (id: number, reason?: string) => invoke('governance:approve-mutation', id, reason)
```

---

## Store Contracts

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| `orchestratorStore` | None | `approveToolCall(id: string, reason?: string)` signature change | None |

The `orchestratorStore.approveToolCall` currently calls `onApprove(id)`. It must change to pass `reason` through.

---

## Component Contracts

| Component | Props Change | Store Dependencies | IPC Calls |
|-----------|-------------|-------------------|-----------|
| `DiffCard` | `onApprove: (id: string, reason?: string) => void`; new internal state for reason input | None | None (parent handles IPC) |
| `ViolationCard` | New `overrideReason?: string` prop | None | None (parent passes data) |
| `GovernanceDashboard` | Fetches override reasons via existing `governance:get-audit-log` IPC (filters `governance_events` rows where `event_type='override'`, extracts reason from `metadata` JSON column) | `canvasStore` (existing) | `governance:get-audit-log` (existing) |

### DiffCard Internal Behavior

```
State: reasonText (string), reasonTouched (boolean)

When riskTier === 'green':
  - No reason input rendered
  - onApprove(id) called with no reason (reason defaults to 'auto' on server side)

When riskTier === 'amber':
  - Render optional text input: "Why is this change needed? (optional)"
  - Apply button always enabled
  - onApprove(id, reasonText || 'skipped') on click

When riskTier === 'red':
  - Render required text input: "Why is this change needed?"
  - Apply button disabled until reasonText.trim().length > 0
  - onApprove(id, reasonText) on click
```

---

## Commandment Checklist

| # | Commandment | Applies? | How Satisfied |
|---|-------------|----------|---------------|
| 1 | Code is Truth | No | No AST changes |
| 9 | CIEDE2000 | No | No color logic changes |
| 10 | Targeted Micro-Recovery | No | No undo changes |
| 12 | Atomic Queuing | Yes | Reason is written atomically with the `UPDATE mutations_ledger` in the same SQL statement |
| 14 | Bypass Prohibition | Yes | Override reason recording uses the existing `OverrideTelemetryService` path, not direct fs |

---

## Test Boundaries

### DiffCard Tests (`src/components/ui/__tests__/DiffCard.test.tsx`)

1. **Green tier: no reason input rendered.** Render DiffCard with `riskTier="green"`. Assert no text input with label matching "reason" or "why" is in the DOM.
2. **Amber tier: optional reason input rendered.** Render DiffCard with `riskTier="amber"`. Assert text input is visible. Assert Apply button is enabled with empty input.
3. **Amber tier: skipped reason sends 'skipped'.** Render with `riskTier="amber"`, click Apply without typing. Assert `onApprove` called with `(id, 'skipped')`.
4. **Amber tier: typed reason is forwarded.** Type "brand team approved" into input, click Apply. Assert `onApprove` called with `(id, 'brand team approved')`.
5. **Red tier: required reason input rendered.** Render with `riskTier="red"`. Assert Apply button is disabled.
6. **Red tier: Apply enables after typing.** Type "justified because X", assert Apply button becomes enabled.
7. **Red tier: Apply sends typed reason.** Click Apply, assert `onApprove` called with `(id, 'justified because X')`.
8. **Red tier: whitespace-only does not enable Apply.** Type "   ", assert Apply button remains disabled.

### Provenance Service Tests (`flint-mcp/src/__tests__/mutationProvenance.test.ts`)

9. **recordProvenance stores reason in provenance_reasoning.** Call `recordProvenance(id, 'agent', null, null, 'brand approved')`. Read back via `getProvenance(id)`. Assert `provenanceReasoning === 'brand approved'`.
10. **recordProvenance with reason='skipped' stores 'skipped'.** Call with reasoning='skipped'. Assert stored value is 'skipped'.
11. **recordProvenance with reason=null stores null.** Existing behavior. Assert `provenanceReasoning === null`.
12. **getAuditTrail includes reason in results.** Insert provenance with reasoning. Query audit trail. Assert `provenanceReasoning` field present on trail entries.

### IPC Tests (`electron/main.ts` or integration)

13. **governance:approve-mutation writes justification.** Call handler with `(42, 'compliance requirement')`. Query `mutations_ledger WHERE id = 42`. Assert `justification = 'compliance requirement'`.
14. **governance:approve-mutation with no reason writes null justification.** Call with `(42)`. Assert `justification IS NULL` (or empty).
15. **governance:get-pending-mutations returns reason field populated from justification column.** Insert a mutations_ledger row with justification='compliance requirement'. Call `get-pending-mutations`. Assert `result[0].reason === 'compliance requirement'`.

### SARIF Tests (`flint-mcp/src/tools/auditReport.ts`)

16. **SARIF output includes override reason in properties when available.** Build SARIF with violations that have associated override reasons (fetched via overrideTelemetryService by ruleId+filePath). Assert `properties.overrideReason` field present.

### ViolationCard Tests

17. **Override reason displayed when present.** Render ViolationCard with `overrideReason="brand team approved"`. Assert text visible in DOM.
18. **Override reason hidden when null.** Render with `overrideReason={null}`. Assert no reason text visible.

---

## Wire-Up Table

| Caller | Service/Function | Params | When |
|--------|-----------------|--------|------|
| DiffCard (Apply button) | parent `onApprove(id, reason)` | id: string, reason: string or 'skipped' or undefined | User clicks Apply |
| orchestratorStore.approveToolCall | `window.flintAPI.governance.approveMutation(id, reason)` | id: number, reason?: string | After DiffCard approval |
| preload.ts bridge | `ipcRenderer.invoke('governance:approve-mutation', id, reason)` | id: number, reason?: string | IPC transport |
| electron/main.ts handler | `db.prepare(UPDATE mutations_ledger SET approved_at=..., justification=? WHERE id=?)` | reason: string or null, id: number | Main process |
| orchestrator.ts (green auto) | `recordProvenance(mutationId, 'agent', agentId, sessionId, 'auto')` | reasoning='auto' | Green-tier auto-approve |
| orchestrator.ts (amber/red) | `recordProvenance(mutationId, source, agentId, sessionId, userReason)` | reasoning=user's text | After user approval |
| GovernanceDashboard | `window.flintAPI.governance.getAuditLog({ limit: 100 })` then filters for `event_type='override'` matching ruleId+filePath, extracts reason from metadata JSON | filePath: string, ruleId: string (client-side filter) | On violation card render |
| ViolationCard | receives `overrideReason` prop from parent | reason: string or null | Display only |
| auditReport.ts SARIF builder | reads reason from provenance/override DB | via service query | On `flint_audit_report` call |

---

## Implementation Order

### Group 1 (Parallel -- no dependencies between them)

1. **flint-design-engineer**: DiffCard reason input UI (state, conditional render, Apply button gating)
2. **flint-electron-ipc**: `governance:approve-mutation` handler gains reason param; preload bridge change; web adapter change; `electron/store.ts` DDL guard for `mutations_ledger`
3. **flint-test-writer**: Test scaffolds (`.todo` stubs for all 18 test boundaries)

### Group 2 (Depends on Group 1)

4. **flint-state-architect**: `orchestratorStore.approveToolCall` wiring to pass reason through DiffCard -> IPC
5. **flint-design-engineer**: ViolationCard override reason display (fetch from `governance:get-audit-log` + render). NOTE: ViolationCard.tsx has zero imports from DiffCard.tsx -- these are fully independent components. Group A DiffCard work and Group B ViolationCard work can run in true parallel.
6. **flint-ast-surgeon**: SARIF builder enrichment in `auditReport.ts`; `mutationProvenanceService.recordProvenance()` gains `reason` param

### Group 3 (Depends on Group 2)

7. **flint-test-writer**: Full test assertions (convert `.todo` to real tests)
8. **flint-integration-validator**: End-to-end validation

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `mutations_ledger` DDL guard in `electron/store.ts` creates a table with fewer usage patterns than the MCP-side. MCP startup runs `CREATE IF NOT EXISTS` which no-ops if the table exists. | Medium | The Electron DDL guard mirrors the full MCP-side DDL schema so both paths produce identical tables. |
| Amber "skipped" reasons may pollute audit reports with noise | Low | SARIF builder should filter out `reason: "skipped"` from display or mark it distinctly |
| DiffCard already has tight vertical space; adding a text input may cause layout overflow | Low | Use a collapsed/expandable pattern or inline the input below the reasoning section |
| `orchestratorStore` may not exist as a formal store (approval may be handled inline in React) | Low | Read the actual approval flow in the component that renders DiffCard before implementing |
