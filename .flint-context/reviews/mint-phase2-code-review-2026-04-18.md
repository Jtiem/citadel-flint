# MINT.5 Phase 2 — Code Review

**Reviewer:** flint-code-reviewer (parallel with UX + security)
**Date:** 2026-04-18
**Round:** 1
**Phase:** MINT.5.2 — Sync Action Surfaces
**Contract:** `.flint-context/contracts/MINT.5-phase2.contract.{md,ts}`
**Verdict:** `FIX-FORWARD` *(derived from findings — 0 blocking, 4 warnings, 5 suggestions)*

---

## Scope

Read every production file, every test file, the binding contract, and the shared IPC-validator change. Ran `npx tsc --noEmit` (0 errors) and the full set of Phase 2 vitest suites (**105/105 pass** across 9 files — 67 from Group A/B component + hook tests and 38 from Group C integration tests).

Files in scope:

- **New (hook + 6 components):** `src/hooks/useSyncActions.ts`, `SyncActionCluster.tsx`, `ConfirmPushDialog.tsx`, `ConfirmResolveDialog.tsx`, `TokenDriftRow.tsx`, `DriftGroupSection.tsx`, `ConnectFigmaEmptyState.tsx`
- **Modified:** `TokenHealthBar.tsx`, `TokenGrid.tsx`, `TokenManager.tsx`, `shared/ipc-validators.ts`
- **Tests:** 9 files, 105 new tests

Skipped (out of scope): Electron main process handlers, MCP tool handlers, web server parity, UX review, security review.

---

## Summary

Phase 2 is **structurally sound** and **ships safely**. The hook architecture is disciplined — `useSyncActions` owns `syncOp` state, serializes concurrent actions with a synchronous `useRef` guard, and emits notifications through the sanctioned `notificationStore.push` path. No Commandment violations. No cross-store contamination. No `fs`/`git`/`window.flintAPI` in any store action. No regex surgery.

What earns the `FIX-FORWARD` verdict instead of `SHIP` is a cluster of warnings around **fragile glue** between the renderer and the engine:

1. **Auth-expired detection is stringly-typed.** `useSyncActions` substring-matches the human-readable error.text to decide persistent-chip vs transient-toast. Works today. Breaks silently on the next error-response copy change.
2. **The Push flow is unreachable in production.** TokenManager hardcodes `localEditCount={0}`, which disables Push and would render "Send 0 token changes..." in the ConfirmPushDialog if it ever opened. 155 LOC of component code + 8 tests exercise a path the user cannot trigger.
3. **The `mcp:call-tool` Zod schema is a catch-all.** `z.record(z.unknown())` validates that `args` is an object but not what keys/types it contains. Per-tool arg schemas would make the preload bridge actually enforce contract correctness.

None of these block ship. All three compound over time if left unaddressed.

I **concur with the integration validator's SHIP verdict** with the caveat that WARN-2 (the localEditCount=0 TODO) needs an explicit follow-up ticket — the integration report called it "safe" because the button renders disabled, but the maintenance cost of keeping unreachable code green is real.

---

## Commandment Compliance

| # | Commandment | Status | Evidence |
|---|-------------|--------|----------|
| 4 | Local-First Only | PASS | `ConnectFigmaEmptyState` renders an inline SVG FigmaMark; no external URLs. `TokenDriftRow` renders colors via inline `style={{ backgroundColor }}` — no network fetch. |
| 5 | A11y is a Compiler Error | PASS | Both dialogs have `role="dialog"` + `aria-modal="true"` + `FocusTrap`. `TokenDriftRow` has `role="button"` with a concrete accessible name ("Open detail for colors.primary"). `SyncActionCluster` sets `aria-label` on every button (including the "Up to date" disabled state). |
| 9 | CIEDE2000 ΔE | PASS | `TokenDriftRow` consumes `drift.deltaE` from Phase 1 types; no new ΔE computation. `deltaEToSeverity` maps to the existing SYNC.3 thresholds (≤2 advisory, ≤4 amber, >4 critical). |
| 12 | Atomic Queuing | N/A | Phase 2 writes no files from the renderer. Sync tools route via `mcp:call-tool` → `electron/main.ts` → `FileTransactionManager` (unchanged). |
| 14 | Bypass Prohibition | PASS | No `fs` / `path` / `sqlite` / `@anthropic-ai/sdk` imports anywhere in the Phase 2 renderer files (verified by grep). |
| 15 | Granular AST Tools Only | N/A | No AI orchestration in Phase 2. |
| 16 | In-Memory Validation | N/A | No AI output path in Phase 2. |

---

## Findings

