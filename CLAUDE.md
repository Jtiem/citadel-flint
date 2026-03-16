# Project: Bridge (v7.2)

## Identity

Bridge is the governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance deterministically at the AST level -- before code reaches production.

Two components:

| Component | What it is | Where it runs |
|-----------|-----------|---------------|
| **Bridge MCP** | Headless governance engine exposed via Model Context Protocol | Anywhere -- CI, IDE plugin, cloud |
| **Bridge Glass** | Visual observability layer (read-only) | Electron 35.7.5 desktop app |

Bridge MCP does all the work. Bridge Glass reads MCP Resources to display state and calls MCP Tools to trigger actions. Glass owns zero business logic. Chat lives in the host IDE (Claude Code, Cursor, VS Code). Bridge Glass is the observability layer, not a chat host.

## Tech Stack

* **Shell:** Electron 35.7.5 (Node.js 22)
* **Frontend:** React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7
* **Canvas Engine:** `@xyflow/react` (React Flow v12)
* **State Management:** Zustand v5
* **Persistence:** SQLite (`better-sqlite3`) + PowerSync SDK (Sync Layer)
* **Preview Engine:** Custom `srcdoc` iframe + Babel Renderer IPC (100% Offline)
* **AST Factory:** Babel (TSX parse/traverse/generate -- deterministic surgery)
* **Vector Store:** `sqlite-vec` (design system RAG for AI context injection)
* **MCP SDK:** `@modelcontextprotocol/sdk` v1.27+

## Architecture

### Glass Layout (3-Panel)

```
+----------------+----------------------------+---------------------+
|  Left Panel    |  Infinite Canvas            |  Right Sidebar       |
|  (Layers /     |  (XYCanvas + LivePreview    |  Tabs: Properties |  |
|   Assets)      |   as draggable node)        |  Tokens | Activity | |
|                |                             |  Health              |
|  AST tree      |  Ghost Code HUDs            |                      |
|  Asset grid    |  Drift Overlays             |  GovernanceOverlay   |
|                |  Spatial Repair triggers    |  (inline violations) |
+----------------+----------------------------+---------------------+
|  StatusBar (Export Gate + Save State + Sync + Figma Status)        |
+--------------------------------------------------------------------+
```

Glass does NOT contain: Monaco editor panel, terminal panel, file explorer panel. Those live in the host IDE.

### Process Boundary

```
electron/    <->  preload.ts  <->  src/
[Node.js]        [IPC Bridge]     [Sandboxed React]
  fs, sqlite                       no Node.js
  AI SDK                           window.bridgeAPI only
  MCP server
```

Any feature crossing this boundary needs an IPC channel via `contextBridge`.

### Context Bridge

`useContextSync` hook (mounted at App root) writes live Glass state to `.bridge/context.json` every 200ms (debounced). The MCP server reads this file via `bridge_get_context` / `bridge://context` to stay synchronized with the visual layer without direct IPC coupling.

## MCP Surface

### Tools (13 registered)

Primary tools (see `bridge-mcp/src/server.ts` for the full catalog):

| Tool | Purpose |
|------|---------|
| `bridge_status` | Server health check |
| `audit_ui_component` | Run Mithril + A11y audit on a component file |
| `hydrate_figma_data` | Convert Figma AST payload into React component snippets |
| `read_design_intent` | Read `.bridge/current-intent.json` and return typed Execution Plan |
| `bridge_ast_mutate` | Apply batched structural mutations (move, inject, fixToken, updateProp, updateClassName, updateTextContent, assembleLayout) |
| `bridge_query_registry` | Semantic + keyword search over component registry; returns Shadow Storybook artifact |
| `bridge_audit` | Full governance audit with SARIF output; optional `healOnAudit` for tier-1 auto-fix |
| `bridge_fix` | Deterministic auto-fix for token violations |
| `bridge_ingest_figma` | Figma ingestion pipeline |
| `bridge_sync_tokens` | Token synchronization |
| `bridge_debt_report` | Design debt health score (0-100), grade (A-F), trend tracking |

Additional tools registered via `bridge-mcp/src/tools/` modules cover governance events, mutation ledger, annotations, and CI/CD gate operations.

### Resources (6 registered)

