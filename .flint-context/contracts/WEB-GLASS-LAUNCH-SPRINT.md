# Web Glass Launch Sprint -- Sprint Plan

**Date:** 2026-03-27
**Status:** PLAN COMPLETE -- Awaiting approval to begin Phase 2 implementation
**Goal:** `npx flint-glass --project ./my-app` opens a browser tab with the governance dashboard and a demo project auto-loaded. Time to first value: 30 seconds.

---

## 1. Architecture Baseline

The web mode is substantially built. The following assets exist and are functional today:

| Asset | Lines | Status |
|-------|:-----:|--------|
| `server/index.ts` | 2,152 | 94/99 IPC handlers |
| `server/cli.ts` | 179 | `--project`, `--port`, `--open` flags |
| `server/mcpClient.ts` | -- | MCP child process client |
| `server/services/previewServer.ts` | -- | Vite-based component preview |
| `server/services/thumbnailService.ts` | -- | Puppeteer-based thumbnails |
| `src/adapters/web-api.ts` | 396 | Complete `window.flintAPI` over HTTP/WS |
| `vite.config.web.ts` | 78 | SPA build, no Electron plugins |
| `src/main.tsx` | 18 | Auto-detects web mode, loads adapter |
| `build-resources/demo-project/` | -- | DemoCard.tsx + design-tokens.json |
| `npm run dev:web` | -- | Working dev command |
| `npm run build:web` | -- | Production build to `dist-web/` |

The React app is already delivery-model agnostic. `window.flintAPI` is the interface; the backend swaps transparently. No React code needs to know whether it is running in Electron or a browser.

---

## 2. Workstream Dependency Graph

```
WS2 (MCP Greeter)  ──────────────┐
                                  │
WS1 (Demo-First Onboarding) ─────┤──→ WS4 (Distribution + Polish)
                                  │
WS3 (Web Feature Completion) ────┘
```

**WS1, WS2, and WS3 are independent.** They touch different files and can execute in parallel. WS4 depends on all three completing because it integrates the final product, wires up the npm bin entry, and validates the end-to-end `npx` experience.

---

## 3. Workstream Detail

### WS1: Demo-First Onboarding (Size: M)

**Objective:** When `isFirstLaunch: true`, auto-load the demo project into the canvas. Skip SetupWizard. Defer MCP/IDE configuration to a non-blocking prompt after the first auto-fix. Works identically in Electron and web mode.

**Current routing chain in `src/App.tsx` (lines 595-699):**
1. `setup:check-first-launch` -- if first launch, render `<SetupWizard>` (blocking)
2. Beta welcome gate -- if beta + not shown, render `<BetaWelcome>` (blocking)
3. Auto-resume -- if prior session exists, load it silently
4. If no workspace, render `<LaunchScreen>` (blocking)

**Target routing chain:**
1. `setup:check-first-launch` -- if first launch, auto-load demo project (non-blocking)
2. Beta welcome gate -- unchanged (already defaults to done=true for non-beta)
3. Auto-resume -- unchanged
4. If no workspace AND not first launch, render `<LaunchScreen>`

**Contract-First required?** No. This is a single-file routing change in `App.tsx` with one new helper in `LaunchScreen.tsx`. The IPC surface (`beta:load-demo-project`) already exists in both backends. No new process boundary crossings.

#### Impact Map

| File | Change | Owner |
|------|--------|-------|
| `src/App.tsx` | Rewire first-launch gate: call `beta:load-demo-project` instead of rendering `<SetupWizard>`. Add deferred setup prompt after first auto-fix. | `flint-design-engineer` |
| `src/components/ui/LaunchScreen.tsx` | Add "Connect to IDE" persistent affordance (small CTA or StatusBar item) for deferred setup. | `flint-design-engineer` |
| `src/components/ui/SetupWizard.tsx` | No deletion. Remains accessible from command palette and "Connect to IDE" prompt. | (no change) |
| `src/components/editor/StatusBar.tsx` | Add "Connect to IDE" indicator when `setupComplete: false` and workspace is loaded. | `flint-design-engineer` |

