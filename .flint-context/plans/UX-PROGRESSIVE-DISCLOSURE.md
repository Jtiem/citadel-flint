# UX Progressive Disclosure Plan — Flint Glass

**Author:** flint-product-planner
**Date:** 2026-03-27
**Version:** 1.0
**Status:** DRAFT — Ready for engineering review

---

## 1. Executive Summary

Flint Glass currently renders its full feature surface — seven right-panel tabs, three left-panel tabs, a dense status bar, and multiple canvas overlays — the instant a project opens, regardless of whether the user has connected Figma, linked an IDE, or even produced a single violation. The result is a product that signals sophisticated complexity before the user has earned a single win. This plan defines a four-stage progressive disclosure strategy that teaches Glass's power through the work itself: start with a near-empty canvas focused on preview and a single governance signal, and reveal each additional capability only after the user's context earns it. The payoff is an onboarding arc that moves from "I see a preview" to "I see why every component is rated the way it is" in a natural sequence tied to real workflow actions, not arbitrary time gates.

---

## 2. Critical UX Review

### 2.1 First Impression

**Severity: Medium**

The `LaunchScreen` (`src/components/ui/LaunchScreen.tsx`) is well-structured. The JTBD tile approach (From Figma / Connect codebase / Audit a folder / Governance dashboard) correctly frames Glass as a tool you connect to a project, not a blank canvas you fill. The primary CTA "Open Canvas" is clear.

Two problems remain. First, the subtitle on the header reads "Design System Governance" — a technically accurate but insider phrase. A first-time user who has never worked with a design system will not know whether this describes something they do or something Glass does for them. Second, the "Open Canvas" primary CTA implies a drawing tool. This is the first word a designer reads, and it sets expectations Glass cannot meet — there is no drawing in Glass. The button should be titled "Start building" or "New project" to align with what happens next: a scratchpad folder is created and the three-panel workspace appears.

**Files to fix:** `src/components/ui/LaunchScreen.tsx` (line 287: button label, line 241: header subtitle)

### 2.2 Information Overload

**Severity: High**

When a project first opens, the following UI elements are active simultaneously:

**Top bar (1 row):**
- Product name + gradient
- Active filename
- IPC health pill ("Connecting…" → "Pong from main")
- Save state dot
- Export button (ShieldCheck or ShieldAlert)
- Governance Rules gear icon
- Project overflow menu (MoreHorizontal)

That is 7 distinct interactive or informational elements in a 48px header strip.

**Left panel tabs (3):**
- Layers / Assets / Files

**Right panel tabs (7, icon-only):**
- Properties (SlidersHorizontal)
- Tokens (Palette)
- Activity (Activity)
- Health (ShieldCheck)
- Agents (Bot)
- Scope (Layers)
- Recovery (History)

**Status bar (~8–11 items depending on state):**
- MCP dot + label + optional "Reconnect"
- "Local SQLite (better-sqlite3)" — static text
- "Babel AST Parser Active" — static text
- "Electron IPC Flint" — static text
- Build/Govern view indicator (when not preview mode)
- Responsive breakpoint chip (when mobile/tablet)
- Scratchpad chip (when scratchpad)
- Figma dot + label (amber "No design system" on fresh project)
- Overrides badge (when count > 0)
- Autopilot toggle
- Export Ready / violation chip
- Beta chip + update chip (when applicable)
- SyncStatus widget

**Total simultaneous attention demands at project open:** approximately 25–30 distinct UI elements.

This is not a "power user" interface — it is an undifferentiated feature dump. Every element competes for attention with equal visual weight. The three static status-bar strings ("Local SQLite (better-sqlite3)", "Babel AST Parser Active", "Electron IPC Flint") are implementation details that belong in a settings or About panel, not a persistent footer visible at all times.

**Files to fix:** `src/components/editor/StatusBar.tsx` (lines 389–397: remove static tech strings), `src/App.tsx` (right panel tab rendering at lines 761–782)

### 2.3 Discoverability

**Severity: High**

The seven right-panel tabs are icon-only with no labels. Tab icons are:

