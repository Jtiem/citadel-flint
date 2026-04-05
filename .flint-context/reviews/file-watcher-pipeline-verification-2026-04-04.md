# File Watcher Pipeline Verification

**Date:** 2026-04-04
**Scope:** Critical path from "file saved to disk" to "Glass shows updated preview"
**Verdict:** B+

---

## Check 1: IPC Channel Symmetry — PASS

The channel name is consistent across all three locations:

| Location | Channel Name | Match |
|----------|-------------|-------|
| `electron/main.ts:2801` | `ipcChannel('file-changed')` -> `flint:file-changed` | YES |
| `electron/preload.ts:263` | `ipcChannel('file-changed')` -> `flint:file-changed` | YES |
| `src/types/flint-api.d.ts:1920` | Comment: `IPC channel: flint:file-changed` | YES |

All three use the shared `ipcChannel()` helper from `shared/brand.ts` (line 56), which concatenates `BRAND.ipcPrefix` (`"flint:"`) with the name. No hardcoded strings, no typo risk.

**Type shape** in preload (`{ filePath: string; content: string }`) matches the type declaration in `flint-api.d.ts:1929` and the destructure in `App.tsx:401`. Consistent across all three.

---

## Check 2: Data Shape Contract — PASS

| Location | Shape |
|----------|-------|
| `electron/main.ts:2801` | `{ filePath, content }` — both are `string` (filePath from the tracked map, content from `readFile(filePath, 'utf-8')`) |
| `src/App.tsx:401` | `(data: { filePath: string; content: string })` — destructures `data.filePath` and feeds `data.content` to `syncCode` |

Exact match. No widening, no missing fields.

---

## Check 3: File Watcher Activation — PASS (with one minor note)

Every `activeProjectRoot = ...` assignment is followed by a `startFileWatcher()` call:

| Path | Assignment Line | Watcher Call | Match |
|------|----------------|-------------|-------|
| `dialog:openFolder` | `main.ts:471` | `main.ts:481` `void (globalThis...)['__flintStartFileWatcher']?.()` | YES |
| `project:createScratchpad` | `main.ts:1602` | `main.ts:1611` `void (globalThis...)['__flintStartFileWatcher']?.()` | YES |
| `project:openPath` | `main.ts:1681` | `main.ts:1691` `void (globalThis...)['__flintStartFileWatcher']?.()` | YES |
| auto-scratchpad (first launch) | `main.ts:4656` | `main.ts:4661` `void (globalThis...)['__flintStartFileWatcher']?.()` | YES |
| Initial launch | N/A | `main.ts:2817` `void startFileWatcher()` | YES |

All five paths covered. The globalThis indirection (`__flintStartFileWatcher`) is used because the watcher block is defined inside a lexical scope after app:ready, while the IPC handlers are defined earlier. The optional chaining (`?.()`) means the call is a safe no-op if the watcher block hasn't initialized yet — this is correct since IPC handlers can fire before app:ready completes.

---

## Check 4: New File Tracking — PASS

`electron/main.ts:1231-1240`: After `ast:save-file` writes via `FileTransactionManager`, it reads the `__flintTrackedFiles` map from globalThis and adds the file with its current mtime if not already tracked:

```typescript
const tracked = (globalThis as Record<string, unknown>)['__flintTrackedFiles'] as Map<string, number> | undefined
if (tracked && !tracked.has(filePath)) {
    try {
        const { mtimeMs } = await fsStat(filePath)
        tracked.set(filePath, mtimeMs)
    } catch { /* ignore */ }
}
```

This ensures newly created files are picked up by subsequent poll cycles. The mtime is set to the current value, so the watcher will NOT immediately re-fire for the just-saved content (the mtime would need to increase again). Correct behavior.

---

## Check 5: Cleanup — PASS

`electron/main.ts:2819-2821`:

```typescript
app.on('will-quit', () => {
    if (fileWatchInterval) clearInterval(fileWatchInterval)
})
```

The interval is properly cleared on app quit. The `trackedFiles` map will be garbage collected with the process.

---

## Check 6: syncCode to Preview — PASS

The chain is:

1. `App.tsx:404` calls `useEditorStore.getState().syncCode(data.content)`
2. `editorStore.ts:363-378`: `syncCode` parses the code, then calls `set({ rawCode: code, ast: parsed, visualTree: ... })`
3. `LivePreview.tsx:350`: `const rawCode = useEditorStore((state) => state.rawCode)` — subscribes to the exact store field that `syncCode` updates
4. `LivePreview.tsx:403`: `const previewCode = (showGoverned && governedCode) ? governedCode : rawCode` — feeds into the transform pipeline

The Zustand subscription is direct — when `rawCode` changes, LivePreview re-renders and rebuilds the iframe `srcdoc`. Chain is complete.

---

## Check 7: A11y Audit in syncCode — PASS

`editorStore.ts:376-377`:

```typescript
const a11yViolations = A11yLinter.audit(parsed as import('@babel/types').File)
useCanvasStore.getState().setA11yViolations(a11yViolations)
```

A11y violations are recomputed on every external file change. The Babel AST cast is safe for React/TSX files (the dominant use case). Mithril violations are handled separately by the `MithrilProvider` React component, which subscribes to `rawCode` changes at the component level and re-runs its scan — so Mithril is also covered, just through a different mechanism.

---

