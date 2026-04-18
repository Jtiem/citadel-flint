# CHRON.1 — Code Review v2 (Post-Polish Verification)

**Reviewer:** Flint Code Reviewer (quality gate)
**Date:** 2026-04-16
**Phase:** CHRON.1 polish pass (commit `7511d75` — `fix(chron.1-repair): ship CHRON.1 from cosmetic to functional`)
**Scope:** verification of the four prior findings (BLK-1, BLK-2, MAJ-1, MAJ-3) plus all new code introduced by the polish

---

## Verdict: FIX-BEFORE-SHIP

The polish pass cleanly resolved all four flagged items from the v1 review. The new shared sanitizer is excellent — strict pipeline ordering, well-bounded, exhaustively tested. The Zod IPC validation is genuinely defensive. The web build is at parity with Electron for the CHRON.1 reason path.

But the polish introduced a separate cluster of regressions that were not in scope of the original review and now block ship:

- **C1 schema canonicalization broke `governance:get-pending-mutations`** (both Electron and web). The handler still selects columns that no longer exist in the canonical DDL.
- **The IPC schema (`approve-mutation`) requires `id: number`, but the canonical schema uses `TEXT` hex ids.** The MRS approval flow is now end-to-end broken — pending mutations cannot be approved through the new validated pipeline.
- **`OverrideReasonDialog` (M3 — newly built) is dead-code in production.** No caller in `GovernanceDashboard.tsx` or `ViolationsList.tsx` passes the `onOverride` prop, so the override button never renders. The 37 unit tests on the dialog all pass against a contract no producer satisfies.
- **`ViolationCard.overrideReason` (display props for past overrides) is also dead-code.** No caller maps the audit log into per-violation override-reason data and passes it down. The tests at `ViolationCard.chron1.test.tsx:97-200` exercise the display in isolation; the wiring from `governance_events.metadata` → card prop is absent.
- **One real TS error** in `OverrideReasonDialog.tsx:229` (`onKeyDown` signature mismatch on MUI `TextField`).

The CHRON.1 reason pipeline is now functional end-to-end *for the orchestrator path* (DiffCard → `record-approval-reason` IPC → `governance_events`). The user-initiated override path and the MRS pending-approval path are both broken.

---

## Prior Findings Verification

### BLK-1 — `flint-api.d.ts` GovernanceAPI types — RESOLVED

Verified at `src/types/flint-api.d.ts:2349-2394`:
- `approveMutation?: (id: number, reason?: string) => Promise<void>` — second parameter added
- `getAuditLog` return type now includes `metadata?: string | null` (line 2391) and `ruleId?: string | null` (line 2393)
- A new sibling method `recordApprovalReason?` (line 2368) was added with full type — covers the new IPC channel

Cleared the four `TS2339` errors flagged in the v1 review:
```
$ npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "TS2339" | grep -i "ruleId\|metadata"
(no output)
```

### BLK-2 — `server/index.ts` parity — RESOLVED

Verified by direct diff against `electron/main.ts` for all three drift points:

1. **DDL guard** — `server/index.ts:440-462` adds the canonical `mutations_ledger` `CREATE TABLE IF NOT EXISTS` mirroring `electron/store.ts:324-353`. Schema is byte-equivalent.
2. **`governance:approve-mutation`** — `server/index.ts:2192-2213` now validates with the same Zod schema, runs the same `sanitizeReason` pipeline, and writes `justification = ?` in the `UPDATE`. Identical to `electron/main.ts:3851-3882`.
3. **`governance:get-audit-log`** — `server/index.ts:2250-2271` selects `metadata, rule_id AS ruleId` from `governance_events` (and corrects the prior wrong column names — see "What Works Well").

A dedicated parity test suite was added at `server/__tests__/governanceApproval.chron1.test.ts` (10 tests, all passing). This tests the handler logic by reproducing it as pure functions over `shared/reasonSanitizer` + `shared/ipc-validators`, so any future drift between Electron and web surfaces immediately.

### MAJ-1 — `approveMutation(0, reason)` sentinel — RESOLVED (Option B)

