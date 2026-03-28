# Contract Lint Report: GLASS.1 / GLASS.2 / GLASS.3

**Linter:** flint-contract-linter
**Date:** 2026-03-27
**Input contracts:** GLASS-1-structural-redesign.md, GLASS-2-credibility.md, GLASS-3-polish.md

---

## Contract Lint Report

### GLASS.1 — Structural Redesign

- [FAIL] **Completeness:** The contract is missing a machine-readable `.contract.ts` file entirely. The workflow requires a companion `GLASS-1-structural-redesign.contract.ts`. Without it, Phase 2 agents cannot import shared types and the linter cannot run its typescript compile check.

- [FAIL] **File paths — DELETE list:** Section 5 lists `src/components/canvas/ComponentCardGrid.tsx` and `src/components/canvas/GovernCardGrid.tsx` as files to deprecate/delete. Neither file exists on disk (Glob returns no results). The contract references phantom files. If these were already removed in a prior phase, the contract must say so. If they were never created, the contract must remove them from the list.

- [PASS] **File paths — MODIFY list:** All 9 files in the modify list exist on disk: `src/App.tsx`, `src/store/canvasStore.ts`, `src/components/editor/XYCanvas.tsx`, `src/components/editor/GovernanceOverlay.tsx`, `src/components/ui/GovernanceDashboard.tsx`, `src/components/editor/GhostOverlay.tsx`, `src/components/editor/ShieldOverlay.tsx`, `src/components/editor/StatusBar.tsx`, `src/components/ui/CommandPalette.tsx`. All confirmed present.

- [FAIL] **File paths — DELETE list:** `src/components/ui/AgentDashboard.tsx` is listed for removal but the file is actively rendered at `App.tsx:971` (`{rightTab === 'agents' && <AgentDashboard />}`) and imported at line 27. Deleting it without simultaneously removing the import and the render branch in `App.tsx` will produce a compile error. The contract's modify list for `App.tsx` must explicitly enumerate this removal, not leave it implied.

- [FAIL] **Store consistency — `componentCardStore`:** The contract proposes adding `panelSearchQuery`, `panelCategoryFilter`, `setPanelSearch`, and `setPanelCategoryFilter` to a store called `componentCardStore`. The actual store at `src/store/componentCardStore.ts` does not contain these fields and there is no indication they were part of a prior phase. This is a valid addition, but the contract specifies it as an addition to `componentCardStore` without cross-referencing the existing store shape. Because `ComponentPanel` (to be created) will consume these fields, the contract must explicitly confirm that `componentCardStore` is the target store (not a new dedicated store) and list the full new type signature.

- [FAIL] **Store consistency — `canvasStore` removal side-effects:** The contract removes `canvasView` and `setCanvasView`. Both are referenced in at least 19 source files (confirmed via grep): `CanvasViewToggle.tsx`, `XYCanvas.tsx`, `CommandPalette.tsx`, `RecipeStrip.tsx`, `ComponentCardNode.tsx`, multiple test files, and `App.tsx` itself (the keyboard handler at lines 488–500 calls `setCanvasView('preview'/'build'/'govern')` with Cmd+1/2/3). The contract's impact map for `XYCanvas.tsx` says "Remove Build/Govern ReactFlow instances" but does not enumerate all the other files that must change. This is a hidden dependency that will cause compile errors if agents work from this contract. The impact map is incomplete.

- [FAIL] **IPC integrity:** Section 4 states GovernanceOverlay should call `window.flintAPI.mcp('flint_fix', { file, dry_run: false })` for the Fix All button. The current `GovernanceOverlay` reads from `editorStore.linterWarnings` and calls `editorStore.applyBatch()` directly — it does not use the MCP bridge. The contract introduces an IPC call pattern to a component that currently has none. This is a new IPC usage (renderer calling `window.flintAPI.mcp`) that requires verifying this method exists on the preload bridge and is in the MCP tool allowlist (SEC.3 commandment). The contract must confirm `flint_fix` is in the renderer-callable MCP allowlist, or propose a different mechanism.

- [FAIL] **Violation unification — decision deferred:** Section 6 documents Option A vs. Option B for the violation single source of truth but marks it "DECISION NEEDED." A contract must make this decision. Phase 2 agents cannot implement against an open question. Specifically: `editorStore.linterWarnings` is a `Map<string, LinterWarning>` while `canvasStore.mithrilViolations` is `string[]` and `canvasStore.a11yViolations` is `Record<string, string[]>`. The two stores have different shapes. The contract must specify the canonical shape, which store wins, and what the migration plan is for the losing store's consumers.

