# Contract Lint Report: Phase 0 — Coverage Honesty

**Date:** 2026-04-18
**Linter:** flint-contract-linter (Phase 1.5)
**Contract:** `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts`
**Prose artifact:** `.flint-context/contracts/PHASE0-coverage-honesty-contract.md`

## Verdict: REVISE

| Check | Result | Issues |
|-------|--------|--------|
| 1. Compiles | PASS | `npx tsc --noEmit` exits 0; `ts.transpileModule` reports 0 diagnostics |
| 2. Completeness | PASS | All required sections populated; 5 non-goals, 5 invariants, 17 test boundaries |
| 3. Impact Map Integrity | PASS | CREATE files absent on disk; MODIFY files present; all 6 owners are known agents |
| 4. IPC Triangle Completeness | FAIL | `getCoverageSummaryPayloadSchema` named as validator but NOT exported from `shared/ipc-validators.ts`; `flint:audit-complete` broadcast consumed by hook but absent from `ipc[]` |
| 5. Store Coherence | PASS | No store slice declared; architectural decision correctly documented |
| 6. Test Boundaries | PASS | All 17 boundaries have non-empty given/when/then; every `then` opens with a verb from the allowed set |
| 7. Commandments | FAIL | C2 (No Hallucinated Styling) applicable but omitted — CoverageBadge uses raw Tailwind utilities not tied to design tokens; C5 (Accessibility) applicable but omitted — CoverageBadge is an interactive component with aria-label |
| 8. Parallelism Safety | FAIL | `flint-test-writer` owns 5 files in the impact map (3 targeting Group A modules: classifier test, debtReport test, IPC test) but is listed only in `parallelismGroups.B`. Scaffolds for MCP engine tests have no scheduled execution phase. |
| 9. MD ↔ TS Consistency | FAIL | Markdown Group A explicitly includes `flint-test-writer`; `parallelismGroups.A` in the `.contract.ts` omits it. The machine-readable contract is the binding document — it governs Phase 2 agent spawning. |
| 10. Falsifiable Invariants | PASS | All 5 invariants contain comparison operators with units; thresholds are specific and measurable |
| 11. Non-Goals | PASS | 5 entries; all are scoped and specific |
| 12. Audience | PASS | `meta.audience = 'engine'`; justification is present and defensible for an observability-only StatusBar mount |

---

## Issues (REVISE Required)

### BLOCKING

**[BLOCKING-1] IPC validator not yet exported — Check 4**

The contract declares `validator: 'getCoverageSummaryPayloadSchema'` for the `flint:getCoverageSummary` channel. Grepping `shared/ipc-validators.ts` finds no such export. The contract linter requires the named export to exist before Phase 2 begins (per v2.1 hardening). Phase 2's `flint-electron-ipc` agent cannot link the preload bridge to a schema that does not exist.

Fix: Either (a) add `getCoverageSummaryPayloadSchema` to `shared/ipc-validators.ts` before Phase 2 spawns — which means the Zod schema ships as part of the contract artifacts, not as Phase 2 work — or (b) move the IPC validator authorship explicitly into Group A of the impact map and ensure `flint-electron-ipc` writes it as the first deliverable in `shared/ipc-validators.ts`. The current impact map entry for `shared/ipc-validators.ts` says "Add Zod schemas" but that is Phase 2 work. The linter must be able to grep the validator at lint time. Resolution: expand the prose artifact's IPC channel table to explicitly note that the validator schema is a pre-Phase-2 deliverable (commit it now as part of the contract commit).

---

**[BLOCKING-2] `flint:audit-complete` broadcast channel undeclared — Check 4**

`useCoverageSummary.ts` summary in the impact map explicitly states the hook "polls on mount + after `flint:audit-complete` main→renderer broadcast." This channel does not exist anywhere in `electron/main.ts`, `electron/preload.ts`, or `server/index.ts` (confirmed by grep). It is not declared in the contract's `ipc[]` array. Without it, the hook refreshes only on mount — the badge will display stale coverage data after every subsequent audit run until the user reloads Glass.

Two acceptable fixes:
- Option A: Declare `flint:audit-complete` as a `main→renderer` broadcast in `ipc[]`, add its emission to `electron/main.ts` (after debt-report service completes), add its listener to `electron/preload.ts` and `server/index.ts`, and assign ownership to `flint-electron-ipc` in the impact map. Since the payload is void, `validator: null` is appropriate per schema.
- Option B: Remove the broadcast dependency from the hook description. Change the refresh strategy to a polling interval (e.g., every 30s) or to a subscription to the existing `mcp-event` channel that already fires after MCP tool completions. Document the chosen mechanism explicitly so Phase 2 implements exactly what the contract says.

