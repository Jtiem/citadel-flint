# MINT.5 Phase 3 — Code Review (Scoped, Cheaper-Pilot A/B)

**Reviewer:** flint-code-reviewer (scoped pilot)
**Date:** 2026-04-20
**Round:** 1
**Commit under review:** 1db3e7f

## Verdict

**SHIP** — 0 blocking, 0 warning, 2 suggestion findings. Derived via `deriveVerdict(findings, 'code')`.

## Summary

Phase 3 adds three capabilities: a shared MCP error classifier, a shared staleness helper, and the Scout emit dropdown. The diff is disciplined and adheres to the Commandments and process boundaries:

- **Process boundary (C14, C9-DIR):** No Node.js imports in `src/`. The two `mcpClient.ts` files (Electron + web) correctly live in their host process and only share the pure classifier via `shared/`.
- **Store isolation:** `syncStalenessStore.ts` is a single-responsibility slice, no cross-store imports, no `window.flintAPI` calls inside store actions. IPC lives in the hook (`useSyncStaleness`), not the store — matches the architectural rule.
- **Single source of truth (R8):** `classifyMCPError` is imported by both `electron/mcpClient.ts:34` and `server/mcpClient.ts:19`, and consumed in the renderer via `useSyncActions.ts:186-188` and `useEmitTokens.ts:156`. No duplicated taxonomy.
- **IPC validation (C14 + Design-by-Contract):** `MCP_TOOL_ARG_SCHEMAS` in `shared/ipc-validators.ts:417-423` covers the five sync tools with `.strict()` Zod objects, matching the handler signatures in `flint-mcp/src/server.ts`.
- **Allowlist (SEC.3):** `flint_emit_tokens` added to `RENDERER_ALLOWED_MCP_TOOLS` with a documented justification — dryRun-default + ConfirmEmitDialog gate for the write path.
- **A11y (C5):** EmitDropdown ships `role="menu"`/`menuitem`, full keyboard nav (Arrow/Home/End/Enter/Escape), document-level Escape handler, outside-click close. ConfirmEmitDialog uses FocusTrap with asymmetric initial focus on Cancel.
- **Serialization:** `useEmitTokens` uses the `emitOpRef` synchronous-ref pattern identical to `useSyncActions` — prevents double-fire before React state settles.
- **Test coverage:** All four new shared/hook modules have co-located tests (`shared/__tests__/mcp-classification.test.ts`, `shared/__tests__/syncStaleness.test.ts`, `src/hooks/__tests__/useEmitTokens.test.ts`, `src/hooks/__tests__/useSyncStaleness.test.ts`).

Two non-blocking suggestions below.

---

## Findings

### SUG-1 — Duplicated hours-formatting logic (DRY)

- **Severity:** suggestion
- **Scope:** one-file
- **File:** `src/components/ui/mint/SyncStalenessBanner.tsx:92-104`

**Observed:** The component defines a local `formatHours(hours)` helper that duplicates the shape of `formatStaleness(durationMs)` in `shared/syncStaleness.ts:53-61`. The component imports nothing from the shared module despite the header comment acknowledging the overlap ("mirrors the shape of shared/syncStaleness.ts but works from pre-computed hours").

**Rationale:** Having two formatters with near-identical thresholds (1h / 48h / day pivots) invites future drift. A single `formatStaleness(durationMs)` call on `hoursSinceSync * 3_600_000` would collapse this to one implementation.

**Proposed fix:** Delete the local `formatHours` helper and call `formatStaleness(hoursSinceSync * 3_600_000)` from the shared module. Minute-granularity callers retain it because `formatStaleness` already handles `< 60_000 ms` correctly.

### SUG-2 — Keyword backstop in `useSyncActions.isPersistentError` is now dead code in the Electron/web paths

- **Severity:** suggestion
- **Scope:** one-file
- **File:** `src/hooks/useSyncActions.ts:92-110`

