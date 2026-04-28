# Security Review — HELLO-FLINT-PHASE-A
**Phase:** HELLO-FLINT-A
**Reviewer:** flint-security-reviewer
**Date:** 2026-04-26
**Round:** 1
**Verdict (derived):** BLOCK — two blocking findings exist; security dimension automatically escalates.

---

## Threat-model verdict in plain language

The new IDE-detection and MCP-config-write surface is, on the **path-traversal** axis, **clean**. The bulk writer never trusts caller-supplied config paths: the renderer's `editors` array is mapped server-side via `detectInstalled()` to a hardcoded set of macOS paths, and the renderer's `mcpServerPath` is rejected unless it equals the server-computed canonical path. The FileTransactionManager honors atomic write routing — `mcpConfigWriter.ts` contains zero direct `writeFile`/`writeFileSync` calls and the source-level grep test enforces it.

The blocking issues live at a different layer: **how the writer treats malformed or unexpected existing config files**. Two failure modes silently destroy user data:

1. **Malformed JSONC** (e.g., a Cursor user with a trailing comma or unterminated string in `settings.json`) is caught by a bare `catch {}` and replaced with a fresh `{ mcpServers: { flint: {...} } }` — wiping every other editor setting on disk.
2. **Non-object `mcpServers`** (e.g., the user has `"mcpServers": []` or some legacy plugin wrote a string there) is cast through TypeScript's `as Record<string, unknown>` and then mutated as if it were an object. JSON serialization drops named properties on arrays; the result is a config with no flint entry visible, and the user's other entries silently lost.

The contract's `config-merge-preservation` invariant says "0 lost entries across 100 randomized fixtures." The 100 fixtures all assume `mcpServers` is an object and the file is valid JSON. The real world is messier than that, especially for VS Code `settings.json` which routinely contains JSONC syntax (comments AND trailing commas).

This is also the closed-beta-blocking surface. Corrupting a tester's editor config on first launch is the worst possible first impression — and the failure is silent (`preservedEntries: 0` looks fine in the UI).

There are also a handful of warnings and suggestions. The IPC payload schema declared in `shared/ipc-validators.ts` does not match its own JSDoc — it claims `editors` is non-empty and `mcpServerPath` is `min 1 char`, but actually allows `[]` and `""`. The `/api/ipc` route has no per-request auth (mitigated by 127.0.0.1 bind, but worth a one-line check). The `FLINT_PROJECT_ROOT` env baked into the editor config becomes stale when the user opens a different project. None of these are blocking, but the schema/comment drift is the kind of bug that bites you a sprint later.

---

## Findings

### BLK-1 — Malformed JSONC config is silently overwritten, destroying user settings
**Severity:** blocking
**Scope:** one-file
**Commandment:** 14 (Bypass Prohibition — atomic writes mean nothing if the source we read was discarded)

**Evidence:**
- `server/services/mcpConfigWriter.ts:121-134` — `readExistingConfig()` swallows `JSON.parse` errors and returns `{}`
- `server/services/mcpConfigWriter.ts:165-188` — `writeMcpConfig()` then writes `JSON.stringify({ mcpServers: { flint: {...} } })` over the original file via FileTransactionManager
- `server/__tests__/helloFlintIpc.test.ts:625-649` — the property test confirms preservation only on valid JSON; no fixture covers parse failure

**Observed:**
```ts
function readExistingConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {}
  }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const stripped = stripJsoncComments(raw)
    return JSON.parse(stripped) as Record<string, unknown>
  } catch {
    // Unreadable or unparseable config — start fresh to avoid data loss
    // (preservedEntries will be 0, which is honest).
    return {}
  }
}
```

The "start fresh to avoid data loss" comment is the inverse of what actually happens. An unparseable Cursor `settings.json` (trailing comma, unterminated string, encoding issue) is replaced with a config that contains only flint. Every existing editor setting — themes, keybindings, MCP servers, language preferences — is destroyed via atomic rename.

