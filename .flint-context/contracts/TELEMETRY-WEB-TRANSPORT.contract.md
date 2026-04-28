# TELEMETRY-WEB-TRANSPORT — Contract Artifact

**Phase:** TELEMETRY-WEB-TRANSPORT (point release on top of `BETA-TELEMETRY-WIRING`)
**Status:** APPROVED
**Audience:** designer
**Owner:** flint-architect
**Date:** 2026-04-26
**Beta freeze:** v0.3.0-beta.1 — IPC contract for the legacy Electron preload path is FROZEN.

## 1. Background

The closed beta ships the web build (`server/index.ts` + Express/WS) inside an Electron shell. The renderer talks to the server through `src/adapters/web-api.ts` over `POST /api/ipc` and `ws://host/ws`, **not** through `electron/preload.ts`. The preload bridge is legacy.

`BETA-TELEMETRY-WIRING` (shipped) wired telemetry into the legacy Electron path:

- `electron/betaTelemetry.ts` — full implementation (consent, queue, flush, redaction, emit).
- `electron/main.ts` — `ipcMain.handle('telemetry:get-consent' | 'telemetry:set-consent')`, `app.whenReady()` calls `startTelemetry()`, emits at `audit.completed` (line 2622) and `mcp.tool_called` (line 3893).
- `electron/preload.ts` — `flintAPI.telemetry.getConsent / setConsent` exposed.
- Web-parity twin already lives in `server/index.ts` lines 3452-3608 (consent handlers + `webEmit` + `startTelemetry()` boot at line 3568) and emits at `webEmit('mcp.tool_called')` line 2862, `webEmit('audit.completed')` line 2883, `webEmit('app.launched')` line 3563, `webEmit('session.ended')` line 4863.

**The bug:** `src/adapters/web-api.ts` does not expose a `telemetry` namespace. `window.flintAPI.telemetry` is `undefined` in the browser, so `App.tsx:790-810` falls through its defensive check and the consent dialog never appears. Telemetry is dead in the production path even though every server-side hook is wired.

## 2. Decision

This phase adds a `telemetry` namespace to `src/adapters/web-api.ts` that mirrors the existing `flintAPI.telemetry` interface defined by `BETA-TELEMETRY-WIRING.contract.ts`. Plus three smoke-quality verifications — server boot, parity emits, secret-on-server — that confirm the production surface is intact.

**Beta-safety:**
- The existing `ipcSchemas['telemetry:get-consent']` / `['telemetry:set-consent']` shape and Zod validators (`telemetryGetConsentResponseSchema`, `telemetrySetConsentPayloadSchema`) are **unchanged**. Frozen contract preserved.
- `electron/betaTelemetry.ts` is **unchanged**.
- The Electron preload path (`electron/preload.ts`) is **unchanged**. Legacy testers won't hit it.
- `src/types/flint-api.d.ts` `telemetry` interface is **unchanged** — the web adapter conforms to it, so `App.tsx` and `TelemetryConsentDialog.tsx` need zero edits.
- `src/components/ui/TelemetryConsentDialog.tsx` imports types from `BETA-TELEMETRY-WIRING.contract` — unchanged.

## 3. Impact Map

| File | Change | Owner | Summary |
|---|---|---|---|
| `src/adapters/web-api.ts` | MODIFY | flint-state-architect | Add `telemetry: { getConsent, setConsent }` namespace inside the object returned by `createWebFlintAPI()`. Routes both to `invoke('telemetry:get-consent')` and `invoke('telemetry:set-consent', payload)`. Shape must match `flintAPI.telemetry` in `src/types/flint-api.d.ts` (no new types). |
| `src/adapters/__tests__/web-api.test.ts` | MODIFY | flint-test-writer | Add tests covering: (a) `telemetry.getConsent` POSTs to `/api/ipc` with `channel: 'telemetry:get-consent'`, (b) `telemetry.setConsent({ state: 'accepted' })` POSTs `channel: 'telemetry:set-consent'`, args `[{ state: 'accepted' }]`, returns the parsed `ConsentRecord`. Reuse the existing fetch mock pattern in this file. |
| `server/__tests__/telemetryIpc.test.ts` | CREATE | flint-test-writer | Create the parity test file. Cover: `webEmit('mcp.tool_called', …)` runs inside the `mcp:call-tool` handler when consent is `accepted`, and the in-memory buffer contains one entry with `name: 'mcp.tool_called'` and (for audit-shaped tools) one entry with `name: 'audit.completed'`. |
| `server/__tests__/index.test.ts` | MODIFY | flint-test-writer | Add a smoke test confirming `startTelemetry()` runs as a side-effect of importing/booting the server (the `app.launched` event lands in the buffer when consent is `accepted`). This exists today (line 3568) — the test locks the behavior in. |
| `.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.md` | CREATE | flint-architect | This document. |
| `.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.ts` | CREATE | flint-architect | Executable `FlintContract`. |

