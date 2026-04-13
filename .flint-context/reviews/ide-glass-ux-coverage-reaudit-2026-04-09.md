# IDE ↔ Glass Integration — Post-Fix Validation Audit
**Date:** 2026-04-09  
**Auditor:** flint-e2e-specialist  
**Scope:** Verify 5 fixes applied in prior audit pass; assess unit test quality; assess e2e coverage gaps

---

## Implementation Verification

### Fix 1 — `server/index.ts`: `startIDEFileSyncWatcher` stat-poll
**Result: PASS**

The implementation at lines 2022–2055 is correct. Specific verification:

- `setInterval` runs every 1,000ms — matches the spec.
- `fs.stat(ideJsonPath)` catches `ENOENT` silently — correct.
- `mtimeMs > ideFileSyncLastMtime` — mtime-change guard is present and correct.
- `ideFileSyncLastMtime = mtimeMs` is assigned before the broadcast, not after — prevents double-broadcast on the same mtime (correct ordering).
- Path validation at line 2044: `filePath.startsWith(activeProjectRoot + path.sep)` — uses `path.sep`, which is the correct boundary guard (`/Users/foo` must not match `/Users/foobar`).
- Extension filter at line 2045: `/\.(tsx?|jsx?)$/.test(filePath)` — matches `.ts`, `.tsx`, `.js`, `.jsx`. Correct.
- `filePath !== ideFileSyncLastPath` dedup guard is present.
- Broadcast payload is `{ path: filePath }` — matches what `useIDEFileSync` reads (`fp` from `onIDEFileSelected`, which in the server becomes the `data` argument; the hook passes it as `filePath: string` directly).

**One minor concern:** `startIDEFileSyncWatcher` is called unconditionally at startup (line 2063) when `activeProjectRoot` may be an empty string (if no project was opened via CLI). In that case `ideJsonPath` would be `/.flint/ide-active-file.json` which will always throw `ENOENT`, making the loop a no-op. This is harmless but wasteful. Not a regression — same behavior as the Electron process.

---

### Fix 2 — `server/index.ts`: `startWebFileWatcher` new-file detection
**Result: PASS with caveat**

The implementation at lines 1986–1997 is correct: on each tick, `scanWorkspaceFiles(activeProjectRoot)` is called and any path not already in `trackedFiles` is stat'd, added, and broadcast as `{ type: 'add', path: filePath }`.

**Caveat — payload shape inconsistency:** The modification event (line 1982) broadcasts `{ filePath, content }` but the new-file event (line 1994) broadcasts `{ type: 'add', path: filePath }` — different field names (`filePath` vs `path`). The `onFileChanged` callback type in `web-api.ts` (line 243) declares `(data: { filePath: string; content: string })`, which does not include `type` or `path`. Consumers checking `data.filePath` will get `undefined` for the `add` event. The Gap F test at line 634 also checks `data.filePath.includes('ChannelAudit')`, which will fail silently for newly-created files (returns undefined, no throw). This is a pre-existing shape inconsistency, not introduced by this fix, but the fix did not normalize it.

**Impact:** The `add` event is broadcast but React consumers cannot read the file path from it using the declared type. The file watcher's primary use case — auto-loading modified files — still works because modifications use `{ filePath, content }`. The `add` event is only consumed by code that checks for `{ type: 'add' }` explicitly (currently none in `src/`).

---

### Fix 3 — `src/adapters/web-api.ts`: `applyBatch` forwards mutations
**Result: PASS (no-op fix, semantically correct)**

Line 330: `applyBatch: (mutations: unknown[]) => invoke('ai:apply-batch', mutations) as Promise<{ ok: boolean }>`

`mutations` is passed as the first element of the `args` array to `invoke`. The server-side handler at `server/index.ts:2258` is `handlers.set('ai:apply-batch', async () => ({ ok: true }))` — it ignores arguments entirely. The Electron handler at `electron/main.ts:2335` also ignores args: `ipcMain.handle('ai:apply-batch', (): { ok: boolean } => ({ ok: true }))`.

