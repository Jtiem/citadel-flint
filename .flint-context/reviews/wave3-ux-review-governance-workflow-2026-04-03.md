# UX Review: Governance Workflow + Glass↔IDE Handshake
**Date:** 2026-04-03
**Reviewer lens:** Governance Value Delivery + Designer Workflow
**Scope:** GovernanceDashboard, ExportModal, FigmaConnectionPanel, FigmaSetupWizard, TokenPanel, StatusBar, AnnotationList, ComponentPanel, App.tsx shell, LivePreview (interaction behavior), useContextSync, preload.ts API surface

---

## Overall Grade: B+

This is a genuinely well-thought-out governance observability layer. The vocabulary is mostly designer-legible, the violation-to-fix path is real and works, and the export gate is meaningfully enforced. The implementation is substantially better than a first pass — the COUNSEL and MINT work especially show considered UX thinking.

The grade does not reach A because three systemic problems drag it down: (1) the governance dashboard is overloaded to the point of cognitive collapse when violations exist, (2) the Glass↔IDE chat handshake is invisible to the designer and offers no feedback when it breaks, and (3) the Figma→Governance→Export path has exactly one point of friction that blocks progress without telling the designer what to do next.

A product targeting A+ UX quality cannot have these gaps.

---

## Surface-by-Surface Table

| Surface | Grade | Key Finding |
|---------|-------|-------------|
| GovernanceDashboard | B | Rich and functionally correct. Collapses under its own weight when violations exist — too many simultaneous UI states, too many competing CTAs. The effort framing text is excellent; the sparkline and audit log are buried. |
| ExportModal | A- | The pre-flight audit, progress bar, and "what's next" success state are genuinely good UX. Two gaps: the blocked state explains what to fix but not which fix to do first; the "deferred" badge in the modal does not explain what deferral means to a first-time user. |
| FigmaConnectionPanel | B+ | Clean and functional. The Token Mapping grid (Total / Synced / Drifted / Orphaned) is exactly what a designer needs. The "Refresh" button is a maintenance escape hatch that designers will overuse because there is no push-based signal when a sync completes inside the panel itself. |
| FigmaSetupWizard | A- | Step indicator and auto-advance are excellent. The "I've configured the plugin" button is a trust ceremony that feels right. One gap: the error state says "restart Flint" but the designer cannot know if the port was the issue or the plugin itself. |
| TokenPanel | B | The visual token grid (ColorGrid, TypographySpecimen, SpacingRuler) is the right idea. The contrast audit section is powerful. The "(read-only)" label next to the count is confusing — if tokens are read-only, why is there an Import button? The read-only label needs a "managed by Figma" explanation. |
| StatusBar | A- | The three-zone layout, progressive disclosure of Autopilot, and the "No design system" amber state are all well-executed. The reconnect banner is a real improvement. One gap: when Glass loses IDE connection mid-session, the banner explains the symptom but not the consequence — designers may not understand that "lost connection" means auto-fix no longer works. |
| AnnotationList | B+ | Solid. Collapsed by default, opens when notes exist, inline add works. The annotation types (note / decision / approval / handoff) map well to real designer workflow. Gap: "Resolve" has no undo and no confirmation. One mis-click and a handoff annotation is gone. |
| ComponentPanel | B+ | Search, filter, and drag-to-insert work. The "Select an element first" toast when inserting without a target is correct. Gap: the Recipes section is collapsed by default and labeled only "Recipes (6)" — there is no preview of what the recipes are, so most designers will never open it. |
| App.tsx shell | B+ | The progressive tab unlock system (tokens tab unlocks on first token, components tab unlocks on first registry card) is thoughtful. The OPP-16 auto-switch logic (selection → Properties, deselect → Governance) is correct. Gap: the `governanceRuleFilter` guard in the auto-switch means that if a designer sets a filter and then clicks a different element, they stay on Governance even when they probably want Properties. The 3-second manual lock period is not enough for slow/careful users. |
| LivePreview (interaction) | A- | The hover outline (indigo 1px) matching Figma's selection affordance is a genuine quality moment. Mode switching between Design and Interact is clear. Gap: in Interact mode the designer has no indication that governance scoring is still happening in the background — the visual mode change removes the governance overlay without explaining that. |

---

## Priority-Ordered Gap List

### P0 — Blocking Designer Value

**GAP-1: GovernanceDashboard cognitive overload when violations exist**

When a file has mixed violations (Mithril + a11y + sync + overrides), the dashboard renders simultaneously: an export gate banner, an effort framing sentence, a delta mode banner (if active), an anomaly banner (if present), a score ring with sparkline, category chips, a "top rules" accordion, individual expandable violation cards each with Fix / Defer / Flag / "Preview diff" / "Copy snippet" affordances, a pending mutations section, an MCP activity log, an audit log tab, advanced insights, a session fix progress bar, and a baseline control strip.