| URI | What it exposes |
|-----|----------------|
| `bridge://tokens` | Current design tokens from `.bridge/design-tokens.json` |
| `bridge://manifest` | Project architecture manifest (`bridge-manifest.json`) |
| `bridge://rules` | All loaded governance rules, grouped by domain |
| `bridge://violations/{filePath}` | Live governance audit for a specific file |
| `bridge://capabilities` | Full MCP surface inventory (tools, resources, prompts) for agent self-discovery |
| `bridge://dashboard` | Design debt health score, grade, top violated files/rules, override telemetry |

### Prompts (3 registered)

| Prompt | Purpose |
|--------|---------|
| `bridge-intent-composer` | UX/UI Architecture Sentinel persona for design-to-code translation |
| `bridge-sentinel` | Domain-configurable governance engine persona |
| `bridge-workflow-guide` | Step-by-step workflow guidance for new MCP clients discovering Bridge |

## Module Status

### Governance Engine (Bridge MCP)

| Module | Phase | Status |
|--------|-------|--------|
| Mithril Enterprise Linter | B-v2 | **ONLINE** |
| Export Gate | B.2 | **ONLINE** |
| Export Gate Severity Escalation | B.1-d | **ONLINE** |
| Accessibility Gate (10 WCAG 2.1 AA rules) | B.3 | **ONLINE** |
| Sharma Validation (snippetAuditor) | B.1-b | **ONLINE** |
| AI Orchestrator Hardening | M | **ONLINE** |
| CI/CD Governance Gate (`bridge audit`) | EXP.1 | **ONLINE** |

### AST Surgery Engine

| Module | Phase | Status |
|--------|-------|--------|
| Batch Mutation Engine | E.1 | **ONLINE** |
| FileTransactionManager | E.2 | **ONLINE** |
| Cross-File Move | F.2 | **ONLINE** |
| Global Recovery Engine (Undo/Redo) | G.1 | **ONLINE** |
| Cross-File Redo | H | **ONLINE** |
| Code-First Recovery (Git Transplants) | D.1 | **ONLINE** |
| Git Time Machine UI | D.2 | **ONLINE** |
| Undo Void Fix | K | **ONLINE** |

### Glass Observability Layer

| Module | Phase | Status |
|--------|-------|--------|
| Infinite Canvas (XYCanvas) | A | **ONLINE** |
| LivePreview (srcdoc iframe) | A | **ONLINE** |
| ShieldOverlay (spatial governance badges) | A | **ONLINE** |
| GhostOverlay (hardcoded class HUD) | U.4 | **ONLINE** |
| GovernanceOverlay (violation list + auto-fix) | U | **ONLINE** |
| GovernancePanel (rule manager) | U | **ONLINE** |
| StatusBar (export gate + save state + sync) | A | **ONLINE** |
| NotificationCenter (toast system) | -- | **ONLINE** |
| ActivityFeed (MCP tool invocation log) | -- | **ONLINE** |
| OnboardingOverlay | -- | **ONLINE** |
| ExportModal (pre-flight audit) | B.2 | **ONLINE** |
| RecoveryPanel (Git Time Machine) | D.2 | **ONLINE** |
| Designer Experience (LayoutPanel) | N.1 | **ONLINE** |
| Asset Management Hub | Q | **ONLINE** |
| Interaction Modes (design/interact) | I | **ONLINE** |
| Native OS Menu | J | **ONLINE** |
| Context Bridge (useContextSync) | 1A | **ONLINE** |
| Auto-Save | F.1 | **ONLINE** |
| Activity Feed Upgrade (filter bar, search, error view) | V.2-af | **ONLINE** |
| Figma Connection Status (IPC, StatusBar popover, staleness) | W.2 | **ONLINE** |
| Ghost Canvas (severity heat tints, ViolationTooltip, viewport culling) | U.1 | **ONLINE** |
| Annotation Rendering (annotationStore, AnnotationList, LayerTree dots) | COLLAB.4 | **ONLINE** |
| Governance Dashboard (health score ring, grade, top-5 rules, "health" tab) | V.1-gd | **ONLINE** |
| MCP Push Channel (mcp-events.jsonl, useMCPEventListener, fs.watch tail) | W.1 | **ONLINE** |
| Bidirectional Action Bridge (mcpClient.ts, Glass-initiated MCP tool calls) | W.3 | **ONLINE** |

