# Contract Artifact: CV2.1 — Build/Govern Canvas Mode Toggle

**Phase:** CV2.1
**Status:** APPROVED
**Date:** 2026-03-20
**Author:** flint-architect

---

## 1. Impact Map

| File | Change Type | Owner Agent | Purpose |
|------|------------|-------------|---------|
| `src/store/canvasStore.ts` | MODIFY | flint-state-architect | Add `canvasView` state, `setCanvasView` action, reset in `closeWorkspace` |
| `src/components/editor/CanvasViewToggle.tsx` | CREATE | flint-design-engineer | Segmented control component (Preview/Build/Govern) |
| `src/components/editor/XYCanvas.tsx` | MODIFY | flint-design-engineer | Gate LivePreview on `canvasView === 'preview'`; show placeholder for build/govern |
| `src/App.tsx` | MODIFY | flint-design-engineer | Add Cmd+1/2/3 keyboard shortcuts for canvas view switching |
| `src/components/editor/StatusBar.tsx` | MODIFY | flint-design-engineer | Add view mode indicator chip |
| `src/components/editor/__tests__/CanvasViewToggle.test.tsx` | CREATE | flint-test-writer | Unit tests for toggle component |
| `src/store/__tests__/canvasStore.canvasView.test.ts` | CREATE | flint-test-writer | Store state transition tests |

---

## 2. Type Contracts

### 2.1 Canvas View Mode

```typescript
/**
 * The three canvas view modes. Only 'preview' is functional in CV2.1.
 * 'build' and 'govern' render placeholder panels until CV2.3/CV2.4.
 *
 *   preview — current behavior: single LivePreview iframe node on the canvas
 *   build   — component library cards (CV2.3 will implement)
 *   govern  — compliance map cards (CV2.4 will implement)
 */
export type CanvasView = 'preview' | 'build' | 'govern'
```

### 2.2 New State & Actions on CanvasStore

```typescript
// Added to the CanvasState interface:
interface CanvasState {
  // ... existing fields ...

  /**
   * Current canvas view mode.
   *   'preview' — Live Preview iframe (default, current behavior)
   *   'build'   — Component library cards (CV2.3 placeholder)
   *   'govern'  — Compliance map cards (CV2.4 placeholder)
   *
   * Persisted across sessions via the existing auto-save mechanism:
   * canvasView is stored in canvasStore and survives workspace close/reopen
   * because closeWorkspace resets it to 'preview' (the safe default).
   */
  canvasView: CanvasView
}

// Added to the CanvasActions interface:
interface CanvasActions {
  // ... existing actions ...

  /**
   * Switches the canvas view mode. Called by:
   *   - CanvasViewToggle segmented control clicks
   *   - Cmd+1/2/3 keyboard shortcuts in App.tsx
   */
  setCanvasView: (view: CanvasView) => void
}
```

### 2.3 CanvasViewToggle Props

```typescript
/**
 * CanvasViewToggle — a segmented control rendered inside the XYCanvas area.
 * No props required. Reads and writes canvasView directly from canvasStore.
 */
// No props interface needed — the component is self-contained via store subscription.
```

---

## 3. IPC Channels

No new IPC channels. This feature is entirely renderer-side state and UI.

| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| (none)  | —         | —       | —      |

---

## 4. Store Contracts

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| `canvasStore` | `canvasView: CanvasView` (default: `'preview'`) | `setCanvasView(view: CanvasView)` | Direct subscription: `useCanvasStore(s => s.canvasView)` |

### 4.1 Store Implementation Details

**Initial value:** `canvasView: 'preview' as CanvasView`

**`setCanvasView` action:**
```typescript
setCanvasView: (view) => set({ canvasView: view }),
```

**`closeWorkspace` reset — add `canvasView: 'preview'` to the reset object:**
The existing `closeWorkspace` action resets all workspace state. `canvasView` must be included in the reset to prevent stale view mode bleeding across projects.

