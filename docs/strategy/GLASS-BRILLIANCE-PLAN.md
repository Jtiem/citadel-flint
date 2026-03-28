# Glass Brilliance Plan

**Date:** 2026-03-27
**Goal:** Take Flint Glass from "functional" to "brilliant" across 3 tiers and 18 work items.
**Citadel codename:** Phase GLASS

---

## The Brilliant Bar

A brilliant design governance observability tool does three things:
1. Makes the invisible visible — governance posture hits you like a weather report on open
2. Makes the painful painless — every violation has a one-click fix with visible proof
3. Makes you feel competent, not surveilled — co-pilot energy, not police scanner

---

## Tier 1: Structural Redesign (GLASS.1)

The architecture changes that reshape how Glass works.

| ID | Item | What Changes | Key Files |
|----|------|-------------|-----------|
| 1.1 | Sidebar consolidation | 7 tabs → 3 (Governance, Properties, Tokens). Merge Health into Governance. Move Activity/Recovery/Scope/Agents out. | `src/App.tsx` |
| 1.2 | Kill Build mode → Component Panel | Component card grid becomes a left-sidebar tab. Drag-to-insert works because preview stays visible. | `src/App.tsx`, `src/components/editor/XYCanvas.tsx`, `src/components/canvas/*` |
| 1.3 | Kill Govern mode → Extended Health Panel | Extend GovernanceDashboard with project-level view, worst-offenders list, clickable drill-down. | `src/components/ui/GovernanceDashboard.tsx`, `src/App.tsx` |
| 1.4 | Unified violation surface | One authoritative list (GovernanceOverlay). Canvas badges link to it. Ghost overlay gets Fix buttons. Every surface leads to resolution. | `src/components/editor/GovernanceOverlay.tsx`, `src/components/editor/GhostOverlay.tsx`, `src/components/editor/ShieldOverlay.tsx` |
| 1.5 | Fix All + Actionable Dashboard | "Fix N Auto-Fixable" button on GovernanceOverlay header. Dashboard rule rows clickable → navigate to violations. Score trend line. | `src/components/editor/GovernanceOverlay.tsx`, `src/components/ui/GovernanceDashboard.tsx` |

**Dependency order:** 1.1 → 1.2 + 1.3 (parallel) → 1.4 → 1.5

---

## Tier 2: Credibility (GLASS.2)

Glass must pass its own governance standards.

| ID | Item | What Changes | Key Files |
|----|------|-------------|-----------|
| 2.1 | ARIA tree semantics | `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-level`, Arrow key navigation on LayerTree + FileExplorer. | `src/components/ui/LayerTree.tsx`, `src/components/ui/FileExplorer.tsx` |
| 2.2 | Modal focus trapping | Focus trap on all modals. `role="dialog" aria-modal="true"`. Tab cannot escape. | `src/App.tsx`, `src/components/ui/ExportModal.tsx`, `src/components/ui/GovernancePanel.tsx`, `src/components/ui/SetupWizard.tsx` |
| 2.3 | React ErrorBoundaries | Every panel gets an ErrorBoundary. Malformed file crashes one panel, not the app. Retry affordance. | All panel components |
| 2.4 | Empty state overhaul | Every panel gets icon + guidance + action button when empty. Consistent sizing. Clean-file celebration. | `LayerTree`, `FileExplorer`, `ActivityFeed`, `GovernanceDashboard`, `RecoveryPanel` |
| 2.5 | RecoveryPanel icon cleanup | Replace all raw emoji with Lucide icons. Match existing icon style. | `src/components/ui/RecoveryPanel.tsx` |

**Dependency order:** All items are independent. Can run in parallel.

---

## Tier 3: Polish (GLASS.3)

The craft-level details that make Glass feel designed, not assembled.

| ID | Item | What Changes | Key Files |
|----|------|-------------|-----------|
| 3.1 | LivePreview loading states | Spinner during transform. "Compiling..." badge. Error formatting with guidance. "Stale preview" indicator. | `src/components/editor/LivePreview.tsx` |
| 3.2 | Panel collapse/expand | Double-click ResizeHandle or chevron to collapse panels to zero width. Full-width canvas when needed. | `src/App.tsx`, `src/components/ui/ResizeHandle.tsx` |
| 3.3 | Tab transitions + skeletons | Crossfade on tab content switch. Skeleton loading states for async panels. Animated new-tab indicator (bigger than 4px). | `src/App.tsx`, new `src/components/ui/Skeleton.tsx` |
| 3.4 | Production cleanup | Remove "Load Demo" button (or gate behind `__DEV__`). Remove IPC "pong" pill. Move Override badge to Dashboard. | `src/components/editor/LivePreview.tsx`, `src/components/editor/StatusBar.tsx` |
| 3.5 | Progressive mode disclosure | If modes survive Tier 1: rename Preview→Canvas, Build→Library, Govern→Health. Show Library/Health only when relevant (3+ registry entries / first audit). | `src/App.tsx`, `src/store/canvasStore.ts` |
| 3.6 | First-audit guided experience | Replace 3 generic tooltip onboarding with guided first fix. Inline card on first open. Contextual tooltip on Auto-Fix button. | `src/components/ui/OnboardingOverlay.tsx` |
| 3.7 | Keyboard violation navigation | Next/previous violation shortcuts. Auto-fix current. Skip. Discoverable in command palette. | `src/components/editor/GovernanceOverlay.tsx`, `src/components/ui/CommandPalette.tsx` |
| 3.8 | Tab overflow handling | Horizontal scroll or "..." dropdown when right-sidebar tab bar overflows at narrow widths. | `src/App.tsx` |

**Dependency order:** 3.1-3.4 independent. 3.5 depends on Tier 1 decisions. 3.6-3.8 independent.

---

## Implementation Strategy

### Phase 1: Contracts (now)
Create binding contract artifacts for each tier. Contracts define types, IPC changes, store changes, component changes, and test boundaries.

### Phase 2: Parallel Implementation
- **Group A (Tier 2):** Credibility items are independent and low-risk. Start immediately.
- **Group B (Tier 1):** Structural redesign requires careful sequencing. Start with 1.1 (sidebar).
- **Group C (Tier 3):** Polish items fill gaps between structural work.

### Phase 3: Integration Validation
Run flint-integration-validator after each tier completes. Full test suite + TSC gate.

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Right sidebar tabs | 7 | 3 |
| Canvas modes | 3 (Preview/Build/Govern) | 1 (Canvas) + 2 panels |
| Violation surfaces | 5 (fragmented) | 1 (authoritative) + linked badges |
| ARIA tree compliance | 0% (LayerTree, FileExplorer) | 100% |
| Focus trapping in modals | 0/4 modals | 4/4 modals |
| ErrorBoundaries | 0 panels | All panels |
| Empty states with guidance | 2/12 panels | 12/12 panels |
| "Fix All" button | Does not exist | GovernanceOverlay header |
| Dashboard actionability | Read-only, dead-end | Clickable rows, trends, Fix path |
