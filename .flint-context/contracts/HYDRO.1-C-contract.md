# Contract: HYDRO.1-C -- Component Registry Search UI in Glass

**Sprint:** HYDRO.1 -- Component Hydration Wiring
**Phase:** 1 (Contract)
**Date:** 2026-03-20
**Owner:** flint-design-engineer (UI), flint-electron-ipc (new IPC channel)

---

## 1. Problem Statement

No UI exists in Flint Glass to search the project's component registry. The existing "Assets" tab in the left sidebar (`AssetsPanel.tsx`) shows a hardcoded 3-component list from `src/data/componentRegistry.ts`. Meanwhile, the `flint_query_registry` MCP tool provides full-text + RAG search over the project's `flint-manifest.json`, but this tool is only callable from external MCP clients (Claude Code, Cursor).

This contract wires a search-and-insert interface into Glass that lets designers discover and insert components from their project's actual registry.

---

## 2. Layout Decision

### Where it lives: Left sidebar, "assets" tab -- replaces/augments `AssetsPanel`

**Rationale:**
- The left sidebar already has a "layers / assets / files" tab bar (see `App.tsx` line 593).
- The "assets" tab currently renders `<AssetsPanel />` which shows 3 hardcoded tiles.
- The right sidebar is reserved for inspection (Properties, Tokens, Activity, Health, Agents, Recovery). Adding search there violates the Glass layout contract.
- A new component `ComponentSearch` renders inside the existing "assets" tab, replacing the hardcoded list with a live search interface. The hardcoded tiles remain as a "Quick Insert" section below the search results when no query is active.

### No new tab needed

The "assets" tab is the correct home. No changes to the left tab bar enum.

---

## 3. Scope

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `src/components/ui/ComponentSearch.tsx` | Search input + result list + click-to-insert UI | flint-design-engineer |
| `src/components/ui/__tests__/ComponentSearch.test.tsx` | Unit tests | flint-test-writer |

### Files to MODIFY

| File | Change | Owner |
|------|--------|-------|
| `src/components/editor/AssetsPanel.tsx` | Import and render `<ComponentSearch />` above the existing hardcoded tiles | flint-design-engineer |
| `src/types/flint-api.d.ts` | No changes needed -- `MCPAPI.callTool` already exists with `(name: string, args: Record<string, unknown>) => Promise<MCPCallResult>` | -- |

### Files UNCHANGED (verified)

| File | Why unchanged |
|------|---------------|
| `electron/preload.ts` | `window.flintAPI.mcp.callTool` already exposes MCP tool invocation. No new IPC channel needed. |
| `electron/main.ts` | The `mcp:call-tool` IPC handler already exists and routes to the MCP server child process |
| `flint-mcp/src/server.ts` | `flint_query_registry` tool is already registered and functional |
| `src/store/canvasStore.ts` | No new state needed; the search is component-local |
| `src/store/editorStore.ts` | `injectComponent` action already exists and works |

---

## 4. IPC Flow (No New Channels)

The search uses the existing bidirectional MCP action flint:

```
ComponentSearch.tsx
  -> window.flintAPI.mcp.callTool('flint_query_registry', { query, limit: 5 })
  -> [preload.ts: ipcRenderer.invoke('mcp:call-tool', ...)]
  -> [main.ts: mcpClient.callTool(...)]
  -> [MCP server child process: flint_query_registry handler]
  -> returns MCPCallResult { content: [{ type: 'text', text: JSON.stringify(shadowStorybook) }] }
```

For insert:

```
ComponentSearch.tsx
  -> useEditorStore.getState().injectComponent(targetNodeId, snippet, importStmt)
  -> [editorStore.applyBatch with 'injectComponent' op]
  -> [AST surgery + save]
```

No new IPC channel is required. The existing `mcp.callTool` and `editorStore.injectComponent` surfaces are sufficient.

---

## 5. Type Contracts

### Component Props: `ComponentSearch`

```typescript
/** No props -- this component is self-contained. It reads store state directly. */
export function ComponentSearch(): JSX.Element
```

### Internal Types (defined inside `ComponentSearch.tsx`)

```typescript
/** A search result parsed from the flint_query_registry MCP tool response. */
interface RegistrySearchResult {
    name: string;
    importPath: string;
    description?: string;
    variants?: string[];
    tokens?: string[];
    props?: Record<string, { type: string; required: boolean; default?: string }>;
    source?: 'local' | 'remote';
}
```

### Store Dependencies

| Store | Selector/Action | Usage |
|-------|----------------|-------|
| `editorStore` | `selectedNodeId` | Read: determine if a target node is selected for insert |
| `editorStore` | `injectComponent(targetNodeId, jsxSnippet, importSnippet)` | Action: insert selected component into AST |