### Collaboration + Sync

| Module | Phase | Status |
|--------|-------|--------|
| Multiplayer Presence | C.1 | **ONLINE** |
| AST Conflict Arbiter | C.2 | **ONLINE** |
| Scaffolding & Registry | G.2 | **ONLINE** |

### Ingestion + Intelligence

| Module | Phase | Status |
|--------|-------|--------|
| Figma Ingestion | O | **ONLINE** |
| SDI Webhook | O.2 | **ONLINE** |
| MCP Intent Router | O.3 | **ONLINE** |
| SDI Layout Assembly | O.3a | **ONLINE** |
| Component Registry RAG | O.3b | **ONLINE** |
| LSP Orchestrator | P | **ONLINE** |
| Annotation Engine | COLLAB.1-3 | **ONLINE** |
| MCP Discoverability (capabilities resource, workflow prompt) | -- | **ONLINE** |
| Ingestion-Time Audit & Auto-Heal (IngestionAuditor, ImportSummary, heal IPC) | ING | **ONLINE** |

### Infrastructure + Governance Roadmap

| Module | Phase | Status |
|--------|-------|--------|
| Governance Events Table | INFRA.1 | **ONLINE** |
| Mutations Ledger Table | INFRA.2 | **ONLINE** |
| Design Debt Report (`bridge_debt_report`) | EXP.2 | **ONLINE** |
| Rule Provenance (`bridge_audit_report`) | GOV.1 | **ONLINE** |
| Override Telemetry (IPC + StatusBar badge) | GOV.2 | **ONLINE** |
| Accessibility Expansion (30 rules, auto-fix) | EXP.6a | **ONLINE** |
| Figma Plugin Settings UI (endpoint + secret + clientStorage) | FP.1 | **ONLINE** |
| Proactive Session Context (`bridge://session-context`) | ACX.1 | **ONLINE** |
| Event-Driven Context Push (ContextPushManager) | ACX.2 | **ONLINE** |
| Complexity Router (Commandment 8 model routing) | ACX.4 | **ONLINE** |
| Sentinel Prompt (6 domain presets) | ACX.1 | **ONLINE** |
| Tool Enrichment (pre-flight context injection) | ACX.3 | **ONLINE** |
| Mutation Provenance Ledger | V.2-mp | PLANNED (unblocked -- INFRA.2 ONLINE) |
| Risk Scoring (MRS) | V.1-rs | PLANNED (blocked on V.2-mp) |
| Renderer Hardening (iframe sandbox + CSP) | SEC.1 | PLANNED (P0, no deps) |
| Secret Hygiene (per-session secret, strip from renderer) | SEC.2 | PLANNED (P1, no deps) |
| MCP Tool Allowlist (renderer-callable tool restriction) | SEC.3 | PLANNED (P1, no deps) |
| API Key Safe Storage (safeStorage encryption) | SEC.4 | PLANNED (P1, no deps) |
| Terminal API Hardening (cwd restriction, input sanitization) | SEC.5 | PLANNED (P2, no deps) |
| Ingestion Rate Limiting | SEC.6 | PLANNED (P3, no deps) |

### Stores

| Store | Responsibility |
|-------|---------------|
| `editorStore` | Active-file AST, visual tree, linterWarnings, applyBatch, syncCode |
| `canvasStore` | Workspace tree, active file, saveState, canvasMode, mithrilViolations |
| `astBufferStore` | Headless multi-file AST buffers, crossFileMove |
| `tokenStore` | Design token CRUD |
| `historyStore` | Undo/redo stack management |
| `governanceStore` | Rule override deltas (enabled/disabled, severity) |
| `notificationStore` | Global toast/notification queue (max 5 concurrent) |
| `orchestratorStore` | AI orchestrator state, tool call approval |
| `assetStore` | Asset metadata, zombie audit state |
| `annotationStore` | Annotation CRUD, fs.watch push sync, rendering state |
| `importSummaryStore` | Ingestion heal summary, tier-2 snap resolution, undo-all-heals |

## The 16 Commandments

