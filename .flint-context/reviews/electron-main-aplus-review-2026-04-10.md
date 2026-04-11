# Electron Main Process A+ Code Review

**Date:** 2026-04-10
**Reviewer:** Quality Gate (claude-opus-4-6)
**TSC:** 0 errors (confirmed)
**Scope:** electron/main.ts, electron/preload.ts, electron/FileTransactionManager.ts, electron/GitManager.ts, electron/orchestrator.ts

---

## Summary Table

| File | Lines | Grade | Critical | Major | Minor |
|------|-------|-------|----------|-------|-------|
| electron/main.ts | 6148 | B+ | 2 | 5 | 6 |
| electron/preload.ts | 1520 | A- | 0 | 1 | 2 |
| electron/FileTransactionManager.ts | 164 | A | 0 | 0 | 1 |
| electron/GitManager.ts | 248 | A- | 0 | 1 | 2 |
| electron/orchestrator.ts | 1923 | A- | 0 | 1 | 3 |

**Overall:** B+ -- solid security posture, good Commandment compliance. Two critical items in main.ts need attention.

---

## Per-File Analysis

### 1. electron/main.ts (Grade: B+)

The backbone. 6148 lines, ~100 IPC handlers. Security validation is consistently applied (home-dir checks, type guards, absolute path enforcement). Most file writes route through FileTransactionManager correctly. Major surface area means more attack surface.

#### CRITICAL-1: Raw writeFile bypasses FileTransactionManager (Commandment 12)

Seven `await writeFile(...)` calls and seven `writeFileSync(...)` calls bypass the atomic write queue. While some are defensible (config flags, setup.json), several write to project data files:

| Line | File Written | Risk |
|------|-------------|------|
| 1114 | pending-tokens.json | **Project data** -- race with concurrent approval |
| 1137 | design-tokens.json | **Project data** -- race with concurrent token writes |
| 1152 | pending-tokens.json | Same as 1114 |
| 1930 | detected-environment.json | Low risk (write-once per detect) |
| 2136 | debt-snapshot.json | Low risk (write-once per baseline) |
| 3750 | health-history.json | **Project data** -- race with concurrent record-health |
| 5355 | design-tokens.json (demo copy) | Low risk (demo scaffolding) |

**Fix:** Route lines 1114, 1137, 1152, and 3750 through `fileTransactionManager.write()`. The tokens:approve-token and tokens:reject-token handlers modify .flint/design-tokens.json and .flint/pending-tokens.json without atomic queuing -- a rapid double-click on "Approve" could corrupt the file.

#### CRITICAL-2: HydroPaste handler uses `any` types pervasively (lines 2344-2756)

The `ipcChannel('hydro-paste')` handler contains approximately 30 `any` type annotations. This is the largest untyped block in the Electron main process. While it functions correctly, it defeats TypeScript's compile-time safety in a code path that processes untrusted Figma payloads.

```typescript
let manifest: any = { components: {} }  // line 2345
const resolvers: any[] = manifest.resolvers || []  // line 2373
function stylesToTailwind(styles: Record<string, any> | undefined): string  // line 2377
```

**Fix:** Define proper interfaces for the Figma payload shape, manifest structure, and resolver entries. This is a large refactor but critical for a handler that processes external data.

#### MAJOR-1: Arbitrary Tailwind values in HydroPaste output (Mithril safety)

Lines 2427-2465 generate classes like `bg-[${styles.fillColor}]`, `text-[${styles.textColor}]`, `border-[${styles.strokeColor}]`, `w-[${styles.width}px]`, etc. These arbitrary values will trigger Mithril violations in any downstream audit. The code is doing the right thing for Figma fidelity, but it means ingested components arrive pre-violated.

**Impact:** WARNING -- this is by design (ingestion produces raw output, governance catches it later), but the inline style generation should at minimum attempt token snapping via `snapToToken` before falling back to arbitrary values.

#### MAJOR-2: project:get-health-grade lacks home-dir validation (line 2162)

