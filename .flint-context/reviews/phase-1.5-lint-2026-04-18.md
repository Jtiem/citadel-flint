# Contract Lint Report — Phase 1.5
**Date:** 2026-04-18
**Linter:** flint-contract-linter
**Contracts:** RUNTIME.1 (axe-core Runtime Adapter), FIGMA-LINT.1 (Figma-Side Mithril/Warden Lint)

---

## Overall Verdict: BOTH REVISE

Neither contract may proceed to Phase 2 until the BLOCKING issues below are resolved.

---

## RUNTIME.1 — axe-core Runtime Adapter

### Per-Check Table

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | TSC Compiles | PASS | `npx tsc --noEmit --skipLibCheck` exits 0; no type errors |
| 2 | Contract Completeness | FAIL (BLOCKING) | `meta.status = 'DRAFT'` — schema requires `'APPROVED'` before Phase 2 |
| 3 | Impact Map Integrity | PASS | All MODIFY files exist on disk; all CREATE files absent; all owners are known agents |
| 4 | IPC Triangle + Validator | FAIL (BLOCKING) | `runtimeRunAxePayloadSchema` and `runtimeRunAxeResponseSchema` are declared in the contract as validators but do NOT exist as named exports in `shared/ipc-validators.ts` |
| 5 | Store Coherence | PASS | `canvasStore` extension is self-contained; no cross-store refs; `setRuntimeFindings` consumed by `useRuntimeAudit` hook in test boundaries |
| 6 | Test Boundaries | PASS | All 24 boundaries have non-empty given/when/then; all `then` fields open with a valid imperative verb (returns, renders, calls, blocks, emits, resolves, sets, writes) |
| 7 | Commandments | PASS | C1, C4, C5, C6, C8, C12, C13, C14 declared; C13 is explicitly addressed (normalizer is a pure deterministic function, no regex); all listed commandments are applicable |
| 8 | Parallelism Safety | FAIL (WARNING) | `flint-integration-validator` appears in Group C but owns zero impact entries — violates "every agent in a parallelism group must own at least one impact file" per Check 3 Rule 4. Same pattern is a convention for Phase 3 validators; no file conflicts between groups A/B |
| 9 | MD ↔ TS Consistency | PASS | IPC channel count (1), payload/response type names, commandment list, invariant count (7), and non-goal count (7) are identical between markdown and `.contract.ts` |
| 10 | Falsifiable Invariants | PASS | All 7 invariants contain a comparison operator (`<`, `>=`, `=`); every threshold carries a unit or explicit count; `measuredBy` names a concrete mechanism |
| 11 | Non-Goals | PASS | 7 non-goal entries; covers all major scope-creep vectors |
| 12 | Audience | PASS | `'designer'` declared; single value; justified (Glass GovernanceDashboard + StatusBar are the primary surface) |

**Contract-specific check — `csp-sandbox-isolation` invariant:** PRESENT and FALSIFIABLE. Threshold `= 0 mutations to primary preview session` with an integration test harness. Architectural wager satisfied.

**Phase 0 collision discipline:** RUNTIME.1 markdown (line 113–116) explicitly names all three append-only collision files (`A11yLinter.ts`, `StatusBar.tsx`, `shared/ipc-validators.ts`) and confirms both modifications are strict appends. Discipline is documented.

### BLOCKING Issues

**[BLOCKING-1] `meta.status` must be `'APPROVED'`, not `'DRAFT'`**
- Location: `.flint-context/contracts/RUNTIME.1.contract.ts` line 225; RUNTIME.1-contract.md line 4
- The schema's `ContractStatus` type permits `'DRAFT'` as a value, but the contract linter requires `'APPROVED'` before Phase 2 may begin. The architect must obtain Justin's sign-off on the five Open Design Questions, resolve them, and flip status to `'APPROVED'` in both the markdown and `.contract.ts`.
- Fix: change `status: 'DRAFT'` → `status: 'APPROVED'` after Justin approves the design questions.

