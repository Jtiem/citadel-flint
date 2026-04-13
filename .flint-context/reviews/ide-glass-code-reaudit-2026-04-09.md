# IDE Glass Integration — Post-Fix Code Re-Audit
**Date:** 2026-04-09
**Reviewer:** Code Review Agent (post-fix pass)
**Prior grade:** C+ architecture, D test quality
**Files reviewed:**
- `server/index.ts` (IDE file sync watcher, new-file watcher, MCP allowlist, d2c:apply, setup:write-mcp-config, ai:apply-batch, IPC dispatch)
- `src/adapters/web-api.ts` (applyBatch, WS reconnect)
- `src/hooks/useIDEFileSync.ts` (cleanup fix)
- `server/__tests__/ide-file-sync.test.ts` (new unit tests)
- `electron/mcp-policy.ts` (allowlist source of truth)

---

## 1. startIDEFileSyncWatcher — stat-poll logic

### What was fixed
The watcher is a 1-second `setInterval` that stats `.flint/ide-active-file.json`, reads it on mtime advance, validates the path (absolute, within project root, `.tsx?/.jsx?` extension, not the same path as last broadcast), and emits `flint:ide-file-selected`. Stat errors are silently swallowed.

### Remaining defects

**DEFECT-1 (Severity: HIGH) — stale closure on activeProjectRoot**

The interval callback reads `activeProjectRoot` from the enclosing module scope, which is a `let` variable that mutates when `project:openPath`, `project:initialize`, or `project:create-scratchpad` is called. `startIDEFileSyncWatcher` is called in those handlers to restart the watcher, which resets `ideFileSyncLastMtime` and `ideFileSyncLastPath` — that part is correct.

The defect is the restart mechanism itself. The function is exposed via `globalThis.__flintIDEFileSyncStart` and called as:
```ts
;(globalThis as Record<string, unknown>).__flintIDEFileSyncStart?.()
```
This works only because `startIDEFileSyncWatcher` is a closure over the module-scoped `activeProjectRoot`. If `activeProjectRoot` changes between the moment `clearInterval` runs and the first tick of the new interval (effectively immediate), there is no race — this is fine. However the pattern is opaque and fragile: there is no type safety on `globalThis.__flintIDEFileSyncStart`, no guarantee the property is set before callers use it (it is set synchronously in the same block that calls `startIDEFileSyncWatcher()`, so in practice the watcher starts before any `project:openPath` can arrive — acceptable), and if `startIDEFileSyncWatcher` is ever called concurrently from two project-open handlers running in parallel (e.g., a race between `project:openPath` and `project:initialize` for the same request), `clearInterval` will clear whichever interval is current, and two new intervals can be created if the second call arrives before the first's `clearInterval` runs. This is a TOCTOU window, not a fatal bug in serial use, but worth noting.

**DEFECT-2 (Severity: MEDIUM) — mtime update occurs before path validation succeeds**

When mtime advances, the code does:
1. Set `ideFileSyncLastMtime = mtimeMs`
2. Read and parse the file
3. Validate the path
4. Only if valid: set `ideFileSyncLastPath` and broadcast

Step 1 runs before step 3. This means if the IDE writes a file with a path that fails extension validation (e.g., `.py`), the mtime is still updated. On the next genuine focus change (same file but `.tsx`), the mtime may not have advanced again — so the tick exits early at the mtime check and the `.tsx` file is never broadcast.

This is a correctness bug when the IDE momentarily writes an invalid path and then immediately re-writes a valid one at the same mtime (no-op on re-write). In practice the IDE typically writes a new mtime each time, so the window is narrow — but it is still a logic error: mtime should only be updated after at least confirming the file was readable and parseable, ideally only after a successful broadcast. The current test suite (IDE-05, IDE-06) explicitly asserts that mtime IS updated on invalid paths (line 165 of the test file), which means the tests are asserting the buggy behavior as intended — masking the defect.

**DEFECT-3 (Severity: LOW) — no symlink resolution on the broadcast path**

The broadcast path comes directly from `parsed.path` (the raw JSON string). If the IDE writes a symlink path, the `startsWith(activeProjectRoot + path.sep)` check may pass (if the symlink is within the project), but the resolved real path may point outside the project. `validateFilePath` uses `realpathSync`, but `startIDEFileSyncWatcher` does not call it. This is a minor inconsistency — exploitability requires a malicious IDE extension that can write symlinks.

**DEFECT-4 (Severity: LOW) — server startup before project is open: activeProjectRoot is the CLI-supplied root**

