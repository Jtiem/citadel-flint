# BETA-TELEMETRY-WIRING — Security & Privacy Review

- **Phase:** BETA.TEL
- **Dimension:** security
- **Reviewer:** flint-security-reviewer
- **Date:** 2026-04-25
- **Round:** 1
- **Verdict (derived):** FIX-FORWARD

## Scope

Reviewed (privacy / IPC / process boundary lens):

- `electron/preload.ts` (telemetry surface, lines 1670–1696)
- `shared/ipc-validators.ts` (Zod schemas, lines 560–582)
- `electron/main.ts` (handlers + emit sites: 16–17, 821–829, 2552–2557, 3822–3823, 5615–5627)
- `electron/betaTelemetry.ts` (consent gate, redaction, network outbound, queue migration)
- `server/index.ts` (web parity, lines 3370–3426)
- `src/types/flint-api.d.ts` (allowlist, lines 1725–1745, 2060–2080)

Skipped (out of partition or unchanged):
- `src/components/ui/TelemetryConsentDialog.tsx` — UX scope, separate reviewer
- Cloudflare Worker telemetry sink — non-goal per contract §9
- Other IPC channels not introduced by BETA.TEL

## Verdict

**FIX-FORWARD.** No blocking privacy violations. The consent gate is sound, the discriminated-union `emit()` signature successfully makes the privacy contract a TSC error, and IPC validation has correct defense in depth (preload Zod + main handler Zod). Three warnings concern incomplete redaction of paths in crash payloads, lack of HTTPS enforcement on the outbound endpoint, and the contract / web-build emit-site mismatch. None are launch-blockers for a ~10-user closed beta with operator-controlled environment, but they should be tracked.

## Rubric Summary

| Criterion | Result |
|---|---|
| Consent gate prevents emit when state ≠ 'accepted' | pass |
| `mcp.tool_called` payload contains only `toolName` | pass |
| `audit.completed` contains no file paths | pass |
| `session.ended` contains only durationMs | pass |
| Renderer surface exposes only `getConsent` + `setConsent` (no `emit`) | pass |
| IPC validators applied at preload AND main handler | pass |
| Discriminated-union TelemetryEvent enforces payload shape at compile time | pass |
| Telemetry module imports `electron`; not reachable from `src/` | pass |
| Web build stub does not emit (privacy-safe degraded mode) | pass |
| Stack-trace homedir redaction covers macOS/Linux/Windows | pass |
| Crash-event `message` field redacted | **fail** |
| Outbound URL forced to HTTPS / scheme-checked | **fail** |
| Stack redaction covers non-homedir absolute paths | **fail** |
| Web build mirrors all emit sites per contract §1 | fail (privacy-safe deviation) |

## Findings

### WARN-S-1 — `app.crashed.message` not redacted

- **Severity:** warning
- **Scope:** one-line
- **Commandment:** 14 (Bypass Prohibition — privacy promise)
- **Evidence:**
  - `electron/betaTelemetry.ts:267-270` — emits `message: String(err?.message ?? err)` with no `redactHomedir()` call
  - `electron/betaTelemetry.ts:266` — only `stack` is redacted
- **Observed:** The `app.crashed` payload redacts `stack` but emits `message` raw. Many runtime errors include absolute paths in `err.message` (e.g., `ENOENT: no such file or directory, open '/Users/justin/Projects/secret-client/...'`, JSON parse errors quoting paths, Babel errors quoting the source file).
- **Rationale:** The consent dialog promises "no file contents or design data leave your machine." A `message` containing a project path leaks directory structure, which on a designer's machine often encodes client/employer names. The privacy contract is enforced for `stack` and silently waived for `message`.
- **Proposed fix:** Apply `redactHomedir()` to `message` as well. One-line change at line 268: `message: redactHomedir(String(err?.message ?? err))`.
- **Status:** open

### WARN-S-2 — No HTTPS / scheme enforcement on `FLINT_TELEMETRY_URL`

- **Severity:** warning
- **Scope:** one-file
- **Evidence:**
  - `electron/betaTelemetry.ts:31` — `const TELEMETRY_URL = process.env.FLINT_TELEMETRY_URL || ''`
  - `electron/betaTelemetry.ts:206-211` — `net.fetch(TELEMETRY_URL, …)` with `X-Flint-Secret` header
