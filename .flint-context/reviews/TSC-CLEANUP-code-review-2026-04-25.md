# TSC Baseline Cleanup — Code Review

**Phase:** TSC-CLEANUP
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-25
**Round:** 1
**Branch:** `feat/review-renderer-pilot`
**Scope:** ~110 files modified to drive `tsc -b` from 505 errors → 0. Reviewing the cleanup itself (not feature behavior; tests already verified by user).

---

## Verdict

**FIX-FORWARD** — derived from finding counts via `deriveVerdict()`. Zero blocking findings; multiple warnings worth following up but none gate the merge of the TSC baseline. The cleanup is principled in the large; a few small surface-area cuts and one cosmetic-but-misleading cast pattern should be addressed before this becomes the new normal others copy from.

`tsc -b` confirmed clean at review time.

---

## Summary

This is a high-quality TSC cleanup. The two big structural moves — the test-files tsconfig split and the `Legacy*` contract grandfather types — are honest, scoped, and self-documenting. The bulk-edit work (Zod 4 API, `NodeJS.ErrnoException` → `{ code?: string }`, dropdown ref types, token-type mapping correction) all stand up to inspection.

The findings below are not "you broke this." They're "the new code teaches a slightly worse pattern than the rest of the codebase models." That matters specifically because the goal of a baseline cleanup is to set the standard for the next 12 months of work.

---

## BLOCKING (0)

None.

---

## WARNINGS (5)

### WARN-1 — `as unknown as Map<string, string>` triple-cast in GovernanceDashboard hides the real type

**Files:** [src/components/ui/GovernanceDashboard.tsx:466-468](src/components/ui/GovernanceDashboard.tsx)

**Observed:** Three call sites pass a `(prev: Map) => Map` updater function to `setDeferDurations` / `setDeferReasons`, but each is wrapped in `as unknown as Map<string, string>`. The setter signature is `Dispatch<SetStateAction<Map<string, string>>>`, which natively accepts both `Map` and `(prev: Map) => Map`. The cast is misleading the reader: it claims a function value is a Map.

**Rationale:** Runtime is fine — React inspects the value, sees a function, and invokes it with `prev`. But the cast pattern teaches future contributors that `as unknown as X` is the way to satisfy a setter, which is exactly the false-trail Commandment 16 (in-memory validation) is designed to prevent agents from leaving behind. The correct fix is not a cast at all — it's the natural updater function shape `setDeferDurations(prev => new Map([...prev, [key, d]]))`. If TS is complaining there's a real type narrowing the setter — fix the narrowing, don't punch through it.

**Proposed fix:** Remove all three casts:
```tsx
onDefer={(key, d) => defer.setDeferDurations(prev => new Map([...prev, [key, d]]))}
```
If that does not compile, the underlying narrowing in `useGovernanceDefer.ts` is what needs adjusting (likely the returned type from the hook has been over-narrowed).

**Scope:** one-line × 3
**Severity:** warning (not blocking — runtime is correct)

---

### WARN-2 — `tsconfig.tests.json` includes `**/__tests__/**` and `**/*.test.ts(x)`, but tsconfig.app.json now EXCLUDES them — tests no longer benefit from the strict pass

**Files:** [tsconfig.app.json:42-47](tsconfig.app.json), [tsconfig.tests.json:1-19](tsconfig.tests.json)

**Observed:** `tsconfig.app.json` excludes test directories. `tsconfig.tests.json` extends `app.json` but disables `noUnusedLocals` and `noUnusedParameters`. Net effect: production code gets the strict pass; test code gets a permissive pass. The excludes are a clean partition (no overlap), so `tsc -b` correctly walks both.

**Rationale:** Defensible scope reduction — test files legitimately have unused imports during scaffolding (it.todo) and unused parameters in mock signatures. The risk is that the same flags hide real bugs in tests too: an unused mock setup may indicate a test that doesn't actually exercise what it claims to. The split is honest because [tsconfig.tests.json:5-6](tsconfig.tests.json) makes the loosening explicit and localized; the file lives next to the strict config for diff visibility.

What's missing: a one-line comment in `tsconfig.tests.json` explaining WHY these flags are off so the next engineer doesn't tighten them in a "cleanup" PR and break 100 test files.

**Proposed fix:** Add a header comment to `tsconfig.tests.json`:
```jsonc
// Test files relax noUnusedLocals/noUnusedParameters because:
//   - it.todo scaffolds reference imports before assertions exist
//   - mock fn signatures often need unused params to satisfy interface shapes
// Production code (tsconfig.app.json) keeps both flags ON.
```