1. **Code is Truth** -- mutations must save to `.tsx` via AST. No ephemeral state.
2. **No Hallucinated Styling** -- every visual edit tied to a `design_token`.
3. **Composite IDs for Arrays** -- `Array.map` elements use injected composite IDs.
4. **Local-First Only** -- no external URLs in preview. 100% offline.
5. **Accessibility is a Compiler Error** -- a11y violations block export.
6. **The Gatekeeper Rule** -- exports blocked while overrides or drift remain.
7. **ID Preservation** -- `injectBridgeIds` after every structural op.
8. **Audit-First Execution** -- complexity routed to Flash vs. Thinking model.
9. **CIEDE2000 Delta-E Logic** -- perceptual color distance for drift detection.
10. **Targeted Micro-Recovery** -- undo pre-flight checks node existence before executing.
11. **Surgical Git Transplants** -- never `git checkout` a shared file; transplant specific nodes.
12. **Atomic Queuing** -- all file saves via `FileTransactionManager`. AI edits batched.
13. **Deterministic Surgery** -- Babel AST traversal only. Never regex on source code.
14. **Bypass Prohibition** -- never use `fs` or `git` directly; route through `FileTransactionManager` / `GitManager`.
15. **Granular AST Tools Only** -- AI Orchestrator emits only versioned catalog ops.
16. **In-Memory Validation** -- type-check AI output before surfacing confirmation UI.

## Testing Standard

Bridge is a governance product — it enforces quality on other people's code. Our own testing bar must be unimpeachable. Every agent and every implementation task follows this protocol.

### Required Test Coverage

| Domain | What must be tested | Test location |
|--------|-------------------|---------------|
| **MCP tools** | Happy path + missing params + malformed input | `bridge-mcp/src/**/__tests__/` |
| **MCP resources** | Returns correct shape + handles missing data | `bridge-mcp/src/**/__tests__/` |
| **SQLite services** | CRUD round-trip + each filter + aggregations + pruning + concurrent writes | `bridge-mcp/src/**/__tests__/` |
| **Linter rules** | Each rule triggers on known-bad input + passes on known-good input | `src/core/*.test.ts` |
| **Zustand stores** | State transitions + selectors + edge cases (empty state, overflow) | `src/store/__tests__/` |
| **React components** | Renders without crash + user interactions + conditional UI states | `src/components/**/__tests__/` |
| **IPC channels** | Request/response shape + error propagation | `electron/*.test.ts` |
| **Hooks** | Mount/unmount lifecycle + state updates + cleanup | `src/hooks/__tests__/` |

### Test Completion Checklist (Every Task)

Every implementation task — whether done by a human or an agent — must complete ALL of these before being marked ONLINE:

1. **Write tests** for all new code (unit tests minimum, integration where IPC/DB involved)
2. **Run the full suite** for the affected package:
   - `cd bridge-mcp && npm test` — MCP engine (must report exact count)
   - `npm run test:react` — Glass components (must report exact count)
   - `npm test` — Core/Electron tests (must report exact count)
3. **Run TSC** — `npx tsc --noEmit` must produce 0 errors
4. **Report results** in this exact format:
   ```
   MCP:   114/114 passing (3 new)
   Glass: 409/409 passing (0 new)
   TSC:   0 errors
   ```
5. **No regressions** — if any pre-existing test fails, fix it before proceeding
6. **Edge cases required** — every service must test: empty input, boundary values, error conditions, concurrent access (for DB services)

### Agent Testing Directive

When spawning agents for implementation work, the prompt MUST include:
- "Write tests for all new code"
- "Run the full test suite and report exact pass/fail counts"
- "Run `npx tsc --noEmit` and confirm 0 errors"
- "Report results in the format: `[Package]: X/Y passing (Z new)`"

If an agent completes work without reporting test results in this format, the work is considered **unverified** and must be re-tested before marking ONLINE.

## Commands

* `unset ELECTRON_RUN_AS_NODE && npm run dev` -- Launch Bridge Glass (Vite + Electron)
* `npm run test:react` -- Run React component tests (vitest.config.react.ts)
* `npm test` -- Run core tests (vitest.config.ts)
* `cd bridge-mcp && npm test` -- Run MCP engine tests
* `npx tsc --noEmit` -- Strict type check

## Session Start Protocol (Every Development Session)

