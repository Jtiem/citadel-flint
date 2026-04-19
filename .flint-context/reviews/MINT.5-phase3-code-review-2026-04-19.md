# MINT.5-phase3 Code Review

- **Phase:** MINT.5-phase3
- **Dimension:** code
- **Reviewer:** flint-code-reviewer
- **Date:** 2026-04-19
- **Round:** 1
- **Scope:** Engine helpers: shared/syncStaleness.ts, shared/mcp-classification.ts; Renderer hooks: useEmitTokens, useSyncStaleness, useSyncActions (Phase 3 delta); Renderer store: syncStalenessStore; Type extension: src/types/flint-api.d.ts (MCPCallResult.classification); Tests for the above

## Verdict

**SHIP** — 0 blocking · 0 warnings · 3 suggestions

## Findings

### SUG-1 — Bench-driven invariant assertion has only 1 sample, undermining p95 confidence

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `shared/__tests__/mcp-classification.bench.ts:109` — The expect(p95).toBeLessThan(5) bench runs only 1 outer iteration.
  ```
  { iterations: 1, warmupIterations: 1 }
  ```

**Observed:** The "p95 < 5ms" assertion bench at line 88-110 runs the 1000-call timing loop only once (iterations: 1, warmupIterations: 1). p95 across 1000 calls is computed inside that single run and asserted, but a single sample makes the invariant flaky on cold caches.

**Rationale:** Contract invariant `classification-attach-overhead` requires `< 5ms per call at p95` measured by a 1000-call loop. The implementation does measure 1000 calls, so it satisfies the letter of the invariant — but a one-shot bench can flake under CI noise. The other bench blocks (lines 40-79) correctly use 50 / 1000 iterations, so reliability is partially covered by them.

**Proposed fix:** Change iterations to 5–10 on the assertion bench, or convert the assertion to a plain `it()` test that loops the timing block 3× and asserts the median p95 < 5ms.

### SUG-2 — useSyncStaleness mountedRef set true inside effect — minor stale-state risk on rapid disabled→enabled flips

**Severity:** suggestion · **Scope:** one-file · **Status:** open

**Evidence:**
- `src/hooks/useSyncStaleness.ts:98` — mountedRef is reset to true inside useEffect, after a previous cleanup may have set it false.
  ```
  mountedRef.current = true
  ```
- `src/hooks/useSyncStaleness.ts:105` — Disabled branch returns a cleanup that flips mountedRef false.
  ```
  if (!enabled) {
    ...
    return () => { mountedRef.current = false }
  }
  ```

**Observed:** The polling effect re-runs on `enabled`/`pollIntervalMs` change. Each run sets mountedRef.current = true at the top, and each cleanup sets it false. Because the effect includes a disabled-path early return (line 100-108) whose cleanup also flips mountedRef false, an enabled→disabled→enabled toggle within one render pass relies on React running the new effect before any in-flight `runPoll()` resolves. This works today but is fragile.

**Rationale:** The mountedRef pattern is conventionally tied to component mount/unmount, not to effect re-runs. Re-using it for "is this effect generation still active" couples two concerns. Phase 3 ships only one consumer (TokenManager) and the risk is low, but the pattern is worth tightening before more consumers join (R11 already calls this out).

**Proposed fix:** Introduce a per-effect `cancelledRef = { current: false }` created inside the effect; check `cancelledRef.current` in `runPoll` instead of `mountedRef.current`. Keep `mountedRef` for true unmount tracking (set false only in the unmount cleanup tied to an empty-deps useEffect).

### SUG-3 — Non-null assertion on optional ref bypasses TS guard

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `src/hooks/__tests__/useSyncStaleness.test.ts:26`
  ```
  window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>
  ```
- `src/hooks/__tests__/useEmitTokens.test.ts:24`
  ```
  window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>
  ```

**Observed:** Both test files use `mcp!` non-null assertion + `as ReturnType<typeof vi.fn>` cast in their `getCallToolMock()` helper. There is no comment explaining why the cast is needed.

**Rationale:** Per the rubric (Type discipline): casts without explanation are warning-worthy. The cast is benign here because the global test setup wires up the mock, but a one-line comment documenting the assumption would satisfy the project convention ("no `as any` casts without a comment").

