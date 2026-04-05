# Glass UI Review -- UX Audit Burn-Down + Accessibility Sprint

**Reviewer:** Quality Gate (code review)
**Date:** 2026-04-04
**Scope:** 7 changed files, 3 test files
**TSC:** 0 errors
**Tests:** 1812/1812 passing (99 test files)

---

## Domain: Glass UI

| File | Rating | Issues |
|------|--------|--------|
| `src/components/editor/GhostCodeSnippet.tsx` | A | Clean. Opt-in pill pattern well executed. |
| `src/components/editor/LivePreview.tsx` | B+ | 1 dead import (WARNING) |
| `src/components/editor/StatusBar.tsx` | A | Clickable gate, contrast, focus/Escape all good. |
| `src/components/editor/XYCanvas.tsx` | A- | Pre-existing hex in MiniMap/Background (not new). |
| `src/components/ui/GovernanceDashboard.tsx` | A- | Pre-existing Sparkline hex (not new). Score section compacted well. |
| `src/components/ui/GovernancePanel.tsx` | A | Toggle resetOverride fix is correct and well-scoped. |
| `src/preview-vendor/flint-interaction.ts` | A | HIGHLIGHT_NODE handler + CSS correct. Hex in srcdoc CSS is expected. |

| Test File | Rating | Notes |
|-----------|--------|-------|
| `GhostCodeSnippet.test.tsx` | A | 12 tests, pill-first flow covered, Escape collapse verified. |
| `LivePreview.loading.test.tsx` | A | Quick Load removal verified, framework badge always-visible tested. |
| `StatusBar.test.tsx` | A | 29 tests, export gate click, popover focus, ordering all covered. |

---

## Commandment Compliance

| Commandment | Status | Notes |
|-------------|--------|-------|
| C3 (Fresh Parse) | PASS | No direct AST mutation found. |
| C4 (Local-First) | PASS | No external URLs introduced. HIGHLIGHT_NODE uses existing srcdoc pattern. |
| C7 (ID Preservation) | PASS | No structural ops in these changes. |
| C10 (History Clear) | PASS | No `setCode` calls on file switch added. Existing `handleHydroPaste` call is unchanged. |
| C12 (Atomic Queuing) | PASS | No file writes in these changes. |
| C13 (No Regex Surgery) | PASS | No `source.replace()` on code strings. |
| C15 (AST Catalog) | PASS | No AI ops in these changes. |
| C16 (TSC Loop) | PASS | No AI output paths in these changes. |

---

## Process Boundary Security

| Check | Status | Notes |
|-------|--------|-------|
| No Node.js APIs in `src/` | PASS | Only `fs`/`path` in `language-pass.test.ts` (test file, pre-existing). |
| No `@anthropic-ai/sdk` in `src/` | PASS | None found. |
| `window.flintAPI` types | PASS | No new IPC channels introduced. |
| CSP unchanged | PASS | No `index.html` changes. |
| No secrets | PASS | Clean. |

---

## State Architecture

| Check | Status | Notes |
|-------|--------|-------|
| No cross-store imports | PASS | No store files modified. Pre-existing `orchestratorStore` IPC calls are a known technical debt item, not introduced by this change. |
| No `window.flintAPI` in stores | N/A | No store changes. |
| Zustand selector pattern | PASS | All components use individual selectors. |

---

## Mithril Safety (Tailwind Tokens)

| Check | Status | Notes |
|-------|--------|-------|
| No hardcoded hex in className | PASS | All component-level styling uses Tailwind token classes. |
| No arbitrary spacing | PASS | No `p-[Npx]` or `mt-[Npx]` patterns found. |
| XYCanvas hex values | INFO | `#374151`, `#4f46e5`, `#111827`, `#1f2937` in MiniMap/Background props -- these are React Flow library configuration values, not className strings. Pre-existing, unchanged. |
| GovernanceDashboard Sparkline hex | INFO | `#34d399`, `#f87171`, `#fbbf24` in SVG stroke -- these are inline SVG attributes for the trend line. Pre-existing, unchanged by this diff. |
| flint-interaction.ts hex | PASS | Hex values are in srcdoc iframe CSS, which is the expected exception (srcdoc cannot use Tailwind token classes). |

---

## Accessibility

