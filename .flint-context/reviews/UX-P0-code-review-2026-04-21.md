# UX-P0 Trust Gap Fixes — Code Review

**Reviewer:** flint-code-reviewer
**Date:** 2026-04-21
**Round:** 1
**Phase:** UX-P0
**Scope:** 11 production files + 4 test files (governance override persistence, violation filter, demo load undo guard)

---

## Verdict

**APPROVED with WARNINGS.** No BLOCKERS. The implementation is sound, correctly routes writes through FileTransactionManager (C12 + C14), validates IPC payloads with Zod, and preserves the web-build parity discipline. Two warnings center on test coverage and consistency with existing patterns.

---

## Narrative Summary

The UX-P0 change adds two IPC channels (`governance:save-overrides` / `governance:get-overrides`) that persist the governance rule override map to `.flint/rule-overrides.json`, a violation filter in `useGovernanceCategories` that suppresses findings for disabled rules (fail-open on missing `ruleId`), and a history-clear hook on demo load so the undo stack starts clean. The Electron handler writes via `fileTransactionManager.write()` — Commandment 12 + 14 are satisfied. The web-parity handler in `server/index.ts` mirrors the logic and uses `atomicWrite` (tmp → rename). Zod schemas in `shared/ipc-validators.ts` are consistent with the existing `FORGE.1` / `CHRON.1` style (named exports, co-located helpers), and `flint-api.d.ts` is updated with typed method signatures.

The `handleToggle` logic in `GovernancePanel.tsx` correctly identifies return-to-default (both enabled-default AND severity-default) and reaches through `setOverride` which merges via spread — no risk of severity-override loss. `historyStore.clear()` is the right call on demo load; `clear()` is the store's documented file-open hook (line 21: "resets both stacks (e.g. on file-open)"). Using `pushCheckpoint()` would leave stale pre-demo entries reachable via undo.

The test suite in `electron/__tests__/governance-ipc.test.ts` is thorough (19 invariants GOVERR-01..19) — round-trip, malformed JSON, ENOENT, Zod rejection, null projectRoot, and the fail-open filter predicate all covered. Two gaps: (1) the real `useGovernanceCategories` hook has no React-layer test covering the new `isRuleEnabled` filter against the real `useGovernanceStore` — it's tested only as a reproduced pure function, and (2) no concurrent-write test exists (FileTransactionManager is trusted to serialize, but the invariant is worth asserting).

---

## Findings

### WARNING 1 — Hook-layer test coverage gap for violation filter

**Files:** `src/hooks/useGovernanceCategories.ts:55-61`, `src/hooks/__tests__/useGovernanceCategories.test.ts` (no matching tests)

The violation suppression logic lives inside the hook and reads `useGovernanceStore.getState().overrides`. The hook's own test file does not import or exercise the new filter — a `grep` for `isRuleEnabled`, `governanceStore`, or `enabled: false` in `useGovernanceCategories.test.ts` returns zero matches. The logic is verified as a pure-function reproduction in `governance-ipc.test.ts` (GOVERR-15..18), which is correct in spirit but decouples the test from the hook's real wiring (the `useMemo` dependency array `[overrides]`, the selector `useGovernanceStore((s) => s.overrides)`). A render of the hook with two stubbed warnings — one with an override disabled, one without a `ruleId` — would close the gap in ~15 lines.

**Fix:** Add a `renderHook` test in `useGovernanceCategories.test.ts` that wraps with a governance-store override fixture and asserts (a) disabled-rule warnings are filtered out of `visibleLinterWarnings`, (b) warnings with undefined `ruleId` pass through fail-open.

### WARNING 2 — No concurrent-write assertion in handler tests

**File:** `electron/__tests__/governance-ipc.test.ts:319-356`

GOVERR-19 covers one save → one get. The handler delegates serialization to `fileTransactionManager.write()`, so correctness under concurrent calls depends on FTM's queue — which is trusted elsewhere. However, the contract for this channel explicitly promises atomicity; a two-writer interleave test (fire save(A) and save(B) simultaneously, assert the file equals exactly one payload, not a mash-up) would make that promise falsifiable. Low severity — the FTM contract is already tested at its own seam — but worth a sentence in the review if the contract artifact lists concurrency as an invariant.

**Fix:** Optional. Add GOVERR-20 that awaits `Promise.all([save(A), save(B)])` against an in-memory FTM mock and asserts the final disk state is one of {A, B} but never a hybrid.

### INFO — Inline Zod reproduction in test file

**File:** `electron/__tests__/governance-ipc.test.ts:44-54`

