# MINT.5 Phase 3 — Code Review (UNSCOPED CONTROL, A/B Pilot)

**Reviewer:** flint-code-reviewer (UNSCOPED control arm)
**Date:** 2026-04-20
**Commit:** 1db3e7f
**Scope:** Full MINT.5.3 diff — 28 changed files, ~403 KB of prod/test source read directly.

## Verdict

**APPROVED WITH MINOR WARNINGS** — no blockers. The phase is internally consistent, Commandment-compliant, well-tested, and ships with a crisp single-source-of-truth for MCP classification. All findings are warnings; none gate the merge.

---

## Findings

### W1 — Rate-limit classification is persistent in `useEmitTokens` but `classifyMCPError` surfaces rate-limited without a retry-after

- **File:** `src/hooks/useEmitTokens.ts:163`
- **Observed:** `persistent: classification === 'auth-expired' || classification === 'rate-limited'`.
- **Rationale:** Marking a rate-limited error as persistent (autoDismissMs=0, severity=critical) can strand the banner indefinitely because there's no retry signal. `useSyncActions` uses the same logic so they're at parity, but neither hook re-polls after backoff nor clears the chip automatically. Consider a timed dismiss (e.g., 60s) for rate-limited, since the upstream 429 typically self-resolves.
- **Fix:** Either keep `persistent=true` but attach a visible "Retry in ~60s" countdown, or treat `rate-limited` as transient with a longer autoDismiss (30000ms).

### W2 — `useSyncStaleness` re-effect does not include `projectRoot` or `thresholdHours` in deps

- **File:** `src/hooks/useSyncStaleness.ts:184`
- **Observed:** `eslint-disable-next-line react-hooks/exhaustive-deps` followed by `[enabled, pollIntervalMs]`.
- **Rationale:** Refs are used to propagate changes, but the initial `runPoll()` (fired at mount) captures the ref values at the moment `enabled` flips. If the consumer swaps `projectRoot` without toggling `enabled`, the new root only takes effect on the next tick (up to 60s later). For a hot project switch this is a UX delay, not a bug.
- **Fix:** Include `projectRoot` in the dep array so the effect re-subscribes and the first poll uses the new root immediately.

### W3 — `hoursSinceSync` can be negative on clock skew but is rendered without guard

- **File:** `src/components/ui/mint/SyncStalenessBanner.tsx:92-104` (formatHours)
- **Observed:** `formatHours(-0.5)` returns `"-30 minutes"`.
- **Rationale:** `shared/syncStaleness.ts` guards against future timestamps by returning `isSyncStale=false`, so the banner would not render in normal cases. But if any caller passes `hoursSinceSync < 0` with `isStale=true` (e.g., test harness or future bug), the copy reads oddly.
- **Fix:** `if (hours < 0) return 'a few moments'` in `formatHours`.

### W4 — `EmitDropdown` keydown handler pollutes `focusedIndex` when MENU_ITEMS changes

- **File:** `src/components/ui/mint/EmitDropdown.tsx:78`
- **Observed:** `const MENU_ITEMS = buildMenuItems();` is module-scoped.
- **Rationale:** Currently fine — platforms are static. If Phase 4 adds a runtime-configurable platform list, the `focusedIndex` state can exceed the new array length. Low-severity forward-compat note.
- **Fix:** Clamp `focusedIndex` against `MENU_ITEMS.length` inside the open effect or move the array into state.

### W5 — `server/index.ts` per-tool validation copy-paste of preload logic; correct but duplicated

- **File:** `server/index.ts:2594-2616` and `electron/preload.ts:810-829`
- **Observed:** The two validation gates are structurally identical; only the shape of the return envelope is the same.
- **Rationale:** Correct parity today, drift risk tomorrow. Single source of truth principle (R8 in the contract) is satisfied for the **schemas** but not for the **gate logic**.
- **Fix:** Factor a `validateMcpToolArgs(name, args): { ok: true, args } | { ok: false, envelope }` helper in `shared/` and consume from both sides. Not urgent — both bodies are ~20 lines — but worth filing.

### W6 — `classification` field on `MCPCallResult` is typed as optional; renderer must defend forever