#### Commandments Affected
- **C1 (Code is Truth):** Demo project uses the real DemoCard.tsx file. No ephemeral state.
- **C4 (Local-First):** Demo project scaffolded to `/tmp/`. No external URLs.
- **C7 (ID Preservation):** DemoCard.tsx already has `data-flint-id` attributes.

#### Acceptance Criteria
1. Cold launch (first-launch flag true) reaches canvas with violations visible in under 10 seconds.
2. "Open Your Own Project" escape hatch visible at all times during demo.
3. SetupWizard reachable via Command Palette and deferred prompt.
4. Electron mode unchanged -- same auto-load behavior applies.

---

### WS2: MCP Greeter Optimization (Size: S)

**Objective:** Rewrite `buildGreeting()` to be trigger-word driven with top-5 entry points, capped at 2KB. Clean up tool descriptions. Add 3 workflow prompts.

**Current state:** `buildGreeting()` at `flint-mcp/src/server.ts:392-421` is 30 lines. Returns a greeting that distinguishes new vs. returning users via `context.json` presence. Tool count hardcoded as 45 (actual is 51). The greeting for new users is generic ("Say 'what can Flint do?'").

**Contract-First required?** No. Entirely within `flint-mcp/`. No process boundary crossings. No store changes. Pure MCP server work.

#### Impact Map

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/server.ts` (buildGreeting) | Rewrite: trigger words, top-5 entry points, 2KB cap, dynamic tool count | `flint-ast-surgeon` |
| `flint-mcp/src/server.ts` (tool descriptions) | Clean up ~51 tool `description` fields: remove phase codes (V.2-mp, GOV.2, etc.), front-load purpose, keep under 120 chars | `flint-ast-surgeon` |
| `flint-mcp/src/prompts/quick-audit.ts` | NEW: `flint-quick-audit` prompt -- single-file audit workflow | `flint-ast-surgeon` |
| `flint-mcp/src/prompts/fix-all.ts` | NEW: `flint-fix-all` prompt -- batch fix workflow | `flint-ast-surgeon` |
| `flint-mcp/src/prompts/onboard-project.ts` | NEW: `flint-onboard-project` prompt -- first-time project setup workflow | `flint-ast-surgeon` |
| `flint-mcp/src/server.ts` (prompt registration) | Register 3 new prompts in ListPrompts and GetPrompt handlers (lines 1442-1519) | `flint-ast-surgeon` |

#### New Greeting Structure (Spec)

```
[For returning users — context.json exists with healthGrade]
  "Flint is connected. Grade: {grade}. {topViolation summary}.
   Say 'audit' to scan, 'fix' to auto-remediate, or 'debt report' for trends."

[For new users — no context.json]
  "Flint is connected. {N} governance tools ready.

   Quick start:
   - 'audit my component' -- scan a file for violations
   - 'fix it' -- auto-remediate detected violations
   - 'check accessibility' -- WCAG 2.1 AA compliance
   - 'show health' -- design debt score and grade
   - 'what can you do?' -- full capability tour

   Read flint://capabilities for the complete catalog."
