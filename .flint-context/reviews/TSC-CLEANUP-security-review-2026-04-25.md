# Security Review — TSC Baseline Cleanup (505 → 0 errors)

- **Phase:** TSC-CLEANUP
- **Reviewer:** flint-security-reviewer
- **Date:** 2026-04-25
- **Round:** 1
- **Branch:** feat/review-renderer-pilot

## Verdict

**FIX-FORWARD** — derived via `deriveVerdict()`. No BLOCK or BLOCKING-severity findings. Two warning-tier issues should be addressed before this branch ships, plus a handful of suggestions documenting risk acceptance.

## Risk Summary

| Severity   | Count |
|------------|-------|
| Blocking   | 0     |
| Warning    | 2     |
| Suggestion | 5     |

## Per-Item Audit (all 9 reviewer asks)

### 1. `electron/autoUpdater.ts` — `FLINT_FORCE_AUTOUPDATE=1` env-var bypass — **WARN-1**

`autoUpdater.ts:70` lets the env var skip the `app.isPackaged && existsSync(app-update.yml)` guard. The bypass is ONLY consulted in `autoUpdater.test.ts` (verified — sole call site). Risk surface:

- `electron-updater` without a valid `app-update.yml` throws `ENOENT` on `checkForUpdates()`, and the error is captured by the registered `'error'` handler at `autoUpdater.ts:126`. There is no hardcoded fallback feed URL — the GitHub provider requires `app-update.yml` for owner/repo. Worst-case behavior is a single benign warning log per check.
- BUT the bypass also unconditionally runs `autoUpdater.checkForUpdates()` on a 4-hour timer (`autoUpdater.ts:139-143`). If a malicious actor can both (a) export `FLINT_FORCE_AUTOUPDATE=1` in the user's shell profile AND (b) plant an attacker-controlled `app-update.yml` next to the binary, the auto-updater will start fetching update metadata from that feed. (a) requires shell-level compromise already; (b) requires write access to `process.resourcesPath`. The composite bar is high but the env-var lever is novel.

**Proposed fix (warning-grade):** wrap the bypass with `if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true')` so production binaries cannot honour `FLINT_FORCE_AUTOUPDATE` even with the env var set. The test file already runs under Vitest so the change is invisible to it.

### 2. `shared/ipc-validators.ts` — `mcp:call-tool` `z.record` Zod-4 migration — **PASS**

Diff: `z.record(z.unknown())` → `z.record(z.string(), z.unknown())`. Verified Zod version is **4.3.6** (`node_modules/zod/package.json`). In Zod 4, the single-arg `z.record(valueSchema)` form was removed; the new two-arg form is the canonical replacement and is **strictly equivalent in validation strictness** — a `Record<string, unknown>` is exactly what JS objects always are. No renderer-trust escalation. The schema continues to reject arrays and `null` because `z.record` requires a plain object.

This is the correct migration. No finding.

### 3. Mass `(window.flintAPI as unknown as Record<string, unknown>)` double-cast — **WARN-2**

The double-cast through `unknown` is a TS type-system escape hatch — it tells the compiler "trust me." In test files this is acceptable (tests stub the bridge). In **production** code I see two call sites:

- `src/main.tsx:19` — `(window as unknown as Record<string, unknown>).flintAPI = createWebFlintAPI()`. Writes a fresh `window.flintAPI` from `createWebFlintAPI()`. The right-hand side is the trusted web-mode adapter (compiled from our source). Risk: low. The cast is required because TS sees `window.flintAPI` as the read-only IPC bridge type. Correct fix would be a single `as unknown` cast on the LHS. Acceptable.
- `src/components/ui/GovernanceDashboard.tsx` and `src/components/ui/LaunchScreen.tsx` — these read off `window.flintAPI` and forward calls. The cast doesn't introduce a NEW vulnerability (the data was already `unknown` from `ipcRenderer.invoke`); it just mutes TS narrowing. The risk is regression: a future refactor can no longer trust TS to flag a removed method.

