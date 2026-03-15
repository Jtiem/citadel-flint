# Project: Bridge IDE

## The Identity (v7.0)
**Bridge** is the first Agentic UI Operating System. It is a strict "containment field" for high-velocity AI agents, ensuring brand, accessibility, and codebase integrity through deterministic AST-level enforcement (Mithril Philosophy).

## Tech Stack
* **Shell:** Electron (v40+)
* **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite
* **Canvas Engine:** `@xyflow/react` (React Flow v12)
* **State Management:** Zustand v5
* **Persistence:** SQLite (`better-sqlite3`) + PowerSync SDK (Sync Layer)
* **Preview Engine:** Custom `srcdoc` iframe + Babel Renderer IPC (100% Offline)
* **AST Factory:** Babel (TSX ↔ Visual Tree)

## Core modules (v6.6 Architecture)
* **Module A (AST Canvas):** ID-Indestructible Select (`data-bridge-id`) + Figma-Grade DnD.
* **Module B (Mithril Safety):** CIEDE2000 ΔE Perceptual Drift calculations (Amber warnings if ΔE > 2.0).
* **Module C (Sync Layer):** PowerSync CRDT partitioning (Global Tokens / Project Overrides / Presence).
* **Module D (Recovery Engine):** Command-pattern AST inversions (Undo/Redo) + Surgical Git Transplants.
* **Module E (Persistence):** Atomic Write Queue (`FileTransactionManager`) + Continuous Auto-Save.
* **Module F (Multi-AST):** Headless AST buffers for cross-file surgery (Phase F.2).

## Architecture Specification & Modules
| Module | State | Notes |
|--------|-------|-------|
| Code-First Recovery (Phase D.1) | **ONLINE** | `gitShow` IPC and surgical `transplantNode` AST replacement. |
| Git Time Machine UI (Phase D.2) | **ONLINE** | `ast:git-log` IPC + `RecoveryPanel.tsx` + `revertNodeToCommit` store action. |
| Multiplayer Presence (Phase C.1) | **ONLINE** | `PresenceService.ts` throttled UPSERT + `useRemotePresence` 5Hz poll + remote cursor SVG overlay in LivePreview. |
| AST Conflict Arbiter (Phase C.2) | **ONLINE** | `useLockedNodeIds` + `useIsNodeLocked`. Blocks drag, selection, and edits on nodes held by remote users. |
| Infinite Canvas (Module A) | **ONLINE** | `XYCanvas.tsx` — `@xyflow/react` v12 whiteboard. LivePreview hosted as a draggable custom node; pan + zoom + minimap. |
| Export Gate (Phase B.2) | **ONLINE** | `ExportModal.tsx` pre-flight audit — reads `component_overrides` + all Mithril violation categories + `a11yViolations`. |
| Accessibility Gate (Phase B.3) | **ONLINE** | `A11yLinter.ts` — **10 WCAG 2.1 AA rules** (A11Y-001..010): img, button, a, input, select, textarea, table, html lang, tabIndex, heading skip. |
| Mithril Enterprise Linter (Module B v2) | **ONLINE** | `MithrilLinter.ts` — 5 AST visitors + `auditAll()`: CIEDE2000 color drift + typography (TYP-001..005) + spacing (SPC-001) + shadow (SHD-001) + opacity (OPC-001). TokenType expanded to 10; 27 enterprise demo tokens seeded. |
| Batch Mutation Engine (Phase E.1) | **ONLINE** | `ASTService.applyMutationBatch` + `applyInversions`. Single parse→mutate→generate cycle per batch. |
| `FileTransactionManager` (Phase E.2) | **ONLINE** | `electron/FileTransactionManager.ts`. Atomic `.tmp`→`rename` writes, serialised per path. |
| `canvasStore` + Auto-Save (Phase F.1) | **ONLINE** | `triggerAutoSave` debounced IPC save. `saveState: 'idle'｜'editing'｜'saving'｜'saved'`. |
| Cross-File Move (Phase F.2) | **ONLINE** | `astBufferStore.crossFileMove` 11-step atomic operation. `FileExplorer` cross-file drag. |
| Global Recovery Engine (Phase G.1) | **ONLINE** | `src/core/recoveryController.ts`. `Cmd+Z`/`Cmd+Shift+Z`. Single-file and cross-file undo. |
| Scaffolding & Registry (Phase G.2) | **ONLINE** | `bridge-registry.db`, `templateService.ts`, `LaunchScreen.tsx`. Global workspace tracking. |
| Cross-File Redo (Phase H) | **ONLINE** | `CrossFileMoveRedoPlan` schema. `isRecovery` flag prevents history duplication on redo. |
| Interaction Modes (Phase I) | **ONLINE** | `canvasMode: 'design'|'interact'` in `canvasStore`. Shield gated on design mode. |
| Native OS Menu (Phase J) | **ONLINE** | `menu:new/open/close-project` IPC channels. `MenuAPI` on `window.bridgeAPI`. |
| Undo Void Fix (Phase K) | **ONLINE** | `applyBatch` no-op guard + `setCode` Commandment-10 fix + all property edits undoable. |
| Post-Redo Undoability | **ONLINE** | `historyStore.pushPast` + `crossFileMove` inversions return. |
| Sharma Validation (Module B.1-b) | **ONLINE** | `snippetAuditor.ts` AST-injection robust against Fragment/Shadow scope. |
| AI Orchestrator Hardening (Phase M) | **ONLINE** | `orchestrator.ts` restricted to 7-tool AST Tool Catalog. No raw code strings. In-memory TSC validation loop before confirmation UI. Design system RAG via `sqlite-vec`. |
| Export Gate Severity Escalation (Phase B.1-d) | **ONLINE** | `ExportModal.tsx` reads `editorStore.linterWarnings` per violation ID. Critical (ΔE > 10) → red header + red row badge. Amber (2.0–10.0) → amber styling. `hasCriticalMithril` gate computation. 21 new Vitest tests in `MithrilLinter.severity.test.ts`. |
| Designer Experience (Phase N.1) | **ONLINE** | `LayoutPanel.tsx` Figma-grade layout controls. `layoutMapper.ts` Tailwind atomic management. |
| Figma Ingestion (Phase O) | **ONLINE** | `ingestion-server.ts` loopback server + `normalizer.ts` Figma → DTCG mapping + `/ingest-ast` integration. |
| LSP Orchestrator (Phase P) | **ONLINE** | TypeScript and Vue LSP clients for cross-file intelligence. |

