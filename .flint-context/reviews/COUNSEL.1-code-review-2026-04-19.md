# COUNSEL.1 — Code Review

- **Phase:** COUNSEL.1 (Sprint 1 — Unify the Health Score)
- **Reviewer:** flint-code-reviewer
- **Date:** 2026-04-19
- **Round:** 1
- **Verdict (derived):** FIX-FORWARD
- **Counts:** 0 blocking · 2 warnings · 2 suggestions

## Summary

The refactor delivers what the contract specified for the four files in scope. All three divergences (A/B/C) are genuinely retired at source — `debtReportService.ts:130-142` and `useGovernanceHealth.ts:64-76` are real `@deprecated` shims that delegate to `shared/healthScore.ts::computeHealthScore`; `dbom/generator.ts:473-478` passes the object-arg form with `advisoryCount: totalAdvisories` (aggregated at line 434); `governance/dbomService.ts:347-352` replaces the inline `Math.max(0, Math.min(100, ...))` arithmetic with the canonical helper. The `DebtReport` JSDoc at `dashboard/types.ts:20-30` now reflects the canonical formula. No IPC additions, no store contamination, no `fs`/`git` introductions — the engine-only scope held.

The parity test is partially load-bearing and partially tautological — see WARN-1.

## Findings

### WARN-1 — Parity matrix surfaces 3 and 4 are tautological adapters, not real call-paths

`shared/__tests__/healthScore.parity.test.ts:242-272` defines `dbomGeneratorAdapter` and `dbomServicePerComponentAdapter` as wrappers that simply call `canonicalCompute(input)` directly. They never import from `flint-mcp/src/core/dbom/generator.ts` or `flint-mcp/src/core/governance/dbomService.ts`. The pairwise `|delta| === 0` assertions at lines 336-345 therefore reduce to `canonicalCompute(input) === canonicalCompute(input)` for surfaces 3 and 4 — true by construction, regardless of what the actual generator/service code does.

Real protection of those two surfaces depends entirely on (a) the architect's discipline today (the inline `computeHealthScore({...})` calls visibly delegate) and (b) the Phase 0 grep invariant. If a future PR re-inlined the formula in `dbomService.ts`, this matrix would still pass green.

**Fix:** replace the two adapters with thin functions that exercise the real surfaces — e.g., import a small extracted `scoreComponent(comp)` helper from `dbomService.ts`, or call `generateDBOM` against a fixture `projectRoot` containing one component per matrix row. Either way, the assertion must transit the production call-path.

**Severity:** warning (the score-parity invariant is the contract's headline guarantee; partial coverage downgrades it to "two surfaces watched, two on the honor system").

### WARN-2 — `initRunner.ts` carries an unaudited fork of the formula

`flint-mcp/src/core/init/initRunner.ts:87-100` defines `computeHealthScore(critical, warning, advisory)` with weights `critical*10, warning*1, advisory*0.5` — different from the canonical `*10, *3, *1`. The file even self-documents the divergence in its JSDoc: "Note: the spec uses different weights than debtReportService". This violates contract invariant `formula-source-uniqueness` which claims `=== 0` files match `/100\s*-.*critical.*\*\s*\d+/` outside `shared/healthScore.ts` after Sprint 1.

The architect's Section 1 audit table only enumerated four divergence sites (A–D) inside `flint-mcp/src/core/dashboard` and `dbom`. The init runner was not surveyed and therefore not fixed.

**Fix:** either (a) migrate `initRunner.ts` to the canonical formula in this sprint to honor the invariant, or (b) explicitly carve it out in the contract `nonGoals` and document the intentional weight divergence in `shared/healthScore.ts`. Today the codebase contradicts the contract.

**Severity:** warning (not blocking because the init runner runs only at `flint init` time and never feeds the four user-visible surfaces, but the contract claim is false as written).

### SUG-1 — Codify the grep invariant as an actual test

The contract's invariant `formula-source-uniqueness` is "measured by grep audit codified as a unit test in `shared/__tests__/healthScore.parity.test.ts`" but no such test exists in the file. Currently the invariant is enforced by reviewer eyeballs only.

**Fix:** add an `it('formula-source-uniqueness')` block that walks the repo (excluding `dist*`, `node_modules`, docs, contracts, tests) and asserts no source file matches the regex. WARN-2 would have been caught automatically.

### SUG-2 — Deprecation tags are JSDoc-only; no `tsc` warning is actually emitted

The contract's TestBoundary `deprecated-shim-still-correct` claims tsc "emits a deprecation diagnostic" when callers use `computeCanonicalHealthScore`. In practice, `@deprecated` JSDoc emits diagnostics in IDEs (VS Code) but not in `tsc --noEmit` runs unless `noImplicitOverride`/strict deprecation flags are enabled — they are not in this repo. The shim's deprecation is therefore informational; CI will not flag a regression.

**Fix:** either lower the contract claim to "IDE surface deprecation" or wire an ESLint rule (`deprecation/deprecation`) into the test suite to enforce it.

## Commandment Compliance

| # | Commandment | Status |
|---|-------------|--------|
| 5 | Accessibility is a Compiler Error | PASS — A11y violations remain critical-bucket, ×10 weight unchanged. |
| 6 | The Gatekeeper Rule | PASS — `ExportModal` reads counts, not score. Score change is not a gate weakening. |
| 14 | Bypass Prohibition | PASS — no new `fs`/`git` callsites. |
| 16 | In-Memory Validation | n/a — no AI orchestration in scope. |

## Coverage Honesty (Phase 0)

PASS. `governedSurfacePercent` is not consumed by any of the four refactored callsites. The score signature has no coverage field; the `coverage-grade-independence` test at parity.test.ts:357-365 asserts the invariant. `computeCoverageSummary` at debtReportService.ts:179 is untouched and still aggregates separately.

## Process Boundary / Stores / IPC

Clean. Zero new `window.flintAPI` surface. Zero Zustand store changes. `useGovernanceHealth` continues to derive locally from `LinterWarning[]` + override count. No store imports another store.

## Test Posture

- MCP 5550/5550, Core 2556/2556 (16 new parity rows), Glass 3126/3128 (2 unrelated), TSC 0 — as reported.
- Parity matrix asserts the canonical formula (good) and the deprecated shims (good); but the two DBOM surfaces are only tested by adapters that call the canonical helper directly (WARN-1).