| Check | Status | Notes |
|-------|--------|-------|
| GhostCodeSnippet pill | PASS | `aria-label="View source code"` on pill button. |
| GhostCodeSnippet panel | PASS | `role="complementary"`, `aria-label` on panel, `aria-label` on dismiss, `role="separator"` on drag handle. |
| StatusBar export gate | PASS | Now a `<button>` with descriptive `title` attributes for both states. |
| XYCanvas ViolationIndicator | PASS | Changed from `<div>` to `<button>` with `aria-label`. |
| XYCanvas AnnotationBadge | PASS | Changed from `<div>` to `<button>` with `aria-label`. |
| GovernancePanel toggle | PASS | `role="switch"`, `aria-checked`, `aria-label` all present. |
| StatusBar Figma popover | PASS | Focus auto-moves to first button on open, Escape closes popover. |

---

## React Best Practices

| Check | Status | Notes |
|-------|--------|-------|
| Event listener cleanup | PASS | All `addEventListener` calls have matching cleanup in `useEffect` return. GhostCodeSnippet drag listeners cleaned up in `onMouseUp`. |
| Stale closures | PASS | `dragStartY` and `dragStartHeight` use refs correctly. `codeHeight` is in the `useCallback` deps. |
| Memo deps | PASS | `useMemo` and `useCallback` deps are correct across all changes. |
| postMessage security | PASS | `'*'` origin used only for srcdoc iframes (opaque origin -- `'*'` is required per HTML spec). |

---

## Issues Found

### 1. [WARNING] `src/components/editor/LivePreview.tsx`:46 -- Dead import after Quick Load removal

```
import { PAYMENT_CALCULATOR_CODE } from '../../templates/paymentCalculator'
```

The `handleLoadDemo` function was removed (which was the sole consumer of `PAYMENT_CALCULATOR_CODE`), but the import was left behind. This is dead code that will increase the bundle size marginally and confuse future readers.

**Fix:** Remove the import on line 46.

---

### 2. [INFO] Pre-existing: `orchestratorStore.ts` calls `window.flintAPI` directly

This is a known architectural debt item (violated the "no IPC in stores" rule) that predates this changeset. Not introduced by the current diff. Flagged for awareness only -- not blocking.

---

### 3. [INFO] Pre-existing: XYCanvas and GovernanceDashboard contain hex color values

These are in React Flow configuration props and SVG stroke attributes respectively, not in Tailwind className strings. They are pre-existing and appropriate for their contexts (library config and inline SVG). Not a Mithril violation.

---

## Changes Summary

### GhostCodeSnippet.tsx
- Auto-popup replaced with opt-in "View Source" pill button
- Escape now collapses to pill (not full dismiss)
- `manualOpen` state added alongside `dismissed`
- Programmatic open via `flint:show-code-snippet` custom event
- All a11y attributes present

### LivePreview.tsx
- `handleLoadDemo` and Quick Load UI removed entirely
- `ensureDemoTokens` selector removed
- `demoLoading` state removed
- Framework badge now always visible (was DEV-only)
- Dead `PAYMENT_CALCULATOR_CODE` import remains (WARNING)

### StatusBar.tsx
- Export gate is now a clickable `<button>` (was static span behavior)
- `cursor-pointer` added to export gate
- Gate label now counts both Mithril + a11y violations (`totalIssues`)
- Overrides fallback text simplified to "Overrides Active"

### XYCanvas.tsx
- Canvas background lightened from `bg-gray-950` to `bg-gray-900`
- ViolationIndicator changed from `<div>` to `<button>` with click handler
- AnnotationBadge changed from `<div>` to `<button>` with click handler

### GovernanceDashboard.tsx
- Grade letter size reduced from `text-6xl` to `text-3xl` (compact health section)

### GovernancePanel.tsx
- Toggle now calls `resetOverride` when re-enabling returns to default state
- Dependency array updated to include `resetOverride` and `overrides`
- Telemetry correctly records 'reset' vs 'enable'/'disable'

### flint-interaction.ts
- New `HIGHLIGHT_NODE` message handler with pulse animation
- New `.flint-highlight-pulse` CSS class with keyframe animation
- Auto-scrolls highlighted element into view
- Auto-removes highlight after 2 seconds

---

## Verdict: SHIP-WITH-FIXES

One non-blocking fix required before commit:

1. Remove the dead `PAYMENT_CALCULATOR_CODE` import from `LivePreview.tsx` (line 46).

All other changes are clean. No Commandment violations. No process boundary violations. Accessibility attributes are thorough. Tests pass and cover the new behaviors. The GovernancePanel toggle fix is a genuine logic improvement. The GhostCodeSnippet opt-in pattern and the interactive ViolationIndicator/AnnotationBadge changes are good UX and a11y wins.
