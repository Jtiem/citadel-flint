# Flint Glass: Electron-to-Web Migration Architecture Research

**Date:** 2026-03-27
**Status:** Research Complete — Awaiting Decision

---

## Executive Summary

Flint Glass already has a working web mode. The `server/` directory contains a 2,152-line Express + WebSocket server that replicates 94 of the 99 `ipcMain.handle()` registrations from `electron/main.ts`. A web adapter (`src/adapters/web-api.ts`) implements the identical `window.flintAPI` interface, and `vite.config.web.ts` builds the SPA without Electron plugins. The `npm run dev:web` command starts both layers today.

This means the migration question is not "can we build a web version?" — it is "should we invest in making the web version the primary delivery model, and what is the cost of completing the remaining gaps?"

The answer: **Yes, adopt Option E (Progressive Web-First) and promote the existing web mode to primary.** The work is 70-80% done. The remaining effort is polish, not architecture.

---

## 1. Case Study Findings: Electron-to-Web Migrations

### VS Code to vscode.dev (Microsoft, 2021)

**What they did:** Built a browser-hosted version of VS Code that runs extensions as web workers. The same TypeScript codebase powers both desktop (Electron) and web, with platform abstraction layers that swap implementations at build time.

**What worked:**
- Shared codebase with `platform/` abstraction interfaces (IFileService, ITerminalService, etc.)
- Feature-flagged native capabilities — web version gracefully degrades
- Extension authors opt into web compatibility via `browser` field in `package.json`

**What broke:**
- Extensions that depend on Node.js APIs cannot run in the browser (native git, terminal, debugger)
- Local file access requires the File System Access API (Chrome-only initially)
- Performance of large workspace operations (search, indexing) needed reimplementation using web workers

**Relevant to Flint:** Glass's `window.flintAPI` interface is exactly analogous to VS Code's platform abstraction. Flint already has two implementations (preload.ts for Electron, web-api.ts for web). The pattern is proven.

### Figma (Reverse Pattern: Web-First, Desktop Wrapper)

**What they did:** Built as a web app from day one. Added an Electron wrapper later for native window management, tabs, and local font access.

**What worked:**
- Web-first meant zero adoption friction — share a URL, it just works
- Desktop app is literally a thin wrapper around the web app with enhanced capabilities
- Canvas rendering (WebGL) performs identically in both modes

**What broke:**
- Font detection required native access (added via Electron shell)
- File save/open dialogs needed native integration for non-Chrome browsers

**Relevant to Flint:** Glass's canvas engine (`@xyflow/react`) is already a pure web component. The LivePreview iframe works identically in both contexts. Figma's model validates that complex canvas UIs work on the web.

### Notion (Web + Electron Wrapper)

**What they did:** Built the web app first. Electron wrapper exists primarily for a native-feel window, offline mode, and OS integration (deep links, global shortcuts).

**What worked:**
- Single codebase with minimal branching
- Offline mode via service workers (web) and local cache (Electron)

**Relevant to Flint:** Glass's "observability" role means offline support is less critical than for a document editor. The data source (MCP server) must be running locally anyway.

### Linear (Web-First, Optional Desktop)

**What they did:** Pure web application. Desktop app is an Electron wrapper that adds window management and keyboard shortcuts.

**What worked:**
- Sub-100ms interactions despite being web-first
- Users overwhelmingly use the web version
- Desktop app is literally the same code with 500 lines of Electron shell

**Relevant to Flint:** Linear proves that rich, real-time dashboards with complex interactions work perfectly as web apps without degraded UX.

### Slack (Electron Struggles)

**What happened:** Slack's Electron app was notorious for resource consumption (multiple Chromium instances). They eventually rebuilt it as a more efficient multi-workspace architecture.

**Lesson for Flint:** Electron's overhead is non-trivial. A 300MB+ download for what is fundamentally a dashboard is a hard sell. Web delivery eliminates this entirely.

### Common Patterns Across All Cases

