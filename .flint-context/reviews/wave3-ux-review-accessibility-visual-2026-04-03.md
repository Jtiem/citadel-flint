# Wave 3 UX Review — Accessibility + Visual Hierarchy
**Reviewer lens:** Accessibility (WCAG 2.1 AA) + Visual Hierarchy
**Date:** 2026-04-03
**Scope:** 11 Glass surfaces reviewed
**Core question:** Does each surface deliver clear, accessible, trustworthy value to a UX/UI designer whose job is to govern AI-generated code?

---

## Overall Grade: B

The codebase shows genuine effort on accessibility — aria labels, FocusTrap, live regions, and focus management are present and often correct. But the surfaces are inconsistent. A handful are close to A-quality. Several have gaps that would fail an accessibility audit run through Flint's own Warden rules if these were third-party components. The visual hierarchy is generally readable but suffers from scale inflation (too many `text-[10px]` strings), low-contrast body text throughout, and a color-only communication pattern for severity that appears in almost every surface.

A UX/UI designer who expects A+ quality from a governance product — one that literally catches these problems in other people's code — should expect better internal consistency.

---

## Surface-by-Surface Table

| Surface | Grade | Key Finding |
|---------|-------|-------------|
| GovernanceDashboard | B+ | Best-in-class a11y annotations; sparkline uses hardcoded hex; step counter aria-hidden loses progress from AT |
| ExportModal | B+ | FocusTrap present, aria-modal correct, progress bar missing role/aria-valuenow, color-only severity communication |
| OnboardingOverlay | B | Focus sent to dismiss (X) not the dialog heading; dots not navigable; no aria-live on step transitions |
| LaunchScreen | B+ | Excellent sr-only live region; health grade colors conveyed by color only; gradient brand text invisible to AT |
| StatusBar | B | Export Gate button has `title` only (no aria-label); violation count chip has no accessible label; Figma dot color-only; popover not a proper ARIA popover |
| NotificationCenter | C+ | `role="alert"` correct but `aria-live="polite"` contradicts it; no focus management; dismiss button 12×12px — below 44px tap target |
| CommandPalette | A- | Best keyboard interaction in the codebase; listbox role missing; selected item not announced to AT; category headers not group labels |
| TokenPanel | B- | Import modal is accessible; token type dots color-only; contrast audit section missing table/list semantics; search field has no accessible placeholder announcement |
| FigmaConnectionPanel | B- | Close button uses `&times;` HTML entity (not aria-labeled); status dot color-only; disconnect confirm lacks focus trap; sync buttons missing aria-disabled semantics |
| FigmaSetupWizard | B | Step indicators have no aria-current/aria-label; CopyField labels use `title` not `aria-label`; success auto-close gives no AT announcement |
| DemoWalkthrough | B+ | Focus management on step transitions is correct; `role="tablist"` on dots is wrong semantic; handoff step uses `aria-modal="false"` while rendering blocking overlay |

---

## Gaps List (Priority Ordered)

### P1 — WCAG Failures (Will fail a real audit)

**GAP-01: NotificationCenter — `role="alert"` + `aria-live="polite"` conflict**
File: `src/components/ui/NotificationCenter.tsx` line 107
`role="alert"` implies `aria-live="assertive"`. Setting `aria-live="polite"` on the same element causes screen reader behavior to be undefined across implementations. The alert may never be announced.
Fix: Remove `aria-live="polite"` from the element that has `role="alert"`, or change `role` to `status` if polite announcement is actually desired (non-critical toasts). Critical/error toasts should keep `role="alert"`.

**GAP-02: NotificationCenter — dismiss button is 12×12px (WCAG 2.5.5 Target Size)**
File: `NotificationCenter.tsx` line 145-151
`<X size={12} />` inside a button with `p-0.5` gives approximately 16×16px click area. WCAG 2.5.5 requires 44×44px. Even WCAG 2.5.8 (AA, v2.2) requires 24×24px minimum.
Fix: `className="ml-1 shrink-0 rounded p-2 text-zinc-600 ..."` — increase padding to achieve minimum 24px, ideally 44px.

**GAP-03: StatusBar — Export Gate button has no accessible label (WCAG 4.1.2)**
File: `src/components/editor/StatusBar.tsx` line 518
The Export Gate button uses only `title` for its accessible name. `title` is not reliably surfaced by screen readers and does not satisfy WCAG 4.1.2 Name, Role, Value.
Fix: Add `aria-label` that describes the current gate state: `aria-label={canExport ? 'Export ready — open export panel' : `Export blocked: ${gateLabel} — click to view issues`}`.