This is not a dashboard — it is a stack of features that share a scroll container. A designer opening Governance for the first time sees a wall of amber and red and no clear entry point.

**Fix:** Apply a primary / secondary / tertiary hierarchy. The single most important thing at any moment is: "What is the one thing I should do right now?" Surface exactly one primary CTA at the top of the violation section (auto-fix all fixable, or "start with accessibility"). Move Audit Log, Sparkline, Session Progress, MCP Activity, Pending Mutations, and Advanced Insights to a collapsible "Details" section collapsed by default. The violation cards themselves are good — the problem is the surrounding density.

---

**GAP-2: No visible signal when Glass↔IDE handshake is degraded**

The context sync (`useContextSync`) fires every 200ms and writes `.flint/context.json`. If this write fails, or if the MCP server is not reading it, the designer has no way to know. The StatusBar MCP connection dot turns zinc when disconnected, but:

- There is no tooltip explaining what MCP connection means to a designer ("Your IDE chat can see your current file and violations")
- When disconnected, the fix prompts in GovernanceDashboard silently change from "say 'fix it' in your IDE" to "connect your editor to enable auto-fix" — but this change is subtle text, not a salient alert
- There is no way to test whether the handshake is actually working (no "Send test context" or "Show what your IDE can see" action)

**Fix:** See the dedicated Glass↔IDE Handshake section below for the full recommendation.

---

**GAP-3: Export blocked state does not prioritize the fix path**

When export is blocked and the designer opens ExportModal, the blocked section lists all violation categories in render order (Unapplied Style Changes, then Accessibility Issues, then Mithril violations). The order is not prioritized by fix effort. An auto-fixable Mithril violation appears below a manual-only a11y violation. A designer who can unblock export in 10 seconds by clicking "Fix" on a color drift may spend 5 minutes trying to understand the a11y violation listed above it.

**Fix:** Sort the blocked section by: (1) auto-fixable Mithril violations first (show "Fix" button, unblock with one click), (2) deferrable violations with clear effort labels, (3) manual violations requiring IDE action. Add a "Quickest path to export" summary line at the top: "2 auto-fixable issues — fix them now and export."

---

**GAP-4: TokenPanel "(read-only)" label creates confusion**

The toolbar shows the token count followed by "(read-only)" with no explanation. Immediately to the right is an Import button. The contradiction (read-only + import button) creates doubt. Designers assume "read-only" means the panel does not reflect their Figma changes, which makes them distrust the token values shown.

**Fix:** Replace "(read-only)" with "synced from Figma" when Figma is connected, or "imported" when tokens were manually imported. Reserve "(read-only)" as a developer concept — it does not communicate governance meaning to a designer.

---

### P1 — Friction in Core Workflow

**GAP-5: FigmaConnectionPanel has no push-based sync completion signal**

After a Pull from Figma completes, the panel shows a success toast and the history list updates — but the Token Mapping grid (Total/Synced/Drifted/Orphaned) only refreshes if `fetchTokenCounts()` is explicitly called after the sync. If the counts are stale, the designer sees "0 drifted" when there are actually drifted tokens.

**Fix:** Confirm that `fetchTokenCounts()` is called in the `!isError` branch after Pull completes. Reading the code, it is — but add a visual "Updated just now" timestamp on the Token Mapping section header so the designer trusts the counts are fresh.

---

**GAP-6: GovernanceDashboard "Run Audit" button purpose is unclear**

The header has a "Run Audit" button that calls `flint_audit` via MCP. The button is disabled when there is no active file or when MCP is not connected. There is no explanation of how "Run Audit" differs from the live linter already running. A designer who sees both a live violation list and a "Run Audit" button will wonder: are the violations I'm seeing already the audit result? Why do I need to run it again?

**Fix:** Add a tooltip or subtext: "Live linting runs continuously. Run Audit performs a deeper check and syncs results to your IDE." Make the button label context-aware: when violations are stale ("last audited Xm ago"), show "Refresh Audit" with a timestamp.

---

**GAP-7: Annotation "Resolve" has no confirmation and no undo**

An annotation of type "Handoff" or "Approval" represents a governance decision. Clicking "Resolve" deletes it with no confirmation and no undo path. The annotationStore's `resolveAnnotation` is permanent.

**Fix:** For annotation types `approval` and `handoff`, show a "Are you sure? This governance decision will be archived" confirmation. Add a 5-second undo toast for all annotation types after resolve.

---

**GAP-8: ComponentPanel Recipes section is effectively invisible**

The Recipes section is collapsed by default with the label "Recipes (6)". The description tooltip appears on hover of individual recipe buttons inside the collapsed section — which designers cannot see because they need to expand first. In user testing, most designers will never discover recipes exist.

