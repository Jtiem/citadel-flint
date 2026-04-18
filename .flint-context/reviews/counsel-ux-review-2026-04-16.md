# Counsel UX Review — 2026-04-16

**Reviewer:** Design-experience agent (UX audit)
**Scope:** GovernanceDashboard + ViolationCard + DiffCard + CHRON.1 reason flow
**Reviewer context:** 4-sprint Counsel redesign planned in memory; CHRON.1 just landed today

---

## Executive Summary

**Provisional Grade: B**

Counsel is a remarkably sophisticated governance surface. The verdict hierarchy is right in principle (chips → ring → breakdown → violations), the CHRON.1 risk-tiered reason input is well-implemented, and the visual system (grade-colored ring, sparkline, auto-fixable badges, hover-reveal triage) shows clear design maturity. The plain-language labels on rules (`A11Y-001 → "Missing alt text"`) and the `getRuleLabel()` lookup table are exactly the right pattern.

It falls short of an A-grade for three reasons:

1. **A real, still-present consistency defect in health-score presentation** (detailed below) — the dashboard exposes at least four co-existing ways the same "drop per violation" weight is computed, and sub-score rows in `ScoreSection` still assume a11y×10 / mithril×3 uniformly, which is not the same as the canonical severity-bucketed score used to drive the ring.
2. **Information density in the right sidebar is at the edge of overwhelming.** The dashboard composes 15+ sub-components via accordions inside a single tab. A designer in triage mode will feel pressure.
3. **Jargon leaks remain** (`MRS 42`, `ΔE` in OnboardingOverlay and PolicySettings labels, rule IDs in `title` attributes) — small but real WCAG-adjacent comprehension failures for the target audience.

With fixes to the two highest-impact items, this surface reaches A- / A territory.

---

## Critical Findings (P0 — fix before grade call)

### P0-1. Two surviving health-score formulas (the memory-flagged defect is real and has mutated)

**Status:** Real defect, partially-remediated but not eliminated. Memory `project_counsel_governance_redesign.md` flagged "two competing health score formulas" — the reality is currently worse: there are **four call sites** with **three semantically different definitions**, all of which claim to be "canonical."

**The four implementations:**

| # | File | Function | Formula | Who calls it |
|---|------|----------|---------|--------------|
| A | `src/hooks/useGovernanceHealth.ts:59` | `computeCanonicalHealthScore(c, w, i, o)` | `100 − c×10 − w×3 − i×1 − o×3` (severity-bucketed + overrides) | GovernanceDashboard ring + grade |
| B | `flint-mcp/src/core/dashboard/debtReportService.ts:142` | `computeHealthScore(c, w, i)` | `100 − c×10 − w×3 − i×1` (severity-bucketed, **no overrides**) | MCP `flint_debt_report`, `dbomService` |
| C | `flint-mcp/src/core/dashboard/debtReportService.ts:131` | `computeHealthScoreFromViolationTypes(m, a)` | `100 − a×10 − m×3` (type-bucketed, **no infos, no overrides**) | MCP `generateDebtReport` internal |
| D | `shared/healthSignal.ts:51` | `formatHealthSignal(m, a, o)` | `100 − a×10 − m×3 − o×3` (type-bucketed, with overrides, **no infos**) | ScoreSection sub-score rows |

**Worked example — a realistic project (2 critical Mithril, 3 amber Mithril, 1 advisory A11y, 2 overrides):**

- Formula A (ring/grade in Glass) = 100 − 2×10 − 3×3 − 1×1 − 2×3 = **64 (D)**
- Formula B (MCP debt report) = 100 − 2×10 − 3×3 − 1×1 = **70 (C)** ← 6 points higher because it ignores overrides
- Formula C (MCP internal, CLI debt) = mithrilCount=5, a11yCount=1 → 100 − 1×10 − 5×3 = **75 (C)** ← treats everything as type-weighted
- Formula D (ScoreSection sub-scores) = m=5, a=1, o=2 → 100 − 1×10 − 5×3 − 2×3 = **69 (D)** ← drops infos entirely

The ring will say **64 (D)**. `flint_debt_report` in the IDE will say **70 (C)**. The sub-score rows **under the ring** are narrated with Formula D math (`(−${mithrilCount * 3} pts)`), which is true in the simple case but diverges from the canonical score the moment an a11y violation has `severity='amber'` (which is possible for live-region rules per the Warden module) or an info-severity mithril violation exists.