## Check 8: Web Build Parity — FAIL (WARNING)

Neither `server/index.ts` nor `src/adapters/web-api.ts` contain any reference to `file-changed`, `fileChanged`, or `onFileChanged`.

**Impact:** The web build (`npm run dev:web`) has no file watcher pipeline. When an AI agent or external editor modifies a file on disk, Glass-in-the-browser will NOT update its preview automatically. Users must manually reload or re-open the file.

**Severity:** WARNING, not BLOCKING. The web build is a secondary target and the Electron build (primary) works correctly. However, this is a parity drift that should be tracked.

**Fix:** Add a `chokidar` or `fs.watch` watcher in `server/index.ts` that broadcasts `file-changed` events over WebSocket, and add an `onFileChanged` handler in `src/adapters/web-api.ts` that subscribes to those WS messages.

---

## Check 9: Race Condition (Partial Write) — PASS

Two write paths exist:

1. **Glass saves via `ast:save-file`** (main.ts:1221): Uses `fileTransactionManager.write(filePath, content)` which does atomic `.tmp` -> `rename`. The file is always complete when the mtime changes.

2. **MCP `flint_ast_mutate` writes** (server.ts:2107-2110): Also uses atomic tmp+rename:
   ```typescript
   const tmpPath = targetPath + `${BRAND.configDir}-tmp-` + crypto.randomUUID().slice(0, 8)
   fs.writeFileSync(tmpPath, newCode, "utf-8")
   fs.renameSync(tmpPath, targetPath)
   ```

Both paths are atomic. The file watcher's `readFile` call will always see a complete file because `rename` is an atomic filesystem operation. No partial-read risk.

**Minor note:** The MCP write uses synchronous `writeFileSync` + `renameSync` while the Electron path uses the async `FileTransactionManager`. Both are correct but the MCP path blocks the event loop during write. For typical component files (< 100KB) this is negligible.

---

## Check 10: Self-Triggered Loop — PASS

The loop concern: Glass saves -> watcher detects -> syncCode -> auto-save -> repeat.

**Analysis:**

- `setCode` (editorStore.ts:247) calls `useCanvasStore.getState().triggerAutoSave(code, 1000)` — this DOES trigger auto-save.
- `syncCode` (editorStore.ts:363-377) does NOT call `triggerAutoSave`. The comment on line 374 explicitly states: "No auto-save: external changes are already on disk."

So the chain is: File saved -> watcher fires -> `syncCode` called -> store updates (`rawCode`, `ast`, `visualTree`) -> LivePreview re-renders. No auto-save triggered. No loop.

Additionally, the `applyBatch` method (editorStore.ts:357) DOES trigger auto-save, but it is not called by the file watcher path. Only direct user edits and programmatic mutations use `applyBatch`.

The only remaining concern: after `syncCode` updates `rawCode`, the `MithrilProvider` component will re-scan and update `mithrilViolations` in the canvas store, but that does NOT trigger a file write. Safe.

---

## Summary

| Check | Result | Details |
|-------|--------|---------|
| 1. IPC Channel Symmetry | PASS | Consistent via shared `ipcChannel()` helper |
| 2. Data Shape Contract | PASS | `{ filePath: string; content: string }` across all legs |
| 3. File Watcher Activation | PASS | All 5 project-open paths start the watcher |
| 4. New File Tracking | PASS | `ast:save-file` registers new files in tracked map |
| 5. Cleanup | PASS | Interval cleared on `will-quit` |
| 6. syncCode to Preview | PASS | Direct Zustand subscription from LivePreview to rawCode |
| 7. A11y Audit in syncCode | PASS | A11yLinter.audit runs; Mithril via MithrilProvider |
| 8. Web Build Parity | WARNING | No file watcher in web build — parity gap |
| 9. Race Condition | PASS | Both write paths use atomic tmp+rename |
| 10. Self-Triggered Loop | PASS | syncCode explicitly skips auto-save |

---

## Issues Found

1. **[WARNING]** Web build (`server/index.ts` + `src/adapters/web-api.ts`) has no file watcher pipeline. External file changes will not propagate to Glass-in-the-browser. This is a known parity gap that should be addressed when the web build reaches feature parity.

2. **[INFO]** The 100-file hard cap in `scanWorkspaceFiles` (main.ts:2752) means large projects with more than 100 source files will have some files unwatched. Files are collected in directory-walk order (not by importance), so deeply nested files may be missed while shallow utility files are tracked. This is a reasonable tradeoff for a polling-based watcher but worth documenting.

3. **[INFO]** The poll interval is 1000ms (main.ts:2792). For rapid AI edits (multiple files in quick succession), there could be a 1-second delay before Glass updates. This is acceptable for the current UX but could feel sluggish during multi-file batch operations.

---

## Grade: B+

The Electron pipeline is structurally sound. IPC symmetry is perfect, the data contract is consistent, all project-open paths activate the watcher, new files are tracked, cleanup is proper, the store-to-preview subscription is direct, and the self-triggered loop is correctly prevented. The atomic write pattern on both the Electron and MCP sides eliminates partial-read races.

The grade is B+ rather than A because:
- The web build parity gap is a real functional hole for `npm run dev:web` users
- The 100-file cap is pragmatic but undocumented, and could surprise users on larger projects

Neither issue is blocking for the Electron build, which is the primary target.