```typescript
ipcMain.handle('project:get-health-grade', async (_e, projectPath: unknown): Promise<...> => {
    if (typeof projectPath !== 'string') return null
    // MISSING: no path.isAbsolute() check, no home-dir containment check
    const snapshotPath = path.join(projectPath, '.flint', 'debt-snapshot.json')
```

A renderer-supplied `projectPath` is joined without home-dir validation. While this only reads (not writes), it enables reading arbitrary .flint/debt-snapshot.json files outside the user's home directory.

**Fix:** Add `if (!path.isAbsolute(projectPath) || !projectPath.startsWith(home + path.sep)) return null`

#### MAJOR-3: setup:write-mcp-config accepts arbitrary configPath (line 4347)

```typescript
ipcMain.handle('setup:write-mcp-config',
    (_event, ideName: string, configPath: string, mcpServerPath: string) => {
```

The `configPath` parameter is passed directly from the renderer and written to disk without any validation. A compromised renderer could write to any file the user has write access to.

**Fix:** Validate that `configPath` matches one of the known IDE settings paths returned by `setup:detect-ides`. The write should only target paths the handler itself computed.

#### MAJOR-4: auto-update:set-channel missing type guard (line 5398)

```typescript
ipcMain.handle('auto-update:set-channel', (_event, payload: unknown) => {
    const { channel } = payload as { channel: string }  // unsafe cast before validation
```

The destructure happens before the type check on the next line. If payload is null/undefined, this throws an unhandled error.

**Fix:** Add `if (typeof payload !== 'object' || payload === null) throw ...` before destructuring.

#### MAJOR-5: Scratchpad index.html contains hardcoded hex colors (lines 4577-4819)

The `SCRATCHPAD_INDEX_HTML` template string contains approximately 20 hardcoded hex color values (`#0f0f11`, `#18181b`, `#6d5cff`, etc.) both in CSS variables and inline styles. While this is a static HTML file and not a React component audited by Mithril, it sets a poor precedent and the inline style attributes duplicate the CSS variable values.

**Impact:** WARNING -- not a Commandment violation (HTML template, not JSX), but should use CSS variables exclusively and remove inline style duplication.

#### MINOR-1: Debug console.log left in GitManager walker (line 51 of GitManager.ts, called from main.ts git-show handler)

```typescript
console.log('found data-flint-id attr:', attr.value)
```

Fires for every data-flint-id attribute during AST walks. Noisy in production.

#### MINOR-2: globalThis pollution for file watcher communication (lines 3009-3010)

```typescript
;(globalThis as Record<string, unknown>)['__flintStartFileWatcher'] = startFileWatcher
;(globalThis as Record<string, unknown>)['__flintTrackedFiles'] = trackedFiles
```

Using globalThis as a communication bus between closures is fragile. A module-level variable or a shared context object would be cleaner.

#### MINOR-3: governance:get-audit-log limit parameter is not clamped (line 3804)

The `limit` is accepted as a raw number from the renderer without an upper bound. A malicious renderer could request `limit: 999999999` and cause excessive memory usage.

#### MINOR-4: beta:load-demo-project writes to os.tmpdir() outside home (line 5341)

```typescript
const tmpBase = path.join(os.tmpdir(), 'flint-beta-demo')
```

This intentionally writes outside the home directory. Defensible for temp files, but inconsistent with the home-dir containment policy applied everywhere else.

#### MINOR-5: Regex used in code:transform for import/export stripping (lines 551-593)

Multiple regex replacements on generated JS output in the code:transform handler. This is post-Babel output manipulation, not source code surgery, so it does not violate Commandment 13 (which applies to user source code). However, it could be fragile with edge cases (e.g., export keyword in a template literal).

#### MINOR-6: File extension check regex allows `.tsx?` meaning `.ts` or `.tsx` but also `.t` (line 506)

```typescript
/\.(tsx?|jsx?)$/
```

This matches `.t` and `.j` as valid extensions. While unlikely to cause real issues (who names files `.t`?), a stricter pattern would be `\.(tsx|ts|jsx|js)$`.

---

### 2. electron/preload.ts (Grade: A-)

