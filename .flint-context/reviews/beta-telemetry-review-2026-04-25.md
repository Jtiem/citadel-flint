# Beta Telemetry — Code Review

**Phase:** Beta Distribution / Phase 4 (Telemetry)
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-25
**Round:** 1
**Verdict:** FIX-BEFORE-SHIP (derived)
**Files reviewed:**
- `electron/betaTelemetry.ts`
- `electron/betaTelemetry.test.ts`
- `docs/strategy/BETA-CLOSED-PLAN.md` (spec)

---

## Summary

The telemetry module is a clean, dependency-free implementation that lines up with most of the Phase 4 spec: consent gating, persistent queue, 60-second flush interval, flush-on-quit, and an `uncaughtException` crash hook. The code is small, readable, and the test file covers the consent state machine, queue accumulation, event-shape envelope, and the no-op decline path.

However, the implementation is **not yet wired into the app.** There is no IPC channel, no preload bridge, no Zod validator, and no UI consent dialog. The plan calls for a first-launch consent dialog (Phase 3.3) — without an IPC surface there's no way for the renderer to call `setConsent`. That's the largest gap.

The other meaningful gaps: the spec says telemetry is "on by default" with a decline toggle, but the implementation defaults to `'unset'` and treats `'unset'` as no-op (effectively opt-in). The queue uses `userData/...` per the spec but actually writes to `~/.flint/` (not `app.getPath('userData')`). And several spec'd events (`audit.completed`, `mcp.tool_called`, `session.ended` body) have no emit sites yet — emit is defined but never called from the audit pipeline or MCP client.

The code itself is well-scoped. The findings below are about closing the loop, not rewriting it.

---

## Findings

### BLK-1 — Spec contradiction: "on by default" vs. opt-in default state

**Severity:** blocking · **Scope:** one-line · **Commandment:** —

The plan states (Phase 4 / line 12 and Phase 3.3): *"Telemetry: **on by default**, with consent dialog on first launch and a decline toggle"* and the consent dialog wording is *"Flint Beta sends anonymous usage events..."*

The implementation (`betaTelemetry.ts:104`) does the opposite:

```ts
if (consent.state !== 'accepted') return
```

First-run state is `'unset'` (`betaTelemetry.ts:59`), which means `emit()` is a no-op until the user explicitly clicks Accept. That's opt-in, not on-by-default-with-decline.

**Why it matters:** Either the spec or the code is wrong, but they have to agree before shipping. The current code is the *safer* (privacy-first) interpretation, but it will lose `app.launched` events from users who quit before the consent dialog appears, and it contradicts the documented decision in the plan's decision log.

**Proposed fix:** Confirm with Justin which behavior is intended. If "on by default": treat `'unset'` as accepted-pending-decision and gate only on `'declined'`. If opt-in: update the plan's decision log and the consent copy ("...will send..." instead of "sends"). My recommendation is opt-in (current code) — it's the GDPR-defensible default and the cost is minor.

---

### BLK-2 — Module is not wired to the app

**Severity:** blocking · **Scope:** cross-file · **Commandment:** —

`startTelemetry()` and `setConsent()` are exported but never imported anywhere in `electron/main.ts`, `electron/preload.ts`, or `src/`. Verified with:

```
grep -rn "betaTelemetry\|startTelemetry\|setConsent" electron/ src/
# (no matches outside the module itself)
```

**Why it matters:** No telemetry will be emitted in production, no consent dialog can be shown (the renderer has no IPC path to call `setConsent`), and the four event sites listed in spec 4.1 (`mcp.tool_called`, `audit.completed`, `session.ended` body, etc.) have no callers.

**Proposed fix:** Add IPC channels (`telemetry:get-consent`, `telemetry:set-consent`) with Zod validators in `shared/ipc-validators.ts`, expose them via `contextBridge` in `preload.ts`, declare them in `src/types/flint-api.d.ts`, call `startTelemetry()` from `app.whenReady()` in `main.ts`, and add emit sites at the audit/MCP-tool boundaries.

---

### BLK-3 — IPC contract missing entirely

**Severity:** blocking · **Scope:** cross-file · **Commandment:** 9 (Process Boundary), implicit IPC validation invariant

The renderer needs to read consent state (to decide whether to show the first-run dialog) and write it (Accept/Decline buttons). There is no `telemetry:*` channel in `shared/ipc-validators.ts` and no entry in `preload.ts`.

**Why it matters:** Per the v2.1 contract hardening (CLAUDE.md: "every renderer→main IPC channel has a Zod validator"), the consent dialog cannot ship without the validator pair. This is a hard architectural rule, not a nicety.