```typescript
closeWorkspace: () => {
    // ... existing timer cleanup ...
    set({
        // ... existing reset fields ...
        canvasView: 'preview',
    })
},
```

**Type export:** `CanvasView` must be exported from `canvasStore.ts` alongside the existing `CanvasMode`, `SaveState`, and `RightTab` type exports.

---

## 5. Component Contracts

### 5.1 CanvasViewToggle

| Aspect | Value |
|--------|-------|
| File | `src/components/editor/CanvasViewToggle.tsx` |
| Props | None |
| Store dependencies | `canvasStore.canvasView`, `canvasStore.setCanvasView` |
| IPC calls | None |

**Behavior:**

- A floating segmented control positioned absolutely in the top-center of the canvas area.
- Three segments, each with an icon and a label:
  1. **Preview** — `Eye` icon from `lucide-react` — sets `canvasView` to `'preview'`
  2. **Build** — `LayoutGrid` icon from `lucide-react` — sets `canvasView` to `'build'`
  3. **Govern** — `ShieldCheck` icon from `lucide-react` — sets `canvasView` to `'govern'`
- The active segment has an indigo highlight (`bg-indigo-600 text-white`). Inactive segments have muted styling (`text-zinc-400 hover:text-zinc-200`).
- Container styling: `rounded-lg border border-gray-700 bg-gray-900/90 backdrop-blur-sm shadow-lg` — floats above the canvas background.
- Positioned via `absolute top-3 left-1/2 -translate-x-1/2 z-10` within the XYCanvas wrapper.
- Each button has a `title` tooltip and `aria-label` for accessibility.
- Each button has `data-testid` attributes: `canvas-view-preview`, `canvas-view-build`, `canvas-view-govern`.

**Visual spec:**
```
+-------------------------------------------+
|  [Eye] Preview  |  [Grid] Build  |  [Shield] Govern  |
+-------------------------------------------+
     ^active (indigo)    muted         muted
```

### 5.2 XYCanvas Modifications

| Aspect | Value |
|--------|-------|
| File | `src/components/editor/XYCanvas.tsx` |
| Change | Conditional rendering based on `canvasView` |
| Store dependencies | `canvasStore.canvasView` (new) |

**Behavior:**

- Import `useCanvasStore` selector for `canvasView` and the `CanvasViewToggle` component.
- When `canvasView === 'preview'`: render the existing ReactFlow canvas with LivePreview node (current behavior, unchanged).
- When `canvasView === 'build'`: render a centered placeholder panel instead of ReactFlow:
  - Heading: "Component Library"
  - Subtext: "Coming in CV2.3 — browse, search, and insert components from your design system."
  - Icon: `LayoutGrid` from `lucide-react`, large and muted.
  - Container: `flex flex-col items-center justify-center h-full text-center`
  - `data-testid="canvas-build-placeholder"`
- When `canvasView === 'govern'`: render a centered placeholder panel instead of ReactFlow:
  - Heading: "Compliance Map"
  - Subtext: "Coming in CV2.4 — visualize health grades, drift scores, and dependency edges across your components."
  - Icon: `ShieldCheck` from `lucide-react`, large and muted.
  - Container: `flex flex-col items-center justify-center h-full text-center`
  - `data-testid="canvas-govern-placeholder"`
- The `CanvasViewToggle` component renders in ALL three modes (always visible above the content area).
- The `GhostCodeSnippet` overlay only renders when `canvasView === 'preview'` (it depends on the ReactFlow canvas context).

**Structural change to the return JSX:**

```tsx
return (
    <div className="relative h-full w-full ..." data-testid="xy-canvas-container">
        {/* Toggle is always visible */}
        <CanvasViewToggle />

        {canvasView === 'preview' && (
            <>
                <ReactFlow ...>
                    {/* Background, Controls, MiniMap */}
                </ReactFlow>
                <GhostCodeSnippet />
            </>
        )}

        {canvasView === 'build' && (
            <div data-testid="canvas-build-placeholder" className="...">
                {/* Build placeholder */}
            </div>
        )}

        {canvasView === 'govern' && (
            <div data-testid="canvas-govern-placeholder" className="...">
                {/* Govern placeholder */}
            </div>
        )}
    </div>
)
```

