# Contract: GLASS.2 — Credibility (Glass Passes Its Own Standards)

**Phase:** GLASS.2
**Status:** REVISED (2026-03-28 — lint fixes applied)
**Date:** 2026-03-27
**Depends on:** GLASS.1a (sidebar consolidation) — ErrorBoundary wrap targets must match surviving panels
**Agents:** flint-accessibility (2.1, 2.2), flint-design-engineer (2.3, 2.4, 2.5), flint-test-writer (all)

---

## 1. Problem Statement

Flint Glass enforces 50 WCAG 2.1 AA rules on other people's code but fails basic accessibility standards in its own UI. The LayerTree and FileExplorer have zero ARIA semantics. No modal traps focus. No panel has an ErrorBoundary. Empty states range from "bare text" to "missing entirely." This is a credibility problem for a governance product.

## 2. Work Items

### 2.1 ARIA Tree Semantics (LayerTree + FileExplorer)

**LayerTree** (`src/components/ui/LayerTree.tsx`):
- Root container: `role="tree"` + `aria-label="Component layer tree"`
- Each row: `role="treeitem"` + `aria-level={depth}` + `aria-selected={isSelected}`
- Collapsible rows: `aria-expanded={isExpanded}`
- Keyboard navigation:
  - `ArrowDown` → next visible treeitem
  - `ArrowUp` → previous visible treeitem
  - `ArrowRight` → expand collapsed node, or move to first child
  - `ArrowLeft` → collapse expanded node, or move to parent
  - `Enter` / `Space` → select node
  - `Home` → first treeitem
  - `End` → last visible treeitem
- Focus management: roving tabindex pattern (`tabIndex={isFocused ? 0 : -1}`)

**FileExplorer** (`src/components/ui/FileExplorer.tsx`):
- Same ARIA pattern as LayerTree
- Root: `role="tree"` + `aria-label="Project files"`
- Directories: `role="treeitem"` + `aria-expanded`
- Files: `role="treeitem"` (leaf, no expanded)
- Same keyboard navigation spec

**Reference:** WAI-ARIA Authoring Practices — TreeView pattern

### 2.2 Modal Focus Trapping

**Affected modals:**
1. `ExportModal` (in `src/components/ui/ExportModal.tsx`)
2. `GovernancePanel` (in `src/components/ui/GovernancePanel.tsx`, rendered as modal from App.tsx)
3. `SetupWizard` (in `src/components/ui/SetupWizard.tsx`, modal wrapper in App.tsx)
4. `BetaFeedbackModal` (in `src/components/ui/BetaFeedbackModal.tsx`)

**For each modal:**
- Add `role="dialog"` + `aria-modal="true"` + `aria-labelledby={titleId}` to the outermost modal container
- Implement focus trap: Tab cycles within modal, does not escape to background
- On open: move focus to first focusable element (or the close button)
- On close (Escape or close button): return focus to the element that triggered the modal
- Background content: `aria-hidden="true"` on the app shell when modal is open

**Implementation approach:** Create a lightweight `FocusTrap` component in `src/components/ui/FocusTrap.tsx` (no external dependency). Implementation: query all focusable elements within the container on mount, intercept Tab/Shift+Tab to cycle within the set, and return focus to the trigger element on unmount. This avoids adding `focus-trap-react` to `package.json` and keeps the bundle lean.

### 2.3 React ErrorBoundaries

**Create:** `src/components/ui/PanelErrorBoundary.tsx`

```typescript
interface Props {
  panelName: string;
  children: React.ReactNode;
}

// Renders children normally. On error:
// - Catches the error
// - Renders a recovery card:
//   [AlertTriangle icon]
//   "Something went wrong in [panelName]"
//   [Retry button] — calls resetErrorBoundary to re-mount children
//   [Copy Error button] — copies error.message to clipboard for bug reports
// - Logs error to console (no silent swallowing)
```

**Wrap every surviving panel component at its JSX usage site in App.tsx (not at the component definition):**

Post-GLASS.1a panels (wrap these):
- LayerTree (left sidebar, Layers tab)
- AssetsPanel (left sidebar, Assets tab)
- ComponentPanel (left sidebar, Components tab — new in GLASS.1b)
- GovernanceOverlay (right sidebar, Governance tab)
- GovernanceDashboard (embedded in GovernanceOverlay header)
- PropertiesPanel (right sidebar, Properties tab)
- TokenManager (right sidebar, Tokens tab)
- LivePreview (already has internal error handling, but add boundary for React errors)