The test file inlines its own copy of `governanceSaveOverridesValidator` (comment at lines 36-42 documents why — module-resolution path for `shared/` in the Electron vitest config). This is a reasonable workaround but creates a second source of truth that can drift. Consider either (a) fixing the vitest alias so the real export imports cleanly, or (b) adding a meta-test that asserts the inlined schema and the real export produce the same parse result for a canonical payload. Not blocking.

---

## Commandment Compliance

| Commandment | Status | Evidence |
|---|---|---|
| **C1 (Code is Truth)** | N/A | This feature persists UI configuration, not source-code mutations. |
| **C2 (No Hallucinated Styling)** | PASS | All new className usages in `GovernancePanel.tsx` and `StatusBar.tsx` use tokens (zinc, indigo, emerald, amber palettes, `var(--spacing.*)`). No hex literals. |
| **C4 (Local-First Only)** | PASS | File writes land in `.flint/rule-overrides.json` under `activeProjectRoot`. No external URLs. |
| **C6 (Gatekeeper Rule)** | PASS | The filter suppresses only *disabled* rules from the dashboard view; the export gate in `canvasStore.canExport()` is unchanged and still blocks on any unresolved critical violation. |
| **C12 (Atomic Queuing)** | PASS | `electron/main.ts:4450` — `fileTransactionManager.write(overridesPath, ...)`. `server/index.ts:2088` uses the `atomicWrite` helper (tmp → rename). |
| **C14 (Bypass Prohibition)** | PASS | No raw `fs.writeFile` for override persistence. Read path uses `readFile` from `node:fs/promises` which is the allowed read primitive; writes go through FTM. |
| **C16 (TSC Loop)** | N/A | No AI-generated source output in this feature. |

## Key Concern Responses

1. **Fail-open violation filter** — Correct. `!w.ruleId` short-circuits to `true` (line 57). Warnings without a `ruleId` are always rendered.
2. **FileTransactionManager usage** — Correct. `electron/main.ts:4450` invokes `fileTransactionManager.write()`. Not raw `fs.writeFile`.
3. **`isReturningToDefault`** — Correct. Line 282-284 checks `enabled === defaultEnabled && (!currentOverride?.severity || currentOverride.severity === rule?.defaultSeverity)`. A severity-only override is preserved when toggling enabled. The `setOverride` store action merges via spread (`governanceStore.ts:66`), so partial updates do not clobber sibling fields.
4. **`historyStore.clear()` on demo load** — Correct. `clear()` is documented (`historyStore.ts:21`) as the file-open reset. `pushCheckpoint()` would retain the pre-demo stack, making undo cross the demo boundary — a worse UX bug than what T1.5 is fixing.
5. **Zod validator style** — Consistent. Named exports (`governanceSaveOverridesValidator`, `governanceGetOverridesValidator`), co-located wire helper (`ruleOverrideWireSchema`), block-comment banner matching `FORGE.1` / `CHRON.1`.
6. **Web-parity handler** — Complete. `server/index.ts:2079` mirrors the Electron handler. Validates with the same schema, writes via `atomicWrite`, handles ENOENT identically. Minor asymmetry: server omits the `!activeProjectRoot` guard — but `server/index.ts:511` initializes `activeProjectRoot: string = resolvedRoot` so it is never null in that context. Intentional.
7. **Edge cases** — Covered: empty overrides (GOVERR-04), malformed JSON (GOVERR-08), missing file (GOVERR-07). Not covered: concurrent writes (Warning 2 above).

---

## Files Reviewed

- src/hooks/useGovernanceCategories.ts
- src/components/ui/GovernancePanel.tsx
- src/components/editor/StatusBar.tsx
- src/components/ui/ResizeHandle.tsx
- src/App.tsx (demo load + undo guard lines 432-472, 721-755, 610-625)
- electron/main.ts (lines 4432-4472)
- electron/preload.ts (lines 1681-1695)
- server/index.ts (lines 2073-2108)
- shared/ipc-validators.ts (lines 507-537)
- src/types/flint-api.d.ts (lines 2161-2170)
- src/adapters/web-api.ts (lines 599-601)
- electron/__tests__/governance-ipc.test.ts
- src/hooks/__tests__/useGovernanceCategories.test.ts
- src/components/ui/__tests__/GovernancePanel.test.tsx (presence only)
- src/components/ui/__tests__/ResizeHandle.test.tsx (presence only)

No BLOCKERS. 2 WARNINGS, 1 INFO. Ready to ship after addressing Warning 1 (hook-layer filter test); Warning 2 and INFO are optional polish.
