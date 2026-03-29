# Governance UX Review — Flint Glass

**Date:** 2026-03-27
**Reviewer:** Flint Product Planner (AI)
**Scope:** End-to-end governance management experience — violation discovery, understanding, configuration, and export

---

## 1. Executive Summary

The governance machinery in Flint Glass is technically complete and architecturally sound, but it is organized around how the system works rather than how a user thinks. A designer who sees a red badge on a component currently faces four separate surfaces — the canvas badge, the GhostOverlay, the GovernanceOverlay in the right sidebar, and the GovernanceDashboard — each showing overlapping but non-identical information with no explicit connection between them. There is no single path from "I see a problem" to "the problem is resolved"; the user must discover and navigate multiple disconnected panels by inference. The export gate is the enforcer but it lacks the remediation power it implies — the "Fix" button in ExportModal selects the node but does not actually execute the fix, leaving the user to find the right panel themselves. The GovernanceDashboard health score is the product's most prominent signal yet it scores 100/A on a project with zero design tokens, silently lying to new users. If governance is the product, these are product failures, not UX polish issues.

---

## 2. Workflow-by-Workflow Findings

### Workflow 1: "I see a violation — now what?"

**Finding 1.1 — Four independent surfaces, no hierarchy** [Critical]

When a node has violations, four separate UI surfaces activate simultaneously:
- The ShieldOverlay renders a badge on the canvas (amber/red pill, top-left of the node bounding box)
- The GhostOverlay renders a floating card in the top-right of the viewport showing hardcoded classes
- The GovernanceOverlay in the left panel (or right panel — it is not clear from the code which panel houses it) shows a scrollable violation list with Auto-Fix buttons
- The GovernanceDashboard in the right sidebar "health" tab shows a penalty breakdown

None of these panels acknowledge the others exist. The user has no way to know these are all representations of the same underlying violation. A designer will naturally try to close the GhostOverlay (it has a dismiss button) thinking they have dismissed the violation. The badge stays. The overlay stays. The health score stays degraded. This teaches the user that dismissal is cosmetic and governance is something that happens to them, not something they control.

**Finding 1.2 — The canvas badge clicks to Properties, not to the violation** [Critical]

In `ShieldOverlay.tsx` (line 408–413), clicking a violation badge runs:
```
setSelectedNode(nodeId)
setActiveSelection(nodeId)
setRightTab('properties')
```

This takes the user to the Properties tab, not to the Health tab or GovernanceOverlay where the violation details and fix buttons live. The user clicked a violation badge and was taken somewhere that does not show violations. This is a fundamental navigation mismatch. The badge implies "click me to see/fix the violation." The behavior is "click me to inspect this element's layout properties."

**Finding 1.3 — The "Configure rule" link is optional and invisible until the handler is wired** [High]

In `GovernanceOverlay.tsx` (line 186–197), the `onConfigureRule` prop controls whether the gear icon renders at all. The icon is `10px` — the minimum perceptible touch target — and labeled only as "Configure rule MITHRIL-COL" with no explanatory text. A user who does not understand Flint's rule system will not recognize this as the path to disabling or adjusting the rule that flagged their work. Even when the handler is wired (OPP-15 is listed as CONTAINED in the opportunities doc but no evidence it has shipped), the affordance is invisible at 10px.

**Finding 1.4 — No override or defer path from the violation surface** [High]

A user who disagrees with a violation has no way to override or defer it from the GovernanceOverlay or ViolationTooltip. The only override path is: close whatever you were doing, find the gear icon, click it, wait for GovernancePanel to load, navigate to the correct category, find the rule, toggle it off, click Save. That is 7 steps. For a designer under deadline who needs to "acknowledge and move on," this is prohibitive.

**Finding 1.5 — GhostOverlay and GovernanceOverlay detect hardcoded values with different logic** [Medium]

GhostOverlay (line 187–220) performs its own `findHardcodedClasses` pass on the selected node's className string using a `PREFIX_CATALOGUE` approach. GovernanceOverlay reads from `linterWarnings` in `editorStore` which comes from the Mithril linter running on the full AST. These two detection systems can disagree. A node could appear clean in GovernanceOverlay but dirty in GhostOverlay (or vice versa) if the linter and the prefix-matching logic use different evaluation rules. A user who fixes a GhostOverlay warning has no guarantee the GovernanceOverlay count decreases.