- [PASS] **Test coverage:** 10 test boundaries listed. Coverage is adequate for the scope. All key behaviors (Fix All, badge click, violation count agreement, mode removal) have corresponding tests.

- [WARNING] **Risks:** The risk section is good but the "Large structural change in App.tsx" risk is understated. `App.tsx` already imports and renders `AgentDashboard`, `ComponentScopePanel`, `RecoveryPanel`, and `ActivityFeed` by name. Removing these tab renders requires removing imports too. If an agent modifies only the tab bar and not the imports, tsc will flag unused imports. The contract should note this explicitly.

- [WARNING] **`RightTab` type in canvasStore:** The `RightTab` type (line 31 of `canvasStore.ts`) is `'properties' | 'tokens' | 'activity' | 'health' | 'agents' | 'scope' | 'recovery'`. GLASS.1 proposes keeping only 3 tabs. The `RightTab` type must be narrowed to `'governance' | 'properties' | 'tokens'` (or similar). The contract does not mention this required type change. If a Phase 2 agent leaves the enum unchanged, Zustand state will still hold stale tab values.

- **Verdict: REVISE**
- **Blocking issues:** 6 (missing .contract.ts, phantom delete targets, AgentDashboard deletion without App.tsx wiring, canvasView removal scope underspecified, IPC usage unverified, violation unification decision not made)

---

### GLASS.2 — Credibility

- [FAIL] **Completeness:** No companion `.contract.ts` file exists. Required by the Contract-First workflow.

- [PASS] **File paths — CREATE list:** 5 files listed for creation (`PanelErrorBoundary.tsx`, `FocusTrap.tsx`, `EmptyState.tsx`, `PanelErrorBoundary.test.tsx`, `EmptyState.test.tsx`). None currently exist on disk, which is correct for CREATE entries.

- [PASS] **File paths — MODIFY list:** All 8 files listed for modification exist on disk (`LayerTree.tsx`, `FileExplorer.tsx`, `ExportModal.tsx`, `GovernancePanel.tsx`, `SetupWizard.tsx`, `BetaFeedbackModal.tsx`, `RecoveryPanel.tsx`, `App.tsx`).

- [FAIL] **File path accuracy — RecoveryPanel emoji line numbers:** Section 2.5 provides approximate line numbers (e.g. "~105", "~114", "~125", "~150", "~155") for emoji replacements in `RecoveryPanel.tsx`. Reading the actual file: the first emoji (`🗂` equivalent — the file uses `🗂` as Unicode at line 105), `⏳` at line 123, and `✓`/`✗` at lines 151/157. The contract's line number approximations are close but `⟳` (used as a spinner at line 114) is not a conventional emoji — it is a Unicode symbol. More critically, the contract lists 5 emoji to replace but the actual file has only 4 distinct emoji/symbol occurrences in the empty-state and status sections. The `✓`/`✗` on lines 151/157 are not emoji — they are Unicode check marks. The contract should be explicit about which Unicode characters to replace, not rely on approximate line numbers. This is a WARNING-level issue that will not block implementation but will cause confusion.

- [PASS] **IPC integrity:** GLASS.2 makes no IPC changes. All work is pure renderer-layer (ARIA, React components, CSS). No process boundary crossing. No new IPC channels required.

- [PASS] **Store consistency:** GLASS.2 makes no store changes. No store modifications are proposed.

- [FAIL] **Missing agents from CLAUDE.md:** Section 2 and the Implementation Order specify `flint-accessibility` as an agent. This agent does not appear in the canonical agent list in CLAUDE.md (which lists `flint-electron-ipc`, `flint-state-architect`, `flint-design-engineer`, `flint-test-writer`, `flint-ast-surgeon`, `flint-mcp-specialist`, `flint-database`, `flint-accessibility`). Cross-checking: `flint-accessibility` IS in the CLAUDE.md agent list. This passes.

