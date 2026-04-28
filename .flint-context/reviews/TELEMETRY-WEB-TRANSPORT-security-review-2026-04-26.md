# Security Review — TELEMETRY-WEB-TRANSPORT

- **Phase:** TELEMETRY-WEB-TRANSPORT
- **Dimension:** Security
- **Reviewer:** flint-security-reviewer
- **Date:** 2026-04-26
- **Round:** 1
- **Sibling:** [TELEMETRY-WEB-TRANSPORT-security-review-2026-04-26.review.ts](./TELEMETRY-WEB-TRANSPORT-security-review-2026-04-26.review.ts)

## Verdict

**FIX-FORWARD** — 0 blocking, 3 warnings, 2 suggestions.

The threat model holds. `FLINT_TELEMETRY_SECRET` does not cross the process boundary on any path I could trace — it is read from `process.env` only inside the server's outbound flush and the legacy Electron `betaTelemetry.ts`. The two telemetry IPC channels are guarded by Zod schemas at the **preload bridge** (Electron path) and by an inline string-equality check on the **server** (web path). The Cloudflare Worker contract — `X-Flint-Secret` header, KV TTL, timing-safe comparison, fail-closed when secret is missing — is unchanged and intact.

The warnings below are about defense-in-depth gaps, not active vulnerabilities. None of them widen the attack surface beyond what Justin already accepted at v0.3.0-beta.1.

## Threat-Model Question Walkthrough

### 1. Secret hygiene — invariant `secret-never-crosses-process-boundary`

**Holds.** Traced every reference to `FLINT_TELEMETRY_SECRET`:

- `electron/betaTelemetry.ts:32` reads it once into a module-scoped const, attaches to outbound `X-Flint-Secret` header only.
- `server/index.ts:3480` reads it once into `webTelemetrySecret`, attaches to outbound `X-Flint-Secret` header only (3534).
- Neither value is referenced inside `webReadConsent`, `webSetConsent`, or any IPC response builder.
- The TEL-06a/b/c security pin tests in `server/__tests__/telemetryIpc.test.ts:417-466` set the env var to a sentinel and assert the response body cannot contain it. Tests are correctly scoped.

**No path** found from secret → renderer. The renderer can call `getConsent` and `setConsent`; neither handler reads `process.env.FLINT_TELEMETRY_SECRET`.

### 2. IPC widening — was the channel reachable before this change?

**Yes, already reachable.** The two server-side handlers (`server/index.ts:3595` / `:3599`) were registered in the `handlers` Map at server boot. The `/api/ipc` POST endpoint at `server/index.ts:4500-4539` dispatches on channel-name string lookup against that map with no allowlist.

A motivated attacker with localhost access could already POST `{"channel":"telemetry:get-consent","args":[]}` to `/api/ipc` and receive the consent record. This change does not widen the attack surface — it only adds a typed wrapper inside the same already-open dispatcher. **Scope unchanged.**

That said, the dispatcher's open-by-default policy is a pre-existing design choice (out of scope for this review) — see WARN-3 below.

### 3. Validator coverage

**Partial.** The Zod schemas exist in `shared/ipc-validators.ts:581-590` as named exports, and they are wired into the **Electron preload** at `electron/preload.ts:1694-1705` (defense-in-depth: validate response on the way back, validate payload before `ipcRenderer.invoke`).

They are **not** wired into:

- The web adapter `src/adapters/web-api.ts:613-616`. The methods cast the `invoke()` result to `Promise<ConsentRecord>` with no runtime parse. A malformed server response would propagate to the renderer unchecked.
- The server-side handler `server/index.ts:3599-3611`. The handler does a manual string comparison (`p?.state !== 'accepted' && p?.state !== 'declined'`) instead of `telemetrySetConsentPayloadSchema.parse(payload)`. The check is functionally correct for the two-value enum, but it duplicates the schema rather than referencing it — a refactor that adds a third state would have to update two places.
- The `ipcSchemas` registry. Both schemas are loose named exports, so they cannot be retrieved by `ipcSchemas['telemetry:set-consent'].payload` the way other channels are. This is what flint-code-reviewer flagged in the BETA-TELEMETRY-WIRING round (BLK-3 was closed by adding the schemas, but the registry-membership gap was deferred). See WARN-1.

