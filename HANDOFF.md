# Bridge — Developer Handoff

**Date:** 2026-03-16
**Architecture:** Bridge MCP (headless governance engine) + Bridge Glass (Electron observability layer)
**Test baseline:** 452/452 Glass tests (29 files) + 330/330 Core tests (13 files) + 903/903 MCP tests (36 files) = 1,685 total -- TSC 0 errors
*(Note: `bridge-mcp/src/tests/project-scaffold.test.ts` has a pre-existing env failure — missing template dir at `/Users/tiemann/electron/templates/`. Not caused by ING work.)*

---

## 1. What Is Bridge

Bridge is a governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance deterministically at the AST level — before code reaches production.

**Two components:**

| Component | What it is | Where it runs |
|-----------|------------|---------------|
| **Bridge MCP** | Headless governance engine — 13 tools, 6 resources, 3 prompts | Anywhere: CI, Claude Code, Cursor, VS Code |
| **Bridge Glass** | Visual observability layer — reads MCP state, calls MCP tools | Electron 35.7.5 desktop app |

Bridge Glass owns zero business logic. All enforcement, mutation, and linting lives in the MCP engine.

---

## 2. How to Run

### First-time setup

```bash
npm install
```

> Note: `bridge-mcp/` is the headless server package. Install its deps separately if working on MCP tools directly:
> ```bash
> cd bridge-mcp && npm install
> ```

### Launch Bridge Glass (Electron + Vite)

```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

`ELECTRON_RUN_AS_NODE` must be unset — if it is set (which happens when Claude Code spawns the shell), Electron boots in a headless Node mode and the window never appears.

### Run tests

```bash
# MCP engine tests (515 tests across 23 files)
cd bridge-mcp && npm test

# Glass component tests (386 tests across 25 files)
npm run test:react

# Core + Electron tests (295 tests across 11 files)
npm test

# TypeScript strict check (both packages)
npx tsc --noEmit
```

---

## 3. Architecture

### 3.1 Glass Layout

Glass is a 3-panel Electron app. There is no Monaco editor pane, no terminal pane, no file explorer pane — those live in the host IDE (Claude Code / Cursor / VS Code).

```
┌─────────────────┬──────────────────────────┬─────────────────────┐
│  Left Panel     │  Infinite Canvas         │  Right Sidebar       │
│  (Layers /      │  (XYCanvas.tsx +         │  Tabs: Properties |  │
│   Assets)       │   LivePreview node)      │  Tokens | Activity | │
│                 │                          │  Health              │
│  AST tree       │  Ghost Code HUDs         │                      │
│  Asset grid     │  Drift Overlays          │  Governance HUDs     │
└─────────────────┴──────────────────────────┴─────────────────────┘
```

### 3.2 Process Model

```
Main Process (Node.js / Electron)
  FileTransactionManager  — atomic .tmp → rename write queue
  SQLite WAL              — bridge.db (project) + bridge-registry.db (global)
  GitManager              — shadow commits on every save
  orchestrator.ts         — Claude AI + constrained AST Tool Catalog + TSC loop
  ingestion-server.ts     — Figma plugin bridge (port 4545)
  LSP clients             — TypeScript + Vue language servers

Renderer Process (React 19 / Vite)
  XYCanvas.tsx            — infinite canvas (@xyflow/react v12)
  LivePreview.tsx         — srcdoc iframe, 100% offline
  ExportModal.tsx         — pre-flight Mithril + a11y audit gate

Preload (contextBridge)
  window.bridgeAPI        — typed IPC surface between renderer and main
