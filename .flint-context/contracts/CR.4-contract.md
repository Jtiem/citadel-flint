# Contract: CR.4 — Glass UI for Component Scope Management

**Phase:** CR.4
**Status:** DRAFT
**Owner:** flint-architect
**Date:** 2026-03-20
**Depends on:** CR.1-3 (ONLINE)

---

## 1. Problem Statement

CR.1-3 delivered proactive generation constraints: the AI orchestrator now rejects unregistered components and injects the allowed palette into the system prompt. But the `componentScope` array in `.flint/policy.json` is invisible to the designer. There is no way to see which components are available, toggle them in or out of scope, or understand why the AI refused a component -- without opening a JSON file in an external editor. CR.4 closes this gap by adding a visual scope editor to Flint Glass's right sidebar.

## 2. Scope

### In scope

- New right-sidebar tab ("Scope") showing all registered components from `flint-manifest.json`
- Toggle each component in/out of the active `componentScope`
- Persist scope changes to `.flint/policy.json` via IPC
- Show component metadata: name, prop count, variant count, consumed token count
- "All Components" vs "Restricted" mode toggle with clear semantics
- Empty state for missing registry / missing policy
- Refresh button to reload the registry from disk

### Out of scope

- Full component browser (search, filtering by category, drag-to-canvas)
- Editing `flint-manifest.json` itself (that is an MCP / CLI concern)
- Component thumbnails in this panel (thumbnails exist in the build canvas view, CV2.3)
- Real-time push when `flint-manifest.json` changes on disk (manual refresh is sufficient for v1)
- Changes to the AI orchestrator itself (CR.1-3 handles that)

## 3. Tab Placement Decision

**Decision: Add a new "Scope" tab to the right sidebar, positioned after "Agents" and before "Recovery".**

Rationale:
- The scope editor is a project-level settings panel, not a per-node inspection tool ("Properties"), not a token catalog ("Tokens"), not an event log ("Activity"), not a health monitor ("Health"), and not an agent dashboard ("Agents").
- It is most closely related to "Agents" (both govern what the AI can do) and "Recovery" (both are project-level management panels), so it sits between them.
- Adding a subtab under an existing tab would overload that tab's responsibility and violate the single-responsibility principle the sidebar already follows.
- The sidebar uses icon-only buttons at `px-3` width, so a 7th tab fits within the `PANEL_MIN` (160px) constraint: 7 tabs x ~22px = 154px.

**Icon:** `Layers` from lucide-react (represents the component stack concept without conflicting with existing icons). Alternative: `BoxSelect` or `Component`. Final choice left to design-engineer, but `Layers` is the recommendation.

**Type update:** `RightTab` union in `canvasStore.ts` gains `'scope'` member.

## 4. IPC Channels

### 4.1 `scope:get-registry-and-scope`

| Property | Value |
|----------|-------|
| Direction | renderer -> main |
| Channel name | `scope:get-registry-and-scope` |
| Request payload | `void` |
| Return type | `ComponentScopeData` |

Reads `flint-manifest.json` from `activeProjectRoot` and `componentScope` from `.flint/policy.json`. Returns both in a single round-trip to avoid race conditions.

```typescript
/** Returned by the scope:get-registry-and-scope IPC handler. */
interface ComponentScopeData {
    /** All components from flint-manifest.json, keyed by component name. */
    registry: Record<string, ComponentRegistryEntry>
    /**
     * Current componentScope from .flint/policy.json.
     * null = no scope set (all components allowed).
     * string[] = explicit allow-list.
     */
    scope: string[] | null
    /** True when flint-manifest.json was found and parsed successfully. */
    registryAvailable: boolean
}

/** Renderer-side mirror of the orchestrator's RegistryEntry. */
interface ComponentRegistryEntry {
    name: string
    props: Record<string, { type: string; required: boolean }>
    variants: string[]
    consumedTokens: string[]
    description: string
}
```