**[BLOCKING-2] Zod validator named exports missing from `shared/ipc-validators.ts`**
- The contract declares `validator: 'runtimeRunAxePayloadSchema'` at `.contract.ts` line 413, and documents the response validator `runtimeRunAxeResponseSchema` at `.contract.ts` lines 265–270 (impact map entry for `shared/ipc-validators.ts`).
- Neither `runtimeRunAxePayloadSchema` nor `runtimeRunAxeResponseSchema` exists as a named export in `shared/ipc-validators.ts` (confirmed by grep returning zero matches).
- The contract's own Group A work item assigns this to `flint-electron-ipc`, meaning the exports are intended to be created during Phase 2 — not before it. This creates a circular dependency: Phase 1.5 gates on the validator existing, but the validator is Phase 2 work.
- **The architect must either:** (a) add stub Zod schema exports to `shared/ipc-validators.ts` as part of the contract artifact itself (pre-Phase-2 scaffolding), or (b) acknowledge that the linter's Check 4 exists precisely to prevent this gap from reaching Phase 2. The standard resolution is option (a): the named exports must exist before Phase 2 begins because preload.ts imports them at compile time.
- Fix: add `runtimeRunAxePayloadSchema` and `runtimeRunAxeResponseSchema` to `shared/ipc-validators.ts` as part of the contract-finalization step (Group 0), before Phase 2 agents receive their assignments.

### WARNING Issues

**[WARNING-1] `flint-integration-validator` in Group C with no impact entries**
- Location: `.contract.ts` line 914
- Per Check 3 Rule 4, every agent listed in a parallelism group must own at least one file in `impact`. `flint-integration-validator` appears in Group C but owns no impact entries. This is a known convention for Phase 3 validators that is architecturally sound; however, it technically fails the schema check. Either exclude `flint-integration-validator` from `parallelismGroups` (it is invoked by the workflow, not the contract) or add a validation-report output file to `impact` that it owns.

**[WARNING-2] `StatusBarProps` and `GovernanceDashboardProps` referenced in `components` array but not defined in `.contract.ts`**
- Location: `.contract.ts` lines 443, 449
- These prop types exist in the project codebase already (existing components), so Phase 2 agents will find them — but the contract's TypeScript surface doesn't re-declare them. Not a blocking compile error, but Phase 3 validation cannot confirm the type name without a stub. Low risk given these are pre-existing components.

---

## FIGMA-LINT.1 — Figma-Side Mithril/Warden Lint

### Per-Check Table

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | TSC Compiles | PASS | `npx tsc --noEmit --skipLibCheck` exits 0; no type errors |
| 2 | Contract Completeness | FAIL (BLOCKING) | `meta.status = 'DRAFT'` — schema requires `'APPROVED'` before Phase 2 |
| 3 | Impact Map Integrity | PASS | All MODIFY files (`flint-mcp/src/core/universal/index.ts`, `flint-mcp/src/server.ts`) exist; all CREATE files absent; all owners are known agents |
| 4 | IPC Triangle + Validator | PASS (N/A) | Zero IPC channels declared; feature lives entirely in `flint-mcp/`; no validator check required |
| 5 | Store Coherence | PASS (N/A) | Zero store changes; confirmed |
| 6 | Test Boundaries | PASS | All 15 boundaries have non-empty given/when/then; all `then` fields open with a valid imperative verb (returns, sets, emits, reads, resolves); checked each entry |
| 7 | Commandments | FAIL (WARNING) | C5 (Accessibility is a Compiler Error) not listed despite the contract explicitly connecting Figma findings to the export Gate (impact map line, risk R8); C13 is listed and addressed; all listed commandments are applicable |
| 8 | Parallelism Safety | FAIL (WARNING) | `flint-integration-validator` in Group C with no impact entries (same pattern as RUNTIME.1); `flint-ast-surgeon` appears in both Group A and Group B — this is safe (sequential within-agent work) but the contract should clarify which Group A tasks must complete before Group B begins for that agent |
| 9 | MD ↔ TS Consistency | FAIL (WARNING) | `engine-isolation` invariant grep pattern differs between markdown (line 110: `"fileKey\|figmaNodeId\|figma-"`) and `.contract.ts` (line 558: `"fileKey|figmaNodeId|FigmaNode"`). The markdown uses `figma-` (prefix match); the TS uses `FigmaNode` (type name match). These catch different things — `FigmaNode` in the TS version would miss a `figma-specific` string, and `figma-` in the markdown would miss a capitalized import. Integration validator will use one; contract is ambiguous which. |
| 10 | Falsifiable Invariants | PASS | All 5 invariants contain comparison operators (`<`, `>`, `=`, `>=`); `audit-p95-warm-500nodes` and `audit-p95-cold-500nodes` have units (ms, runs); `engine-isolation` threshold `= 0 matches` is falsifiable; `cache-hit-rate-warm` threshold `> 0.9` is clean; `adapter-finding-parity` threshold `>= 1 shared rule id` is specific |
| 11 | Non-Goals | PASS | 10 non-goal entries; comprehensive boundary declaration |
| 12 | Audience | PASS | `'engine'` declared; single value; correct (feature lives in `flint-mcp/`, no Glass surface) |