`startIDEFileSyncWatcher` is called immediately at server startup with `activeProjectRoot = resolvedRoot` (the CLI argument). If the CLI is invoked with a root that was later abandoned (user opens a different project via the UI), there is a brief window where the watcher polls the CLI root. `startIDEFileSyncWatcher` is called again in `project:openPath`, so this resolves quickly. The state reset (`ideFileSyncLastMtime = 0`, `ideFileSyncLastPath = ''`) means any file from the CLI root that was broadcast before the UI project opens will simply be re-broadcast from the new root if the user happens to focus the same relative path — not a crash, but potentially surprising.

---

## 2. New-file watcher (startWebFileWatcher) — rescan logic

### What was fixed
A `scanWorkspaceFiles` call was added inside the interval tick to detect new files. New files are added to `trackedFiles` and a `flint:file-changed` event with `type: 'add'` is broadcast.

### Remaining defects

**DEFECT-5 (Severity: HIGH) — initial scan and first tick race condition is real**

`startWebFileWatcher` scans files and populates `trackedFiles` *before* the interval starts. If a file is created *after* the initial scan completes but *before* the first tick runs (within ~1 second), it will be picked up correctly in the new-file detection block in the first tick. This is fine.

However: `trackedFiles` is populated in the `startWebFileWatcher` async function, and the `setInterval` callback is registered synchronously at the end of that function. The `await scanWorkspaceFiles` call is the last awaited operation. If another async operation (e.g., `project:openPath` calling `startWebFileWatcher()` again while the previous scan is still in flight) calls `clearInterval(fileWatchInterval)` and sets `trackedFiles.clear()` on a partially-populated `trackedFiles`, you can lose file tracking. The `void` call site (`void startWebFileWatcher()`) means the caller does not await the scan. Two rapid project-open calls will cause the second invocation to clear `trackedFiles` while the first scan's `for` loop is still appending to it — a classic async mutation race.

**DEFECT-6 (Severity: MEDIUM) — "previously known" set is not snapshotted per tick**

The rescan compares `currentFiles` against `trackedFiles`. `trackedFiles` is mutated inside the same tick (step 1 of the interval body updates mtimes). This means the new-file detection in step 2 is correct — newly tracked files added in step 1 will appear in `trackedFiles` before the step-2 scan runs. But because step 2's scan is itself async (`await scanWorkspaceFiles`), the mtime-update loop (step 1) is *already complete* before step 2's scan returns. There is no snapshot inconsistency within a tick because the tick body is a single `async IIFE`. The concern is moot. This is fine as-is.

**DEFECT-7 (Severity: LOW) — broadcast shape mismatch for new-file events**

For file modifications, the broadcast is `{ filePath, content }`. For new files, the broadcast is `{ type: 'add', path: filePath }` — note the key name is `path`, not `filePath`. Consumers listening to `flint:file-changed` expecting `filePath` will receive `undefined` on new-file events. There are no tests for this shape, and no documentation of the expected shape. This is a silent API inconsistency.

---

## 3. RENDERER_ALLOWED_MCP_TOOLS — allowlist correctness

### Assessment
The `server/index.ts` Set contains exactly the same 7 tools as `electron/mcp-policy.ts` array. The canonical list is:
- `flint_status`, `flint_audit`, `flint_debt_report`, `flint_query_registry`, `flint_generate_dbom`, `flint_accessibility_report`, `flint_audit_report`

The lists are in sync. The enforcement in `server/index.ts` uses `Set.has()` (O(1)), while `electron/mcp-policy.ts` uses `Array.includes()` (O(n), acceptable for 7 items). Both are correct.

**DEFECT-8 (Severity: MEDIUM) — two sources of truth with no shared source**

The allowlist is defined in two places: `electron/mcp-policy.ts` and as a local `Set` in `server/index.ts`. There is no import relationship between them. A future developer adding a tool to one list will likely miss the other. The comment "Mirrors RENDERER_ALLOWED_MCP_TOOLS from electron/mcp-policy.ts" documents the intent but provides no enforcement. When the two drift, both server environments silently diverge in their security posture. The fix is to move the allowlist to a `shared/` module that both files import — this is the existing pattern used by `shared/brand.ts` and `shared/contract-schema.ts`.

**DEFECT-9 (Severity: LOW) — no test verifying web server allowlist matches Electron**

`electron/__tests__/mcp-policy.test.ts` tests the Electron allowlist in isolation. There is no test (nor CI check) that asserts both lists are identical. This is the enforcement gap that makes DEFECT-8 dangerous in practice.

---

## 4. applyBatch fix — argument shape

**DEFECT-10 (Severity: CRITICAL) — ai:apply-batch is a stub that ignores its argument**

`web-api.ts` now correctly calls `invoke('ai:apply-batch', mutations)`, passing the mutations array as the first argument. However, the handler in `server/index.ts` at line 2258 is:

```ts
handlers.set('ai:apply-batch', async () => ({ ok: true }))
```

