# Integration Report: RUNTIME.1 — axe-core Runtime Adapter

**Date:** 2026-04-18
**Validator:** flint-integration-validator
**Contract:** `.flint-context/contracts/RUNTIME.1-contract.md`
**Executable contract:** `.flint-context/contracts/RUNTIME.1.contract.ts`

## Status: FAIL

| Check | Result | Details |
|-------|--------|---------|
| Type Check | UNVERIFIED | TSC could not be executed in this sandbox. Trusting the reporter's claim of 0 errors; no static inconsistencies found by manual inspection. |
| IPC Symmetry | **FAIL** | Renderer+web+preload-type legs present, but **Electron main handler and preload bridge do NOT exist**. |
| Store Isolation | PASS | `canvasStore` slice is pure state, no cross-store imports introduced. Pre-existing `window.flintAPI` calls in canvasStore are unchanged (historical). |
| Contract Fidelity | PARTIAL | 25/27 contract files exist. Missing: real append to `electron/main.ts` and `electron/preload.ts`. |
| Commandment Compliance | PARTIAL | C4 (offline) implemented on web via route blocker; C6 gate integration and C9 (CIEDE2000 vs axe contrast) correctly documented. C14 preserved on Glass side. |
| Test Coverage | PARTIAL | 7 of 8 invariants have at least one matching test. Dashboard-level integration merged-row test mounts `RuntimeAuditAccordion` directly, not `GovernanceDashboard`. Tests reported 55/55 + 50/50 not independently verified. |
| Process Boundary | PASS | No `fs`/`path`/`electron`/`better-sqlite3` imports in `src/**/*RuntimeAudit*`, `useRuntimeAudit`, `useMergedA11yFindings`, `useRuntimeAxeFlag`, or `runtime-audit.ts`. |
| Import Hygiene | PASS | No circular imports introduced. No `@ts-ignore`/`@ts-expect-error` observed in new files. |

## Active Invariant Verification

| Invariant | Verified actively | Verdict | Evidence |
|-----------|-------------------|---------|----------|
| `runtime-audit-latency-p95` | No (no benchmark file in scope) | TRUSTED | Contract specifies `electron/__tests__/runtime-adapter.bench.ts` — not present. |
| `dedup-coverage` | Active | PASS | `src/hooks/__tests__/useMergedA11yFindings.test.ts` exercises merge logic. |
| `csp-sandbox-isolation` | No (requires spawning BrowserWindow) | INDIRECT | Pure function isolation asserted structurally; no runtime CSP capture executed. |
| `version-mismatch-graceful` | Active | PASS | Server handler at `server/index.ts:4285` returns status `version-mismatch` without throwing. |
| `empty-preview-handled` | Active | PASS | `runtimeAxeIpc.test.ts` RIPC-11/RIPC-12 assert sentinel. Server handler `server/index.ts:4195` short-circuits. |
| `offline-resilience` | Active (structural) | PASS | `server/index.ts:4248-4255` registers `context.route('**/*')` to abort all non-data/about/file URLs. |
| `serialization` | Active | PASS | `useRuntimeAudit.ts:92` `statusRef.current === 'running'` guard. Test boundary covered. |
| `flag-off-ui-silent` | Active | PASS | `StatusBar.runtime.test.tsx` asserts `queryAllByTestId('runtime-audit-pill').length === 0`; `GovernanceDashboard` gates accordion behind `useRuntimeAxeFlag()`. |

## User's 7-Question Probe

1. **Invariants 1–7 honored?** Invariants 2, 4, 5, 6, 7, 8 honored; invariants 1 (latency) and 3 (csp-sandbox-isolation) are **taken on trust** — no benchmark file or captured CSP headers on disk.
2. **No existing Warden rule modules modified?** PASS. Only `A11yLinter.ts` got a doc-block append (lines 12–34 of the diff). Rule modules in `flint-mcp/src/core/a11y/rules/*.ts` untouched.
3. **`shared/ipc-validators.ts` named exports?** PASS. `runtimeRunAxePayloadSchema` (line 284) and `runtimeRunAxeResponseSchema` (line 287) both live and grep-able.
4. **Zustand cross-store contamination?** PASS. `canvasStore` gained only three fields (`runtimeFindings`, `setRuntimeFindings`, `clearRuntimeFindings`) — zero store-to-store imports introduced.
5. **StatusBar MINT.5 coordination?** PASS. `<RuntimeAuditGate />` inserted at `StatusBar.tsx:852` immediately after `<CoverageBadge />` and before the Herald IDE chip. MINT.5 elements undisturbed.
6. **Playwright lazy in web build?** PASS. `server/index.ts:4166` `loadPlaywrightForRuntime()` performs `await import('playwright')` only inside the IPC handler; no top-level import.
7. **Ephemeral `runtimeFindings` rebuilt vs merged?** PASS — `setRuntimeFindings(response)` REPLACES the slice on every IPC success; `setActiveFilePath` and `closeWorkspace` both clear to `null`.