```

Must stay under 2KB. Must not include phase codes, internal identifiers, or developer jargon.

#### Commandments Affected
- **C8 (Audit-First Execution):** Greeter routes users toward audit-first workflows.

#### Acceptance Criteria
1. `buildGreeting()` output is under 2KB for both new and returning users.
2. No phase codes (V.2-mp, GOV.4, etc.) appear in any tool description visible to end users.
3. 3 new prompts registered and functional via `GetPromptRequestSchema`.
4. Existing tests still pass; new tests for greeting variants.

---

### WS3: Web Feature Completion (Size: M)

**Objective:** Close the 5 remaining feature gaps identified in the migration research so the web mode is functionally complete.

**Contract-First required?** Yes -- for Gap 1 (Project Picker) which introduces a new UI component. Gaps 2-5 are wiring changes within existing code.

#### Gap 1: Project Picker (Web Alternative to Native File Dialog)

In Electron, `dialog:openFolder` shows a native OS dialog. In web mode, it returns `null`. Users currently must use `--project` CLI flag. This gap blocks the LaunchScreen's "Open Folder" button.

**Solution:** Add a "Project Path" input with recent-projects dropdown in `LaunchScreen.tsx`. When running in web mode (`__FLINT_WEB__` is true), the "Open Folder" tile shows a path text input instead of triggering the native dialog. The recent projects list (already wired via `registry:getRecent`) provides one-click project switching.

| File | Change | Owner |
|------|--------|-------|
| `src/components/ui/LaunchScreen.tsx` | Add path input component with validation. Show when `__FLINT_WEB__` is true and user clicks "Open Folder". Call `project:openPath` on submit. | `flint-design-engineer` |
| `src/adapters/web-api.ts` | Update `openFolder` to show the path input UI (or return a signal that triggers it). Currently returns `null`. | `flint-design-engineer` |

#### Gap 2: Component Health Enrichment

The `components:health` handler in `server/index.ts` is missing or returns null. The Electron version calls MCP `audit_ui_component` to get per-component health grades.

| File | Change | Owner |
|------|--------|-------|
| `server/index.ts` | Wire `components:health` handler to call MCP `audit_ui_component` via the existing `mcpClient`. | `flint-electron-ipc` |

#### Gap 3: Project Reindex

The `project:reindex` handler in `server/index.ts` returns `{ components: 0, ragChunks: 0 }`. Needs to call manifest regeneration + RAG seeding.

| File | Change | Owner |
|------|--------|-------|
| `server/index.ts` | Wire `project:reindex` to run manifest scan + `ai:seed-rag` equivalent logic server-side. | `flint-electron-ipc` |

#### Gap 4: Thumbnails

`server/services/thumbnailService.ts` exists with a Puppeteer-based implementation. Needs verification and graceful fallback when Puppeteer is not installed.

| File | Change | Owner |
|------|--------|-------|
| `server/services/thumbnailService.ts` | Verify end-to-end. Add try/catch with graceful degradation when Puppeteer is not available. | `flint-electron-ipc` |
| `src/adapters/web-api.ts` | Update thumbnails stub to call server instead of returning hardcoded empty. | `flint-design-engineer` |

#### Gap 5: MCP Event Push

`useMCPEventListener` in Electron uses `window.flintAPI.mcp.onEvent()` which maps to an IPC push channel. In web mode this should use the WebSocket transport. The `web-api.ts` already has `subscribe('flint:mcp-event', ...)` wired. Needs verification that the server broadcasts MCP events over WebSocket.

| File | Change | Owner |
|------|--------|-------|
| `server/index.ts` | Verify mcp-events.jsonl tailing broadcasts over WebSocket. Add if missing. | `flint-electron-ipc` |

#### Commandments Affected
- **C4 (Local-First):** All operations remain localhost. No external URLs.
- **C12 (Atomic Queuing):** Server-side file writes already use `atomicWrite()` (line 142 of server/index.ts). Compliant.
- **C14 (Bypass Prohibition):** Server uses its own `atomicWrite` which mirrors `FileTransactionManager`. The web server is the equivalent of the main process -- it IS the authorized file I/O boundary.

#### Acceptance Criteria
1. LaunchScreen path input works in web mode: type a path, press Enter, project loads.
2. Component health grades appear on Build mode cards in web mode.
3. `project:reindex` returns non-zero component and RAG chunk counts.
4. Thumbnails load or gracefully show placeholder when Puppeteer is unavailable.
5. MCP tool invocations appear in the Activity Feed in web mode.

---

### WS4: Distribution + Polish (Size: S-M)

**Objective:** Make `npx flint-glass --project ./my-app` work out of the box. Browser opens automatically. CI builds the web artifact.

**Contract-First required?** No. Infrastructure work, no process boundaries or store changes.

#### Impact Map

| File | Change | Owner |
|------|--------|-------|
| `package.json` | Add `"bin": { "flint-glass": "./server/cli.ts" }`. Verify `"files"` array includes `server/`, `dist-web/`, `build-resources/`. | `flint-electron-ipc` |
| `server/cli.ts` | Add hashbang `#!/usr/bin/env npx tsx`. Default `--open` to true. Add `--demo` flag that auto-loads demo project (equivalent to first-launch behavior). Add version flag. | `flint-electron-ipc` |
| `server/index.ts` | Ensure `dist-web/` static serving works when invoked via `npx` (resolve path relative to package root, not cwd). | `flint-electron-ipc` |
| `.github/workflows/pr-validate.yml` | Add `build:web` step to CI. | `flint-electron-ipc` |
| `.github/workflows/build-release.yml` | Add web artifact to release build. | `flint-electron-ipc` |
| `docs/START-HERE.md` | NEW: Concise getting-started for web mode (3 steps). | `flint-design-engineer` |

