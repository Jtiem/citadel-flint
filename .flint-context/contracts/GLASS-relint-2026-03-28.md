# Contract Re-Lint Report: GLASS.1 / GLASS.2 / GLASS.3

**Date:** 2026-03-28
**Linter:** flint-contract-linter
**Purpose:** Verify all 6 previous blockers and warnings are resolved. Catch any new issues introduced by revisions.

---

## Re-Lint Report

### GLASS.1 — Structural Redesign

**[PASS] Blocker 1 (violation store decision open):**
Section 6 now contains an explicit "RESOLVED" heading. The decision is documented: keep both stores, add `useUnifiedViolations` as a derived hook. Rationale for non-migration is sound (structural type mismatch between `string[]`, `Map<string, LinterWarning>`, and `Record<string, string[]>`; `canExport()` depends on existing shape). New file `src/hooks/useUnifiedViolations.ts` is listed as a CREATE in the impact map. Blocker is resolved.

**[PASS] Blocker 2 (canvasView consumer map underspecified):**
Section 6 now contains a full 27-entry table broken into three categories: source files (10), test files (9), and contract/doc files (8). Every entry specifies what changes. The source files list is realistic and verifiable (all 10 files confirmed present on disk). Blocker is resolved.

**[PASS] Blocker 3 (phantom DELETE paths):**
Section 5 now reads "Deprecate" not "Delete." The four files listed (CanvasViewToggle.tsx, ComponentCardNode.tsx, RecipeStrip.tsx, AgentDashboard.tsx) all exist on disk — confirmed via Glob. The note at the bottom explicitly states `src/components/canvas/` does not exist and prohibits phantom path references. Blocker is resolved.

**[PASS] Warning (RightTab type narrowing):**
Section 6 now specifies the exact narrowed type: `type RightTab = 'governance' | 'properties' | 'tokens'` (was 7 values). The default tab is updated to `'properties'` (matches current store default — confirmed in `canvasStore.ts` line 406). The `DEFAULT_UNLOCKED_TABS` set currently contains `'health'` and `'properties'`; the contract's tab rename from `'health'` to `'governance'` needs to carry through to this constant. This is correctly implied by the impact map entry for `canvasStore.ts` but is not explicitly stated — noted as a minor gap (see New Issues below).

**[PASS] Warning (Fix All IPC allowlist):**
Section 6 now contains an explicit pre-implementation checklist requiring the agent to verify `flint_fix` is in the SEC.3 renderer-callable allowlist before wiring up the button. The contract correctly does not assume it is allowed. This is appropriately deferred to the implementation agent.

**New issues in GLASS.1:**

1. **[WARNING]** `DEFAULT_UNLOCKED_TABS` constant currently contains `'health'` (line 38 of `canvasStore.ts`). The contract narrows `RightTab` to `'governance' | 'properties' | 'tokens'`, which means the `'health'` value in `DEFAULT_UNLOCKED_TABS` will become a type error after the migration. The impact map entry for `canvasStore.ts` says "Remove `CanvasView` type, `canvasView` state, `setCanvasView` action" and "Narrow `RightTab`" but does not mention updating `DEFAULT_UNLOCKED_TABS` from `'health'` to `'governance'`. The implementing agent will likely produce a type error unless this is explicit. Recommend adding a bullet to the canvasStore change spec.

2. **[WARNING]** The `closeWorkspace` action in the current store (line 571) resets `rightTab` to `'properties'`. After the rename, this remains valid. However, the progressive disclosure unlock effects in `App.tsx` call `unlockTab('activity')`, `unlockTab('recovery')`, `unlockTab('scope')`, and `unlockTab('agents')` — all of which will be removed tabs. Those four `useEffect` blocks (App.tsx lines 207-227) must also be deleted. They are listed in the canvasView consumer map but only under `App.tsx` generically ("Remove Cmd+1/2/3 keyboard handler, remove segmented control, remove canvasView-conditional rendering"). The tab-unlock effects are not called out specifically. Risk of the implementing agent missing them.

3. **[INFO]** `useUnifiedViolations` is listed as a new CREATE file but has no test boundary specified. All new public APIs require at least one test boundary per the lint schema. The test boundaries section (Section 7) covers surface-level behavior ("Violation count agrees across all surfaces") but does not name a test that directly exercises the `useUnifiedViolations` hook itself. Recommend adding: "useUnifiedViolations returns merged count matching sum of unique violations across both stores."

