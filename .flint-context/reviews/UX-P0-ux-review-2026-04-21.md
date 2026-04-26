# UX Review — UX-P0 Trust Gap Fixes

**Phase:** UX-P0
**Reviewer:** flint-ux-critic
**Date:** 2026-04-21
**Round:** 1
**Verdict (derived):** FIX-FORWARD

## Scope Reviewed
- `src/hooks/useGovernanceCategories.ts` — T1.1 violation filter for disabled rules
- `src/components/ui/GovernancePanel.tsx` — T1.2 toggle-back clears override
- `src/components/editor/StatusBar.tsx` — T1.3 actionable gate label
- `src/components/ui/ResizeHandle.tsx` — T1.4 z-index fix for drag capture
- `src/App.tsx` — T1.5 history clear on demo load + "nothing to undo" toast

## Summary

The five fixes address real trust gaps and land in the right places. Toggle-back correctly collapses the override entry when returning to default (verified against `governanceStore.resetOverride`). The gate label is now actionable and the click target routes to the `governance` tab. Resize handle z-index puts the handle above the React Flow pane layer. Demo load now clears the history stack so undo can't rewind into pre-demo state, and the undo shortcut provides user-visible feedback when the stack is empty.

Findings below are narrow regressions and edge cases, not blockers. Verdict is FIX-FORWARD: none of these block ship, but several should be addressed in a fast follow.

---

## Answers to the Questions

**Q1 — Toggle-back behavior (T1.2):** Correct. The logic at `GovernancePanel.tsx:282-284` compares against both `defaultEnabled=true` AND either absent severity or severity equal to `rule.defaultSeverity`. A user who (a) set severity=warning, (b) disabled the rule, then (c) re-enables — `setOverride({enabled:true})` is called (not reset), preserving the severity override. "Modified" badge stays, which is correct: severity is still non-default. Re-enabling only clears the badge when no other drift remains.

**Q2 — StatusBar gate label (T1.3):** Meaningfully better. "N issues blocking export" communicates cause + consequence in one phrase and the tooltip ("View issues blocking export") closes the intent loop. Concern: the button has zero visual button-affordance beyond color — no border, no underline, no chevron. In the dense StatusBar context a designer may still read it as a passive label. See WARN-1.

**Q3 — Resize handle (T1.4):** The z-index fix correctly raises the handle above React Flow's pane. However, the handle is a 24px hit zone with a 1px visual bar — discoverability is low even when pointer events now reach it. Not a regression introduced here; noted as SUG-1.

**Q4 — "Nothing to undo" (T1.5):** Appropriate. The toast is 2s auto-dismiss, `severity:'info'`, and avoids silent-failure ambiguity when users hit Cmd+Z reflexively. Clearing the history stack on demo load is the right call — it prevents the class of bug where undo rewinds demo hydration into an inconsistent pre-demo state. See BLK/WARN — there's a subtle concern: the clear runs on *every* demo load including via `handleLoadDemo` after the user has been working. If a designer loaded a demo, worked on it, then loaded a different demo, they'd lose work-in-progress undo — but that's bounded because loading a new demo replaces the workspace anyway. Acceptable.

**Q5 — Missed edge cases:** See findings. Notable: the filter in `useGovernanceCategories.ts` is fail-open when `ruleId` is missing — appropriate, but chip counts (line 43-45) are computed from `allLinterWarnings` before the enabled filter is applied, so a designer who disables all rules in "design-system" still sees a non-zero chip count. See WARN-2.

---

## Findings

### WARN-1 — Gate label button has weak affordance
The actionable gate label is now semantically a button but visually identical to the prior label (color-only change on hover). In the StatusBar's dense mixed row of dots, pills, and labels, designers scanning for "what can I click" may not register this as interactive until they already hover it.
- Evidence: `src/components/editor/StatusBar.tsx:616-628` — no underline, no border, no chevron, no pointer-cursor-only hint (cursor class is applied via `cursor-pointer`).
- Proposed fix: add a subtle right-chevron (`ChevronRight` from lucide) or dotted underline when `!canExport`. Alternatively a faint `ring-1 ring-amber-500/20` on hover to signal clickability.
- Scope: one-file. Rationale: Journey "Fix a violation" depends on the designer noticing the entry point; affordance ambiguity raises friction at the exact moment they're already frustrated.

