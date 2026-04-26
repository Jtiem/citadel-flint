# Security Review — UX-P0 Trust Gap Fixes

**Date:** 2026-04-21
**Reviewer:** flint-security-reviewer
**Scope:** `governance:save-overrides` / `governance:get-overrides` IPC surface
  - `electron/main.ts:4432-4472`
  - `electron/preload.ts:1681-1695`
  - `shared/ipc-validators.ts:519-537`
  - `src/adapters/web-api.ts:598-601`
  - `server/index.ts:2073-2108`

**Verdict:** PASS with warnings. No blocker-tier vulnerabilities. Two warnings and two suggestions.

---

## Risk Summary

- BLOCKER: 0
- WARNING: 2
- SUGGESTION: 2

---

## Threat Model Context

The `governance:save-overrides` channel persists a Zod-validated JSON blob to `.flint/rule-overrides.json` within `activeProjectRoot`. The path is server-computed (`path.join(activeProjectRoot, '.flint', 'rule-overrides.json')`) with zero renderer-supplied path segments, which closes the classic traversal vector. `activeProjectRoot` itself is set only by trusted flows (open-folder dialog, main-process loaders at `electron/main.ts:496, 1991, 2070, 2589, 5540`), not by the renderer over this channel. The write goes through `FileTransactionManager` in Electron and `atomicWrite` in the web build, satisfying Commandments 12 + 14.

The payload schema is tight: `version` is a literal `1`, `rules` is `Record<string, { enabled?: boolean; severity?: 'critical'|'amber'|'advisory' }>`. Severity is a closed enum — no string injection. The value types are primitives, so `JSON.stringify` cannot round-trip executable content. The read path re-parses JSON and returns to the renderer; JSON.parse itself is safe (no prototype pollution risk from plain parse), but the result is *not* re-validated against the schema on read (see W2).

---

## Findings

### [WARNING] W1 — No size cap on rule overrides payload
- **Location:** `shared/ipc-validators.ts:528-531`, `electron/main.ts:4438-4451`
- **Observed:** `governanceSaveOverridesValidator` accepts `z.record(z.string(), ...)` with no upper bound on key count or string length. A compromised or buggy renderer could submit a payload with millions of rule keys, forcing a large JSON serialization and disk write inside `FileTransactionManager`.
- **Impact:** Local DoS / disk-fill. Not remote-exploitable, but a runaway renderer bug would be absorbed silently. Also inflates subsequent `get-overrides` reads and JSON parses on every project open.
- **Rationale:** Defense in depth — the schema is the only gate between an untrusted renderer process and disk I/O. Commandment-free bounds are the norm for all other Zod validators when the input is a map.
- **Remediation:** Add `.refine(r => Object.keys(r).length <= 5000, ...)` on the `rules` record and bound `ruleId` key length (`z.string().max(200)`). Apply in `shared/ipc-validators.ts` so both Electron and web handlers inherit the cap.
- **Status:** open

### [WARNING] W2 — `get-overrides` returns unvalidated parsed JSON to the renderer
- **Location:** `electron/main.ts:4459-4472`, `server/index.ts:2097-2108`
- **Observed:** Both handlers `JSON.parse` the on-disk file and cast the result to `{ version: 1; rules: Record<string, unknown> }` without running it through `governanceSaveOverridesValidator` (or an equivalent read-side schema). If an attacker with local filesystem access corrupts `.flint/rule-overrides.json` (or if a pre-existing malformed file is present), the renderer receives arbitrary-shaped data typed as if it were valid.
- **Impact:** The renderer consumer (`governanceStore.loadFromFile`) trusts the shape. A crafted file could introduce unexpected `severity` strings that bypass the renderer's closed enum or cause downstream linter logic to misbehave. Local-only, but undermines the stated invariant that "malformed payload → null."
- **Rationale:** Threat model includes malicious local files (e.g., a pack import gone wrong, another tool writing to `.flint/`). The write-side Zod gate is worthless if the read side doesn't re-validate.
- **Remediation:** Replace the unchecked cast with `governanceSaveOverridesValidator.safeParse(JSON.parse(raw))` and return `null` on parse failure (same behavior as ENOENT). Apply to both `electron/main.ts:4464` and `server/index.ts:2101`.
- **Status:** open

