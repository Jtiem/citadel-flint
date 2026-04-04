# Wave 5 Code Review -- Code Quality

**Reviewer:** Reviewer 3 (Code Quality)
**Date:** 2026-04-03
**Verdict:** FIX (1 WARNING pattern repeated across 4 files, otherwise clean)

---

## Verification Results

```
TSC:   0 errors
Glass: 1879/1879 passing (99 test files, 0 failures)
```

No regressions detected.

---

## Per-File Findings

### `src/components/editor/StatusBar.tsx`

**CLEAN.** All `animate-ping` and `animate-pulse` usages are correctly prefixed with `motion-safe:` (lines 625, 808, 920, 958). Focus-visible rings are present on all interactive elements. No hardcoded hex colors. No process boundary violations.

Tap target fix (p-0.5 to p-2): confirmed on reconnect banner dismiss button (line 497) and Figma popover close (line 638).

### `src/components/ui/GovernanceDashboard.tsx`

**CLEAN.** Fix 6 (activeFilePath injection) reads from `canvasStore` using the correct Zustand selector pattern at line 491:
```
const activeFilePath = useCanvasStore((s) => s.activeFilePath)
```
This is done inside the component, not inside another store or an IPC call. Correct.

Fix 7 (zone divider label): line 1647 uses a ternary on `totalViolations > 0` to switch between "Issues to Resolve" and "Audit Results". Clean.

Fix 9 (zero-violation state): lines 825 and 1668-1671 inject `activeFileBasename` into effort text and the clean-state message. The basename is derived from `activeFilePath.split('/').pop()` with fallback -- correct and safe.

No hardcoded hex colors. No process boundary violations.

### `src/components/ui/TokenPanel.tsx`

**CLEAN.** Fix 4 (role="alert" on store-level error): line 653 has `role="alert"` on the error paragraph. Correct.

Fix 8 (figmaConnectedForBadge): lines 370-375 derive this from `window.flintAPI.figma.status()` in a `useEffect`, stored in local component state. This is the correct pattern -- IPC call in a component effect, not in a store. The badge renders at lines 500-504 with three states (synced/imported/no source). No hardcoded colors.

FocusTrap import at line 23: `import { FocusTrap } from './FocusTrap'` -- same local source as ExportModal, GovernancePanel, BetaFeedbackModal, and all other consumers. No new dependency.

Pre-existing `as any` cast at line 63 (`window.flintAPI as any`) has a comment explaining why ("getSyncSummary is wired by Agent C -- handle gracefully if not yet available"). This predates Wave 5 and is acceptable given the comment.

### `src/components/ui/OnboardingOverlay.tsx`

**CLEAN.** Fix 5 (FocusTrap): lines 133-190 wrap the tooltip card in `<FocusTrap>`. Import at line 20 from `'./FocusTrap'` -- same source as all other consumers.

Focus management: `firstFocusRef` is correctly attached to the `<h2>` heading (line 154) with `tabIndex={-1}`, and `focus()` is called on mount (line 76). This follows WCAG 2.4.3 correctly.

No hardcoded hex colors. No external URLs. No process boundary violations.

### `src/components/ui/CommandPalette.tsx`

**CLEAN.** Fix 10 (PaletteCommand interface): `description` field is typed as `description?: string` at line 45, making it optional and backward compatible. The field is rendered conditionally at line 650-652. Only one command uses it ("gov-autopilot" at line 244). No existing tests reference `PaletteCommand` directly, so no interface breakage.

No hardcoded hex colors. No external URLs. No process boundary violations.

### `src/components/ui/LaunchScreen.tsx`

Fix 11 ("Audit a Folder" elevated to secondary button): lines 528-543 render it as a `<button>` with border styling and `focus-visible:ring`. The `motion-safe:animate-spin` prefix on the loader (line 537) is correct.

No hardcoded hex colors. No external URLs. No process boundary violations.

---

## WARNING: focus-visible Applied to Non-Interactive Elements

**Severity:** WARNING (non-blocking, cosmetic no-op, but sloppy)

`focus-visible:ring-*` classes are applied to Lucide icon components (`<X>`, `<Download>`, `<RefreshCw>`, `<Unplug>`) and non-interactive `<div>` / `<span>` elements that will never receive keyboard focus. The classes are inert (they will never trigger) but they bloat the className string and signal that the author applied focus rings mechanically without checking whether the element is focusable.

**Occurrences found:**

| File | Line(s) | Element |
|------|---------|---------|
| `TokenPanel.tsx` | 184 | `<X className="... focus-visible:ring-*">` inside a button |
| `CommandPalette.tsx` | 563 | `<X className="... focus-visible:ring-*">` inside a button |
| `FigmaConnectionPanel.tsx` | 214, 267, 297 | `<Download>`, `<RefreshCw>`, `<Unplug>` icons inside buttons |
| `LaunchScreen.tsx` | 404-405 | `<div>` elements inside a `<button>` with focus-visible classes |
| `LaunchScreen.tsx` | 430, 450 | Icon wrapper `<div>` elements inside buttons |
| `LaunchScreen.tsx` | 582 | `<span>` inside a `<button>` |

**Fix:** Remove `focus-visible:ring-*` classes from non-interactive child elements. The parent `<button>` already has the ring -- the child SVG/div/span cannot independently receive focus.

---

## Commandment Compliance Table

| Commandment | Status | Notes |
|-------------|--------|-------|
| C2 -- No Hallucinated Styling | PASS | No hardcoded hex in className strings |
| C3 -- Fresh Parse | N/A | No AST mutations in these files |
| C4 -- Local-First Only | PASS | No external URLs introduced |
| C7 -- ID Preservation | N/A | No structural ops |
| C10 -- History Clear | N/A | No setCode calls |
| C12 -- Atomic Queuing | N/A | No file writes |
| C13 -- No Regex Surgery | N/A | No source code modification |
| C15 -- AST Catalog | N/A | No AI orchestrator changes |
| C16 -- TSC Loop | N/A | No AI output paths |
| Process Boundary | PASS | No `fs`/`path`/`sqlite` imports in `src/` (test files in `__tests__/` are exempt) |
| Store Architecture | PASS | `activeFilePath` read via selector in component, not cross-store |
| Mithril Safety | PASS | No hardcoded hex, no arbitrary spacing tokens |

---

## Summary

The Wave 5 mechanical fixes are structurally correct. TypeScript compiles cleanly. All 1879 tests pass with no regressions. The Zustand access pattern for `activeFilePath` in GovernanceDashboard is correct (selector in component). The `PaletteCommand.description` field is optional and backward compatible. FocusTrap is sourced from the same local module as all other consumers. The `figmaConnectedForBadge` state is derived from an IPC call in a component effect, which is the correct pattern.

The only issue is cosmetic: `focus-visible:ring-*` classes sprayed onto SVG icons and non-focusable child elements across 4 files. These are inert (no visual or functional impact) but should be cleaned up before this pattern propagates further. This is a WARNING, not a blocker.

**Verdict: FIX** -- clean up the non-interactive focus-visible classes, then this is ready to ship.