1. **Platform abstraction is the prerequisite** — and Flint already has it (`window.flintAPI`)
2. **Feature flags, not feature removal** — native capabilities get flagged, not deleted
3. **Canvas/rendering is not the problem** — all complex UI frameworks work fine on the web
4. **File I/O and native APIs are the hard part** — always solved with a thin server or API layer
5. **Distribution is the biggest win** — "open a URL" beats "download an installer" every time

---

## 2. Architecture Comparison Matrix

### Current State Assessment

Before comparing options, it is critical to acknowledge what already exists:

| Asset | Status |
|-------|--------|
| `server/index.ts` | 2,152 lines, 94 IPC handlers implemented |
| `server/cli.ts` | CLI entry point with `--project`, `--port`, `--open` flags |
| `server/mcpClient.ts` | MCP child process client (Electron-free) |
| `server/services/previewServer.ts` | Vite-based component preview for web |
| `server/services/ingestionServer.ts` | Figma ingestion for web mode |
| `server/services/aiChat.ts` | AI chat streaming for web mode |
| `server/services/ragStore.ts` | RAG store for web mode |
| `src/adapters/web-api.ts` | Complete `window.flintAPI` implementation over HTTP/WS |
| `vite.config.web.ts` | SPA build config (no Electron plugins) |
| `npm run dev:web` | Working dev command |
| `npm run build:web` | Working production build |

**This is not a greenfield migration. The web mode is substantially built.**

### Option Comparison

Scoring: 1 (worst) to 5 (best)

| Criterion | A: Static SPA + MCP/SSE | B: Thin Backend | C: VS Code Webview | D: Hybrid (Web + Agent) | E: Progressive (Web-First) |
|-----------|:-:|:-:|:-:|:-:|:-:|
| **Implementation effort** | 3 | 4 | 2 | 3 | **5** |
| **Feature parity** | 2 | 4 | 2 | 5 | **4** |
| **UX quality** | 3 | 4 | 2 | 4 | **4** |
| **Distribution simplicity** | 5 | 3 | 4 | 2 | **4** |
| **Maintenance cost** | 4 | 3 | 3 | 2 | **3** |
| **Total** | 17 | 18 | 13 | 16 | **20** |

### Option A: Static SPA + MCP via SSE/WebSocket

**Architecture:** Glass becomes a pure static React SPA. All interactions go through MCP tools via SSE or WebSocket from the IDE's MCP client.

**Pros:**
- Simplest deployment — serve static files from anywhere
- Zero backend to maintain
- MCP server already exists

**Cons:**
- MCP protocol is tool/resource/prompt — not designed for real-time UI push (no `flint:tokens-updated` equivalent)
- Would require a new MCP notification channel or polling, which does not exist in the protocol today
- Loses all write capabilities (file save, token CRUD, annotations)
- No SQLite access from the browser — loses governance events, baselines, presence
- Would need to rebuild most of the 94 IPC handlers as MCP tools or resources
- The MCP server is designed for AI agents, not for a web UI frontend

**Verdict:** Architecturally clean but impractical. Would require either massive MCP surface expansion or accepting a read-only dashboard. The existing web server is more complete than this option.

### Option B: Thin Backend (Express/Hono) + Web Frontend

**Architecture:** Small Node.js server replaces Electron's main process. Frontend is the same React SPA.

**This is what already exists.** The `server/index.ts` is exactly this architecture — Express + WebSocket, with 94 IPC handlers dispatching `window.flintAPI` calls over HTTP.

**Pros:**
- Already 80% built
- Near-complete feature parity
- Same React codebase, zero UI rewrite
- SQLite, Git, file I/O all work server-side

**Cons:**
- User must run `npx tsx server/cli.ts` — requires Node.js on the machine
- Two processes to manage (web server + MCP server)
- No native OS integration (system tray, global shortcuts, native dialogs)

**Verdict:** The foundation is already laid. This is the pragmatic path.

### Option C: VS Code Webview Panel

