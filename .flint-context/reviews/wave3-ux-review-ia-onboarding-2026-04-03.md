# Wave 3 UX Review: Information Architecture, Onboarding & Language
**Reviewer role:** IA + Onboarding + Language/Jargon specialist  
**Date:** 2026-04-03  
**Surfaces reviewed:** LaunchScreen, OnboardingOverlay, DemoWalkthrough, SetupWizard, CommandPalette, GovernanceDashboard, FigmaSetupWizard, FigmaConnectionPanel, TokenPanel, ExportModal, App.tsx (shell)  
**Core question:** Does each surface deliver clear, accessible, trustworthy value to a UX/UI designer whose job is to govern AI-generated code?

---

## Overall Grade: B+

The product has made real and recent progress. Language is mostly plain-English. Demo and onboarding flows are invitation-forward rather than gate-forward. Progressive disclosure is architecturally in place. The gaps holding this back from A-territory are concentrated in three areas: (1) the GovernanceDashboard carries too much state and too many features for a sidebar panel, producing cognitive overload before any violations have been explained; (2) jargon residue in TokenPanel and FigmaConnectionPanel signals developer-oriented design; and (3) the 30-second clarity test fails for a net-new user who opens a project — they arrive in the main shell with no immediate signal about what Flint found or what they should do first.

---

## Surface-by-Surface Table

| Surface | Grade | Key Finding |
|---------|-------|-------------|
| LaunchScreen | A- | Three-path model is clean. Health grades on recent projects are meaningful. Minor: "Audit a Folder" text-link reads as tertiary but is a primary workflow for some users. |
| OnboardingOverlay | B+ | 3-step tooltip is brief and plain-language. Gap: Step 3 body copy references ⌘K but that shortcut is not self-evident — user must know what ⌘K opens. |
| DemoWalkthrough | A- | Workspace orientation step (Step 0) with no close button is the right call. Handoff step is conversion-optimized correctly. Gap: tooltip repositioning can misplace cards off-screen on small monitors. |
| SetupWizard | A | Strongest onboarding surface in the codebase. Consent-first install, retry logic, skip-at-every-step. "Get Flint running in 2 minutes" headline sets an honest expectation. |
| CommandPalette | B+ | Raycast pattern is well-executed. Category labels are clear. Gap: "History" category label is ambiguous — it contains Git Time Machine and Mutation History which are very different operations. |
| GovernanceDashboard | C+ | Information-dense to the point of overload. More than 15 distinct state dimensions in a single sidebar panel. "Next step" coaching sentence is excellent. Critical gap: "Delta Mode", "Set Baseline", "Provenance", "Anomaly alerts", "Pending Mutations", "Sparkline" all appear simultaneously with no visual hierarchy separating the "health at a glance" view from deep governance controls. |
| FigmaSetupWizard | A- | 3-step indicator is well-labeled. Troubleshooting section is progressive disclosure done right. Gap: "Configure Figma plugin" step label does not explain *which* plugin — first-time users may not know there is a separate Figma plugin involved. |
| FigmaConnectionPanel | B | Functional and organized. Gap: "Drifted" and "Orphaned" token counts need plain-language tooltips visible without hover — designers will not know what "Orphaned" means on first encounter. Section header "Token Mapping" uses technical vocabulary; "Token Health" would be clearer. |
| TokenPanel | B- | Visual rendering (ColorGrid, SpacingRuler) is the right direction. Gap: the toolbar label reads "read-only" in parentheses after the count — this tells users what they *cannot* do but not *why* or *how to change that*. "Import Token File" button expects raw JSON — a non-trivial format requirement with no guidance in the empty state about where to get the file. |
| ExportModal | A- | "Export Gate — All Clear / Blocked / Critical Violations" verdicts are immediately scannable. "Unapplied Style Changes" is better than "Property Overrides". Gap: the DBOM download affordance (`dbom.json`) is unlabeled — a designer has no idea what a "Design Bill of Materials" is or why they would want one. |
| App.tsx (shell) | B | Progressive disclosure unlock logic is correct. Gap: when a project first opens and the governance tab is active by default, there is no empty-state copy guiding the user. If violations exist they appear immediately but without any orientation sentence ("Here is what Flint found"). If no violations exist, the health ring shows 100 but there is no celebration copy or next-step prompt in the shell-level layout to direct the user forward. |

---

## Gaps List (Priority Ordered)

### P0 — Breaks the critical first-session flow