**Main process implementation notes:**
- Reuses the same manifest search order as `components:list` and `loadComponentRegistry`: `activeProjectRoot/flint-manifest.json` first, then fallback paths.
- Policy path: `activeProjectRoot/.flint/policy.json`. If missing, `scope` returns `null`.
- If `flint-manifest.json` is missing, return `{ registry: {}, scope: null, registryAvailable: false }`.

### 4.2 `scope:set-scope`

| Property | Value |
|----------|-------|
| Direction | renderer -> main |
| Channel name | `scope:set-scope` |
| Request payload | `ComponentScopeUpdate` |
| Return type | `{ ok: boolean; error?: string }` |

```typescript
/** Payload for updating componentScope in policy.json. */
interface ComponentScopeUpdate {
    /**
     * The new componentScope array.
     * null = remove componentScope from policy.json (all components allowed).
     * string[] = set explicit allow-list.
     */
    scope: string[] | null
}
```

**Main process implementation notes:**
- Read existing `.flint/policy.json` (create if missing with default structure).
- If `scope` is `null`, delete the `componentScope` key from the JSON.
- If `scope` is a non-empty array, set `policy.componentScope = scope`.
- If `scope` is an empty array, delete the `componentScope` key (empty = all allowed, per CR.3 semantics).
- Write via `FileTransactionManager` (Commandment 12: atomic queuing).
- Return `{ ok: true }` on success, `{ ok: false, error: string }` on failure.
- Validate that `activeProjectRoot` is set; reject with error if no project is open.

## 5. preload.ts Surface

Add a `scope` namespace to `window.flintAPI`:

```typescript
// In electron/preload.ts — new scope namespace
scope: {
    /**
     * Returns the full component registry + current scope from policy.json.
     * Single round-trip — renderer never reads the registry and policy separately.
     */
    getRegistryAndScope: (): Promise<ComponentScopeData> =>
        ipcRenderer.invoke('scope:get-registry-and-scope'),

    /**
     * Persists the updated componentScope to .flint/policy.json.
     * Pass null to clear the scope (all components allowed).
     */
    setScope: (update: { scope: string[] | null }): Promise<{ ok: boolean; error?: string }> =>
        ipcRenderer.invoke('scope:set-scope', update),
},
```

## 6. Store Design

**Decision: No new Zustand store. Extend `canvasStore` with the new `RightTab` value only. All scope data is fetched and held locally within the `ComponentScopePanel` component via `useState`/`useEffect`.**

Rationale:
- The scope data is consumed by exactly one component (`ComponentScopePanel`).
- No other component or store needs to react to scope changes in real time.
- The existing pattern for similar single-consumer panels (AgentDashboard, GovernanceDashboard) is local state + IPC fetch, not a dedicated store.
- Creating a store would add complexity without cross-consumer benefit and risk cross-store contamination if other stores tried to read it.

### canvasStore changes

```typescript
// In src/store/canvasStore.ts

// Update the RightTab type union:
export type RightTab = 'properties' | 'tokens' | 'activity' | 'health' | 'agents' | 'scope' | 'recovery'
```

That is the only store change required. No new state, no new actions, no new selectors.

## 7. Type Contracts (flint-api.d.ts)

Add to `src/types/flint-api.d.ts`:

```typescript
// ── CR.4: Component Scope Management ──────────────────────────────────────────

/**
 * A single component entry from flint-manifest.json, as surfaced to the
 * renderer. This is the renderer-side mirror of the orchestrator's RegistryEntry
 * with normalized field names (consumedTokens instead of tokens array).
 */
export interface ComponentRegistryEntry {
    name: string
    props: Record<string, { type: string; required: boolean }>
    variants: string[]
    consumedTokens: string[]
    description: string
}

/**
 * Combined registry + scope snapshot returned by scope:get-registry-and-scope.
 * A single IPC round-trip returns everything the scope panel needs.
 */
export interface ComponentScopeData {
    /** All components from flint-manifest.json, keyed by component name. */
    registry: Record<string, ComponentRegistryEntry>
    /**
     * Current componentScope from .flint/policy.json.
     * null = no scope set (all components allowed, CR.3 backward compat).
     * string[] = explicit allow-list of component names.
     */
    scope: string[] | null
    /** True when flint-manifest.json was found and parsed successfully. */
    registryAvailable: boolean
}

/**
 * Payload for scope:set-scope IPC.
 */
export interface ComponentScopeUpdate {
    /**
     * null = remove scope restriction (all components allowed).
     * string[] = set explicit allow-list. Empty array = treated as null.
     */
    scope: string[] | null
}

/**
 * IPC surface for component scope management (CR.4).
 * Exposed as window.flintAPI.scope.
 */
export interface ScopeAPI {
    /** Returns full registry + current scope in one round-trip. */
    getRegistryAndScope: () => Promise<ComponentScopeData>
    /** Persists scope changes to .flint/policy.json. */
    setScope: (update: ComponentScopeUpdate) => Promise<{ ok: boolean; error?: string }>
}
```