**Finding 1.6 — Fix button in ExportModal navigates away but does not fix** [Critical]

In `ExportModal.tsx` (line 429–438), the "Fix" button for auto-fixable Mithril violations calls `handleSelectNode(id)`, which closes the modal and selects the node. It does not apply the fix. The user is now back on the canvas with a node selected, with no clear indication of where to go next to actually apply the `nearestToken` replacement. The button is labeled "Fix" with a wrench icon, which implies execution. It should either execute the fix inline or be labeled "Navigate to fix."

**Click count from problem to resolution:**
- See badge → understand WHY: 2 clicks (hover tooltip)
- See badge → fix it: minimum 4 clicks (hover, read, close tooltip, find GovernanceOverlay, click Auto-Fix) — likely 6–8 in practice because GovernanceOverlay location is not obvious
- See badge → override it: 7 steps minimum

---

### Workflow 2: "I want to understand my project's governance health"

**Finding 2.1 — Health score of 100/A on a project with no design system** [Critical]

In `GovernanceDashboard.tsx`, the `computeHealthScore` function returns 100 when there are zero Mithril violations, zero a11y violations, and zero overrides. For a brand-new project with no design tokens loaded, this is always the case — not because the code is clean, but because there is nothing to measure against. A score of 100/A actively misleads new users into thinking their project is fully governed when governance has not started yet.

The "no design system" empty state (OPP-5) was identified in the UX-OPPORTUNITIES.md file as a known gap and tagged as APPROVED FOR PLANNING. This document confirms it has not shipped. For a governance product, this is a showstopper: the first thing the user sees tells them everything is fine when it is not.

**Finding 2.2 — Health score formula is not user-legible** [High]

The penalty breakdown in GovernanceDashboard shows "Mithril violations × 5 pts" and "Accessibility violations × 10 pts" and "Active overrides × 3 pts." This exposes the internal calculation formula, not a user insight. A designer does not want to know the penalty weight of each violation type — they want to know "am I making progress?" and "what should I fix first to unlock export?"

The "Top Violated Rules" section addresses this partially by showing a ranked list of violation categories, but rows in this list are not clickable and do not lead to any action. They are purely informational data points with no next step attached to them.

**Finding 2.3 — No trend data** [Medium]

The health score is a point-in-time number with no history. There is a "Set Baseline / Delta Mode" feature that measures new violations since a snapshot, but this is not the same as trend data. A designer who has been fixing violations for an hour cannot see whether their score improved. Delta Mode requires explicit user action to set up — it is a power-user feature, not a built-in trend view.

**Finding 2.4 — "Active File" section shows only the current file** [Medium]

The GovernanceDashboard shows health only for the currently active file. In a multi-file workspace, a designer cannot get a cross-file health view from Glass. The worst-offending file may not be the active file. There is no way to see "which of my open files is in worst shape?" without switching files and re-reading the score.

---

### Workflow 3: "I want to configure governance rules"

**Finding 3.1 — GovernancePanel is undiscoverable** [Critical]

GovernancePanel is described in the code comments as opened via "gear icon / Cmd+K." The Cmd+K shortcut opens the command palette (`commandPaletteOpen` in canvasStore), not the GovernancePanel. The gear icon entry point is not identified in any of the reviewed files — it appears to be somewhere in App.tsx or a parent container but is not documented in the GovernancePanel itself. A new user has no affordance to find governance rule configuration from the violation surfaces they encounter.

The path from violation → rule configuration via the `onConfigureRule` prop in GovernanceOverlay is wired only when the parent component passes the handler. If the parent does not pass it, the configure icon simply does not render, leaving zero path from violation to configuration.

**Finding 3.2 — RuleRow shows rule ID and name but not what the rule does** [High]

In `GovernancePanel.tsx` (RuleRow component, lines 137–184), each rule shows:
- Toggle
- Rule ID (e.g., "MITHRIL-COL-001") in monospace
- Rule name (e.g., "Color Drift")
- Severity badge
- "modified" link if overridden

There is no description of what the rule does, what it catches, or what fixing it means in practice. A designer configuring governance rules needs to understand: "If I disable this, what am I allowing?" "If I set this to warning instead of critical, when will it block my export?" Neither question has an answer in the panel.