Either way the hook description and the `ipc[]` array must agree.

---

**[BLOCKING-3] `flint-test-writer` omitted from `parallelismGroups.A` — Checks 8 and 9**

The markdown contract's Group A bullet list includes `flint-test-writer → Generates it.todo() scaffolds for every testBoundary`. The `.contract.ts` `parallelismGroups.A` array is `['flint-state-architect', 'flint-electron-ipc', 'flint-ast-surgeon', 'flint-mcp-specialist']` — `flint-test-writer` is absent.

Three of the five `flint-test-writer` impact entries target modules delivered in Group A:
- `flint-mcp/src/core/__tests__/coverageClassifier.test.ts` — depends on Group A's classifier
- `flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts` — depends on Group A's debt service
- `electron/__tests__/coverageIpc.test.ts` — depends on Group A's IPC handler

If `flint-test-writer` is only spawned in Group B, these three test files have no scaffolding phase and the TDD red-phase intent of the contract is lost. Additionally, the markdown and TypeScript disagree — a Check 9 violation.

Fix: Add `'flint-test-writer'` to `parallelismGroups.A` in the `.contract.ts`. The design-engineer-dependent tests (`CoverageBadge.test.tsx`, `CoveragePopover.test.tsx`) remain Group B scaffolds.

---

### WARNINGS (do not block but architect should address)

**[WARNING-W1] C2 (No Hallucinated Styling) omitted — Check 7**

`CoverageBadge`'s test boundaries assert `class bg-emerald-500` and `class bg-amber-500`. These are raw Tailwind color utilities, not design tokens. Commandment 2 requires every visual edit to be tied to a `design_token`. The architect listed C2 as "not applicable — no mutations, Phase 0 is read-only," which conflates mutation-only scope with styling scope. Creating a new component with hardcoded color classes is a visual edit regardless of whether it mutates existing files.

Recommended fix: List C2, then either (a) bind the dot color to design tokens from `tokenStore` (e.g., `var(--color-success-500)` / `var(--color-warning-500)`) or (b) explicitly justify in the commandments section why `bg-emerald-500`/`bg-amber-500` are acceptable as Tailwind semantic utilities rather than brand tokens. The justification needs to be in the contract, not left implicit.

**[WARNING-W2] C5 (Accessibility is a Compiler Error) omitted — Check 7**

`CoverageBadge` is an interactive element (`onClick`) that the test boundary verifies has an `aria-label`. Commandment 5 applies to export-affecting changes and to any new interactive component. Listing C5 with a brief rationale ("aria-label declared; no Warden violations expected") is sufficient — its omission just means Phase 3 has no baseline to check against.

**[WARNING-W3] Risk entry references wrong commandment — Check 7 (minor)**

The "Web build drift" risk entry in `risks[]` declares `commandment: 9`. Commandment 9 is CIEDE2000 perceptual color distance — it has no bearing on web-parity enforcement. There is no specific commandment for web parity; the field should be omitted rather than misfiled. This is a minor documentation error that could confuse Phase 3 validation.

---

## Probes (architect-specific concerns)

### Probe 1: Classifier-runs-once invariant

There is no standalone invariant for "classifier runs at most once per file per audit." The runtime-performance risk is documented in the risk register ("Classifier doubled the MithrilLinter runtime by re-parsing") with a prose mitigation. The mitigation is architecturally sound (AST passed from caller, verdict cached and shared with A11yLinter), but it is not falsifiable — no test boundary verifies the call count. The `A11yLinter.auditStructured — coverage passthrough` test boundary does assert `calls classifier 0 times when caller supplies verdict`, which partially covers this. However, a strict "single-parse" invariant would close the loop. This is a warning-level gap, not blocking.

### Probe 2: Coverage-grade-independence invariant

The `coverage-grade-independence` invariant is correctly shaped: threshold `= 0`, measuredBy is a fixture parity test. The `then` verb of the corresponding test boundary is `returns` (not present — there is no test boundary for this invariant directly, the invariant is verified by the debt-report aggregation test). No issue found.

### Probe 3: CoverageReason enum wire-format stability