Add `scope?: ScopeAPI` to the `FlintAPI` interface (optional-chained for Vitest/headless environments).

## 8. UI Component Spec

### `ComponentScopePanel`

| Property | Value |
|----------|-------|
| File | `src/components/ui/ComponentScopePanel.tsx` |
| Rendered when | `rightTab === 'scope'` |
| Store dependencies | None (local state only) |
| IPC calls | `window.flintAPI.scope?.getRegistryAndScope()`, `window.flintAPI.scope?.setScope()` |

#### Layout (top to bottom)

1. **Header bar** (sticky)
   - Title: "Component Scope" (uppercase, `text-xs font-medium tracking-wider text-zinc-400`)
   - Refresh button (right-aligned, same pattern as AgentDashboard)

2. **Description text**
   - One-liner: "Controls which components the AI can use when generating code."
   - Style: `text-[10px] text-zinc-600 border-b border-zinc-800/50 px-3 py-1.5`

3. **Mode toggle**
   - Two-state segmented control:
     - **"All Components"** (default when `scope === null`) -- no restrictions, AI can use any registered component.
     - **"Restricted"** -- only checked components are available.
   - When switching from "All" to "Restricted", the initial scope is set to all currently registered components (everything checked). The user then unchecks what they want to remove.
   - When switching from "Restricted" to "All", `scope` is set to `null` and persisted immediately.

4. **Summary chips** (3 chips in a grid, same pattern as AgentDashboard)
   - "In Registry": total component count from `flint-manifest.json`
   - "In Scope": count of currently scoped components (or "All" in unrestricted mode)
   - "Excluded": count of components not in scope (or "0" in unrestricted mode)

5. **Component list** (scrollable)
   - Each row:
     - Checkbox (left) -- checked = in scope, unchecked = excluded. Disabled in "All" mode.
     - Component name (monospace, `text-xs text-zinc-200`, truncated)
     - Metadata badges (right):
       - Prop count: `N props` in muted zinc
       - Variant count: `N variants` in muted zinc (hidden if 0)
       - Token count: `N tokens` in muted zinc (hidden if 0)
   - Rows sorted alphabetically by component name.
   - Toggle interaction: on click, immediately update local state and fire `scope:set-scope` IPC. Show optimistic UI (checkbox toggles immediately) with a save indicator.

6. **Empty state** (shown when `registryAvailable === false`)
   - Message: "No component registry found."
   - Subtext: "Create a flint-manifest.json in your project root to define available components."
   - No checkboxes or toggles shown.

#### Interaction Behaviors

- **Optimistic updates:** Toggle the checkbox immediately in local state, fire IPC in background. On IPC failure, revert and show notification via `useNotificationStore`.
- **Debounced persistence:** When the user rapidly toggles multiple components, batch scope changes with a 300ms debounce before calling `scope:set-scope`. This avoids writing policy.json 10 times in rapid succession.
- **Loading state:** Spinner + "Loading component registry..." (same pattern as AgentDashboard).
- **Error state:** Error message + Retry button (same pattern as AgentDashboard).

## 9. Edge Cases

