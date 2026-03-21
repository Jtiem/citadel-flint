# Contract: CV2.3 -- Component Cards on Canvas

**Phase:** CV2.3 -- Canvas View: Component Card Nodes
**Date:** 2026-03-20
**Prerequisites:** CV2.1 (Canvas View Mode Toggle -- `canvasView` state), CV2.2 (Thumbnail Generation -- `.flint/thumbnails/`)
**Owner:** flint-design-engineer (ComponentCardNode, canvas wiring), flint-electron-ipc (new IPC channel), flint-state-architect (componentCardStore), flint-test-writer (tests)

---

## 1. Problem Statement

Flint Glass currently renders a single LivePreview iframe node on the infinite canvas. There is no way for designers to see their full component library at a glance, understand component relationships, or assess governance health spatially.

CV2.3 introduces **Component Card Nodes** -- lightweight custom React Flow nodes that render component thumbnails, metadata, and governance status on the canvas. In Build mode, cards emphasize discovery and insertion. In Govern mode, cards emphasize health grades, violation counts, and dependency edges.

This transforms Flint Glass from a single-file viewer into a spatial component observatory.

---

## 2. Architecture Decision: Separate Store

### Why a new `componentCardStore` (not extending `canvasStore`)

`canvasStore` owns the single-file editing lifecycle: `activeFilePath`, `saveState`, `mithrilViolations`, `a11yViolations`, `canExport`. The component card system introduces orthogonal concerns:

- A list of **all** project components (not just the active file)
- Spatial positions that persist across sessions
- A selected card ID independent of `activeSelection` (which refers to a `data-flint-id` within a single file)
- Dependency graph edges (Govern mode only)

Merging these into `canvasStore` would violate separation of concerns and create a 500+ line store. A dedicated `componentCardStore` keeps the boundary clean.

**Cross-store coordination:** When `componentCardStore.selectedCardId` changes, a React effect in `App.tsx` (not inside the store) calls `canvasStore.setActiveFile(card.filePath)` and `canvasStore.setRightTab('properties')`. This avoids the anti-pattern of importing one Zustand store inside another.

### Canvas view gating

CV2.1 introduces `canvasView: 'preview' | 'build' | 'govern'` on `canvasStore`. XYCanvas reads this value:

- `canvasView === 'preview'`: Existing behavior -- single LivePreview node.
- `canvasView === 'build'` or `canvasView === 'govern'`: ComponentCardNode grid + optional edges.

---

## 3. Impact Map

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `src/store/componentCardStore.ts` | Component card state: card data, selection, positions, edges | flint-state-architect |
| `src/components/editor/ComponentCardNode.tsx` | Custom React Flow node -- thumbnail + metadata + mode-aware UI | flint-design-engineer |
| `src/components/editor/DependencyEdge.tsx` | Custom React Flow edge -- health-colored dependency line (Govern mode) | flint-design-engineer |
| `src/components/editor/__tests__/ComponentCardNode.test.tsx` | Component rendering, mode switching, selection tests | flint-test-writer |
| `src/store/__tests__/componentCardStore.test.ts` | Store state transitions, position persistence, card population | flint-test-writer |

### Files to MODIFY

| File | Change | Owner |
|------|--------|-------|
| `src/components/editor/XYCanvas.tsx` | Register `componentCard` and `dependencyEdge` node/edge types; switch between LivePreview and card grid based on `canvasView`; controlled nodes/edges from store | flint-design-engineer |
| `src/store/canvasStore.ts` | Add `canvasView: CanvasView` state + `setCanvasView` action (CV2.1 dependency -- may already exist by implementation time) | flint-state-architect |
| `src/types/flint-api.d.ts` | Add `components:list` IPC return type; add `ComponentCardData` and `ComponentHealth` types | flint-state-architect |
| `electron/preload.ts` | Add `components: { list: () => Promise<ComponentCardData[]> }` to `window.flintAPI` | flint-electron-ipc |
| `electron/main.ts` | Add `components:list` IPC handler -- reads `flint-manifest.json`, enriches with thumbnail paths and health data | flint-electron-ipc |
| `src/App.tsx` | Cross-store coordination effect: when `selectedCardId` changes, call `setActiveFile` + `setRightTab('properties')` | flint-design-engineer |

### Files UNCHANGED (verified)

