# IDE↔Glass Integration — Code Review
**Date:** 2026-04-09
**Reviewer:** Senior Code Review Agent (consensus audit)
**Scope:** IDE→Glass file sync, web server sync chain, VS Code extension, Playwright e2e spec

---

## Overall Grades

| Dimension | Grade | Rationale |
|-----------|-------|-----------|
| Architecture | C+ | The Electron path is sound. The web path has a structural break: the entire `flint:ide-file-selected` broadcast chain described in the test's own header comment does not exist in `server/index.ts`. |
| Test Quality | D | The e2e tests describe a chain that is broken in the web build. They will always fail or time out in that build. The unit tests for `diagnosticsProvider.ts` are good but cover only pure functions. Critical hook and client paths have no coverage. |
| VS Code Extension | B- | Clean lifecycle management. Two significant defects: `process.execPath` used to spawn the MCP server (wrong in Electron extension host), and `flintClient.ts` implements no MCP resources/subscriptions. |
| Reliability | D+ | No recovery on WS reconnect for in-flight listeners. New files written by the IDE are not picked up by the web file watcher unless they were scanned at startup. The extension writes `ide-active-file.json` fire-and-forget with no verification that the file was actually written. |
| Security | B | No injection vulnerabilities in the IPC path. Minor: `globalThis` coupling (`__flintWebStartFileWatcher`) is a code smell with no security boundary. |

---

## Section 1 — Architecture

### 1.1 The Core Defect: `flint:ide-file-selected` Does Not Exist in `server/index.ts`

**Severity: P0 — The web build IDE sync feature does not work.**

The test at `tests/e2e/ide-file-sync.spec.ts:12` documents the intended chain:

```
fs.writeFileSync(projectDir/TestSync.tsx)
  → server/index.ts fsWatch fires
  → broadcast('flint:ide-file-selected', absolutePath)
  → WebSocket push to browser
  → web-api.ts subscribe('flint:ide-file-selected') fires
  → useIDEFileSync hook calls canvasStore.setActiveFile()
```

`server/index.ts` does **not** broadcast `flint:ide-file-selected` anywhere. A search across the full 3,106-line file returns zero matches for this channel name. The broadcast exists only in:

- `electron/main.ts:3057` — inside the 1-second stat-poll watcher on `ide-active-file.json`
- `electron/preload.ts:741` — the IPC bridge

The web file watcher at `server/index.ts:1943–1956` only broadcasts `flint:file-changed` (content updates for files **already in the tracked set**). It does not broadcast `flint:ide-file-selected` for any new file created by an external process (the IDE).

The web-api adapter at `src/adapters/web-api.ts:358–363` subscribes to `flint:ide-file-selected` — a channel that the web server never emits. `useIDEFileSync` at `src/hooks/useIDEFileSync.ts:22` wires into that channel — so in web mode, this hook is entirely inert.

This means:
- Test 1 (`IDE file write triggers Glass to load the new component`) will always time out after 8 seconds in the web build.
- Test 2 (`file watcher broadcasts to WebSocket after project is loaded`) will always time out after 5 seconds.
- Test 3 (`sibling directory guard`) passes vacuously because the channel is never broadcast, so `__testOutsideEventReceived` is never set — the guard passes for the wrong reason.

### 1.2 Web File Watcher Does Not Detect New Files

**Severity: P0**

`startWebFileWatcher()` (`server/index.ts:1930–1957`) scans the project at startup and builds a `trackedFiles` map. The interval at line 1943 only polls files **already in that map**. A file written by the IDE after the watcher starts is invisible to it unless the file was present at scan time.

The `ast:save-file` handler at line 679 partially mitigates this for files saved through Flint itself, but there is no code that adds an externally created file to `trackedFiles`. The test at line 200–201 writes `TestSync.tsx` using Node's `fs.writeFileSync` directly — bypassing the `ast:save-file` IPC handler — so the watcher will never see it.

Even if the broadcast channel existed, it would not fire for these files. This is two compounding P0 defects.

### 1.3 `flintWebStartFileWatcher` Global Coupling

**Severity: P2**

