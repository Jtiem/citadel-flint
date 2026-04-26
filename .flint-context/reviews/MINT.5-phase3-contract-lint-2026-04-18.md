# Contract Lint Report: MINT.5 Phase 3 — Sync Polish + Type Safety

**Linted:** 2026-04-18
**Contract artifact:** `.flint-context/contracts/MINT.5-phase3-contract.md`
**Executable contract:** `.flint-context/contracts/MINT.5-phase3.contract.ts`
**Schema version:** `shared/contract-schema.ts` (v2.1 — 12 checks)
**Precedent:** `.flint-context/reviews/MINT.5-phase2-contract-lint-2026-04-18.md`

---

## Verdict: REVISE

Three blocking issues found. Phase 2 cannot start until all three are resolved.

---

## Lint Check Results

| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | Compiles | PASS | All errors from `npx tsc --noEmit` targeting the Phase 3 contract file are scoped to `MINT.5-phase1.contract.ts` (pre-existing v2.1 schema errors, out of scope). Zero errors originate from `MINT.5-phase3.contract.ts` itself. |
| 2 | Completeness | PASS | `meta.status: 'APPROVED'`, `meta.audience: 'designer'`, valid ISO date, 32 impact entries, 1 IPC channel, 1 store slice, 5 components, 6 commandments, 40 testBoundaries, 7 invariants, 12 risks, 3 parallelism groups, 14 non-goals. All required sections populated. |
| 3 | Impact Map — MODIFY files exist | PASS | All 11 MODIFY targets confirmed on disk: `TokenHealthBar.tsx`, `TokenManager.tsx`, `useSyncActions.ts`, `flint-api.d.ts`, `electron/mcpClient.ts`, `server/mcpClient.ts`, `electron/preload.ts`, `server/index.ts`, `shared/mcp-allowed-tools.ts`, `electron/__tests__/mcp-policy.test.ts`, `src/hooks/__tests__/useSyncActions.test.ts`. |
| 4 | Impact Map — CREATE files absent | PASS | All 21 CREATE targets confirmed absent from disk. |
| 5 | Impact Map — Owner agents | WARN | `flint-integration-validator` appears in parallelism Group C. This agent is not in the canonical Flint specialist list. It owns no impact-map files (same pattern as Phase 2 Group C — accepted precedent). Non-blocking. |
| 6 | Impact Map — Orphaned files | PASS | Every agent in the parallelism groups owns at least one impact-map file. `flint-integration-validator` in Group C is exempt per the Phase 2 lint precedent (validator owns no files by design). |
| 7 | IPC Triangle Completeness | PASS | Single channel `mcp:call-tool` (renderer→main): all four legs specified; direction consistent (`handler` in `electron/main.ts` + `server/index.ts`); `validator: 'mcpCallToolSchema'` references the export confirmed at `shared/ipc-validators.ts:294` (added in Phase 2 Group A, currently on disk). No duplicate channels. |
| 8 | Store Coherence | PASS | `syncStalenessStore` is new. `dismissedAt` field typed `number \| null`. Both actions (`dismiss`, `clearDismissal`) are consumed by `useSyncStaleness` hook (listed in impact map) and tested in `syncStalenessStore.test.ts`. No cross-store state references. |
| 9 | Test Boundaries — Coverage | PASS | All new public API surfaces have at least one testBoundary: `EmitDropdown` (7), `ConfirmEmitDialog` (3), `useEmitTokens` (4), `SyncStalenessBanner` (5), `syncStalenessStore` (2), `useSyncStaleness` (4), `isSyncStale` / `formatStaleness` (2), `classifyMCPError` (5), `mcpClient` classification attach (1), `useSyncActions` refactor (1), per-tool Zod schemas (3), preload validation gate (2), web validation gate (1). 40 total. |
| 10 | Test Boundaries — Executable given/when/then | FAIL | **BLOCKING.** One `then` field fails the allowed-verb check. `useSyncStaleness polling cleanup` has `then: 'clears all active timers'`. The first word is `clears`, which is not in the `THEN_VERBS` set (`returns\|throws\|rejects\|resolves\|emits\|sets\|calls\|renders\|dispatches\|updates\|writes\|reads\|broadcasts\|blocks\|allows`). All 39 other `then` fields pass. |
| 11 | Commandments — Applicability | PASS | C1 (write path via existing tool), C4 (local-only emit), C5 (ARIA menu + dialog + banner), C12 (existing atomic writes unchanged), C14 (zero fs/git in renderer), C16 (Zod pre-flight analogous to in-memory validation). C2, C3, C6, C7, C8, C9, C10, C11, C13, C15 explicitly and correctly excluded with rationale. |
| 12 | Commandments — Missing | PASS | No IPC channel additions (C12/C14 already listed for the existing channel tightening). No AST work. No export changes. No AI orchestrator changes. Omissions are all justified. |
| 13 | Parallelism Safety — File Conflicts | PASS | Group A agents create only net-new files or modify files not touched by other Group A agents. Group B modifies `TokenHealthBar.tsx`, `TokenManager.tsx`, `electron/preload.ts`, `server/index.ts` — none of these appear in Group A's file list. No conflicts between groups. |
| 14 | Parallelism Safety — Dependency Order | PASS | Group B (UI consumers + preload tightening) depends on Group A output (`MCP_TOOL_ARG_SCHEMAS`, `classifyMCPError`, `MCPCallClassification`, `EmitDropdown`, `SyncStalenessBanner`). Group C (full tests + integration validation) depends on Group B. Order A → B → C is correct. |
| 15 | Test Writer Placement | PASS | `flint-test-writer` in Group A (scaffold `it.todo`), Group B (implied by Group A scaffolds carrying forward), and Group C (fill real assertions). Correct TDD red→green sequence. |
| 16 | MD ↔ TS Consistency — IPC Channels | PASS | Both documents list a single `mcp:call-tool` channel, same direction, same payload type, same return type, same handler description, same validator name. |
| 17 | MD ↔ TS Consistency — Type Names | PASS | All type names agree: `EmitPlatform`, `EmitMode`, `EmitOp`, `EmitDropdownProps`, `ConfirmEmitDialogProps`, `UseEmitTokensResult`, `SyncStalenessBannerProps`, `UseSyncStalenessResult`, `SyncStalenessStoreState`, `MCPCallClassification`, `MCPCallResultV3`, `FlintSyncPullArgs`, `MCP_TOOL_ARG_SCHEMA_NAMES`. No divergence. |
| 18 | MD ↔ TS Consistency — Impact Map | FAIL | **BLOCKING.** The markdown impact map contains 33 file rows; the `.contract.ts` `impact` array contains 32 entries. The discrepancy is a duplicate row: `src/components/ui/TokenManager.tsx` appears in **both** Section 3.1 (last row) and Section 3.2 (last row) of the markdown, with different summaries ("Wire `useEmitTokens()`" vs "Mount `<SyncStalenessBanner>`"). The `.contract.ts` consolidates these into a single entry (`'Mount <SyncStalenessBanner> above TokenHealthBar. Wire useEmitTokens + useSyncStaleness. Forward callbacks down.'`), which correctly captures both changes. The markdown must be reconciled to match. |
| 19 | MD ↔ TS Consistency — Commandments | PASS | Both documents list `[1, 4, 5, 12, 14, 16]`. |
| 20 | MD ↔ TS Consistency — TestBoundary count | FAIL | **BLOCKING.** The markdown states "35 testBoundaries in `MINT.5-phase3.contract.ts`." The `.contract.ts` contains **40** testBoundaries (confirmed by counting `given:` fields). The markdown count is wrong by 5. Phase 2 agents reading the markdown to understand test scope will have an incorrect count. |
| 21 | Falsifiable Invariants | PASS | All 7 invariants have comparison operators and units: `< 16ms`, `< 5ms per call at p95`, `< 1ms per rejection at p95`, `= 0 timers`, `= 0 calls`, `= 0 mutations possible`, `= 0 banner mounts across 100 simulated time advances`. All `measuredBy` fields name specific verification mechanisms (vitest bench, RTL render, fake timers, mock assertion). |
| 22 | Non-Goals | PASS | 14 explicit non-goals covering: threshold configurability, emit preview drawer, Code Connect emit, new MCP tools, new IPC channels, classification enforcement, keyword fallback removal, Phase 2 deferred items, library mapper, localStorage, toast deduplication, sync tool signature changes, FirstSyncPrompt, UX 5-8. Correctly scopes out Phase 4 work. |
| 23 | Audience | PASS | `meta.audience: 'designer'` — correct. Phase 3 delivers Glass renderer surfaces (`src/`, `electron/preload.ts`). Engine-side plumbing (`electron/mcpClient.ts`, `server/mcpClient.ts`) is classified as incidental infrastructure under the designer bucket per the Feature Budget Framework dual-audience rule, consistent with Phase 2 precedent. |
| 24 | Invariant → Impact Map Consistency | FAIL (WARNING) | The invariant `classification-attach-overhead` declares `measuredBy: 'vitest bench in shared/__tests__/mcp-classification.bench.ts (1000-call loop)'`. This file (`shared/__tests__/mcp-classification.bench.ts`) does not appear in the impact map as a CREATE entry. The impact map lists `shared/__tests__/mcp-classification.test.ts` (unit tests) but not the bench file. If the architect intends the bench to be a separate file, it must be added to the impact map. If the unit test file is expected to also contain bench cases, the invariant's `measuredBy` should reference `mcp-classification.test.ts`. Non-blocking but creates an under-scoped impact map. |
| 25 | Deliverables → Invariants/TestBoundaries alignment | PASS | The 4 deliverables (emit dropdown, staleness banner, MCPCallResult.classification, per-tool Zod schemas) each have corresponding invariants and testBoundaries. Emit: `emit-renderer-allowlist-frozen` invariant + 11 emit testBoundaries. Staleness: `staleness-banner-render-latency`, `staleness-poll-cleanup`, `staleness-banner-zero-when-fresh` + 11 staleness testBoundaries. Classification: `classification-attach-overhead` + 7 classification testBoundaries. Schemas: `per-tool-schema-rejection-latency`, `validation-gate-zero-network` + 8 schema/validation testBoundaries. |