**Scope:** one-line
**Severity:** warning

---

### WARN-3 — `LegacyFlintContract` is principled but the rename is not policed

**Files:** [shared/contract-schema.ts:140-249](shared/contract-schema.ts)

**Observed:** `LegacyTestBoundary`, `LegacyContractMeta`, `LegacyIPCChannelContract`, and `LegacyFlintContract` were added with extensive JSDoc explaining they are pre-2026-04-17 grandfather types. New contracts must use `FlintContract`. There is no compile-time or lint-time enforcement that NEW `.contract.ts` files don't import the Legacy types.

**Rationale:** The grandfather pattern itself is correct — it acknowledges history without diluting v2.1 hardening for new contracts. But `flint-contract-linter` was strengthened in v2.1 specifically because architects took shortcuts. Now we have a typed escape hatch sitting next to the strict type. The first time an architect on a deadline sees `LegacyFlintContract` and uses it for a new feature, the v2.1 hardening is undone for that contract, silently.

**Proposed fix:** Add an ESLint or `flint-contract-linter` rule that scans `.flint-context/contracts/**/*.contract.ts` for any import of a `Legacy*` symbol from `shared/contract-schema.ts` and rejects it unless the file's `meta.date` is < `2026-04-17`. Until that exists, JSDoc is a request, not a rule.

**Scope:** cross-file (linter rule)
**Severity:** warning

---

### WARN-4 — `FLINT_FORCE_AUTOUPDATE=1` env-var bypass is a production foot-gun

**Files:** [electron/autoUpdater.ts:70-84](electron/autoUpdater.ts)

**Observed:** The file-existence guard for `app-update.yml` can be bypassed by setting `FLINT_FORCE_AUTOUPDATE=1` in the environment. Comment says "for unit tests that mock electron-updater." There is no test for the inverse (env var set in a real packaged build).

**Rationale:** Test-only env var bypasses are a recurring class of incident. If a beta tester or CI environment sets this variable (or it leaks via a parent process), the autoUpdater will register handlers and start its 4-hour periodic check against a feed that doesn't exist, producing recurring background errors. The cleaner pattern is to inject the file-existence check (or the whole "should run" decision) as a function with a default and override it in the test, instead of reading process.env in production code.

**Proposed fix:** Replace the env-var read with an explicit injection:
```ts
export function initAutoUpdater(win: BrowserWindow, opts?: { forceForTesting?: boolean }) {
    const force = opts?.forceForTesting === true
    if (!force) { /* existing existsSync guard */ }
}
```
Tests pass `{ forceForTesting: true }` directly; production callers never have the option. No env var involved.

**Scope:** one-file
**Severity:** warning

---

### WARN-5 — `tokenMatcher.ts` mapping change `borderRadius → 'dimension'` is a real fix but lacks a regression test

**Files:** [src/utils/tokenMatcher.ts:223-231](src/utils/tokenMatcher.ts)

**Observed:** The pre-cleanup mapping had `spacing: 'spacing'` and `borderRadius: 'borderRadius'`. Neither `'spacing'` nor `'borderRadius'` is a valid `token_type` value in the engine — DTCG normalization uses `'dimension'` for both per [flint-mcp/src/core/](flint-mcp/src/core/). The cleanup correctly remapped both to `'dimension'`. This means the previous code returned `inTokenSet: false` for every spacing and border-radius value (no token of type `'spacing'` ever existed), so the inspector silently flagged every spacing value as off-token.

**Rationale:** This is a real bug fix masquerading as a TSC cleanup. The behavior change is: spacing and border-radius values that match a dimension token will now correctly resolve as `inTokenSet: true` — which is the intended INSPECTOR.1 contract. There should be a test asserting this (`given a dimension token "8px", when matchValueToToken("8px", "spacing", tokens), then inTokenSet === true`). The existing tokenMatcher tests should be checked for this case before considering INSPECTOR.1 fully online.

**Proposed fix:** Add two tests in the next round:
```ts
it('matchValueToToken("8px", "spacing", [dimToken8px]) → inTokenSet: true', ...)
it('matchValueToToken("4px", "borderRadius", [dimToken4px]) → inTokenSet: true', ...)
```

**Scope:** one-file (tests)
**Severity:** warning

---

