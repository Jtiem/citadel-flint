# Flint VS Code Extension -- A+ Code Review

**Date:** 2026-04-11
**Scope:** `flint-vscode/` -- all source, tests, config, webview panels
**Reviewer:** Quality Gate (Opus)
**TSC:** 0 errors
**Tests:** 87/87 passing (5 suites)

---

## Executive Summary

The extension is well-structured, properly modular, and covers the fundamentals of a VS Code diagnostic extension. Security posture is strong (CSP, nonce, no arbitrary code execution). Test coverage is good for pure logic but has gaps in integration paths. Several issues need attention before this extension is marketplace-ready.

**Overall Grade: B+**

---

## Per-File Grades

| File | Grade | Summary |
|------|-------|---------|
| `extension.ts` | B | Solid activation + MCP registration; several issues noted below |
| `flintClient.ts` | B- | Functional JSON-RPC client; uses `process.execPath` incorrectly for spawn |
| `diagnosticsProvider.ts` | A- | Clean separation of pure functions; good testability |
| `codeActionProvider.ts` | B | Works but `applyFix` command signature drops the violation argument |
| `webview/governancePanel.ts` | B- | Functional but health grade logic duplicates the MCP debt report |
| `webview/activityPanel.ts` | A- | Simple, correct, well-tested |
| `webview/shared.ts` | A | Good theming, proper nonce generation |
| `package.json` | B | Missing `extensionDependencies`, redundant language contributions |
| Tests (5 suites) | A- | 87 tests, good coverage of pure functions; no integration tests for FlintClient |

---

## CRITICAL Findings

### C1. `process.execPath` used to spawn MCP server (flintClient.ts:123)

```typescript
const proc = spawn(process.execPath, [serverPath], {
```

Inside a VS Code extension host, `process.execPath` is the **Electron binary** (e.g., `/Applications/Visual Studio Code.app/.../Electron`), NOT a Node.js binary. The extension already has `resolveNodePath()` in `extension.ts` that correctly identifies the system Node.js, but `FlintClient.start()` ignores it and uses `process.execPath` directly.

This means the MCP server is being spawned with the Electron runtime, which may work coincidentally in some VS Code versions (Electron bundles Node) but:
- Will fail in Cursor/Windsurf where the Electron binary may not support `--inspect` or MCP-required Node APIs
- Is fragile across Electron version changes
- Contradicts the comment in `resolveNodePath()` that explicitly warns about this

**Fix:** `FlintClient.start()` should accept the resolved node path as a parameter, or call `resolveNodePath()` internally.

### C2. `applyFix` command ignores the violation argument (codeActionProvider.ts:111-113)

```typescript
vscode.commands.registerCommand(
    'flint.applyFix',
    async (uri: vscode.Uri) => {
        await this.applyFix(uri);
    },
),
```

The code action passes two arguments: `[document.uri, violation]` (line 76), but the command handler only accepts `uri`. The `violation` argument is silently dropped. This means single-fix and fix-all go through the exact same code path with no way to target a specific violation.

This is not strictly broken (flint_fix fixes all violations in a file anyway), but it means the user sees "Fix: Replace with design token `color/blue/500`" and the action replaces ALL tokens, not just the one they clicked. That is a UX integrity issue.

**Fix:** Either (a) pass the violation to `flint_fix` to scope the fix, or (b) rename the action to "Fix all Flint violations in this file" so the label matches the behavior.

---

## MAJOR Findings

### M1. No debounce on audit triggers (diagnosticsProvider.ts:166-179, extension.ts:506-544)

Audits fire on:
- `onDidSaveTextDocument` (line 167)
- `onDidOpenTextDocument` (line 176)
- `onDidChangeActiveTextEditor` in `extension.ts` (line 506)

The `onDidChangeActiveTextEditor` handler runs a full `flint_audit` MCP call on every editor switch. Combined with `onDidOpenTextDocument`, opening a new file triggers TWO concurrent audits (open + editor change). For a workspace with many tabs, rapid tab switching will flood the MCP server with parallel audit calls.

There is no debounce, no cancellation of in-flight requests, and no queue. The 30-second timeout in `FlintClient` is the only safety valve.

**Fix:** Add a debounce (300-500ms) on audit triggers. Cancel in-flight audit requests when a new one starts for the same file. Consider a `Map<string, AbortController>` keyed by file path.

### M2. Hardcoded hex colors in webview CSS (shared.ts:47-48, governancePanel.ts:206-215)

```css
.badge-green { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge-red { background: rgba(239,68,68,0.15); color: #ef4444; }
```

And in `governancePanel.ts` JavaScript:
```javascript
if (total <= 2) updateGrade('A', '#10b981');
else if (total <= 5) updateGrade('B', '#10b981');
else if (total <= 10) updateGrade('C', '#f59e0b');
```