This is correct by design: the IPC call is a sentinel ACK — the actual AST mutation runs in `editorStore.applyBatch` in the renderer. The prior missing argument was a bug only in the sense that the argument was not transmitted; the server-side contract was never broken. The fix is sound.

---

### Fix 4 — `src/adapters/web-api.ts`: WS reconnect exponential backoff
**Result: PASS**

Lines 95–97 define the constants:
```
WS_MAX_ATTEMPTS = 50
WS_BASE_DELAY_MS = 2000
WS_MAX_DELAY_MS = 60_000
```

Line 132: `const delay = Math.min(WS_BASE_DELAY_MS * Math.pow(1.5, _wsReconnectAttempts), WS_MAX_DELAY_MS)`

- Attempt 0: `2000 * 1.5^0 = 2000ms` — correct 2s base.
- Attempt 1: `2000 * 1.5^1 = 3000ms`
- Attempt 10: `2000 * 1.5^10 = ~115s` → capped at `60_000ms` — cap works correctly.
- `_wsReconnectAttempts` increments after delay is computed (line 133), so attempt 0 uses `1.5^0 = 1` — no accidental zero-delay first retry.
- `_wsReconnectAttempts` resets to `0` on `ws.onopen` (line 119) — correct.
- Guard at line 128–130: `>= WS_MAX_ATTEMPTS` bails before scheduling — correct (avoids scheduling a 51st attempt).

No issues.

---

### Fix 5 — `src/hooks/useIDEFileSync.ts`: cleanup unsubs only its own callback
**Result: PASS**

Lines 37–43:
```typescript
const unsub = window.flintAPI.onIDEFileSelected(handleIDEFile)
return () => {
    if (typeof unsub === 'function') {
        unsub()
    }
}
```

`onIDEFileSelected` in `web-api.ts` calls `subscribe(channel, callback)` which returns `() => channelListeners.get(channel)?.delete(callback)`. This is an unsub function that removes only the specific callback instance from the Set — not the entire channel. The cleanup correctly calls this per-instance unsub, not `removeIDEFileSelectedListener()` (which calls `unsubscribeAll` and nukes the whole channel).

In Electron mode `onIDEFileSelected` returns `void`, so `typeof unsub === 'function'` is `false` — no error, correct guard.

---

## Gap F Assertion: Should it Flip to `toBe(true)`?

**Answer: YES — the assertion on line 699 must flip from `toBe(false)` to `toBe(true)`.**

The test at line 603–704 was written to document a gap: `flint:ide-file-selected` was never emitted by `server/index.ts`. Fix 1 has now added `startIDEFileSyncWatcher` which emits exactly `broadcast('flint:ide-file-selected', { path: filePath })`.

However, there is a subtlety: Gap F test creates a NEW file (`ChannelAudit.tsx`) and writes an IDE-active-file JSON to trigger the event. It is testing `onIDEFileSelected`, which the server now emits. But the test as written does NOT actually write a `.flint/ide-active-file.json` file — it writes `ChannelAudit.tsx` directly into the project dir and expects the IDE sync to fire. This conflates two separate channels:

- `flint:file-changed` — triggered by the file watcher when a tracked `.tsx` file is modified.
- `flint:ide-file-selected` — triggered by the stat-poll reading `.flint/ide-active-file.json`.

Writing `ChannelAudit.tsx` does NOT trigger `flint:ide-file-selected`. It would only do so if a corresponding `.flint/ide-active-file.json` file containing the path `ChannelAudit.tsx` was also written and stat'd by the watcher. The test never writes that JSON file.

**Practical conclusion:** The `ideFileSelectedReceived` variable will still be `false` after the fix, not because the server never emits the channel, but because the test does not correctly exercise the IDE sync path. The fix is real but the test does not probe it correctly.

