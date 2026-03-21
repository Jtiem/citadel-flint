# Flint — Developer Handoff

**Date:** 2026-03-21
**Architecture:** Flint MCP (headless governance engine) + Flint Glass (Electron observability layer)
**Test baseline:** 2,135/2,135 MCP | 960/960 Glass | 977/977 Core — TSC 0 errors

---

## Session: 2026-03-21 Rebrand Sprint (COMPLETE)

**Goal:** Rename product from Bridge → Flint across all source files, agents, commands, and docs. `shared/brand.ts` is the single source of truth for all product name strings.

**What shipped:**
- All `bridge-*` directory references → `flint-*` (`bridge-mcp/` → `flint-mcp/`, `bridge-vscode/` → `flint-vscode/`, `bridge-ci/` → `flint-ci/`)
- All user-visible strings, IPC channel prefixes (`bridge:` → `flint:`), and type names updated
- Old `.bridge-context/` directory removed; `.flint-context/` is the active territory tracking dir
- Old `.claude/agents/bridge-*.md` → `.claude/agents/flint-*.md`
- `flint-manifest.json` replaces `bridge-manifest.json` as the project registry file
- `src/types/flint-api.d.ts` replaces `src/types/bridge-api.d.ts`
- `shared/brand.ts` — single source of truth for `BRAND.product`, `BRAND.manifestFile`, `toolName()`, `ipcChannel()`, `configPath()`

**Test results:**
```
MCP:   2135/2135 passing
Glass:  960/960  passing
Core:   977/977  passing
TSC:    0 errors
```

---

## Session: 2026-03-21 Cleanup Sprint (COMPLETE)

**Goal:** Three deferred code fixes + framework-agnostic language sweep + post-review hardening.

**What shipped:**

| Fix | File | Details |
|-----|------|---------|
| CK.3 MCP tool registration | `flint-mcp/src/tools/reindex.ts` (CREATE), `flint-mcp/src/server.ts` | `flint_reindex_registry` tool was ONLINE in Electron IPC but missing from MCP surface. Added tool definition, handler, import, ListTools entry, and CallTool case. |
| Double scope filter | `electron/orchestrator.ts:1801` | `activeRegistry` was already scope-filtered; removed redundant `scope` arg from `serializeRegistryConstraints()` call. |
| Pluralization fix | `electron/orchestrator.ts` | `TOKEN_TYPE_LABELS` lookup table replaces naive `type + 's'` — fixes "Typographys" → "Typography". |
| Framework-agnostic language | 7 files | 11 occurrences of "React component" in tool descriptions, JSDoc, UI strings → "component" (framework-neutral). Files: `ingest.ts`, `hydroPaste.ts`, `componentIndexer.ts`, `main.ts`, `LaunchScreen.tsx`. |
| Atomic write (review fix) | `flint-mcp/src/tools/reindex.ts` | `writeFileSync` → tmp file + `renameSync` (Commandment 12). |
| Missing try/catch (review fix) | `flint-mcp/src/tools/reindex.ts` | `indexComponents()` call now wrapped in try/catch returning structured error. |
| Non-null assertion (review fix) | `src/components/ui/AgentDashboard.tsx` | `mcp!.readResource` → `mcp?.readResource` (runtime safety). |
| Missing aria-label (review fix) | `src/components/ui/ComponentSearch.tsx` | Added `aria-label="Search components"` to search input. |
| Color palette (review fix) | `src/components/ui/SetupWizard.tsx` | 5 `gray-*` classes → `zinc-*` for consistency with the rest of Glass UI. |

**Remaining warnings (non-blocking, tracked):**
- `componentCardStore.ts` — cross-store import + `window.flintAPI` in store actions (architectural debt)
- `betaGuard.ts` — IPC channels use raw strings instead of `ipcChannel()` helper; no test file
- `DependencyEdge.tsx` — `<style>` keyframe injected per-edge (should be global CSS)
- `ragSeeder.ts` — synchronous I/O; no symlink guard on `.flint/docs/` reads

---

## Session: 2026-03-20 CV2.1 (COMPLETE)

**Sprint:** CV2.1 — Build/Govern Canvas Mode Toggle
**Goal:** Three-mode canvas view toggle (Preview/Build/Govern) with segmented control, keyboard shortcuts, and StatusBar indicator.

**What shipped:**

| Task | Files | Tests Added |
| ---- | ----- | ----------- |
| Store: `CanvasView` type, `canvasView` state, `setCanvasView`, reset in `closeWorkspace` | `src/store/canvasStore.ts` | 6 new (canvasStore.canvasView.test.ts) |
| UI: Segmented control floating top-center of canvas | `src/components/editor/CanvasViewToggle.tsx` (CREATE) | 7 new (CanvasViewToggle.test.tsx) |
| UI: XYCanvas conditional rendering — Preview/Build/Govern panels | `src/components/editor/XYCanvas.tsx` | — |
| UI: Cmd+1/2/3 keyboard shortcuts | `src/App.tsx` | — |
| UI: "Build View" / "Govern View" StatusBar chip | `src/components/editor/StatusBar.tsx` | — |

**Test results:**

```text
Glass: 734/734 passing
TSC:   0 errors
```

**Notes:**

- Build and Govern modes render placeholder panels (CV2.3/CV2.4 will fill them)
- `canvasView` is orthogonal to `canvasMode` ('design'|'interact') — different concerns
- Cross-file drop handler gated behind `canvasView === 'preview'`

---

