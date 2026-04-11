# Zustand Store Architecture Review

**Date:** 2026-04-10
**Reviewer:** Quality Gate (Opus)
**Scope:** All 12 Glass Zustand stores

---

## Summary Table

| # | Store | Grade | Cross-Store | IPC in Store | Test Coverage | Findings |
|---|-------|-------|-------------|-------------|---------------|----------|
| 1 | editorStore | B | YES (2 stores) | NO (indirect) | Partial | 3 major, 1 minor |
| 2 | canvasStore | B- | NO (lazy import) | YES (5 calls) | Good | 3 major, 2 minor |
| 3 | astBufferStore | B | YES (1 store) | YES (3 calls) | Partial | 2 major, 1 minor |
| 4 | tokenStore | B+ | NO | YES (8 calls) | Partial | 1 major, 1 minor |
| 5 | historyStore | A | NO | NO | Missing | 1 minor |
| 6 | governanceStore | B+ | NO | YES (2 calls) | Good | 1 major |
| 7 | notificationStore | A | NO | NO | Good | 0 |
| 8 | orchestratorStore | C | YES (2 stores) | YES (12+ calls) | Missing | 4 major, 2 minor |
| 9 | assetStore | B | NO | YES (2 calls) | Missing | 1 major, 1 minor |
| 10 | annotationStore | A- | NO | YES (2 calls) | Missing | 1 minor |
| 11 | importSummaryStore | A | NO | NO | Good | 0 |
| 12 | componentCardStore | A- | NO | YES (3 calls) | Good | 1 minor |

**Overall Grade: B**

---

## Per-Store Analysis

### 1. editorStore (Grade: B)

**CRITICAL: Cross-store imports (lines 28-29)**
```typescript
import { useCanvasStore } from './canvasStore'
import { useHistoryStore } from './historyStore'
```
editorStore imports and directly calls into canvasStore (triggerAutoSave, setA11yViolations, activeFilePath) and historyStore (push, clear) from within its actions. This is the documented architectural anti-pattern. These calls happen in `setCode`, `applyBatch`, `syncCode`, `clearAST`, and `revertNodeToCommit`.

**MAJOR: History clear fires on every keystroke (line 257-259)**
```typescript
if (code !== previousCode) {
    useHistoryStore.getState().clear()
}
```
In `setCode`, history is cleared whenever `code !== previousCode`. Since `setCode` is called on every keystroke from Monaco, this means undo history is wiped on every single character typed. The intent is to clear on file switch (Commandment 10), but the condition is too broad. Should compare file paths, not code content.

**MAJOR: A11yLinter.audit called synchronously on every parse (line 253)**
`A11yLinter.audit(parsed)` runs synchronously in `setCode` on every successful parse. For large files, this blocks the main thread on every keystroke (after the 1s debounce fires). Should be debounced or run in a web worker.

**MINOR: `revertNodeToCommit` calls `window.flintAPI.gitShow` (line 432)**
This is an IPC call inside a store action. The documented anti-pattern says IPC belongs in components/hooks/services.

### 2. canvasStore (Grade: B-)

**MAJOR: IPC calls inside store actions**
- `setActiveFile` (line 557): `window.flintAPI.saveFile`, `window.flintAPI.readFile`
- `loadPolicy` (line 613): `window.flintAPI.policy?.get()`
- `triggerAutoSave` (line 794): `window.flintAPI.saveFile`

Five separate IPC call sites inside store actions. The anti-pattern guidance says these belong in hooks/components/services.

**MAJOR: `setActiveFile` uses dynamic import to break circular dependency (line 571)**
```typescript
const { useEditorStore } = await import('./editorStore')
```
This is a code smell indicating the stores are too coupled. The async import means `setActiveFile` is essentially coordinating two stores, which should be a hook or service.

**MAJOR: State shape is massive (40+ fields)**
canvasStore has grown to hold panel widths, breakpoint state, governance filters, autopilot state, preview dimensions, scroll targets, and more. Many of these (panel collapse, preview size, breakpoint) could be split into a `layoutStore` or `uiStore`.

**MINOR: `nodeLayouts` is unbounded (line 148)**
`Record<string, NodeLayout>` grows with every NODE_LAYOUT postMessage. Never cleaned up except on `closeWorkspace`. For components with many flint nodes, this accumulates silently.

**MINOR: Module-level mutable state (`_saveTimer`, `_setActiveFileSeq`)**
These are safe for a singleton store but make testing harder and are invisible to Zustand devtools.