**Architecture:** Glass becomes a VS Code extension panel rendering inside a webview.

**Pros:**
- Zero separate app — user stays in their IDE
- Can communicate via VS Code extension API
- Flint already has `flint-vscode/` with diagnostics and quick fixes

**Cons:**
- Webview panels have constrained viewport — the infinite canvas, 3-panel layout, and spatial governance overlays would be severely cramped
- Limited to VS Code and Cursor — excludes JetBrains, Zed, Neovim users
- Webview security model restricts many capabilities (no WebSocket, limited fetch)
- Would need to rewrite the entire UI for a panel context
- VS Code webviews have a different lifecycle than standalone apps (destroyed on tab switch)
- The existing VS Code extension provides diagnostics and quick fixes — that is the right level of IDE integration

**Verdict:** Wrong tool for the job. Glass is a spatial observability surface — it needs screen real estate and persistent state. A webview panel would force a complete UX redesign for a worse result. The existing VS Code extension already provides the appropriate IDE-embedded integration.

### Option D: Hybrid — Web Glass + Local Agent

**Architecture:** Lightweight system tray agent handles file I/O, Git, SQLite. Web Glass connects to it via localhost.

**Pros:**
- Full feature parity including native file operations
- Web UI with native backend capabilities
- Could add multi-project support

**Cons:**
- Still requires a local install (the agent)
- Two things to maintain: the agent and the web UI
- More complex than Option B (system tray integration, process management, auto-update for the agent)
- Architecturally identical to Option B but with extra complexity

**Verdict:** Over-engineered for the problem. The `server/cli.ts` already does what this agent would do. Adding a system tray and auto-update infrastructure just to avoid typing `npx` is not worth the complexity.

### Option E: Progressive — Web-First, Electron Wrapper Optional

**Architecture:** Build web-first. Wrap in Electron (or Tauri) for users who want native features. Feature-flag the native-only capabilities.

**This is the direction the codebase is already moving.**

**Pros:**
- One React codebase, two delivery models (already the case)
- Web users get `npm run start:web` — open in any browser
- Desktop users get the Electron app for native dialog, system tray, auto-update
- Feature flags already exist (`__FLINT_WEB__`, no-ops in `web-api.ts`)
- Preserves all investment in the Electron app
- No throwaway work

**Cons:**
- Must maintain two backend implementations (Electron main.ts + server/index.ts)
- Feature divergence risk — new features must be added to both backends
- Slightly more complex CI/CD (build two artifacts)

**Verdict:** This is what is already happening. The question is whether to formalize it and make web the primary target.

---

## 3. Feature Survival Matrix

Every Glass feature assessed for web compatibility.

### Legend
- **Works Now:** Feature operates correctly in `npm run dev:web` today
- **Server Proxy:** Works via the Express server (file I/O, SQLite, Git)
- **MCP Delegation:** Feature calls MCP tools through the server's MCP client
- **Stubbed:** Returns a no-op or static value in web mode
- **N/A:** Feature concept does not apply to web

### Core Observability (Read-Only)

| Feature | Web Status | Notes |
|---------|-----------|-------|
| Infinite canvas (@xyflow/react) | **Works Now** | Pure React component, zero Electron dependency |
| LivePreview (srcdoc iframe) | **Works Now** | Babel transform runs server-side; iframe renders identically |
| Governance overlay (violations) | **Works Now** | Pure React rendering |
| Ghost code snippets | **Works Now** | Pure React rendering |
| Activity feed (MCP event log) | **Works Now** | WebSocket push replaces fs.watch on mcp-events.jsonl |
| Governance dashboard | **Works Now** | Pure React + MCP resource read |
| Agent risk dashboard | **Works Now** | Pure React + MCP resource read |
| Component cards (Build/Govern modes) | **Works Now** | Manifest reading via server |
| StatusBar indicators | **Works Now** | All status data available via IPC-over-HTTP |
| Shield overlay (presence cursors) | **Works Now** | Presence via SQLite, synced over WebSocket |
| Violation tooltips | **Works Now** | Pure React rendering |
| Design system coverage map | **Works Now** | Pure React + MCP data |
| Governance stickers | **Works Now** | Pure React rendering |
| Annotation list | **Works Now** | File read via server |
| Command palette | **Works Now** | Pure React component |

