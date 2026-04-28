# TELEMETRY-WEB-TRANSPORT — Code Review (Round 1)

**Phase:** TELEMETRY-WEB-TRANSPORT (point release on `BETA-TELEMETRY-WIRING`)
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-26
**Round:** 1
**Verdict (derived):** FIX-FORWARD
**Counts:** 0 blocking · 3 warnings · 2 suggestions

---

## TL;DR

The Phase 2 patch is a clean, minimal wiring fix. `src/adapters/web-api.ts` gains a two-method `telemetry` namespace that conforms to the existing `flintAPI.telemetry` shape declared in `src/types/flint-api.d.ts`, and 44 new tests cover the contract's `testBoundaries`. TSC is clean (0 errors). All 27 web-api adapter tests, all 21 server telemetryIpc tests, and all 64 server index tests pass.

There are no blocking issues. The shipping path for `App.tsx` → `getConsent()` → `setShowTelemetryConsent(true)` → `<TelemetryConsentDialog>` → `setConsent()` is fully wired and traceable. The consent dialog will appear on first web boot.

The three warnings are about test fidelity, not the implementation. The two suggestions are stylistic.

## Verdict reasoning

`deriveVerdict(findings, 'code')`:
- 0 blocking findings → not BLOCK / FIX-BEFORE-SHIP / REDESIGN
- 3 warnings → FIX-FORWARD

Justin: this is shippable as-is. The warnings should be filed as follow-up work; none of them prevent the consent dialog from appearing in the closed beta.

---

## Scope reviewed

**Modified by Phase 2 (full review):**
- `src/adapters/web-api.ts` — added telemetry namespace at lines 611–616
- `src/adapters/__tests__/web-api.test.ts` — 18 new tests (WA-11* through WA-13*)
- `server/__tests__/telemetryIpc.test.ts` — 21 tests (TEL-01 through TEL-07)
- `server/__tests__/index.test.ts` — 5 new tests (IDX-SMOKE-01 through IDX-SMOKE-05)

**Direct callers (read-only verification):**
- `src/App.tsx` lines 786–811 (consent useEffect), 1483–1487 (dialog render)
- `src/components/ui/TelemetryConsentDialog.tsx` (calls `setConsent`)
- `server/index.ts` lines 2855–2894 (`mcp:call-tool` emits), 3450–3612 (telemetry handlers + boot)
- `src/types/flint-api.d.ts` lines 1746–1764, 2088–2099 (telemetry interface)
- `shared/ipc-validators.ts` lines 581–588 (Zod schemas — unchanged, exist as referenced)

**Skipped (per contract scope):**
- `electron/preload.ts`, `electron/main.ts`, `electron/betaTelemetry.ts` — explicit non-goals
- Pre-existing TSC errors in `electron/thumbnailGenerator.ts`, `electron/visualAuditor.ts` — out of scope

---

## Verifications performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run test:react -- --run src/adapters/__tests__/web-api.test.ts` | 27/27 passing |
| `npm test -- --run server/__tests__/telemetryIpc.test.ts` | 21/21 passing |
| `npm test -- --run server/__tests__/index.test.ts` | 64 passing, 10 todo |
| No Node imports in `src/adapters/web-api.ts` | confirmed |
| No `electron/betaTelemetry.ts` import in renderer | confirmed |
| Zod validators referenced exist in `shared/ipc-validators.ts` | confirmed |
| Channel strings match server handler keys | confirmed (`telemetry:get-consent`, `telemetry:set-consent`) |
| Pattern matches sibling `governance.*` namespace | confirmed |

---

## Findings

### WARN-1 — Security pin test exercises a code mirror, not the real handler

**Severity:** warning · **Scope:** one-file

**Evidence:**
- `server/__tests__/telemetryIpc.test.ts:107–122` — `webSetConsent()` mirror takes `consentDir` as a parameter and never reads `process.env.FLINT_TELEMETRY_SECRET`.
- `server/__tests__/telemetryIpc.test.ts:417–462` — TEL-06 sets `process.env.FLINT_TELEMETRY_SECRET = SENTINEL` and asserts the mirror's response body does not contain it.
- `server/index.ts:3480` — the real handler captures `webTelemetrySecret` once at server boot, in a closure. The mirror has no access to that closure.