| Edge Case | Behavior |
|-----------|----------|
| No `flint-manifest.json` | Show empty state. No toggles. Guide text. |
| No `.flint/policy.json` | `scope` returns `null`. "All Components" mode active. First toggle creates the file. |
| `componentScope` has names not in registry | Show those names in a separate "Unregistered" section below the main list, with a warning badge. They are still part of the scope but have no metadata to display. |
| Registry has 0 components (empty `components` key) | Show "0 components registered" with the same guide text as missing manifest. |
| `componentScope` is an empty array | Treated as `null` per CR.3 semantics. "All Components" mode active. |
| No project open (`activeProjectRoot === null`) | IPC handler returns error. Panel shows: "Open a project to manage component scope." |
| User toggles the last component off in Restricted mode | Allow it. The scope becomes an empty array, which is normalized to `null` (all allowed) by the IPC handler. Show a notification: "No components restricted. Switched to All Components mode." |
| Very large registry (50+ components) | Render a virtualized list or simple scroll. No truncation -- all components are shown. For v1, simple overflow-y scroll is sufficient; virtual list is a follow-up. |
| Concurrent MCP tool writes to policy.json | The IPC handler reads-then-writes policy.json. The read-modify-write is not atomic across processes. This is acceptable for v1 because scope edits are infrequent and user-initiated. Documented as a known limitation. |

## 10. Test Requirements

### IPC Tests (`electron/__tests__/componentScope.test.ts`)

| # | Test Case |
|---|-----------|
| 1 | `scope:get-registry-and-scope` returns full registry + null scope when policy.json has no componentScope |
| 2 | `scope:get-registry-and-scope` returns filtered scope when policy.json has componentScope array |
| 3 | `scope:get-registry-and-scope` returns `registryAvailable: false` when flint-manifest.json is missing |
| 4 | `scope:get-registry-and-scope` returns empty registry when manifest has empty components |
| 5 | `scope:set-scope` writes componentScope array to policy.json and returns ok |
| 6 | `scope:set-scope` with null removes componentScope key from policy.json |
| 7 | `scope:set-scope` with empty array removes componentScope key (normalized to null) |
| 8 | `scope:set-scope` returns error when no project is open |

### Component Tests (`src/components/ui/__tests__/ComponentScopePanel.test.tsx`)

| # | Test Case |
|---|-----------|
| 9 | Renders loading spinner on mount before data arrives |
| 10 | Renders component list with correct names and metadata after fetch |
| 11 | Shows empty state when registryAvailable is false |
| 12 | Toggling a component checkbox calls setScope with updated array |
| 13 | "All Components" mode disables all checkboxes |
| 14 | Switching from "All" to "Restricted" initializes scope with all component names |
| 15 | Shows error state with retry button on IPC failure |
| 16 | Shows "Unregistered" section when scope contains names not in registry |

### Store Tests

No new store tests needed -- the only change is adding `'scope'` to the `RightTab` union, which is a type-level change verified by TSC.

### Integration Smoke Test

| # | Test Case |
|---|-----------|
| 17 | Tab appears in right sidebar and clicking it renders ComponentScopePanel |

**Total: 17 test cases** (8 IPC, 8 component, 1 integration).

## 11. Files to Create

| File | Purpose | Owner Agent |
|------|---------|-------------|
| `src/components/ui/ComponentScopePanel.tsx` | Scope editor panel component | flint-design-engineer |
| `src/components/ui/__tests__/ComponentScopePanel.test.tsx` | Component tests (cases 9-16) | flint-test-writer |
| `electron/__tests__/componentScope.test.ts` | IPC handler tests (cases 1-8) | flint-test-writer |

## 12. Files to Modify

| File | Changes | Owner Agent |
|------|---------|-------------|
| `electron/main.ts` | Add `scope:get-registry-and-scope` and `scope:set-scope` IPC handlers | flint-electron-ipc |
| `electron/preload.ts` | Add `scope` namespace with `getRegistryAndScope` and `setScope` | flint-electron-ipc |
| `src/types/flint-api.d.ts` | Add `ComponentRegistryEntry`, `ComponentScopeData`, `ComponentScopeUpdate`, `ScopeAPI` types; add `scope?: ScopeAPI` to `FlintAPI` | flint-state-architect |
| `src/store/canvasStore.ts` | Add `'scope'` to `RightTab` union type | flint-state-architect |
| `src/App.tsx` | Add `ComponentScopePanel` import, add `'scope'` tab to right sidebar tab bar, add render case | flint-design-engineer |
| `src/components/__tests__/setup.ts` | Add `scope` mock to `flintAPI` test fixture | flint-test-writer |