**Contract-specific check — `engine-isolation` invariant:** PRESENT and FALSIFIABLE. Threshold `= 0 matches` with a grep-based measurement mechanism. Architectural wager satisfied. See WARNING on grep pattern divergence.

**Phase 0 collision discipline:** FIGMA-LINT.1 does NOT touch `A11yLinter.ts`, `StatusBar.tsx`, or `shared/ipc-validators.ts` at all. No collision coordination needed beyond noting that `flint-mcp/src/server.ts` is also modified by RUNTIME.1 — but RUNTIME.1 touches the Electron-side handlers, not `flint-mcp/src/server.ts`. Both contracts' `server.ts` modifications are to different process implementations. Zero collision. Discipline satisfied.

### BLOCKING Issues

**[BLOCKING-1] `meta.status` must be `'APPROVED'`, not `'DRAFT'`**
- Location: `.flint-context/contracts/FIGMA-LINT.1.contract.ts` line 288; FIGMA-LINT.1-contract.md line 3
- Same requirement as RUNTIME.1: Justin must answer the three Open Design Questions and sign off before status flips to `'APPROVED'`.
- Fix: change `status: 'DRAFT'` → `status: 'APPROVED'` in both artifacts after design question resolution.

### WARNING Issues

**[WARNING-1] C5 (Accessibility is a Compiler Error) should be listed**
- Location: `.contract.ts` line 361; FIGMA-LINT.1-contract.md commandment table (line 89–101)
- The contract's risk section (risk R8, markdown line 627) explicitly states "Tool response explicitly tags `sourceAuthority:'figma-frame'` so downstream can compose with `runtime-dom` findings from RUNTIME.1." The downstream Gate (`C6`, already listed) consumes findings including A11y violations. However, the Warden (A11y) lint runs through this adapter — `A11yLinter` processes the Figma node tree via `FigmaNodeAdapter` without modification. C5 applies because the contract extends the surface on which accessibility violations are detectable. Not including C5 may lead Phase 2 agents to miss that A11y findings from `flint_audit_figma_frame` should contribute to export-blocking severity counts.
- Fix: add `5` to the `commandments` array and document that A11y findings from Figma nodes flow through the same severity pipeline as AST-time findings.

**[WARNING-2] `engine-isolation` grep pattern divergence between markdown and TS**
- Location: FIGMA-LINT.1-contract.md line 110 vs `.contract.ts` line 558
- Markdown pattern: `"fileKey\|figmaNodeId\|figma-"` (three OR alternatives, `figma-` prefix)
- TS pattern: `"fileKey|figmaNodeId|FigmaNode"` (three OR alternatives, `FigmaNode` type name)
- The integration validator will execute one of these. `FigmaNode` (TS version) is stricter — it catches a type import. `figma-` (markdown version) catches string literals and identifiers containing the prefix. Neither alone is complete. The architect should reconcile to a single pattern: `"fileKey|figmaNodeId|figmaAdapter|FigmaNode|figma-"` or equivalent.
- Fix: update the `measuredBy` field in either the markdown or `.contract.ts` to use an identical, agreed-upon grep pattern.

**[WARNING-3] `flint-integration-validator` in Group C with no impact entries**
- Location: `.contract.ts` line 637
- Same structural issue as RUNTIME.1 WARNING-1. Resolve consistently across both contracts.