The cast pattern is **invisible to runtime safety** because `validateIPCResponse()` and the per-call narrowings still apply at the boundary. The warning is about type-safety hygiene: a `WebFlintAPI` interface should be declared and the cast collapsed to a single named cast.

**Proposed fix:** declare `(window as { flintAPI?: WebFlintAPI }).flintAPI = createWebFlintAPI()` in `main.tsx:19`, and audit the two production component cast sites for whether a typed wrapper exists.

### 4. `src/types/flint-api.d.ts` — `ProvenanceInfo.filePath?` and `ruleId?` extension — **SUG-1**

Verified the new optional fields are **not yet consumed** in any UI render path:

- `ViolationCard.tsx:636` renders `filePath={activeFilePath ?? undefined}` — pulls from renderer state, not from provenance.
- `GovernanceDashboard.tsx:174` reads `filePath` off audit-log entries (a separate type), not off `ProvenanceInfo`.
- `useGovernanceDefer.ts` consumes `provenance.source` and `provenance.agentId` only.

So **today** the extension is dead-data and carries no rendering risk. Suggestion only: when a future UI consumes `provenance.filePath`, ensure path-traversal characters are not displayed verbatim in tooltips/aria-labels, and that `ruleId` is interpolated as text (not `dangerouslySetInnerHTML`). The MCP `mutationProvenanceService` is the source of these fields — both come from sanitized SQLite rows, so the upstream is trustworthy. Add a doc comment to flag the rendering rule when first consumer lands.

### 5. `src/store/__tests__/tokenStore.protoPollution.test.ts` — `@ts-expect-error` → `@ts-ignore` — **SUG-2**

Diff is cosmetic: both directives suppress the same TS error. `@ts-expect-error` would FAIL the build if the underlying type ever stops being an error (a useful canary that the test is genuinely exercising the type guard). `@ts-ignore` silently ignores forever.

The actual security guard tested is **`flattenDTCG` in tokenStore** — that runtime guard is unchanged and the four `expect(...).toBe(...)` assertions still execute the same prototype-pollution attack vectors. Test coverage of the security defense is unchanged.

The cosmetic change does weaken the **type-system canary**: if `setupFlintAPI()` someday becomes type-safe, the test won't notice. Suggest reverting to `@ts-expect-error` since the surrounding context (`global.window` injection) is genuinely a TS error today and will remain so.

### 6. `tsconfig.tests.json` — `noUnusedLocals: false` / `noUnusedParameters: false` — **WARN-3**

This config disables both unused-locals and unused-parameters checks across all test files (`src/**/__tests__`, `electron/**/__tests__`, `shared/**/__tests__`). Concrete risk: a test that imports a security helper but forgets to call it would now pass without TS complaint. Example failure mode:

```ts
import { sanitizePath } from '../sanitizer'  // imported, never used
const result = await ipcCall(rawUserPath)    // sanitizer never applied
expect(result).toEqual(...)                  // false positive — test "passes"
```

This is a real downgrade vs. the strict app config. Recommend re-enabling `noUnusedLocals: true` in tests (parameters can stay relaxed — Vitest mocks legitimately ignore params) and fixing the handful of unused-import sites. If that's too much churn, at minimum add a doc comment in `tsconfig.tests.json` explaining the security trade-off so future agents understand the gap.

### 7. `src/lib/autoResume.ts` and `src/store/canvasStore.ts` — `(err as { code?: string })` cast — **PASS**

Verified at `canvasStore.ts:833` and `autoResume.ts:168`: the cast still extracts ONLY `err.code`, never `err.message`. The Security m1 fix's intent — "log only the error code, never the raw error object" — is preserved. The change from `NodeJS.ErrnoException` to inline `{ code?: string }` was needed because `NodeJS.ErrnoException` carries `message`/`stack`/`path` properties that, while not consumed today, made the type contract broader than necessary. The new cast is **strictly narrower**. No finding — this is actually a small security improvement.