```

### 3.3 MCP-First Design

Claude Code and other MCP clients connect to Bridge MCP directly. Glass reads the same MCP Resources to display state — it is a consumer of the engine, not a wrapper around it.

MCP connection config (add to `~/.claude/mcp.json`):
```json
{
  "mcpServers": {
    "bridge": {
      "command": "node",
      "args": ["/path/to/bridge-mcp/dist/server.js"]
    }
  }
}
```

---

## 4. File Map

### `src/` — Glass React renderer

| Path | Role |
|------|------|
| `src/App.tsx` | Root layout, keyboard bindings (Cmd+Z / Cmd+Shift+Z), IPC wiring |
| `src/components/editor/XYCanvas.tsx` | Infinite canvas — LivePreview as draggable custom node |
| `src/components/editor/LivePreview.tsx` | `srcdoc` iframe + Shield overlay + design/interact mode toggle |
| `src/components/inspector/LayoutPanel.tsx` | Figma-grade Auto Layout panel |
| `src/components/ui/ExportModal.tsx` | Export Gate — Mithril severity escalation + a11y pre-flight |
| `src/components/ui/RecoveryPanel.tsx` | Git Time Machine UI — per-node surgical revert |
| `src/components/editor/AssetsPanel.tsx` | Asset Management Hub (SQLite-backed, zombie auditor) |
| `src/store/editorStore.ts` | Active-file AST, Visual Tree, `applyBatch`, `syncCode` |
| `src/store/canvasStore.ts` | Workspace tree, active file, `saveState` lifecycle |
| `src/store/astBufferStore.ts` | Headless multi-file AST buffers, `crossFileMove` (11-step atomic) |
| `src/store/historyStore.ts` | `past`/`future` stacks with `CrossFileMoveRedoPlan` |
| `src/store/annotationStore.ts` | Annotation CRUD + `fs.watch` push sync from MCP writes |
| `src/components/ui/GovernanceDashboard.tsx` | Health score ring, grade letter, top-5 rules ("health" tab) |
| `src/components/ui/AnnotationList.tsx` | Annotation rendering in Properties panel |
| `src/components/editor/ViolationTooltip.tsx` | Ghost Canvas severity tooltip on hover |
| `src/core/ASTService.ts` | `applyMutationBatch`, `applyInversions`, `synthesizeImports` |
| `src/core/MithrilLinter.ts` | CIEDE2000 ΔE color drift + typography/spacing/shadow/opacity visitors |
| `src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules (A11Y-001..010) |
| `src/core/recoveryController.ts` | Undo/redo orchestration — single-file + cross-file |
| `src/utils/layoutMapper.ts` | Atomic Tailwind layout class management |

### `electron/` — Electron main process

| File | Role |
|------|------|
| `electron/main.ts` | IPC handlers: `saveFile`, `saveFileBatch`, `readFile`, `ast:git-show`, `ast:git-log` |
| `electron/preload.ts` | `contextBridge` — exposes `window.bridgeAPI` to renderer |
| `electron/FileTransactionManager.ts` | Atomic `.tmp` → `rename` write queue, serialized per path |
| `electron/GitManager.ts` | `ensureRepo`, `shadowCommit`, `getGitNode` for surgical recovery |
| `electron/orchestrator.ts` | Claude streaming + 7-op AST Tool Catalog + in-memory TSC validation |
| `electron/ingestion-server.ts` | Figma ingestion (port 4545) + SDI webhook (`POST /intent`) |
| `electron/store.ts` | SQLite `bridge.db` initialization and schema |
| `electron/ragService.ts` | `sqlite-vec` design system RAG for AI context injection |
| `electron/mcpClient.ts` | MCP client (JSON-RPC stdio, crash recovery) |

### `src/hooks/` — React hooks

| File | Role |
|------|------|
| `src/hooks/useMCPEventListener.ts` | Renderer hook for MCP event dispatch |
| `src/hooks/useContextSync.ts` | Context bridge (writes `.bridge/context.json`) |

### `bridge-mcp/` — Headless MCP server