- [FAIL] **`App.tsx` wrap-all-panels claim is underspecified:** Section 2.3 says "Wrap every panel component in App.tsx" and lists 10 panels. However, the actual `App.tsx` render for `GovernanceOverlay` is inside the `properties` tab render (line 964), not as a standalone panel. `PropertiesPanel` is rendered inside the same block. The panel list in the contract does not match how components are actually mounted in `App.tsx`. `ActivityFeed` is at `rightTab === 'activity'`, `RecoveryPanel` at `rightTab === 'recovery'`. These are all conditionally rendered — an agent wrapping them with `PanelErrorBoundary` must understand the conditional render context. The contract says "wrap every panel in App.tsx" but does not acknowledge the conditional-render architecture. An agent that reads this literally might try to wrap the import rather than the JSX usage.

- [FAIL] **`TokenManager` empty state:** Section 2.4 lists `TokenManager (no tokens) | Unknown | [new empty state]`. The "Unknown" indicates the architect did not verify the current empty state in `TokenManager.tsx`. Before specifying a fix, the current behavior must be established. This is a contract incompleteness.

- [PASS] **Test coverage:** 16 test boundaries. All key behaviors covered (ARIA roles, keyboard navigation, focus trap, error boundary retry, empty states, emoji elimination). Adequate.

- [WARNING] **`FocusTrap` library choice:** Section 2.2 mentions "or install `focus-trap-react`" as an alternative. This is a build dependency decision that should be resolved in the contract, not left to the implementing agent. If `focus-trap-react` is added it needs to appear in `package.json` changes (which are not listed in Files to Modify).

- **Verdict: REVISE**
- **Blocking issues:** 2 (missing .contract.ts, TokenManager current-state unknown and therefore fix underspecified)
- **Warning-level issues:** 3 (RecoveryPanel emoji line numbers approximate, App.tsx wrap-all-panels needs architectural precision, FocusTrap library decision deferred)

---

### GLASS.3 — Polish

- [FAIL] **Completeness:** No companion `.contract.ts` file exists. Required by the Contract-First workflow.

- [PASS] **File paths — CREATE list:** 3 files (`Skeleton.tsx`, `TabTransition.tsx`, `Skeleton.test.tsx`). None exist on disk. Correct for CREATE entries.

- [PASS] **File paths — MODIFY list:** All 9 files listed for modification exist on disk (`LivePreview.tsx`, `App.tsx`, `ResizeHandle.tsx`, `canvasStore.ts`, `GovernanceOverlay.tsx`, `GovernanceDashboard.tsx`, `OnboardingOverlay.tsx`, `StatusBar.tsx`, `CommandPalette.tsx`). All confirmed present.

- [FAIL] **Store consistency — panel collapse additions:** Section 3.2 proposes adding `leftPanelCollapsed`, `rightPanelCollapsed`, `leftPanelWidth`, `rightPanelWidth`, `toggleLeftPanel`, `toggleRightPanel` to `canvasStore`. Reading `canvasStore.ts`: panel widths are currently managed as local `useState` in `App.tsx` (lines 112-113: `leftWidth`, `rightWidth`). Moving them to the Zustand store is a architectural change that affects `App.tsx` and all consumers reading those widths. The contract lists `App.tsx` as a modified file but does not explicitly call out that `leftWidth`/`rightWidth` local state must be removed and replaced with store selectors. The `closeWorkspace` action in `canvasStore` will also need to reset these new fields. The contract omits this from the `closeWorkspace` specification.

- [FAIL] **Dependency ordering on 3.3 Tab skeletons:** Section 3.3B says skeletons apply to `AgentDashboard` "if this panel survives GLASS.1." GLASS.3 declares `Depends on: GLASS.1`. If GLASS.1 removes `AgentDashboard`, then GLASS.3's skeleton spec for it is N/A. The contract handles this with the inline note, which is acceptable. However, the same conditionality applies to `ActivityFeed` — GLASS.1 moves Activity to a StatusBar popover. If GLASS.1 is implemented first, `ActivityFeed` may no longer be a right-sidebar panel that needs a skeleton. The contract does not acknowledge this dependency conflict for `ActivityFeed`.

- [FAIL] **Agent `flint-perf-profiler`:** Section 3 lists `flint-perf-profiler` as a responsible agent. This agent exists (confirmed at `.claude/agents/flint-perf-profiler.md`) but is not in the canonical specialist agent list in CLAUDE.md. If this agent lacks write permissions in the project environment, or is not an approved Flint specialist, its assignment is invalid. The contract should use `flint-design-engineer` for loading state UI work (which is UI work, not performance profiling).