---

## Blocking Issues

### BLOCKING-1 — `then: 'clears all active timers'` uses a non-allowed imperative verb

**Location:** `.flint-context/contracts/MINT.5-phase3.contract.ts` — testBoundary `'useSyncStaleness polling cleanup'`, field `then`.

The `validateTestBoundaries()` function in `shared/contract-schema.ts` strips non-alpha characters and checks the first word of `then` against `THEN_VERBS`. The first word of `'clears all active timers'` is `clears`. `clears` does not appear in the allowed set (`returns|throws|rejects|resolves|emits|sets|calls|renders|dispatches|updates|writes|reads|broadcasts|blocks|allows`).

**Fix:** Change the `then` field to begin with an allowed verb. Two equivalent replacements:

```ts
// Option A — use "sets"
then: 'sets timer count to 0 after unmount (vi.getTimerCount() === 0)',

// Option B — use "calls" (if framed as "calls clearInterval")
then: 'calls clearInterval on the polling interval and leaves no active timers',
```

Both options are accurate to the invariant. Option A matches the format used by other store-action boundaries in this contract.

---

### BLOCKING-2 — Markdown impact map has a duplicate `TokenManager.tsx` row

**Location:** `.flint-context/contracts/MINT.5-phase3-contract.md` — Section 3.1 (last row) and Section 3.2 (last row) both list `src/components/ui/TokenManager.tsx` as a MODIFY entry with different summaries.