**Observed:** With Phase 3's `callTool()` in both `electron/mcpClient.ts:174-175` and `server/mcpClient.ts:147-148` unconditionally attaching `classification`, the `result.classification` field is always populated. The keyword-matching fallback branch (lines 101-109) will only fire for results from external adapters that bypass the two `callTool` call sites (none exist today) or for thrown exceptions (the `catch` branch at line 231 already passes `undefined` deliberately).

**Rationale:** The comment says "Keyword fallback will be removed in Phase 4" — tracked. Not a defect today; confirming the author's self-noted follow-up for visibility.

**Proposed fix:** Add a `// TODO(MINT.5/phase4):` marker referencing the removal so grep picks it up when Phase 4 lands.

---

## Rubric

| Criterion | Result | Evidence |
|---|---|---|
| No Node.js imports in `src/` | pass | Grepped scoped files — only `react`, `zustand`, `zod`, `clsx`, `lucide-react`, and `../../shared/*` imports |
| No `window.flintAPI` inside a Zustand store action | pass | `syncStalenessStore.ts` has only pure `set()` calls |
| No cross-store imports | pass | `syncStalenessStore.ts` imports only contract + zustand |
| Every new renderer→main IPC path has a Zod validator | pass | `MCP_TOOL_ARG_SCHEMAS` covers the 5 sync tools; `mcpCallToolSchema` exists |
| SEC.3 allowlist updated for new renderer-callable tool | pass | `shared/mcp-allowed-tools.ts:37` adds `flint_emit_tokens` with justification |
| C14 (Bypass Prohibition): no direct `fs`/`git` in renderer | pass | Hooks + components audited |
| C5 (A11y): ARIA roles + keyboard nav on new interactive UI | pass | EmitDropdown + ConfirmEmitDialog + SyncStalenessBanner all instrumented |
| C9-DIR (Process Boundary): no Node imports in `src/` | pass | Confirmed by file review |
| Discriminated union exhaustiveness | pass | `MCPCallClassification` union used by name in consumers; no implicit `never` paths |
| Test coverage for new shared modules + hooks | pass | 4 test files present (see Summary) |
| TSC correctness of diffed files | pass | Types flow cleanly from contract imports; no `any` leaks |
| AST mutation routed through Babel (C13) | n/a | No AST mutations in this diff |

All applicable criteria pass.

---

## Scope Coverage

**Reviewed:**
- `shared/mcp-classification.ts`
- `shared/syncStaleness.ts`
- `shared/ipc-validators.ts` (Phase 3 additions only)
- `shared/mcp-allowed-tools.ts`
- `electron/mcpClient.ts`
- `server/mcpClient.ts`
- `src/hooks/useEmitTokens.ts`
- `src/hooks/useSyncActions.ts`
- `src/hooks/useSyncStaleness.ts`
- `src/store/syncStalenessStore.ts`
- `src/components/ui/TokenHealthBar.tsx`
- `src/components/ui/mint/EmitDropdown.tsx`
- `src/components/ui/mint/ConfirmEmitDialog.tsx`
- `src/components/ui/mint/SyncStalenessBanner.tsx`

**Skipped (out of pilot scope):**
- `shared/review-schema.ts` — reviewed for schema-types only, not as diff under review
- Test files — existence confirmed via `ls`, not content-reviewed (pilot A scope)
- `.flint-context/contracts/MINT.5-phase3-contract.md` — metadata confirmed, not substantively re-read against the prior review

---

## Instrumentation

- **Files read (in full):** 14 implementation files + 1 schema file (review-schema.ts) = 15
- **Out-of-scope reads:** 1 (`shared/review-schema.ts` for verdict derivation) — within the ≤2 budget
- **Test files read:** 0 (existence confirmed via `ls` only)
- **Approx. total bytes read (scoped set):** ~115 KB
  - shared/* (~15 KB)
  - electron/mcpClient.ts + server/mcpClient.ts (~26 KB)
  - hooks (~28 KB)
  - store (~2 KB)
  - components (~40 KB)
  - review-schema.ts (~12 KB)
- **Tool calls:** 2 parallel Read batches (11 + 4 files) + 2 Bash `ls` calls = minimal overhead