- SlidersHorizontal → Properties (reasonable)
- Palette → Tokens (reasonable)
- Activity → Activity (ambiguous — looks like a chart or a heartbeat)
- ShieldCheck → Health (collides visually with the Export button which is also ShieldCheck/ShieldAlert)
- Bot → Agents (clear)
- Layers → Scope (the Layers icon is also used on the left panel "Layers" tab — same icon, different meaning)
- History → Recovery (reasonable)

The "Scope" tab uses the same Lucide `Layers` icon as the left panel's "Layers" tab. Two tabs in the same window share an icon. This is a navigational collision that will cause misclicks every session.

The GovernancePanel (full-screen rules manager) is only reachable via: (a) the Settings2 gear icon in the top bar, (b) the CommandPalette (⌘K). A user who never discovers the gear and never learns ⌘K will never find rule management. There is no path from "I see a violation" to "I want to configure this rule" that does not require knowing about the gear icon.

**Files to fix:** `src/App.tsx` (icon imports at line 52, tab definitions at lines 761–782), need to add tooltips on hover and differentiate the Scope icon.

### 2.4 Consistency

**Severity: Medium**

The Export action exists in two places with different visual treatments:
1. Top bar: a labeled button with border ("Export")
2. Status bar: an unlabeled chip showing "Export Ready" or "N Mithril Violations"

Both are interactive. Both open the ExportModal via different mechanisms (button onClick vs. CustomEvent dispatch). A user who discovers one will not know the other exists.

The ShieldCheck icon appears on both the Export button (top bar) and the Health tab (right panel). In the top bar it means "file is export-ready." In the right panel it means "view health score." Users scan for icons as affordances — same icon, two meanings, two locations.

**Files to fix:** `src/App.tsx` (top bar export button at line 651), `src/components/editor/StatusBar.tsx` (export chip at lines 597–625). The right panel Health tab should use a different icon (e.g. `Activity` or `BarChart2`).

### 2.5 Empty States

**Severity: Critical**

The following panels have empty states that are either blank or unhelpfully technical:

**Properties tab (empty, no selection):** Renders nothing useful. `PropertiesPanel` returns a minimal shell when `selectedNodeId` is null. There is no instruction telling the user to click something on the canvas.

**Tokens tab (no design system connected):** `TokenManager` renders its full UI with empty lists. The amber "No design system" indicator in the StatusBar fires, but the Tokens tab itself does not explain *why* there are no tokens or what to do.

**Activity tab (no MCP activity):** Renders an empty log. No explanation that Activity tracks AI agent tool calls, which means nothing to a user who has not yet connected an AI agent.

**Health tab (fresh project, no violations):** Renders a health score of 100 with an A grade, which is technically correct but misleading — it's 100/A because there's no design system to enforce against, not because the code is clean.

**Agents tab (no agents connected):** Renders a loading spinner or empty state with no path to connecting an agent.

**Scope tab (no registry):** Shows an empty component list. No prompt to run indexing.

These empty states represent 6 of the 7 right-panel tabs returning unhelpful or confusing content on a fresh project. The product feels broken on first use.

**Files to fix:** All right-panel tab components; see Section 6 for specific empty state designs.

### 2.6 Progressive Complexity

**Severity: High**

There is no progressive complexity in Glass today. All 7 tabs are always visible. The Governance Autopilot toggle in the status bar is always visible. The GovernancePanel (rule packs, compliance profiles, 50+ rules) is always one click away. The Agent Trust Tier system is always exposed. None of these are gated to "you have used this feature and are ready for more."

The onboarding nudge (`OnboardingNudge` in `src/components/ui/OnboardingNudge.tsx`, rendered at App.tsx line 755) is the only progressive element, and it renders above the tab bar — an awkward position that competes with the tabs themselves.

### 2.7 Workflow Alignment

**Severity: Medium**

The actual design-to-production workflow is:
1. Preview component
2. See governance state (violations, health)
3. Fix violations or accept risk
4. Export

Glass's right panel puts Properties first — which requires canvas selection to be useful — before Health, before the Governance information a user needs to understand whether they can export. The workflow order should be: Health (what's the state?), Properties (what is this?), Tokens (what system governs this?), then deeper options.