| File | Why unchanged |
|------|---------------|
| `src/components/editor/LivePreview.tsx` | LivePreview continues to work as-is; it renders when `canvasView === 'preview'` or when a card is selected (shows full render in the right sidebar area) |
| `src/store/editorStore.ts` | Card selection triggers `setActiveFile` which already handles file loading into editorStore |
| `flint-mcp/src/server.ts` | No new MCP tools; component listing is a Glass-only IPC concern |
| `src/core/ASTService.ts` | No AST mutations in this phase; cards are read-only |

---

## 4. IPC Channels

### New: `components:list`

| Property | Value |
|----------|-------|
| Channel | `components:list` |
| Direction | Renderer -> Main -> Renderer |
| Payload | none |
| Return Type | `ComponentCardData[]` |
| Handler location | `electron/main.ts` |

**Handler behavior:**

1. Read `flint-manifest.json` from `activeProjectRoot` (same search path logic as HydroPaste).
2. For each component in `manifest.components`, construct a `ComponentCardData`:
   - `id`: Stable hash of `name + importPath` (deterministic across sessions).
   - `name`, `importPath`, `props` from the manifest `ComponentEntry`.
   - `category`: Derived from file path convention (`components/primitives/` -> `primitive`, `components/molecules/` -> `molecule`, `components/organisms/` -> `organism`). Falls back to `'uncategorized'`.
   - `variantCount`: Length of `variants` array (or 0).
   - `thumbnailPath`: Absolute path to `.flint/thumbnails/<id>.png`. Set to `null` if file does not exist.
   - `health`: `null` for Build mode. In Govern mode, enriched by a separate `components:health` IPC call (out of scope for CV2.3 -- stubbed to null).
3. Return the array sorted by category, then alphabetically by name.

No new IPC channel for position persistence -- positions are stored in the renderer and saved to `.flint/card-positions.json` via the existing `syncContext` pipeline or a dedicated `components:save-positions` IPC (see section 5).

### New: `components:save-positions`

| Property | Value |
|----------|-------|
| Channel | `components:save-positions` |
| Direction | Renderer -> Main |
| Payload | `Record<string, { x: number; y: number }>` |
| Return Type | `void` |
| Handler location | `electron/main.ts` |

Writes position map to `.flint/card-positions.json` via `FileTransactionManager` (Commandment 12).

### New: `components:load-positions`

| Property | Value |
|----------|-------|
| Channel | `components:load-positions` |
| Direction | Renderer -> Main -> Renderer |
| Payload | none |
| Return Type | `Record<string, { x: number; y: number }>` |
| Handler location | `electron/main.ts` |

Reads `.flint/card-positions.json`. Returns `{}` if the file does not exist.

---

## 5. Type Contracts

### `ComponentCardData` (shared between main and renderer)

```typescript
/**
 * Data shape for a single component card on the canvas.
 * Assembled by the `components:list` IPC handler from flint-manifest.json.
 */
export interface ComponentCardData {
    /** Deterministic ID: stable hash of name + importPath. */
    id: string;
    /** Component display name (e.g., "Button", "Card"). */
    name: string;
    /** Import path (e.g., "@/components/ui/Button"). */
    importPath: string;
    /** Resolved file path (absolute). */
    filePath: string;
    /** Category derived from file path or manifest field. */
    category: ComponentCategory;
    /** Number of variants from the manifest. */
    variantCount: number;
    /** Props table from the manifest. */
    props: Record<string, { type: string; required: boolean }>;
    /** Absolute path to thumbnail PNG, or null if not yet generated. */
    thumbnailPath: string | null;
    /** Governance health data (Govern mode). Null when not computed. */
    health: ComponentHealth | null;
    /** Design tokens this component consumes. */
    tokens: string[];
    /** Import paths of components this component depends on. */
    dependencies: string[];
}

export type ComponentCategory =
    | 'primitive'
    | 'molecule'
    | 'organism'
    | 'page'
    | 'layout'
    | 'uncategorized';

/**
 * Governance health snapshot for a single component.
 * Populated by audit results; null until first audit runs.
 */
export interface ComponentHealth {
    /** Health grade letter: A (clean) through F (critical). */
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    /** Maximum CIEDE2000 Delta-E found in this component. */
    maxDeltaE: number;
    /** Total violation count (Mithril + A11y). */
    violationCount: number;
    /** Mithril violations only. */
    mithrilCount: number;
    /** Accessibility violations only. */
    a11yCount: number;
}
```

### `ComponentCardNodeProps` (React Flow custom node data)