**Fix:** Show one or two recipe preview chips below the collapsed header even in the closed state, with an "expand to see all" affordance. Or show a permanent "Try a recipe" CTA on the empty canvas state.

---

**GAP-9: Delta Mode (Set Baseline) has no designer-legible explanation at point-of-action**

The "Set Baseline" button appears in the dashboard header. The confirmation message after clicking says "Baseline set — X existing issues marked as known." This is technically correct but doesn't tell the designer _why_ they'd want to do this. A designer on a long-running project with 40 pre-existing violations has no signal that delta mode exists or would help them until they accidentally find the button.

**Fix:** When violation count exceeds a threshold (the code already does this at >10 with the auto-enable banner), surface the baseline explanation more prominently: "You have 40 existing violations. Set a baseline to track only new issues as the AI generates code." Make this a contextual coach mark, not just a banner.

---

**GAP-10: StatusBar Autopilot button has no explanation of consequence**

The Autopilot toggle in the StatusBar appears after the first violation is seen. Clicking it enables/disables autopilot governance. There is no tooltip, label expansion, or explanation of what autopilot does before the user toggles it. The `governedFixCount` counter in the StatusBar shows "N fixes" when autopilot has applied changes, but a designer may not know if those fixes were safe.

**Fix:** Add a one-sentence tooltip: "Autopilot automatically applies token fixes as you work. Review changes with Cmd+Shift+G." Show a "review last N changes" link in the GovernanceDashboard session section when autopilot has been active.

---

### P2 — Polish and Clarity

**GAP-11: GovernanceDashboard category chips ("Design System" / "Accessibility" / "Token Sync") show counts but not relative severity**

The chip counts show how many violations are in each category but not how many are blocking export. A designer may choose to address 15 "Design System" issues before seeing that the 2 "Accessibility" issues are the ones actually blocking export.

**Fix:** Add a small "blocks export" indicator next to the chip count for categories with export-blocking violations.

---

**GAP-12: ExportModal success state "next steps" are generic**

