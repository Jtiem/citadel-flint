# Wave 4 UX Review: Accessibility + Visual Hierarchy

**Reviewer:** UX Reviewer 1 (Accessibility + Visual Hierarchy Specialist)
**Date:** 2026-04-03
**Scope:** 9 surfaces post-fix audit
**Overall Grade: B+**

## Verdict

Solid improvement from Wave 3. The targeted fixes (role split, focus management, semantic corrections) are implemented correctly. One systemic gap — missing focus-visible indicators across all surfaces — prevents an A-range grade. This is a WCAG 2.4.7 failure that affects every keyboard user.

## Surface-by-Surface Assessment

| Surface | Grade | Key Finding |
|---------|-------|-------------|
| NotificationCenter | A | `role="alert"` vs `role="status"` split is textbook correct. Dismiss button `p-2` meets 2.5.5. No remaining issues. |
| StatusBar | B- | Dynamic `aria-label` on Export Gate and violation chip is correct. Three undersized tap targets at `p-0.5`. Five animation instances lack `motion-safe:` guard. Zero `focus-visible` on any button. |
| GovernanceDashboard | B+ | Sparkline hex-to-CSS-var fix respects Commandment 2. `<details>` collapse for Developer Controls is good progressive disclosure. 121 ARIA attributes present. Zero `focus-visible` on 30+ interactive elements. |
| FigmaConnectionPanel | B | Close button `aria-label="Close Figma panel"` is correct. Status dot accompanied by text label (good, not color-only). Close button at `p-1` is ~20×20px, below 2.5.5 minimum. Zero `focus-visible`. |
| OnboardingOverlay | A- | `firstFocusRef` on heading is the correct WCAG 2.4.3 pattern. `focus:outline-none` on the heading is appropriate (receives programmatic focus, not user-initiated). Missing FocusTrap — Tab can escape dialog. |
| DemoWalkthrough | A | `role="list"` with `aria-current="step"` is semantically correct. `motion-safe:transition-*` guards present. Focus moves to heading on step change. Solid implementation. |
| TokenPanel | B+ | Import modal `role="alert"` on error paragraph is correct. Form labels use `htmlFor`. Store-level error (line 642) missing `role="alert"` — screen readers will not announce it. |
| ExportModal | B+ | FocusTrap wraps dialog correctly. `aria-labelledby="export-modal-title"` is proper. Progress indicator with numeric context is accessible. Zero `focus-visible` on buttons. |
| useContextSync | A | No UI surface. Pure data hook. Single error toast with fire-once guard is clean behavior. No accessibility concerns. |

## Fix Verification

All claimed fixes verified in source:

| Fix | Status | Notes |
|-----|--------|-------|
| NotificationCenter `role="alert"` / `role="status"` split | CORRECT | Lines 107-113: critical/error use `role="alert"`, info/success/warning use `role="status"`. `aria-live` values match correctly (assertive vs polite). |
| NotificationCenter dismiss `p-2` | CORRECT | Line 155: `p-2` = 32px total, exceeds 24px minimum. |
| StatusBar dynamic `aria-label` on Export Gate | CORRECT | Lines 519-525: label dynamically computes violation count and communicates blocked state. |
| StatusBar dynamic `aria-label` on violation chip | CORRECT | Line 600: label includes count and directs to governance dashboard. |
| FigmaConnectionPanel close button `aria-label` | CORRECT | Line 169: `aria-label="Close Figma panel"`. |
| OnboardingOverlay `firstFocusRef` on heading | CORRECT | Lines 62, 73-76, 151-155: ref on `<h2>`, focus called when visible, `tabIndex={-1}` for programmatic focus. |
| DemoWalkthrough `role="list"` | CORRECT | Lines 274-289: `role="list"` with `role="listitem"` children, `aria-current="step"` on active dot. |
| TokenPanel `role="alert"` on error | PARTIALLY CORRECT | Line 225: import modal error has `role="alert"`. Line 642: store-level error does not. |
| GovernanceDashboard sparkline CSS vars | CORRECT | Lines 359-372: `SPARKLINE_TREND_CLASS` uses Tailwind tokens, `SPARKLINE_STROKE_COLOR` uses `var(--color-*)` with hex fallbacks. |
| GovernanceDashboard `<details>` for Developer Controls | CORRECT | Lines 2549-2561: native `<details>` element with `<summary>`. Collapsed by default. Designer zone is not obscured. |

