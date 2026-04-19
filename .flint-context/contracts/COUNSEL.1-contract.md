# Counsel Sprint 1 — Unify the Health Score (COUNSEL.1)

**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-19
**Audience:** engine
**Related:** [shared/healthScore.ts](../../shared/healthScore.ts), [docs/strategy/BETA-READINESS-CHECKLIST.md](../../docs/strategy/BETA-READINESS-CHECKLIST.md) Gate 1

---

## 1. Background — the actual divergence

`shared/healthScore.ts` was introduced by CHRON.1-repair / C2 to be the single source of truth for the project health-score formula:

```
score = clamp(100 - critical*10 - amber*3 - advisory*1 - override*3, 0, 100)
grade: A>=90 B>=80 C>=70 D>=60 F<60
```

That module is correct. Most surfaces correctly delegate to it. **Three divergences remain** — all in the MCP package, all silent, all able to make four "user-visible health" surfaces disagree on the same fileset:

| # | Location | Defect | Effect |
|---|----------|--------|--------|
| A | `flint-mcp/src/core/dashboard/debtReportService.ts:135` (`computeHealthScore`) | Inlines a fork-copy of the canonical formula instead of importing it. Header comment claims parity, parity is enforced by convention only. | If anyone edits `shared/healthScore.ts` (changes weights, adds a bucket), `flint_debt_report` and `flint://dashboard` will silently fall behind. This is the exact failure mode that produced the original 4-formula divergence. |
| B | `flint-mcp/src/core/dbom/generator.ts:469` | Calls the positional `computeHealthScore(criticals, warnings, 0)` 4-arg shim with **only 2 bucket arguments**. `advisoryCount` defaults to `0`. | Whenever advisory-severity violations exist, DBOM `healthScore` and `flint_debt_report` healthScore will report different numbers for the same project. |
| C | `flint-mcp/src/core/governance/dbomService.ts:341` (per-component score inside `generateDBOM`) | Inlines `Math.max(0, Math.min(100, 100 - (criticals * 10 + warnings * 3)))`. Never calls the canonical helper at all. | Per-component scores carried on every `DBOMComponentEntry.auditResult.score` ignore advisory + override penalties. They cannot agree with the project-level score by construction. |
| D | `flint-mcp/src/core/dashboard/types.ts:21` (JSDoc) | Claims formula is `100 - mithrilCount × 5 - a11yCount × 10`. **Has never been correct.** | Wrong contract documentation; misleads future implementers. |

**Renderer-side hooks audited:**
- `src/hooks/useGovernanceHealth.ts` — already a thin wrapper, correctly delegates. The positional `computeCanonicalHealthScore(c, w, i, o)` shim survives for back-compat callers and is the same shape as the 4-arg shim that caused divergence B. **Mark `@deprecated`** to deter future positional callers.
- `src/hooks/useTokenHealth.ts` — already imports `computeHealthScore` from `shared/healthScore`. Clean.
- `src/components/ui/GovernanceDashboard.tsx` — consumes `useGovernanceHealth`. Clean.
- `src/components/editor/StatusBar.tsx` — does not compute a score; only renders the coverage badge and Figma dot. Reads governance state from `canvasStore`. No math change required.

**Chosen unified formula:** `shared/healthScore.ts` `computeHealthScore({ criticalCount, amberCount, advisoryCount, overrideCount })` is the canonical, object-arg form. Every consumer must import and call it directly. Positional 4-arg variants survive only as `@deprecated` shims that internally delegate.

---

## 2. Scope (Sprint 1 only)

In scope:
1. Replace divergence A (debtReportService inline copy) with a delegating import of `shared/healthScore.ts`.
2. Replace divergence B (DBOM core generator dropped bucket) by passing `advisoryCount` and switching to the object-arg call.
3. Replace divergence C (DBOM enrichment per-component arithmetic) with `computeHealthScore` calls.
4. Fix divergence D (stale `DebtReport` JSDoc).
5. Add a cross-package parity test that asserts identical `{score, grade}` from every public surface for a fixed input vector. This test must be the canary for any future drift.
6. Mark legacy positional shims `@deprecated` (no removal — one-release migration window per spec).

**Out of scope** (must appear in `nonGoals`):
- Counsel visual redesign (Sprints 2–4)
- New dashboard layout
- Plain-language verdict copy changes
- Any Mithril/Warden rule changes
- Any new MCP tools or resources
- Removal of legacy positional `computeHealthScore` signatures (deprecation only)
- Coverage Honesty changes — Phase 0 `CoverageVerdict` and `governedSurfacePercent` remain authoritative; the unified score must continue to NOT read coverage data
- IPC channel changes
- Any new Zustand store

---