**Proposed fix:**

```ts
// shared/ipc-validators.ts
export const TelemetrySetConsentInput = z.object({
  state: z.enum(['accepted', 'declined']),
});
export const TelemetryConsentOutput = z.object({
  state: z.enum(['unset', 'accepted', 'declined']),
  decidedAt: z.string().optional(),
  sessionId: z.string().uuid(),
});
```

Wire as `telemetry:get-consent` (no input) and `telemetry:set-consent` (validated input). Both belong in the renderer-allowed list.

---

### WARN-1 — Spec says `userData/`, code writes to `~/.flint/`

**Severity:** warning · **Scope:** one-line · **Commandment:** —

Spec (Phase 4.2): *"Queue persisted to `userData/telemetry-queue.json`"*

Code (`betaTelemetry.ts:43-50`):

```ts
const dir = path.join(os.homedir(), BRAND.configDir)  // → ~/.flint/
```

`app.getPath('userData')` would resolve to `~/Library/Application Support/Flint` on macOS and `%APPDATA%\Flint` on Windows — the OS-conventional location, and the location referenced in the install guide's uninstall instructions (Phase 5).

**Why it matters:** Users who follow the uninstall guide (`rm -rf ~/Library/Application\ Support/Flint`) will leave `~/.flint/` orphaned with their consent state and queued events. This is also the correct location per Electron convention.

**Proposed fix:** Replace `os.homedir() + BRAND.configDir` with `app.getPath('userData')`. The MCP server reads `~/.flint/context.json` for Beacon, but telemetry is a Glass-only concern — they don't need to share a directory.

---

### WARN-2 — Synchronous fs in hot path

**Severity:** warning · **Scope:** one-file · **Commandment:** 12 (Atomic Queuing — applies in spirit)

`emit()` does `readFileSync` + `writeFileSync` synchronously on every call (`betaTelemetry.ts:114-116`). Spec 4.1 lists `mcp.tool_called` as an event — that fires on every tool invocation, potentially many per second during an audit run.

**Why it matters:** Synchronous JSON parse + serialize on a queue that grows monotonically until flush will become measurable around 100+ events. There's also a TOCTOU race if two emits interleave (read A, read B, write A+1, write B+1 — A is lost). The spec invariant *"Safe to call from hot paths — all I/O is best-effort"* in the file header is aspirational; the implementation isn't async.

**Proposed fix:** Either (a) keep an in-memory buffer and only persist on flush + before-quit, or (b) use append-only NDJSON instead of round-trip JSON parse. Option (a) is simpler and matches the 60s flush cadence — the only loss window is a hard crash, where the `uncaughtException` hook handles it anyway.

---

### WARN-3 — `app.crashed` payload may leak file paths via stack trace

**Severity:** warning · **Scope:** one-line · **Commandment:** —

`betaTelemetry.ts:145`:

```ts
emit('app.crashed', { stack: String(err?.stack ?? '').slice(0, 2000) })
```

Stack traces routinely contain absolute paths like `/Users/justin/Projects/SecretClient/src/...`. The plan's consent copy promises *"No file contents or design data leave your machine"* — file *paths* arguably leak project names (a form of design data).

**Why it matters:** Privacy claim mismatch. With 10 hand-picked beta users this is low risk, but the consent dialog text should match what's actually sent.

**Proposed fix:** Either redact the stack (replace `/Users/<name>/...` with `<homedir>/...`) before emit, or update the consent copy to "No file contents or design data leave your machine — except crash stack traces, which may include file paths."

---

### WARN-4 — `flint_get_context` / `mcp.tool_called` payload not defined

**Severity:** warning · **Scope:** one-line · **Commandment:** —

Spec 4.1 lists `mcp.tool_called` with "tool name only, **not args**" — but there's no shared schema for the payload, and the test only stubs `{ toolName: 'audit_ui_component' }` without enforcing that callers honor "tool name only."

**Why it matters:** Without a typed payload contract, future emit sites might leak args. This is the single biggest privacy footgun in a telemetry pipeline.

**Proposed fix:** Tighten `emit()` to a discriminated-union signature:

```ts
type TelemetryEvt =
  | { name: 'app.launched'; payload: { locale: string } }
  | { name: 'app.crashed'; payload: { message: string; stack: string } }
  | { name: 'mcp.tool_called'; payload: { toolName: string } }   // never args
  | { name: 'audit.completed'; payload: { fileCount: number; violationCount: number; durationMs: number } }
  | { name: 'session.ended'; payload: { durationMs: number } };
export function emit<E extends TelemetryEvt>(name: E['name'], payload: E['payload']): void
```