The left panel's three-tab structure (Layers / Assets / Files) is reasonable but "Files" is a developer tab — it shows raw filesystem paths and is primarily useful when Glass is being used as a companion to an IDE session. On first launch, this tab adds complexity without benefit.

---

## 3. Progressive Disclosure Strategy

### Stage 1: First Launch (minute 0–5)

**Goal:** The user takes one action, sees something work, and understands what Glass does.

#### What is VISIBLE

- LaunchScreen with renamed primary CTA: "New project" (not "Open Canvas")
- Four JTBD tiles
- Recent projects (if any)
- SetupWizard (first launch only, before LaunchScreen)
- Once in workspace: the canvas (preview mode), the left panel in Layers-only mode, the right panel with only the Properties tab visible

#### What is HIDDEN

- Right panel tabs: Activity, Health, Agents, Scope, Recovery — all hidden
- Right panel tab: Tokens — hidden until design system is connected
- Left panel tab: Files — hidden until MCP is confirmed connected
- Status bar: "Local SQLite", "Babel AST Parser Active", "Electron IPC Flint" static strings — removed permanently
- Status bar: Autopilot toggle — hidden until first violation is seen
- Status bar: Overrides badge — hidden until first override exists
- GovernancePanel gear icon — present but relocated (see Section 4)

#### Single first action

After workspace opens, the Properties tab is selected and shows:

> **Nothing selected yet.**
> Click any element in the preview to inspect it.

When the user clicks an element, Properties populates. This is the first win: "I clicked something and Glass responded."

#### Teaching without a tutorial

The first time a violation appears in GovernanceOverlay (inside the Properties tab), a contextual tooltip appears once: "Mithril flagged a drift — this color doesn't match your design tokens. Click to see why." This is dismissed on click and never shown again. No modal, no walkthrough, no "step 1 of 7."

#### Trigger to advance to Stage 2

User has selected at least one element on the canvas.

---

### Stage 2: First Project (minute 5–15)

**Goal:** The user sees governance in action and understands the health score.

#### What becomes VISIBLE (in addition to Stage 1)

- Right panel: Health tab unlocks — appears when the first audit completes (first `mithrilViolations` or `a11yViolations` array is non-empty OR when the first file is parsed successfully)
- Status bar: Export chip now appears (was present but visually faded in Stage 1)
- Governance stickers begin appearing on component cards in Build mode
- The "No design system" amber indicator in the Figma StatusBar chip becomes a tooltip: "Connect Figma to enforce your color and type tokens"
- Left panel: Assets tab unlocks once the component registry has at least 1 entry

#### What is STILL HIDDEN

- Tokens tab: still hidden
- Activity tab: still hidden
- Agents tab: still hidden
- Scope tab: still hidden
- Recovery tab: still hidden (this unlocks after first mutation)
- GovernancePanel full rules manager: present behind gear icon, not surfaced proactively

#### How governance is introduced naturally

When the first violation badge appears in GovernanceOverlay, the Health tab icon becomes active (shows a count badge). The user's natural reaction: "What is that?" They click the tab. The Health tab shows the score ring, the grade, and the top violations. This is the governance introduction — not a wizard step, but a reaction to seeing something real.

#### When the first violation badge appears

First violation badge appears in GovernanceOverlay when `canvasStore.mithrilViolations` or `canvasStore.a11yViolations` has at least one entry. This fires automatically when the file is parsed.

#### Trigger to advance to Stage 3

Any of:
- User connects Figma (via LaunchScreen tile or StatusBar popover)
- MCP connection is confirmed active (via SetupWizard completion or StatusBar indicator turning green)

---

### Stage 3: Connected (day 1–3)

**Goal:** The AI agent features and token system become meaningful.

#### What becomes VISIBLE (in addition to Stage 2)

- Right panel: Tokens tab unlocks — appears when `tokenStore.tokens.length > 0` (Figma sync has delivered tokens OR user has imported a token file)
- Right panel: Activity tab unlocks — appears when `mcpConnected === true` AND first activity log entry exists
- Right panel: Recovery tab unlocks — appears when `historyStore` has at least one undo entry (first mutation has been made)
- Left panel: Files tab unlocks — appears when `mcpConnected === true`
- Status bar: Autopilot toggle becomes visible when MCP is connected and first violation has been seen
- GovernancePanel (full rules manager) remains behind gear icon but now has a contextual tooltip on the gear: "50 WCAG + Mithril rules — configure here"