### 3. astBufferStore (Grade: B)

**MAJOR: Cross-store import (line 43)**
```typescript
import { useHistoryStore } from './historyStore'
```
Directly pushes to historyStore from `crossFileMove` (lines 360-365). Also uses dynamic imports to reach canvasStore and editorStore (lines 311-319).

**MAJOR: IPC calls inside store action**
- `loadBuffer` (line 143): `window.flintAPI.readFile`
- `crossFileMove` (lines 259-267): `window.flintAPI.saveFileBatch`

**MINOR: Buffers Map has no eviction policy**
`buffers: Map<string, unknown>` grows with every loaded file and is only cleared explicitly via `clearBuffers` or `evictBuffer`. In a large workspace, this could hold dozens of parsed ASTs in memory.

### 4. tokenStore (Grade: B+)

**MAJOR: IPC calls inside every store action**
Every mutating action (addToken, updateToken, deleteToken, clearAllTokens, importTokensJSON, ensureDemoTokens, fetchTokens) calls `window.flintAPI.tokens.*` directly. This is the most IPC-heavy store.

However, the store documents this as intentional ("All mutations go through window.flintAPI") and the pattern is consistent. The `initSync`/`watchTokens` subscription pattern is well-designed.

**MINOR: `ensureDemoTokens` fires 24 parallel token.create calls (line 251)**
`Promise.all(defaults.map(...))` sends 24 IPC calls simultaneously. Should batch via a single IPC call.

### 5. historyStore (Grade: A)

Clean, focused, no cross-store imports, no IPC calls. Pure state management.

**MINOR: Unbounded stacks**
`past` and `future` arrays grow without limit. A very active editing session could accumulate hundreds of entries with full `restoreCode` snapshots (each holding the entire file content). Should cap at a reasonable limit (e.g., 100 entries).

### 6. governanceStore (Grade: B+)

**MAJOR: IPC calls in store actions (lines 87, 96)**
`saveToFile` and `loadFromFile` call `window.flintAPI.saveRuleOverrides` and `window.flintAPI.getRuleOverrides` directly. Should be in a hook.

Clean separation otherwise. ERM fields are well-structured with sensible defaults.

### 7. notificationStore (Grade: A)

Excellent store. No cross-store imports, no IPC calls, bounded collections (MAX_CONCURRENT=5, MAX_HISTORY=200), clean state transitions, well-documented severity policies. Nothing to flag.

### 8. orchestratorStore (Grade: C)

**CRITICAL: Cross-store imports (lines 18-19)**
```typescript
import { useEditorStore } from './editorStore'
import { useCanvasStore } from './canvasStore'
```
Both are used in `executeReadOnlyTool` (lines 48, 57) and `_addToolCallMessage` (line 561). This is the documented anti-pattern.

**MAJOR: Massive IPC surface inside store**
12+ `window.flintAPI.ai.*` calls throughout the store: `chat`, `onChunk`, `removeChunkListener`, `getConfig`, `saveConfig`, `queryRAG`, `applyBatch`. The entire AI chat flow is orchestrated from within the store.

**MAJOR: Recursive `_dispatchChat` (line 249, 309)**
On validation_error (line 249) and after read-only tool execution (line 309), `_dispatchChat` calls itself recursively. With a sufficiently chatty AI that keeps calling read-only tools or producing validation errors, this could stack overflow or create an infinite loop. No recursion depth guard.

**MAJOR: `messages` array is unbounded**
Long conversations accumulate without limit. Each message carries `toolData` which can include full code snapshots (`beforeSnapshot`). Memory grows linearly with conversation length.

**MINOR: `pendingToolCalls` is never cleaned up**
Approved/rejected tool calls stay in `pendingToolCalls` with updated status but are never removed. Only `clearHistory` wipes them.

**MINOR: `rejectToolCall` is declared `async` but doesn't need to be**
The function signature is `async (id: string)` but only the final `_dispatchChat` call is async, and it's fire-and-forget via void.

### 9. assetStore (Grade: B)

**MAJOR: IPC calls in store actions (lines 79, 104)**
`fetchAssets` and `runAudit` call `window.flintAPI.assets!.*` with non-null assertions. If `assets` is undefined (e.g., web build without full IPC surface), this throws at runtime.

**MINOR: No error state reset**
`fetchAssets` silently swallows errors without setting an error field. Unlike tokenStore, there's no user-visible error state.

### 10. annotationStore (Grade: A-)

