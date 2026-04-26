# PHASE 2 — UX Review: PostCSS + CSS Modules + Tailwind v4 CSS-First

**Date:** 2026-04-18
**Reviewer:** flint-ux-critic
**Verdict:** FIX-BEFORE-SHIP → PASS after fixes applied
**Status:** All blockers + warnings addressed before commit

## Summary

Phase 2 is MCP-engine-only with zero new Glass UI. But Phase 2 changed the MEANING of 3 Phase 0 CoveragePopover labels — they no longer accurately describe when the reason fires.

## Findings

### BLK-1 — `external-stylesheet-imported` label lied post-Phase-2
- **Evidence:** `src/components/editor/CoveragePopover.tsx:40`
- **Observed:** Label said *"Imports an external stylesheet — Flint doesn't read .css/.scss files yet"* — but after Phase 2, Flint DOES read them. The reason now fires only on failure (parse error, missing file, too-large, unsupported syntax).
- **Fix applied:** Replaced with `"Flint couldn't read an imported stylesheet (missing file, parse error, or over 2MB size limit)"`.

### BLK-2 — `css-modules-reference` label lied post-Phase-2
- **Evidence:** `src/components/editor/CoveragePopover.tsx:41`
- **Observed:** Label said *"Uses CSS Modules — Flint doesn't resolve module class maps yet"* — Phase 2 MEANS Flint resolves them. Reason fires only on failure.
- **Fix applied:** Replaced with `"Flint couldn't resolve a CSS Modules import (missing file, parse error, or outside your project)"`.

### WARN-1 — `unresolvable-var` ambiguous
- **Evidence:** `src/components/editor/CoveragePopover.tsx:43`
- **Observed:** Label said *"References a CSS variable Flint can't resolve"* — didn't explain why.
- **Fix applied:** Replaced with `"References a CSS variable Flint couldn't resolve (not defined in any :root block, or circular reference)"`.

### WARN-2 — Error ordering
- **Evidence:** `src/components/editor/CoveragePopover.tsx:122`
- **Observed:** Multiple reasons rendered in whatever order `nonZeroReasons` returned. No hierarchy between user-fixable and environmental causes.
- **Fix applied:** Added `REASON_PRIORITY` map. User-fixable reasons (parse-failure, non-literal-ternary-branch, dynamic-class-expression, unresolvable-var) now sort above environmental reasons (external-stylesheet-imported, css-modules-reference, tailwind-config-extension, css-in-js-detected, non-jsx-framework).

## Suggestions (deferred)

### SUG-1 — Coverage-delta nudge
Phase 2 is the biggest governed-% jump in the roadmap. Users who had 30% might see 85%+ on the next scan. A small `(+55%)` indicator in the popover would surface the improvement. Not required for ship.

### SUG-2 — One-time notification when delta ≥+20%
Combined with SUG-1 this would make Phase 2 feel like a capability expansion rather than invisible plumbing. Flag for follow-up.

## Gate Results

1. **Audience:** PASS — Engine-only, coverage labels surface to Designer via Glass
2. **Behavior:** PASS — Users see real coverage reflecting resolved stylesheets
3. **Priority:** PASS — 80% case (CSS Modules + external sheets near-universal)
4. **Journey:** PASS — OPP-7 (governance trust) reinforced by honest labels
5. **Layout:** PASS — Zero Glass surface change
6. **Cost:** PASS — Copy-only string updates