**Finding 3.3 — Three tabs (Rules / Rule Packs / Profiles) represent the same concept at different abstraction levels with no connecting explanation** [High]

- "Rules" tab: individual rule toggles (low-level)
- "Rule Packs" tab: grouped bundles of rules by domain/jurisdiction (mid-level)
- "Profiles" tab: compliance frameworks like WCAG 2.1 AA, GDPR (high-level)

Enabling a profile in the Profiles tab enables a rule pack, which activates individual rules. But there is no UI explanation of this relationship. A user who enables "EU — European Accessibility Act" in Profiles does not know which rules have just become active. A user looking at the Rules tab does not know which rules came from a Pack they enabled versus which are Flint's built-in defaults.

The relationship between these three concepts is the core of the governance configuration model. Without an explanation, users either disable things they should not (because they do not understand what enabling a pack means) or never engage with configuration at all.

**Finding 3.4 — Save button only saves Rules tab changes** [Medium]

The Save button in GovernancePanel footer is only rendered on the Rules tab (`{activeTab === 'rules' && ...}`). Pack and profile changes appear to apply immediately via IPC toggle. This inconsistency in commit model (explicit save vs. immediate apply) is unexplained in the UI. A user switching from Profiles to Rules tab will find a Save button they did not expect and may click it accidentally committing unintended rule overrides.

**Finding 3.5 — PolicySettings is a separate undiscoverable modal** [Medium]

`PolicySettings.tsx` exists as a full-screen modal with its own entry point that is separate from GovernancePanel. It controls Mithril ΔE thresholds, export gate severity floor, and the `block_on_overrides` toggle. A user configuring governance has no signal that there is a second, separate configuration surface with these controls. The relationship between GovernancePanel (per-rule overrides) and PolicySettings (global policy thresholds) is implicit only in the code architecture.

---

### Workflow 4: "I want to export — why is it blocked?"

**Finding 4.1 — Export gate label in StatusBar uses internal terminology** [High]

In `StatusBar.tsx` (line 118–122), the blocked export label is:
- "N Mithril Violation(s)" — "Mithril" is a Flint-internal Citadel name, not a term a first-time user knows
- "Overrides Active" — unclear whether this means rule overrides (governance configuration changes) or property overrides (manual style changes that differ from the design system)

A designer who sees "Overrides Active" blocking their export does not know what to do. There are two distinct override concepts in this system — rule overrides (in governanceStore, which do NOT block export) and property overrides (in the component_overrides SQLite table, which DO block export). The label conflates them.

**Finding 4.2 — ExportModal violation sections do not explain what category means** [Medium]

The blocked ExportModal shows three violation sections:
1. Property Overrides
2. Accessibility Violations
3. Mithril Violations

There is no explanation of what each category is or how they differ. A designer seeing "Mithril Violations" for the first time does not know if this means "design system drift" or "an AI model" or "something from the movie." The Compliance Summary section at the bottom (which appears only when there are violations and complianceSummary is non-null) adds "Regulatory Reference" rows in monospace font — regulatory citation codes like "WCAG 2.1 SC 1.1.1" — which are meaningful to compliance engineers but opaque to product designers.

**Finding 4.3 — "Fix" button in ExportModal closes the modal without fixing** [Critical — already noted in 1.6]

Repeated here because it is the single most damaging interaction in the export workflow. When export is blocked and the user clicks the "Fix" button (the most obviously named action), they are navigated away from the modal with no fix applied. Export remains blocked. The user is confused about what happened.

**Finding 4.4 — No "fix all" action in ExportModal** [High]

When there are multiple auto-fixable violations, each has an individual "Fix" button. There is no "Fix All" action to apply all auto-fixable violations at once, even though `GovernanceOverlay` already has the individual `handleAutoFix` logic and there is a batch mutation system (`editorStore.applyBatch`). A user with 8 auto-fixable Mithril violations must navigate to 8 individual nodes and apply 8 individual fixes.

---

### Workflow 5: "An AI agent changed my code — was it safe?"

**Finding 5.1 — ActivityFeed and AgentDashboard are passive but risk information is active** [High]