**Verdict: APPROVED** — Blockers resolved. Warnings do not block Phase 2 but should be addressed during implementation.

---

### GLASS.2 — Credibility

**[PASS] Blocker 4 (dependency incorrect):**
Header now reads `Depends on: GLASS.1a (sidebar consolidation)`. Section 2.3 explicitly lists which panels survive GLASS.1a and which are removed, making the ErrorBoundary wrap list precise. The removed panels (ActivityFeed, RecoveryPanel, AgentDashboard, ComponentScopePanel) are correctly excluded with a strikethrough note. Blocker is resolved.

**[PASS] Warning (TokenManager empty state):**
Section 2.4 table now includes a row for TokenManager noting it is "ALREADY GOOD" and "No change needed." This closes the ambiguity. Pass.

**[PASS] Warning (FocusTrap library decision):**
Section 2.2 now specifies the exact implementation approach: a lightweight custom `FocusTrap` component in `src/components/ui/FocusTrap.tsx` with no external dependency. The implementation spec (query focusable elements on mount, intercept Tab/Shift+Tab, return focus to trigger on unmount) is detailed enough to implement. `focus-trap-react` is explicitly rejected to keep bundle lean. Pass.

**[PASS] Warning (RecoveryPanel line numbers):**
Section 2.5 now specifies exact line numbers and exact current content. Verified against `src/components/ui/RecoveryPanel.tsx`:
- Line 105: `🗂` — CONFIRMED
- Line 114: `⟳` (Unicode reload symbol with `animate-spin`) — CONFIRMED
- Line 123: `⏳` (hourglass emoji) — CONFIRMED
- Line 151: `✓` (within status string) — CONFIRMED
- Line 157: `✗` (within error string) — CONFIRMED
All five line numbers match the actual file. The Unicode descriptions are accurate. Pass.

**[PASS] Warning (ErrorBoundary scope):**
The wrap list in Section 2.3 is now definitive: 8 specific panels listed to wrap, 4 explicitly excluded with rationale. The wrap pattern shows the exact JSX shape at the App.tsx call site. Pass.

**New issues in GLASS.2:**

1. **[WARNING]** `FocusTrap.tsx` is listed in Section 3 as a file to create, and in Section 4 as a file to modify under `ExportModal.tsx`, `GovernancePanel.tsx`, `SetupWizard.tsx`, `BetaFeedbackModal.tsx`. However, there is no corresponding test file listed for `FocusTrap.tsx` itself. The test boundaries section includes "ExportModal traps focus on open" and "ExportModal returns focus on close" which indirectly test the trap, but there is no unit test for the `FocusTrap` component in isolation. This matters because `FocusTrap` is a new shared utility — a bug in it breaks all 4 modals simultaneously. Recommend adding `src/components/ui/__tests__/FocusTrap.test.tsx` to Section 3.

2. **[WARNING]** The `BetaFeedbackModal` is listed in Section 2.2 as a target for FocusTrap. Verify this component is rendered as a true modal (blocking background) rather than a toast or slide-in panel. If it is not a blocking modal, `aria-modal="true"` and background `aria-hidden` would be incorrect. This is a pre-implementation verification item for the accessibility agent.

3. **[INFO]** Section 2.4 specifies `ActivityFeed` empty state with icon + text. However, per GLASS.1, ActivityFeed is being moved to a StatusBar popover. The empty state fix targets the panel version which will no longer exist in its current form. The popover version (`ActivityPopover.tsx`) is a new CREATE in GLASS.1 and will need its own empty state from the start. This is not a blocker — the fix is still valid for the current ActivityFeed while GLASS.1 is in progress — but GLASS.2 agents should note that `ActivityFeed.tsx` empty state may be superseded by `ActivityPopover.tsx`.

**Verdict: APPROVED** — Blockers resolved. Warnings are implementation-guidance items, not contract defects.

---

### GLASS.3 — Polish