### WARN-1 — Auth-expired classification is keyword-based and fragile

**Severity:** warning  **Scope:** cross-file

**Evidence:**

```ts
// src/hooks/useSyncActions.ts:68
function isAuthExpiredError(message: string): boolean {
    const lower = message.toLowerCase()
    return (
        lower.includes('auth-expired') ||
        lower.includes('auth expired') ||
        lower.includes('token expired') ||
        lower.includes('connection revoked') ||
        lower.includes('unauthorized') ||
        lower.includes('not authorized')
    )
}
```

```ts
// flint-mcp/src/core/errorResponse.ts:116
"The connection was disconnected or the access token expired"
```

**Observed:** Error classification (persistent-chip vs transient-toast) is implemented by substring-matching the MCP tool's human-readable text. `MCPCallResult` has no structured status field. If upstream error wording changes — "Figma session revoked", "401 Unauthorized", or a localized message in the future — the renderer misclassifies and surfaces a transient 8-second toast instead of the persistent chip the contract specifies.

**Rationale:** The contract §Open-Questions-5 explicitly requires the split. The author acknowledged the fragility in a JSDoc comment ("If/when a structured status field is added (Phase 3+), swap this for that field"). That's honest but makes a load-bearing UX decision on a stringly-typed signal the engine team can change unilaterally. This is a behavioural regression waiting to happen.

**Proposed fix:** Add a structured `status` field to the MCP error path (e.g. `content[].metadata?.status: "auth-expired" | "network" | ...`) surfaced by `errorResponse.ts`. Interim: widen the keyword list to include `"401"`, `"403"`, `"forbidden"`, `"session"`, `"reauth"`, and document upstream wording invariants in `errorResponse.ts` so the two ends stay in sync.

---

### WARN-2 — `localEditCount` hardcoded to 0 — Push + ConfirmPushDialog path unreachable in production

**Severity:** warning  **Scope:** one-file

**Evidence:**

```tsx
// src/components/ui/TokenManager.tsx:696
/* MINT.5 Phase 2 §2.1 — sync cluster wiring.
   localEditCount and pendingConflictCount are TODO-sourced
   from flint_sync_check in a future sync. For now we pass
   0 so the Push and Resolve buttons render disabled —
   Pull still works for the common case (drift → pull). */
localEditCount={0}
```

```tsx
// src/components/ui/TokenManager.tsx:885
<ConfirmPushDialog
    isOpen={pushDialogOpen}
    localEditCount={0}
```

```tsx
// src/components/ui/mint/ConfirmPushDialog.tsx:43
`Send ${localEditCount} token changes to Figma? This will overwrite Figma variables with ${localEditCount} local token ${plural}. Continue?`
```

**Observed:** TokenManager wires `localEditCount={0}` to both the TokenHealthBar cluster (which disables Push) and the ConfirmPushDialog (which would display "Send 0 token changes to Figma" copy if opened). 155 LOC of production code + 8 passing ConfirmPushDialog tests exercise a code path that cannot fire in the live app today.

**Rationale:** Unreachable production code is a red-flag smell: (a) maintenance burden — refactors must keep the dialog tests green even though the dialog never renders live, (b) the integration validator SHIPped on a TODO that isn't tracked anywhere except the inline comment, and (c) the ConfirmPushDialog test at line 45 asserts copy that cannot be shown to a user. The Phase 2 contract §Impact-Map does not list `flint_sync_check` wiring as a work item, so this isn't tracked as "deferred".

**Proposed fix:** Either (a) hide the Push button entirely until `localEditCount` is sourced (safer — matches the Pull+Connect gating model for disconnected state), or (b) file an explicit follow-up ticket referenced by the TODO comment and listed in `HANDOFF.md`. The current "render disabled with count=0" state is the worst of both worlds: the button is visible but never works.

---

### WARN-3 — Auto-revert effect subtly over-reactive but not stale-closure buggy

**Severity:** warning  **Scope:** one-line

**Evidence:**

```tsx
// src/components/ui/TokenManager.tsx:349
useEffect(() => {
    if (viewMode === 'drift' && driftedTokens.length === 0) {
        setViewMode('grid')
    }
}, [viewMode, driftedTokens.length])
```

**Observed:** The effect depends on `viewMode` and `driftedTokens.length`. React guarantees `setViewMode` identity stability, so this is not an actual stale-closure bug. But `driftedTokens` is recomputed by `useTokenUsage` on every rescan — the array identity changes even when contents don't — and a hostile scan pattern (`[] → [] → []`) would fire the effect body repeatedly. All no-ops because `viewMode === "grid"` after the first flip, but noisy.