Verified at `src/store/orchestratorStore.ts:573-592`. The sentinel is gone. Replaced with a real IPC channel `governance:record-approval-reason` (the v1 review's "Option B"). End-to-end trace:

- Renderer call: `orchestratorStore.ts:580-588` — calls `window.flintAPI.governance.recordApprovalReason({ filePath, toolName, reason })`
- Preload bridge: `electron/preload.ts:1065-1066` — `ipcRenderer.invoke('governance:record-approval-reason', args)`
- Web bridge: `src/adapters/web-api.ts:546-547` — `invoke('governance:record-approval-reason', args)`
- Main handler: `electron/main.ts:3892-3933` — Zod-validates payload, sanitizes reason, calls `govEventService.recordEvent({ eventType: 'override', metadata: { reason, source: 'orchestrator', toolName }})`, broadcasts via `broadcastGovernanceOverrideRecorded()`
- Web handler: `server/index.ts:2215-2243` — same pipeline, raw `INSERT INTO governance_events`
- DB persistence: writes a real row with `event_type='override'` and `rule_id='orchestrator:<toolName>'` so the dashboard's audit log surface can find it

The reason now actually persists to a row that other tools (audit_report, SARIF) can read. Verified the helper `governance_events` table exists with required columns in both code paths.

### MAJ-3 — TODO comment in `electron/orchestrator.ts:1875` — RESOLVED

Grep confirmed:
```
$ grep -n "TODO: CHRON.1\|reason: 'auto'" electron/orchestrator.ts
(no matches)
```

The TODO was deleted outright.

---

## New Issues Introduced by the Polish

### BLK-NEW-1 — `governance:get-pending-mutations` queries non-existent columns (BLOCKER)

**Files:** `electron/main.ts:3830-3849`, `server/index.ts:2182-2190`

The polish's C1 schema canonicalization (`electron/store.ts:324-353`) replaced the legacy narrow `mutations_ledger` schema with the MCP-canonical shape. The canonical shape has `operation_type`, no `risk_score`, no `risk_tier`, no `agent_id` columns:

```sql
-- electron/store.ts:324-353 (canonical shape after polish)
CREATE TABLE IF NOT EXISTS mutations_ledger (
    id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    timestamp           TEXT NOT NULL ...,
    file_path           TEXT NOT NULL,
    node_id             TEXT,
    operation_type      TEXT NOT NULL CHECK (operation_type IN (...)),
    source              TEXT NOT NULL CHECK (source IN (...)),
    -- NO risk_score, NO risk_tier, NO agent_id, NO `type`
    ...
)
```

But the consumer handler still queries the legacy column names:

```ts
// electron/main.ts:3834-3844
const rows = db.prepare(`
    SELECT id, type, file_path as filePath, risk_score as riskScore,
           risk_tier as riskTier, agent_id as agentId
    FROM mutations_ledger
    WHERE risk_tier IN ('Amber', 'Red')
      AND approved_at IS NULL
    ORDER BY risk_score DESC
    LIMIT 50
`).all() as ...
```

In any new install (and after the legacy migration runs once), this query will throw `SqliteError: no such column: type` and the catch block silently returns `[]`. The PendingApprovalsAccordion will be permanently empty.

The same bug exists in `server/index.ts:2184-2188`.

**Fix:** Either update the SELECT to use canonical columns and remove the obsolete projection, or — if MRS risk fields are still needed — add the columns to the canonical DDL and align with MCP-side `mutationLedgerService.ts` first.

This is a regression: prior to the polish, `get-pending-mutations` worked because the legacy schema had those columns. The schema migration shipped without updating the consumers.

### BLK-NEW-2 — IPC schema rejects canonical `id` type (BLOCKER)

**Files:** `shared/ipc-validators.ts:129-135`, `electron/store.ts:324`

The canonical DDL (per polish) uses `id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))`. So real ids are 32-char hex strings like `9a3f1b7e...`.

The Zod schema for `governance:approve-mutation` requires:
```ts
payload: z.object({
    id: z.number().int().nonnegative(),   // ← rejects strings
    reason: z.string().max(1000).optional(),
}),
```

When the PendingApprovalsAccordion eventually renders (after BLK-NEW-1 is fixed) and the user clicks "Approve", the renderer will pass a hex string id and the Zod gate will throw `TypeError: invalid payload`. The MRS approval flow is end-to-end broken behind the new validation.

**Fix:** Widen the Zod schema to `id: z.union([z.number().int().nonnegative(), z.string().regex(/^[a-f0-9]{32}$/)])`, or commit fully to text ids and switch the renderer types accordingly.

The polish landed C3 (Zod gate), C1 (TEXT id schema), and BLK-2 (web parity), but didn't reconcile that Zod and the canonical schema disagree about the id type.

### BLK-NEW-3 — `OverrideReasonDialog` (M3) is dead-code in production (BLOCKER for the M3 claim)

**Files:** `src/components/ui/governance/OverrideReasonDialog.tsx` (new, 295 lines), `src/components/ui/governance/ViolationsList.tsx:128-130, 251, 303`, `src/components/ui/GovernanceDashboard.tsx`

The polish commit message says:
> M3 OverrideReasonDialog built — user-initiated overrides from ViolationCard had no reason prompt before. Risk-tiered dialog (Amber optional, Red required), wired to ViolationCard, reason displayed with actor + relative timestamp in the violation row.

Verification of the wiring chain:

- `ViolationCard.tsx:339-348` — accepts `onOverride?: (reason?: string) => void` ✓
- `ViolationsList.tsx:128-130, 251, 303` — accepts and forwards `onOverride?` to ViolationCard ✓
- `GovernanceDashboard.tsx` — **does not pass `onOverride` to ViolationsList** ✗

```
$ grep -n "onOverride" src/components/ui/GovernanceDashboard.tsx
132:        const unsub = window.flintAPI.governance.onOverrideRecorded(...)   ← unrelated
```

`ViolationCard` only renders the Override button when `onOverride` is truthy (`ViolationCard.tsx:730, 806`). Since no production caller provides it, the button never renders, the dialog is never opened, and the entire M3 path is unreachable in the running app. The 37 dialog tests pass in isolation — they exercise a path no user can ever reach.

**Fix:** Wire `onOverride` from `GovernanceDashboard` → `ViolationsList`. The handler should call `governance:record-approval-reason` (or equivalent) with the rule's filePath + ruleId + reason. Add an integration test that asserts the Override button is in the DOM when the dashboard renders a violation.

### BLK-NEW-4 — `ViolationCard.overrideReason` display props are dead-code (BLOCKER for the M3 claim)

**Files:** `src/components/ui/governance/ViolationCard.tsx:359-367, 455-483`

The polish added `overrideReason`, `overrideActor`, and `overrideTimestamp` props to ViolationCard plus a display block that renders past overrides:
```ts
// ViolationCard.tsx:474-483
{showOverrideReason && (
    <p data-testid={`override-reason-${w.id}`} ...>
        {overrideHeader}: &ldquo;{overrideReason}&rdquo;
    </p>
)}
```

But no producer in the codebase builds an `overrideReasonMap` from the audit log and passes the per-card reason in:

```
$ grep -rn "overrideReason\|overrideTimestamp\|overrideActor" src/
src/components/ui/governance/ViolationCard.tsx:363,365,367,429-431,...   ← prop sink
src/components/ui/__tests__/ViolationCard.chron1.test.tsx:...            ← unit tests only
(no production producer)
```

The prior v1 review noted this gap as MAJ-4 (the dashboard would re-fetch the audit log per file change). The polish kept the consumer surface but did not build the producer at all. So the original UX claim — "reason displayed with actor + relative timestamp in the violation row" — is false in production.

**Fix:** In `GovernanceDashboard.tsx` (or a new `useOverrideReasonMap` hook), call `getAuditLog`, filter `action === 'override'`, parse `metadata` for `reason`, build a `Map<string, { reason, actor, timestamp }>` keyed by `${ruleId}:${filePath}`, and thread it through `ViolationsList` → `ViolationCard`. Add an integration test that walks a real audit-log entry into a rendered violation card.

### BLK-NEW-5 — Real TS error in `OverrideReasonDialog.tsx:229` (BLOCKER)

```
src/components/ui/governance/OverrideReasonDialog.tsx(229,21):
  error TS2322: Type '(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void'
  is not assignable to type 'KeyboardEventHandler<HTMLDivElement>'.
```

`MUI TextField`'s `onKeyDown` is typed against the wrapping `HTMLDivElement`, not the inner input. The handler signature must be `KeyboardEventHandler<HTMLDivElement>` — or wrap the existing handler with a typed cast. Tests pass at runtime because MUI dispatches up the DOM, but TSC is correct that the contract is violated.

This is the only real CHRON.1-attributable production-code TS error after the polish — but it's in a freshly-introduced file, so it counts.

**Fix:**
```ts
const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { ... }
}
```

### MAJ-NEW-1 — Path traversal not validated on `record-approval-reason.filePath`

**Files:** `electron/main.ts:3892-3933`, `server/index.ts:2215-2243`

The new IPC handler accepts `filePath` from the renderer and stores it as a plain string in `governance_events`. It is not normalized against `app.getPath('home')` or the active project root. A malicious renderer (or a compromised tab in web mode) could write arbitrary path strings into the audit log: `/etc/passwd`, `../../../somewhere`, etc. There is no file IO so it's not directly exploitable, but it pollutes compliance artifacts and SARIF outputs.

**Fix:** Either normalize `filePath` against `activeProjectRoot` (substring or `path.resolve` containment check) before insert, or reject paths with `..` segments at the Zod gate.

### MIN-NEW-1 — Two TS6133 unused-variable warnings in CHRON.1 polish files

```
src/components/ui/governance/__tests__/ScoreSection.test.tsx(23,36):
  error TS6133: 'beforeEach' is declared but its value is never read.
src/components/ui/governance/ScoreSection.tsx(18,50):
  error TS6133: 'ShieldOff' is declared but its value is never read.
```

Cosmetic but they're in CHRON.1-touched files. Either remove the imports or eslint-disable with a comment.

### MIN-NEW-2 — `governance_events.metadata` size not capped explicitly

**Files:** `electron/main.ts:3923-3927`, `server/index.ts:2238`

The metadata JSON is built from `{ reason: sanitized, source: 'orchestrator', toolName }`. `reason` is capped at 1000 by sanitizer; `toolName` at 200 by Zod; `source` is constant. So the final payload is implicitly bounded around 1.2 KB. That's fine — but no explicit assertion exists. Worth a one-line comment in the handler so a future change to the metadata shape can't bypass the cap.

### MIN-NEW-3 — `record-approval-reason` writes through a new code path that doesn't go through `FileTransactionManager`

**Files:** `electron/main.ts:3915-3928`

This is a DB write, not a file write, so Commandment 12 (Atomic Queuing) doesn't strictly apply — `FileTransactionManager` is for filesystem writes. The DB write itself is atomic at the SQLite transaction level. No fix needed; flagging for completeness in the C12/C14 audit below.

---

## What Works Well

- **`shared/reasonSanitizer.ts` is genuinely strong.** Pipeline ordering is correct (cap → strip → redact → trim). Length cap *before* the regex work bounds the worst case; the 1 MB DoS test is in place. The `\p{Cc}\p{Cf}` Unicode strip catches the full Trojan-Source class plus zero-width chars. The 35 test cases cover every secret pattern including the high-entropy heuristic with proper anti-false-positive safeguards (mixed case + digit required).
- **Zod schemas catch realistic abuse.** Negative ids, floats, string-typed ids, missing fields, oversize reasons, oversize file paths — all rejected. 19 ipcValidators tests, all passing.
- **Web build genuinely at parity with Electron** for the CHRON.1 reason path. `governanceApproval.chron1.test.ts` (10 tests) reproduces the handler logic and verifies behavior end-to-end against the same shared modules. Drift is now structurally detectable.
- **The audit log SELECT bug fix is more substantive than the v1 review caught.** The prior implementation queried `created_at` and `description` columns that don't exist in `governance_events`. Every query was silently erroring into the catch block — meaning the dashboard's audit-log timeline had been showing nothing, ever. The polish fixes this with `timestamp AS timestamp, COALESCE(message, event_type) AS description`. This was a latent bug not flagged in v1 — credit to the polish for catching it incidentally.
- **Health score parity test (256 lines, 78 tests)** locks in cross-surface agreement between Glass ring, MCP debt report, CLI, and ScoreSection narration. This is exactly the kind of cross-surface invariant test we should have for every shared formula.
- **Risk tier is now a required prop on `DiffCard`.** The v1 review didn't mention this but the polish made `riskTier` non-optional and removed the dangerous `inferRiskTier(toolName)` fallback (which could mis-tier a `flint_update_props` on a root element as "Low risk" and bypass CHRON.1). All 23 test callers were updated. Strong defense-in-depth.
- **Clear separation of MRS path (writes `justification` on a real ledger row) vs orchestrator path (writes `governance_events` override).** Both surfaces land in the audit log, queryable through the same dashboard surface.

---

## Test Coverage Gaps (still present after polish)

1. **No integration test from `getAuditLog` → `overrideReasonMap` → ViolationCard.** The hook is missing entirely; the consumer ViolationCard tests pass props directly. So the wiring gap that BLK-NEW-4 describes is also a test-coverage gap. A test that mocks `getAuditLog` to return one override entry, renders the dashboard, and asserts the override-reason text is visible on the matching card would have caught this immediately.
2. **No test for the actual `getPendingMutations` SQL.** Both `useGovernancePendingMutations.test.ts` and the Counsel dashboard test mock the IPC. Neither asserts that the SQL query against the canonical `mutations_ledger` schema returns the expected shape. That's why BLK-NEW-1 (schema column mismatch) didn't surface — there's no test exercising the real DB.
3. **No test that the IPC schema's id type matches what `getPendingMutations` returns.** A round-trip test (`approve(getPendingMutations()[0].id)`) would have caught BLK-NEW-2.
4. **No test for the `OverrideReasonDialog` integration in the dashboard.** All 37 OverrideReasonDialog tests render the dialog directly. No test mounts the dashboard and looks for the Override button. That's why BLK-NEW-3 (no production consumer for `onOverride`) didn't surface.

These are coverage gaps in the test pyramid: unit tests are strong, contract/handler tests are strong, but the seam between the renderer and the dashboard composition is untested.

---

## Final Test Counts

```
Glass: 2796/2798 passing  (2 pre-existing StatusBar failures, unchanged from polish commit message)
       (CHRON.1-scoped: 97 passing — 5 + 8 + 26 + 21 + 37)
Core:  1850/1850 passing  (no regressions)
MCP:   5115/5115 passing  (no regressions)
Shared/IPC: 187 passing   (35 reasonSanitizer + 19 ipcValidators + 78 healthScore + 45 approveMutationIpc + 10 governanceApproval)

TSC on CHRON.1 scope:
  - All v1 BLK-1 TS2339 errors (4 of them) cleared ✓
  - One NEW real TS error in OverrideReasonDialog.tsx:229 (BLK-NEW-5) ✗
  - Two NEW TS6133 unused-variable warnings in CHRON.1 files (MIN-NEW-1)

TSC project-wide (tsconfig.app.json): unchanged from pre-polish counts (lots of pre-existing
errors in unrelated files — App.tsx, AnnotationList.tsx, AssetGrid, etc. — these are tracked
in a separate cleanup ticket and not introduced by CHRON.1).
```

---

## Commandment Audit (Polish Pass)

| # | Commandment | Status | Notes |
|---|-------------|--------|-------|
| 3 | Fresh Parse | N/A | No AST mutation in polish |
| 7 | ID Preservation | N/A | No structural ops |
| 10 | History Clear | N/A | No file-switch paths touched |
| 12 | Atomic Queuing | PASS | DB writes are SQLite-atomic; Electron-side broadcasts via `broadcastGovernanceOverrideRecorded` after commit |
| 13 | No Regex Surgery | PASS | sanitizer regex works on free-text reasons, not source code |
| 14 | Bypass Prohibition | PASS | All file/DB ops route through proper services; `recordEvent` wraps the SQLite write |
| 15 | AST Catalog | N/A | No AI tool catalog changes |
| 16 | TSC Loop | PASS | Validation loop untouched |

---

## Fix Checklist Before Ship

Critical:
1. [ ] BLK-NEW-1: update `governance:get-pending-mutations` SELECT in both `electron/main.ts` and `server/index.ts` to use canonical column names
2. [ ] BLK-NEW-2: reconcile the Zod `id: z.number()` schema with the canonical `id TEXT` schema (widen to union, or commit fully to TEXT)
3. [ ] BLK-NEW-3: wire `onOverride` from `GovernanceDashboard` through `ViolationsList` to `ViolationCard` so the M3 dialog actually opens for users
4. [ ] BLK-NEW-4: build the `overrideReasonMap` producer (hook or in-dashboard) and thread it through `ViolationsList` so past override reasons render
5. [ ] BLK-NEW-5: fix `OverrideReasonDialog.tsx:229` `onKeyDown` signature (`KeyboardEventHandler<HTMLDivElement>`)

Major:
6. [ ] MAJ-NEW-1: validate `record-approval-reason.filePath` against project root (or reject `..` segments at Zod)

Minor:
7. [ ] MIN-NEW-1: remove unused `beforeEach` import in ScoreSection test, unused `ShieldOff` import in ScoreSection
8. [ ] MIN-NEW-2: add a one-line comment about implicit metadata size bound

Add tests:
9. [ ] Integration test: dashboard renders → override button appears → clicking it opens the dialog → submitting writes to audit log
10. [ ] Integration test: audit log entry with override reason → dashboard renders → reason text visible on matching card
11. [ ] Round-trip test: `approve(getPendingMutations()[0].id)` succeeds against the canonical schema (catches both BLK-NEW-1 and BLK-NEW-2)

---

## Summary

A+ requires that the four prior findings AND the new code introduced by the polish are both clean. The first half is genuinely clean — strong sanitizer, solid Zod gate, real web-parity, end-to-end orchestrator-path persistence. The second half has a cluster of regressions that the test pyramid did not catch because integration/composition seams are untested.

Recommend: fix the five new blockers, add three integration tests, then re-review.
