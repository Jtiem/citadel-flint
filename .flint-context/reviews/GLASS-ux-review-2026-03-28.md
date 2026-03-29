# Glass UX Review — 2026-03-28

Reviewer: Senior UX Review (code-only pass — no live session)
Scope: Full Glass UI after Phase GLASS structural redesign
Files read: App.tsx, XYCanvas.tsx, StatusBar.tsx, GovernanceDashboard.tsx, GovernancePanel.tsx, ComponentPanel.tsx, LayerTree.tsx, PropertiesPanel.tsx, TokenManager.tsx, LaunchScreen.tsx, SetupWizard.tsx, CommandPalette.tsx, canvasStore.ts

---

## Executive Summary

**Grade: B**

Phase GLASS achieved what it set out to do structurally. The Build/Govern canvas mode split is gone. The three-panel layout is cleaner. The GovernanceDashboard is now a real co-pilot surface with contextual fix guidance, score projection, and the Delta Mode baseline. Progressive disclosure is genuinely well-implemented — the tab unlock logic in App.tsx (lines 196–219) is one of the better execution decisions in the codebase.

The B grade is earned because the bones are right. It is not an A because there are five specific problems that individually would not break the grade but together create consistent moments of friction, confusion, and abandonment risk. A product that enforces quality on other people's code and ships with these problems loses credibility. A is achievable. The path is concrete.

The previous B+ assessment was probably generous. This review finds issues the earlier reviewer did not surface, particularly around the Export button duplication, the status bar layout fragility, the empty GovernanceDashboard accordion state, and the Autopilot discoverability problem. Those four alone justify dropping from B+ to B.

---

## Critical Issues (Grade-Blockers)

### 1. Export button exists in two places with inconsistent behavior

**What it is:** The top-right header (`App.tsx` line 796–804) has an Export button that opens `ExportModal`. The StatusBar (`StatusBar.tsx` line 367–398) has a separate Export Gate chip that, when clean, also opens the export modal via a dispatched custom event — but when violations exist, it routes to the right sidebar properties tab (`setRightTab('properties')`), not the Governance tab where the violations actually live.

**User impact:** A designer sees "Export" in the header and clicks it to check status. Then they notice "Design Drift Issues" in the footer. They click the footer chip expecting to see the violations — and land on the Properties tab, which shows nothing relevant if nothing is selected on canvas. This is a double confusion: wrong destination and the destination is empty.

**The routing logic at StatusBar.tsx line 370–374:**
```
if (canExport) {
    window.dispatchEvent(new CustomEvent(`${BRAND.productLower}:open-export`))
} else {
    setRightTab('properties')   // <-- wrong. should be 'governance'
}
```

The intended destination is the GovernanceDashboard (governance tab), not properties. This is a one-line fix but it is a real usability failure.

**Secondary problem:** Two export surfaces. The header Export button and the status bar chip are doing the same job. One of them should own this action. The header button is better positioned (larger, labeled "Export") but the status bar chip is the correct location for a continuous status signal. The recommendation is to remove the header Export button and make the status bar chip the single owner of export state and the export action.

**Proposed fix:** StatusBar.tsx line 373: change `setRightTab('properties')` to `setRightTab('governance')`. Then remove the Export button from the App.tsx header (lines 794–805) to eliminate the duplication.

---

### 2. GovernanceDashboard accordion default states defeat the primary job-to-be-done

**What it is:** The GovernanceDashboard initializes with Health Score, Top Violated Rules, and Session & Baseline all collapsed by default (GovernanceDashboard.tsx lines 688–690: `useState(false)` for all three). The only always-visible content above the fold is the header, the export gate banner, and the violations list — which is only shown when `mithrilCount > 0 || a11yCount > 0 || overridesExist`. When violations exist, this is fine. But for a new project with no violations yet, the user lands on a governance tab that shows only the "All clear — export ready" banner and three collapsed accordion headers. The score ring, grade letter, and the "Health Score" section — the most motivating signal in the entire product — is hidden behind a collapsed accordion.

**User impact:** A new project or a clean file presents as near-empty. There is nothing to read, nothing to do, nothing to feel good about. The A grade and 100 score that should feel rewarding are invisible until the user knows to click "Health Score." This is a silent first impression failure.