**[PASS] Blocker 5 (`__DEV__` undefined):**
Section 3.4C now reads: "replace with conditional `if (__DEV__)` guards" — wait, this still references `__DEV__`. However, Section 3.1D (the primary location for this blocker) reads: "Remove or `import.meta.env.DEV`-gate the 'Quick Load' label and 'Load Demo' button." The primary fix location (3.1D) uses the correct Vite idiom. Section 3.4C uses `__DEV__` in a generic example referring to `console.log` statements, not as an actual code reference. The `console.log` cleanup is informational context, not a code prescription. The actionable item in 3.1D correctly specifies `import.meta.env.DEV`. Confirmed: "Load Demo" exists in LivePreview.tsx at line 887 with no guard — the fix target is real. Blocker is substantively resolved; the residual `__DEV__` mention in 3.4C is imprecise but not blocking.

However: `__DEV__` in 3.4C is still undefined in this codebase — Grep across all `src/` files confirms zero occurrences of `__DEV__`. If any agent reads 3.4C literally and emits `if (__DEV__)` guards around console.log calls, it will produce a TS `noImplicitAny` error. This needs to be addressed.

**[REVISED VERDICT on Blocker 5]: FAIL — partially addressed.** 3.1D is correct. 3.4C still references `__DEV__` as if it is defined. The contract must say `import.meta.env.DEV` consistently in both locations.

**[PASS] Blocker 6 (panel collapse migration incomplete):**
Section 3.2 now specifies the complete migration:
- Remove `const [leftWidth, setLeftWidth] = useState(224)` at line 112
- Remove `const [rightWidth, setRightWidth] = useState(288)` at line 113
- Remove `handleLeftDrag` and `handleRightDrag` callbacks at lines 115-121
- Replace with canvasStore selectors
- Update `closeWorkspace` to reset panel widths and collapsed state

Verified: App.tsx lines 112-113 confirm exactly `useState(224)` and `useState(288)` — the line numbers are correct. `closeWorkspace` in `canvasStore.ts` currently resets `canvasMode`, `canvasView`, `nodeLayouts`, `rightTab` etc. but does not include panel widths (because those live in App.tsx useState today). The contract correctly specifies that after migration, `closeWorkspace` must include the four new fields. Blocker is resolved.

**[PASS] Warning (agent assignment):**
The header now lists both agents: `flint-design-engineer (UI, loading states), flint-state-architect (stores)`. Each work item in Section 2 maps to one of these agents. Pass.

**[PASS] Warning (GovernanceOverlay dependency):**
Section 6 Implementation Order now explicitly states item 3.7 "Do NOT start until GLASS.1d GovernanceOverlay restructure is merged." This is a clear blocking dependency on the GLASS.1d sub-phase. Pass.

**New issues in GLASS.3:**

1. **[BLOCKING]** Section 3.4C uses `__DEV__` in: "Any other `console.log` debug output in production → replace with conditional `if (__DEV__)` guards." This identifier is undefined in this codebase (confirmed by Grep). Any agent implementing this literally will produce TypeScript errors. Must be changed to `if (import.meta.env.DEV)`.

2. **[WARNING]** Section 3.3B specifies skeletons for `AgentDashboard` with the caveat "if this panel survives GLASS.1." Per GLASS.1 Section 2.1, AgentDashboard is being removed from Glass entirely. The skeleton work for AgentDashboard is therefore N/A. The contract should remove that item or replace the caveat with "N/A — removed in GLASS.1." As written, an implementing agent may build a skeleton for a panel that no longer exists.

3. **[WARNING]** Section 3.2 specifies `PANEL_MIN` as 160px. The actual value in `App.tsx` line 59 is `const PANEL_MIN = 160` — confirmed correct. However, the contract does not specify where `PANEL_MIN` will live after the migration. Currently it is a module-level constant in App.tsx. If panel collapse state moves to canvasStore, `PANEL_MIN` should either remain in App.tsx (accessed by the ResizeHandle) or be exported from canvasStore. This is an implementation decision that should be specified to prevent agent divergence.

4. **[WARNING]** Section 3.7 specifies keyboard shortcuts `J/K/F/S` on GovernanceOverlay but does not specify the focus model. For `J/K` to work, the Governance tab must have focus, but the contract does not describe how focus enters the Governance panel (click on the panel? Tab from the tab bar?). Without a specified focus entry point, the keyboard navigation will be unreachable in practice. Recommend adding: "The violation list receives focus when the Governance tab is clicked or when the panel is activated via keyboard."