- **Observed:** Endpoint URL is read from env without scheme validation. If the env var is set to `http://…`, both event payloads and the `X-Flint-Secret` shared secret are sent in cleartext. There is no certificate pinning either.
- **Rationale:** For a beta whose entire privacy claim depends on the data going to one trusted endpoint, accepting any URL from the environment is a soft underbelly. An attacker who can set environment variables (e.g., a malicious launcher script, supply-chain attack on a parent process) can both exfiltrate events and capture the shared secret to authenticate further requests.
- **Proposed fix:** Reject non-`https:` URLs at module init: `if (TELEMETRY_URL && !TELEMETRY_URL.startsWith('https://')) { console.warn('[telemetry] non-https URL rejected'); TELEMETRY_URL = '' }`. Optionally pin to a documented host allowlist for the closed beta.
- **Status:** open

### WARN-S-3 — Stack redaction does not cover non-homedir absolute paths

- **Severity:** warning
- **Scope:** one-file
- **Evidence:**
  - `electron/betaTelemetry.ts:141-149` — `redactHomedir()` only replaces the current `os.homedir()` substring
- **Observed:** `redactHomedir()` only redacts the running user's homedir. Stack traces routinely include other absolute paths: `/opt/`, `/private/var/folders/…` (macOS tmp), `/tmp/`, system Node paths (`/usr/local/lib/node_modules/…`), and any project root the user opened *outside* their home directory. Designers using shared mounts (`/Volumes/Clients/<client>/…`, `/mnt/work/<employer>/…`) leak that structure.
- **Rationale:** Same privacy-promise scope as WARN-S-1. The contract's `stack-redaction` invariant (line 337–342) is satisfied for the literal homedir but not for the broader claim. The 2000-char stack truncation reduces volume but doesn't remove leakage.
- **Proposed fix:** Either (a) reduce `stack` to filename + line/col only — strip directory paths entirely with `text.replace(/(?:\/[^\s:'"]+\/)+([^/\s:'"]+:\d+:\d+)/g, '<path>/$1')` — or (b) document the exact privacy claim more narrowly and have the dialog match. Option (a) is preferable; the stack still localizes the bug.
- **Status:** open

### SUG-S-1 — Web build does not mirror Electron emit sites

- **Severity:** suggestion
- **Scope:** cross-file
- **Evidence:**
  - `server/index.ts:3385` — `function startTelemetry(): void { /* no-op */ }`
  - Contract `BETA-TELEMETRY-WIRING-contract.md:31` says "same emit sites as electron/main.ts"
- **Observed:** The web build's `startTelemetry` is a no-op and there are no `telemetryEmit` calls in `server/index.ts`. The web build accepts and stores consent but never produces any events.
- **Rationale:** From a privacy standpoint this is the *safer* deviation — the web build emits nothing regardless of consent. But it conflicts with the contract's web-parity claim and means a user who opts in via the web UI gets a privacy promise the build cannot honor in either direction. Surfacing this as a suggestion rather than warning because it does not weaken the threat model.
- **Proposed fix:** Either (a) remove the consent dialog from the web build entirely (no telemetry → no consent surface needed), or (b) update the contract's invariant `web-parity` to acknowledge that web is intentionally emit-disabled. Do not add web emit sites without revisiting the network/storage threat model for a server-deployed Glass.
- **Status:** open

### SUG-S-2 — `X-Flint-Secret` lives in `process.env`, not `safeStorage`

- **Severity:** suggestion
- **Scope:** one-file
- **Evidence:**
  - `electron/betaTelemetry.ts:32` — `const TELEMETRY_SECRET = process.env.FLINT_TELEMETRY_SECRET || ''`
- **Observed:** The shared secret authenticating the app to the telemetry endpoint is read from an environment variable and held in process memory for the life of the process. Other Flint secrets (per SEC.4) use Electron `safeStorage` with OS keychain encryption.
- **Rationale:** For a closed beta where the secret is operator-injected at packaging time, this is acceptable. It would not be acceptable for a public beta or production. Flagging now so the upgrade path is explicit before the threat model widens.
- **Proposed fix:** Pre-production, move the secret to `safeStorage`-encrypted local config. Document the trust model in the build/release runbook. No change needed for the closed beta.
- **Status:** open