The ActivityFeed logs MCP tool invocations with outcomes (success/error/blocked). The AgentDashboard shows per-agent risk posture. Neither surface is linked to the violation surfaces. When an agent makes a change that introduces Mithril violations, the user sees the violations in GovernanceOverlay and ShieldOverlay but has no indication which agent caused them or when. The causal link between "agent action" and "new violation" is broken.

**Finding 5.2 — MRS Approval Flow (amber/red risk tier confirmations) is not represented in Glass** [Medium]

The MRS (Mutation Risk Scoring) approval flow exists in `orchestratorStore`. When a high-risk mutation is proposed, the user presumably must confirm it. But from the Glass UI perspective (GovernancePanel, GovernanceDashboard, ShieldOverlay), there is no representation of "a high-risk mutation is pending approval" in the governance surfaces. The approval flow and the governance health view are visually disconnected, which means a designer watching their health score does not know if an in-progress agent action is about to degrade it.

**Finding 5.3 — Undo agent changes requires knowing about RecoveryPanel** [Medium]

RecoveryPanel is the Git Time Machine UI accessible via the "recovery" right tab. There is no link from the ActivityFeed (where agent actions appear) to RecoveryPanel (where they can be undone). A designer who sees an agent made a bad change in the activity feed cannot follow that entry directly to a recovery action.

---

## 3. Information Architecture Problems

**The governance concept is split across six distinct surfaces with no declared hierarchy:**

| Surface | What it shows | Where it lives |
|---------|--------------|----------------|
| ShieldOverlay badge | Violation count per node, canvas-spatial | Canvas overlay |
| ViolationTooltip | Mithril + a11y violation details per node | Canvas hover |
| GhostOverlay card | Hardcoded classes per selected node | Viewport fixed position |
| GovernanceOverlay | Full violation list for active file | Right sidebar (which panel?) |
| GovernanceDashboard | Health score, top rules, penalty breakdown | Right sidebar "health" tab |
| ExportModal | Blocking violations for active file | Modal |

**The user must mentally construct a unified view of their governance state by visiting all six surfaces.** None of them declare "this is the authoritative view" or "go here to act." The ShieldOverlay badges are the most prominent (on-canvas, immediate) but lead to the Properties tab. GovernanceDashboard has the most information density but is buried in a right sidebar tab that starts with no "new" indicator. ExportModal has the most complete action surface but is only accessible when the user tries to export — after the problem has already been discovered elsewhere.

**The two override concepts share a name but mean different things:**
- `overridesExist` in canvasStore refers to property overrides (manual style changes) — these BLOCK export
- `overrides` in governanceStore refers to rule overrides (disabling or changing rule severity) — these do NOT block export

In the StatusBar, GovernanceDashboard, and ExportModal, both types of overrides appear but they are not distinguished. The "Active Overrides" section in GovernanceDashboard (line 496–514) shows a count derived from `overrideCount` which is a boolean coercion (`overridesExist ? 1 : 0`) and says "Property overrides are active — export is blocked." The "Modified" badge on rule rows in GovernancePanel refers to the other kind of override. The same word means two different things in two adjacent surfaces.

**Mithril and Warden are functionally distinct but visually merged:**

Mithril violations (design drift) and Warden violations (accessibility) are shown in separate sections in ExportModal and ViolationTooltip, but both use "critical" severity styling, both are called "violations," and both are listed in the same GovernanceDashboard "Top Violated Rules" list. A designer who understands "my button has no accessible name" is fundamentally different from "my button's color is 3.2 ΔE off spec" — these require different knowledge and different fix paths — but the visual treatment does not communicate this difference.

---

## 4. Interaction Design Problems

**Problem 4.1 — Badge click leads to Properties, not violation detail**
The most prominent interactive affordance (the canvas violation badge in ShieldOverlay) navigates to the Properties tab, not to any governance surface. Properties tab shows layout controls. The user must then navigate back to Health tab or find GovernanceOverlay through other means.

**Problem 4.2 — GhostOverlay has no fix action**
GhostOverlay is a floating read-only card showing hardcoded class entries with `suggestion` tokens. It is dismissed with an X button. There is no way to apply the suggested replacement from within GhostOverlay. The user must dismiss it, find GovernanceOverlay, and locate the matching violation row to apply the fix. The suggestion is shown but the action is withheld.

