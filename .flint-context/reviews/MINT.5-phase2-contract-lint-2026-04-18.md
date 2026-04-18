# Contract Lint Report: MINT.5 Phase 2 — Sync Action Surfaces

**Linted:** 2026-04-18
**Contract artifact:** `.flint-context/contracts/MINT.5-phase2-contract.md`
**Executable contract:** `.flint-context/contracts/MINT.5-phase2.contract.ts`
**Schema version:** `shared/contract-schema.ts` (v2.1 — 12 checks)
**Phase 1 contract ref:** `.flint-context/contracts/MINT.5-phase1.contract.ts`

---

## Verdict: REVISE

Two blocking issues found. Phase 2 cannot start until both are resolved.

---

## Lint Check Results

| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | Compiles | PASS | Phase 2 `.contract.ts` has zero type errors in isolation. (Phase 1 contract has pre-existing v2.1 schema errors that are out of scope for this lint.) |
| 2 | Completeness | FAIL | `meta.status` is `'DRAFT'` — must be `'APPROVED'` before Phase 2 can begin. All other sections populated: 35 testBoundaries, 10 risks, 5 invariants, 15+ nonGoals. |
| 3 | Impact Map — MODIFY files exist | PASS | `src/components/ui/TokenHealthBar.tsx`, `TokenGrid.tsx`, `TokenManager.tsx` all confirmed on disk. |
| 4 | Impact Map — CREATE files absent | PASS | `src/components/ui/mint/` subdirectory does not exist. All 14 CREATE targets confirmed absent. |
| 5 | Impact Map — Owner agents | WARN | `flint-integration-validator` appears in Group C. This agent is not in the recognized Flint specialist list (`flint-electron-ipc`, `flint-state-architect`, `flint-design-engineer`, `flint-test-writer`, `flint-ast-surgeon`, `flint-mcp-specialist`, `flint-database`, `flint-accessibility`). Non-blocking — validators in Group C own no impact-map files (same pattern accepted in Phase 1 lint). |
| 6 | Impact Map — Orphaned files | PASS | Every agent in parallelism groups owns at least one impact-map file (Group C validator is exempt per Phase 1 precedent). |
| 7 | IPC Triangle Completeness | FAIL | `mcp:call-tool` declares `validator: 'mcpCallToolSchema'` but that named export does not exist in `shared/ipc-validators.ts`. Grepped entire project — `mcpCallToolSchema` appears only in the two contract files. The channel itself is real (`electron/preload.ts:798`) but has no Zod schema registered. This is a blocking gap per Check 4. |
| 8 | IPC Direction Consistency | PASS | `mcp:call-tool` is `renderer→main`, handler correctly located in `electron/main.ts` + `server/index.ts`. |
| 9 | No Duplicate IPC Channels | PASS | Only one channel entry; no duplicates. |
| 10 | Store Coherence | PASS | No new Zustand slices. `useSyncActions` is a hook. Hook calling `window.flintAPI` is the sanctioned pattern — not a store anti-pattern. |
| 11 | Test Boundary — Coverage | PASS | All new public APIs covered: `SyncActionCluster`, `useSyncActions` (5 actions + error + serialization), `TokenDriftRow`, `DriftGroupSection`, `TokenGrid` drift tab, `ConnectFigmaEmptyState`, `ConfirmPushDialog`, `ConfirmResolveDialog`. 35 testBoundaries total. |
| 12 | Test Boundary — Executable given/when/then | PASS | All 35 boundaries have non-empty `given`, `when`, and `then`. All `then` fields begin with an allowed imperative verb: `renders`, `calls`, `sets`, `blocks`, `returns`. No prose failures. |
| 13 | Test Boundary — Edge cases | PASS | Every boundary with a non-trivial API surface has at least one edge case. `SyncActionCluster` disconnected case, `useSyncActions.pullOne` scope-rejection case, and dialog escape paths all covered. |
| 14 | Commandments — Applicability | PASS | C1, C4, C5, C9, C12, C14 all directly applicable. C1: downstream MCP writes via FTM. C4: no external URLs. C5: ARIA on dialogs + disabled button labels. C9: `drift.deltaE` display. C12: MCP tool handlers already queue correctly. C14: zero `fs`/`git` in renderer. |
| 15 | Commandments — Missing | PASS | No IPC additions → C12+C14 already listed. No AST work → C1/C7/C13 not required. No export changes → C6 correctly absent. |
| 16 | Parallelism Safety — File Conflicts | PASS | Group A creates only net-new files. Group B modifies `TokenHealthBar.tsx`, `TokenGrid.tsx`, `TokenManager.tsx`. No Group A file appears in Group B's modify list. No conflicts. |
| 17 | Parallelism Safety — Dependency Order | PASS | Group B components depend on Group A primitives (`SyncActionCluster`, `TokenDriftRow`, `DriftGroupSection`, `ConnectFigmaEmptyState`, `useSyncActions`). Group A must complete first. Order is correct. |
| 18 | Test Writer Placement | PASS | `flint-test-writer` in Group A (scaffold `it.todo`) and Group C (fill assertions). Correct TDD red→green flow, matching Phase 1 pattern. |
| 19 | MD ↔ TS Consistency — IPC Channels | PASS | Both documents list the single `mcp:call-tool` channel with identical payload type, return type, handler, and validator name. |
| 20 | MD ↔ TS Consistency — Type Names | WARN | Markdown Type Contracts section (line 158) exports `ViewMode = 'grid' \| 'list' \| 'drift'`. The `.contract.ts` exports the same union as `Phase2ViewMode` (line 145). The names diverge. Phase 2 agents importing the contract will get `Phase2ViewMode` — which is the correct type — but the markdown suggests `ViewMode`. Agents will not be confused in practice since the import is explicit, but the contract documents are inconsistent. Non-blocking. |
| 21 | MD ↔ TS Consistency — Impact Map | PASS | Both documents enumerate the same 20 files with the same change types and owners. |
| 22 | MD ↔ TS Consistency — Commandments | PASS | Both list `[1, 4, 5, 9, 12, 14]`. |
| 23 | Falsifiable Invariants | PASS | All 5 invariants have comparison operators and units: `< 400ms`, `= 0 calls`, `< 120ms`, `= 0 calls`, `= 0 additional calls`. All `measuredBy` fields name specific verification mechanisms (vitest `performance.now()`, component test mock assertion). |
| 24 | Non-Goals | PASS | 15 explicit non-goals. Correctly names Phase 3 (emit dropdown), Phase 4 (TokenImpactAccordion, read-only banner, aria-live, ApprovalStagingArea collapse, density revamp). Does NOT accidentally defer anything Justin already approved in the Phase 2 scope. |
| 25 | Audience | PASS | `meta.audience: 'designer'` — correct. Phase 2 is pure Glass renderer work (src/ + React components). |
| 26 | Phase 1 Cross-Import | PASS | `.contract.ts` imports `TokenDrift` from `MINT.5-phase1.contract.js`. `TokenDrift` is the only Phase 1 type needed in Phase 2's type surface — `HealthGrade`, `HealthScoreInput`, and `TokenHealthData` are consumed by `useTokenHealth` (Phase 1 territory) and are not re-declared in Phase 2. No duplicate declarations. |
| 27 | Test file placement | WARN | `src/components/ui/__tests__/SyncActionCluster.test.tsx` is placed in the parent directory's test folder, but `SyncActionCluster.tsx` lives in `src/components/ui/mint/`. Parallel components in `mint/` have their tests in `src/components/ui/mint/__tests__/`. This is inconsistent. Non-blocking, but `flint-test-writer` should place it in `mint/__tests__/SyncActionCluster.test.tsx` to match the pattern used for the other 5 mint test files. |

