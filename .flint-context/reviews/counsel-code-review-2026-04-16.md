# Counsel Surface — A+ Code Review

**Date:** 2026-04-16
**Reviewer:** Code review agent (Claude)
**Scope:** Counsel surface (GovernanceDashboard, ViolationCard, DiffCard, orchestratorStore, CHRON.1 IPC additions, health-score defect hunt, web parity).
**Provisional grade:** **B** (strong Counsel UX work, but blocked by two shipped defects — health-score divergence and a schema collision that compromises CHRON.1's persistence guarantee).

---

## Executive Summary

The Counsel surface is architecturally sound and the shipped CHRON.1 work is mostly correct in the renderer tier (DiffCard tier gating, orchestratorStore reason plumbing, ViolationCard overrideReason display, Electron main.ts SQL). However, two **non-cosmetic** defects survived the 55-test Glass sweep:

1. **Two-formula health score defect is real** — it is not between Glass and MCP but _inside the MCP debt service itself_ (two exported functions with different shapes), and the debt report uses the non-canonical one.
2. **`mutations_ledger` schema collision** — the Electron-side DDL guard added in CHRON.1 creates a DIFFERENT table shape than the MCP-side DDL. The SQL written by the CHRON.1 `approve-mutation` handler only matches the Electron shape; if MCP ran first, the write will silently fail inside `try/catch`.
3. **Web-parity drift is real** — `server/index.ts` did not receive the CHRON.1 changes. Reason text is silently dropped on the web build.

No Process Boundary violations, no `fs` in `src/`, no `ipcRenderer` in React, no cross-store module imports. The store-architecture refactor completed in 2026-04-10 held up.

Raise to **A-** once the three blockers below are resolved. Raise to **A** after the anti-pattern on line 574/580 of orchestratorStore is also addressed (`window.flintAPI` called from inside a Zustand action body).

---

## Critical (Blockers — must fix before CHRON.1 can be marked shipped with confidence)

### C1. `mutations_ledger` schema collision — CHRON.1 reason persistence is not guaranteed

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/store.ts:324-340` (Electron DDL guard, added in CHRON.1)
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/governance/mutationLedgerService.ts:27-56` (MCP DDL, pre-existing)

The two DDLs disagree on nearly every column:

| Column | Electron guard | MCP service |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))` |
| timestamp column name | `created_at` | `timestamp` |
| op column name | `op` | `operation_type` (with CHECK constraint) |
| source | `agent_id` only | `source` (with CHECK constraint) + `approved_by` |
| risk | `risk_score`, `risk_tier` | not present |
| approval timestamp | `approved_at` | `approved_by` (no `approved_at`) |
| justification | yes | yes |
| metadata | not present | `TEXT DEFAULT '{}'` |

`CREATE TABLE IF NOT EXISTS` is idempotent on **name only** — whichever DDL runs first wins; the second is silently ignored. In Electron deployments where the MCP sidecar is running and initializes its schema first, the CHRON.1 handler's `UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?` (main.ts:3840) fails because `approved_at` does not exist on the MCP schema. The error is swallowed by the `try { ... } catch { /* table may not exist */ }` wrapper — giving the **illusion** that reason was written when it was not.

**Impact:** CHRON.1's central compliance claim ("reason is logged to the mutations_ledger.justification column") only holds in Electron-only deployments that never ran the MCP sidecar. In every other configuration, `reason` is silently dropped. The existing `approveMutationIpc.chron1.test.ts` uses a stub DB, so this went untested.

**Recommendation:** Consolidate to a single DDL. The MCP schema is richer and has CHECK constraints — keep it and retire the Electron guard. Update the Electron `approve-mutation` handler to match the MCP columns: `UPDATE mutations_ledger SET approved_by = ?, justification = ? WHERE id = ?` (or add an `approved_at` column). Run an integration test that initializes both services against the same `flint.db` and round-trips an approve.

---

### C2. Two-formula health score defect — `debtReportService.ts` contains both formulas, uses the wrong one

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/dashboard/debtReportService.ts:131-149, 340` (debt report — defect site)
- `/Users/tiemann/Lunar-Elevator-Bridge/src/hooks/useGovernanceHealth.ts:53-73, 117-127` (Glass — canonical)
- `/Users/tiemann/Lunar-Elevator-Bridge/shared/healthSignal.ts:51-72` (CLI/CI sub-score display)

