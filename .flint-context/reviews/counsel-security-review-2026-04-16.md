# Security Review: Counsel Surface (GovernanceDashboard + CHRON.1)

**Date:** 2026-04-16
**Reviewer:** flint-security-architect (independent re-review)
**Phase:** End-of-round Counsel security ceremony
**Scope:** CHRON.1 reason-on-override input surface, IPC trust boundary, SARIF export filter, SQLite persistence, web-parity diff, threat model

---

## Executive Summary

**Provisional Grade: B-**

CHRON.1 gets the deterministic fundamentals right: every write path is a parameterised `better-sqlite3` statement, every render path is a React text node (no `dangerouslySetInnerHTML`), the SARIF `'skipped'`/`'auto'` filter is in place and defended by a hardcoded Set, and the new DDL guard in `electron/store.ts:324-340` mirrors the MCP-side schema so the handler no longer silently no-ops on fresh installs.

But the grade is pulled down from A- to B- by five concrete integrity and exfiltration gaps that cannot ship for a compliance feature:

1. **Web build drops the reason argument entirely** (`server/index.ts:2156`). The web handler accepts only `(id)` while `web-api.ts:535` dutifully forwards `(id, reason)` over WS. Every red-tier override in web mode writes `NULL` to `justification` and the UI lies to the user. This is the most damaging bug by far because web is the primary target as of 2026-04-04.
2. **Orchestrator path writes against id `0`** (`src/store/orchestratorStore.ts:580-586`). The DiffCard approval sentinel `approveMutation(0, reason)` either no-ops silently or (worse) overwrites whatever row id=0 happens to exist in any alternate-schema ledger. The renderer is told the reason was recorded; the ledger disagrees.
3. **No length cap anywhere on the path.** `DiffCard` `<input>` has no `maxLength`, the IPC handler has no length check, `ViolationCard` renders the full string inline. A 10 MB reason pasted from a clipboard is committed to SQLite, re-read on every dashboard mount via `getAuditLog({ limit: 200 })`, and `JSON.parse`d 200 times.
4. **No control/bidi-override character filter.** `trim()` is the only sanitisation. NUL bytes, ANSI escapes, U+202E bidi overrides flow straight through to SQLite, the dashboard render, and — critically — SARIF artifacts uploaded to GitHub Security tab. Trojan-Source (CVE-2021-42574) applies directly.
5. **`governance:approve-mutation` is not on any IPC allowlist** (SEC.3 restricts only `mcp:call-tool`). The channel accepts writes from any compromised renderer code with no mutation-id context check, defeating the audit-defensibility purpose that is the entire point of CHRON.1.

What's good: SQL injection surface is zero, XSS surface is zero, the SARIF filter holds, the DDL migration is idempotent, the reject-mutation path was correctly left untouched, type guards reject non-numeric ids at the boundary, and `contextIsolation: true` plus `nodeIntegration: false` eliminate the classic escape hatches.

**Required for SHIP:** fix web-parity (C1), fix orchestrator id sentinel (C2), add length caps (M1), strip control/bidi chars (M2), add an allowlist + Zod validator for the channel (M3), add basic secret-regex redaction (M4). L1-L6 can land in the next hardening sprint.

---

## Critical (must-fix before SHIP)

### C1. Web-build handler ignores the reason argument — silent audit-log failure

**Location:** `server/index.ts:2156-2159`

