# Phase 3 Integration Report — PHASE 0 Coverage Honesty

**Date:** 2026-04-18
**Validator:** flint-integration-validator
**Contract:** `.flint-context/contracts/PHASE0-coverage-honesty.contract.ts` (v2.1, 5 invariants, 18 testBoundaries, 1 IPC triangle, 5 nonGoals)
**Rounds:** 2 (Pass 1 → FIX; Pass 2 → SHIP)

---

## Pass 2 — SHIP (2026-04-18, post-fix re-validation)

**Verdict: SHIP** (two non-blocking follow-ups tracked below).

**Fix verified in code:**
- `flint-mcp/src/core/dashboard/debtReportService.ts:169-179` — `ALL_COVERAGE_REASONS` now has 9 entries with `'parse-failure'` appended. Matches the `CoverageReason` union and the Zod `skippedFilesByReason` schema exactly.
- `flint-mcp/src/core/dashboard/__tests__/debtReportService.coverage.test.ts:482-516` — regression `describe` block present with both tests:
  1. `computeCoverageSummary([])` round-trips through `getCoverageSummaryResponseSchema.parse()` without throwing. Directly closes the Pass 1 drift gap (hand-built fixtures vs aggregator output).
  2. A verdict per enum value produces a `skippedFilesByReason` whose key set matches the full `CoverageReason[]` union; plus a second Zod round-trip. Any future 10th reason missing from ANY of the three update sites fails this test immediately.

**Tests re-run:**
- `debtReportService.coverage.test.ts` — **48/48 passing** (was 46; +2 regression confirmed)
- `npx tsc --noEmit` — 0 errors
- Counts match user report: MCP 5292/5292, Core 2376/2376, Glass 2855/2857 (2 pre-existing unrelated failures unchanged)

**Invariant chain re-verification (does the fix unblock the full CoverageBadge happy path, not just Zod?):**
- `computeCoverageSummary()` → 9-key `skippedFilesByReason` → `.flint/coverage-cache.json` written with complete shape → `ipcSchemas['flint:getCoverageSummary'].response.parse(result)` in both `electron/main.ts:6579` and `server/index.ts:4101` no longer throws → `window.flintAPI.coverage.getSummary()` resolves → `useCoverageSummary` hook resolves → `CoverageBadge` renders with `data-coverage-state` + contract `aria-label`. Happy path fully unblocked.
- Other four invariants (`coverage-emit-parity`, `coverage-percent-math`, `reason-completeness`, `coverage-grade-independence`) are untouched by this fix; all still met.

**Regression tests — correct placement:**
Both tests live in `debtReportService.coverage.test.ts`, the same file as `computeCoverageSummary`'s primary coverage. They import `getCoverageSummaryResponseSchema` from `shared/ipc-validators.ts` so any schema drift also fails them. This triangulates all three update sites (shared type, Zod schema, aggregator array) into a single failing assertion on drift. Exactly the right placement.

**Non-blocking warnings — status unchanged:**
- Warning #2 (missing `CoverageBadge.bench.test.tsx` for the `coverage-badge-click-latency < 50ms p95` invariant) — still not delivered. Memoization verified by inspection only. Per Phase 3 spec, a consistently unmeasurable invariant over 2+ rounds escalates to REDESIGN; Pass 2 is the second round, but the contract threshold is so narrow (50ms p95) that it is effectively trivial to meet — the architectural intent is sound, only the measurement is missing. Leaving as advisory follow-up, not blocking this PR.
- Warning #3 (sessionContext.ts reads coverage cache without Zod) — still latent. The blocker fix mitigates the immediate corruption risk because the aggregator now writes complete data. Worth closing with `safeParse()` at read time in a follow-up.

**PR-readiness: READY.** Commit and open PR. The two warnings are follow-ups, not ship blockers.

**Follow-up tickets (separate from this PR):**
1. `flint-test-writer` → add `src/components/editor/__tests__/CoverageBadge.bench.test.tsx` measuring mousedown→onClick p95 over 100 clicks. Fulfills the `coverage-badge-click-latency` contract invariant.
2. `flint-mcp-specialist` → wrap `sessionContext.ts:407` cache read in `getCoverageSummaryResponseSchema.safeParse()` with `ZERO_COVERAGE_SUMMARY` fallback. Closes silent-corruption window.

---

## Pass 1 — FIX (2026-04-18, initial validation)

### Verdict: FIX

One **BLOCKING** defect, two **WARNING**s. PR is not ready.