## SUGGESTIONS (3)

### SUG-1 — `(err as { code?: string })?.code` is fine but losing the brand

**Files:** [src/store/canvasStore.ts:833](src/store/canvasStore.ts), [src/lib/autoResume.ts:168](src/lib/autoResume.ts)

`NodeJS.ErrnoException` was the explicit signal "this might be an fs error." `{ code?: string }` is a structural shadow. Both compile. Consider creating a shared `interface NodeErrorLike { code?: string; errno?: number; syscall?: string; path?: string }` in `shared/` and importing it — keeps the intent legible without pulling in the `@types/node` dependency from src/.

**Scope:** one-file (or cross-file if shared)
**Severity:** suggestion

---

### SUG-2 — `(window as unknown as Record<string, unknown>)` double-cast in `src/main.tsx` is correct Zod 4-era pattern but unsigned

**Files:** [src/main.tsx](src/main.tsx)

The `as unknown as` double-cast is the canonical TS escape for type-incompatible bridging. It's correct here. Consider adding a one-line comment "double-cast: `Window` shape is not extensible; we attach test hooks for e2e." So that the next reader doesn't try to "fix" it.

**Scope:** one-line
**Severity:** suggestion

---

### SUG-3 — Vue/Svelte adapter `sideEffects: []` returns are empty placeholders

**Files:** [src/core/adapters/VueAdapter.ts](src/core/adapters/VueAdapter.ts), [src/core/adapters/SvelteAdapter.ts](src/core/adapters/SvelteAdapter.ts)

Adding `sideEffects: []` makes both adapters satisfy `IFlintAdapter` and TSC pass. But returning an empty array silently means "no side effects ever" — which is a lie if the adapter ever processes a real mutation. If these adapters are still skeletons (per `project_preview_framework_support.md` they are queued, not online), document that explicitly with a `// TODO(framework-agnostic): populate sideEffects when adapter implementation lands` comment so the next implementer doesn't ship the empty-array stub by accident.

**Scope:** one-line × 2
**Severity:** suggestion

---

## Counts

| Severity | Count |
|---|---|
| Blocking | 0 |
| Warning | 5 |
| Suggestion | 3 |

## Top 3 Most Actionable

1. **WARN-1** — Remove the three `as unknown as Map<string, string>` casts in GovernanceDashboard. Trivial diff, removes a future-misleading pattern.
2. **WARN-5** — Add the two regression tests for the tokenMatcher mapping fix. The behavior changed; lock it in.
3. **WARN-4** — Replace the `FLINT_FORCE_AUTOUPDATE` env var with an injected option. Test-only env vars don't stay test-only.

## Scope Coverage

**Reviewed:**
- shared/contract-schema.ts (Legacy* additions)
- shared/review-schema.ts (read for context)
- shared/ipc-validators.ts (Zod 4 API change)
- tsconfig.app.json, tsconfig.node.json, tsconfig.tests.json
- src/types/flint-api.d.ts (TokenType + SourceAuthority + ProvenanceInfo + FixableItem + RightTab)
- src/utils/tokenMatcher.ts (CATEGORY_TO_TOKEN_TYPE)
- src/components/ui/FixPreviewDrawer.tsx
- src/components/ui/GovernanceDashboard.tsx (Map-setter casts, lines 450-484)
- src/components/ui/mint/EmitDropdown.tsx (ref type changes)
- src/store/canvasStore.ts (notes tab + ErrnoException)
- src/lib/autoResume.ts (ErrnoException)
- src/main.tsx (window cast)
- src/store/__tests__/tokenStore.protoPollution.test.ts (mock additions)
- src/core/adapters/VueAdapter.ts, SvelteAdapter.ts (sideEffects)
- electron/autoUpdater.ts (env-var bypass)
- electron/main.ts (spot checks of cited line numbers — pt undefined, HydroResolvedDef cast, variantVal guard, Dirent widening, filePath shadow)

**Skipped (out of scope for this review):**
- All test-file behavior changes — already verified passing by user
- electron/preload.ts changes — under security reviewer scope, not code reviewer scope
- server/index.ts — web-build parity not in TSC cleanup scope per user prompt
- Bulk perl/sed `(window.flintAPI.X as Record<...>)` replacements — sampled `src/main.tsx`, did not exhaustively re-grep all 110 files for the pattern. **Recommend a follow-up grep + spot-check round** before declaring the cleanup fully reviewed.
