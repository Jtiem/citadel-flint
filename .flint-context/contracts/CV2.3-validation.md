# Validation Report: CV2.3 -- Component Cards on Canvas

**Phase:** 3 (Integration Validation)
**Contract:** `.flint-context/contracts/CV2.3-contract.md`
**Validator:** flint-integration-validator
**Date:** _[to be filled on validation]_

---

## 1. Pre-Flight Checklist

Run ALL checks before marking any item as PASS.

### 1.1 TypeScript Compilation

```bash
npx tsc --noEmit
```

| Check | Expected | Result |
|-------|----------|--------|
| TSC exit code | 0 | _pending_ |
| Errors | 0 | _pending_ |

### 1.2 Test Suite

```bash
npm run test:react
npm test
cd flint-mcp && npm test
```

| Suite | Expected | Result |
|-------|----------|--------|
| Glass (test:react) | All passing, N new | _pending_ |
| Core (npm test) | All passing | _pending_ |
| MCP (flint-mcp) | All passing | _pending_ |

---

## 2. Contract Compliance

### 2.1 Files Created

| File | Contract Section | Exists | Content Matches Contract |
|------|-----------------|--------|--------------------------|
| `src/store/componentCardStore.ts` | S6 | _pending_ | _pending_ |
| `src/components/editor/ComponentCardNode.tsx` | S7 | _pending_ | _pending_ |
| `src/components/editor/DependencyEdge.tsx` | S7 | _pending_ | _pending_ |
| `src/components/editor/__tests__/ComponentCardNode.test.tsx` | S11 | _pending_ | _pending_ |
| `src/store/__tests__/componentCardStore.test.ts` | S11 | _pending_ | _pending_ |

### 2.2 Files Modified

| File | Contract Section | Modified | Change Matches Contract |
|------|-----------------|----------|-------------------------|
| `src/components/editor/XYCanvas.tsx` | S7 | _pending_ | _pending_ |
| `src/store/canvasStore.ts` | S3 | _pending_ | _pending_ |
| `src/types/flint-api.d.ts` | S5 | _pending_ | _pending_ |
| `electron/preload.ts` | S8 | _pending_ | _pending_ |
| `electron/main.ts` | S4 | _pending_ | _pending_ |
| `src/App.tsx` | S3 | _pending_ | _pending_ |

### 2.3 Files NOT Modified (Anti-regression)

| File | Should be unchanged | Result |
|------|-------------------|--------|
| `src/components/editor/LivePreview.tsx` | Yes | _pending_ |
| `src/store/editorStore.ts` | Yes | _pending_ |
| `flint-mcp/src/server.ts` | Yes | _pending_ |
| `src/core/ASTService.ts` | Yes | _pending_ |

---

## 3. Type Contract Verification

### 3.1 `ComponentCardData` interface

| Field | Type per contract | Implemented correctly |
|-------|-------------------|----------------------|
| `id` | `string` | _pending_ |
| `name` | `string` | _pending_ |
| `importPath` | `string` | _pending_ |
| `filePath` | `string` | _pending_ |
| `category` | `ComponentCategory` | _pending_ |
| `variantCount` | `number` | _pending_ |
| `props` | `Record<string, { type: string; required: boolean }>` | _pending_ |
| `thumbnailPath` | `string \| null` | _pending_ |
| `health` | `ComponentHealth \| null` | _pending_ |
| `tokens` | `string[]` | _pending_ |
| `dependencies` | `string[]` | _pending_ |

### 3.2 `ComponentHealth` interface

| Field | Type per contract | Implemented correctly |
|-------|-------------------|----------------------|
| `grade` | `'A' \| 'B' \| 'C' \| 'D' \| 'F'` | _pending_ |
| `maxDeltaE` | `number` | _pending_ |
| `violationCount` | `number` | _pending_ |
| `mithrilCount` | `number` | _pending_ |
| `a11yCount` | `number` | _pending_ |

### 3.3 `ComponentCategory` type