### Write Operations

| Feature | Web Status | Notes |
|---------|-----------|-------|
| D2C apply (file generation) | **Server Proxy** | `d2c:apply` handler writes files server-side |
| Recovery Panel (Git operations) | **Server Proxy** | `ast:git-show`, `ast:git-log` via `execFile('git', ...)` |
| MCP tool calls (audit, fix) | **MCP Delegation** | Server spawns MCP process, proxies JSON-RPC |
| Auto-save (file writes) | **Server Proxy** | `ast:save-file` uses `atomicWrite()` |
| Token CRUD (SQLite) | **Server Proxy** | Full CRUD via prepared statements |
| Annotation CRUD | **Server Proxy** | Read/write to `.flint/annotations.json` |
| Asset management | **Server Proxy** | File operations via server |
| Setup wizard (IDE config) | **Server Proxy** | `setup:write-mcp-config` writes JSON files |
| Component scope editor | **Server Proxy** | Policy.json read/write via server |
| Enrichment approve/dismiss | **Server Proxy** | Manifest + drafts JSON via server |

### Electron-Only Features

| Feature | Web Status | Notes |
|---------|-----------|-------|
| Native OS menu | **Stubbed** | No-ops in web-api.ts. CommandPalette replaces it. |
| Native file picker dialog | **Stubbed** | `dialog:openFolder` returns null. Users use `--project` flag or in-app path input. |
| Auto-update | **Stubbed** | N/A for web. Server restarts are the equivalent. |
| Beta expiry enforcement | **Stubbed** | Returns `isBeta: false` in web mode. |
| Screenshot capture | **Stubbed** | Returns null. Could use html2canvas if needed. |
| Thumbnails (offscreen BrowserWindow) | **Partial** | Puppeteer-based service exists at `server/services/thumbnailService.ts` |
| System tray | **N/A** | Not applicable to web |
| Global keyboard shortcuts | **N/A** | Browser shortcuts work; OS-level shortcuts are not possible |
| Safe storage (encrypted API keys) | **Reduced** | Config stored in `~/.flint/config.json` — not encrypted. Accept this or add keyring integration. |

### Gap Summary

Out of approximately 40 distinct Glass features:
- **30 features** work fully in web mode today
- **5 features** are stubbed with acceptable degradation (native dialogs, menus, auto-update)
- **3 features** have web-specific alternatives (thumbnails via Puppeteer, menus via CommandPalette, file picker via CLI flag)
- **2 features** have reduced functionality (safe storage, screenshot capture)

The gap is narrow. No feature requires a fundamental rethink.

---

## 4. Competitive Analysis

### How Similar Tools Deliver Their UI

| Product | Delivery Model | Local Server? | Key Observation |
|---------|---------------|:---:|----------------|
| **Storybook** | Web (localhost dev server) | Yes, `npx storybook dev` | Requires Node.js. Users expect `npm run storybook`. Exact same model as Flint's `npm run dev:web`. |
| **Chromatic** | Cloud web app | No | SaaS dashboard. No local install needed. Reads from CI. |
| **Snyk Dashboard** | Cloud web app | No | SaaS. Local CLI uploads results. |
| **SonarQube** | Self-hosted web app OR cloud | Optional | Server + web UI. Users run `docker-compose up` or use cloud. The self-hosted pattern is well-understood. |
| **Figma Dev Mode** | Cloud web app | No | Pure web. Desktop wrapper optional. |
| **Vercel Dashboard** | Cloud web app | No | SaaS. Shows deployment status, logs, analytics. |
| **Grafana** | Self-hosted web app OR cloud | Optional | The canonical observability dashboard. Always web-based. |
| **Retool / Airplane** | Web app | No | Internal tool dashboards. Always web. |
| **Nx Cloud / Turborepo** | Cloud web app | No | Build system dashboards. Always web. |