### 4. Browser supply chain

**Clean.** The new code in `web-api.ts:611-616` introduces no new imports. It reuses the existing `invoke()` helper and uses a TypeScript type-only import (`import('../types/flint-api').ConsentRecord`) which compiles to nothing at runtime. No new transitive dependencies, no new untyped escapes.

The `as Promise<ConsentRecord>` cast (suggestion SUG-1) is the typical adapter pattern; the rest of the file uses the same shape.

### 5. Cloudflare Worker contract

**Intact.** Re-verified `cloudflare-worker/src/index.ts`:

- `SHARED_SECRET` fail-closed at line 125-128 (returns 503 if missing).
- `X-Flint-Secret` header check via `timingSafeEqualStrings` at lines 103-109 — uses `crypto.subtle.timingSafeEqual` and bails on length mismatch before the timing-equal call.
- Discriminated union schema at lines 65-82 unchanged. Every event must match exactly one of the five variants.
- KV TTL = 14 days (line 93), MAX_BODY_BYTES = 64KB (line 97), event count cap = 100 (line 85).
- Slack mrkdwn injection via `escapeForSlackInlineCode` (line 226) — strips backticks and HTML entity-escapes `<`, `>`, `&`. Defends against `<!channel>` broadcast pings, `<@U…>` mentions, and `<http://evil|click>` link rewrites.

The browser → server → Worker pipeline is unchanged: the renderer never POSTs to the Worker. The server batches events from the in-memory buffer and forwards from `webFlushTelemetry()` (server/index.ts:3521-3552) using the secret it read at boot. The renderer's only role is to flip the consent state on disk; the consent gate at `server/index.ts:3509` short-circuits all emit calls when state ≠ `'accepted'`.

### 6. Privacy contract — can the browser cause an event without consent?

**No, holds.** Three independent gates:

1. The browser cannot directly invoke `webEmit`. It can only call `setConsent` or trigger MCP tool calls. MCP-tool-call telemetry runs through `webEmit` server-side (`server/index.ts` mcp:call-tool handler), which calls `webReadConsentState()` at line 3509 before pushing to buffer.
2. The buffer flush is a separate timer; if it fires with consent ≠ `'accepted'`, no events are emitted because the buffer was never populated.
3. The Worker independently rejects unsigned requests; even if the browser could somehow submit raw events, it cannot reach the Worker (no `X-Flint-Secret`).

**Edge case (not exploitable but worth noting):** The browser can flip consent to `'accepted'`, triggering MCP calls (which now buffer events), then flip consent back to `'declined'` before the next 60-second flush. The buffer is in-memory and not cleared on consent change. Events captured during the accepted window will still flush on the next interval. This is the **correct** semantics — the user accepted at the time of capture — but worth pinning explicitly. See SUG-2.

### 7. Test isolation — security pin uses sentinel?

**Yes, correctly isolated.** `server/__tests__/telemetryIpc.test.ts:418` defines `SENTINEL = 'TEST_SECRET_SENTINEL_a7f3c9e1'` and sets `process.env.FLINT_TELEMETRY_SECRET = SENTINEL` in `beforeEach`. The tester's real `.env` cannot leak because the test always overwrites the env var with the sentinel before assertions, and the `afterEach` deletes the var (line 58, 425). Same pattern in `electron/betaTelemetry.test.ts:81-94`.

## Findings

### WARN-1 — Telemetry schemas not registered in `ipcSchemas` map