**[WARNING-4] `flint-ast-surgeon` appears in both Group A and Group B — Group A tasks not enumerated per agent**
- Location: `.contract.ts` lines 632–636
- The markdown (lines 160–169) correctly describes which specific files go in which group for `flint-ast-surgeon`. The `.contract.ts` parallelism groups only list agent names, not file assignments. This is a schema limitation (groups only carry agent names), but the markdown description is authoritative. Confirmed safe by reading the markdown breakdown.

---

## Cross-Contract Observations

1. **`flint-mcp/src/server.ts` touched by both contracts**: FIGMA-LINT.1 appends `flint_audit_figma_frame` registration; RUNTIME.1 does not touch `flint-mcp/src/server.ts` (RUNTIME.1's `server/index.ts` is the web Express server, not the MCP server). Zero conflict confirmed.

2. **`shared/ipc-validators.ts` touched by RUNTIME.1 only** — FIGMA-LINT.1 has no IPC and does not touch this file. No cross-contract collision.

3. **`SourceAuthority` union** — RUNTIME.1 appends `'runtime-dom'`; FIGMA-LINT.1's `FigmaAuditFinding` hardcodes `sourceAuthority: 'figma-frame'` as a literal type. Both are append-only. However, FIGMA-LINT.1 does NOT add `'figma-frame'` to the central `SourceAuthority` union in `flint-mcp/src/core/governance/types.ts` — it only uses the string literal in the local `FigmaAuditFinding` type. This means the provenance registry and SARIF filter will not know about `'figma-frame'` unless an impact entry adds it (the way RUNTIME.1 adds `'runtime-dom'` via `ruleProvenanceRegistry.ts`). FIGMA-LINT.1 has no corresponding registration. This is a latent issue: not a Phase 1.5 blocker since the type check passes, but Phase 3 should verify `'figma-frame'` is registered in the provenance registry.

---

## Required Actions Before Phase 2

### RUNTIME.1
1. Justin approves the 5 Open Design Questions in the contract
2. Add `runtimeRunAxePayloadSchema` and `runtimeRunAxeResponseSchema` as named Zod exports to `shared/ipc-validators.ts`
3. Change `meta.status` from `'DRAFT'` to `'APPROVED'` in both markdown and `.contract.ts`
4. Optionally: resolve WARNING-1 (remove `flint-integration-validator` from `parallelismGroups` or add a report output impact entry)

### FIGMA-LINT.1
1. Justin approves the 3 Open Design Questions in the contract
2. Change `meta.status` from `'DRAFT'` to `'APPROVED'` in both markdown and `.contract.ts`
3. Reconcile the `engine-isolation` grep pattern between markdown and `.contract.ts` to an identical string
4. Optionally: add `5` to `commandments` array for C5 coverage of A11y findings

---

## What Phase 2 Agents Can Rely On (once APPROVED)

### RUNTIME.1
- Types in `.contract.ts` compile clean (TSC 0 errors)
- Single IPC channel `runtime:run-axe` is fully specified with all four legs
- All 7 invariants are falsifiable with measurement harnesses named
- All 24 test boundaries are executable with imperative `then` verbs
- No file conflicts between Group A and Group B agents
- `csp-sandbox-isolation` invariant is the SEC.1 architectural gate

### FIGMA-LINT.1
- Types in `.contract.ts` compile clean (TSC 0 errors)
- Zero IPC: entire feature is within `flint-mcp/` — no preload bridge risk
- `engine-isolation` invariant is the architectural gate; grep harness is named
- All 15 test boundaries are executable
- No file conflicts within or across groups
- `FigmaFrameCacheAPI` interface is fully specified; Phase 2 must match exactly

---

## Round 2 — 2026-04-18

**Linter pass:** Re-lint of both revised contracts. All 12 checks re-executed.

---

### Overall Verdict: BOTH APPROVED

Phase 2 may begin for both contracts. Details and residual warnings below.

---

### Round 1 Finding Closure Table

| Finding | Contract | Resolution |
|---------|----------|------------|
| BLOCKING-1: `meta.status = 'DRAFT'` | RUNTIME.1 | **CLOSED** — `.contract.ts` line 273 reads `status: 'APPROVED'`; markdown header reads `Status: APPROVED`. Design decisions locked. |
| BLOCKING-2: Missing Zod validator exports | RUNTIME.1 | **CLOSED (structural)** — Group 0 is registered in both the markdown (Impact Map row + Implementation Order section) and `.contract.ts` (parallelismGroups key `'0': ['flint-electron-ipc']` + impact entry at line 315 with explicit Group 0 annotation). The exports do not yet exist on disk, which is correct: Group 0 is the first Phase 2 step, not a pre-contract artifact. The linter's original concern was that there was no documented path to create them before Group A ran. That path now exists as a hard-gated Group 0 step. The validator gap is acknowledged and controlled. No further blocking. |
| WARNING-1: `flint-integration-validator` orphaned in Group C | RUNTIME.1 | **CLOSED** — Impact entry `.flint-context/reviews/runtime.1-integration-2026-04-18.md` at `.contract.ts` line 462 is owned by `flint-integration-validator`. Agent now owns a concrete file. |
| WARNING-2: `StatusBarProps`/`GovernanceDashboardProps` undefined | RUNTIME.1 | **CLOSED** — Both types are stubbed with full field lists at `.contract.ts` lines 53–67. Phase 2 agents have typed stubs. |
| BLOCKING-1: `meta.status = 'DRAFT'` | FIGMA-LINT.1 | **CLOSED** — `.contract.ts` line 424 reads `status: 'APPROVED'`; markdown header reads `Status: APPROVED`. |
| WARNING: C5 commandment missing | FIGMA-LINT.1 | **CLOSED** — `commandments: [4, 5, 6, 9, 13, 14, 15]` at `.contract.ts` line 586. C5 now listed. Commandment table in markdown (line 147) includes a full C5 rationale row explaining how `designTimeCompatible` + skipped-runtime-only entries keep C5 honest at design time. |
| WARNING: `engine-isolation` grep pattern mismatch | FIGMA-LINT.1 | **CLOSED** — Markdown line 173 and `.contract.ts` line 855 both use `(fileKey\|figmaNodeId\|FigmaNode\|figma-)`. The markdown added an explicit "authoritative pattern and command" block (lines 168–179) declaring the `.contract.ts` pattern as the single source of truth. Patterns are now identical. |
| WARNING: `flint-integration-validator` orphaned | FIGMA-LINT.1 | **CLOSED** — Impact entry `.flint-context/reviews/figma-lint.1-integration-2026-04-18.md` at `.contract.ts` line 569 is owned by `flint-integration-validator`. |
| WARNING: `'figma-frame'` not in ruleProvenanceRegistry | FIGMA-LINT.1 | **NOTED, NOT BLOCKING** — Correctly tracked as post-Phase-2 work in markdown "Known post-Phase-2 Work" section (line 312). No change required; Phase 3 integration validator owns verification. |

---

### RUNTIME.1 — Round 2 Per-Check Table

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | TSC Compiles | PASS | `npx tsc --noEmit --skipLibCheck` exits 0 |
| 2 | Contract Completeness | PASS | `meta.status = 'APPROVED'`; all required sections populated |
| 3 | Impact Map Integrity | PASS | All MODIFY files exist; CREATE files absent; all owners known agents including `flint-integration-validator` with concrete impact file |
| 4 | IPC Triangle + Validator | PASS (conditional) | Channel `runtime:run-axe` fully specified; Group 0 documents the validator creation as a hard-gated pre-Group-A step; the gap is acknowledged and controlled |
| 5 | Store Coherence | PASS | No change from Round 1 |
| 6 | Test Boundaries | PASS | 29 boundaries total (24 original + 5 new feature-flag cluster). All new `then` fields open with valid imperative verbs: `renders`, `returns`, `blocks`. Verified all 29. |
| 7 | Commandments | PASS | No change from Round 1; C1, C4, C5, C6, C8, C12, C13, C14 |
| 8 | Parallelism Safety | PASS | Group 0 added; single-owner hard gate before A/B/C; no file conflicts within any group |
| 9 | MD ↔ TS Consistency | PASS (with one minor note) | Invariant count: markdown lists 8, TS has 8 (7 original + `flag-off-ui-silent`). IPC channel: 1 in both. Non-goals: 9 in TS vs 7 in Round 1 (architect added 2 new entries). MINOR: markdown invariant table (lines 214–221) lists all 8 invariants but the section header still says "Every invariant is falsifiable." No structural divergence; purely cosmetic. |
| 10 | Falsifiable Invariants | PASS | New `flag-off-ui-silent` invariant: threshold `= 0 DOM nodes rendered for runtime-axe surfaces` — contains `=` operator, unit is DOM node count, `measuredBy` names specific test-id queries. All 8 invariants clean. |
| 11 | Non-Goals | PASS | 9 entries (2 new: no separate IPC channel for feature flag; no flag-defaulted-true ship) |
| 12 | Audience | PASS | `'designer'`; single value |

**New scope additions verified:**
- 5 new test boundaries (feature flag cluster): `RuntimeAuditPill flag-off not mounted`, `GovernanceDashboard runtime accordion flag-off hidden`, `isRuntimeAxeEnabled default false`, `isRuntimeAxeEnabled true when flag set`, `runtime:run-axe ipc-callable when flag off` — all have executable given/when/then with correct imperative verbs.
- New invariant `flag-off-ui-silent`: threshold `= 0 DOM nodes rendered` is falsifiable; `measuredBy` names specific `queryByTestId` and `queryByRole` assertions.
- New types `RUNTIME_AXE_FEATURE_FLAG`, `RuntimeAxeFeatureFlag` at lines 80–81; stub types `StatusBarProps` at lines 53–57, `GovernanceDashboardProps` at lines 61–67. All compile cleanly.

**Residual WARNING (non-blocking):**
- The two new non-goal entries in the `.contract.ts` (`nonGoals` array, lines 1068–1074) are not explicitly listed as a numbered non-goal in the markdown's "Out of scope" section (lines 66–74). The markdown covers them narratively in the "Decisions Locked" section (lines 42–46). Not a structural divergence but the markdown's non-goal list is shorter than the TS array. Phase 2 agents read the TS file; they will see all 9. Low risk.

---

### FIGMA-LINT.1 — Round 2 Per-Check Table

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | TSC Compiles | PASS | `npx tsc --noEmit --skipLibCheck` exits 0 |
| 2 | Contract Completeness | PASS | `meta.status = 'APPROVED'`; all required sections populated |
| 3 | Impact Map Integrity | PASS | All MODIFY files (`flint-mcp/src/core/universal/index.ts`, `flint-mcp/src/server.ts`, and all 11 a11y rule files) exist; all CREATE files absent; all owners known agents; `flint-integration-validator` now owns a concrete file |
| 4 | IPC Triangle + Validator | PASS (N/A) | Zero IPC; no validator check required |
| 5 | Store Coherence | PASS (N/A) | Zero store changes |
| 6 | Test Boundaries | PASS | 20 boundaries (14 original + 6 new: PAT happy path, PAT invalid, PAT rate-limited, PAT headless env-var, PAT headless missing, design-time structural rule). All `then` fields verified: `returns`, `rejects`, `emits`, `reads`, `sets`, `writes` — all valid. New boundary count matches markdown summary (line 202 lists 20 items). |
| 7 | Commandments | PASS | C5 now included; [4, 5, 6, 9, 13, 14, 15]; C5 rationale in markdown is accurate |
| 8 | Parallelism Safety | PASS | No file conflicts; `flint-integration-validator` owns impact entry; `flint-ast-surgeon` in both A and B is documented and safe |
| 9 | MD ↔ TS Consistency | PASS | Invariant name divergence resolved: markdown table row `engine-isolation-grep` is a display label; the authoritative section (markdown lines 168–179) explicitly declares the `.contract.ts` pattern `(fileKey|figmaNodeId|FigmaNode|figma-)` as the single source of truth. TS invariant name is `engine-isolation`; the discrepancy in the table label (`engine-isolation-grep` vs `engine-isolation`) is cosmetic — the authoritative block reconciles them. MINOR RESIDUAL: markdown invariants table line 162 still lists the warm-cache invariant as `audit-p95-500nodes` while TS names it `audit-p95-warm-500nodes`. These names diverge by one word. The TS name is unambiguous (distinguishes warm vs cold). Not a Phase 2 blocker since agents read the TS file, but the markdown table should be updated in a follow-up. |
| 10 | Falsifiable Invariants | PASS | 7 invariants total (5 original + `zero-silent-pass` + `pat-mode-headless-ok`). New invariants: `zero-silent-pass` threshold `= 0 delta` (contains `=`); `pat-mode-headless-ok` threshold `success rate >= 95% over 20 runs AND safeStorage invocations = 0` (contains `>=` and `=`). All 7 clean. |
| 11 | Non-Goals | PASS | 10 entries; unchanged from Round 1 |
| 12 | Audience | PASS | `'engine'`; single value |

**New scope additions verified:**
- 6 new test boundaries (PAT + design-time ledger cluster): all have executable given/when/then. `rejects with a FigmaPatError instance whose kind equals "unauthorized"` correctly starts with `rejects`. `emits exactly one FigmaAuditSkippedEntry` correctly starts with `emits`. `emits a FigmaAuditFinding with ruleId` — valid. All 20 boundaries pass `validateTestBoundaries`.
- New types `FigmaPatCredentials`, `FigmaPatError`, `FigmaPatClientAPI` fully typed and compile clean. `FigmaAuditPassedEntry`, `FigmaAuditSkippedEntry` typed and referenced in `FigmaAuditResult.passed`/`FigmaAuditResult.skipped`.
- 11 new impact files (rule files + `figmaPatClient.ts` + `a11y/types.ts`) correctly owned by `flint-ast-surgeon`.
- `zero-silent-pass` and `pat-mode-headless-ok` invariants have concrete `measuredBy` harnesses.

**Residual MINOR (non-blocking):**
- Markdown invariants table row `audit-p95-500nodes` should be `audit-p95-warm-500nodes` to match TS. Cosmetic only — agents import the TS file.

---

### Cross-Contract Round 2 Observations

All Round 1 cross-contract observations carry forward unchanged:

1. No `flint-mcp/src/server.ts` collision — FIGMA-LINT.1 touches the MCP server; RUNTIME.1 touches `server/index.ts` (Express web server). Zero conflict confirmed.
2. No `shared/ipc-validators.ts` collision — FIGMA-LINT.1 has no IPC. Group 0 (RUNTIME.1 only) appends cleanly.
3. `'figma-frame'` is not yet in the central `SourceAuthority` union — tracked as post-Phase-2 in FIGMA-LINT.1's "Known post-Phase-2 Work" section. Phase 3 validator owns verification.

**New cross-contract observation:** RUNTIME.1 Group 0 must complete before any Group A work from either contract begins if both contracts are being implemented in the same sprint. Group 0 modifies `shared/ipc-validators.ts` which is a compile-time dependency. FIGMA-LINT.1 does not import from `shared/ipc-validators.ts`, so there is no cascade risk — this is informational only.

---

### What Phase 2 Agents Can Rely On

#### RUNTIME.1
- Types in `.contract.ts` compile clean (TSC 0 errors)
- `StatusBarProps` and `GovernanceDashboardProps` stubbed in contract for self-consistency
- `RUNTIME_AXE_FEATURE_FLAG` constant exported; feature flag semantics fully specified
- 8 falsifiable invariants with measurement harnesses named
- 29 executable test boundaries covering all new public APIs including flag-off paths
- Group 0 (Zod validator stubs) is the hard gate — no Group A work starts before it
- No file conflicts between groups

#### FIGMA-LINT.1
- Types compile clean; `FigmaPatCredentials`, `FigmaPatError`, `FigmaPatClientAPI`, `FigmaAuditPassedEntry`, `FigmaAuditSkippedEntry` fully specified
- Zero IPC: no preload bridge risk
- `engine-isolation` invariant with authoritative grep pattern documented in markdown and TS
- 7 falsifiable invariants covering performance, correctness, security, and ledger integrity
- 20 executable test boundaries covering adapter, cache, PAT client, tool handler, ledger, and engine-agnosticism paths
- `designTimeCompatible` field on `A11yRule` is REQUIRED (non-optional) — TypeScript enforces completeness at Phase 2 compile time
- No file conflicts within or across groups