### WARN-2 — Category chip counts ignore the new rule-enabled filter
`useGovernanceCategories.ts` applies the `isRuleEnabled` filter to `visibleLinterWarnings`/`visibleA11yWarnings` but NOT to `chipCounts`. A designer who disables a rule still sees violations counted in the category chip even though the violations don't appear in the list.
- Evidence: `src/hooks/useGovernanceCategories.ts:43-51` (counts derived from `allLinterWarnings`/`allA11yWarnings` pre-filter) vs `src/hooks/useGovernanceCategories.ts:64-76` (lists post-filter via `isRuleEnabled`).
- Proposed fix: derive counts from `allLinterWarnings.filter(isRuleEnabled)` and `allA11yWarnings.filter(isRuleEnabled)` to keep chip numerics aligned with visible rows.
- Scope: one-file. Rationale: chip says "5", list shows "3" → designer concludes the filter is broken or governance is unreliable. Directly contradicts the trust intent of UX-P0.

### WARN-3 — StatusBar gate export count excludes overrides
`totalIssues = mithrilViolations.length + a11yViolationCount` omits override-only blocks. When overrides are the sole blocker, the label falls through to the generic `'Overrides blocking export'` branch — fine — but when both overrides AND violations exist, overrides are invisible in the count, potentially confusing a designer who resolves all N issues and still can't export.
- Evidence: `src/components/editor/StatusBar.tsx:317-326` — `totalIssues` sums only Mithril + a11y; `overridesExist` is used only for the else-branch.
- Proposed fix: append "+ overrides active" when both conditions hold, e.g. `"3 issues blocking export (plus overrides)"`.
- Scope: one-file. Rationale: preserves the "count matches remedy" contract the fix aims to establish.

### SUG-1 — Resize handle visual bar still sub-threshold
The 24px hit area fix resolves capture; the 1px bar remains barely visible until hover. For first-time users the panel boundary looks non-adjustable.
- Evidence: `src/components/ui/ResizeHandle.tsx:82-83` — `w-px` with `bg-transparent` by default, only `group-hover:bg-indigo-500/20` lights it up.
- Proposed fix: render the bar with a very low base opacity (e.g. `bg-zinc-700/20`) so it's hinted at rest, intensifying on hover.
- Scope: one-line. Rationale: progressive disclosure without a cold-start cost.

### SUG-2 — Demo handleLoadDemo doesn't guard if workspace has unsaved work
`handleLoadDemo` clears history unconditionally. A user in a working project who invokes "load demo" from the launch screen after having edits would lose undo, even though `hydrateWorkspace` replaces the tree anyway. Not a regression, but a confirm-before-destroy would be consistent with the "trust" theme.
- Evidence: `src/App.tsx:442-445`.
- Proposed fix: if `useHistoryStore.getState().canUndo`, show a confirm toast ("Load demo? Unsaved changes will be lost") before proceeding. Defer if out of scope.
- Scope: one-file. Rationale: nice-to-have; consistent with the undo-safety theme.

### SUG-3 — "Nothing to undo" toast may become noise on Cmd+Z held-down
Auto-dismiss is 2s. If a user holds Cmd+Z at an empty stack, each keydown repeats fires a new toast. React's notification queue caps at 5, but the visual thrash is distracting.
- Evidence: `src/App.tsx:610-622` — no debounce on repeat keydowns.
- Proposed fix: only push the "nothing to undo" toast if the last push was >500ms ago, or dedupe by `type:'undo'+title` in the notification store.
- Scope: one-file. Rationale: small polish; prevents the fix itself from creating a new friction point.

---

## Rubric

| Criterion | Result |
|---|---|
| Disabling a rule removes its violations from the list | pass |
| Chip counts stay in sync with visible violations | fail (WARN-2) |
| Toggle-back to default clears "modified" when no severity drift remains | pass |
| Toggle-back preserves override when severity is still non-default | pass |
| Gate label communicates cause + remedy | pass |
| Gate label is visibly interactive (has button affordance) | fail (WARN-1) |
| Gate count reflects all blockers (violations + overrides) | fail (WARN-3) |
| Resize handle captures pointer events reliably | pass |
| Undo after demo load does not rewind into pre-demo state | pass |
| Empty-stack Cmd+Z provides user-visible feedback | pass |