**GovernanceDashboard.tsx lines 688–694 show the initial states:**
```
const [isScoreOpen, setIsScoreOpen] = useState(false)
const [isTopRulesOpen, setIsTopRulesOpen] = useState(false)
const [isSessionOpen, setIsSessionOpen] = useState(false)
// When violations disappear, open score accordion automatically
useEffect(() => {
    if (noViolations) setIsScoreOpen(true)
}, [noViolations])
```

The `useEffect` only fires when `noViolations` changes — not on mount. So a project that opens clean never triggers it and the score stays collapsed.

**Proposed fix:** Initialize `isScoreOpen` to `true` (or derive it: `useState(() => noViolations_initial_value)`). When there are violations, the violations section dominates — Health Score can reasonably stay collapsed because it is secondary information during remediation. When there are no violations, the health score ring is the only meaningful content and should be the first thing visible.

---

### 3. Status bar layout breaks under real-world conditions

**What it is:** The status bar (`StatusBar.tsx`) uses a flat flexbox row with no overflow protection. Under certain conditions — beta build active, update available, violations present, scratchpad mode, Autopilot revealed, breakpoint chip shown — there are up to 9 simultaneous chips in the same row. At 1280px the layout likely wraps or truncates. There is no `min-width: 0` protection on any chip, no `flex-wrap`, and no graceful collapse logic.

The `ml-auto` mechanism (lines 663, 677, 711, 717) that pushes SyncStatus to the right is conditionally applied based on `betaInfo` and `updateState`. This means SyncStatus's alignment shifts depending on which beta/update state is active. At `App.tsx` line 1020, SyncStatus is always rendered but its visual position depends on props it doesn't know about.

**User impact:** In a beta build with a pending update, the status bar likely overflows. The right-side SyncStatus alignment shifts unpredictably. This is not a corner case — it is the exact user who is most likely running a beta build (early adopter, power user) and most likely to have violations active.

**Proposed fix:** Divide the status bar into two fixed zones: left (export gate + figma) and right (save state + sync status + beta/update chips). Use `justify-between` with two `flex` children rather than a single flat row with scattered `ml-auto`. Chips in the center zone should have `overflow: hidden` and `text-overflow: ellipsis` protection.

---

### 4. "Autopilot" feature is invisible until first violation and has no discovery path

**What it is:** The Autopilot toggle button and its accompanying "N fixes ready" state indicator are hidden until the user encounters their first Mithril violation (`hasSeenViolation` in StatusBar.tsx lines 117–120). This is implemented correctly as progressive disclosure — but the Autopilot feature has no other discovery surface. There is no tooltip on first reveal, no mention in the GovernanceDashboard, and no entry in the CommandPalette.

The CommandPalette (`CommandPalette.tsx` lines 100–101) reads `autopilotEnabled` from the store but only provides a toggle command when building the command list. A new user who has seen violations but hasn't discovered the status bar chip would never find Autopilot.

**User impact:** Autopilot is one of the highest-value features in Glass (continuous governance without manual auditing) and it has the worst discoverability of any feature in the product. The StatusBar chip is tiny, unlabeled with a keyboard shortcut until hovered, and competes visually with 6+ other chips. A designer working fast in their IDE would never see it.

**Proposed fix:** On first Mithril violation, in addition to revealing the Autopilot chip, show a one-time tooltip (using the existing `useOnboardingTooltip` pattern) that explains what it does. Also add a "governance" section entry to the GovernanceDashboard that links to or surfaces the Autopilot toggle — it belongs in the governance surface, not only the infrastructure strip at the bottom.

---

## Significant Issues

### 5. Right tab icons without labels fail to communicate at a glance

**What it is:** The right sidebar tab bar (App.tsx lines 959–989) renders three tabs as icons only: `BarChart2` (Governance), `SlidersHorizontal` (Properties), `Palette` (Tokens). There are no text labels, only aria-labels and a `title` tooltip. On first use, none of these icons reliably communicates its tab's purpose. `SlidersHorizontal` looks like "settings" to most designers. `BarChart2` looks like "analytics" or "metrics," not "governance health." `Palette` is the best of the three.

The progressive disclosure new-tab dot (line 982–986) helps signal "something new here" but not what the tab contains.

**User impact:** A first-time user sees a shield check in the status bar, wants to understand what governance violations mean, and has to hover or guess which of three icons to click. This raises cognitive load at exactly the wrong moment — when the user has a problem and needs help.

