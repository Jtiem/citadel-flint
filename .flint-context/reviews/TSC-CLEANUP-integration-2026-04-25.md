# Integration Report: TSC Baseline Cleanup (505 → 0 errors)

**Branch:** `feat/review-renderer-pilot`
**Files changed:** 154 (uncommitted)
**Date:** 2026-04-25
**Reviewer:** flint-integration-validator (regression canary, cheaper-pilot Lever D)

## Status: SHIP (with 2 documentation/policy follow-ups)

| Check | Result | Details |
|-------|--------|---------|
| TSC `-b` build | PASS | 0 errors, all 4 project references clean |
| IPC triangle (`tokens:seed-from-project`) | PASS | All 6 legs match shape `{seeded, source, sourcePath?, error?}` |
| Type narrowing chains (`fontSize` extension) | PASS | All `Record<TokenType, X>` and `switch(token_type)` sites handle the new variant or default-skip safely |
| `tokenMatcher.ts` DTCG mapping | PASS | spacing/borderRadius → 'dimension' is consistent with seedTokens, MithrilLinter, and tokenAdapter |
| Vue/Svelte adapter `sideEffects: []` | PASS | Sole consumer (`editorStore.applyBatch`) guards with `length > 0` |
| `LegacyFlintContract` grandfather | WARN | 5 historical contracts grandfathered correctly; linter has no rule preventing NEW contracts from using the legacy escape hatch |
| `tsconfig.tests.json` include coverage | WARN | `server/**/*.test.ts` not type-checked (pre-existing — `server/` has no tsconfig project reference) |
| `FLINT_FORCE_AUTOUPDATE` accidental setters | PASS | Only set in `electron/__tests__/autoUpdater.test.ts` (intended) |
| `CommandPalette.tsx` cast (`fixOps as unknown as …`) | PASS | Runtime shape matches `ApplyTokenFixMutation` exactly; cast hides only the widened local `op: string` literal |
| `shared/projectDetector.ts` exclusion | PASS | Zero imports from `src/`; safe to exclude from app config |
| `_settings-test.tsx` `@ts-nocheck` | PASS | Zero imports anywhere; fixture only indexed by `flint-manifest.json` (audit registry); not reachable from any render path |

---

## Issues Found (that scoped reviewers might miss)

### 1. [WARNING] Two divergent `TokenType` definitions in shared code

- **shared/dtcgFlatten.ts:20** declares its own `TokenType` union that does **NOT** include `'fontSize'`.
- **src/types/flint-api.d.ts:39** declares the canonical `TokenType` union that **DOES** include `'fontSize'`.

The two are structurally compatible today (every member of dtcgFlatten's union is a member of flint-api's union), so `FlatToken.token_type` is assignable to `DesignToken.token_type`. But maintenance drift will silently break this — if someone adds a member to dtcgFlatten's local union that isn't in the canonical one, the structural compat reverses without warning.

**Fix:** `shared/dtcgFlatten.ts` should `import type { TokenType } from '../src/types/flint-api'` (or vice versa — establish one canonical home). Since `shared/` is intended to be the single source of truth and `src/types/flint-api.d.ts` is renderer-only, the cleanest move is to export `TokenType` from `shared/dtcgFlatten.ts` (or a sibling `shared/tokenTypes.ts`) and have `src/types/flint-api.d.ts` re-export it. Note: `shared/tokenValueSanitizer.ts:58` defines a *third* variant called `TokenShapeCategory` (also includes `'fontSize'`). Three definitions of the same concept.

**File:line:** `shared/dtcgFlatten.ts:20`, `src/types/flint-api.d.ts:39`, `shared/tokenValueSanitizer.ts:58`

---

### 2. [WARNING] `LegacyFlintContract` escape hatch is not gated by the contract linter

`shared/contract-schema.ts:240` defines `LegacyFlintContract` (omits the 2026-04-17 hardening fields: `meta.audience`, `invariants`, `nonGoals`, IPC `validator`, executable `given/when/then`). The 5 historical contracts that needed rescuing (CHRON.1, MINT.5-phase1, MINT.5-phase3, sprint-2-glass-ui-fixes, sprint-clarity-2) correctly use it.

However, **`.claude/agents/flint-contract-linter.md` only checks `FlintContract`** — it has no rule that fails NEW contracts declared as `LegacyFlintContract`. An architect could ship a new feature contract using `LegacyFlintContract` to bypass every Phase 1.5 check (no audience, no invariants, no nonGoals, no IPC validators, prose-only test boundaries) and the linter would still APPROVE.

**Fix:** Add a Check 0 to `flint-contract-linter.md`: "If the contract's `meta.date` is on or after 2026-04-17, the export type MUST be `FlintContract`, not `LegacyFlintContract`. Reject with code `LEGACY-CONTRACT-NEW-FEATURE`."