`preservedEntries: 0` surfaces in the verify UI, but the user can't distinguish "had no entries to preserve" from "your entire config was just thrown out." `stripJsoncComments` is a hand-rolled stripper; it does not handle `\u` escapes inside strings, regex literals, or trailing commas — all of which are common in editor settings files.

**Rationale:**
This is the worst-case first-launch failure. A closed-beta tester opens Flint, clicks "Let's go", picks Cursor, sees "Done. I added Flint to your Cursor settings — your other MCP servers are untouched." — and their entire Cursor settings file is gone. There's no undo because the original was renamed-over via atomic write. The contract risk #2 explicitly calls out "What happens on parse failure — do we refuse to write, or silently overwrite?" — the implementation chose silently overwrite without surfacing the choice in the UI or the contract test fixture.

**Proposed fix:**
Refuse to write when the source file exists but cannot be parsed. Return `{ failed: [{ editor, reason: "Couldn't read your existing config — I won't overwrite it. Use the manual snippet path instead." }] }` and route the user to the manual fallback. Add a test fixture: `mcpConfigWriter:refuses to overwrite unparseable config` that asserts the original bytes are unchanged after a write attempt against a malformed file. The contract's risk #2 already names this mitigation as required.

**Status:** open

---

### BLK-2 — Non-object `mcpServers` value is silently corrupted via type-assertion lie
**Severity:** blocking
**Scope:** one-file
**Commandment:** 14

**Evidence:**
- `server/services/mcpConfigWriter.ts:169` — `const existingServers = (config.mcpServers ?? {}) as Record<string, unknown>`
- `server/services/mcpConfigWriter.ts:175-180` — mutates `existingServers['flint'] = ...` regardless of underlying type
- No runtime type-check in source; no test fixture covers `mcpServers: []`, `mcpServers: "..."`, `mcpServers: false`, etc.

**Observed:**
The writer performs a TypeScript cast from `unknown` to `Record<string, unknown>` without any runtime validation. If the user's existing `mcpServers` is:
- An array (`[]`) — `Object.keys` returns indices, `existingServers['flint'] = ...` sets a named property on the array, JSON serialization drops named props on arrays. **flint entry never written; preservedEntries reports a misleading count of array indices.**
- A string, number, or boolean — `Object.keys` returns `[]` (or character indices for strings via String wrapper), property assignment may throw or silently fail in strict mode.
- `null` is the only falsy value handled correctly because of the `??` operator; `false`, `0`, and `""` slip through.