**GAP-1: GovernanceDashboard has no "health at a glance" vs. "advanced controls" hierarchy**  
When a user opens a project, the governance tab shows simultaneously: the score ring, grade, sparkline, health signal, category chips, violation cards (each with expand/collapse, pin, flag, defer, inline diff, provenance), pending mutations, anomaly banner, delta mode controls, and audit log. There is no visual or information architecture separation between the summary view a designer needs in 5 seconds and the power-user features they may never touch. A designer trying to understand their project health must scroll past five distinct interaction zones before forming a mental model.  
**Fix:** Split the dashboard into two regions with a clear visual divider and label: (1) a fixed-height "Health Summary" zone (ring + grade + next-step sentence + category chips + Fix All button) and (2) a scrollable "Details" zone (violation cards, advanced controls). The summary zone should never scroll off screen. Advanced features (Delta Mode, Provenance, Pending Mutations, Anomaly Banner, Audit Log) should be collapsed behind a "Developer Controls" disclosure toggle, defaulting closed.

**GAP-2: No project-open orientation message when violations are present**  
When a project opens with violations, the governance tab renders the list immediately with no sentence that says "here is what Flint found in this project." The user arrives in the middle of a list without context. The `nextStep` coaching sentence is computed and displayed, but only at the bottom of the score ring section — not as a top-of-panel greeting.  
**Fix:** The first element inside the governance tab when violations exist should be an orientation line: "Flint found [N] issues in [filename]. [nextStep text]." This should appear above the score ring, not below it.

**GAP-3: TokenPanel empty state tells users nothing actionable**  
When tokens are not loaded, the health bar shows "No tokens loaded" and the list area shows a loading state or empty list with no guidance. A designer who arrives at the tokens tab without prior context has no idea how to load tokens (connect Figma? import a JSON file? run an MCP tool?).  
**Fix:** Replace the empty state with: "No design tokens yet. Connect Figma to pull your token library, or import a JSON file using the button above." Include a "Connect Figma" CTA that opens the FigmaSetupWizard.

### P1 — Degrades clarity for non-technical designers

**GAP-4: "Token Mapping" section header in FigmaConnectionPanel uses developer vocabulary**  
"Token Mapping" is a developer-oriented term. A designer reads "mapping" as a verb (the act of mapping), not as a status report. The section shows four counts: Total, Synced, Drifted, Orphaned. These four concepts are not introduced anywhere in the product before this panel.  
**Fix:** Rename the section header "Token Health". Add a two-line explanation at the top of the section: "These are your design tokens from Figma. 'Drifted' means the value has changed since last sync. 'Orphaned' means the token was removed from Figma but still exists locally."

**GAP-5: "Orphaned" token count has no in-panel explanation**  
The FigmaConnectionPanel shows an "Orphaned" count with only a tooltip (`title` attribute) that reads "removed from Figma" — visible only on hover, not accessible by touch or keyboard.  
**Fix:** Move the explanation text into the card body as visible micro-copy (the `p.text-[9px]` below "Orphaned" does this partially — but the text "removed from Figma" is too brief and only visible on hover via `title`). Make the explanation always-visible below the count at `text-[10px]`.

**GAP-6: CommandPalette "History" category contains conceptually unrelated commands**  
"Open Git Time Machine", "Undo Last Mutation", and "View Mutation History" are grouped under "History". The first two are recovery operations; the third is an audit trail. A designer searching for "undo" would find it under "History" which is counterintuitive.  
**Fix:** Rename the category to "Undo & History" or split into two categories: "Recovery" (Git Time Machine, Undo) and "Audit Trail" (Mutation History).

**GAP-7: OnboardingOverlay Step 3 references ⌘K without explaining what it opens**  
The disconnected-state body for Step 3 reads: "Run your first audit — click the Search icon (⌘K) in the header and choose 'Run audit on this file'." A first-time user does not know that ⌘K opens the Command Palette, or that there is a Command Palette. The icon reference "(⌘K)" will not match the icon they see unless they already know the shortcut.  
**Fix:** Rewrite to: "Open the command palette (⌘K) and choose 'Run Audit on Current File'. The command palette is available any time from the top toolbar."

**GAP-8: ExportModal DBOM download button is unexplained**  
The "Download DBOM" button appears in the export-cleared state with no explanation. "DBOM" is not a common acronym. A designer will not know whether clicking it is necessary, optional, or what they should do with the resulting file.  
**Fix:** Replace the button label with "Download Compliance Report (.json)" and add a one-line description: "A machine-readable record of all components, tokens, and governance decisions in this project."

**GAP-9: TokenPanel "read-only" parenthetical creates confusion without explanation**  
The toolbar shows `{N} tokens (read-only)` with a tooltip that says "Tokens are managed through your design tool or config files." This is hidden behind a `title` attribute. The `read-only` label creates friction — a designer may not understand why they cannot edit tokens directly in this panel.  
**Fix:** Remove the `(read-only)` label from the count line. Replace with a status badge: "Synced from Figma" (if Figma is connected) or "Imported" (if manually loaded). The explanation of read-only behavior belongs in a first-launch empty state, not as a parenthetical on every visit.