## Session: 2026-03-20 CV2.7 (COMPLETE)

**Sprint:** CV2.7 — Search/Filter Bar
**Goal:** Text search + category filter for the component card grid.

**What shipped:** Debounced search input (150ms) + category `<select>` dropdown + result count + clear button. Filters apply to both `toFlowNodes` and `toFlowEdges`. `clearCards()` resets filters.

**Test results:**
```text
Glass: 813/813 passing (29 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 CV2.6 (COMPLETE)

**Sprint:** CV2.6 — Category Management
**Goal:** Reclassify components via category badge dropdown in Build mode.

**What shipped:**

| Component | What | Tests |
|-----------|------|-------|
| IPC: `components:set-category` + override persistence | Category overrides in `.flint/category-overrides.json`, applied in `components:list` | 30 new |
| Store: `setCategoryOverride` action | Optimistic update + IPC + revert on failure + notification | 5 new |
| UI: Category badge dropdown on ComponentCardNode | Click badge → 6-option popover, Build mode only | 7 new |

**Test results:**
```text
Glass: 795/795 passing (12 new)
Core:  977/977 passing (30 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 CV2.5 (COMPLETE)

**Sprint:** CV2.5 — Drag-to-Insert
**Goal:** Drag component cards from Build canvas into LivePreview to insert into AST.

**What shipped:**

| Component | What | Tests |
|-----------|------|-------|
| `ComponentCardNode.tsx` | `nodrag` drag handle with `flint-component-card` MIME, Build mode only | 4 new |
| `LivePreview.tsx` | Enhanced drop handler for card MIME, dashed indigo drop indicator | 8 new |

**Test results:**
```text
Glass: 783/783 passing (12 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 CV2.4 (COMPLETE)

**Sprint:** CV2.4 — Component Health Enrichment
**Goal:** Populate Govern mode cards with real per-component audit data.

**What shipped:**

| Component | What | Tests |
|-----------|------|-------|
| `componentHealth.ts` (NEW) | Grade computation + per-file parse/lint enrichment | 12 new |
| `main.ts` (`components:list`) | Dynamically imports linters, loads tokens, enriches cards with real health | — |

**Test results:**
```text
Core: 947/947 passing (12 new)
TSC:  0 errors
```

---

## Session: 2026-03-20 CV2.3 (COMPLETE)

**Sprint:** CV2.3 — Component Cards on Canvas
**Goal:** Fill the Build/Govern placeholder panels with a spatial component library.

**What shipped:**

| Component | What it does | Tests |
|-----------|-------------|-------|
| `componentCardStore.ts` | Cards, positions, selection, auto-layout, flow selectors | 15 (pre-existing) |
| `ComponentCardNode.tsx` | Build mode (thumbnail, Insert) + Govern mode (grade, Delta-E, A11y) | 20 (pre-existing) |
| `DependencyEdge.tsx` | Health-grade colored bezier edges in Govern mode | 17 new |

**Code review:** FIX. One type bug found and fixed (DependencyEdgeData conditional type resolving to `null` instead of grade string). Now SHIP.

**Test results:**
```text
Glass: 771/771 passing (17 new)
TSC:   0 errors
```

---

## Session: 2026-03-20 EN.1-4 (COMPLETE)

**Sprint:** EN.1-4 — Registry Enrichment (Generate, Then Curate)
**Goal:** AI generates component documentation drafts, designers curate in Scope panel

**What shipped:**

| Phase | What | Tests |
|-------|------|-------|
| EN.1 | `flint_enrich_registry` + `flint_approve_enrichment` MCP tools, `enrichmentDraftService`, IPC handlers (`enrichment:get-drafts`, `enrichment:approve`) | 19 new (enrichTool.test.ts) |
| EN.2 | JSDoc extraction in `componentIndexer.ts` — auto-populates descriptions from `/** */` comments | 7 new (componentIndexer.test.ts) |
| EN.3 | Scope panel: three-state dots (bare/draft/enriched), expandable draft review, approve/edit/dismiss, health metric | 9 new (ComponentScopePanel.test.tsx) |
| EN.4 | Discovery banner when >50% bare: "Ask your AI: enrich my component registry" with copy-to-clipboard | (included in EN.3 tests) |
| Agent | `flint-registry-enricher` agent definition — cross-component analysis, usage mining, relationship discovery | n/a |

**Code review:** FIX verdict. One critical fix applied (IPC handlers not unwrapping `.drafts` sub-key). Now SHIP-ready.

**Test results:**
```text
MCP:   2,135/2,135 passing (26 new)
Glass:   754/754 passing (9 new)
Core:    935/935 passing
TSC:     0 errors
```

---

## Session: 2026-03-20 CK.1-4 (COMPLETE)

**Sprint:** CK.1-4 — Component Knowledge (Closing the Generation Gap)
**Goal:** Make the AI effectively build with registered components, not just be constrained by them.

**What shipped:**

| Phase | What | Tests |
|-------|------|-------|
| CK.1 | RAG auto-seeding from manifest + tokens + docs on project open | 13 new (ragSeeder.test.ts) |
| CK.2 | 6th plan intent `component-composition` — queries registry, suggests components | 30 new (planComposition.test.ts) |
| CK.3 | On-demand re-indexing via `project:reindex` IPC | 12 new (reindex.test.ts) |
| CK.4 | Extended ComponentEntry: usageExample, compositionNotes, a11yNotes, relatedComponents | 13 new (registryService.test.ts) |

**Test results:**
```text
MCP:   2,109/2,109 passing (43 new)
Core:    935/935 passing (25 new)
Glass:   745/745 passing
TSC:     0 errors
```

**Code review:** SHIP. Two fixes applied: Commandment 12 atomic write in reindex handler, CK.4 fields added to ragSeeder. One follow-up noted: `flint_reindex_registry` MCP tool not yet registered (IPC path works, MCP clients need follow-up).

---

## Session: 2026-03-20 CR.4 (COMPLETE)

**Sprint:** CR.4 — Glass UI for Component Scope Management
**Goal:** Visual control surface for managing which components the AI can use per-project.

**What shipped:**

| Task | Files | Tests Added |
|------|-------|-------------|
| IPC: `scope:get-registry-and-scope`, `scope:set-scope` | `electron/main.ts`, `electron/preload.ts` | 18 new (componentScope.test.ts) |
| Types: `ComponentRegistryEntry`, `ComponentScopeData`, `ScopeAPI` | `src/types/flint-api.d.ts` | 0 (type-level, verified by TSC) |
| Store: `'scope'` added to `RightTab` union | `src/store/canvasStore.ts` | 0 (type-level) |
| UI: ComponentScopePanel (scope editor in right sidebar) | `src/components/ui/ComponentScopePanel.tsx`, `src/App.tsx` | 11 new (ComponentScopePanel.test.tsx) |

**Test results:**
```text
Glass: 745/745 passing (11 new)
Core:  910/910 passing (18 new)
TSC:   0 errors
```

**Code review:** FIX verdict (2 fixes applied inline: useEffect cleanup for debounce timer, string validation in scope:set-scope). Now SHIP-ready.

**Key decisions:**
1. New "Scope" tab in right sidebar (Layers icon), after Agents, before Recovery
2. No new Zustand store — local state only (matches AgentDashboard pattern)
3. "All Components" vs "Restricted" mode toggle with clear semantics
4. 300ms debounced persistence for rapid toggles, optimistic UI with revert on failure

---

## Session: 2026-03-20 CR.1-3 (COMPLETE)

**Sprint:** CR.1-3 — Constrained Registry (Proactive Generation Constraints)
**Goal:** When a user describes what they want built, the AI orchestrator is constrained to only use components and styles registered for the active project.

**What shipped:**

| Task | Files | Tests Added |
|------|-------|-------------|
| CR.1: System prompt injection (registry + tokens as BINDING constraints) | `electron/orchestrator.ts` | 10 new |
| CR.2: Registry membership gate in Commandment 16 validation loop | `electron/orchestrator.ts` | 16 new |
| CR.3: Per-project `componentScope` filter via `.flint/policy.json` | `electron/orchestrator.ts` | 4 new |

**New exported functions:**
- `serializeRegistryConstraints(registry, scope?)` — serializes allowed components into system prompt
- `serializeTokenConstraints(tokens)` — serializes design token palette into system prompt
- `validateRegistryMembership(toolName, input, registry)` — hard-rejects ops targeting unregistered components

**Test results:**
```
Core: 892/892 passing (30 new in constrainedRegistry.test.ts)
TSC:  0 errors
```

**Code review:** SHIP verdict. Three low-priority items noted (double scope filter, "Typographys" pluralization, module-level activeRegistry). No blockers.

**Key architectural decision:** Governance flipped from reactive (audit after generation) to proactive (constrain before generation). The AI model now sees a BINDING component registry and token palette in its system prompt. Unregistered components are rejected at the Commandment 16 validation loop before reaching the UI.

---

## Session: 2026-03-20 CV2.1 (Contracts Phase)

**Sprint:** CV2.1 -- Build/Govern Canvas Mode Toggle
**Goal:** Write Phase 1 contract artifact for the three-mode canvas view toggle (Preview/Build/Govern).

**Contracts produced:**
- `.flint-context/contracts/CV2.1-contract.md` -- Full contract: state, UI, keyboard shortcuts, StatusBar indicator
- `.flint-context/contracts/CV2.1-validation.md` -- Validation spec with 24 test case requirements

**Files in scope (Phase 2 implementation):**

| Task | Files to MODIFY | Files to CREATE |
|------|----------------|-----------------|
| State | `src/store/canvasStore.ts` | `src/store/__tests__/canvasStore.canvasView.test.ts` |
| UI | `src/components/editor/XYCanvas.tsx`, `src/App.tsx`, `src/components/editor/StatusBar.tsx` | `src/components/editor/CanvasViewToggle.tsx`, `src/components/editor/__tests__/CanvasViewToggle.test.tsx` |

**Key architectural decisions:**
1. No new IPC channels -- entirely renderer-side state + UI
2. New `CanvasView` type is orthogonal to existing `CanvasMode` ('design'|'interact')
3. Build and Govern modes render placeholder panels (actual content in CV2.3/CV2.4)
4. `canvasView` resets to `'preview'` on `closeWorkspace()` -- no cross-project bleed
5. Cross-file drop handler gated behind `canvasView === 'preview'`

**Parallelism:** flint-state-architect and flint-design-engineer can run fully in parallel. flint-test-writer runs after both complete.

**Next steps:** Phase 2 implementation. Spawn specialist agents per contract.

---

## Session: 2026-03-20 HYDRO.1 (COMPLETE)

**Sprint:** HYDRO.1 — Component Hydration Wiring

**What shipped:**

| Task | Files | Tests Added |
|------|-------|-------------|
| HYDRO.1-A: `flint_ingest_figma` stub → full HydroPaste wiring | `flint-mcp/src/tools/ingest.ts` | 7 new (ingestTool.test.ts) |
| HYDRO.1-B: Figma ID deterministic match loop | `flint-mcp/src/core/hydroPaste.ts` | 10 new (hydroPaste.test.ts) |
| HYDRO.1-C: Component Registry Search UI in Glass | `src/components/ui/ComponentSearch.tsx`, `src/components/editor/AssetsPanel.tsx` | 11 new (ComponentSearch.test.tsx) |

**Post-review fixes applied:**

- `ingest.ts`: Added try/catch around `engine.processPayload` → `'error'` status now reachable
- `ingest.ts`: Extended `isInvalidPayload` detection to include `'unrecognized'` and `'error'` summaries
- `hydroPaste.ts`: Replaced `as any` with narrow typed cast + comment; renamed `violationCount` → `registryComponentCount`; narrowed `matchMode !== 'none'` guard to fix TSC error
- `ComponentSearch.tsx`: Replaced `mcp!.callTool` with `mcp` guard + `mcp.callTool`; added `aria-label` on Insert buttons; added `role="status"` on spinner
- `ComponentSearch.test.tsx`: Added `isError: true` response test; strengthened loading test to assert spinner presence

**Test results:**
```
MCP:   2046/2046 passing (28 new: 7 + 10 + 11 across 3 test files)
Glass: 642/642 passing (32 new from this sprint)
TSC:   0 errors
```

**What these changes enable:**

- Calling `flint_ingest_figma` now returns actual generated JSX components (not an empty stub)
- Figma component IDs deterministically match to code components via `queryRegistryDeterministic`
- Glass "Assets" tab now has a live search field — type 2+ chars → searches registry → click Insert to inject into active layer

**Nothing remains from HYDRO.1. Territory cleared.**

---

## Session: 2026-03-20 HYDRO.1 (Contracts Phase)

**Sprint:** HYDRO.1 -- Component Hydration Wiring
**Goal:** Write Phase 1 contract artifacts for three wiring tasks that connect the Figma ingestion pipeline, deterministic component matching, and Glass search UI.

**Contracts produced:**
- `.flint-context/contracts/HYDRO.1-A-contract.md` -- Wire HydroPaste into flint_ingest_figma tool
- `.flint-context/contracts/HYDRO.1-B-contract.md` -- Figma ID deterministic match loop
- `.flint-context/contracts/HYDRO.1-C-contract.md` -- Component Registry Search UI in Glass

**Files in scope (Phase 2 implementation):**

| Task | Files to MODIFY | Files to CREATE |
|------|----------------|-----------------|
| HYDRO.1-A | `flint-mcp/src/tools/ingest.ts`, `flint-mcp/src/core/hydroPaste.ts` | `flint-mcp/src/__tests__/ingestTool.test.ts` |
| HYDRO.1-B | `flint-mcp/src/core/hydroPaste.ts` | `flint-mcp/src/core/__tests__/hydroPaste.test.ts` |
| HYDRO.1-C | `src/components/editor/AssetsPanel.tsx` | `src/components/ui/ComponentSearch.tsx`, `src/components/ui/__tests__/ComponentSearch.test.tsx` |

**Key architectural decisions:**
1. No new IPC channels needed -- HYDRO.1-C uses existing `window.flintAPI.mcp.callTool` (Phase W.3)
2. HYDRO.1-B replaces inline manifest scan in hydroPaste.ts with canonical `queryRegistryDeterministic()` from registryService.ts
3. HYDRO.1-C lives in the left sidebar "assets" tab, augmenting (not replacing) the hardcoded AssetsPanel tiles
4. HYDRO.1-A and HYDRO.1-B both touch hydroPaste.ts -- coordinate via territory claim or merge sequentially

**Parallelism:** HYDRO.1-A and HYDRO.1-C can run fully in parallel. HYDRO.1-B shares hydroPaste.ts with HYDRO.1-A.

**Next steps:** Phase 2 implementation. Spawn specialist agents per contract.

---

## Session: 2026-03-19 ONBOARD.1-FIXES (Swarm: ONBOARD.1-FIXES)

**Files changed:**
- `src/components/ui/SetupWizard.tsx`
- `src/components/ui/__tests__/SetupWizard.test.tsx`

**Fixes (9 UX and safety issues from formal audit):**
1. **R-1** — Removed auto-write `useEffect`; `writeMCPConfig` now fires only when user clicks "Install MCP Config"; config JSON preview shown before install.
2. **R-2** — Error state now shows "Copy config snippet" button (copies JSON to clipboard) and manual paste instruction with the target path.
3. **R-3** — "Skip" on mcp-snippet calls `goNext` (advances to verify), not `handleDone`; `completeFirstLaunch` is called only from the done step's "Start building" button.
4. **R-4** — Escape key handler checks `writeStatus !== 'writing'` before calling `onComplete`; dismissal blocked mid-write.
5. **R-5** — Verify step copy updated: removed "restart your IDE" instruction; replaced with accurate "Flint is checking its internal connection" text.
6. **R-6** — IDE selection button now calls `setWriteStatus(null)` and `setWriteError(null)` on click to reset stale write state.
7. **R-8** — Removed two stale `@ts-expect-error` comments on `window.flintAPI.setup` and `window.flintAPI.mcp` calls (types are defined in `flint-api.d.ts`).
8. **R-9** — Added `aria-live="polite"` to the mcp-snippet status indicator container.
9. **R-10** — `StepDots` rewritten: completed steps show filled indigo dot with checkmark character; current step shows outlined ring with inner filled dot; future steps show hollow ring. Uses `data-step-state` and `data-step-index` attributes for testability.

**Test results:**
```
Glass: 610/610 passing (17 new)
TSC:   0 errors
```

---

## Session: 2026-03-19 MCP-FIXES (Swarm: MCP-FIXES)

**Files changed:**
- `flint-mcp/src/core/capabilities/index.ts`
- `flint-mcp/src/server.ts`
- `flint-mcp/src/core/tailwindMigrator.ts`
- `flint-mcp/src/core/tailwindMigrator.test.ts` (deleted — duplicate)

**Fixes:**
1. **capabilities/index.ts** — Updated `audit_ui_component` param `componentPath`→`file` and `flint_query_registry` param `semantic_query`→`query`; marked `projectRoot` as optional to match actual tool schemas.
2. **server.ts (audit_ui_component)** — Added `args.file ?? args.componentPath` fallback for backward-compatible clients still sending `componentPath`.
3. **server.ts (flint_query_registry)** — Added `args.query ?? args.semantic_query` fallback for backward-compatible clients still sending `semantic_query`.
4. **server.ts (flint_migrate_tw)** — Added path traversal guard: rejects any `glob` containing `..` or an absolute path before file operations.
5. **server.ts (SYNC.4 factories)** — Converted `getSyncCheckService`, `getOfflineQueue`, `getSyncHistoryService` from per-call constructors to module-scope cached singletons (Maps keyed by projectRoot) to prevent SQLite connection leaks.
6. **tailwindMigrator.ts** — Replaced bare `@ts-ignore` with `@ts-expect-error` plus an explanatory comment about the Babel CJS/ESM interop.
7. **tailwindMigrator.test.ts** — Deleted duplicate; canonical test lives at `flint-mcp/src/core/__tests__/tailwindMigrator.test.ts`.

**Test results:**
```
MCP: 1886/1886 passing (0 new)
TSC: 0 errors
```

---

## 1. What Is Flint

Flint is a governance infrastructure layer that makes AI-generated UI code safe to ship. It enforces design systems, accessibility standards, and brand compliance deterministically at the AST level — before code reaches production.

**Two components:**

| Component | What it is | Where it runs |
|-----------|------------|---------------|
| **Flint MCP** | Headless governance engine — 13 tools, 6 resources, 3 prompts | Anywhere: CI, Claude Code, Cursor, VS Code |
| **Flint Glass** | Visual observability layer — reads MCP state, calls MCP tools | Electron 35.7.5 desktop app |

Flint Glass owns zero business logic. All enforcement, mutation, and linting lives in the MCP engine.

---

## 2. How to Run

### First-time setup

```bash
npm install
```

> Note: `flint-mcp/` is the headless server package. Install its deps separately if working on MCP tools directly:
> ```bash
> cd flint-mcp && npm install
> ```

### Launch Flint Glass (Electron + Vite)

```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

`ELECTRON_RUN_AS_NODE` must be unset — if it is set (which happens when Claude Code spawns the shell), Electron boots in a headless Node mode and the window never appears.

### Run tests

```bash
# MCP engine tests (515 tests across 23 files)
cd flint-mcp && npm test

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
  SQLite WAL              — flint.db (project) + flint-registry.db (global)
  GitManager              — shadow commits on every save
  orchestrator.ts         — Claude AI + constrained AST Tool Catalog + TSC loop
  ingestion-server.ts     — Figma plugin flint (port 4545)
  LSP clients             — TypeScript + Vue language servers

Renderer Process (React 19 / Vite)
  XYCanvas.tsx            — infinite canvas (@xyflow/react v12)
  LivePreview.tsx         — srcdoc iframe, 100% offline
  ExportModal.tsx         — pre-flight Mithril + a11y audit gate

Preload (contextBridge)
  window.flintAPI        — typed IPC surface between renderer and main
```

### 3.3 MCP-First Design

Claude Code and other MCP clients connect to Flint MCP directly. Glass reads the same MCP Resources to display state — it is a consumer of the engine, not a wrapper around it.

MCP connection config (add to `~/.claude/mcp.json`):
```json
{
  "mcpServers": {
    "flint": {
      "command": "node",
      "args": ["/path/to/flint-mcp/dist/server.js"]
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
| `electron/preload.ts` | `contextBridge` — exposes `window.flintAPI` to renderer |
| `electron/FileTransactionManager.ts` | Atomic `.tmp` → `rename` write queue, serialized per path |
| `electron/GitManager.ts` | `ensureRepo`, `shadowCommit`, `getGitNode` for surgical recovery |
| `electron/orchestrator.ts` | Claude streaming + 7-op AST Tool Catalog + in-memory TSC validation |
| `electron/ingestion-server.ts` | Figma ingestion (port 4545) + SDI webhook (`POST /intent`) |
| `electron/store.ts` | SQLite `flint.db` initialization and schema |
| `electron/ragService.ts` | `sqlite-vec` design system RAG for AI context injection |
| `electron/mcpClient.ts` | MCP client (JSON-RPC stdio, crash recovery) |

### `src/hooks/` — React hooks

| File | Role |
|------|------|
| `src/hooks/useMCPEventListener.ts` | Renderer hook for MCP event dispatch |
| `src/hooks/useContextSync.ts` | Context flint (writes `.flint/context.json`) |

### `flint-mcp/` — Headless MCP server

| Path | Role |
|------|------|
| `flint-mcp/src/server.ts` | MCP tool and resource registrations (13 tools, 6 resources, 3 prompts) |
| `flint-mcp/src/core/ast-modifier.ts` | `assembleLayout`, `apply_ast_mutations` |
| `flint-mcp/src/core/registryService.ts` | `flint_query_registry` keyword search over `flint-manifest.json` |
| `flint-mcp/src/core/MithrilLinter.ts` | CIEDE2000 + typography/spacing/shadow/opacity visitors |
| `flint-mcp/src/core/A11yLinter.ts` | 10 WCAG 2.1 AA rules |
| `flint-mcp/src/core/events.ts` | MCP event bus + JSONL writer |

### `docs/` — Planning and strategy

| Path | Role |
|------|------|
| `docs/FLINT-MASTER-PLAN.md` | Single source of truth for architecture, roadmap, and ejected plans |
| `docs/strategy/` | Fidelity strategy documents (visual accuracy, logic ingestion, AI healing) |
| `docs/archive/` | Stale pre-pivot planning documents (not authoritative) |

---

## 5. Key Invariants

1. **No hardcoded colors in Glass** — token-derived Tailwind classes only. ΔE > 2.0 triggers Amber warning in PropertiesPanel.
2. **`data-flint-id` is sacred** — never remove or overwrite it. All canvas-selectable elements need it. All mutations must preserve it.
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

## 6b. Active Work

- **ONBOARD.1 — First-Launch Setup Walkthrough:** Phase 1 contract produced. 5-step wizard guides user through MCP registration in their IDE. Contract at `.flint-context/contracts/ONBOARD.1-contract.md`. Awaiting Phase 2 implementation.

## 7. Recent Changes

- **Phase U.4 — Ghost Code Snippets (COMPLETE 2026-03-16):** New `GhostCodeSnippet.tsx` floating overlay (portal into `document.body`) shows JSX source context for the selected canvas node. Extracts source lines via node id's embedded 1-based line number (format `tagName:line:col`). CSS-class-based keyword tokeniser with Flint palette token colours — no Monaco/CodeMirror added. Escape key + close button dismiss; auto-resets on node deselect. Integrated into `XYCanvas.tsx` as a sibling overlay. 18 new Glass tests covering `parseLineFromNodeId`, `extractSourceContext`, and all component render/dismiss states. Glass: 554/554 passing (18 new). TSC: 0 errors.
- **Phase CX.1 — Response Quality Baseline (COMPLETE 2026-03-16):** New `flint-mcp/src/core/projectContext.ts` (`loadProjectContext()` — O(1) read of `.flint/debt-history.json`, graceful null on any error). `summary` field added to `flint_audit`, `flint_fix`, `flint_ast_mutate`, `flint_debt_report`, `audit_ui_component`, `flint_swarm_audit_fix` responses — one sentence plain English per contract generation rules. `project_context` footer on `flint_audit`, `flint_fix`, and `flint_ast_mutate` responses. `dryRun` flag formalized on `flint_fix` (response labeling + provenance skip) and `flint_ast_mutate` (writeFile forced false + provenance skip + MRS skip). Server `instructions` onboarding hint set in MCP Server constructor. 69 new tests (projectContext.test.ts: 24, responseQuality.test.ts: 34, cx1-response-quality.test.ts: 11). MCP: 1,158/1,158 passing, TSC: 0 errors.
- **Phase ING (COMPLETE 2026-03-16)** — Ingestion-Time Audit & Auto-Heal. `IngestionAuditor.ts` (CIEDE2000 tier classification + Babel AST surgery), heal pass wired in `/ingest-ast` handler, `importSummaryStore`, `ImportSummary.tsx` (toast + panel), `flint:import-summary` IPC push, `import:snap-to-token` + `import:undo-all-heals` IPC handlers, `healOnAudit` parameter on `flint_audit` MCP tool. 30 new tests (ING-01 → ING-18 + integration tests + store tests + component tests).
- **Wave 1 (COMPLETE)** — Activity Feed upgrade (filter bar, search, error view buttons). Figma Connection Status (IPC endpoint, StatusBar popover, staleness colors). Ghost Canvas (severity heat tints, ViolationTooltip, click-to-properties, viewport culling). MCP Discoverability (`flint://capabilities` resource, `flint-workflow-guide` prompt).
- **Wave 2 (COMPLETE)** — Annotation rendering in Glass (`annotationStore`, `AnnotationList`, LayerTree annotation dots, `fs.watch` push sync from MCP). Governance Health Dashboard (health score ring, grade letter, top-5 rules, "health" tab in right sidebar).
- **JTBD score: 7.5 -> 8.4 (projected)** — Waves 1-2 close the observability and discoverability gaps.
- **Glass 3-panel layout** — [Left: Layers/Assets] [Center: Canvas] [Right: Properties/Tokens/Activity/Health]. Four right sidebar tabs.
- **New store: `annotationStore`** — Annotation CRUD, fs.watch push sync, rendering state for AnnotationList and LayerTree dots.
- **New components** — `ViolationTooltip` (Ghost Canvas hover), `AnnotationList` (right sidebar), `GovernanceDashboard` (health tab). Figma connection status popover is implemented inline in `StatusBar.tsx`.
- **MCP-first architecture** — `flint-mcp/` is the authoritative governance engine. Glass is a read-only consumer of MCP Resources.
- **Context flint** — `.flint/context.json` is a stateless file that connects the host IDE cursor position and selection to Flint state.
- **Annotation engine** — COLLAB.1-4 complete: annotation data model + `flint://annotations` MCP resource + `flint_annotate` MCP tool + Glass rendering.
- **Notification system** — Toast notifications for save state, sync state, and governance violations wired through `canvasStore`.

---

## 8. Module Status (all ONLINE)

See `docs/FLINT-MASTER-PLAN.md` Section 3 for the full module table. All phases through COLLAB.4 are online and tested.

**Sprint 3 — Risk + Chat Quality (COMPLETE 2026-03-16):**
- **GOV.1 — Rule Provenance (COMPLETE):** Static provenance registry mapping all 40 governance rules to compliance authorities (WCAG 2.1 AA, SOC2, FDA SaMD, Section 508). Provenance attached to `flint_audit` and `audit_ui_component` violations. `flint_audit_report` extended with `sourceAuthority` filter and compliance summary. 50 tests.
- **GOV.2 — Override Telemetry (COMPLETE):** SQLite-backed `override_events` table. `OverrideTelemetryService` with record, query by session/rule, summary, pruning. `flint_override_telemetry` MCP tool (summary/by_session/by_rule). `flint://overrides` resource. Fire-and-forget recording wired into audit/fix. 33 tests.
- **V.1 — Risk Scoring Approval Flow (COMPLETE):** MRS Green/Amber/Red tiers wired into orchestrator mutation approval. Green auto-approves, Amber requires human review, Red requires senior sign-off. Policy floors enforce minimum tiers for structural/destructive ops. `requiresReview`/`requiresSignoff` annotated on tool_call chunks. 47 tests.
- **AGV.1 — Per-Agent Tool ACL (COMPLETE):** Deny-by-default per-agent permission model extending SEC.3 renderer allowlist. Tier hierarchy (untrusted/standard/trusted/admin). Rate limiting per session. `agentPolicy.ts` + `mcp-policy.ts` unified `checkToolAccess`. 74 tests.
- **AGV.3 — Agent Auto-Escalation (COMPLETE):** Configurable escalation rules engine with session-scoped tracking. 4 default rules (red count, amber count, avg risk, velocity). Rule deduplication. `agentEscalation.ts`. Note: not yet wired into orchestrator — infrastructure ready. 74 tests.
- **CX.1 — Response Quality Baseline (COMPLETE):** `summary` + `project_context` on all tool responses. `dry_run` flag on `flint_ast_mutate` and `flint_fix`. MCP `initialize` onboarding pointer. 76 tests.
- **CX.3 — Error Taxonomy (COMPLETE):** Structured `FLINT-ERR-001..010` error codes with descriptions and recovery instructions. `explanation` field on Mithril and A11y rules. `errorCodes.ts` + `errorTaxonomy.ts`.
- **MDA.1 — Mithril Delta Mode (COMPLETE):** Baseline snapshotting with SHA-256 violation hashing. Per-project baselines. `auditDelta` suppresses known violations. Sentinel row for empty baselines. 39 tests.
- **SEC.4-6 (COMPLETE):** SEC.4 safeStorage API key encryption, SEC.5 terminal cwd/input hardening, SEC.6 ingestion rate limiting.
- **U.3 — Immersive Canvas (COMPLETE):** Removed CodeEditor, CodeEditorPanel, TerminalPanel. Recovers ~40% vertical real estate.
- **ING.3 — healOnAudit Integration Tests (COMPLETE):** 17 tests covering happy path, backward compat, zero-token edge case.
- **Security fix:** Closed agent ID spoofing vector in `main.ts` — renderer always identified as `'renderer'`, never trusts `_agentId` from IPC args.
- **`/review` command:** Automated pre-commit code review gate (`.claude/commands/review.md`). Domain-aware parallel `flint-code-reviewer` agents. Wired into Contract-First workflow between Phase 2 and Phase 3.

**Previously completed:**
- V.1-rs (MRS stateless scorer), V.2-mp (Mutation Provenance Ledger), CX.2 (flint_plan), Sprint 2 Security (SEC.1-3, P0-4), Phase ACX (Proactive Agent Context), Phase ING (Ingestion Auto-Heal), JTBD Waves 1-3, INFRA.1-2, EXP.2 (Debt Report), GOV.3 (Session Validation), Test Coverage Remediation.
- **Contract-First Feature Build:** Mandatory 3-phase workflow. See `.claude/workflows/feature-build.md`.

**EXP.3 — Tailwind v3→v4 Migration Tool (COMPLETE 2026-03-16):**
- **`flint-mcp/src/core/tailwindMigrator.ts`** — Core migration engine: Babel AST visitor (`JSXAttribute` traversal on `className`), `TW_V3_TO_V4_MAP` (75+ class entries covering flex, text-overflow, box-decoration, bg-gradient, opacity modifiers, shadow, outline renames), `migrateFile(source, options)`, `migrateFileAtPath(filePath, options)`. Dry-run default. Commandment 13 compliant — zero regex on source code.
- **`flint-mcp/src/core/__tests__/tailwindMigrator.test.ts`** — 56 tests covering all transformation categories, template literals, expression containers, no-op cases, malformed JSX, empty input, dry-run vs. write mode, file I/O round-trips, TW_V3_TO_V4_MAP integrity checks.
- **`flint-mcp/src/server.ts`** — `flint_migrate_tw` MCP tool registered (tool definition + `case "flint_migrate_tw"` handler). Accepts `filePaths[]`, `dryRun`, `from`, `to`. Post-migration `flint_audit` run on each changed file. Returns per-file `summary`, `changes[]`, `auditViolationCount`.
- MCP: 1,602/1,602 passing (56 new) | TSC: 0 errors

**Sprint 4 Phase A — Wire + AGV.2 (COMPLETE 2026-03-16):**
- **1A: Escalation engine wired into orchestrator.** `escalationEngine` imported from `agentEscalation.ts`. After MRS computation, `recordMutationRisk` called. `block_mutations` escalation rejects tool calls with clear error. `require_review` escalation forces `requiresReview=true`.
- **1B: Policy file loading wired into main.ts.** `loadAgentPolicy(projectRoot)` called at all 3 `activeProjectRoot` assignment points (openFolder, create-scratchpad, openPath). Per-project `.flint/agent-policy.json` is now live.
- **1C: Blast radius populated in orchestrator.** `flint_ast_mutate` extracts `mutations.length` for real blast radius. Other tools default to 1.
- **AGV.2: Agent Risk Dashboard (COMPLETE).** New `AgentRiskService` aggregates provenance + risk scores + overrides per agent. `flint://agent-risk` MCP resource. `flint_agent_risk` MCP tool (summary/by_agent). Types: `AgentRiskProfile`, `AgentRiskSummary`. 15 new tests.

**GOV.4: Statistical Anomaly Detection (COMPLETE 2026-03-16):**
- **AnomalyDetectionService** (`flint-mcp/src/core/governance/anomalyDetectionService.ts`): Computes baseline stats from mutations_ledger, governance_events, override_events, mutation_risk_scores. Detects 5 anomaly types (override_spike, violation_surge, risk_drift, velocity_spike, agent_behavior_change) at 3-sigma threshold. When stddev=0, uses mean*1.5 fallback. Severity derived from sigma distance (3σ=warning, 4σ=critical). SQLite `anomaly_history` table for persistence.
- **Types** added to `types.ts`: `AnomalyType`, `AnomalySeverity`, `BaselineStats`, `Anomaly`.
- **MCP tool** `flint_anomaly_report` registered with actions: `detect`, `history`, `baseline`.
- **MCP resource** `flint://anomalies` returns count + latest 10 anomalies.
- **23 new tests** covering: schema init, empty/missing tables, single data point, multi-day baselines, all 5 anomaly types, stddev=0 fallback, multiple simultaneous anomalies, persistence, severity derivation, history ordering/limit/scoping.
- **Test results:** MCP: 1491/1512 passing (23 new; 21 pre-existing policy test failures unchanged) | TSC: 0 errors

**2026-03-19 ELECTRON-JSONC: Setup IPC Bug Fixes (COMPLETE):**
- **Files changed:** `electron/main.ts`, `electron/__tests__/setupIpc.test.ts`
- **Fix 1 (JSONC-safe parse):** Added `stripJsoncComments()` helper in `main.ts`; `setup:write-mcp-config` now strips JSONC comments before `JSON.parse()` so VS Code / Cursor settings files with `//` or `/* */` comments are merged correctly.
- **Fix 2 (Claude Code dual detection):** `setup:detect-ides` now treats either `~/.claude/settings.json` (older) or `~/.claude/mcp.json` (fresh MCP-first install) as proof of Claude Code; `settingsPath` prefers `mcp.json` when present.
- **Tests:** 21 new tests (SETUP-06b/c/d + SETUP-21-27). Core: 812/812 passing (21 new). TSC: 0 errors.

**ONBOARD.1: First-Launch Setup Walkthrough (COMPLETE 2026-03-18):**
- **`src/components/ui/SetupWizard.tsx`** -- 5-step full-screen wizard (welcome, ide-detect, mcp-snippet, verify, done). Local React state only, no Zustand store. Uses `window.flintAPI.setup.*` IPC for IDE detection and first-launch flag. Uses `window.flintAPI.mcp.callTool('flint_status')` for connection verification.
- **`electron/main.ts`** -- 3 IPC handlers: `setup:detect-ides` (macOS IDE path detection via `existsSync`), `setup:check-first-launch` (reads `~/.flint/setup.json`), `setup:complete-first-launch` (writes flag). Claude Code detection checks `settings.json` but returns `mcp.json` as the config target.
- **`electron/preload.ts`** -- `setup` namespace added to `window.flintAPI`.
- **`src/types/flint-api.d.ts`** -- `setup` property added as required on `FlintAPI` interface.
- **`src/App.tsx`** -- Wizard gate inserted before LaunchScreen gate with 3-second timeout fallback.
- **Tests:** 22 wizard tests (SetupWizard.test.tsx) + 14 IPC tests (setupIpc.test.ts) = 36 new tests.
- **Validation:** Integration report at `.flint-context/contracts/ONBOARD.1-validation.md`. Verdict: SHIP.
- Glass: 592/592 | Core: 791/791 | MCP: 1886/1886 | TSC: 0 errors

**Remaining architectural gaps (Sprint 4):**
4. Duplicated MRS formula in `riskApproval.test.ts` — no sync enforcement with `orchestrator.ts`

**Note:** Master Plan uses V.1 (Risk Scoring) and V.2 (Mutation Provenance). JTBD plan uses V.1-gd (Governance Dashboard) and V.2-af (Activity Feed). These are different features — use full phase codes to avoid confusion.