**Observed:** The TEL-06 security pin tests assert that the mirror functions' response bodies do not contain the FLINT_TELEMETRY_SECRET env value. The mirror functions (`webReadConsent`, `webSetConsent`) never touch the env var at all, so these tests pass trivially regardless of whether the real handler in `server/index.ts:3595–3611` is leak-safe.

**Rationale:** This invalidates the security pin. The contract's stated invariant is "secret-never-crosses-process-boundary" — but the tests pin the mirror's behavior, not the real handler's. If a future refactor adds a debug log or a stack trace inclusion to the real handler that surfaces `webTelemetrySecret`, this test will not catch it. The other TEL-* tests have the same mirror gap, but TEL-06 is the only one whose value depends on testing the actual closure.

**Proposed fix:** Either (a) extract the consent read/write logic into an exported pure function in `server/index.ts` (or a new `server/services/webTelemetryConsent.ts` module) that the real handler and the test both import, so the test exercises the same code path, or (b) write a thin integration test that imports `startServer()` and POSTs to `/api/ipc` with `channel: 'telemetry:get-consent'` — there are 10 `it.todo` placeholders in `index.test.ts:765–774` already earmarked for live HTTP/WS round-trips.

---

### WARN-2 — Mirror divergence risk: real handler and test mirror can drift silently

**Severity:** warning · **Scope:** cross-file

**Evidence:**
- `server/__tests__/telemetryIpc.test.ts:64–66` — comment "These are close-mirror functions. If the real handler in server/index.ts changes, update these mirrors and this comment."
- `server/__tests__/telemetryIpc.test.ts:130–138` — `makeWebEmit()` mirror.
- `server/__tests__/telemetryIpc.test.ts:146–185` — `simulateMcpCallTool()` mirror.
- `server/index.ts:2864–2892` — the real `mcp:call-tool` emit logic.
- `server/index.ts:3496–3519` — the real `webReadConsentState` and `webEmit`.

**Observed:** All 21 `telemetryIpc.test.ts` tests run against locally-defined mirror functions, not against the real handlers in `server/index.ts`. The test file acknowledges this and says "update these mirrors" if the real handler changes — but there is no mechanism to detect when that has been forgotten.

**Rationale:** This is a known trade-off in `server/__tests__/` (per the comment in `index.test.ts:25–29` — "Tests that genuinely require startServer() (live HTTP/WS round-trip) are marked it.todo"). It's the established pattern, not a regression. But for telemetry specifically — where Risk R5 in the contract is "webEmit removed from mcp:call-tool handler" — a mirror test cannot fail when the real emit site is deleted. If someone removes line 2866 (`webEmit('mcp.tool_called', { toolName })`), every test in `telemetryIpc.test.ts` still passes.

**Proposed fix:** Add at least one test that imports the real `server/index.ts` and asserts the emit-call sites are present (e.g., a static-analysis test that greps the source for `webEmit('mcp.tool_called'`, `webEmit('audit.completed'`, `webEmit('app.launched'`, `webEmit('session.ended'`). This is the cheapest backstop — Risk R5 explicitly says "Add the parity test (Group B task 2)" and the current parity test is the mirror.

---

### WARN-3 — TEL-07 misnamed: contract says "fileCount=0 default" but real handler defaults to 1

**Severity:** warning · **Scope:** one-line

**Evidence:**
- Contract `TELEMETRY-WEB-TRANSPORT.contract.md` line 470–490 (test file): "TEL-07 — audit.completed defaults: tool result with no parseable JSON produces fileCount=0 and violationCount=0."
- `server/index.ts:2881` — `fileCount = typeof parsed.fileCount === 'number' ? parsed.fileCount : 1` (defaults to **1**, not 0).
- `server/__tests__/telemetryIpc.test.ts:471–490` — the test asserts `expect(payload.fileCount).toBe(1)` and the inline comment correctly documents "Server default: fileCount=1 when not in parsed JSON".