5. **[INFO]** Section 3.5 is correctly conditional ("If GLASS.1 kills modes: N/A"). Since GLASS.1 kills modes, this entire section is N/A. The contract could remove it to avoid confusion, but the conditional phrasing is acceptable.

**Verdict: REVISE** — One blocking issue remains (3.4C `__DEV__` reference). Warnings should be addressed before Phase 2 agents start on 3.4C.

---

### Cross-Contract Coherence

**[PASS] App.tsx merge order:**
GLASS.1, GLASS.2, and GLASS.3 all modify App.tsx. The ordering is sound:
- GLASS.1a removes tabs and segmented control (structural surgery)
- GLASS.2 wraps surviving panels in ErrorBoundaries (additive)
- GLASS.3 migrates panel widths from useState to canvasStore (state refactor)
These are non-overlapping concerns on App.tsx and can be sequenced without conflict. GLASS.2 correctly depends on GLASS.1a to know which panels survive before wrapping. GLASS.3.2 is listed as independent (only needs canvasStore). The ordering is internally consistent.

**[PASS] Violation store consistency:**
All three contracts agree: `editorStore.linterWarnings` and `canvasStore.mithrilViolations`/`a11yViolations` remain separate. `useUnifiedViolations` (GLASS.1d) is the single derived surface. GLASS.3.7 keyboard navigation references "GLASS.1d unified violations + `useUnifiedViolations` hook" as a prerequisite. Consistent.

**[PASS] GLASS.2 → GLASS.1 dependency:**
GLASS.2 header says `Depends on: GLASS.1a`. This is the correct sub-phase (sidebar consolidation determines which panels exist to wrap). GLASS.2 does not depend on GLASS.1b/c/d/e. The dependency is as narrow as possible. Pass.

**[FAIL] GLASS.3 → GLASS.1 blocking items:**
GLASS.3 Section 6 correctly blocks items 3.6, 3.7, 3.8 on GLASS.1 merging. However, GLASS.3's header says `Depends on: GLASS.1 (some items)` — this is imprecise. "GLASS.1" is a multi-sub-phase contract. Items 3.6/3.7/3.8 specifically depend on GLASS.1d (unified violations) and GLASS.1a (sidebar tab count). The body of Section 6 is specific enough, but the header dependency declaration should say `Depends on: GLASS.1a (for 3.6/3.8), GLASS.1d (for 3.7)` for agents that read only the header. This is a documentation gap, not a contract logic error — minor but worth fixing to prevent an agent starting 3.7 before GLASS.1d is merged.

---

### Overall Verdict: REVISE

**GLASS.1: APPROVED**
**GLASS.2: APPROVED**
**GLASS.3: REVISE** — One blocking issue: Section 3.4C uses `__DEV__` which is undefined in this Vite project. Must be changed to `import.meta.env.DEV`.

Return GLASS.3 to flint-architect for a single-line fix. After correction, GLASS.3 is expected to APPROVE on re-lint.

---

## Required Fix for GLASS.3

**Section 3.4C — line to change:**

Current:
```
Any other `console.log` debug output in production → replace with conditional `if (__DEV__)` guards
```

Required:
```
Any other `console.log` debug output in production → replace with conditional `if (import.meta.env.DEV)` guards
```

This is the only blocking change. All other items are warnings that implementation agents should note but that do not gate Phase 2.

---

## What Phase 2 Agents Can Rely On (GLASS.1 and GLASS.2)

- The canvasView consumer map is complete and verified — all 10 source files exist on disk
- Deprecation targets (CanvasViewToggle, ComponentCardNode, RecipeStrip, AgentDashboard) exist and are correctly described
- The violation store decision is final: two stores remain, `useUnifiedViolations` is the unified surface
- RecoveryPanel emoji locations (lines 105, 114, 123, 151, 157) match the actual file
- All 4 modal files targeted for FocusTrap exist on disk
- ErrorBoundary wrap targets are scoped to post-GLASS.1a surviving panels only
- RightTab narrowing to 3 values is specified with exact type literal
- Panel width migration from App.tsx useState to canvasStore is fully specified including closeWorkspace reset