**Recommended change:**
1. Flip the assertion to `toBe(true)`.
2. Rewrite the test body to write `.flint/ide-active-file.json` with the canary path, wait 2s for the stat-poll to fire, then assert `ideFileSelectedReceived === true`.
3. The existing `flint:file-changed` assertion in Gap F can be repurposed separately to verify Fix 2.

---

## Unit Test Quality Assessment (9 tests in `server/__tests__/ide-file-sync.test.ts`)

### Approach
The tests use a pure re-implementation of the tick logic (`ideSyncTick`) rather than injecting into the running server. This is a valid isolation strategy but has one tradeoff: it does not detect divergence between the test's `ideSyncTick` and the actual server implementation if they drift over time.

### Per-Test Assessment

| Test | Verdict | Notes |
|------|---------|-------|
| IDE-01 — file not found | PASS | Correct. Verifies `statFn` called with expected path. |
| IDE-02 — first tick broadcasts | PASS | Test name says "does not broadcast" but the assertion checks it DOES broadcast. The comment corrects this. Name is misleading but logic is sound. |
| IDE-03 — mtime advance broadcasts | PASS | Core happy path. Correct. |
| IDE-04 — same mtime skips | PASS | Verifies `readFileFn` is not called. Correct. |
| IDE-05 — path escapes project root | PASS | Verifies `lastMtime` IS updated (to prevent re-reading bad payload) but `lastPath` stays empty. This is a correct behavioral assertion. |
| IDE-06 — disallowed extension | PASS | `.py` used as canary. Correct. Does not test `.css`, `.md`, `.json` but `.py` is sufficient to verify the regex. |
| IDE-07 — same path dedup | PASS | Verifies mtime advancing with same path does not re-broadcast. Correct. |
| IDE-08 — JSON missing `path` field | PASS | Correct. Tests `{ file: ... }` typo scenario. |
| IDE-09 — `.ts` and `.jsx` extensions accepted | PASS | Two-file loop, fresh state per file. Correct. |

### Coverage Gaps in Unit Tests

1. **Non-absolute path in JSON** — the guard `path.isAbsolute(filePath)` is not tested. A relative path like `src/App.tsx` should be rejected silently.
2. **Malformed JSON** — `JSON.parse` will throw if `ide-active-file.json` contains invalid JSON. The server catches all exceptions in the outer `try/catch`, but this scenario is not covered. The `readFileFn` should be mocked to throw `SyntaxError` and the test should verify `broadcastFn` is not called.
3. **`activeProjectRoot` is empty string** — startup edge case. `ideJsonPath` becomes `/.flint/ide-active-file.json`. Not tested.
4. **`startIDEFileSyncWatcher` restart behavior** — the function clears the interval and resets state on re-call. Not tested (would require integration-level test).
5. **No test for the `globalThis` exposure** — `__flintIDEFileSyncStart` and `__flintIDEFileSyncStop` are exposed for external restart; no test verifies they work.

---

## Integration Scenarios Without Test Coverage

### Completely uncovered

1. **`startIDEFileSyncWatcher` restart after `project:openPath`** — when a new project is opened, the watcher must restart with the new `activeProjectRoot`. There is no test that opens a project mid-session and verifies the watcher follows.

2. **Multiple WebSocket clients receiving the broadcast** — `broadcast()` iterates all `wss.clients`. No test verifies that two simultaneously connected clients both receive `flint:ide-file-selected`.

3. **`startWebFileWatcher` add-event payload shape inconsistency** — `{ type: 'add', path: filePath }` vs `{ filePath, content }`. No test verifies what consumers actually receive for the `add` case.

4. **`useIDEFileSync` workspace boundary guard** — the hook reads `workspaceFiles.path` from `canvasStore` and calls `filePath.startsWith(ws.path)` before calling `setActiveFile`. No test covers the case where the IDE emits a valid-extension file from within the project root but the hook's workspace boundary check blocks it because `canvasStore` does not yet have a workspace loaded.

