# COUNSEL.1 Security Review — 2026-04-19

**Reviewer:** flint-security-reviewer
**Phase:** COUNSEL.1 (engine-only health-score unification)
**Scope:** `flint-mcp/src/core/dashboard/debtReportService.ts`, `flint-mcp/src/core/dbom/generator.ts`, `flint-mcp/src/core/governance/dbomService.ts`, `flint-mcp/src/core/dashboard/types.ts`, `src/hooks/useGovernanceHealth.ts`, `shared/__tests__/healthScore.parity.test.ts`
**Round:** 1

## Verdict: **SHIP** (PASS)

- Blocking: 0
- Warning: 0
- Suggestion: 1

## Threat-model context

Sprint 1 is a pure-math refactor: three inline copies of an integer formula are replaced by delegating calls to `shared/healthScore.ts`. No IPC, no preload bridge, no new MCP tool, no new fs writes (existing writes `.flint/dbom.json`, `.flint/coverage-cache.json`, `.flint/debt-history.json` were already there, unchanged in path/mechanism), no new external calls, no new dependencies, no new input handlers. The renderer-side change (`useGovernanceHealth.ts`) only adds `@deprecated` JSDoc — semantics unchanged.

## Targeted concern checks

1. **No new attack surface — PASS.** Diff against `electron/preload.ts` and `electron/main.ts`: untouched in this changeset (the shown working-tree diff lists `electron/preload.ts` modified, but unrelated to COUNSEL.1 — it belongs to mcpClient/MINT work). All new imports are pure functions from `shared/healthScore.ts`. No `child_process`, no `net`, no `http`, no `fs.write*` callsites added. `dbom/generator.ts` and `dbomService.ts` continue to use the existing atomic-write pattern (`*.tmp` → `renameSync`) at `dbomService.ts:432-434`.

2. **`advisoryCount` restoration in DBOM does not expose previously redacted data — PASS.** `advisoryCount` is a derived integer count of `comp.violations` whose `severity` is neither `critical` nor `amber`. The underlying violation array (`DBOMViolation[]`) was already serialized in full into `.flint/dbom.json` long before this sprint (see `generator.ts:422-435`, `dbomService.ts:382-390`). Restoring the bucket only changes a single integer in `summary.healthScore` (and per-component `auditResult.score`). Zero new fields, zero previously-suppressed strings surface. The CycloneDX wrapper (`dbomService.ts:263-280`) already exposed `flint:violations`/`flint:score`/`flint:dbom` properties; values shift but no new properties are added.

3. **`@deprecated` shims accept no new untrusted input — PASS.** `computeHealthScore(criticals, warnings, infos, overrides=0)` (`debtReportService.ts:130-142`) and `computeCanonicalHealthScore(c,w,i,o)` (`useGovernanceHealth.ts:64-76`) take four `number` parameters and forward to the canonical object-arg form. Inputs are `Math.floor`-clamped inside the canonical helper (assumed; the shim does no parsing). No string parsing, no regex, no eval. The shim is strictly weaker than the canonical form (cannot express future buckets), so it cannot be coerced into bypassing future canonical validation.

4. **No secrets/tokens/PII in parity fixtures — PASS.** Reviewed every row of both `SCENARIOS` and `PARITY_MATRIX` in `shared/__tests__/healthScore.parity.test.ts`. Every fixture is `{ criticalCount, amberCount, advisoryCount, overrideCount }` — four non-negative integers. No file paths, no user identifiers, no Figma keys, no API tokens, no hostnames, no email addresses, no UUIDs.

5. **Test fixtures do not bypass production guard rails — PASS.** The test imports the same exported entry points consumers use (`canonicalCompute`, `mcpCompute`, `glassCompute`, `formatHealthSignal`). The two `*Adapter` functions for `dbom/generator` and `dbomService` per-component (`healthScore.parity.test.ts:242-272`) are documented as call-path mirrors and route through `canonicalCompute` — they do NOT shadow the production module nor monkey-patch globals. There is no in-test mocking of `fs`, `BetterSqlite3`, or any IPC channel. No `process.env` mutation. The test never invokes `generateDBOM` against a temp project, so it cannot accidentally write to disk.

## Suggestions (non-blocking)

### [SUG-1] Adapter comment in parity test understates what is mirrored

- **Evidence:** `shared/__tests__/healthScore.parity.test.ts:242-256` (`dbomGeneratorAdapter`) and `:265-272` (`dbomServicePerComponentAdapter`)
- **Observed:** Both adapters call `canonicalCompute` directly rather than importing the actual call sites from `dbom/generator.ts` / `dbomService.ts`. Comments claim "this adapter mirrors the exact call path" but the test will continue to pass even if a future PR re-introduces an inline formula in those files, because the adapter itself never invokes them.
- **Rationale:** Not a security issue per se, but the parity test is positioned as the canary for divergence regressions. If someone reverts divergence B or C, only the unit tests in `dbom/generator.test.ts` / `dbomService.test.ts` would catch it — not this parity matrix. Tightening this would harden the regression net for future security-sensitive math (e.g., severity weights for compliance gates).
- **Proposed fix:** Either (a) extract the bucketing-then-canonical-call shape into a small helper exported from each consumer module and have the adapter import it, or (b) drive the adapters through `generateDBOM` against a tiny in-memory project fixture. Option (a) is the lighter change.
- **Scope:** one-file
- **Status:** open

## Verified controls

- Process boundary intact: no `fs`/`path`/`child_process` added to `src/`. `useGovernanceHealth.ts` imports only from `react` and `../../shared/healthScore`.
- No new `window.flintAPI` surface. No preload changes.
- No new MCP tool registrations or resource URIs.
- Atomic write discipline preserved: `dbomService.ts` write path (`tmp` → `renameSync`) unchanged.
- No new dependencies in `package.json` for this sprint.
- Type-check delegated to existing `npx tsc --noEmit`; no `any` casts introduced in changed regions beyond pre-existing `ast as any` patterns inherited from earlier work.

## Scope coverage

- **Reviewed:** all six files listed in the request, plus a sanity grep over `electron/preload.ts` and `electron/main.ts` to confirm COUNSEL.1 does not touch them, plus `shared/healthScore.ts` types referenced by the shims.
- **Skipped:** `flint-mcp/src/core/dashboard/__tests__/debtReportService.test.ts` and `governance/__tests__/dbomService.test.ts` (Group C regression tests — out of scope for this security pass; their absence does not change the security posture).