Good defensive coding with `typeof window === 'undefined'` guards. Named selector export (`useAnnotations`) is a nice pattern. Clean separation documented in the header.

**MINOR: IPC calls in store actions**
`fetchAnnotations` and `resolveAnnotation` call `window.flintAPI.annotations.*`. Documented as intentional, but still violates the anti-pattern guidance.

### 11. importSummaryStore (Grade: A)

Exemplary store. Explicitly documents "This store does NOT call window.flintAPI." No cross-store imports. Named selector hooks exported. Clean state machine. Nothing to flag.

### 12. componentCardStore (Grade: A-)

Well-structured, no cross-store imports. Good auto-layout algorithm. Sticker system is clean.

**MINOR: `savePositions` uses fire-and-forget IPC (line 459)**
The debounced save calls `window.flintAPI.components.savePositions` with only a `.catch` handler. If the user closes the app during the 500ms debounce window, positions are lost. Minor but worth noting.

---

## Prioritized Punch List

### CRITICAL (must fix)

1. **orchestratorStore cross-store imports** -- `useEditorStore` and `useCanvasStore` are imported and called directly from store actions. Move `executeReadOnlyTool` and snapshot capture to a service/hook layer.

2. **editorStore cross-store imports** -- `useCanvasStore` and `useHistoryStore` are imported at module level and called from 6+ actions. This creates a tight coupling web: editorStore -> canvasStore -> (dynamic import) editorStore. Extract coordination logic into a `useEditorMutations` hook or a `MutationService`.

### MAJOR (should fix)

3. **editorStore history clear on every keystroke** -- `setCode` clears undo history whenever code changes, which happens on every typed character. Fix: compare `activeFilePath` before/after, not code content.

4. **orchestratorStore recursive _dispatchChat** -- Add a max recursion depth counter (e.g., 5) to prevent infinite loops from validation errors or read-only tool chains.

5. **canvasStore bloat** -- 40+ state fields in one store. Split panel/layout state into a dedicated `layoutStore`.

6. **orchestratorStore unbounded messages** -- Cap at ~200 messages, trimming oldest non-error messages when exceeded.

7. **historyStore unbounded stacks** -- Cap `past` at ~100 entries. Each entry with `restoreCode` holds a full file snapshot.

### MINOR (nice to have)

8. **IPC-in-store pattern is pervasive** -- 8 of 12 stores call `window.flintAPI` directly. The CLAUDE.md anti-pattern guidance says "IPC belongs in components/hooks/services." In practice, the token/annotation/asset stores are data-fetching stores where IPC is the natural home. Recommend documenting a formal exception: "Data-fetching stores may call window.flintAPI for CRUD operations. Coordination stores (editor, canvas, orchestrator) must NOT."

9. **tokenStore bulk insert** -- `ensureDemoTokens` fires 24 parallel IPC calls. Add a `tokens.createBatch` IPC endpoint.

10. **astBufferStore buffer eviction** -- Add a max buffer count (e.g., 20) with LRU eviction.

---

## Cross-Store Import Map

```
orchestratorStore ---> editorStore ---> canvasStore
                  \--> canvasStore       \--> historyStore
                                    
astBufferStore -----> historyStore
                 (dynamic) canvasStore, editorStore
                                    
canvasStore ----(dynamic)---> editorStore
```

The editorStore<->canvasStore circular dependency is currently broken by dynamic imports in canvasStore.setActiveFile. This works but is fragile and makes the dependency invisible at module resolution time.

**Recommended fix:** Extract a `FileMutationService` that both stores delegate to, eliminating the circular dependency entirely.

---

## Test Coverage Gaps

| Store | Has Tests | Coverage Quality |
|-------|-----------|-----------------|
| editorStore | Yes (applyBatch) | Partial -- missing setCode, syncCode, revert* |
| canvasStore | Yes (5 files) | Good -- autopilot, breakpoint, panels, disclosure, selection |
| astBufferStore | Yes (crossFileClone) | Partial -- missing loadBuffer, evictBuffer |
| tokenStore | Yes (errorHandling) | Partial -- missing happy path CRUD, importTokensJSON |
| historyStore | NO | Missing entirely |
| governanceStore | Yes | Good |
| notificationStore | Yes | Good |
| orchestratorStore | NO | Missing entirely |
| assetStore | NO | Missing entirely |
| annotationStore | NO | Missing entirely |
| importSummaryStore | Yes | Good |
| componentCardStore | Yes | Good |

**4 stores have zero test files: historyStore, orchestratorStore, assetStore, annotationStore.**