The handler ignores all arguments and always returns `{ ok: true }`. This means in web mode, every `applyBatch` call silently succeeds without applying any mutations. The fix corrected the *caller* but left the *handler* as a no-op stub. The prior audit's D-grade concern about this path being broken is still valid — it is now a silent success rather than a silent failure, which is worse for detectability.

The fix passes mutations correctly from the adapter to the IPC layer, but since the handler discards them, no mutations are ever applied in the web build. This is a functional regression relative to the Electron build.

---

## 5. useIDEFileSync cleanup — type annotation

### What was fixed
The cleanup function now checks `if (typeof unsub === 'function')` before calling it, accommodating Electron's `void` return.

### Assessment
This is correct. `window.flintAPI.onIDEFileSelected` in `web-api.ts` returns `() => void` (from `subscribe()`). In Electron's `preload.ts`, `onIDEFileSelected` calls `ipcRenderer.on` and returns `void`. The `typeof unsub === 'function'` guard correctly handles both cases.

**DEFECT-11 (Severity: LOW) — type annotation on onIDEFileSelected is too permissive**

In `web-api.ts` the signature is typed as `onIDEFileSelected: (cb: ...) => void`. The actual runtime return is `() => void` (an unsubscribe function). The declared return type is `void`. TypeScript therefore cannot infer `unsub` as a function, and the `typeof unsub === 'function'` check is technically operating on an `any`-coerced value — except that the hook file casts it correctly. The real risk is that callers who use the TypeScript type would never know to check for the unsubscribe return. The Electron preload should document (or type) this divergence more explicitly.

This is a documentation/typing issue, not a runtime bug.

---

## 6. The 9 new unit tests — quality assessment

### Structure
The test file re-implements the tick logic as a standalone `ideSyncTick` function rather than importing from `server/index.ts`. This is a "shadow implementation" testing pattern.

### Critical defect in the test suite

**DEFECT-12 (Severity: HIGH) — tests exercise a shadow copy, not the real code**

The `ideSyncTick` function in the test file is a manual re-implementation of the interval callback. It is NOT imported from `server/index.ts`. This means:
- The tests will pass even if `server/index.ts` has a completely different (broken) implementation.
- A refactor of the real watcher (e.g., changing `startsWith(activeProjectRoot + path.sep)` to `startsWith(activeProjectRoot)`, or removing the extension check) will not cause any test to fail.
- Conversely, a bug introduced into the shadow copy that doesn't exist in the real code will produce a false-positive failure.

This is the most significant structural problem with the test suite. Shadow implementation tests provide confidence in the *logic specification* of the feature but give zero regression protection against the actual production code path.

**DEFECT-13 (Severity: MEDIUM) — IDE-02 test name does not match its assertion**

The test name at line 112 says "initialises lastMtime on first stat but does not broadcast (mtime > 0, lastMtime=0)". The comment in the body says "should broadcast". The assertion at line 121 `expect(broadcastFn).toHaveBeenCalledOnce()` confirms the test *does* expect a broadcast. The test name is wrong — it says "does not broadcast" but asserts the opposite. This is a misleading test that the next developer will misread.

**DEFECT-14 (Severity: MEDIUM) — tests validate buggy mtime-before-validation behavior (see DEFECT-2)**

IDE-05 at line 165 asserts `expect(state.lastMtime).toBe(1000)` after a path-escapes-project-root scenario. This is asserting that mtime IS updated even when the path is invalid. That matches the current implementation but enshrines the wrong behavior — the next developer who fixes DEFECT-2 (mtime should not update if path is invalid) will have to simultaneously fix the tests to avoid a false test failure.

**DEFECT-15 (Severity: LOW) — missing project-change scenario test**

The tests do not cover: watcher state after `startIDEFileSyncWatcher()` is called a second time (project change mid-session). There is no test verifying that `lastMtime` and `lastPath` are reset to 0 and '' when the watcher restarts. This was called out in the audit brief as a required scenario.

**DEFECT-16 (Severity: LOW) — no test for concurrent/rapid calls to startIDEFileSyncWatcher**

The concurrent-call race described in DEFECT-1 has no test coverage.

**DEFECT-17 (Severity: LOW) — IDE-09 not listed in the header coverage comment**

The file header documents 8 scenarios (IDE-01 through IDE-08) but the test file actually contains 9 tests — IDE-09 covers `.ts` and `.jsx` extensions. The coverage comment is stale on the first commit.

---

## 7. Revised grades

### Architecture: B-
**Up from C+.** The stat-poll pattern is sound and matches the Electron implementation. Project-change restart via `globalThis` function references works but is structurally opaque — a function reference on `globalThis` is not a typed interface, not observable in tests, and not documented in the architecture section of CLAUDE.md. The two-source-of-truth allowlist problem (DEFECT-8) is an architectural debt that will cause drift. The `ai:apply-batch` stub (DEFECT-10) is an architectural gap where the web build silently diverges from Electron semantics.