#### npx Execution Model

When a user runs `npx flint-glass --project ./my-app`:

1. npm downloads the `flint-glass` package (includes `server/`, `dist-web/`, `build-resources/`, `flint-mcp/`)
2. `server/cli.ts` starts the Express server on port 4201
3. Express serves `dist-web/` as static files (SPA with fallback)
4. Browser opens `http://localhost:4201`
5. React app boots, detects web mode (no `window.flintAPI`), loads `web-api.ts` adapter
6. If `--demo` flag or first launch: auto-scaffolds demo project
7. User sees the governance dashboard with violations within 30 seconds

**Critical path verification:** The `dist-web/` directory must be pre-built and included in the npm package. This means `npm run build:web` must run as a prepublish step, or the CI must include the built artifact.

#### Commandments Affected
- **C4 (Local-First):** Everything runs on localhost. No external service dependencies.

#### Acceptance Criteria
1. `npx flint-glass --project ./some-react-app` opens a browser with the governance dashboard.
2. `npx flint-glass --demo` opens with the demo project auto-loaded.
3. CI builds `dist-web/` artifact without errors.
4. The web artifact does not include Electron dependencies.

---

## 4. Consolidated Impact Map (All Workstreams)

| File | WS | Change Type | Owner Agent |
|------|----|-------------|-------------|
| `src/App.tsx` | 1 | Modify: rewire first-launch routing | `flint-design-engineer` |
| `src/components/ui/LaunchScreen.tsx` | 1,3 | Modify: deferred setup CTA + path input | `flint-design-engineer` |
| `src/components/editor/StatusBar.tsx` | 1 | Modify: "Connect to IDE" indicator | `flint-design-engineer` |
| `src/adapters/web-api.ts` | 3 | Modify: thumbnails wiring, openFolder signal | `flint-design-engineer` |
| `flint-mcp/src/server.ts` | 2 | Modify: buildGreeting + tool descriptions + prompt registration | `flint-ast-surgeon` |
| `flint-mcp/src/prompts/quick-audit.ts` | 2 | New file | `flint-ast-surgeon` |
| `flint-mcp/src/prompts/fix-all.ts` | 2 | New file | `flint-ast-surgeon` |
| `flint-mcp/src/prompts/onboard-project.ts` | 2 | New file | `flint-ast-surgeon` |
| `server/index.ts` | 3 | Modify: wire health, reindex, verify MCP events | `flint-electron-ipc` |
| `server/services/thumbnailService.ts` | 3 | Modify: graceful Puppeteer fallback | `flint-electron-ipc` |
| `server/cli.ts` | 4 | Modify: --demo flag, --open default, hashbang | `flint-electron-ipc` |
| `package.json` | 4 | Modify: bin entry, files array | `flint-electron-ipc` |
| `.github/workflows/pr-validate.yml` | 4 | Modify: add build:web step | `flint-electron-ipc` |
| `.github/workflows/build-release.yml` | 4 | Modify: add web artifact | `flint-electron-ipc` |
| `docs/START-HERE.md` | 4 | New file | `flint-design-engineer` |