## Critical AI Directives
1.  **Architecture Spec:** Always consult `.bridge-context/architecture.md` and `.antigravityrules`.
2.  **Mithril Safety:** If ΔE > 2.0, code must be auto-fixed or Amber-flagged.
3.  **Persistence Rule:** All mutations MUST be atomic and saved via the `FileTransactionManager` queue.
4.  **No Hallucinations:** Use Babel AST traversal for all code changes. Never use Regex for source code.
5.  **Documentation Autopilot:** No session ends without a `[BRIDGE-PULSE-v6.9]` block update.
6.  **Granular AST Tools Only (Commandment 15):** The AI Orchestrator MUST only emit ops from the versioned AST Tool Catalog (`updateProps`, `updateText`, `insertNode`, `wrapNode`, `deleteNode`, `addClassName`, `removeClassName`). Raw code string generation is prohibited.
7.  **In-Memory Validation Loop (Commandment 16):** `orchestrator.ts` MUST run an in-memory TSC type-check on all AI output before surfacing a confirmation UI. Hallucinations feed back as an invisible prompt — never a broken diff.

## Installed Plugin Skills (Auto-Use)
When working on Bridge, automatically use these installed skills without being asked:
* **`/vitest`** — Consult when writing or debugging tests. Bridge uses Vitest 3.x with `vitest.config.react.ts`.
* **`/vite`** — Consult when touching `vite.config.ts`, build config, or HMR issues.
* **`/ast-grep`** — Use for structural code search across the AST codebase (e.g., finding all Babel visitors, mutation patterns, or component structures). Prefer over regex for code pattern matching.
* **`/agent-browser`** — Use for Electron app testing, browser automation, or E2E validation of the LivePreview.
* **`accessibility-specialist`** agent — Spawn proactively when creating or modifying UI components to ensure WCAG 2.1 AA compliance (aligns with A11yLinter Phase B.3).
* **`ui-ux-designer`** agent — Spawn when designing new panels, modals, or layout changes.

### Plugin Marketplaces (installed at `~/.claude/plugins/marketplaces/`)
* `claude-plugins-official` — Anthropic official plugins
* `pleaseai` — Community plugins (vitest, vite, ast-grep, agent-browser, etc.)
* `buildwithclaude` — 489+ extensions (agents, skills, hooks, commands)

## Commands
* `npm run dev`: Launch Bridge IDE (Vite + Electron)
* `npm test`: Run Vitest suite
* `npx tsc --noEmit`: Strict Type Check