#### What is STILL HIDDEN

- Right panel: Agents tab — hidden until `agentStore` detects at least one agent mutation in the session
- Right panel: Scope tab — hidden until at least 3 components are in the registry

#### Figma, MCP, agent feature unlock triggers

| Feature | Trigger |
|---------|---------|
| Tokens tab | `tokenStore.tokens.length > 0` |
| Activity tab | `mcpConnected === true` AND activity log file exists with at least 1 entry |
| Recovery tab | `historyStore.undoStack.length > 0` |
| Files tab | `mcpConnected === true` |
| Autopilot | `mcpConnected && mithrilViolations.length > 0` |
| Scope tab | `registryService.componentCount >= 3` |
| Agents tab | Agent mutation recorded in session (first `flint_ast_mutate` or `flint_plan` call appears in activity log) |

#### How tabs are revealed spatially

When a new tab unlocks, it is added to the right panel's tab bar with a one-time "new" dot indicator (a 4px indigo dot above the icon, similar to iOS notification dots). The dot disappears when the tab is first clicked. This communicates "something new is here" without interrupting flow.

---

### Stage 4: Power User (week 1+)

**Goal:** Full feature set is available. Customization is earned.

#### What becomes VISIBLE (full feature set)

All 7 right-panel tabs: Properties, Tokens, Activity, Health, Agents, Scope, Recovery.

All 3 left-panel tabs: Layers, Assets, Files.

The status bar in its full form (minus the three removed static tech strings).

GovernancePanel advanced features: Rule Packs, Compliance Profiles.

The CanvasViewToggle (Build / Preview / Govern) is always visible and now fully taught because the user has seen components in preview mode and understands what Build and Govern views offer.

#### Customization options in Stage 4

- Right panel tabs can be reordered via drag (not currently built — see Section 7 for priority)
- Status bar items can be individually hidden/shown via a "Customize status bar" menu (right-click the status bar)
- The "three static tech strings" remain permanently removed for all users

#### Advanced governance (rules, packs, agent trust)

Rule Packs and Compliance Profiles are accessible via the GovernancePanel gear (always was, now better labeled). Agent trust tiers in the Agents tab are documented with a one-time contextual tooltip on first visit: "These are the AI agents that have called Flint tools this session. Trust tiers control what they're allowed to change."

---

## 4. Spatial Model

The canonical "where to look" pattern for Glass.

### Left Panel = What Am I Looking At?

**Purpose:** Navigation and structure. Answers "what files and elements exist in this project?"

- **Layers tab:** Shows the AST tree of the active file. Always first. Always present once a project is open.
- **Assets tab:** Component registry cards. Unlocks in Stage 2 when registry has entries.
- **Files tab:** Raw filesystem tree. Unlocks in Stage 3 when MCP is connected. Primarily useful when Glass is paired with an IDE session.

**Icon change needed:** The left panel Layers tab uses `Layers` (Lucide). The right panel Scope tab also uses `Layers`. These must be differentiated. Left panel Layers → keep `Layers`. Right panel Scope → change to `Package` or `Boxes` (representing component allowlist/packages).

### Canvas = What Does It Look Like?

**Purpose:** The primary workspace. Answers "how does this component render and what governance violations does it have?"

- Preview mode: Live iframe. Ghost overlays. Shield badges.
- Build mode: Component card grid. Recipe strip. Drag-to-insert.
- Govern mode: Compliance map. Coverage heat map. Grade stickers.

The CanvasViewToggle (`src/components/editor/CanvasViewToggle.tsx`) is already in the correct position (top-left of canvas). It should be the primary mode switch.

**One change needed:** The mode toggle labels "Preview / Build / Govern" should have keyboard shortcuts permanently visible next to them (⌘1, ⌘2, ⌘3). These shortcuts exist in code but are not surfaced in the UI.