### [SUGGESTION] S1 — Preload type signature could be tighter
- **Location:** `electron/preload.ts:1691-1695`
- **Observed:** The preload exposes `severity?: string` in the TypeScript type, not `'critical' | 'amber' | 'advisory'`. Main-process Zod will reject bad values, but the looser renderer-facing type encourages callers to pass arbitrary strings that will fail at runtime.
- **Impact:** Minor DX / defense-in-depth. Does not expand the attack surface because runtime validation catches it.
- **Rationale:** The preload is the contract surface. Narrower types push invariants left.
- **Remediation:** Change `severity?: string` to `severity?: 'critical' | 'amber' | 'advisory'` in both the `saveRuleOverrides` preload signature and the `src/types/flint-api.d.ts` declaration. Mirror in `src/adapters/web-api.ts:598`.
- **Status:** open

### [SUGGESTION] S2 — Web handler error leakage via console.warn
- **Location:** `server/index.ts:2104`, `electron/main.ts:4468`
- **Observed:** On non-ENOENT read failure, the handler logs the raw `err` object to console. This can include file-system paths and stack traces. In the web build, that console output is main-process-side so it is not directly exposed to browser, but any log aggregation in the server path could pick it up.
- **Impact:** Low. Paths under `activeProjectRoot` are not secrets, but stack traces can leak Node version / module paths.
- **Rationale:** Commandment-12-adjacent hygiene: IPC handlers should not return raw error objects, and the same applies to log sinks that may be shipped off-box.
- **Remediation:** Log only `err.code` and `err.message`, not the full object. Nice-to-have, not required.
- **Status:** open

---

## Security Questions — Direct Answers

1. **Path traversal.** Safe. The path is built from `activeProjectRoot` (main-process-controlled) joined with static literals `.flint` and `rule-overrides.json`. No renderer-supplied segments. The only way to "redirect" the write is to trick the main process into setting `activeProjectRoot` elsewhere, which is out of scope for this channel.
2. **Payload validation.** Yes, the Electron handler calls `governanceSaveOverridesValidator.safeParse` before any disk I/O (`electron/main.ts:4439-4444`). Web parity handler does the same (`server/index.ts:2081-2086`). Malformed → `TypeError` thrown to caller, no write. **But** no size cap — see W1.
3. **Injection.** Not exploitable. `ruleId` keys are strings serialized by `JSON.stringify`, which escapes control characters. `severity` is a closed enum. Neither value ever enters a code path that `eval`s, interpolates into HTML, or runs as a shell argument. The file is read back via `JSON.parse`, not `require` or `vm.runInNewContext`.
4. **Web parity.** Yes, `server/index.ts:2079-2090` uses the same `governanceSaveOverridesValidator` schema. Matches Electron behavior (including the same lack of size cap per W1).
5. **Preload exposure.** Typed (not `any`) but loose on `severity: string` — see S1. Runtime Zod in main process is the real gate and does enforce the enum, so a compromised renderer cannot smuggle unknown severities past the write.
6. **File read of corrupt/attacker-controlled file.** `JSON.parse` throws are caught and logged, returning `null` — good. **But** a syntactically valid JSON file with wrong shape passes through uninspected — see W2.

---

## Verified Controls

- Zod validation on write path (both Electron + web) — PASS
- FileTransactionManager atomic write in Electron (Commandment 12/14) — PASS
- `atomicWrite` tmp→rename in web build — PASS
- Path construction uses `path.join` with no renderer-supplied segments — PASS
- Severity closed enum prevents value injection — PASS
- ENOENT suppressed without logging — PASS
- No `child_process`, `eval`, or dynamic require anywhere on the code path — PASS
- Preload surface typed, not `any` — PASS (with tightening suggested in S1)

---

## Scope Coverage

- Reviewed: `electron/main.ts:4432-4472`, `electron/preload.ts:1681-1695`, `shared/ipc-validators.ts:519-537`, `src/adapters/web-api.ts:598-601`, `server/index.ts:2073-2108`
- Skipped: `governanceStore.ts` consumer logic (out of security scope — covered by code reviewer)

---

## Recommendations (Priority-Ordered)

1. **W2 first** — add read-side validation in both handlers. One-line change, closes a real (if local) corruption vector.
2. **W1 second** — add size caps in `shared/ipc-validators.ts`. Defense in depth for runaway renderer / DoS.
3. **S1** — tighten preload/adapter types to the enum.
4. **S2** — trim error logging to `{ code, message }`.

None of these are ship-blockers for UX-P0. The channel is fundamentally sound.