```typescript
import type { NodeProps } from '@xyflow/react';

/** Data payload passed to the ComponentCardNode via React Flow's `data` prop. */
export interface ComponentCardNodeData {
    card: ComponentCardData;
    isSelected: boolean;
    canvasView: 'build' | 'govern';
}

export type ComponentCardNodeProps = NodeProps<ComponentCardNodeData>;
```

### `DependencyEdgeData` (React Flow custom edge data)

```typescript
import type { EdgeProps } from '@xyflow/react';

export interface DependencyEdgeData {
    /** Health grade of the target (downstream) component. */
    targetGrade: ComponentHealth['grade'] | null;
}

export type DependencyEdgeProps = EdgeProps<DependencyEdgeData>;
```

---

## 6. Store Contract: `componentCardStore`

```typescript
interface ComponentCardState {
    /** All component cards for the current project. Empty array when no project open. */
    cards: ComponentCardData[];
    /** ID of the currently selected card, or null. */
    selectedCardId: string | null;
    /** Persisted spatial positions. Keyed by card ID. */
    cardPositions: Record<string, { x: number; y: number }>;
    /** Whether the initial card load has completed. */
    isLoaded: boolean;
    /** Loading state for the card list fetch. */
    isLoading: boolean;
}

interface ComponentCardActions {
    /**
     * Fetches the component list via `components:list` IPC and populates `cards`.
     * Also loads persisted positions via `components:load-positions`.
     * Called when `canvasView` transitions to 'build' or 'govern'.
     */
    loadCards: () => Promise<void>;
    /** Selects a card by ID. Pass null to deselect. */
    selectCard: (cardId: string | null) => void;
    /**
     * Updates the position for a single card.
     * Called on React Flow `onNodesChange` (drag end).
     */
    updatePosition: (cardId: string, position: { x: number; y: number }) => void;
    /**
     * Persists all current positions to disk via `components:save-positions` IPC.
     * Debounced -- call freely on every drag event; only writes on settle.
     */
    savePositions: () => void;
    /** Clears all cards and positions (on project close). */
    clearCards: () => void;
    /**
     * Computes React Flow Node[] from cards + positions.
     * Pure selector -- no state mutation.
     */
    toFlowNodes: () => Node<ComponentCardNodeData>[];
    /**
     * Computes React Flow Edge[] from card dependencies (Govern mode only).
     * Pure selector.
     */
    toFlowEdges: () => Edge<DependencyEdgeData>[];
}
```

### Auto-layout algorithm

When `cardPositions` is empty (first open, or no `.flint/card-positions.json`), the store computes a grid layout:

1. Group cards by `category` in order: `primitive`, `molecule`, `organism`, `page`, `layout`, `uncategorized`.
2. Within each group, sort alphabetically by `name`.
3. Lay out cards in a grid: 4 columns, 240px column width, 280px row height, 40px gap.
4. Each category group starts on a new row with a 60px vertical gap between groups.
5. Store the computed positions into `cardPositions`.

### Position persistence

- `updatePosition` updates the in-memory map immediately.
- `savePositions` is debounced (500ms). It calls `window.flintAPI.components.savePositions(cardPositions)`.
- `loadCards` calls `window.flintAPI.components.loadPositions()` and merges into `cardPositions`. Cards without saved positions get auto-layout positions.

---

## 7. Component Contracts

### `ComponentCardNode`

| Prop | Type | Source |
|------|------|--------|
| `data.card` | `ComponentCardData` | `componentCardStore.cards` via React Flow node |
| `data.isSelected` | `boolean` | `componentCardStore.selectedCardId === card.id` |
| `data.canvasView` | `'build' \| 'govern'` | `canvasStore.canvasView` |

**Render spec -- Build mode:**

```
+---------------------------------------+
| [Thumbnail image or placeholder]       |  180 x 120px
|                                        |
+---------------------------------------+
| ComponentName            [variant #]   |
| @/path/to/component                    |
| category badge                         |
|                         [Insert] btn   |
+---------------------------------------+
```

- Thumbnail: `<img>` loading from `file://` protocol (Electron allows this). Falls back to a gradient placeholder with the first letter of the component name.
- Category badge: Colored pill -- `primitive` (blue), `molecule` (purple), `organism` (amber), `page` (emerald), `layout` (cyan), `uncategorized` (zinc).
- Insert button: Calls `editorStore.getState().injectComponent(...)` with the component import path. Disabled when no `activeFilePath`.
- Selected state: Indigo border ring.

**Render spec -- Govern mode:**