**Problem 4.3 — Fix preview (hover-only) is inaccessible**
In `GovernanceOverlay.tsx` (lines 258–265), the Auto-Fix button shows a diff preview (before→after token swap) only on `onMouseEnter` / `onFocus`. Touch device users and users who prefer not to hover before clicking have no way to preview the fix. The preview content is shown after the action point has already passed (hover implies intent, which should reveal confirmation, not additional ambiguity).

**Problem 4.4 — No bulk action path**
Every fix action in the governance surfaces is per-violation. With 20 auto-fixable violations (a realistic number when importing AI-generated code), the user must execute 20 individual actions with no "Fix All Design Drift" or "Fix All Fixable" affordance.

**Problem 4.5 — GovernancePanel changes require explicit Save; Pack/Profile changes do not**
The commit model inconsistency (saving rule overrides vs. immediate-apply pack toggles) creates unpredictable mental models. Users who enable a Rule Pack and then close the panel without pressing Save may not realize some of their changes persisted and some did not. The distinction is not surfaced in the UI.

**Problem 4.6 — ViolationTooltip is hover-only with no persistent pin**
ViolationTooltip (in ShieldOverlay, line 443–456) appears on `onMouseEnter` of a badge and closes when the badge loses hover. There is no way to keep the tooltip open while scrolling or doing other work. A user who wants to read the full violation message while simultaneously looking at their code in the IDE cannot do so.

**Problem 4.7 — Max 64 characters on violation message in GovernanceOverlay**
GovernanceOverlay shows violation messages with `line-clamp-2`. Mithril messages contain the rule ID, a description, and sometimes a ΔE value. A critical message like `MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set (ΔE 8.4 vs token text-blue-500 #3b82f6)` is routinely clipped. The most diagnostic part of the message — the exact ΔE value — is often in the truncated portion.

---

## 5. Copy and Terminology Problems

**Term: "Mithril"**
Used in: StatusBar label, ExportModal section header, GovernanceDashboard penalty row, violation badge tooltips. A first-time user has no frame of reference for "Mithril." The intent is "design system drift detection." The fix: use "Design Drift" as the user-facing term and reserve "Mithril" for Citadel/internal usage. StatusBar should read "3 Design Drift Issues" not "3 Mithril Violations."

**Term: "ΔE"**
Used in: ExportModal violation messages ("Color drift ΔE 4.5"), ViolationTooltip ("ΔE 8.4 — very different from token"). ΔE is a perceptual color science metric that is completely unknown to product designers. The copy should translate this: "This color is noticeably different from your design system token (ΔE 4.5)" rather than leading with the metric.

**Term: "Governance"**
Used as a tab label, section header, and panel title throughout. "Governance" is an enterprise compliance term that connotes heavy process. Figma calls these "constraints" or "component properties." For the notification surface, "governance" may be appropriate (this is a compliance product). But in the immediate violation surfaces, "design system check" or "brand check" would create faster intuition for a product designer audience.

**Term: "Delta Mode"**
Used in GovernanceDashboard header badge. "Delta Mode" has no obvious meaning. The behavior — "only count violations introduced since a baseline snapshot" — is a useful feature but the name requires knowledge of what a delta is in this context. "New Issues Only" or "Changes Since Baseline" would be understood without explanation.

**Term: "Overrides Active"**
Used in StatusBar export gate chip and GovernanceDashboard. As noted in section 3, "overrides" means two different things in this system. The StatusBar chip "Overrides Active" refers to property overrides (export-blocking). The GovernanceDashboard "Active Overrides" count refers to rule configuration changes. The same term, adjacent surfaces, different meaning.

**Penalty breakdown labels ("× 5 pts", "× 10 pts", "× 3 pts")**
These are algorithm implementation details presented as user information. A designer does not need to know the penalty weights. What they need to know is: "you have N accessibility issues. Fixing them would raise your score by X points." Action-framing versus formula-display.

**"In development" badge in GovernancePanel**
Rules with `status: 'planned'` show an "In development" badge. This is accurate but it means a user browsing the rule list sees 30+ rules that do nothing yet. This creates cognitive overhead ("should I configure this? Will it affect me?") for rules that are not active. Consider hiding planned rules behind an "Also coming" expansion link.

---

## 6. Opportunities