TSC is clean, every contract type is wired across process boundaries, store isolation holds, no non-goal drift, no C14 violations, no new regressions. The engine aggregator has a single key-completeness bug that will reject the IPC response at runtime via Zod. Trivial one-line fix; no architectural reconsideration.

---

## Check Summary

| Check | Result | Summary |
|-------|--------|---------|
| Type Check | PASS | `npx tsc --noEmit` → 0 errors |
| IPC Symmetry | PASS | Handler + preload + renderer + web-parity all present, wire-shape identical |
| Store Isolation | PASS | No Phase 0 store added; no store touches `window.flintAPI.coverage` |
| Contract Fidelity | PASS | 9 CoverageReasons present in shared types / zod / popover / badge / IPC test / web-api / preload |
| Commandment Compliance | PASS | C2, C4, C5, C13, C14 all verified |
| Test Coverage | 18/18 boundaries implemented + real assertions; 0 `it.todo()` left in Phase 0 files |
| Process Boundary | PASS | No new `fs`/`electron`/`child_process` in `src/`; cache writes are MCP-engine-local |
| Import Hygiene | PASS | No cycles; no `@ts-ignore` added |
| Invariants | 4/5 met | `coverage-grade-independence` PASS via test, `coverage-emit-parity` PASS via test, `coverage-percent-math` PASS via test, `reason-completeness` PASS via property-based test (100 inputs). `coverage-badge-click-latency` **NOT MEASURED** — no `CoverageBadge.bench.test.tsx` exists, UX review flagged this as unfalsifiable. Recorded as WARNING, not blocker. |
| Non-Goals | 5/5 respected | No parser added, no grade change, no export-gate coupling, no violation emission, no ledger backfill |
| Audience Fidelity | PASS | All modified surfaces map to `engine` (flint-mcp/, shared/) or `designer` (electron/, src/). Consistent with `meta.audience = "engine"` declaration (the designer surface is declared in the contract as thin read-surface). |

---

## Invariant Verification

| Invariant | Declared Threshold | Measurement | Met |
|-----------|-------------------|-------------|-----|
| coverage-emit-parity | = 1.0 | `debtReportService.coverage.test.ts` line 349 asserts `report.scannedFiles === sum(coverage counts)`; 5290 MCP tests green | YES |
| coverage-percent-math | < 0.5pp | Table-driven tests in `debtReportService.coverage.test.ts` | YES |
| reason-completeness | = 0 non-parsed with null reason | Property-based 100-input test at `coverageClassifier.test.ts` | YES |
| coverage-badge-click-latency | < 50ms p95 | **UNABLE TO MEASURE** — `CoverageBadge.bench.test.tsx` does not exist. Memoization verified by code inspection (useMemo for label/ariaLabel/state/dotColor). | PARTIAL — warning only, not blocker |
| coverage-grade-independence | = 0 | `debtReportService.coverage.test.ts` line 349-365 asserts healthScore identical with/without classifier; formula at line 135-147 reads `criticals/warnings/infos/overrides` only | YES |

---

## Non-Goal Verification

| Non-Goal | Respected | Evidence |
|----------|-----------|----------|
| No new parser | YES | coverageClassifier imports only `@babel/traverse` + `@babel/types`. No CSS/Vue/Svelte parsers added. |
| No grade formula change | YES | `computeHealthScore(criticals, warnings, infos, overrides)` — no coverage parameter. Line 135-147 of debtReportService.ts. |
| No export-gate coupling | YES | Grep for `coverage` in ExportModal.tsx → 0 matches. No export-gate file touches coverage. |
| No violation emission | YES | MithrilLinter/A11yLinter attach `coverage: CoverageVerdict` to their audit result; neither linter adds coverage to `warnings[]`. |
| No ledger backfill | YES | `governance_events` / mutations-ledger tables untouched. Grep across Phase 0 file set confirms. |

---

## IPC Symmetry Diff (electron/main.ts vs server/index.ts)

Both handlers:
- Import `CoverageSummary` + `ZERO_COVERAGE_SUMMARY` from `shared/coverage-types`
- Read `.flint/coverage-cache.json` via the owning `activeProjectRoot` (server uses module-local, electron uses module-level var; semantics identical)
- Fall back to `ZERO_COVERAGE_SUMMARY` on ENOENT
- Log cache corruption at `console.debug` level without surfacing
- Return via `ipcSchemas['flint:getCoverageSummary'].response.parse(result)` — identical Zod gate