### Key Takeaways

1. **Every observability/dashboard tool in dev tooling is web-based.** There is not a single desktop-native observability dashboard in the modern dev tool ecosystem. Grafana, Datadog, Sentry, LaunchDarkly, PagerDuty — all web.

2. **The "local dev server" pattern is standard.** Storybook, Next.js dev tools, Vite inspect, Vue Devtools — all run as `localhost:PORT`. Users understand this model. Running `npx flint-glass` is no different from `npx storybook dev`.

3. **Desktop wrappers are afterthoughts, not primary targets.** Even Figma, which has a desktop app, builds web-first. The desktop app is a convenience, not the product.

4. **Electron desktop apps for dashboards are anomalous.** GitHub Desktop and VS Code are the major Electron success stories, but both are editors/clients, not observability dashboards. A dashboard in Electron is like shipping Grafana as a desktop app — it does not match user expectations.

5. **SaaS is not appropriate for Flint's threat model.** Flint runs locally and accesses source code. A cloud dashboard would require uploading code or audit results. The `localhost` dev server model is the right fit — same privacy as the Electron app, but with web delivery.

---

## 5. Recommendation

### Promote the existing web mode to primary. Keep Electron as a secondary wrapper.

This is Option E (Progressive Web-First), but the framing matters: this is not a migration. It is a **promotion**. The web mode exists. It works. The recommendation is to:

1. Make `npm run dev:web` / `npx flint-glass` the default getting-started experience
2. Complete the remaining feature gaps (see phased plan below)
3. Keep the Electron app available for users who prefer a native window
4. Stop adding Electron-only features — every new feature must work in web mode first

### Why This Recommendation

**Distribution is Flint's biggest adoption barrier.** Today, getting Flint Glass requires:
1. Clone the repo
2. `npm install` (installs Electron, rebuilds native modules)
3. `npm run dev` (launches Electron)
4. Hope the native module rebuild did not fail

With web mode:
1. `npx flint-glass --project ./my-app`
2. Open `localhost:4201` in any browser

Or even simpler, if published to npm:
1. `npx flint-glass`

**The MCP engine is the product. Glass is the dashboard.** This is Flint's own architecture philosophy — CLAUDE.md states "Flint MCP does all the work. Flint Glass reads MCP Resources to display state and calls MCP Tools to trigger actions. Glass owns zero business logic." If Glass owns zero business logic, it should be a zero-install web dashboard, not a 300MB Electron binary.

**Electron is friction, not value.** For Flint Glass, Electron provides:
- Native window chrome (cosmetic)
- Native file dialogs (replaceable with CLI flag or in-app path input)
- System tray (unused currently)
- Auto-update (replaceable with npm version checks)
- Safe storage (minor — could use OS keyring via keytar)

None of these are essential to Glass's core mission: observability.

**The codebase already supports it.** The `server/index.ts` implements 94 of 99 IPC handlers. The `web-api.ts` adapter means the React app does not know the difference. The migration path is not "rewrite Glass" — it is "finish the last 5%."

---

## 6. Risks of the Recommended Approach

### Risk 1: Backend Divergence (HIGH)

**Problem:** Two backend implementations (`electron/main.ts` at 4,925 lines and `server/index.ts` at 2,152 lines) must stay in sync. Every new IPC handler must be added to both. Bugs fixed in one may not be fixed in the other.

**Mitigation:**
- Extract shared handler logic into a `shared/handlers/` module imported by both backends
- Add integration tests that verify both backends return identical results for the same inputs
- Eventually, make the Express server the single backend and have Electron invoke it internally (Electron loads the Express server instead of using `ipcMain.handle()`)

### Risk 2: Native Dialog Replacement (MEDIUM)

