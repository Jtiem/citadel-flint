# Post-Hoc Security Review — Commit 601daff
**Date:** 2026-04-25
**Reviewer:** flint-security-reviewer
**Round:** 1 (post-hoc catch-up)
**Scope:** seed-from-project tokens IPC + production-build CSP / preload wiring
**Files reviewed:**
- `electron/main.ts` (diff scope only — CSP block, createWindow, tokens:seed-from-project handler)
- `electron/preload.ts` (tokens.seedFromProject exposure)
- `server/index.ts` (web-parity handler, listen binding, ws-token auth)
- `shared/dtcgFlatten.ts`
- `src/App.tsx` (caller)
- `src/types/flint-api.d.ts`
- `electron/__tests__/tokensSeedFromProject.test.ts`

---

## Verdict: **FIX-FORWARD**

No blocking findings. Three warnings worth fixing before public beta; closed beta is defensible as-is. No vulnerabilities that would let a beta tester compromise another tester or escape the workspace boundary. The CSP relaxations are necessary, scoped to localhost, and consistent with how the dev build already runs. The new IPC handler is well-tested (24 tests including malformed-JSON, invalid-input, prototype-pollution paths in the flattener) and reuses prepared statements.

### Risk summary
- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 2 (CSP comment drift — misleading; clear+insert not in a single SQLite transaction)
- **LOW:** 1 (no path-canonicalisation on `projectRoot` in the new handler)
- **INFO:** 2 (process-isolation note on `usePreload`; recursive `flattenDtcg` depth)

---

## Top 3 findings

### [WARNING] Stale CSP comment in `createWindow` contradicts the new policy
- **Location:** `electron/main.ts:496–497`
- **Observed:** Comment reads *"Production CSP omits 'unsafe-eval' — the only new Function() usage in production is inside the sandboxed srcdoc iframe which has its own CSP context."* The actual `PRODUCTION_CSP` constant on line 446 now includes `'unsafe-eval'`.
- **Why it matters:** A future reader (human or agent) will trust the comment and assume the renderer cannot evaluate strings. They may then ship a feature that does, believing the CSP would catch it. Audit trails depend on comments matching code.
- **Fix:** Update the comment to: *"Both dev and production CSPs allow `'unsafe-eval'` because the LivePreview transpile-and-eval pipeline runs in the top-level renderer, not inside an isolated iframe. The eval surface is bounded by the input surface — only project-local TSX is transpiled."*
- **Commandment:** —

### [WARNING] `tokens:seed-from-project` clear-then-insert is not a SQLite transaction
- **Location:** `electron/main.ts:1059–1071`, `server/index.ts:934–944`
- **Observed:** `stmtClearAll.run()` runs, then a per-token loop of `stmtCreate.run(...)`. If any insert throws (e.g., a malformed token value tripping a future NOT NULL/UNIQUE constraint), the user is left with the existing tokens cleared and only a partial set seeded. The handler's outer `try/catch` returns an error string, but the database is already mutated.
- **Why it matters:** Commandment 12 ("Atomic Queuing") applies to file writes but the spirit — atomicity around stateful mutations — applies here too. The risk in practice is low (the schema is forgiving and the next project-open re-seeds), but the fix is a one-line wrap. Existing pattern: `electron/main.ts:4651` already uses `db.transaction(...)` for `insertMany`.
- **Fix:** Wrap the clear + insert loop in a `db.transaction(() => { ... })` call. Mirror in `server/index.ts`.
- **Commandment:** 12

### [WARNING] `projectRoot` is not canonicalised before being joined into a file path
- **Location:** `electron/main.ts:1041–1048`, `server/index.ts:912–918`
- **Observed:** The handler accepts `projectRoot: unknown`, type-checks it as a non-empty string, then `path.join(projectRoot, '.flint', 'design-tokens.json')`. There's no `path.resolve` + boundary check that the resolved path stays under a known workspace root. If a renderer passed `"/etc"` the handler would happily attempt to read `/etc/.flint/design-tokens.json`.
- **Why it matters:** **In Electron** the renderer has `contextIsolation: true` and a vetted preload allowlist — a malicious renderer means a compromised app, at which point this is moot. **In the web build** the handler is exposed via the same JSON-RPC HTTP surface, behind a per-session WS token + `127.0.0.1` bind. The realistic threat is a beta tester accidentally invoking the handler with a wrong path (e.g., a stale project tree state) and reading a JSON file from outside their workspace. Read-only, error-path leak (the path string echoes back in the `sourcePath` field on success and in the `error` string on failure). Worth tightening but not exploitable in the current trust model.
- **Fix:** After validating the string, `const resolved = path.resolve(projectRoot)` and reject if it doesn't match `activeProjectRoot` (or a recently-opened root). Keep the symmetric change in `server/index.ts`.
- **Commandment:** 9 (process boundary spirit) / 14 (bypass-prohibition spirit)

---

## CSP changes — defensible for beta?