---

## Blocking Issues

### BLOCKING-1 — `meta.status` is `'DRAFT'`, not `'APPROVED'`

**Location:** `.flint-context/contracts/MINT.5-phase2.contract.ts` line 263; markdown header line 4.

The contract schema (`FlintContract.meta.status`) requires `'APPROVED'` before Phase 1.5 grants the gate. The current value of `'DRAFT'` with the note "pending answers to Open Questions for Justin" indicates the architect held the status pending Justin's decision on the 5 open questions in the contract.

Justin has since approved all defaults (sub-tab option b for drift closure, bulk-first Resolve, Push confirm required, tone confirmed, toast+persistent badge error split). The open questions are answered. The architect must update `meta.status` from `'DRAFT'` to `'APPROVED'` in both the markdown header and the `.contract.ts` `CONTRACT` object.

**Fix:** Change `status: 'DRAFT'` to `status: 'APPROVED'` in `.contract.ts` line 263. Update the markdown header line 4 from `**Status:** DRAFT — pending answers to "Open Questions for Justin"` to `**Status:** APPROVED`.

---

### BLOCKING-2 — `validator: 'mcpCallToolSchema'` references a non-existent export

**Location:** `.flint-context/contracts/MINT.5-phase2.contract.ts` line 302; IPC Channel Contracts section of markdown.