### Right Panel = What Should I Know About This?

**Purpose:** Context for the current selection and project state. Answers "what does this element mean and what is its governance status?"

**Consistent selection rule:** The right panel always responds to canvas selection. When nothing is selected, it shows project-level health. When a node is selected, Properties becomes primary.

See Section 5 for full right panel redesign.

### Status Bar = Is Everything Healthy?

**Purpose:** Persistent system state. Should answer two questions only: (1) Is the system connected and working? (2) Is the active file ready to export?

**Current status bar has too much.** After removing the three static tech strings and applying progressive disclosure:

**Always visible:**
- MCP connection dot + label
- Figma dot + label (with "No design system" amber state preserved)
- Export chip (Export Ready / blocked with violation count)
- SyncStatus widget

**Conditionally visible:**
- Scratchpad chip (only when file is in Untitled- scratchpad)
- Override badge (only when count > 0)
- Autopilot toggle (only when MCP connected, Stage 3+)
- Breakpoint chip (only when preview mode + non-desktop breakpoint)
- Build View / Govern View label (only when not in preview mode)
- Beta chip + update chip (only when applicable)

**Permanently removed:**
- "Local SQLite (better-sqlite3)" — this is an implementation detail, not user state
- "Babel AST Parser Active" — same
- "Electron IPC Flint" — same

### Command Palette = Power Actions

**Purpose:** Keyboard-driven access to anything. ⌘K opens it. Lives in `src/components/ui/CommandPalette.tsx`.

The Command Palette is the correct home for: running a governance audit, triggering token sync, switching canvas mode, accessing recovery, managing rule packs. It is the escape valve for advanced operations that don't need persistent space in the UI.

**One addition needed:** The Command Palette should surface "Governance Rules" as a top-level command so users who never find the gear icon can still reach the GovernancePanel.

---

## 5. Right Panel Redesign

### Current State (7 icon-only tabs, always visible)

```
[SlidersHorizontal] [Palette] [Activity] [ShieldCheck] [Bot] [Layers] [History]
  Properties         Tokens    Activity    Health        Agents  Scope   Recovery
```

Problems:
- Icon collisions: ShieldCheck (Health) = ShieldCheck (Export button). Layers (Scope) = Layers (left panel Layers tab).
- All 7 always visible — no signal about what is currently meaningful.
- No visual hierarchy between "core" and "advanced" tabs.

### Proposed Redesign

**Grouping strategy: Core / Governance / Power**

Separate the 7 tabs into two visual groups with a 1px divider between them:

```
CORE GROUP (always visible, Stage 1+)
  [SlidersHorizontal]   Properties — selected element context
  [ShieldHalf]          Health     — project governance state

GOVERNANCE GROUP (visible Stage 2+, unlocks progressively)
  [Palette]             Tokens     — design token browser (unlocks: Stage 3)
  [Activity]            Activity   — MCP tool log (unlocks: Stage 3)
  [Bot]                 Agents     — agent risk posture (unlocks: Stage 3)

POWER GROUP (icon-only, collapses to "..." until Stage 4 or explicit expand)
  [Package]             Scope      — component allowlist (unlocks: Stage 3)
  [History]             Recovery   — git time machine (unlocks: Stage 3)
```

**Tab appearance at each stage:**

- Stage 1: Only Properties visible. Health visible but grayed out with tooltip "Opens after first audit."
- Stage 2: Health activates. Governance group appears but Tokens/Activity/Agents icons are dimmed with "..." overflow indicator.
- Stage 3: Tokens, Activity, and Agents unlock individually (per trigger table in Section 3). Each reveals with a one-time "new" dot.
- Stage 4: All tabs visible. Scope and Recovery promoted out of overflow.

**Icon corrections:**

| Tab | Current Icon | Proposed Icon | Reason |
|-----|-------------|---------------|--------|
| Health | ShieldCheck | `BarChart2` or `TrendingUp` | Disambiguates from Export button's ShieldCheck |
| Scope | Layers | `Package` or `Boxes` | Disambiguates from left panel Layers tab |

**Label visibility:**

