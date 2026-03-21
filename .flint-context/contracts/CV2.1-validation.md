# Validation Spec: CV2.1 — Build/Govern Canvas Mode Toggle

**Phase:** CV2.1
**Date:** 2026-03-20
**For:** flint-integration-validator

---

## 1. Type Check

Run `npx tsc --noEmit` from the project root. Must produce 0 errors.

---

## 2. IPC Symmetry

**N/A** — No new IPC channels in CV2.1. Confirm no accidental IPC additions by verifying:
- `electron/main.ts` has no new `ipcMain.handle` calls referencing `canvas-view`, `CV2`, or `canvasView`.
- `electron/preload.ts` has no new `ipcRenderer.invoke` calls referencing `canvas-view`, `CV2`, or `canvasView`.

---

## 3. Store Isolation

Confirm:
- [ ] `canvasStore.ts` does NOT import any other Zustand store at the module level (existing lazy import in `setActiveFile` is acceptable).
- [ ] `canvasStore.ts` does NOT call `window.flintAPI` in `setCanvasView` (it is a pure state setter).
- [ ] No new store files created.

---

## 4. Contract Fidelity

### 4.1 CanvasView Type

- [ ] `CanvasView` type is exported from `src/store/canvasStore.ts`.
- [ ] `CanvasView` is defined as `'preview' | 'build' | 'govern'` (exactly three members).
- [ ] `canvasView` property exists on the store state interface.
- [ ] `setCanvasView` action exists on the store actions interface.
- [ ] Initial value of `canvasView` is `'preview'`.

### 4.2 closeWorkspace Reset

- [ ] The `closeWorkspace` action's `set({...})` call includes `canvasView: 'preview'`.

### 4.3 CanvasViewToggle Component

- [ ] File exists at `src/components/editor/CanvasViewToggle.tsx`.
- [ ] Named export `CanvasViewToggle`.
- [ ] Renders three buttons with `data-testid` attributes: `canvas-view-preview`, `canvas-view-build`, `canvas-view-govern`.
- [ ] Each button calls `setCanvasView` with the correct view value.
- [ ] Each button has an `aria-label` attribute.
- [ ] Uses `lucide-react` icons only (Eye, LayoutGrid, ShieldCheck).
- [ ] Active segment has visual distinction (indigo highlight or equivalent).

### 4.4 XYCanvas Modifications

- [ ] `XYCanvas.tsx` imports and renders `CanvasViewToggle`.
- [ ] `XYCanvas.tsx` subscribes to `canvasView` from `canvasStore`.
- [ ] When `canvasView === 'preview'`: ReactFlow and GhostCodeSnippet render.
- [ ] When `canvasView === 'build'`: A placeholder with `data-testid="canvas-build-placeholder"` renders. ReactFlow does NOT render.
- [ ] When `canvasView === 'govern'`: A placeholder with `data-testid="canvas-govern-placeholder"` renders. ReactFlow does NOT render.
- [ ] `CanvasViewToggle` renders in all three view modes.
- [ ] Cross-file drop handler (`handleDrop`) is gated behind `canvasView === 'preview'` or is otherwise no-op in non-preview modes.

### 4.5 App.tsx Keyboard Shortcuts

- [ ] Cmd+1 (or Ctrl+1 on non-Mac) calls `setCanvasView('preview')`.
- [ ] Cmd+2 (or Ctrl+2 on non-Mac) calls `setCanvasView('build')`.
- [ ] Cmd+3 (or Ctrl+3 on non-Mac) calls `setCanvasView('govern')`.
- [ ] Shortcuts do NOT fire when `e.shiftKey` is true.
- [ ] Shortcuts are inside the existing `handleKeyDown` function, gated by the INPUT/TEXTAREA/SELECT guard.
- [ ] Each shortcut calls `e.preventDefault()`.

### 4.6 StatusBar View Indicator

- [ ] `StatusBar.tsx` subscribes to `canvasView` from `canvasStore`.
- [ ] No indicator renders when `canvasView === 'preview'`.
- [ ] "Build View" indicator renders when `canvasView === 'build'`.
- [ ] "Govern View" indicator renders when `canvasView === 'govern'`.
- [ ] Indicator has `data-testid="statusbar-canvas-view"`.

---

## 5. Commandment Compliance

| # | Commandment | Check |
|---|------------|-------|
| 4 | Local-First Only | Confirm no `fetch()`, `XMLHttpRequest`, or external URL references in any changed file. |
| 9 | Process Boundary | Confirm no `fs`, `path`, `child_process`, `electron`, or `better-sqlite3` imports added to any file in `src/`. |

---

## 6. Test Coverage

### 6.1 Required Test IDs

All of these test cases must exist and pass:

**Store tests** (`src/store/__tests__/canvasStore.canvasView.test.ts`):

