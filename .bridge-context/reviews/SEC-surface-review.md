# Security Surface Review
**Date:** 2026-03-16
**Reviewer:** Agent 1 (Security Surface)
**Files reviewed:** electron/main.ts, electron/preload.ts, src/components/editor/LivePreview.tsx, electron/ingestion-server.ts

## Summary

Bridge has solid fundamentals: context isolation is enabled, node integration is disabled, the process boundary is clean (zero Node.js imports in `src/`), and most IPC handlers validate payloads and enforce home-directory containment. However, the application has not implemented any of the six planned SEC-phase hardening items (SEC.1 through SEC.6). The most dangerous gaps are the missing iframe sandbox attribute (SEC.1), the hardcoded webhook secret shipped in the binary (SEC.2), the unrestricted MCP tool relay (SEC.3), the plaintext API key storage (SEC.4), and the unsandboxed terminal with no cwd restriction (SEC.5).

## Findings

### CRITICAL: srcdoc iframe has no `sandbox` attribute (SEC.1)
**File:** `src/components/editor/LivePreview.tsx:910-923`
**Issue:** The `<iframe>` element rendered by `LivePreview` has no `sandbox` attribute. The comment on line 4 claims it is "sandboxed" but no sandbox attribute exists on the actual element. Because the iframe uses `srcdoc` (and sometimes `src` pointing at localhost Vite), and is rendered in the same Electron renderer process, it has full access to the parent frame via `window.parent`. The srcdoc content already uses `new Function(code)` (line 181) to execute arbitrary transformed code, and communicates with the parent via `postMessage('*')`.
**Attack vector:** If an attacker can inject malicious code into the Figma payload (via `/ingest-ast`), that code is transformed by Babel and executed via `new Function()` inside the iframe. Without a `sandbox` attribute, the iframe shares the renderer's origin and can access `window.parent.bridgeAPI` — which exposes file read/write, terminal spawn, AI config (with API key save), and MCP tool invocation. A single malicious component in a Figma import could exfiltrate the AI API key, write arbitrary files within home, or execute shell commands via the terminal API.
**Recommended fix approach:** Add `sandbox="allow-scripts"` to the iframe element. Do NOT include `allow-same-origin` — that combination defeats the sandbox. The existing `postMessage('*')` communication pattern already works across sandbox boundaries. The `src`-based Vite preview path (Phase N.4) will need separate treatment since cross-origin iframes loaded from localhost already run in a separate origin.
**Contract required:** yes (touches LivePreview.tsx + likely requires adjustments to the postMessage origin checks)
**Maps to SEC phase:** SEC.1

### CRITICAL: Hardcoded webhook secret in production binary (SEC.2)
**File:** `electron/ingestion-server.ts:35`
**Issue:** `const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? 'bridge-dev-secret-phase2'`. The fallback value `'bridge-dev-secret-phase2'` is a compile-time constant that ships in the built binary. Every Bridge installation that does not set the env var uses the same secret. The inline comment acknowledges this is "Phase 2" but the code has been shipped.
**Attack vector:** Any local process (or browser tab with access to localhost) can send authenticated requests to the ingestion server on port 4545 using the well-known secret. This allows injecting arbitrary design tokens, arbitrary Figma AST payloads (which flow through to code execution in the preview iframe per the finding above), and triggering IPC events to all renderer windows.
**Recommended fix approach:** Generate a per-session cryptographic random secret at app startup (e.g., `randomUUID()` or `crypto.randomBytes(32).toString('hex')`). Store it in the SQLite `project_state` table. Expose it to the Figma plugin setup UI so users can copy it into their plugin settings. Remove the hardcoded fallback entirely.
**Contract required:** yes (touches ingestion-server.ts, main.ts, Figma plugin settings UI)
**Maps to SEC phase:** SEC.2

### CRITICAL: Secret logged to console on every startup (SEC.2)
**File:** `electron/ingestion-server.ts:354`
**Issue:** `console.log('[Bridge] x-bridge-secret: ${BRIDGE_SECRET}')` prints the webhook secret to the Electron console on every server start.
**Attack vector:** Any screen-sharing session, screenshot, or log capture reveals the authentication secret. Combined with the hardcoded secret above, this makes the secret trivially discoverable.
**Recommended fix approach:** Remove this log line entirely, or replace the secret value with a masked representation (e.g., first 4 characters + asterisks).
**Contract required:** no
**Maps to SEC phase:** SEC.2

