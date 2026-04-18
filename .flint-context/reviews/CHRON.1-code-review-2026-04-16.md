# CHRON.1 — Code Review

**Reviewer:** Flint Code Reviewer (quality gate)
**Date:** 2026-04-16
**Phase:** CHRON.1 (Reason-on-Override, Citadel: Chronicle)
**Scope:** 11 prod files, 6 test files, contract artifacts

---

## Verdict: FIX-BEFORE-SHIP

The core flow works end-to-end in Electron and the 59 new tests pass locally. However, two categories of defects block a clean ship:

1. A public type-surface drift (`flint-api.d.ts`) that puts the renderer implementation and its declared contract out of sync. This produces real `TS2339` errors in `GovernanceDashboard.tsx` when the app-level tsconfig is checked explicitly.
2. A web-build parity regression. `server/index.ts` was not touched, so the CHRON.1 reason pipeline is silently dropped in `npm run dev:web` and `web-api.ts`'s optimistic typing mis-describes what the web adapter actually receives.

Both are one-file fixes. No redesign needed.

---

## Blocking Issues

### BLK-1 — `flint-api.d.ts` GovernanceAPI types not updated for CHRON.1

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/types/flint-api.d.ts`

`approveMutation` signature is stale:

```ts
// src/types/flint-api.d.ts:2354
approveMutation?: (id: number) => Promise<void>
```

The orchestratorStore calls it as `approveMutation(0, reason)`. TypeScript tolerates the excess arg at call sites, so it slips past TSC at the caller. But every IDE/hover/documentation view will show the wrong signature, and any future strict check (`strictExcessArgs`, or explicit unit tests that assert `.length`) will fail.

`getAuditLog` return type is also stale:

```ts
// src/types/flint-api.d.ts:2372
getAuditLog?: (opts?: { limit?: number }) => Promise<Array<{
    id: number | string
    timestamp: string
    action: string
    filePath: string
    description: string
    // ← missing: metadata, ruleId
}>>
```

This causes **real TS2339 errors** in `src/components/ui/GovernanceDashboard.tsx` lines 130, 134, 136, 141 when `tsc --noEmit -p tsconfig.app.json` runs (the errors were masked by incremental `tsBuildInfoFile` caching on the first run I did — on a clean invocation they surface).

Verified via:
```
src/components/ui/GovernanceDashboard.tsx(130,28): error TS2339: Property 'ruleId' does not exist on type '{ id: string | number; timestamp: string; action: string; filePath: string; description: string; }'.
src/components/ui/GovernanceDashboard.tsx(134,27): error TS2339: Property 'metadata' does not exist ...
src/components/ui/GovernanceDashboard.tsx(136,57): error TS2339: Property 'metadata' does not exist ...
src/components/ui/GovernanceDashboard.tsx(141,35): error TS2339: Property 'ruleId' does not exist ...
```

The implementations in `electron/preload.ts:1062-1073` and `src/adapters/web-api.ts:539-540` already include `metadata?: string | null` and `ruleId?: string | null`. The canonical `.d.ts` just needs the same update.

**Fix:**
```ts
approveMutation?: (id: number, reason?: string) => Promise<void>

getAuditLog?: (opts?: { limit?: number }) => Promise<Array<{
    id: number | string
    timestamp: string
    action: string
    filePath: string
    description: string
    metadata?: string | null
    ruleId?: string | null
}>>
```

### BLK-2 — Web build (`server/index.ts`) was not updated

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/server/index.ts`

The contract explicitly listed `src/adapters/web-api.ts` in the impact map and the web adapter was updated, but the companion server-side handlers were not. Three specific drifts:

1. `governance:approve-mutation` — `server/index.ts:2156-2159` ignores the `reason` arg entirely and writes a SQL statement that does not set `justification`:
   ```ts
   handlers.set('governance:approve-mutation', (id: unknown): void => {
     if (typeof id !== 'number') throw new TypeError(...)
     try { db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now') WHERE id = ?`).run(id) } catch { /* table may not exist */ }
   })
   ```
   Result: in the web build, every CHRON.1 reason the user types is silently dropped. The compliance UX claim is false for `npm run dev:web`.

2. `governance:get-audit-log` — `server/index.ts:2166-2176` does not `SELECT metadata` or `rule_id`, so the `overrideReasonMap` in `GovernanceDashboard` will always be empty in the web build even when overrides have been recorded with reasons.

3. No `CREATE TABLE IF NOT EXISTS mutations_ledger` DDL guard in `server/index.ts`. The electron-side got it in `electron/store.ts:312-341` (contract-aligned), but the web server still silently swallows the UPDATE inside try/catch when the table is missing. That's the exact Commandment 12 scenario the Electron guard was added to prevent — the web build has the original bug unresolved.

This is a cross-ref of the `feedback_web_parity_drift` memory: after any `electron/main.ts` IPC change, diff against `server/index.ts`. That step was not done.

**Fix:**
- Mirror the three DDL + UPDATE + SELECT changes from `electron/main.ts` and `electron/store.ts` into `server/index.ts`.

---

## Major Issues

### MAJ-1 — `approveMutation(0, reason)` sentinel — architectural smell

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/store/orchestratorStore.ts:582`

```ts
// src/store/orchestratorStore.ts:575-586
// CHRON.1: Log reason via governance IPC if available.
// approveMutation expects a numeric ledger id; we pass 0 as a sentinel
// here since tool-call mutations are not yet tracked in mutations_ledger
// by the orchestrator path. The reason string is still recorded in the
// tool_result content for audit-trail purposes.
if (reason && window.flintAPI.governance?.approveMutation) {
    try {
        await window.flintAPI.governance.approveMutation(0, reason)
    } catch { /* Non-fatal */ }
}
```

The DB runs `UPDATE mutations_ledger SET approved_at = ..., justification = ? WHERE id = 0`. Three problems:

1. **Silent no-op.** The orchestrator path never creates a `mutations_ledger` row, so `WHERE id = 0` updates zero rows. The reason is never persisted to the ledger. The justification claim in the comment — "The reason string is still recorded in the tool_result content for audit-trail purposes" — is true only for the in-memory chat transcript, not for anything the audit_report or SARIF pipeline queries.
2. **Semantic confusion.** `id=0` looks like a valid ledger ID; a future developer reading the SQL may reasonably assume it references a real row. If someone ever seeds id=0 (unlikely but possible with `INSERT OR IGNORE ... VALUES (0, ...)`), the wrong row gets mutated.
3. **Auto-incrementing PK collision risk.** SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` starts at 1, so id=0 cannot collide today, but the code reads as if it's relying on an implementation detail rather than an explicit "no ledger row yet" pathway.

**Recommended fix (options, pick one):**
- **Option A (best):** Add a "pre-approved ghost row" insertion to the orchestrator mutation path — insert a `mutations_ledger` row at the moment the tool_call chunk arrives, return its `lastInsertRowid`, pass that into `approveToolCall`, and approve-by-real-id. This aligns the orchestrator path with the MRS path instead of forking behavior.
- **Option B:** Change the IPC name to `governance:record-orchestrator-reason` for this code path — no ledger id, just filePath + reason + timestamp into `governance_events` with `event_type='override'`. That would also fix the SARIF override lookup, which currently queries `override_events` keyed on ruleId+filePath and never sees the orchestrator reasons.
- **Option C (cheapest):** Delete the id=0 call and keep the reason in the tool_result only. Be honest in the comment that the reason is not persisted to the ledger.

The current code claims persistence it does not provide. That's worse than either extreme.

### MAJ-2 — Store calls `window.flintAPI` directly (anti-pattern reinforced)

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/store/orchestratorStore.ts:580`

CLAUDE.md lists as an explicit anti-pattern: "Calling `window.flintAPI` inside a Zustand store action (IPC belongs in components/hooks/services)."

This is pre-existing in `orchestratorStore` (lines 78, 95, 96, 268, 334, 400, 406, 430, 435, 440, 466, 510, 574). CHRON.1 adds another occurrence on line 582 without extracting to a service layer. TODO comments acknowledging the debt are sprinkled throughout but nothing new is being consolidated.

Not a blocker — the pattern existed before CHRON.1 — but the phase was an opportunity to extract a `governanceService` or similar and it was not taken. The `reason` wiring makes the antipattern surface larger. Flag for backlog.