**GAP-10: FigmaSetupWizard step label "Configure Figma plugin" omits the noun "Flint"**  
The step indicator reads "2. Configure Figma plugin." A designer who has never heard of the Flint Figma plugin does not know which plugin is being referenced, or that they need to install it separately.  
**Fix:** Change the label to "Configure Flint plugin in Figma" and add a note in the step content body: "If you haven't installed the Flint plugin in Figma yet, search for 'Flint' in the Figma Community."

### P2 — Polish and consistency

**GAP-11: LaunchScreen "Audit a Folder" is visually underweighted relative to its role**  
"Audit a Folder" is positioned as a tertiary text-link below two primary buttons, but for returning developers who do not want a persistent workspace, this is the primary path. The current visual weight (text-only, `text-zinc-500`) signals "you probably don't want this."  
**Fix:** Elevate to a secondary button with a border (matching the "Open My Project" style) or move it inside the "Open My Project" card as a sub-option: "Open for governance only (no project setup)".

**GAP-12: GovernanceDashboard "Delta Mode" badge and controls have no onboarding tooltip**  
"Delta Mode" is a power feature. When a user first sees the badge or the "Set Baseline" button, there is no explanation of what a baseline is or why they would want one. The confirmation message ("Baseline set — 42 existing issues marked as known") is shown after the fact, not before.  
**Fix:** Add a `useOnboardingTooltip` tooltip that fires on first encounter with the Delta Mode controls: "Delta Mode lets you focus on new violations only. Set a baseline to mark existing issues as 'already known' so they don't distract you from new work."

**GAP-13: App.tsx shell governance tab default shows health ring with no context sentence when score is 100 and no violations exist**  
When a project opens clean (score 100, no violations), the GovernanceDashboard renders the score ring, grade A, and the nextStep sentence "Perfect score — your design system is fully in sync." This is good. However, there is no context about *what was checked* — a designer who opened a small file with 3 components might assume Flint checked the whole project.  
**Fix:** Below the "Perfect score" sentence, add: "Flint audited [filename] — [N] components, [N] design tokens." This grounds the result in what was actually evaluated.

**GAP-14: SetupWizard "done" step CTA "Start building" is misaligned with Flint's purpose**  
Flint is a governance tool, not a building tool. "Start building" implies code creation, which is not what Glass does (Glass is observability only). This contradicts the product identity.  
**Fix:** Change to "Open your project" or "View your canvas" — something that accurately describes the next action.

**GAP-15: Multiple surfaces use "⌘⇧G" as a keyboard shortcut hint (Autopilot) without any modal explanation of what Autopilot does**  
The CommandPalette and GovernanceDashboard surface "Enable Governance Autopilot" with shortcut `⌘⇧G` but Autopilot is never explained in any onboarding step. A designer who accidentally triggers it has no idea what changed.  
**Fix:** Add a one-line description next to every Autopilot UI surface: "Autopilot watches for violations while you work and fixes them automatically without prompts."

---

## What Already Hits A+ in This Lens

**SetupWizard consent model.** The wizard never auto-writes config files. Every action is user-initiated. The "Review the config above, then click 'Add to editor'" instruction is the clearest example of consent-first design in the whole codebase.

**ExportModal verdict headers.** "Export Gate — All Clear", "Export Gate — Blocked", "Export Gate — Critical Violations" are instantly scannable. The severity escalation into the header color (red for critical, amber for blocked) is correct information architecture — the verdict is the first thing you see.

**LaunchScreen health grades on recent projects.** Showing A/B/C/D/F grades next to project names in the recent-projects list is exactly the right signal density. A designer can assess project health without opening it.

**GovernanceDashboard "next step" coaching sentence.** The `nextStep` computed text ("Nearly perfect. 3 accessibility gaps remain — say 'fix it' in your IDE to clean up.") is well-written, context-aware, and actionable. This is the strongest piece of designer-facing copy in the whole product.

**DemoWalkthrough Step 0 blocking close button.** Preventing skip on the workspace orientation step is the right UX call. Users who close immediately in other products consistently report confusion about what the canvas is for. The single forward CTA "Let's go →" is invitation-forward, not gate-forward.

**FigmaSetupWizard troubleshooting section.** Progressive disclosure via collapsible "Troubleshooting" is the right pattern. The four help topics (server won't start, port fallback, connection expired, no tokens after sync) directly address the failure modes users actually hit. These are concrete and actionable — not generic "check your network connection" filler.

**OnboardingOverlay MCP-aware Step 3 body copy.** Detecting whether MCP is connected and showing different instructions (IDE chat path vs. ⌘K path) is thoughtful adaptation to context. This prevents a broken first-session experience for users who haven't yet connected their IDE.

---

*This review is independent. Grades were not adjusted for consensus. The GovernanceDashboard C+ reflects genuine IA overload that will degrade first-session clarity for non-technical designers regardless of the quality of individual features within it.*