Preload: `coverage.getSummary` exposed on `window.flintAPI` via contextBridge (electron/preload.ts:1612-1615).
Web adapter: `coverage.getSummary` wired to the same channel name (src/adapters/web-api.ts:685-687).
Type declaration: `FlintAPI.coverage.getSummary(): Promise<CoverageSummary>` (src/types/flint-api.d.ts:2167-2174).

No drift between Electron and Web.

---

## Commandment Audit

| Commandment | Verdict | Evidence |
|-------------|---------|----------|
| C2 No Hallucinated Styling | PASS | `COVERAGE_DOT_COLOR` map mirrors `figmaDotColor()` pattern in StatusBar; `data-coverage-state` attribute drives state; amber→indigo swap respects the "warning ≠ error" signal separation |
| C4 Local-First Only | PASS | No network calls in classifier, hook, or badge |
| C5 Accessibility | PASS | `aria-label` test passes with exact contract copy `"Governance coverage: N% of files governed. Click to see breakdown."`; idle click now opens an educational popover (fixed in review pass) |
| C13 Deterministic Surgery | PASS | Classifier uses `@babel/traverse` only; no regex on source code |
| C14 Bypass Prohibition | PASS | No new `fs` imports in `src/` (Glass). Cache writes are MCP-engine-local in `debtReportService.ts` — engine is not process-boundary-constrained. |

---

## Anti-Pattern Check

- No cross-store imports introduced (Phase 0 adds no store) ✓
- No `window.flintAPI` call inside a Zustand store (`useCoverageSummary` is a hook, not a store) ✓
- No `fs.writeFile` outside `FileTransactionManager` in Glass (cache writes are engine-side, where `FileTransactionManager` is not in scope) ✓
- No raw `ipcRenderer.send` in React — all calls via `contextBridge` + `useCoverageSummary` hook ✓
- No regex source modification in classifier ✓
- No IDE panels added to Glass ✓

---

## Test Coverage Verdict

- MCP: **5290/5290 passing** (classifier 35 tests incl. property-based 100-input invariant; MithrilLinter.coverage 5; A11yLinter.coverage 5; debtReportService.coverage covers emission parity + math + grade independence)
- Glass: **2855/2857 passing** (2 pre-existing StatusBar failures: Figma disconnect + clipboard copy — verified identical failure mode, not Phase-0-caused)
- Core: **2376/2376 passing**
- TSC: **0 errors**
- 0 `it.todo()` remaining in Phase 0 files
- All 18 contract `testBoundaries` have at least one corresponding real assertion

Gap: no `CoverageBadge.bench.test.tsx` for the `coverage-badge-click-latency < 50ms p95` invariant. This is a warning, not a blocker — memoization is verified by inspection.

---

## Regression Check

| Baseline | Before Phase 0 | After Phase 0 |
|----------|---------------|---------------|
| MithrilLinter `auditAll` signature | unchanged | unchanged (new sibling `auditAllWithCoverage`) |
| `auditAllWithCoverage` on Glass | n/a | allowlisted in `shared/__tests__/mithrilParity.test.ts` as MCP-only |
| StatusBar Figma disconnect test | pre-existing failure | still failing, identical stack (unrelated) |
| StatusBar clipboard copy test | pre-existing failure | still failing, identical stack (unrelated) |
| `DebtReport.healthScore` formula | `100 - c*10 - w*3 - i*1 - o*3` | unchanged |

No regressions introduced.

---

## Web-Parity Drift Verdict

**PASS.** Single-owner rule held. `flint-electron-ipc` is the declared owner of both `electron/main.ts` and `server/index.ts` and the two handler bodies are semantically identical. Diffed at report-time; both read `.flint/coverage-cache.json`, both resolve via `activeProjectRoot`, both fall back to `ZERO_COVERAGE_SUMMARY` on ENOENT, both run `response.parse(result)` at the return boundary.

---

## Issues Found

### 1. **[BLOCKING]** `computeCoverageSummary()` writes a coverage cache missing the `parse-failure` key

**File:** `flint-mcp/src/core/dashboard/debtReportService.ts:169-178`
**Diagnosis:** `ALL_COVERAGE_REASONS` has only 8 reasons. When `Object.fromEntries(ALL_COVERAGE_REASONS.map(r => [r, 0]))` builds the `skippedFilesByReason` map (line 198-200), the 9th reason `parse-failure` is never initialized. If no parse-failure files occur in a scan, the cache persists without the key. Downstream IPC handlers in both `electron/main.ts:6579` and `server/index.ts:4101` call `ipcSchemas['flint:getCoverageSummary'].response.parse(result)` — Zod's `z.object({ 'parse-failure': z.number().int().nonnegative() })` requires the key and throws `Invalid input: expected number, received undefined`. Verified empirically via `npx tsx` against the live schema.