The "All Clear" success state shows: 1. Commit your changes, 2. Share with your team, 3. Deploy when ready. This is a generic workflow list that does not reflect the actual project context (e.g., what IDE is being used, whether there are pending tokens, whether it's a scratchpad project).

**Fix:** Make the next steps context-aware: if `pendingTokenCount > 0`, add "Review pending token changes in the Token panel first." If `activeFilePath` is a scratchpad, add "Save your project to a permanent location before committing."

---

**GAP-13: FigmaSetupWizard error state says "restart Flint" for all error conditions**

The error step shows "The Figma sync service is not running. Restart Flint to start it automatically." This is the correct fix for a port conflict but the wrong fix for a plugin misconfiguration. Designers who have already restarted Flint once and still see this error have no further guidance.

**Fix:** Add a "Try again" button to the error state that re-runs the status check without a full restart. Show the troubleshooting section expanded (not collapsed) in the error state.

---

**GAP-14: AnnotationList has no visual hierarchy between annotation types**

All annotation types (Note, Decision, Approval, Handoff) render with the same card structure and font weight. A governance "Approval" annotation carries more weight than a "Note" but looks identical at a glance.

**Fix:** Use visual weight to communicate annotation severity. Approval and Handoff annotations should have a border-left accent and slightly larger type badge. Note annotations should be visually lighter.

---

**GAP-15: No empty state for GovernanceDashboard when no file is active**

When Glass launches with no active file (initial state before opening a project), the GovernanceDashboard renders the "No design system" state (if tokenCount is 0) or an ambiguous empty state. There is no proactive guidance: "Open a file or select a component to see its governance health."

**Fix:** Show a centered empty state with a Layers icon, the text "No file open," and a CTA to open a file or create a new project.

---

## Glass↔IDE Handshake Assessment

### Current Architecture

Glass writes `.flint/context.json` via `useContextSync` every 200ms (debounced). The file contains: active file path, violation counts, health score, selected node, source excerpt, canvas mode, import summary, override count, and library selection. The MCP server reads this via `flint_get_context` / `flint://session-context`. The designer does nothing — it is fully automatic.

### What Works Well

- The debounce at 200ms is appropriate — not too aggressive, captures meaningful state changes.
- The context is rich: the `sourceExcerpt` (first 200 lines), `selectedNodeSummary`, and `violationSnapshot` give the IDE chat immediate context without requiring a tool call.
- The `mcpConnected` state gates the "say 'fix it' in your IDE" prompts so designers are not told to do something unavailable.
- `useIDEFileSync` keeps Glass's active file synchronized with the IDE's focus — this closes a major workflow gap.

### What Is Missing or Broken from a Designer's Perspective

**The handshake is invisible.** A designer using Flint Glass alongside Claude Code has no indication that the context channel is working. They cannot see what the IDE chat is receiving. There is no "Glass is synced to your IDE" confirmation state. The StatusBar shows an MCP connection dot but no indication of whether the context file is being read.

**The failure mode is silent.** If `syncContext` fails (e.g., filesystem permission issue, disk full), the hook silently swallows the error. The designer has no way to know their IDE chat is working from stale context. The chat response may reference violations that were already fixed 2 minutes ago.

**The context does not include what the designer just did.** The context snapshot is state-at-a-point-in-time. If a designer clicked "Fix" on 3 violations and the context fires at 200ms, the IDE chat may receive either the pre-fix or post-fix state depending on timing. There is no "action log" in the context (what fix was just applied, what was just deferred). The IDE agent may recommend fixing something the designer just fixed.

**The `healthScore` and `healthGrade` fields in the context are always null.** The code in `useContextSync.ts` sets `healthScore: null` and `healthGrade: null` unconditionally (line 198-199). The GovernanceDashboard computes these values correctly from `useGovernanceHealth` but they are never written back to the context file. When the IDE agent calls `flint_get_context`, it receives a violation count but no health score — it cannot tell the designer "you're at a B+ right now."

**No session narrative.** The context file captures instantaneous state but not the story of the session: "We started with 12 violations, fixed 8 via autopilot, 4 remain, all accessibility." An IDE agent asking `flint_get_context` at the start of the session and again 20 minutes later has no way to know what changed. `sessionPersona` is always null.

### What Would Make It Feel Truly Seamless

1. **A "sync status" indicator in Glass.** Show a small "Synced to IDE" chip in the StatusBar that turns amber if the last context write failed or is older than 2 seconds. This gives the designer confidence the channel is live.

2. **Write healthScore and healthGrade into the context.** The computation already exists. This is a one-line fix that would make `flint_get_context` significantly more useful to the IDE agent. Fix: replace `healthScore: null` with the computed `score` from `useGovernanceHealth`, and `healthGrade: null` with the computed `grade`.

3. **Include a `recentActions` field in the context.** A ring buffer of the last 5 actions taken in Glass (fix applied, violation deferred, baseline set, annotation added). This gives the IDE agent narrative context so it does not recommend something just done.

4. **Add a "What does my IDE see?" command to the Command Palette.** ⌘K → "Show IDE context" opens a read-only JSON view of the last-written context. Designers can verify the handshake is working and see what the AI assistant knows about their current state.

5. **Sync errors should surface in Glass.** The `syncContext` IPC call should push a notification (throttled to once per session) if the write fails: "Glass lost sync with your IDE chat. Violations may be stale in your editor." This is one line of error handling in `useContextSync`.

---

## What Already Hits A+ in This Lens

**GovernanceDashboard: effort framing sentence.** The `effortText` logic — "3 auto-fixable — Autopilot can resolve them in one click" — is exactly what a designer needs: a clear count of what is actionable vs. what needs input. This is the best sentence in the entire UI.

**GovernanceDashboard: fix guides with WCAG references.** The `A11Y_FIX_GUIDE` map with `why` sentences ("Screen readers announce images using alt text. Without it, the image is invisible to assistive tech users.") is the right level of designer education. Not too technical, not condescending.

**ExportModal: pre-flight progress bar.** Showing "Auditing 1 of 2 audit steps..." with a progress bar for a sub-second check is micro-UX gold. It tells the designer governance is running, not just loading.

**StatusBar: "No design system" amber state.** When `tokenCount === 0`, the Figma chip turns amber and says "No design system" instead of silently being inactive. This is exactly the right signal — it tells the designer that governance is not yet meaningful, not that something is broken.

**FigmaSetupWizard: contextual mode header.** `contextualMode && projectName` rendering "Setting up Figma for [Project Name]" instead of a generic header is a small detail that dramatically increases the sense that the wizard knows where the designer is.

**LivePreview: hover outline in Design mode.** The 1px indigo overlay with rAF-throttled positioning matching the Figma hover affordance is genuinely polished. This is A+ interaction design at the preview layer.

**GovernanceDashboard: MCP connection-aware fix prompts.** Changing "say 'fix it' in your IDE" to "connect your editor to enable auto-fix" when `mcpConnected === false` is correct, kind, and prevents a frustrating dead end. This is precisely the kind of contextual guidance that separates good from great.

**ExportModal: fixability sorting.** Rendering auto-fixable violations before manual violations within the Mithril section (line 685+) means the easiest path to export is always at the top of the list within each category. This is the right priority ordering.

---

*This review was conducted independently against the production source code. No other reviewer's findings were consulted before reaching these conclusions. Grades reflect UX quality from a designer's perspective against an A+ standard.*