The contract declares `validator: 'mcpCallToolSchema'` for the `mcp:call-tool` channel. The Phase 1.5 linter requires this named export to exist in `shared/ipc-validators.ts`. It does not. A full grep of the project confirms `mcpCallToolSchema` appears only in the two Phase 2 contract files — nowhere in the actual codebase.

The channel `mcp:call-tool` is real (`electron/preload.ts:798`: `ipcRenderer.invoke('mcp:call-tool', name, args)`) and is used by StatusBar, FigmaConnectionPanel, and others today. The gap is that it was added before the IPC validator requirement was tightened in v2.1.

Two acceptable fixes:

1. **Add the schema to `shared/ipc-validators.ts`** — add a `'mcp:call-tool'` entry with `payload: z.object({ tool: z.string(), args: z.unknown() })` and `response: z.unknown()` (MCP tool responses are structurally heterogeneous). Export `export const mcpCallToolSchema = ipcSchemas['mcp:call-tool'].payload`. This is the correct long-term fix and closes a real preload-bridge security gap.

2. **Acknowledge the gap in the contract** — if adding the schema is out of scope for Phase 2 (it probably should be a separate IPC hardening task), the contract may note `validator: null` and document in the IPC section that `mcp:call-tool` predates v2.1 validator requirements and a dedicated hardening task is filed. However, `validator: null` is only valid per the schema for payload-less `main→renderer` broadcasts — this is a `renderer→main` channel with a non-void payload, so `null` is not technically valid either.

**Recommended fix:** Add the Zod schema in `shared/ipc-validators.ts` as part of this contract's Group A (`flint-electron-ipc` is already listed as an owner for "IPC + Store" work in Group A). Update the `ipc-validators.ts` entry with the `mcpCallToolSchema` named export. This is the same pattern the Phase 1 contract used for `tokens:read-figma-drift`.

Note: The contract's text claims "already in `shared/ipc-validators.ts` with validator `mcpCallToolSchema`" — this claim is incorrect and must be corrected in the markdown IPC section along with the fix.

---

## Non-Blocking Observations

### W1 — `flint-integration-validator` is not a recognized Flint specialist agent

Group C lists `flint-integration-validator`. This agent type is not in the canonical list of Flint specialist agents defined in the contract schema spec. The Phase 1 lint accepted this pattern (validators are not file owners). Recommend renaming the group role to `flint-test-writer` (already present) for Phase 3 integration work, or document the agent's scope. Not blocking implementation.

### W2 — `ViewMode` / `Phase2ViewMode` naming divergence between MD and TS

The markdown Type Contracts section declares `export type ViewMode = 'grid' | 'list' | 'drift'`. The `.contract.ts` exports this as `Phase2ViewMode`. The name `Phase2ViewMode` is defensively correct (avoids stomping on any existing `ViewMode` in `TokenGrid.tsx`) but the two contract documents disagree on the name. Phase 2 agents should use `Phase2ViewMode` from the `.contract.ts` import and then alias or adapt to the local `ViewMode` type in `TokenGrid.tsx` during implementation.