- **Severity:** warning
- **Scope:** one-file
- **Commandment:** 14 (Bypass Prohibition — IPC must go through validated wrappers)
- **Evidence:**
  - `shared/ipc-validators.ts:581` `telemetryGetConsentResponseSchema` — named export, no `ipcSchemas['telemetry:get-consent']` entry.
  - `shared/ipc-validators.ts:588` `telemetrySetConsentPayloadSchema` — same.
  - `shared/ipc-validators.ts:288-291` precedent for the correct pattern: `getCoverageSummaryPayloadSchema = ipcSchemas['flint:getCoverageSummary'].payload`.

**Observed:** Both telemetry schemas live as standalone named exports outside the `ipcSchemas` registry. The Phase 1.5 contract linter and the Phase 3 integration validator key off the registry to verify "every channel has a validator" — these channels are addressable only by name lookup and would slip past automated coverage checks.

**Rationale:** The named exports are technically sufficient for the Electron preload (which imports them directly), but they create two parallel validation surfaces. A future refactor that swaps `ipcSchemas` for a stricter registry-only contract would silently regress these channels. This was already flagged in the BETA-TELEMETRY-WIRING code review (`.flint-context/reviews/BETA-TELEMETRY-WIRING-code-review-2026-04-25.review.ts:140-160`) and was deferred. The current change inherits the gap.

**Proposed fix:** Add `'telemetry:get-consent'` and `'telemetry:set-consent'` entries to the `ipcSchemas` object in `shared/ipc-validators.ts`. Redefine the named exports as `ipcSchemas['telemetry:*'].response` / `.payload` (same pattern as `getCoverageSummaryResponseSchema`). No call-site changes needed because the named exports stay grep-stable. Out of scope for this contract per `nonGoals` line 309 — flag for follow-up.

---

### WARN-2 — Web adapter does not validate the response from `/api/ipc`

- **Severity:** warning
- **Scope:** one-file
- **Commandment:** 14
- **Evidence:**
  - `src/adapters/web-api.ts:613` `getConsent: () => invoke('telemetry:get-consent') as Promise<…>`
  - `src/adapters/web-api.ts:614-615` `setConsent: (payload) => invoke('telemetry:set-consent', payload) as Promise<…>`
  - `electron/preload.ts:1694-1695` for contrast: `const raw = await ipcRenderer.invoke('telemetry:get-consent'); return telemetryGetConsentResponseSchema.parse(raw)`.

**Observed:** The web adapter casts the response to `ConsentRecord` without parsing. The Electron preload validates with `telemetryGetConsentResponseSchema.parse(raw)` on every call. The web build inherits the same threat model (a malicious or buggy server can return an unexpected shape) but skips the runtime check.

**Rationale:** In the Electron path, the server is in-process and trusted, so response validation is belt-and-braces. In the web path, the server is a separate process reachable over loopback HTTP — the same boundary that warrants validation in the Electron case. The renderer code that consumes the cast (`App.tsx:802` `record.state === 'unset'`) doesn't crash on malformed input but could mis-decide whether to show the consent dialog. Privacy impact is bounded: a malformed response causes the dialog to NOT show, which is the privacy-safe failure (no telemetry emits because consent stays `'unset'`).

**Proposed fix:** Wrap both calls with the existing schemas:

```ts
telemetry: {
  getConsent: async () => {
    const raw = await invoke('telemetry:get-consent')
    return telemetryGetConsentResponseSchema.parse(raw)
  },
  setConsent: async (payload) => {
    const validated = telemetrySetConsentPayloadSchema.parse(payload)
    const raw = await invoke('telemetry:set-consent', validated)
    return telemetryGetConsentResponseSchema.parse(raw)
  },
},
```

Mirrors `electron/preload.ts:1693-1706` exactly. Adds two imports from `shared/ipc-validators.ts`. Touches one file. Adopts the same pattern as the existing `mcp.callTool` validation at `web-api.ts:514-519`.

---