```ts
handlers.set('governance:approve-mutation', (id: unknown): void => {
  if (typeof id !== 'number') throw new TypeError(...)
  try { db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now') WHERE id = ?`).run(id) } catch { /* table may not exist */ }
})
```

Compare to `electron/main.ts:3835-3842`:

```ts
ipcMain.handle('governance:approve-mutation', (_event, id, reason) => {
  const reasonStr = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null
  db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?`).run(reasonStr, id)
})
```

The web handler:
- Does not accept a `reason` parameter in its signature.
- Does not write `justification` in the SQL.
- Silently succeeds, meaning the renderer's `await window.flintAPI.governance.approveMutation(id, reason)` resolves normally.

**Impact:** For every user on the web build (which is the primary target), every red-tier mutation records `justification = NULL`. The UI shows a reason prompt, gates the Apply button, and claims the reason is persisted. The database has no record. The SARIF export from that project will have no `overrideReason` property for any of those violations. CHRON.1's entire compliance promise collapses on the primary target.

**Remediation:** Mirror the Electron handler verbatim:

```ts
handlers.set('governance:approve-mutation', (id: unknown, reason: unknown): void => {
  if (typeof id !== 'number') throw new TypeError(...)
  const reasonStr = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null
  try {
    db.prepare(`UPDATE mutations_ledger SET approved_at = datetime('now'), justification = ? WHERE id = ?`).run(reasonStr, id)
  } catch { /* table may not exist */ }
})
```

Verify the WS dispatcher in `server/index.ts` forwards positional args beyond the first. Add a parity test: both handlers receive the same `(id, reason)` payload and produce identical `mutations_ledger` rows.

### C2. Orchestrator path writes against sentinel id `0`

**Location:** `src/store/orchestratorStore.ts:580-586`

```ts
if (reason && window.flintAPI.governance?.approveMutation) {
  try {
    await window.flintAPI.governance.approveMutation(0, reason)
  } catch { /* Non-fatal: reason logging should not block the mutation */ }
}
```

The comment above acknowledges the gap ("approveMutation expects a numeric ledger id; we pass 0 as a sentinel"). Two failure modes:

- **Normal case:** SQLite AUTOINCREMENT starts at 1, so `UPDATE … WHERE id = 0` matches zero rows. The handler's try/catch swallows the silent-no-op, the renderer believes the write succeeded, and there is no audit trail for any chat-initiated mutation.
- **Pathological case:** If any MCP-side tool, migration, or test ever inserts a row with id=0 (explicit, not AUTOINCREMENT), every subsequent chat approval overwrites that row's `justification` regardless of file or rule.

The CHRON.1 contract (`CHRON.1-contract.md`) wire-up table explicitly calls for `recordProvenance(mutationId, source, agentId, sessionId, reason)` on the orchestrator path. That IPC (or similar) needs to be wired instead of misusing the ledger UPDATE channel.

**Impact:** The orchestrator chat flow — the primary place a user approves risky mutations — has no audit trail at all. SARIF reports will show `properties.overrideReason` only for the GovernanceDashboard "Override" path, not for any chat-driven mutation.

**Remediation:** Either (a) thread the actual `mutations_ledger.id` through the AI orchestrator chunk into `PendingToolCall.ledgerId` and pass that real id, or (b) call a dedicated `governance:record-provenance` IPC that inserts rather than updates. Option (b) is cleaner and matches the contract.

---

## Major (P1 — threat-model-driven)

### M1. No length cap — SQLite bloat and render-time DoS

**Locations:**
- `src/components/ui/DiffCard.tsx:445-452` — input has no `maxLength`
- `electron/main.ts:3838` — handler trims but does not enforce length
- `src/components/ui/governance/ViolationCard.tsx:527-540` — `{overrideReason}` rendered inline with no truncation
- `src/components/ui/GovernanceDashboard.tsx:126-145` — `JSON.parse` runs on up to 200 entries per mount

**Threat:** A compromised agent or a user pasting clipboard contents can submit a reason of arbitrary size. That string:
- Commits to SQLite (better-sqlite3 handles multi-MB values, but the table bloats).
- Ships across IPC every time the dashboard mounts (`getAuditLog({ limit: 200 })`).
- Gets parsed 200 times on every mount.
- Gets rendered inline inside a `<p>` element that line-wraps indefinitely.

**Remediation:**
- `maxLength={500}` on the `<input>` in `DiffCard.tsx`.
- Defensive `reason.slice(0, 1000)` at `electron/main.ts:3838` and `server/index.ts:2156` (post-trim).
- Truncate-with-ellipsis render in `ViolationCard.tsx:532-540` if `overrideReason.length > 200`.
- Cap the per-entry metadata size on the dashboard parse path: `if (entry.metadata && entry.metadata.length > 4096) continue`.

### M2. No control-character / bidi-override sanitisation

**Location:** `electron/main.ts:3838` and `server/index.ts:2156`

The only sanitisation is `trim()`. ASCII controls (0x00-0x1F), Unicode bidi-override chars (U+202A-U+202E, U+2066-U+2069), and zero-width chars (U+200B, U+FEFF) flow through to:
- SQLite storage
- The rendered violation card (`aria-label` includes the raw string at `ViolationCard.tsx:536`)
- SARIF `properties.overrideReason` uploaded to GitHub Security tab

**Threat:** Trojan-Source attacks (CVE-2021-42574) against audit log readers. A malicious reviewer or compromised agent writes a reason like `approved\u202Eby-manager` that renders as `approved-manager-by` in one tool and as `approved`-by-manager` in another. For a feature whose value is its defensibility as a compliance record, ambiguity about what was actually stored is fatal.

Additionally, NUL bytes (`\x00`) truncate strings in C-based downstream tools — including terminal-rendered SARIF output — without warning.

**Remediation:** At the handler, after `trim()`:

```ts
// Strip Cc (control) and Cf (format/bidi) Unicode categories
const cleaned = reasonStr.replace(/[\p{Cc}\p{Cf}]/gu, '')
```

Apply the same regex in `server/index.ts` — no parity drift.

### M3. IPC channel bypasses the SEC.3 allowlist and has no caller-context check

**Locations:**
- `electron/main.ts:3835` — handler is an `ipcMain.handle` with no authorization envelope
- `electron/main.ts:3251` (approx) — SEC.3 allowlist enforces only `mcp:call-tool`

Any renderer-reachable code path — a compromised MCP-injected rendering, a malicious npm dependency, a future chat-rendering bug — can fabricate audit entries by calling `window.flintAPI.governance.approveMutation(42, 'attacker-controlled-text')`.

**Threat:** CHRON.1's value is the defensibility of the audit record. If the audit record can be forged by the renderer without any main-side validation that the mutation actually exists or is pending, the record is worthless for compliance purposes.

**Remediation:**
1. Add a Zod schema to `shared/ipc-validators.ts` for the channel:
   ```ts
   export const ApproveMutationPayload = z.tuple([
     z.number().int().positive(),
     z.string().max(1000).optional(),
   ])
   ```
2. Validate at the preload bridge before invoking.
3. On the main side, maintain a `pendingApprovals: Map<number, { ledgerId, expiresAt }>` and reject calls that don't reference a known pending id. When the orchestrator emits a mutation tool_call, register the pending approval; when approve/reject is called, verify.

### M4. Reason field is a secret/PII leakage vector with no detection

**Threat:** A user pastes `approved by manager, key sk-ant-api03-xxx...` or `PII: user 123-45-6789` into the reason input. That string:
- Flows to SQLite (project-local, usually committed to git via `.flint/flint.db` accidentally).
- Flows to SARIF artifacts uploaded to GitHub Security tab (public for public repos).
- Flows to `flint://session-context` MCP resource visible to every connected MCP client.
- Flows to the dashboard render for every user with project access.

Compliance teams adopt Flint specifically for the audit story. Leaking secrets into the very compliance artifacts they generate is the worst-case failure.

**Remediation:** Lightweight regex at the handler:

```ts
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,        // Anthropic
  /sk-[A-Za-z0-9]{20,}/g,               // OpenAI
  /AKIA[0-9A-Z]{16}/g,                  // AWS access key
  /ghp_[A-Za-z0-9]{36}/g,               // GitHub PAT
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,      // Slack
]
let cleaned = reasonStr
for (const pat of SECRET_PATTERNS) cleaned = cleaned.replace(pat, '[REDACTED]')
```

Surface a one-time toast when a pattern is caught so the user knows. Consider calling `mcp__claude-flow__aidefence_has_pii` as a follow-up enhancement.

### M5. `JSON.parse` on every dashboard mount with unbounded input

**Location:** `src/components/ui/GovernanceDashboard.tsx:126-145`

Up to 200 entries parsed on every mount. try/catch correctly handles malformed JSON, but combined with M1 a single 10 MB entry stalls render for every subsequent mount. `parsed.reason` is accepted as any string value with no shape check beyond `typeof === 'string'`.

**Remediation:**
```ts
if (entry.metadata && entry.metadata.length > 4096) continue
```

Add a schema check before trusting `parsed.reason`:
```ts
if (typeof parsed.reason === 'string' && parsed.reason.length <= 500) reason = parsed.reason
```

---

## Minor (P2 — defense-in-depth)

- **L1.** `src/store/orchestratorStore.ts:587-596` concatenates `reason` into a chat message (`Reason: ${reason}`). Fine today (React text node), but escape/validate when chat gains markdown or HTML rendering. Add a comment pinning the current safety assumption.
- **L2.** Empty/whitespace handling differs between contract (`'skipped'`) and handler (`null`). Add a comment at `electron/main.ts:3838` noting "UI sends `'skipped'` explicitly per `resolveReasonForStorage`; trim-to-null is a defensive guard for programmatic callers."
- **L3.** `try { … } catch {}` at `electron/main.ts:3839-3841` and `server/index.ts:2158` swallows all DDL errors silently. With the new DDL guard at `electron/store.ts:324-340` the table now always exists in Electron; log via `console.warn` so genuine SQL failures are visible during development.
- **L4.** `aria-label={`Override reason: ${overrideReason}`}` at `ViolationCard.tsx:536` reads bidi-override chars literally to the screen reader. M2 auto-fixes.
- **L5.** `mutations_ledger.justification` is plaintext in SQLite. This is the right call — SEC.4 uses safeStorage only for API keys, not for audit data. But register `governance_events.metadata` and `mutations_ledger.justification` in a redaction allowlist when telemetry/crash-reporting lands (don't ship a crash reporter that pipes customer reasons to Sentry).
- **L6.** No rate limit on `governance:approve-mutation`. SEC.6 covers ingestion, not governance writes. A renderer bug or malicious agent could write millions of approvals in a loop. Add a token bucket (e.g., 60/min/session) at the preload bridge.
- **L7.** Contract references `recordProvenance` as the orchestrator wire-up but the code calls `approveMutation(0, reason)`. Either update the contract or update the code — they must agree.

---

## PII / exfiltration analysis of CHRON.1

Three surfaces receive reason data:

**Surface 1: `mutations_ledger.justification` (project-local SQLite)**
- Plaintext, no encryption.
- Risk: low if SQLite stays local. High if `.flint/flint.db` is committed to git (checked — it is in `.gitignore`). Risk escalates if any future sync (PowerSync) replicates this column off-device.
- Action: ensure PowerSync schema does NOT replicate `mutations_ledger.justification`.

**Surface 2: SARIF `properties.overrideReason` (CI artifact → GitHub Security tab)**
- Public for public repos.
- Current filter: `SARIF_FILTERED_REASONS = new Set(['skipped', 'auto'])` at `flint-mcp/src/tools/auditReport.ts:284` — works correctly, filters system-generated reasons.
- Verified: the filter is applied inside `buildSarifOutput` as a safety net even when a projectRoot-based lookup provides the value, and `overrideReason` is only set when both `override !== null` and the reason is not in the filter set.
- Gap: no opt-out for orgs that want ALL reasons filtered. Add a `includeOverrideReasons: boolean` flag to `AuditReportArgs` defaulting to `true` but allowing `false` for privacy-sensitive orgs.
- Gap: no redaction of user-written reasons themselves (M4 addresses this).

**Surface 3: `flint://session-context` MCP resource**
- Visible to every connected MCP client (host IDE, plus any future MCP peer).
- Governance events are surfaced here per ACX.2 (Proactive Session Context).
- Gap: no redaction layer between the `mutations_ledger` query and the MCP resource. Any secret in `justification` reaches every connected MCP client. M4 redaction at the handler closes this end-to-end.

**Bottom line on the SARIF filter:** it holds. `SARIF_FILTERED_REASONS` is a hardcoded Set, the lookup applies the filter even when an injected `overrideLookup` is provided, and the filter sits inside `buildSarifOutput` where no caller can bypass it. Primary risk is not filter-bypass but M4 (user-written secret-carrying reasons pass the filter because they're not `'skipped'` or `'auto'`).

---

## IPC trust boundary assessment

`governance:approve-mutation` is now a multi-argument IPC channel that:

- Accepts an unvalidated second positional arg from the renderer. **Violates the spirit of the CHRON.1 contract's "IPC runtime validation" clause.**
- Is not on any allowlist (SEC.3 allowlists `mcp:call-tool` only).
- Has no caller-context check — any renderer code can approve any ledger id.
- Lives in the same channel namespace as `reject-mutation` which is a destructive operation.

Remediation stack:
1. **Zod validator at `shared/ipc-validators.ts`** — enforces `(number, string?)` with string `max(1000)`. Called at the preload bridge before `ipcRenderer.invoke`.
2. **Pending-approvals map on main side** — register on mutation emit, check on approve/reject, TTL ~5 min.
3. **Add to renderer-callable allowlist** — explicitly enumerate governance channels that the renderer is permitted to call.
4. **Consider splitting the channel** — `governance:approve-mutation-chat` (auto-reason) vs `governance:approve-mutation-override` (user-reason required). Enforces reason requirement at the IPC layer, not the UI layer.

For `governance:get-audit-log`: this is a read-only handler. The additional `metadata` and `ruleId` fields returned to the renderer are safe per se, but `metadata` is a raw JSON string that can contain arbitrary payloads written by any past event source. Consider projecting only known fields at the SQL layer instead of shipping raw JSON to the renderer.

---

## Web-parity security diff

Two substantive drifts between `electron/main.ts` and `server/index.ts`:

| Behavior | Electron (`main.ts:3835`) | Web (`server/index.ts:2156`) | Impact |
|----------|---------------------------|-------------------------------|--------|
| Accepts `reason` param | Yes | **No** | Web silently drops reason — C1 |
| Writes `justification` | Yes | **No** | Web never populates the column |
| Returns `metadata` in audit log | Yes (line 3876-3877) | **No** (line 2166 — only 5 columns) | Web dashboard's `overrideReasonMap` will always be empty |
| Returns `ruleId` in audit log | Yes (line 3877) | **No** | Web dashboard can't match override events to violations |

The second drift (audit log columns) is also SHIP-blocking for web parity. `src/components/ui/GovernanceDashboard.tsx:126-145` iterates `entries`, reads `entry.metadata` and `entry.ruleId` — both `undefined` on web — and builds an empty `overrideReasonMap`. The feature is cosmetically present but functionally dead on web.

**Remediation:** Bring `server/index.ts:2166-2176` into parity:

```ts
handlers.set('governance:get-audit-log', (opts: unknown) => {
  const limit = typeof (opts as Record<string, unknown>)?.limit === 'number'
    ? (opts as Record<string, unknown>).limit as number : 50
  try {
    return db.prepare(`
      SELECT id, created_at AS timestamp, event_type AS action,
             COALESCE(file_path, '') AS filePath,
             COALESCE(description, event_type) AS description,
             metadata, rule_id AS ruleId
      FROM governance_events ORDER BY created_at DESC LIMIT ?
    `).all(limit)
  } catch { return [] }
})
```

Add a parity test to `.flint-context/` that diffs the channels' return shapes and rejects regressions.

---

## Threat model — attacker story

**Scenario:** A compromised agent (npm dependency, malicious MCP plugin, or chat injection) sends a forged approval.

**Attack chain:**
1. Attacker renders a React component that, on mount, calls `window.flintAPI.governance.approveMutation(<target_ledger_id>, '<attacker-text>')`.
2. IPC bridge forwards directly to main handler (no SEC.3 gate).
3. Handler trims the string, writes `UPDATE mutations_ledger SET approved_at=now(), justification='<attacker-text>' WHERE id = <target_ledger_id>`. No check that (a) the calling context has permission to approve that id, (b) the id corresponds to a pending-approval record, (c) the mutation actually happened.
4. The attacker has now fabricated an approval record with attacker-controlled justification text. The next SARIF export carries `properties.overrideReason: '<attacker-text>'` into the CI artifact and GitHub Security tab.
5. Exfil variant: attacker writes `justification = 'exfil: ' + btoa(document.cookie)` or similar. Reason is now base64-encoded session data in the SARIF artifact.
6. Trojan-Source variant: attacker writes a reason containing U+202E to make a legitimate-looking reason render reversed. Human auditor reviewing the SARIF artifact sees a different string than what's stored.

**Worst case severity:** High. The product's value proposition is the defensibility of the audit record for SOC2/FDA/etc. Forged or mis-rendered audit records invalidate the compliance use case.

**Mitigations that close this chain:**
- C2 (real ledger ids) — attacker can't target id=0 to corrupt records
- M3 (allowlist + pending-approvals check) — attacker's forged call is rejected because id is not pending
- M2 (control/bidi filter) — Trojan-Source variant is defanged
- M4 (secret regex) — common exfil patterns are redacted

---

## Recommendations — ordered by attacker leverage

| # | Issue | Attacker leverage | Effort |
|---|-------|-------------------|--------|
| 1 | M3 — IPC allowlist + pending-approvals check | Very high — closes forged-approval attack chain entirely | Medium |
| 2 | C1 — Web reason handler parity | Very high — 100% of web audit records are currently blank | Low |
| 3 | M2 — Control/bidi char filter | High — Trojan-Source + NUL truncation on compliance artifacts | Very low |
| 4 | C2 — Orchestrator real ledger id | High — 100% of chat-driven audit records are currently blank | Medium |
| 5 | M4 — Secret regex redaction | High — direct leak into public SARIF | Low |
| 6 | M1 — Length caps | Medium — DoS + storage bloat | Very low |
| 7 | M5 — Per-entry metadata size cap | Medium — paired with M1 | Very low |
| 8 | Web-parity for audit log columns | Medium — web dashboard feature silently dead | Low |
| 9 | L3 — Replace silent catches with warn-logs | Low — dev visibility | Very low |
| 10 | L5 — Telemetry redaction allowlist | Low but important before telemetry lands | Medium |

Land 1-5 for SHIP. 6-8 in the next point release. 9-10 on the hardening backlog.

---

## What's already secure

- **SQL injection surface: zero.** All writes use parameterised `?` placeholders in both `electron/main.ts:3840` and the DDL at `electron/store.ts:324-340`.
- **XSS surface: zero.** `ViolationCard.tsx:538` renders `{overrideReason}` as a React text node. No `dangerouslySetInnerHTML`, no `innerHTML`, no markdown renderer in the path. `DiffCard.tsx` input is a controlled component.
- **JSON.parse safety.** `GovernanceDashboard.tsx:135-139` wraps in try/catch and silently skips malformed metadata.
- **Type guards at IPC.** Both handlers validate `typeof id === 'number'` before use; handler validates `typeof reason === 'string'` before trim.
- **DDL guard.** `electron/store.ts:324-340` mirrors the MCP-side `mutations_ledger` schema so the handler no longer silently no-ops on fresh installs.
- **SARIF auto-reason filter.** `SARIF_FILTERED_REASONS = new Set(['skipped', 'auto'])` correctly filters internal sentinels; `buildSarifOutput` applies it even when an injected `overrideLookup` is passed.
- **Process boundary.** No `fs`, `child_process`, `os`, `crypto`, or `path` reachable through the reason path. `src/` side uses only `window.flintAPI`.
- **`contextIsolation: true`, `nodeIntegration: false`** verified in Electron config.
- **Reject-mutation unchanged.** `governance:reject-mutation` was correctly left single-argument — rejection doesn't require justification.
- **Audit log read path fields are safe.** The `metadata` JSON is treated as opaque and only parsed with try/catch; `ruleId` is a string that flows to dashboard labels without execution.

---

## Verdict for SHIP

**B-.** Fix C1, C2, M1, M2, M3, M4 before this can be considered compliant-grade. Without those, the feature reads as "compliance theater" on web (where the feature is functionally dead) and "exploitable audit log" on Electron (forged approvals via a renderer-reachable IPC with no allowlist). With those six fixed, the feature becomes A- and defensible as a SOC2/FDA audit artifact.

The grade call is Justin's, not mine — relaying findings.