**Proposed fix:** Add a comment above getCallToolMock(): "// Mock attached by src/components/__tests__/setup.ts; non-null assertion is safe in test env."

## Rubric

| Criterion | Result | Evidence / Related findings |
|-----------|--------|-----------------------------|
| shared/syncStaleness.ts is pure (no fs, store, React, or window access) | pass |  |
| shared/mcp-classification.ts is pure (no I/O, single-source classifier) | pass |  |
| MCPCallResult.classification is optional in src/types/flint-api.d.ts (R3 graceful degrade) | pass |  |
| MCPCallClassification union exported from src/types/flint-api.d.ts and matches contract verbatim | pass |  |
| useSyncActions reads classification from result envelope and preserves keyword backstop when classification is undefined | pass | src/hooks/useSyncActions.ts:92-110 — isPersistentError takes classification first, falls back to keyword check only when undefined. |
| syncStalenessStore: no cross-store imports, no IPC in actions, per-session lifetime (no localStorage) | pass |  |
| useSyncStaleness clears interval on unmount (invariant: staleness-poll-cleanup, vi.getTimerCount() === 0) | pass | src/hooks/useSyncStaleness.ts:176-180 cleanup; test src/hooks/__tests__/useSyncStaleness.test.ts:238-257 verifies vi.getTimerCount() === 0. |
| useSyncStaleness uses mountedRef + refs to avoid stale closures inside polling interval | pass |  |
| useEmitTokens serializes via emitOpRef and gates write mode on confirmWrite when provided | pass | src/hooks/useEmitTokens.ts:119,129-132 — ref guard + confirmWrite gate. |
| isSyncStale handles null, future, and NaN inputs without throwing | pass |  |
| classifyMCPError precedence: auth-expired > rate-limited > network-error > tool-error; success → unknown | pass |  |
| classification-attach-overhead invariant (< 5ms p95) is measured by the bench file | pass | shared/__tests__/mcp-classification.bench.ts:86-111 measures p95 across 1000 calls; see SUG-1 for sample-size note. |
| staleness-banner-zero-when-fresh invariant (= 0 banner mounts across 100 advances) covered by hook test loop | pass | src/hooks/__tests__/useSyncStaleness.test.ts:152-181 |
| No `any`, no `@ts-ignore` introduced in scope files | pass |  |
| No Node.js imports (fs/path/child_process) in any src/ file in scope | pass |  |
| Hook lifecycle: mountedRef guards prevent state updates after unmount in useEmitTokens and useSyncStaleness | pass |  |
| Commandment 12 (Atomic Queuing): store transitions are single set() calls; emitOp/syncOp transitions are atomic | pass |  |
| Commandment 14 (Bypass Prohibition): no direct fs/git imports in renderer-side scope files | pass |  |
| Phase 2 keyword-fallback backstop preserved in useSyncActions for unclassified errors | pass | src/hooks/useSyncActions.ts:100-109 keyword check fires only when classification === undefined; test useSyncActions.test.ts:416-431 confirms persistent=false on unclassified non-keyword text. |
| No dead code or unused exports introduced | pass |  |

## Scope Coverage

**Reviewed:**
- shared/syncStaleness.ts
- shared/mcp-classification.ts
- src/hooks/useEmitTokens.ts
- src/hooks/useSyncStaleness.ts
- src/hooks/useSyncActions.ts (Phase 3 delta)
- src/store/syncStalenessStore.ts
- src/types/flint-api.d.ts (MCPCallResult.classification + MCPCallClassification union)
- shared/__tests__/syncStaleness.test.ts
- shared/__tests__/mcp-classification.test.ts
- shared/__tests__/mcp-classification.bench.ts
- src/hooks/__tests__/useEmitTokens.test.ts
- src/hooks/__tests__/useSyncStaleness.test.ts
- src/store/__tests__/syncStalenessStore.test.ts
- src/hooks/__tests__/useSyncActions.test.ts (Phase 3 delta)

**Skipped:**
- src/components/ui/mint/* — UX reviewer scope
- shared/ipc-validators.ts — security reviewer scope
- electron/preload.ts, electron/mcpClient.ts, server/mcpClient.ts, server/index.ts — security reviewer scope (cross-process parity + IPC validation)
- shared/mcp-allowed-tools.ts — security reviewer scope
- electron/__tests__/* and server/__tests__/* — security reviewer scope