**Why this is P0:** Flint is a governance product. If the designer sees one score in Glass and a different score in the CLI (`flint-gate audit`), or if the "fix 1 issue raises score by 3 pts" narration doesn't match the actual ring drop, trust evaporates. This is the compliance-tool equivalent of Turbotax returning different numbers depending on which tab you click.

**Evidence of the drift being live, not historical:**
- `useGovernanceHealth.ts:8` comment says *"same severity-weighted formula as debtReportService.ts"* — but `debtReportService.ts:131` implements a **different** formula (type-based) used by `generateDebtReport`.
- `HealthScoreAccordion.tsx:131` narrates `(−${mithrilCount * 3} pts)` **assuming all mithril are amber**, which breaks when the real ring was computed with a critical-severity mithril violation (which scored −10, not −3).
- `formatHealthSignal`'s JSDoc (`@deprecated`) already admits this — but `ScoreSection.tsx:194` still calls it for the sub-score rows displayed next to the ring.

**Recommended fix:**
1. Delete Formula C (`computeHealthScoreFromViolationTypes`). Route `generateDebtReport` through Formula B.
2. Delete Formula D (`formatHealthSignal`). Either drop the sub-scores or recompute them from the same `bucketViolations` output that drives the ring.
3. Add overrides into Formula B to match Formula A exactly, or explicitly document that MCP does not score overrides (since overrides are Glass-local state).
4. Change the sub-score row narration from `(−${mithrilCount * 3} pts)` to render actual per-severity drops: `${criticals} critical (−${criticals*10} pts), ${warnings} amber (−${warnings*3} pts), ${infos} advisory (−${infos*1} pts)`.
5. Add a cross-surface assertion test that renders a synthetic project through both Glass and CLI and asserts `scoreGlass === scoreMCP`.

### P0-2. Accessibility sub-score row math is inconsistent with the rest of Counsel

In `ScoreSection.tsx:370` and `HealthScoreAccordion.tsx:141`, a11y violations are narrated as `(−${a11yCount * 10} pts)`. That's correct **iff** a11y defaults to `severity='critical'` everywhere. But the Warden A11yLinter in `src/core/A11yLinter.ts` emits both critical and amber-severity a11y warnings (motion pack, live-region pack in Sprint 8). Both paths eventually hit `bucketViolations` in `useGovernanceHealth`, so an amber-severity a11y violation scores −3, not −10. The sub-score narration will overpromise by 7 points per amber-severity a11y violation.

Same root cause as P0-1 but worth calling out separately because the bug is pure-text: the narration lies before the ring even recomputes.

---

## Major Findings (P1 — fix before declaring A)

### P1-1. OverrideReasonDialog does not exist — CHRON.1 capture is inline-only

The review brief references `src/components/ui/governance/OverrideReasonDialog.tsx`. That file does not exist in the codebase. CHRON.1 reason capture happens inline in `DiffCard.tsx:444-453` (a text input that appears on amber/red risk tiers inside the approval card) — there is no standalone dialog anywhere in the Counsel surface.

This has two consequences:

- **For AI-mediated mutations** (the DiffCard flow), reason capture works well — risk-tier gating is obvious, the amber placeholder text reads `"Why is this change needed? (optional)"`, red reads `"Why is this change needed?"`, and the Apply button is disabled until non-empty for red. Good.
- **For direct user-initiated overrides** (e.g., "this violation doesn't apply, ignore it" from the Flag / Defer menu in ViolationCard), there is **no reason capture UI at all**. The defer form has a textarea labeled "Reason (optional)" but that's for snoozing, not for overriding a rule. If the designer intends to silence a rule permanently, there's no prompt for justification. The audit log will still show the rule was overridden, but without context.

**Recommendation:** Either rename the feature to "AI-override reason" in marketing and docs (to set expectation that CHRON.1 only covers the tool-call path), or build the missing OverrideReasonDialog to cover the human-initiated case (opens from ViolationCard when a user clicks "Ignore" or "Suppress rule").

### P1-2. Risk tier on DiffCard is inferred, not sourced

`DiffCard.tsx:31-35`:

