# Contract Lint Report: MINT.5 Phase 1 — Mint Surface Foundation

**Linted:** 2026-04-17
**Contract artifact:** `.flint-context/contracts/MINT.5-phase1-contract.md`
**Executable contract:** `.flint-context/contracts/MINT.5-phase1.contract.ts`
**Schema version:** `shared/contract-schema.ts`

---

## Verdict: APPROVED (with 3 Warnings)

No blocking issues found. Three non-blocking observations are documented below that
Phase 2 agents must read before they begin.

---

## Lint Check Results

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Compiles | PASS | `npx tsc --noEmit` exits 0 with no errors |
| 2 | Completeness | PASS | All required sections populated; 36 testBoundaries; 10 risks; 3 parallelism groups |
| 3 | Impact Map — MODIFY files exist | PASS | All 26 MODIFY targets verified on disk |
| 4 | Impact Map — CREATE files absent | PASS | `shared/tokenValueSanitizer.ts`, `shared/tokenPath.ts`, `flint-mcp/src/core/emitters/escape.ts`, `src/hooks/useTokenHealth.ts`, `src/components/ui/governance/SeverityChip.tsx` do not yet exist |
| 5 | Impact Map — Owner agents | PASS | All owners are valid Flint specialist agents |
| 6 | Impact Map — Orphaned agent | PASS | `flint-integration-validator` appears in Group C and owns no impact-map file — this is correct; validators are not file owners |
| 7 | IPC Triangle Completeness | PASS | All 5 channels have channel name + payload type + return type + handler location |
| 8 | IPC Direction Consistency | PASS | `governance:on-token-approved` is `main→renderer` with no handler; broadcast pattern specified correctly via `broadcastTokenApproved` helper |
| 9 | No Duplicate IPC Channels | PASS | No two entries share a channel name |
| 10 | Store Coherence | PASS | No new stores introduced; `useTokenHealth` correctly identified as a hook, not a store |
| 11 | Test Boundary Coverage | PASS | 36 testBoundaries covering all 5 new public APIs: `sanitizeTokenValue`, `validateTokenPath`, `validateProjectRoot`, emitter escape helpers, `tokens:read-figma-drift`, `governance:on-token-approved`, `useTokenHealth`, `SeverityChip`, `ApprovalStagingArea` push-channel |
| 12 | Edge Cases Per Boundary | PASS | Every boundary has at least one edge case; fuzz harness specified with 60 values |
| 13 | Commandment Applicability | PASS | C1, C4, C5, C9, C12, C13, C14 all directly apply to Phase 1 work; no inapplicable commandments listed |
| 14 | Missing Commandments | PASS | No IPC change without C12+C14 (both listed); no visual change without C5 (listed); no AST mutation (none in scope) |
| 15 | Parallelism Safety — File Conflicts | PASS | Group A agents create net-new files only; no Group A file appears in Group B's modify list |
| 16 | Parallelism Safety — Dependency Order | PASS | Group B consumers import from Group A artifacts; Group C tests depend on Group B output |
| 17 | Test Writer Placement | PASS | `flint-test-writer` in Group A (scaffolds with `it.todo`) and Group C (fills assertions); correct TDD red→green flow |
| 18 | Sanitizer API Fidelity | PASS | `SanitizeTokenValueResult` correctly extends the `reasonSanitizer` pattern; adds `rejected` + `rejectionReason` fields that `SanitizeReasonResult` does not have; `sanitizeTokenDescription` reuses `SanitizeReasonResult` exactly — faithful mirror |
| 19 | 5 Sanitizer Ingress Points | WARN | See Warning W1 below |
| 20 | Per-Emitter Escape Coverage | PASS | All 5 emitter targets (CSS, Tailwind, Swift, Kotlin, RN) have escape helpers specified; all 5 emitter files exist on disk |
| 21 | `validateProjectRoot` correctness | PASS | `validateProjectRoot(raw, homeDir)` is new; it correctly does NOT reuse `validateFilePath`'s extension-allowlist check (directories have no extension); home-scope invariant is preserved; the `selfHostCheck` is intentionally omitted for MCP (documented in R9) |
| 22 | Drift IPC Root-Cause | PASS | `useTokenUsage.ts:84` comment confirms the `.json` extension guard in `file:read` as the exact root cause; contract's diagnosis matches; dedicated `tokens:read-figma-drift` IPC is the correct fix |
| 23 | Web Parity | PASS | Every new IPC channel and every modified handler has an explicit `server/index.ts` pair in the impact map; `src/adapters/web-api.ts` and `onTokenApproved` web WS event also specified |
| 24 | Health Score Reuse | PASS | `useTokenHealth` explicitly calls `computeHealthScore` from `shared/healthScore.ts`; `TokenHealthData.input: HealthScoreInput` is the imported type; no new formula invented |
| 25 | SeverityChip Cross-Tab Use | PASS | Non-blocking: contract correctly scopes Counsel refactor out of Phase 1 (non-goals list); `ViolationCard.tsx` modification is "survey only" — no test regressions expected |
| 26 | MD ↔ TS Consistency — IPC Channels | PASS | Both documents list identical 5 channels with identical type names |
| 27 | MD ↔ TS Consistency — Impact Map | WARN | See Warning W2 below |
| 28 | MD ↔ TS Consistency — Types | PASS | All type names in markdown match the `.contract.ts` exports exactly |
| 29 | MD ↔ TS Consistency — Commandments | PASS | Both documents list [1, 4, 5, 9, 12, 13, 14] |
| 30 | `tokens:update` Zod schema divergence | WARN | See Warning W3 below |
| 31 | `ApprovalStagingArea.emitsIPC` annotation | PASS (note) | The component entry marks `emitsIPC: ['governance:on-token-approved']` — strictly it SUBSCRIBES to this channel rather than emitting it. This is a schema limitation (no `subscribesIPC` field). Phase 2 agents should read the summary field for the correct semantics |