### IPC Dependencies

| API | Method | Usage |
|-----|--------|-------|
| `window.flintAPI.mcp` | `callTool('flint_query_registry', { query, limit })` | Invoke MCP tool for search |

---

## 6. Behavioral Spec

### ComponentSearch.tsx

**Layout:**

```
+------------------------------------+
| [Search icon] [text input]         |
+------------------------------------+
| Result 1: ComponentName            |
|   @/path/to/component              |
|   Description text...              |
|   [Insert] button                  |
+------------------------------------+
| Result 2: ...                      |
+------------------------------------+
| (empty state when no query)        |
| (loading spinner while searching)  |
| (no results message)              |
+------------------------------------+
```

**Behavior:**

1. **Search input**: Debounced text input (300ms). On each debounce tick, if the query is >= 2 characters, call `window.flintAPI.mcp?.callTool('flint_query_registry', { query: inputValue, limit: 5 })`.

2. **Parsing the response**: The MCP tool returns `MCPCallResult` with `content[0].text` containing a markdown Shadow Storybook. However, the raw JSON result can also be extracted. The search should parse the response intelligently:
   - The `flint_query_registry` handler in `server.ts` returns a `formatShadowStorybook` markdown string.
   - For the Glass UI, we need structured data. Two options:
     - **Option A (chosen):** Call `flint_query_registry` and parse the JSON response. The tool response wraps the Shadow Storybook markdown, but it also contains the raw match data if we look at `withResponseMeta`. Since the tool only returns markdown, we will parse the markdown to extract component names and import paths.
     - **Option B (better, requires server change -- OUT OF SCOPE for this sprint):** Add a `format: 'json'` parameter to `flint_query_registry` that returns structured `ComponentEntry[]` instead of markdown.
   - **For HYDRO.1-C, use Option A**: Parse the Shadow Storybook markdown with a lightweight regex-free approach:
     - Split on `### ` to find component sections
     - Extract `**Import**: \`path\`` for import path
     - Extract description (first non-empty line after the heading)
     - Extract `**Variants**: ...` for variant list

3. **Result display**: Each result shows:
   - Component name (heading, `text-xs font-medium text-zinc-200`)
   - Import path (monospace, `font-mono text-[10px] text-zinc-500`)
   - Description (truncated, `text-[10px] text-zinc-400`)
   - "Insert" button (only enabled when `selectedNodeId !== null`)

4. **Click-to-insert**: When the user clicks "Insert":
   - If `selectedNodeId` is null, show an inline amber alert: "Select a target layer first" (same pattern as current `AssetsPanel`).
   - Otherwise, call `injectComponent(selectedNodeId, snippet, importStmt)` where:
     - `snippet`: `<${componentName} />` (minimal JSX element)
     - `importStmt`: `import { ${componentName} } from '${importPath}';`

5. **Empty state**: When no query is entered, show the text "Search your component registry" with a search icon.

6. **Loading state**: Show a small spinner while the MCP call is in flight.

7. **Error state**: If `mcp.callTool` rejects or `isError` is true, show "Search unavailable" with a muted icon. Do not crash.

8. **No results state**: Show "No components found" when the search returns empty results.

### AssetsPanel.tsx Modification

```typescript
// Before (current):
export function AssetsPanel() {
    // ... hardcoded componentRegistry tiles
}

// After:
import { ComponentSearch } from '../ui/ComponentSearch'

export function AssetsPanel() {
    return (
        <div className="flex flex-col gap-3 p-3">
            {/* Live registry search */}
            <ComponentSearch />

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Quick Insert — hardcoded tiles (unchanged) */}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Quick Insert
            </span>
            {/* ... existing componentRegistry.map tiles ... */}
        </div>
    )
}
```

The existing `alert` state for "no target selected" can be shared or each section can have its own. For simplicity, `ComponentSearch` manages its own alert state.

---

## 7. Test Requirements

All tests go in `src/components/ui/__tests__/ComponentSearch.test.tsx`.

### Required test cases