**No edits to:** `electron/betaTelemetry.ts`, `electron/main.ts`, `electron/preload.ts`, `shared/ipc-validators.ts`, `src/types/flint-api.d.ts`, `src/App.tsx`, `src/components/ui/TelemetryConsentDialog.tsx`, `server/index.ts` (handlers + emits + boot already present).

## 4. Type Contracts

The web adapter consumes the existing types verbatim. **No new types are introduced.** Phase 2 imports from `BETA-TELEMETRY-WIRING.contract.ts`:

```ts
import type {
  ConsentRecord,
  TelemetrySetConsentPayload,
  TelemetryFlintAPI,
} from './BETA-TELEMETRY-WIRING.contract'
```

The `telemetry` field on the object returned by `createWebFlintAPI()` MUST be assignable to `TelemetryFlintAPI['telemetry']`:

```ts
telemetry: {
  getConsent: () => Promise<ConsentRecord>
  setConsent: (payload: TelemetrySetConsentPayload) => Promise<ConsentRecord>
}
```

## 5. IPC Channels

Both channels are already registered on the server. This contract changes **no Zod schema**. The renderer just stops calling them through a non-existent surface.

| Channel | Direction | Payload type | Return type | Handler | Validator (export from `shared/ipc-validators.ts`) |
|---|---|---|---|---|---|
| `telemetry:get-consent` | renderer→main | `void` (no args) | `ConsentRecord` | `server/index.ts:3591` (web) / `electron/main.ts:5690` (legacy) | `telemetryGetConsentResponseSchema` (response only — payload is void) |
| `telemetry:set-consent` | renderer→main | `TelemetrySetConsentPayload` | `ConsentRecord` | `server/index.ts:3595` (web) / `electron/main.ts:5694` (legacy) | `telemetrySetConsentPayloadSchema` |

The web `invoke()` transport already POSTs `{ channel, args }` to `/api/ipc`. The server already validates payloads inline (line 3597). The Zod export names are referenced for traceability — Phase 1.5 greps `shared/ipc-validators.ts` for both names.

## 6. Store Contracts

None. No store changes. Telemetry consent is read once on App mount via `App.tsx:790`, no global slice needed.

## 7. Component Contracts

| Component | File | Stores | IPC calls |
|---|---|---|---|
| `TelemetryConsentDialog` | `src/components/ui/TelemetryConsentDialog.tsx` (UNCHANGED) | none | `window.flintAPI.telemetry.setConsent` |

`App.tsx` (UNCHANGED) reads `window.flintAPI.telemetry.getConsent` on mount.

## 8. Commandment Audit

| # | Commandment | Applies | How this contract satisfies it |
|---|---|---|---|
| 4 | Local-First Only | YES | The flush sink is opt-in via `FLINT_TELEMETRY_URL`. With consent declined or `unset`, every emit is a no-op. With consent accepted but no URL, the queue is persisted to `~/.flint/telemetry-queue.json` (web path) and never leaves the host. |
| 13 | Deterministic Surgery | YES (negative) | This phase is renderer-side adapter wiring + tests. Zero AST modification. Zero source-code regex. |
| 14 | Bypass Prohibition | YES | `src/adapters/web-api.ts` keeps the IPC seam intact. The renderer never reads `~/.flint/beta-consent.json` directly — every consent operation is an `invoke('telemetry:get-consent' | 'telemetry:set-consent')` call. The server is the only writer. |
| 16 | In-Memory Validation | NO | No AI-generated code. Skip. |

Other commandments are not implicated — this is consent-IPC plumbing, not AST surgery, not styling, not export gating.

## 9. Implementation Order

| Group | Agent | Tasks |
|---|---|---|
| **A — single-file adapter** | flint-state-architect | (1) Add `telemetry: { getConsent, setConsent }` namespace inside `createWebFlintAPI()` in `src/adapters/web-api.ts`. Use the existing `invoke()` helper. Cast the return value to `ConsentRecord`. Both methods are one-liners. |
| **B — tests (parallel with A)** | flint-test-writer | (1) Add adapter tests in `src/adapters/__tests__/web-api.test.ts`. (2) Add server parity test in `server/__tests__/telemetryIpc.test.ts`. (3) Add server-boot smoke test in `server/__tests__/index.test.ts`. |
| **C — review** | flint-code-reviewer | Run after A and B converge. Verify no preload-bridge references slipped into the adapter, no Node imports in `src/`, the namespace placement is alphabetically reasonable inside the returned object. |

Group A and Group B can run in parallel because the adapter change is one block and the test file edits don't overlap with it.