The enum's append-only constraint is noted in the risk register with an appropriate severity and mitigation. It is NOT in `invariants[]` and it is not falsifiable as written (no threshold, no comparison operator). However, it does not belong in `invariants[]` — it is a design constraint, not a measurable threshold. Its placement in `risks[]` is correct. The mitigation (append-only, default branch in callers) is sufficient for Phase 0. No issue found.

### Probe 4: `useCoverageSummary` as hook (not store slice)

The architectural decision is defensible and correctly documented. The impact map does not list any new Zustand store. `useCoverageSummary.ts` is owned by `flint-state-architect` and filed under `src/hooks/`, not `src/store/`. The contract correctly reflects the anti-pattern guidance: no `window.flintAPI` calls inside stores. No issue — this is well-reasoned.

### Probe 5: Web parity

The mirroring intent is stated in the impact map (same file, same owner), in the risk register, and in the IPC channel table note. The impact map assigns both `electron/main.ts` and `server/index.ts` to `flint-electron-ipc` for this change, preventing drift. Phase 3 is instructed to diff the two. The mechanism is sound; the only gap is the undeclared `flint:audit-complete` broadcast (BLOCKING-2 above), which would also need a `server/index.ts` WebSocket emission if Option A is chosen.

---

## What Phase 2 Agents Can Rely On (once BLOCKING issues are resolved)

- Types in `.contract.ts` compile and are correct; they are the authoritative source for all 10 exported shapes
- IPC triangle for `flint:getCoverageSummary` is fully specified pending validator creation
- No file conflicts exist between Group A parallel agents
- 17 test boundaries cover every new public API with executable given/when/then
- 5 falsifiable invariants are measurable and have named verification mechanisms
- `useCoverageSummary` is correctly scoped as a hook; no Zustand store anti-pattern to guard against
- `CoverageReason` enum stability is documented as a risk with a concrete append-only mitigation

---

## Required Fixes Before Phase 2

1. Add `getCoverageSummaryPayloadSchema` (and its response counterpart) to `shared/ipc-validators.ts` as part of the contract commit — not deferred to Phase 2.
2. Either declare `flint:audit-complete` in `ipc[]` with handler/owner assignments (Option A) or change the hook's refresh description to remove the dependency on that channel (Option B).
3. Add `'flint-test-writer'` to `parallelismGroups.A` in the `.contract.ts` file.
4. Update the markdown Group A / Group B table to exactly match the `.contract.ts` parallelismGroups object.

Fix warnings at architect's discretion; they do not gate Phase 2.

---

## Pass 2 — 2026-04-18

**Linter:** flint-contract-linter (Phase 1.5, second pass)
**Trigger:** Architect revised contract in response to Pass 1 REVISE verdict.

### Verdict: APPROVED

| Check | Result | Notes |
| ----- | ------ | ----- |
| 1. Compiles | PASS | `npx tsc --skipLibCheck --noEmit` exits 0 on both `.contract.ts` and `shared/ipc-validators.ts`. No contract-level errors. (Node-module locale errors are pre-existing and unrelated.) |
| 2. Completeness | PASS | All required sections populated: 18 test boundaries, 5 invariants, 5 non-goals, parallelismGroups with 2 groups, `meta.audience = 'engine'`, `meta.status = 'APPROVED'`, ISO date `2026-04-18`. |
| 3. Impact Map Integrity | PASS | All 11 MODIFY-tagged files confirmed on disk. All 8 CREATE-tagged files confirmed absent. All 6 owner agents are known Flint specialists. No orphaned agents. |
| 4. IPC Triangle Completeness | PASS | One channel only: `flint:getCoverageSummary` (renderer→main). All four legs specified. `getCoverageSummaryPayloadSchema` confirmed exported from `shared/ipc-validators.ts` at line 209. `getCoverageSummaryResponseSchema` also exported at line 212. No `flint:audit-complete` reference remains anywhere in either artifact. |
| 5. Store Coherence | PASS | No store slices declared. Architectural rationale documented in contract. |
| 6. Test Boundaries | PASS | 18 boundaries, all with non-empty given/when/then. New a11y boundary (`then: 'sets aria-label to ...'`) opens with `sets` — allowed verb. Rewritten badge boundaries (`then: 'renders element with data-coverage-state=...'`) open with `renders` — allowed verb. given/when/then field count: 57 total (19 each × 3) confirming each of 18 boundaries plus the IPC boundary all carry all three fields. |
| 7. Commandments | PASS | C2, C4, C5, C13, C14 listed. C2 justified: dot color sourced from existing StatusBar semantic-color map, not raw utilities. C5 justified: `aria-label` declared with an explicit test boundary. Non-applicable commandments (C1, C6, C12, C15, C16) called out and justified. |
| 8. Parallelism Safety | PASS | Group A: no file conflicts between any two agents (verified programmatically). Group B correctly follows Group A. `flint-design-engineer` (UI) is Group B, after Group A's classifier + IPC + store implementations. |
| 9. MD ↔ TS Consistency | PASS | Markdown Group A lists all 5 agents: `flint-state-architect`, `flint-electron-ipc`, `flint-ast-surgeon`, `flint-mcp-specialist`, `flint-test-writer`. TypeScript `parallelismGroups.A` is the same 5 agents. 1 IPC channel in both. Same 5 commandments (2, 4, 5, 13, 14). Same type names (`CoverageSummary`, `CoverageBadgeProps`, `CoveragePopoverProps`). No divergence detected. |
| 10. Falsifiable Invariants | PASS | 5 invariants. All thresholds contain comparison operators with units: `= 1.0`, `< 0.5 percentage points`, `= 0 across 100 inputs`, `< 50ms at p95`, `= 0 (exact match)`. All `measuredBy` fields name specific mechanisms (integration test, table-driven test, property-based test, RTL + performance.now, fixture parity test). |
| 11. Non-Goals | PASS | 5 entries, all specific and scope-bounding. |
| 12. Audience | PASS | `'engine'` — single valid value. Dual-audience justification provided and defensible. |