### OPP-GOV-01: Unify the violation discovery path
**Scope:** ShieldOverlay, GovernanceOverlay, GovernanceDashboard, canvasStore
**Complexity:** Moderate
**What:** When a user clicks a violation badge on the canvas, switch the right panel to the Health tab (not Properties) and scroll GovernanceDashboard to the affected node's violations. This makes the badge the entry point to the full governance view, not a dead end at Properties. The ViolationTooltip on hover remains the "quick read" and badge click becomes "I want to act."

### OPP-GOV-02: Add "Override" and "Defer" actions to violation rows
**Scope:** GovernanceOverlay, ViolationTooltip, possibly a new SnoozeStore
**Complexity:** Moderate
**What:** Each violation row in GovernanceOverlay should have three actions: Auto-Fix (existing), Override (disable this rule for this file), and Defer (suppress this violation until next audit). Override writes a rule override to governanceStore. Defer marks the violation as acknowledged in a local store (not the governance config). Both reduce the "fix or ignore" binary that currently makes every violation feel like an interruption.

### OPP-GOV-03: Fix the ExportModal "Fix" button
**Scope:** ExportModal.tsx
**Complexity:** Contained
**What:** The "Fix" button for auto-fixable violations should execute `editorStore.applyBatch([{ op: 'applyTokenFix', ... }])` inline, the same way GovernanceOverlay does. It should then re-evaluate `canExport` without closing the modal, so the user can apply multiple fixes in sequence and see the export gate clear in real time. If the fix cannot be applied inline, the button should be labeled "Navigate to fix" not "Fix."

### OPP-GOV-04: Add "Fix All Fixable" action
**Scope:** GovernanceOverlay, ExportModal
**Complexity:** Contained
**What:** When there are 2+ auto-fixable violations, show a "Fix All (N)" button at the top of the violation list that calls `editorStore.applyBatch` with all fixable tokens in one transaction. Uses the existing batch mutation infrastructure — this is a UI addition, not an architectural change.

### OPP-GOV-05: Add fix action to GhostOverlay
**Scope:** GhostOverlay.tsx
**Complexity:** Contained
**What:** Each entry in GhostOverlay that has a `suggestion` should have an "Apply" button that calls `editorStore.applyBatch` with the token replacement. GhostOverlay already computes the `hardcoded` class and `suggestion` token — it just never passes them to an action. This closes the read/write gap in the most immediate violation surface.

### OPP-GOV-06: Rename user-facing copy to remove internal jargon
**Scope:** StatusBar, ExportModal, GovernanceDashboard, ViolationTooltip, GovernanceOverlay
**Complexity:** Trivial (copy changes only)
**What:** Replace "Mithril Violations" with "Design Drift Issues." Replace "ΔE N.N" with "Color is N.N off spec from token X" (with ΔE in a tooltip for power users). Replace "Overrides Active" (StatusBar) with "Manual Overrides Active." Replace "Delta Mode" with "New Issues Only." Replace penalty breakdown labels with action-framing ("Fixing these accessibility issues would unlock export").

### OPP-GOV-07: Health score zero-state for no design system
**Scope:** GovernanceDashboard.tsx
**Complexity:** Contained (OPP-5 from UX-OPPORTUNITIES.md — formally track here)
**What:** When `tokenStore.tokens.length === 0`, replace the 100/A score hero with an "Unavailable" state: "Governance score requires a design system. No tokens are loaded — connect Figma or import tokens to start measuring." This is the most important correctness fix in the health surface.

### OPP-GOV-08: Explain the Rules / Packs / Profiles relationship
**Scope:** GovernancePanel.tsx (tab bar + tab descriptions)
**Complexity:** Trivial
**What:** Add a one-line subtitle under each tab header:
- Rules: "Individual rule overrides for the active project"
- Rule Packs: "Bundles of rules by domain — enabling a pack activates its rules"
- Profiles: "Compliance frameworks (WCAG, GDPR) — enabling a profile activates its rule pack"
A connecting sentence in the Profiles tab: "Changes here activate the corresponding Rule Pack above." This makes the three-level hierarchy legible without a documentation visit.

### OPP-GOV-09: Add rule descriptions to GovernancePanel rule rows
**Scope:** GovernancePanel.tsx (RuleRow component), governanceRulesManifest.ts
**Complexity:** Contained
**What:** Add a `description` field to the `GovernanceRule` type in the manifest. Each rule row in GovernancePanel should show a one-line description on hover or always-visible for expanded rows. "MITHRIL-COL-001: Color Drift — flags color values that differ from your design tokens by more than ΔE 2.0. Prevents brand drift from hardcoded hex values." This is the critical piece of information a user needs to make an informed configuration decision.