These hardcoded colors do not adapt to VS Code themes. In a high-contrast theme, `#10b981` on a light background may have poor contrast. VS Code webviews should use `--vscode-*` CSS variables wherever possible. For status colors where no exact variable exists, the extension should at minimum support the high-contrast theme override.

**Fix:** Use `--vscode-testing-iconPassed`, `--vscode-testing-iconFailed`, `--vscode-editorWarning-foreground` etc., or define CSS custom properties with high-contrast fallbacks.

### M3. Governance panel health grade is a naive violation count (governancePanel.ts:206-215)

```javascript
const total = violations.length;
if (total <= 2) updateGrade('A', '#10b981');
else if (total <= 5) updateGrade('B', '#10b981');
```

This grade is computed client-side from raw violation count and has **no relationship** to the actual `flint_debt_report` health score (which uses a weighted formula: 0-100, A-F). The panel also calls `flint_debt_report` on init and uses its grade, but the violation-count grade **overwrites** the debt report grade on every audit result.

This means the user sees an "A" grade when they have 2 violations, even if the debt report says "D". The two systems fight each other.

**Fix:** Remove the violation-count grading logic. Always use the `flint_debt_report` grade as the single source of truth for the health score display. If the debt report hasn't loaded yet, show "--" instead of a computed fallback.

### M4. `sendHandshake` does not wait for the `initialize` response (flintClient.ts:215-248)

```typescript
private async sendHandshake(): Promise<void> {
    const req: JsonRpcRequest = { ... method: 'initialize' ... };
    this.send(req);
    // Fallback: assume connected after settle period
    await new Promise<void>((resolve) => { ... setTimeout(3000) ... });
}
```

The handshake sends the `initialize` request but never registers a pending call for its response. It just waits 3 seconds and assumes the server is ready. The MCP protocol requires the client to wait for the `initialize` response before sending `initialized` notification.

This means:
- The extension proceeds to call tools before initialization completes
- If the server takes >3s to initialize (e.g., loading a large token file), calls will fail
- The `initialized` notification is never sent

**Fix:** Register the initialize request in `pendingCalls` via `this.rpc()`, await the response, then send `{ method: 'initialized' }` notification.

### M5. No test coverage for FlintClient (spawn, RPC, lifecycle)

There are 0 tests for `flintClient.ts`. This is the most critical module -- it manages the child process, JSON-RPC communication, and the entire client lifecycle. All existing tests cover pure functions in `diagnosticsProvider.ts`, webview panels, and MCP registration.

**Fix:** Add tests for:
- `resolveServerPath()` -- 3 candidates, custom path, not found
- `callTool()` -- mock stdin/stdout, verify JSON-RPC request/response
- `stop()` -- graceful SIGTERM, SIGKILL fallback
- Timeout handling -- pending call after 30s
- Server crash handling -- `handleExit` rejects all pending calls

### M6. `governancePanel.ts` fix handler reads `result.fixedSource` directly, not from MCP content wrapper (line 70-71)

```typescript
const result = (await this._callMcp('flint_fix', { ... })) as { fixedSource?: string } | null;
if (result?.fixedSource) {
```

But `flint_fix` returns an MCP response wrapped in `{ content: [{ type: 'text', text: '...' }] }`. The `codeActionProvider.ts` correctly unwraps this (lines 152-163), but the governance panel does not. This means the "Fix All" button in the sidebar panel **silently does nothing** because `result.fixedSource` is always undefined.

**Fix:** Unwrap the MCP content response before accessing `fixedSource`, same as `codeActionProvider.ts` does.

---

## MINOR Findings

### m1. Redundant language contributions in package.json (lines 46-62)

```json
"languages": [
    { "id": "typescriptreact", "extensions": [".tsx"] },
```

VS Code already knows about `.tsx`, `.jsx`, `.ts`, `.js`. Re-declaring these language contributions is harmless but unnecessary and clutters the extension manifest. These declarations are only needed for custom languages.

### m2. `dist/` contains stale `bridgeClient.*` files from pre-rebrand

The `dist/` directory has `bridgeClient.d.ts`, `bridgeClient.js`, `bridgeClient.js.map` files (dated Mar 19) alongside the current `flintClient.*` files (dated Mar 22). These are leftover artifacts from before the Bridge-to-Flint rename.

**Fix:** Delete `dist/bridgeClient.*` and add `dist/` to `.gitignore` (if not already).

### m3. No `.vscodeignore` file

The `.vsix` package includes `node_modules/`, `src/`, `scripts/`, `tsconfig.json`, `vitest.config.ts`, and other development files. A `.vscodeignore` would reduce the package size from 89KB to ~30KB and exclude test/dev files from the published extension.

### m4. `getNonce()` uses `Math.random()` instead of crypto (shared.ts:108-115)