### 5.3 App.tsx Keyboard Shortcuts

| Aspect | Value |
|--------|-------|
| File | `src/App.tsx` |
| Change | Add Cmd+1/2/3 handlers to the existing `handleKeyDown` function |

**Behavior:**

Add three keyboard shortcut handlers inside the existing `handleKeyDown` function in the `useEffect` at approximately line 291. These go after the existing `meta` check (line 309) and before the undo/redo handlers:

```typescript
// ── CV2.1: Canvas View shortcuts ──────────────────────────────────────
if (meta && !e.shiftKey) {
    if (e.key === '1') {
        e.preventDefault()
        useCanvasStore.getState().setCanvasView('preview')
        return
    }
    if (e.key === '2') {
        e.preventDefault()
        useCanvasStore.getState().setCanvasView('build')
        return
    }
    if (e.key === '3') {
        e.preventDefault()
        useCanvasStore.getState().setCanvasView('govern')
        return
    }
}
```

**Placement:** After the `const meta = e.metaKey || e.ctrlKey` line and before the `Cmd+Shift+G` block. The shortcuts fire only when `meta` is pressed and `shift` is NOT pressed (to avoid collision with existing Cmd+Shift+G for autopilot apply).

**Input guard:** These handlers are gated by the existing `INPUT/TEXTAREA/SELECT` early return at line 293, so they will not fire when the user is typing in form fields.

### 5.4 StatusBar View Mode Indicator

| Aspect | Value |
|--------|-------|
| File | `src/components/editor/StatusBar.tsx` |
| Change | Add a view mode indicator chip |
| Store dependencies | `canvasStore.canvasView` (new) |

**Behavior:**

- Subscribe to `canvasView` from `canvasStore`.
- Render a small text indicator in the status bar showing the current view mode.
- Only visible when the mode is NOT `'preview'` (since preview is the default and showing it would be noise).
- Positioned after the "Babel AST Parser Active" indicator and before the Scratchpad indicator.
- Styling: `text-xs text-indigo-400` with a dot indicator.
- Content:
  - When `canvasView === 'build'`: `"Build View"`
  - When `canvasView === 'govern'`: `"Govern View"`

```tsx
{canvasView !== 'preview' && (
    <span
        className="flex items-center gap-1 text-xs text-indigo-400"
        data-testid="statusbar-canvas-view"
    >
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        {canvasView === 'build' ? 'Build View' : 'Govern View'}
    </span>
)}
```

---

## 6. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|------------|---------|---------------|
| 1 | Code is Truth | NO | This feature is UI state only -- no AST mutations, no source file changes. `canvasView` is ephemeral view state, not code truth. |
| 4 | Local-First Only | YES | No network calls. All state is local Zustand. No external URLs. |
| 7 | ID Preservation | NO | No AST structural operations. `data-flint-id` is not touched. |
| 9 | CIEDE2000 | NO | No color/drift logic involved. |
| 10 | Targeted Micro-Recovery | NO | No undo/redo changes. The canvas view mode is not undoable (it is UI navigation state, not a mutation). |
| 13 | Deterministic Surgery | NO | No code modification. |

**Process Boundary Law:** NOT CROSSED. This feature is entirely renderer-side (React + Zustand). No new IPC channels, no main process changes, no preload changes.

---

## 7. Implementation Order

### Group 1 (parallel) — State + UI

**Agent: flint-state-architect** (canvasStore changes)

