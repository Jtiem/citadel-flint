# IDE↔Glass Integration — Test Coverage and Feature Completeness Review
**Date:** 2026-04-09
**Reviewer:** E2E test specialist audit
**Scope:** `tests/e2e/ide-file-sync.spec.ts`, `src/adapters/web-api.ts`, `server/index.ts`, `src/hooks/useIDEFileSync.ts`, `src/hooks/useContextSync.ts`, `flint-vscode/src/extension.ts`, `flint-vscode/src/flintClient.ts`, `flint-vscode/src/diagnosticsProvider.ts`

---

## Grades

| Dimension | Grade | Reasoning |
|-----------|-------|-----------|
| Test coverage (existing) | D | 3 tests cover the happy path and one negative case, but all 3 share the same underlying assumption that the feature works in web mode — which it does not |
| Feature completeness (web mode IDE sync) | F | The primary IDE→Glass sync channel (`flint:ide-file-selected`) is never emitted by `server/index.ts`. The feature is present in Electron only. |
| Feature completeness (Beacon / context sync) | B | The write pipeline exists and is wired. Gap is on readback validation. |
| Feature completeness (VS Code extension) | C | Extension code is present and architecturally sound, but has zero E2E coverage and a newly-created-files tracking gap in the web server |

---

## Critical Finding: IDE File Sync Is Broken in Web Mode

The core IDE→Glass file sync feature (IDE.2) does not function in the web build. The chain is:

```
VS Code extension writes .flint/ide-active-file.json
  → electron/main.ts stat-polls at 1s intervals
  → emits ipcChannel('ide-file-selected') to renderer
  → web-api.ts subscribe('flint:ide-file-selected')
  → useIDEFileSync calls canvasStore.setActiveFile()
```

`server/index.ts` has NO stat-poll loop for `.flint/ide-active-file.json`. It never emits `flint:ide-file-selected`. A global search across the entire `server/` directory returns zero matches for `ide-active-file`, `ide-file-selected`, or `ideFileSync`. The Electron implementation is in `electron/main.ts` lines 3020–3070 and was never ported.

This means `useIDEFileSync` silently subscribes to a channel that is never emitted. The hook returns without error; Glass just never auto-follows IDE focus.

---

## Numbered Gaps Found

### Gap 1 — `flint:ide-file-selected` never emitted in web mode (CRITICAL)

`server/index.ts` has no equivalent of the `startIDEFileSyncWatcher()` function in `electron/main.ts`. The VS Code extension correctly writes `.flint/ide-active-file.json` on every `onDidChangeActiveTextEditor` event (`extension.ts` line 516), but the web server never reads this file. The entire IDE→Glass auto-follow feature is non-functional in web mode.

**Fix required:** Add a `setInterval` loop to `server/index.ts` (inside `startServer()`) that stat-polls `.flint/ide-active-file.json` at 1-second intervals, reads `{ path, ts }`, validates the path is inside `activeProjectRoot`, and calls `broadcast('flint:ide-file-selected', parsedPath)`. Restart the watcher when `activeProjectRoot` changes (same trigger points as `__flintWebStartFileWatcher`).

---

### Gap 2 — Newly created files are not tracked by the web file watcher (HIGH)

`startWebFileWatcher()` in `server/index.ts` calls `scanWorkspaceFiles(activeProjectRoot)` once at startup and populates `trackedFiles`. Files written to the project directory AFTER the watcher starts are never added to `trackedFiles`. The 1-second `setInterval` only checks files already in the map.

Consequence: A developer creating a new component in the IDE gets no `flint:file-changed` broadcast. LivePreview never updates. The feature only works for files that existed when the server started.

**Fix required:** After each setInterval tick (or on a slower background timer), re-run `scanWorkspaceFiles()` and add any new files to `trackedFiles` with their current `mtimeMs`. Alternatively, replace the stat-poll with `fs.watch()` using recursive mode, which fires for new files.

---

### Gap 3 — WS reconnection does not re-subscribe listeners (MEDIUM)

When the WebSocket drops and `ensureWS()` reconnects after 2 seconds, `channelListeners` (a `Map<string, Set<callback>>`) is preserved across reconnections. Existing subscriptions survive the reconnect because `channelListeners` is module-level and is never cleared in `ws.onclose`. This is actually correct behavior for the Map-based design.

However, there is a subtle race: `ensureWS()` checks `ws.readyState === WebSocket.OPEN`. During the reconnect window (2 seconds), `ws` is `null`/closing. Any call to `subscribe()` during that window calls `ensureWS()` which creates a new WS object, but listeners registered via `onIDEFileSelected` during the original connection are attached to the old closed socket's entry in `channelListeners`. The new socket's `onmessage` handler reads from `channelListeners` directly, so they survive — but any listener registered DURING the reconnect window will correctly use the new socket's channel. The reconnect logic is sound, but it is never tested.

**Gap in tests:** No test verifies that events arrive after a deliberate WS close and reconnect. Gap A test in the new file covers this.

---

### Gap 4 — Beacon (useContextSync) Glass→MCP write path is untested (MEDIUM)

The existing ide-file-sync tests test only the IDE→Glass direction. No test verifies that `useContextSync` writes `.flint/context.json` when Glass state changes. The `context:sync` IPC handler in `server/index.ts` (line 1524) calls `atomicWrite` to `.flint/context.json`. The `context:get-enriched` handler reads it back. Neither direction is covered by an E2E test.

This matters because MCP agents read `flint://session-context` which reads `context.json`. If `useContextSync` stops writing (e.g., `window.flintAPI.syncContext` fails silently), agents see stale state. The `syncContext` failure handling in `useContextSync.ts` is a `.catch` that logs a warning — easy to miss in production.