### HIGH: Webhook secret returned to renderer via IPC (SEC.2)
**File:** `electron/ingestion-server.ts:402-411` and `electron/preload.ts:30`
**Issue:** `getFigmaStatus()` returns `{ ..., secret: BRIDGE_SECRET }` and the preload exposes it via `figma.status()`. The secret is sent to the renderer process on every `figma:status` call. The renderer's type declaration confirms this: `Promise<{ running: boolean; lastWebhookAt: number | null; tokenCount: number; port: number; secret: string }>`.
**Attack vector:** A compromised renderer (XSS in the preview iframe, malicious extension, or devtools injection) can call `window.bridgeAPI.figma.status()` to retrieve the authentication secret and then use it to send arbitrary payloads to the ingestion server. This is an unnecessary escalation path — the renderer should not need the secret at all.
**Recommended fix approach:** Remove the `secret` field from the `getFigmaStatus()` return value and from the preload type. If the secret must be displayed in a setup UI, use a dedicated one-shot IPC handler that requires a user gesture (e.g., clicking "Show Secret" in the Figma connection wizard).
**Contract required:** yes (touches ingestion-server.ts, preload.ts, bridge-api.d.ts, and any renderer code reading `secret`)
**Maps to SEC phase:** SEC.2

### HIGH: No CSP set via session.webRequest in main process
**File:** `electron/main.ts` (absent)
**Issue:** The Content Security Policy is set only via a `<meta>` tag in `index.html`. In Electron, a `<meta>` CSP can be bypassed or overridden if the renderer navigates to a `data:` URL, `blob:` URL, or if `loadURL` is called with inline content. The secure approach is to set CSP via `session.defaultSession.webRequest.onHeadersReceived` which cannot be overridden by page content.
**Attack vector:** If an attacker can trigger a navigation in the main window (e.g., via `window.open` from an unsandboxed iframe, or a crafted `file://` link), the meta-CSP is no longer enforced. The `frame-src` directive in the current meta CSP already allows `blob:` and `http://localhost:*` which is quite permissive.
**Recommended fix approach:** Add a `session.defaultSession.webRequest.onHeadersReceived` callback in `createWindow()` that injects the same CSP as a response header. This is defense-in-depth alongside the existing meta tag.
**Contract required:** no (single-file change in main.ts)
**Maps to SEC phase:** SEC.1

### HIGH: MCP tool relay has no allowlist (SEC.3)
**File:** `electron/main.ts:1857-1868`
**Issue:** The `mcp:call-tool` IPC handler accepts any tool name string from the renderer and forwards it to `mcpClient.callTool(name, args)` without restriction. The renderer can invoke ANY registered MCP tool, including potentially destructive ones (e.g., `bridge_ast_mutate`, `bridge_fix`, file-writing tools).
**Attack vector:** A compromised renderer can invoke MCP tools that modify files, apply AST mutations, or trigger other side effects. The renderer should only be able to invoke a curated subset of read-oriented tools. Write operations should require explicit user approval.
**Recommended fix approach:** Define an `ALLOWED_RENDERER_TOOLS` set (e.g., `bridge_status`, `bridge_audit`, `bridge_query_registry`, `bridge_debt_report`) and reject any tool name not in the set. Write-oriented tools should either be excluded or gated by a user-confirmation dialog in the main process.
**Contract required:** yes (main.ts + possibly a new confirmation dialog)
**Maps to SEC phase:** SEC.3

### HIGH: AI API key stored as plaintext JSON (SEC.4)
**File:** `electron/orchestrator.ts:438, 451-456`
**Issue:** The API key is stored in `~/.bridge/config.json` as a plaintext JSON field. `writeConfig` merges the key into a plain JSON file using `writeFile`. Electron provides `safeStorage.encryptString()` / `safeStorage.decryptString()` which uses the OS keychain (macOS Keychain, Windows DPAPI, Linux gnome-keyring/kwallet) to encrypt sensitive data at rest.
**Attack vector:** Any process running as the user can read `~/.bridge/config.json` and extract the API key. Malware, browser extensions with filesystem access, or other Electron apps could exfiltrate the key. The file persists across sessions and is never cleaned up.
**Recommended fix approach:** Use `safeStorage.encryptString(apiKey)` before writing and `safeStorage.decryptString(buffer)` when reading. Store the encrypted blob as a base64 string in the config file. Fall back to plaintext only if `safeStorage.isEncryptionAvailable()` returns false, and warn the user.
**Contract required:** yes (orchestrator.ts + main.ts config handlers)
**Maps to SEC phase:** SEC.4