---

## 5. Implementation Order

### Phase 2a (Parallel -- all three workstreams start simultaneously)

| Group | Workstream | Agent | Estimated Size |
|:-----:|-----------|-------|:--------------:|
| A | WS1: Demo-First Onboarding | `flint-design-engineer` | M |
| B | WS2: MCP Greeter Optimization | `flint-ast-surgeon` | S |
| C | WS3: Web Feature Completion | `flint-electron-ipc` + `flint-design-engineer` | M |

**Group A** touches `src/App.tsx`, `LaunchScreen.tsx`, `StatusBar.tsx`.
**Group B** touches `flint-mcp/src/server.ts` and `flint-mcp/src/prompts/`.
**Group C** touches `server/index.ts`, `server/services/`, `web-api.ts`.

No file conflicts between groups. Full parallel execution is safe.

Within Group C, the `flint-electron-ipc` agent handles server-side changes (Gaps 2-5), and `flint-design-engineer` handles the client-side path input (Gap 1). These can also run in parallel since they touch different files.

### Phase 2b (Sequential -- after Phase 2a completes)

| Step | Workstream | Agent | Estimated Size |
|:----:|-----------|-------|:--------------:|
| 1 | WS4: Distribution + Polish | `flint-electron-ipc` | S-M |
| 2 | Integration validation | `flint-integration-validator` | -- |

WS4 must wait because it integrates the outputs of WS1-3 and validates the end-to-end `npx` experience.

### Phase 3: Validation

The `flint-integration-validator` runs the full checklist:
1. TSC passes (`npx tsc --noEmit`)
2. MCP tests pass (`cd flint-mcp && npm test`)
3. React tests pass (`npm run test:react`)
4. Core tests pass (`npm test`)
5. `npm run build:web` succeeds
6. `npx tsx server/cli.ts --project ./build-resources/demo-project --open` loads in browser
7. Demo project auto-loads on first launch
8. Violations appear in governance panel
9. Auto-fix resolves at least one violation
10. "Open Your Own Project" path works from within the demo

---

## 6. Commandment Compliance Matrix

| # | Commandment | Applies? | How Satisfied |
|:-:|-------------|:--------:|---------------|
| 1 | Code is Truth | Yes | Demo uses real DemoCard.tsx. All mutations save via AST. |
| 2 | No Hallucinated Styling | Yes | Demo violations are real CIEDE2000 drift, not synthetic. |
| 4 | Local-First Only | Yes | Everything runs on localhost. No external URLs. |
| 5 | A11y is Compiler Error | Yes | Demo shows A11y violations; export gate still enforced. |
| 7 | ID Preservation | Yes | DemoCard.tsx already has `data-flint-id` attributes. |
| 8 | Audit-First Execution | Yes | Greeter routes to audit-first workflows. |
| 9 | CIEDE2000 | Yes | Demo includes #0055EE vs #0066FF drift for demonstration. |
| 12 | Atomic Queuing | Yes | Server uses `atomicWrite()` for all file ops. |
| 13 | Deterministic Surgery | N/A | No code modification in this sprint. |
| 14 | Bypass Prohibition | Yes | Server is the authorized I/O boundary (equivalent to Electron main process). |
| 16 | In-Memory TSC | N/A | No AI code generation in this sprint. |

---

## 7. Launch Gate

The sprint is SHIPPED when all of the following pass:

### Functional Gate
- [ ] `npx tsx server/cli.ts --project <path> --open` starts server and opens browser
- [ ] First-launch auto-loads demo project (canvas shows DemoCard with violations)
- [ ] Violations visible in GovernanceOverlay within 10 seconds of launch
- [ ] Auto-fix resolves at least one violation
- [ ] "Open Your Own Project" opens a real project from within the demo session
- [ ] Recent projects list works in web mode
- [ ] `buildGreeting()` output is under 2KB for both user types
- [ ] 3 new workflow prompts registered and return correct content
- [ ] No tool description contains internal phase codes
- [ ] Component health grades appear on cards in web mode (or graceful fallback)
- [ ] MCP events appear in Activity Feed in web mode