**Proposed fix:** Add text labels below the icons. At the current panel widths (160–400px) even short labels ("Health," "Inspect," "Tokens") fit comfortably. If icon-only is a strong design preference, add labels only on first-use sessions (behind the `seenTabs` mechanism already in the store).

---

### 6. Left tab labels are raw identifiers, not human-readable names

**What it is:** App.tsx lines 879–894 render left tab buttons using the raw tab identifier strings (`layers`, `components`, `assets`) directly as text via the template literal in the button content. The output is `layers` / `components` / `assets` in uppercase via Tailwind class `uppercase tracking-wider`. This is technically fine but `layers` as a tab name does not match how any mainstream design tool labels this panel. Figma calls it "Layers." The capitalization applied by CSS is invisible in the source, making the code harder to read, and the labels themselves ("LAYERS," "COMPONENTS," "ASSETS") are all-caps labels without icons at 10px — barely readable at normal desktop DPI.

**User impact:** The left panel feels lower-fidelity than the right panel. The all-caps micro-type is hard to read and does not match the right panel's icon+label (or icon-only) treatment.

**Proposed fix:** Define a display map: `{ layers: 'Layers', components: 'Components', assets: 'Assets' }` and render display names. Add small icons (Layers icon, Grid icon, Image icon) from lucide-react consistent with the right panel pattern.

---

### 7. Violation cards in GovernanceDashboard truncate messages without surfacing the full content

**What it is:** The violation message in each card's summary row is truncated with `truncate` (GovernanceDashboard.tsx line 831 for rule ID display, and line 832 for message). The full message is only visible in the expanded detail section. But the summary row shows a `title` tooltip, which only works on desktop hover. The rule ID shown is the internal identifier (e.g., `MITHRIL-COL-001`) and the description strip strips the prefix but then truncates what remains with no wrapping.

More specifically, element IDs in the expanded card (line 888: `Element: #${w.id.slice(0, 20)}`) are truncated raw flint IDs. These are not human-readable names — a designer reading this sees `Element: #flint-abc123def` and cannot map it to anything in the canvas without selecting it.

**User impact:** The violation list is dense and information-poor. A designer with 8 violations cannot quickly understand what is wrong or where on screen it is. The "click to expand" pattern is correct but the content at the collapsed level is too minimal to prioritize which ones to fix first.

**Proposed fix:** In the collapsed row, show the element's inferred layer name (already computed in `getLayerName()` used by LayerTree) rather than the raw flint ID. If no layer name is available, show the JSX tag name. This requires passing layer context to the dashboard — or alternatively, a lookup function against the visual tree from editorStore.

---

### 8. "No design system" state in GovernanceDashboard and StatusBar are inconsistent

**What it is:** When no tokens are loaded, GovernanceDashboard.tsx lines 732–746 shows a `ShieldOff` icon, explanatory text, and an "Import Tokens" CTA that routes to the tokens tab. StatusBar.tsx lines 355–359 shows the Figma chip as amber with label "No design system" and a tooltip explaining how to fix it.

These two surfaces give different mental models for the same problem: the dashboard says "connect Figma or import tokens" (two paths), the status bar says "click to connect Figma or import tokens" (same two paths, one click). But the status bar's click target opens the Figma connection popover — not the tokens tab, and not the setup wizard. So clicking "No design system" in the status bar opens a popover about Figma, while clicking "Import Tokens" in the dashboard opens the Tokens tab. They are the same problem but the actions diverge.

**User impact:** A user trying to resolve "no design system" has two conflicting paths depending on where they look. One path leads to Figma configuration. The other leads to JSON import. Neither surface tells them which path is right for their situation.

**Proposed fix:** When tokenCount is 0, the status bar chip should route to the GovernanceDashboard's "no design system" state (governance tab), not to the Figma popover. The GovernanceDashboard empty state should be the single authoritative surface for this condition, presenting both resolution paths with clear labels ("I have a Figma file" / "I have a token JSON file").

---

### 9. LaunchScreen tile expansion is not keyboard accessible in the way the code implies