```
+---------------------------------------+
| [Thumbnail image or placeholder]       |  180 x 120px
|                                        |
+---------------------------------------+
| ComponentName                    [A]   |  grade letter
| 3 violations | DE 1.8                  |
| category badge                         |
+---------------------------------------+
```

- Grade letter: Colored circle -- A (emerald), B (lime), C (amber), D (orange), F (red).
- Border color matches grade: emerald for A/B, amber for C, red for D/F.
- Violation count and max Delta-E shown below the name.
- No Insert button in Govern mode.

**Interaction:**

- Click on card -> `componentCardStore.selectCard(card.id)`.
- The cross-store effect in App.tsx reads the new `selectedCardId`, finds the card's `filePath`, and calls `canvasStore.setActiveFile(filePath)` + `canvasStore.setRightTab('properties')`.
- Double-click on card -> switches `canvasView` to `'preview'` with that component loaded (returns to single-file view).

**Performance:**

- Cards use `React.memo` with a custom comparator (card.id + isSelected + canvasView + health.grade).
- No live iframes -- PNG thumbnails only.
- Maximum 100 cards tested without frame drops.

### `DependencyEdge` (Govern mode only)

- Custom edge component using React Flow's `getBezierPath`.
- Stroke color derived from `targetGrade`: emerald for A/B, amber for C, red for D/F, zinc-600 when health is null.
- Animated dash pattern for edges pointing to components with violations (`violationCount > 0`).
- Edges are only present when `canvasView === 'govern'`.

### `XYCanvas` modifications

```typescript
// Updated node types registry
const nodeTypes: NodeTypes = {
    livePreview: LivePreviewNode,
    componentCard: ComponentCardNode,  // NEW
}

// Updated edge types registry
const edgeTypes: EdgeTypes = {
    dependency: DependencyEdge,  // NEW
}
```

**Controlled vs. uncontrolled:**

Currently, XYCanvas uses `defaultNodes` (uncontrolled). For CV2.3, when `canvasView !== 'preview'`, XYCanvas switches to **controlled mode** (`nodes` + `onNodesChange`) so the store drives the node list and positions. In `preview` mode, it continues to use `defaultNodes` for the LivePreview (preserving existing behavior exactly).

```typescript
// In XYCanvas:
const canvasView = useCanvasStore((s) => s.canvasView)

// When in card mode, use controlled nodes from the store
const flowNodes = useComponentCardStore((s) => s.toFlowNodes())
const flowEdges = canvasView === 'govern'
    ? useComponentCardStore((s) => s.toFlowEdges())
    : EMPTY_EDGES

if (canvasView === 'preview') {
    return <ReactFlow defaultNodes={INITIAL_NODES} ... />
} else {
    return <ReactFlow nodes={flowNodes} edges={flowEdges} onNodesChange={handleNodesChange} ... />
}
```

---

## 8. IPC Surface in `preload.ts`

```typescript
components: {
    /** Returns all indexed components for the active project. */
    list: (): Promise<ComponentCardData[]> =>
        ipcRenderer.invoke('components:list'),

    /** Persists card spatial positions to .flint/card-positions.json. */
    savePositions: (positions: Record<string, { x: number; y: number }>): Promise<void> =>
        ipcRenderer.invoke('components:save-positions', positions),

    /** Loads persisted card positions. Returns {} if no file. */
    loadPositions: (): Promise<Record<string, { x: number; y: number }>> =>
        ipcRenderer.invoke('components:load-positions'),
},
```

---

## 9. Data Flow

```
flint-manifest.json (on disk)
  |
  v
[Main Process] IPC handler: components:list
  |  - Reads manifest
  |  - Derives category from file path
  |  - Checks .flint/thumbnails/<id>.png existence
  |  - Returns ComponentCardData[]
  v
[Preload] window.flintAPI.components.list()
  |
  v
[Renderer] componentCardStore.loadCards()
  |  - Stores cards[]
  |  - Loads positions from components:load-positions
  |  - Computes auto-layout for cards without saved positions
  v
[Renderer] componentCardStore.toFlowNodes()
  |  - Maps cards + positions to React Flow Node<ComponentCardNodeData>[]
  v
[Renderer] XYCanvas
  |  - Renders <ReactFlow nodes={flowNodes} edges={flowEdges} ... />
  |  - Each node renders <ComponentCardNode />
  v
[User clicks card]
  |  - componentCardStore.selectCard(id)
  |  - App.tsx effect: canvasStore.setActiveFile(card.filePath)
  |  - Right sidebar: PropertiesPanel shows the selected component
  |
[User drags card]
  |  - componentCardStore.updatePosition(id, pos)
  |  - Debounced: componentCardStore.savePositions()
  |  - Main process writes .flint/card-positions.json
```