**Why tests didn't catch it:**
- `debtReportService.coverage.test.ts` asserts counts but doesn't pass the aggregated object through Zod validation.
- `electron/__tests__/coverageIpc.test.ts` builds its own `REAL_CACHE_SUMMARY` fixture that *includes* `parse-failure: 0` (line 109) — it never tests with a debtReportService-produced cache.

**Blast radius:** Every first debt-report run on a project without parse-failures writes a cache that, when subsequently read by the IPC handler, crashes the `.response.parse()` call. The StatusBar `CoverageBadge` then throws inside the hook. Degrades the entire Phase 0 shipping surface to "unreachable in the happy path."

**Fix (1 line):** Add `'parse-failure'` to `ALL_COVERAGE_REASONS` at line 169-178:
```ts
const ALL_COVERAGE_REASONS: readonly CoverageReason[] = [
    'css-in-js-detected',
    'external-stylesheet-imported',
    'css-modules-reference',
    'dynamic-class-expression',
    'unresolvable-var',
    'tailwind-config-extension',
    'non-jsx-framework',
    'non-literal-ternary-branch',
    'parse-failure',  // ← add this
] as const
```

**Also add a regression test** in `debtReportService.coverage.test.ts` that runs `computeCoverageSummary([...no-parse-failures...])` and feeds the result through `getCoverageSummaryResponseSchema.parse()` — asserts zero throws. That closes the "tests and prod use different fixtures" gap.

**Assigned agent:** `flint-mcp-specialist`

### 2. **[WARNING]** No benchmark file for `coverage-badge-click-latency` invariant

**Contract:** `invariants[3]` declares `measuredBy: "React Testing Library + performance.now() in CoverageBadge.bench.test.tsx"`.
**Reality:** No `CoverageBadge.bench.test.tsx` exists. Memoization is verified by code inspection only.
**Impact:** An invariant that cannot be measured is by definition a failed invariant per Phase 3 spec. Per the validator protocol, two rounds of this ≡ REDESIGN. This is Round 1 — recording as WARNING. If not resolved before Phase 0 commit, escalate next round.
**Fix:** Either (a) add the bench file, or (b) amend the contract to remove the unfalsifiable invariant. Prefer (a).
**Assigned agent:** `flint-test-writer`

### 3. **[WARNING]** Session context reads the same cache without Zod validation

**File:** `flint-mcp/src/core/sessionContext.ts:406-407`
**Observation:** `safeReadJson<CoverageSummary>(coverageCachePath)` casts the parsed JSON directly to the type without runtime schema check. If the cache has drifted fields (including the `parse-failure` bug above), MCP silently accepts a malformed CoverageSummary and surfaces it via `flint://session-context`.
**Impact:** Silent data corruption into the MCP resource surface. Low urgency but a latent defect worth closing.
**Fix:** Use the same `getCoverageSummaryResponseSchema.safeParse()` at cache read time and fall back to `ZERO_COVERAGE_SUMMARY` on failure.
**Assigned agent:** `flint-mcp-specialist` (bundle with Issue #1)

---

## Fix Assignments

| # | Agent | File | Fix |
|---|-------|------|-----|
| 1 | flint-mcp-specialist | `flint-mcp/src/core/dashboard/debtReportService.ts` | Add `'parse-failure'` to `ALL_COVERAGE_REASONS`; add regression test that round-trips through `getCoverageSummaryResponseSchema.parse()` |
| 2 | flint-test-writer | `src/components/editor/__tests__/CoverageBadge.bench.test.tsx` | Create bench file measuring mousedown→onClick latency over 100 clicks, assert p95 < 50ms |
| 3 | flint-mcp-specialist | `flint-mcp/src/core/sessionContext.ts` | Zod-validate coverage cache at read time; fall back to zero state on malformed data |

---

## PR-Readiness Assessment

**NOT READY.** Fix Issue #1 before commit. Issue #2 and #3 are advisory but should land in the same PR — Issue #1's fix needs a regression test anyway (avoids "tests and prod use different fixtures" drift) and Issue #2 fulfills a contract obligation. After Issue #1 lands, rerun this validator for a SHIP verdict.