| ID | Description |
|----|-------------|
| CV-STORE-01 | Initial `canvasView` is `'preview'` |
| CV-STORE-02 | `setCanvasView('build')` transitions state |
| CV-STORE-03 | `setCanvasView('govern')` transitions state |
| CV-STORE-04 | `setCanvasView('preview')` transitions back |
| CV-STORE-05 | `closeWorkspace()` resets `canvasView` to `'preview'` |
| CV-STORE-06 | Setting the same view twice is idempotent |

**Toggle tests** (`src/components/editor/__tests__/CanvasViewToggle.test.tsx`):

| ID | Description |
|----|-------------|
| CV-TOGGLE-01 | Renders three buttons |
| CV-TOGGLE-02 | Preview button has active styling when `canvasView === 'preview'` |
| CV-TOGGLE-03 | Clicking Build button calls `setCanvasView('build')` |
| CV-TOGGLE-04 | Clicking Govern button calls `setCanvasView('govern')` |
| CV-TOGGLE-05 | Active segment changes visual highlight |
| CV-TOGGLE-06 | All buttons have accessible labels |
| CV-TOGGLE-07 | All buttons have `data-testid` attributes |

**Canvas tests** (in `src/components/editor/__tests__/`):

| ID | Description |
|----|-------------|
| CV-CANVAS-01 | ReactFlow renders when `canvasView === 'preview'` |
| CV-CANVAS-02 | Build placeholder renders when `canvasView === 'build'` |
| CV-CANVAS-03 | Govern placeholder renders when `canvasView === 'govern'` |
| CV-CANVAS-04 | CanvasViewToggle renders in all three modes |
| CV-CANVAS-05 | GhostCodeSnippet only renders in preview mode |

**StatusBar tests** (inline or standalone):

| ID | Description |
|----|-------------|
| CV-SB-01 | No view indicator when `canvasView === 'preview'` |
| CV-SB-02 | "Build View" indicator when `canvasView === 'build'` |
| CV-SB-03 | "Govern View" indicator when `canvasView === 'govern'` |

**Keyboard shortcut tests** (inline or standalone):

| ID | Description |
|----|-------------|
| CV-KB-01 | Cmd+1 sets `canvasView` to `'preview'` |
| CV-KB-02 | Cmd+2 sets `canvasView` to `'build'` |
| CV-KB-03 | Cmd+3 sets `canvasView` to `'govern'` |
| CV-KB-04 | Shortcuts do not fire when focus is in an INPUT element |
| CV-KB-05 | Cmd+Shift+1 does NOT trigger view switch |

**Minimum total:** 24 test cases.

### 6.2 Test Suite Execution

Run all three test suites and report exact counts:

```
MCP:   <count>/<count> passing (0 new -- not touched)
Glass: <count>/<count> passing (<N> new)
Core:  <count>/<count> passing (0 new -- not touched)
TSC:   0 errors
```

Confirm no regressions against baseline:
- MCP: 2,046 baseline
- Glass: 642 baseline
- Core tests: existing baseline
- TSC: 0 errors

---

## 7. Process Boundary

- [ ] No new `import` statements in `src/` reference `fs`, `path`, `child_process`, `os`, `electron`, `better-sqlite3`, `@electron/*`, or any Node.js built-in.
- [ ] No new `window.flintAPI` calls added (this feature is pure store + React).
- [ ] No `ipcRenderer` references added anywhere.

---

## 8. Scope Creep Check

Confirm these items are NOT implemented:
- [ ] No component library card grid (CV2.3 scope).
- [ ] No compliance map visualization (CV2.4 scope).
- [ ] No `useContextSync` changes (canvasView is not written to `.flint/context.json`).
- [ ] No undo/redo entries for view switching.
- [ ] No SQLite schema changes.
- [ ] No MCP tool or resource additions.
- [ ] No `electron/main.ts` changes.
- [ ] No `electron/preload.ts` changes.

---

## 9. Output Format

```markdown
# Integration Report: CV2.1 — Build/Govern Canvas Mode Toggle

## Status: PASS | FAIL

## Type Check: PASS | FAIL (with errors)
## IPC Symmetry: N/A — no new channels (PASS if no accidental additions)
## Store Isolation: PASS | FAIL (list violations)
## Contract Fidelity: PASS | FAIL (list gaps)
## Commandment Compliance: PASS | FAIL (list violations)
## Test Coverage: X/24 test cases covered
## Process Boundary: PASS | FAIL (list violations)
## Scope Creep: PASS | FAIL (list unauthorized additions)

## Test Results
MCP:   <count>/<count> passing (0 new)
Glass: <count>/<count> passing (<N> new)
Core:  <count>/<count> passing (0 new)
TSC:   0 errors

## Issues Found
1. (description + file:line + recommended fix)

## Verdict
- SHIP: All checks pass
- FIX: Issues found, list which Phase 2 agent should fix what
- REDESIGN: Contract was fundamentally wrong, return to Phase 1
```