**File:line:** `shared/contract-schema.ts:240`, `.claude/agents/flint-contract-linter.md` (Check 2 section)

---

### 3. [INFORMATIONAL — pre-existing, not introduced by this session]

- `server/**/*.test.ts` is not included in `tsconfig.tests.json` (only `src/`, `electron/`, `shared/` globs). The root `tsconfig.json` does not reference `server/` at all. This means `npx tsc -b` does not type-check the web build server or its 5 test files. Pre-existing condition (the cleanup did not introduce it), but worth flagging because the user explicitly asked about test-coverage gaps.

  **Fix (optional, separate work):** Add `server/**/*.test.ts` to `tsconfig.tests.json` includes, and add `server/**/*.ts` to `tsconfig.node.json` includes (or create a `tsconfig.server.json` project reference).

- `tests/e2e/*.spec.ts` Playwright tests are not in `tsconfig.tests.json` either, but Playwright manages its own type resolution via `playwright.config.ts`. Acceptable.

---

## Cross-Cutting Verifications That Passed

- **IPC triangle for `tokens:seed-from-project`** — verified shape symmetry across all 6 legs (electron/main.ts:1041, server/index.ts:912, electron/preload.ts:140, src/adapters/web-api.ts:300, src/types/flint-api.d.ts:182, shared/ipc-validators.ts:71). Response object `{seeded, source, sourcePath?, error?}` is identical at every leg. Zod validator response schema matches the TypeScript return type exactly.
- **`fontSize` consumers** — checked all `switch(token_type)` and `Record<TokenType, …>` sites:
  - `src/utils/tokenAdapter.ts:87` — has explicit `default: break` for fontSize/string/boolean (intentional — Tailwind v4 has no `extend.fontSize`, fontSize flows through dimension)
  - `src/utils/classMapper.ts:53` — returns `null` for fontSize in `getStripSet`, which is correct (no canonical prefix to strip)
  - `src/components/ui/TokenGrid.tsx:550,563,578` — confirmed user added 'fontSize' to TYPE_LABEL, TYPE_DOT, and GRID_FRIENDLY_TYPES sets
  - `shared/tokenValueSanitizer.ts:233` — has 'fontSize' case (line 238)
- **`tokenMatcher.ts:223` mapping change** — `spacing → 'dimension'` and `borderRadius → 'dimension'` is consistent with how `MithrilLinter`, `seedTokens`, and `tokenAdapter` already store these tokens (all use `'dimension'`). The previous mapping pointed at `'spacing'` and `'borderRadius'` which were never valid TokenType values, so no production data exists under those keys.
- **Vue/Svelte adapter `sideEffects: []`** — sole consumer is `src/store/editorStore.ts:376` which guards `if (sideEffects.length > 0)`. Empty array is safe.
- **CommandPalette cast** — `fixOps` shape matches `ApplyTokenFixMutation` (op/nodeId/hardcodedClass/tokenClass) exactly. Cast only widens local `op: string` to the literal union; runtime is correct.
- **`projectDetector.ts` excluded from app** — zero references in `src/`. Safe.
- **`_settings-test.tsx @ts-nocheck`** — zero imports anywhere. Vite will exclude from production bundle. Listed in `flint-manifest.json` only as an audit fixture.
- **`FLINT_FORCE_AUTOUPDATE`** — only `electron/autoUpdater.ts` reads it and only `electron/__tests__/autoUpdater.test.ts` sets it. No CI/build-script accidental setters.

---

## Verdict: SHIP

The TSC cleanup is structurally sound. The two warnings (divergent `TokenType` definitions; `LegacyFlintContract` linter gap) are tech-debt items, not blockers — they don't break the current build, the current tests, or any user-facing behavior. They should be filed as follow-up tickets but should not block this commit.

The cheaper-pilot lever D paid off here: scoped reviewers focused on individual files would not have caught the **two divergent `TokenType` unions in `shared/dtcgFlatten.ts` vs `src/types/flint-api.d.ts`** (cross-file invariant) or the **`LegacyFlintContract` linter-rule gap** (policy/tooling boundary, not code). Both findings are exactly the cross-cutting class the integration validator is designed to surface.

### Recommended follow-ups (separate commits, not blocking)

1. Consolidate `TokenType` to a single canonical export shared by `dtcgFlatten`, `flint-api.d.ts`, and `tokenValueSanitizer`.
2. Add Check 0 to `flint-contract-linter.md` rejecting `LegacyFlintContract` for any contract dated on/after 2026-04-17.
3. (Lower priority) Bring `server/` under a tsconfig project reference so `tsc -b` covers the web build server and its tests.
