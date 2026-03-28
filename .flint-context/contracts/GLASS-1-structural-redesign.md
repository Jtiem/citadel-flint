# Contract: GLASS.1 — Structural Redesign

**Phase:** GLASS.1
**Status:** REVISED (2026-03-28 — lint fixes applied)
**Date:** 2026-03-27
**Depends on:** None (first tier)
**Agents:** flint-architect (review), flint-design-engineer (UI), flint-state-architect (stores), flint-electron-ipc (if IPC changes needed)

---

## 1. Problem Statement

Flint Glass has accumulated 7 right-sidebar tabs, 3 canvas modes that destroy context, and 5 overlapping violation surfaces. Designers cannot find information without guessing which panel to check, lose their preview every time they browse components or check health, and must click individual Fix buttons for every violation.

## 2. Design Decisions

### 2.1 Right Sidebar: 7 Tabs → 3 Tabs

**Keep:**
- **Governance** — merge current "Health" (GovernanceDashboard) INTO GovernanceOverlay as a header section. Score ring at top, violation list below.
- **Properties** — unchanged. Shows selected node properties.
- **Tokens** — unchanged. Token browser and editor.

**Remove from right sidebar:**
- **Activity** → Move to StatusBar popover (click to expand recent MCP log). Or remove entirely — this is developer telemetry.
- **Recovery** → Move to Command Palette action (`Cmd+K` → "Recovery" / "Time Machine"). Or StatusBar dropdown.
- **Scope** → Move to a settings modal accessible from GovernancePanel. This is a configuration action, not a monitoring tab.
- **Agents** → Remove from Glass entirely. This is system admin telemetry. Surface in IDE extension if needed.

**Progressive disclosure changes:**
- Only 2 tabs visible on first open: Governance, Properties
- Tokens tab appears after first token import (existing OPP-10 behavior)
- No other tabs to progressively disclose — they're gone

### 2.2 Canvas Modes: 3 → 1 + 2 Panels

**Kill Build mode. Replace with Component Panel (left sidebar).**

The current left sidebar has: Layers, Assets, Files.
New left sidebar: **Layers, Components, Assets**

"Components" tab contains:
- Search bar + category filter (from current SearchFilterBar)
- Scrollable vertical list of component cards (not spatial canvas)
- Each card: thumbnail, name, category badge, variant count, Insert button, drag handle
- Recipe section (collapsible) at top
- Variant strip expands inline below selected card

Key difference: LivePreview stays mounted. Drag-to-insert works because source (sidebar) and target (preview) coexist.

Remove "Files" tab from left sidebar — per CLAUDE.md, file explorer belongs in the IDE, not Glass.

**Kill Govern mode. Extend GovernanceDashboard in right sidebar.**

The Governance tab (right sidebar) becomes a two-level view:
- **Project level** (when no node selected): coverage bar, grade distribution, worst-offender component list (sorted by grade), each row clickable → opens that file + scrolls to violations
- **File level** (when file is active, current behavior): score ring, penalties, top rules, delta mode

Add to project-level view:
- "Fix All Tier-1" button (auto-fix all auto-fixable violations across project)
- Score trend sparkline (from debt-history data)
- Dependency overlay toggle (renders edges on main canvas as temporary layer)

**Remove the Preview/Build/Govern segmented control entirely.**

The canvas is always the canvas. No modes.

### 2.3 Unified Violation Surface

**Single source of truth:** GovernanceOverlay in the right sidebar Governance tab.

All other surfaces become links to it:
- **ShieldOverlay badges** (canvas): clicking a badge scrolls Governance tab to that violation and selects the node
- **GhostOverlay** (floating card): add "Auto-Fix" button per suggestion (it already has the data, just needs the action)
- **ViolationTooltip** (on badge hover): add "Fix" link that triggers auto-fix directly
- **StatusBar export gate**: clicking "N violations" opens Governance tab
- **GovernanceDashboard rule rows**: clicking a rule filters the violation list to that rule type