### HIGH: Terminal spawn has no cwd restriction (SEC.5)
**File:** `electron/main.ts:2271-2301`
**Issue:** The `terminal:spawn` IPC handler accepts any `cwd` string from the renderer and passes it directly to `pty.spawn()` with no validation. There is no check that `cwd` is inside the user's home directory or inside the active project root. The handler also exposes the full `process.env` to the spawned shell.
**Attack vector:** A compromised renderer can spawn a shell in any directory on the filesystem (e.g., `/`, `/etc`, `/usr/local/bin`). Combined with `terminal:data`, it can execute arbitrary commands as the user. The `process.env` pass-through may also leak sensitive environment variables.
**Recommended fix approach:** Validate that `cwd` is an absolute path inside `app.getPath('home')` (same pattern as `ast:save-file`). Filter `process.env` to exclude known-sensitive variables (e.g., `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`). Consider restricting terminal to the active project root only.
**Contract required:** no (single-file change in main.ts)
**Maps to SEC phase:** SEC.5

### HIGH: No input size ceiling on terminal:data (SEC.5)
**File:** `electron/main.ts:2303-2307`
**Issue:** The `terminal:data` handler writes any string from the renderer directly to the PTY with no length check. A compromised renderer could flood the PTY with megabytes of data, causing memory pressure or denial of service in the shell process.
**Attack vector:** A malicious script calling `window.bridgeAPI.terminal.write()` in a tight loop with large payloads can consume memory and CPU in the main process.
**Recommended fix approach:** Add a size check (e.g., reject strings > 64 KB) and optionally rate-limit writes.
**Contract required:** no (single-file change in main.ts)
**Maps to SEC phase:** SEC.5

### MEDIUM: No rate limiting on ingestion server (SEC.6)
**File:** `electron/ingestion-server.ts` (entire file)
**Issue:** The HTTP server on port 4545 has no rate limiting. Any authenticated client (or any client when using the well-known hardcoded secret) can send unlimited requests per second. The 10 MB body limit (line 144) prevents individual payload bombs, but rapid-fire requests can still overwhelm SQLite writes and IPC broadcasts.
**Attack vector:** A script sending rapid POST /ingest requests can saturate the SQLite write path, trigger a flood of IPC events to the renderer (causing UI freezes), and fill the design_tokens table with garbage data.
**Recommended fix approach:** Implement a simple in-memory rate limiter (e.g., sliding window of 10 requests per 10 seconds per IP). Since the server is loopback-only, the attack surface is limited, but the fix is trivial.
**Contract required:** no (single-file change in ingestion-server.ts)
**Maps to SEC phase:** SEC.6

### MEDIUM: DevTools unconditionally opened in production
**File:** `electron/main.ts:231`
**Issue:** `mainWindow.webContents.openDevTools()` is called unconditionally, including in production builds. DevTools provides full access to the renderer console, network tab, and allows arbitrary JavaScript execution in the renderer context.
**Attack vector:** Physical access to the machine (or a screenshot during a demo) exposes all IPC traffic, store state, and the `window.bridgeAPI` surface. An attacker with DevTools access can call any bridgeAPI method directly.
**Recommended fix approach:** Guard with `if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL)` so DevTools are not opened in packaged production builds. Users can still access them via View > Toggle DevTools from the menu bar if needed.
**Contract required:** no
**Maps to SEC phase:** SEC.1