Well-structured contextBridge surface. Every IPC channel has a typed wrapper. No raw ipcRenderer.send() calls leak through. Good use of unsubscribe patterns for push events.

#### MAJOR-1: importSummary.undoAllHeals accepts preHealCode parameter but main.ts ignores it

The preload signature:
```typescript
undoAllHeals: (preHealCode: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('import:undo-all-heals', preHealCode),
```

But the main.ts handler at line 4062 ignores the parameter entirely (reads from server-side `preHealCodeStore` instead). This is actually the *correct security behavior* (SECURITY-01 fix), but the preload signature is misleading. The parameter should be removed from the preload type to avoid confusion.

#### MINOR-1: `detectEnvironment` returns `Promise<unknown>` (line 494)

Should return a typed DetectedEnvironment interface for proper renderer-side type safety.

#### MINOR-2: Several push event subscriptions don't return unsubscribe functions

`onTokensUpdated`, `onFileChanged`, `onIDEFileSelected` use `ipcRenderer.on()` but only provide a separate `removeXxxListener()` method. The newer pattern (figma.onConnected, beta.onUpdateAvailable) returns an unsubscribe function directly. The older handlers should be migrated for consistency.

---

### 3. electron/FileTransactionManager.ts (Grade: A)

Excellent. Clean, focused, well-documented. The per-path FIFO queue with never-rejecting tail promises is a correct design. The eviction timing is intentionally tight (same microtask hop). Error propagation is correct -- callers get the rejection, but the queue continues.

#### MINOR-1: No maximum queue depth guard

Under pathological conditions (thousands of rapid writes to the same path), the promise chain grows without bound. In practice this is unlikely given the 1-second file watcher interval, but a depth counter with a warning log at, say, 100 queued writes would provide observability.

---

### 4. electron/GitManager.ts (Grade: A-)

Correct Commandment 11 compliance (no git checkout). All git operations use execFile with array args (no shell injection). Shadow commits are properly gated on no-op detection.

#### MAJOR-1: shadowCommit only stages .flint/ directory (line 155)

```typescript
await execFileAsync('git', ['add', '.flint/'], { cwd: gitRoot })
```

This means user source file changes (written by fileTransactionManager) are NOT included in shadow commits. The `ast:save-file` handler calls `shadowCommit` after saving, but the commit only includes .flint/ metadata files. If the user needs to recover a source file from a shadow commit, it won't be there.

**Impact:** The Git Time Machine (Rewind) feature may not work as expected for source file recovery. The original comment explains this was done to avoid Vite config watcher loops, but the fix should be more targeted (add only the specific saved file, not `git add .`).

#### MINOR-1: Debug console.log in findFlintIdOffsets (line 51)

```typescript
console.log('found data-flint-id attr:', attr.value)
```

Fires during every AST walk. Should be removed or gated behind a debug flag.

#### MINOR-2: No input validation on commitHash in getGitNode

While main.ts validates commitHash as hex-only before calling git-show, `getGitNode` itself does not validate. If called from another location, a crafted commitHash could pass arbitrary content to `git show`.

---

### 5. electron/orchestrator.ts (Grade: A-)

Strong Commandment 15/16 compliance. The tool catalog is well-defined and complete. The in-memory validation loop (validateToolInput) correctly checks every mutation before surfacing it. The complexity router is deterministic and well-tested. API key encryption via safeStorage is properly implemented.

#### MAJOR-1: writeConfig uses raw writeFile, not FileTransactionManager (line 595)

```typescript
await writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8')
```

The AI config file (`~/.flint/config.json`) is written with raw `writeFile`. While this is a config file (not source code), it contains the encrypted API key. A concurrent read during a partial write could corrupt the key. The comment in main.ts line 4312 acknowledges this pattern ("Commandment 12 exemption") for setup.json, but config.json is more sensitive.

**Impact:** WARNING -- low probability but high consequence (API key corruption requires re-entry).

#### MINOR-1: HTML_INTRINSICS set duplicated from flint-mcp (lines 1237-1246)