**GAP-04: StatusBar — violation count chip has no accessible text label**
File: `StatusBar.tsx` line 583-592
The violation count chip has `title="Click to view issues in the Governance tab"` but no `aria-label`. The `title` attribute is not reliably announced.
Fix: Add `aria-label={`${totalCount} governance issue${totalCount !== 1 ? 's' : ''} — click to view in Governance tab`}`.

**GAP-05: FigmaConnectionPanel — close button uses `&times;` with no aria-label**
File: `src/components/ui/FigmaConnectionPanel.tsx` line 164-169
The close button renders `&times;` (×) as its content. `&times;` is punctuation — it will be read as "times" or "multiplication sign" by screen readers.
Fix: Add `aria-label="Close Figma panel"` to the button (it has no label at all currently — no `aria-label` is present on this button, unlike most other close buttons in the codebase).

**GAP-06: GovernanceDashboard Sparkline — hardcoded hex colors**
File: `src/components/ui/GovernanceDashboard.tsx` line 368
```
const color = trend > 2 ? '#34d399' : trend < -2 ? '#f87171' : '#fbbf24'
```
This is a Mithril violation in Flint's own UI. Color drift introduced in the SVG sparkline uses raw hex values not from the token palette. Ironic for a governance product. The Sparkline is also not distinguishable by pattern, only by color — a WCAG 1.4.1 failure for users with color vision deficiency.
Fix: Use Tailwind token classes or CSS variables. Add a text alternative or pattern/direction annotation.

**GAP-07: OnboardingOverlay — focus sent to dismiss X, not the dialog heading (WCAG 2.4.3)**
File: `src/components/ui/OnboardingOverlay.tsx` line 134-143
`firstFocusRef` is attached to the close/dismiss button, not the dialog title. A screen reader user's first experience is being told "Skip onboarding" — they have not been introduced to what step they are on or what the dialog contains. The intent of WCAG 2.4.3 focus order is that focus enters a logical starting point.
Fix: Move `firstFocusRef` to the `<h2>` title element, or add a `<div>` with `tabIndex={-1}` that wraps the full card and receives initial focus after the heading is read.

**GAP-08: DemoWalkthrough — `role="tablist"` on step dots is incorrect semantics**
File: `src/components/ui/DemoWalkthrough.tsx` line 273
The progress dots use `role="tablist"` with `role="tab"` children. Tabs imply that clicking each one navigates to that step. These dots are display-only progress indicators, not navigation controls. `role="tablist"` will cause screen readers to announce "tab panel" behavior that does not exist.
Fix: Replace with `role="list"` and `role="listitem"` children. Use `aria-label="Step X of Y"` on the current dot and `aria-hidden="true"` on inactive dots, or use a single `aria-live` announcement for step transitions instead.

### P2 — Significant Gaps (Accessibility degraded, not failed)

**GAP-09: Color-only severity communication — systemic**
Surfaces affected: GovernanceDashboard, ExportModal, NotificationCenter, StatusBar, FigmaConnectionPanel, TokenPanel
Every severity indicator (critical/amber/advisory) uses color as the only differentiator. A user with deuteranopia or protanopia cannot distinguish emerald from amber, or amber from red, in many Tailwind configurations against a zinc-900 background.
Fix: Each severity state needs a secondary signal — either a unique icon, text label, pattern, or shape difference. Most surfaces already import severity icons but don't display them in the dot/badge contexts. Specifically: the `SEVERITY_DOT` color-only record in GovernanceDashboard has no shape or pattern equivalent. Every colored dot in StatusBar needs an accompanying icon or text label.

**GAP-10: ExportModal — progress bar has no ARIA semantics (WCAG 4.1.2)**
File: `src/components/ui/ExportModal.tsx` line 417-421
The audit progress bar (`<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">`) has no `role="progressbar"`, no `aria-valuenow`, no `aria-valuemin`, no `aria-valuemax`, and no `aria-label`. It is invisible to screen readers.
Fix:
```tsx
<div
  role="progressbar"
  aria-valuenow={Math.round((auditProgress.current / auditProgress.total) * 100)}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Pre-flight audit progress"
  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
  style={{ width: `${Math.round((auditProgress.current / auditProgress.total) * 100)}%` }}
/>
```

