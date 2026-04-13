# Flint Glass UX Audit -- Figma Benchmark Comparison

**Date:** 2026-04-06
**Benchmark:** Figma Desktop App (right sidebar, layers panel, canvas, status bar)
**Reviewers:** 3 parallel UX critics (Inspector, Canvas/Layout, Governance/Tokens)
**Verdict:** REVISE -- Composite Grade C+

---

## Overall Grades

| Area | Grade | Reviewer |
|------|-------|----------|
| Inspector / Properties Panel | C- | Inspector |
| ClassBuilder (Typography/Fill/Stroke) | C | Inspector |
| Primitives (Select, ColorPicker, Accordion) | C | Inspector |
| LayoutPanel | B- | Inspector |
| LayerTree | B | Canvas |
| Canvas Chrome | C+ | Canvas |
| Status Bar | C | Canvas |
| App Shell / Layout | B | Canvas |
| Color Palette Consistency | **D** | Canvas |
| GovernanceDashboard | C+ | Governance |
| GovernancePanel | B+ | Governance |
| ExportModal | B | Governance |
| LaunchScreen | B+ | Governance |
| FixPreviewDrawer | B+ | Governance |

---

## What Flint Does Well (Preserve)

1. **DriftDetector** -- Innovative governance UX with no Figma equivalent (color swatches, delta-E badges, one-click fix)
2. **Progressive Disclosure** -- Tab unlock system, empty states, onboarding tooltips. Better than Figma's static tabs
3. **Layer Tree interactions** -- Full WAI-ARIA TreeView, DnD with position indicators, inline rename, keyboard nav
4. **Export Gate pattern** -- "Blocked until governance passes" with audit loading states
5. **LaunchScreen 3-path flow** -- Try / New / Open maps perfectly to user segments
6. **ARIA semantics** -- Thorough across the board; professional-grade accessibility
7. **Fix Preview Drawer** -- Inline diff before commit with power-user opt-out

---

## Sprint Plan: C+ to A+

### Sprint 1: Systemic Consistency (C+ -> B)

**Theme:** Unify the visual foundation before touching individual components.

| # | Issue | Files | What to do |
|---|-------|-------|------------|
| 1.1 | gray-* vs zinc-* mixing (Grade: D) | All files | Global find-replace: pick zinc, apply everywhere |
| 1.2 | text-[9px] and text-[10px] overuse | All files | Floor at 10px for badges, 11px for labels. Tab labels -> icon-only with tooltip |
| 1.3 | No shared primitives for headers/popovers/badges | `primitives.tsx`, new files | Extract SectionHeader, Popover, Badge primitives with single source of truth |
| 1.4 | Section header inconsistency | All panels | All headers use SectionHeader primitive: `text-[11px] font-medium uppercase tracking-wider text-zinc-400` |
| 1.5 | Sparkline hardcoded hex colors | `GovernanceDashboard.tsx` | Replace `#34d399`, `#f87171`, `#fbbf24` with Tailwind class-based approach |

### Sprint 2: Interaction Upgrades (B -> B+)

**Theme:** Replace raw/native controls with professional design-tool interactions.

| # | Issue | Files | What to do |
|---|-------|-------|------------|
| 2.1 | Native `<select>` elements | `primitives.tsx` | Custom listbox with portal, text filter for 8+ items, inline color swatches |
| 2.2 | No spatial properties (X, Y, W, H) | `PropertiesPanel.tsx` | Read-only "Frame" section at top showing computed bounding box from LivePreview |
| 2.3 | Status bar overloaded (15 chips) | `StatusBar.tsx` | Cap at 5-6 visible items; overflow to popover or command palette |
| 2.4 | Top bar gradient + too many controls | `App.tsx` | Single-color wordmark, remove Audit button (use cmd palette), reduce padding |
| 2.5 | Empty state for Properties is passive | `PropertiesPanel.tsx` | Show project-level summary (file, tokens, violations, last audit) when no selection |