| Path | Role |
|------|------|
| `bridge-mcp/src/server.ts` | MCP tool and resource registrations (13 tools, 6 resources, 3 prompts) |
| `bridge-mcp/src/core/ast-modifier.ts` | `assembleLayout`, `apply_ast_mutations` |
| `bridge-mcp/src/core/registryService.ts` | `bridge_query_registry` keyword search over `bridge-manifest.json` |
| `bridge-mcp/src/core/MithrilLinter.ts` | CIEDE2000 + typography/spacing/shadow/opacity visitors |
| `bridge-mcp/src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules |
| `bridge-mcp/src/core/events.ts` | MCP event bus + JSONL writer |

### `docs/` — Planning and strategy

| Path | Role |
|------|------|
| `docs/BRIDGE-MASTER-PLAN.md` | Single source of truth for architecture, roadmap, and ejected plans |
| `docs/strategy/` | Fidelity strategy documents (visual accuracy, logic ingestion, AI healing) |
| `docs/archive/` | Stale pre-pivot planning documents (not authoritative) |

---

## 5. Key Invariants

1. **No hardcoded colors in Glass** — token-derived Tailwind classes only. ΔE > 2.0 triggers Amber warning in PropertiesPanel.
2. **`data-bridge-id` is sacred** — never remove or overwrite it. All canvas-selectable elements need it. All mutations must preserve it.
3. **Atomic writes only** — all file saves route through `FileTransactionManager`. Never call `fs.writeFile` directly for stateful changes.
4. **No raw code strings from AI** — `orchestrator.ts` is constrained to 7 ops from the AST Tool Catalog. Raw code string generation is prohibited (Commandment 15).
5. **Babel AST for all mutations** — never use regex on source code. Every code change goes through `ASTService.applyMutationBatch` (Commandment 13).
6. **In-memory TSC before confirmation** — `orchestrator.ts` runs a TypeScript type-check on every AI-proposed mutation before surfacing a confirmation dialog (Commandment 16).
7. **`historyStore.clear()` on file-open** — prevents stale undo entries bleeding across files.
8. **`isRecovery` flag on cross-file redo** — `crossFileMove(..., { isRecovery: true })` prevents double-push to history.

---

## 6. Known Issues

- **`ELECTRON_RUN_AS_NODE` must be unset** — Claude Code sets this env var in its shell environment. If you launch `npm run dev` from a Claude Code terminal without unsetting it, Electron boots headless and no window appears. Always run `unset ELECTRON_RUN_AS_NODE && npm run dev`.
- **`ENOTEMPTY` on APFS in tests** — use `rm({ maxRetries: 3 })` for temp directory cleanup. `force: true` alone is insufficient on APFS.
- **Monaco undo guard** — `App.tsx` uses `!= null` (loose equality) for the Monaco focus guard. `document.activeElement?.closest(…)` returns `undefined` when `activeElement` is null — strict `!== null` incorrectly allows undo to fire.

---

## 7. Recent Changes

- **Phase ING (COMPLETE 2026-03-16)** — Ingestion-Time Audit & Auto-Heal. `IngestionAuditor.ts` (CIEDE2000 tier classification + Babel AST surgery), heal pass wired in `/ingest-ast` handler, `importSummaryStore`, `ImportSummary.tsx` (toast + panel), `bridge:import-summary` IPC push, `import:snap-to-token` + `import:undo-all-heals` IPC handlers, `healOnAudit` parameter on `bridge_audit` MCP tool. 30 new tests (ING-01 → ING-18 + integration tests + store tests + component tests).
- **Wave 1 (COMPLETE)** — Activity Feed upgrade (filter bar, search, error view buttons). Figma Connection Status (IPC endpoint, StatusBar popover, staleness colors). Ghost Canvas (severity heat tints, ViolationTooltip, click-to-properties, viewport culling). MCP Discoverability (`bridge://capabilities` resource, `bridge-workflow-guide` prompt).
- **Wave 2 (COMPLETE)** — Annotation rendering in Glass (`annotationStore`, `AnnotationList`, LayerTree annotation dots, `fs.watch` push sync from MCP). Governance Health Dashboard (health score ring, grade letter, top-5 rules, "health" tab in right sidebar).
- **JTBD score: 7.5 -> 8.4 (projected)** — Waves 1-2 close the observability and discoverability gaps.
- **Glass 3-panel layout** — [Left: Layers/Assets] [Center: Canvas] [Right: Properties/Tokens/Activity/Health]. Four right sidebar tabs.
- **New store: `annotationStore`** — Annotation CRUD, fs.watch push sync, rendering state for AnnotationList and LayerTree dots.
- **New components** — `ViolationTooltip` (Ghost Canvas hover), `AnnotationList` (right sidebar), `GovernanceDashboard` (health tab). Figma connection status popover is implemented inline in `StatusBar.tsx`.
- **MCP-first architecture** — `bridge-mcp/` is the authoritative governance engine. Glass is a read-only consumer of MCP Resources.
- **Context bridge** — `.bridge/context.json` is a stateless file that connects the host IDE cursor position and selection to Bridge state.
- **Annotation engine** — COLLAB.1-4 complete: annotation data model + `bridge://annotations` MCP resource + `bridge_annotate` MCP tool + Glass rendering.
- **Notification system** — Toast notifications for save state, sync state, and governance violations wired through `canvasStore`.

---

## 8. Module Status (all ONLINE)

See `docs/BRIDGE-MASTER-PLAN.md` Section 3 for the full module table. All phases through COLLAB.4 are online and tested.

