# Security Review: CHRON.1 — Reason-on-Override

**Date:** 2026-04-16
**Reviewer:** flint-security-reviewer
**Phase:** CHRON.1 end-of-round ceremony

---

**Verdict: FIX**

CHRON.1 has no critical SQL/XSS holes — SQL is parameterized end-to-end and React renders the reason as a text node — but two SHIP-blocking integrity bugs and a cluster of medium hardening issues exist. A compliance feature whose audit story is the product cannot ship with integrity gaps.

---

## Critical vulnerabilities (block SHIP)

None.

## High-severity issues

### H1. Web build silently drops the reason argument

- **Location:** `server/index.ts:2156-2159`
- **Description:** Electron handler accepts `(id, reason)` and writes `justification = ?`. The web mirror only accepts `(id)`. `web-api.ts:535` correctly forwards `reason` over WS, but the handler ignores the second positional arg — no `justification` write at all.
- **Impact:** In `dev:web` and any web deploy, every approval — including red-tier overrides that "require" a reason — is silently logged with `justification = NULL`. The UI tells the user a reason was recorded, the database has no record. CHRON.1's promise collapses.
- **Remediation:** Bring `server/index.ts:2156` into parity with `electron/main.ts:3835` — accept `reason: unknown`, trim, write to `justification` column. Verify the WS dispatcher actually passes the second arg through to handlers.

### H2. Hardcoded sentinel id `0` corrupts the ledger

- **Location:** `src/store/orchestratorStore.ts:580-586`
- **Description:** The store calls `window.flintAPI.governance.approveMutation(0, reason)` — id `0` is a sentinel meaning "no real ledger row". The handler then runs `UPDATE mutations_ledger SET … justification=? WHERE id = 0`. SQLite AUTOINCREMENT starts at 1 so this normally no-ops, but (a) any pre-existing row with id=0 (test, migration, MCP path) gets its reason silently overwritten, and (b) the renderer believes the reason was logged because the handler's try/catch swallows the no-op-success path.
- **Impact:** Audit reports lie about whether high-risk mutations had reasons. SARIF `properties.overrideReason` receives no data from the chat-based approval flow because no ledger row was ever updated. CHRON.1's contract wire-up table (line 309-311) explicitly calls for `recordProvenance` on the orchestrator path — that's what should be wired.
- **Remediation:** Either plumb the actual `mutations_ledger.id` through the orchestrator chunk, or call a dedicated `recordProvenance(mutationId, source, agentId, sessionId, reason)` IPC instead of misusing the ledger UPDATE channel.

## Medium-severity issues

### M1. No length cap → SQLite/UI DoS vector

- **Locations:** `src/components/ui/DiffCard.tsx:445-452` (no `maxLength`); `electron/main.ts:3838` (no length check); `src/components/ui/governance/ViolationCard.tsx:532-540` (renders entire string inline).
- **Impact:** A multi-MB pasted reason bloats SQLite, gets parsed and held in memory on every dashboard mount, renders an enormous `<p>`, and ships across IPC repeatedly.
- **Remediation:** `maxLength={500}` on the input, `reason.slice(0, 1000)` defensive at handler, ellipsis truncation at render.

### M2. No control-character / bidi-override sanitisation

- **Location:** `electron/main.ts:3838`
- **Description:** Handler trims whitespace but does not strip ASCII controls (0x00-0x1F), Unicode bidi-override chars (U+202A-U+202E, U+2066-U+2069), or zero-width chars.
- **Impact:** Trojan-Source-style (CVE-2021-42574) attacks against audit log readers; NUL bytes truncate strings in C-based downstream tools (e.g., terminal SARIF output). The "defensible compliance record" promise requires unambiguous text.
- **Remediation:** Strip `\p{Cc}` and `\p{Cf}` at the handler before storage.

### M3. `governance:approve-mutation` bypasses the SEC.3 allowlist

- **Locations:** `electron/main.ts:3835` (handler); `:3251` (SEC.3 enforces only `mcp:call-tool`).
- **Impact:** Any code in the renderer — including a compromised MCP-injected payload, malicious dependency, or future bug in chat rendering — can fabricate audit entries with no authorisation check. Defeats the audit-defensibility purpose.
- **Remediation:** Add a Zod schema for the channel in `shared/ipc-validators.ts` (the contract calls for IPC runtime validation at the bridge). Consider tracking pending approvals on the main side and rejecting calls that don't reference a known pending `toolUseId`.

