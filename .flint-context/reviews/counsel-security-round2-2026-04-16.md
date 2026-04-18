# Security Review Round 2: Counsel Surface (post CHRON.1-repair)

**Date:** 2026-04-16
**Reviewer:** flint-security-architect (re-review)
**Commit:** 7511d75
**Prior grade:** B- | **New grade: A-**

---

## Executive Summary

The sprint closed the three top findings from the prior review. Top-3 verification:

1. **IPC validation + allowlist** — FIXED at the channel-validator level. `shared/ipc-validators.ts:129-135` defines the Zod schema (`id: number().int().nonnegative()`, `reason: string().max(1000).optional()`). Handler entry calls `.safeParse` and throws on failure (`electron/main.ts:3854-3859`, `server/index.ts:2194-2199`). String `id`, negative `id`, and over-long `reason` are rejected before any DB write. SQL-fragment-as-id attacks are dead.
2. **Web-build reason parity** — FIXED at `server/index.ts:2192-2213`. Handler now takes `(id, reason)`, runs identical validator + sanitizer, writes the same `UPDATE … SET approved_at, justification` statement, and the paired `governance:get-audit-log` at `server/index.ts:2250-2271` returns `metadata` + `ruleId`. Diff against Electron is byte-for-byte on validation and sanitization; only the `governance_events` INSERT differs (server inlines SQL; Electron calls `govEventService.recordEvent`) — both write the same row shape.
3. **Control-char + bidi + NUL filter** — FIXED via `shared/reasonSanitizer.ts:53` (`/[\p{Cc}\p{Cf}]/gu`). Strips NUL (U+0000, \p{Cc}), U+202E bidi-override (\p{Cf}), U+200B zero-width (\p{Cf}), and ANSI CSI introducer ESC/0x1B (\p{Cc}). Precedence is length-cap (line 86) → control strip (line 90) → secret redact (lines 96-104) → trim (line 108), so regex work is bounded by `REASON_MAX_LENGTH=1000` (line 24) before untrusted input hits the engine.

M4 (length cap) and M5 (secret regex) both land — Anthropic/GitHub/AWS/OpenAI patterns correctly distinct (openai uses negative lookahead `(?!ant-)` to avoid overlapping Anthropic). The high-entropy fallback at line 48 requires mixed case + digit, so it won't over-match plain English. SARIF filter (`flint-mcp/src/tools/auditReport.ts:86,293`) is intact — `SARIF_FILTERED_REASONS` is `const … as ReadonlySet<string>` applied inside `buildSarifOutput`.

## Residual risks (attacker-leverage ranked)

1. **No `pendingApprovals` map on main side** (medium). `grep pendingApproval* electron/` returns nothing. Zod schema accepts any non-negative integer `id`, so a compromised renderer can still call `approveMutation(42, 'attacker-text')` on a ledger id that doesn't belong to its session. Forgery surface narrowed (no bidi, no secrets, capped length, validated shape) but not closed. Recommend: register `{ledgerId, sessionId, expiresAt}` on orchestrator mutation emit; reject approvals for unknown ids.
2. **`id: 0` still valid** (low). Schema uses `nonnegative()` not `positive()`. `UPDATE … WHERE id = 0` matches zero rows under AUTOINCREMENT, but if any MCP-side migration ever inserts id=0 the write lands there. Tighten to `.int().positive()` — one-character fix.
3. **High-entropy regex lookahead cost** (low). Three chained `(?=…)` lookaheads on strings ≤1000 chars — Node V8 handles this in microseconds; no catastrophic backtracking observed.

**SHIP verdict:** Approved at A-. The two remaining issues are hardening, not blockers.