**Observed:** The header comment on TEL-07 (line 467) says "produces fileCount=0 and violationCount=0", but the assertion on line 488 says `expect(payload.fileCount).toBe(1)`. The contract's edge-case description in the testBoundaries also says "fileCount/violationCount default to 0".

**Rationale:** The test is correct (matches the real handler at `server/index.ts:2881`), but the documentation comment is misleading. A reader trying to triage a future failure will see "expected 0" in the comment and "expected 1" in the assertion and lose confidence in which is right. The contract's edge-case prose is also wrong relative to the real implementation.

**Proposed fix:** Update the TEL-07 docblock to read "produces fileCount=1 (default when key missing) and violationCount=0". Optionally update the contract markdown to match. One-line change.

---

### SUG-1 — Inline `import('../types/flint-api')` types are heavier than necessary

**Severity:** suggestion · **Scope:** one-line

**Evidence:**
- `src/adapters/web-api.ts:613` — `as Promise<import('../types/flint-api').ConsentRecord>`
- `src/adapters/web-api.ts:615` — same
- `src/adapters/web-api.ts:13` — file already has top-of-file imports for `notificationStore` and `ipc-validators`

**Observed:** The new namespace uses inline-import-type assertions twice. No other namespace in this file uses inline `import()` types. Other namespaces use either inline structural literal types (e.g., `as Promise<{ affectedFiles: number; ... }>`) or `as Promise<unknown>`.

**Rationale:** The contract requires the namespace to consume `ConsentRecord` without introducing new types. The inline `import()` form satisfies that constraint. But since `src/types/flint-api.d.ts` is already a global ambient declaration (`declare global { interface Window { flintAPI: FlintAPI }... }`), adding a top-of-file `import type { ConsentRecord, TelemetrySetConsentPayload } from '../types/flint-api'` (or referencing the type by its global name if available) would read more naturally and match the file's existing import style.

**Proposed fix:** At the top of the file, add `import type { ConsentRecord, TelemetrySetConsentPayload } from '../types/flint-api'`, then simplify the cast on line 613/615 to `as Promise<ConsentRecord>`. Also, type `payload` on line 614 as `TelemetrySetConsentPayload` instead of the inline `{ state: 'accepted' | 'declined' }` — that's the named type the rest of the codebase uses (`TelemetryConsentDialog.tsx:33`).

---

### SUG-2 — Global `afterEach` deletes FLINT_TELEMETRY_SECRET unconditionally

**Severity:** suggestion · **Scope:** one-line

**Evidence:**
- `server/__tests__/telemetryIpc.test.ts:54–59` — `afterEach(() => { ... delete process.env.FLINT_TELEMETRY_SECRET })`
- `server/__tests__/telemetryIpc.test.ts:420–426` — TEL-06 also sets/deletes the same var in its scoped beforeEach/afterEach

**Observed:** The global `afterEach` at the file level deletes `process.env.FLINT_TELEMETRY_SECRET` after every test. If a developer runs vitest from a shell that has the var pre-set (e.g., for live debugging the flush sink), the var will be wiped from the test process after the first test runs.

**Rationale:** Tests should not mutate environment variables that they did not set. If the var was set externally by the developer, the test should preserve it. This is a small papercut, not a functional bug — vitest workers don't propagate env changes back to the parent shell, so the developer's shell var is unaffected. But it can mislead a developer who loads the env var, runs a single TEL-06 test, and then runs a different test and finds `FLINT_TELEMETRY_SECRET` mysteriously empty.

**Proposed fix:** Capture the original value once at file load:
```ts
const ORIGINAL_TELEMETRY_SECRET = process.env.FLINT_TELEMETRY_SECRET
afterEach(() => {
  // ...
  if (ORIGINAL_TELEMETRY_SECRET === undefined) delete process.env.FLINT_TELEMETRY_SECRET
  else process.env.FLINT_TELEMETRY_SECRET = ORIGINAL_TELEMETRY_SECRET
})
```
Same change in TEL-06's scoped afterEach.