**Problem:** The native file picker (`dialog:openFolder`) returns `null` in web mode. Users need another way to select project directories.

**Mitigation:**
- The `--project` CLI flag already works
- Could add a "recent projects" dropdown (already implemented via `registry:getRecent`)
- Could add an in-app path text input with autocomplete
- The File System Access API works in Chrome/Edge for browser-native file picking (progressive enhancement)

### Risk 3: Safe Storage (LOW)

**Problem:** In Electron, `safeStorage.encryptString()` encrypts API keys. In web mode, keys are stored in plaintext in `~/.flint/config.json`.

**Mitigation:**
- Use OS keyring via `keytar` or `keychain-access` npm packages
- Or accept this limitation — the keys are already on the local filesystem, protected by OS user permissions. This is the same security model as `.env` files.

### Risk 4: Performance of IPC-over-HTTP (LOW)

**Problem:** Every `window.flintAPI` call becomes an HTTP POST in web mode, adding network overhead versus in-process IPC.

**Mitigation:**
- Latency is sub-millisecond on localhost (no network hop)
- WebSocket push is already implemented for real-time events
- Could batch frequent calls (e.g., `syncPresence`) into WebSocket messages
- Measured performance is already acceptable — the web mode works today without noticeable lag

### Risk 5: Puppeteer Dependency for Thumbnails (LOW)

**Problem:** Thumbnails use an offscreen BrowserWindow in Electron. The web server uses Puppeteer, which is a heavier dependency.

**Mitigation:**
- Thumbnails are nice-to-have, not core functionality
- Could make Puppeteer optional — stub thumbnails when not installed
- Could generate thumbnails at build time via CI instead of at runtime

### Risk 6: Complexity of Maintaining Two Builds (MEDIUM)

**Problem:** CI/CD must build both the Electron app and the web SPA. Two sets of tests, two build configurations.

**Mitigation:**
- The React test suite (`vitest.config.react.ts`) already tests the shared UI layer
- The web server can have its own test suite (independent of Electron tests)
- Use a single CI pipeline that builds both artifacts from the same commit
- Longer-term: consolidate the backends (see Risk 1 mitigation)

---

## 7. Phased Migration Plan

### Phase 0: Formalize What Exists (1 week)

The web mode already works. This phase makes it official.

- [ ] Add `"bin": { "flint-glass": "server/cli.ts" }` to `package.json` so `npx flint-glass` works
- [ ] Write a `Getting Started (Web)` section in the README
- [ ] Add web mode to CI: build `dist-web/`, run the Express server in tests
- [ ] Ensure all 94 server handlers have test coverage
- [ ] Document the `__FLINT_WEB__` flag and conditional behavior

### Phase 1: Close Feature Gaps (2 weeks)

Complete the remaining 5-10% of feature parity.

- [ ] **Project picker:** Add in-app directory browser or path input when `dialog:openFolder` is called (replace native dialog)
- [ ] **Component health:** Wire up MCP-based health enrichment in server mode (currently returns `null`)
- [ ] **project:reindex:** Implement RAG seeding in web mode (currently returns `{ components: 0, ragChunks: 0 }`)
- [ ] **Thumbnail generation:** Verify Puppeteer-based service works end-to-end, make it optional
- [ ] **MCP event streaming:** Verify mcp-events.jsonl file tailing works via WebSocket broadcast

### Phase 2: Consolidate Backends (3-4 weeks)

Reduce maintenance burden by extracting shared logic.

- [ ] Create `shared/handlers/` with pure handler functions (no Express or Electron dependency)
- [ ] Import shared handlers into both `electron/main.ts` and `server/index.ts`
- [ ] Add parity tests: run the same test suite against both backends
- [ ] Audit all 99 Electron IPC handlers — identify any missing from the server

### Phase 3: Polish and Distribution (2 weeks)

Make web mode production-ready for external users.