### MEDIUM: BrowserWindow sandbox disabled
**File:** `electron/main.ts:227`
**Issue:** `sandbox: false` is set in `webPreferences`. The inline comment explains this is required because the preload is built as ESM and Electron's sandbox cannot bootstrap ESM preloads. However, disabling the sandbox removes the second layer of defense that restricts the preload's access to Node.js APIs. With `sandbox: false`, the preload can access `require()` and full Node.js — contextIsolation alone prevents the renderer page from accessing them.
**Attack vector:** If contextIsolation is ever broken (Electron CVE), the disabled sandbox means the renderer immediately has full Node.js access. This is a defense-in-depth concern.
**Recommended fix approach:** Investigate building the preload as CJS (or using Electron's new ESM preload support in v35). If the ESM requirement is firm, document this as an accepted risk and ensure contextIsolation is verified in a startup self-test.
**Contract required:** yes (build tooling change)
**Maps to SEC phase:** SEC.1

### MEDIUM: writeAnnotationsFile bypasses FileTransactionManager (C12 / C14)
**File:** `electron/main.ts:1612-1620`
**Issue:** `writeAnnotationsFile()` uses raw `writeFile` and `rename` directly instead of routing through `FileTransactionManager`. This violates Commandments 12 (Atomic Queuing) and 14 (Bypass Prohibition). While the function does implement its own atomic tmp-rename pattern, it bypasses the per-path serialization and logging that FTM provides.
**Attack vector:** Not a direct security vulnerability, but concurrent writes to annotations.json (e.g., from both an MCP tool and a resolve action) could race because they are not serialized by FTM's per-path queue.
**Recommended fix approach:** Replace the manual writeFile+rename with `fileTransactionManager.write(filePath, JSON.stringify(annotations, null, 2))`. The FTM already handles tmp-rename and per-path serialization.
**Contract required:** no
**Maps to SEC phase:** new finding (C12/C14 compliance)

### MEDIUM: CSP allows 'unsafe-eval' and 'unsafe-inline' for scripts
**File:** `index.html:11`
**Issue:** The CSP `script-src` includes both `'unsafe-eval'` and `'unsafe-inline'`. While `'unsafe-eval'` is required for the srcdoc preview iframe's `new Function()` usage, `'unsafe-inline'` could be tightened. The combination significantly weakens XSS protections in the renderer.
**Attack vector:** An XSS vector in the renderer (e.g., unsanitized HTML injection) can execute arbitrary inline scripts. With `'unsafe-eval'`, `eval()` is also available.
**Recommended fix approach:** Consider using nonces for the boot-skeleton inline script (line 33) so `'unsafe-inline'` can be removed from the CSP. The `'unsafe-eval'` requirement should be documented as needed for the preview engine, and ideally constrained to the iframe only (which the sandbox attribute from SEC.1 would achieve).
**Contract required:** no
**Maps to SEC phase:** SEC.1

### MEDIUM: connect-src CSP allows `https:` wildcard
**File:** `index.html:15`
**Issue:** `connect-src` includes `https:` which allows the renderer to make fetch/XHR/WebSocket requests to any HTTPS endpoint. This is overly permissive for an app that claims to be "100% Offline" (Commandment 4).
**Attack vector:** If an attacker achieves XSS in the renderer, they can exfiltrate data to any HTTPS endpoint. This contradicts the "Local-First Only" commandment.
**Recommended fix approach:** Replace `https:` with specific domains that are actually needed (e.g., `https://unpkg.com`, `https://cdn.jsdelivr.net`, `https://cdn.tailwindcss.com`). If no external fetch is needed from the renderer itself (only the iframe needs CDN access), this can be tightened to `'self'` plus localhost.
**Contract required:** no
**Maps to SEC phase:** SEC.1

### LOW: postMessage uses wildcard origin '*'
**File:** `src/components/editor/LivePreview.tsx` (multiple locations, e.g., lines 583, 591, 746, 764)
**Issue:** All `postMessage` calls between the renderer and the srcdoc iframe use `'*'` as the target origin. While this is necessary for srcdoc iframes (which have a `null` origin), it means any iframe or window could receive these messages.
**Attack vector:** Low risk in the current architecture since the messages contain only bridge IDs and coordinates, not secrets. However, if the iframe is ever loaded from a remote URL (e.g., Vite preview on localhost), the wildcard allows any co-resident iframe to sniff the messages.
**Recommended fix approach:** When using `src=` mode (Vite preview), set the target origin to the known localhost URL. When using `srcdoc`, `'*'` is the only option. Add origin validation in the message event handlers.
**Contract required:** no
**Maps to SEC phase:** SEC.1

### LOW: Preload undo-all-heals signature still accepts code from renderer
**File:** `electron/preload.ts:657-658`
**Issue:** The preload exposes `undoAllHeals(preHealCode: string)` which passes the renderer-supplied code string to the main process. The main process handler (main.ts:2177) correctly ignores this argument and reads from the server-side store instead. However, the preload signature and type declaration still accept and transmit the code string, which is misleading and creates a latent risk if the handler is ever refactored to use the argument.
**Attack vector:** No current attack vector (the main process ignores the argument), but the exposed API surface is wider than necessary.
**Recommended fix approach:** Change the preload and type declaration to `undoAllHeals(): Promise<{ ok: boolean }>` with no parameters. Update ImportSummary.tsx to call it with no arguments.
**Contract required:** yes (preload.ts, bridge-api.d.ts, ImportSummary.tsx)
**Maps to SEC phase:** SEC.2

## Clean / No Issue

- **Process boundary enforcement:** Zero Node.js imports found in `src/`. No `ipcRenderer` calls found in `src/` outside of `preload.ts`. All cross-boundary communication goes through the typed `window.bridgeAPI` surface.
- **contextIsolation / nodeIntegration:** Correctly set to `true` / `false` respectively in `webPreferences` (main.ts:220-221).
- **File path validation:** All file read/write IPC handlers (`ast:save-file`, `ast:save-batch`, `file:read`, `ast:git-show`, `ast:git-log`, `project:initialize`, `project:openPath`, `project:reset-to-demo`, `preview:start`) validate that paths are absolute, have correct extensions, and reside within `app.getPath('home')`.
- **Git show injection prevention:** The `ast:git-show` handler validates `commitHash` against a strict hex-only regex (`/^([0-9a-fA-F]{4,64}|HEAD)$/`) and uses `execFile` with array arguments (no shell interpolation).
- **SQL injection prevention:** Token CRUD handlers use parameterized prepared statements. The dynamic SQL in `tokens:update` builds SET clauses from an allowlist of known column names with `?` parameter binding.
- **Ingestion server binds to loopback only:** `server.listen(port, '127.0.0.1')` at line 350 prevents network-adjacent access.
- **Payload size limits:** The ingestion server enforces 10 MB on `/ingest` and `/ingest-ast`, 50 MB on `/ingest-asset`.
- **No `@anthropic-ai/sdk` import in `src/`:** Confirmed clean.
- **Template ID validation:** `templateService.ts` validates `templateId` against a strict allowlist, preventing path traversal in project scaffolding.
- **Import summary undo path (SECURITY-01 fix):** The server-side `preHealCodeStore` pattern correctly prevents the renderer from injecting arbitrary code through the undo path. The main process stores the pre-heal code and reads it back server-side.

## Backlog Items

Ordered by priority (matches the SEC.* phase numbers from the roadmap):

1. **[P0] SEC.1 — Add `sandbox="allow-scripts"` to srcdoc iframe** in LivePreview.tsx. Verify postMessage communication still works without `allow-same-origin`. Handle the Vite preview `src=` path separately.
2. **[P0] SEC.1 — Set CSP via `session.webRequest.onHeadersReceived`** in main.ts alongside the existing meta tag.
3. **[P0] SEC.1 — Guard `openDevTools()` behind dev-mode check** in main.ts createWindow.
4. **[P1] SEC.2 — Generate per-session random secret** in ingestion-server.ts. Remove hardcoded `'bridge-dev-secret-phase2'` fallback. Persist in SQLite.
5. **[P1] SEC.2 — Remove `console.log` of bridge secret** in ingestion-server.ts:354.
6. **[P1] SEC.2 — Remove `secret` field from `getFigmaStatus()` return** in ingestion-server.ts and update preload.ts + bridge-api.d.ts.
7. **[P1] SEC.3 — Add MCP tool allowlist to `mcp:call-tool` handler** in main.ts. Define allowed renderer-callable tool set.
8. **[P1] SEC.4 — Encrypt API key at rest using `safeStorage`** in orchestrator.ts.
9. **[P2] SEC.5 — Validate terminal `cwd` against home directory** in main.ts terminal:spawn handler. Add input size ceiling to terminal:data.
10. **[P3] SEC.6 — Add rate limiter to ingestion server** in ingestion-server.ts.
11. **[P3] Tighten CSP** — remove `'unsafe-inline'` (use nonces), replace `connect-src https:` with specific domains.
12. **[P3] Route `writeAnnotationsFile` through FileTransactionManager** for C12/C14 compliance.
13. **[P3] Clean up `undoAllHeals` preload signature** — remove unused `preHealCode` parameter.
14. **[P4] Investigate re-enabling BrowserWindow sandbox** by building preload as CJS or using Electron v35 ESM sandbox support.