`debtReportService.ts` exports **two** health-score functions:

**Formula A — `computeHealthScoreFromViolationTypes(mithril, a11y)`** (line 131):
```
raw = 100 − a11yCount × 10 − mithrilCount × 3
```
This is the **type-based** formula (every mithril violation counts as severity="amber", every a11y violation counts as "critical") and is what the debt report actually calls (line 340).

**Formula B — `computeHealthScore(criticals, warnings, infos)`** (line 142):
```
raw = 100 − criticals × 10 − warnings × 3 − infos × 1
```
This is the canonical severity-bucket formula that Glass uses. It is exported but not called inside `debtReportService`. The file's own docstring (line 116-130) says it "matches the canonical formula" — which is only true if you accept the simplifying assumption that every mithril warning is severity=amber. That assumption is false: `MithrilLinter` emits Mithril violations at `critical`, `amber`, AND `advisory` severities.

**Divergence example (real inputs):**

Consider a file with 5 mithril violations — 2 `critical` (shadow-drift with high Delta-E), 2 `amber` (spacing drift), 1 `advisory` (opacity drift) — and 0 a11y.

- **Glass (`useGovernanceHealth`, Formula B):** `100 − 2×10 − 2×3 − 1×1 = 73` (Grade C)
- **MCP `debt_report` (Formula A):** `100 − 5×3 − 0×10 = 85` (Grade B)
- **Divergence: 12 points, one grade.**

Same file. Same violations. Two different answers. The user sees **C in Glass** and **B in `flint_debt_report` / `flint-gate debt`**. `shared/healthSignal.ts` (which the CI command prints as sub-scores on line 127 of `debt.ts`) uses Formula A as well, so the CI output and the debt report agree with each other and disagree with Glass.

**Recommendation — canonicalize on Formula B:**
1. Change line 340 of `debtReportService.ts` to call `computeHealthScore(bySeverity.critical, bySeverity.warning, bySeverity.info)`.
2. Delete `computeHealthScoreFromViolationTypes` (line 131).
3. Update `shared/healthSignal.formatHealthSignal` to also take severity-bucketed counts, or deprecate it in favor of a shared export of `computeHealthScore` from a single module that both Glass and CLI import.
4. Fix the `byFile` severity counter in `scanFile` (line 224-229): A11y violations are hardcoded to `'critical'` which agrees with the canonical mapping — good. But the Mithril mapping through `mapSeverity` needs to be verified to preserve the three-level scale.
5. Add a cross-package golden test: `test/parity/healthScore.test.ts` that feeds the same severity buckets into `useGovernanceHealth` and `debtReportService.computeHealthScore` and asserts equality.

---

### C3. Web-parity drift — CHRON.1 did not ship to `server/index.ts`

**Files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/electron/main.ts:3835-3842` (CHRON.1 handler with reason)
- `/Users/tiemann/Lunar-Elevator-Bridge/server/index.ts:2156-2159` (web build — no reason)
- `/Users/tiemann/Lunar-Elevator-Bridge/src/adapters/web-api.ts:535-536` (adapter forwards reason)

The web adapter in `src/adapters/web-api.ts` is updated: `approveMutation(id, reason)` passes both args through `invoke('governance:approve-mutation', id, reason)`. But `server/index.ts` handler takes only `id` and runs `UPDATE mutations_ledger SET approved_at = datetime('now') WHERE id = ?` — **no `justification = ?`**. Reason is dropped silently; the user sees "Apply" succeed in Glass-in-browser and assumes their audit trail was written. It wasn't.

`server/index.ts:2166-2176` also returns a NARROWER row shape for `governance:get-audit-log` — it omits `metadata` and `ruleId`. This will break `GovernanceDashboard.overrideReasonMap` (lines 122-146) in the web build: the code reads `entry.metadata` and `entry.ruleId`, will find both undefined, and the override-reason decoration will silently not render. Not a crash — a silent visual regression.

**Recommendation:** Mirror both handlers in `server/index.ts` exactly:
- `governance:approve-mutation`: accept `(id, reason)`, do the reasonStr trim, run the 2-arg UPDATE.
- `governance:get-audit-log`: add `metadata, rule_id AS ruleId` to the SELECT.

Then add a lightweight web-parity test (`server/__tests__/chron1-parity.test.ts`) that hits both handlers. Memory `feedback_web_parity_drift.md` explicitly warns about this — it triggered here.

---

## Major (P1 — non-blocking but should fix in the next sprint)

### M1. `orchestratorStore.approveToolCall` calls `window.flintAPI` from inside a Zustand action body (anti-pattern)

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/store/orchestratorStore.ts:574, 580-586`