```
function inferRiskTier(toolName: string): RiskTier {
    if (toolName === 'flint_delete_node' || toolName === 'flint_wrap_node') return 'amber'
    if (toolName === 'flint_insert_node') return 'amber'
    return 'green'
}
```

This is a naive name-based classifier shipped alongside the MRS (Mutation Risk Scoring) engine in `electron/mrsEngine.ts` that computes a weighted 0–100 score. The card accepts a `riskTier` override prop, so if the orchestrator wires MRS through, the Sentry score drives the gate — but the inferred path is the default. A `flint_add_class` that triggers `critical` drift will still render as "Low risk" in the card until a caller explicitly overrides.

This means CHRON.1's reason-gating promise ("amber optional, red required") can silently break: a dangerous tool call via `flint_update_props` on a root element is also "Low risk" by inference.

**Recommendation:** Make `riskTier` a required prop and have the orchestrator always resolve it from the MRS engine before emitting the PendingToolCall. Remove `inferRiskTier` entirely, or rename to `fallbackRiskTier` with a `console.warn` when it's used.

### P1-3. `MRS 42` badge is pure jargon with no disclosure

`ViolationCard.tsx:572` displays `MRS ${w.mrsScore}` as a visible badge. The `aria-label` is good ("Mutation risk score 42 out of 100, medium risk") but sighted users see only "MRS 42" — a rule-ID-like token that a non-developer cannot decode. No tooltip, no expandable "what is this?" affordance, no legend.

**Recommendation:** Either remove the visible "MRS" prefix and show just a color-coded number (the aria-label already explains), or replace with the plain-English label from the aria-label:
- `0–30` → "Low risk"
- `31–60` → "Medium risk"
- `61–100` → "High risk"

This aligns with how `DiffCard` already does it ("Low risk" / "Review" / "High risk").

### P1-4. Rule ID leakage in `title` attributes and `aria-label`

`ViolationCard.tsx:456` renders the human label (`"Missing alt text"`) as the visible text but sets `title={ruleId}` — so the tooltip on hover shows `A11Y-001`. For a designer, a hover tooltip that says `A11Y-001` is either meaningless or mildly alarming (looks like an error code).

Similarly, `onFlag`/`onUnflag`/`onCancelDefer` aria-labels use the raw ruleId: `"Flag A11Y-001 for review"`.

**Recommendation:** Use `getRuleLabel(ruleId)` everywhere the user is the audience. Rule IDs should remain in `data-testid` (for tests) and machine-readable reporting paths only.

### P1-5. OnboardingOverlay still references ΔE

`src/components/ui/OnboardingOverlay.tsx:38`:
> *"Mithril warnings appear here when a token drifts beyond the ΔE threshold."*

This is the literal first-impression copy a new user sees. It's bad practice for a non-technical tool. Replace with something like: *"Mithril flags colors and styles that drift from your design system, even by small amounts."*

PolicySettings has the same issue (`"ΔE Threshold"`, `"ΔE Critical Threshold"`) — reasonable for an advanced settings panel but should still have plain-language primaries (`"Color drift sensitivity"`) with the ΔE label demoted to a help-text footnote.

### P1-6. `/64` accordion tabs inside the right sidebar creates cognitive load

`GovernanceDashboard.tsx:415-432` wires seven accordions inside a `MoreDetailsPanel` wrapper:
- TopRulesAccordion
- SessionBaselineAccordion
- McpActivityAccordion
- TokenImpactAccordion
- PendingApprovalsAccordion
- AuditLogAccordion
- CoverageSection

Plus the top-level HealthScoreAccordion. Plus the CompactScoreSummary section. Plus the ViolationsList with its own internal grouping, resurface header, deferred header, overrides row. Plus category chips, blocking dots, effort framing, delta mode banner, export banner.

The information is all legitimately useful, but **all of it lands in one right-sidebar tab** ("governance"). Designer in flow-state triage will find the scroll fatigue real. The redesign memo accurately identifies this — Sprint 1 of the Counsel redesign should reduce to a "Verdict + 3 cards" default view with an opt-in "More details" reveal, which aligns with the `MoreDetailsPanel` pattern already in place but not yet pushed far enough.

**Recommendation:** Default-collapse everything inside `MoreDetailsPanel`. It currently has 7 nested accordions each with their own `isOpen` state — without `MoreDetailsPanel` itself being collapsed by default, these are all expand-target choices by the user. Make `MoreDetailsPanel` closed-by-default.