---

## Pattern fidelity check

The new namespace matches the existing `governance`, `tokens`, `baseline`, `policy` patterns in the file:
- Routes via `invoke()`
- Uses `as Promise<T>` for return-type narrowing (no `unknown` leakage to callers)
- No direct fetch / WebSocket calls
- Lives inside the `createWebFlintAPI()` factory return object
- Placement adjacent to `beta` namespace (telemetry is a sub-feature of the beta program)

No anti-patterns observed (no Node imports, no Zustand-store-inside-store, no `fs.writeFile`, no regex source surgery).

## Commandment audit

| # | Commandment | Status |
|---|---|---|
| 4 | Local-First Only | OK — all telemetry traffic optional and gated by `FLINT_TELEMETRY_URL`. Browser never holds the secret. |
| 9 | Process Boundary Law | OK — `src/adapters/web-api.ts` has zero Node imports. All operations route through `invoke()` to the server. |
| 13 | Deterministic Surgery | N/A — no AST changes. |
| 14 | Bypass Prohibition | OK — adapter never reads `~/.flint/beta-consent.json` directly; both methods are `invoke()` calls. |
| 16 | In-Memory Validation | N/A — no AI-generated code. |

## Test coverage assessment

The 44 new tests collectively cover:
- WA-11 / WA-11b / WA-11c — invariant: namespace presence (3 tests)
- WA-12 / WA-12b / WA-12c / WA-12d — `getConsent` happy paths + edge cases (4 tests)
- WA-13 / WA-13b / WA-13c — `setConsent` happy paths (3 tests)
- TEL-01a–d — `mcp.tool_called` + `audit.completed` parity (4 tests)
- TEL-02a–c — consent gate (3 tests)
- TEL-03a–c, TEL-04, TEL-04b–e — round-trip (8 tests)
- TEL-06a–c — security pin (3 tests; see WARN-1)
- TEL-07a–c — defaults on unparseable result (3 tests)
- IDX-SMOKE-01–05 — startTelemetry boot (5 tests)

Coverage of the contract's `testBoundaries` and `invariants`:
- `web-telemetry-namespace-present` (≥ 2 methods) — covered by WA-11, WA-11b, WA-11c
- `web-build-emits-tool-called` — covered by TEL-01 (in mirror; see WARN-2)
- `secret-never-crosses-process-boundary` — covered by TEL-06 (limited; see WARN-1)
- `boot-emits-app-launched` — covered by IDX-SMOKE-01

Coverage holes:
- No live HTTP/WS round-trip — all `it.todo` (acknowledged in `index.test.ts:765–774`)
- No test that asserts the renderer's `setConsent({ state: 'accepted' })` round-trips through the actual server handler and lands on disk — both halves are tested in isolation, but the seam is not.

The coverage holes are reasonable given the contract's scope (renderer-side adapter wiring + smoke verification of server side). They're not blocking.

## What remains for the consent dialog to appear

I traced `App.tsx:786–811` end-to-end and the path is complete:

1. `App.tsx:790` — useEffect on mount.
2. `App.tsx:791–795` — reads `window.flintAPI.telemetry?.getConsent`. With the new adapter, this is now a function in web mode (was `undefined` before Phase 2).
3. `App.tsx:800–804` — `getConsent()` resolves to `{ state: 'unset', sessionId: ... }` on first boot.
4. `App.tsx:803` — `setShowTelemetryConsent(true)` because `state === 'unset'`.
5. `App.tsx:1483–1487` — dialog renders.
6. User clicks Accept/Decline.
7. `TelemetryConsentDialog.tsx:54` — calls `setConsent({state})`.
8. Server `setConsent` handler writes `~/.flint/beta-consent.json`.
9. `onDecided(state)` → `setShowTelemetryConsent(false)` → dialog dismisses.

Nothing is missing. The dialog will appear on the next `npm run dev:web` boot (assuming `~/.flint/beta-consent.json` does not already exist — if it does, delete it first to test).

---

*Generated by flint-code-reviewer for the Phase 2.5 review ceremony.*