**What it is:** LaunchScreen.tsx tiles (lines 427–468) are `<button>` elements that toggle expansion. The `ChevronRight` icon rotates 90 degrees when active (`isActive ? 'rotate-90'`). This is a correct expand/collapse pattern for keyboard users. However, the tiles have no `aria-expanded` attribute and no `aria-controls` pointing to the expanded section ID. Screen readers cannot communicate the expand/collapse state, and the expanded content is not associated with its trigger.

Additionally, the expanded inline flow (line 472: `{selectedPath !== null && ...}`) renders a single `<div>` regardless of which tile is active. It has no `id` attribute, so there is nothing for `aria-controls` to point at even if the tiles had the attribute.

**User impact:** Keyboard and screen reader users cannot navigate the LaunchScreen flows without sighted assistance. This is notable because Flint enforces WCAG 2.1 AA on user code but ships a LaunchScreen that would fail its own audit.

**Proposed fix:** Add `aria-expanded={selectedPath === tile.id}` and `aria-controls="launch-flow-panel"` to each tile button. Add `id="launch-flow-panel"` to the expanded flow container. If multiple tiles could be open simultaneously this would need a per-tile ID, but since only one can be open, a single panel ID works.

---

### 10. Setup Wizard accessible as a modal only — no way to re-access from within the workspace after initial dismiss

**What it is:** The SetupWizard (`SetupWizard.tsx`) is accessible from the LaunchScreen via `onConnectIDE` callback and from the StatusBar's "Connect IDE" button (StatusBar.tsx lines 566–576, only shown when MCP is disconnected). Once MCP connects and the "Connect IDE" button disappears, there is no other path to re-open the setup wizard from within the workspace.

A user who needs to rotate their MCP server path, switch IDEs, or reconfigure their connection has no obvious access point. The CommandPalette (`CommandPalette.tsx`) does not include a "Setup Wizard" or "Reconfigure IDE" command. The GovernancePanel does not surface it. The project overflow menu (App.tsx lines 829–849) only shows "Open Folder" and "Close Project."

**User impact:** Users who need to reconfigure their IDE connection after initial setup have no discoverable path. They would need to know to disconnect MCP (status bar) and then find the setup wizard — which is only described as available from the LaunchScreen in the "Need help?" tooltip text in the Figma popover.

**Proposed fix:** Add a "Reconnect IDE / Setup" entry to the CommandPalette under the `settings` category. This would call `setShowSetupWizardModal(true)` from the App-level state — which already exists (App.tsx line 95). The CommandPalette already has the mechanism; it just needs the command.

---

## Minor Issues

### 11. "Scratchpad" chip label is too jargon-heavy for new users

StatusBar.tsx line 624 shows a "Scratchpad" chip with a `FolderInput` icon when `isScratchpadPath` is true. The tooltip says "Scratchpad project — click to save to a permanent location." The word "scratchpad" is an internal architectural term (matching the IPC handler `project:create-scratchpad`), not a concept that naturally maps to what a designer would understand. A first-time user sees "Scratchpad" and does not know if it is a warning, a mode, or a label. The tooltip helps but requires hover.

**Proposed fix:** Change the chip label to "Unsaved Project" or "Save Project" to communicate the action rather than the technical state. The tooltip already explains what to do; the label should reinforce it.

---

### 12. The GovernanceDashboard "Run Audit" button is not explained anywhere

GovernanceDashboard.tsx line 706 shows a "Run Audit" button with a `Play` icon. It triggers `flint_audit` via MCP. There is no tooltip explaining what "running an audit" means versus the continuous linting already happening, no indication of what will change after it runs, and no visual diff between pre-audit and post-audit state.

A designer who sees real-time violations in the list will reasonably ask: "If violations are already showing, why do I need to 'run an audit'?" The distinction between continuous AST linting (Mithril/Warden) and an explicit full audit pass is not communicated.

**Proposed fix:** Add a tooltip to the Run Audit button that says "Run a full governance audit via the AI engine — more thorough than the live linter but requires the MCP engine to be connected." Also consider showing a brief confirmation state after the audit completes (e.g., replacing the button text with "Audit complete — X new findings").

---

### 13. Violation card expanded content has an inconsistent "Fix" button placement

In GovernanceDashboard.tsx, the "Fix" button for auto-fixable violations appears in the collapsed summary row (line 841) as a small chip. This means the fix action is available without reading the explanation. This is good for expert users but creates a risk for newcomers who fix without understanding. More importantly, the "Fix" button is styled as a `role="button"` on a `<span>` rather than a `<button>` element (line 837–846). This is an HTML semantics issue.