Tab labels ("Properties", "Tokens", etc.) should be visible on hover via tooltip (already implemented via `title` prop at App.tsx line 775). No change needed here, but labels should be added as `aria-label` values where missing for screen reader support.

**Tab width:**

Current: `py-2 px-3` per tab, 7 tabs in ~288px panel. At 288px / 7 tabs = 41px each — barely enough for a 14px icon with 12px padding. With the proposed Core (2 tabs always visible) + overflow, the Core tabs can be larger and more tappable.

---

## 6. Empty State Strategy

Each panel should tell the user what to do next, not simply be blank.

### Properties Tab (no selection)

**Current:** Minimal shell, no guidance.

**Proposed empty state:**
```
[cursor/click icon]
Nothing selected

Click any element in the preview
to inspect its properties and
governance state.
```
**Implementation:** `PropertiesPanel.tsx` — add a conditional render when `selectedNodeId === null` that shows this message. The message should disappear on first selection and never reappear.

### Health Tab (no violations, fresh project, no design system)

**Current:** A 100/A score that implies everything is fine.

**Proposed empty state for "no design system" condition:**
```
[amber dot] No design system connected

Health score will be 100 until you
connect Figma or import a token file.
Governance has nothing to enforce against yet.

[Connect Figma] [Import tokens]
```
**Implementation:** `GovernanceDashboard.tsx` — detect `tokenStore.tokens.length === 0` and render this state instead of the misleading A grade.

### Tokens Tab (no tokens loaded)

**Current:** Empty TokenManager list.

**Proposed empty state:**
```
[Palette icon, muted]
No design tokens

Connect Figma to pull your colors,
spacing, and typography tokens.
Or import a token file manually.

[Connect Figma] [Import token file]
```
**Implementation:** `TokenManager` component — detect empty token list on mount and render this state.

### Activity Tab (no MCP activity)

**Current:** Empty log.

**Proposed empty state:**
```
[Activity icon, muted]
No agent activity yet

Activity shows every tool call your
AI agent (Claude, Cursor, etc.) makes
through Flint. Connect your IDE via MCP
to see the live log.

⌘K → "MCP setup" to get started
```
**Implementation:** `ActivityFeed.tsx` — detect empty log on mount and render this state.

### Agents Tab (no agents)

**Current:** Loading spinner or blank.

**Proposed empty state:**
```
[Bot icon, muted]
No agents active

When your AI agent calls Flint tools,
its risk posture appears here.
Each agent gets a trust tier and
a mutation count.

[View agent policy] ← links to .flint/agent-policy.json via IPC
```
**Implementation:** `AgentDashboard.tsx` — detect empty `agents` array and render this state.

### Scope Tab (no registry)

**Current:** Empty component list with a discovery banner (EN.4).

**Proposed empty state (replaces EN.4 banner):**
```
[Package icon, muted]
Registry is empty

Run indexing to discover your
component library. Flint will scan
every .tsx/.jsx file in the project.

[Index now]
```
The "Index now" button calls `window.flintAPI.project.reindex()` (already wired via CK.3).

**Implementation:** `ComponentScopePanel.tsx` — detect zero components in registry and render this state.

### Recovery Tab (no history)

**Current:** Empty RecoveryPanel.

**Proposed empty state:**
```
[History icon, muted]
No history yet

Every change you or an AI agent makes
is recorded here. Use ⌘Z to undo,
or browse the Git timeline.
```
**Implementation:** `RecoveryPanel.tsx` — detect empty undo stack and no git commits and render this.

---

## 7. Implementation Priority

Listed in implementation order. Each item includes the file(s) to change and the specific behavioral change.

### Priority 1 — Status Bar Noise Reduction (effort: S, 1 day)

Remove the three static technology strings from `StatusBar.tsx` (lines 389–397):
- "Local SQLite (better-sqlite3)"
- "Babel AST Parser Active"
- "Electron IPC Flint"

These are internal implementation details. They belong in an About panel or developer tools overlay, not a persistent footer. This is a one-line deletion per string and frees ~25% of status bar width for meaningful indicators.

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/StatusBar.tsx`

### Priority 2 — Icon Collision Fixes (effort: S, 1 day)

Fix the two icon collisions:
1. Right panel Health tab: change `ShieldCheck` to `BarChart2`
2. Right panel Scope tab: change `Layers` to `Package`

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/App.tsx` (lines 52, 764–768)