Before writing any code, every agent MUST complete these steps in order:

1. **Declare territory** — Update `.bridge-context/ACTIVE-SWARM-TERRITORY.md` with the files and modules you intend to touch. If another agent has already claimed a file, stop and coordinate first.
2. **Update HANDOFF.md** — Add a session entry: phase/feature name, files in scope, and goal. This is how the next agent (or session) knows what was in progress.
3. **Read context** — Consult `HANDOFF.md`, `CLAUDE.md`, and `docs/BRIDGE-MASTER-PLAN.md` before reading the codebase.
4. **Begin work.**

After completing work:
- Update `HANDOFF.md` with what was done, what changed, and what remains.
- Clear your entries from `.bridge-context/ACTIVE-SWARM-TERRITORY.md`.

This protocol is mandatory for any session involving implementation, refactoring, or file changes. Read-only research sessions are exempt.

## Development Workflow

**Contract-First Feature Build** (`.claude/workflows/feature-build.md`) is the mandatory workflow for any feature touching 2+ files or crossing a process boundary.

```
SESSION START: Declare territory in ACTIVE-SWARM-TERRITORY.md + update HANDOFF.md
GIT:    bridge-git-guru → create feature branch
Phase 1: bridge-architect → Contract Artifact (.bridge-context/contracts/)
GIT:    bridge-git-guru → commit contract
Phase 2: Parallel specialist agents implement against contract
GIT:    bridge-git-guru → commit per agent + pre-commit gate (TSC + tests)
Phase 3: bridge-integration-validator → Integration Report (SHIP/FIX/REDESIGN)
GIT:    bridge-git-guru → create PR (on SHIP)
SESSION END: Update HANDOFF.md + clear territory claim
```

Single-file bug fixes and cosmetic changes are exempt from the Contract-First flow but NOT from the Session Start Protocol. All other work follows this flow. Contract artifacts are the binding specification — Phase 2 agents implement exactly what the contract defines. If the contract is wrong, return to Phase 1.

**Git ceremonies** are handled by `bridge-git-guru` at every phase boundary. It manages branch naming (`feat/<phase>-<desc>`), conventional commit messages, pre-commit validation, and PR creation. Never commit without running the pre-commit gate (TSC + relevant test suites).

## Critical AI Directives

1. **Session Start Protocol:** Before any implementation work, declare territory in `.bridge-context/ACTIVE-SWARM-TERRITORY.md` and update `HANDOFF.md`. See the Session Start Protocol section above. Always consult `HANDOFF.md`, `CLAUDE.md`, and `docs/BRIDGE-MASTER-PLAN.md` before reading the codebase.
2. **Glass is Observability Only:** Chat lives in the host IDE. Bridge Glass is the visual observability layer, not a code editor, terminal, file browser, or chat host. Do not add IDE-native panels to Glass.
3. **Mithril Safety:** If Delta-E > 2.0, code must be auto-fixed or Amber-flagged.
4. **Persistence Rule:** All mutations MUST be atomic and saved via the `FileTransactionManager` queue.
5. **No Hallucinations:** Use Babel AST traversal for all code changes. Never use Regex for source code.
6. **Granular AST Tools Only (Commandment 15):** The AI Orchestrator MUST only emit ops from the versioned AST Tool Catalog. Raw code string generation is prohibited.
7. **In-Memory Validation Loop (Commandment 16):** `orchestrator.ts` MUST run an in-memory TSC type-check on all AI output before surfacing a confirmation UI.
8. **Context Bridge Awareness:** Glass writes live state to `.bridge/context.json` via `useContextSync`. The MCP server reads `bridge_get_context` / `bridge://context` to stay synchronized. Any new Glass state that should be visible to MCP must be added to the `BridgeContext` type.
9. **Process Boundary Law:** No `fs`, `sqlite`, or Node.js APIs in `src/`. All cross-boundary calls go through `window.bridgeAPI` (defined in `preload.ts`).

## Key Files