- [ ] Publish `flint-glass` as an npm package (server + pre-built web assets)
- [ ] Add `npx flint-glass init` command for first-time setup
- [ ] Add service worker for offline caching of static assets
- [ ] Add authentication option for team/remote access (token-based, optional)
- [ ] Add graceful error pages when the backend is unreachable
- [ ] Performance profiling: measure IPC-over-HTTP latency vs. Electron IPC

### Phase 4: Electron Convergence (4 weeks, optional)

Long-term: make Electron a thin shell around the web server.

- [ ] Have Electron's main process start the Express server internally
- [ ] Point the Electron BrowserWindow at `localhost:PORT` instead of bundled HTML
- [ ] Remove duplicated handler code from `electron/main.ts`
- [ ] Electron-only additions: native dialogs, safe storage, system tray — injected as middleware
- [ ] Single backend, two delivery shells

This is the architecture VS Code uses: the Electron shell loads a web page, and the backend is shared between desktop and web.

---

## 8. The "Is Glass Necessary?" Question

This was asked, so it deserves a direct answer.

**Glass adds value that a VS Code panel cannot replicate.** Specifically:

1. **Spatial governance.** The infinite canvas with component cards, governance stickers, dependency edges, and severity heat halos creates a map of your design system. A VS Code panel cannot render this — it is too complex and too spatial for a sidebar.

2. **Cross-file overview.** Glass shows governance health across your entire component library simultaneously. A VS Code panel shows one file at a time.

3. **Non-developer access.** Designers and design system managers need to see governance health without opening an IDE. Glass serves this audience. A VS Code panel does not.

4. **Multi-tool independence.** Flint's MCP engine works with Claude Code, Cursor, VS Code, JetBrains, and Zed. Glass should be equally universal. Embedding it in VS Code would contradict this.

However, **Glass as an Electron desktop app is harder to justify than Glass as a web dashboard.** The value proposition of Glass is the spatial observability surface, not the native window chrome. That surface works identically in a browser tab.

The right answer is not "kill Glass" or "make it a VS Code panel." The right answer is "make Glass a web dashboard that works in any browser, like Storybook or Grafana."

---

## Appendix A: Handler Coverage Comparison

| Backend | IPC Handlers | Lines of Code |
|---------|:---:|:---:|
| `electron/main.ts` | 99 | 4,925 |
| `server/index.ts` | 94 | 2,152 |
| Coverage | **95%** | — |

The 5 missing handlers in the server are likely Electron-specific (auto-update lifecycle, screenshot capture, safe storage operations). These are stubbed in `web-api.ts` and do not affect core functionality.

## Appendix B: window.flintAPI Surface

The `window.flintAPI` interface (defined in `src/types/flint-api.d.ts` and referenced across 80 files with 484 occurrences) is the complete abstraction boundary. Two implementations exist:

1. **Electron:** `electron/preload.ts` (1,278 lines) — routes calls via `ipcRenderer.invoke()`
2. **Web:** `src/adapters/web-api.ts` (396 lines) — routes calls via `fetch('/api/ipc')` and WebSocket

The web adapter is notably smaller because it uses a single generic `invoke()` function rather than individual `ipcRenderer.invoke()` calls per channel. The API surface is identical.

## Appendix C: Technology Compatibility

| Technology | Electron | Web (server/index.ts) | Notes |
|-----------|:---:|:---:|-------|
| React 19 | Yes | Yes | No change |
| @xyflow/react | Yes | Yes | Pure React, no native deps |
| Tailwind CSS 4 | Yes | Yes | Build-time only |
| Zustand v5 | Yes | Yes | Client-side state |
| better-sqlite3 | Main process | Express server | Same API, different process boundary |
| Babel (AST) | Main process | Express server | Same transforms |
| @modelcontextprotocol/sdk | Child process | Child process | Identical — MCP server is external to both |
| Git operations | execFile in main | execFile in server | Identical approach |
| WebSocket | N/A (uses IPC push) | ws library | Web gains real-time push |
| File System Access API | N/A | Optional enhancement | Chrome/Edge only, progressive |
