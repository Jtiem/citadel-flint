# COUNSEL.1 — Integration Validation

**Date:** 2026-04-19
**Validator:** flint-integration-validator
**Contract:** `.flint-context/contracts/COUNSEL.1-contract.md` (APPROVED)
**Verdict:** **SHIP**

---

## 1. Validation Gate Results

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| 1 | Type Check (`npx tsc --noEmit`) | **PASS** | 0 errors, 0 output |
| 2 | Parity verification (`shared/__tests__/healthScore.parity.test.ts`) | **PASS** | 97/97 tests pass in 528ms; 16-row COUNSEL.1 matrix × 4 surfaces all green |
| 3 | Single-source-of-truth audit | **PASS** | Grep for `function computeHealthScore` finds: canonical (`shared/healthScore.ts`), one `@deprecated` shim in `debtReportService.ts`, and `flint-mcp/src/tools/audit.ts` (different signature — file-result aggregator, not a forked formula). No inline `100 - critical/amber/advisory * N` matches in any production source under the COUNSEL.1 surfaces. |
| 4 | Drop-in safety (renderer hook) | **PASS** | `src/hooks/useGovernanceHealth.ts` imports only `react` + `../../shared/healthScore` + `../types/flint-api`. No `fs`, `path`, `electron`, `child_process`. |
| 5 | DBOM regression (divergence B fix) | **PASS** | `dbom/generator.ts:404` introduces `totalAdvisories` accumulator; `:459-460` increments amber/advisory by severity; `:501` calls `computeDbomProjectHealth({criticalCount, amberCount, advisoryCount})`. Old `computeHealthScore(c, w, 0)` removed. |
| 6 | Stale doc cleanup (divergence D fix) | **PASS** | `flint-mcp/src/core/dashboard/types.ts:20-30` JSDoc now states canonical formula `clamp(100 - critical×10 - amber×3 - advisory×1 - override×3, 0, 100)` with grade bands. The "× 5 / × 10" phantom formula is gone. |
| 7a | Test suite — MCP | **PASS** | `cd flint-mcp && npm test` → **5550/5550 passing**, 206 files |
| 7b | Test suite — React | **PASS (with known carve-out)** | `npm run test:react` → **3126/3128 passing**, 11 todo. The 2 failures are the pre-flagged `StatusBar.test.tsx` Figma-popover regressions owned by RUNTIME.1 — unrelated to COUNSEL.1 surfaces. |
| 7c | Test suite — Core | **PASS** | `npm test` → **2556/2556 passing**, 90 files, 1 skipped, 26 todo |
| 8 | Carve-outs honored | **PASS** | `initRunner.ts::computeInitHeuristic` retains its softer onboarding heuristic, explicitly named in §13 of contract. `tools/audit.ts::computeHealthScore(files)` is a per-file aggregator, not a project-health forked formula. Both are documented exemptions. |

---

## 2. Final Test Counts

```
MCP:    5550/5550 passing
Glass:  3126/3128 passing (2 pre-existing, RUNTIME.1)
Core:   2556/2556 passing
TSC:    0 errors
Parity: 97/97 passing
```

---

## 3. Contract Drift Observed

None of substance. Two structural notes:

- **Helper extraction beyond contract text** — Implementers extracted `computeDbomProjectHealth` (in `dbom/generator.ts`) and `computePerComponentHealth` (in `governance/dbomService.ts`) as named exports rather than calling `computeHealthScore` inline at the use-site. The contract did not require this, but the helpers are pure delegators and they make the parity test's adapter pattern bind to the **production code path** rather than to a test-only re-implementation. Strict improvement; not drift.
- **Hard-coded `overrideCount: 0`** in both DBOM helpers is documented in JSDoc and asserted by the parity test (rows with overrides are exempt from DBOM↔canonical pairwise equality). Matches contract §1 explicit treatment of DBOM as a filesystem-scan surface that "cannot see live overrides".

---

## 4. Pilot Regression-Canary — What Reviewers Missed

The **code reviewer** (FIX-FORWARD) and **security reviewer** (SHIP) both correctly approved the engine refactor. Adversarial pass below.

**Net new findings: 0 blocking, 1 non-blocking.**

Items I checked specifically:

1. **Phantom forked formula re-emergence** — None. Grep audit clean across full source tree (excluding tests/contracts/dist). The `initRunner.ts` softer heuristic is the only legitimate deviation and is explicitly carved out in contract §13.
2. **Snapshot drift** — Risk #2 in contract called out that DBOM snapshot tests asserting numeric scores would change. MCP suite passes 5550/5550, including `flint-mcp/src/core/dbom/__tests__/dbom.test.ts` and `governance/__tests__/dbomService.test.ts` — fixtures were updated correctly. No silent xfail.
3. **Hook deprecation visibility** — `computeCanonicalHealthScore` in `src/hooks/useGovernanceHealth.ts` carries the `@deprecated` JSDoc with COUNSEL.1 reference and migration target. TSC will emit deprecation diagnostics for any new positional caller — matches test boundary §11 row 6.
4. **Override-bucket parity with DBOM** — Adapter logic in `dbomGeneratorAdapter` and `dbomServicePerComponentAdapter` correctly compares against `canonical({...input, overrideCount: 0})` for non-zero-override rows, while `s1` and `s2` continue to honor full overrides. Mathematically correct given documented DBOM design constraint.
5. **Audit-tool aggregator name collision** — `flint-mcp/src/tools/audit.ts:585 function computeHealthScore(files: BatchFileResult[]): number` shares the name with the canonical helper but has a completely different signature. Not a forked formula and out of scope for COUNSEL.1, but worth a future rename to e.g. `aggregateBatchHealth` to remove the name collision in code search. **Non-blocking; Sprint 2 cleanup.**

---

## 5. Verdict

**SHIP.** All 8 gates pass. The contract's headline invariant (`score-parity-across-surfaces |delta| === 0`) is asserted by 16 matrix rows × 4 surfaces, all green. The divergence-B canary `{0,0,5,0} ⇒ 95 / A` is an explicit assertion in the parity suite and passes. Beta Gate 1 item #1 is closed.