Comment says "Keep this copy in sync" but there's no mechanism to enforce that. A shared import from `shared/` would be better, or at minimum a test that verifies the sets are identical.

#### MINOR-2: activeRegistry is module-level mutable state (line 1232)

```typescript
let activeRegistry: Record<string, RegistryEntry> = {}
```

This is mutated at the start of each `sendChatMessage` call. If two concurrent chat turns are somehow in flight (unlikely but possible during fast UI interactions), they share the same mutable `activeRegistry`. Should be passed as a parameter to `validateToolInput` instead of relying on module-level state.

#### MINOR-3: Model roster outdated (line 455)

```typescript
export const ANTHROPIC_MODELS = [
    { id: 'claude-3-5-haiku-20241022', ... },
    { id: 'claude-3-5-sonnet-20241022', ... },
    { id: 'claude-3-7-sonnet-20250219', ... },
    { id: 'claude-opus-4-5', ... },
]
```

The model roster says "updated March 2025" but does not include Claude 4 Sonnet or Claude 4 Opus. The TIER_TO_MODEL mapping (line 136) references models that may not be the most current. This is cosmetic but affects the complexity router's model selection.

---

## Commandment Compliance Summary

| # | Commandment | Status | Notes |
|---|------------|--------|-------|
| C4 | Local-First | PASS | No external URLs in preview. GitHub feedback upload is best-effort behind an env flag. |
| C7 | ID Preservation | PASS | d2c:apply runs injectFlintIdPlugin on all generated files. |
| C9 | CIEDE2000 | PASS | Mithril pre-commit check uses checkClassNameForColorDrift. |
| C11 | Surgical Git | PASS | No git checkout anywhere. Read-only git show. |
| C12 | Atomic Queuing | **FAIL** | 7 raw writeFile + 7 writeFileSync calls bypass FTM. Most are defensible (config/setup), but tokens:approve-token and health-history are not. |
| C13 | No Regex Surgery | PASS | All source code mutations use Babel. The regex in code:transform operates on post-Babel output only. |
| C14 | Bypass Prohibition | **WARN** | Same files as C12. The annotations handler was fixed (Fix 6 P3-3) but the token approval handlers were not. |
| C15 | AST Catalog | PASS | 18-tool catalog defined. No raw code generation path. Non-Anthropic providers hard-gated. |
| C16 | TSC Loop | PASS | validateToolInput runs on every mutation tool call via ILspClient. |

---

## Prioritized Punch List

### Must Fix (before next release)

1. **[CRITICAL-1]** Route `tokens:approve-token`, `tokens:reject-token`, and `governance:record-health` writes through FileTransactionManager. Lines 1114, 1137, 1152, 3750.
2. **[MAJOR-2]** Add home-dir validation to `project:get-health-grade` handler. Line 2162.
3. **[MAJOR-3]** Validate `configPath` in `setup:write-mcp-config` against known IDE paths. Line 4347.
4. **[MAJOR-4]** Add null guard before destructuring in `auto-update:set-channel`. Line 5398.

### Should Fix (next sprint)

5. **[CRITICAL-2]** Type the HydroPaste handler -- replace `any` with proper interfaces.
6. **[MAJOR-1 preload]** Remove the unused `preHealCode` parameter from `importSummary.undoAllHeals`.
7. **[MAJOR-1 GitManager]** Shadow commits should include the specific source file that was saved, not just .flint/.
8. **[MINOR-1]** Remove debug console.log from GitManager.findFlintIdOffsets line 51.
9. **[MINOR-2]** Replace globalThis file watcher communication with module-level variables.
10. **[MINOR-3]** Clamp governance:get-audit-log limit to max 500.

### Nice to Have

11. **[MINOR-1 FTM]** Add queue depth observability (warn at 100 queued writes).
12. **[MINOR-1 orchestrator]** Share HTML_INTRINSICS from a single source instead of duplicating.
13. **[MINOR-2 orchestrator]** Pass activeRegistry as a parameter instead of module-level state.
14. **[MINOR-6]** Tighten file extension regex from `tsx?` to `tsx|ts|jsx|js`.
