# Flint Glass — WCAG 2.1 AA Accessibility Review
**Date:** 2026-04-04
**Reviewer:** Flint Accessibility Agent
**Scope:** 12 key UI surfaces across the Glass Electron/React UI

---

## Grade: B−

Flint Glass has a solid accessibility foundation — better than most Electron apps of comparable complexity. FocusTrap is implemented and used consistently across modals. Screen-reader-relevant ARIA patterns (role=dialog, role=tablist/tab/tabpanel, role=switch) are correct in the surfaces that have them. Live regions for toasts are implemented with the right assertive/polite split. The violation indicator and score ring carry proper aria-label text.

However, several recurring issues prevent a higher grade. The most significant: a batch of `animate-spin` and `animate-pulse` usages that ignore `prefers-reduced-motion`. The project uses `motion-safe:` correctly in some places but inconsistently everywhere else. Additionally, touch target sizing is too small in several high-traffic areas, the live preview iframe has no accessible title, and the project overflow menu lacks keyboard accessibility.

---

## Summary Counts

| Category | Critical | Warning |
|----------|----------|---------|
| Motion / animation | 0 | 8 |
| Keyboard / focus | 2 | 3 |
| Screen reader / ARIA | 1 | 4 |
| Color contrast | 0 | 3 |
| Touch targets | 0 | 4 |
| Forms / labels | 1 | 1 |
| **Totals** | **4** | **23** |

---

## Critical Issues — Must Fix

These four issues each map to a WCAG 2.1 AA failure.

---

### C-1: Live preview iframe has no accessible title
**File:** `src/components/editor/LivePreview.tsx` (render section, line ~1300)
**WCAG:** 4.1.2 Name, Role, Value

The `<iframe>` element that hosts the preview has no `title` attribute. Screen readers will announce it as "unnamed frame" or read its URL, which provides zero context. This is a WCAG 4.1.2 failure.

**Fix:**
```tsx
<iframe
  ref={iframeRef}
  title={`Live preview — ${detectedFramework} component`}
  ...
/>
```

---

### C-2: Project overflow menu is not keyboard accessible
**File:** `src/App.tsx` lines ~974–994
**WCAG:** 2.1.1 Keyboard

The `#project-overflow-menu` div is a custom dropdown built from plain `<div>` and `<button>` elements. The menu opens/closes via mouse click on `#project-overflow-btn`, but there is no Escape key handler attached to the menu itself, no `aria-haspopup="menu"` on the trigger, no `role="menu"` on the container, no `role="menuitem"` on the items, and no arrow-key navigation within the menu. The menu closes only on an outside `mousedown` — a keyboard user has no way to close it without tabbing out of it.

**Fix:**
```tsx
// On the trigger button:
aria-haspopup="menu"
aria-expanded={showProjectMenu}
aria-controls="project-overflow-menu"

// On the menu div:
role="menu"

// On each item:
role="menuitem"

// Add an Escape handler inside the menu:
onKeyDown={(e) => { if (e.key === 'Escape') setShowProjectMenu(false) }}
```

---

### C-3: Command palette search input is missing an accessible label
**File:** `src/components/ui/CommandPalette.tsx` lines ~545–560
**WCAG:** 1.3.1 Info and Relationships / 4.1.2