### Quality Gate
- [ ] `npx tsc --noEmit` -- 0 errors
- [ ] `cd flint-mcp && npm test` -- all passing
- [ ] `npm run test:react` -- all passing
- [ ] `npm test` -- all passing
- [ ] `npm run build:web` -- completes without errors

### Regression Gate
- [ ] Electron mode (`npm run dev`) still works
- [ ] SetupWizard still accessible via Command Palette
- [ ] Existing onboarding (non-first-launch) unchanged
- [ ] Auto-resume for returning users unchanged

---

## 8. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Backend divergence** -- new handler in `server/index.ts` without Electron equivalent | HIGH | WS3 only wires existing IPC channels. No new channels introduced. Track in parity audit. |
| **Demo scaffold race condition** -- demo project not ready when canvas tries to load | MEDIUM | Use the existing `setIsLoadingProject` overlay. Await `beta:load-demo-project` before calling `hydrateWorkspace`. |
| **npx binary resolution** -- `server/cli.ts` is TypeScript, not compiled JS | HIGH | Two options: (a) add a `postinstall` or `prepublish` that compiles `server/` to JS, or (b) use `npx tsx` as the hashbang interpreter. Option (b) adds a `tsx` dependency for npx users. Decision needed before WS4 implementation. **Recommendation:** compile `server/` to `dist-server/` as part of `build:web` and point `bin` at the compiled JS. |
| **Puppeteer optional dependency** -- not all users will have Chrome/Chromium | LOW | Thumbnails already gracefully degrade. Verify the fallback path shows a placeholder, not an error. |
| **2KB greeting cap** -- returning-user greeting with rich context may exceed 2KB | LOW | The returning-user greeting is 1-2 sentences. Only the new-user greeting has the 5-entry-point block. Both will comfortably fit under 2KB. |
| **Web build size** -- dist-web may include Electron-only code paths | MEDIUM | `vite.config.web.ts` already externals Electron and better-sqlite3. Verify tree-shaking removes dead branches behind `__FLINT_WEB__` checks. |
| **First-launch detection in web mode** -- `setup:check-first-launch` reads `~/.flint/setup.json` | LOW | The server handler (line 1266) already implements this. Works the same as Electron. |

---

## 9. Scope Estimate Summary

| Workstream | Size | Parallel Group | Agent(s) |
|-----------|:----:|:--------------:|----------|
| WS1: Demo-First Onboarding | M | A | `flint-design-engineer` |
| WS2: MCP Greeter Optimization | S | B | `flint-ast-surgeon` |
| WS3: Web Feature Completion | M | C | `flint-electron-ipc` + `flint-design-engineer` |
| WS4: Distribution + Polish | S-M | Sequential (after A,B,C) | `flint-electron-ipc` |
| **Total** | **M-L** | | |

With full parallelism on Phase 2a, the critical path is the longest of WS1/WS2/WS3 (both M-sized) plus WS4 (S-M). Estimated calendar time: 3-5 days of focused implementation.

---

## 10. What This Sprint Does NOT Include

These are explicitly deferred to keep the launch sprint focused:

1. **Backend consolidation** (Phase 2 in migration research) -- extracting shared handlers into `shared/handlers/`. Important but not required for launch.
2. **Electron convergence** (Phase 4 in migration research) -- making Electron a thin shell around the Express server. Long-term architecture goal, not sprint scope.
3. **Service worker / offline caching** -- Glass requires the server running anyway.
4. **Authentication / multi-user** -- localhost-only for v1.
5. **npm publish** -- the sprint makes the package publishable, but actual npm publish is a separate operation requiring version bump, registry auth, and release notes.
6. **Guided tutorial overlay on demo violations** -- the demo auto-load is the critical change. Progressive violation discovery (Recommendation 4 from the research) is a follow-up enhancement.