- [PASS] **IPC integrity:** GLASS.3 makes no IPC changes. The `isTransforming` state in `LivePreview` is renderer-local. No new IPC channels.

- [PASS] **Test coverage:** 14 test boundaries. All key behaviors covered (loading overlay, stale badge, panel collapse, keyboard navigation, onboarding, production cleanup). Adequate.

- [FAIL] **`__DEV__` global availability:** Section 3.1D and 3.4C reference gating the "Load Demo" button with `__DEV__`. Vite exposes `import.meta.env.DEV` (boolean), not a global `__DEV__` variable. Using bare `__DEV__` will throw a `ReferenceError` at runtime unless it is defined in `vite.config` as a global. The contract must specify either `import.meta.env.DEV` or document that `__DEV__` is already defined as a Vite global. Reading `vitest.config.ts` would confirm, but this is a correctness risk the contract must resolve.

- [WARNING] **`closeWorkspace` omission:** The new panel collapse state fields (`leftPanelCollapsed`, `rightPanelCollapsed`) should reset on `closeWorkspace` to prevent collapsed-panel state bleeding across projects. The contract does not specify this.

- [WARNING] **Tab overflow and GLASS.1 dependency:** Section 3.8 says to implement tab overflow "after GLASS.1 determines final tab count." If GLASS.1 reduces right tabs from 7 to 3, tab overflow is unlikely to ever trigger. This item may be entirely N/A after GLASS.1. The contract should make the conditional explicit: "Only implement if tab count > 4 after GLASS.1 completes."

- **Verdict: REVISE**
- **Blocking issues:** 4 (missing .contract.ts, panel collapse store migration incomplete, flint-perf-profiler agent invalid for UI work, `__DEV__` global undefined)
- **Warning-level issues:** 2 (closeWorkspace omission, tab overflow conditionality)

---

### Cross-Contract Coherence

- [FAIL] **GovernanceOverlay double-modification:** Both GLASS.1 and GLASS.3 list `src/components/editor/GovernanceOverlay.tsx` as a file to modify. GLASS.1 adds the Fix All button and score ring header. GLASS.3 adds keyboard navigation (J/K/F/S). These are non-conflicting changes, but both contracts assign the file to different agents (GLASS.1 to `flint-design-engineer`/`flint-state-architect`, GLASS.3 to `flint-design-engineer`). Without explicit sequencing, two agents in the same sprint could produce conflicting diffs to the same file. The contracts must specify that GLASS.3 changes to `GovernanceOverlay` are blocked until GLASS.1 is merged.

- [FAIL] **App.tsx modified by all three contracts:** `src/App.tsx` is a modify target in GLASS.1, GLASS.2, and GLASS.3. Each contract assigns a different set of changes to the same file. If all three are implemented in parallel, agents will produce conflicting patches. The contracts must serialize App.tsx modifications: GLASS.1 changes land first (structural), GLASS.2 changes second (ErrorBoundary wrapping, which depends on the GLASS.1 tab structure), GLASS.3 changes third (collapse state, IPC pill removal). This dependency chain is not stated in any contract's "Depends on" section. GLASS.2 and GLASS.3 both say they can run parallel to GLASS.1 — but their App.tsx changes cannot.

- [FAIL] **StatusBar modified by GLASS.1 and GLASS.3:** GLASS.1 adds an Activity popover trigger and violation count click to `StatusBar.tsx`. GLASS.3 removes the IPC pill and moves the override badge from the same file. Both contracts must be sequenced. Currently GLASS.3 declares "Depends on: GLASS.1" — this correctly serializes them. The sequencing for StatusBar is valid. No blocking issue here.

- [FAIL] **GLASS.1 kills tabs that GLASS.2 wraps:** GLASS.2 says "Wrap every panel component in App.tsx" and lists `ActivityFeed`, `RecoveryPanel`, and `AgentDashboard` in its wrap list. GLASS.1 removes these as right sidebar panels. If GLASS.1 lands first, the GLASS.2 instruction to wrap `ActivityFeed` in `PanelErrorBoundary` within the right sidebar is already obsolete before GLASS.2 begins. GLASS.2 says it "can run parallel with GLASS.1" — but the ErrorBoundary wrap targets depend on GLASS.1's outcome. GLASS.2 must declare `Depends on: GLASS.1` or scope its ErrorBoundary targets to only the 3 surviving tabs.

