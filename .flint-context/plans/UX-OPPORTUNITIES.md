# Glass UX Opportunities — Prioritized

**Date:** 2026-03-27
**Status:** APPROVED FOR PLANNING
**Source:** Critical UX review in `UX-PROGRESSIVE-DISCLOSURE.md`

---

## How to read this

Each opportunity has a **scope** (what it touches) and **complexity** rating:
- **Trivial** — Single file, copy/icon change, no state logic
- **Contained** — 2-3 files, local state or style change, no new store slices
- **Moderate** — 4-8 files, new store slice or IPC, touches multiple panels
- **Significant** — 10+ files, new architectural pattern, cross-cutting concern

No time estimates. Complexity tells you how much can go wrong. Justin decides sequencing.

---

## Priority 1 — Remove noise (ship confidence, reduce cognitive load)

### OPP-1: Remove status bar debug strings
**Scope:** `StatusBar.tsx` only
**Complexity:** Trivial
**What:** Delete "Local SQLite (better-sqlite3)", "Babel AST Parser Active", "Electron IPC Flint" from the status bar. These are implementation details that make Glass feel like a developer debug console.
**Impact:** ~25% of status bar width freed. First impression shifts from "technical tool" to "design product."

### OPP-2: Fix icon collisions (Health tab, Scope tab)
**Scope:** `App.tsx` (icon imports + tab definitions)
**Complexity:** Trivial
**What:** Health tab uses `ShieldCheck` — same icon as the Export button. Change to `BarChart2` or `Activity`. Scope tab uses `Layers` — same icon as the left panel Layers tab. Change to `Package` or `Boxes`.
**Impact:** Eliminates two navigational collisions that cause misclicks every session.

### OPP-3: Rename "Open Canvas" → "New Project"
**Scope:** `LaunchScreen.tsx` (button label + subtitle)
**Complexity:** Trivial
**What:** "Open Canvas" implies a drawing tool. Glass has no canvas drawing. "New project" matches what actually happens (a scratchpad folder is created). Also change subtitle from "Design System Governance" to something that explains the value: "AI governance for your design system."
**Impact:** Sets correct mental model from first interaction.

---

## Priority 2 — Empty states (turn dead ends into next actions)

### OPP-4: Properties tab empty state
**Scope:** `PropertiesPanel.tsx`
**Complexity:** Contained
**What:** When nothing is selected, show: "Click any element in the preview to inspect it." with a subtle illustration of a cursor clicking. Currently shows a blank shell.
**Impact:** First-time users understand what to do. The first win ("I clicked and Glass responded") happens faster.

### OPP-5: Health tab "no design system" state
**Scope:** `GovernanceDashboard.tsx`
**Complexity:** Contained
**What:** 100/A on a fresh project is misleading — it's 100 because there are no tokens to compare against, not because the code is clean. When `tokenStore.tokens.length === 0`, show: "No design system connected. Health score requires design tokens to measure against." with a CTA to connect Figma or import tokens.
**Impact:** Prevents false confidence. Users understand governance requires a design system to work.

### OPP-6: Activity tab empty state
**Scope:** `ActivityFeed.tsx`
**Complexity:** Contained
**What:** When the activity log is empty, show: "This feed tracks AI agent actions — audits, fixes, mutations. Connect an MCP client to start seeing activity." Currently shows an empty list.
**Impact:** Users understand this tab has a purpose even when nothing's happened yet.

### OPP-7: Agents tab empty state
**Scope:** `AgentDashboard.tsx`
**Complexity:** Contained
**What:** When no agents have connected, show: "No AI agents have connected this session. When Claude Code, Cursor, or another MCP client runs governance tools, their activity appears here." Currently shows a spinner or blank.
**Impact:** Demystifies the Agents tab for non-technical users.

### OPP-8: Scope tab empty state
**Scope:** `ComponentScopePanel.tsx`
**Complexity:** Contained
**What:** When the registry is empty, show: "No components indexed. Open a project with React/Vue/Svelte components, then click 'Reindex' to populate the registry." with the reindex CTA.
**Impact:** Scope tab goes from confusing to actionable.

### OPP-9: Tokens tab empty state
**Scope:** `TokenManager.tsx` (or wherever tokens are rendered in the right panel)
**Complexity:** Contained
**What:** When token list is empty, show: "No design tokens loaded. Connect Figma to sync your design system, or import a tokens JSON file." with both CTAs.
**Impact:** Tokens tab becomes the bridge between "I opened Glass" and "I connected my design system."

---

## Priority 3 — Progressive disclosure (reveal features when earned)