---

## Blocking Issues

None. Phase 2 may begin.

---

## Non-Blocking Observations (Phase 2 must read)

### W1 — Ingress Point Count: "6" in summary vs. 8 in body

The contract summary states "Apply at 6 token write ingress points." The actual impact map and wire-up table enumerate 8 distinct sanitization call sites:

1. `electron/main.ts` — `tokens:create`
2. `electron/main.ts` — `tokens:update`
3. `server/index.ts` — `tokens:create`
4. `server/index.ts` — `tokens:update`
5. `electron/ingestion-server.ts` — `batchUpsertTokens`
6. `flint-mcp extractTokens.ts` — `handleApproveTokens` merge loop
7. `flint-mcp tokenSyncEngine.ts` — `executePull`
8. `flint-mcp tokenFileIO.ts` — `writeFile`

The "6" in the summary appears to count Electron + Web + MCP as three platforms with two paths each, collapsing 3+4 and 7+8. The body is the authoritative specification; ignore the "6." Phase 2 agents implement all 8 call sites enumerated in the impact map and wire-up table.

### W2 — Markdown impact table references `flint-mcp/src/tools/approveTokens.ts`; file does not exist; `.contract.ts` correctly omits it

The markdown impact table (section 1.1, line 75) lists:

```
| `flint-mcp/src/tools/approveTokens.ts` (wherever `projectRoot` lands — if structurally separate from `extractTokens.ts`) | MODIFY | flint-ast-surgeon | Same `validateProjectRoot` gate. |
```

Confirmed: `approveTokens.ts` does not exist as a separate file. The `flint_approve_tokens` handler (`handleApproveTokens`) lives inside `flint-mcp/src/tools/extractTokens.ts` alongside `flint_extract_tokens`. The `.contract.ts` impact array correctly omits this phantom row and folds the work into the `extractTokens.ts` MODIFY entry.

**Phase 2 action:** `flint-ast-surgeon` applies `validateProjectRoot` inside `extractTokens.ts:handleApproveTokens` — not in a separate file. No new file is created. The markdown summary count of "4 MCP tools" for `projectRoot` validation is also slightly off: the work touches 3 tool files (`extractTokens.ts`, `emitTokens.ts`, `mapTokens.ts`) not 4. `tokenSyncEngine.ts` and `tokenFileIO.ts` also call `validateProjectRoot` on paths, but those are not "tools" in the MCP tool-registration sense.

### W3 — Pre-existing `ipc-validators.ts` schema for `tokens:update` does not match actual handler signature

The existing `shared/ipc-validators.ts` schema for `tokens:update` reads:

```ts
payload: z.object({ id: z.number().int().positive(), token_value: z.string(), description: z.string().optional() })
response: z.object({ success: z.boolean() })
```