---

## 10. Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|-------------|---------|---------------|
| 1 | Code is Truth | No | Cards are read-only; no AST mutations. Position persistence is a UI preference, not code state. |
| 4 | Local-First Only | Yes | Thumbnail images loaded from local `file://` path. No network calls. `flint-manifest.json` is a local file. |
| 7 | ID Preservation | N/A | No structural AST mutations in this phase. |
| 9 | Process Boundary Law | Yes | No `fs` or `node:` imports in `src/`. All file reads go through `window.flintAPI.components.*` IPC. Position writes go through IPC to `FileTransactionManager`. |
| 12 | Atomic Queuing | Yes | Position file writes go through `FileTransactionManager` (atomic `.tmp` -> `rename`). The `.flint/card-positions.json` file is not a code file, but we still use atomic writes for crash safety. |
| 13 | Deterministic Surgery | N/A | No code modifications. The Insert button in Build mode delegates to `editorStore.injectComponent` which already uses AST surgery. |

---

## 11. Test Requirements

### `src/components/editor/__tests__/ComponentCardNode.test.tsx`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders in Build mode without crash | Card shows component name, category badge, Insert button |
| 2 | Renders in Govern mode without crash | Card shows grade letter, violation count, Delta-E |
| 3 | Shows thumbnail when `thumbnailPath` is set | `<img>` element has correct `src` attribute |
| 4 | Shows placeholder when `thumbnailPath` is null | Gradient placeholder with first letter visible |
| 5 | Insert button disabled when no `activeFilePath` | Button has `disabled` attribute |
| 6 | Insert button calls `injectComponent` | Mock `editorStore.injectComponent`; click Insert; verify called with correct args |
| 7 | Click selects the card | Mock `componentCardStore.selectCard`; click the card; verify called with `card.id` |
| 8 | Selected state shows indigo border | Card wrapper has indigo border classes when `isSelected === true` |
| 9 | Grade letter colors are correct | For each grade (A-F), the circle has the expected color class |
| 10 | Category badge colors are correct | For each category, the badge has the expected color class |
| 11 | Build mode hides grade/violations | Grade letter and violation count are not in the DOM |
| 12 | Govern mode hides Insert button | Insert button is not in the DOM |

### `src/store/__tests__/componentCardStore.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Initial state is empty | `cards: [], selectedCardId: null, cardPositions: {}, isLoaded: false` |
| 2 | `loadCards` populates cards from IPC | Mock `components:list`; call `loadCards`; verify `cards` matches mock data |
| 3 | `loadCards` merges persisted positions | Mock `components:load-positions` with saved data; verify `cardPositions` includes saved entries |
| 4 | Auto-layout fills missing positions | Load 3 cards with no saved positions; verify all 3 have computed positions |
| 5 | `selectCard` updates `selectedCardId` | Call `selectCard('foo')`; verify state |
| 6 | `selectCard(null)` clears selection | Call with null; verify `selectedCardId === null` |
| 7 | `updatePosition` updates a single card | Call with new position; verify only that card's position changed |
| 8 | `clearCards` resets all state | Populate cards then call `clearCards`; verify initial state |
| 9 | `toFlowNodes` returns correct Node shape | Verify each node has `type: 'componentCard'`, correct position, correct data |
| 10 | `toFlowEdges` returns edges for Govern mode | Provide 2 cards where A depends on B; verify edge from A to B |
| 11 | `toFlowEdges` returns empty when no dependencies | Provide cards with no dependencies; verify empty array |
| 12 | Auto-layout groups by category | Provide cards from 2 categories; verify Y positions show grouping |
| 13 | `savePositions` calls IPC | Mock `components:save-positions`; trigger save; verify IPC called with current positions |

### Validation commands

```bash
npm run test:react -- --reporter verbose 2>&1 | grep -E 'ComponentCard|componentCard|PASS|FAIL'
npx tsc --noEmit
```

---

## 12. Dependencies on CV2.1 and CV2.2

### CV2.1: Canvas View Mode Toggle

This contract assumes `canvasStore` has:

```typescript
export type CanvasView = 'preview' | 'build' | 'govern'
// State:
canvasView: CanvasView  // default: 'preview'
// Action:
setCanvasView: (view: CanvasView) => void
```