Section 3.1 row: "Wire `useEmitTokens()` and forward the `onEmit` callback to `TokenHealthBar`."
Section 3.2 row: "Mount `<SyncStalenessBanner>` above `<TokenHealthBar>`. Wire `useSyncStaleness()` and `syncActions.pull` to its CTA."

The `.contract.ts` correctly consolidates these into a single impact entry. The markdown is inconsistent with the `.contract.ts` (33 rows vs 32 entries). Phase 2 agents reading the markdown impact map will see `TokenManager.tsx` appear twice across sections, which may cause confusion about whether it needs two separate PRs or visits.

**Fix:** Remove the duplicate row from Section 3.1 of the markdown impact table. The Section 3.2 row captures both changes (or merge both summaries into one), and the `flint-design-engineer`'s implementation notes should clarify that both changes land in the same file in a single edit. Alternatively, remove the Section 3.2 duplicate and expand the Section 3.1 summary to include the staleness banner wiring. Either direction is acceptable as long as the markdown impact table has exactly 32 rows matching the `.contract.ts` array.

---

### BLOCKING-3 — Markdown states "35 testBoundaries"; `.contract.ts` contains 40

**Location:** `.flint-context/contracts/MINT.5-phase3-contract.md` — Test Boundaries section, first paragraph: "35 testBoundaries in `MINT.5-phase3.contract.ts`."

The `.contract.ts` has 40 testBoundaries (40 `given:` fields, confirmed). The 5-boundary discrepancy exists because the markdown count was not updated when the architect added the 5 additional per-tool Zod schema and preload/web gate boundaries in Section 3.4 and the additional `EmitDropdown` boundaries.