### MAJ-3 — TODO comment in `orchestrator.ts` still present after phase is supposedly complete

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/electron/orchestrator.ts:1875-1878`

```ts
// TODO: CHRON.1 — when green-tier auto-approval is added,
// pass reason: 'auto' to recordProvenance here before surfacing
// the tool_call chunk. Green-tier mutations currently surface
// to the DiffCard UI for user confirmation like amber/red.
```

If green-tier auto-approval is out of scope for CHRON.1 (confirmed — contract non-goal: "No reason prompts for Green-tier mutations"), the TODO should be filed as a backlog ticket and deleted, or restated without the phase tag. Leaving "TODO: CHRON.1" in the code after CHRON.1 ships reads like incomplete work.

**Fix:** Either file as a follow-up ticket and remove the TODO, or restate as `// NOTE: green-tier auto-approval (out of scope) would call recordProvenance(reason='auto') here`.

### MAJ-4 — `getAuditLog` fetch is run on every `activeFilePath` change, no pagination awareness

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernanceDashboard.tsx:123-146`

Every time the active file changes, the dashboard requests the last 200 audit log entries, client-filters for `event_type='override'` matching ruleId+filePath, and builds a Map. For a long-running session with hundreds of files and thousands of audit events, this:

1. Pulls 200 events per file-switch (linear with active file changes).
2. Discards ~95% of them because most won't be overrides.
3. Does not re-query when new overrides land between file-switches (stale data until next file change).

A `governance:get-overrides-for-file(filePath)` endpoint would be cheaper and more direct. Not a blocker but worth a follow-up.

---

## Minor Issues / Nits

- **MIN-1** — `DiffCard.chron1.test.tsx:21-22`: unused type-level smoke checks produce `TS6196` errors. Prefix with `@ts-expect-error` or use `void` expressions.
- **MIN-2** — `orchestratorStore.chron1.test.ts:68-73`: the first test is a tautology (`typeof approveToolCall === 'function'`). Remove it — the 7 others cover the real contract.
- **MIN-3** — `ViolationCard.tsx:532`: the filter `overrideReason && overrideReason !== 'skipped'` is redundant with the dashboard-side filter in `GovernanceDashboard.tsx:140` (`if (reason && reason !== 'skipped')`). Pick one — duplicating the same condition in two layers makes future changes error-prone.
- **MIN-4** — DiffCard's reason input (`DiffCard.tsx:445-452`) uses `text-[10px]` — arbitrary Tailwind size. That's consistent with the surrounding file's prior choices, but flags Mithril. Low priority since the whole file is pre-existing non-token text sizing.
- **MIN-5** — The contract claims `resolveReasonForStorage` and `getReasonRequirement` are utilities callers should use. In the shipped code they are defined only in the contract file and in the test file — no production code calls them. Either delete them from the contract (they're aspirational) or extract them to `shared/chron1.ts` and use them in `DiffCard` and the IPC handler. Right now they look like contract mandates that were ignored.
- **MIN-6** — `electron/main.ts:3838`: comment says "trim whitespace; store null when no meaningful reason provided" but the impl additionally rejects non-string values. That's good defensive behavior — just update the comment to match.
- **MIN-7** — `electron/main.ts:3841`: the `try { } catch { /* table may not exist */ }` fallback is now obsolete given the DDL guard in `store.ts`. Can be removed, or kept with a clarifying comment ("defensive — DDL guard makes this unreachable in practice").

---

## What Works Well

- **Atomic SQL.** The CHRON.1 update is a single SQL statement (`electron/main.ts:3840`): `UPDATE mutations_ledger SET approved_at = ..., justification = ? WHERE id = ?`. That satisfies Commandment 12 cleanly. TB-7 test locks in the atomicity assertion.
- **Dead-code guard for red empty input.** `resolveReasonForStorage('red', '')` returns `'skipped'` as a defensive fallback. The contract acknowledges the UI blocks this path; the test locks it in anyway. Good Design-by-Contract hygiene.
- **Whitespace normalization.** `reason.trim().length > 0 ? reason.trim() : null` in both the contract helper and the IPC handler produces consistent storage across UI and programmatic callers.
- **Clean separation between MRS ledger flow and orchestrator DiffCard flow.** The contract called this out explicitly; the implementation honors it by writing to `justification` via two paths (MCP-side `mutationLedgerService` unchanged, Electron-side handler added) that target the same column.
- **DDL guard mirror is schema-complete.** `electron/store.ts:325-340` includes every column from `flint-mcp/src/core/governance/mutationLedgerService.ts` DDL (`mutation_id`, `before_snapshot`, `after_snapshot`, `session_id`, etc.). MCP `CREATE IF NOT EXISTS` will no-op cleanly when both paths fire.
- **Test coverage against contract.** 55 of 55 CHRON.1 testBoundary assertions covered, plus 14 boundary-adjacent edge cases (non-string reason, whitespace-only red input, malformed metadata, preload vs web-api adapter symmetry). That's a strong pyramid.
- **Failure isolation.** `approveMutation` IPC failure does not block `applyBatch` success (orchestratorStore.chron1.test.ts line 125-135). Reason logging degrades gracefully.

---

## Test Coverage Gaps

Despite the strong coverage overall, three gaps:

1. **GovernanceDashboard integration test for `overrideReasonMap` build.** No test asserts that when `getAuditLog` returns real audit entries, the dashboard filters by `action === 'override'` + `ruleId + filePath match` correctly. The unit-level ViolationCard tests pass the prop directly — nothing validates the prop-sourcing path end-to-end. Malformed metadata JSON handling (try/catch at `GovernanceDashboard.tsx:138`) is also untested.

2. **No DB-race / concurrent-write test** for the CHRON.1 DDL guard. Contract risk #1 says "The Electron DDL guard mirrors the full MCP-side DDL schema so both paths produce identical tables" — no test asserts this. A simple test that runs both DDL statements in sequence and asserts schema equivalence would prevent silent drift when one side changes.

3. **No web-api parity test.** Given BLK-2 (web build was not updated), the absence of any test that exercises `server/index.ts` handlers for `governance:approve-mutation` with reason confirms the gap was not checked. Adding a server-side handler test (`server/__tests__/governance.test.ts` or similar) would prevent the drift.

---

## Test Results

```
MCP:   14/14 passing (7 mutationProvenance + 7 auditReport — both CHRON.1 suites)
Glass: 23/23 passing (10 DiffCard + 5 ViolationCard + 8 orchestratorStore)
IPC:   22/22 passing (approveMutationIpc.chron1.test.ts — handler logic, preload, web-api, utilities)
TSC (tsconfig.json):       exit 0 (incremental cache masks errors)
TSC (tsconfig.app.json):   4 CHRON.1-attributable errors (TS2339 ruleId / metadata) + pre-existing errors unrelated to CHRON.1
```

---

## Commandment Audit

| # | Commandment | Status | Notes |
|---|-------------|--------|-------|
| 3 | Fresh Parse | N/A | No AST mutation in CHRON.1 |
| 7 | ID Preservation | N/A | No structural ops |
| 10 | History Clear | N/A | No file-switch paths touched |
| 12 | Atomic Queuing | PARTIAL | Electron path atomic; web path silently drops `reason` (see BLK-2) |
| 13 | No Regex Surgery | PASS | No source-code regex |
| 14 | Bypass Prohibition | PASS | All reason writes go through IPC handler |
| 15 | AST Catalog | N/A | No AI tool catalog changes |
| 16 | TSC Loop | N/A | Validation loop untouched |

---

## Fix Checklist Before Ship

1. [ ] BLK-1: update `src/types/flint-api.d.ts` — `approveMutation(id, reason?)` + `getAuditLog` return includes `metadata` and `ruleId`
2. [ ] BLK-2: mirror CHRON.1 changes into `server/index.ts` (`governance:approve-mutation` writes `justification`, `governance:get-audit-log` returns `metadata`+`rule_id`, add DDL guard)
3. [ ] MAJ-1: decide ledger strategy — implement Option A or B, or at minimum update the comment to reflect what actually happens (Option C)
4. [ ] MAJ-3: delete or re-label TODO at `electron/orchestrator.ts:1875`
5. [ ] MIN-1: silence the unused-type-alias warnings in DiffCard.chron1.test.tsx
6. [ ] Re-run `tsc --noEmit -p tsconfig.app.json` — confirm the four TS2339 errors clear

Once BLK-1 and BLK-2 are fixed and MAJ-1 has a clear decision, CHRON.1 is ready to ship.