## Remaining Gaps (Prioritized)

### P0 — Must Fix

**1. Focus visibility is absent across all interactive surfaces.**
Not a single `<button>` in the reviewed code uses `focus-visible:ring-*` or any visible focus indicator. This is a WCAG 2.4.7 (Focus Visible) Level AA failure. Keyboard users cannot see which element has focus.

Affected surfaces and approximate button counts:
- StatusBar: 15+ buttons
- GovernanceDashboard: 30+ buttons
- ExportModal: 10+ buttons
- FigmaConnectionPanel: 8 buttons
- TokenPanel: 5+ buttons
- OnboardingOverlay: 3 buttons
- DemoWalkthrough: 2 buttons

The irony: GovernanceDashboard line 275 tells users to add `focus-visible:ring-2 focus-visible:ring-indigo-500` to their code. Flint should practice what it preaches.

Recommendation: Add `focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900` globally via Tailwind base styles or a shared component, then apply to all interactive elements.

### P1 — Should Fix

**2. Undersized tap targets in StatusBar and FigmaConnectionPanel.**
- FigmaConnectionPanel close button (line 168): `p-1` — approximately 20×20px. Change to `p-2`.
- StatusBar reconnection banner dismiss (line 497): `p-0.5` with 12px icon — approximately 14×14px.
- StatusBar Figma popover close (line 638): `p-0.5` with 12px icon — approximately 14×14px.
- StatusBar beta close (line 1030): `p-0.5` with icon — approximately 14×14px.

WCAG 2.5.5 (Target Size) requires minimum 24×24px. NotificationCenter was correctly fixed to `p-2`; same treatment needed here.

**3. StatusBar animations lack `prefers-reduced-motion` guard.**
Five animation instances with no `motion-safe:` prefix:
- Line 625: `animate-ping` on Figma sync dot
- Line 808: `animate-pulse` on MCP connecting state
- Line 920: `animate-pulse` on autopilot dot
- Line 958: `animate-pulse` on update download icon

DemoWalkthrough correctly uses `motion-safe:transition-*`. StatusBar should follow with `motion-safe:animate-ping` and `motion-safe:animate-pulse`. WCAG 2.3.3.

**4. TokenPanel store-level error missing `role="alert"`.**
Line 642: Error paragraph in the main panel body has no `role="alert"`, unlike the correctly annotated import modal error on line 225.

### P2 — Polish

**5. FigmaConnectionPanel Token Health grid uses color-only coding.**
Lines 311-329: Synced/Drifted/Orphaned differentiated only by color. Label text accompanies each (partially sufficient). Adding a small status icon per card would fully satisfy WCAG 1.4.1.

**6. OnboardingOverlay missing FocusTrap.**
`role="dialog" aria-modal="true"` present but no FocusTrap wrapper. Tab can escape into the backdrop. FocusTrap is already used by ExportModal and TokenPanel's ImportModal — use the same pattern here.

**7. GovernanceDashboard `details-open:` variant.**
Lines 2551-2552 use `details-open:hidden` / `hidden details-open:block` for chevron toggling. Requires Tailwind v4's `details-open:` variant. Project targets v4 — low risk, but worth a manual test.

## What Hits A+ Quality

- **NotificationCenter** — No further action needed. Role split, tap targets, severity mapping, auto-dismiss lifecycle all correct.
- **DemoWalkthrough** — Semantic markup, motion safety, focus management on step change, `aria-current` on progress dots. Gold standard for the codebase.
- **useContextSync** — Fire-once error toast guard prevents notification spam. Clean.

## 30-Second Clarity Test

**Mostly yes.** The onboarding overlay provides a 3-step tour. The StatusBar uses plain language. The GovernanceDashboard health score ring is immediately legible, with developer-facing controls correctly hidden behind a `<details>` collapse.

**One concern:** The StatusBar center zone can become dense when multiple indicators are active. On narrow windows, `overflow-hidden` and `truncate` may hide important governance context. A minimum-width test would be worthwhile.

## Conclusion

Wave 4 fixes addressed real accessibility problems and were implemented correctly. The remaining work is primarily mechanical: applying focus-visible indicators globally, fixing a handful of undersized tap targets, and gating animations behind `motion-safe`. These are not architectural problems — they are consistent application of patterns that already exist in the codebase.

**Grade: B+ — one systematic pass on focus-visible would move this to A-.**