### W3 — SyncActionCluster test file placed in wrong directory

`src/components/ui/__tests__/SyncActionCluster.test.tsx` should be `src/components/ui/mint/__tests__/SyncActionCluster.test.tsx` to match the colocation pattern used by all other 5 mint test files. The impact map and Group A assignment should be updated by the architect. This is a cosmetic inconsistency that will not break tests but will make the directory structure harder to navigate.

---

## Required Actions Before Phase 2

1. Set `meta.status: 'APPROVED'` in `.contract.ts` and update the markdown header. (BLOCKING-1)
2. Add `mcp:call-tool` Zod schema entry and `mcpCallToolSchema` named export to `shared/ipc-validators.ts`. Update contract IPC section to reflect the correct validator location. (BLOCKING-2)
3. Optionally: move `SyncActionCluster.test.tsx` impact entry to `src/components/ui/mint/__tests__/` in both `.contract.ts` and markdown. (W3 — recommended)

Both blockers are small edits — no architectural changes required. The underlying design is sound.

---

## What Phase 2 Agents Can Rely On (after blockers are fixed)

- Types in `.contract.ts` compile cleanly in isolation with zero errors.
- `TokenDrift` is correctly imported from `MINT.5-phase1.contract.ts` — no duplicate Phase 1 types.
- All 3 MODIFY files exist on disk. All 14 CREATE files are confirmed absent.
- No file conflicts exist between Group A and Group B parallel agents.
- All 35 testBoundaries have executable `given/when/then` with allowed imperative verbs.
- All 5 invariants have falsifiable thresholds with comparison operators and units.
- 15 explicit non-goals correctly scope out Phase 3 and Phase 4 work.
- Disabled-state matrix for `SyncActionCluster` is fully specified (disconnected / no-drift / no-local-edits / no-conflicts / in-flight).
- Confirm dialog asymmetry (Push confirms, Pull fires immediately) is specified and has test coverage.
- Error surfacing split (transient toast vs. persistent SeverityChip for auth-expired) is specified with `SyncActionError.persistent` flag in the type contract.
- Web parity for `mcp:call-tool` is inherited from existing `server/index.ts` wiring — no new parity work required.

---

## Re-lint 2026-04-18

### Verdict: APPROVED

### BLOCKING-1 resolved

`meta.status` is `'APPROVED'` in both `.flint-context/contracts/MINT.5-phase2.contract.ts` (line 261) and the markdown header (line 4). Confirmed by direct file read.

### BLOCKING-2 resolved

`shared/ipc-validators.ts` now contains:

- A `'mcp:call-tool'` entry in `ipcSchemas` at line 261 (payload: `z.tuple([z.string().min(1), z.record(z.unknown())])`, response: `z.unknown()`).
- A named export `mcpCallToolSchema` at line 294 pointing to `ipcSchemas['mcp:call-tool'].payload`.
- The contract's `validator: 'mcpCallToolSchema'` at line 301 resolves to this export.

TSC exits with 0 errors across the full project.

### Non-blocking warnings (carry-forward for implementation agents)

| # | Warning | For agent |
| --- | --- | --- |
| W1 | `flint-integration-validator` is not a recognized Flint specialist agent — Group C role name is unconventional | Address during Phase 3 planning; does not affect Phase 2 |
| W2 | Markdown declares `ViewMode`; `.contract.ts` exports `Phase2ViewMode` — naming diverges between documents | `flint-design-engineer` and `flint-test-writer` must import `Phase2ViewMode` from the `.contract.ts`; do not invent a separate `ViewMode` type |
| W3 | `SyncActionCluster.test.tsx` is scoped to `src/components/ui/__tests__/` in the impact map but should live at `src/components/ui/mint/__tests__/SyncActionCluster.test.tsx` to match the colocation pattern of the other 5 mint test files | `flint-test-writer` should create the file at the correct path; Group A impact-map entry is cosmetically wrong but does not block implementation |

All 12 checks pass. Phase 2 may begin.