### OPP-GOV-10: Distinguish the two types of "overrides" in all copy
**Scope:** StatusBar.tsx, GovernanceDashboard.tsx, ExportModal.tsx
**Complexity:** Trivial (copy + minor conditional logic)
**What:** "Overrides Active" in StatusBar means property overrides (export-blocking manual style changes). Rename to "Unapplied Style Changes" or "Manual Style Overrides." GovernanceDashboard "Active Overrides" count (which is a rule configuration badge) should use different language: "Rule customizations active" with a tooltip explaining they do not block export. This eliminates the most confusing naming collision in the product.

### OPP-GOV-11: Connect ActivityFeed entries to governance state changes
**Scope:** ActivityFeed.tsx, GovernanceDashboard.tsx
**Complexity:** Moderate
**What:** When an agent action (flint_ast_mutate, generate_component, etc.) is logged in ActivityFeed, annotate the governance score at the time of that action. Show a "Before: 85/B → After: 70/C" delta in the ActivityFeed row for mutations that changed governance state. This creates the causal link between agent action and governance outcome that currently does not exist.

### OPP-GOV-12: Add badge click → right tab switch to Health (not Properties)
**Scope:** ShieldOverlay.tsx (badge onClick handler)
**Complexity:** Trivial
**What:** Change the badge onClick in ShieldOverlay from `setRightTab('properties')` to `setRightTab('health')`. This single line change converts the most prominent governance affordance from a dead end into the correct destination. A more complete version (OPP-GOV-01) would also scroll to the relevant violation in the health view, but even this minimal change is a significant improvement.

### OPP-GOV-13: Surface GovernancePanel entry point from violation surfaces
**Scope:** GovernanceOverlay.tsx, ViolationTooltip.tsx
**Complexity:** Contained
**What:** Add a visible "Configure rules" text link at the bottom of GovernanceOverlay (not just a 10px gear icon per row) and a "Manage rules" link in ViolationTooltip's footer. These links open GovernancePanel. The existing `onConfigureRule` prop mechanism is correct but the affordance needs to be more prominent and discoverable.

---

## 7. Recommended Priority Order

**Fix immediately (correctness failures — the product is lying or breaking):**
1. OPP-GOV-07 — Health score zero-state (score of 100 on zero-token project is incorrect behavior)
2. OPP-GOV-03 — Fix the "Fix" button in ExportModal (the button that says Fix should fix)
3. OPP-GOV-12 — Badge click should go to Health tab (most prominent affordance leads to wrong place)

**Fix next (workflow blockers — users cannot complete basic governance tasks):**
4. OPP-GOV-04 — "Fix All" action (40+ clicks to fix a typical imported component)
5. OPP-GOV-05 — GhostOverlay fix action (read-only surface when action is available)
6. OPP-GOV-02 — Override / Defer actions on violation rows (binary fix-or-ignore model)
7. OPP-GOV-10 — Distinguish the two override concepts in copy (same word, different meanings)

**Fix after (comprehension gaps — users understand less than they should):**
8. OPP-GOV-06 — Rename jargon throughout (Mithril → Design Drift, ΔE framing)
9. OPP-GOV-08 — Explain Rules/Packs/Profiles relationship
10. OPP-GOV-09 — Add rule descriptions to GovernancePanel rows
11. OPP-GOV-13 — Surface GovernancePanel entry point from violation rows

**Fix in a structured sprint (architectural — requires design thinking):**
12. OPP-GOV-01 — Unify violation discovery path (requires deciding which surface is authoritative)
13. OPP-GOV-11 — Connect ActivityFeed to governance state changes

---

## Appendix: Files Reviewed

- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/GovernanceOverlay.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/GhostOverlay.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/ViolationTooltip.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/ShieldOverlay.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/StatusBar.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernancePanel.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernanceDashboard.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/RuleCatalogPanel.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/ComplianceProfileSelector.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/PolicySettings.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/ExportModal.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/ActivityFeed.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/store/canvasStore.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/store/governanceStore.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/plans/UX-OPPORTUNITIES.md`