### WARN-3 — `/api/ipc` dispatcher accepts any channel name from any localhost client

- **Severity:** warning
- **Scope:** architectural
- **Commandment:** 14
- **Evidence:**
  - `server/index.ts:4500-4539` — POST `/api/ipc` dispatches by string lookup with no origin check, no auth, no channel allowlist.
  - `server/index.ts:705-707` — the WS-token endpoint is bound to localhost ("only reachable from localhost") but `/api/ipc` has no equivalent guard in code (it inherits from the binding only).

**Observed:** Any local process — a browser extension, a malicious VS Code extension, another Electron app, a curl from a terminal — can POST to `localhost:<port>/api/ipc` and invoke any handler. There is no CORS preflight enforcement, no origin allowlist, and no per-channel ACL. The telemetry channels are the latest addition; this is a pre-existing design choice that grew with the surface.

**Rationale:** This is not a regression introduced by the telemetry change — it predates v0.3.0-beta.1. But because the security review is for the channel addition, the right thing to do is name the inherited risk. A malicious local actor could:

1. Read consent state (`telemetry:get-consent`) — low impact, exposes a UUID.
2. Flip consent to `'accepted'` (`telemetry:set-consent`) — could enable telemetry against the user's wishes.
3. Invoke any other handler in the registry — file reads, MCP tool calls, etc. (orthogonal to this review).

**Proposed fix:** Out of scope for this contract. Track as a separate hardening pass: add a per-process token to `/api/ipc` similar to the WS auth flow, or restrict to same-origin via `Origin` header check. The Electron path is unaffected because IPC is in-process. This is a web-only concern.

**Status:** open — flag for backlog. Do not block this phase.

---

### SUG-1 — Inline `as Promise<ConsentRecord>` cast pattern

- **Severity:** suggestion
- **Scope:** one-line
- **Evidence:**
  - `src/adapters/web-api.ts:613` `as Promise<import('../types/flint-api').ConsentRecord>`

**Observed:** The adapter uses an inline dynamic-import type annotation rather than a top-of-file `import type`. The rest of the file mostly uses inline annotations, so this matches local style — but a `import type { ConsentRecord, TelemetrySetConsentPayload } from '../types/flint-api'` at the top would be slightly more discoverable.

**Rationale:** Stylistic, not a security issue. Mentioned only because if WARN-2 is implemented, you'll need a real top-level `import` for the Zod schemas anyway, and pulling the types up at the same time is a tidy combined edit.

---

### SUG-2 — Buffer not cleared on consent flip from 'accepted' → 'declined'

- **Severity:** suggestion
- **Scope:** one-file
- **Evidence:**
  - `server/index.ts:3484` `let webTelemetryBuffer: Array<…> = []` — module-scoped buffer.
  - `server/index.ts:3599-3611` `telemetry:set-consent` handler — writes new state but does not touch `webTelemetryBuffer`.

**Observed:** If a user accepts, generates events, then declines before the next 60-second flush, the buffered events will still flush on the next interval. The events were captured during the accepted window so this is the correct semantics — but it could surprise a privacy-conscious user who declined "to stop sending data."

**Rationale:** Defensible either way. The conservative-privacy reading is: declining → drop buffered events, even though they were captured under consent. The literal-consent reading is: events were captured under consent, ship them. Both are defensible; the project should pick one and document it. The current behavior is "literal-consent." If the desired semantics is "conservative," add `webTelemetryBuffer = []` inside the `telemetry:set-consent` handler when `next.state === 'declined'`.

**Proposed fix:** Either (a) document current behavior in `TelemetryConsentDialog.tsx` ("Decline stops new events; previously buffered events from this session may still send"), or (b) clear the buffer on transition to declined. (b) is one line.

## Rubric