The nested-interactive-element pattern (a `<span role="button">` inside a `<button>`) is technically invalid HTML — a button cannot contain interactive descendants. While this works in most browsers via event propagation and `e.stopPropagation()`, it will fail JAWS and NVDA screen readers in certain configurations, and it would fail Flint's own Warden lint rules if this JSX were audited.

**Proposed fix:** The "Fix" button in the summary row should be a `<button>` element. The parent summary row should not be a `<button>` — it should be a `<div>` with `role="row"` or redesigned so the two interactive targets are siblings, not nested. The existing `role="button"` + `tabIndex={0}` pattern on the span is an accessibility anti-pattern.

---

### 14. The canvas drag handle has no visible affordance in a resting state

XYCanvas.tsx line 67–68 shows a drag handle as a narrow chrome bar at the top of the LivePreview node. The bar has no text, no icon, and no visible content — just `border-b border-gray-800 bg-gray-900 px-4 py-2`. The `cursor-grab` CSS only activates on hover. Until the user happens to hover over the top edge of the preview node, there is no visual indication it can be moved.

**User impact:** Low for experienced users who know canvas paradigms. High for designers coming from Figma who may attempt to drag from the preview content itself and be confused when the canvas pans instead.

**Proposed fix:** Add a drag handle icon (e.g., `GripHorizontal` from lucide-react) and a faint "Drag to reposition" label that becomes visible on hover. Alternatively, use the standard three-dot drag grip icon that Figma and Linear use for draggable panels.

---

### 15. The "Fix all auto" button label is awkward

GovernanceDashboard.tsx line 793: the button reads "Fix all auto (N)". The parenthetical number and the word "auto" make this read like a developer annotation, not a UI label. Compare to Figma's "Fix all issues" or a simple "Auto-fix all (N)".

**Proposed fix:** Change to "Auto-fix all (N violations)" or simply "Fix N Issues" with a Wand icon. The Wand2 icon is already used (line 793) which is correct.

---

### 16. GhostCodeSnippet overlay has no close button or keyboard dismiss

XYCanvas.tsx line 258: `<GhostCodeSnippet />` floats above the canvas when a node is selected. The component is not in the files reviewed directly, but based on its mount point and the Phase U.2 description ("Ghost Code Snippet overlay: floats above canvas when a node is selected"), the overlay appears when a node is selected and presumably dismisses when selection is cleared. If the overlay has no `Escape` key handler and no close button, keyboard users who open it are trapped.

---

## What's Working Well

**Progressive disclosure is genuinely excellent.** The tab unlock system in canvasStore (DEFAULT_UNLOCKED_TABS, DEFAULT_UNLOCKED_LEFT_TABS, unlockTab, markTabSeen, unlockedLeftTabs) and the trigger effects in App.tsx lines 196–219 are among the most thoughtful implementations in the codebase. The one-time new-tab dot (App.tsx line 982–986) is exactly the right signal intensity — visible but not alarming. This pattern should be the model for all future feature reveals.

**The GovernanceDashboard fix guidance is substantive and specific.** The A11Y_FIX_GUIDE map (GovernanceDashboard.tsx lines 214–278) with WCAG references, plain-language "Why" explanations, numbered steps, and copy-ready snippets is exactly what distinguishes Flint from a bare linter. This is a genuine competitive advantage. The `scoreTrendHint` calculation (lines 579–591) that projects grade improvement based on the highest-impact fix category is a smart motivator.

**The StatusBar information hierarchy is correct.** The left-to-right ordering: Export Gate, Figma sync, MCP status, secondary chips is the right priority order. The amber "No design system" state that replaces the silent zinc chip when tokenCount is 0 is a meaningful improvement — it converts a passive indicator into an actionable signal.

**The three-panel layout with collapsible panels is clean.** The collapse rail (App.tsx lines 858–918) with keyboard accessibility (`role="button"`, `onKeyDown`, `tabIndex={0}`) and the double-click-to-toggle on the resize handle is a polished interaction. Panel width persistence via canvasStore is correct.