1. Add `CanvasView` type to `src/store/canvasStore.ts` (alongside existing `CanvasMode` type).
2. Add `canvasView: CanvasView` to `CanvasState` interface with default `'preview'`.
3. Add `setCanvasView: (view: CanvasView) => void` to `CanvasActions` interface.
4. Implement `setCanvasView` action: `(view) => set({ canvasView: view })`.
5. Add `canvasView: 'preview'` to the `closeWorkspace` reset object.
6. Export `CanvasView` type.

**Agent: flint-design-engineer** (all UI components — can run in parallel with state because the store shape is defined in the contract)

1. Create `src/components/editor/CanvasViewToggle.tsx` per section 5.1.
2. Modify `src/components/editor/XYCanvas.tsx` per section 5.2:
   - Import `CanvasViewToggle` and subscribe to `canvasView`.
   - Gate ReactFlow + GhostCodeSnippet behind `canvasView === 'preview'`.
   - Add build and govern placeholder panels.
3. Modify `src/App.tsx` per section 5.3:
   - Add Cmd+1/2/3 keyboard shortcut handlers.
4. Modify `src/components/editor/StatusBar.tsx` per section 5.4:
   - Subscribe to `canvasView`.
   - Render non-preview indicator chip.

### Group 2 (after Group 1) — Tests

**Agent: flint-test-writer**

1. Create `src/store/__tests__/canvasStore.canvasView.test.ts`:
   - CV-STORE-01: Initial `canvasView` is `'preview'`.
   - CV-STORE-02: `setCanvasView('build')` transitions state to `'build'`.
   - CV-STORE-03: `setCanvasView('govern')` transitions state to `'govern'`.
   - CV-STORE-04: `setCanvasView('preview')` transitions state back to `'preview'`.
   - CV-STORE-05: `closeWorkspace()` resets `canvasView` to `'preview'`.
   - CV-STORE-06: Setting the same view twice is idempotent (no errors).

2. Create `src/components/editor/__tests__/CanvasViewToggle.test.tsx`:
   - CV-TOGGLE-01: Renders three buttons (preview, build, govern).
   - CV-TOGGLE-02: Preview button has active styling when `canvasView === 'preview'`.
   - CV-TOGGLE-03: Clicking Build button calls `setCanvasView('build')`.
   - CV-TOGGLE-04: Clicking Govern button calls `setCanvasView('govern')`.
   - CV-TOGGLE-05: Active segment changes visual highlight.
   - CV-TOGGLE-06: All buttons have accessible labels (`aria-label`).
   - CV-TOGGLE-07: All buttons have `data-testid` attributes.

3. XYCanvas conditional rendering tests (add to existing test file or create new):
   - CV-CANVAS-01: ReactFlow renders when `canvasView === 'preview'`.
   - CV-CANVAS-02: Build placeholder renders when `canvasView === 'build'` (check `data-testid`).
   - CV-CANVAS-03: Govern placeholder renders when `canvasView === 'govern'` (check `data-testid`).
   - CV-CANVAS-04: CanvasViewToggle renders in all three modes.
   - CV-CANVAS-05: GhostCodeSnippet only renders in preview mode.

4. StatusBar view indicator tests:
   - CV-SB-01: No view indicator when `canvasView === 'preview'`.
   - CV-SB-02: "Build View" indicator when `canvasView === 'build'`.
   - CV-SB-03: "Govern View" indicator when `canvasView === 'govern'`.

5. Keyboard shortcut tests (in App.tsx test or standalone):
   - CV-KB-01: Cmd+1 sets `canvasView` to `'preview'`.
   - CV-KB-02: Cmd+2 sets `canvasView` to `'build'`.
   - CV-KB-03: Cmd+3 sets `canvasView` to `'govern'`.
   - CV-KB-04: Shortcuts do not fire when focus is in an INPUT element.
   - CV-KB-05: Cmd+Shift+1 does NOT trigger view switch (shift guard).

### Group 3 (after Group 2) — Validation

**Agent: flint-integration-validator**

