# Web Build A+ Code Review — 2026-04-10

## Summary

| File | Grade | Critical | Major | Minor |
|------|-------|----------|-------|-------|
| `server/index.ts` | **B+** | 2 | 5 | 4 |
| `server/mcpClient.ts` | **A** | 0 | 0 | 1 |
| `src/adapters/web-api.ts` | **B** | 1 | 3 | 2 |
| `server/services/ragStore.ts` | **A-** | 0 | 1 | 0 |
| `server/services/aiChat.ts` | **A-** | 0 | 1 | 1 |
| `server/services/ingestionServer.ts` | **A** | 0 | 0 | 1 |
| `server/services/previewServer.ts` | **A** | 0 | 0 | 1 |
| `server/services/thumbnailService.ts` | **B+** | 1 | 0 | 1 |
| `vite.config.web.ts` | **A** | 0 | 0 | 1 |

**Overall Grade: B+**

Two critical issues, nine major issues, twelve minor issues. The server is functional and well-structured but has meaningful parity gaps and one security concern that should be addressed before the web build ships as the primary target.

---

## Critical Findings

### CRITICAL-1: Thumbnail service loads React from external CDN (Commandment 4 violation)

**File:** `server/services/thumbnailService.ts`, lines 63-64

```typescript
const REACT_UMD = 'https://unpkg.com/react@18/umd/react.production.min.js'
const REACT_DOM_UMD = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'
```

Commandment 4 says "no external URLs in preview. 100% offline." The thumbnail renderer fetches React from unpkg.com, which breaks offline-first and introduces a CDN dependency for component card screenshots.

**Fix:** Bundle React UMD files locally or read from the project's `node_modules/react/umd/` directory.

### CRITICAL-2: No WebSocket authentication

**File:** `server/index.ts`, line 551

```typescript
const wss = new WebSocketServer({ server, path: '/ws' })
```

The WebSocket server accepts all connections with zero authentication. Any process on the machine (or network, if not bound to 127.0.0.1) can connect and receive all governance events, file contents, and AI chat streams. While the server binds to `127.0.0.1` (line 3290), this is still a concern for multi-user dev environments and remote SSH forwarding.

**Fix:** Implement a session token handshake. Generate a random secret on server start, pass it to the browser via an initial HTTP call, and require it as the first WebSocket message. Reject connections that don't provide it within 5 seconds.

---

## Parity Gap Matrix

### Missing IPC Handlers (20 handlers in Electron, absent from web server)

| Channel | Used by UI? | Severity |
|---------|-------------|----------|
| `tokens:scan-usage` | Yes (`useTokenUsage.ts`) | **MAJOR** |
| `tokens:audit-contrast` | Yes (`useContrastAudit.ts`) | **MAJOR** |
| `tokens:get-pending-approvals` | Yes (test setup) | MINOR |
| `tokens:approve-token` | Yes (test setup) | MINOR |
| `tokens:reject-token` | Yes (test setup) | MINOR |
| `governance:get-provenance-summary` | Yes (`GovernanceDashboard.tsx`) | **MAJOR** |
| `governance:get-anomalies` | Yes (test setup, typed) | MINOR |
| `governance:get-last-clean-state` | Yes (test setup, typed) | MINOR |
| `governance:preview-token-impact` | Yes (test setup, typed) | MINOR |
| `governance:get-health-history` | Yes (test setup, typed) | MINOR |
| `governance:record-health` | Yes (test setup, typed) | MINOR |
| `governance:get-pending-mutations` | Yes (test setup, typed) | MINOR |
| `governance:approve-mutation` | Yes (test setup, typed) | MINOR |
| `governance:reject-mutation` | Yes (test setup, typed) | MINOR |
| `governance:get-audit-log` | Yes (test setup, typed) | MINOR |
| `auto-update:check` | No (no-op in web) | N/A |
| `auto-update:download` | No (no-op in web) | N/A |
| `auto-update:install` | No (no-op in web) | N/A |
| `auto-update:get-channel` | No (no-op in web) | N/A |
| `auto-update:set-channel` | No (no-op in web) | N/A |

### Missing web-api.ts Methods (present in preload.ts, absent from web adapter)

| Method | Called in `src/`? | Impact |
|--------|-------------------|--------|
| `tokens.scanUsage()` | Yes | Token usage badges broken in web |
| `tokens.auditContrast()` | Yes | Contrast audit panel broken in web |
| `tokens.getPendingApprovals()` | Optional typed | Approval flow unavailable |
| `tokens.approveToken()` | Optional typed | Approval flow unavailable |
| `tokens.rejectToken()` | Optional typed | Approval flow unavailable |
| `project.findRootForFile()` | Yes (App.tsx:729-730, useMCPEventListener) | **IDE file sync broken** |
| `project.onBaselineProgress()` | Optional typed | No progress during baseline |
| `mcp.getRecentFileFocus()` | Yes (App.tsx:728) | MCP file focus broken |
| `governance.getProvenanceSummary()` | Yes (GovernanceDashboard) | Provenance panel broken |
| `governance.getAnomalies()` | Optional typed | Anomaly panel unavailable |
| `governance.getLastCleanState()` | Optional typed | Clean state UX unavailable |
| `governance.previewTokenImpact()` | Optional typed | Impact preview unavailable |
| `governance.getHealthHistory()` | Optional typed | Health trend unavailable |
| `governance.recordHealth()` | Optional typed | Health tracking unavailable |
| `governance.getPendingMutations()` | Optional typed | Mutation approval unavailable |
| `governance.approveMutation()` | Optional typed | Mutation approval unavailable |
| `governance.rejectMutation()` | Optional typed | Mutation approval unavailable |
| `governance.getAuditLog()` | Optional typed | Audit log unavailable |