CLAUDE.md "Architectural Anti-Patterns" line 2 says: _"Calling `window.flintAPI` inside a Zustand store action (IPC belongs in components/hooks/services)"_. `approveToolCall` calls `window.flintAPI.applyBatch()` and `window.flintAPI.governance.approveMutation()` directly. The file is peppered with `// TODO: extract to service layer` comments acknowledging this (lines 78, 95, 268, 406, 430, 435, 440, 574).

The 2026-04-10 review fix removed the cross-store imports (good), but did not complete the IPC extraction. This is P1 because it blocks web-build testing — any unit test that exercises `approveToolCall` must mock `window.flintAPI`, which the existing CHRON.1 tests do (`orchestratorStore.chron1.test.ts:42`).

**Recommendation:** Extract an `approvalService.ts` with `applyBatch(mutations)` and `logApprovalReason(id, reason)` functions. Inject via a `configure()` pattern or import at module top (services can import `window.flintAPI`, stores cannot).

---

### M2. `approveMutation(0, reason)` writes the reason against a sentinel ledger id of `0`

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/store/orchestratorStore.ts:576-586`

The comment on line 576-579 explicitly admits the ledger entry doesn't exist:
```
// approveMutation expects a numeric ledger id; we pass 0 as a sentinel
// here since tool-call mutations are not yet tracked in mutations_ledger
// by the orchestrator path.
```

This means the CHRON.1 UPDATE runs as `WHERE id = 0`, which will almost never match a row (MCP uses TEXT UUIDs, Electron uses autoincrement starting at 1). So reason is **written to no row**. Every test passes because the SQL stub accepts the call; the actual database never records anything. The fallback comment says reason "is still recorded in the tool_result content for audit-trail purposes" — that is a UI artifact, not a queryable audit trail.

**Recommendation:** Either (a) create a ledger row at tool-call time (record the mutation in `mutations_ledger` the instant the AI proposes it, use its id when approving), or (b) remove this IPC call entirely and rely on the MCP-side ledger writing the reason through a different channel. Mark the IPC as preview-stage until (a) is implemented.

---

### M3. `OrchestratorChunk` type — validation_error path uses `as const` cast without updating the type

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/store/orchestratorStore.ts:310-329`

The validation_error branch creates a synthetic `tool_result` message with `toolData: { ..., status: 'rejected' as const }`. The `PendingToolCall.status` union includes `'rejected'`, so this type-checks. But the chunk.type `'validation_error'` is not enumerated anywhere in this file — it's handled implicitly through duck typing. If `OrchestratorChunk` in `types/flint-api.ts` doesn't include `'validation_error'` as a discriminated variant, this lands as `any`-narrowing. Verify that type.

---