**Gap in tests:** Gap B test in the new file covers this.

---

### Gap 5 — Path guard only tests sibling directories, not extension filtering (LOW-MEDIUM)

Existing Test 3 in `ide-file-sync.spec.ts` writes a `.tsx` file to the PARENT directory of the project. It does not test whether a `.md`, `.json`, or `.css` file written INSIDE the project directory triggers an event. The server's `scanWorkspaceFiles()` filters on `/\.(tsx?|jsx?)$/` so `.md` files should be excluded — but this is not verified.

Additionally, `validateFilePath()` in `server/index.ts` accepts `.html?` extensions as source files, meaning `.html` files inside the project trigger `flint:file-changed`. Whether this is intentional is unspecified.

**Gap in tests:** Gap C test in the new file covers extension filtering.

---

### Gap 6 — VS Code extension has zero E2E coverage (HIGH)

`flintClient.ts`, `diagnosticsProvider.ts`, `codeActionProvider.ts`, and `extension.ts` are each 200–550 lines of production code with zero Playwright coverage. The only tests for this code are unit tests in `flint-vscode/__tests__/` (if they exist — not found in this audit). The `FlintClient` stdio JSON-RPC bridge, the `DiagnosticsProvider` violation-to-diagnostic mapping, and the `extension.ts` activation path are all untested against a real MCP server.

**Gap in tests:** Gap E test in the new file spawns the real MCP server and calls `flint_status` via `FlintClient` to validate the stdio bridge.

---

### Gap 7 — Rapid-write ordering is untested (LOW-MEDIUM)

The existing tests write exactly one file and assert it appears. They do not test what happens when 5 files are written quickly. This matters because:

- The web server's stat-poll fires every 1 second. If 5 files are created in < 1s, all 5 `flint:file-changed` events fire on the same tick.
- `useIDEFileSync` calls `canvasStore.setActiveFile` for each event. `setActiveFile` is async. Order is not guaranteed.
- `startWebFileWatcher` does not track newly created files (Gap 2), so rapid writes of NEW files will not trigger any events at all.

**Gap in tests:** Gap D test in the new file covers this.

---

### Gap 8 — MCP push channel (mcp-events.jsonl) is untested (MEDIUM)

`server/index.ts` has an `mcpEventsWatcher` that tail-follows `.flint/mcp-events.jsonl` and broadcasts `flint:mcp-event` to Glass. `useMCPEventListener` in the React app subscribes to this. No test verifies that appending a line to `mcp-events.jsonl` results in a `flint:mcp-event` reaching the browser. This is the push channel used by MCP tools to send live governance updates to Glass.

---

## What the New Tests Validate

| Test | Gap | What it proves |
|------|-----|----------------|
| Gap A | #3 | WS reconnect behavior — events arrive after deliberate disconnect |
| Gap B | #4 | Beacon write — `.flint/context.json` updated when Glass state changes |
| Gap C | #5 | Extension filter — `.md`/`.json` files inside project dir are not broadcast |
| Gap D | #7 | Rapid writes — Glass ends on the last file, not an intermediate one |
| Gap E | #6 | FlintClient stdio bridge — calls `flint_status`, gets valid response |
| Gap F | #1 + #2 | Channel mismatch audit — documents that `flint:ide-file-selected` is never emitted and newly created files are not tracked |

Gap F is written as a **negative assertion** — it asserts that `ideFileSelectedReceived` is `false`, because that IS the current state. This makes the gap machine-verifiable and prevents the gap from being marked as "passing" by accident.

---

## What Remains Unvalidated After New Tests

1. **Gap 8** (MCP push channel) — No test verifies that appending to `mcp-events.jsonl` broadcasts `flint:mcp-event` to the browser. Requires a fixture that writes an event and polls the browser.

2. **Gap 2 fix validation** — Once the newly-created-file tracking is fixed (by adding new files to `trackedFiles` mid-session), a regression test for that fix needs to be added.

3. **VS Code extension activation path** — Gap E tests `FlintClient` in isolation but not the full `activate()` function in `extension.ts`. Testing activation requires either a VS Code extension test runner (`@vscode/test-electron`) or mocking the VS Code API. Neither is set up.

4. **DiagnosticsProvider violation mapping** — `parseAuditResponse`, `mapSeverity`, `buildDiagnosticMessage`, and `extractDeltaE` are pure functions but have no Playwright coverage. Unit tests in `flint-vscode/__tests__/` should exist — verify they do before marking ONLINE.

5. **Export gate interaction with context.json** — The export gate reads `canvasStore.mithrilViolations` and `a11yViolations` which are NOT written to `context.json` via `useContextSync` (it writes `violations.mithrilCount` but not the raw violation array). MCP agents calling `flint://session-context` cannot see the exact violation objects, only counts. If an agent needs to call `flint_fix` based on session context, it may be working from incomplete data.

6. **Beacon timestamp freshness** — No test verifies that `context.json` has a recent timestamp. A stale context file (from a previous session) could mislead agents. The `useContextSync` hook writes `timestamp: Date.now()` on every debounce. No test checks that the file is never more than N seconds old while Glass is open.

---

## Summary of Most Important Actions

Listed in priority order:

1. Port `startIDEFileSyncWatcher()` from `electron/main.ts` to `server/index.ts` (Gap 1 — feature is broken)
2. Fix `startWebFileWatcher()` to track newly created files mid-session (Gap 2 — feature is partially broken)
3. Add Gap B test to CI so Beacon write failures are caught automatically (Gap 4 — hidden regression risk)
4. Build `flint-mcp` in CI before running Gap E test so the MCP health check does not skip (Gap 6)
5. Add MCP push channel test (Gap 8 — untested production path used by governance tools)
