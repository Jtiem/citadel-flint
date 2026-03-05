# Project: Bridge IDE

## The Identity (v6.8)
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
| Export Gate (Phase B.2) | **ONLINE** | `ExportModal.tsx` pre-flight audit — reads `component_overrides` + `mithrilViolations` + `a11yViolations`. |
| Accessibility Gate (Phase B.3) | **ONLINE** | `A11yLinter.ts` — 4 WCAG rules checked on every AST parse. Blocks export via `canExport`. |
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

## Critical AI Directives
1.  **Architecture Spec:** Always consult `.bridge-context/architecture.md` and `.antigravityrules`.
2.  **Mithril Safety:** If ΔE > 2.0, code must be auto-fixed or Amber-flagged.
3.  **Persistence Rule:** All mutations MUST be atomic and saved via the `FileTransactionManager` queue.
4.  **No Hallucinations:** Use Babel AST traversal for all code changes. Never use Regex for source code.
5.  **Documentation Autopilot:** No session ends without a `[BRIDGE-PULSE-v6.9]` block update.

## Commands
* `npm run dev`: Launch Bridge IDE (Vite + Electron)
* `npm test`: Run Vitest suite
* `npx tsc --noEmit`: Strict Type Check