### Bridge MCP Engine
| File | Role |
|------|------|
| `bridge-mcp/src/server.ts` | MCP tool and resource registrations |
| `bridge-mcp/src/core/ast-modifier.ts` | `assembleLayout`, mutation ops |
| `bridge-mcp/src/core/registryService.ts` | `bridge_query_registry` search |
| `bridge-mcp/src/core/MithrilLinter.ts` | CIEDE2000 + typography/spacing/shadow/opacity |
| `bridge-mcp/src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules |
| `bridge-mcp/src/tools/` | audit, fix, ingest, sync tool handlers |
| `bridge-mcp/src/prompts/sentinel.ts` | Domain-configurable governance persona |

### Electron Main Process
| File | Role |
|------|------|
| `electron/main.ts` | IPC handlers: saveFile, readFile, ast:git-show, ast:git-log, syncContext |
| `electron/orchestrator.ts` | Constrained AI orchestration with TSC validation loop |
| `electron/FileTransactionManager.ts` | Atomic `.tmp` -> `rename` write queue |
| `electron/GitManager.ts` | ensureRepo, shadowCommit, getGitNode |
| `electron/ingestion-server.ts` | Figma ingestion + SDI webhook (port 4545) + heal pass |
| `electron/ingestion/IngestionAuditor.ts` | CIEDE2000 tier classification + Babel AST auto-heal (Phase ING) |
| `electron/normalizer.ts` | Figma Variables → W3C DTCG token normalization |
| `electron/store.ts` | SQLite database (`bridge.db`) |
| `electron/preload.ts` | IPC bridge -- defines `window.bridgeAPI` surface |

### Glass UI
| File | Role |
|------|------|
| `src/App.tsx` | Application shell -- 3-panel layout, keyboard shortcuts, menu events |
| `src/components/editor/XYCanvas.tsx` | Infinite canvas (`@xyflow/react` v12) |
| `src/components/editor/LivePreview.tsx` | `srcdoc` iframe preview engine |
| `src/components/editor/StatusBar.tsx` | Export gate + engine indicators |
| `src/components/editor/GovernanceOverlay.tsx` | Inline violation list with auto-fix |
| `src/components/editor/GhostOverlay.tsx` | Hardcoded class detection HUD |
| `src/components/editor/ShieldOverlay.tsx` | Spatial governance badges + presence cursors |
| `src/components/ui/NotificationCenter.tsx` | Global toast renderer |
| `src/components/ui/ActivityFeed.tsx` | MCP tool invocation log |
| `src/components/ui/GovernancePanel.tsx` | Rule enable/disable/severity manager |
| `src/components/ui/ExportModal.tsx` | Export Gate pre-flight audit |
| `src/components/ui/RecoveryPanel.tsx` | Git Time Machine UI |
| `src/components/inspector/LayoutPanel.tsx` | Figma-grade Auto Layout controls |
| `src/components/ui/GovernanceDashboard.tsx` | Health score ring, grade letter, top-5 rules ("health" tab) |
| `src/components/ui/AnnotationList.tsx` | Annotation rendering in right sidebar |
| `src/components/editor/ViolationTooltip.tsx` | Ghost Canvas severity tooltip on hover |
| `src/components/ui/ImportSummary.tsx` | Ingestion heal summary toast + review panel (Phase ING) |
| `src/store/importSummaryStore.ts` | Ingestion summary state, tier-2 snap, undo-all-heals |
| `src/store/annotationStore.ts` | Annotation CRUD + fs.watch push sync |
| `src/hooks/useContextSync.ts` | Writes live state to `.bridge/context.json` |

### Core Services
| File | Role |
|------|------|
| `src/core/ASTService.ts` | applyMutationBatch, applyInversions, synthesizeImports |
| `src/core/recoveryController.ts` | Undo/redo orchestration (single-file + cross-file) |
| `src/utils/layoutMapper.ts` | Atomic Tailwind layout class management |

## Architectural Anti-Patterns (Reject These)

- Importing a Zustand store inside another store (cross-store contamination)
- Calling `window.bridgeAPI` inside a Zustand store action (IPC belongs in components/hooks/services)
- Writing to disk with `fs.writeFile` instead of routing through `FileTransactionManager`
- Adding `import { readFileSync } from 'fs'` anywhere in `src/` (process boundary violation)
- Using `ipcRenderer.send` directly in React (must go through `contextBridge` surface)
- Regex-based source code modification (always Babel AST traversal)
- Adding IDE panels (editor, terminal, file explorer, chat) to Bridge Glass