## 10. Verification Plan (acceptance — owned by Justin, not the agent)

1. `npm run dev:web` with `FLINT_TELEMETRY_URL` and `FLINT_TELEMETRY_SECRET` set.
2. Open the browser. The TelemetryConsentDialog SHOULD render on first load (consent state was `unset`).
3. Click Accept. The dialog dismisses, `~/.flint/beta-consent.json` updates to `state: 'accepted'`.
4. Trigger an `audit_ui_component` MCP call from the IDE. Wait ≥ 70s.
5. `wrangler tail` shows the POST hitting the Worker; Slack receives the digest.

## 11. Risks

| # | Risk | Severity | Commandment | Mitigation |
|---|---|---|---|---|
| R1 | `web-api.ts` wires the namespace but mistypes the channel name (e.g., `telemetry:getConsent`) — server returns 404 silently. | medium | 14 | Tests in `web-api.test.ts` assert the exact channel string sent through `fetch`. Phase 1.5 grep verifies the validator export names match the server handler keys. |
| R2 | The renderer adapter accidentally imports `electron/betaTelemetry.ts` to "share types" and breaks the web build (Node-only imports). | high | 14 | Contract forbids it explicitly. Phase 2 imports types from `BETA-TELEMETRY-WIRING.contract.ts` ONLY (no Node imports). flint-code-reviewer must confirm. |
| R3 | The browser surfaces `FLINT_TELEMETRY_SECRET` because someone "exposes" it to debug a 401. | high | 4 | Secret stays on the server (`server/index.ts:3476`). The browser never sends or reads the secret — it only POSTs `{ channel, args }` to `/api/ipc` and the server attaches the `X-Flint-Secret` header before forwarding to the Worker. Tests assert the secret is never returned in any IPC response. |
| R4 | `startTelemetry()` is removed from `server/index.ts` during a future refactor and the flush timer never runs — events accumulate in memory and vanish on reload. | medium | none | Add the boot smoke test (Group B task 3). The test fails the moment the boot call is removed. |
| R5 | `webEmit('mcp.tool_called')` is removed from the `mcp:call-tool` handler — web users only emit `app.launched` and `session.ended`. | medium | none | Add the parity test (Group B task 2). |
| R6 | App.tsx is currently defensive (`typeof telemetryApi?.getConsent !== 'function'` short-circuits). After this contract lands, `getConsent` is always a function — but if it ever rejects, the dialog hides forever (privacy-safe fallback at line 808). That's intended, but verify the rejection path doesn't fire on healthy boots. | low | none | Tests must include a happy-path resolution that returns `state: 'unset'` so App.tsx flips `setShowTelemetryConsent(true)`. |

## 12. Non-Goals

- **No new IPC channels.** Frozen at `v0.3.0-beta.1`.
- **No changes to `electron/betaTelemetry.ts`.** Reuse as-is.
- **No changes to the Electron preload bridge.** Legacy path remains broken; no testers hit it.
- **No new SDK dependency** (no PostHog, Sentry, Snowplow, etc.). Native `fetch` only.
- **No emit-site additions.** All four event types (`app.launched`, `audit.completed`, `mcp.tool_called`, `session.ended`) already fire in `server/index.ts`. The contract verifies parity, it does not extend.
- **No consent-store slice.** Consent lives on disk, not in Zustand.
- **No retry policy changes.** The existing 3x retry on `invoke()` (web-api.ts:238) is sufficient; no separate telemetry-channel retry.
- **No browser-side queue.** The buffer lives on the server. The browser is a thin RPC client.

## 13. Self-Check (architect pre-flight)

| # | Check | Status |
|---|---|---|
| 1 | Audience declared | `designer` (Glass renderer). Declared. |
| 2 | Invariants falsifiable | One declared with `<` operator. |
| 3 | TestBoundary given/when/then | All five boundaries have given/when/then; `then` starts with `returns`/`writes`/`emits`/`renders`/`calls`. |
| 4 | IPC validators linked | Both channels link to existing exports in `shared/ipc-validators.ts`. |
| 5 | nonGoals ≥ 1 | Seven listed. |
| 6 | Types compile standalone | Contract `.ts` only imports from `./BETA-TELEMETRY-WIRING.contract` and `../../shared/contract-schema`. No `src/` imports. |
| 7 | Owners are real agents | `flint-state-architect`, `flint-test-writer`, `flint-code-reviewer`, `flint-architect` all exist in `.claude/agents/`. |
| 8 | Parallelism groups cover all files | All impact entries map to A, B, or C. |
| 9 | Commandment audit | 4, 13, 14 explicitly addressed. |
| 10 | Markdown ↔ TypeScript agree | Two IPC channels, no new types, three commandments — same in both files. |