**What keeps it from A:** DEFECT-10 (mutations not applied in web mode), DEFECT-8 (allowlist duplication), and the opaque globalThis wiring for watcher restart.

### Test Quality: C
**Up from D, but not significantly.** Adding 9 tests is better than 0. However, all 9 test a shadow copy of the logic rather than the real code path (DEFECT-12). The misleading IDE-02 test name (DEFECT-13) reduces trust in the suite. The missing project-change scenario (DEFECT-15) was explicitly listed in the audit brief. The tests validate the buggy mtime behavior rather than the correct behavior (DEFECT-14). The suite would not catch a regression in `server/index.ts` itself.

**What keeps it from B:** The shadow-implementation pattern is a fundamental structural problem, not a minor gap.

### Reliability: B
**Up from prior implied C.** The WS reconnect with exponential backoff (60s cap, 50-attempt max) is correct and well-structured. The `validateFilePath` realpathSync addition closes a symlink escape vector. The `d2c:apply` project-root boundary fix is correct for theme files. The IDE file sync watcher handles stat errors gracefully. The `onIDEFileSelected` cleanup fix correctly handles the Electron/web return-type divergence.

**What keeps it from A:** DEFECT-10 (silent mutation no-op in web mode is a reliability failure), DEFECT-1 (concurrent watcher restart race), DEFECT-5 (async trackedFiles race in startWebFileWatcher), DEFECT-7 (new-file event shape mismatch).

---

## Summary of defects by severity

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| DEFECT-10 | CRITICAL | `server/index.ts` | `ai:apply-batch` handler is a stub — mutations are never applied in web mode |
| DEFECT-1 | HIGH | `server/index.ts` | Concurrent project-open calls can create duplicate intervals; globalThis wiring is untyped |
| DEFECT-5 | HIGH | `server/index.ts` | `startWebFileWatcher` async race if called twice rapidly before first scan completes |
| DEFECT-12 | HIGH | `server/__tests__/ide-file-sync.test.ts` | Tests exercise shadow copy, not real code — provide zero regression protection |
| DEFECT-2 | MEDIUM | `server/index.ts` | mtime updated before path validation — invalid paths suppress future valid broadcasts at same mtime |
| DEFECT-7 | MEDIUM | `server/index.ts` | New-file broadcast uses `path` key, modification broadcast uses `filePath` — API inconsistency |
| DEFECT-8 | MEDIUM | `server/index.ts` vs `electron/mcp-policy.ts` | Allowlist duplicated with no shared import — will drift |
| DEFECT-13 | MEDIUM | test file | IDE-02 test name says "does not broadcast" but asserts the opposite |
| DEFECT-14 | MEDIUM | test file | Tests assert buggy mtime-on-invalid-path behavior rather than correct behavior |
| DEFECT-3 | LOW | `server/index.ts` | IDE sync broadcasts symlink paths without realpathSync resolution |
| DEFECT-4 | LOW | `server/index.ts` | Brief window at startup where watcher polls CLI root before UI project open |
| DEFECT-9 | LOW | Missing test | No CI check that web and Electron allowlists are identical |
| DEFECT-11 | LOW | `web-api.ts` | `onIDEFileSelected` typed as returning `void` but actually returns `() => void` in web mode |
| DEFECT-15 | LOW | test file | No test for watcher state reset on project change |
| DEFECT-16 | LOW | test file | No test for concurrent watcher restart |
| DEFECT-17 | LOW | test file | IDE-09 not listed in header coverage comment |

---

## Required actions before A+ grade

1. **Fix DEFECT-10 immediately.** The `ai:apply-batch` handler must actually apply mutations. This is a functional correctness failure, not a code quality concern.

2. **Fix DEFECT-12.** Refactor the tests to import and exercise the real `server/index.ts` watcher tick, or at minimum export the tick callback from the module so tests can import it. The shadow-implementation approach must be discarded.

3. **Fix DEFECT-8.** Move the allowlist to `shared/mcp-policy.ts` (or similar) and import it from both `electron/mcp-policy.ts` and `server/index.ts`. Add a test that both imports resolve to the same set.

4. **Fix DEFECT-2.** Move `ideFileSyncLastMtime = mtimeMs` to *after* the path validation block (ideally only on successful broadcast) to prevent valid future events being silenced.

5. **Fix DEFECT-7.** Normalize the broadcast payload to `{ filePath, content?, type? }` for all `flint:file-changed` events, or document the shape difference explicitly and update consumers.

6. **Add the missing project-change test (DEFECT-15).** The test brief explicitly required it.