### Sprint 3: Governance UX Overhaul (B+ -> A-)

**Theme:** Make the governance dashboard scannable and actionable, not exhausting.

| # | Issue | Files | What to do |
|---|-------|-------|------------|
| 3.1 | GovernanceDashboard is a 2000-line monolith | `GovernanceDashboard.tsx` -> decompose | Extract ScoreSection, ViolationCard, ViolationList, BatchActionBar, DeferForm |
| 3.2 | Typography section too compressed | `ClassBuilder.tsx` | Stack Family/Weight vertically full-width; remove inline dot-notation from labels |
| 3.3 | Violation cards have 5 badges + 5 buttons | `GovernanceDashboard.tsx` | Primary action visible, secondary (Flag/Defer/Pin) on hover or overflow menu |
| 3.4 | Batch action buttons compete in section header | `GovernanceDashboard.tsx` | Move batch actions to floating bar or dedicated toolbar below header |
| 3.5 | ExportModal doesn't differentiate fixable vs unfixable | `ExportModal.tsx` | Add fixability indicator to violation rows in export gate |

### Sprint 4: Polish Pass (A- -> A+)

**Theme:** The details that separate good from brilliant.

| # | Issue | Files | What to do |
|---|-------|-------|------------|
| 4.1 | No numeric input fields | `primitives.tsx` | NumericInput with arrow-key step, Shift for 10x, click-drag scrub |
| 4.2 | Color picker flat list, no grouping | `primitives.tsx` | Group by first path segment; add compact swatch grid + detailed list toggle |
| 4.3 | Accordion has no animation | `primitives.tsx` | CSS `grid-template-rows: 0fr -> 1fr` at 150ms |
| 4.4 | LivePreview chrome bar looks like OS window | `XYCanvas.tsx` | Chrome invisible by default, grip icon on hover only |
| 4.5 | Resize handle 23px void between panels | `ResizeHandle.tsx` | Absolute position hit area to overlap panel edges |
| 4.6 | Canvas controls blend into background | `XYCanvas.tsx` | Controls get `bg-zinc-950` + `ring-1 ring-zinc-800` for separation |
| 4.7 | Notes tab empty state is bare paragraph | `App.tsx` | Use EmptyState component with MessageSquare icon |

---

## Files Touched Per Sprint

### Sprint 1
- `src/App.tsx`
- `src/components/editor/StatusBar.tsx`
- `src/components/editor/XYCanvas.tsx`
- `src/components/ui/GovernanceDashboard.tsx`
- `src/components/ui/ExportModal.tsx`
- `src/components/ui/LayerTree.tsx`
- `src/components/inspector/primitives.tsx`
- `src/components/inspector/ClassBuilder.tsx`
- `src/components/inspector/LayoutPanel.tsx`
- All other files with gray-*/zinc-* mixing

### Sprint 2
- `src/components/inspector/primitives.tsx` (custom listbox)
- `src/components/inspector/PropertiesPanel.tsx`
- `src/components/editor/StatusBar.tsx`
- `src/App.tsx`

### Sprint 3
- `src/components/ui/GovernanceDashboard.tsx` (decompose)
- `src/components/inspector/ClassBuilder.tsx`
- `src/components/ui/ExportModal.tsx`
- New: `src/components/ui/governance/ScoreSection.tsx`
- New: `src/components/ui/governance/ViolationCard.tsx`
- New: `src/components/ui/governance/ViolationList.tsx`
- New: `src/components/ui/governance/BatchActionBar.tsx`
- New: `src/components/ui/governance/DeferForm.tsx`

### Sprint 4
- `src/components/inspector/primitives.tsx` (NumericInput, ColorPicker, Accordion)
- `src/components/editor/XYCanvas.tsx`
- `src/components/ui/ResizeHandle.tsx`
- `src/App.tsx`