| Change | Closed beta | Public beta | Verdict |
|---|---|---|---|
| `'unsafe-eval'` in `script-src` | OK | OK with caveats | The LivePreview engine genuinely needs it (`new Function()` over Babel-transpiled JSX). Removing it would require a Worker-based sandbox (real architecture work, not a beta blocker). |
| `ws://localhost:*`, `ws://127.0.0.1:*` | OK | OK | Required by the embedded server, scoped to loopback. |
| `http://localhost:*`, `http://127.0.0.1:*` in `connect-src` | OK | OK | Same. Clashing-port concern is theoretical: the renderer can only fetch what the SPA code asks it to, and the SPA only points at the server's known port (passed in by the launcher). A second local service on a clashing port would have to be reached by code in our SPA, which doesn't exist. |
| `frame-src` allows `http://localhost:*` and `blob:` | OK | OK | LivePreview srcdoc + ingestion server. Scope is loopback. |
| Preload only attached in dev | OK | OK | Production loads the SPA from the embedded Express server; the SPA uses the web adapter (HTTP+WS). The preload bridge would be redundant and would fight the adapter. The web adapter's surface IS subject to the per-session WS token (`server/index.ts:695–724`) and the 127.0.0.1 bind. |

**What changes for public beta:** Tighten the three warnings above (transaction wrap, comment, path canonicalisation). Beyond that, public-beta-grade hardening would mean a Worker-based LivePreview sandbox to drop `'unsafe-eval'` — that's a roadmap item, not a release blocker.

**Electron Security Tutorial checklist (post-change):**
- [x] Only load secure content (loopback HTTP/WS only)
- [x] Disable Node integration in renderers
- [x] Enable context isolation
- [x] Sandbox — partial (architecturally blocked by ESM preload, documented at `electron/main.ts:471–483`)
- [x] Use a Content-Security-Policy
- [x] Do not use `disableBlinkFeatures` to enable insecure features
- [~] Do not use `allowRunningInsecureContent` — confirmed default
- [~] Do not enable experimental features — confirmed default
- [x] Do not use `enableRemoteModule` — not used
- [x] Verify all external URLs — N/A, all loopback

---

## Embedded server surface vs. preload allowlist

The embedded server's HTTP/WS handler set is built from the same map used by the Electron preload (`handlers.set(...)` calls in `server/index.ts`). They are intentionally near-mirrors. Two notes:

1. **WS upgrade is gated** by a per-session `wsSessionToken` (UUID, regenerated on each server start). Any browser tab that didn't fetch `/api/ws-token` gets a 401 on upgrade. Good.
2. **HTTP IPC is NOT token-gated** — any process on the loopback interface can POST to `/api/invoke` if such a route exists. This is consistent with the closed-beta threat model (single-user laptop, no multi-tenancy) but is the obvious next hardening step if the server ever binds beyond `127.0.0.1`.

---

## tokens.seedFromProject — concrete answers

1. **Path traversal:** Not exploitable in the current model (renderer is trusted via contextIsolation + allowlist, server is loopback-bound). But the handler does not canonicalise `projectRoot` against a known root — see WARN-3.
2. **Recursive flatten + stack overflow:** `flattenDtcg` recurses on each nested `$value`-less object. V8's default stack handles ~10k frames. A pathologically nested DTCG file (10k+ levels) could throw `RangeError: Maximum call stack size exceeded`, which is caught by the outer `try/catch` and returned as `error`. Not a DoS — the worst outcome is one rejected seed and the user falls back to baseline tokens. **No fix required.**
3. **Atomicity:** Not transactional — see WARN-2.
4. **Prototype pollution:** Already defended at `shared/dtcgFlatten.ts:61` (skips `__proto__`, `constructor`, `prototype`). Good.

---

## What should block before tester invitations

**Nothing in this commit blocks closed-beta invitations.** The three warnings are quality-of-implementation issues, not exploit vectors against the closed-beta trust model (single-user laptop, loopback-only server, signed builds going to known testers).

For public beta, fix all three warnings and add a roadmap line for "LivePreview Worker sandbox" so we can drop `'unsafe-eval'` later.

---

## Verified controls
- `contextIsolation: true`, `nodeIntegration: false` — preserved
- WS upgrade authentication via per-session UUID — preserved
- Server binds to `127.0.0.1` only, not `0.0.0.0`
- `flattenDtcg` rejects prototype-pollution keys and strips `$`-prefixed metadata
- 24 unit tests cover happy + malformed + invalid + nested cases for the new handler
- Process boundary intact: no `fs`/`path` imports added to `src/`

## Recommendations (priority-ordered)
1. Fix the stale CSP comment in `electron/main.ts:496–497` (15 minutes).
2. Wrap clear+insert in `db.transaction()` in both `electron/main.ts` and `server/index.ts` (15 minutes).
3. Canonicalise `projectRoot` and check it matches an opened workspace root before joining (1–2 hours including symmetric server change + tests).
4. Roadmap: investigate Worker-based LivePreview sandbox to drop `'unsafe-eval'` from production CSP (multi-day).