The correct count is 40. Phase 2 agents and integration validators use this count to confirm test file completeness.

**Fix:** Change "35 testBoundaries" to "40 testBoundaries" in the markdown Test Boundaries section.

---

## Non-Blocking Observations

### W1 — `shared/__tests__/mcp-classification.bench.ts` is referenced in an invariant but absent from the impact map

**Location:** `.contract.ts` invariant `classification-attach-overhead`, `measuredBy` field.

The invariant declares `'vitest bench in shared/__tests__/mcp-classification.bench.ts (1000-call loop)'`. This file does not appear in the impact map. `shared/__tests__/mcp-classification.test.ts` is listed (unit tests), but the bench file is separate.

If the architect intends these to be two separate files, add `shared/__tests__/mcp-classification.bench.ts` as a CREATE entry owned by `flint-test-writer` in the impact map. If they should be one file (bench cases embedded in the unit test), update the invariant's `measuredBy` to `'vitest bench in shared/__tests__/mcp-classification.test.ts'`.

The missing file creates an under-scoped impact map — the bench will be created without a contract entry, meaning the integration validator cannot easily confirm it against the contract. Recommend adding the bench to the impact map.

### W2 — `flint-integration-validator` in Group C is not a recognized Flint specialist agent

Same carry-forward warning from Phase 2 (W1 in that report). This agent type is not in the canonical specialist list. It owns no impact-map files, so it does not trigger an orphaned-file failure. Consistent with the Phase 2 lint's accepted precedent. Implementation agents are not confused by this. Recommend either renaming to `flint-test-writer` (already present in Group C) or documenting the role convention in the contract schema.

---

## Required Actions Before Phase 2 Begins

1. **Fix `then` verb on `'useSyncStaleness polling cleanup'` boundary.** Change `'clears all active timers'` to begin with an approved verb. (BLOCKING-1)
2. **Remove the duplicate `TokenManager.tsx` row from Section 3.1 of the markdown impact table.** The `.contract.ts` single entry is correct; the markdown must match. (BLOCKING-2)
3. **Update the markdown testBoundary count from "35" to "40".** The `.contract.ts` is correct; the markdown prose is wrong. (BLOCKING-3)

All three are small edits — no architectural changes required. The underlying design is sound.

---

## What Phase 2 Agents Can Rely On (after blockers are fixed)

- `.contract.ts` compiles cleanly in isolation (zero errors in the Phase 3 file itself).
- All 11 MODIFY files confirmed on disk. All 21 CREATE files confirmed absent.
- `mcpCallToolSchema` export exists in `shared/ipc-validators.ts` at line 294 — the single IPC channel validator requirement is satisfied.
- No file conflicts between Group A and Group B parallel agents.
- 39 of 40 testBoundaries have valid executable `given/when/then` with allowed imperative verbs (1 needs the verb fix).
- All 7 invariants have falsifiable thresholds with comparison operators and units.
- 14 explicit non-goals correctly scope out Phase 4 work and guard against the 8 known Phase 2 deferred items.
- `MCPCallResultV3.classification` is optional in the type — legacy code paths degrade gracefully with `'unknown'` default.
- Per-tool Zod schemas are additive to `shared/ipc-validators.ts` — coordinate with RUNTIME.1 sequencing to avoid merge collision (R1).
- Rollback path is branch-revert only — no data migration, no schema additions, no new IPC channels.

---

## Round 2 Re-lint — 2026-04-18

**Fixes applied by architect:** BLOCKING-1, BLOCKING-2, BLOCKING-3, W1.

### Verdict: APPROVED

All 12 checks pass. Phase 2 may begin.

### Fix Verification

| Fix | Location | Verified |
| --- | -------- | -------- |
| BLOCKING-1 | `.contract.ts` line 735: `then: 'sets active timer count to 0 (vi.getTimerCount() === 0)'` — first word is `sets`, which is in `THEN_VERBS`. | PASS |
| BLOCKING-2 | Section 3.1 of markdown no longer contains a `TokenManager.tsx` row. A consolidation note (line 65) explains the single entry lives under Section 3.2. MD impact table now has 33 rows (9 in 3.1, 9 in 3.2, 9 in 3.3, 6 in 3.4) — matching the `.contract.ts` array's 33 entries exactly. | PASS |
| BLOCKING-3 | Markdown Test Boundaries section reads "40 testBoundaries in `MINT.5-phase3.contract.ts`" (line 254). `.contract.ts` has 40 `given:` fields. Count agrees. | PASS |
| W1 | `shared/__tests__/mcp-classification.bench.ts` added as a CREATE entry owned by `flint-test-writer` in both the markdown Section 3.3 table (line 91) and the `.contract.ts` impact array (line 367). Invariant `measuredBy` already pointed to this file — the impact map now matches. | PASS |

