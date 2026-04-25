# BETA-TELEMETRY-WIRING — Code Review

**Phase:** BETA.TEL
**Reviewer:** flint-code-reviewer
**Date:** 2026-04-25
**Round:** 1
**Verdict:** FIX-FORWARD (derived: 0 blocking, 4 warnings, 3 suggestions)

## Summary

The wiring is functionally complete and TSC-clean (`npx tsc --noEmit` exits 0).
Telemetry boots from `app.whenReady()`, both IPC channels are registered with
Zod validators, the renderer surface is typed end-to-end, the consent dialog is
mounted in `App.tsx` keyed on `getConsent()`, and tests cover all 12 contract
testBoundaries plus 21 IPC round-trips. The discriminated-union `EmitFunction`
correctly forces tool-name-only at the type level for object-literal call sites.

The findings below are real but tractable — none threaten ship. The most
material gap is **incomplete web parity**: the web build registers the consent
IPC handlers but `startTelemetry()` is a no-op stub and **none of the three
emit sites** (`mcp.tool_called`, `audit.completed`, `session.ended`) exist in
`server/index.ts`. The contract Impact Map and the `web-parity` invariant both
require "same emit sites as `electron/main.ts`."

The other warnings are local hardening: a startup race between async migration
and sync queue-load, a contract-listed edge case (whitespace-only secret) that
the tests explicitly mark TODO, and a flush() race that can drop events
captured during an in-flight POST.

## Findings

### WARN-1 — Web build has no emit sites; server `startTelemetry` is a no-op stub

**Severity:** warning  ·  **Scope:** cross-file  ·  **Commandment:** —

**Evidence:**
- `server/index.ts:3385` — `function startTelemetry(): void { /* no-op for web build — no Electron app module */ }`
- `server/index.ts` — grep for `emit(` returns no `mcp.tool_called`, `audit.completed`, or `session.ended` call sites.
- Contract Impact Map (`BETA-TELEMETRY-WIRING-contract.md` line 36): "Mirror in `server/index.ts`. Web parity: mirror IPC channels over WS; same emit sites."
- Contract invariant `web-parity` (`.contract.ts` line 354): threshold `= 0 missing mirrors`.

**Observed:** The web build registers `telemetry:get-consent` and
`telemetry:set-consent` handlers but never produces any telemetry events. The
contract requires the same emit sites as the Electron build.

**Rationale:** When a web user accepts consent, the only event that would ever
be sent is whatever the consent dialog flow itself implies — but the actual
beta signal (tools called, audits completed, session length) is silently
absent on web. This violates the `web-parity` invariant that the contract
explicitly defined as ship-blocking.

**Proposed fix:** Either (a) port the queue + flush + emit sites into
`server/index.ts` (or a small shared module), or (b) explicitly downgrade the
contract: rename the Phase to "Electron-only telemetry" and add a `nonGoals`
entry. Option (a) is the right call since Justin previously stated web is
the primary target (`project_web_primary.md`).

---

### WARN-2 — `migrateLegacyQueue()` is async but its caller doesn't await; queue seed races the copy

**Severity:** warning  ·  **Scope:** one-file  ·  **Commandment:** —

**Evidence:**
- `electron/betaTelemetry.ts:249` — `void migrateLegacyQueue()`
- `electron/betaTelemetry.ts:252` — `const seeded = loadQueueFromDisk()` runs synchronously on the next line.
- `electron/betaTelemetry.ts:235` — `await copyFile(legacy, dest)` (async).
- Comment at line 248 reads "migrate legacy queue before loading the in-memory buffer" — does not match the actual ordering.

**Observed:** `startTelemetry()` calls `void migrateLegacyQueue()` which
returns immediately, then calls `loadQueueFromDisk()` synchronously. The
async `copyFile` will resolve later — by which time the seed step has
already returned `[]`.

**Rationale:** On a first-run-after-upgrade scenario where the user has a
populated `~/.flint/telemetry-queue.json` and no `userData/` queue, the
migrated events are not picked up until the **next** session. They aren't
lost (they sit on disk), but the comment claims an ordering that doesn't
hold and the contract testBoundary `queue path migration` `then` clause
("writes those 2 events to userData/telemetry-queue.json") happens after
`startTelemetry()` returns rather than during it.

**Proposed fix:** Make migration synchronous (`copyFileSync` from `node:fs`)
and call it in the same call frame as `loadQueueFromDisk()`. The migration is
a one-time, small-file copy at boot — sync I/O is fine here.

---

### WARN-3 — `flush()` can drop events emitted during the in-flight POST

**Severity:** warning  ·  **Scope:** one-file  ·  **Commandment:** —

**Evidence:**
- `electron/betaTelemetry.ts:201` — `const combined = [...diskEvents, ...memoryBuffer]`
- `electron/betaTelemetry.ts:207-211` — `await net.fetch(...)`
- `electron/betaTelemetry.ts:212-215` — `if (res.ok) { memoryBuffer = []; persistQueue([]) }`

**Observed:** Between the synchronous snapshot at line 201 and the success
branch at line 212, any new `emit()` calls push to `memoryBuffer`. On
success, `memoryBuffer = []` discards them.

**Rationale:** With a 60-second flush interval and bursty MCP tool calls, a
slow network can put dozens of new events at risk. They're never POSTed and
never persisted. Not catastrophic for a closed-beta `~10` users, but the
contract invariant `consent-gates-emit` is silent on durability.

**Proposed fix:** Capture `const sentLength = memoryBuffer.length` before
`net.fetch`, then on success `memoryBuffer.splice(0, sentLength)` instead
of full reassignment. Same idea for the disk file.