| Criterion | Result | Evidence |
|---|---|---|
| `FLINT_TELEMETRY_SECRET` not referenced in any IPC response builder | pass | server/index.ts:3578-3611, electron/main.ts:5698-5705 — neither handler reads the env var |
| Security pin test (TEL-06) uses sentinel, not real secret | pass | server/__tests__/telemetryIpc.test.ts:418 SENTINEL = 'TEST_SECRET_SENTINEL_a7f3c9e1' |
| Cloudflare Worker fail-closed without SHARED_SECRET | pass | cloudflare-worker/src/index.ts:125-128 returns 503 |
| Cloudflare Worker uses timing-safe comparison | pass | cloudflare-worker/src/index.ts:131 `timingSafeEqualStrings` |
| Worker rejects oversized bodies (DOS guard) | pass | cloudflare-worker/src/index.ts:139 MAX_BODY_BYTES = 64KB |
| Worker uses discriminated union (no extra event types) | pass | cloudflare-worker/src/index.ts:74-82 |
| Slack mrkdwn injection neutralised | pass | cloudflare-worker/src/index.ts:226 escapeForSlackInlineCode |
| Renderer-emitted events gated by consent state | pass | server/index.ts:3509 webEmit consent gate |
| Telemetry IPC payload validated with Zod at preload (Electron) | pass | electron/preload.ts:1694-1705 |
| Telemetry IPC response validated with Zod at preload (Electron) | pass | electron/preload.ts:1695, 1705 |
| Telemetry IPC response validated at web adapter | fail | src/adapters/web-api.ts:613-616 — see WARN-2 |
| Telemetry schemas registered in `ipcSchemas` map | fail | shared/ipc-validators.ts:581-590 — see WARN-1 |
| Server-side handler validates payload (web) | pass | server/index.ts:3601 — manual enum check, functionally correct |
| Web adapter introduces no new transitive imports | pass | src/adapters/web-api.ts:613-616 |
| `/api/ipc` dispatcher has channel allowlist or origin check | fail | server/index.ts:4500-4539 — see WARN-3 (pre-existing) |
| Browser cannot cause emit without consent (privacy contract) | pass | server/index.ts:3509 — buffer is server-side only |
| WS upgrade authenticated | pass | server/index.ts:712-728 — token check before handleUpgrade |
| Buffer cleared on consent flip to declined | n/a | SUG-2 — design choice, not a security violation |

## Scope Coverage

**Reviewed:**

- `src/adapters/web-api.ts` (telemetry namespace addition, lines 611-616)
- `server/index.ts` (telemetry handlers + flush + consent file IO, lines 3456-3612 + dispatcher 4500-4539)
- `shared/ipc-validators.ts` (Zod schemas for the two channels, lines 570-592)
- `src/types/flint-api.d.ts` (ConsentRecord and TelemetrySetConsentPayload types, lines 1744-1764)
- `cloudflare-worker/src/index.ts` (full file, 244 lines)
- `electron/main.ts` (telemetry handlers, lines 5693-5705; FLINT_TELEMETRY_SECRET grep — only referenced in betaTelemetry.ts)
- `electron/preload.ts` (telemetry namespace, lines 1688-1707)
- `electron/betaTelemetry.ts` (FLINT_TELEMETRY_SECRET usage, line 32)
- `electron/betaTelemetry.test.ts` (test isolation, lines 80-94 + 356-470)
- `server/__tests__/telemetryIpc.test.ts` (security pin TEL-06, lines 400-466)
- `src/components/ui/TelemetryConsentDialog.tsx` (full file, 195 lines)
- `src/App.tsx` (telemetry hook, lines 786-811)
- `.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.ts` (full contract, 341 lines)

**Skipped:**

- `electron/thumbnailGenerator.ts`, `electron/visualAuditor.ts` — out of scope per task framing (pre-existing TSC errors).
- `flint-mcp/src/server.ts` — telemetry path does not invoke MCP tools.
- All non-telemetry IPC handlers in `server/index.ts` and `electron/main.ts` — out of scope.