- **File:** `shared/mcp-classification.ts` + `electron/mcpClient.ts:44`, `server/mcpClient.ts:28`
- **Observed:** Interface says `classification?: MCPCallClassification` and `useSyncActions.ts:97` degrades to keyword matching when absent.
- **Rationale:** Both main-process clients now always attach classification, so the field is de facto required. The `?` perpetuates the keyword backstop. Phase 4's plan to remove keyword fallback is easier if the field is required now.
- **Fix:** Remove the `?` and the keyword backstop in the same cut. Tests assert `'classification' in result` already.

### W7 — `ConfirmEmitDialog` displays `outputDir` from caller but tool resolves a different path

- **File:** `src/components/ui/TokenManager.tsx` (diff) — `emitOutputDir = \`${projectPath || '.'}/.flint/platform-tokens\``
- **Observed:** The UI string is a best-guess; the MCP tool may write to `design-tokens/platform/` or similar on the main side.
- **Rationale:** Users will confirm based on what the dialog says. If the real path differs, trust erodes.
- **Fix:** Either expose the resolved path via a pre-flight dryRun call or coordinate with the Scout tool to accept an explicit `outputDir` arg and pass `emitOutputDir` through.

### W8 — Network-error patterns miss common Node `getaddrinfo EAI_AGAIN`

- **File:** `shared/mcp-classification.ts:65-78`
- **Observed:** `'enotfound', 'econnreset', 'etimedout', 'network error', 'dns failure', ...`
- **Rationale:** Node's intermittent DNS failure surfaces as `getaddrinfo EAI_AGAIN` which won't match any existing pattern → falls through to `'tool-error'`.
- **Fix:** Add `'eai_again'` and `'getaddrinfo'` to NETWORK_ERROR_PATTERNS.

---

## Commandment Compliance (abbreviated)

- **C1/C12/C14 (code-is-truth / atomic / bypass):** Emit write path routes via MCP tool → main-process fs write. No direct `fs` in src/. ✔
- **C4 (local-first):** Emit + staleness calls use local MCP only. ✔
- **C5 (a11y):** `ConfirmEmitDialog` has `role=dialog`, `aria-modal`, FocusTrap, asymmetric cancel focus. `EmitDropdown` implements full ARIA menu pattern. `SyncStalenessBanner` uses `role=status` + `aria-live=polite`. ✔
- **C13 (no regex surgery):** N/A — no source mutation in this phase. ✔
- **C15 (granular tools):** New renderer-facing MCP call (`flint_emit_tokens`) goes through the catalog. ✔
- **Process boundary:** No Node imports in `src/`. IPC only via `window.flintAPI`. Store never calls `window.flintAPI`. ✔

## Test Coverage

- `shared/__tests__/mcp-classification.test.ts` — 6 boundaries covered, precedence tested.
- `shared/__tests__/ipc-validators.mcp-tool-schemas.test.ts` — per-tool Zod gate exercised (294 LOC).
- `electron/__tests__/preload.mcp-validation.test.ts` — validation-gate-zero-network invariant tested via inline reproducer.
- `electron/__tests__/mcpClient.classification.test.ts` — classification attached on every result path.
- `src/hooks/__tests__/useEmitTokens.test.ts` — 330 LOC covering preview, write, confirm gate, serialization, error paths.
- `src/hooks/__tests__/useSyncStaleness.test.ts` — 368 LOC covering polling, auto-clear, cleanup.
- `src/store/__tests__/syncStalenessStore.test.ts` — dismiss + clear round-trip.
- Component tests for `ConfirmEmitDialog`, `EmitDropdown`, `SyncStalenessBanner`.

TSC: 0 errors (verified locally).

---

## Instrumentation

- **Files fully read:** 16 production source files + 2 test files sampled + contract summary.
- **Approx bytes in full file set:** ~403,735 bytes of production/test source read or diffed (selectively — `server/index.ts` and `electron/preload.ts` consumed via `git diff` windows rather than full reads).
- **Findings by domain:**
  - ui/a11y: 3 (W3, W4, W7)
  - ipc/security: 1 (W5)
  - state/hook: 2 (W1, W2)
  - classification/types: 2 (W6, W8)
- **Findings by severity:** 0 blockers, 8 warnings.
- **TSC:** clean.
- **Tool calls in review:** 1 full-commit git-show, 4 parallel Reads for shared modules, 4 parallel Reads for hooks/components, 2 targeted diffs for preload + server, 1 file-size survey, 1 TSC run.