**Rationale:** No runtime bug today. The integration test at `TokenGrid.drift-tab.test.tsx:118` exercises the happy-path auto-revert, but does not assert the effect does not thrash on repeat renders.

**Proposed fix:** Correct as written. Add a comment documenting that the dep list intentionally omits `driftedTokens` (the array) in favor of `driftedTokens.length` (the stable number) so the next maintainer doesn't "fix" it by adding the array and introducing thrash.

---

### WARN-4 — `mcpCallToolSchema` accepts any record<unknown> — no per-tool arg validation at preload

**Severity:** warning  **Scope:** one-file

**Evidence:**

```ts
// shared/ipc-validators.ts:261
'mcp:call-tool': {
    payload: z.tuple([
      z.string().min(1),
      z.record(z.unknown()),
    ]),
    response: z.unknown(),
},
```

**Observed:** The Phase 2 contract claims `validator: 'mcpCallToolSchema'` gives the channel runtime validation. In practice, the validator catches `args === null` and `toolName === ""` — both trivial misuses — but not the two failure modes the renderer is likely to produce: (a) a renaming drift where the renderer still calls a stale tool name, and (b) misspelled keys in the `args` object (e.g. `{ stratergy: 'prefer-figma' }` instead of `{ strategy: ... }`).

**Rationale:** For Phase 2, practical impact is low — misspellings blow up at the MCP tool layer with "no such tool" / "missing arg" errors, not silently. But the contract's security claim is weaker than advertised. CLAUDE.md Architectural-Anti-Patterns says the preload bridge implements "Design by Contract at the process boundary" — which implies tighter enforcement than a catch-all type.

**Proposed fix:** Phase 3 follow-up: split `mcp:call-tool` into per-tool schemas, or a discriminated union keyed on `toolName` with a Zod schema per known tool. For now, document the intentional looseness inline in `useSyncActions.ts` so maintainers know the preload isn't a backstop for tool-arg correctness.

---

### SUG-1 — SyncActionCluster disconnected Connect button has asymmetric in-flight disable

**Severity:** suggestion  **Scope:** one-line

**Evidence:**

```tsx
// src/components/ui/mint/SyncActionCluster.tsx:52
<button
    type="button"
    onClick={onConnect}
    disabled={syncOp === 'connect'}
```

The connected-cluster branch uses `opInFlight = syncOp !== null` to disable all three buttons (line 74); the disconnected branch only disables on `syncOp === 'connect'`. If `syncOp` were `'pull'` when Figma disconnects mid-op (theoretically possible), the Connect button stays enabled. Serialization guard catches the double-dispatch at the hook layer (returns silently) but the button communicates nothing.

**Proposed fix:** Change `disabled={syncOp === 'connect'}` to `disabled={syncOp !== null}`.

---

### SUG-2 — `lastError` is cleared only after a successful await — brief stale window

**Severity:** suggestion  **Scope:** one-file

```ts
// src/hooks/useSyncActions.ts:174
// Success path — clear any prior error, emit a success toast,
// fire the onAfterSync callback so consumers can refetch.
setLastError(null)
```

A consumer reading `lastError` during the in-flight window (e.g. a persistent badge bound to `lastError.persistent`) sees the previous error for the duration of the next tool call. Arguably correct — the chip should persist while retry is indeterminate — but not documented either way.

**Proposed fix:** Document in JSDoc, or clear eagerly inside `setSyncOp(op)` at dispatch time if the UX team prefers the chip to disappear at click.

---

### SUG-3 — ConfirmResolveDialog radiogroup has sr-only legend but no visible label

**Severity:** suggestion  **Scope:** one-line

```tsx
// src/components/ui/mint/ConfirmResolveDialog.tsx:90
<span id={radiogroupId} className="sr-only">
    Resolution strategy
</span>
```

The radiogroup is labeled via an sr-only span. Sighted users see only the radio labels ("Prefer Figma" / "Prefer Local") preceded by a prose paragraph. Not an a11y violation — the radiogroup has an accessible name — but diverges from the visible-legend pattern elsewhere in the codebase.

**Proposed fix:** Promote the prose paragraph to a visible legend-style label, or add a visible "Strategy" heading above the radios.

---

### SUG-4 — Prop drilling through TokenHealthBar with defensive `?? (() => {})` fallbacks

**Severity:** suggestion  **Scope:** one-file

```tsx
// src/components/ui/TokenHealthBar.tsx:239
onPull={onPull ?? (() => {})}
onPush={onPush ?? (() => {})}
onResolve={onResolve ?? (() => {})}
```