## Issues Found

### 1. **[BLOCKING]** Electron IPC triangle incomplete — main-process handler and preload bridge missing
- **Evidence:** `git diff HEAD -- electron/main.ts electron/preload.ts` is empty. `grep -n "runtime:run-axe\|runAxe" electron/preload.ts` returns zero matches. `grep -n "runtime" electron/main.ts` returns only 5 pre-existing matches, none runtime-adapter-related.
- **Impact:** `window.flintAPI.runtime.runAxe` exists as a TypeScript declaration in `src/types/flint-api.d.ts:2203-2243` but has NO implementation at the preload bridge. Any Electron-runtime call from `useRuntimeAudit` will resolve `api?.runAxe` as `undefined`, fall through to the "IPC surface not available" branch, and surface an error toast. The feature is unreachable in Electron.
- **File:** `electron/main.ts`, `electron/preload.ts`
- **Fix:** flint-electron-ipc must add (a) an `ipcMain.handle('runtime:run-axe', …)` that spawns a sandboxed BrowserWindow, injects the bundled axe-core, runs `axe.run()`, and returns a Zod-validated `RuntimeAuditResult`; and (b) a `contextBridge` exposure under `runtime.runAxe` in preload.ts. Must pass the payload through `runtimeRunAxePayloadSchema` and the response through `runtimeRunAxeResponseSchema`.

### 2. **[BLOCKING]** axe-core npm dependency not installed
- **Evidence:** `package.json:55` lists `"axe-core": "4.10.3"` but `node_modules/axe-core` does not exist on disk. User claim of `flint-mcp/package.json — adds axe-core@4.10.3` contradicted by `git diff HEAD -- flint-mcp/package.json` returning empty.
- **Impact:** Web handler at `server/index.ts:4144-4164` searches three candidate paths for `axe.min.js`. All three will miss. Handler resolves with `{ status: 'error', error: { code: 'axe-core-missing' } }` — no audits produce real results.
- **File:** root `node_modules/` (via `npm install`); `flint-mcp/package.json` if MCP consumes axe-core directly.
- **Fix:** Run `npm install` from the project root. Verify `node_modules/axe-core/axe.min.js` exists. If the MCP engine (not just Glass/web) needs axe-core at test time, add the dep to `flint-mcp/package.json` as well (user claimed this landed; it has not).

### 3. **[WARNING]** `src/types/flint-api.d.ts` type declares `window.flintAPI.runtime.runAxe` without a preload implementation
- **Evidence:** `flint-api.d.ts:2203-2243` adds the full `runtime.runAxe` signature.
- **Impact:** TSC passes, giving a false sense of completeness. Runtime calls resolve `undefined`. This is the classic "types drift ahead of implementation" anti-pattern — exactly what your IPC Symmetry check is designed to catch.
- **Fix:** Either land Issue #1 or remove the type declaration until the implementation ships.

### 4. **[WARNING]** Dashboard integration test does not mount GovernanceDashboard
- **Evidence:** `src/components/ui/__tests__/GovernanceDashboard.runtime-merge.test.tsx:26-31` imports `RuntimeAuditAccordion` and `SourceAuthorityChip` only. No `import { GovernanceDashboard }`.
- **Impact:** Contract testBoundary `dashboard-merged-rendering` asserts "when GovernanceDashboard renders, renders one row with two source-authority chips" — this is not exercised. Tests pass because accordion behavior is sound in isolation, but the wiring between `useMergedA11yFindingsFromStore → GovernanceDashboard → RuntimeAuditAccordion` is not validated.
- **Fix:** Add one integration test that renders `<GovernanceDashboard>` with a populated `canvasStore.a11yViolations` + `canvasStore.runtimeFindings` and a mocked `useRuntimeAxeFlag() === true`, then asserts the merged row is visible.