**All surfaces must agree on violation count.** Resolve the dual-store issue:
- `editorStore.linterWarnings` (used by GovernanceOverlay)
- `canvasStore.mithrilViolations` + `canvasStore.a11yViolations` (used by ShieldOverlay)
- These must derive from the same source. Either GovernanceOverlay reads from canvasStore, or ShieldOverlay reads from editorStore. Single direction of truth.

### 2.4 Fix All Button

Add to GovernanceOverlay section header:
```
[Governance Health — Score: 72/B]  [Fix 8 Auto-Fixable ▶]
```

Behavior:
- Counts violations where `autoFix` is available
- On click: batch-applies all tier-1 fixes via `window.flintAPI.mcp('flint_fix', { file, dry_run: false })`
- Shows progress: "Fixing 8 violations... (3/8)"
- On complete: re-runs audit, shows before/after counts
- If some fixes fail: show "Fixed 6/8. 2 require manual review."

### 2.5 Actionable Dashboard

GovernanceDashboard changes:
- Top-5 rule rows: clickable → filters violation list to that rule type
- Score ring: tooltip shows "Fix N [type] to reach grade [X]"
- Add score trend sparkline (reads from `debt-history.json`)
- Delta Mode toggle promoted to top of dashboard (not buried at bottom)
- "Run Audit" button in dashboard header (triggers `flint_audit` via MCP)

## 3. Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/ComponentPanel.tsx` | Left-sidebar component browser (replaces Build mode canvas) |
| `src/components/ui/ComponentPanelCard.tsx` | Compact card for sidebar list (smaller than canvas ComponentCard) |
| `src/components/ui/ActivityPopover.tsx` | StatusBar popover for recent MCP activity (replaces Activity tab) |
| `src/components/ui/RecoveryCommand.tsx` | Command palette integration for Recovery (replaces Recovery tab) |

## 4. Files to Modify

| File | What Changes |
|------|-------------|
| `src/App.tsx` | Remove right-sidebar tabs (Activity, Recovery, Scope, Agents). Remove Build/Govern canvas mode switching. Remove segmented control. Add Components to left sidebar tabs. |
| `src/store/canvasStore.ts` | Remove `canvasView`/`setCanvasView`. Remove `CanvasView` type. Narrow `RightTab` from 7 values to 3: `'governance' \| 'properties' \| 'tokens'`. Update default from `'properties'`. |
| `src/components/editor/XYCanvas.tsx` | Remove Build/Govern ReactFlow instances. Single canvas always renders LivePreview. |
| `src/components/editor/GovernanceOverlay.tsx` | Add score ring header, "Fix All" button, merged dashboard view. Make violation list the single authoritative surface. |
| `src/components/ui/GovernanceDashboard.tsx` | Convert to project-level + file-level views. Add clickable rule rows, trend sparkline, "Run Audit" button. Move delta mode toggle to top. |
| `src/components/editor/GhostOverlay.tsx` | Add Auto-Fix button per ghost suggestion. |
| `src/components/editor/ShieldOverlay.tsx` | Badge click → scroll Governance tab to violation + select node. |
| `src/components/editor/StatusBar.tsx` | Add Activity popover trigger. Violation count click → opens Governance tab. Remove override badge (move to dashboard). |
| `src/components/ui/CommandPalette.tsx` | Add "Recovery" / "Time Machine" command entries. |

## 5. Files to Deprecate

| File | Reason | Notes |
|------|--------|-------|
| `src/components/editor/CanvasViewToggle.tsx` | Segmented control removed — no canvas modes | Actually exists on disk |
| `src/components/editor/ComponentCardNode.tsx` | Canvas card node replaced by sidebar ComponentPanel | Actually exists on disk |
| `src/components/editor/RecipeStrip.tsx` | Recipes move to ComponentPanel collapsible section | Actually exists on disk |
| `src/components/ui/AgentDashboard.tsx` | Removed from Glass — admin telemetry belongs in IDE extension | Actually exists on disk |