This makes the privacy guarantee a compile-time invariant.

---

### WARN-5 — Test coverage gaps: network failure, malformed queue, large payloads

**Severity:** warning · **Scope:** one-file · **Commandment:** —

Test file covers consent state, opt-out gating, event shape, and the "no URL" branch. Missing:

- **Network failure** (`mockNet.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))`) — verify queue is retained, not cleared.
- **HTTP non-2xx** (`mockNet.fetch.mockResolvedValueOnce({ ok: false, status: 500 })`) — same expectation.
- **Malformed queue file on disk** — test handles `readQueue()` returning `[]` when JSON is corrupt (the catch is there, but no test exercises it).
- **`X-Flint-Secret` header** — verify it's added when set, omitted when not.
- **`process.on('uncaughtException')` registration** — currently only `app.on` is mocked; the process listener path is untested.

**Why it matters:** The "offline-safe queue survives crashes" claim in the file header is the value prop of this module. None of the failure paths are tested.

**Proposed fix:** Add four tests covering the bullets above. Each is ~10 lines.

---

### SUG-1 — `flush()` not exported, can't be triggered manually

**Severity:** suggestion · **Scope:** one-line

`flush()` is module-private. For testing and for a "Flush now" debug command (useful during the 10-user beta), exporting it would be cheap.

---

### SUG-2 — No queue size cap

**Severity:** suggestion · **Scope:** one-line

If a user is offline for days, the queue can grow without bound. Cap at e.g. 10,000 events with a drop-oldest policy.

---

## Rubric

| Criterion | Result | Evidence |
|---|---|---|
| Implementation matches Phase 4 spec on event names | pass (3 of 5) | `app.launched` and `app.crashed` and `session.ended` emit sites exist in `startTelemetry`; `mcp.tool_called` and `audit.completed` have no callers |
| Consent default state matches spec ("on by default") | fail | BLK-1: code defaults to `unset` → opt-in |
| Queue location matches spec (`userData/`) | fail | WARN-1: writes to `~/.flint/` |
| Consent gating works for `unset` and `declined` | pass | tests at `betaTelemetry.test.ts:109-120` |
| Module is wired to app entry point | fail | BLK-2: no caller of `startTelemetry()` |
| IPC channels for consent have Zod validators | fail | BLK-3: no `telemetry:*` channel exists |
| `process.on('uncaughtException')` registered | pass | `betaTelemetry.ts:144` |
| `app.before-quit` flushes queue | pass | `betaTelemetry.ts:149-153` |
| Privacy claim ("no file contents") holds for all events | fail | WARN-3: stack trace may include project paths |
| Test covers network failure path | fail | WARN-5: no rejected-promise test |
| Test covers happy path + opt-out | pass | tests 4–6, 11–12 |
| TypeScript strict-clean | pass | no `any`, no `@ts-ignore` (file inspected) |
| Atomic write of queue file | fail | WARN-2: read-modify-write race possible |

---

## Spec fidelity scorecard

| Spec line | Status |
|---|---|
| Events: `app.launched` (version, OS, locale) | partial — locale + appVersion + platform present; OS == platform |
| Events: `app.crashed` via `uncaughtException` | implemented |
| Events: `mcp.tool_called` (name only) | not wired (no caller) |
| Events: `audit.completed` (file count, violation count, duration) | not wired |
| Events: `session.ended` (duration, active time) | not wired (called but with empty payload) |
| 60-second flush interval | implemented |
| Flush on `app.quit` | implemented (`before-quit`) |
| Queue persisted across crashes | implemented |
| Respects decline flag | implemented |
| Cloudflare Worker route | not yet defined; `cloudflare-worker/` exists but worker code not reviewed in this scope |
| Same Worker as feedback widget | not verifiable yet (worker source not part of this review) |

---

## Scope coverage

**Reviewed:**
- `electron/betaTelemetry.ts` (full file, 159 lines)
- `electron/betaTelemetry.test.ts` (full file, 207 lines)
- `docs/strategy/BETA-CLOSED-PLAN.md` (spec, full file)
- Cross-references in `electron/main.ts`, `electron/preload.ts`, `shared/ipc-validators.ts`, `src/types/flint-api.d.ts`, `shared/brand.ts`

**Skipped:**
- `cloudflare-worker/src/**` — worker transport not in scope for this review (mentioned in BETA-CLOSED-PLAN Phase 3.2, separate concern)
- Feedback widget UI (Phase 3) — separate file, separate review
- Expiry kill switch (Phase 2) — separate file, separate review