---

## Minor Findings (P2 — polish)

### P2-1. Empty states are inconsistent
- `NoDesignSystemEmpty` (zero tokens) has a primary CTA to import tokens. Good.
- `ZeroViolationCelebration` at `score === 100` has confetti particles, A+ grade, congratulatory copy. Good — this is the brightest moment in the surface.
- But the in-between state (`score > 0 < 100, 0 violations in delta mode`) renders just a green checkmark without the celebratory treatment. Same visual weight as a skeleton.

### P2-2. Loading state is a bare spinner
`GovernanceHeader` shows `<Loader2 className="animate-spin" />` during audit, but the dashboard body does not render a skeleton — it renders the previous audit's violations while the new audit runs. If a user hits "Run Audit" and waits 2s, they cannot tell which violations are stale. Small risk of acting on outdated data.

### P2-3. Keyboard navigation through violation list is functional but not announced
Each `ViolationCard` is a `<button>` (expand toggle), which is reachable by Tab. However, there's no roving-tabindex or list-role skip, so tabbing through 50 violations takes 50 Tab presses. Screen reader users get this as a flat list of buttons with no container-level `role="list"` annotation. `GovernanceDashboard.tsx:346` has `role="region"` on the outer div — good — but `ViolationsList` internally doesn't use `role="list"` / `role="listitem"`.

### P2-4. Color contrast on the grade letter is borderline for grade F
`GRADE_TEXT.F = 'text-red-400'` on a `bg-zinc-950` background. Tailwind `red-400` is #f87171, which against `zinc-950` (#09090b) hits approximately 5.8:1 — passes WCAG AA (4.5) but is well below AAA (7). Given that a grade F is the moment of maximum user anxiety, AAA contrast on the grade letter would be defensible. Same concern for `amber-400` (grades C and D) on grade-letter display at `text-3xl`.

### P2-5. `DiffCard` text is `text-[10px]` / `text-[11px]` hard-coded
The entire DiffCard (`DiffCard.tsx:387`) is `text-[11px]` with nested `text-[10px]` sub-elements. This is extremely small for a decision-point UI (user has to approve/reject a code mutation). Consider bumping the primary reasoning text to `text-xs` (12px) minimum.

### P2-6. Focus traps not present
There's no `<OverrideReasonDialog>` (as noted) — and `ConsensusBadge` / DiffCard approval state does not trap focus. If the designer tabs out of the approval card while the red-tier reason field is focused, their next Tab can land anywhere. This is fine-ish for an inline input but would be a P1 issue if an actual modal existed.

---

## Verified Defect Details: The Two (Four) Health Score Formulas

Full table from P0-1 repeated for clarity. The discrepancy is real, present in the code today, and affects both Glass and MCP/CLI surfaces.

| Surface | Formula | File |
|---------|---------|------|
| GovernanceDashboard ring (what the designer sees) | `100 − c×10 − w×3 − i×1 − o×3` | `src/hooks/useGovernanceHealth.ts:59` |
| MCP `flint_debt_report` (what IDE shows) | `100 − c×10 − w×3 − i×1` (no o) | `flint-mcp/src/core/dashboard/debtReportService.ts:142` |
| MCP `generateDebtReport` internal (CLI) | `100 − a×10 − m×3` (type, no i, no o) | `flint-mcp/src/core/dashboard/debtReportService.ts:131` |
| ScoreSection sub-score narration | `100 − a×10 − m×3 − o×3` (type, no i, with o) | `shared/healthSignal.ts:51` |

Three comments across these files claim "matches the canonical formula." None of them does, because they define "canonical" differently. The oldest (`formatHealthSignal`) now carries `@deprecated`, but its output still drives the sub-score rows that narrate the drop per violation.

**Test coverage:** `flint-mcp/src/core/dashboard/__tests__/debtReportService.test.ts` has tests for **both** `computeHealthScore` and `computeHealthScoreFromViolationTypes` — the tests pass because each asserts its own formula, not cross-surface parity.

---

## CHRON.1 Assessment

**Grade for CHRON.1 in isolation: A-** (solid work, with one structural gap)

What's working well:

- **Risk-tier gating on the Apply button is obvious.** Red tier disables until non-empty; amber is optional. The placeholder text copy is clear: `"Why is this change needed?"` for red vs. `"Why is this change needed? (optional)"` for amber.
- **Reason persists to display.** `ViolationCard.tsx:532-540` renders `"Overridden: {reason}"` as italic subtle text below the violation message. The filter (`overrideReason && overrideReason !== 'skipped'`) correctly suppresses the display when the amber-tier user declined to write a reason.
- **Aria-label includes reason** for screen-reader awareness: `aria-label={\`Override reason: ${overrideReason}\`}`.
- **Eager fetch on mount** in `GovernanceDashboard.tsx:123-146` populates the map without waiting for the audit log accordion to open. Performance tradeoff is deliberate: limit 200, one-shot per activeFilePath change. Sensible.
- **Filter excludes `'skipped'` and malformed JSON.** The try/catch around metadata parsing is defensive without being noisy.

Structural gaps:

- **No OverrideReasonDialog exists** (see P1-1). CHRON.1 covers the AI-mediated mutation path (DiffCard) but not the direct-user override path (click "Suppress rule" on a ViolationCard).
- **Reason is logged via `approveMutation(0, reason)` sentinel.** `orchestratorStore.ts:580-584` uses a numeric sentinel `0` because the orchestrator doesn't carry a real ledger ID. This works but it's fragile — if anything downstream tries to reconcile the ledger entry, it'll hit "ledger id 0 does not exist." Worth a refactor pass to give the orchestrator an actual mutation ID.
- **Risk tier is inferred from tool name** (P1-2 above). Until this is routed through MRS, the "amber vs red" distinction that gates the reason UI can be wrong.
- **No way to edit or delete a past override reason.** Once written, the reason is immutable via UI. For a governance product, this is arguably the right call (reason is a historical fact), but there should be a stated policy on that.

---

## Recommendations, Ordered by Impact

1. **Fix the score-formula divergence (P0-1, P0-2).** Delete the redundant formulas, route everything through one canonical function in `shared/healthSignal.ts` (or promote `useGovernanceHealth.computeCanonicalHealthScore` to the shared layer). Add a parity test that runs the same synthetic project through both Glass and CLI and asserts score equality. This single change unlocks trust in every other Counsel number.
2. **Default-collapse `MoreDetailsPanel` (P1-6).** The dashboard's information density problem is 80% solved by closing the accordions that are intermediate-use rather than first-load. The verdict hierarchy becomes: category chips → ring → "No new issues / Fix N to export" → top 3 violations → "More details (7 sections)" collapsed.
3. **Route risk tier through MRS, not tool name (P1-2).** Required prop, remove `inferRiskTier`, warn if the fallback path executes. This hardens CHRON.1's promise.
4. **De-jargon the first-impression copy (P1-4, P1-5, P2-4).** OnboardingOverlay, PolicySettings primary labels, `title` attributes in ViolationCard. Keep the terminology but demote it to help text. The Citadel vocabulary ("Mithril", "Warden", "Sentry") is fine — it's the compliance-engineer vocabulary (`ΔE`, `MRS`, rule IDs) that needs to be reserved for secondary context.
5. **Build OverrideReasonDialog or rename CHRON.1 (P1-1).** Either cover the human-initiated override case explicitly, or update docs/marketing to state that "reason on override" means "reason on AI mutation approval."
6. **Bump DiffCard type size from 10–11px to 12px minimum (P2-5).** Decision-point UI should not be smaller than body text elsewhere in the app.
7. **Skeleton the dashboard body during audit (P2-2).** When `isAuditing === true` and there are stale violations visible, dim them to 40% opacity with an overlaid "Audit running…" stripe.
8. **Add `role="list"` / `role="listitem"` to ViolationsList (P2-3).** One-line change; meaningful for screen reader users.
9. **Consider a celebratory score-90+ state** in addition to score-100 (P2-1). Designers hitting B or A should feel rewarded, not just "no issues found."

---

## Closing

Counsel is already the best-looking surface in Flint Glass. The composition pattern (14 hooks + 12 pure sub-components in one `GovernanceDashboard` shell) is enviable engineering. Sprint 2's refactor to pure sub-components paid off — the file is readable at 437 lines despite doing a lot.

The gap between "this is competent" and "this is A+" is the score-formula trust issue. A designer who sees the same project score differently in Glass, in the IDE, and in the CLI report will stop trusting any of the three. That's the single highest-leverage fix on this surface.