Note: `src/components/canvas/` directory does NOT exist. Component cards live in `src/components/editor/`. Do not reference phantom paths. Deprecate with `@deprecated` JSDoc comment, remove in follow-up.

## 6. Store Changes

### canvasStore
```typescript
// REMOVE
canvasView: 'preview' | 'build' | 'govern'  // type: CanvasView
setCanvasView: (view) => void

// NARROW
type RightTab = 'governance' | 'properties' | 'tokens'  // was 7 values

// KEEP (still needed for design/interact toggle within preview)
canvasMode: 'design' | 'interact'
```

### canvasView removal — full consumer impact map (27 files)

All of these files reference `canvasView` or `setCanvasView` and must be updated:

**Source files (remove/update references):**
| File | What to change |
|------|---------------|
| `src/store/canvasStore.ts` | Remove `CanvasView` type, `canvasView` state, `setCanvasView` action |
| `src/components/editor/CanvasViewToggle.tsx` | Deprecate entire file |
| `src/components/editor/XYCanvas.tsx` | Remove Build/Govern ReactFlow branches |
| `src/components/editor/RecipeStrip.tsx` | Deprecate (moves to ComponentPanel) |
| `src/components/editor/ComponentCardNode.tsx` | Deprecate (moves to ComponentPanelCard) |
| `src/components/editor/StatusBar.tsx` | Remove "Build View"/"Govern View" labels |
| `src/components/ui/CommandPalette.tsx` | Remove Cmd+1/2/3 mode-switch commands |
| `src/App.tsx` | Remove Cmd+1/2/3 keyboard handler (lines ~488-500), remove segmented control, remove canvasView-conditional rendering |
| `src/store/componentCardStore.ts` | Remove canvasView dependency for card loading |
| `src/hooks/useDesignToCodeApply.ts` | Remove canvasView switch-to-preview logic |

**Test files (update or remove):**
| File | What to change |
|------|---------------|
| `src/store/__tests__/canvasStore.canvasView.test.ts` | Delete entire file |
| `src/store/__tests__/canvasStore.progressiveDisclosure.test.ts` | Remove canvasView references |
| `src/store/__tests__/canvasStore.breakpoint.test.ts` | Remove canvasView references |
| `src/store/__tests__/componentCardStore.test.ts` | Update card loading tests |
| `src/components/editor/__tests__/CanvasViewToggle.test.tsx` | Delete entire file |
| `src/components/editor/__tests__/RecipeStrip.test.tsx` | Rewrite for ComponentPanel context |
| `src/components/editor/__tests__/ComponentCardNode.test.tsx` | Rewrite for ComponentPanelCard |
| `src/components/ui/__tests__/CommandPalette.test.tsx` | Remove mode-switch command tests |
| `src/hooks/__tests__/useDesignToCodeApply.test.ts` | Remove canvasView assertions |

**Contract/doc files (informational, no code changes):**
`HANDOFF.md`, `.flint-context/contracts/CV2.1-contract.md`, `.flint-context/contracts/CV2.3-contract.md`, `.flint-context/contracts/D2C-2-livepreview-integration.md`, `.flint-context/contracts/GLASS-lint.md`, `flint-manifest.json`

### Fix All IPC — allowlist verification required

The "Fix All" button calls `window.flintAPI.mcp('flint_fix', ...)` from the renderer. Before implementation, verify:
1. `flint_fix` is in the renderer-callable MCP tool allowlist (SEC.3, defined in `electron/main.ts`)
2. If not, add it to the allowlist — `flint_fix` is a deterministic auto-fix tool with no destructive side effects beyond token replacement
3. The `mcpClient.ts` bidirectional channel (W.3) supports this call pattern