TokenManager passes 12 props to TokenHealthBar, 8 are Phase 2 sync-related, 8 are forwarded unchanged to SyncActionCluster. The `?? (() => {})` fallbacks allow TokenHealthBar to render in isolation but mask misconfigurations — a caller who forgets `onPull` sees a working-looking Pull button that does nothing. (This is adjacent to WARN-2: the Push button today is exactly in this "looks fine, does nothing" state.)

**Proposed fix:** Remove the fallbacks and let the types enforce the wiring (onPull becomes required when `hasSyncCluster` is true), OR introduce a `SyncActionContext` provider. Neither is urgent for Phase 2.

---

### SUG-5 — setReady useEffect runs once but does not re-check later

**Severity:** suggestion  **Scope:** one-line

```ts
// src/hooks/useSyncActions.ts:111
useEffect(() => {
    // Re-evaluate once on mount (covers cases where the window.flintAPI
    // shim is attached asynchronously in dev/test).
    if (typeof window !== 'undefined' && typeof window.flintAPI?.mcp?.callTool === 'function') {
        setReady(true)
    }
}, [])
```

The JSDoc promises a guarantee the implementation doesn't deliver — if `window.flintAPI` attaches after the first effect tick, `ready` stays `false` forever. Low impact because Phase 2 test setup populates `window.flintAPI` in `beforeEach` and production preload is synchronous, but the comment is misleading.

**Proposed fix:** Strengthen the JSDoc ("evaluated once on mount — does not re-evaluate if window.flintAPI is attached later") or add a small bounded retry.

---

## Test Coverage Assessment

105 new tests across 9 files. Assertions are **meaningful**, not shallow mount-doesn't-crash checks.

- **useSyncActions (18 tests):** covers serialization race (simultaneous `pull()` — exactly 1 call), error classification (both transient + persistent), clearance-on-success, confirmPush/confirmResolve gates, and thrown-error catch path. Deep.
- **SyncActionCluster (16 tests):** every disabled-state combination, loading-spinner placement per op, all three callback fire paths, disconnected-with-and-without-onConnect fallback. Matrix is complete.
- **ConfirmPushDialog (8 tests):** focus trap (initial focus + Tab cycle + Escape), singular vs plural copy, confirm vs cancel firing. Solid.
- **ConfirmResolveDialog (9 tests):** default strategy, radio switching, confirm-with-selected-strategy, Escape, cancel. Solid.
- **TokenDriftRow (16 tests):** color vs dimension rendering, ΔE severity tiers (amber vs critical), Pull-button stopPropagation, Enter/Space activation. Good.
- **DriftGroupSection (8 tests):** grouping, empty state, sort order. Adequate.
- **ConnectFigmaEmptyState (15 tests):** all 3 variants, both CTAs, has-tokens returns null. Complete.
- **TokenGrid.drift-tab (5 tests):** integration-level radiogroup ARIA, badge count, viewMode routing, auto-revert. Sufficient.
- **TokenManager.phase2 (10 tests):** empty state variants, dialog open/close on Push flow (disabled-gated), disconnected-cluster pull non-invocation, auto-revert. Good breadth.

**Gaps worth noting:** (a) No test exercises the serialization guard where a second call arrives *after* the first's `setSyncOp` microtask — tests use synchronous `void pull()` pairs, which is the load-bearing case but not the only one. (b) No test covers `ConfirmPushDialog` body text when `localEditCount=0` — exactly the unreachable state noted in WARN-2.

---

## Integration Validator Concurrence

Integration validator SHIPed with one documented TODO (`localEditCount=0`). I **concur with SHIP**, with the caveat that the TODO should be filed as a tracked ticket rather than left as an inline comment. The Push path is currently a well-typed, well-tested component that cannot be triggered — if another agent refactors `TokenManager` in Phase 3, they may delete `ConfirmPushDialog` altogether, not realizing it's waiting for `flint_sync_check` wiring.

---

## Rubric Summary

- Type-check clean — **pass**
- All Phase 2 tests pass — **pass** (105/105)
- No Node.js in `src/` — **pass**
- No IPC in Zustand stores — **pass**
- All renderer→main channels have Zod validators — **pass**
- Commandment 4/5/9/12/14/15/16 — **pass or n/a**
- MCP error classification uses structured status — **fail** (WARN-1)
- Production code paths are reachable — **fail** (WARN-2)
- IPC payload schemas narrow per-tool args — **fail** (WARN-4)
- Integration validator SHIP concurred — **pass**

**Verdict:** `FIX-FORWARD` — 0 blocking, 4 warnings, 5 suggestions. Ship.
