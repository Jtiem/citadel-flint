# Contract: Phase 0 — Coverage Honesty

**Phase:** PHASE0 (first of 3 sequential phases closing Flint's coverage gap)
**Status:** APPROVED (pending Phase 1.5 contract-linter verdict)
**Owner:** flint-architect
**Date:** 2026-04-18
**Executable contract:** `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts`
**Audience (Feature Budget Framework):** engine (primary) — a thin Glass read-surface is added but carries no actions

---

## Goal (verbatim)

**Make Flint honest about what it governs vs. what it silently skipped.** Every audit operation emits a per-file `CoverageVerdict` with a structured reason code. The governed-surface-area % is surfaced in the debt report, the `flint://dashboard` resource, and the Glass StatusBar. Users can drill in to see which files were skipped and why.

---

## Feature Budget Framework — 6 Gates

1. **Who is this for?** Engine (both audiences). The classifier, linter wiring, debt-report extension, and MCP resources are the primary surface. The Glass StatusBar badge is a thin informational render of engine output — it owns no behavior of its own. Per the dual-audience rule, this remains an `engine` feature; if the popover ever gains actions (filter, mute, annotate), split it.
2. **Behavior enabled:** "Users and agents can now see which files Flint is actually governing vs. silently skipped, which they could not see before."
3. **80% vs 5%:** 80%. Every audit result today is misleading without this. Foundational for Phases 1–5.
4. **Maintenance cost:** Medium. New types, one new IPC triangle (with web-parity leg), one new classifier, two linter integrations, one debt-report aggregator, one new component + popover.
5. **Validatable without building?** No. The coverage signal is itself the validation mechanism for the Phase 1–5 roadmap. This must exist before downstream phases can measure their own impact on the governed-surface %.
6. **What stops?** Nothing — Phase 0 unblocks Phases 1–5 and doesn't deprioritize any in-flight work.

---

## Scope summary

**IN:** Classifier + two linter integrations + debt-report aggregation + dashboard/context resources + IPC channel (+ web parity) + StatusBar badge + popover. Tests for every new public API.

**OUT:** Any actual parsing of unsupported file types, any new governance rules, any violation emission, any grade-formula change, any export-gate wiring, any ledger backfill.

---

## Impact Map

| File | Change | Owner |
|------|--------|-------|
| `shared/coverage-types.ts` | **CREATE** — `CoverageReason`, `CoverageVerdict`, `CoverageSummary`, `SkippedFilesByReason` | `flint-state-architect` |
| `shared/ipc-validators.ts` | **MODIFY** — Add `getCoverageSummaryPayloadSchema` + response schema | `flint-electron-ipc` |
| `flint-mcp/src/core/coverageClassifier.ts` | **CREATE** — Pure classifier function | `flint-ast-surgeon` |
| `flint-mcp/src/core/__tests__/coverageClassifier.test.ts` | **CREATE** — One test per `CoverageReason` + invariant test | `flint-test-writer` |
| `flint-mcp/src/core/MithrilLinter.ts` | **MODIFY** — Invoke classifier once per file, attach verdict | `flint-ast-surgeon` |
| `flint-mcp/src/core/A11yLinter.ts` | **MODIFY** — Accept pre-computed verdict from caller | `flint-ast-surgeon` |
| `flint-mcp/src/core/dashboard/debtReportService.ts` | **MODIFY** — Aggregate verdicts into `CoverageSummary` | `flint-mcp-specialist` |
| `flint-mcp/src/core/dashboard/types.ts` | **MODIFY** — Extend `DebtReport` and `DashboardData` additively | `flint-mcp-specialist` |
| `flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts` | **CREATE** — Integration aggregation test | `flint-test-writer` |
| `flint-mcp/src/server.ts` | **MODIFY** — Include `coverage` in `flint://dashboard`, `flint://session-context`, and `flint_get_context` | `flint-mcp-specialist` |
| `electron/main.ts` | **MODIFY** — Register `flint:getCoverageSummary` handler | `flint-electron-ipc` |
| `electron/preload.ts` | **MODIFY** — Expose `coverage.getSummary()` on `window.flintAPI` | `flint-electron-ipc` |
| `server/index.ts` | **MODIFY** — Mirror handler for web build parity | `flint-electron-ipc` |
| `src/adapters/web-api.ts` | **MODIFY** — Mirror `coverage.getSummary()` in browser adapter | `flint-electron-ipc` |
| `src/types/flint-api.d.ts` | **MODIFY** — Extend `FlintAPI` type | `flint-electron-ipc` |
| `src/components/editor/CoverageBadge.tsx` | **CREATE** — Dot + "X% governed" | `flint-design-engineer` |
| `src/components/editor/CoveragePopover.tsx` | **CREATE** — Breakdown-by-reason panel | `flint-design-engineer` |
| `src/components/editor/StatusBar.tsx` | **MODIFY** — Mount `<CoverageBadge />` | `flint-design-engineer` |
| `src/hooks/useCoverageSummary.ts` | **CREATE** — Fetch on mount + refresh on existing `mcp-event` push with `eventType === "debt-scan-complete"` (no new IPC channel) | `flint-state-architect` |
| `src/components/editor/__tests__/CoverageBadge.test.tsx` | **CREATE** | `flint-test-writer` |
| `src/components/editor/__tests__/CoveragePopover.test.tsx` | **CREATE** | `flint-test-writer` |
| `electron/__tests__/coverageIpc.test.ts` | **CREATE** — Round-trip test | `flint-test-writer` |

---

## Type Contracts (binding — see `.contract.ts`)

All TypeScript interfaces live in `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts`. Phase 2 agents import from there; they do NOT redeclare the types. Key exports:

- `CoverageReason` — stable enum of 8 values; order and values are wire-format stable.
- `CoverageVerdict` — `{ status, reason, details? }`; invariant: `parsed ⇔ reason === null`.
- `SkippedFilesByReason` — `Record<CoverageReason, number>` with all keys present.
- `CoverageSummary` — aggregate returned by debt report, dashboard, session-context, and IPC.
- `CoverageInput` — input to the classifier (path, source, ast, optional import graph, optional `tailwindConfigUnparsed` flag).
- `LinterResultWithCoverage` — additive interface layered onto both linter outputs.
- `DebtReportCoverageExtension`, `DashboardCoverageExtension`, `SessionContextCoverageExtension` — additive extensions.
- `GetCoverageSummaryPayload`, `GetCoverageSummaryResponse` — IPC shapes.
- `CoverageBadgeProps`, `CoveragePopoverProps` — component props.

After Phase 2 completes, `shared/coverage-types.ts` becomes the canonical source of truth and Phase 3 verifies the contract types were imported (not duplicated) across all impacted files.

---

## IPC Channels

| Channel | Direction | Payload | Return | Handler | Zod Validator |
|---------|-----------|---------|--------|---------|---------------|
| `flint:getCoverageSummary` | renderer→main | `undefined` | `CoverageSummary` | `electron/main.ts` | `getCoverageSummaryPayloadSchema` (in `shared/ipc-validators.ts`) |

Web-parity mirror: `GET /api/coverage/summary` in `server/index.ts`, same Zod schema, same response shape.

---

## Store Contracts

**None.** Coverage is derived, not owned. The `useCoverageSummary` hook reads the summary directly from IPC; no Zustand store is added. This matches the architectural anti-pattern guidance: no `window.flintAPI` calls inside Zustand stores, and no state that is already owned by the MCP engine should be mirrored into a Zustand store.

---

## Component Contracts

| Component | Props | Consumes Store | Emits IPC |
|-----------|-------|---------------|-----------|
| `CoverageBadge` | `CoverageBadgeProps` | — | `flint:getCoverageSummary` (via hook) |
| `CoveragePopover` | `CoveragePopoverProps` | — | — |

---

## Commandment Checklist

- [x] **C2 No Hallucinated Styling** — `CoverageBadge` dot color (healthy/warning/idle) MUST come from the existing StatusBar semantic-color map (the same token source used by `SyncStatus` and `figmaDotColor`). No raw `bg-emerald-500` / `bg-amber-500` literals. Component renders a `data-coverage-state` attribute; the token-backed class map lives alongside the existing StatusBar helpers.
- [x] **C4 Local-First Only** — classifier is pure, no network, no external resources; badge and popover are fully offline.
- [x] **C5 Accessibility is a Compiler Error** — `CoverageBadge` is an interactive button. It MUST carry an `aria-label` that conveys the governed percentage and hints at the popover (e.g., `"Governance coverage: 60% of files governed. Click to see breakdown."`). Covered by an explicit test boundary ("CoverageBadge — accessible name").
- [x] **C13 Deterministic Surgery** — classifier uses Babel AST traversal. No regex against source code.
- [x] **C14 Bypass Prohibition** — no new `fs` imports in `src/`. All reads route through the IPC handler that already owns the DebtReportService.

Other commandments considered and not applicable:

- C1 Code is Truth: no mutations; Phase 0 is read-only.
- C6 Gatekeeper Rule: coverage explicitly does NOT block export (non-goal #3).
- C12 Atomic Queuing: no file writes.
- C15 Granular AST Tools Only: no AI orchestration.
- C16 In-Memory Validation: no AI output.

---

## Test Boundaries

Full set of 18 boundaries in `.contract.ts` under `testBoundaries`. Summary:

- 9 classifier unit tests — one per `CoverageReason` + one happy-path + one parsed/reason invariant.
- 2 linter-integration tests — MithrilLinter attaches verdict, A11yLinter accepts pre-computed verdict without re-classifying.
- 1 debt-report aggregation test — 3 parsed + 1 partial + 1 skipped → governedSurfacePercent ≈ 60%.
- 1 IPC round-trip test — renderer → main → response matches Zod schema.
- 4 CoverageBadge tests — 100%, <100%, click latency, accessible name (aria-label).
- 1 CoveragePopover test — renders exactly N rows for non-zero reasons.

Every boundary has executable given/when/then with an imperative `then` verb (returns/renders/calls/sets/emits).

---

## Invariants (falsifiable, measurable)

| Name | Measurable | Threshold | Measured by |
|------|------------|-----------|-------------|
| `coverage-emit-parity` | CoverageVerdicts emitted / files scanned | `= 1.0` across any debt-report run | Instrumented integration test |
| `coverage-percent-math` | Absolute error between reported % and `(parsedFiles/totalFiles)*100` | `< 0.5` percentage points | Table-driven test over 20 fixtures |
| `reason-completeness` | Non-parsed verdicts with `reason === null` | `= 0` across 100 random classifier inputs | Property-based test |
| `coverage-badge-click-latency` | Mousedown → onClick firing | `< 50ms` at p95 (100-click bench) | React Testing Library + performance.now |
| `coverage-grade-independence` | `DebtReport.healthScore` delta with/without classifier on identical fixture | `= 0` (grade formula must not read coverage) | Fixture parity test |

---

## Implementation Order (Parallelism Groups)

- **Group A (parallel):**
  - `flint-state-architect` → `shared/coverage-types.ts`, `src/hooks/useCoverageSummary.ts`
  - `flint-electron-ipc` → `shared/ipc-validators.ts`, `electron/main.ts`, `electron/preload.ts`, `server/index.ts`, `src/adapters/web-api.ts`, `src/types/flint-api.d.ts`
  - `flint-ast-surgeon` → `flint-mcp/src/core/coverageClassifier.ts`, `MithrilLinter.ts`, `A11yLinter.ts`
  - `flint-mcp-specialist` → `debtReportService.ts`, `dashboard/types.ts`, `server.ts` (resources)
  - `flint-test-writer` → Generates `it.todo()` scaffolds for every `testBoundary`

- **Group B (after A):**
  - `flint-design-engineer` → `CoverageBadge.tsx`, `CoveragePopover.tsx`, `StatusBar.tsx` edit
  - `flint-test-writer` → Fills scaffolds with real assertions; all tests green

- **Group C (after B):**
  - `/review` gate (Phase 2.5) — runs on all changes before commit
  - `flint-integration-validator` (Phase 3)

**Parallelism safety check:** No two agents in Group A touch the same file. `flint-ast-surgeon` is the sole owner of the MCP linter files. `flint-electron-ipc` is the sole owner of every IPC leg including `server/index.ts` — this is intentional to prevent web-parity drift (see risk table).

---

## Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Classifier false positives (e.g., unrelated local `clsx` util flagged) | medium | 13 | Match only the binding imported as `clsx`/`cva`/`classnames`/`tw-merge` used inside a JSX `className` attribute. Ambiguous cases have unit tests. |
| Classifier doubles linter runtime by re-parsing | medium | — | Classifier takes the already-parsed AST from the caller; no Babel parse calls. Verdict is computed once in MithrilLinter and passed into A11yLinter. |
| New popover plumbing in Glass | low | — | Mirror the existing FigmaConnectionPanel popover primitive. No new overlay lib. |
| User confusion: "60% governed" read as "60 debt score" | medium | — | Popover copy explicitly states "Coverage is informational — it does not change your grade." Also documented as non-goal #2. |
| Web build drift — IPC change not mirrored in `server/index.ts` | medium | — | Single agent (`flint-electron-ipc`) owns BOTH `electron/main.ts` and `server/index.ts` for this channel. Phase 3 validator diffs the two. |
| `CoverageReason` enum values serialize into `debt-history.json`; renames would corrupt history | low | — | Enum values are treated as stable wire-format strings. New reasons append only; callers pattern-match with a default branch. |

---

## Non-Goals (required ≥ 1; listing all 5)

1. Not attempting to parse unsupported patterns. Phase 0 is detection, not support. Mithril emits a coverage reason and moves on — it does NOT parse tagged-template bodies, CSS Module files, Tailwind config, Vue SFC, or Svelte templates.
2. Not changing the debt grade formula. The A-F grade continues to reflect violations on the parsed surface only. Coverage % is a separate signal. Conflating them is a separate product decision.
3. Not blocking the export gate based on coverage. A 60%-governed project still ships. Phase 0 is observability, not enforcement.
4. Not emitting coverage as a violation. Coverage reasons are informational — they do not feed `MithrilLinter.violations` or affect health scores.
5. Not backfilling coverage onto pre-Phase-0 mutations-ledger entries. History rows predating Phase 0 remain coverage-free; only go-forward scans emit verdicts.

---

## Self-Check (10-row pre-linter gate)

| # | Check | Status |
|---|-------|--------|
| 1 | `meta.audience` is exactly one of the 4 enum values | PASS — `"engine"` |
| 2 | Every invariant threshold contains `<`, `>`, `=`, `≤`, or `≥` and a unit | PASS — 5 invariants, all with operators and units |
| 3 | Every TestBoundary has given/when/then; `then` starts with imperative verb | PASS — 18 boundaries, all verbs are returns/sets/renders/calls |
| 4 | Every `renderer→main` / `bidirectional` IPC channel names a Zod export | PASS — `getCoverageSummaryPayloadSchema` lives in `shared/ipc-validators.ts` |
| 5 | `nonGoals.length >= 1` | PASS — 5 entries |
| 6 | Types compile standalone (`npx tsc --noEmit <path>` exits 0) | PASS — verified on both `.contract.ts` and `shared/ipc-validators.ts` |
| 7 | Every `impact[].owner` exists in `.claude/agents/` | PASS — all 6 agents exist (state-architect, electron-ipc, ast-surgeon, mcp-specialist, design-engineer, test-writer) |
| 8 | Every `impact[].owner` appears in a parallelism group | PASS — `flint-test-writer` now in both Group A (scaffolds) and Group B (real assertions); other 5 agents in their respective groups |
| 9 | Applicable Commandments listed with rationale | PASS — C2, C4, C5, C13, C14 with rationale; non-applicable ones called out |
| 10 | Markdown ↔ TypeScript agree on IPC count, type names, commandment list | PASS — 1 IPC channel, same type names, same 5 commandments, same parallelism groups |

---

## Revision Notes (v2, 2026-04-18)

Applied in response to `PHASE0-contract-lint-2026-04-18.md`:

- **BLOCKING-1 resolved:** Added `getCoverageSummaryPayloadSchema` and `getCoverageSummaryResponseSchema` as named exports in `shared/ipc-validators.ts`, plus the `'flint:getCoverageSummary'` entry in `ipcSchemas`. Both `.contract.ts` and `shared/ipc-validators.ts` type-check clean.
- **BLOCKING-2 resolved:** Removed the dependency on an undeclared `flint:audit-complete` broadcast. `useCoverageSummary` now refreshes via the existing `mcp-event` push channel, filtering on `eventType === "debt-scan-complete"`. No new IPC channel introduced; `ipc[]` remains the single `flint:getCoverageSummary` entry.
- **BLOCKING-3 resolved:** `flint-test-writer` added to `parallelismGroups.A` in `.contract.ts` (Group A scaffolds with `it.todo()`) AND retained in Group B (fills scaffolds with real assertions). Markdown Group A already listed it; the two artifacts now agree.
- **Warning — C2 listed:** Added Commandment 2. `CoverageBadge` renders a `data-coverage-state` attribute (healthy / warning / idle) with dot colors sourced from the existing StatusBar semantic-color map — no raw `bg-emerald-500` / `bg-amber-500` literals. Test assertions updated from class-name checks to `data-coverage-state` checks.
- **Warning — C5 listed:** Added Commandment 5. A new test boundary ("CoverageBadge — accessible name") asserts the `aria-label` reads `"Governance coverage: N% of files governed. Click to see breakdown."` and has a null-state fallback. Boundary count is now 18.
- **Warning — misleading Commandment tag removed:** `commandment: 9` dropped from the "Web build drift" risk entry. CIEDE2000 is the wrong Commandment for web-parity drift; the risk stands on its own without a tag.

Ready for `flint-contract-linter` re-run.