**The LaunchScreen JTBD tile model is the right approach.** Using job-to-be-done framing ("From Figma," "Connect codebase," "Audit a folder," "Governance dashboard") rather than feature names is contextually correct onboarding. The inline expanded flow that shows below the tiles without navigating away reduces cognitive load for new users.

**The CommandPalette implementation is solid.** Registry search with debounced MCP calls, category grouping, keyboard navigation, and the portal-based rendering are all done correctly. The only gap is missing commands (noted in issue 10).

**Delta Mode is a power feature done right.** The Set Baseline / Clear Baseline mechanism in GovernanceDashboard is exactly the kind of workflow feature that makes Glass useful for teams already managing technical debt — they can separate "violations we own" from "violations we inherited." The confirmation message and auto-dismiss are appropriate feedback loops.

---

## Path to A+

The following five changes, implemented in order, would take Glass from B to A+. They are listed in priority order, not implementation order.

### 1. Fix the Export Gate routing bug (StatusBar.tsx line 373)

Change `setRightTab('properties')` to `setRightTab('governance')`. One line. Eliminates a clear usability failure where the primary user action — understanding why export is blocked — routes to the wrong panel. Estimated 5 minutes to implement, test in 1 scenario.

### 2. Show the Health Score ring by default when no violations exist

Change `GovernanceDashboard.tsx` line 688 from `useState(false)` to `useState(() => /* compute initial noViolations */)`. When the dashboard opens clean, the score ring and grade letter should be the first thing visible — not hidden behind a collapsed accordion. This transforms the clean-file experience from "empty panel" to "you're at 100, A grade."

### 3. Add text labels to right sidebar tabs

The icon-only tab bar is a readability problem for new users. Labels take 5 pixels of vertical height and are the difference between "I have to hover to know what this does" and "I know at a glance." The right sidebar is narrow, which is why icons were chosen, but even single-word labels ("Health," "Inspect," "Tokens") fit at the current minimum panel width of 160px.

### 4. Add "Setup / Reconnect IDE" to the CommandPalette

A power user who needs to reconfigure their IDE connection has no discoverable path after initial setup. The CommandPalette already handles all other governance and settings actions. Adding this command closes the configuration loop and makes Glass self-sufficient for users who rotate credentials or switch editors.

### 5. Surface Autopilot in the GovernanceDashboard, not only the StatusBar

Autopilot is a governance feature — it belongs where governance information lives. Add an "Autopilot" section or row to the GovernanceDashboard that shows its current state (on/off, fixes pending) and links to toggle it. The current status bar implementation is correct as a persistent indicator, but discovery depends entirely on a 6px chip in the footer that only appears after the first violation. No designer should first encounter Autopilot by accidentally hovering over the status bar.

---

## Detailed Summary of Defects by File

| File | Issue | Severity |
|---|---|---|
| StatusBar.tsx:373 | Export Gate routes to wrong tab on violation state | Critical |
| GovernanceDashboard.tsx:688 | Health Score accordion collapsed by default on clean file | Critical |
| StatusBar.tsx (overall layout) | Flat flex row with no overflow management | Significant |
| StatusBar.tsx (Autopilot) | No discovery surface outside of status bar chip | Significant |
| App.tsx:959–989 | Right tab icons without labels | Significant |
| App.tsx:879–894 | Left tab labels are raw identifiers | Significant |
| GovernanceDashboard.tsx:832,888 | Violation messages truncated, element IDs not human-readable | Significant |
| StatusBar.tsx + GovernanceDashboard.tsx | Inconsistent "no design system" resolution paths | Significant |
| LaunchScreen.tsx:428–465 | Tile expansion missing aria-expanded and aria-controls | Significant |
| App.tsx (CommandPalette) | No "Setup / Reconnect IDE" command | Significant |
| StatusBar.tsx:624 | "Scratchpad" label is internal jargon | Minor |
| GovernanceDashboard.tsx:706 | "Run Audit" button unexplained | Minor |
| GovernanceDashboard.tsx:837–846 | Fix button is a span with role="button" inside a button | Minor (accessibility) |
| XYCanvas.tsx:67–68 | Drag handle has no resting-state affordance | Minor |
| GovernanceDashboard.tsx:793 | "Fix all auto (N)" is awkward label | Minor |
| GhostCodeSnippet (inferred) | Possible missing Escape dismiss | Minor |

---

*End of review.*