### 8. `shared/contract-schema.ts` — `LegacyFlintContract` relaxes `validator` to optional — **SUG-3**

Verified the live preload (`electron/preload.ts:846`) DOES validate `mcp:call-tool` via `mcpCallToolSchema`. Verified `governance:approve-mutation` and `governance:record-approval-reason` (CHRON.1 channels) DO have payload schemas in `ipcSchemas`. Verified `tokens:create`, `tokens:update`, `tokens:read-figma-drift` (MINT.5 phase 1) DO have schemas.

So the legacy contracts grandfathered into `LegacyFlintContract` are NOT actually missing validators in production — the relaxation is a contract-schema convenience for historical contract files that pre-date the v2.1 hardening, not a live-IPC gap. The PDP enforcement (Phase 1.5 contract linter) on NEW contracts still requires `validator`, so going forward the gap can't open.

**Suggestion:** add a doc comment in `LegacyFlintContract` listing the ~4 grandfathered contracts and a sunset date by which they must migrate to `FlintContract`. Without that, the legacy escape hatch can drift indefinitely.

### 9. `MINT.5-phase3.contract.ts` — `_SyncActionErrorBinding` → `void (null as unknown as SyncActionError)` — **PASS**

Verified by reading the contract: the change is purely a TSC-pleasing keep-alive for the `SyncActionError` re-export at line 31. No exported type or runtime behavior changed. The cast pattern is contained inside a contract artifact (compile-time only — never executed). No security relevance.

## Verified Controls (passed)

- IPC payload validation for `mcp:call-tool` is intact at the preload bridge (`preload.ts:846`)
- Per-tool argument schemas (`MCP_TOOL_ARG_SCHEMAS`) still gate the 5 sync tools
- `flattenDTCG` prototype-pollution defense unchanged
- Zod 4 migration of `z.record` is semantically equivalent
- Error-code redaction in canvasStore + autoResume preserved
- New `ProvenanceInfo` optional fields are dead-data today (no render-path exposure)

## Recommendations (priority order)

1. **WARN-1**: gate `FLINT_FORCE_AUTOUPDATE` behind `NODE_ENV === 'test'` to prevent the env var from being honoured in production binaries.
2. **WARN-3**: re-enable `noUnusedLocals: true` in `tsconfig.tests.json` (or document the security trade-off) so unused-security-helper imports remain caught.
3. **WARN-2**: collapse the `as unknown as Record<string, unknown>` double-casts in production files to typed wrappers; tests can keep the loose form.
4. **SUG-2**: revert `@ts-ignore` → `@ts-expect-error` in `tokenStore.protoPollution.test.ts` to keep the type-system canary.
5. **SUG-3**: doc-comment `LegacyFlintContract` with a sunset list + date.
6. **SUG-1**: add a render-rule doc comment to `ProvenanceInfo.filePath`/`ruleId` to flag sanitization needs at first-consumer time.

## Scope

**Reviewed:**
- `electron/autoUpdater.ts` (init guard + bypass)
- `shared/ipc-validators.ts` (mcp:call-tool, all named exports)
- `electron/preload.ts:830-870` (bridge validation site)
- `electron/main.ts:3855-3890` (mcp:call-tool handler)
- `src/main.tsx` (window.flintAPI write site)
- `src/types/flint-api.d.ts` (ProvenanceInfo + governance API surface)
- `src/store/__tests__/tokenStore.protoPollution.test.ts`
- `src/lib/autoResume.ts` (error-code cast)
- `src/store/canvasStore.ts:820-844` (error-code cast)
- `tsconfig.tests.json`
- `shared/contract-schema.ts` (LegacyFlintContract)
- `.flint-context/contracts/MINT.5-phase3.contract.ts`
- `.flint-context/contracts/CHRON.1.contract.ts` (validator coverage)

**Skipped:**
- The remaining ~10 test-file cast sites — sampled 2, pattern is uniform, no per-file analysis adds signal
- `electron/__tests__/autoUpdater.test.ts` — test file, not a production attack surface