**Active work streams (2026-03-16):**
- **Phase V.2-mp — Mutation Provenance Ledger (COMPLETE 2026-03-16):** `MutationProvenanceService` (`bridge-mcp/src/core/governance/mutationProvenanceService.ts`), provenance types in `bridge-mcp/src/core/governance/types.ts`, `bridge_mutation_provenance` MCP tool registered in `server.ts`, provenance recording wired into `bridge_ast_mutate` (source='agent') and `bridge_fix` (source='auto-fix') handlers. SQLite backed at `.bridge/provenance.db`. 41 new tests in `bridge-mcp/src/__tests__/mutationProvenance.test.ts`. MCP: 903/903 passing, TSC: 0 errors. Unblocks V.1-rs (Risk Scoring).
- **Phase CX.2 — bridge_plan (IN PROGRESS 2026-03-16):** Contract phase starting now. New MCP tool: intent → structured execution plan. Files: new `bridge-mcp/src/core/planService.ts`, `bridge-mcp/src/tools/plan.ts`. Server registration deferred pending ING.3 completion. Territory claimed.
- **Sprint 2 Security (COMPLETE 2026-03-16):** SEC.1 (iframe sandbox + CSP), SEC.2 (per-session secret, strip from renderer), SEC.3 (MCP tool allowlist), P0-4 (Anthropic-only provider guard). New files: `electron/mcp-policy.ts`. Modified: `electron/main.ts`, `electron/ingestion-server.ts`, `electron/preload.ts`, `electron/orchestrator.ts`, `src/components/editor/LivePreview.tsx`, `src/types/bridge-api.d.ts`, `src/components/editor/StatusBar.tsx`, `src/components/ui/FigmaSetupWizard.tsx`. 54 new tests. Core: 527/527, Glass: 496/496, MCP: 903/903, TSC: 0 errors.

**Previously active (2026-03-16):**
- **Phase ING (Ingestion-Time Audit & Auto-Heal):** COMPLETE. See Recent Changes above.
- **JTBD Gap-Fill Waves 1-3:** COMPLETE. Activity Feed upgrade, Figma status, Ghost Canvas, MCP discoverability, Annotation rendering, Governance Dashboard, MCP Push Channel (W.1), Bidirectional Action Bridge (W.3). JTBD score 8.4.
- **INFRA.1 + INFRA.2:** DONE. Governance Events + Mutations Ledger SQLite tables in `bridge-mcp/src/core/governance/`. Foundation for GOV.1-4, risk scoring, anomaly detection.
- **EXP.2:** DONE. Design Debt Report — `bridge_debt_report` MCP tool + `bridge://dashboard` resource. Health score 0-100, grade A-F, trend tracking via `.bridge/debt-history.json`.
- **Next sprint candidates (top 3):**
  1. **Phase CX.1 — Chat UX Quick Wins** (P0, ~1 sprint): Add `summary` + `project_context` fields to all tool responses; add `dry_run` flag to mutation tools; add onboarding pointer to MCP server init response. All MCP-layer changes, no Glass work. See `docs/strategy/CHAT-UX-CRITIQUE.md` for full rationale.
  2. **Phase CX.2 — `bridge_plan` Orchestration Tool** (P1, ~2 sprints): New MCP tool that accepts high-level intent and returns a structured, step-by-step execution plan with tool sequence, decision points, and expected outcomes. Closes the multi-step task coordination gap. See `docs/strategy/CHAT-UX-CRITIQUE.md` §5.
  3. **SEC.1 — Renderer Hardening** (P0, ~1 day): iframe sandbox + CSP. No deps. Has been P0 longest.
  - *Also unblocked:* GOV.1 (Rule Provenance), GOV.2 (Override Telemetry) — since INFRA.1 ONLINE. V.2-mp (Mutation Provenance Ledger) — since INFRA.2 ONLINE.
- **Security Hardening Track (SEC phases):** SEC.1 (P0 — iframe sandbox + CSP), SEC.2 (P1 — per-session secret, strip secret from renderer IPC), SEC.3 (P1 — MCP tool allowlist), SEC.4 (P1 — safeStorage for AI API key), SEC.5 (P2 — terminal cwd restriction), SEC.6 (P3 — ingestion rate limiting). All independent, no blocking deps. See Section 4.10 in `docs/BRIDGE-MASTER-PLAN.md`.
- **Contract-First Feature Build:** Mandatory 3-phase workflow for multi-file features. See `.claude/workflows/feature-build.md`.

**Note:** Master Plan uses V.1 (Risk Scoring) and V.2 (Mutation Provenance). JTBD plan uses V.1-gd (Governance Dashboard) and V.2-af (Activity Feed). These are different features — use full phase codes to avoid confusion.
