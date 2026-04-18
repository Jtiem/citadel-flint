# Security Review: CHRON.1 A+ Polish (v2)

**Date:** 2026-04-16
**Reviewer:** flint-security-reviewer
**Phase:** CHRON.1 polish-pass verification

## Verdict: PASS

All six prior SHIP-blockers (H1, H2, M1–M5) are resolved with test coverage. No new critical or high issues introduced by the polish. One latent HIGH (pre-existing, surfaced by polish) and three LOW residuals flagged as post-SHIP backlog. Compliance-artefact integrity is intact.

---

## Prior findings — verification

| # | Status | Evidence |
|---|--------|----------|
| **H1** web drops reason | RESOLVED | `server/index.ts:2192-2213` mirrors Electron; `src/adapters/web-api.ts:542-547` forwards both positional args; dispatcher spreads `...args`. Round-trip verified. |
| **H2** hardcoded id 0 | RESOLVED | `orchestratorStore.ts:580-592` now calls `governance.recordApprovalReason`. Handler at `electron/main.ts:3892-3933` writes a `governance_events` row with `event_type='override'`. Test asserts `approveMutation` is NOT invoked. |
| **M1** length caps | RESOLVED | Input `DiffCard.tsx:493` maxLength=500; Zod `max(1000)` at `shared/ipc-validators.ts:132,142`; sanitiser `REASON_MAX_LENGTH=1000` at `shared/reasonSanitizer.ts:24`. 1 MB perf test passes <1s. |
| **M2** control + bidi | RESOLVED | `shared/reasonSanitizer.ts:53,89-92` strips `[\p{Cc}\p{Cf}]` with `u` flag at both entry points on both targets. 8 tests including explicit CVE-2021-42574 regression. |
| **M3** SEC.3 allowlist bypass | RESOLVED | Zod schemas at `shared/ipc-validators.ts:129-144`; both handlers `safeParse` and throw `TypeError`. Direct IPC channels enforce via Zod — correct layering per Contract-First. |
| **M4** secret/PII | RESOLVED | `shared/reasonSanitizer.ts:33-50` — 5 patterns (Anthropic/OpenAI/AWS/GitHub/high-entropy) with negative-lookahead avoiding overlap. Redact-not-block UX. 11 tests. |
| **M5** JSON.parse DoS | RESOLVED (with 4096-byte cap after UX v2 wiring restore) | `GovernanceDashboard.tsx` rebuilds `overrideReasonMap` on activeFilePath change with `metadata.length <= 4096` cap before parse, defensive try/catch. |

---

## Attack scenarios — validated

1. **Trojan-Source `\u202e`** — stripped at handler, DB stores clean text, render literal. Safe.
2. **`sk-ant-…` paste** — redacted identically on Electron + web.
3. **Web data-loss regression** — fixed; handler now writes `justification`.
4. **50 KB payload** — input clamps 500, Zod rejects >1000, sanitiser caps at 1000 pre-regex.
5. **Metadata `\u0000`** — stripped pre-storage.
6. **`id=-1`, 9999999-char reason** — both rejected gracefully by Zod, throws before any DB work.
7. **Race approve + audit read** — SQLite WAL + parameterised `?` binding + better-sqlite3 write serialisation. No injection or race surface.

---

## New finding surfaced by polish (not introduced)

### H-new-1 — [HIGH / latent integrity, fails closed] `mutations_ledger.id` type mismatch

- `electron/store.ts:324` — canonical schema: `id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))` (32-char hex)
- `shared/ipc-validators.ts:131` — Zod: `z.number().int().nonnegative()`
- `electron/main.ts:3832-3844` — `get-pending-mutations` SELECTs columns that don't exist in the canonical schema and casts `id` as number. Try/catch swallows the error → returns `[]`
- `src/hooks/useGovernancePendingMutations.ts:40,59` — `Number(id)` on hex string = `NaN`, Zod then rejects

**Impact:** S8.3 pending-approvals UI is effectively dead on canonical-schema installs. Fails closed (no silent corruption, no SQLi). **CHRON.1 reason-on-override pipeline itself unaffected** — the orchestrator flow writes via `record-approval-reason`, not this path. Pre-dates the polish pass. Not a CHRON.1 blocker.

---

## Low residuals (non-blocking)

- **L-new-1** `OverrideReasonDialog.tsx:73` uses `MAX_REASON_CHARS=2000` while server caps at 1000 — silent truncation with only a `console.warn`. Align to `REASON_MAX_LENGTH` from shared.
- **L-new-2** `governance:record-approval-reason` has no pending-`toolUseId` pairing — any renderer code can fabricate override events. Zod rejects shape abuse; no rate limit or pairing check.
- **L-new-3** `record-approval-reason` `filePath` is stored unverified; not a traversal surface (never reaches `fs`), but can pollute audit log. Call `sharedValidateFilePath` before store.

---

## Genuinely secure

- **SQL injection: zero surface** — all `?`-bound prepared statements
- **XSS: zero** — React text nodes everywhere; no `dangerouslySetInnerHTML` in reason path
- **Pipeline order correct**: length-cap → control/format strip → secret redact → trim, tested explicitly
- **Shared sanitiser imported identically** by Electron and web — no parity drift
- **Orchestrator path fails open on IPC error** — mutation still applies, reason is lost but mutation not blocked
- **Reason never appended to chat transcript** — doesn't leak into next LLM turn
- **SARIF filter drops `'skipped'`/`'auto'` sentinels**
- **Process boundary intact** — no `fs/path/child_process/crypto/os` reachable from reason path