### 5. **[WARNING]** RuntimeAuditGate wires a real button without a real `previewHtml` source
- **Evidence:** `src/components/editor/StatusBar.tsx:259` calls `void run({})` — the payload passes no HTML. The web handler short-circuits this to `{ status: 'no-preview' }`.
- **Impact:** Every user click from an Electron instance (when Issue #1 is fixed) or the web build will immediately resolve to `no-preview`. The feature's happy path is unreachable from the UI. A "No preview" caption renders; no actual audit runs.
- **Fix:** StatusBar (or the main-process handler) must source the current LivePreview iframe's HTML. Options: (a) capture iframe HTML via a renderer-side hook and pass via `request.previewHtml`; (b) handler reads the primary BrowserWindow's active webContents HTML directly. The contract anticipates (b) ("primary LivePreview CSP untouched" + "sandbox BrowserWindow loads HTML"), but the passing logic was never implemented.

### 6. **[WARNING]** Electron IPC test is a pure helper reproduction, not a handler invocation
- **Evidence:** `electron/__tests__/runtimeAxeIpc.test.ts:43-119` defines local copies of `axeImpactToSeverity`, `extractElementId`, and `normalizeAxeResults` and tests those. No call to `ipcMain.handle` or a real IPC flow.
- **Impact:** The 22+ tests prove the shape of utility functions but do not prove an actual handler is registered or reachable. Given Issue #1, this is consistent — there IS no handler to test — but the test name "IPC" is misleading.
- **Fix:** Once Issue #1 lands, rewrite this test to dispatch via a mock `ipcMain`/preload harness that exercises the real handler.

### 7. **[WARNING]** Latency benchmark missing
- **Evidence:** Contract invariants declare `electron/__tests__/runtime-adapter.bench.ts`. No such file.
- **Impact:** `runtime-audit-latency-p95` is asserted by trust only.
- **Fix:** Add a vitest benchmark covering a 1000-node fixture, or downgrade the invariant to "measured in integration testing post-ship."

## TODOs That Survived

- **Integration test for GovernanceDashboard-level merging** (Issue #4) — the contract `dashboard-merged-rendering` boundary is only partially covered.
- **Latency benchmark file** (Issue #7).
- **Real `previewHtml` capture** from LivePreview (Issue #5).
- **Electron handler + preload** (Issue #1) — this is the feature's Electron backbone, missing entirely.

## Verdict: FIX

The feature is not shippable in its current state on Electron. The web build has working infrastructure (server handler, Playwright lazy import, route blocker, normalizer) but is blocked by Issue #2 (axe-core not installed). Electron has zero implementation despite the contract, type declarations, and UI wiring being present. The test suite is green because it exercises helpers in isolation rather than the real IPC pathway — this is the integration gap your validator exists to catch.

### FIX Assignments

| Issue # | Assigned Agent | Fix Description |
|---------|---------------|----------------|
| 1 | flint-electron-ipc | Add `ipcMain.handle('runtime:run-axe', …)` in electron/main.ts with sandboxed BrowserWindow lifecycle, tight CSP, axe bundle injection, Zod validation via `runtimeRunAxePayloadSchema`/`runtimeRunAxeResponseSchema`, and `contextBridge` exposure under `runtime.runAxe` in preload.ts. |
| 2 | flint-electron-ipc | Run `npm install` to materialize `node_modules/axe-core`. Add `axe-core@4.10.3` to `flint-mcp/package.json` if MCP-side code references it. Verify `server/index.ts` bundle-resolution paths succeed. |
| 3 | flint-electron-ipc | After Issue #1 lands, remove the "IPC surface not available" bailout branch in `useRuntimeAudit.ts:98-112` — it becomes dead once the preload is real. |
| 4 | flint-test-writer | Add `GovernanceDashboard.runtime-merge` tests that mount `<GovernanceDashboard>` with realistic store state and flag-on, asserting merged rows render with two chips inline (not in the accordion). |
| 5 | flint-design-engineer | Wire RuntimeAuditGate `run()` call to pull real `previewHtml` from the active LivePreview (or have the main handler read it from webContents). Without this the feature is a "No preview" stub. |
| 6 | flint-test-writer | Convert `runtimeAxeIpc.test.ts` from helper reproductions to a handler-driven test once the main handler exists. |
| 7 | flint-test-writer | Add `electron/__tests__/runtime-adapter.bench.ts` covering 1000-node fixture latency assertion. |

## Invariants: Active vs. Trusted Summary

- **Actively verified (file-read proof):** 6/8 invariants — dedup-coverage, version-mismatch-graceful, empty-preview-handled, offline-resilience (structural), serialization, flag-off-ui-silent.
- **Taken on trust:** 2/8 — runtime-audit-latency-p95 (no bench file), csp-sandbox-isolation (no Electron handler exists to test against, so the "primary CSP unchanged" claim is vacuously true by omission).

## Notes

- TSC and test execution were not available in this validation sandbox. The reporter's counts (Glass 55/55, MCP 50/50) are accepted as stated but were not independently re-verified.
- The web-build parity path (`server/index.ts:4128-4392`) is the highest-fidelity landing of this feature. It would SHIP on its own if axe-core were installed. The Electron gap is the ship-blocker.
- The contract, types, stores, hooks, components, and tests are all internally consistent. What's missing is the single leg that actually connects the renderer to the DOM-layer engine on Electron. That is a one-agent fix (flint-electron-ipc), not a redesign.