If CV2.1 is not yet implemented when CV2.3 begins, the `canvasView` state and `setCanvasView` action must be added as part of CV2.3 implementation (they are trivial: a string state + setter).

### CV2.2: Thumbnail Generation

This contract does not depend on CV2.2 being complete. When `thumbnailPath` is `null` (thumbnail not yet generated), cards render a gradient placeholder. CV2.2 can be implemented independently, and cards will start showing thumbnails as soon as the PNG files appear in `.flint/thumbnails/`.

### Dependency parsing for edges

The `dependencies` field on `ComponentCardData` is populated by the `components:list` IPC handler. The handler reads each component's source file and extracts import statements that reference other components in the manifest. This is a read-only Babel parse in the main process (Commandment 13 -- no regex).

If full dependency extraction is too expensive for the initial implementation, the `dependencies` array can be left empty and edges will simply not render. The edge rendering system is architecturally ready but the data population can be deferred.

---

## 13. Implementation Order

### Parallelism Group A (can run simultaneously)

| Step | Agent | Task |
|------|-------|------|
| A1 | flint-electron-ipc | Add `components:list`, `components:save-positions`, `components:load-positions` IPC handlers in `main.ts` and `preload.ts`. Add types to `flint-api.d.ts`. |
| A2 | flint-state-architect | Create `componentCardStore.ts` with all state, actions, auto-layout algorithm, `toFlowNodes`, `toFlowEdges` selectors. |

### Parallelism Group B (depends on A1 + A2)

| Step | Agent | Task |
|------|-------|------|
| B1 | flint-design-engineer | Create `ComponentCardNode.tsx` and `DependencyEdge.tsx`. Modify `XYCanvas.tsx` to register new node/edge types and switch between preview/card modes. Add cross-store coordination effect to `App.tsx`. |

### Sequential Step C (depends on B1)

| Step | Agent | Task |
|------|-------|------|
| C1 | flint-test-writer | Create `ComponentCardNode.test.tsx` and `componentCardStore.test.ts`. Run full test suite. |

### Phase 3 Validation

| Step | Agent | Task |
|------|-------|------|
| D1 | flint-integration-validator | Run integration validation per `.flint-context/contracts/CV2.3-validation.md`. |

---

## 14. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Controlled/uncontrolled React Flow switch may cause position flickering during mode transitions | Medium | -- | Use `key` prop on `<ReactFlow>` to force unmount/remount when switching between preview and card modes. This avoids stale internal state. |
| 100+ cards may cause rendering jank | Medium | -- | `React.memo` on `ComponentCardNode` with custom comparator. React Flow has built-in viewport culling -- nodes outside the viewport are not rendered. Verify with 100-card stress test. |
| `file://` protocol for thumbnail images may be blocked by CSP | Medium | 4 | Electron's default CSP allows `file://` for `<img>` in BrowserWindow. Verify in SEC.1 hardened CSP. If blocked, use `data:` URIs or a custom protocol (`flint-thumb://`). |
| `flint-manifest.json` may not exist for new projects | Low | -- | `components:list` returns `[]` when manifest is missing. Canvas shows empty state with guidance text. |
| Category derivation from file paths is fragile | Low | -- | Falls back to `'uncategorized'`. The manifest can optionally include a `category` field for explicit control. |
| Position file corruption on crash | Low | 12 | Writes go through `FileTransactionManager` (atomic). Corrupt/missing file defaults to `{}`. |
| Cross-store coordination via `useEffect` may cause unnecessary renders | Low | -- | The effect only fires when `selectedCardId` changes (Zustand shallow equality). The `setActiveFile` call is debounced by the existing dirty-file flush logic. |
| Dependency parsing in `components:list` may be slow for large projects | Medium | 13 | Defer dependency extraction to a background task or lazy-load on first Govern mode entry. For MVP, `dependencies: []` is acceptable. |

---

## 15. Future Enhancements (Out of Scope)

- **CV2.4: Component Health Enrichment** -- `components:health` IPC that runs `flint_audit` on each component and populates the `health` field. Currently stubbed to `null`.
- **CV2.5: Drag-to-insert from card to LivePreview** -- Drop a card onto the preview to inject the component at the drop position.
- **CV2.6: Category management UI** -- Allow designers to drag cards between category groups to reclassify them.
- **CV2.7: Search/filter bar** -- Text search and category filter above the card grid.
- **Live thumbnail updates** -- Re-generate thumbnails when component source changes.
- **Minimap coloring** -- Color minimap nodes by health grade in Govern mode.