5. **Beacon round-trip under `onFileChanged`** — when `flint:file-changed` arrives and `canvasStore.setActiveFile` is called, `useContextSync` should write `context.json`. Gap B e2e test probes this but there is no unit test covering the `useContextSync` → `syncContext` IPC → server write chain.

6. **WS reconnect re-subscribes live listeners** — the `channelListeners` Map persists across WS reconnects in `web-api.ts`. When the WS drops and reconnects, previously registered `subscribe()` callbacks are still in the Map and will receive new messages. No test verifies this property holds after the new `onclose` handler fires and `ensureWS()` creates a fresh `WebSocket` instance.

7. **Extension filter in `scanWorkspaceFiles` vs `startIDEFileSyncWatcher`** — `scanWorkspaceFiles` filters `/\.(tsx?|jsx?|html?)$/.test(filePath)` (includes `.html`). The IDE sync watcher regex is `/\.(tsx?|jsx?)$/` (excludes `.html`). An `.html` file change would be tracked by the file watcher but rejected by the IDE sync watcher. This discrepancy is not tested.

---

## Coverage Grade

| Dimension | Before Fixes | After Fixes |
|-----------|-------------|-------------|
| Server IDE sync (unit) | 0% — feature absent | 9 tests, ~75% logic paths |
| Server file watcher new-file (unit) | 0% — feature absent | 0% — no dedicated unit tests |
| `applyBatch` mutations forwarding (unit) | 0% | 0% — no unit test added |
| WS reconnect backoff (unit) | 0% | 0% — no unit test added |
| `useIDEFileSync` cleanup (unit) | 0% | 0% — no unit test added |
| IDE sync e2e (Gap A) | Gap documented | Gap documented; test still expected to fail (wrong trigger) |
| Beacon round-trip e2e (Gap B) | Uncovered | Covered by new spec |
| Extension filter e2e (Gap C) | Uncovered | Covered by new spec |
| Rapid-fire ordering e2e (Gap D) | Uncovered | Covered by new spec |
| MCP bridge e2e (Gap E) | Uncovered | Covered by new spec (skips if not built) |
| Channel mismatch audit (Gap F) | Documented gap | Assertion must flip — fix landed but test not updated |

**Overall:** The unit test coverage for Fix 1 (IDE sync tick logic) is good in isolation. Fixes 2–5 received zero new unit tests. E2e gaps B–E are now documented with real tests. Gap F test assertion is stale and will produce a false-positive pass (expecting `false` when it should now be `true`) once the test is correctly rewritten to write the `.flint/ide-active-file.json` trigger file.

---

## Action Items (Priority Order)

1. **[P0] Fix Gap F test** — rewrite to write `.flint/ide-active-file.json` with a valid file path and assert `ideFileSelectedReceived === true`. The current test will produce a false-passing result because it asserts `toBe(false)` and the wrong trigger means the event still won't fire.

2. **[P0] Fix `add` event payload shape** — either change line 1994 to `broadcast('flint:file-changed', { filePath, content: '' })` so consumers using `data.filePath` work, or update `onFileChanged` type to handle both shapes. Current inconsistency silently breaks any consumer that handles new-file events.

3. **[P1] Add unit test for non-absolute path rejection** — `ideSyncTick` with `{ path: 'src/App.tsx' }` should not broadcast.

4. **[P1] Add unit test for malformed JSON** — `readFileFn` throws `SyntaxError` → no broadcast, no unhandled rejection.

5. **[P2] Add unit test for WS backoff constants** — verify delay sequence: attempt 0 = 2000ms, attempt 5 ≈ 15188ms, capped at 60000ms.

6. **[P2] Add e2e test for watcher restart** — open project A, verify sync works, open project B, verify sync switches to new root.