The `<input>` inside the command palette has `placeholder="Search commands and components…"` but no `<label>`, no `aria-label`, and no `aria-labelledby`. The placeholder disappears as soon as the user types. Screen readers will announce this as an unlabelled input (WCAG 1.3.1 + 4.1.2 failure, which also maps to Flint's own rule A11Y-004).

**Fix:**
```tsx
<input
  ref={inputRef}
  type="text"
  aria-label="Search commands and components"
  placeholder="Search commands and components…"
  ...
/>
```

---

### C-4: Autopilot diff toggle buttons have no accessible name
**File:** `src/components/editor/LivePreview.tsx` lines ~1240–1256
**WCAG:** 4.1.2 Name, Role, Value

The "Original" and "Governed" toggle buttons inside the autopilot banner are plain `<button>` elements with only text labels. That is fine by itself, but the context of what they toggle is not communicated — a screen reader user hears "Original" and "Governed" with no understanding of what those states mean. These should carry a `role="group"` on their container and an `aria-label` that explains the context.

**Fix:**
```tsx
<div
  role="group"
  aria-label="Preview source toggle"
  className="flex shrink-0 items-center gap-2 ...">
  <button aria-pressed={!showGoverned} ...>Original</button>
  <button aria-pressed={showGoverned} ...>Governed</button>
```

---

## Warnings — Should Fix

### W-1 through W-8: `animate-spin` and `animate-pulse` without `motion-safe:`
**WCAG:** 2.3.3 Animation from Interactions (AAA), but also a strong 2.3.1 consideration

Several `animate-spin` usages do not use the `motion-safe:` prefix. The project already applies `motion-safe:` correctly in StatusBar (Figma dot ping, Autopilot pulse) and LaunchScreen (Loader2 spin). These omissions are inconsistent with that established pattern.

**Affected locations:**

| File | Line | Class | Element purpose |
|------|------|-------|-----------------|
| `src/App.tsx` | ~856 | `animate-spin` | Project loading overlay spinner |
| `src/App.tsx` | ~885 | `animate-pulse` | IPC status dot |
| `src/App.tsx` | ~905 | `animate-spin` | Global Audit button Loader2 |
| `src/App.tsx` | ~942 | `animate-pulse` | Save state dot |
| `src/components/ui/ExportModal.tsx` | ~379 | `animate-spin` | Pre-flight audit spinner |
| `src/components/ui/GovernanceDashboard.tsx` | ~159 | `animate-pulse` | Score ring pulse |
| `src/components/ui/ComponentPanel.tsx` | ~249 | `animate-spin` | Registry loading spinner |
| `src/components/ui/FigmaSetupWizard.tsx` | ~78 | `animate-pulse` | Connection pulse ring |

**Fix pattern** — replace `animate-spin` with `motion-safe:animate-spin` and `animate-pulse` with `motion-safe:animate-pulse` at each site above. Example from App.tsx line 856:
```tsx
// Before:
<div className="h-4 w-4 animate-spin rounded-full ..." />

// After:
<div className="h-4 w-4 motion-safe:animate-spin rounded-full ..." />
```

---

### W-9: Sparkline SVG has no role="presentation" fallback for browsers that don't support aria-label on svg
**File:** `src/components/ui/GovernanceDashboard.tsx` line ~424
**WCAG:** 1.1.1 Non-text Content

The `<svg>` sparkline uses `aria-label="Health trend"` without `role="img"`. Without `role="img"`, some screen readers (particularly JAWS) will not treat the aria-label as the accessible name. The ScoreRing above it (line 155) correctly adds `role="img"` — the Sparkline should match.

**Fix:**
```tsx
<svg
  width={w}
  height={h}
  role="img"
  aria-label="Health score trend — 7-day sparkline"
  ...>
```

---

### W-10: The canvas drag handle has no keyboard affordance
**File:** `src/components/editor/XYCanvas.tsx` line ~161
**WCAG:** 2.1.1 Keyboard

The `<div className="drag-handle ...">` in the LivePreviewNode chrome bar is a mouse-only drag affordance. Keyboard users cannot reposition the canvas node. XYFlow supports keyboard-based node positioning via arrow keys when a node is focused, but the custom drag handle `<div>` does not expose a `tabIndex` or any keyboard instructions.

**Fix:** Make the drag handle focusable and announce its purpose:
```tsx
<div
  className="drag-handle ..."
  tabIndex={0}
  role="button"
  aria-label="Drag to reposition preview panel"
  onKeyDown={(e) => {
    // XYFlow handles arrow key movement when the node is selected
    if (e.key === 'Enter' || e.key === ' ') e.currentTarget.focus()
  }}
>
```

---

### W-11: ViolationIndicator tooltip is mouse-only
**File:** `src/components/editor/XYCanvas.tsx` lines ~78–88
**WCAG:** 1.4.13 Content on Hover or Focus

The violation count dot's tooltip (`group-hover:opacity-100`) appears only on mouse hover. There is no keyboard/focus equivalent — a keyboard user who tabs to the canvas area cannot discover the violation count tooltip. The element is also a plain `<div>` with no keyboard interactivity, yet it conveys meaningful information (issue count and type).

**Fix:** Convert to a button with an aria-label that contains the label text, so keyboard users receive the information without needing the tooltip:
```tsx
<button
  type="button"
  className="group absolute right-3 -top-1.5 z-10"
  aria-label={`${count} design ${count !== 1 ? 'violations' : 'violation'} — click to view`}
  onClick={() => { /* open governance tab */ }}
>
```

---

### W-12: AnnotationBadge tooltip is mouse-only
**File:** `src/components/editor/XYCanvas.tsx` lines ~108–126
**WCAG:** 1.4.13 Content on Hover or Focus

Same pattern as the ViolationIndicator above. The annotation count badge tooltip is mouse-only. The count is meaningful — keyboard users should access it.

**Fix:** Same approach as W-11. Add an aria-label carrying the count, and either a `tabIndex={0}` or convert to a button.

---

### W-13: Left panel tab bar missing `aria-controls`
**File:** `src/App.tsx` lines ~1021–1044
**WCAG:** 4.1.2 Name, Role, Value

The left sidebar tab bar uses `role="tablist"` and `role="tab"` with `aria-selected` correctly. However, the tab buttons are missing `aria-controls` pointing to the tab panel id, and the tab panel content area is missing a corresponding `id` and `role="tabpanel"`. WCAG 4.1.2 requires the relationship between tabs and panels to be programmatically determinable.

**Fix:**
```tsx
// Each tab button:
<button
  role="tab"
  id={`left-tab-${tab}`}
  aria-selected={leftTab === tab}
  aria-controls={`left-tabpanel-${tab}`}
  ...
/>

// Tab content wrapper:
<div
  role="tabpanel"
  id={`left-tabpanel-${leftTab}`}
  aria-labelledby={`left-tab-${leftTab}`}
  className="min-h-0 flex-1 overflow-y-auto"
>
```

---

### W-14: Right panel tab bar missing `aria-controls` and `tabpanel` role
**File:** `src/App.tsx` lines ~1119–1173
**WCAG:** 4.1.2 Name, Role, Value

Same issue as W-13, for the right sidebar. The right panel tabs use `role="tab"` and `aria-selected` correctly, but omit `aria-controls` and the corresponding `role="tabpanel"` + `id` on the content area. The tablist itself also lacks an `aria-label`.

**Fix:** Mirror the pattern described in W-13, using `right-tab-${tab}` and `right-tabpanel-${tab}` as IDs. Add `aria-label="Right sidebar sections"` on the tablist div.

---

### W-15: StatusBar Figma popover lacks focus management
**File:** `src/components/editor/StatusBar.tsx` lines ~629–720
**WCAG:** 2.4.3 Focus Order

The Figma status popover opens on button click but does not move focus into the popover. A keyboard user who activates the button will find focus remains on the trigger, with the popover content behind it in the tab order. The popover closes on outside `mousedown` but not on Escape key (WCAG 2.1.1 requirement for non-modal overlays).

**Fix:**
```tsx
// When popover opens, move focus to the close button or first interactive element
useEffect(() => {
  if (popoverOpen) {
    // Focus the first interactive element in the popover
    popoverRef.current?.querySelector<HTMLElement>('button')?.focus()
  }
}, [popoverOpen])

// Add Escape key handler
useEffect(() => {
  if (!popoverOpen) return
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setPopoverOpen(false) }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [popoverOpen])
```

---

### W-16: Error display in LivePreview has no live region announcement
**File:** `src/components/editor/LivePreview.tsx` line ~1190
**WCAG:** 4.1.3 Status Messages

The transform error panel (`data-testid="transform-error"`) appears dynamically when code fails to compile. Screen readers will not announce this unless it is wrapped in a live region. A designer editing code who uses a screen reader will not know the preview failed.

**Fix:**
```tsx
<div
  data-testid="transform-error"
  role="alert"
  aria-live="assertive"
  className="shrink-0 border-b border-red-700/40 ..."
>
```

---

### W-17: "Show more / Show less" error toggle is missing an `aria-expanded` state
**File:** `src/components/editor/LivePreview.tsx` lines ~1215–1224
**WCAG:** 4.1.2 Name, Role, Value

The error message expand button uses text "Show more" / "Show less" but does not use `aria-expanded` to communicate the toggle state to screen readers.

**Fix:**
```tsx
<button
  type="button"
  aria-expanded={errorExpanded}
  aria-controls="error-message-body"
  ...
>
  {errorExpanded ? 'Show less' : 'Show more'}
</button>
```

---

### W-18: Color contrast — `text-zinc-500` on `bg-zinc-900`
**WCAG:** 1.4.3 Contrast (Minimum)

`text-zinc-500` is `#71717a`. On `bg-zinc-900` (`#18181b`), the contrast ratio is approximately **3.6:1**, which is below the 4.5:1 requirement for normal-weight text smaller than 18px (or 14px bold).

`text-zinc-500` is used extensively as the secondary text color across all panels — tab labels (inactive state), rule IDs in GovernancePanel, status chip labels in StatusBar, and timestamps in GovernanceDashboard.

**Affected files:** `src/App.tsx`, `src/components/ui/GovernancePanel.tsx`, `src/components/editor/StatusBar.tsx`, `src/components/ui/GovernanceDashboard.tsx`

**Fix:** Promote inactive secondary text to `text-zinc-400` (`#a1a1aa`, ~5.6:1 on zinc-900) where it is smaller than 18px or non-bold. Reserve `text-zinc-500` only for text that is 18px+ or bold 14px+.

---

### W-19: Color contrast — `text-[8px]` governance issue count badge
**File:** `src/App.tsx` line ~1149
**WCAG:** 1.4.3 Contrast (Minimum)

```tsx
<span className="rounded-full bg-red-500/20 px-1 text-[8px] font-medium text-red-400">
    {governanceIssueCount}
</span>
```

`text-[8px]` is 8px — far below the 14px/18px threshold where large-text contrast rules apply. At 8px this is tiny, and `text-red-400` (`#f87171`) on `bg-red-500/20` (approximately `#3f1515` at 20% opacity over zinc-900) achieves roughly 3.9:1. But at 8px the character size itself is a legibility problem independent of contrast ratio. This should be at minimum `text-[10px]` and preferably `text-xs` (12px).

**Fix:** Change `text-[8px]` to `text-[10px]` and verify the contrast renders at or above 4.5:1.

---

### W-20: Color contrast — `text-zinc-400` on `bg-zinc-800`
**WCAG:** 1.4.3 Contrast (Minimum)

`text-zinc-400` is `#a1a1aa`. On `bg-zinc-800` (`#27272a`), the contrast ratio is approximately **4.0:1**, marginally below the 4.5:1 AA threshold for normal text.

This combination appears in GovernanceDashboard rule labels, category sidebar buttons in GovernancePanel, and the CommandPalette category headings.

**Fix:** Use `text-zinc-300` (`#d4d4d8`) for body text on zinc-800 backgrounds — contrast approximately 7.2:1.

---

### W-21: Touch targets — header icon buttons are 28x28px or smaller
**File:** `src/App.tsx` lines ~952–960
**WCAG:** 2.5.5 Target Size (AA, 24x24 minimum per WCAG 2.2)

The Governance Rules button and Project Options button in the header use `px-2 py-1` which produces a hit area of approximately 28x26px. WCAG 2.5.5 (AA in WCAG 2.2) requires 24x24px minimum, which these just barely meet — but they are significantly below the recommended 44x44px. Given these are primary actions in the header, increasing them is worth doing.

**Fix:** Change `px-2 py-1` to `px-2 py-1.5` (adds 2px top+bottom) and consider `px-3` for slightly wider targets. This also improves visual balance.

---

### W-22: Touch targets — StatusBar chips are 20-22px tall
**File:** `src/components/editor/StatusBar.tsx` lines ~505–603
**WCAG:** 2.5.5 Target Size

The StatusBar export gate button and violation count chip use `py-[3px]` inherited from the footer height. The buttons themselves compute to approximately 20-22px tall. While this is a toolbar convention, the chips are interactive primary actions (clicking them navigates to the governance dashboard). At minimum they should be 24px.

**Fix:** Add explicit `min-h-[24px]` to the interactive StatusBar buttons, or increase the footer's `py-[3px]` to `py-1.5`.

---

### W-23: Touch targets — ResizeHandle is 12px wide
**File:** `src/components/ui/ResizeHandle.tsx` line ~99
**WCAG:** 2.5.5 Target Size

The resize handle has `w-3` (12px) hit area. WCAG 2.5.5 requires 24px minimum. The hit area here is the entire functional target — there is no adjacent spacing to compensate.

**Fix:** Increase the hit area to `w-6` (24px) while keeping the visual bar `w-px`:
```tsx
<div
  className="group relative z-30 flex shrink-0 w-6 cursor-col-resize items-center justify-center self-stretch bg-transparent pointer-events-auto"
>
  <div className="w-px h-full ..." />
</div>
```

---

### W-24: Touch targets — CategorySidebar buttons in GovernancePanel are short
**File:** `src/components/ui/GovernancePanel.tsx` line ~263
**WCAG:** 2.5.5 Target Size

The category filter buttons use `py-1.5` which is approximately 18-20px tall. Adding `min-h-[24px]` brings them to the minimum.

---

## Good Practices Already in Place

The following areas are well-implemented and should be maintained as-is.

**1. FocusTrap is used consistently on all blocking modals.** `src/components/ui/FocusTrap.tsx` is applied in ExportModal, GovernancePanel, SetupWizard, FigmaSetupWizard, and Command Palette. This is the most important focus management requirement for modal dialogs and it is done right.

**2. Modals use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.** ExportModal (line 364), GovernancePanel (line 452), CommandPalette (line 525), TokenManager, and others all follow the complete ARIA dialog pattern.

**3. The toast notification system has correct live region semantics.** `NotificationCenter.tsx` correctly uses `role="alert"` with `aria-live="assertive"` for critical/error toasts, and `role="status"` with `aria-live="polite"` for info/success/warning toasts. This is the right split and will work correctly with most screen readers.

**4. The GovernancePanel toggle switch uses `role="switch"` with `aria-checked`.** The `Toggle` component at line 102 is a textbook implementation of the ARIA switch pattern: `role="switch"`, `aria-checked={enabled}`, `aria-label`, and `focus-visible:ring-2` focus styling.

**5. The score ring SVG carries `role="img"` and `aria-label`.** `ScoreRing` at line 155 uses both attributes correctly, and the inner score text element adds `aria-hidden="true"` to prevent double-announcement. This is correct.

**6. The LaunchScreen has a polite live region for project-open announcements.** The `aria-live="polite"` span at line 313 correctly announces which project is opening, which is especially useful for users waiting for a slow disk operation.

**7. Escape key closes all modal surfaces.** ExportModal (line 348), GovernancePanel (line 335), and CommandPalette (line 436) all handle Escape. The Figma popover in StatusBar does not (see W-15).

**8. The GovernancePanel tab bar uses the full `role=tablist/tab/tabpanel/aria-controls` pattern.** Lines 491–570 implement this correctly, including `id` attributes on tabs and panels for programmatic association. This is the model the left and right sidebar tab bars (W-13, W-14) should follow.

**9. The collapse rails for left/right panels are keyboard-accessible.** Lines 1003–1013 and 1093–1103 in App.tsx use `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` with Enter/Space handlers. This is correctly done.

**10. Motion-safe is used correctly in several StatusBar animations.** The Figma dot ping, Autopilot pulse, and update download pulse all use `motion-safe:` prefix (StatusBar.tsx lines 624, 807, 922, 960). This pattern should be extended to the remaining `animate-*` usages listed in W-1 through W-8.

**11. Inline icons are consistently wrapped with `aria-hidden="true"`.** Lucide icons used purely as visual decoration (ShieldCheck, ShieldAlert, FileCode, etc.) carry `aria-hidden="true"` throughout StatusBar and GovernanceDashboard. This prevents screen readers from reading icon names like "shield check" in the middle of button labels.

**12. The `aria-hidden={isAnyModalOpen}` pattern on the main app wrapper.** App.tsx line 850 applies `aria-hidden` to the background content when any modal is open (GLASS.2.2). This prevents screen readers from reading content behind modal dialogs.

---

## Prioritized Fix List

| Priority | Issue | WCAG | File |
|----------|-------|------|------|
| P0 | C-1: iframe missing title | 4.1.2 | LivePreview.tsx |
| P0 | C-2: Project menu keyboard inaccessible | 2.1.1 | App.tsx |
| P0 | C-3: Command palette input unlabelled | 1.3.1 | CommandPalette.tsx |
| P0 | C-4: Autopilot toggle no accessible context | 4.1.2 | LivePreview.tsx |
| P1 | W-1 to W-8: animate-* without motion-safe | 2.3.3 | Multiple |
| P1 | W-13: Left tab bar missing aria-controls | 4.1.2 | App.tsx |
| P1 | W-14: Right tab bar missing aria-controls | 4.1.2 | App.tsx |
| P1 | W-15: Figma popover missing focus + Escape | 2.4.3 | StatusBar.tsx |
| P1 | W-16: Error panel needs role=alert | 4.1.3 | LivePreview.tsx |
| P2 | W-17: Error toggle missing aria-expanded | 4.1.2 | LivePreview.tsx |
| P2 | W-18: text-zinc-500 contrast 3.6:1 | 1.4.3 | Multiple |
| P2 | W-19: 8px badge text too small | 1.4.3 | App.tsx |
| P2 | W-20: text-zinc-400 on zinc-800 contrast 4.0:1 | 1.4.3 | Multiple |
| P2 | W-9: Sparkline missing role="img" | 1.1.1 | GovernanceDashboard.tsx |
| P3 | W-10: Drag handle not keyboard accessible | 2.1.1 | XYCanvas.tsx |
| P3 | W-11: ViolationIndicator tooltip mouse-only | 1.4.13 | XYCanvas.tsx |
| P3 | W-12: AnnotationBadge tooltip mouse-only | 1.4.13 | XYCanvas.tsx |
| P3 | W-21 to W-24: Touch target sizing | 2.5.5 | Multiple |

---

## Notes on Scope

This review covers the 12 Glass UI surfaces listed in the brief. It does not cover:

- The content rendered *inside* the LivePreview iframe (that is the user's code, not Flint's UI).
- PropertiesPanel, TokenManager, LayerTree, AssetsPanel, or other right-sidebar sub-panels not listed in scope.
- The VS Code extension or CLI output.
- The SetupWizard or FigmaSetupWizard in depth (briefly checked; they follow the modal dialog pattern correctly and use FocusTrap).

The four critical issues (C-1 through C-4) and the motion/animation warnings (W-1 through W-8) should be addressed before any public beta. The contrast warnings (W-18 through W-20) require measurement against actual rendered Tailwind values — the ratios above are based on the raw hex values from the Tailwind v4 default palette and should be confirmed in browser devtools.