### Previous Blockers — Confirmed Resolved

**BLOCKING-1 (Zod validator export):** `getCoverageSummaryPayloadSchema` and `getCoverageSummaryResponseSchema` are exported from `shared/ipc-validators.ts` at lines 209 and 212. The `flint:getCoverageSummary` entry in `ipcSchemas` is present at line 178. The named export matches exactly what the contract's `validator` field declares.

**BLOCKING-2 (undeclared broadcast channel):** The `flint:audit-complete` channel is entirely absent from both artifacts. `useCoverageSummary.ts` impact summary now reads: "on every `mcp-event` push message with `eventType === 'debt-scan-complete'` (existing channel — no new IPC surface)." The existing `mcp-event` push infrastructure is confirmed in `electron/preload.ts` at lines 789–814. No new IPC declaration needed. The `ipc[]` array has exactly one entry.

**BLOCKING-3 (`flint-test-writer` in Group A):** `parallelismGroups.A` in the `.contract.ts` is `['flint-state-architect', 'flint-electron-ipc', 'flint-ast-surgeon', 'flint-mcp-specialist', 'flint-test-writer']`. Markdown Group A bullet list at line 161 includes `flint-test-writer → Generates it.todo() scaffolds for every testBoundary`. Both artifacts agree.

### Previous Warnings — Confirmed Addressed

- **W1 (C2):** `commandments` array now includes `2`. Rationale present in contract: dot color from existing StatusBar semantic-color map. Test boundaries assert `data-coverage-state` attribute, not raw Tailwind color classes.
- **W2 (C5):** `commandments` array now includes `5`. Rationale present. New test boundary at position 17 (0-indexed 16): "CoverageBadge — accessible name" — `then` opens with `sets`, boundary is executable.
- **W3 (commandment: 9 on web-drift risk):** The `commandment` field is absent from the web-drift risk entry. Only one `commandment` field remains in `risks[]`, on the classifier-false-positives entry referencing C13 — correct and applicable.

### What Phase 2 Agents Can Rely On

- All types in `.contract.ts` compile and are complete. Import from the contract file; do not re-declare.
- `getCoverageSummaryPayloadSchema` and `getCoverageSummaryResponseSchema` are live in `shared/ipc-validators.ts` — use them in preload bridge wiring immediately.
- `mcp-event` with `eventType === "debt-scan-complete"` is the documented refresh trigger for `useCoverageSummary` — do not introduce a new broadcast channel.
- No file conflicts exist between any Group A agents.
- 18 test boundaries provide executable given/when/then scaffolds for `flint-test-writer`'s `it.todo()` phase.
- `CoverageBadge` must render a `data-coverage-state` attribute (`"healthy"` / `"warning"` / `"idle"`), not raw Tailwind color classes — test assertions are written against this attribute.
- `CoverageBadge` must carry an `aria-label` matching `"Governance coverage: N% of files governed. Click to see breakdown."` with a `"Governance coverage: loading"` fallback when `summary` is null.