### M4. `buildNavMap` and the render pipeline — O(n log n) on every render

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernanceDashboard.tsx:74-95, 275`

`buildNavMap` is wrapped in `useMemo` (line 275) with the correct deps, so this is OK. Flagging only because the inner sort is `.sort` on a newly-constructed array — fine for N<100 violations but performance-watch it when a file hits 500+ violations. Consider an O(n) priority bucketing pass if that becomes a hot path.

---

## Minor (P2 — polish)

### m1. `GovernanceDashboard.tsx:173` — `useGovernanceDefer` takes a cast `provenanceMap as Record<string, ProvenanceInfo>`

Multiple places in the file cast through unknown shape. The type correctness depends on `anomalies.provenanceMap` being declared as this. Either widen `useGovernanceAnomalies`' return type to `Record<string, ProvenanceInfo>` or narrow it so the cast is unnecessary. Casts on lines 173, 313, 321, 373, 411, 417, 430-432 all have the same smell.

### m2. `GovernanceDashboard.tsx:204, 206` — ternary statement with side effects

```ts
setExpandedCards((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
```
The ternary is used as a statement (for its side effect) — ESLint `no-unused-expressions` often flags this. Refactor to `if/else`.

### m3. `DiffCard.tsx:166-198` — regex on source code, but scoped

The `deriveAfterSnippet` function does regex replacements on JSX. CLAUDE.md Commandment 13 prohibits regex on source code for mutation. This is a **display-only** preview, not a mutation — so Commandment 13 doesn't apply. But the comment on lines 70-76 incorrectly cites "Mithril commandment C2" which doesn't exist. Document this more carefully: "This is display-only; the real mutation goes through the AST on line 574 of orchestratorStore." Also consider moving the derivation server-side to get a real AST diff.

### m4. `ViolationCard.tsx` — 944 lines, nearly all in one component

Consider extracting the defer form (lines 816-874), the inline diff (lines 753-813), and the fix guide accordion (lines 889-940) as sub-components. 944 lines of JSX in one file slows cognitive load.

### m5. `DiffCard.tsx:357` — `reasonText` state ephemeral, lost on unmount

If the user types a reason, closes Glass, and re-opens, the reason is lost. This is acceptable for a volatile-session mutation approval, but flag for UX review: Justin's memory `feedback_plain_language_output.md` suggests this might surprise users. Consider persisting drafts keyed by `call.id`.

### m6. `ViolationCard.tsx` — `overrideReason` display swallows 'skipped' but not '' or whitespace

Line 532: `{overrideReason && overrideReason !== 'skipped' && ...}`. A user who typed " " and submitted would have it stored (the DiffCard trims, but the Electron handler also trims — good) but if anything bypassed that trim path in the future, the card would display "Overridden:  " with a trailing space. Defensive: `overrideReason.trim() && overrideReason.trim() !== 'skipped'`.

### m7. `orchestratorStore.ts:45` — module-level mutable state

```ts
let _cachedEditorStore: { getState: () => { rawCode: string | null } } | null = null
let _chatDepth = 0
const MAX_CHAT_DEPTH = 10
```
These are module singletons. Testing with `vi.resetModules()` leaves them dirty across test runs. Flag for the testing-standard review; integration tests that reset store state won't clear these.

---

## CHRON.1 Correctness Assessment

Tracing `reason` end-to-end:

| Stage | File | Status |
|---|---|---|
| User input — input field | `DiffCard.tsx:445-452` | Correct — `useState('')`, controlled |
| Apply button gating | `DiffCard.tsx:458` | Correct — `disabled={tier === 'red' && reasonText.trim().length === 0}` |
| Green tier (no reason) | `DiffCard.tsx:460-461` | Correct — `onApprove(call.id)` |
| Amber tier (optional) | `DiffCard.tsx:462-463` | Correct — empty ⇒ `'skipped'`, else user text |
| Red tier (required) | `DiffCard.tsx:464-467` | Correct — gated above; always non-empty |
| Store signature | `orchestratorStore.ts:170, 516` | Correct — `reason?: string` |
| `applyBatch` | `orchestratorStore.ts:574` | Correct — mutations are applied regardless of reason |
| IPC call | `orchestratorStore.ts:580-586` | **DEFECTIVE — writes to `id = 0`, see M2** |
| Preload bridge | `preload.ts:1048-1049` | Correct — 2-arg invoke |
| Web adapter | `web-api.ts:535-536` | Correct — 2-arg invoke |
| Electron handler | `main.ts:3835-3842` | Correct in isolation — **blocked by C1 schema collision** |
| Web handler | `server/index.ts:2156-2159` | **BROKEN — see C3** |
| SARIF filter | `auditReport.ts` (line 284 `SARIF_FILTERED_REASONS`) | Correct — `{'skipped', 'auto'}` set filters both from SARIF |
| Display | `ViolationCard.tsx:532-540` | Correct — filters 'skipped', aria-label, testid |

**Verdict on CHRON.1:** The renderer chain is solid. The persistence chain has two landmines (C1 schema, M2 sentinel id=0). The web-build chain is broken (C3). Functional correctness of the reason display works in all local dev flows I traced — but the audit trail that the feature promises is not actually being persisted to queryable storage. **This is the kind of defect that only shows up when a customer runs `flint_override_telemetry` six months later and finds every `justification` is null.**

---

## Web-Parity Check

| IPC channel | `electron/main.ts` | `server/index.ts` | Parity |
|---|---|---|---|
| `governance:approve-mutation` | accepts `(id, reason)`, writes `justification` | accepts `(id)` only | **BROKEN** |
| `governance:get-audit-log` | returns `{ ..., metadata, ruleId }` | returns `{ ... }` (no metadata/ruleId) | **BROKEN** |
| `governance:get-override-count` | OK | OK | parity |
| `governance:record-health` | OK | OK | parity |
| `governance:get-pending-mutations` | OK | OK | parity |
| `governance:reject-mutation` | OK | OK | parity |

**Two of six Counsel-adjacent channels diverged in CHRON.1 and that drift shipped.** See C3 for the remediation.

---

## Test Coverage Gaps

The reviewed tests exist for:
- DiffCard reason input/tier gating (`DiffCard.chron1.test.tsx`)
- ViolationCard override reason rendering (`ViolationCard.chron1.test.tsx` — TB-16, TB-17, 'skipped' bonus case)
- orchestratorStore reason forwarding (`orchestratorStore.chron1.test.ts`)
- Electron handler DB write (`approveMutationIpc.chron1.test.ts` — uses stub DB, does not catch C1 schema collision)

**Gaps:**
1. **No integration test** verifying a real `flint.db` accepts the UPDATE on a row inserted by `mutationLedgerService`. This is the test that would have caught C1.
2. **No web-parity test** — `server/__tests__/` has no `chron1-parity.test.ts`. That would have caught C3.
3. **No SARIF overrideReason filter test asserting both `skipped` AND `auto` are filtered** — the test grep found the `SARIF_FILTERED_REASONS` constant, but I did not find a test that asserts both reasons are dropped from SARIF output.
4. **No test for `mutations_ledger` schema guard** — the Electron DDL guard added in CHRON.1 has no DDL parity test vs the MCP DDL.
5. **ViolationsList filter for 'skipped'/'auto'** — you asked specifically about this; the filter for 'skipped' exists only in `GovernanceDashboard.tsx:140-142` (the useEffect building `overrideReasonMap`), not in ViolationsList. Tests verify the display-side filter in ViolationCard but not the accumulator-side filter. Add a GovernanceDashboard integration test that seeds audit-log entries with `metadata: '{"reason":"skipped"}'` and `metadata: '{"reason":"actual text"}'` and asserts only the latter appears in `overrideReasonMap`.

---

## Recommendations (Ordered by Impact)

1. **Fix C1 — unify `mutations_ledger` DDL.** Remove the Electron-side guard, reuse the MCP schema, update `main.ts:3840` UPDATE to match. Write an integration test.
2. **Fix C2 — canonicalize health score on Formula B.** One formula, one export, one shared module. Delete `computeHealthScoreFromViolationTypes`. Add cross-package parity test.
3. **Fix C3 — web-parity CHRON.1 additions.** Update `server/index.ts` for both `approve-mutation` and `get-audit-log`. Add a parity test. Document the post-CHRON.1 checklist update in `feedback_web_parity_drift.md`.
4. **Fix M2 — real ledger id instead of `0`.** Either insert into `mutations_ledger` when the tool_call arrives, or remove the IPC call and rely on MCP-side recording.
5. **Fix M1 — extract `approvalService.ts` from `orchestratorStore`.** Clears TODO comments on lines 78, 95, 268, 406, 430, 435, 440, 574 at once.
6. **Add the three missing tests:** integration ledger round-trip, web-parity, SARIF filter coverage.
7. **M3-M4** and minor items m1-m7 in the next polish pass.

---

## Grade Rationale

- **CHRON.1 shipping quality (renderer):** A-
- **CHRON.1 shipping quality (persistence):** C+ (schema collision + sentinel id)
- **Web parity:** D (two handlers drifted)
- **Health score canonicalization:** F (two live formulas, wrong one used)
- **Architectural discipline in Counsel tree:** A (no boundary violations, no store contamination, all IPC via preload)
- **Test coverage:** B (55 new Glass tests, but critical integration paths uncovered)

Provisional grade: **B**.

Grade moves to **A-** on C1+C3 fixes. Grade moves to **A** when C2 is resolved and M1+M2 are addressed.