## 13. Commandment Compliance Checklist

| # | Commandment | Applies? | How satisfied |
|---|-------------|----------|---------------|
| 1 | Code is Truth | Yes | Scope changes persist to `.flint/policy.json` on disk. No ephemeral state. |
| 4 | Local-First Only | Yes | All data read from local `flint-manifest.json` and `policy.json`. No network calls. |
| 9 | Process Boundary | Yes | Renderer reads/writes scope exclusively via `window.flintAPI.scope`. No `fs` imports in `src/`. |
| 12 | Atomic Queuing | Yes | `scope:set-scope` writes policy.json through `FileTransactionManager`. |
| 14 | Bypass Prohibition | Yes | No direct `fs.writeFile` in renderer or main handler; uses `FileTransactionManager`. |

Commandments 2, 3, 5, 6, 7, 8, 9 (CIEDE2000), 10, 11, 13, 15, 16 do not apply (no AST mutations, no visual edits, no AI tool calls, no undo operations).

## 14. Parallelism Plan

### Group 1 (can run simultaneously)

| Agent | Task | Estimated effort |
|-------|------|-----------------|
| **flint-electron-ipc** | Add 2 IPC handlers in `main.ts` + `scope` namespace in `preload.ts` | Small |
| **flint-state-architect** | Add types to `flint-api.d.ts` + `'scope'` to `RightTab` union | Small |

### Group 2 (depends on Group 1 types being committed)

| Agent | Task | Estimated effort |
|-------|------|-----------------|
| **flint-design-engineer** | Build `ComponentScopePanel.tsx` + integrate into `App.tsx` | Medium |

### Group 3 (depends on Group 1 + Group 2)

| Agent | Task | Estimated effort |
|-------|------|-----------------|
| **flint-test-writer** | Write all 17 tests + update `setup.ts` mock | Medium |

### Critical path

Group 1 (types + IPC) -> Group 2 (UI) -> Group 3 (tests)

Group 1 agents can work in parallel because:
- `flint-electron-ipc` modifies `electron/main.ts` and `electron/preload.ts`
- `flint-state-architect` modifies `src/types/flint-api.d.ts` and `src/store/canvasStore.ts`
- No file overlap.

## 15. Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Tab bar overflow at narrow panel widths | Low | 7 icons at ~22px each = 154px, which fits `PANEL_MIN` (160px). The tab bar already uses `px-3` spacing. Verified by measuring the existing 6-tab layout. |
| Read-modify-write race on policy.json | Low | Scope edits are infrequent, user-initiated, and debounced at 300ms. Concurrent MCP writes could interleave, but this is a known limitation for v1. A file lock can be added in v2. |
| ComponentScopePanel fetches on every tab switch | Low | The panel fetches data in its `useEffect` mount. Tab switches unmount/remount the component. For v1 this is acceptable; data is small and local. A cache can be added if needed. |
| `RightTab` union change may break existing `as const` arrays | Low | Only one location in `App.tsx` defines the tab array, and it is already typed manually. Adding the new entry there is straightforward. |

## 16. Non-Goals (Explicit Future Work)

- **Push updates on manifest change**: When `flint-manifest.json` is edited externally, the panel does not auto-refresh. The user must click "Refresh". A `fs.watch` push channel can be added in a follow-up phase.
- **Component search/filter**: For registries with 30+ components, a search bar would help. Out of scope for CR.4.
- **Drag-to-canvas from scope panel**: This belongs to the Build Canvas (CV2.3), not the scope editor.
- **Scope presets**: Named scope configurations (e.g. "Marketing Page", "Dashboard") are a future feature.