### SUG-S-3 — `persistBuffer()` can grow disk queue unboundedly when network is down

- **Severity:** suggestion
- **Scope:** one-file
- **Evidence:**
  - `electron/betaTelemetry.ts:222-225` — `persistQueue([...existing, ...memoryBuffer])` always concatenates
  - `electron/betaTelemetry.ts:198-218` — `flush()` only clears queue on `res.ok`
- **Observed:** If `flush()` keeps failing (offline, endpoint down, 500s), the on-disk queue grows monotonically every quit + crash. There is no size cap or age cap on the queue.
- **Rationale:** Not a privacy violation — the events are already consent-gated. But on a long-running offline session, the queue can grow large enough to affect launch time (sync `readFileSync` + `JSON.parse`) and disk usage.
- **Proposed fix:** Cap queue length at e.g. 1000 events and drop oldest on overflow: `persistQueue(combined.slice(-1000))`. Combine with a 14-day TTL on event timestamps if simpler.
- **Status:** open

## Notes on threat model items the user asked about

- **Consent gate audit (every emit site):** all 5 emit sites — `app.launched` (line 258), `app.crashed` (267), `mcp.tool_called` (main.ts:3823), `audit.completed` (main.ts:2553), `session.ended` (278) — flow through `emit()` which short-circuits at `betaTelemetry.ts:182-183` when `consent.state !== 'accepted'`. No bypass paths found.
- **`mcp.tool_called` toolName provenance:** `name` is renderer-supplied but validated by `mcpCallToolSchema` (non-empty string) and gated by SEC.3 + AGV.1 allowlist *before* the emit at `main.ts:3823`. So toolName values are bounded to known-good MCP tool names. No prompt-injection vector via toolName.
- **`audit.completed` payload:** counts only, no `filePath` or component identifiers. Verified at `main.ts:2553-2557`. Safe.
- **Allowlist surface:** `src/types/flint-api.d.ts:2069-2080` exposes only `getConsent` and `setConsent`. `emit` is not on `window.flintAPI`. Renderer cannot fire arbitrary events. Verified.
- **IPC defense in depth:** preload calls `telemetrySetConsentPayloadSchema.parse(payload)` before forwarding (preload.ts:1692); main handler calls the same schema again (main.ts:5625). Pass.
- **Path traversal during userData migration:** `legacyQueuePath()` uses `path.join(os.homedir(), BRAND.configDir, 'telemetry-queue.json')` — no user input. Safe.
- **Race during migration:** `void migrateLegacyQueue()` is fire-and-forget; `loadQueueFromDisk()` runs immediately after. If migrate hasn't completed, seeded events miss the migrated queue — minor data loss, not a privacy issue.
- **GDPR record-of-consent:** `decidedAt` ISO timestamp + stable per-install `sessionId` UUID is sufficient to satisfy data-subject requests provided the user can supply their `sessionId` (visible only via the disk file `userData/beta-consent.json`). Document this for the beta runbook so a request can actually be fulfilled.

## Verified Controls

- Process-boundary integrity: telemetry module imports `electron`; renderer cannot import it; web build cannot import it (uses inline stub).
- Consent gate placement: at the *single* `emit()` chokepoint, not at each call site — robust to future emit-site additions provided the discriminated union is extended.
- Discriminated-union privacy contract: TSC blocks any caller passing extra keys to `emit()`. `mcp.tool_called` cannot carry args by construction.
- Zod validation at both preload and main; renderer cannot inject arbitrary `state` values.
- No renderer access to `userData/`; all reads/writes via IPC.
- Empty-buffer no-op in `flush()` (line 203) avoids gratuitous network calls.
- `uncaughtException` handler synchronously persists buffer before async flush — survives hard crash.

## Recommendations (priority order)

1. Apply `redactHomedir()` to `app.crashed.message` (WARN-S-1). One-line change.
2. Reject non-HTTPS `FLINT_TELEMETRY_URL` at module init (WARN-S-2). One-line change.
3. Tighten stack redaction to strip all directory components, keeping filename + line/col (WARN-S-3).
4. Decide consciously: should the web build emit, or should its consent dialog go away? (SUG-S-1).
5. Track for production hardening: move `FLINT_TELEMETRY_SECRET` to `safeStorage` (SUG-S-2).
6. Cap on-disk queue length (SUG-S-3).