`server/index.ts:1960` exposes `startWebFileWatcher` as `globalThis.__flintWebStartFileWatcher`. This is called from three separate handler closures (lines 838, 909, 1006) to restart the watcher after a project change.

This is a code smell — a module-private function leaking into global state to be called across module boundaries. The correct pattern is to pass the function as a dependency or use a proper event bus. The current approach has no TypeScript type safety at the call sites (all cast to `Record<string, unknown>`), and a future refactor could silently break it.

### 1.4 `useIDEFileSync` Has No Cleanup Guard for Stale Callbacks

**Severity: P2**

`src/hooks/useIDEFileSync.ts:22–33`: The hook calls `window.flintAPI.onIDEFileSelected(callback)` on mount. The cleanup calls `removeIDEFileSelectedListener()`, which calls `unsubscribeAll('flint:ide-file-selected')` (`web-api.ts:362`).

`unsubscribeAll` deletes the **entire listener set** for that channel, not just the one registered by this hook instance. If any other component were to register an `onIDEFileSelected` listener independently, it would be silently removed when this hook unmounts. This is the same architectural mistake as calling `removeAllListeners` in Node's EventEmitter. The correct pattern is to use the unsubscribe return value from `subscribe()` (which the adapter already returns at line 133–135) and call only that closure in cleanup.

### 1.5 `applyBatch` in web-api.ts Silently Drops Mutations

**Severity: P1**

`src/adapters/web-api.ts:319`:
```typescript
applyBatch: (_mutations: unknown[]) => invoke('ai:apply-batch') as Promise<{ ok: boolean }>,
```

The `_mutations` argument is accepted but never forwarded to the IPC call. The handler receives an empty argument list. In the Electron build, mutations are passed and applied. In the web build, every `applyBatch` call is a silent no-op that returns `{ ok: true }`. This violates Commandment 12 (Atomic Queuing) in the web build.

---

## Section 2 — Test Quality

### 2.1 Tests Test a Broken Chain

**Severity: P0**

Tests 1 and 2 in `tests/e2e/ide-file-sync.spec.ts` are testing a code path that does not exist in `server/index.ts`. When run against the web build (which is the primary target per project memory), both tests will time out at their respective poll limits and return `false`, making `expect(syncResult).toBe(true)` and `expect(eventReceived).toBe(true)` fail.

Test 3 passes vacuously — the sibling file guard "works" because the broadcast never fires, not because the guard code is correct.

### 2.2 `getActiveProjectDir` Is Brittle and Will Fail Silently

**Severity: P1**

`tests/e2e/ide-file-sync.spec.ts:90–162`: `getActiveProjectDir` uses three fallback strategies to determine the project directory:

1. **DOM scraping for a header element** (line 100–127): scans `document.querySelectorAll('header *')` for an element whose `title`, `aria-label`, or `data-path` attribute contains an absolute path. This is extraordinarily fragile — any CSS/HTML refactor to the header that removes those attributes silently breaks the test. There is no documented contract that the header element must carry the full path as an accessible name.

2. **HTTP POST to `/api/ipc`** (line 135–154): calls `project:getTree` and checks for `result.path`. The channel `project:getTree` does not appear in `server/index.ts`. This will return 404 or a handler-not-found error, silently resolved by the `catch` clause.

3. **Regex scrape of `page.content()`** (line 157–159): matches `/(?:var\/folders|tmp)[^"'\s]+flint-beta-demo\/demo-\d+/`. This couples the test to the specific path structure of the demo project loader. Any change to the demo path format silently breaks the detection.