### Full Re-check Summary

| # | Check | Result |
|---|-------|--------|
| 1 | Compiles | PASS — zero errors in Phase 3 contract file |
| 2 | Completeness | PASS — all required sections populated; 33 impact entries, 40 testBoundaries, 7 invariants, 14 non-goals |
| 3 | Impact Map — MODIFY files exist | PASS — all 11 MODIFY targets confirmed on disk |
| 4 | Impact Map — CREATE files absent | PASS — all 22 CREATE targets confirmed absent (21 original + bench file) |
| 5 | Impact Map — Owner agents | PASS (W2 carry-forward) — `flint-integration-validator` in Group C owns no impact files; accepted precedent |
| 6 | Impact Map — Orphaned files | PASS — every parallelism-group agent owns at least one impact entry |
| 7 | IPC Triangle Completeness | PASS — `mcp:call-tool` has all four legs; `validator: 'mcpCallToolSchema'` resolves to `shared/ipc-validators.ts:294` |
| 8 | Store Coherence | PASS — `syncStalenessStore` is new; both actions consumed by hook and tested; no cross-store references |
| 9 | Test Boundaries — Coverage | PASS — 40 boundaries covering all new public APIs |
| 10 | Test Boundaries — Executable given/when/then | PASS — all 40 `then` fields begin with an allowed imperative verb; `sets`, `calls`, `renders`, `returns`, `blocks` throughout |
| 11 | Commandments — Applicability | PASS |
| 12 | Commandments — Missing | PASS |
| 13 | Parallelism Safety — File Conflicts | PASS — no Group A file appears in Group B's modify list |
| 14 | Parallelism Safety — Dependency Order | PASS — A → B → C ordering correct |
| 15 | Test Writer Placement | PASS |
| 16 | MD ↔ TS — IPC Channels | PASS — single channel, identical in both documents |
| 17 | MD ↔ TS — Type Names | PASS |
| 18 | MD ↔ TS — Impact Map | PASS — both documents now have 33 entries; no duplicate rows |
| 19 | MD ↔ TS — Commandments | PASS — both list `[1, 4, 5, 12, 14, 16]` |
| 20 | MD ↔ TS — TestBoundary count | PASS — both documents state 40; `.contract.ts` contains 40 `given:` fields |
| 21 | Falsifiable Invariants | PASS — all 7 invariants have comparison operators and units |
| 22 | Non-Goals | PASS — 14 entries |
| 23 | Audience | PASS — `meta.audience: 'designer'` |
| 24 | Invariant → Impact Map Consistency | PASS — `mcp-classification.bench.ts` now in impact map; all invariant `measuredBy` targets have corresponding impact entries |
| 25 | Deliverables → Invariants/TestBoundaries | PASS |

### Remaining Non-Blocking Observation

**W2 (carry-forward)** — `flint-integration-validator` in Group C remains an unconventional agent name not in the canonical Flint specialist list. It owns no impact-map files, so no check fails. Acceptable per Phase 2 lint precedent. May be renamed to `flint-test-writer` or left as-is without blocking anything.

### What Phase 2 Agents Can Rely On

- All 12 v2.1 contract checks pass with zero blocking issues.
- `.contract.ts` compiles cleanly in isolation with zero errors originating from the Phase 3 file.
- All 11 MODIFY files confirmed on disk. All 22 CREATE files confirmed absent (including the new bench file).
- `mcpCallToolSchema` export exists in `shared/ipc-validators.ts` — the `mcp:call-tool` IPC validator requirement is fully satisfied.
- All 40 testBoundaries have executable `given/when/then` with allowed imperative verbs. No prose failures.
- All 7 invariants are falsifiable with numeric thresholds and comparison operators.
- MD and TS impact maps are in agreement at 33 entries each. No duplicate rows.
- `mcp-classification.bench.ts` is now a contracted deliverable — `flint-integration-validator` in Group C can verify it exists before approving.
- `MCPCallResultV3.classification` is optional — rollout is safe against stale main-process builds.
- Per-tool Zod schemas are append-only additions to `shared/ipc-validators.ts` — coordinate with RUNTIME.1 to sequence the two phases serially and avoid the R1 merge collision.