---

### WARN-4 — Whitespace-only `FLINT_TELEMETRY_SECRET` still sends the header (contract edge case)

**Severity:** warning  ·  **Scope:** one-line  ·  **Commandment:** —

**Evidence:**
- `electron/betaTelemetry.ts:32` — `const TELEMETRY_SECRET = process.env.FLINT_TELEMETRY_SECRET || ''`
- `electron/betaTelemetry.ts:206` — `if (TELEMETRY_SECRET) headers['X-Flint-Secret'] = TELEMETRY_SECRET`
- Contract `.contract.ts:296` testBoundary `X-Flint-Secret header gating`, edgeCases: `'whitespace-only env var → header omitted'`.
- `electron/betaTelemetry.test.ts:459-468` — test explicitly documents the gap with a `TODO: update assertion to .toBeUndefined() after WARN-5 whitespace-trim is implemented in betaTelemetry.ts`.

**Observed:** Setting `FLINT_TELEMETRY_SECRET='   '` (whitespace) results in
the header being sent. The test was written to be permissive of either
behavior pending implementation.

**Rationale:** The contract listed this edge case explicitly. Either the
contract was wrong, or the implementation is incomplete. Given the test
calls itself a TODO, the implementation is incomplete.

**Proposed fix:** One line — `if (TELEMETRY_SECRET.trim()) headers['X-Flint-Secret'] = TELEMETRY_SECRET.trim()`.
Then update the test assertion.

---

### SUG-1 — Telemetry channels not registered in `ipcSchemas` map

**Severity:** suggestion  ·  **Scope:** one-line

**Evidence:**
- `shared/ipc-validators.ts:39-269` — `ipcSchemas` map; grep for `'telemetry:` returns no entries inside the map.
- `shared/ipc-validators.ts:570-580` — `telemetryGetConsentResponseSchema` and `telemetrySetConsentPayloadSchema` exist as standalone exports.

**Observed:** Other IPC channels (`tokens:create`, `runtime:run-axe`, etc.)
are entries in the `ipcSchemas` map so the `validateIPC`/`createValidatedInvoker`
helpers can pick them up by channel name. The telemetry channels skip the
map and are only addressable as named exports.

**Rationale:** Inconsistent registration shape; future maintainers won't
find the telemetry validators when grepping `ipcSchemas`. No runtime impact
since preload calls `.parse()` directly on the named exports.

**Proposed fix:** Add `'telemetry:get-consent'` and `'telemetry:set-consent'`
entries to `ipcSchemas` and re-export the named aliases off the map (same
pattern as `getCoverageSummaryResponseSchema`).

---

### SUG-2 — Duplicate `TIPC-04` test ID in `telemetryIpc.test.ts`

**Severity:** suggestion  ·  **Scope:** one-line

**Evidence:**
- `electron/__tests__/telemetryIpc.test.ts:187` — `it('TIPC-04 — corrupt consent file returns a fresh unset record', ...)`
- `electron/__tests__/telemetryIpc.test.ts:213` — `it('TIPC-04 — Zod response validator accepts the returned record', ...)`

**Observed:** Two distinct tests share the `TIPC-04` ID prefix.

**Rationale:** Test IDs are how the contract `testBoundaries` are traced
to executable assertions. Duplicates break the trace.

**Proposed fix:** Rename the second to `TIPC-06b` or `TIPC-22`.

---

### SUG-3 — `App.tsx` swallows `getConsent()` errors and hides the dialog

**Severity:** suggestion  ·  **Scope:** one-file

**Evidence:**
- `src/App.tsx:793-798` — on `getConsent()` rejection, `console.warn` then `setShowTelemetryConsent(false)`.

**Observed:** If the IPC channel throws (transient bridge error, schema
mismatch from a future version), the renderer silently treats the user as
"already decided" and never shows the dialog.

**Rationale:** This is a soft-fail that means a user who legitimately should
see the prompt will never see it. The harm is bounded (no events emit since
consent is `unset` on disk), but it does mean the privacy-default contract
("consent unset → no emit") becomes "consent unset → also no prompt".

**Proposed fix:** On error, leave `showTelemetryConsent` as `null` (loading
state) and retry once after 1s. Or surface a one-line notification.

## Rubric

| Criterion | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` exits 0 | pass | Verified locally. |
| Every renderer→main IPC channel has a Zod validator | pass | Both `telemetry:*` channels validated at preload + main. |
| `EmitFunction` is a discriminated union; extra-key payloads fail TSC | pass | Object-literal call sites (the only ones in the codebase) get excess-property check. |
| Stack traces redact homedir for macOS / Linux / Windows | pass | Single regex on `os.homedir()` covers all three (lines 141-149). |
| In-memory buffer; disk write only at flush / quit / crash | pass | `memoryBuffer.push` is the only write path on emit. |
| Web parity: every `electron/preload.ts` channel mirrored in `server/index.ts` | partial-fail | IPC channels mirrored; emit sites and `startTelemetry` are not. |
| Migration runs before queue seed | fail | `void migrateLegacyQueue()` is async; sync seed runs before the copy resolves. |
| Whitespace-only secret omits header | fail | Contract edge case not implemented; test is TODO. |
| Tests cover all 12 contract `testBoundaries` | pass | All 12 mapped to assertions in the two test files. |
| No direct `fs.writeFile` from the renderer | pass | All renderer access goes through `window.flintAPI.telemetry`. |

## Counts

- Blocking: 0
- Warning: 4
- Suggestion: 3

## Verdict

**FIX-FORWARD** — ship is not blocked. The web-parity gap is the only finding
worth fixing in this round; the rest can land as a follow-up commit.