If all three fail (which they will whenever the header doesn't carry the expected attributes), the test calls `expect(projectDir).toBeTruthy()` and then hits the `if (!projectDir) return` early exit on line 187. The test appears to pass because the assertion fires before `return`, but Playwright treats an early `return` inside a test as passing — effectively no assertions after line 185 run. This is a silent false-positive.

### 2.3 The 8-Second Timeout Is Not Documented as the Actual Chain Latency

**Severity: P2**

The comment at `ide-file-sync.spec.ts:205–208` says:
> The IDE file watcher (fsWatch) has a 500ms debounce. The WS push adds ~100ms latency. The React state update adds another render tick. We allow 8 seconds total.

But the web server does not use `fsWatch` at all — it uses a 1-second `setInterval` stat-poll (`server/index.ts:1943`). The actual latency budget for the web path (if the chain existed) would be:
- New file scan: only on restart or `project:openPath` — not continuous
- Stat poll interval: 1,000ms per cycle
- WS push: ~50ms
- React render: ~16ms

The 8-second timeout comment is written for the Electron path, not the web path. For the web path, the correct timeout depends on a channel that does not exist.

### 2.4 Test 2 Installs a Global Listener Without Cleanup

**Severity: P3**

`ide-file-sync.spec.ts:270–277`: the test calls `window.flintAPI.onIDEFileSelected(...)` inside `page.evaluate()`. There is no corresponding cleanup (`removeIDEFileSelectedListener`) after the test. In a multi-test run where the page is reused, the listener accumulates across tests. The `page` object is not explicitly closed between tests in this spec — Playwright may reuse the tab.

### 2.5 `diagnosticsProvider.test.ts` — Good but Narrow

The unit tests in `flint-vscode/src/__tests__/diagnosticsProvider.test.ts` are thorough for the five pure functions they cover (`mapSeverity`, `extractDeltaE`, `extractSuggestedToken`, `buildDiagnosticMessage`, `parseAuditResponse`). The test structure is clean and the edge cases are reasonable.

**Missing coverage:**
- `DiagnosticsProvider` class — no tests for the VS Code lifecycle (on-save, on-open, on-close events)
- `extractRange` — not tested at all; the `tagName:line:col` parsing is tested nowhere
- `violationToDiagnostic` — not tested
- `FlintClient.start()` — no test for the connection lifecycle, handshake timeout, or process spawn failure
- `FlintClient.stop()` — no test for graceful shutdown or SIGKILL fallback
- `getMcpTargets()` / `writeMcpEntry()` — exported from `extension.ts` but no tests exist for them

---

## Section 3 — VS Code Extension

### 3.1 `process.execPath` Is Wrong in an Electron Extension Host

**Severity: P1 — MCP server will not spawn on some hosts**

`flint-vscode/src/flintClient.ts:123`:
```typescript
const proc = spawn(process.execPath, [serverPath], { ... })
```

The code comment at `extension.ts:50–53` correctly identifies this problem for `resolveNodePath()`: "process.execPath in a VS Code extension host is the Electron app binary, NOT Node.js." However, `FlintClient.start()` uses `process.execPath` directly to spawn the server process, bypassing `resolveNodePath()` entirely.

This means on VS Code and Cursor (Electron hosts), `process.execPath` is the Electron binary, and `spawn(electronBinary, [server.js])` will fail or behave unexpectedly. The `resolveNodePath()` function exists but is only used by `writeMcpEntry()` in `extension.ts` — it is not passed to or used by `FlintClient.start()`.

### 3.2 MCP Resources Not Implemented in FlintClient

**Severity: P1**

`flintClient.ts` implements only:
- `callTool()` → `tools/call`
- `sendHandshake()` → `initialize`

Missing:
- `resources/read` — no way to fetch `flint://violations/{filePath}`, `flint://dashboard`, `flint://tokens`, etc.
- `resources/list` — cannot enumerate available resources
- `prompts/get` — cannot invoke `flint-sentinel` or `flint-workflow-guide`
- `notifications/tools/list_changed` — no mechanism to receive server-push events when tool definitions change

The governance panel (`webview/governancePanel`) calls only `callMcpTool()`, so it is limited to the 54 MCP tools. It cannot read any of the 13 MCP resources, which means the VS Code extension cannot display `flint://dashboard` health scores, `flint://tokens`, or `flint://agent-risk` without wiring additional `callTool` wrappers — an architectural workaround.

### 3.3 MCP Handshake Is a Polling Loop with a 3-Second Silent Assumption

**Severity: P2**

`flintClient.ts:229–248`:
```typescript
await new Promise<void>((resolve) => {
    const check = setInterval(() => {
        if (this.connected) { clearInterval(check); resolve() }
    }, 100);
    setTimeout(() => {
        clearInterval(check)
        if (!this.connected && this.proc) {
            this.connected = true  // assume connected
            this.onLog('Flint MCP: assumed connected after handshake settle')
        }
        resolve()
    }, 3000)
})
```

The `initialize` request is sent but its response is never awaited — `sendHandshake()` fires the request, then polls stderr for the string `'Flint MCP Server listening'`. If the server emits that string before the initialize RPC round-trips, the client marks itself connected. If neither happens within 3 seconds, it assumes connected anyway.

This means:
- If the server starts slowly (cold build), the 3-second fallback marks `connected = true` before the server can handle `tools/call` requests. The first real call will fail.
- The initialize response from the server (which acknowledges protocol version and server capabilities) is never read by `handleResponse()` because `initialize` has no pending call in `pendingCalls` — the request was sent outside the `rpc()` path, so no `id` was registered.

### 3.4 `.nvm/versions/node/current/bin/node` Is Not a Real Path

**Severity: P3**

`extension.ts:64`:
```typescript
`${process.env['HOME'] ?? ''}/.nvm/versions/node/current/bin/node`,
```

nvm does not create a `current` symlink by default. The canonical path is `~/.nvm/versions/node/<version>/bin/node`. The `current` symlink is only present if the user has configured it explicitly or is using an older nvm. This candidate will silently fail for most nvm users, falling through to the `/usr/bin/node` fallback (which often does not exist on modern macOS) and then to `which node` (which may return an Electron binary as the comment itself warns).

### 3.5 IDE→Glass Sync Path in Extension Writes File Fire-and-Forget

**Severity: P2**

`extension.ts:515–517`:
```typescript
fs.promises.mkdir(flintDir, { recursive: true })
    .then(() => fs.promises.writeFile(syncFile, JSON.stringify({ path: filePath, ts: Date.now() }), 'utf8'))
    .catch(() => { /* Non-fatal */ })
```

The `.catch()` silently swallows all errors. If the `.flint/` directory does not exist and `mkdir` fails for any reason (permissions, disk full), the write never happens. If `writeFile` fails, Glass never learns about the active file change. There is no retry, no fallback, and no user notification. The extension output channel receives nothing from this code path.

At minimum, the catch block should log to the output channel: `log('IDE sync write failed: ...')`.

---

## Section 4 — Reliability

### 4.1 WS Reconnect Does Not Re-Register In-Flight Listeners

**Severity: P1**

`web-api.ts:121–124`:
```typescript
ws.onclose = () => {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
    wsReconnectTimer = setTimeout(() => ensureWS(), 2000)
}
```

When the WebSocket disconnects and reconnects, `ensureWS()` creates a new `WebSocket` instance. The `channelListeners` map is preserved across reconnects (it is module-level), so listeners registered before the disconnect are re-attached to message events on the new socket. This part works.

However, any call to `invoke()` that was in-flight during the disconnect gets a network error and rejects. The 3-retry logic at `web-api.ts:149–167` only retries on non-2xx HTTP — it does not handle WS-disconnect-during-fetch. The fetch goes over HTTP (`/api/ipc`), not WS, so WS reconnect does not affect it. This is actually correct.

The real reliability gap: after a WS disconnect, the `_mcpOfflineToastFired` flag is reset on reconnect (`ws.onopen` at line 113), but in-flight WS-backed subscriptions (e.g., AI streaming chunks via `ai:chunk`) that were interrupted will silently miss events between disconnect and reconnect. No buffering or catch-up mechanism exists.

### 4.2 New Files Created by External IDE Not Detected by Web Watcher

Already documented as P0 in Section 1.2.

### 4.3 Project Root Change Does Not Cleanly Restart All Dependent Watchers

**Severity: P2**

When `activeProjectRoot` changes (e.g., via `project:openPath`), three side effects must restart:
1. `startWebFileWatcher()` — called via `__flintWebStartFileWatcher` global
2. MCP server — restarted via `mcp.start(targetPath)`
3. MCP events tail watcher (`tailMCPEvents`) — references `getMCPEventsFilePath()` which reads `activeProjectRoot`

The MCP events tail watcher is started once (line ~1800 area) and never explicitly restarted when the project changes. `getMCPEventsFilePath()` reads the current `activeProjectRoot` closure variable at call time, so new events will be read from the new project path — but the `mcpEventsOffset` accumulated from the old project will cause the watcher to potentially seek past the beginning of the new file, missing initial events. This is a subtle state corruption bug.

---

## Section 5 — Missing Test Coverage

These scenarios have zero test coverage:

| Scenario | Severity | Notes |
|----------|----------|-------|
| WS disconnect + reconnect: listeners survive | P1 | No test verifies listeners survive the 2-second reconnect cycle |
| New file created externally: not in watcher's initial scan | P0 | The broken path — no test catching this gap |
| `useIDEFileSync` mounts and unmounts | P1 | Hook not tested in isolation; `AppMountGate.test.tsx` only mocks it |
| `FlintClient.start()` when `process.execPath` is Electron binary | P1 | No spawn failure test |
| `FlintClient` handles server exit during pending call | P2 | `handleExit()` exists but is untested |
| `writeMcpEntry()` with malformed JSON in target file | P2 | The function handles this but it is untested |
| `getMcpTargets()` for unknown host (else branch) | P2 | Untested |
| `extractRange()` in `DiagnosticsProvider` | P2 | Not covered at all |
| `DiagnosticsProvider.auditDocument()` when client not connected | P2 | Not tested |
| `applyBatch` web no-op dropping mutations | P1 | No test verifies the argument is dropped |
| Project root change mid-session, file watcher switches correctly | P2 | Not tested |
| `getActiveProjectDir` returns null, test hits early return | P1 | Silent false-positive — no guard |

---

## Numbered Defect List

| # | Severity | File | Line | Defect |
|---|----------|------|------|--------|
| 1 | P0 | `server/index.ts` | — | `flint:ide-file-selected` never broadcast in web build; entire IDE sync chain is broken |
| 2 | P0 | `server/index.ts` | 1930–1957 | Web file watcher only tracks files present at scan time; externally created files are invisible |
| 3 | P0 | `tests/e2e/ide-file-sync.spec.ts` | 207–248 | Tests 1 and 2 test a broken chain; will always fail in web build |
| 4 | P1 | `tests/e2e/ide-file-sync.spec.ts` | 90–162 | `getActiveProjectDir` has three fallback strategies, all brittle; when all fail, test hits `return` before assertions — silent false-positive |
| 5 | P1 | `flint-vscode/src/flintClient.ts` | 123 | `process.execPath` spawns Electron binary in VS Code extension host, not Node.js |
| 6 | P1 | `flint-vscode/src/flintClient.ts` | — | MCP resources/read, resources/list, prompts/get, notifications not implemented |
| 7 | P1 | `src/adapters/web-api.ts` | 319 | `applyBatch` silently drops the `mutations` argument; all mutations are a no-op in web build |
| 8 | P1 | `src/hooks/useIDEFileSync.ts` | 31 | `removeIDEFileSelectedListener` calls `unsubscribeAll`, removing all listeners not just this hook's |
| 9 | P2 | `flint-vscode/src/flintClient.ts` | 229–248 | MCP handshake polls stderr for a string then assumes connected after 3s; initialize response never parsed |
| 10 | P2 | `tests/e2e/ide-file-sync.spec.ts` | 313–357 | Test 3 (sibling guard) passes vacuously — channel never fires, not because guard works |
| 11 | P2 | `flint-vscode/src/extension.ts` | 515–517 | IDE→Glass sync write fire-and-forget with silent catch; failures not logged to output channel |
| 12 | P2 | `server/index.ts` | 1960 | `__flintWebStartFileWatcher` global coupling — no TypeScript type safety, module-private function exposed on globalThis |
| 13 | P2 | `server/index.ts` | ~1800 | MCP events tail watcher not restarted on project change; `mcpEventsOffset` from old project carried over |
| 14 | P2 | `tests/e2e/ide-file-sync.spec.ts` | 270–277 | WS listener registered in test but not cleaned up; accumulates across test runs if page is reused |
| 15 | P2 | `flint-vscode/src/extension.ts` | 64 | `~/.nvm/versions/node/current/bin/node` is not a standard nvm path; will silently fail for most nvm users |
| 16 | P3 | `src/hooks/useContextSync.ts` | 36 | `cursorPosition` is declared as always `null` with a comment saying it is "not yet tracked"; the field exists in `FlintContext` and MCP reads it — agents get stale null permanently |
| 17 | P3 | `tests/e2e/ide-file-sync.spec.ts` | 205–208 | Timeout comment documents Electron's `fsWatch` debounce; does not apply to web stat-poll path |

---

## What Must Be Fixed Before This Can Be Called "A+ Brilliant"

### Must-Fix (P0/P1)

1. **Implement `flint:ide-file-selected` in `server/index.ts`**: The web server needs to monitor `.flint/ide-active-file.json` exactly as `electron/main.ts:3021–3060` does — a 1-second stat-poll that broadcasts `flint:ide-file-selected` when the path changes. Alternatively, parse the `ide-active-file.json` write path from the new-file scan path in the watcher and broadcast when a `.tsx`/`.ts` file is newly written.

2. **Detect new files in web watcher**: `startWebFileWatcher` must re-scan for new files on each interval tick, not just stat existing tracked files. A simple approach: on each interval, re-run `scanWorkspaceFiles(activeProjectRoot)` and add any new paths to `trackedFiles` before the stat comparison loop. Broadcast `flint:ide-file-selected` for any new `.tsx`/`.ts`/`.jsx`/`.js` file added.

3. **Fix `FlintClient.start()` to use `resolveNodePath()`**: The client must pass `resolveNodePath()` (or accept a `nodePath` argument) instead of `process.execPath`. The extension already has the resolver — it just needs to thread it through to `FlintClient`.

4. **Fix `applyBatch` to forward mutations**: `web-api.ts:319` must pass `mutations` to the IPC call: `invoke('ai:apply-batch', mutations)`. The server handler at `server/index.ts:2148` (`async () => ({ ok: true })`) also needs to be implemented properly.

5. **Fix `useIDEFileSync` cleanup**: Replace `unsubscribeAll` with the unsubscribe function returned by `subscribe()`. Store the unsub function in a ref and call it in the cleanup closure.

6. **Rewrite `getActiveProjectDir`**: It should not scrape the DOM. The server should expose a stable IPC handler (`project:getActiveRoot` or similar) that returns `activeProjectRoot`. The test should call that endpoint directly. If this requires wiring a new handler, wire it.

7. **Fix Test 3 (sibling guard)**: The test must verify the guard is enforced server-side, not rely on the channel never firing. If the channel did fire, the test would need to confirm the path guard rejected it. The test as written cannot distinguish between "the server enforced the guard" and "the server never implemented the feature."

### Should-Fix (P2)

8. **Log sync write failures in extension**: The `.catch()` in `extension.ts:517` must at minimum call `log(...)` with the error message.

9. **Restart MCP events tail watcher on project change**: When `activeProjectRoot` changes, reset `mcpEventsOffset` to 0 and re-call `tailMCPEvents()`.

10. **Replace `globalThis.__flintWebStartFileWatcher` coupling**: Use a proper dependency injection pattern. The `startWebFileWatcher` function should be returned from the watcher setup block and stored in a typed local variable, then passed explicitly to the handlers that need it.

11. **Implement MCP resources in `FlintClient`**: Add a `readResource(uri: string)` method using `resources/read` JSON-RPC. The governance panel webview needs this to display dashboard data without tool wrappers.

12. **Fix MCP handshake**: Implement a proper `initialize` → await response → `initialized` notification sequence per the MCP spec. Remove the 3-second silent fallback.

---

## Summary

The IDE↔Glass integration has a complete P0 feature break in the web build: the channel that the entire sync chain depends on (`flint:ide-file-selected`) is never broadcast by `server/index.ts`. The e2e tests describe this chain correctly but test against code that does not implement it. A passing CI run on the web build gives false confidence.

The VS Code extension has solid structure but is hamstrung by spawning the wrong Node.js binary in Electron extension hosts and an incomplete MCP client that cannot read resources. The diagnostics transformation tests are well-written but cover only the pure-function layer.

Reliability is acceptable for a single-session happy path but has documented failure modes on reconnect, project change, and external file creation. None of these failure modes have any error visibility in the output channel or UI.

This cannot be shipped as IDE→Glass sync until defects 1–7 are resolved.