### M4. Reason field is a secret/PII leakage vector with no detection

- **Description:** A pasted "approved by API key sk-ant-…" or PII reason flows to SQLite (project-local), SARIF artifacts (uploaded to GitHub Security tab / CI), the dashboard inline render for any user, and eventually `flint://session-context` MCP resource visible to every connected MCP client.
- **Impact:** Compliance teams adopting Flint specifically for the audit story will leak secrets into the very compliance artifacts they generate. AIMDS is available via MCP and unused here.
- **Remediation:** Lightweight regex detection at the handler (`sk-ant-`, `sk-`, `AKIA`, high-entropy strings); reject or replace with `[REDACTED]` and surface a notification. One-time onboarding tip explaining what "reason" data is shared.

### M5. `JSON.parse` on every mount with unbounded input

- **Location:** `src/components/ui/GovernanceDashboard.tsx:126-145`
- **Description:** Up to 200 entries parsed on every dashboard mount. try/catch handles malformed JSON correctly, but combined with M1 a single oversized entry stalls render. `parsed.reason` is read with no shape check beyond `typeof === 'string'`.
- **Remediation:** Cap `entry.metadata` size before parsing (`if (entry.metadata.length > 4096) continue`).

## Low-severity / hardening

- **L1.** Reason concatenated into chat message at `src/store/orchestratorStore.ts:587-596` — fine today (text node), but escape when chat gains markdown/HTML rendering.
- **L2.** Empty/whitespace handling differs between contract (`'skipped'`) and handler (`null`); add a comment noting "trim-to-null is defensive; UI sends 'skipped' explicitly".
- **L3.** `try { … } catch {}` at `electron/main.ts:3839-3841` swallows DDL failures silently — but the new DDL guard at `electron/store.ts:324-340` means the table now always exists in Electron; log via `console.warn` so genuine SQL failures are visible.
- **L4.** `aria-label={`Override reason: ${overrideReason}`}` at `src/components/ui/governance/ViolationCard.tsx:536` reads bidi-override chars literally — auto-fixed by M2.
- **L5.** Reason not redacted from future telemetry (Sentry-like crash reports); register `governance_events.metadata` and `mutations_ledger.justification` in a redaction allowlist when telemetry lands.
- **L6.** No rate limit on `governance:approve-mutation`; a renderer bug could write megabytes of audit entries. SEC.6 covers ingestion, not governance writes — add a token bucket (e.g., 60/min/session).

## What's already secure

- **SQL injection: no surface.** All reason writes use parameterized `?` placeholders.
- **XSS: no surface.** Every render of `overrideReason` is React text interpolation. No `dangerouslySetInnerHTML`.
- **JSON.parse safety.** Correctly try/catch-wrapped, falls through silently on malformed metadata.
- **Type validation at IPC.** Both handlers validate `typeof id === 'number'` and `typeof reason === 'string'` before use.
- **DDL guard mirrors MCP-side schema.** All 13 columns present — no schema drift.
- **Process boundary intact.** No `fs`, `path`, `child_process`, `os`, `crypto` reachable through the reason path.
- **`contextIsolation: true`, `nodeIntegration: false`** verified.
- **SARIF auto-reason filtering.** Filters `'skipped'` and `'auto'` — no audit-noise leakage to CI consumers.
- **Reject-mutation correctly unchanged.** `governance:reject-mutation` was not extended with a reason parameter — rejection doesn't need justification.

## Required before SHIP

1. **H1** — Add reason handling to `server/index.ts:2156` for web parity.
2. **H2** — Replace `approveMutation(0, reason)` sentinel with real ledger id or dedicated `recordProvenance` IPC.
3. **M1** — Length caps at input (500) and handler (1000).
4. **M2** — Strip control + bidi-override chars at IPC handler.
5. **M3** — Zod validator for `governance:approve-mutation` in `shared/ipc-validators.ts`.
6. **M4** — Basic secret pattern detection with redaction.

L1-L6 are post-SHIP hardening backlog.