---

## Per-File Analysis

### server/index.ts — Grade: B+

**MAJOR-1: `code:transform` uses regex on compiled JS output (lines 759-801)**

The handler uses `.replace()` with regex patterns to strip import/export statements from Babel-compiled output. While this is operating on Babel output (not source code), it operates on a code string and could misfire on edge cases (e.g., string literals containing `export`). This is the same code as Electron's handler, so it is a shared concern, not a web-only regression.

Classification: MAJOR (Commandment 13 borderline — the input is Babel output, not user source code, but the pattern is fragile)

**MAJOR-2: No CORS configuration on the Express app**

The main Express app has no CORS middleware. In dev mode, Vite proxies `/api` and `/ws`, but in production (`dist-web` served by Express), if the SPA is loaded from a different origin (e.g., behind a reverse proxy), all API calls will fail with CORS errors.

**Fix:** Add `app.use(cors({ origin: true }))` or at minimum set CORS headers on `/api/ipc`.

**MAJOR-3: Synchronous SQLite calls on the Express event loop**

All `better-sqlite3` prepared statement calls (`stmtReadAll.all()`, `stmtUpsertPresence.run()`, etc.) are synchronous and block the Node.js event loop. Under load (many concurrent WS clients or rapid-fire IPC calls), this will cause latency spikes for all connected clients.

Classification: MAJOR for a "primary deployment target"

**Fix:** Consider wrapping SQLite operations in a worker thread, or accept this as a known limitation with a documented concurrency ceiling.

**MAJOR-4: Handler dispatch trusts channel name from client (line 3261)**

```typescript
const result = await handler(...(args || []))
```

Any channel name the client sends is dispatched to the matching handler with client-supplied args spread directly. While the handler map is fixed, this means the client can call any registered handler including `setup:write-mcp-config` which writes files. The Electron build has the same pattern, but in web mode the attack surface is larger (any browser tab on localhost).

**MAJOR-5: `scanDirectory` is recursive with no depth limit (line 92)**

A symlink loop or deeply nested directory structure could cause stack overflow. Add a depth limit parameter.

**MINOR-1:** `dialog:openFolder` handler returns null but the web-api routes `openFolder()` through the custom event system, not through this handler. The handler is dead code.

**MINOR-2:** `import:undo-all-heals` broadcasts null as the hydro-paste-auto payload (line 3177), which could crash listeners expecting a string.

**MINOR-3:** The `project:get-active-root` handler exists in the web server but has no corresponding method in `web-api.ts`.

**MINOR-4:** Error messages from the IPC dispatch (line 3266) are generic `"Operation failed (${channel})"` — the original error message is swallowed. In Electron, errors propagate naturally through IPC. In web mode, debugging is harder without the original message.

### server/mcpClient.ts — Grade: A

Clean, well-structured port. The only Electron dependency (`app`) was correctly removed. Retry logic, handshake, and shutdown are all properly implemented.

**MINOR-1:** The `_send` method silently drops messages when stdin is not writable (line 344) without rejecting the corresponding pending promise. If the process crashes between `_send` and the timeout, the caller waits the full 30 seconds before getting an error.

### src/adapters/web-api.ts — Grade: B

**CRITICAL (already counted above):** Missing `project.findRootForFile` and `mcp.getRecentFileFocus` which are actively called in `App.tsx` and `useMCPEventListener.ts`. These will throw `TypeError: ... is not a function` in web mode when the MCP event listener tries to auto-open files from IDE focus events.

**MAJOR-1: Missing `tokens.scanUsage()` and `tokens.auditContrast()`**

These are called by `useTokenUsage.ts` and `useContrastAudit.ts` hooks. Both hooks guard with `typeof api?.tokens?.scanUsage !== 'function'` so they won't crash, but the MINT features (usage badges, contrast audit) are silently broken in web mode.

**MAJOR-2: Missing `governance` sub-object methods**

The web adapter has a `governance` object but it only has `recordOverride`, `getOverrideCount`, `getComplianceSummary`, `onOverrideRecorded`, and `applyFix`. The Electron preload exposes 15+ governance methods. The `GovernanceDashboard.tsx` calls `api.getProvenanceSummary` which will silently fail.

**MAJOR-3: `project.getActiveRoot` is not exposed in the web adapter**

The handler exists in `server/index.ts` but has no corresponding method in `web-api.ts`.