### componentCardStore
```typescript
// ADD
panelSearchQuery: string
panelCategoryFilter: string | null
setPanelSearch: (query: string) => void
setPanelCategoryFilter: (cat: string | null) => void
// Reuse existing card data, just different presentation
```

### editorStore / canvasStore — violation unification (RESOLVED)

**Decision: Keep both stores, add a derived selector. Do NOT move data.**

Rationale: `canvasStore.mithrilViolations` is `string[]` (flint IDs with ΔE drift). `editorStore.linterWarnings` is `Map<string, LinterWarning>` (rich objects with rule, severity, autoFix). `canvasStore.a11yViolations` is `Record<string, string[]>` (flint ID → rule IDs). These are structurally different and consumed differently. Moving data would break the export gate (`canvasStore.canExport` reads from `mithrilViolations` + `a11yViolations` + `overridesExist` + `cachedPolicy`).

**Implementation:**
```typescript
// NEW: src/hooks/useUnifiedViolations.ts
// A derived hook that reads from BOTH stores and merges into a single list
// for GovernanceOverlay, StatusBar count, and ShieldOverlay badge linking.
export function useUnifiedViolations() {
  const linterWarnings = useEditorStore(s => s.linterWarnings)
  const mithrilViolations = useCanvasStore(s => s.mithrilViolations)
  const a11yViolations = useCanvasStore(s => s.a11yViolations)
  // Merge into unified list with consistent shape
  // ShieldOverlay and GovernanceOverlay both consume this hook
  // Count is derived, not duplicated
}
```

This avoids store migration risk while giving all surfaces a single consistent view. The export gate logic in `canvasStore.canExport` remains untouched.

## 7. Test Boundaries

| Test | What it verifies |
|------|-----------------|
| Right sidebar renders only 3 tabs | Governance, Properties, Tokens visible. No Activity, Recovery, Scope, Agents. |
| Component Panel renders in left sidebar | Components tab shows searchable card list |
| Component Panel drag-to-insert works | Drag from sidebar card → drop on LivePreview → AST mutation fires |
| No Build/Govern canvas modes exist | `canvasStore` has no `canvasView` state. Segmented control absent. |
| Fix All button appears with auto-fixable violations | Button shows count, triggers batch fix, shows progress |
| Fix All button hidden when 0 auto-fixable | No button rendered when all violations are manual-only |
| Dashboard rule rows navigate to violations | Click rule → Governance tab filters to that rule type |
| Shield badge click scrolls to violation | Click badge → right sidebar scrolls to matching violation row |
| Ghost overlay has Fix buttons | Each ghost suggestion row has Auto-Fix button |
| Violation count agrees across all surfaces | GovernanceOverlay count === ShieldOverlay badge count === StatusBar count |

## 8. Risks

| Risk | Mitigation |
|------|-----------|
| Removing tabs breaks workflows users rely on | Activity → StatusBar popover preserves access. Recovery → Command Palette. Scope → settings modal. |
| Killing Build mode loses drag-to-insert | ComponentPanel in sidebar provides the same feature without context switch |
| Violation store unification causes regressions | Run full Mithril + A11y test suite after store change. Snapshot violation counts before/after. |
| Large structural change in App.tsx | Break into sub-PRs: sidebar first, then modes, then violations. Each independently testable. |

## 9. Implementation Order

1. **GLASS.1a — Sidebar Consolidation** (App.tsx tab changes, ActivityPopover, RecoveryCommand)
2. **GLASS.1b — Component Panel** (ComponentPanel.tsx, left sidebar integration, drag-to-insert)
3. **GLASS.1c — Kill Modes** (Remove segmented control, Build/Govern canvas instances)
4. **GLASS.1d — Unified Violations** (Store unification, badge linking, Ghost fix buttons)
5. **GLASS.1e — Fix All + Dashboard** (Batch fix, clickable rules, trend sparkline)

Each sub-phase is independently shippable and testable.