**GAP-11: CommandPalette — no listbox role, selected item not announced**
File: `src/components/ui/CommandPalette.tsx`
The command list is a `<div ref={listRef}>` with no ARIA list role. The selected item is tracked via `data-selected="true"` and a visual highlight, but there is no `aria-activedescendant` on the search input pointing to the selected item, and no `role="option"` on items. A keyboard user navigating with ArrowDown/ArrowUp receives no screen reader feedback about which command is selected.
Fix: Add `role="combobox"` and `aria-expanded` to the input, `role="listbox"` to the results container, `role="option"` to each item, `aria-selected="true"` on the selected item, and `aria-activedescendant={selectedItemId}` on the input.

**GAP-12: FigmaSetupWizard — step indicators have no accessible state (WCAG 1.3.1)**
File: `src/components/ui/FigmaSetupWizard.tsx` line 69-97
The `StepIndicator` component communicates step status (completed/current/upcoming) visually only through icon choice and color. No `aria-current`, `aria-label`, or visible text label differentiates the states. A screen reader user hears three identical "Check circle, Configure Figma plugin" sequences.
Fix: Add `aria-label={`Step ${index}: ${label} — ${status}`}` to the wrapper div, or add visually-hidden text for each status state.

**GAP-13: FigmaSetupWizard — success auto-close is silent to AT**
File: `FigmaSetupWizard.tsx` line 257-269
When the `success` step triggers, the wizard closes after 2 seconds. There is no `aria-live` region announcing "Figma connected" or "Wizard closing." The screen reader user is left mid-wizard with no feedback.
Fix: Add `aria-live="polite"` region that announces success before closing. Or delay close until user confirms.

**GAP-14: FigmaConnectionPanel — disconnect confirm has no focus trap**
File: `FigmaConnectionPanel.tsx` line 269-287
The inline disconnect confirmation (Cancel / Yes, disconnect buttons) appears without trapping focus. A keyboard user can tab out of the confirmation into the rest of the panel while the confirmation is active.
Fix: Wrap in `FocusTrap` or handle focus manually when `showDisconnectConfirm` is true.

**GAP-15: OnboardingOverlay — step transitions have no aria-live announcement**
File: `OnboardingOverlay.tsx`
When step changes, the new step title and body are rendered but there is no `aria-live` region announcing the transition. A screen reader user who has moved focus past the step counter will not know a new step has appeared.
Fix: Add an `aria-live="polite"` region that announces the step title on transition, or move focus to the heading on each step change (the DemoWalkthrough does this correctly — OnboardingOverlay should match).

**GAP-16: TokenPanel — ImportModal error state missing `role="alert"`**
File: `src/components/ui/TokenPanel.tsx` line 223-225
```tsx
{error && (
    <p className="rounded bg-red-900/30 px-2 py-1.5 text-[11px] text-red-400">
        {error}
    </p>
)}
```
The error paragraph has no `role="alert"` or `aria-live`. It appears silently for keyboard/AT users.
Fix: Add `role="alert"` to the error paragraph.

**GAP-17: StatusBar — Figma dot is color-only status communication**
File: `StatusBar.tsx` line 607-613
The Figma connection dot (emerald/amber/zinc) communicates three distinct states with color only. No text, icon, or pattern difference accompanies the color change. A colorblind user cannot determine connection health from this indicator.
This is especially notable because the label changes ("No design system" vs "Figma") — that part is good. But when it shows "Figma" in amber vs green states, the color carries the full meaning.
Fix: The amber state (stale, 24–72h) should display a different label from the emerald state. Current code: `figmaButtonLabel` is "Figma" for both amber and emerald. Change amber state to "Figma (stale)" or add a visible warning icon.

### P3 — Visual Hierarchy Gaps

**GAP-18: Pervasive `text-[10px]` usage — below readable minimum**
Surfaces affected: All 11 surfaces
Browser default is 16px. `text-[10px]` = 10px text. WCAG 1.4.4 requires text to be resizable to 200%. At 10px, 200% = 20px — which is what body text should be at 1x. 10px text is borderline unreadable at default browser zoom for users over 40, and routinely fails readability audits.
The most affected surfaces: GovernanceDashboard (category headers, timestamps), ExportModal (step numbers, descriptions), StatusBar (all chip labels), TokenPanel (health bar text, sync status).
Fix: Establish a floor of `text-xs` (12px) for any text the user must read. `text-[10px]` should be used only for decorative/ambient labels that users are not expected to act on — and even then, sparingly.

**GAP-19: LaunchScreen — gradient brand headline is invisible to AT**
File: `src/components/ui/LaunchScreen.tsx` line 306
```tsx
<h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
    {BRAND.product}
</h1>
```
`text-transparent` with `bg-clip-text` is a CSS gradient technique. The text renders visually but `color: transparent` causes some screen readers and high-contrast modes to lose the text entirely, depending on browser/OS combination. On Windows High Contrast Mode, the text disappears.
Fix: Ensure this passes WHCM by adding `@media (forced-colors: active) { color: ButtonText; }` or use a visually-hidden duplicate heading.