| # | Test | Assertion |
|---|------|-----------|
| 1 | **Renders without crash** | Component mounts and shows the search input |
| 2 | **Shows empty state when no query** | Text "Search your component registry" is visible |
| 3 | **Typing triggers search after debounce** | After typing "button" and waiting 300ms, `window.flintAPI.mcp.callTool` is called with `('flint_query_registry', { query: 'button', limit: 5 })` |
| 4 | **Does not search for single character** | Typing "b" does not trigger `callTool` |
| 5 | **Shows loading state** | While `callTool` promise is pending, a spinner or "Searching..." text is visible |
| 6 | **Renders search results** | Mock `callTool` to return Shadow Storybook markdown with 2 components; verify both component names appear in the DOM |
| 7 | **Insert button calls injectComponent** | Click "Insert" on a result with a selected node; verify `editorStore.injectComponent` was called with the correct snippet and import |
| 8 | **Insert button shows alert when no node selected** | Click "Insert" with `selectedNodeId === null`; verify amber alert appears |
| 9 | **Error state on MCP failure** | Mock `callTool` to reject; verify "Search unavailable" appears |
| 10 | **No results state** | Mock `callTool` to return empty markdown; verify "No components found" appears |

### Test setup

```typescript
// Mock the flintAPI.mcp surface
const mockCallTool = vi.fn()
Object.defineProperty(window, 'flintAPI', {
    value: {
        mcp: { callTool: mockCallTool },
    },
    writable: true,
})

// Mock editorStore
vi.mock('../../../store/editorStore', () => ({
    useEditorStore: vi.fn((selector) => {
        const state = {
            selectedNodeId: 'test-node-1',
            injectComponent: vi.fn(),
        }
        return selector(state)
    }),
}))
```

### Validation commands

```bash
npm run test:react -- --reporter verbose 2>&1 | grep -E 'ComponentSearch|PASS|FAIL'
npx tsc --noEmit
```

---

## 8. Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|-------------|---------|---------------|
| 4 | Local-First Only | Yes | MCP call goes to the local MCP server child process via stdio; no network calls |
| 7 | ID Preservation | Yes | `injectComponent` routes through `applyBatch` which calls `injectFlintIds` on structural ops |
| 9 | Process Boundary Law | Yes | No `fs` or `node:` imports in `src/`. Uses `window.flintAPI.mcp.callTool` which is the `contextBridge` surface |
| 12 | Atomic Queuing | Yes | Insert goes through `editorStore.applyBatch` which saves via `FileTransactionManager` |
| 13 | Deterministic Surgery | Yes | Insert uses `injectComponent` AST op, not string concatenation |

---

## 9. Dependency Map

```
HYDRO.1-C depends on:
  - window.flintAPI.mcp.callTool (ONLINE -- Phase W.3)
  - editorStore.injectComponent (ONLINE -- Phase A)
  - flint_query_registry MCP tool (ONLINE)

HYDRO.1-C does NOT depend on HYDRO.1-A or HYDRO.1-B.
  - It calls flint_query_registry (not flint_ingest_figma).
  - Improvements from HYDRO.1-B flow through the MCP tool automatically.

HYDRO.1-C can execute fully in parallel with HYDRO.1-A and HYDRO.1-B.
  - It creates a new file (ComponentSearch.tsx) and modifies AssetsPanel.tsx.
  - Neither of those files is touched by HYDRO.1-A or HYDRO.1-B.
```

---

## 10. Implementation Order

1. Create `src/components/ui/ComponentSearch.tsx` with search input, debounce, MCP call, result parsing, and insert logic
2. Modify `src/components/editor/AssetsPanel.tsx` to import and render `<ComponentSearch />`
3. Create `src/components/ui/__tests__/ComponentSearch.test.tsx`
4. Run `npm run test:react` -- confirm all 610+ tests pass
5. Run `npx tsc --noEmit` -- confirm 0 errors

---

## 11. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Parsing Shadow Storybook markdown is fragile | Medium | The markdown format is controlled by `formatShadowStorybook` in registryService.ts which has 14 tests; it is stable. A future sprint should add a `format: 'json'` param to the tool for structured results. |
| `window.flintAPI.mcp` may be undefined in test/headless environments | Low | Optional-chain: `window.flintAPI.mcp?.callTool(...)`. Tests mock the surface. |
| Debounce timing may cause flaky tests | Low | Use `vi.useFakeTimers()` and `vi.advanceTimersByTime(300)` in tests |
| Insert produces minimal `<Component />` without props | Low | This is intentional for v1. The designer then customizes props in the Properties panel. A future enhancement can pre-populate required props. |
| MCP server may not be connected when Glass opens | Low | The error state handles this gracefully; search shows "Search unavailable" |

---

## 12. Future Enhancements (Out of Scope)

- **`format: 'json'` param on `flint_query_registry`**: Returns structured `ComponentEntry[]` instead of markdown, eliminating the parsing step.
- **Drag-to-canvas insert**: Instead of click-to-insert, drag a component tile onto the canvas.
- **Snippet preview**: Show the generated JSX in a syntax-highlighted preview before insert.
- **Required props form**: When inserting a component with required props, show a mini-form to fill them in.