| Value | Exists in type |
|-------|---------------|
| `'primitive'` | _pending_ |
| `'molecule'` | _pending_ |
| `'organism'` | _pending_ |
| `'page'` | _pending_ |
| `'layout'` | _pending_ |
| `'uncategorized'` | _pending_ |

---

## 4. IPC Channel Verification

### 4.1 `components:list`

| Check | Expected | Result |
|-------|----------|--------|
| Handler registered in `main.ts` | `ipcMain.handle('components:list', ...)` | _pending_ |
| Preload exposes `components.list()` | Returns `Promise<ComponentCardData[]>` | _pending_ |
| Returns `[]` when no manifest | Empty array, no error | _pending_ |
| Category derivation works | File path convention maps to correct category | _pending_ |
| Thumbnail path check | Returns absolute path when file exists, `null` otherwise | _pending_ |

### 4.2 `components:save-positions`

| Check | Expected | Result |
|-------|----------|--------|
| Handler registered in `main.ts` | `ipcMain.handle('components:save-positions', ...)` | _pending_ |
| Writes via `FileTransactionManager` | Atomic `.tmp` -> `rename` | _pending_ |
| Preload exposes `components.savePositions()` | Returns `Promise<void>` | _pending_ |

### 4.3 `components:load-positions`

| Check | Expected | Result |
|-------|----------|--------|
| Handler registered in `main.ts` | `ipcMain.handle('components:load-positions', ...)` | _pending_ |
| Returns `{}` when file missing | Empty object, no error | _pending_ |
| Preload exposes `components.loadPositions()` | Returns `Promise<Record<string, {x, y}>>` | _pending_ |

---

## 5. Store Contract Verification

### 5.1 `componentCardStore`

| State/Action | Contract Section | Implemented | Test coverage |
|-------------|-----------------|-------------|---------------|
| `cards: ComponentCardData[]` | S6 | _pending_ | _pending_ |
| `selectedCardId: string \| null` | S6 | _pending_ | _pending_ |
| `cardPositions: Record<...>` | S6 | _pending_ | _pending_ |
| `isLoaded: boolean` | S6 | _pending_ | _pending_ |
| `isLoading: boolean` | S6 | _pending_ | _pending_ |
| `loadCards()` | S6 | _pending_ | _pending_ |
| `selectCard(id)` | S6 | _pending_ | _pending_ |
| `updatePosition(id, pos)` | S6 | _pending_ | _pending_ |
| `savePositions()` | S6 | _pending_ | _pending_ |
| `clearCards()` | S6 | _pending_ | _pending_ |
| `toFlowNodes()` | S6 | _pending_ | _pending_ |
| `toFlowEdges()` | S6 | _pending_ | _pending_ |

### 5.2 Auto-layout algorithm

| Check | Expected | Result |
|-------|----------|--------|
| Groups by category | Cards sorted by category order then alphabetically | _pending_ |
| Grid dimensions | 4 columns, 240px width, 280px row height, 40px gap | _pending_ |
| Category gap | 60px vertical gap between category groups | _pending_ |
| Missing positions filled | Cards without saved positions get computed positions | _pending_ |
| Saved positions preserved | Cards with saved positions keep them | _pending_ |

---

## 6. Component Rendering Verification

### 6.1 `ComponentCardNode` -- Build Mode

| Check | Expected | Result |
|-------|----------|--------|
| Component name displayed | Visible in DOM | _pending_ |
| Import path displayed | Monospace, truncated | _pending_ |
| Category badge with correct color | Pill element with category-specific color | _pending_ |
| Variant count displayed | Shows number when > 0 | _pending_ |
| Insert button present | Visible, enabled when `activeFilePath` exists | _pending_ |
| Insert button disabled | `disabled` attribute when no `activeFilePath` | _pending_ |
| Thumbnail image loads | `<img>` with `file://` src | _pending_ |
| Placeholder shown | Gradient div with letter when no thumbnail | _pending_ |
| Selected border | Indigo ring when `isSelected === true` | _pending_ |
| No grade/violations shown | Grade letter and violation count absent from DOM | _pending_ |