**Rationale:**
A type cast in TypeScript is a promise to the compiler, not a runtime check. The contract assumes editor config files always have `mcpServers` as either absent or an object — but Flint is shipping into the wild where users have plugin-managed configs, partial migrations, and corrupted state. Today this is a low-probability path; in a closed beta of designers using a wide range of editor setups it will hit eventually, and the failure is silent (the user will think Flint connected, but the MCP entry isn't actually in their config).

**Proposed fix:**
Replace the cast with a runtime type guard:
```ts
const rawServers = config.mcpServers
const existingServers: Record<string, unknown> =
  rawServers !== null
  && typeof rawServers === 'object'
  && !Array.isArray(rawServers)
    ? { ...(rawServers as Record<string, unknown>) }
    : {}
```
And if the original `mcpServers` was a non-object truthy value, refuse to overwrite (same path as BLK-1) — the user's config is in a state Flint doesn't understand, and silently flattening it is the wrong default. Add unit fixtures for each malformed type.

**Status:** open

---

### WARN-1 — Schema declares `editors` non-empty and `mcpServerPath` non-empty, but Zod schema enforces neither
**Severity:** warning
**Scope:** one-line
**Commandment:** 14 (Design by Contract at the process boundary)

**Evidence:**
- `shared/ipc-validators.ts:618-626` — JSDoc says `editors: non-empty array... 1..3` and `mcpServerPath: absolute path string, min 1 char`. Schema is `z.array(z.enum(...))` (allows `[]`) and `z.string()` (allows `""`).
- `server/__tests__/helloFlintIpc.test.ts:779-789` — test claims to "reject empty editors array" but builds its own inline schema with `.nonempty()`, not the production schema.
- `shared/ipc-validators.js:478-481` — same drift in the compiled mirror.

**Observed:**
```ts
// Comment lies:
//   editors: non-empty array of editor names (1..3; handler dedupes).
//   mcpServerPath: absolute path string, min 1 char.
export const helloWriteMcpConfigBulkSchema = z.object({
  editors: z.array(z.enum(['claude-code', 'cursor', 'vscode'])),  // no .nonempty()
  mcpServerPath: z.string(),                                       // no .min(1)
})
```

Sending `{ editors: [], mcpServerPath: "" }` passes Zod, then reaches the `mcpServerPath !== canonicalMcpPath` check, and is rejected — but only because the canonical path is non-empty. If the canonical path resolution ever returned `""` (e.g., bundling regression where `flint-mcp/dist/server.js` doesn't resolve), the empty-string mismatch would silently be `"" === ""` → true, and the bulk writer would proceed with no editors and a stale path.

**Rationale:**
The point of having a Zod validator at the boundary is to make the validator the source of truth. When the JSDoc says one thing and the schema another, the schema wins and the comment becomes a trap — future readers will assume the constraint is enforced. The test in `helloFlintIpc.test.ts:779` reinforces the trap because it tests an inline schema that does include `.nonempty()` and passes, giving false confidence that the production schema is constrained.

**Proposed fix:**
```ts
export const helloWriteMcpConfigBulkSchema = z.object({
  editors: z.array(z.enum(['claude-code', 'cursor', 'vscode'])).min(1).max(3),
  mcpServerPath: z.string().min(1),
})
```
Update `shared/ipc-validators.js` mirror in the same commit. Update the test to import the production schema instead of building an inline copy. Run `tsc -b` to confirm no callers depended on the loose typing.

**Status:** open

---

### WARN-2 — `/api/ipc` route has no per-request auth; any localhost-bound process or browser tab can invoke `hello:write-mcp-config-bulk`
**Severity:** warning
**Scope:** one-file
**Commandment:** 14

**Evidence:**
- `server/index.ts:4582-4621` — `/api/ipc` POST handler has no header check, no token check, no Origin check
- `server/index.ts:707-709` — `/api/ws-token` returns the WS token to anyone who asks (used to gate WebSocket upgrades, but not REST IPC)
- `server/index.ts:4938` — `server.listen(port, '127.0.0.1', ...)` correctly limits to loopback
- WebSocket upgrade does enforce `?token=` (lines 714-730), creating an asymmetry where the push channel is gated but the REST IPC is not.

**Observed:**
The new `hello:write-mcp-config-bulk` channel is reachable over HTTP from any localhost-bound process — another browser tab, a malicious npm postinstall script, a curl from the user's terminal — without authentication. The ws-token gate exists but is only checked on the WebSocket upgrade path, not on `/api/ipc`.

**Rationale:**
Closed-beta-blocking? No — Phase A explicitly scopes "process boundary" to "browser tab in the user's own session." 127.0.0.1 binding closes the LAN attacker. But a malicious dev-dependency that runs a postinstall script and POSTs to `localhost:<port>/api/ipc` could write arbitrary editor MCP configs, including pointing the editor's MCP server at a malicious binary. Today the bulk writer's `mcpServerPath` mismatch check makes the attack harder — the attacker has to first call `hello:detect-editors` to learn the canonical server path, then POST it back. Trivially scriptable.

The asymmetry is the smell: if the WS channel is worth gating, so is the REST IPC. This is also a pattern that will recur in later phases that introduce more sensitive write channels, so fixing it now is cheaper than fixing it under fire.

**Proposed fix:**
Require the same `wsSessionToken` on `/api/ipc` requests via a header (`X-Flint-Session: <token>`). The web-api adapter would fetch the token once and attach it to every IPC POST. Reject requests without the header with 401. This is a 20-line change in `server/index.ts` + a small change in `src/adapters/web-api.ts`. Out-of-scope for Phase A on its own, but should be queued before Phase B adds more write channels.

**Status:** open

---

### WARN-3 — `FLINT_PROJECT_ROOT` baked into the editor config goes stale when the user opens a different project
**Severity:** warning
**Scope:** one-file

**Evidence:**
- `server/services/mcpConfigWriter.ts:175-180` — writes `env: { FLINT_PROJECT_ROOT: projectRoot ?? '' }` into the editor config
- `server/index.ts:3378-3382` — `writeMcpConfigBulk(payload, editorConfigPaths, activeProjectRoot)` snapshots `activeProjectRoot` at write time
- `server/index.ts:1222-1223, 1331, 1453, 1911` — `activeProjectRoot` is mutated whenever the user opens or creates a project

**Observed:**
The Hello flow runs once on first launch and bakes the current `activeProjectRoot` into the editor's MCP config as `FLINT_PROJECT_ROOT`. If the user opens a different project later (which is the normal flow), the editor's MCP server will keep using the FIRST project root the user happened to be in when the auto-connect ran. The Flint MCP server may then audit / index / write to a project the user isn't actively working on.

**Rationale:**
Not strictly a security issue — the user opened both projects intentionally — but it's an incorrect-state issue with security-flavored consequences (the MCP server may surface design tokens or violations from the wrong project, leak file paths in error messages that don't match the project the user is looking at, etc.). The legacy `setup:write-mcp-config` handler has the same behavior, so this isn't a regression. But Phase A is the right time to decide whether `FLINT_PROJECT_ROOT` should be set at all — the MCP server can probably derive it from `process.cwd()` at the time the editor invokes it, which would track the editor's working directory instead of a stale snapshot.

**Proposed fix:**
Either (a) omit `FLINT_PROJECT_ROOT` entirely and have flint-mcp derive the project root from cwd / nearest `.flint/` ancestor, or (b) document explicitly that re-running the connection flow (Help → "Re-run the connection") is the supported way to update the baked-in path. Probably (a). Out-of-scope for Phase A; flag as a Phase B item.

**Status:** open

---

### WARN-4 — `mcpConfigWriter` accepts a relative `mcpServerPath` despite the contract's "absolute path" promise
**Severity:** warning
**Scope:** one-line

**Evidence:**
- `shared/ipc-validators.ts:625` — `mcpServerPath: z.string()` with no path-shape constraint
- `server/services/mcpConfigWriter.ts:177` — `args: [mcpServerPath]` written to the editor config verbatim
- `server/services/ideDetection.ts:58-61` — `getMCPServerPath` always returns an absolute path via `path.resolve`, so the canonical path comparison closes the loop in practice

**Observed:**
The bulk handler rejects mismatches between renderer-supplied `mcpServerPath` and the server-canonical one, which closes the path-injection vector. But the schema doesn't assert "this is an absolute path", and the writer doesn't either. If a future refactor changes how the canonical path is computed (e.g., during packaging), a relative path could end up in the editor config, breaking MCP startup but not in a way the writer surfaces.

**Rationale:**
Defense in depth. The current mismatch check is correct, but it's a single line away from a regression. A `.startsWith(path.sep)` or `path.isAbsolute()` assertion in the schema (or just before the write) would make the invariant explicit.

**Proposed fix:**
Add `.refine(path.isAbsolute, "mcpServerPath must be absolute")` to the Zod schema. This needs the runtime `path` module imported into the validator file, which is fine (it's already a Node-only module).

**Status:** open

---

### SUG-1 — Detection result `configPath` strings render the user's home directory in the welcome UI
**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:462-480` — `EditorDetectionRow` renders `Found Cursor ✓` (label only, no path) — **good, no leak in the row**
- `src/components/ui/HelloFlintWelcome.tsx:646-651` — `ManualPanel` renders `<code>{mcpServerPath}</code>` — this IS the absolute path, including the user's home dir
- The screen has no telemetry events emitted in Phase A (`nonGoals`), so paths don't leave the box

**Observed:**
The connect-confirm panel only renders editor labels — paths are hidden, good. The manual panel intentionally shows the resolved server path in a `<code>` element so the user can copy the snippet. React string-children auto-escape, so XSS via the path is not exploitable. The path itself includes `/Users/<username>/...` — if the user takes a screenshot of the manual panel for a support thread, their username leaks.

**Rationale:**
Low-impact privacy nit. The path is already on the user's machine in a file they can read; rendering it in their own UI doesn't create new exposure. The concern is screenshot-driven leakage in support channels. Phase C introduces telemetry; that's the right time to revisit this.

**Proposed fix:**
None for Phase A. Optionally, the manual panel could render `~/path/to/flint-mcp/dist/server.js` (using `~` for `os.homedir()`) and copy the absolute version to the clipboard. Defer to Phase C.

**Status:** open

---

### SUG-2 — `alreadyConnected` race: response can resolve and call `onComplete()` while the user has already advanced past welcome and a writer is mid-flight
**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:130-146` — mount-time `useEffect` fires `alreadyConnected()`; `cancelled` flag only blocks the `onComplete()` call after unmount, not after user interaction
- `src/components/ui/HelloFlintWelcome.tsx:175-195` — `handleLetsGo` doesn't cancel or await the in-flight `alreadyConnected()` call
- The contract acknowledges the case (`testBoundaries:HelloFlintWelcome:already-connected fast path: alreadyConnected resolves after user clicks Let's go`) but the implementation doesn't guard against it

**Observed:**
On a slow filesystem (encrypted homedir, fuse mount, NFS), `alreadyConnected()` may take longer than the user takes to read the welcome and click "Let's go." If the user clicks before the check resolves, both code paths run: the writer starts, then `alreadyConnected()` resolves `connected: true` and calls `onComplete()`. The component unmounts mid-write. The writer's promise resolves to nobody. The atomic rename either completes or doesn't — the user's editor config state is non-deterministic from their POV.

**Rationale:**
Low-likelihood, low-impact (writer is idempotent, atomic write is atomic). Worth a single guard so the contract test actually passes the edge case it names.

**Proposed fix:**
Track a `userAdvanced` ref that flips to true on `handleLetsGo`. If the `alreadyConnected` promise resolves after `userAdvanced.current === true`, ignore the result.

**Status:** open

---

### SUG-3 — Manual snippet omits `FLINT_PROJECT_ROOT`, so manual-path users get a different config than auto-path users
**Severity:** suggestion
**Scope:** one-line

**Evidence:**
- `src/components/ui/HelloFlintWelcome.tsx:69-79` — `buildManualSnippet` produces `{ command: 'node', args: [mcpServerPath] }` with no `env`
- `server/services/mcpConfigWriter.ts:175-179` — auto-writer produces the same shape PLUS `env: { FLINT_PROJECT_ROOT: ... }`

**Observed:**
A user who picks "I'll do this manually" gets a snippet without `FLINT_PROJECT_ROOT`. The MCP server then has to derive the project root from cwd. A user who picks the auto path gets the env baked in. Two slightly different configs ship from the same first-launch screen.

**Rationale:**
Not a security issue — manual path is a user choice — but it's an inconsistency. If WARN-3 is fixed by removing `FLINT_PROJECT_ROOT` from the auto path entirely, this resolves itself.

**Proposed fix:**
Either remove `FLINT_PROJECT_ROOT` from the auto-write path (preferred — see WARN-3) or include it in `buildManualSnippet`. Don't let the two paths diverge.

**Status:** open

---

## Rubric

| Criterion | Result |
|-----------|--------|
| `helloWriteMcpConfigBulkSchema` enforces `editors.length ≥ 1` and `mcpServerPath.length ≥ 1` | fail |
| Renderer-supplied config paths are not used; bulk handler derives paths from `detectInstalled()` server-side | pass |
| Renderer-supplied `mcpServerPath` is rejected unless it equals server-canonical path | pass |
| `mcpConfigWriter.ts` contains zero direct `fs.writeFile`/`writeFileSync` calls | pass |
| All disk writes route through `FileTransactionManager` (atomic `.tmp` → rename) | pass |
| Existing valid JSON config preserves all entries byte-for-byte | pass |
| Existing JSONC config (with comments) parses without throwing | pass |
| Existing INVALID JSON config is NOT silently overwritten | fail |
| Existing `mcpServers` of non-object type is NOT silently corrupted | fail |
| Detection paths are constants based on `os.homedir()` and known editor locations | pass |
| Detection rejects symlink-traversal beyond the home directory | n/a (`existsSync` does not follow symlinks for stat in macOS, and only known paths are probed) |
| Manual snippet rendered through React text content (auto-escaped, no `dangerouslySetInnerHTML`) | pass |
| `/api/ipc` enforces auth on requests | fail |
| `/api/ipc` is bound to 127.0.0.1 only (LAN attacker excluded) | pass |
| WebSocket upgrade enforces session token | pass |
| `hello:write-mcp-config-bulk` Zod parse runs at handler entry, rejects on parse failure | pass |
| `hello:detect-editors` and `hello:already-connected` accept void payload (no payload Zod parse needed) | pass |
| Error messages returned to renderer never include raw fs error stack | pass |
| `JSON.stringify` cannot smuggle attacker-controlled JSON (the merged entry is built from typed fields, not user-controlled strings) | pass |

---

## Scope Coverage

**Reviewed:**
- `server/services/ideDetection.ts`
- `server/services/mcpConfigWriter.ts`
- `server/services/fileTransactionManager.ts`
- `server/__tests__/helloFlintIpc.test.ts`
- `server/index.ts:3329-3401` (the three new handlers)
- `server/index.ts:4582-4621` (`/api/ipc` route)
- `server/index.ts:700-730` (WS token + bind)
- `shared/ipc-validators.ts:594-651`
- `shared/ipc-validators.js:466-498`
- `src/adapters/web-api.ts:642-689`
- `src/types/flint-api.d.ts:2117-2171`
- `src/components/ui/HelloFlintWelcome.tsx`
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md`
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts`

**Skipped:**
- `electron/preload.ts` — Phase A is web-transport-first by design (per scope guidance)
- Legacy `setup:*` handlers in `server/index.ts:3220-3327` — pre-existing, out of scope
- Phase B work — out of scope

---

## Counts
- blocking: 2
- warning: 4
- suggestion: 3

## Verdict
**BLOCK** — derived from `deriveVerdict(findings, 'security')`. Security-dimension blockers escalate automatically.

## Recommendations (priority order)

1. **Fix BLK-1 and BLK-2 before any closed-beta build ships.** The "first impression" failure mode of corrupting a tester's editor config is the worst possible Phase A outcome. Both fixes are one-file, one-day changes. Add the missing test fixtures: malformed JSON, `mcpServers: []`, `mcpServers: "string"`, `mcpServers: false`.
2. **Tighten `helloWriteMcpConfigBulkSchema`** (WARN-1). Five-line change. Update both the `.ts` and `.js` mirrors. Update the test to import the production schema instead of an inline copy.
3. **Decide what to do with `FLINT_PROJECT_ROOT`** (WARN-3 / SUG-3). Probably remove it. If kept, document the staleness behavior in HelpPanel.
4. **Queue the `/api/ipc` auth gate** (WARN-2) for Phase B before any new write channels are added. Asymmetric auth (WS gated, REST not) is a smell that compounds.
5. SUG-1, SUG-2, SUG-3 — defer to Phase B/C with explicit owners.
