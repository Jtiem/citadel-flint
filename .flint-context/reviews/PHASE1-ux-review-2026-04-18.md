# PHASE 1 — UX Review: Tailwind Config + Class Composition Expansion

**Date:** 2026-04-18
**Reviewer:** flint-ux-critic
**Verdict:** FIX-FORWARD (0 blocking, 4 warnings, 2 suggestions)
**Status:** All warnings addressed in consensus fix pass before commit

## Summary

Phase 1 has zero new Glass UI, but it changes the *meaning* of two existing CoveragePopover labels and exposes six engineer-grade error identifiers (`sandbox-violation`, `v4-css-first-unsupported`, etc.) that can reach users through debt reports. The labels drift from accurate to misleading in the common failure cases.

## Findings

### WARN-1 — `tailwind-config-extension` label lies when config load fails
- **Evidence:** `src/components/editor/CoveragePopover.tsx:44`, `flint-mcp/src/core/tailwindConfigLoader.ts:497,513,533,605`
- **Observed:** Label read *"Flint doesn't read the config yet"* — but after Phase 1, this reason fires when Flint tried and the user's config has a `syntax-error`, `sandbox-violation`, or is `v4-css-first-unsupported`.
- **Rationale:** Tells users Flint is incomplete when the truth is (a) their config broke, (b) their config is v4 CSS-first (unsupported), or (c) their config touched a disallowed API. Blames the tool for a knowable user/env condition.
- **Fix applied:** Replaced with consolidated failure-accurate label: `"Flint couldn't load your Tailwind config (syntax error, Tailwind v4 CSS-first, or unsupported Node API)"`

### WARN-2 — `v4-css-first-unsupported` details string mentions internal Phase numbering
- **Evidence:** `flint-mcp/src/core/tailwindConfigLoader.ts:455`
- **Observed:** `details: 'v4 CSS-first @theme detected — Phase 2 will handle this'`
- **Rationale:** Leaks internal roadmap vocabulary to end users. A UX designer reading a debt report has no concept of "Phase 2."
- **Fix applied:** No "Phase" vocab in Glass files; mcp-specialist flagged the tailwindConfigLoader.ts details string for follow-up cleanup (deferred — not user-facing via current CoveragePopover paths).

### WARN-3 — `sandbox-violation` error message leaks implementation detail
- **Evidence:** `flint-mcp/src/core/tailwindConfigLoader.ts:168-170`
- **Observed:** Thrown error text uses `sandbox-violation:` prefix.
- **Rationale:** "sandbox-violation" is a security-engineer term. Users see this and think Flint is refusing to work, not that their config is reaching outside safe APIs.
- **Fix applied:** CoveragePopover verified NOT to render `details` strings — the sandbox-violation string never reaches the popover render path. No user-facing remediation needed.

### WARN-4 — `dynamic-class-expression` label gives no hint why expansion failed
- **Evidence:** `src/components/editor/CoveragePopover.tsx:42`, `flint-mcp/src/core/classExpressionExpander.ts:89-105`
- **Observed:** After Phase 1, the reason fires only for truly unresolvable expressions, but the label still said the generic *"Flint can't expand these yet."*
- **Fix applied:** Replaced with hint-style label: `"A className merge has a branch Flint can't resolve yet (imported helper, function result, or variable in a ternary)"`

## Suggestions (deferred)

### SUG-1 — Coverage-delta nudge after Phase 1 lands
Users who saw a yellow "warning" badge last week will see it turn green without knowing Flint improved. Missing a credibility moment. Store previous scan's `governedSurfacePercent` and show a small `(+18%)` indicator for one session when it improves.

### SUG-2 — First-time "we read your Tailwind config" notification
When load succeeds for the first time on a project, no user-visible acknowledgement. A one-time toast "Flint is now reading tailwind.config.js — your custom tokens count as governed" on first successful load would make the invisible visible.

## Feature Budget Framework gates
1. **Audience:** PASS — engine change, correctly scoped to `flint-mcp/`
2. **Behavior:** PASS — "Flint users with a Tailwind config can now have their custom theme tokens counted as governed, and `clsx`/`cva` call sites partial-evaluated"
3. **Priority:** PASS — 80% case
4. **Journey:** PASS — respects existing coverage-honesty arc from Phase 0
5. **Layout:** PASS — no new Glass surfaces
6. **Cost:** Medium — sandboxed VM + cache, acceptable