### 6.2 `ComponentCardNode` -- Govern Mode

| Check | Expected | Result |
|-------|----------|--------|
| Grade letter displayed | Colored circle with letter A-F | _pending_ |
| Violation count displayed | Number visible | _pending_ |
| Max Delta-E displayed | Number visible | _pending_ |
| Border color matches grade | Emerald for A/B, amber for C, red for D/F | _pending_ |
| No Insert button | Insert button absent from DOM | _pending_ |
| Health `null` handled | Shows "--" or placeholder when health is null | _pending_ |

### 6.3 `DependencyEdge`

| Check | Expected | Result |
|-------|----------|--------|
| Renders bezier path | SVG path element present | _pending_ |
| Color matches target grade | Correct color per grade mapping | _pending_ |
| Animated dash for violations | Dash animation when `violationCount > 0` | _pending_ |
| Only in Govern mode | Not rendered in Build or Preview mode | _pending_ |

---

## 7. XYCanvas Mode Switching

| Check | Expected | Result |
|-------|----------|--------|
| Preview mode shows LivePreview | Single `livePreview` node, uncontrolled | _pending_ |
| Build mode shows component cards | Controlled nodes from `componentCardStore` | _pending_ |
| Govern mode shows cards + edges | Controlled nodes + edges | _pending_ |
| Mode switch < 200ms | Measure transition time | _pending_ |
| No position flickering on switch | Positions stable across mode changes | _pending_ |
| LivePreview state preserved | Returning to preview mode shows same content | _pending_ |

---

## 8. Cross-Store Coordination

| Check | Expected | Result |
|-------|----------|--------|
| Card selection triggers `setActiveFile` | `canvasStore.activeFilePath` updates to card's `filePath` | _pending_ |
| Card selection triggers `setRightTab('properties')` | Right sidebar switches to properties | _pending_ |
| No store-to-store imports | `componentCardStore` does not import `canvasStore` or vice versa | _pending_ |
| Coordination lives in App.tsx | `useEffect` in App.tsx handles the flint | _pending_ |

---

## 9. Commandment Compliance

| # | Commandment | Check | Result |
|---|-------------|-------|--------|
| 4 | Local-First | No external URLs in component or thumbnails | _pending_ |
| 9 | Process Boundary | No `fs`/`node:` imports in `src/` files | _pending_ |
| 12 | Atomic Queuing | Position writes go through `FileTransactionManager` | _pending_ |
| 13 | Deterministic Surgery | No regex-based source modification | _pending_ |

---

## 10. Performance Verification

| Check | Target | Result |
|-------|--------|--------|
| 10 cards render without jank | < 16ms frame time | _pending_ |
| 50 cards render without jank | < 16ms frame time | _pending_ |
| 100 cards render without jank | < 32ms frame time | _pending_ |
| Mode switch latency | < 200ms | _pending_ |
| Position save debounce | No write until 500ms after last drag | _pending_ |

---

## 11. Anti-Pattern Verification

| Anti-Pattern | Check | Result |
|-------------|-------|--------|
| No cross-store imports | `componentCardStore` does not import `canvasStore`, `editorStore`, or any other store | _pending_ |
| No `window.flintAPI` in store actions | All IPC calls in `loadCards`/`savePositions` go through the action (store actions are the exception for data-loading stores, per existing pattern in `canvasStore.setActiveFile`) | _pending_ |
| No `ipcRenderer.send` in React components | All IPC through `window.flintAPI.*` | _pending_ |
| No `fs` in `src/` | Grep for `from 'fs'` or `from 'node:fs'` in all created/modified `src/` files | _pending_ |

---

## 12. Verdict

| Outcome | Criteria |
|---------|----------|
| **SHIP** | All checks PASS. TSC 0 errors. All tests pass. No regressions. |
| **FIX** | Minor issues found. List specific fixes needed, return to Phase 2. |
| **REDESIGN** | Fundamental contract violation. Return to Phase 1 for contract revision. |

**Verdict:** _[SHIP / FIX / REDESIGN]_

**Notes:** _[validator fills in]_