- [PASS] **GovernanceDashboard modifications are non-conflicting:** GLASS.1 adds clickable rule rows and trend sparkline. GLASS.3 adds skeleton loading state. These target different parts of the component. If sequenced (GLASS.1 first), they are safe to implement without conflict.

- [FAIL] **Violation source of truth conflict propagates:** GLASS.1's unresolved "DECISION NEEDED" on violation store unification directly affects GLASS.3's keyboard navigation feature. GLASS.3 adds J/K navigation to `GovernanceOverlay.tsx` which reads from `editorStore.linterWarnings`. If GLASS.1 decides to move violation truth to `canvasStore`, GLASS.3's implementation target changes. GLASS.3 cannot be fully specified until GLASS.1's store decision is made.

- [WARNING] **`RightTab` enum:** GLASS.1 narrows the right tab set from 7 to 3, requiring a `RightTab` type change in `canvasStore.ts`. GLASS.3 adds keyboard navigation to `GovernanceOverlay` and assumes the Governance tab exists (it does — it is one of the 3 surviving tabs). The type narrowing in GLASS.1 must be done correctly so GLASS.3's references to the tab system remain valid.

---

### Summary Table

| Check | GLASS.1 | GLASS.2 | GLASS.3 |
|-------|---------|---------|---------|
| .contract.ts exists | FAIL | FAIL | FAIL |
| File paths accurate | FAIL (phantoms) | PASS | PASS |
| Store consistency | FAIL (incomplete) | PASS | FAIL (incomplete) |
| IPC integrity | FAIL (unverified) | PASS | PASS |
| Test coverage | PASS | PASS | PASS |
| Agent validity | PASS | PASS | FAIL (perf-profiler) |
| Cross-contract coherence | FAIL | FAIL | FAIL |

---

### Overall Verdict: REVISE

All three contracts are REVISE. No implementation may begin. The following blocking issues must be resolved before Phase 2:

**GLASS.1 — 6 blocking issues:**
1. Create `GLASS-1-structural-redesign.contract.ts` with typed exports.
2. Remove `src/components/canvas/ComponentCardGrid.tsx` and `src/components/canvas/GovernCardGrid.tsx` from the delete list — they do not exist on disk.
3. Add `src/App.tsx` import removal to the impact map when `AgentDashboard` is deleted (line 27 import + line 971 render must both be removed).
4. Expand the `canvasView` removal impact map to include all 19 affected files (confirmed via grep): `CanvasViewToggle.tsx`, `RecipeStrip.tsx`, `ComponentCardNode.tsx`, keyboard handler in `App.tsx` (lines 488-500), all test files that reference `setCanvasView` or `canvasView`. Agents working only from this contract will miss them.
5. Confirm `window.flintAPI.mcp('flint_fix')` is in the renderer-callable MCP allowlist (SEC.3) or replace with `editorStore.applyBatch` for the Fix All implementation.
6. Make the violation store unification decision explicit: declare which store is canonical, what the new type shape is, and list all files that must be migrated.

**GLASS.2 — 2 blocking issues:**
1. Create `GLASS-2-credibility.contract.ts` with typed exports.
2. Read `TokenManager.tsx` and document the actual current empty state before specifying the replacement. "Unknown" is not an acceptable contract state.

**GLASS.3 — 4 blocking issues:**
1. Create `GLASS-3-polish.contract.ts` with typed exports.
2. Specify the full `closeWorkspace` update required when adding panel collapse fields to `canvasStore` (reset `leftPanelCollapsed`, `rightPanelCollapsed`, `leftPanelWidth`, `rightPanelWidth`).
3. Replace `flint-perf-profiler` with `flint-design-engineer` for all loading-state UI work in section 3.1.
4. Replace `__DEV__` with `import.meta.env.DEV` throughout the contract (sections 3.1D, 3.4C), or document that `__DEV__` is already a configured Vite global.

**Cross-contract — 2 blocking issues:**
1. GLASS.2 must declare `Depends on: GLASS.1` (not parallel-safe) because its ErrorBoundary wrap targets include panels that GLASS.1 removes. GLASS.2 must scope its wrap targets to the 3 surviving tabs only.
2. GLASS.3's `GovernanceOverlay` changes must be explicitly blocked until GLASS.1's overlay restructuring is merged. Add to GLASS.3 implementation order: "GovernanceOverlay changes require GLASS.1 overlay work to be merged first."