- Run `npx tsc --noEmit` -- 0 errors.
- Run `npm run test:react` -- all Glass tests pass.
- Run `npm test` -- all core tests pass.
- Verify contract fidelity against this document.
- Produce integration report at `.flint-context/contracts/CV2.1-validation.md`.

---

## 8. Risks

| Risk | Severity | Mitigation | Commandment Threatened |
|------|----------|-----------|----------------------|
| Cmd+1/2/3 conflicts with browser dev tools or Electron shortcuts | Low | Electron does not reserve Cmd+1/2/3 by default. These do not conflict with existing Flint shortcuts (Cmd+Z undo, Cmd+Shift+G autopilot). If a conflict is discovered during testing, fall back to Cmd+Shift+1/2/3 instead. | None |
| ReactFlow unmount/remount on view switch could lose canvas position | Medium | ReactFlow uses `defaultNodes` (uncontrolled mode). Switching away from preview unmounts ReactFlow; switching back remounts it with `INITIAL_NODES` and `fitView`. This is acceptable for CV2.1 since the user explicitly chose to leave preview. If canvas position persistence is needed, it can be added in a follow-up by storing node positions in state before unmounting. | None |
| `GhostCodeSnippet` portal orphan on view switch | Low | `GhostCodeSnippet` uses a portal into `document.body`. It reads `activeSelection` from canvasStore. When switching views, the underlying ReactFlow unmounts but GhostCodeSnippet is gated by `canvasView === 'preview'`, so it also unmounts cleanly. No orphan risk. | None |
| Cross-file drop handler fires in non-preview mode | Low | The drag/drop handlers in XYCanvas operate on the outer wrapper div. In build/govern mode, the ReactFlow target is gone, but the handlers still call `crossFileMove`. Gate the `handleDrop` callback behind `canvasView === 'preview'` so drops are no-ops in build/govern mode. | None |
| Existing `canvasMode` vs new `canvasView` naming confusion | Low | `canvasMode` is `'design' | 'interact'` (controls pointer event behavior within the LivePreview iframe). `canvasView` is `'preview' | 'build' | 'govern'` (controls which top-level content the canvas area shows). These are orthogonal concerns. Document the distinction in the store JSDoc. | None |

---

## 9. Non-Scope (Explicitly Excluded)

These items are NOT part of CV2.1. They are documented here to prevent scope creep:

1. **Component library cards** — CV2.3 will implement the build mode card grid with thumbnails, categories, variant counts, and insert buttons.
2. **Compliance map cards** — CV2.4 will implement the govern mode visualization with health grades, Delta-E drift scores, violation counts, and dependency edges.
3. **Context Flint update** — `canvasView` does NOT need to be written to `.flint/context.json` via `useContextSync`. The MCP server does not need to know the Glass view mode. If a future phase requires it, add it then.
4. **Undo/redo for view switching** — View mode is navigation state, not a mutation. It should not appear in the history stack.
5. **Per-project persistence** — The view mode resets to `'preview'` on workspace close (see section 4.1). If per-project view mode persistence is desired, it requires a SQLite column or settings file — out of scope for CV2.1.

---

## 10. Visual Design Notes

- Toggle container: `rounded-lg border border-gray-700 bg-gray-900/90 backdrop-blur-sm shadow-lg p-1`
- Active segment: `rounded-md bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium`
- Inactive segment: `rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-gray-800/50 px-3 py-1.5 text-xs font-medium transition-colors`
- Icon size: 14px (`h-3.5 w-3.5`), inline with text label
- Gap between icon and label: `gap-1.5`
- Placeholder panels:
  - Icon: 48px (`h-12 w-12`), `text-zinc-600`
  - Heading: `text-lg font-semibold text-zinc-300 mt-4`
  - Subtext: `text-sm text-zinc-500 max-w-md mt-2`
  - Background: inherits canvas `bg-gray-950` via the parent container
- StatusBar indicator: matches existing indicator styling (`text-xs`, dot + label)
- Use only `lucide-react` icons: `Eye`, `LayoutGrid`, `ShieldCheck`