## 3. Impact Map

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/core/dashboard/debtReportService.ts` | MODIFY — replace inline `computeHealthScore` body with delegating call to `shared/healthScore.ts`; preserve positional signature, mark `@deprecated`; keep `scoreToGrade` as `@deprecated` re-export of `gradeFromScore`. | flint-ast-surgeon |
| `flint-mcp/src/core/dbom/generator.ts` | MODIFY — switch import to `shared/healthScore.ts`; replace `computeHealthScore(c, w, 0)` with `computeHealthScore({ criticalCount, amberCount, advisoryCount: totalAdvisories, overrideCount: 0 })`. Compute `totalAdvisories` from `comp.violations` advisory count. | flint-ast-surgeon |
| `flint-mcp/src/core/governance/dbomService.ts` | MODIFY — replace inline `Math.max(0, Math.min(100, ...))` per-component score with `computeHealthScore({...}).score`; bucket advisory severity from `comp.violations`. | flint-ast-surgeon |
| `flint-mcp/src/core/dashboard/types.ts` | MODIFY — fix `DebtReport` JSDoc to reflect canonical formula. | flint-ast-surgeon |
| `src/hooks/useGovernanceHealth.ts` | MODIFY — add `@deprecated` JSDoc on `computeCanonicalHealthScore` positional shim with migration guidance to `computeHealthScore({...})`. | flint-state-architect |
| `shared/__tests__/healthScore.parity.test.ts` | MODIFY — file already exists from CHRON.1-repair; extend with 16-row parity matrix and per-consumer adapters (debtReportService, dbom generator, dbomService per-component) so every surface is asserted equal. | flint-test-writer |
| `flint-mcp/src/core/dashboard/__tests__/debtReportService.test.ts` | MODIFY — add advisory-bucket regression test that would have caught divergence B. | flint-test-writer |
| `flint-mcp/src/core/governance/__tests__/dbomService.test.ts` | MODIFY — add per-component advisory-bucket regression test. | flint-test-writer |

---

## 4. IPC Channels

None. Sprint 1 is engine-internal; no `window.flintAPI` surface changes, no new channels. Existing `mcp:call-tool` invocations of `flint_debt_report` and `flint_generate_dbom` change return-value content (specifically: per-component scores and DBOM project healthScore may change for projects with advisory violations) but the wire schema is unchanged.

---

## 5. Store Contracts

None. No new Zustand state. `useGovernanceHealth` and `useTokenHealth` continue to derive locally from existing store slices.

---

## 6. Component Contracts

None. `GovernanceDashboard.tsx` and `StatusBar.tsx` are unmodified.

---

## 7. Commandment Checklist

| # | Commandment | How Sprint 1 satisfies |
|---|-------------|------------------------|
| 5 | Accessibility is a Compiler Error | A11y violations remain `severity: 'critical'` (`debtReportService.ts:309`); their bucket weight (×10) is unchanged. The unified formula preserves the export-blocking property. |
| 6 | The Gatekeeper Rule | Export-gate logic in `ExportModal` reads violation counts directly, not the score. Score change does not weaken the gate. Verified: no consumer treats "score=100" as "exportable". |
| 14 | Bypass Prohibition | No new `fs` or `git` callsites. All file writes (DBOM, debt-history, coverage-cache) continue to use existing patterns; this contract does not relocate them. |

Commandments 1–4, 7–13, 15, 16 are not applicable — Sprint 1 modifies engine math (no user-code AST mutation, no AI orchestration, no undo, no persistence relocation).

---

## 8. Implementation Order & Parallelism

**Group A (parallel — three flint-ast-surgeon tasks):**
1. Refactor `debtReportService.ts` `computeHealthScore` to delegating wrapper. Update `scoreToGrade` to delegate to `gradeFromScore`.
2. Refactor `dbom/generator.ts` to pass advisory bucket via object arg.
3. Refactor `governance/dbomService.ts` per-component score to use canonical helper.

All three are independent files with no shared symbols beyond the canonical import path.

**Group B (sequential after Group A — flint-state-architect):**
4. Add `@deprecated` JSDoc to `useGovernanceHealth.ts` positional shim. Document migration to object-arg form.

**Group C (sequential after Group A — flint-test-writer):**
5. Create `shared/__tests__/healthScore.parity.test.ts` (cross-surface parity). This test imports from every consumer — must run after refactors land or it will fail intentionally.
6. Add advisory-bucket regression tests to `debtReportService.test.ts` and `dbomService.test.ts`.

**Group D (final — code reviewer):**
7. `/review` gate per the workflow.

---

## 9. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| flint-mcp `tsconfig.json` `rootDir: './src'` may reject `../../../../shared/healthScore.js` import. | medium | — | Same package already imports `../../../../shared/coverage-types.js` from `debtReportService.ts:22`. Pattern is proven. If TSC rejects, bump rootDir to package root (already permitted by build config). |
| Existing DBOM snapshot tests assert specific numeric scores. Adding the advisory bucket changes those numbers. | medium | — | Group C deliberately updates the affected test fixtures with the corrected expected values. Snapshot drift is the *intended* outcome — that's the bug being fixed. |
| Consumer of `DBOMComponentEntry.auditResult.score` may rely on the old (lower) numeric scale. | low | — | Search the repo for `.auditResult.score` consumers; only the formatter and DBOM CycloneDX wrapper currently read it. Both treat it as opaque display data. |
| Removing the formula fork could be perceived as breaking change for downstream MCP consumers (CI pipeline, third-party MCP clients). | low | — | Contract is "same formula, fewer copies." The score for the same input does not change in the debtReportService surface — that surface was already correct. Only DBOM scores change, and only for projects with advisory violations. |
| Cross-package parity test creates a circular-looking import (Glass `src/hooks` ← test ← `shared/`). | low | — | Test lives under `shared/__tests__/`. It imports the canonical formula and the public types of consumers' inputs only — not the React hooks themselves. |

---

## 10. Invariants (falsifiable)

| Name | Measurable | Threshold | Verified by |
|------|------------|-----------|-------------|
| `score-parity-across-surfaces` | Difference between scores returned by `shared/healthScore.ts`, `flint-mcp/dashboard/debtReportService.ts` (project total), `flint-mcp/dbom/generator.ts` (DBOM summary), and `flint-mcp/governance/dbomService.ts` (DBOM summary) for the same `{critical, amber, advisory, override}` input | `\|delta\| === 0` for every input in the parity matrix | `shared/__tests__/healthScore.parity.test.ts` (vitest) |
| `formula-source-uniqueness` | Number of files in the repo that contain a numeric expression matching `100\s*-.*critical|amber|warning|advisory.*\*\s*\d+` outside `shared/healthScore.ts` | `=== 0` after Sprint 1 lands | grep audit (CI lint check, also documented in test) |
| `coverage-grade-independence` | `score(input)` value when `governedSurfacePercent` varies from 0 to 100 with all other inputs fixed | `delta === 0` | unit test in parity suite |
| `advisory-bucket-respected` | DBOM project `healthScore` for input `{critical:0, amber:0, advisory:5, override:0}` | `=== 95` (was `100` before fix — divergence B regression) | `dbom.test.ts` |
| `deprecated-shim-still-correct` | Positional `computeCanonicalHealthScore(c,a,adv,o)` output equals object-arg `computeHealthScore({...}).score` for the same buckets | `=== ` (strict equality across 100 random inputs) | `useGovernanceHealth.test.ts` |

---

## 11. Test Boundaries

See `COUNSEL.1.contract.ts` for executable given/when/then. Summary:

- **parity-matrix:** for a fixed 16-row input matrix, every consumer surface returns identical `{score, grade}`.
- **advisory-bucket-dbom:** DBOM project `healthScore` deducts `advisoryCount * 1` (was 0 before fix).
- **per-component-canonical:** `DBOMComponentEntry.auditResult.score` matches `computeHealthScore({...}).score` for the component's own buckets.
- **deprecated-shim-delegates:** `computeCanonicalHealthScore(c, a, adv, o)` returns same number as canonical object-arg call.
- **coverage-independence:** score is invariant to changes in `governedSurfacePercent` (Phase 0 contract preserved).
- **export-gate-unaffected:** `ExportModal` blocks export iff critical violations or active overrides exist, regardless of score value.
- **doc-fix:** `DebtReport` JSDoc reflects canonical formula (manual review checkpoint, also asserted by a markdown-grep test).

---

## 13. Carve-outs (formula-source-uniqueness exemptions)

The headline invariant `formula-source-uniqueness === 0` applies to the **project health score** surface — every consumer that computes "how healthy is this project" must delegate to `shared/healthScore.ts::computeHealthScore`. The following functions are *not* project health scores and are deliberately exempt:

| Function | File | Why exempt |
|----------|------|------------|
| `computeInitHeuristic` (formerly `computeInitHealthScore`) | `flint-mcp/src/core/init/initRunner.ts` | Init-time onboarding heuristic with softer weights (warning×1, advisory×0.5) chosen so a fresh, pre-Flint project does not deterministically receive an "F" on its first welcome banner. Output is printed to stdout and returned in `InitResult.healthScore` for the Forge welcome surface only — no persisted governance surface (dashboard, DBOM, debt report, CI gate) reads it. The function is renamed and JSDoc-flagged so callers cannot mistake it for the canonical score. The deprecated `computeInitHealthScore` alias survives for one release. |

Adding a new carve-out requires updating this table AND adding a JSDoc block on the function naming it as a divergence from the canonical formula.

---

## 12. What Phase 2 will build (one paragraph)

Phase 2 implementers will perform a tightly-scoped engine refactor: replace three inline copies of the health-score formula in `flint-mcp/` with delegating calls to `shared/healthScore.ts`, restoring the advisory-bucket penalty that DBOM currently drops and eliminating the per-component arithmetic fork in `dbomService.ts`. They will fix one stale JSDoc block, mark the legacy positional `computeHealthScore` shims `@deprecated` with migration guidance, and add a cross-surface parity test that locks the contract going forward. No UI, no IPC, no store, no new MCP tools — just collapsing four math sites to one. The Beta-blocker is closed when every visible surface (StatusBar coverage badge data path, Governance Dashboard, `flint_debt_report`, `flint_generate_dbom`) returns the same number for the same input, asserted by automated test rather than convention.