While acceptable for CSP nonces in a trusted webview context, `Math.random()` is not cryptographically secure. VS Code provides `crypto` in the extension host.

**Fix:** Consider using `crypto.randomBytes(16).toString('hex')` for defense in depth.

### m5. Status bar shows static text, not health score (extension.ts:454-462)

```typescript
statusBarItem.text = '$(shield) Flint';
statusBarItem.tooltip = 'Flint Governance is active';
```

The README claims the extension shows a "health score display" in the status bar, but it only shows a static "Flint" label. The governance webview panel shows the score, but the status bar item is purely a click target.

### m6. `onDidReceiveMessage` return values not stored as disposables (governancePanel.ts:48, activityPanel.ts:42)

The `onDidReceiveMessage` call returns a `Disposable` that should be pushed into the view's disposable list. Currently it's discarded, which means the listener is never cleaned up if the view is disposed and recreated.

### m7. Workspace audit hardcoded limit of 100 files (extension.ts:398)

```typescript
const files = await vscode.workspace.findFiles('...', '...', 100);
```

For large workspaces this silently skips files beyond 100. The limit is reasonable for performance, but the user message "Audited 100 files" doesn't indicate that more files were skipped.

### m8. `codeActionProvider.ts` re-audit uses `setTimeout(500)` (line 192-197)

```typescript
setTimeout(() => {
    // ...
    vscode.commands.executeCommand('flint.auditFile');
}, 500);
```

This is a race condition. The 500ms delay is a guess that the file will be saved by then. A better approach is to listen for `onDidChangeTextDocument` or `onDidSaveTextDocument`.

---

## Accessibility Assessment

**Grade: B**

Positives:
- All webview HTML uses `lang="en"`
- Webview buttons use visible text labels
- VS Code manages keyboard navigation for command palette entries

Issues:
- No `aria-label` on the status bar item (VS Code auto-generates from text, which is acceptable)
- Webview grade display (large "A" letter) has no `role` or `aria-live` attribute -- screen readers won't announce grade changes
- Violation list items have no `role="listitem"` or `aria-label` -- they're just `<div>` elements

---

## Security Assessment

**Grade: A-**

Positives:
- CSP `default-src 'none'` with nonce-gated style and script (both webview panels)
- `localResourceRoots` restricted to extension directory
- No `eval()`, no external script loading
- `escapeHtml()` used for all user-facing text in webviews
- MCP responses are JSON-parsed, never executed as code
- `flint_fix` result is applied as a text replacement, not eval'd

Issues:
- `writeMcpEntry()` writes to user's global config files (`~/.cursor/mcp.json`, `~/.claude/mcp.json`) without explicit user confirmation. The information message is shown *after* the write. This is aggressive for a VS Code extension. Most MCP extensions ask first.
- No path validation on `flint.serverPath` configuration -- a malicious settings value could point to an arbitrary script that gets spawned as a child process. Consider validating the path is under the workspace root or a known safe location.

---

## Missing Test Coverage

| Area | Status |
|------|--------|
| `FlintClient` (spawn, RPC, timeout, exit) | **None** |
| `codeActionProvider` (provideCodeActions, applyFix) | **None** |
| `extension.ts` activate/deactivate lifecycle | **None** |
| Integration: audit round-trip (provider -> client -> diagnostics) | **None** |
| `governancePanel` fix handler (MCP response unwrapping) | **None** |
| `diagnosticsProvider` DiagnosticsProvider class methods | **None** (only pure functions tested) |

Current tests cover: pure transformation functions, MCP registration config generation, webview HTML structure, and shared utilities. The class-level behavior and integration paths are untested.

---

## Summary of Required Actions

### Must Fix (Blockers)

1. **C1** -- `process.execPath` used to spawn MCP server instead of resolved Node.js path
2. **C2** -- `applyFix` command drops violation argument, misleading single-fix UX

### Should Fix (Major)

3. **M1** -- No debounce on audit triggers; concurrent audits on tab switch
4. **M2** -- Hardcoded hex colors break high-contrast themes
5. **M3** -- Naive violation-count grade overwrites real debt report grade
6. **M4** -- MCP handshake doesn't wait for response or send `initialized`
7. **M5** -- Zero test coverage for FlintClient
8. **M6** -- Governance panel fix handler doesn't unwrap MCP content response

### Nice to Fix (Minor)

9. **m1** -- Remove redundant language contributions
10. **m2** -- Clean up stale `dist/bridgeClient.*` files
11. **m3** -- Add `.vscodeignore` for smaller package
12. **m4** -- Use crypto.randomBytes for nonce generation
13. **m5** -- Status bar should reflect health score, not static text
14. **m6** -- Store `onDidReceiveMessage` disposables
15. **m7** -- Communicate when workspace audit hits the 100-file limit
16. **m8** -- Replace setTimeout-based re-audit with event listener