**MINOR-1:** The `invoke()` retry logic (line 161) retries on ALL errors including 4xx client errors. It should only retry on network failures or 5xx.

**MINOR-2:** The `subscribe()` function casts callbacks with `as (...args: unknown[]) => void` which loses type safety. Not a runtime issue but makes the adapter harder to maintain.

### server/services/ragStore.ts — Grade: A-

**MAJOR-1:** Uses n-gram hashing instead of neural embeddings. This is documented and intentional, but the semantic quality is significantly lower than the Electron version (which uses HuggingFace ONNX). For a "primary deployment target," this is a meaningful capability regression. Consider adding a configuration option to use a local embedding model when available.

### server/services/aiChat.ts — Grade: A-

**MAJOR-1:** Imports `@anthropic-ai/sdk` directly. This is correct for the server process (it runs in Node.js, not in `src/`), but the file should be verified to never be imported from `src/` code paths.

**MINOR-1:** The `DEFAULT_MODEL` is hardcoded to `claude-sonnet-4-20250514` (line 28). The Electron orchestrator uses complexity routing (Commandment 8). The web chat is intentionally simplified, but this should be documented as a known capability gap.

### server/services/ingestionServer.ts — Grade: A

Clean implementation. Proper secret validation, body size limits, CORS headers, loopback binding. Good parity with the Electron version.

**MINOR-1:** The `Access-Control-Allow-Origin: *` header (line 50) is more permissive than necessary. Since this receives Figma plugin payloads on localhost, `*` is acceptable but could be tightened to the known plugin origin.

### server/services/previewServer.ts — Grade: A

Well-designed with proper idempotency guard, graceful degradation when Vite is not installed, and clean lifecycle management.

**MINOR-1:** The `preview:start` handler in `server/index.ts` (line 3073) always returns an error message disabling the Vite preview server in web mode. This means `previewServer.ts` is effectively dead code in web mode. Consider removing the service or making it configurable.

### server/services/thumbnailService.ts — Grade: B+

See CRITICAL-1 above (CDN dependency).

**MINOR-1:** Puppeteer is dynamically imported which is good for graceful degradation, but the fallback (returning `{ generated: false, error: 'Puppeteer not available' }`) means component cards in web mode will have no thumbnails unless the user installs Puppeteer separately. This should be documented.

### vite.config.web.ts — Grade: A

Clean configuration. Correct proxy setup, proper exclusions for Electron/Node modules, sensible watch ignores.

**MINOR-1:** `process.env.NODE_ENV` is hardcoded to `'development'` (line 19) even for production builds (`npm run build:web`). This should be `JSON.stringify(process.env.NODE_ENV || 'production')` in the build config, or removed entirely since Vite sets it automatically.

---

## Prioritized Punch List

### Must Fix (ship blockers)

1. **Add `project.findRootForFile` to web-api.ts** — Active crash path in App.tsx and useMCPEventListener
2. **Add `mcp.getRecentFileFocus` to web-api.ts** — Called in App.tsx startup
3. **Fix thumbnail CDN dependency** — Commandment 4 violation
4. **Add `tokens.scanUsage` and `tokens.auditContrast` handlers and web-api methods** — MINT features broken

### Should Fix (quality bar for primary target)

5. Add WebSocket session token authentication
6. Add CORS middleware to Express app for production mode
7. Add `governance.getProvenanceSummary` handler + web-api method (used by GovernanceDashboard)
8. Add `project.getActiveRoot` to web-api.ts
9. Add `project.onBaselineProgress` to web-api.ts (WebSocket subscription)
10. Fix `import:undo-all-heals` broadcasting null — should broadcast empty string or skip
11. Pass original error messages through IPC dispatch (not just "Operation failed")
12. Fix `process.env.NODE_ENV` hardcoding in vite.config.web.ts
13. Add depth limit to `scanDirectory`
14. Document the RAG embedding quality gap between Electron and web builds

### Nice to Have

15. Add remaining 15 governance handlers as stubs returning sensible defaults
16. Consider worker thread for SQLite operations under concurrent load
17. Remove dead `previewServer.ts` code path or make it configurable
18. Tighten invoke() retry to only retry on network/5xx errors
19. Document Puppeteer as optional dependency for thumbnail generation

---

## Commandment Compliance Notes

| Commandment | Status | Notes |
|-------------|--------|-------|
| C4 (Local-First Only) | **VIOLATION** | thumbnailService.ts loads React from unpkg.com |
| C12 (Atomic Queuing) | PASS | `atomicWrite()` mirrors FileTransactionManager pattern |
| C13 (No Regex Surgery) | BORDERLINE | `code:transform` uses regex on Babel output (same as Electron) |
| C15 (AST Catalog) | PASS | `ai:apply-batch` delegates to MCP `flint_ast_mutate` |
| C16 (TSC Loop) | N/A | Web server chat is passthrough; validation is MCP-side |

---

*Review conducted: 2026-04-10*
*Reviewer: Quality Gate (flint-reviewer)*
*Files examined: 9 files, ~5,000 lines*
*Handler parity: 104/124 (84%) — 20 handlers missing from web server*