**GAP-20: GovernanceDashboard score ring — grade letter not surfaced separately**
File: `GovernanceDashboard.tsx` line 110-163
The `ScoreRing` SVG has `aria-label="Health score {score} out of 100"` — good. But the grade letter (A/B/C/D/F) rendered adjacent to the ring has no programmatic association to the ring's accessible label. A screen reader user hears "Health score 87 out of 100" but not "grade B." The grade is displayed as a separate text element but without any semantic grouping.
Fix: Include the grade in the `aria-label`: `aria-label={`Health score ${score} out of 100, grade ${grade}`}`.

**GAP-21: CommandPalette — category section headers not group labels**
File: `CommandPalette.tsx`
Commands are grouped by category with header labels. These headers are not programmatically associated with the commands beneath them — there are no `role="group"` + `aria-labelledby` pairs. A screen reader user navigating with arrow keys receives a flat undifferentiated list.
Fix: Wrap each category section in a `role="group"` with `aria-labelledby` pointing to the category heading element.

**GAP-22: FigmaConnectionPanel — Token Mapping section missing table/list semantics**
The four count figures (total/synced/drifted/orphaned) are rendered as adjacent `<div>` elements with no semantic structure. Screen readers cannot determine the relationship between the label and the value.
Fix: Use `<dl>/<dt>/<dd>` pattern (already correctly used in other parts of FigmaConnectionPanel for the Status section — apply the same pattern here).

**GAP-23: DemoWalkthrough handoff step — `aria-modal="false"` on visually blocking overlay**
File: `DemoWalkthrough.tsx` line 169
The handoff dialog uses `aria-modal="false"`. The overlay renders `fixed inset-0 z-50` which visually blocks all content, but `aria-modal="false"` tells AT that content behind the dialog is still accessible. This is inconsistent and potentially disorienting.
Fix: Either use `aria-modal="true"` (and add a proper FocusTrap), or redesign the handoff step as a non-blocking banner that genuinely allows content behind it to remain accessible.

---

## What Already Hits A+ in This Lens

The following are genuine best practices that should be recognized and preserved:

1. **ExportModal — `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and FocusTrap** — the modal foundation is correct and complete. This is a pattern the whole codebase should follow.

2. **LaunchScreen — `aria-live="polite"` screen-reader announcement for project open** — the `sr-only` live region at line 313-321 is exactly right. It announces the project name when opening without disrupting visual layout.

3. **DemoWalkthrough — focus management on step transitions** — moving focus to the heading on each step change is correct WCAG 2.4.3 behavior. This is one of the harder patterns to get right and it's done correctly here.

4. **GovernanceDashboard — SVG aria-label + aria-hidden on inner text** — the `ScoreRing` component correctly labels the SVG at the container level and hides the internal text element from AT with `aria-hidden="true"`. Textbook pattern.

5. **CommandPalette — Escape key close, ArrowUp/ArrowDown navigation, auto-focus on open** — the keyboard interaction model is complete and correct. This is the best keyboard-navigable surface in the codebase.

6. **OnboardingOverlay — `aria-label` on dialog with step context** — `aria-label="Onboarding: step {n} of {total}"` on the dialog root gives AT users immediate step context on focus entry. Good pattern.

7. **FigmaSetupWizard — `aria-label` on copy buttons with state feedback** — the `CopyField` component uses `aria-label={copied ? 'Copied!' : `Copy ${label}`}` which updates the label on state change — exactly correct for communicating copy confirmation to AT users.

8. **TokenPanel — `FocusTrap` in ImportModal + proper `role="dialog"` + `aria-labelledby`** — the import modal is the cleanest modal implementation in the reviewed set.

---

## Summary

The pattern of gaps is consistent: the engineering team has addressed structural accessibility (modals, focus traps, landmark regions) but has not addressed the semantic layer (ARIA roles, live region announcements, accessible names on interactive elements) or the visual layer (color-only communication, tap target sizes, text scale). These are the gaps that a WCAG 2.1 AA audit would surface.

For a product that sells WCAG compliance enforcement to its users, shipping Glass surfaces that fail WCAG 2.1 AA themselves is a credibility problem as much as a compliance problem.

The six P1 gaps (GAP-01 through GAP-08) should be treated as blocking defects, not backlog items.