Also add `aria-label` to each right panel tab button (the `title` prop handles tooltips but `aria-label` is needed for screen readers).

### Priority 3 — Empty State Implementations (effort: M, 3–4 days)

Implement the empty states for all 6 affected panels:
1. `PropertiesPanel.tsx` — "Nothing selected" state
2. `GovernanceDashboard.tsx` — "No design system" state with CTA buttons
3. `TokenManager.tsx` — empty state with Connect Figma + Import token CTA
4. `ActivityFeed.tsx` — "No agent activity" state with ⌘K hint
5. `AgentDashboard.tsx` — "No agents active" state
6. `ComponentScopePanel.tsx` — "Registry is empty" state with "Index now" button
7. `RecoveryPanel.tsx` — "No history yet" state

Each empty state must: (a) explain what the panel does, (b) explain why it's empty, (c) offer a specific next action.

### Priority 4 — LaunchScreen Copy Fixes (effort: S, 0.5 days)

Two copy changes in `LaunchScreen.tsx`:
1. Primary CTA label: "Open Canvas" → "New project"
2. Header subtitle: "Design System Governance" → "AI governance for your design system"

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/LaunchScreen.tsx` (lines 241, 287)

### Priority 5 — Right Panel Progressive Disclosure Logic (effort: M, 3–5 days)

Implement the tab visibility logic from Section 3. New state slice in `canvasStore.ts`:

```typescript
unlockedTabs: Set<RightTab>
unlockTab: (tab: RightTab) => void
```

Default unlocked set: `['properties', 'health']`

Unlock triggers fire as effects in `App.tsx` watching:
- `tokenStore.tokens.length > 0` → unlock 'tokens'
- `mcpConnected && activityLogHasEntries` → unlock 'activity'
- `historyStore.undoStack.length > 0` → unlock 'recovery'
- `mcpConnected` → unlock 'files' (left panel)
- `registryComponentCount >= 3` → unlock 'scope'
- `agentActivityDetected` → unlock 'agents'

The tab bar renders only tabs in `unlockedTabs`. New tabs appear with a one-time "new" dot. The dot is cleared from a separate `seenTabs: Set<RightTab>` slice.

**Files:** `/Users/tiemann/Lunar-Elevator-Bridge/src/store/canvasStore.ts`, `/Users/tiemann/Lunar-Elevator-Bridge/src/App.tsx`

### Priority 6 — Health Tab Unlocks After First Audit (effort: S, 1 day)

Change the Health tab unlock trigger: it should not be visible in Stage 1. It appears in Stage 2 when the first audit completes.

The first audit completes when `canvasStore.mithrilViolations` becomes non-null (even if it's an empty array — this signals "the linter ran"). Add this as a trigger in the progressive disclosure logic above.

Until the Health tab is unlocked, add a single contextual badge to the Properties tab header: a small amber dot with count when violations exist. This tells the user "something happened" without requiring them to know to look at a tab they haven't seen yet.

**Files:** `/Users/tiemann/Lunar-Elevator-Bridge/src/App.tsx`, `/Users/tiemann/Lunar-Elevator-Bridge/src/store/canvasStore.ts`

### Priority 7 — Top Bar Rationalization (effort: M, 2–3 days)

The top bar's 7 simultaneous elements need hierarchy:

**Keep in top bar:**
- Product name / brand (always)
- Active filename (always when project open)
- Save state dot (always when project open)

**Move to Command Palette / right-click menu only:**
- "Governance Rules" gear icon → remain in top bar but add to ⌘K commands as well
- Project overflow menu (MoreHorizontal) → keep, it's low-frequency

**Visual change:**
- Remove the IPC health pill ("Pong from main") from the top bar entirely. This is a developer debug artifact. The MCP status in the StatusBar already covers system connectivity.

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/App.tsx` (lines 618–629: IPC health pill)

### Priority 8 — Keyboard Shortcut Visibility on CanvasViewToggle (effort: S, 0.5 days)