Removed by GLASS.1a (do NOT wrap — they won't exist):
- ~~ActivityFeed~~ → moved to StatusBar popover
- ~~RecoveryPanel~~ → moved to Command Palette
- ~~AgentDashboard~~ → removed from Glass
- ~~ComponentScopePanel~~ → moved to settings modal

Wrap pattern in App.tsx:
```tsx
{rightTab === 'governance' && (
  <PanelErrorBoundary panelName="Governance">
    <GovernanceOverlay />
  </PanelErrorBoundary>
)}
```

**Style:** Match existing error patterns — `bg-red-900/10 border border-red-700/40` with `text-red-400` icon and message.

### 2.4 Empty State Overhaul

Every panel with a zero-data state gets a consistent empty state:

**Pattern:**
```
[Lucide icon, 24px, text-zinc-600]
[Primary text, text-sm text-zinc-400]
[Secondary text, text-xs text-zinc-500, 1-2 lines of guidance]
[Optional: CTA button, text-xs, indigo]
```

**Specific fixes:**

| Component | Current | New |
|-----------|---------|-----|
| LayerTree ("No JSX found") | Gray text, no icon | `<Layers size={24} />` + "No component layers" + "Open a .tsx file to see its layer structure" + [Open File] button |
| FileExplorer ("No folder open") | Text + non-clickable instruction | `<FolderOpen size={24} />` + "No project folder" + [Open Folder] button (actually clickable) |
| ActivityFeed (empty) | Nothing renders | `<Activity size={24} />` + "No activity yet" + "MCP tool invocations will appear here" |
| RecoveryPanel (no file) | Folder emoji | `<FolderOpen size={24} />` + "Select a component" + "Open a file to access version history" |
| RecoveryPanel (no history) | Hourglass emoji | `<Clock size={24} />` + "No history yet" + "Edits create shadow commits for recovery" |
| GovernanceDashboard (clean) | "No violations — clean file" text | `<ShieldCheck size={24} className="text-emerald-400" />` + "All clear" + "Zero governance violations. Your component is production-ready." (celebratory) |
| TokenManager (no tokens) | Palette icon + "No design tokens loaded. Connect Figma..." (ALREADY GOOD) | No change needed — already uses Lucide Palette icon + guidance text at lines 446-450 |

### 2.5 RecoveryPanel Icon Cleanup

**File:** `src/components/ui/RecoveryPanel.tsx`

| Line | Current | New (Lucide) |
|------|---------|-------------|
| 105 | `🗂` (folder emoji) | `<FolderOpen className="h-6 w-6 text-zinc-600" />` |
| 114 | `⟳` (Unicode reload symbol, used with `animate-spin`) | `<Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />` |
| 123 | `⏳` (hourglass emoji) | `<Clock className="h-6 w-6 text-zinc-600" />` |
| 151 | `✓` (Unicode checkmark) | `<CheckCircle className="h-4 w-4 text-emerald-400" />` |
| 157 | `✗` (Unicode X mark) | `<XCircle className="h-4 w-4 text-red-400" />` |

Import: `import { FolderOpen, Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';`

## 3. Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/PanelErrorBoundary.tsx` | Shared error boundary for all panels |
| `src/components/ui/FocusTrap.tsx` | Focus trap wrapper for modals (or install `focus-trap-react`) |
| `src/components/ui/EmptyState.tsx` | Shared empty state component (icon + text + optional CTA) |
| `src/components/ui/__tests__/PanelErrorBoundary.test.tsx` | ErrorBoundary catch + retry test |
| `src/components/ui/__tests__/EmptyState.test.tsx` | Renders icon, text, button correctly |

## 4. Files to Modify

| File | What Changes |
|------|-------------|
| `src/components/ui/LayerTree.tsx` | ARIA tree roles, keyboard navigation, roving tabindex |
| `src/components/ui/FileExplorer.tsx` | ARIA tree roles, keyboard navigation, roving tabindex |
| `src/components/ui/ExportModal.tsx` | `role="dialog"`, FocusTrap wrapper |
| `src/components/ui/GovernancePanel.tsx` | `role="dialog"`, FocusTrap wrapper |
| `src/components/ui/SetupWizard.tsx` | `role="dialog"`, FocusTrap wrapper |
| `src/components/ui/BetaFeedbackModal.tsx` | `role="dialog"`, FocusTrap wrapper |
| `src/components/ui/RecoveryPanel.tsx` | Replace 5 emoji with Lucide icons |
| `src/App.tsx` | Wrap all panel renders in PanelErrorBoundary |
| All panels with empty states | Use shared EmptyState component |

## 5. Test Boundaries

| Test | What it verifies |
|------|-----------------|
| LayerTree has `role="tree"` on root | ARIA compliance |
| LayerTree items have `role="treeitem"` | ARIA compliance |
| LayerTree ArrowDown moves focus to next item | Keyboard navigation |
| LayerTree ArrowRight expands collapsed node | Keyboard navigation |
| LayerTree Enter selects focused node | Keyboard interaction |
| FileExplorer has `role="tree"` on root | ARIA compliance |
| FileExplorer keyboard navigation works | Same spec as LayerTree |
| ExportModal traps focus on open | Tab does not escape modal |
| ExportModal returns focus on close | Focus returns to trigger element |
| All modals have `role="dialog"` | ARIA compliance |
| PanelErrorBoundary catches render error | Shows recovery card, not white screen |
| PanelErrorBoundary retry re-mounts children | Click retry → children render again |
| EmptyState renders icon + text + button | Visual regression baseline |
| LayerTree empty state shows guidance | "Open a .tsx file" text present |
| RecoveryPanel uses Lucide icons | No emoji characters in render output |
| GovernanceDashboard clean state is celebratory | ShieldCheck icon + "All clear" text |

## 6. Implementation Order

All 5 items are independent. Recommended parallel assignment:

- **flint-accessibility agent:** 2.1 (ARIA trees) + 2.2 (focus trapping) — these are pure a11y work
- **flint-design-engineer agent:** 2.3 (ErrorBoundary) + 2.4 (empty states) + 2.5 (emoji cleanup) — these are UI component work
- **flint-test-writer agent:** Tests for all items (can start writing test shells immediately from this contract)

## 7. Acceptance Criteria

- [ ] LayerTree passes WAI-ARIA TreeView pattern audit
- [ ] FileExplorer passes WAI-ARIA TreeView pattern audit
- [ ] All 4 modals trap focus (verified by Tab-cycling test)
- [ ] Throwing an error in any panel renders PanelErrorBoundary, not white screen
- [ ] Every panel has a designed empty state with icon + guidance
- [ ] Zero emoji characters remain in RecoveryPanel
- [ ] `npm run test:react` passes with new tests
- [ ] `npx tsc --noEmit` — 0 errors