### OPP-10: Tab unlock system (`unlockedTabs` store slice)
**Scope:** `canvasStore.ts`, `App.tsx`, all right-panel tab components
**Complexity:** Moderate
**What:** Add an `unlockedTabs: Set<string>` slice to `canvasStore`. Tabs only render when their key is in the set. Unlock triggers:

| Tab | Unlock trigger |
|-----|---------------|
| Properties | Always visible |
| Health | First audit completes (violations array non-empty OR first file parsed) |
| Tokens | `tokenStore.tokens.length > 0` |
| Activity | MCP connected AND first activity log entry |
| Recovery | `historyStore.undoStack.length > 0` |
| Scope | Component registry has ≥ 3 entries |
| Agents | Agent mutation recorded in session |

Each tab appears with a one-time indigo "new" dot (like iOS notification dots) that disappears on first click.

**Impact:** Fresh projects show 2 tabs instead of 7+. Features reveal themselves as the user's workflow earns them.

### OPP-11: Left panel progressive tabs
**Scope:** `App.tsx` (left panel tab rendering)
**Complexity:** Contained
**What:** Files tab hidden until MCP confirmed connected. Assets tab hidden until component registry has ≥ 1 entry. Layers always visible.
**Impact:** Left panel starts clean (1 tab) and grows to 3 as the project matures.

### OPP-12: Status bar progressive elements
**Scope:** `StatusBar.tsx`
**Complexity:** Contained
**What:** Autopilot toggle hidden until first violation seen. Overrides badge hidden until first override exists. Responsive breakpoint chip hidden until user has used Shift+scroll at least once.
**Impact:** Status bar starts with 4 items (MCP, Figma, Export, Sync) instead of 11.

---

## Priority 4 — Workflow alignment (put things where users look)

### OPP-13: Right panel tab reorder
**Scope:** `App.tsx` (tab definition order)
**Complexity:** Trivial
**What:** Reorder tabs to match workflow: Health → Properties → Tokens → Activity → Recovery → Scope → Agents. Currently Properties is first, but Properties requires a selection — Health is useful immediately.
**Impact:** The first tab a user sees answers "what's the state of my project?" not "select something first."

### OPP-14: Keyboard shortcut labels on canvas mode toggle
**Scope:** `CanvasViewToggle.tsx`
**Complexity:** Trivial
**What:** Show ⌘1, ⌘2, ⌘3 next to Preview / Build / Govern labels. Shortcuts exist in code but aren't surfaced.
**Impact:** Power users discover keyboard shortcuts without documentation.

### OPP-15: Violation → rule configuration path
**Scope:** `GovernanceOverlay.tsx`, `GovernancePanel.tsx`
**Complexity:** Contained
**What:** When a user sees a violation in GovernanceOverlay, add a "Configure rule" link that opens GovernancePanel filtered to that specific rule. Currently there's no path from "I see a violation" to "I want to adjust this rule" without knowing about the gear icon.
**Impact:** Closes the biggest discoverability gap in the governance workflow.

---

## Priority 5 — Spatial model refinement

### OPP-16: Right panel consistent selection rule
**Scope:** `App.tsx`, `PropertiesPanel.tsx`, `GovernanceDashboard.tsx`
**Complexity:** Moderate
**What:** When nothing is selected, right panel defaults to Health (project-level view). When a node is selected, right panel auto-switches to Properties (element-level view). This makes the right panel always contextually relevant.
**Impact:** The right panel is never "stuck" on a tab that's showing nothing.

### OPP-17: Contextual tooltips (one-time, non-modal)
**Scope:** New `useOnboardingTooltip` hook, multiple components
**Complexity:** Moderate
**What:** First time a violation appears → tooltip on the violation badge: "Mithril flagged a drift. Click to see why." First time Health tab unlocks → tooltip: "Your project's governance health score." First time Agents tab shows activity → tooltip: "These are the AI agents working on your project." Each tooltip shows once, is dismissed on click, and is tracked in localStorage.
**Impact:** Teaches features in context without a tutorial wizard.

---

## Not planned (explicitly out of scope)

- **Code editor in Glass** — Glass is observability only. Editor lives in host IDE.
- **Tab drag reorder** — Nice to have but not a priority vs. the above.
- **Custom status bar** — Right-click to hide/show items. Deferred until progressive disclosure proves out.

---

## Dependencies

- OPP-10 (tab unlock system) is the foundation for OPP-11 and OPP-12
- OPP-4 through OPP-9 (empty states) can all be done in parallel
- OPP-1 through OPP-3 (noise removal) have zero dependencies — they can ship today
- All opportunities apply to BOTH Electron and web builds (same React codebase)