Add ⌘1 / ⌘2 / ⌘3 labels to the three mode buttons in `CanvasViewToggle.tsx`. These shortcuts are already wired in `App.tsx` (lines 371–387) but nowhere visible in the UI.

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/CanvasViewToggle.tsx`

---

## 8. Test Ownership

All implementation work stemming from this plan MUST follow the Flint testing standard.

| Implementation item | Test suite | Test types required |
|--------------------|-----------|-------------------|
| Status bar static string removal | `npm run test:react` | Unit: StatusBar renders without removed strings |
| Icon collision fixes | `npm run test:react` | Unit: correct icon renders per tab |
| Empty state implementations | `npm run test:react` | Unit: each panel renders empty state when condition is true; renders content when condition is false |
| Progressive disclosure logic | `npm test` + `npm run test:react` | Unit: canvasStore unlockTab action; Integration: tab appears after trigger fires |
| LaunchScreen copy | `npm run test:react` | Unit: button label and subtitle match updated strings |
| Top bar IPC pill removal | `npm run test:react` | Unit: IPC pill does not render |

Implementing agent directive: write tests for all new code, run the full suite, run `npx tsc --noEmit`, report results as `[Package]: X/Y passing (Z new)` before marking any item ONLINE.

---

## 9. What This Plan Does NOT Do

This plan deliberately excludes:

- **Redesigning the canvas itself.** The XYCanvas, LivePreview, Build mode cards, and Govern mode are working well. No changes proposed to `XYCanvas.tsx` or `LivePreview.tsx`.
- **Redesigning the SetupWizard.** The wizard (`SetupWizard.tsx`) is 5 steps, functional, and correct. The only setup-related change is to the LaunchScreen copy.
- **Adding new tabs or features.** Progressive disclosure means revealing what exists, not building new things.
- **Changing the MCP surface.** All progressive disclosure is Glass-side only. The MCP engine is not affected.
- **Removing features.** Nothing is deleted. Every feature remains accessible — it just needs to be earned.
- **Customizable tab ordering.** Noted as a Stage 4 power user feature but not in scope for this plan.

---

## Appendix A: Right Panel Tab Unlock Conditions (Quick Reference)

| Tab | Stage | Unlock Trigger | Store to watch |
|-----|-------|---------------|----------------|
| Properties | 1 | Always visible | — |
| Health | 2 | First audit runs (`mithrilViolations !== null`) | `canvasStore.mithrilViolations` |
| Tokens | 3 | First token loaded | `tokenStore.tokens.length > 0` |
| Activity | 3 | MCP connected + first log entry | `mcpConnected && activityLogHasEntries` |
| Recovery | 3 | First mutation made | `historyStore.undoStack.length > 0` |
| Scope | 3 | 3+ components in registry | `componentCount >= 3` (via IPC) |
| Agents | 3 | First agent mutation in session | First `flint_ast_mutate` or `flint_plan` in activity log |

## Appendix B: Left Panel Tab Unlock Conditions

| Tab | Stage | Unlock Trigger |
|-----|-------|---------------|
| Layers | 1 | Always visible |
| Assets | 2 | Registry has ≥ 1 component |
| Files | 3 | MCP connected |

## Appendix C: Status Bar Items — Permanent / Conditional

| Item | Keep/Remove | Condition |
|------|------------|-----------|
| MCP dot + label | Keep | Always |
| "Local SQLite" string | Remove | — |
| "Babel AST Parser Active" string | Remove | — |
| "Electron IPC Flint" string | Remove | — |
| Canvas view indicator | Keep | Only when not in preview mode |
| Breakpoint chip | Keep | Only when preview mode + non-desktop |
| Scratchpad chip | Keep | Only when scratchpad path |
| Figma dot + label | Keep | Always |
| Overrides badge | Keep | Only when count > 0 |
| Autopilot toggle | Keep | Stage 3+: MCP connected only |
| Export chip | Keep | Always (was faded in Stage 1, full in Stage 2+) |
| Beta chip | Keep | Only when beta build |
| Update chip | Keep | Only when update available |
| SyncStatus | Keep | Always |