But the actual `electron/main.ts` and `server/index.ts` handlers use a variadic two-argument form: `(tokenPath: string, updates: { token_type?, token_value?, description? })` with a `{ changes: number }` response. The Zod schema and the live handler are already out of sync before Phase 1 touches anything.

The contract correctly documents the live handler signature in the TypeScript types (`TokensUpdatePayload`, `TokensUpdateResponse`) but does not flag this pre-existing schema mismatch as a Phase 1 fix.

**Phase 2 action:** When `flint-electron-ipc` adds the `tokens:read-figma-drift` Zod schema to `ipc-validators.ts`, they should also fix the pre-existing `tokens:update` schema to match the live variadic handler, or leave a prominent comment explaining the mismatch. Silently adding the new schema next to the broken one accumulates debt. This is not a Phase 1 contract blocker — but leaving it unaddressed means the `validateIPC` helper is silent-no-op for `tokens:update` in production today.

---

## Architect's 5 Open Questions — Linter's Read

The contract states these "do not block Phase 1." That claim is correct for all five. But two of them have implications for the contract's own test-boundary assertions that Phase 2 agents may stumble on if left ambiguous.

**Q1 — Sanitizer strictness (sanitize vs. reject).** Non-blocking. The contract defaults to sanitize-first with a fail-closed config flag, matching CHRON.1 precedent. Phase 2 implements that default; the flag is a no-op if Justin does not set it. No test boundary depends on the answer — the fuzz harness only tests that breakout sequences do not survive, not whether the rejection gate is enforced vs. sanitized. Recommend confirming so the config flag is named and documented consistently, but do not hold Phase 2 for it.

**Q2 — Length caps (4096 chars for description vs. 1000 for value).** Non-blocking. The `.contract.ts` already hard-codes `TOKEN_VALUE_MAX_LENGTH = 1000` and `TOKEN_DESCRIPTION_MAX_LENGTH = 4096`. Phase 2 agents implement exactly those numbers. If Justin changes them, the constants are the single source of truth and the fuzz harness will catch the mismatch. No Phase 2 decision needed.

**Q3 — Drift IPC data source (Option A vs. B).** Non-blocking. Option A (main-process server-side diff returning `TokenDrift[]`) is specified in the contract and is the correct call — it eliminates the state loop, keeps all `.flint/*.json` parsing in one place, and makes web parity automatic. Phase 2 implements Option A. Justin does not need to answer before work begins.

**Q4 — Push-channel scope (emit from both `tokens:approve-token` IPC and MCP `flint_approve_tokens`).** Non-blocking. The contract specifies "emit from BOTH paths." This is the right call; the test boundary explicitly covers both. Phase 2 implements both. No decision needed.

**Q5 — `SeverityChip` severity vocabulary (`critical | amber | advisory`).** Mildly load-bearing. The `.contract.ts` hard-codes `ChipSeverity = 'critical' | 'amber' | 'advisory'`. This is what `ViolationCard.tsx` uses internally (confirmed: `LinterWarning['severity']` maps to `critical | amber | advisory`). Phase 2 must match this exactly. If Justin wants different labels the contract needs to be revised before implementation. Recommend confirming before Phase 2 Group A begins writing `SeverityChip.tsx`, since the enum drives the Tailwind classes and a11y labels. This is the one open question that, if answered incorrectly, would require a component rewrite.

---

## What Phase 2 Agents Can Rely On

- Types in `.flint-context/contracts/MINT.5-phase1.contract.ts` compile and are complete.
- IPC triangles are fully specified for all 5 channels (new and modified).
- No file conflicts exist between Group A and Group B parallel agents.
- All 36 testBoundaries map to files in the impact map.
- `shared/healthScore.ts:computeHealthScore` is the correct function to call; `HealthGrade` and `HealthScoreInput` are the correct import targets.
- `shared/reasonSanitizer.ts:SanitizeReasonResult` is the correct shape for `sanitizeTokenDescription` return — do not invent a new type.
- `flint-mcp/src/tools/approveTokens.ts` does NOT exist. `handleApproveTokens` is inside `extractTokens.ts`. Implement there.
- `ViolationCard.tsx` is survey-only in Phase 1. Do not refactor Counsel severity chips.
- Pre-existing `ipc-validators.ts` schema for `tokens:update` is already wrong. Do not trust it for new development; fix it when adding `tokens:read-figma-drift`.
