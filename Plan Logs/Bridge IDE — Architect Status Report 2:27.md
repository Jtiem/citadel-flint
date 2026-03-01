
[BRIDGE-PULSE-v5.7]

Active Module: Phase F (Multi-file Support) — Transitioning F.1 → F.2.
AST Integrity Report:
    - Status: GREEN
    - Conflicts: 0 detected.
    - Note: Clean Slate Protocol active on file switch.

Mithril Drift:
    - ΔE Warnings: N/A (Backend/State logic).
    - A11y Blocks: 0.

Pending Mutations: Map<filePath, BabelAST> initialization in editorStore.ts.

Next Gate: Macro-Recovery Baseline (Git Init) & Relative Import Resolution.

---

Inbound Audit: [BRIDGE-PULSE-v5.7]

The audit identifies the roadmap to harden the "Agentic UI Operating System" against structural drift.

    Mithril Violation: The lack of relative path resolution in synthesizeImports will lead to "dirty" code (broken imports) upon cross-file component moves.
    Integrity Risk: Absence of a Git repository renders the Macro-Recovery Engine (Module D) non-functional.
    Protocol Hardening: [RESOLVED] Explicit iframe invalidation signal added to `clearAST()` to prevent Ghost Overlays.

Phase A: Session Initialization (Memory Refresh Gate)

Current Alignment Status:
Domain          Status      Required Action
AST Readiness   AMBER       Hardening of synthesizeImports for relative path resolution.
Buffer Management LOCKED    Single-AST model confirmed; Multi-AST logic must remain sequential.
Recovery Engine CRITICAL    Initialize Git repository to enable gitShow logic.
Visual Integrity GREEN       HARDENED: Explicit `CLEAR_PREVIEW` signal added to file switch.

---

# Bridge IDE — Architect Status Report
**Date:** 2026-02-28 | **Model handoff:** Claude Sonnet 4.6 → Antigravity (Claude)

## Project Identity
**Name:** Bridge IDE
**Path:** `/Users/justintiemann/Documents/AI Coding/Lunar Elevator - Bridge`
**Stack:** Electron 33 + Vite + React 18 + TypeScript (strict) + Tailwind v4 + Monaco Editor + Babel + better-sqlite3 + Zustand v5
**Build:** `npm run dev` (Vite dev server + Electron).
**Tests:** `npm test` → 32/32 passing.

## What This App Is
Bridge IDE is a local-first Electron IDE for visual component editing. Its core loop:
1. User opens a `.tsx` file → raw source loads into Monaco.
2. Babel parses it → Babel AST stored in Zustand (`editorStore.ast`).
3. A simplified `VisualLayer[]` tree is built from the AST → renders in the Layer Tree panel.
4. `code:transform` IPC call sends the TSX to main process → Babel injects `data-bridge-id` attrs + strips imports + rewrites export default → srcdoc iframe renders live preview.
5. Clicking a node in the iframe fires `CANVAS_CLICK` postMessage → selection synced to both stores.
6. AST mutations update `rawCode` → auto-saved to disk via `FileTransactionManager` (atomic two-phase write).

## Completed Phases

### Phase C.5 — Properties Inspector Bridge
- `ast-parser.ts`: `VisualLayer` extended with `style` and `textContent` extraction. Handles both literal and expression-based text.
- `PropertiesPanel.tsx`: Read-only `NodeProperties` UI showing `className`, `style`, `textContent`.

### Phase C.7 — The Persistence Loop
- `FileTransactionManager`: Atomic FIFO write queue for concurrent-safe disk persistence.
- `canvasStore.ts`: `activeFilePath` tracking + debounced (1s) `triggerAutoSave`.
- `editorStore.ts`: All mutation actions (drag, class edit, component inject) trigger immediate auto-save.

### Phase C.8 — Text Editing & Visual Integrity (HOT)
- **AST Surgery**: Added `updateJSXTextContent` to `ast-parser.ts`. Handles line:col matching and `data-bridge-id` lookup. Correctly targets the first non-empty `JSXText` child.
- **Store Wiring**: `updateNodeProperty` now supports `propName === 'textContent'`.
- **Ghost Overlay Fix**: `clearAST()` now explicitly dispatches a `CLEAR_PREVIEW` postMessage to the iframe, instantly wiping the preview DOM on file switch to prevent stale visual layers.

## Current File Inventory (key files)
| File | Role |
|------|------|
| `electron/FileTransactionManager.ts` | Atomic file writer singleton (Two-phase write) |
| `src/core/ast-parser.ts` | **Babel Core**: parse/generate/buildVisualTree/updateJSXClassName/updateJSXTextContent |
| `src/store/editorStore.ts` | Main AST state + mutation actions (`updateNodeProperty`, `moveLayerNode`, etc.) |
| `src/utils/astModifier.ts` | Higher-level mutation logic: `moveNode`, `injectComponent` |
| `src/components/editor/LivePreview.tsx` | Iframe bridge + Ghost Proxy Shield |

## Known Stubs / Deferred Work
- **Relative Path Synthesis**: `synthesizeImports` currently assumes absolute paths or package names; needs logic to compute relative paths for local file component moves.
- **PropertiesPanel write capability**: `textContent` and `className` are now writable via AST; `style` and other arbitrary props remain read-only.
- **Macro-Recovery Engine (Phase D)**: Requires Git initialization to perform `git show` node transplants.

## Next Gate
1. **Initialize Git Repository**: Mandatory for Phase D recovery features.
2. **Harden `synthesizeImports`**: Add path resolution for multi-file moves.
3. **Generalize Prop Editing**: Implement `updateJSXProp` for arbitrary attribute editing.

## Constraints for New Work
- No Node.js imports in `src/`.
- All mutation results must pass through `editorStore.ts` to trigger the `triggerAutoSave` pipeline.
- `tsc -b` and `npm test` must remain green.
